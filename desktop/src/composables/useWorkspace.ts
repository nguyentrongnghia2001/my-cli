import { reactive, readonly } from "vue";
import type { WorkspaceViewState, PaneMetadata, LaunchRequest } from "../types/desktop";
import {
  validateWorkspace,
  pickWorkspaceDirectory,
  createPane,
  closePane,
} from "../lib/tauri";

const state = reactive<WorkspaceViewState>({
  root: null,
  panes: [],
  focusedPaneId: null,
  zoomedPaneId: null,
  isClosing: false,
});

let errorMessage: string | null = null;

export function useWorkspace() {
  /** Select a workspace directory via native dialog and validate it in Rust. */
  async function selectAndOpenWorkspace(): Promise<boolean> {
    errorMessage = null;
    try {
      const selectedPath = await pickWorkspaceDirectory();
      if (!selectedPath) return false;

      const result = await validateWorkspace(selectedPath);
      if (result.valid && result.canonicalPath) {
        state.root = result.canonicalPath;
        return true;
      } else {
        errorMessage = result.errorMessage || "Folder được chọn không hợp lệ hoặc không tồn tại.";
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errorMessage = `Lỗi mở workspace: ${msg}`;
      return false;
    }
  }

  /** Set the workspace root directly (useful for tests/demos). */
  async function setWorkspaceRoot(path: string): Promise<boolean> {
    errorMessage = null;
    const result = await validateWorkspace(path);
    if (result.valid && result.canonicalPath) {
      state.root = result.canonicalPath;
      return true;
    } else {
      errorMessage = result.errorMessage || "Lỗi kiểm tra thư mục workspace.";
      return false;
    }
  }

  /** Close the current workspace and its panes. */
  function closeWorkspace() {
    // Attempt to terminate all active backend PTY processes first
    for (const pane of state.panes) {
      closePane(pane.id, pane.generation).catch((err) => {
        console.warn(`Failed to close PTY for pane ${pane.id}:`, err);
      });
    }

    state.root = null;
    state.panes = [];
    state.focusedPaneId = null;
    state.zoomedPaneId = null;
    state.isClosing = false;
    errorMessage = null;
  }

  /** Add a terminal pane with specific launch request configuration. */
  async function addPaneWithLaunch(launch: LaunchRequest, title: string): Promise<string | null> {
    if (!state.root) return null;
    if (state.panes.length >= 4) {
      errorMessage = "Đã đạt giới hạn tối đa 4 terminal pane.";
      return null;
    }

    const paneId = `pane_${Date.now()}`;
    const generation = 1;
    const newPane: PaneMetadata = {
      id: paneId,
      generation,
      title: title,
      launch,
      status: "starting",
      cols: 80,
      rows: 24,
    };

    state.panes.push(newPane);
    state.focusedPaneId = paneId;

    try {
      await createPane(
        paneId,
        generation,
        state.root,
        launch,
        newPane.cols,
        newPane.rows
      );
      return paneId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updatePaneError(paneId, "SpawnFailed", msg);
      return null;
    }
  }

  /** Backwards compatibility helper. */
  async function addShellPane(): Promise<string | null> {
    return addPaneWithLaunch(
      { kind: "shell", displayName: "Shell" },
      `Shell ${state.panes.length + 1}`
    );
  }

  function setFocusedPane(paneId: string) {
    const pane = state.panes.find((p) => p.id === paneId);
    if (pane) {
      state.focusedPaneId = paneId;
    }
  }

  // Zoom management
  function toggleZoom(paneId: string) {
    if (state.zoomedPaneId === paneId) {
      state.zoomedPaneId = null;
    } else {
      const pane = state.panes.find((p) => p.id === paneId);
      if (pane) {
        state.zoomedPaneId = paneId;
        state.focusedPaneId = paneId;
      }
    }
  }

  function updatePaneStatus(paneId: string, status: PaneMetadata["status"]) {
    const pane = state.panes.find((p) => p.id === paneId);
    if (pane) {
      pane.status = status;
    }
  }

  function updatePaneDimensions(paneId: string, cols: number, rows: number) {
    const pane = state.panes.find((p) => p.id === paneId);
    if (pane) {
      pane.cols = cols;
      pane.rows = rows;
    }
  }

  function updatePaneExitCode(paneId: string, exitCode: number) {
    const pane = state.panes.find((p) => p.id === paneId);
    if (pane) {
      pane.status = "exited";
      pane.exitCode = exitCode;
    }
  }

  function updatePaneError(paneId: string, errorCode: string, message: string) {
    const pane = state.panes.find((p) => p.id === paneId);
    if (pane) {
      pane.status = "error";
      pane.errorCode = errorCode;
      pane.errorMessage = message;
    }
  }

  async function restartPane(paneId: string) {
    const pane = state.panes.find((p) => p.id === paneId);
    if (!pane || !state.root) return;

    try {
      await closePane(paneId, pane.generation);
    } catch {
      // Ignored if already closed
    }

    pane.generation += 1;
    pane.status = "starting";
    pane.exitCode = undefined;
    pane.errorCode = undefined;
    pane.errorMessage = undefined;

    try {
      await createPane(
        paneId,
        pane.generation,
        state.root,
        pane.launch,
        pane.cols,
        pane.rows
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updatePaneError(paneId, "SpawnFailed", msg);
    }
  }

  async function closePaneById(paneId: string) {
    const index = state.panes.findIndex((p) => p.id === paneId);
    if (index === -1) return;

    const pane = state.panes[index];

    try {
      await closePane(paneId, pane.generation);
    } catch (err) {
      console.warn(`Error closing pane on backend:`, err);
    }

    state.panes.splice(index, 1);

    if (state.focusedPaneId === paneId) {
      state.focusedPaneId = state.panes[0]?.id || null;
    }
    if (state.zoomedPaneId === paneId) {
      state.zoomedPaneId = null;
    }
  }

  function getErrorMessage(): string | null {
    return errorMessage;
  }

  function clearErrorMessage() {
    errorMessage = null;
  }

  return {
    state: readonly(state),
    selectAndOpenWorkspace,
    setWorkspaceRoot,
    closeWorkspace,
    addPaneWithLaunch,
    addShellPane,
    setFocusedPane,
    toggleZoom,
    updatePaneStatus,
    updatePaneDimensions,
    updatePaneExitCode,
    updatePaneError,
    restartPane,
    closePaneById,
    getErrorMessage,
    clearErrorMessage,
  };
}
