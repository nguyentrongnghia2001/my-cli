<script setup lang="ts">
import { useWorkspace } from "./composables/useWorkspace";
import EmptyState from "./components/EmptyState.vue";
import WorkspaceView from "./components/WorkspaceView.vue";

const { state } = useWorkspace();
</script>

<template>
  <div class="app-container">
    <WorkspaceView v-if="state.root" />
    <EmptyState v-else />
  </div>
</template>

<style>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
