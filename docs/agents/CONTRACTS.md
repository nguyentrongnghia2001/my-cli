# CONTRACTS — interface chốt giữa các module

Đây là **hợp đồng**, không phải gợi ý. Agent làm module A được phép giả định module B đúng contract này
mà không cần đọc code của B. Ai muốn đổi signature: **không tự đổi** — ghi vào `BOARD.md` mục "Đề xuất
đổi contract" và chờ Lead chốt. Đổi ngầm một signature là làm vỡ việc của agent khác.

Luật chung:

- CommonJS: `module.exports = { ... }`, `"use strict"` đầu file.
- `src/core/**` **không được** `require("blessed")` hay `require("node-pty")`. Vi phạm là fail gate.
- Hàm nào ném lỗi thì ném `Error` với message **tiếng Việt** (hiện ra cho người dùng).
- Path luôn là **tuyệt đối** khi đi qua biên module. Chỉ đổi sang tương đối lúc render.
- Không dùng `any` kiểu ngầm: JSDoc `@param`/`@returns` cho mọi hàm export.

---

## src/core/language.js

Chuyển nguyên `guessLang` từ `bin/wsedit.js`, **không đổi hành vi**.

```js
guessLang(filePath: string) => string   // "javascript" | "plaintext" | ...
```

## src/core/fs-tree.js

```js
IGNORED: Set<string>                    // { "node_modules", ".git", "dist", "build" } — dùng chung voi lenh ls

/** Đọc ĐÚNG MỘT cấp. Không đệ quy (đệ quy sẽ treo UI trên repo lớn). */
readDir(dirPath: string) => Array<{ name: string, path: string, isDirectory: boolean }>
// Sắp xếp: thư mục trước file, rồi localeCompare theo name. Bỏ các tên trong IGNORED.
// Lỗi quyền đọc: ném Error("Không đọc được thư mục: <path>")
```

## src/core/file-index.js

```js
/** Bất đồng bộ để không chặn UI lúc khởi động. */
buildIndex(root: string, options?: { limit?: number }) => Promise<{
  paths: string[],        // path tuyệt đối, đã bỏ IGNORED
  truncated: boolean      // true khi chạm limit (default 20000)
}>
```
`truncated === true` → UI **phải** hiện cảnh báo (SPEC §7.3: không âm thầm cắt).

## src/core/fuzzy.js

Pure, không IO. Đây là module có unit test bắt buộc.

```js
/** Subsequence match, không phân biệt hoa thường. */
match(pattern: string, candidate: string) => { score: number, positions: number[] } | null
// null = không khớp. score cao hơn = khớp tốt hơn.
// Cộng điểm: ký tự khớp liên tiếp, khớp trong basename (sau dấu / hoặc \), khớp đầu segment.
// pattern rỗng => { score: 0, positions: [] }

rank(pattern: string, candidates: string[], limit?: number) => Array<{
  value: string, score: number, positions: number[]
}>   // sắp xếp giảm dần theo score, cắt còn limit (default 12)
```

## src/core/text-buffer.js

Pure, không IO. Unit test bắt buộc. **Các hàm mutate buffer tại chỗ và return chính nó**
(state tập trung, không clone — đã chốt để tránh copy mảng dòng lớn mỗi lần gõ).

```js
detectEol(content: string) => "LF" | "CRLF"    // đếm \r\n vs \n, nhiều hơn thì thắng; không có thì "LF"

createBuffer(content: string) => {
  lines: string[],                 // luôn tách theo \n, đã bỏ \r cuối dòng
  eol: "LF" | "CRLF",
  cursor: {
    line: number, col: number,   // 0-based
    desiredCol: number           // cột người dùng "muốn"; up/down bám theo giá trị này
                                 // để đi qua dòng ngắn rồi xuống dòng dài vẫn về đúng cột
  },
  scroll: { top: number, left: number },
  dirty: boolean
}

serialize(buffer) => string        // join lại đúng buffer.eol — GIỮ EOL GỐC (SPEC §7.2)

insertText(buffer, text: string) => buffer      // text KHÔNG chứa \n; caller tự tách
insertNewline(buffer) => buffer
deleteBackward(buffer) => buffer                // Backspace; ở col 0 thì nối vào dòng trên
deleteForward(buffer) => buffer                 // Delete; ở cuối dòng thì hút dòng dưới lên
moveCursor(buffer, to, viewportRows?: number) => buffer
// to: "left" | "right" | "up" | "down" | "home" | "end" | "pageup" | "pagedown"
// up/down giữ col mong muốn khi đi qua dòng ngắn; pageup/pagedown cần viewportRows

clampCursor(buffer) => buffer       // kéo cursor về trong biên hợp lệ
```
Mọi hàm sửa nội dung phải set `dirty = true`. `moveCursor` **không** đổi `dirty`.

## src/core/workspace-state.js

