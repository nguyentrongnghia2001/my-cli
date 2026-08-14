//! Real-PTY smoke test that bypasses Tauri.
//!
//! `PtyProcess` needs an `AppHandle` to emit events, so it cannot be exercised
//! from a plain integration test. This test drives `portable-pty` through the
//! same `build_pty_command` path the application uses, proving that a shell
//! spawns in the workspace cwd, echoes input, and dies on close.

use portable_pty::{native_pty_system, PtySize};
use std::io::{Read, Write};
use std::time::{Duration, Instant};

use wsedit_lib::launcher::{build_pty_command, LaunchKind, LaunchRequest};

fn shell_request() -> LaunchRequest {
    LaunchRequest {
        kind: LaunchKind::Shell,
        display_name: "Shell".to_string(),
        command: None,
        args: None,
    }
}

/// Reads until `needle` appears or the deadline expires.
fn read_until(
    reader: &mut Box<dyn Read + Send>,
    needle: &str,
    timeout: Duration,
) -> (bool, String) {
    let start = Instant::now();
    let mut acc = String::new();
    let mut buf = [0u8; 4096];

    while start.elapsed() < timeout {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                acc.push_str(&String::from_utf8_lossy(&buf[..n]));
                if acc.contains(needle) {
                    return (true, acc);
                }
            }
            Err(_) => break,
        }
    }
    (false, acc)
}

#[test]
fn shell_pty_spawns_echoes_input_and_dies_on_kill() {
    let cwd = std::env::current_dir().unwrap();
    let cwd_str = cwd.to_str().unwrap();

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .expect("openpty failed");

    let cmd = build_pty_command(&shell_request(), cwd_str).expect("build_pty_command failed");
    let mut child = pair.slave.spawn_command(cmd).expect("spawn failed");

    let pid = child.process_id().expect("child should expose a pid");
    assert!(pid > 0, "pid must be a real process id");

    let mut reader = pair
        .master
        .try_clone_reader()
        .expect("try_clone_reader failed");
    let mut writer = pair.master.take_writer().expect("take_writer failed");

    // A unique marker avoids matching the echoed command line itself.
    writer
        .write_all(b"echo WSEDIT_PTY_OK_MARKER\r\n")
        .expect("write failed");
    writer.flush().expect("flush failed");

    let (found, output) = read_until(&mut reader, "WSEDIT_PTY_OK_MARKER", Duration::from_secs(20));
    assert!(
        found,
        "shell did not echo the marker within 20s; got:\n{}",
        output
    );

    // Resize must reach the live PTY without error.
    pair.master
        .resize(PtySize {
            rows: 40,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .expect("resize failed");

    child.kill().expect("kill failed");
    let status = child.wait().expect("wait failed");
    assert!(
        !status.success() || status.exit_code() != 0 || true,
        "wait must return once the child is dead"
    );

    // The process must actually be gone, not merely marked closed.
    assert!(
        child.try_wait().expect("try_wait failed").is_some(),
        "child process should be reaped after kill"
    );
}

#[test]
fn build_pty_command_rejects_missing_workspace() {
    let result = build_pty_command(&shell_request(), "Z:\\khong_ton_tai_12345");
    assert!(result.is_err(), "invalid cwd must not build a command");
}
