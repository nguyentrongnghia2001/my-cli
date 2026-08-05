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
        if map.len() >= 4 {
            return Err(DesktopError::PtyCreateFailed(
                "Đã đạt giới hạn tối đa 4 terminal pane.".to_string(),
            ));
        }

        if map.contains_key(&pane_id) {
            return Err(DesktopError::PtyCreateFailed(format!(
                "Pane ID \"{}\" đã tồn tại.",
                pane_id
            )));
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
            let proc = map
                .get(pane_id)
                .ok_or_else(|| DesktopError::StaleGeneration)?;
            if proc.generation != generation {
                return Err(DesktopError::StaleGeneration);
            }
            map.remove(pane_id).unwrap()
        };

        // Terminate outside the registry lock to keep lock narrow!
        proc.terminate(800)
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
