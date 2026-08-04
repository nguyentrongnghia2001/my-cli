# SPEC — wsedit workspace UI (v1)

> **Historical document.** This specification records the legacy Node/Blessed TUI.
> Current CLI behavior is determined by source and executable tests. Active desktop
> product decisions begin at [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md).
> Do not use this file to expand the desktop MVP.

Trạng thái: draft, chờ chốt các câu hỏi mở ở §12.
Phạm vi: thêm lệnh `wsedit ui [dir]` — một workspace UI kiểu VS Code chạy hoàn toàn trong terminal.

> Tiếp theo v1: `SPEC-multi-agent.md` — chạy nhiều agent CLI song song trên cùng một repo
> (split pane, cô lập bằng git worktree, phím dẫn). Cùng nền tảng Node + blessed + node-pty.

---

## 1. Mục tiêu

Một cửa sổ TUI duy nhất cho vòng lặp làm việc thường ngày: duyệt file → mở nhiều file
→ sửa → lưu → chạy lệnh/agent, không phải rời terminal và không cần Electron.

**Mục tiêu chất lượng**

- Khởi động < 300ms trên repo vừa (≤ 5k file), không treo trên repo lớn.
- Chạy được qua SSH và trong Windows Terminal / PowerShell.
- Giữ nguyên triết lý trong README: vài trăm KB, không Chromium.

**Phi mục tiêu (v1)** — nói rõ để không bị trôi phạm vi:

- Không LSP, không IntelliSense, không autocomplete.
- Không debugger, không extension system, không settings UI.
- Không multi-root workspace (mở đúng 1 thư mục gốc).
- Không git integration (không gutter blame, không diff view).
- Không theme tuỳ biến — dùng 1 palette cố định.

---

## 2. Phạm vi v1 (đã chốt)

| # | Tính năng | Ghi chú |
|---|-----------|---------|
| 1 | Explorer: cây thư mục expand/collapse | Lazy load từng cấp |
| 2 | Tab đa file + editor sửa được | Có gutter số dòng, Ln/Col |
| 3 | Quick open `Ctrl+P` | Fuzzy theo tên file |
| 4 | Terminal panel: nhiều tab, chạy lệnh, chạy agent | PTY thật |
| 5 | Status bar | Path, Ln/Col, EOL, encoding, language |

**Hoãn sang v2 (không làm trong v1)**

- Tìm chuỗi trong toàn workspace (`Ctrl+Shift+F`) — *không được chọn ở v1*.
- Syntax highlight trong lúc gõ — *không được chọn ở v1*. Lệnh `wsedit view` vẫn
  giữ highlight như hiện tại; vùng editor của UI hiển thị text thuần.
- Selection, copy/paste, undo/redo, soft wrap, tìm trong 1 file.
- Split editor (chia đôi vùng editor).

Bốn thứ ở nhóm sau (selection/undo/clipboard/wrap) là những gì người dùng
**sẽ lập tức thấy thiếu** khi gõ thật. Tôi đề xuất đưa undo + clipboard lên v1.5
ngay sau khi v1 chạy được, đừng để lâu hơn.

---

## 3. Kiến trúc & cấu trúc file

