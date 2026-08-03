# CHANGELOG — theo từng Phase

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

**Đã biết chưa xong**

- (trống)

---

## Phase 2 — Editor sửa được + tab

- [T2.1] `src/core/text-buffer.js` — quản lý buffer theo mảng dòng, mutate tại chỗ, giữ nguyên EOL gốc. (agy)
- [T2.2] `src/core/workspace-state.js` — quản lý state và event theo SPEC. (agy)
- [T2.5] `src/ui/prompt.js` — overlay nhập liệu ask và confirm. (agy)

**Đã biết chưa xong**

- (trống)

---

## Phase 3 — Quick open

- [T3.1] `src/core/fuzzy.js` — thuật toán rank với điểm thưởng đoạn nối và segment. (agy)
- [T3.2] `src/core/file-index.js` — index bất đồng bộ với cờ truncated. (agy)

**Đã biết chưa xong**

- (trống)

---

## Phase 4 — Terminal panel

*(trống — chưa bắt đầu)*

**Đã biết chưa xong**

- (trống)

---

## Phase 5 — Hoàn thiện

*(trống — chưa bắt đầu)*

**Đã biết chưa xong**

- (trống)

---

## Ngoài phạm vi v1 (đã quyết, không làm)

- Tìm chuỗi toàn workspace (`Ctrl+Shift+F`) → v2.
- Syntax highlight khi đang gõ → v2. Lệnh `view` vẫn giữ highlight.
- Selection, copy/paste, undo/redo, soft wrap, tìm trong 1 file → **v1.5**, làm ngay sau v1.
- Split editor, LSP, debugger, git integration, multi-root, theme → không có kế hoạch.
