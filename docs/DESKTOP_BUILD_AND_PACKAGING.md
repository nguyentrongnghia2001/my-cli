# Desktop Build & Packaging Guide

Status: Phase 6 Desktop Packaging Guide for `wsedit`.

## 1. Environment Requirements

### Build Environment
- **Node.js**: v18.0.0 or higher (`node -v`)
- **Rust**: 1.77+ with `x86_64-pc-windows-msvc` toolchain (`rustc -V`)
- **Visual Studio C++ Build Tools**: Required on the build machine for Rust MSVC compilation.
- **Tauri CLI**: `@tauri-apps/cli` v2

### End-User Runtime Prerequisites
- **Windows**: Windows 10 (1903+) or Windows 11
- **WebView2**: Windows Evergreen WebView2 Runtime (pre-installed on Windows 11 and Windows 10 update 2004+).
- **No Node.js runtime required**: The desktop application packages native Rust PTY management and web frontend into a standalone Windows executable.

## 2. Development & Build Commands

Mở terminal trong thư mục `desktop/`:

```bash
# Cài đặt dependencies
npm install

# Khởi chạy chế độ Development (mở cửa sổ Tauri + Vite dev server)
npm run tauri dev

# Kiểm tra TypeScript typecheck
npm run typecheck

# Build gói ứng dụng release cho Windows (Tạo installer NSIS & exe)
npm run tauri build
```

Artifacts sau khi build thành công sẽ nằm ở:
- `desktop/src-tauri/target/release/bundle/nsis/wsedit_0.1.0_x64-setup.exe`
- `desktop/src-tauri/target/release/wsedit.exe`

## 3. SmartScreen & Code-Signing

- **Unsigned Executables**: Khi phát hành bản setup chưa được sign (unsigned binary), Windows SmartScreen có thể hiển thị cảnh báo "Windows protected your PC". Người dùng chọn **More info -> Run anyway** để khởi chạy.
- **Production Code Signing**: Để loại bỏ SmartScreen, cần sign installer bằng chứng chỉ EV/OV Code Signing Certificate hợp lệ thông qua `signtool.exe`.

## 4. Verification & Testing Checklist

- [x] Installer setup chạy hoàn tất và tạo shortcut Start Menu.
- [x] Mở workspace folder thành công.
- [x] Khởi chạy 1 - 4 terminal pane độc lập (Shell, Codex, Claude, Gemini, Custom Command).
- [x] Resize cửa sổ và Zoom/Focus pane hoạt động mượt mà.
- [x] Khi đóng ứng dụng, tất cả tiến trình con (PTY) được dọn dẹp sạch sẽ, không để lại mồ côi.
