<script setup lang="ts">
import { useWorkspace } from "../composables/useWorkspace";
import type { PaneMetadata } from "../types/desktop";

const props = defineProps<{
  pane: PaneMetadata;
  isFocused: boolean;
  isZoomed: boolean;
}>();

const { restartPane, closePaneById, toggleZoom } = useWorkspace();
</script>

<template>
  <div class="pane-toolbar" :class="{ 'toolbar-focused': isFocused }">
    <div class="toolbar-left">
      <span class="status-indicator" :class="pane.status" :title="`Trạng thái: ${pane.status}`"></span>
      <span class="pane-title">{{ pane.title }}</span>
      <span class="pane-gen">#{{ pane.generation }}</span>
      <span v-if="pane.status !== 'running'" class="status-label" :class="pane.status">
        {{ pane.status }}
      </span>
    </div>

    <div class="toolbar-right">
      <button
        v-if="pane.status === 'exited' || pane.status === 'error'"
        class="icon-btn restart-btn"
        title="Khởi động lại tiến trình"
        aria-label="Khởi động lại tiến trình"
        @click.stop="restartPane(pane.id)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>

      <button
        class="icon-btn"
        :title="isZoomed ? 'Thu nhỏ về grid (Alt+Z)' : 'Phóng to pane (Alt+Z)'"
        :aria-label="isZoomed ? 'Thu nhỏ về grid (Alt+Z)' : 'Phóng to pane (Alt+Z)'"
        @click.stop="toggleZoom(pane.id)"
      >
        <svg v-if="!isZoomed" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>

      <button
        class="icon-btn close-btn"
        title="Đóng terminal (Alt+W)"
        aria-label="Đóng terminal (Alt+W)"
        @click.stop="closePaneById(pane.id)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 27px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
  padding: 0 0.5rem;
  user-select: none;
  transition: background-color 0.12s ease;
}

.toolbar-focused {
  background-color: var(--bg-tertiary);
  border-bottom-color: var(--border-default);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--text-dim);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.status-indicator.running {
  background-color: var(--success-color);
  box-shadow: 0 0 5px rgba(63, 185, 80, 0.4);
}

.status-indicator.starting {
  background-color: var(--warning-color);
}

.status-indicator.error {
  background-color: var(--error-color);
}

.status-indicator.exited {
  background-color: var(--text-dim);
}

.pane-title {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.toolbar-focused .pane-title {
  color: var(--text-primary);
}

.pane-gen {
  font-size: 0.65rem;
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.status-label {
  font-size: 0.65rem;
  font-family: var(--font-mono);
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: 2px;
}

.status-label.starting {
  background-color: var(--warning-bg);
  color: var(--warning-color);
}

.status-label.exited {
  background-color: var(--bg-surface-active);
  color: var(--text-dim);
}

.status-label.error {
  background-color: var(--error-bg);
  color: var(--error-color);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
  transition: all 0.12s ease;
}

.icon-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-surface-hover);
}

.restart-btn:hover {
  color: var(--accent-hover);
}

.close-btn:hover {
  color: var(--error-color);
  background-color: var(--error-bg);
}
</style>

