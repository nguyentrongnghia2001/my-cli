<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { PaneMetadata } from "../types/desktop";
import TerminalPane from "./TerminalPane.vue";
import { useWorkspace } from "../composables/useWorkspace";

const props = defineProps<{
  panes: readonly PaneMetadata[];
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
}>();

const { setFocusedPane } = useWorkspace();

const gridContainer = ref<HTMLDivElement | null>(null);

// Split percentages (15% to 85%)
const SPLIT_STORAGE_KEY = "wsedit:panel_splits";

function loadSavedSplits() {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        splitX: typeof parsed.splitX === "number" ? parsed.splitX : 50,
        splitY: typeof parsed.splitY === "number" ? parsed.splitY : 50,
        splitYRight: typeof parsed.splitYRight === "number" ? parsed.splitYRight : 50,
      };
    }
  } catch {}
  return { splitX: 50, splitY: 50, splitYRight: 50 };
}

const savedSplits = loadSavedSplits();
const splitX = ref(savedSplits.splitX);
const splitY = ref(savedSplits.splitY);
const splitYRight = ref(savedSplits.splitYRight);

function saveSplits() {
  try {
    localStorage.setItem(
      SPLIT_STORAGE_KEY,
      JSON.stringify({
        splitX: splitX.value,
        splitY: splitY.value,
        splitYRight: splitYRight.value,
      })
    );
  } catch {}
}

// Dragging state
type DragMode = "x" | "y" | "y-right" | null;
const activeDragMode = ref<DragMode>(null);

function startDrag(mode: DragMode, e: MouseEvent) {
  e.preventDefault();
  activeDragMode.value = mode;
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!activeDragMode.value || !gridContainer.value) return;

  const rect = gridContainer.value.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  if (activeDragMode.value === "x") {
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    splitX.value = Math.max(15, Math.min(85, Math.round(rawX * 10) / 10));
  } else if (activeDragMode.value === "y") {
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    splitY.value = Math.max(15, Math.min(85, Math.round(rawY * 10) / 10));
  } else if (activeDragMode.value === "y-right") {
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    splitYRight.value = Math.max(15, Math.min(85, Math.round(rawY * 10) / 10));
  }
}

function onMouseUp() {
  if (activeDragMode.value) {
    activeDragMode.value = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    saveSplits();
  }
}

function resetSplit(mode: "x" | "y" | "y-right") {
  if (mode === "x") splitX.value = 50;
  if (mode === "y") splitY.value = 50;
  if (mode === "y-right") splitYRight.value = 50;
  saveSplits();
}

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
});

const isZoomed = computed(() => props.zoomedPaneId !== null);
const paneCount = computed(() => props.panes.length);

const gridColumnsStyle = computed(() => {
  if (isZoomed.value || paneCount.value <= 1) return "1fr";
  return `${splitX.value}% calc(${100 - splitX.value}% - 4px)`;
});

const gridRowsStyle = computed(() => {
  if (isZoomed.value || paneCount.value <= 2) return "1fr";
  if (paneCount.value === 4) {
    return `${splitY.value}% calc(${100 - splitY.value}% - 4px)`;
  }
  return "1fr 1fr";
});
</script>

