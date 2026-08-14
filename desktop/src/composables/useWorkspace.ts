import { ref, reactive, readonly } from "vue";
import type {
  WorkspaceViewState,
  PaneMetadata,
  LaunchRequest,
  RecentWorkspace,
} from "../types/desktop";
import {
  validateWorkspace,
  pickWorkspaceDirectory,
  createPane,
  closePane,
  loadAppState,
  saveAppState,
  type AppStateDto,
  type SavedPaneEntry,
} from "../lib/tauri";

const RECENT_WORKSPACES_STORAGE_KEY = "wsedit:recent_workspaces";
const LAST_ACTIVE_WORKSPACE_KEY = "wsedit:last_active_workspace";
const MAX_RECENT_WORKSPACES = 10;

function formatErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) {
      return obj.message;
    }
    if (typeof obj.code === "string" && obj.code) {
      return obj.code;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function loadRecentWorkspaces(): RecentWorkspace[] {
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => typeof item?.path === "string" && typeof item?.name === "string"
      );
    }
    return [];
  } catch (err) {
    console.warn("Failed to load recent workspaces from localStorage:", err);
    return [];
  }
}

const recentWorkspaces = ref<RecentWorkspace[]>(loadRecentWorkspaces());
let memoryPanesStorage: Record<string, SavedPaneEntry[]> = {};

async function syncStateFromDisk() {
  try {
    const diskState = await loadAppState();
    if (diskState.recentWorkspaces && diskState.recentWorkspaces.length > 0) {
      recentWorkspaces.value = diskState.recentWorkspaces.map((item) => ({
        path: item.path,
        name: item.name,
        lastOpened: item.lastOpened,
      }));
    }
    if (diskState.workspacePanes) {
      memoryPanesStorage = diskState.workspacePanes;
    }
  } catch (err) {
    console.warn("Failed to load state from disk:", err);
  }
}

// Initial background sync from disk file ~/.wsedit/state.json
syncStateFromDisk();

function persistAllToDisk() {
  const dto: AppStateDto = {
    version: 1,
    lastActiveWorkspace: state.root,
    recentWorkspaces: recentWorkspaces.value.map((w) => ({
      path: w.path,
      name: w.name,
      lastOpened: w.lastOpened,
    })),
    workspacePanes: memoryPanesStorage,
  };
  saveAppState(dto).catch((err) => {
    console.warn("Failed to save state to disk:", err);
  });
}

