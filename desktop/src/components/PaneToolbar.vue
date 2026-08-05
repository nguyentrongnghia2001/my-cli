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
      <span class="focus-dot" :class="{ active: isFocused }"></span>
      <span class="pane-title">{{ pane.title }} (Gen {{ pane.generation }})</span>
      <span class="pane-status" :class="pane.status">{{ pane.status }}</span>
    </div>

    <div class="toolbar-right">
      <button
        v-if="pane.status === 'exited' || pane.status === 'error'"
        class="toolbar-btn action-btn"
        title="Khởi động lại terminal"
        @click.stop="restartPane(pane.id)"
      >
        Restart
      </button>
      <button
        class="toolbar-btn action-btn"
        :title="isZoomed ? 'Thu nhỏ về grid' : 'Phóng to pane'"
        @click.stop="toggleZoom(pane.id)"
      >
        {{ isZoomed ? "Unzoom" : "Zoom" }}
      </button>
      <button
        class="toolbar-btn close-btn"
        title="Đóng terminal"
        @click.stop="closePaneById(pane.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.pane-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0 0.5rem;
  user-select: none;
}

.toolbar-focused {
  background-color: var(--bg-tertiary);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.focus-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: transparent;
}

.focus-dot.active {
  background-color: var(--accent-color);
  box-shadow: 0 0 4px var(--accent-color);
}

.pane-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.pane-status {
  font-size: 0.7rem;
  padding: 1px 4px;
  border-radius: 2px;
  text-transform: uppercase;
  font-weight: 600;
  font-family: var(--font-sans);
}

.pane-status.starting {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.pane-status.running {
  background-color: rgba(137, 209, 133, 0.1);
  color: var(--success-color);
}

.pane-status.exited {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
}

.pane-status.closing {
  background-color: rgba(244, 135, 113, 0.1);
  color: var(--error-color);
}

.pane-status.error {
  background-color: rgba(244, 135, 113, 0.2);
  color: var(--error-color);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.toolbar-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.close-btn {
  font-size: 1.1rem;
  padding: 0 4px;
  line-height: 1;
}

.close-btn:hover {
  color: var(--error-color);
}
</style>
