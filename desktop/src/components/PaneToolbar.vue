<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useWorkspace } from "../composables/useWorkspace";
import type { PaneMetadata } from "../types/desktop";

const props = defineProps<{
  pane: PaneMetadata;
  isFocused: boolean;
  isZoomed: boolean;
}>();

const { restartPane, closePaneById, toggleZoom, renamePane } = useWorkspace();

const isEditing = ref(false);
const editTitle = ref(props.pane.title);
const inputRef = ref<HTMLInputElement | null>(null);

function startRename() {
  editTitle.value = props.pane.title;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

function finishRename() {
  if (isEditing.value) {
    const trimmed = editTitle.value.trim();
    if (trimmed) {
      renamePane(props.pane.id, trimmed);
    }
    isEditing.value = false;
  }
}

function cancelRename() {
  isEditing.value = false;
}
</script>

<template>
  <div class="pane-toolbar" :class="{ 'toolbar-focused': isFocused }">
    <div class="toolbar-left">
      <span class="status-indicator" :class="pane.status" :title="`Trạng thái: ${pane.status}`"></span>
      
      <!-- Title Display & Inline Rename -->
      <div
        v-if="!isEditing"
        class="title-group"
        title="Nhấp đúp để đổi tên"
        @dblclick.stop="startRename"
      >
        <span class="pane-title">{{ pane.title }}</span>
        <button
          class="edit-title-btn"
          title="Đổi tên terminal"
          aria-label="Đổi tên terminal"
          @click.stop="startRename"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </button>
      </div>

      <input
        v-else
        ref="inputRef"
        v-model="editTitle"
        class="rename-input"
        type="text"
        maxlength="30"
        @keydown.enter.stop="finishRename"
        @keydown.esc.stop="cancelRename"
        @blur="finishRename"
        @click.stop
      />

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

.title-group {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  border-radius: 3px;
  padding: 1px 3px;
  margin: -1px -3px;
  transition: background-color 0.12s ease;
}

.title-group:hover {
  background-color: var(--bg-surface-hover);
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

.edit-title-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-dim);
  border-radius: 2px;
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.12s ease, color 0.12s ease;
}

.title-group:hover .edit-title-btn {
  opacity: 1;
}

.edit-title-btn:hover {
  color: var(--accent-hover);
}

.rename-input {
  font-size: 0.775rem;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-focus);
  border-radius: 3px;
  padding: 0 4px;
  height: 19px;
  width: 110px;
  outline: none;
  box-shadow: 0 0 0 1px var(--border-focus);
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

