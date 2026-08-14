use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;

use crate::error::{DesktopError, Result};
use crate::launcher::LaunchRequest;
use crate::pty_process::PtyProcess;

#[derive(Default)]
pub struct PtyManager {
    processes: Arc<Mutex<HashMap<String, PtyProcess>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_pane(
        &self,
        app_handle: AppHandle,
        pane_id: String,
        generation: u32,
        workspace: String,
        launch: LaunchRequest,
        cols: u16,
        rows: u16,
    ) -> Result<()> {
        let mut map = self.processes.lock();

        // Prune dead processes first
        map.retain(|_, proc| proc.is_alive());

        // If the same pane_id is already present (e.g. restart or retry), terminate and replace
        if let Some(old_proc) = map.remove(&pane_id) {
            let _ = old_proc.terminate(300);
        }

        // If for any reason there are >= 4 processes alive from an orphaned session, terminate the oldest to make room
        while map.len() >= 4 {
            if let Some(first_key) = map.keys().next().cloned() {
                if let Some(old_proc) = map.remove(&first_key) {
                    let _ = old_proc.terminate(300);
                }
            } else {
                break;
            }
        }


        let process = PtyProcess::spawn(
            app_handle,
            pane_id.clone(),
            generation,
            workspace,
            launch,
            cols,
            rows,
        )?;

        map.insert(pane_id, process);
        Ok(())
    }

    pub fn write_pane(&self, pane_id: &str, generation: u32, bytes: &[u8]) -> Result<()> {
        let map = self.processes.lock();
        let proc = map
            .get(pane_id)
            .ok_or_else(|| DesktopError::StaleGeneration)?;

        if proc.generation != generation {
            return Err(DesktopError::StaleGeneration);
        }

        proc.write(bytes)
    }

    pub fn resize_pane(&self, pane_id: &str, generation: u32, cols: u16, rows: u16) -> Result<()> {
        let map = self.processes.lock();
        let proc = map
            .get(pane_id)
            .ok_or_else(|| DesktopError::StaleGeneration)?;

        if proc.generation != generation {
            return Err(DesktopError::StaleGeneration);
        }

        proc.resize(cols, rows)
    }

    pub fn close_pane(&self, pane_id: &str, generation: u32) -> Result<()> {
        let proc = {
            let mut map = self.processes.lock();
            if let Some(proc) = map.get(pane_id) {
                if proc.generation != generation {
                    return Ok(()); // Stale generation or already closed
                }
                map.remove(pane_id)
            } else {
                None
            }
        };

        if let Some(proc) = proc {
            // Terminate outside the registry lock to keep lock narrow!
            let _ = proc.terminate(800);
        }
        Ok(())
    }


    pub fn close_all(&self) {
        let procs: Vec<PtyProcess> = {
            let mut map = self.processes.lock();
            map.drain().map(|(_, p)| p).collect()
        };

        for proc in procs {
            let _ = proc.terminate(500);
        }
    }
}
