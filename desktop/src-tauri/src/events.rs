use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PaneEvent {
    Started {
        pane_id: String,
        generation: u32,
    },
    Output {
        pane_id: String,
        generation: u32,
        data: String,
    },
    Exited {
        pane_id: String,
        generation: u32,
        exit_code: i32,
    },
    Error {
        pane_id: String,
        generation: u32,
        error_code: String,
        message: String,
    },
}
