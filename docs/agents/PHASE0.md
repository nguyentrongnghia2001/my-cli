# Phase 0 — Kết quả spike (ĐÃ XONG, trừ §8)

Tất cả số liệu dưới đây đo trên máy thật: **Windows 11 Pro 26200, Node v24.16.0, npm 10.9.2, không có `cl.exe`**.
Agent **không được suy diễn lại** hay viết code trái với mục nào ở đây. Nếu thấy mâu thuẫn → dừng, báo lại, không tự đoán.

## 1. Quyết định: dùng ĐƯỜNG A — `blessed-xterm`

`blessed-xterm@1.6.0` + `node-pty` (prebuilt). SPEC §7.4 trước đây lo package này cũ — **điều đó sai**:
copyright tới 2026, deps là `@xterm/headless@6.0.0` + `node-pty@1.2.0-beta.14`, có kèm `.d.ts`.
Không cần tự viết VT painter (đường B đã loại).

## 2. Cài đặt: KHÔNG cần Visual Studio Build Tools

`npm install node-pty` xong trong ~2s, 2 packages, **không compile** — có prebuilt binary cho Node 24.
`blessed-xterm` cài thêm 5 packages, kèm sẵn `conpty.dll` + `OpenConsole.exe`.
→ Rủi ro "node-pty cài thất bại" trong SPEC §9 hạ từ **Cao xuống Thấp** trên môi trường này.
→ Vẫn giữ `optionalDependencies` + fallback, vì máy khác có thể khác.

## 3. Key forwarding hoạt động

Ghi `"\x03"` vào pty giết được child: tiến trình `Start-Sleep -Seconds 60` thoát sau **1868ms**.
→ Yêu cầu "Ctrl+C xuống agent, không thoát wsedit" (SPEC §6) khả thi.

## 4. Resize: tới được ConPTY, nhưng child Node KHÔNG được thông báo tự động

- `pty.resize(120, 40)` có tác dụng thật: ConPTY phát `ESC[8;40;120t` và repaint đổi đúng số dòng.
- Child **tự truy vấn lại** thì thấy size mới: `80x24 → 120x40 → 100x30`.
- Nhưng event `resize` của Node **không tự bắn** dưới ConPTY. Nó chỉ xuất hiện khi chính child gọi
  `process.stdout._refreshSize()` (vì hàm đó tự emit khi phát hiện đổi).

**Hệ quả phải chấp nhận:** agent viết bằng Node/ink/blessed chạy trong pane có thể **không tự re-layout**
khi người dùng đổi kích thước cửa sổ wsedit. Không sửa được từ phía parent. Ghi vào README như hạn chế đã biết;
đừng tốn thời gian "fix".

## 5. Ràng buộc API của blessed-xterm (lấy từ source + `sample.js`)

Bốn ràng buộc này làm code sai ngay nếu không biết:

1. **Không truyền `parent`/`screen` trong options.** Constructor `clone(options)` (blessed-xterm.js:39)
   deep-clone cả screen → blessed ném `Cannot switch a node's screen`.
   Đúng: `const t = new XTerm({...}); screen.append(t)`.
2. **`width`/`height` phải là SỐ NGUYÊN**, không dùng `"100%"`. Constructor gọi `_bootstrap()` →
   `_innerSize()` → `this.width` trước khi widget được attach, nên `%` không giải được → `TypeError`.
   → `ui/layout.js` **phải** tính hình học bằng số nguyên và set lại khi resize. Không dựa vào layout `%` của blessed.
3. **Phải truyền `shell` tường minh.** Default là `process.env.SHELL || "sh"`; trên Windows `SHELL`
   thường rỗng → `sh` không tồn tại.
4. **Widget tự lo resize pty.** Nó nghe blessed `resize` rồi gọi `term.resize()` + `pty.resize()`
   (debounce bằng `setImmediate`). → SPEC §4 "phải tự gọi pty.resize cho mọi tab" là **không cần**;
   thay vào đó phải đảm bảo set `width`/`height` cho **cả tab đang ẩn**, nếu không tab nền không nhận resize.

Tiện dụng có sẵn, dùng đúng thay vì tự viết:
`ignoreKeys` (đúng cơ chế giữ lại 2 phím ở SPEC §6) · `scrollback` · `controlKey` (chế độ scroll) ·
`mousePassthrough` · events `title`/`exit`/`update`/`scroll` · `injectInput()` · `spawn()` · `terminate()`.

## 6. Mô hình nhiều tab: OK

2 pty sống song song. Tab **bị ẩn vẫn nhận output**. `injectInput()` tới được shell.
Nội dung 2 tab không lẫn nhau. → Tab model của SPEC §7.4 chạy được.

## 7. Thoát: `screen.destroy()` rồi `process.exit(0)` — KHÔNG gọi `pty.kill()`

Đo được:

| Cách | Kết quả |
|------|---------|
| `pty.kill()` rồi để event loop tự cạn | **Không thoát** — còn sống quá 6s |
| `taskkill /pid <pid> /T /F` | **Không thoát** — còn sống quá 6s |
| `process.exit(0)` | Thoát ngay (~1.65s tổng) |

- **Không có tiến trình mồ côi** ở cả hai cách: ConPTY tự dọn child khi host chết. Đã kiểm bằng pid thật.
- `pty.kill()` còn làm `node-pty/lib/conpty_console_list_agent.js` crash `AttachConsole failed` và
  **đổ stack trace ra stderr** → rác hiện lên terminal người dùng lúc thoát.

→ Luật: quit path là `screen.destroy()` → `process.exit(0)`. Không `pty.kill()`.
Không dựa vào event loop tự cạn — nó sẽ treo.

## 8. CHƯA kiểm — cần TTY thật, agent không làm được

Bốn mục này **chỉ người dùng chạy trong Windows Terminal thật mới xác nhận được**. Agent không được đánh dấu xong:

- [ ] Gõ trong pane có mượt, có nháy (flicker) không
- [ ] Màu / ANSI có đúng không
- [ ] Chạy một agent tương tác thật trong pane (ví dụ `claude`) và dùng được
- [ ] **`Ctrl+Shift+<key>` có phân biệt được không.** Nếu không → đổi phím tab mới sang `Ctrl+T`,
      run sang `Ctrl+R` (SPEC §6 đã ghi dự phòng)

Script spike nằm ngoài repo, ở scratchpad: `test-pty.js`, `test-resize2.js`, `test-render.js`,
`test-tabs.js`, `test-exit.js`, `test-orphan.js`.
