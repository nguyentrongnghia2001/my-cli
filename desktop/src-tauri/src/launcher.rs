use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use portable_pty::CommandBuilder;

use crate::command_detection::{find_executable, resolve_default_shell};
use crate::error::{DesktopError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LaunchKind {
    Shell,
    Codex,
    Claude,
    Gemini,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub kind: LaunchKind,
    pub display_name: String,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
}

/// Convert a `LaunchRequest` and a working directory into a `CommandBuilder` for `portable-pty`.
pub fn build_pty_command(request: &LaunchRequest, cwd: &str) -> Result<CommandBuilder> {
    let cwd_path = Path::new(cwd);
    if !cwd_path.exists() || !cwd_path.is_dir() {
        return Err(DesktopError::InvalidWorkspace(format!(
            "Thư mục không hợp lệ: {}",
            cwd
        )));
    }

    let mut cmd_builder = match &request.kind {
        LaunchKind::Shell => {
            let shell_path = resolve_default_shell();
            CommandBuilder::new(shell_path)
        }
        LaunchKind::Codex => build_cli_command("codex")?,
        LaunchKind::Claude => build_cli_command("claude")?,
        LaunchKind::Gemini => build_cli_command("gemini")?,
        LaunchKind::Custom => {
            let raw_cmd = request.command.as_deref().unwrap_or("").trim();
            if raw_cmd.is_empty() {
                return Err(DesktopError::InvalidLaunch(
                    "Lệnh custom không được để rỗng.".to_string(),
                ));
            }
            build_custom_command(raw_cmd, request.args.as_deref())?
        }
    };

    cmd_builder.cwd(cwd);

    // Set standard terminal environment variables
    cmd_builder.env("TERM", "xterm-256color");
    cmd_builder.env("COLORTERM", "truecolor");

    Ok(cmd_builder)
}

/// Helper to build command for installed AI CLIs (codex, claude, gemini).
fn build_cli_command(cli_name: &str) -> Result<CommandBuilder> {
    let exe_path = find_executable(cli_name).ok_or_else(|| {
        DesktopError::CommandNotFound(format!(
            "Không tìm thấy lệnh \"{}\" trong PATH hệ thống.",
            cli_name
        ))
    })?;

    create_safe_command(&exe_path, &[])
}

/// Helper to build a custom command.
fn build_custom_command(raw_cmd: &str, extra_args: Option<&[String]>) -> Result<CommandBuilder> {
    let exe_path = find_executable(raw_cmd).unwrap_or_else(|| PathBuf::from(raw_cmd));
    let args = extra_args.unwrap_or(&[]);
    create_safe_command(&exe_path, args)
}

/// Handles Windows `.cmd`/`.bat` batch scripts safely by running via `cmd.exe /c`.
fn create_safe_command(exe_path: &Path, args: &[String]) -> Result<CommandBuilder> {
    if cfg!(windows) {
        if let Some(ext) = exe_path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if ext_str == "cmd" || ext_str == "bat" {
                let cmd_exe = resolve_default_shell();
                let mut builder = CommandBuilder::new(cmd_exe);
                builder.arg("/c");
                builder.arg(exe_path.to_string_lossy().to_string());
                for arg in args {
                    builder.arg(arg);
                }
                return Ok(builder);
            }
        }
    }

    let mut builder = CommandBuilder::new(exe_path);
    for arg in args {
        builder.arg(arg);
    }
    Ok(builder)
}
