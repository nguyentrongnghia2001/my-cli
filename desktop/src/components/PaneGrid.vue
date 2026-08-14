<script setup lang="ts">
import { computed } from "vue";
import type { PaneMetadata } from "../types/desktop";
import TerminalPane from "./TerminalPane.vue";
import { useWorkspace } from "../composables/useWorkspace";

const props = defineProps<{
  panes: readonly PaneMetadata[];
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
}>();

const { setFocusedPane } = useWorkspace();

const layoutClass = computed(() => {
  if (props.zoomedPaneId) {
    return "grid-zoomed";
  }
  const count = props.panes.length;
  switch (count) {
    case 1:
      return "grid-1";
    case 2:
      return "grid-2";
    case 3:
      return "grid-3";
    case 4:
      return "grid-4";
    default:
      return "grid-empty";
  }
});
</script>

<template>
  <div class="pane-grid" :class="layoutClass">
    <div
      v-for="(pane, index) in panes"
      :key="pane.id"
      class="pane-wrapper"
      :class="{
        'pane-focused': pane.id === focusedPaneId,
        'pane-zoomed': pane.id === zoomedPaneId,
        'pane-hidden': zoomedPaneId !== null && pane.id !== zoomedPaneId,
        [`pane-slot-${index + 1}`]: true,
      }"
      @click="setFocusedPane(pane.id)"
    >
      <TerminalPane :pane="pane" />
    </div>
  </div>
</template>

<style scoped>
.pane-grid {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 4px;
  box-sizing: border-box;
}

/* 1 pane: 1 x 1 */
.grid-1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

/* 2 panes: 2 columns */
.grid-2 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}

/* 3 panes: pane 1 spans 2 rows on left; panes 2 & 3 stack on right */
.grid-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.grid-3 .pane-slot-1 {
  grid-row: 1 / span 2;
  grid-column: 1;
}

.grid-3 .pane-slot-2 {
  grid-row: 1;
  grid-column: 2;
}

.grid-3 .pane-slot-3 {
  grid-row: 2;
  grid-column: 2;
}

/* 4 panes: 2 x 2 */
.grid-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* Zoomed layout */
.grid-zoomed {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.pane-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.pane-wrapper.pane-focused {
  border-color: var(--border-accent);
  box-shadow: 0 0 0 1px var(--border-focus);
}

.pane-wrapper.pane-hidden {
  display: none !important;
}
</style>

