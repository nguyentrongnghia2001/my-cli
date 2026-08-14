<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useWorkspace } from "../composables/useWorkspace";
import PaneGrid from "./PaneGrid.vue";

const {
  state,
  recentWorkspaces,
  addShellPane,
  selectAndOpenWorkspace,
  switchWorkspace,
  removeRecentWorkspace,
  closeWorkspace,
  setFocusedPane,
  toggleZoom,
  closePaneById,
} = useWorkspace();

const isWorkspaceMenuOpen = ref(false);

const workspaceName = computed(() => {
  if (!state.root) return "";
  return state.root.split(/[/\\]/).filter(Boolean).pop() || state.root;
});

function handleAddTerminal() {
  if (state.panes.length < 4) {
    addShellPane();
  }
}

function toggleWorkspaceMenu() {
  isWorkspaceMenuOpen.value = !isWorkspaceMenuOpen.value;
}

function closeWorkspaceMenu() {
  isWorkspaceMenuOpen.value = false;
}

async function handleSwitchWorkspace(path: string) {
  closeWorkspaceMenu();
  if (state.root?.toLowerCase() === path.toLowerCase()) return;
  await switchWorkspace(path);
}

async function handleOpenOtherWorkspace() {
  closeWorkspaceMenu();
  await selectAndOpenWorkspace();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isWorkspaceMenuOpen.value) {
    closeWorkspaceMenu();
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
    if (state.focusedPaneId) {
      closePaneById(state.focusedPaneId);
    }
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
  if (isWorkspaceMenuOpen.value && target && !target.closest(".workspace-menu-wrap")) {
    closeWorkspaceMenu();
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
    <!-- Top Deck Header Bar -->
    <header class="deck-bar">
      <!-- Workspace Switcher Selector -->
      <div class="workspace-menu-wrap">
        <button
          class="ws-trigger"
          :class="{ active: isWorkspaceMenuOpen }"
          title="Chuyển đổi workspace"
          aria-label="Chuyển đổi workspace"
          @click="toggleWorkspaceMenu"
        >
          <svg class="ws-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="ws-name">{{ workspaceName }}</span>
          <span class="ws-full-path">{{ state.root }}</span>
          <svg class="chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <!-- Dropdown Popover -->
        <div v-if="isWorkspaceMenuOpen" class="ws-popover">
          <div class="popover-heading">
            <span>Danh sách Workspace</span>
          </div>

          <div class="popover-list">
            <div
              v-for="ws in recentWorkspaces"
              :key="ws.path"
              class="popover-item"
              :class="{ current: state.root?.toLowerCase() === ws.path.toLowerCase() }"
              :title="ws.path"
              @click="handleSwitchWorkspace(ws.path)"
            >
              <div class="item-check">
                <svg v-if="state.root?.toLowerCase() === ws.path.toLowerCase()" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div class="item-details">
                <div class="item-title">{{ ws.name }}</div>
                <div class="item-sub">{{ ws.path }}</div>
              </div>
              <button
                v-if="state.root?.toLowerCase() !== ws.path.toLowerCase()"
                class="item-del"
                title="Xoá khỏi danh sách"
                @click.stop="removeRecentWorkspace(ws.path)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <div class="popover-divider"></div>

          <div class="popover-actions">
            <button class="popover-action-btn" @click="handleOpenOtherWorkspace">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Mở thư mục khác...</span>
            </button>
            <button class="popover-action-btn danger" @click="closeWorkspace">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Đóng Workspace</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Deck Actions -->
      <div class="deck-controls">
        <span class="panes-counter" :title="`Đang mở ${state.panes.length} trên 4 panes`">
          {{ state.panes.length }}/4 Panes
        </span>

        <button
          class="add-terminal-btn"
          :disabled="state.panes.length >= 4"
          :title="state.panes.length >= 4 ? 'Đã đạt giới hạn tối đa 4 terminal' : 'Thêm Terminal (Alt+N)'"
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

    <!-- Main Deck Panes Area -->
    <main class="deck-body">
      <div v-if="state.panes.length === 0" class="empty-deck-notice">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="notice-svg">
          <rect x="2" y="4" width="20" height="16" rx="3"></rect>
          <path d="m7 9 3 3-3 3"></path>
          <path d="M12 15h5"></path>
        </svg>
        <p class="notice-text">Workspace đã sẵn sàng. Chưa có terminal nào đang chạy.</p>
        <button class="primary-notice-btn" aria-label="Mở Terminal (Alt+N)" @click="handleAddTerminal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Mở Terminal</span>
          <kbd>Alt+N</kbd>
        </button>
      </div>

      <div v-else class="panes-container">
        <PaneGrid
          :panes="state.panes"
          :focused-pane-id="state.focusedPaneId"
          :zoomed-pane-id="state.zoomedPaneId"
        />
      </div>
    </main>
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
  height: 36px;
  padding: 0 0.75rem;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-subtle);
  position: relative;
  z-index: 50;
}

.workspace-menu-wrap {
  position: relative;
  max-width: 65%;
}

.ws-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  max-width: 100%;
  transition: all 0.12s ease;
}

.ws-trigger:hover,
.ws-trigger.active {
  background-color: var(--bg-tertiary);
  border-color: var(--border-default);
}

.ws-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.ws-name {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.ws-full-path {
  font-family: var(--font-mono);
  color: var(--text-dim);
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevron-svg {
  color: var(--text-dim);
  flex-shrink: 0;
}

.ws-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 360px;
  max-width: 90vw;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
}

.popover-heading {
  padding: 0.45rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.popover-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.popover-item:hover {
  background-color: var(--bg-secondary);
}

.popover-item.current {
  background-color: var(--accent-light);
}

.item-check {
  width: 14px;
  color: var(--accent-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-details {
  flex: 1;
  min-width: 0;
}

.item-title {
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-sub {
  color: var(--text-dim);
  font-size: 0.7rem;
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-del {
  background: none;
  border: none;
  color: var(--text-dim);
  padding: 3px;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
}

.item-del:hover {
  opacity: 1;
  color: var(--error-color);
  background-color: var(--error-bg);
}

.popover-divider {
  height: 1px;
  background-color: var(--border-subtle);
  margin: 0.2rem 0;
}

.popover-actions {
  padding: 0.25rem 0;
}

.popover-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.75rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.775rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
}

.popover-action-btn:hover {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.popover-action-btn.danger:hover {
  color: var(--error-color);
  background-color: var(--error-bg);
}

.deck-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.panes-counter {
  font-size: 0.725rem;
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.add-terminal-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background-color: var(--accent-color);
  color: #ffffff;
  border: none;
  padding: 0.25rem 0.6rem;
  font-size: 0.775rem;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.add-terminal-btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.add-terminal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deck-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 4px;
  overflow: hidden;
}

.empty-deck-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  gap: 0.75rem;
}

.notice-svg {
  color: var(--text-dim);
}

.notice-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.primary-notice-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.primary-notice-btn:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-hover);
}

.panes-container {
  width: 100%;
  height: 100%;
}
</style>


