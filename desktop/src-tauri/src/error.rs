use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum DesktopError {
    #[error("Thư mục workspace không tồn tại hoặc không hợp lệ: {0}")]
    InvalidWorkspace(String),

    #[error("Không tìm thấy lệnh: {0}")]
    CommandNotFound(String),

    #[error("Cấu hình launch không hợp lệ: {0}")]
    InvalidLaunch(String),

    #[error("Không khởi tạo được PTY: {0}")]
    PtyCreateFailed(String),

    #[error("Không thể spawn tiến trình: {0}")]
    SpawnFailed(String),

    #[error("Thao tác nhắm tới phiên bản terminal cũ (stale generation).")]
    StaleGeneration,

    #[error("Ghi vào PTY thất bại: {0}")]
    WriteFailed(String),

    #[error("Resize PTY thất bại: {0}")]
    ResizeFailed(String),

    #[error("Lỗi đọc luồng PTY: {0}")]
    ReaderFailed(String),

    #[error("Tiến trình đóng quá hạn (termination timeout).")]
    TerminationTimeout,

    #[error("Không thể xác nhận dọn dẹp tiến trình (cleanup unverified): {0}")]
    CleanupUnverified(String),

    #[error("Lỗi I/O: {0}")]
    IoError(String),
}

pub type Result<T> = std::result::Result<T, DesktopError>;
