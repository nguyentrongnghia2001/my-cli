use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
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

#[cfg(test)]
mod tests {
    use super::*;

    /// The frontend reads `event.paneId`/`event.exitCode`; a snake_case payload
    /// silently fails every pane/generation guard in usePaneTerminal.
    #[test]
    fn output_event_serializes_field_names_as_camel_case() {
        let event = PaneEvent::Output {
            pane_id: "pane_1".to_string(),
            generation: 2,
            data: "hello".to_string(),
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["type"], "output");
        assert_eq!(json["paneId"], "pane_1");
        assert_eq!(json["generation"], 2);
        assert_eq!(json["data"], "hello");
        assert!(json.get("pane_id").is_none());
    }

    #[test]
    fn exit_and_error_events_serialize_field_names_as_camel_case() {
        let exited = serde_json::to_value(PaneEvent::Exited {
            pane_id: "pane_1".to_string(),
            generation: 1,
            exit_code: 3,
        })
        .unwrap();
        assert_eq!(exited["type"], "exited");
        assert_eq!(exited["paneId"], "pane_1");
        assert_eq!(exited["exitCode"], 3);

        let error = serde_json::to_value(PaneEvent::Error {
            pane_id: "pane_1".to_string(),
            generation: 1,
            error_code: "SpawnFailed".to_string(),
            message: "boom".to_string(),
        })
        .unwrap();
        assert_eq!(error["type"], "error");
        assert_eq!(error["paneId"], "pane_1");
        assert_eq!(error["errorCode"], "SpawnFailed");
    }
}
