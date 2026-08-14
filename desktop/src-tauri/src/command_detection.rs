use serde::Serialize;
use std::env;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDetection {
    pub kind: String,
    pub display_name: String,
    pub available: bool,
    pub resolved_path: Option<String>,
}

/// Get the system PATHEXT env var as a list of extensions (all uppercase).
/// Default to common ones on Windows if not set.
fn get_pathext() -> Vec<String> {
    if cfg!(windows) {
        env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.BAT;.CMD;.COM;.VBS;.JS".to_string())
            .split(';')
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty())
            .collect()
    } else {
        vec![]
    }
}

/// Search for a command in the system PATH.
/// Returns the absolute path to the executable if found.
pub fn find_executable(cmd: &str) -> Option<PathBuf> {
    let cmd_path = Path::new(cmd);
    if cmd_path.is_absolute() || cmd_path.parent().map_or(false, |p| !p.as_os_str().is_empty()) {
        if cmd_path.exists() && cmd_path.is_file() {
            return Some(cmd_path.to_path_buf());
        }

        if cfg!(windows) {
            let pathext = get_pathext();
            for ext in &pathext {
                let with_ext = cmd_path.with_extension(ext.trim_start_matches('.'));
                if with_ext.exists() && with_ext.is_file() {
                    return Some(with_ext);
                }
            }
        }
        return None;
    }

    let path_val = env::var("PATH").ok()?;
    let paths: Vec<PathBuf> = env::split_paths(&path_val).collect();
    let pathext = get_pathext();

    for dir in paths {
        let direct_path = dir.join(cmd);
        if direct_path.exists() && direct_path.is_file() {
            return Some(direct_path);
        }

        if cfg!(windows) {
            for ext in &pathext {
                let ext_name = ext.trim_start_matches('.');
                let path_with_ext = dir.join(format!("{}.{}", cmd, ext_name.to_lowercase()));
                if path_with_ext.exists() && path_with_ext.is_file() {
                    return Some(path_with_ext);
                }
                let path_with_ext_upper = dir.join(format!("{}.{}", cmd, ext_name.to_uppercase()));
                if path_with_ext_upper.exists() && path_with_ext_upper.is_file() {
                    return Some(path_with_ext_upper);
                }
            }
        }
    }

    None
}

/// Resolve the preferred default shell on the system.
pub fn resolve_default_shell() -> PathBuf {
    if cfg!(windows) {
        if let Some(pwsh) = find_executable("pwsh") {
            return pwsh;
        }
        if let Some(powershell) = find_executable("powershell") {
            return powershell;
        }
        if let Some(cmd) = find_executable("cmd") {
            return cmd;
        }
        PathBuf::from("cmd.exe")
    } else {
        if let Ok(shell) = env::var("SHELL") {
            if !shell.is_empty() {
                return PathBuf::from(shell);
            }
        }
        find_executable("bash").unwrap_or_else(|| PathBuf::from("/bin/sh"))
    }
}

/// Detect supported launch profiles and their availability in current environment.
pub fn detect_launch_profiles() -> Vec<ProfileDetection> {
    let default_shell = resolve_default_shell();

    let profiles = vec![
        ProfileDetection {
            kind: "shell".to_string(),
            display_name: "Default Shell".to_string(),
            available: true,
            resolved_path: Some(default_shell.to_string_lossy().to_string()),
        },
        ProfileDetection {
            kind: "codex".to_string(),
            display_name: "Codex CLI".to_string(),
            available: find_executable("codex").is_some(),
            resolved_path: find_executable("codex").map(|p| p.to_string_lossy().to_string()),
        },
        ProfileDetection {
            kind: "claude".to_string(),
            display_name: "Claude Code".to_string(),
            available: find_executable("claude").is_some(),
            resolved_path: find_executable("claude").map(|p| p.to_string_lossy().to_string()),
        },
        ProfileDetection {
            kind: "gemini".to_string(),
            display_name: "Gemini CLI".to_string(),
            available: find_executable("gemini").is_some(),
            resolved_path: find_executable("gemini").map(|p| p.to_string_lossy().to_string()),
        },
    ];

    profiles
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_default_shell() {
        let shell = resolve_default_shell();
        assert!(!shell.as_os_str().is_empty());
    }

    #[test]
    fn test_detect_launch_profiles() {
        let profiles = detect_launch_profiles();
        assert_eq!(profiles.len(), 4);
        assert_eq!(profiles[0].kind, "shell");
        assert!(profiles[0].available);
        assert!(profiles.iter().any(|p| p.kind == "codex"));
        assert!(profiles.iter().any(|p| p.kind == "claude"));
        assert!(profiles.iter().any(|p| p.kind == "gemini"));
    }

    #[test]
    fn test_find_executable_nonexistent() {
        let non_existent = find_executable("__non_existent_binary_xyz_12345__");
        assert!(non_existent.is_none());
    }
}

