import { ref, reactive, readonly, computed } from "vue";
import type {
  WorkspaceViewState,
  WorkspaceSession,
  PaneMetadata,
  LaunchProfileKind,
  LaunchRequest,
  RecentWorkspace,
} from "../types/desktop";
import {
  validateWorkspace,
  pickWorkspaceDirectory,
  createPane,
  closePane,
  closeAllPanes,
  loadAppState,
  saveAppState,
  type AppStateDto,
  type SavedPaneEntry,
} from "../lib/tauri";
import { notifyAgentNeedsApproval, notifyAgentCompleted } from "../lib/notifications";

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

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
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
      memoryPanesStorage = {};
      for (const [k, v] of Object.entries(diskState.workspacePanes)) {
        memoryPanesStorage[normalizePath(k)] = v;
      }
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
    lastActiveWorkspace: state.activeRoot,
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
  const key = normalizePath(wsPath);
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
  const key = normalizePath(wsPath);
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
  sessions: [],
  activeRoot: null,
  root: null,
  panes: [],
  focusedPaneId: null,
  zoomedPaneId: null,
  isClosing: false,
});

const errorMessage = ref<string | null>(null);

function getActiveSession(): WorkspaceSession | null {
  if (!state.activeRoot) return null;
  const normActive = normalizePath(state.activeRoot);
  return (
    state.sessions.find(
      (s) => normalizePath(s.root) === normActive
    ) || null
  );
}

function syncActiveState() {
  const active = getActiveSession();
  if (active) {
    state.root = active.root;
    state.panes = active.panes;
    state.focusedPaneId = active.focusedPaneId;
    state.zoomedPaneId = active.zoomedPaneId;
  } else {
    state.root = null;
    state.panes = [];
    state.focusedPaneId = null;
    state.zoomedPaneId = null;
  }
}

function findPaneAndSession(
  paneId: string
): { pane: PaneMetadata; session: WorkspaceSession } | null {
  for (const session of state.sessions) {
    const pane = session.panes.find((p) => p.id === paneId);
    if (pane) return { pane, session };
  }
  return null;
}

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
    localStorage.removeItem(`wsedit:panes:${normalizePath(pathToRemove)}`);
  } catch {}
  delete memoryPanesStorage[normalizePath(pathToRemove)];
  persistAllToDisk();
}