```js
createState(root: string) => state    // shape đúng như SPEC §5

onChange(state, listener: () => void) => () => void   // trả về hàm unsubscribe
emitChange(state) => void                              // mutator gọi sau khi đổi

// Mutators — mỗi hàm tự gọi emitChange():
setFocus(state, focus: "explorer"|"editor"|"terminal"|"overlay") => void
toggleSidebar(state) => void
toggleTerminal(state) => void

openFile(state, filePath: string, buffer) => string    // trả về tabId; nếu file đã mở thì
                                                        // chỉ activate tab cũ, KHÔNG tạo tab trùng
closeTab(state, tabId: string) => void
setActiveTab(state, tabId: string) => void
activeTab(state) => tab | null                          // KHÔNG emit

setTreeCursor(state, path: string) => void
setTreeNode(state, path: string, node: { expanded, loaded, children }) => void
```
`pty`/`vt` handle của terminal **không** đi qua state mutator — `terminal-panel.js` tự giữ,
state chỉ lưu metadata (`id`, `title`, `exited`). Lý do: handle không serialize được và không cần re-render.

## src/core/keymap.js

```js
createDispatcher({ state, actions }) => (ch: string, key: object) => boolean
// return true = ĐÃ xử lý (không cho lan xuống pane). false = bỏ qua.
// Thứ tự: global -> overlay -> pane đang focus (SPEC §6).
// LUẬT CỨNG: khi state.focus === "terminal", CHỈ "C-`" và "f6" được xử lý ở đây;
// mọi phím khác trả về false để terminal-panel forward xuống pty.

GLOBAL_KEYS: Record<string, string>   // "C-p" -> "quickOpen", ... (bảng tra, không chứa logic)
```
`actions` là object hàm do `ui.js` truyền vào (`quickOpen`, `save`, `closeTab`, `toggleSidebar`,
`toggleTerminal`, `cycleFocus`, `quit`, ...). `keymap.js` **không** tự require widget nào.

---

## src/ui/layout.js

```js
/** Trả về hình học SỐ NGUYÊN cho mọi vùng (bắt buộc — xem PHASE0 §5.2). */
computeLayout(input: {
  screenWidth: number, screenHeight: number,
  sidebarVisible: boolean, terminalVisible: boolean
}) => {
  sidebar:        { left, top, width, height } | null,   // null khi ẩn
  tabBar:         { left, top, width, height },
  editor:         { left, top, width, height },
  terminalTabBar: { left, top, width, height } | null,
  terminal:       { left, top, width, height } | null,
  statusBar:      { left, top, width, height },
  hintBar:        { left, top, width, height }
}
```
Quy tắc kích thước theo SPEC §4 (sidebar 28 cột min 18 max 50%; terminal 35% min 6 dòng;
< 60 cột tự ẩn sidebar; < 16 dòng tự đóng terminal). Mọi giá trị là số nguyên ≥ 0.
Hàm này **pure** — không require blessed, test được.

## src/ui/* (widget) — contract chung

Mọi widget export **đúng một** factory cùng dạng:

```js
create<Ten>({ screen, state, geometry }) => {
  element,                     // blessed element (hoặc mảng element nếu widget có nhiều box)
  render() => void,            // vẽ lại từ state; KHÔNG tự gọi screen.render()
  setGeometry(geometry) => void,   // áp hình học mới khi resize
  destroy() => void
}
```
- Widget **chỉ đọc** state, không mutate trực tiếp — gọi mutator của `workspace-state.js`.
- `render()` không gọi `screen.render()`; `ui.js` gọi một lần sau khi mọi widget render xong
  (tránh vẽ lại N lần cho 1 thay đổi).

Danh sách: `explorer.js`, `tab-bar.js`, `editor-view.js`, `status-bar.js`, `quick-open.js`,
`prompt.js`, `terminal-panel.js`.

## src/ui/prompt.js — bổ sung

```js
createPrompt({ screen }) => {
  ask(question: string, options?: { initial?: string }) => Promise<string | null>   // null = Esc
  confirm(question: string) => Promise<"yes" | "no" | "cancel">                     // cho tab dirty
  destroy() => void
}
```

## src/ui/terminal-panel.js — bổ sung

```js
createTerminalPanel({ screen, state, geometry }) => {
  element, render, setGeometry, destroy,          // như contract chung
  newTab(options?: { command?: string }) => string,   // trả về terminalId; không command = shell mặc định
  closeTab(id: string) => void,
  setActiveTab(id: string) => void,
  focusActive() => void
}
```
Bắt buộc tuân thủ PHASE0 §5 và §7:
- Không truyền `parent` vào `new XTerm`; `screen.append()` sau.
- `width`/`height` là số nguyên; set cho **cả tab đang ẩn** để tab nền cũng nhận resize.
- Truyền `shell` tường minh: Windows → `pwsh` nếu có, không thì `powershell.exe`; khác → `process.env.SHELL || "bash"`.
- `ignoreKeys: ["C-`", "f6"]`.
- `destroy()` **không** gọi `pty.kill()`.

## src/commands/ui.js — entry

```js
runUi(dir?: string) => Promise<void>
```
Dựng screen, `computeLayout`, mount widget, gắn dispatcher, `buildIndex` (không await),
nghe `screen.on("resize")` → `computeLayout` lại → `setGeometry` cho mọi widget.
Quit path: `screen.destroy()` → `process.exit(0)` (PHASE0 §7).
Bọc `process.on("uncaughtException")`: `screen.destroy()` trước rồi mới in stack, nếu không terminal của
người dùng bị hỏng.
