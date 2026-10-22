<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWorkspace } from "../composables/useWorkspace";
import type { LaunchRequest, WorkspaceSession } from "../types/desktop";
import PaneGrid from "./PaneGrid.vue";
import LauncherDialog from "./LauncherDialog.vue";
import ConfirmModal from "./ConfirmModal.vue";
import AgentStatusBadge from "./AgentStatusBadge.vue";

const {
  state,
  activeSession,
  recentWorkspaces,
  addPaneWithLaunch,
  selectAndOpenWorkspace,
  switchWorkspace,
  removeRecentWorkspace,
  closeWorkspace,
  setFocusedPane,
  focusAttentionPane,
  toggleZoom,
  closePaneById,
} = useWorkspace();

interface SessionSummary {
  name: string;
  root: string;
  panes: readonly {
    status: string;
    activity?: string;
    detectedKind?: string;
    title: string;
    errorCode?: string;
    exitCode?: number;
  }[];
}

function isSessionActive(root: string): boolean {
  if (!state.activeRoot) return false;
  return (
    root.replace(/\\/g, "/").toLowerCase() ===
    state.activeRoot.replace(/\\/g, "/").toLowerCase()
  );
}

function getSessionStatus(session: SessionSummary) {
  const waitingApprovalCount = session.panes.filter(
    (p) => p.status === "running" && p.activity === "waiting_approval"
  ).length;
  const executingCount = session.panes.filter(
    (p) => p.status === "running" && p.activity === "executing"
  ).length;
  const runningCount = session.panes.filter(
    (p) => p.status === "running"
  ).length;
  const errorCount = session.panes.filter((p) => p.status === "error").length;
  const exitedCount = session.panes.filter((p) => p.status === "exited").length;

  return {
    hasWaitingApproval: waitingApprovalCount > 0,
    waitingApprovalCount,
    isExecuting: executingCount > 0,
    executingCount,
    isRunning: runningCount > 0,
    runningCount,
    hasError: errorCount > 0,
    errorCount,
    isAllExited: session.panes.length > 0 && exitedCount === session.panes.length,
    totalCount: session.panes.length,
  };
}

function getSessionTooltip(session: SessionSummary): string {
  const lines: string[] = [
    `${session.name} — ${session.root}`,
    "─────────────────────────────",
  ];

  if (session.panes.length === 0) {
    lines.push("Chưa có terminal nào đang chạy.");
  } else {
    for (const pane of session.panes) {
      let icon = "⚪";
      let statusText = "Nhàn rỗi";
      if (pane.status === "running") {
        if (pane.activity === "waiting_approval") {
          icon = "🟡";
          statusText = "Đang chờ duyệt lệnh [y/N]";
        } else if (pane.activity === "executing") {
          icon = "⟳";
          statusText = "Đang thực thi...";
        } else {
          icon = "🟢";
          statusText = "Sẵn sàng (Chờ lệnh)";
        }
      } else if (pane.status === "starting") {
        icon = "🟡";
        statusText = "Đang khởi động...";
      } else if (pane.status === "error") {
        icon = "🔴";
        statusText = `Lỗi (${pane.errorCode || "Unknown"})`;
      } else if (pane.status === "exited") {
        icon = "✓";
        statusText = `Đã xong (mã: ${pane.exitCode ?? 0})`;
      }
      lines.push(`${icon} ${pane.title}: ${statusText}`);
    }
  }

  return lines.join("\n");
}

const isRecentMenuOpen = ref(false);
const isLauncherOpen = ref(false);

// Confirm close pane state
const isConfirmClosePaneOpen = ref(false);
const paneToClose = ref<{ id: string; title: string } | null>(null);

// Confirm close workspace state
const isConfirmCloseWorkspaceOpen = ref(false);
const workspaceToClose = ref<{ root: string; name: string } | null>(null);

const activeWorkspaceName = computed(() => {
  if (!state.activeRoot) return "";
  return state.activeRoot.split(/[/\\]/).filter(Boolean).pop() || state.activeRoot;
});

function handleAddTerminal() {
  const currentCount = activeSession.value?.panes.length || 0;
  if (currentCount < 4) {
    isLauncherOpen.value = true;
  }
}

async function handleLaunchPane(payload: { launch: LaunchRequest; title: string }) {
  await addPaneWithLaunch(payload.launch, payload.title);
}

