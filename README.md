# wsedit — Lightweight Desktop Terminal Deck

Ứng dụng Desktop gọn nhẹ (xây dựng bằng **Tauri 2 + Rust + Vue 3 + xterm.js**) cho Windows, cung cấp terminal deck đa pane (tối đa 4 pane) để chạy song song Shell, Codex CLI, Claude Code, Gemini CLI hoặc các lệnh tuỳ chỉnh trong cùng một workspace.

## Đặc điểm nổi bật

- **Siêu nhẹ & Nhanh**: Dùng Tauri 2 và Rust `portable-pty`, tiêu tốn cực ít RAM (< 50MB ban đầu, < 250MB khi chạy 4 pane). Không cồng kềnh như Electron.
- **Tối đa 4 Terminal Panes**: Bố cục lưới linh hoạt (1x1, 2 cột, 3 pane stack, 2x2 grid) với thanh trượt chỉnh kích thước (splitters).
- **Profile AI CLI Sẵn sàng**: Tự động nhận diện và hỗ trợ khởi chạy Default Shell, Codex CLI, Claude Code, Gemini CLI, hoặc Custom Command.
- **Cô lập Tiến trình Chuẩn xác**: Quản lý PTY trực tiếp qua Rust backend, cách ly sự kiện theo pane ID và generation; đóng hoặc khởi động lại một pane không ảnh hưởng tới các pane khác.
- **Dọn dẹp Tiến trình Sạch sẽ**: Đảm bảo dọn sạch mọi tiến trình con khi đóng pane hoặc thoát ứng dụng, không sinh ra tiến trình zombie.
- **Phím tắt Thuận tiện**: Alt+N (thêm pane), Alt+W (đóng pane), Alt+Z (phóng to/thu nhỏ pane), Alt+1..4 (chuyển focus nhanh).

## Cấu trúc Dự án

```text
desktop/
  src/                  # Giao diện Vue 3 + TypeScript (components, composables, styles)
  src-tauri/            # Rust backend (portable-pty, command detection, launcher, lifecycle)
docs/                   # Tài liệu kiến trúc và hướng dẫn đóng gói
package.json            # Script tiện ích cấp root
```

## Yêu cầu Môi trường

- **Node.js**: v18.0.0 trở lên
- **Rust**: Phiên bản mới nhất (khuyến nghị cài qua `rustup`)
- **Windows**: Windows 10/11 (đã có sẵn WebView2 Runtime)

## Hướng dẫn Chạy & Phát triển

### Cài đặt dependencies

```bash
cd desktop
npm install
```

### Chạy chế độ phát triển (Dev mode)

Đứng ở thư mục gốc hoặc trong `desktop/`:

```bash
# Chạy từ thư mục gốc:
npm run tauri:dev

# Hoặc đứng trong desktop/:
cd desktop
npm run tauri dev
```

Lệnh này sẽ khởi động Vite dev server và cửa sổ Tauri Desktop kết nối với Rust PTY backend.

### Kiểm tra kiểu (Typecheck) & Build Frontend

```bash
npm run typecheck
npm run build
```

### Đóng gói Ứng dụng (Windows Installer / Exe)

```bash
npm run tauri:build
```

File cài đặt NSIS (`.exe`) sẽ được tạo ra trong `desktop/src-tauri/target/release/bundle/nsis/`. Chi tiết xem thêm tại [`docs/DESKTOP_BUILD_AND_PACKAGING.md`](docs/DESKTOP_BUILD_AND_PACKAGING.md).

## Tài liệu Kỹ thuật

- [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md): Định hướng phạm vi và nguyên tắc sản phẩm.
- [`docs/DESKTOP_REQUIREMENTS.md`](docs/DESKTOP_REQUIREMENTS.md): Đặc tả chức năng và tiêu chí nghiệm thu.
- [`docs/DESKTOP_ARCHITECTURE.md`](docs/DESKTOP_ARCHITECTURE.md): Kiến trúc phân tách ranh giới Frontend - Rust backend.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): Lộ trình phát triển các phiên bản.
