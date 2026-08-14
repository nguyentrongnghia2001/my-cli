pub mod command_detection;
pub mod commands;
pub mod error;
pub mod events;
pub mod launcher;
pub mod pty_manager;
pub mod pty_process;
pub mod state_storage;
pub mod workspace;

use pty_manager::PtyManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_manager = PtyManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(pty_manager)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(manager) = window.try_state::<PtyManager>() {
                    manager.close_all();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::validate_workspace,
            commands::detect_profiles,
            commands::create_pane,
            commands::write_pane,
            commands::resize_pane,
            commands::close_pane,
            commands::close_all,
            commands::load_app_state,
            commands::save_app_state
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