function requestCloseFocusedPane() {
  if (!state.focusedPaneId) return;
  const pane = state.panes.find((p) => p.id === state.focusedPaneId);
  if (!pane) return;

  if (pane.status === "running") {
    paneToClose.value = { id: pane.id, title: pane.title };
    isConfirmClosePaneOpen.value = true;
  } else {
    closePaneById(pane.id);
  }
}

function confirmCloseFocusedPane() {
  if (paneToClose.value) {
    closePaneById(paneToClose.value.id);
    paneToClose.value = null;
  }
  isConfirmClosePaneOpen.value = false;
}

function cancelCloseFocusedPane() {
  paneToClose.value = null;
  isConfirmClosePaneOpen.value = false;
}

function requestCloseWorkspaceTab(rootPath: string) {
  const session = state.sessions.find((s) => s.root.toLowerCase() === rootPath.toLowerCase());
  if (!session) return;

  const hasRunningPane = session.panes.some((p) => p.status === "running");
  if (hasRunningPane) {
    workspaceToClose.value = { root: session.root, name: session.name };
    isConfirmCloseWorkspaceOpen.value = true;
  } else {
    closeWorkspace(rootPath);
  }
}

function confirmCloseWorkspace() {
  if (workspaceToClose.value) {
    closeWorkspace(workspaceToClose.value.root);
    workspaceToClose.value = null;
  }
  isConfirmCloseWorkspaceOpen.value = false;
}

function cancelCloseWorkspace() {
  workspaceToClose.value = null;
  isConfirmCloseWorkspaceOpen.value = false;
}

function toggleRecentMenu() {
  isRecentMenuOpen.value = !isRecentMenuOpen.value;
}

function closeRecentMenu() {
  isRecentMenuOpen.value = false;
}

async function handleSwitchWorkspace(path: string) {
  closeRecentMenu();
  if (isSessionActive(path)) return;
  await switchWorkspace(path);
}

