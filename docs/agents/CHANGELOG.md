# CHANGELOG — theo từng Phase

> **Historical implementation log.** Pass counts and “done” labels below describe past
> runs and may be stale. Current claims require fresh executable evidence. This file is
> not a product plan; see `../PRODUCT_DIRECTION.md`.

Mỗi agent thêm **1 dòng** vào đúng Phase của task mình, dạng:

```
- [T1.2] `src/core/fs-tree.js` — đọc 1 cấp + sort thư mục trước file. (agy)
```

Luật: thêm dòng vào cuối mục của Phase, không sửa dòng người khác, không đổi mục "Đã chốt".
Mục `Đã biết chưa xong` là nơi ghi thẳng những gì **không** làm được — để trống là khai gian.

---

## Phase 0 — Spike terminal ✅ ĐÃ XONG (trừ mục cần TTY thật)

Chi tiết đầy đủ: `docs/agents/PHASE0.md`.

**Đã chốt**

- Chọn **đường A**: `blessed-xterm@1.6.0` + `node-pty`. Không tự viết VT painter.
- `blessed-xterm` **không cũ** như SPEC §7.4 lo ban đầu: `@xterm/headless@6.0.0`, `node-pty@1.2.0-beta.14`, có `.d.ts`.
- Cài **không cần** Visual Studio Build Tools (prebuilt, ~2s). Rủi ro SPEC §9 hạ từ Cao → Thấp.
- Forward `\x03` giết được child (1868ms) → `Ctrl+C` xuống agent khả thi.
- 2 pty song song OK; tab **ẩn vẫn nhận output**; `injectInput()` hoạt động; không lẫn nội dung.
- Đường thoát: `screen.destroy()` → `process.exit(0)`, **không** `pty.kill()`.
  Không có tiến trình mồ côi (ConPTY tự dọn).

**Đã biết chưa xong**

- Resize tới được ConPTY, nhưng **child Node không được thông báo tự động** — agent viết bằng
  Node/ink có thể không re-layout khi đổi kích thước. Không sửa được từ parent; ghi vào README.
- 4 mục PHASE0 §8 (gõ mượt/nháy, màu, agent thật, `Ctrl+Shift+<key>`) **chưa xác nhận** — cần TTY thật, User tick.
- `pty.kill()` làm `conpty_console_list_agent.js` crash `AttachConsole failed`, đổ stack ra stderr.
  Tránh được bằng cách không gọi `kill()` — nhưng nếu sau này cần kill 1 tab lẻ thì phải xử lý lại.

---

## Phase 1 — Khung UI

- [T1.2] `src/core/fs-tree.js` — đọc 1 cấp, sort thư mục trước file. (agy)
- [T1.3] `src/ui/layout.js` — tính toán hình học số nguyên cho 7 vùng. (agy)
- [T1.4] `src/core/keymap.js` — dispatcher ưu tiên terminal forward. (agy)
- [T1.5] `src/ui/status-bar.js` — widget thanh trạng thái hiển thị file path, cursor Ln/Col, EOL, encoding, ngôn ngữ và thông báo tạm. (agy)
- [T1.6] `src/ui/explorer.js` — duyệt cây thư mục, lazy load, chọn file. (agy)
- [T1.7] `test/smoke-ui.test.js` — headless harness cho blessed screen. (agy)
- [T1.8] `src/commands/ui.js` — entrypoint `wsedit ui`: dựng screen, mount widget, dispatcher, resize,
  đường thoát `screen.destroy()` + `process.exit(0)`, bọc `uncaughtException` để không hỏng terminal. (Lead)
- [T1.8] `tools/ui-smoke.js` — chạy `wsedit ui` trong pty thật rồi bấm phím vào nó. Đây là thứ
  `node --test` không làm được: test headless chỉ chứng minh lệnh **từ chối** chạy khi thiếu TTY. (Lead)
- [T1.8] Sửa: chỉ đổi `state.focus` là chưa đủ — blessed chỉ gửi keypress tới element đang focus,
  nên explorer không nhận được phím nào. Thêm `applyFocus()`. (Lead)
