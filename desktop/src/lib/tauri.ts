import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ValidateWorkspaceResult, LaunchRequest, ProfileDetection } from "../types/desktop";

/**
 * Open the OS native directory picker and return the selected path,
 * or null if the user cancelled.
 */
export async function pickWorkspaceDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  if (!selected) return null;
  return typeof selected === "string" ? selected : selected[0] ?? null;
}

/**
 * Ask the Rust backend to validate and canonicalize a workspace directory path.
 */
export async function validateWorkspace(path: string): Promise<ValidateWorkspaceResult> {
  return await invoke<ValidateWorkspaceResult>("validate_workspace", { path });
}

export async function detectProfiles(): Promise<ProfileDetection[]> {
  return await invoke<ProfileDetection[]>("detect_profiles");
}

export async function createPane(
  paneId: string,
  generation: number,
  workspace: string,
  launch: LaunchRequest,
  cols: number,
  rows: number
): Promise<void> {
  await invoke("create_pane", { paneId, generation, workspace, launch, cols, rows });
}

export async function writePane(paneId: string, generation: number, bytes: number[]): Promise<void> {
  await invoke("write_pane", { paneId, generation, bytes });
}

export async function resizePane(paneId: string, generation: number, cols: number, rows: number): Promise<void> {
  await invoke("resize_pane", { paneId, generation, cols, rows });
}

export async function closePane(paneId: string, generation: number): Promise<void> {
  await invoke("close_pane", { paneId, generation });
}

export async function closeAllPanes(): Promise<void> {
  await invoke("close_all");
}

export interface RecentWorkspaceEntry {
  path: string;
  name: string;
  lastOpened: number;
}

export interface SavedPaneEntry {
  title: string;
  launch: LaunchRequest;
}

export interface AppStateDto {
  version: number;
  lastActiveWorkspace: string | null;
  recentWorkspaces: RecentWorkspaceEntry[];
  workspacePanes: Record<string, SavedPaneEntry[]>;
}

export async function loadAppState(): Promise<AppStateDto> {
  return await invoke<AppStateDto>("load_app_state");
}

export async function saveAppState(state: AppStateDto): Promise<void> {
  await invoke("save_app_state", { state });
}

export interface PaneBackendEvent {
  type: string;
  paneId: string;
  generation: number;
  data?: string;
  exitCode?: number;
  errorCode?: string;
  message?: string;
}

export async function listenToPaneEvents(callback: (event: PaneBackendEvent) => void): Promise<UnlistenFn> {
  return await listen<PaneBackendEvent>("pane-event", (event) => {
    callback(event.payload);
  });
}