async function handleOpenOtherWorkspace() {
  closeRecentMenu();
  await selectAndOpenWorkspace();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (isLauncherOpen.value || isConfirmClosePaneOpen.value || isConfirmCloseWorkspaceOpen.value) {
    return;
  }

  if (e.key === "Escape" && isRecentMenuOpen.value) {
    closeRecentMenu();
    return;
  }

  // Ctrl+O opens directory picker
  if (e.ctrlKey && e.key.toLowerCase() === "o") {
    e.preventDefault();
    selectAndOpenWorkspace();
    return;
  }

  // Handle Alt + key shortcuts
  if (!e.altKey || e.ctrlKey || e.metaKey) return;

  const key = e.key.toLowerCase();

  if (key === "n") {
    e.preventDefault();
    handleAddTerminal();
  } else if (key === "w") {
    e.preventDefault();
    requestCloseFocusedPane();
  } else if (key === "z") {
    e.preventDefault();
    if (state.focusedPaneId) {
      toggleZoom(state.focusedPaneId);
    }
  } else if (key >= "1" && key <= "4") {
    const index = parseInt(key) - 1;
    if (index < state.panes.length) {
      e.preventDefault();
      setFocusedPane(state.panes[index].id);
    }
  }
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (isRecentMenuOpen.value && target && !target.closest(".recent-menu-wrap")) {
    closeRecentMenu();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
  document.addEventListener("click", handleDocumentClick);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <div class="workspace-deck">
    <!-- Top Deck Header Bar with Multi-Workspace Tabs -->
    <header class="deck-bar">
      <!-- Workspace Tabs -->
      <div class="workspace-tabs-area">
        <div class="workspace-tabs">
          <div
            v-for="session in state.sessions"
            :key="session.root"
            class="ws-tab"
            :class="{
              active: isSessionActive(session.root),
              'has-waiting': getSessionStatus(session).hasWaitingApproval,
              'has-running': getSessionStatus(session).isExecuting,
              'has-error': getSessionStatus(session).hasError,
            }"
            :title="getSessionTooltip(session)"
            @click="handleSwitchWorkspace(session.root)"
          >
            <svg class="ws-tab-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="ws-tab-name">{{ session.name }}</span>

            <!-- Status Indicator / Pill (matching navbar screenshot) -->
            <div
              v-if="session.panes.length > 0"
              class="ws-tab-status-wrap"
              title="Nhấn để chuyển nhanh tới terminal đang chờ duyệt lệnh hoặc đang thực thi"
              @click.stop="focusAttentionPane(session.root)"
            >
              <!-- Priority 1: Waiting for Approval [y/N] (Amber pulsing dot) -->
              <span
                v-if="getSessionStatus(session).hasWaitingApproval"
                class="ws-tab-pill waiting-approval"
                :title="getSessionTooltip(session)"
              >
                <span class="pulse-dot-amber"></span>
                <span class="pill-count">{{ getSessionStatus(session).waitingApprovalCount }}</span>
              </span>

              <!-- Priority 2: Actively Executing Agent (Green pulsing dot) -->
              <span
                v-else-if="getSessionStatus(session).isExecuting"
                class="ws-tab-pill running executing"
                :title="getSessionTooltip(session)"
              >
                <span class="pulse-dot live"></span>
                <span class="pill-count">{{ getSessionStatus(session).executingCount }}</span>
              </span>

              <!-- Priority 3: Error: red dot -->
              <span
                v-else-if="getSessionStatus(session).hasError"
                class="ws-tab-pill error"
                :title="getSessionTooltip(session)"
              >
                <span class="error-dot"></span>
                <span class="pill-count">{{ getSessionStatus(session).errorCount }}</span>
              </span>

              <!-- Priority 4: Running Idle: solid green dot with count -->
              <span
                v-else-if="getSessionStatus(session).isRunning"
                class="ws-tab-pill running"
                :title="getSessionTooltip(session)"
              >
                <span class="pulse-dot"></span>
                <span class="pill-count">{{ getSessionStatus(session).runningCount }}</span>
              </span>

              <!-- Priority 5: Completed: checkmark -->
              <span
                v-else-if="getSessionStatus(session).isAllExited"
                class="ws-tab-pill exited"
                :title="getSessionTooltip(session)"
              >
                <svg class="check-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="pill-count">{{ session.panes.length }}</span>
              </span>

              <!-- Default neutral count -->
              <span v-else class="ws-tab-pill neutral">
                {{ session.panes.length }}
              </span>
            </div>

            <button
              class="ws-tab-close"
              title="Đóng workspace này"
              aria-label="Đóng workspace này"
              @click.stop="requestCloseWorkspaceTab(session.root)"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Add Workspace Tab Button -->
        <button
          class="add-ws-btn"
          title="Mở thêm Workspace khác... (Ctrl+O)"
          aria-label="Mở thêm Workspace khác"
          @click="selectAndOpenWorkspace"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Workspace</span>
        </button>
      </div>

      <!-- Right Deck Controls -->
      <div class="deck-controls">
        <!-- Quick Recent Workspaces Dropdown -->
        <div class="recent-menu-wrap">
          <button
            class="recent-trigger"
            :class="{ active: isRecentMenuOpen }"
            title="Danh sách workspace gần đây"
            aria-label="Danh sách workspace gần đây"
            @click="toggleRecentMenu"
          >
            <span class="recent-trigger-text">{{ activeWorkspaceName }}</span>
            <svg class="chevron-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <!-- Dropdown Popover -->
          <div v-if="isRecentMenuOpen" class="recent-popover">
            <div class="popover-heading">Workspace gần đây</div>
            <div class="popover-list">
              <div
                v-for="ws in recentWorkspaces"
                :key="ws.path"
                class="popover-item"
                :class="{ current: isSessionActive(ws.path) }"
                @click="handleSwitchWorkspace(ws.path)"
              >
                <div class="item-name">{{ ws.name }}</div>
                <div class="item-path">{{ ws.path }}</div>
                <button
                  class="item-del-btn"
                  title="Xoá khỏi danh sách gần đây"
                  @click.stop="removeRecentWorkspace(ws.path)"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="popover-footer">
              <button class="popover-action-btn" @click="handleOpenOtherWorkspace">
                Mở thư mục khác... (Ctrl+O)
              </button>
            </div>
          </div>
        </div>

        <span class="panes-counter" :title="`Đang mở ${activeSession?.panes.length || 0} trên 4 panes trong workspace này`">
          {{ activeSession?.panes.length || 0 }}/4 Panes
        </span>

        <button
          class="add-terminal-btn"
          :disabled="(activeSession?.panes.length || 0) >= 4"
          :title="(activeSession?.panes.length || 0) >= 4 ? 'Đã đạt giới hạn tối đa 4 terminal cho workspace này' : 'Thêm Terminal (Alt+N)'"
          aria-label="Thêm Terminal (Alt+N)"
          @click="handleAddTerminal"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Terminal</span>
          <kbd>Alt+N</kbd>
        </button>
      </div>
    </header>

    <!-- Main Deck Panes Area: Background Sessions Preserved via v-show -->
    <main class="deck-body">
      <div
        v-for="session in state.sessions"
        :key="session.root"
        v-show="isSessionActive(session.root)"
        class="session-view-wrapper"
      >
        <!-- Notice if this workspace has 0 panes -->
        <div v-if="session.panes.length === 0" class="empty-deck-notice">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="notice-svg">
            <rect x="2" y="4" width="20" height="16" rx="3"></rect>
            <path d="m7 9 3 3-3 3"></path>
            <path d="M12 15h5"></path>
          </svg>
          <p class="notice-text">
            Workspace <strong>{{ session.name }}</strong> đã sẵn sàng. Chưa có terminal nào đang chạy.
          </p>
          <button class="primary-notice-btn" aria-label="Mở Terminal (Alt+N)" @click="handleAddTerminal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Mở Terminal</span>
            <kbd>Alt+N</kbd>
          </button>
        </div>

        <!-- Render Panes Grid for this session -->
        <div v-else class="panes-container">
          <PaneGrid
            :panes="session.panes"
            :focused-pane-id="session.focusedPaneId"
            :zoomed-pane-id="session.zoomedPaneId"
          />
        </div>
      </div>
    </main>

    <!-- Dialogs -->
    <LauncherDialog
      :is-open="isLauncherOpen"
      :pane-count="activeSession?.panes.length || 0"
      :default-cwd="state.activeRoot || undefined"
      @close="isLauncherOpen = false"
      @launch="handleLaunchPane"
    />

    <!-- Confirm Close Running Pane -->
    <ConfirmModal
      :is-open="isConfirmClosePaneOpen"
      title="Đóng terminal đang chạy?"
      :message="`Tiến trình '${paneToClose?.title || ''}' vẫn đang chạy. Đóng pane sẽ chấm dứt tiến trình này.`"
      confirm-text="Đóng tiến trình"
      cancel-text="Hủy bỏ"
      :is-danger="true"
      @confirm="confirmCloseFocusedPane"
      @cancel="cancelCloseFocusedPane"
    />

    <!-- Confirm Close Running Workspace -->
    <ConfirmModal
      :is-open="isConfirmCloseWorkspaceOpen"
      title="Đóng workspace đang chạy?"
      :message="`Workspace '${workspaceToClose?.name || ''}' có terminal vẫn đang thực thi lệnh. Đóng workspace sẽ kết thúc các tiến trình này.`"
      confirm-text="Đóng toàn bộ"
      cancel-text="Hủy bỏ"
      :is-danger="true"
      @confirm="confirmCloseWorkspace"
      @cancel="cancelCloseWorkspace"
    />
  </div>
</template>

<style scoped>
.workspace-deck {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-app);
}

