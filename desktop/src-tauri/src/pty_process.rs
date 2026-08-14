use parking_lot::Mutex;
use portable_pty::{native_pty_system, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::AppHandle;
use tauri::Emitter;

use crate::error::{DesktopError, Result};
use crate::events::PaneEvent;
use crate::launcher::{build_pty_command, LaunchRequest};

pub struct PtyProcess {
    pub pane_id: String,
    pub generation: u32,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child_pid: Option<u32>,
    is_alive: Arc<AtomicBool>,
}

impl PtyProcess {
    pub fn spawn(
        app_handle: AppHandle,
        pane_id: String,
        generation: u32,
        cwd: String,
        request: LaunchRequest,
        cols: u16,
        rows: u16,
    ) -> Result<Self> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| DesktopError::PtyCreateFailed(e.to_string()))?;

        let cmd = build_pty_command(&request, &cwd)?;
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| DesktopError::SpawnFailed(e.to_string()))?;

        let pid = child.process_id();
        let master = pair.master;
        let reader = master
            .try_clone_reader()
            .map_err(|e| DesktopError::PtyCreateFailed(e.to_string()))?;
        let writer = master
            .take_writer()
            .map_err(|e| DesktopError::PtyCreateFailed(e.to_string()))?;

        let master = Arc::new(Mutex::new(master));
        let writer = Arc::new(Mutex::new(writer));
        let is_alive = Arc::new(AtomicBool::new(true));

        // Start reader thread for PTY output
        let pane_id_clone = pane_id.clone();
        let is_alive_reader = is_alive.clone();
        let app_handle_reader = app_handle.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 8192];
            let mut reader = reader;
            while is_alive_reader.load(Ordering::Relaxed) {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        let event = PaneEvent::Output {
                            pane_id: pane_id_clone.clone(),
                            generation,
                            data: text,
                        };
                        let _ = app_handle_reader.emit("pane-event", event);
                    }
                    Err(_) => break,
                }
            }
            is_alive_reader.store(false, Ordering::Relaxed);
        });

        // Start exit monitoring thread
        let pane_id_exit = pane_id.clone();
        let is_alive_exit = is_alive.clone();
        let app_handle_exit = app_handle.clone();
        let mut child_process = child;
        thread::spawn(move || {
            let exit_status = child_process.wait();
            is_alive_exit.store(false, Ordering::Relaxed);
            let code = match exit_status {
                Ok(status) => status.exit_code() as i32,
                Err(_) => -1,
            };

            let event = PaneEvent::Exited {
                pane_id: pane_id_exit,
                generation,
                exit_code: code,
            };
            let _ = app_handle_exit.emit("pane-event", event);
        });

        // Emit Started event
        let _ = app_handle.emit(
            "pane-event",
            PaneEvent::Started {
                pane_id: pane_id.clone(),
                generation,
            },
        );

        Ok(Self {
            pane_id,
            generation,
            master,
            writer,
            child_pid: pid,
            is_alive,
        })
    }

    pub fn write(&self, data: &[u8]) -> Result<()> {
        if !self.is_alive.load(Ordering::Relaxed) {
            return Err(DesktopError::WriteFailed("PTY đã thoát.".to_string()));
        }

        let mut w = self.writer.lock();
        w.write_all(data)
            .map_err(|e| DesktopError::WriteFailed(e.to_string()))?;
        w.flush()
            .map_err(|e| DesktopError::WriteFailed(e.to_string()))?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        if cols == 0 || rows == 0 {
            return Err(DesktopError::ResizeFailed(
                "Kích thước terminal không hợp lệ (>= 1).".to_string(),
            ));
        }

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let master = self.master.lock();
        master
            .resize(size)
            .map_err(|e| DesktopError::ResizeFailed(e.to_string()))?;
        Ok(())
    }

    pub fn is_alive(&self) -> bool {
        self.is_alive.load(Ordering::Relaxed)
    }

    pub fn terminate(&self, grace_period_ms: u64) -> Result<()> {
        self.is_alive.store(false, Ordering::Relaxed);

        // Send graceful exit string first (Ctrl+C then exit)
        let _ = self.write(b"\x03exit\r");

        let start = Instant::now();
        while self.is_alive.load(Ordering::Relaxed)
            && start.elapsed() < Duration::from_millis(grace_period_ms)
        {
            thread::sleep(Duration::from_millis(50));
        }

        // If child PID is known and process is still alive on Windows, force kill via taskkill if needed
        if self.is_alive.load(Ordering::Relaxed) {
            if let Some(pid) = self.child_pid {
                if cfg!(windows) {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/T", "/PID", &pid.to_string()])
                        .output();
                }
            }
        }

        Ok(())
    }
}
