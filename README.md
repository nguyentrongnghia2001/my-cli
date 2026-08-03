# wsedit

CLI nhẹ để **xem** và **sửa** file ngay trong terminal, dùng như một "app" — cài 1 lần, gõ lệnh ở bất kỳ workspace nào.

## Yêu cầu

- Đã cài [Node.js](https://nodejs.org) (bản 18+). Kiểm tra: `node -v`

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
```

### Trong chế độ `edit`

| Phím       | Chức năng     |
|------------|---------------|
| `Ctrl+S`   | Lưu file      |
| `Ctrl+Q`   | Thoát         |
| `Esc`      | Thoát         |
| Gõ bình thường | Soạn thảo văn bản |

Nếu file chưa tồn tại, `wsedit edit tenfile.txt` sẽ tạo file mới khi bạn lưu.

## Tùy chỉnh

- Đổi tên lệnh: sửa field `"bin"` trong `package.json` (ví dụ đổi `"wsedit"` thành `"e"` cho gọn), rồi chạy lại `npm link`.
- Thêm ngôn ngữ highlight: sửa object `map` trong hàm `guessLang()` ở `bin/wsedit.js`.
- Thêm lệnh mới: thêm 1 block `program.command(...)` mới theo mẫu có sẵn.

## Vì sao chọn Node.js?

- Cài 1 lệnh (`npm link`/`npm install -g`) là chạy được trên cả Windows lẫn macOS, không cần build riêng cho từng OS.
- Rất nhẹ (vài trăm KB, không cần Electron/Chromium như VS Code).
- Thư viện `blessed` dựng giao diện terminal (TUI), `cli-highlight` tô màu code theo cú pháp.