.deck-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 0.5rem;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
  z-index: 50;
  user-select: none;
}

.workspace-tabs-area {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 65%;
  overflow-x: auto;
}

.workspace-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ws-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
  max-width: 280px;
}

.ws-tab:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.ws-tab.active {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: 0 0 0 1px var(--accent-light);
}

.ws-tab-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.ws-tab.active .ws-tab-icon {
  color: var(--accent-hover);
}

.ws-tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-tab.has-waiting:not(.active) {
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
}

.ws-tab.has-running:not(.active) {
  border-color: rgba(63, 185, 80, 0.45);
}

.ws-tab-status-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  border-radius: 9999px;
  transition: transform 0.12s ease;
}

.ws-tab-status-wrap:hover {
  transform: scale(1.08);
}

.ws-tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  border-radius: 9999px;
  padding: 1.5px 7px;
  font-family: var(--font-mono);
  font-weight: 600;
  line-height: 1.2;
}

.ws-tab-pill.waiting-approval {
  background: rgba(245, 158, 11, 0.18);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.5);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
}

.pulse-dot-amber {
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  animation: pulse-amber-pill 1.4s infinite ease-out;
  flex-shrink: 0;
}

@keyframes pulse-amber-pill {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  70% {
    transform: scale(1.15);
    box-shadow: 0 0 0 5px rgba(245, 158, 11, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
}

.ws-tab-pill.running {
  background: rgba(16, 185, 129, 0.16);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.ws-tab-pill.running.executing {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(52, 211, 153, 0.6);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.25);
}

.pulse-dot {
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
}

.pulse-dot.live {
  background: #34d399;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-green 1.4s infinite ease-out;
}

@keyframes pulse-green {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.7);
  }
  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 5px rgba(63, 185, 80, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(63, 185, 80, 0);
  }
}

