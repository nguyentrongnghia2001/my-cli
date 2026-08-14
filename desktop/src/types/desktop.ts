/** Supported launch profile kinds. */
export type LaunchProfileKind = "shell" | "codex" | "claude" | "gemini" | "custom";

/** The exact user-approved launch configuration needed for restart. */
export interface LaunchRequest {
  kind: LaunchProfileKind;
  displayName: string;
  /** Only set for custom commands. */
  command?: string;
  args?: readonly string[];
}

/** Pane lifecycle status. */
export type PaneStatus = "starting" | "running" | "exited" | "closing" | "error";

/** Frontend-only metadata for one terminal pane. */
export interface PaneMetadata {
  id: string;
  generation: number;
  title: string;
  launch: LaunchRequest;
  status: PaneStatus;
  exitCode?: number;
  errorCode?: string;
  errorMessage?: string;
  cols: number;
  rows: number;
}

/** Top-level workspace view state held in the singleton composable. */
export interface WorkspaceViewState {
  root: string | null;
  panes: PaneMetadata[];
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
  isClosing: boolean;
}

/** Result of the Rust workspace validation command. */
export interface ValidateWorkspaceResult {
  valid: boolean;
  canonicalPath?: string;
  errorMessage?: string;
}

/** Backend profile detection result. */
export interface ProfileDetection {
  kind: LaunchProfileKind;
  displayName: string;
  available: boolean;
  resolvedPath?: string;
}

/** Record of a recently opened workspace directory. */
export interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: number;
}