- [T1.6] Sửa `explorer.js`: bỏ file IO khỏi widget, `render()` không còn mutate state. (Lead)

**Đã biết chưa xong**

- (trống)

---

## Phase 2 — Editor sửa được + tab

- [T2.1] `src/core/text-buffer.js` — quản lý buffer theo mảng dòng, mutate tại chỗ, giữ nguyên EOL gốc. (agy)
- [T2.2] `src/core/workspace-state.js` — quản lý state và event theo SPEC. (agy)
- [T2.5] `src/ui/prompt.js` — overlay nhập liệu ask và confirm. (agy)
- [T2.6] Nối vào `ui.js`: mở file kèm policy >2MB read-only + từ chối binary, sửa/lưu giữ nguyên EOL,
  `Ctrl+W` đóng tab dirty có hỏi, `Ctrl+Q` thoát có hỏi. (Lead)
- [T2.6] Sửa bug nặng: cùng một phím Enter bị xử lý hai lần — explorer mở file rồi đổi focus, sau đó
  handler editor chèn thêm dòng trống vào chính file vừa mở, làm nó dirty ngay lúc mở. Hoãn `setFocus`
  sang tick sau. (Lead)
- [T2.4] `src/ui/tab-bar.js` — render tab bar kèm bullet dirty, nút close và hỗ trợ overflow. (agy)

**Đã biết chưa xong**

- (trống)

---

## Phase 3 — Quick open

- [T3.1] `src/core/fuzzy.js` — thuật toán rank với điểm thưởng đoạn nối và segment. (agy)
- [T3.2] `src/core/file-index.js` — index bất đồng bộ với cờ truncated. (agy)
- [T3.4] Nối `Ctrl+P` + cảnh báo khi index bị cắt vào `ui.js`. (Lead)
- [T3.3] Sửa `quick-open.js`: box gốc thiếu `parent: screen` nên `input.focus()` đọc toạ độ của
  parent null → TypeError, **sập cả app** ngay khi bấm Ctrl+P. Chỉ lộ ra khi chạy trong pty thật. (Lead)
- [T3.3] `src/ui/quick-open.js` — overlay input và list kết quả filter bằng module fuzzy. (agy)

**Đã biết chưa xong**

- (trống)

---

## Phase 4 — Terminal panel

- [T4.1] `src/ui/terminal-panel.js` — nhiều pty tab, `ignoreKeys` chỉ giữ 2 phím, fallback khi
  thiếu node-pty. Nhận cả vùng gộp lẫn dạng tách, tự cắt 1 dòng cho thanh tab của nó. (codex)
- [T4.2] Nối vào `ui.js`: `Ctrl+T` mở pane/tab mới, `Ctrl+R` (chỉ ở editor) hỏi lệnh rồi chạy,
  `Alt+←/→` đổi tab. Panel tạo trễ vì khởi tạo là spawn shell ngay. (Lead)
- [T4.2] `tools/ui-smoke.js` mở rộng: gõ lệnh thật vào pane và đợi output, resize khi terminal
  đang mở, và kiểm **không sót tiến trình mồ côi** bằng probe có dấu trong dòng lệnh. 12/12. (Lead)
- Test cho `tab-bar` và `quick-open` — hai widget trước đó không có test nào. (agy)

**Đã biết chưa xong**

- Codex không trả về được báo cáo review (task treo phía nó). Lead tự kiểm 6 luật cứng PHASE0
  trên bản trên đĩa thay vì tin báo cáo — nhưng **chưa có ai đọc kỹ toàn bộ** `terminal-panel.js`.
  Đã giao lại cho codex ở T5.2.
- `Ctrl+\`` chưa từng được bấm thử bằng máy: smoke test dùng `Ctrl+T` vì chính `Ctrl+\`` là thứ
  PHASE0 §8 chưa xác nhận. Vẫn cần User tick.

---

## Phase 5 — Hoàn thiện

- [T5.1] `uncaughtException` + `unhandledRejection` → `screen.destroy()` rồi mới in stack.
  Đã có sẵn từ T1.8, nay xác nhận lại trên code thật. (Lead)
