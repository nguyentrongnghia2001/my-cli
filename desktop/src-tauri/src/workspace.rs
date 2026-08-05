use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateWorkspaceResult {
    pub valid: bool,
    pub canonical_path: Option<String>,
    pub error_message: Option<String>,
}

pub fn validate_workspace_path(path_str: &str) -> ValidateWorkspaceResult {
    let path = Path::new(path_str);
    if !path.exists() {
        return ValidateWorkspaceResult {
            valid: false,
            canonical_path: None,
            error_message: Some(format!("Thư mục không tồn tại: {}", path_str)),
        };
    }

    if !path.is_dir() {
        return ValidateWorkspaceResult {
            valid: false,
            canonical_path: None,
            error_message: Some(format!("Đường dẫn không phải là thư mục: {}", path_str)),
        };
    }

    match path.canonicalize() {
        Ok(canonical) => {
            // Convert UNC path format on Windows if present (e.g. \\?\C:\...)
            let path_string = canonical.to_string_lossy().to_string();
            let clean_path = if path_string.starts_with(r"\\?\") {
                path_string[4..].to_string()
            } else {
                path_string
            };

            ValidateWorkspaceResult {
                valid: true,
                canonical_path: Some(clean_path),
                error_message: None,
            }
        }
        Err(err) => ValidateWorkspaceResult {
            valid: false,
            canonical_path: None,
            error_message: Some(format!("Không thể xác thực đường dẫn: {}", err)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_validate_current_dir() {
        let cwd = env::current_dir().unwrap();
        let res = validate_workspace_path(cwd.to_str().unwrap());
        assert!(res.valid);
        assert!(res.canonical_path.is_some());
        assert!(res.error_message.is_none());
    }

    #[test]
    fn test_validate_nonexistent_dir() {
        let res = validate_workspace_path("nonexistent_directory_xyz_12345");
        assert!(!res.valid);
        assert!(res.canonical_path.is_none());
        assert!(res.error_message.is_some());
    }
}
