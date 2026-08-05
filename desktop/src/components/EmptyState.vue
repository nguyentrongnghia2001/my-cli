<script setup lang="ts">
import { useWorkspace } from "../composables/useWorkspace";

const { selectAndOpenWorkspace, getErrorMessage } = useWorkspace();
</script>

<template>
  <div class="empty-state">
    <div class="card">
      <h1>wsedit Terminal Deck</h1>
      <p>Chọn một thư mục local workspace để bắt đầu làm việc với các terminal pane.</p>

      <div v-if="getErrorMessage()" class="error-box">
        {{ getErrorMessage() }}
      </div>

      <button class="primary-btn" @click="selectAndOpenWorkspace">
        Mở Workspace
      </button>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: var(--bg-primary);
}

.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 2.5rem;
  max-width: 450px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

h1 {
  margin-top: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  line-height: 1.4;
}

.error-box {
  background-color: rgba(244, 135, 113, 0.1);
  border: 1px solid var(--error-color);
  color: var(--error-color);
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  text-align: left;
}

.primary-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.primary-btn:hover {
  background-color: var(--accent-hover);
}
</style>
