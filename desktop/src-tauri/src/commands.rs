use tauri::{AppHandle, State};

use crate::command_detection::{detect_launch_profiles, ProfileDetection};
use crate::error::Result;
use crate::launcher::LaunchRequest;
use crate::pty_manager::PtyManager;
use crate::workspace::{validate_workspace_path, ValidateWorkspaceResult};

#[tauri::command]
pub fn validate_workspace(path: String) -> ValidateWorkspaceResult {
    validate_workspace_path(&path)
}

#[tauri::command]
pub fn detect_profiles() -> Vec<ProfileDetection> {
    detect_launch_profiles()
}

#[tauri::command]
pub fn create_pane(
    app_handle: AppHandle,
    manager: State<'_, PtyManager>,
    pane_id: String,
    generation: u32,
    workspace: String,
    launch: LaunchRequest,
    cols: u16,
    rows: u16,
) -> Result<()> {
    manager.create_pane(
        app_handle,
        pane_id,
        generation,
        workspace,
        launch,
        cols,
        rows,
    )
}

#[tauri::command]
pub fn write_pane(
    manager: State<'_, PtyManager>,
    pane_id: String,
    generation: u32,
    bytes: Vec<u8>,
) -> Result<()> {
    manager.write_pane(&pane_id, generation, &bytes)
}

#[tauri::command]
pub fn resize_pane(
    manager: State<'_, PtyManager>,
    pane_id: String,
    generation: u32,
    cols: u16,
    rows: u16,
) -> Result<()> {
    manager.resize_pane(&pane_id, generation, cols, rows)
}

#[tauri::command]
pub fn close_pane(
    manager: State<'_, PtyManager>,
    pane_id: String,
    generation: u32,
) -> Result<()> {
    manager.close_pane(&pane_id, generation)
}

#[tauri::command]
pub fn close_all(manager: State<'_, PtyManager>) -> Result<()> {
    manager.close_all();
    Ok(())
}
