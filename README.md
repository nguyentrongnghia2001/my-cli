# wsedit

CLI nhẹ để **xem** và **sửa** file ngay trong terminal, dùng như một "app" — cài 1 lần, gõ lệnh ở bất kỳ workspace nào.

> Desktop direction: a separate Vue/Tauri terminal-deck application is currently in
> specification only; no desktop implementation has started. See
> [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md) and
> [`docs/ROADMAP.md`](docs/ROADMAP.md). The CLI/TUI documented below remains the
> implemented product.

## Yêu cầu

- Đã cài [Node.js](https://nodejs.org) **v18.0.0 trở lên** (kiểm tra: `node -v`). Node 18 LTS hoặc mới hơn được khuyến nghị.

## Cài đặt (làm 1 lần)

Mở terminal (macOS: Terminal/iTerm, Windows: PowerShell hoặc CMD) tại thư mục `wsedit` này:

```bash
npm install
npm link
```

`npm link` sẽ tạo ra lệnh toàn cục `wsedit` — dùng được ở **bất kỳ thư mục nào** trên máy, giống như một app đã cài.

> Windows: nếu PowerShell báo lỗi execution policy khi chạy npm link, mở PowerShell với quyền Administrator rồi chạy:
> `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

Muốn gỡ ra sau này: `npm unlink -g wsedit`

## Sử dụng

Đứng ở bất kỳ workspace/project nào:

```bash
# Liệt kê toàn bộ file trong project (bỏ qua node_modules, .git, dist, build)
wsedit ls

# Xem nội dung file, có tô màu cú pháp theo ngôn ngữ
wsedit view src/index.js

# Mở editor mini để sửa file ngay trong terminal
wsedit edit src/index.js

# Mở giao diện workspace ngay trong terminal (mặc định là thư mục hiện tại)
wsedit ui
wsedit ui ./src
```

### Trong chế độ `edit` (sửa một file)

| Phím       | Chức năng     |
|------------|---------------|
| `Ctrl+S`   | Lưu file      |
| `Ctrl+Q`   | Thoát         |
| `Esc`      | Thoát         |
| Gõ bình thường | Soạn thảo văn bản |

Nếu file chưa tồn tại, `wsedit edit tenfile.txt` sẽ tạo file mới khi bạn lưu.

### Trong chế độ `ui` (Workspace UI)

`wsedit ui [dir]` cung cấp một môi trường làm việc kiểu VS Code thu nhỏ ngay trong terminal, bao gồm:
- **Explorer**: Cây thư mục bên trái (hiển thị tệp tin, bỏ qua `node_modules`, `.git`, v.v.).
- **Tab đa file**: Cho phép mở và chỉnh sửa nhiều file cùng lúc, có hiển thị dòng/cột.
- **Terminal panel**: Khu vực chạy shell (bash, pwsh) hoặc các agent AI, hỗ trợ PTY thật và đa tab.

**Bảng phím tắt (Keymap):**

| Nhóm | Phím | Chức năng |
|---|---|---|
| **Toàn cục** | `Ctrl+P` | Mở file nhanh (Quick open) |
| | `Ctrl+S` | Lưu tab đang mở |
| | `Ctrl+W` | Đóng tab đang mở (hỏi nếu chưa lưu) |
| | `Ctrl+Q` | Thoát (hỏi nếu chưa lưu) |
| | `Ctrl+B` | Ẩn/hiện thanh bên |
| | ``Ctrl+` `` | Ẩn/hiện và focus terminal |
| | `F6` | Luân chuyển focus: Explorer → Editor → Terminal |
| | `Alt+1`..`9` | Nhảy tới tab file số 1..9 |
| **Terminal** | `Ctrl+T` | Mở tab terminal mới |
| | `Alt+←` / `Alt+→` | Đổi tab terminal |
| **Editor** | `Ctrl+R` | Nhập một lệnh rồi chạy nó trong tab terminal mới |

Khi con trỏ đang **ở trong** terminal, mọi phím đều được gửi thẳng xuống tiến trình
con — kể cả `Ctrl+C` và `Ctrl+Q`. Đây là chủ ý: agent chạy trong pane cần nhận đủ
phím. Chỉ ``Ctrl+` `` và `F6` được giữ lại để bạn rời khỏi terminal; hai phím
`Ctrl+T` / `Alt+←→` vì vậy cũng chỉ có tác dụng khi focus **không** ở terminal.

`Ctrl+R` chỉ nhận khi focus ở editor, vì trong Explorer phím này dành cho việc
nạp lại thư mục.

`wsedit ui` cần một terminal thật; chạy qua pipe hoặc redirect sẽ bị từ chối.

### Yêu cầu về `node-pty`

Terminal panel dùng `node-pty` + `blessed-xterm` để mở PTY thật. Cả hai nằm trong
**`optionalDependencies`**, nên nếu cài thất bại thì `npm install` vẫn thành công.

Khi thiếu, panel hiện một khung báo thiếu package nào kèm lệnh `npm install` cần
chạy; Explorer, Editor, tab bar và Quick open vẫn hoạt động bình thường.

Trên Windows các package này có bản dựng sẵn — thực tế cài mất khoảng 2 giây và
**không cần** Visual Studio Build Tools.

### Hạn chế đã biết

- **Resize không tới được tiến trình con.** Kích thước mới có tới ConPTY, nhưng
  child process viết bằng Node/ink không được thông báo tự động nên có thể không
  vẽ lại theo khổ mới. Không sửa được từ phía wsedit.
- **Chưa nghiệm thu trên TTY thật**: độ mượt khi gõ, độ chính xác màu ANSI, chạy
  agent tương tác trong pane, và việc terminal có phân biệt được `Ctrl+Shift+<key>`
  hay không — cả bốn đều chưa được xác nhận bằng tay.
- Chưa có trong v1: selection, copy/paste, undo/redo, tìm trong file, và syntax
  highlight khi đang gõ (lệnh `view` vẫn có highlight).

## Tùy chỉnh

- Đổi tên lệnh: sửa field `"bin"` trong `package.json` (ví dụ đổi `"wsedit"` thành `"e"` cho gọn), rồi chạy lại `npm link`.
- Thêm ngôn ngữ highlight: sửa object `map` trong hàm `guessLang()` ở `bin/wsedit.js`.
- Thêm lệnh mới: thêm 1 block `program.command(...)` mới theo mẫu có sẵn.

## Vì sao chọn Node.js?

- Cài 1 lệnh (`npm link`/`npm install -g`) là chạy được trên cả Windows lẫn macOS, không cần build riêng cho từng OS.
- Rất nhẹ (vài trăm KB, không cần Electron/Chromium như VS Code).
- Thư viện `blessed` dựng giao diện terminal (TUI), `cli-highlight` tô màu code theo cú pháp.