`bin/wsedit.js` hiện tại là single-file ~180 dòng. Workspace UI không thể ở chung
một file, nên đây là lúc dùng đúng escape clause trong CLAUDE.md ("chỉ tách module
khi file đã quá dài để đọc"). Tách theo hướng: **bin chỉ wiring, logic vào `src/`**.

```
bin/wsedit.js              # chỉ định nghĩa command + gọi action. Không còn logic.
src/
  commands/
    view.js                # chuyển từ bin, giữ nguyên hành vi
    ls.js                  # chuyển từ bin, giữ nguyên hành vi
    edit.js                # chuyển từ bin, giữ nguyên hành vi (editor 1 file cũ)
    ui.js                  # entry mới: dựng screen, khởi tạo state, mount panes
  core/
    workspace-state.js     # state tập trung + emit thay đổi
    keymap.js              # bảng phím + dispatcher theo focus
    fs-tree.js             # đọc thư mục theo từng cấp, ignore set
    file-index.js          # index tên file cho quick open
    fuzzy.js              # thuật toán match + score (pure, test được)
    text-buffer.js         # mảng dòng + cursor + các thao tác sửa (pure, test được)
    language.js            # guessLang() chuyển từ bin, dùng lại cho status bar
  ui/
    layout.js              # tính toạ độ/kích thước 5 vùng, xử lý resize
    explorer.js
    tab-bar.js
    editor-view.js         # render buffer + gutter + cursor
    terminal-panel.js      # nhiều pty tab
    status-bar.js
    quick-open.js          # overlay
    prompt.js              # hộp nhập 1 dòng dùng chung (run command, xác nhận)
```

**Nguyên tắc bắt buộc**

- CommonJS, `require`, `"use strict"` — giữ đúng style hiện tại (xem CLAUDE.md).
- `core/` **không** được `require("blessed")`. Đây là ranh giới cho phép test logic
  (fuzzy, text-buffer) mà không cần dựng terminal.
- Widget không tự giữ sự thật. Mọi thay đổi đi qua `workspace-state.js`, widget chỉ
  render từ state. Nếu để blessed giữ state, tab + dirty flag + focus sẽ lệch nhau.
- 3 lệnh `view`/`ls`/`edit` phải hoạt động **y như trước** sau khi refactor. Đây là
  điều kiện nghiệm thu của Phase 1, không phải "dọn sau".

**Quyết định:** thêm lệnh mới `wsedit ui [dir]` thay vì đổi hành vi của `wsedit`
không tham số (hiện in help). Đổi lệnh trần thành mở UI là breaking change và làm
mất đường in help nhanh.

---

## 4. Layout

```
┌─ EXPLORER ──┬─ index.js ●  app.vue × ─────────┐  ← tab bar (1 dòng)
│ ▾ src/      │  1  import { ref } from 'vue'   │
│   ▾ compo…  │  2                              │
│      app.v… │  3  export function useCart() { │  ← editor (gutter + text)
│   index.js  │  4    const items = ref([])     │
│   pkg.json  │  5    return { items }          │
├─────────────┴─────────────────────────────────┤
│ TERMINAL  1: pwsh ×  2: claude ×              │  ← terminal tab bar (1 dòng)
│ PS C:\proj> npm test                          │
│ ✓ 12 passed                                   │  ← terminal panel (pty)
├───────────────────────────────────────────────┤
│ src/index.js ●  Ln 4, Col 22  CRLF  UTF-8  JS │  ← status bar (1 dòng)
└───────────────────────────────────────────────┘
 Ctrl+P file  Ctrl+` terminal  Ctrl+S lưu  Ctrl+Q  ← hint bar (1 dòng)
```

**Quy tắc kích thước**

| Vùng | Kích thước |
|------|-----------|
| Sidebar | rộng 28 cột, min 18, max 50%; ẩn bằng `Ctrl+B` |
| Terminal panel | cao 35% màn hình, min 6 dòng; ẩn mặc định, mở bằng ``Ctrl+` `` |
| Status bar + hint bar | mỗi cái đúng 1 dòng, luôn hiện |
| Editor | phần còn lại |

- Terminal đóng → editor giãn hết chiều cao.
- Màn hình < 60 cột → sidebar tự ẩn. < 16 dòng → terminal tự đóng.
- Mọi thay đổi kích thước phải gọi `pty.resize(cols, rows)` cho **mọi** terminal tab
  đang mở, không chỉ tab active — nếu bỏ sót, output tab nền sẽ bị gãy dòng.

---

## 5. State model

```js
{
  root: "C:/Dtsmart/my-cli",     // path tuyệt đối, resolve 1 lần khi khởi động
  focus: "explorer",             // explorer | editor | terminal | overlay
  sidebarVisible: true,
  terminalVisible: false,

  tree: {
    // key = path tuyệt đối
    "C:/…/src": { expanded: true, loaded: true, children: ["…/src/index.js"] }
  },
  treeCursor: "C:/…/src/index.js",   // dòng đang chọn trong explorer

  editors: {
    activeId: "e1",
    tabs: [{
      id: "e1",
      filePath: "C:/…/src/index.js",
      lines: ["import …", ""],       // luôn tách theo \n, EOL gốc lưu riêng
      eol: "CRLF",                   // giữ nguyên khi lưu
      cursor: { line: 3, col: 21 },  // 0-based trong state, +1 khi hiện ra status bar
      scroll: { top: 0, left: 0 },
      dirty: false,
      readOnly: false                // true khi file > 2MB
    }]
  },

  terminals: {
    activeId: "t1",
    tabs: [{ id: "t1", title: "pwsh", pty: <handle>, vt: <emulator>, exited: false }]
  }
}
```

`file-index.js` giữ danh sách path riêng ngoài state (chỉ quick open dùng, không cần
re-render khi đổi).

---

## 6. Keymap & điều phối focus

Dispatcher duy nhất ở `keymap.js`. Thứ tự xử lý: **global → overlay → pane đang focus.**

**Global (mọi lúc)**

| Phím | Hành động |
|------|-----------|
| `Ctrl+Q` | Thoát (hỏi nếu còn tab dirty) |
| `Ctrl+P` | Quick open |
| `Ctrl+B` | Ẩn/hiện sidebar |
| ``Ctrl+` `` | Ẩn/hiện + focus terminal panel |
| `F6` | Luân chuyển focus explorer → editor → terminal |
| `Ctrl+S` | Lưu tab đang mở |
| `Ctrl+W` | Đóng tab đang mở |
| `Alt+1…9` | Nhảy tới tab editor thứ n |

**Explorer**: `↑`/`↓` di chuyển · `→`/`Enter` mở rộng thư mục hoặc mở file · `←` thu gọn ·
`Ctrl+R` reload thư mục đang chọn.

**Editor**: phím ký tự chèn text · `Enter` · `Backspace` · `Delete` · phím mũi tên ·
`Home`/`End` · `PgUp`/`PgDn` · `Tab` chèn 2 space.

**Terminal (quan trọng)**: khi focus là terminal, **mọi phím được forward xuống PTY**,
chỉ giữ lại đúng 2 phím: ``Ctrl+` `` (rời panel) và `F6` (đổi focus).

- Nghĩa là `Ctrl+C` đi xuống tiến trình con để kill nó, **không** thoát wsedit. Đây là
  yêu cầu bắt buộc, không phải tuỳ chọn — thiếu nó thì không dùng được agent nào.
- Đánh đổi: `Ctrl+P`/`Ctrl+S` **không** hoạt động khi đang gõ trong terminal. Chấp nhận,
  vì tranh phím với agent tương tác gây bug khó hiểu hơn nhiều.

**Terminal panel (khi focus panel nhưng thêm modifier)**: ``Ctrl+Shift+` `` tab mới ·
`Ctrl+Shift+R` prompt "Chạy lệnh:" → mở tab mới chạy lệnh đó · `Alt+←/→` đổi terminal tab.

Rủi ro: nhiều terminal emulator **không phân biệt** được `Ctrl+Shift+<key>`. Phase 0
phải kiểm tra trên Windows Terminal; nếu không nhận, đổi sang `Ctrl+T` (tab mới) và
`Ctrl+R` (run).

---

## 7. Đặc tả từng thành phần

### 7.1 Explorer

- **Lazy load từng cấp.** Không dùng lại hàm `walk()` đệ quy sync hiện có — nó đọc
  toàn bộ cây và sẽ treo UI trên repo lớn. `walk()` vẫn giữ nguyên cho lệnh `ls`.
- Ẩn `node_modules`, `.git`, `dist`, `build` (dùng chung ignore set với `ls` để hai
  chỗ không lệch nhau). v1 không có toggle hiện file ẩn.
- Thư mục trước file, rồi sort theo tên (`localeCompare`).
- Thụt lề 2 space mỗi cấp; tên dài hơn chiều rộng sidebar thì cắt bằng `…`.
- Đánh dấu: `▾` mở, `▸` đóng, file không có marker.
- Mở file đã mở rồi → nhảy tới tab đó, không tạo tab trùng.

### 7.2 Tab bar + Editor

**Tại sao viết editor riêng thay vì dùng `blessed.textarea`:** textarea không cho biết
vị trí cursor và scroll offset một cách đáng tin, nên không thể vẽ gutter số dòng khớp
dòng, cũng không hiện được Ln/Col. Cả hai đều nằm trong phạm vi v1 → tự quản buffer là
đường ngắn hơn là chọc vào nội tại của textarea.

- Buffer là mảng dòng (`text-buffer.js`, pure, không biết gì về blessed).
- Gutter rộng `digits(số dòng) + 2`, màu `chalk.gray`, phân cách bằng `│`.
- Chỉ render đúng số dòng nằm trong viewport — không render cả file.
- Dòng dài hơn viewport: cuộn ngang theo cursor (không wrap trong v1).
- Tab title: tên file; `●` khi dirty; `×` để đóng.
- Đóng tab dirty → prompt `Lưu thay đổi? (y/n/esc)`.
- **Lưu file phải giữ EOL gốc.** Detect EOL khi mở (đếm `\r\n` vs `\n`, nhiều hơn thì
  thắng), join lại đúng loại đó khi lưu. Bỏ qua điều này là làm bẩn cả diff git trên
  Windows.
- File > 2MB: mở read-only, status bar ghi rõ `[read-only: file lớn]`.
- File có byte `NUL` trong 8KB đầu: coi là binary, từ chối mở, báo "Không mở được file
  binary". Không mở rồi hiện rác.
- Encoding v1: chỉ UTF-8.

### 7.3 Quick open (`Ctrl+P`)

- Overlay giữa màn hình: 1 dòng input + tối đa 12 kết quả.
- Index build **bất đồng bộ khi khởi động** (dùng ignore set), UI không chờ. Trong lúc
  chưa xong, overlay hiện "Đang lập index…".
- Giới hạn 20.000 file. Vượt thì dừng và **hiện cảnh báo trên status bar** — không âm
  thầm cắt, vì người dùng sẽ tưởng file không tồn tại.
- Match: fuzzy subsequence không phân biệt hoa thường. Điểm cộng cho: khớp liên tiếp,
  khớp ở tên file thay vì thư mục, khớp đầu segment. Tất cả trong `fuzzy.js` (pure).
- Hiện tên file + path tương đối mờ phía sau. `↑`/`↓` chọn, `Enter` mở, `Esc` đóng.
- Refresh index khi lưu file mới hoặc `Ctrl+R` trong explorer.

### 7.4 Terminal panel

Đây là phần khó nhất và là lý do có Phase 0.

**Bắt buộc PTY thật.** `child_process.spawn` + đổ stdout vào box chỉ chạy được lệnh
one-shot; agent tương tác và `vim`/`less` cần pseudo-terminal để nhận key, biết kích
thước, và điều khiển cursor. Dùng `node-pty` — cùng thư viện VS Code dùng.

Để hiển thị output của PTY trong 1 pane, cần một VT emulator dịch escape sequence thành
lưới ký tự rồi vẽ vào blessed. Hai đường:

- **A (thử trước):** `blessed-xterm` — widget blessed bọc sẵn xterm + node-pty, làm
  đúng việc này. Tiết kiệm nhiều công nhưng là package cũ; **phải kiểm tra tính tương
  thích với Node 18+ trong Phase 0**, tôi không xác nhận được điều đó mà không chạy thử.
- **B (fallback):** `node-pty` + `xterm-headless` tự viết painter: feed data vào
  emulator, đọc buffer, vẽ từng cell vào blessed box. Chủ động hoàn toàn, tốn khoảng
  1–2 ngày và là phần dễ sinh bug render nhất.

**Hành vi**

- Tab đầu tiên mở shell mặc định: Windows → `pwsh` nếu có, không thì `powershell.exe`;
  còn lại → `process.env.SHELL || "bash"`. cwd = `root`.
- Nhiều tab độc lập, mỗi tab 1 pty. Tab bar hiện `1: pwsh`, `2: claude`.
- Tiến trình thoát → tab ghi `[đã thoát: code N]`, giữ lại nội dung để đọc, đóng bằng `×`.
- Thoát wsedit → **kill toàn bộ pty** (`SIGKILL` sau `SIGTERM` 2s). Bỏ sót là để lại
  tiến trình mồ côi.
- Scrollback 5.000 dòng/tab, `Shift+PgUp`/`Shift+PgDn` cuộn.
- **Agent không phải tính năng riêng.** `claude`, `codex`, `gemini` chạy được vì đó là
  PTY thật với key forwarding đầy đủ. Không hardcode tên agent nào.

### 7.5 Status bar

Trái: path tương đối của tab active + `●` nếu dirty.
Phải: `Ln x, Col y` · EOL (`LF`/`CRLF`) · `UTF-8` · tên ngôn ngữ từ `guessLang()`.
Thông báo tạm (đã lưu, cảnh báo index) chiếm chỗ giữa, tự mất sau 2s — dùng lại đúng
kiểu `setStatus(msg, ttl)` đã có trong `edit` hiện tại.

---

## 8. Dependency mới

| Package | Vì sao | Rủi ro |
|---------|--------|--------|
| `node-pty` | PTY thật cho terminal/agent | **Native module.** Windows cần ConPTY (Win10+, máy bạn Win11 → OK) và có thể cần Visual Studio Build Tools nếu không có prebuilt binary cho phiên bản Node đang dùng |
| `blessed-xterm` *hoặc* `xterm-headless` | Dịch escape sequence → lưới ký tự | Xem §7.4, chốt ở Phase 0 |

Không thêm gì khác. `chalk` vẫn **giữ ở `^4`** — v5 là ESM-only, `require()` sẽ vỡ.

`node-pty` phá vỡ tính chất "cài là chạy" hiện tại của project. Cần ghi vào README:
yêu cầu build tools, và cách hạ cấp nhẹ nhàng nếu cài thất bại (xem §9).

---

## 9. Rủi ro & cách giảm

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|-----------|
| `node-pty` cài thất bại trên máy người dùng | Cao | Đưa vào `optionalDependencies`; nếu `require` fail thì UI vẫn chạy đủ 4 vùng còn lại, terminal panel hiện "Terminal không khả dụng: chưa cài node-pty" kèm lệnh sửa. Không để cả app chết vì một pane |
| `blessed-xterm` không chạy với Node hiện tại | Trung bình | Phase 0 spike; fallback đường B |
| Render pane terminal chậm khi agent vẽ nhiều | Trung bình | Throttle repaint ~30ms, gộp nhiều chunk pty thành 1 lần vẽ |
| Xung đột phím với agent bên trong | Trung bình | Chỉ giữ 2 phím (§6) |
| Tự viết editor sinh bug con trỏ | Trung bình | `text-buffer.js` là pure module → viết unit test cho insert/delete/newline/biên |
| Blessed để lại terminal hỏng khi crash | Cao | `screen.destroy()` trong `finally` + `process.on("uncaughtException")` restore rồi mới in stack. Đang là điểm yếu của code hiện tại |

---

## 10. Lộ trình

**Phase 0 — Spike terminal (0.5–1 ngày). Cổng quyết định.**
Một file thử độc lập: dựng blessed screen + 1 pane pty, chạy `pwsh`, rồi chạy một agent
tương tác trong đó. Kiểm: gõ được, `Ctrl+C` kill được tiến trình con, resize đúng, màu
đúng, không nháy.
*Done khi:* chốt được đường A hoặc B, và xác nhận `Ctrl+Shift+<key>` có nhận trên
Windows Terminal hay không. Không code Phase 1+ trước khi qua cổng này.

**Phase 1 — Khung UI (1–2 ngày)**
Tách module theo §3, `wsedit ui`, 5 vùng, layout + resize, focus dispatcher, explorer
lazy load, mở file **read-only** vào editor, status bar.
*Done khi:* `view`/`ls`/`edit` cũ chạy y như trước; duyệt cây và xem file được; đổi
kích thước cửa sổ không vỡ layout.

**Phase 2 — Editor sửa được + tab (2–3 ngày)**
`text-buffer.js` + `editor-view.js` + tab bar + lưu + dirty + prompt + giữ EOL + guard
file lớn/binary.
*Done khi:* mở 3 file, sửa, lưu, EOL không đổi, đóng tab dirty có hỏi.

**Phase 3 — Quick open (0.5–1 ngày)**
`file-index.js` + `fuzzy.js` + overlay.
*Done khi:* `Ctrl+P` gõ vài ký tự ra đúng file trên repo ≥ 1k file, không lag.

**Phase 4 — Terminal pane
l (1–2 ngày, phụ thuộc Phase 0)**
Nhiều tab, prompt run, resize, cleanup khi thoát, fallback khi thiếu `node-pty`.
*Done khi:* chạy `npm test` ở tab 1 và một agent tương tác ở tab 2 cùng lúc; thoát
wsedit không để lại tiến trình mồ côi.

**Phase 5 — Hoàn thiện (0.5–1 ngày)**
Xử lý lỗi, restore terminal khi crash, cập nhật README + **CLAUDE.md** (cấu trúc module
mới làm mục §Structure hiện tại lỗi thời).

Tổng: **6–10 ngày làm việc**, sai số chủ yếu nằm ở Phase 0/4.

---

## 11. Nghiệm thu

Project chưa có test runner. Đề xuất (không bắt buộc): thêm `node:test` **chỉ cho 2
module pure** `fuzzy.js` và `text-buffer.js` — đó là chỗ logic dễ sai và test được rẻ.
Phần UI kiểm thủ công theo checklist:

- [ ] `wsedit view`, `wsedit ls`, `wsedit edit` hoạt động như trước khi refactor
- [ ] `wsedit ui` mở đúng thư mục hiện tại; `wsedit ui ../khac` mở đúng thư mục chỉ định
- [ ] Duyệt cây, mở/thu gọn, mở file; repo có `node_modules` không làm chậm khởi động
- [ ] Mở 3 file, sửa cả 3, `Ctrl+S` từng file → nội dung trên đĩa đúng, EOL không đổi
- [ ] Đóng tab dirty → có prompt; chọn `n` → mất thay đổi đúng như mong đợi
- [ ] `Ctrl+P` tìm ra file ở thư mục sâu
- [ ] Terminal: chạy lệnh dài (`npm install`), output cuộn đúng
- [ ] Terminal: chạy agent tương tác, gõ được, `Ctrl+C` kill agent chứ không thoát wsedit
- [ ] Mở 2 terminal tab, đổi kích thước cửa sổ → cả 2 tab đều không gãy dòng
- [ ] `Ctrl+Q` khi còn tab dirty → có hỏi; sau khi thoát terminal sạch, không tiến trình sót
- [ ] Ép lỗi (mở file không có quyền đọc) → báo lỗi rõ, terminal không hỏng
- [ ] Cửa sổ 60×16 → vẫn dùng được; 40×10 → suy giảm có kiểm soát, không crash

---

## 12. Câu hỏi mở

1. **Shell mặc định trên Windows:** `pwsh` → `powershell.exe` → `cmd.exe` theo thứ tự
   ưu tiên, đúng chứ? (Giả định hiện tại: đúng.)
2. **Undo/redo + copy/paste:** giữ ở v1.5 như đề xuất §2, hay kéo vào v1 (thêm ~1–2 ngày)?
3. **`node-pty`:** đồng ý đặt `optionalDependencies` để UI vẫn chạy khi cài fail?
4. **Sửa file ngoài root:** quick open và explorer chỉ trong `root`. Cần mở file ngoài
   root không (v1 giả định: không)?