- [T5.3] `README.md` — thêm lệnh `ui`, bảng phím, yêu cầu `node-pty`, mục hạn chế đã biết. (agy)
- [T5.4] `CLAUDE.md` — viết lại mục Structure: file cũ vẫn ghi "everything lives in a single
  file" và dặn **không** tạo cây `src/`, tức là chỉ dẫn ngược hẳn với code thật. Thêm mục
  Testing (gồm bẫy `npm test` và bẫy `node --test test/`), 3 ranh giới kiến trúc, và các
  luật cứng của `ui`. (Lead)

- [T5.2] Review chéo toàn bộ v1: 3 mục Cao, 9 Trung, 3 Thấp. (codex)
- [T5.2] Sửa 2/3 mục Cao sau khi Lead tự xác minh lại trên code:
  - **Overlay không chặn phím.** Handler cấp screen có `if (state.focus === "overlay") return`
    nhưng **không chỗ nào đặt giá trị đó**. Hậu quả: gõ vào ô nhập của prompt/quick open thì
    phím chảy tiếp xuống editor và sửa luôn file đang mở. Thêm `enterOverlay`/`leaveOverlay`/
    `withOverlay` trong `ui.js`; `quick-open.close()` gọi `actions.closeOverlay()` thay cho
    `actions.cycleFocus()` (cái cũ đẩy focus sang vùng kế tiếp chứ không trả về chỗ cũ).
  - **Tab bar chưa bao giờ được vẽ.** Hai lỗi chồng nhau trong `tab-bar.js`: thiếu
    `parent: screen`, và `setGeometry` gán `element.left` thay vì `element.position.left`
    nên hình học không áp vào (các widget khác đều dùng `element.position`).
- [T5.2] `tools/ui-smoke.js`: thêm 2 check chặn tái diễn → 14/14. Bộ test cũ **pass 12/12
  ngay cả khi cả hai bug trên còn nguyên** — riêng check "file vừa mở không dirty" là vô
  nghĩa suốt thời gian đó, vì dấu `●` nằm trên tab bar vốn không hiện. (Lead)
- [T5.2] Bác bỏ nghi vấn cũ về `editor-view.js` `_updateCursor`: blessed **có** gọi hook này
  trên element con đang focus (`screen.js:751`). Nghi vấn ban đầu của Lead là sai. (codex)

- [T5.2] Xử 9 mục Trung của codex. **Hai mục bị bác bỏ sau khi Lead tự kiểm:**
  - *"off-by-one ở cờ `truncated`"* — **SAI**. Thử thực nghiệm 3 biên (n<limit, n=limit,
    n>limit) với `limit=3`: lần lượt `truncated=false/false/true`. Đúng cả ba.
  - *"IO trực tiếp trong `explorer.js`"* — **SAI**, không còn `fs` nào trong file; IO đã
    được gỡ từ Phase 1. Báo cáo của codex dựa trên bản cũ.
- [T5.2] **Đã sửa 5 mục:**
  - Thông báo hết TTL không biến mất: `status-bar.render()` chỉ `setContent`, mà widget
    không được tự gọi `screen.render()`. Thêm action `requestRender()` cho widget xin vẽ lại.
  - Terminal không ẩn khi màn hình < 16 dòng: `applyLayout` bám `state.terminalVisible`
    thay vì quyết định của layout. Đổi sang `Boolean(geo.terminal)`.
  - `src/core/shell.js` mới: chuyển `resolveShell`/`createShellArgs`/`shellTitle`/
    `executableExistsOnPath` ra khỏi `terminal-panel.js`. Tầng `ui/` không còn `require("fs")`.
  - Spawn lỗi làm sập app: `new XTerm()` spawn shell ngay trong constructor, trước khi
    listener `error` kịp gắn — lỗi sẽ ném ra khỏi handler phím thành `uncaughtException`.
    Bọc `try/catch`, báo qua `actions.notify` và trả `null`.
  - Quick open mở trước khi index xong hiện danh sách rỗng trông y như "không có tệp nào".
    Thêm cờ `ready` và thông báo "Đang lập index tệp".
