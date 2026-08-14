<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import type { PaneMetadata } from "../types/desktop";
import { usePaneTerminal } from "../composables/usePaneTerminal";
import { useWorkspace } from "../composables/useWorkspace";
import PaneToolbar from "./PaneToolbar.vue";

const props = defineProps<{
  pane: PaneMetadata;
}>();

const { state, updatePaneStatus, updatePaneExitCode, updatePaneError, restartPane, setFocusedPane } = useWorkspace();

const terminalContainer = ref<HTMLDivElement | null>(null);
let terminalInstance: ReturnType<typeof usePaneTerminal> | null = null;

const isFocused = computed(() => state.focusedPaneId === props.pane.id);
const isZoomed = computed(() => state.zoomedPaneId === props.pane.id);

function initializeTerminal() {
  if (terminalInstance) {
    terminalInstance.dispose();
    terminalInstance = null;
  }

  if (terminalContainer.value) {
    terminalInstance = usePaneTerminal(
      props.pane.id,
      props.pane.generation,
      terminalContainer.value,
      (exitCode) => {
        updatePaneExitCode(props.pane.id, exitCode);
      },
      (errCode, msg) => {
        updatePaneError(props.pane.id, errCode, msg);
      }
    );

    // Initial setup completes, mark status running
    updatePaneStatus(props.pane.id, "running");
  }
}

onMounted(() => {
  initializeTerminal();
});

onUnmounted(() => {
  if (terminalInstance) {
    terminalInstance.dispose();
  }
});

// Re-initialize terminal on restart / new generation
watch(
  () => props.pane.generation,
  () => {
    initializeTerminal();
  }
);

// Focus xterm if state says focused
watch(isFocused, (focused) => {
  if (focused && terminalInstance) {
    terminalInstance.focus();
  }
});

function handlePaneClick() {
  setFocusedPane(props.pane.id);
  if (terminalInstance) {
    terminalInstance.focus();
  }
}

function handleRestart() {
  restartPane(props.pane.id);
}
</script>

<template>
  <div class="terminal-pane" @click="handlePaneClick">
    <PaneToolbar
      :pane="pane"
      :is-focused="isFocused"
      :is-zoomed="isZoomed"
    />

    <div class="pane-body">
      <div ref="terminalContainer" class="terminal-container"></div>

      <div v-if="pane.status === 'starting'" class="overlay status-overlay">
        <div class="spinner"></div>
        <span>Đang khởi động terminal...</span>
      </div>

      <div v-else-if="pane.status === 'exited'" class="overlay status-overlay exited-overlay">
        <span>Tiến trình đã thoát (mã: {{ pane.exitCode }}).</span>
        <button class="action-btn" @click="handleRestart">Khởi động lại</button>
      </div>

      <div v-else-if="pane.status === 'error'" class="overlay status-overlay error-overlay">
        <span class="error-msg">Lỗi: {{ pane.errorMessage || pane.errorCode }}</span>
        <button class="action-btn" @click="handleRestart">Thử lại</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

.pane-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.terminal-container {
  width: 100%;
  height: 100%;
  padding: 4px;
  box-sizing: border-box;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background-color: rgba(14, 17, 23, 0.88);
  backdrop-filter: blur(3px);
  color: var(--text-primary);
  z-index: 10;
}

.status-overlay {
  font-size: 0.825rem;
  color: var(--text-secondary);
}

.exited-overlay {
  border-top: 1px solid var(--border-default);
}

.error-overlay {
  border-top: 1px solid var(--error-color);
}

.error-msg {
  color: var(--error-color);
  max-width: 80%;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.8rem;
}

.action-btn {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  padding: 0.35rem 0.85rem;
  font-size: 0.775rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background-color: var(--accent-color);
  border-color: var(--accent-hover);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: var(--accent-hover);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

