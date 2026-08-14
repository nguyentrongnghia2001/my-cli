use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::launcher::LaunchRequest;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecentWorkspaceEntry {
    pub path: String,
    pub name: String,
    pub last_opened: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedPaneEntry {
    pub title: String,
    pub launch: LaunchRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppStateDto {
    pub version: u32,
    pub last_active_workspace: Option<String>,
    pub recent_workspaces: Vec<RecentWorkspaceEntry>,
    pub workspace_panes: HashMap<String, Vec<SavedPaneEntry>>,
}

pub fn get_storage_path() -> PathBuf {
    let base = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join(".wsedit").join("state.json")
}

pub fn load_persisted_state_from_path(path: &PathBuf) -> AppStateDto {
    if !path.exists() {
        return AppStateDto {
            version: 1,
            last_active_workspace: None,
            recent_workspaces: Vec::new(),
            workspace_panes: HashMap::new(),
        };
    }

    match fs::read_to_string(path) {
        Ok(content) => match serde_json::from_str::<AppStateDto>(&content) {
            Ok(state) => state,
            Err(e) => {
                eprintln!("Failed to parse state.json: {:?}", e);
                AppStateDto {
                    version: 1,
                    last_active_workspace: None,
                    recent_workspaces: Vec::new(),
                    workspace_panes: HashMap::new(),
                }
            }
        },
        Err(e) => {
            eprintln!("Failed to read state.json: {:?}", e);
            AppStateDto {
                version: 1,
                last_active_workspace: None,
                recent_workspaces: Vec::new(),
                workspace_panes: HashMap::new(),
            }
        }
    }
}

pub fn save_persisted_state_to_path(path: &PathBuf, state: &AppStateDto) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create storage directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write state file: {}", e))?;
    Ok(())
}

pub fn load_persisted_state() -> AppStateDto {
    let path = get_storage_path();
    load_persisted_state_from_path(&path)
}

pub fn save_persisted_state(state: &AppStateDto) -> Result<(), String> {
    let path = get_storage_path();
    save_persisted_state_to_path(&path, state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    #[test]
    fn test_save_and_load_persisted_state() {
        let temp_file = temp_dir().join(format!("wsedit_test_state_{}.json", std::process::id()));

        let mut panes = HashMap::new();
        panes.insert(
            "C:\\project\\foo".to_string(),
            vec![SavedPaneEntry {
                title: "Terminal 1".to_string(),
                launch: LaunchRequest {
                    kind: crate::launcher::LaunchKind::Shell,
                    display_name: "Terminal".to_string(),
                    command: None,
                    args: None,
                },
            }],
        );


        let initial_state = AppStateDto {
            version: 1,
            last_active_workspace: Some("C:\\project\\foo".to_string()),
            recent_workspaces: vec![RecentWorkspaceEntry {
                path: "C:\\project\\foo".to_string(),
                name: "foo".to_string(),
                last_opened: 1723650000,
            }],
            workspace_panes: panes,
        };

        let save_res = save_persisted_state_to_path(&temp_file, &initial_state);
        assert!(save_res.is_ok());

        let loaded = load_persisted_state_from_path(&temp_file);
        assert_eq!(loaded, initial_state);

        let _ = fs::remove_file(&temp_file);
    }
}