<template>
  <div
    ref="gridContainer"
    class="pane-grid-root"
    :class="{
      'is-dragging': activeDragMode !== null,
      'cursor-col': activeDragMode === 'x',
      'cursor-row': activeDragMode === 'y' || activeDragMode === 'y-right',
    }"
  >
    <!-- 1 Pane or Zoomed -->
    <div v-if="isZoomed || paneCount <= 1" class="layout-single">
      <div
        v-for="pane in panes"
        :key="pane.id"
        class="pane-box"
        :class="{
          'pane-focused': pane.id === focusedPaneId,
          'pane-hidden': isZoomed && pane.id !== zoomedPaneId,
        }"
        @click="setFocusedPane(pane.id)"
      >
        <TerminalPane :pane="pane" />
      </div>
    </div>

    <!-- 2 Panes: Left / Right with Vertical Splitter -->
    <div
      v-else-if="paneCount === 2"
      class="layout-2"
      :style="{ gridTemplateColumns: gridColumnsStyle }"
    >
      <div
        v-if="panes[0]"
        class="pane-box"
        :class="{ 'pane-focused': panes[0].id === focusedPaneId }"
        @click="setFocusedPane(panes[0].id)"
      >
        <TerminalPane :pane="panes[0]" />
      </div>

      <div
        class="splitter splitter-vertical"
        :style="{ left: `calc(${splitX}% - 4px)` }"
        title="Kéo để chỉnh kích thước (Nhấp đúp để đặt lại 50:50)"
        @mousedown="startDrag('x', $event)"
        @dblclick="resetSplit('x')"
      >
        <div class="splitter-line"></div>
      </div>

      <div
        v-if="panes[1]"
        class="pane-box"
        :class="{ 'pane-focused': panes[1].id === focusedPaneId }"
        @click="setFocusedPane(panes[1].id)"
      >
        <TerminalPane :pane="panes[1]" />
      </div>
    </div>

    <!-- 3 Panes: Left 1, Right 2 & 3 with Vertical & Horizontal Splitter -->
    <div
      v-else-if="paneCount === 3"
      class="layout-3"
      :style="{ gridTemplateColumns: gridColumnsStyle }"
    >
      <!-- Left Pane 1 -->
      <div
        v-if="panes[0]"
        class="pane-box"
        :class="{ 'pane-focused': panes[0].id === focusedPaneId }"
        @click="setFocusedPane(panes[0].id)"
      >
        <TerminalPane :pane="panes[0]" />
      </div>

      <!-- Vertical Splitter between Left and Right -->
      <div
        class="splitter splitter-vertical"
        :style="{ left: `calc(${splitX}% - 4px)` }"
        title="Kéo để chỉnh kích thước (Nhấp đúp để đặt lại 50:50)"
        @mousedown="startDrag('x', $event)"
        @dblclick="resetSplit('x')"
      >
        <div class="splitter-line"></div>
      </div>

      <!-- Right Column containing Pane 2 & 3 -->
      <div
        class="right-col-stack"
        :style="{
          gridTemplateRows: `${splitYRight}% calc(${100 - splitYRight}% - 4px)`,
        }"
      >
        <div
          v-if="panes[1]"
          class="pane-box"
          :class="{ 'pane-focused': panes[1].id === focusedPaneId }"
          @click="setFocusedPane(panes[1].id)"
        >
          <TerminalPane :pane="panes[1]" />
        </div>

        <!-- Horizontal Splitter between Pane 2 and 3 -->
        <div
          class="splitter splitter-horizontal right-h-splitter"
          :style="{ top: `calc(${splitYRight}% - 4px)` }"
          title="Kéo để chỉnh kích thước (Nhấp đúp để đặt lại 50:50)"
          @mousedown="startDrag('y-right', $event)"
          @dblclick="resetSplit('y-right')"
        >
          <div class="splitter-line"></div>
        </div>

        <div
          v-if="panes[2]"
          class="pane-box"
          :class="{ 'pane-focused': panes[2].id === focusedPaneId }"
          @click="setFocusedPane(panes[2].id)"
        >
          <TerminalPane :pane="panes[2]" />
        </div>
      </div>
    </div>

    <!-- 4 Panes: 2x2 Grid with Cross Splitters -->
    <div
      v-else-if="paneCount === 4"
      class="layout-4"
      :style="{
        gridTemplateColumns: gridColumnsStyle,
        gridTemplateRows: gridRowsStyle,
      }"
    >
      <div
        v-if="panes[0]"
        class="pane-box"
        :class="{ 'pane-focused': panes[0].id === focusedPaneId }"
        @click="setFocusedPane(panes[0].id)"
      >
        <TerminalPane :pane="panes[0]" />
      </div>

      <div
        v-if="panes[1]"
        class="pane-box"
        :class="{ 'pane-focused': panes[1].id === focusedPaneId }"
        @click="setFocusedPane(panes[1].id)"
      >
        <TerminalPane :pane="panes[1]" />
      </div>

      <div
        v-if="panes[2]"
        class="pane-box"
        :class="{ 'pane-focused': panes[2].id === focusedPaneId }"
        @click="setFocusedPane(panes[2].id)"
      >
        <TerminalPane :pane="panes[2]" />
      </div>

      <div
        v-if="panes[3]"
        class="pane-box"
        :class="{ 'pane-focused': panes[3].id === focusedPaneId }"
        @click="setFocusedPane(panes[3].id)"
      >
        <TerminalPane :pane="panes[3]" />
      </div>

      <!-- Vertical Splitter -->
      <div
        class="splitter splitter-vertical"
        :style="{ left: `calc(${splitX}% - 4px)` }"
        title="Kéo để chỉnh độ rộng cột (Nhấp đúp để đặt lại 50:50)"
        @mousedown="startDrag('x', $event)"
        @dblclick="resetSplit('x')"
      >
        <div class="splitter-line"></div>
      </div>

      <!-- Horizontal Splitter -->
      <div
        class="splitter splitter-horizontal"
        :style="{ top: `calc(${splitY}% - 4px)` }"
        title="Kéo để chỉnh chiều cao hàng (Nhấp đúp để đặt lại 50:50)"
        @mousedown="startDrag('y', $event)"
        @dblclick="resetSplit('y')"
      >
        <div class="splitter-line"></div>
      </div>
    </div>

    <!-- Active Drag Overlay to prevent iframe/canvas event capture -->
    <div v-if="activeDragMode !== null" class="drag-shield"></div>
  </div>