function getSavedPanesForWorkspace(wsPath: string): SavedPaneEntry[] {
  const key = wsPath.toLowerCase();
  if (memoryPanesStorage[key] && memoryPanesStorage[key].length > 0) {
    return memoryPanesStorage[key].slice(0, 4);
  }
  try {
    const raw = localStorage.getItem(`wsedit:panes:${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 4);
      }
    }
  } catch {
    // fallback
  }
  return [{ title: "Terminal 1", launch: { kind: "shell", displayName: "Terminal" } }];
}

function savePanesForWorkspace(wsPath: string, panes: readonly PaneMetadata[]) {
  if (!wsPath) return;
  const key = wsPath.toLowerCase();
  const toSave: SavedPaneEntry[] = panes.map((p) => ({
    title: p.title,
    launch: p.launch,
  }));
  memoryPanesStorage[key] = toSave;
  try {
    localStorage.setItem(`wsedit:panes:${key}`, JSON.stringify(toSave));
  } catch {}
  persistAllToDisk();
}

const state = reactive<WorkspaceViewState>({
  root: null,
  panes: [],
  focusedPaneId: null,
  zoomedPaneId: null,
  isClosing: false,
});

let errorMessage = ref<string | null>(null);

function recordRecentWorkspace(canonicalPath: string) {
  const name = canonicalPath.split(/[/\\]/).filter(Boolean).pop() || canonicalPath;
  const existing = recentWorkspaces.value.filter(
    (item) => item.path.toLowerCase() !== canonicalPath.toLowerCase()
  );
  const updated: RecentWorkspace[] = [
    {
      path: canonicalPath,
      name,
      lastOpened: Date.now(),
    },
    ...existing,
  ].slice(0, MAX_RECENT_WORKSPACES);

  recentWorkspaces.value = updated;
  try {
    localStorage.setItem(RECENT_WORKSPACES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  persistAllToDisk();
}

function removeRecentWorkspace(pathToRemove: string) {
  const updated = recentWorkspaces.value.filter(
    (item) => item.path.toLowerCase() !== pathToRemove.toLowerCase()
  );
  recentWorkspaces.value = updated;
  try {
    localStorage.setItem(RECENT_WORKSPACES_STORAGE_KEY, JSON.stringify(updated));
    localStorage.removeItem(`wsedit:panes:${pathToRemove.toLowerCase()}`);
  } catch {}
  delete memoryPanesStorage[pathToRemove.toLowerCase()];
  persistAllToDisk();
}


export function useWorkspace() {
  /** Restore saved panes for the given workspace. */
  async function restorePanes(wsPath: string) {
    if (state.panes.length > 0) return;
    const saved = getSavedPanesForWorkspace(wsPath);
    for (const item of saved) {
      await addPaneWithLaunch(item.launch, item.title);
    }
  }

  /** Select a workspace directory via native dialog and validate it in Rust. */
  async function selectAndOpenWorkspace(): Promise<boolean> {
    errorMessage.value = null;
    try {
      const selectedPath = await pickWorkspaceDirectory();
      if (!selectedPath) return false;

      const result = await validateWorkspace(selectedPath);
      if (result.valid && result.canonicalPath) {
        state.root = result.canonicalPath;
        recordRecentWorkspace(result.canonicalPath);
        localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, result.canonicalPath);
        await restorePanes(result.canonicalPath);
        return true;
      } else {
        errorMessage.value = result.errorMessage || "Folder được chọn không hợp lệ hoặc không tồn tại.";
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errorMessage.value = `Lỗi mở workspace: ${msg}`;
      return false;
    }
  }

  /** Open a workspace directly from the recent list or active key. */
  async function openRecentWorkspace(path: string): Promise<boolean> {
    errorMessage.value = null;
    try {
      const result = await validateWorkspace(path);
      if (result.valid && result.canonicalPath) {
        state.root = result.canonicalPath;
        recordRecentWorkspace(result.canonicalPath);
        localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, result.canonicalPath);
        await restorePanes(result.canonicalPath);
        return true;
      } else {
        errorMessage.value = result.errorMessage || `Thư mục không tồn tại hoặc không thể truy cập: ${path}`;
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errorMessage.value = `Lỗi mở workspace: ${msg}`;
      return false;
    }
  }

  /** Switch workspace by closing current panes and opening new path. */
  async function switchWorkspace(path: string): Promise<boolean> {
    closeWorkspace();
    return openRecentWorkspace(path);
  }

  /** Set the workspace root directly (useful for tests/demos). */
  async function setWorkspaceRoot(path: string): Promise<boolean> {
    errorMessage.value = null;
    const result = await validateWorkspace(path);
    if (result.valid && result.canonicalPath) {
      state.root = result.canonicalPath;
      recordRecentWorkspace(result.canonicalPath);
      localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, result.canonicalPath);
      await restorePanes(result.canonicalPath);
      return true;
    } else {
      errorMessage.value = result.errorMessage || "Lỗi kiểm tra thư mục workspace.";
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
    errorMessage.value = null;
    localStorage.removeItem(LAST_ACTIVE_WORKSPACE_KEY);
  }

  /** Add a terminal pane with specific launch request configuration. */
  async function addPaneWithLaunch(launch: LaunchRequest, title: string): Promise<string | null> {
    if (!state.root) return null;
    if (state.panes.length >= 4) {
      errorMessage.value = "Đã đạt giới hạn tối đa 4 terminal pane.";
      return null;
    }

    const paneId = `pane_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
    savePanesForWorkspace(state.root, state.panes);

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
      const msg = formatErrorMessage(err);
      updatePaneError(paneId, "SpawnFailed", msg);
      return null;
    }
  }

  /** Directly add an interactive shell terminal without prompting for CLI. */
  async function addShellPane(): Promise<string | null> {
    const paneNumber = state.panes.length + 1;
    return addPaneWithLaunch(
      { kind: "shell", displayName: "Terminal" },
      `Terminal ${paneNumber}`
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
      const msg = formatErrorMessage(err);
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

    if (state.root) {
      savePanesForWorkspace(state.root, state.panes);
    }

    if (state.focusedPaneId === paneId) {
      state.focusedPaneId = state.panes[0]?.id || null;
    }
    if (state.zoomedPaneId === paneId) {
      state.zoomedPaneId = null;
    }
  }


  function getErrorMessage(): string | null {
    return errorMessage.value;
  }

  function clearErrorMessage() {
    errorMessage.value = null;
  }

  return {
    state: readonly(state),
    recentWorkspaces: readonly(recentWorkspaces),
    selectAndOpenWorkspace,
    openRecentWorkspace,
    removeRecentWorkspace,
    switchWorkspace,
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