.ws-tab-pill.error {
  background: rgba(248, 81, 73, 0.18);
  color: #f85149;
  border: 1px solid rgba(248, 81, 73, 0.4);
}

.error-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f85149;
  flex-shrink: 0;
}

.ws-tab-pill.exited {
  background: rgba(139, 148, 158, 0.15);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.check-icon {
  color: #3fb950;
  flex-shrink: 0;
}

.ws-tab-pill.neutral {
  background: var(--bg-primary);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
}

.pill-count {
  font-size: 10px;
}

.ws-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 2px;
  border-radius: 3px;
  cursor: pointer;
  margin-left: 2px;
  transition: all 0.12s ease;
}

.ws-tab-close:hover {
  background: var(--error-bg);
  color: var(--error-color);
}

.add-ws-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px dashed var(--border-default);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}

.add-ws-btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.deck-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.recent-menu-wrap {
  position: relative;
}

.recent-trigger {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.76rem;
  cursor: pointer;
  transition: all 0.12s ease;
  max-width: 140px;
}

.recent-trigger:hover,
.recent-trigger.active {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-default);
}

.recent-trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron-svg {
  color: var(--text-dim);
  flex-shrink: 0;
}

.recent-popover {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 320px;
  max-width: 90vw;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.popover-heading {
  padding: 0.5rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-subtle);
}

.popover-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 0.25rem;
}

.popover-item {
  display: flex;
  flex-direction: column;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  transition: background-color 0.1s ease;
}

.popover-item:hover {
  background-color: var(--bg-surface-hover);
}

.popover-item.current {
  background-color: var(--bg-tertiary);
  border-left: 2px solid var(--accent-color);
}

.item-name {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-primary);
}

.item-path {
  font-size: 0.68rem;
  font-family: var(--font-mono);
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.1rem;
}

.item-del-btn {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text-dim);
  padding: 0.2rem;
  border-radius: 3px;
  cursor: pointer;
  display: none;
}

.popover-item:hover .item-del-btn {
  display: block;
}

.item-del-btn:hover {
  background-color: var(--error-bg);
  color: var(--error-color);
}

.popover-footer {
  padding: 0.35rem;
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-secondary);
}

.popover-action-btn {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.75rem;
  padding: 0.35rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.1s ease;
}

.popover-action-btn:hover {
  background-color: var(--bg-surface-hover);
  color: var(--text-primary);
}

.panes-counter {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background-color: var(--bg-secondary);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.add-terminal-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  background-color: var(--accent-color);
  border: 1px solid transparent;
  color: #fff;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}

.add-terminal-btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.add-terminal-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background-color: var(--bg-surface-hover);
  color: var(--text-dim);
}

.add-terminal-btn kbd {
  background-color: rgba(0, 0, 0, 0.25);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.68rem;
  font-family: var(--font-mono);
  margin-left: 0.2rem;
}

.deck-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.session-view-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.panes-container {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-deck-notice {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--text-muted);
}

.notice-svg {
  opacity: 0.4;
  color: var(--text-dim);
}

.notice-text {
  font-size: 0.85rem;
  margin: 0;
  color: var(--text-secondary);
}

.notice-text strong {
  color: var(--text-primary);
}

.primary-notice-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--accent-color);
  color: #fff;
  border: none;
  padding: 0.45rem 1rem;
  border-radius: 5px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.12s ease;
  margin-top: 0.25rem;
}

.primary-notice-btn:hover {
  background-color: var(--accent-hover);
}

.primary-notice-btn kbd {
  background-color: rgba(0, 0, 0, 0.25);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-family: var(--font-mono);
}
</style>
