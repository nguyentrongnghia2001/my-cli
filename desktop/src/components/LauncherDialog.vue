<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { ProfileDetection, LaunchRequest } from "../types/desktop";
import { detectProfiles } from "../lib/tauri";
import { useWorkspace } from "../composables/useWorkspace";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { addPaneWithLaunch } = useWorkspace();

const profiles = ref<ProfileDetection[]>([]);
const loading = ref(true);
const activeTab = ref<"profiles" | "custom">("profiles");

const customCommand = ref("");
const customArgs = ref("");
const customError = ref("");

onMounted(async () => {
  try {
    profiles.value = await detectProfiles();
  } catch (e) {
    console.error("Lỗi phát hiện launch profile:", e);
  } finally {
    loading.value = false;
  }
});

function launchProfile(profile: ProfileDetection) {
  if (!profile.available) return;

  const launch: LaunchRequest = {
    kind: profile.kind,
    displayName: profile.displayName,
  };

  addPaneWithLaunch(launch, profile.displayName);
  emit("close");
}

function handleLaunchCustom() {
  customError.value = "";
  const cmd = customCommand.value.trim();
  if (!cmd) {
    customError.value = "Vui lòng nhập lệnh hoặc đường dẫn thực thi.";
    return;
  }

  const argsList = customArgs.value
    .trim()
    .split(/\s+/)
    .filter((a) => a.length > 0);

  const launch: LaunchRequest = {
    kind: "custom",
    displayName: cmd.split(/[/\\]/).pop() || cmd,
    command: cmd,
    args: argsList.length > 0 ? argsList : undefined,
  };

  addPaneWithLaunch(launch, launch.displayName);
  emit("close");
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Thêm Terminal Pane mới</h3>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>

      <div class="tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'profiles' }"
          @click="activeTab = 'profiles'"
        >
          Profile có sẵn
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'custom' }"
          @click="activeTab = 'custom'"
        >
          Lệnh tùy chỉnh (Custom)
        </button>
      </div>

      <div v-if="activeTab === 'profiles'" class="modal-body">
        <div v-if="loading" class="loading-state">
          Đang dò tìm công cụ trong PATH...
        </div>

        <div v-else class="profiles-list">
          <div
            v-for="profile in profiles"
            :key="profile.kind"
            class="profile-card"
            :class="{ disabled: !profile.available }"
            @click="launchProfile(profile)"
          >
            <div class="profile-main">
              <span class="profile-name">{{ profile.displayName }}</span>
              <span v-if="profile.available" class="badge available">Khả dụng</span>
              <span v-else class="badge unavailable">Chưa cài đặt</span>
            </div>

            <div class="profile-detail">
              <span v-if="profile.available && profile.resolvedPath" class="path">
                {{ profile.resolvedPath }}
              </span>
              <span v-else-if="!profile.available" class="unavailable-hint">
                Không tìm thấy lệnh "{{ profile.kind }}" trong PATH hệ thống.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="modal-body">
        <form class="custom-form" @submit.prevent="handleLaunchCustom">
          <div class="form-group">
            <label>Tên lệnh hoặc đường dẫn file (.exe, .cmd, .bat):</label>
            <input
              v-model="customCommand"
              type="text"
              placeholder="ví dụ: python, node, C:\tools\mytool.exe"
              class="input-field"
            />
          </div>

          <div class="form-group">
            <label>Tham số (tùy chọn, phân cách bởi khoảng trắng):</label>
            <input
              v-model="customArgs"
              type="text"
              placeholder="ví dụ: --version --verbose"
              class="input-field"
            />
          </div>

          <div v-if="customError" class="error-msg">
            {{ customError }}
          </div>

          <div class="form-actions">
            <button type="submit" class="primary-btn">Khởi chạy</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.2rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-primary);
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0.6rem;
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
  background-color: var(--bg-secondary);
}

.modal-body {
  padding: 1.2rem;
  max-height: 360px;
  overflow-y: auto;
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.profile-card {
  padding: 0.8rem 1rem;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}

.profile-card:not(.disabled):hover {
  border-color: var(--accent-color);
  background-color: var(--bg-tertiary);
}

.profile-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.profile-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.profile-name {
  font-weight: 500;
  font-size: 0.95rem;
}

.badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.badge.available {
  background-color: rgba(137, 209, 133, 0.15);
  color: var(--success-color);
}

.badge.unavailable {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
}

.profile-detail {
  margin-top: 0.3rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.unavailable-hint {
  color: var(--error-color);
  opacity: 0.8;
}

.custom-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.input-field {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
  font-family: var(--font-mono);
}

.input-field:focus {
  outline: none;
  border-color: var(--accent-color);
}

.error-msg {
  color: var(--error-color);
  font-size: 0.8rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.primary-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  padding: 0.5rem 1.25rem;
  font-size: 0.9rem;
  border-radius: 4px;
  cursor: pointer;
}

.primary-btn:hover {
  background-color: var(--accent-hover);
}
</style>