async function addPaneToSession(
  session: WorkspaceSession,
  launch: LaunchRequest,
  title: string
): Promise<string | null> {
  if (session.panes.length >= 4) {
    errorMessage.value = "Mỗi workspace chỉ được mở tối đa 4 terminal pane.";
    return null;
  }

  const paneId = `pane_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const generation = 1;
  const newPane: PaneMetadata = {
    id: paneId,
    generation,
    title,
    launch,
    status: "starting",
    cols: 80,
    rows: 24,
  };

  session.panes.push(newPane);
  session.focusedPaneId = paneId;
  syncActiveState();
  savePanesForWorkspace(session.root, session.panes);

  // If launch specifies a custom cwd, use it; otherwise use the workspace root
  const effectiveCwd = launch.cwd || session.root;

  try {
    await createPane(
      paneId,
      generation,
      effectiveCwd,
      launch,
      newPane.cols,
      newPane.rows
    );
    newPane.status = "running";
    newPane.activity = "idle";
    syncActiveState();
    return paneId;
  } catch (err: unknown) {
    const msg = formatErrorMessage(err);
    newPane.status = "error";
    newPane.errorCode = "SpawnFailed";
    newPane.errorMessage = msg;
    syncActiveState();
    return null;
  }
}

export function useWorkspace() {
  /** Open a workspace directory and set it as active without terminating other sessions. */
  async function openWorkspacePath(targetPath: string): Promise<boolean> {
    errorMessage.value = null;
    try {
      const result = await validateWorkspace(targetPath);
      if (!result.valid || !result.canonicalPath) {
        errorMessage.value =
          result.errorMessage || "Thư mục không tồn tại hoặc không thể truy cập.";
        return false;
      }

      const canonical = result.canonicalPath;
      const normCanonical = normalizePath(canonical);
      let session = state.sessions.find(
        (s) => normalizePath(s.root) === normCanonical
      );

      if (!session) {
        const name = canonical.split(/[/\\]/).filter(Boolean).pop() || canonical;
        session = {
          root: canonical,
          name,
          panes: [],
          focusedPaneId: null,
          zoomedPaneId: null,
        };
        state.sessions.push(session);
        state.activeRoot = canonical;
        syncActiveState();

        const saved = getSavedPanesForWorkspace(canonical);
        for (const item of saved) {
          await addPaneToSession(session, item.launch, item.title);
        }
      } else {
        state.activeRoot = session.root;
        syncActiveState();
      }

      recordRecentWorkspace(canonical);
      localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, canonical);
      persistAllToDisk();
      return true;
    } catch (err: unknown) {
      const msg = formatErrorMessage(err);
      errorMessage.value = `Lỗi mở workspace: ${msg}`;
      return false;
    }
  }

  /** Select a workspace directory via native dialog and validate it in Rust. */
  async function selectAndOpenWorkspace(): Promise<boolean> {
    errorMessage.value = null;
    try {
      const selectedPath = await pickWorkspaceDirectory();
      if (!selectedPath) return false;
      return await openWorkspacePath(selectedPath);
    } catch (err: unknown) {
      const msg = formatErrorMessage(err);
      errorMessage.value = `Lỗi mở workspace: ${msg}`;
      return false;
    }
  }

  /** Open a workspace directly from the recent list or active key. */
  async function openRecentWorkspace(path: string): Promise<boolean> {
    return await openWorkspacePath(path);
  }

  /** Switch active workspace without closing previous background sessions. */
  async function switchWorkspace(path: string): Promise<boolean> {
    const norm = normalizePath(path);
    const existing = state.sessions.find(
      (s) => normalizePath(s.root) === norm
    );
    if (existing) {
      state.activeRoot = existing.root;
      syncActiveState();
      localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, existing.root);
      persistAllToDisk();
      return true;
    }
    return await openWorkspacePath(path);
  }

  /** Set the workspace root directly (useful for tests/demos). */
  async function setWorkspaceRoot(path: string): Promise<boolean> {
    return await openWorkspacePath(path);
  }

  /** Close a specific workspace session (or active workspace) and its panes. */
  async function closeWorkspace(rootToClose?: string) {
    const targetRoot = rootToClose || state.activeRoot;
    if (!targetRoot) return;

    const sessionIndex = state.sessions.findIndex(
      (s) => s.root.toLowerCase() === targetRoot.toLowerCase()
    );
    if (sessionIndex === -1) return;

    const session = state.sessions[sessionIndex];

    // Terminate only this session's PTY processes
    for (const pane of session.panes) {
      try {
        await closePane(pane.id, pane.generation);
      } catch (err) {
        console.warn(`Failed to close PTY for pane ${pane.id}:`, err);
      }
    }

    state.sessions.splice(sessionIndex, 1);

    if (state.activeRoot?.toLowerCase() === targetRoot.toLowerCase()) {
      state.activeRoot = state.sessions[0]?.root || null;
    }

    syncActiveState();

    if (state.activeRoot) {
      localStorage.setItem(LAST_ACTIVE_WORKSPACE_KEY, state.activeRoot);
    } else {
      localStorage.removeItem(LAST_ACTIVE_WORKSPACE_KEY);
    }
    persistAllToDisk();
  }

  /** Close all workspaces and all panes (e.g. on application exit). */
  async function closeAllWorkspaces() {
    state.isClosing = true;
    try {
      await closeAllPanes();
    } catch (err) {
      console.warn("Failed to close all panes on backend:", err);
    }
    state.sessions = [];
    state.activeRoot = null;
    syncActiveState();
    state.isClosing = false;
    localStorage.removeItem(LAST_ACTIVE_WORKSPACE_KEY);
    persistAllToDisk();
  }

  /** Add a terminal pane with specific launch request configuration to the active workspace. */
  async function addPaneWithLaunch(
    launch: LaunchRequest,
    title: string
  ): Promise<string | null> {
    const active = getActiveSession();
    if (!active) return null;
    return await addPaneToSession(active, launch, title);
  }

  /** Directly add an interactive shell terminal without prompting for CLI. */
  async function addShellPane(): Promise<string | null> {
    const active = getActiveSession();
    const count = active ? active.panes.length + 1 : 1;
    return addPaneWithLaunch(
      { kind: "shell", displayName: "Terminal" },
      `Terminal ${count}`
    );
  }

  function setFocusedPane(paneId: string) {
    const found = findPaneAndSession(paneId);
    if (found) {
      found.session.focusedPaneId = paneId;
      syncActiveState();
    }
  }

  // Zoom management
  function toggleZoom(paneId: string) {
    const found = findPaneAndSession(paneId);
    if (!found) return;
    const { session } = found;
    if (session.zoomedPaneId === paneId) {
      session.zoomedPaneId = null;
    } else {
      session.zoomedPaneId = paneId;
      session.focusedPaneId = paneId;
    }
    syncActiveState();
  }

  function updatePaneStatus(paneId: string, status: PaneMetadata["status"]) {
    const found = findPaneAndSession(paneId);
    if (found) {
      found.pane.status = status;
      syncActiveState();
    }
  }

  function updatePaneActivity(paneId: string, activity: PaneMetadata["activity"]) {
    const found = findPaneAndSession(paneId);
    if (found) {
      const oldActivity = found.pane.activity;
      found.pane.activity = activity;
      syncActiveState();

      if (activity === "waiting_approval" && oldActivity !== "waiting_approval") {
        notifyAgentNeedsApproval();
      } else if (activity === "idle" && oldActivity === "executing") {
        notifyAgentCompleted();
      }
    }
  }

  /**
   * Jump and focus directly to the terminal pane requiring user attention
   * (e.g. waiting for approval [y/N] or currently executing).
   */
  function focusAttentionPane(targetRoot?: string) {
    const root = targetRoot || state.activeRoot;
    if (!root) return;

    if (state.activeRoot?.toLowerCase() !== root.toLowerCase()) {
      switchWorkspace(root);
    }

    const session = state.sessions.find(
      (s) => s.root.toLowerCase() === root.toLowerCase()
    );
    if (!session || session.panes.length === 0) return;

    const target =
      session.panes.find(
        (p) => p.status === "running" && p.activity === "waiting_approval"
      ) ||
      session.panes.find(
        (p) => p.status === "running" && p.activity === "executing"
      ) ||
      session.panes[0];

    if (target) {
      if (session.zoomedPaneId && session.zoomedPaneId !== target.id) {
        session.zoomedPaneId = null;
      }
      session.focusedPaneId = target.id;
      syncActiveState();

      // Dispatch event so the xterm instance receives focus even if already selected
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("wsedit:focus-pane", { detail: { paneId: target.id } })
        );
      }, 50);
    }
  }

  function updatePaneDetectedKind(paneId: string, kind: LaunchProfileKind) {
    const found = findPaneAndSession(paneId);
    if (found && (found.pane.launch.kind === "shell" || found.pane.launch.kind === "custom")) {
      found.pane.detectedKind = kind;
      syncActiveState();
    }
  }

  function updatePaneDimensions(paneId: string, cols: number, rows: number) {
    const found = findPaneAndSession(paneId);
    if (found) {
      found.pane.cols = cols;
      found.pane.rows = rows;
    }
  }

  function updatePaneExitCode(paneId: string, exitCode: number) {
    const found = findPaneAndSession(paneId);
    if (found) {
      found.pane.status = "exited";
      found.pane.exitCode = exitCode;
      syncActiveState();
    }
  }

  function updatePaneError(paneId: string, errorCode: string, message: string) {
    const found = findPaneAndSession(paneId);
    if (found) {
      found.pane.status = "error";
      found.pane.errorCode = errorCode;
      found.pane.errorMessage = message;
      syncActiveState();
    }
  }

  async function restartPane(paneId: string) {
    const found = findPaneAndSession(paneId);
    if (!found) return;
    const { pane, session } = found;

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
    syncActiveState();

    const effectiveCwd = pane.launch.cwd || session.root;

    try {
      await createPane(
        paneId,
        pane.generation,
        effectiveCwd,
        pane.launch,
        pane.cols,
        pane.rows
      );
      pane.status = "running";
      pane.activity = "idle";
      syncActiveState();
    } catch (err: unknown) {
      const msg = formatErrorMessage(err);
      updatePaneError(paneId, "SpawnFailed", msg);
    }
  }

  async function closePaneById(paneId: string) {
    const found = findPaneAndSession(paneId);
    if (!found) return;
    const { session } = found;

    const index = session.panes.findIndex((p) => p.id === paneId);
    if (index === -1) return;

    const pane = session.panes[index];

    try {
      await closePane(paneId, pane.generation);
    } catch (err) {
      console.warn(`Error closing pane on backend:`, err);
    }

    session.panes.splice(index, 1);
    savePanesForWorkspace(session.root, session.panes);

    if (session.focusedPaneId === paneId) {
      session.focusedPaneId = session.panes[0]?.id || null;
    }
    if (session.zoomedPaneId === paneId) {
      session.zoomedPaneId = null;
    }
    syncActiveState();
  }

  function renamePane(paneId: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const found = findPaneAndSession(paneId);
    if (found) {
      found.pane.title = trimmed;
      savePanesForWorkspace(found.session.root, found.session.panes);
      syncActiveState();
    }
  }

  function getErrorMessage(): string | null {
    return errorMessage.value;
  }

  function clearErrorMessage() {
    errorMessage.value = null;
  }

  const activeSession = computed(() => getActiveSession());

  return {
    state: readonly(state),
    activeSession,
    recentWorkspaces: readonly(recentWorkspaces),
    selectAndOpenWorkspace,
    openRecentWorkspace,
    removeRecentWorkspace,
    switchWorkspace,
    setWorkspaceRoot,
    closeWorkspace,
    closeAllWorkspaces,
    addPaneWithLaunch,
    addShellPane,
    setFocusedPane,
    focusAttentionPane,
    toggleZoom,
    updatePaneStatus,
    updatePaneActivity,
    updatePaneDetectedKind,
    updatePaneDimensions,
    updatePaneExitCode,
    updatePaneError,
    restartPane,
    closePaneById,
    renamePane,
    getErrorMessage,
    clearErrorMessage,
  };
}
