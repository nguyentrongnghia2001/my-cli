# BOARD — bảng việc

Trạng thái: `TODO` · `DANG-LAM` · `DONE-CHO-REVIEW` · `DA-REVIEW` · `BLOCKED`

Agent chỉ được ghi vào cột **Trạng thái** + **Ghi chú** của task mình, và các mục ở cuối file.
Không tự nhận task khác. Không sửa cột "File sở hữu".

Ký hiệu người làm: `agy` = Antigravity/Gemini · `codex` = Codex · `Lead` = Claude · `User` = người dùng.

---

## Phase 1 — Khung UI

| ID | Việc | Ai | File sở hữu | Phụ thuộc | Trạng thái |
|----|------|-----|-------------|-----------|------------|
| T1.1 | Tách `bin/wsedit.js` → `src/commands/{view,ls,edit}.js` + `src/core/language.js`. Giữ y nguyên hành vi | Lead | `bin/wsedit.js`, `src/commands/view.js`, `src/commands/ls.js`, `src/commands/edit.js`, `src/core/language.js` | — | DA-REVIEW |
| T1.2 | `fs-tree.js`: đọc 1 cấp, sort, IGNORED | agy | `src/core/fs-tree.js` | — | DA-REVIEW |
| T1.3 | `layout.js`: hình học số nguyên 7 vùng + test | agy | `src/ui/layout.js`, `test/layout.test.js` | — | DA-REVIEW |
| T1.4 | `keymap.js`: dispatcher theo focus | agy | `src/core/keymap.js` | — | DA-REVIEW |
| T1.5 | `status-bar.js` | agy | `src/ui/status-bar.js` | T1.3 | DA-REVIEW |
| T1.6 | `explorer.js`: duyệt cây, expand/collapse, chọn file (chưa cần mở) | agy | `src/ui/explorer.js` | T1.2, T1.3 | DA-REVIEW |
| T1.7 | `test/smoke-ui.test.js`: harness dựng blessed screen bằng stream giả (không cần TTY) | agy | `test/smoke-ui.test.js` | — | DA-REVIEW |
| T1.8 | `src/commands/ui.js`: dựng screen, mount widget, gắn dispatcher, xử lý resize | Lead | `src/commands/ui.js` | T1.3–T1.7 | DA-REVIEW |

**Done Phase 1 khi:** 3 lệnh cũ chạy y như trước · `wsedit ui` duyệt cây + xem được file · đổi kích thước không vỡ layout.

## Phase 2 — Editor sửa được + tab

| ID | Việc | Ai | File sở hữu | Phụ thuộc | Trạng thái |
|----|------|-----|-------------|-----------|------------|
| T2.1 | `text-buffer.js` + test đầy đủ (insert/delete/newline/biên/EOL) | agy | `src/core/text-buffer.js`, `test/text-buffer.test.js` | — | DA-REVIEW |
| T2.2 | `workspace-state.js`: state + onChange + mutators | agy | `src/core/workspace-state.js` | — | DA-REVIEW |
| T2.3 | `editor-view.js`: render viewport + gutter + cursor + cuộn ngang | codex | `src/ui/editor-view.js` | T2.1, T1.3 | DA-REVIEW |
| T2.4 | `tab-bar.js`: tab, dấu `●` dirty, nút `×` | agy | `src/ui/tab-bar.js` | T2.2 | DA-REVIEW |
| T2.5 | `prompt.js`: `ask()` + `confirm()` | agy | `src/ui/prompt.js` | — | DA-REVIEW |
| T2.6 | Nối lưu/đóng tab/dirty/guard file lớn + binary vào `ui.js` | Lead | `src/commands/ui.js` | T2.1–T2.5 | DA-REVIEW |

**Done Phase 2 khi:** mở 3 file, sửa, lưu — **EOL gốc không đổi** · đóng tab dirty có hỏi · file > 2MB read-only · file binary bị từ chối.

## Phase 3 — Quick open

| ID | Việc | Ai | File sở hữu | Phụ thuộc | Trạng thái |
|----|------|-----|-------------|-----------|------------|
| T3.1 | `fuzzy.js` + test (score, thứ tự, basename bonus) | agy | `src/core/fuzzy.js`, `test/fuzzy.test.js` | — | DA-REVIEW |
| T3.2 | `file-index.js`: build async, limit 20k, cờ `truncated` | agy | `src/core/file-index.js` | T1.2 | DA-REVIEW |
| T3.3 | `quick-open.js`: overlay input + 12 kết quả | agy | `src/ui/quick-open.js` | T3.1, T3.2 | DA-REVIEW |
| T3.4 | Nối `Ctrl+P` + cảnh báo `truncated` vào `ui.js` | Lead | `src/commands/ui.js` | T3.3 | DA-REVIEW |

