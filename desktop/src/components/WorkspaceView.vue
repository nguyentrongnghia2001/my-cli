<script setup lang="ts">
import { ref } from "vue";
import { useWorkspace } from "../composables/useWorkspace";
import PaneGrid from "./PaneGrid.vue";
import LauncherDialog from "./LauncherDialog.vue";

const { state, closeWorkspace } = useWorkspace();
const isLauncherOpen = ref(false);

function openLauncher() {
  if (state.panes.length < 4) {
    isLauncherOpen.value = true;
  }
}

function closeLauncher() {
  isLauncherOpen.value = false;
}
</script>

<template>
  <div class="workspace-view">
    <header class="header">
      <div class="workspace-info">
        <span class="label">Workspace:</span>
        <span class="path" :title="state.root || ''">{{ state.root }}</span>
      </div>

      <div class="header-actions">
        <button
          v-if="state.panes.length < 4"
          class="primary-btn"
          @click="openLauncher"
        >
          + Thêm Terminal
        </button>
        <button class="secondary-btn" @click="closeWorkspace">
          Đổi Workspace
        </button>
      </div>
    </header>

    <main class="pane-grid-container">
      <div v-if="state.panes.length === 0" class="empty-panes-hint">
        <p>Workspace đã sẵn sàng. Chưa có terminal nào.</p>
        <button class="primary-btn hint-btn" @click="openLauncher">
          Mở Terminal
        </button>
      </div>

      <div v-else class="panes-area">
        <PaneGrid
          :panes="state.panes"
          :focused-pane-id="state.focusedPaneId"
          :zoomed-pane-id="state.zoomedPaneId"
        />
      </div>
    </main>

    <LauncherDialog
      v-if="isLauncherOpen"
      @close="closeLauncher"
    />
  </div>
</template>

<style scoped>
.workspace-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--bg-primary);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 1rem;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.workspace-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  overflow: hidden;
  white-space: nowrap;
}

.label {
  color: var(--text-muted);
  font-weight: 500;
}

.path {
  color: var(--text-primary);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  overflow: hidden;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.primary-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  border-radius: 3px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.primary-btn:hover {
  background-color: var(--accent-hover);
}

.secondary-btn {
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.75rem;
  font-size: 0.8rem;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.pane-grid-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  box-sizing: border-box;
  overflow: hidden;
}

.empty-panes-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-secondary);
}

.hint-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  font-size: 0.9rem;
}

.panes-area {
  width: 100%;
  height: 100%;
}
</style>