- [T5.2] `createTerminalPanel` nay nhận `actions` cho đúng chữ ký trong CONTRACTS.md.
- [T5.2] Mục Thấp *"thiếu `cursor.desiredCol` trong shape khởi tạo"* — **đúng, đã sửa.**
  `moveCursor` đọc `desiredCol` khi đi dọc, thiếu thì `Math.min(undefined, len)` ra `NaN`.
- [T5.2] `test/shell.test.js` — test cho module `core/shell.js` mới. 37 → 41 test. (agy)

**Đã biết chưa xong**

- Mục Trung *"`terminal-panel` tự mutate state rồi gọi `emitChange`"* — **đúng, chưa sửa.**
  Sửa cho chuẩn phải thêm mutator vào `workspace-state.js` rồi đổi ~5 chỗ trong panel;
  đó là thay đổi quyền sở hữu state, cần một vòng review riêng chứ không làm ngay trước tag.
- Mục Trung *"`closeTab()` để process treo"* — **đúng, chưa sửa được.** `releaseTerminal()`
  chỉ gỡ listener chứ không kết thúc pty. Không vá bằng `pty.kill()` vì PHASE0 §7 đo được
  nó làm crash. Hiện **chưa phím nào gọi tới**; đã ghi cảnh báo ngay trên hàm để không ai
  nối nhầm. Thoát cả app vẫn sạch (smoke kiểm mỗi lần chạy).
- 3 mục Thấp của codex (thiếu `cursor.desiredCol` trong shape khởi tạo, `runUi()` không
  async, thiếu JSDoc) — chưa xử, không ảnh hưởng hành vi.
- Mục Cao thứ ba của codex — `shutdown()` không gọi `terminalPanel.destroy()` — **chưa sửa,
  cố ý**: smoke pty đo được thoát mã 0 và không sót tiến trình con, PHASE0 §7 cấm đụng đường
  thoát. Cần ca tái hiện được rồi mới đổi.
- 9 mục Trung + 3 mục Thấp của codex chưa xử lý: IO trực tiếp trong `explorer.js` và
  `terminal-panel.js`, `terminal-panel` tự `emitChange`, terminal không tự ẩn khi < 16 dòng,
  status-bar không render lại khi hết TTL, race khi spawn lỗi, `closeTab()` của terminal để
  process treo, off-by-one ở cờ `truncated` trong `buildIndex()`. Đều chưa được Lead xác minh
  độc lập — **không coi là đã xác nhận**.
- `npm test` vẫn là placeholder của npm-init và **thoát mã 1**. Gate thật là `node --test`.
  Chưa sửa `package.json` vì CLAUDE.md cấm thêm tooling khi chưa được yêu cầu — cần User quyết.
- Explorer: SPEC §6 giao `Ctrl+R` cho việc nạp lại thư mục nhưng chưa thấy chỗ nối trong
  `ui.js`; README chỉ mô tả `Ctrl+R` ở editor. Cần đối chiếu lại ở T5.2.

---

## Phase v2 — Multi-agent Workspace (SPEC-multi-agent.md)

- [TA.1] `tools/phaseA-bench.js` — benchmark đo hiệu năng 1..4 pane pty in dữ liệu liên tục. Kết quả 4 pane tiêu tốn ~11.8% CPU, RSS ~114MB. Xác nhận mốc 4 pane hoạt động tốt. (agy)
- [TB.1] `src/ui/terminal-panel.js` + `test/terminal-lifecycle.test.js` — triển khai `terminatePtyAsync` kết thúc tiến trình con sạch sẽ bằng signal Ctrl+C/exit, process.kill PID fallback và taskkill, không để sót tiến trình mồ côi và không crash ConPTY. (agy)

---

## Ngoài phạm vi v1 (đã quyết, không làm)

- Tìm chuỗi toàn workspace (`Ctrl+Shift+F`) → v2.
- Syntax highlight khi đang gõ → v2. Lệnh `view` vẫn giữ highlight.
- Selection, copy/paste, undo/redo, soft wrap, tìm trong 1 file → **v1.5**, làm ngay sau v1.
- Split editor, LSP, debugger, git integration, multi-root, theme → không có kế hoạch.