**Done Phase 3 khi:** `Ctrl+P` ra đúng file ở thư mục sâu trên repo ≥ 1k file, không lag · `truncated` có cảnh báo hiện ra.

## Phase 4 — Terminal panel

| ID | Việc | Ai | File sở hữu | Phụ thuộc | Trạng thái |
|----|------|-----|-------------|-----------|------------|
| T4.1 | `terminal-panel.js`: nhiều pty tab, forward phím, `ignoreKeys`, scrollback | codex | `src/ui/terminal-panel.js` | PHASE0, T1.3 | DA-REVIEW |
| T4.2 | Nối toggle/focus/`Ctrl+Shift+R` run prompt + đường thoát vào `ui.js` | Lead | `src/commands/ui.js` | T4.1 | DA-REVIEW |
| T4.3 | **Xác nhận PHASE0 §8 trên terminal thật** (gõ, nháy, màu, agent thật, `Ctrl+Shift+<key>`) | **User** | — | T4.2 | TODO |

**Done Phase 4 khi:** chạy `npm test` ở tab 1 và một agent tương tác ở tab 2 cùng lúc · `Ctrl+C` kill agent chứ không thoát wsedit · thoát không sót tiến trình · **T4.3 do User tick**.

## Phase 5 — Hoàn thiện

| ID | Việc | Ai | File sở hữu | Phụ thuộc | Trạng thái |
|----|------|-----|-------------|-----------|------------|
| T5.1 | `uncaughtException` → `screen.destroy()` trước khi in stack; chốt đường thoát | Lead | `src/commands/ui.js` | Phase 4 | DA-REVIEW |
| T5.2 | Review chéo toàn bộ diff v1 (đối chiếu SPEC + CONTRACTS + PHASE0) | codex | — (chỉ báo cáo) | T5.1 | DANG-LAM |
| T5.3 | Cập nhật `README.md`: lệnh `ui`, keymap, yêu cầu node-pty, hạn chế resize ở PHASE0 §4 | agy | `README.md` | T5.1 | DA-REVIEW |
| T5.4 | Cập nhật `CLAUDE.md` mục Structure + Coding style cho cây module mới | Lead | `CLAUDE.md` | T5.1 | DA-REVIEW |
| T5.5 | Chốt `CHANGELOG.md`, gắn tag v1 | Lead | `docs/agents/CHANGELOG.md` | tất cả | TODO |

**Done Phase 5 khi:** checklist nghiệm thu SPEC §11 xanh hết · README/CLAUDE.md khớp code thật · review của codex không còn mục Cao.

---

## Cần Lead chốt

*(agent ghi vào đây, không tự quyết)*

- (trống)

## Đề xuất đổi contract

*(ghi: module · signature cũ → mới · lý do)*

- (trống)

## Bug thấy ở file người khác

*(ghi: file · dòng · hiện tượng. KHÔNG tự sửa)*

- ~~`src/ui/editor-view.js` · dòng ~82 · `element._updateCursor` không bao giờ được gọi~~
  **SAI — đã bác bỏ.** `node_modules/blessed/lib/widgets/screen.js:751` có
  `if (this.focused && this.focused._updateCursor) this.focused._updateCursor(true)`,
  tức blessed **có** gọi hook này trên element con đang focus. Nghi vấn ban đầu của Lead
  là sai; codex kiểm chứng bằng source ở T5.2. Không cần sửa gì.

- `src/commands/ui.js` · dòng ~347 · `shutdown()` không gọi `terminalPanel.destroy()`.
  codex xếp mức Cao. **Chưa sửa, và cố ý:** smoke pty đo được thoát mã 0 và không sót
  tiến trình con, còn PHASE0 §7 nói rõ không đụng vào đường thoát. Sửa dựa trên suy luận
  chưa kiểm chứng là tự tạo regression. Cần một ca tái hiện được rồi mới đổi.

## Câu hỏi mở còn treo từ SPEC §12

1. Shell mặc định Windows: `pwsh` → `powershell.exe` → `cmd.exe` — **Lead giả định đúng**, chưa User xác nhận.
2. Undo/redo + copy/paste: để **v1.5**, không làm trong v1.
3. `node-pty` đặt `optionalDependencies`: **giữ**, dù PHASE0 §2 cho thấy cài dễ hơn dự kiến.
4. Mở file ngoài `root`: **không** trong v1.

## Cập nhật trạng thái agent

- [T4.1] `DONE-CHO-REVIEW` — Đã triển khai terminal nhiều tab, fallback dependency, resize tab nền và cleanup không kill PTY. (codex)
- [T2.4] `DONE-CHO-REVIEW` — Đã triển khai tab-bar, render các tab, highlight active tab và xử lý overflow hiển thị. (agy)
- [T3.3] `DONE-CHO-REVIEW` — Đã triển khai quick-open, tích hợp text input, list kết quả từ fuzzy matcher và giao tiếp với actions. (agy)