</template>

<style scoped>
.pane-grid-root {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.pane-grid-root.is-dragging {
  user-select: none;
}

.pane-grid-root.cursor-col {
  cursor: col-resize;
}

.pane-grid-root.cursor-row {
  cursor: row-resize;
}

/* Layouts */
.layout-single {
  width: 100%;
  height: 100%;
  display: flex;
}

.layout-2 {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 4px;
  position: relative;
}

.layout-3 {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 4px;
  position: relative;
}

.right-col-stack {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 4px;
  position: relative;
}

.layout-4 {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 4px;
  position: relative;
}

/* Pane Box */
.pane-box {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
  overflow: hidden;
  background-color: var(--bg-primary);
  min-width: 0;
  min-height: 0;
}

.pane-box.pane-focused {
  border-color: var(--border-accent);
  box-shadow: 0 0 0 1px var(--border-focus);
}

.pane-box.pane-hidden {
  display: none !important;
}

/* Splitters */
.splitter {
  position: absolute;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.splitter-vertical {
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
}

.splitter-vertical .splitter-line {
  width: 2px;
  height: 100%;
  background-color: var(--border-subtle);
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.splitter-vertical:hover .splitter-line,
.is-dragging.cursor-col .splitter-vertical .splitter-line {
  background-color: var(--border-accent);
  box-shadow: 0 0 6px var(--accent-hover);
}

.splitter-horizontal {
  left: 0;
  right: 0;
  height: 8px;
  cursor: row-resize;
}

.splitter-horizontal .splitter-line {
  height: 2px;
  width: 100%;
  background-color: var(--border-subtle);
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.splitter-horizontal:hover .splitter-line,
.is-dragging.cursor-row .splitter-horizontal .splitter-line {
  background-color: var(--border-accent);
  box-shadow: 0 0 6px var(--accent-hover);
}

.right-h-splitter {
  left: 0;
  right: 0;
}

/* Drag Shield */
.drag-shield {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  cursor: inherit;
  background: transparent;
}
</style>


