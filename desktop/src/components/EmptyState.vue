<script setup lang="ts">
import { useWorkspace } from "../composables/useWorkspace";

const {
  recentWorkspaces,
  selectAndOpenWorkspace,
  openRecentWorkspace,
  removeRecentWorkspace,
  getErrorMessage,
} = useWorkspace();

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes}m trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d trước`;
  return new Date(timestamp).toLocaleDateString("vi-VN");
}
</script>

<template>
  <div class="empty-state">
    <div class="deck-card">
      <!-- Brand Header -->
      <div class="deck-header">
        <div class="brand-badge">
          <svg class="terminal-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span class="brand-title">wsedit</span>
          <span class="version-tag">DECK</span>
        </div>
        <p class="deck-desc">
          Môi trường đa terminal deck gọn nhẹ cho workspace cục bộ.
        </p>
      </div>

      <!-- Error message -->
      <div v-if="getErrorMessage()" class="error-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{{ getErrorMessage() }}</span>
      </div>

      <!-- Primary Action -->
      <div class="primary-action-wrap">
        <button class="open-workspace-btn" @click="selectAndOpenWorkspace">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="btn-text">Mở thư mục Workspace...</span>
          <kbd>Ctrl+O</kbd>
        </button>
      </div>

      <!-- Recent Workspaces -->
      <div class="recent-container">
        <div class="recent-header">
          <span class="recent-title">Workspace gần đây</span>
          <span v-if="recentWorkspaces.length" class="badge-pill">
            {{ recentWorkspaces.length }}
          </span>
        </div>

        <div v-if="recentWorkspaces.length > 0" class="recent-list">
          <div
            v-for="ws in recentWorkspaces"
            :key="ws.path"
            class="recent-row"
            :title="ws.path"
            @click="openRecentWorkspace(ws.path)"
          >
            <div class="row-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="row-content">
              <div class="row-name">{{ ws.name }}</div>
              <div class="row-path">{{ ws.path }}</div>
            </div>
            <div class="row-meta">
              <span class="row-time">{{ formatTime(ws.lastOpened) }}</span>
              <button
                class="del-btn"
                title="Xoá khỏi danh sách"
                aria-label="Xoá khỏi danh sách"
                @click.stop="removeRecentWorkspace(ws.path)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty-hint">
          <span>Chưa có workspace nào trong lịch sử. Chọn một thư mục để bắt đầu.</span>
        </div>
      </div>

      <!-- Footer Help -->
      <div class="deck-footer">
        <span>Tối đa 4 terminal panes độc lập &bull; Phím tắt <kbd>Alt+N</kbd> thêm terminal</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
  background-color: var(--bg-app);
}

.deck-card {
  width: 480px;
  max-width: 95vw;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 1.75rem;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.deck-header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.brand-badge {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.terminal-svg {
  color: var(--accent-hover);
}

.brand-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
  font-family: var(--font-mono);
}

.version-tag {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background-color: var(--accent-light);
  color: var(--accent-hover);
  letter-spacing: 0.8px;
}

.deck-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.45;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: var(--error-bg);
  border: 1px solid var(--error-color);
  color: var(--error-color);
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  line-height: 1.35;
}

.primary-action-wrap {
  display: flex;
}

.open-workspace-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.65rem 0.9rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.open-workspace-btn:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-hover);
  box-shadow: 0 0 0 1px var(--accent-hover);
}

.btn-text {
  flex: 1;
  text-align: left;
  margin-left: 0.6rem;
}

.recent-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-top: 1px solid var(--border-subtle);
  padding-top: 1rem;
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent-title {
  font-size: 0.725rem;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.badge-pill {
  font-size: 0.65rem;
  font-family: var(--font-mono);
  background-color: var(--bg-secondary);
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: 210px;
  overflow-y: auto;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.65rem;
  background-color: var(--bg-secondary);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.recent-row:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--border-default);
}

.row-icon {
  color: var(--text-dim);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.recent-row:hover .row-icon {
  color: var(--accent-hover);
}

.row-content {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.row-name {
  color: var(--text-primary);
  font-size: 0.825rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-path {
  color: var(--text-dim);
  font-size: 0.72rem;
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.row-time {
  font-size: 0.7rem;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.del-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  padding: 3px;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.del-btn:hover {
  color: var(--error-color);
  background-color: var(--error-bg);
}

.empty-hint {
  padding: 1rem;
  font-size: 0.775rem;
  color: var(--text-dim);
  text-align: center;
  background-color: var(--bg-secondary);
  border: 1px dashed var(--border-subtle);
  border-radius: 4px;
}

.deck-footer {
  font-size: 0.72rem;
  color: var(--text-dim);
  text-align: center;
  border-top: 1px solid var(--border-subtle);
  padding-top: 0.85rem;
}
</style>


