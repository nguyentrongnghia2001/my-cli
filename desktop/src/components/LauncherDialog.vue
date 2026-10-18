<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { detectProfiles } from "../lib/tauri";
import type { LaunchProfileKind, LaunchRequest, ProfileDetection } from "../types/desktop";

const props = defineProps<{
  isOpen: boolean;
  paneCount: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "launch", payload: { launch: LaunchRequest; title: string }): void;
}>();

interface ProfileOption {
  kind: LaunchProfileKind;
  displayName: string;
  description: string;
  hint: string;
  icon: string;
  badge?: string;
  available: boolean;
  resolvedPath?: string;
}

const defaultProfiles: ProfileOption[] = [
  {
    kind: "shell",
    displayName: "Default Shell",
    description: "Hệ vỏ lệnh mặc định của Windows (PowerShell / CMD)",
    hint: "Dùng để gõ lệnh, chạy script hoặc công cụ phát triển",
    icon: "terminal",
    available: true,
  },
  {
    kind: "codex",
    displayName: "Codex CLI",
    description: "Trợ lý lập trình viên AI dòng lệnh của OpenAI",
    hint: "Cần cài đặt trước: npm i -g @openai/codex",
    icon: "sparkles",
    available: false,
  },
  {
    kind: "claude",
    displayName: "Claude Code",
    description: "Agentic AI coding assistant của Anthropic",
    hint: "Cần cài đặt trước: npm i -g @anthropic-ai/claude-code",
    icon: "bot",
    available: false,
  },
  {
    kind: "gemini",
    displayName: "Gemini CLI",
    description: "Trợ lý AI dòng lệnh đa năng của Google",
    hint: "Cần cài đặt trước qua PATH của hệ thống",
    icon: "cpu",
    available: false,
  },
  {
    kind: "custom",
    displayName: "Custom Command",
    description: "Khởi chạy một lệnh hoặc file thực thi tuỳ chỉnh",
    hint: "Hỗ trợ đường dẫn, file batch .cmd/.bat và tham số chứa khoảng trắng",
    icon: "command",
    available: true,
  },
];

const profiles = ref<ProfileOption[]>([...defaultProfiles]);
const selectedIndex = ref<number>(0);
const isLoading = ref<boolean>(false);

// Custom command fields
const customCommand = ref<string>("");
const customArgs = ref<string>("");
const customCommandInputRef = ref<HTMLInputElement | null>(null);

async function refreshProfileDetection() {
  isLoading.value = true;
  try {
    const detected = await detectProfiles();
    profiles.value = defaultProfiles.map((p) => {
      if (p.kind === "custom") return p;
      const match = detected.find((d: ProfileDetection) => d.kind === p.kind);
      if (match) {
        return {
          ...p,
          available: match.available,
          resolvedPath: match.resolvedPath,
        };
      }
      return p;
    });
  } catch (err) {
    console.warn("Không thể kiểm tra trạng thái profile từ backend:", err);
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      selectedIndex.value = 0;
      customCommand.value = "";
      customArgs.value = "";
      refreshProfileDetection();
    }
  }
);

const currentProfile = computed(() => profiles.value[selectedIndex.value]);

function selectProfile(index: number) {
  selectedIndex.value = index;
  if (profiles.value[index].kind === "custom") {
    nextTick(() => {
      customCommandInputRef.value?.focus();
    });
  }
}

function handleLaunch() {
  const profile = currentProfile.value;
  if (!profile) return;

  const paneNumber = props.paneCount + 1;

  if (profile.kind === "custom") {
    const rawCmd = customCommand.value.trim();
    if (!rawCmd) {
      customCommandInputRef.value?.focus();
      return;
    }

    const args = customArgs.value.trim()
      ? customArgs.value.trim().split(/\s+/).filter(Boolean)
      : [];

    const title = rawCmd.split(/[/\\]/).pop() || `Custom ${paneNumber}`;

    emit("launch", {
      launch: {
        kind: "custom",
        displayName: rawCmd,
        command: rawCmd,
        args,
      },
      title,
    });
    emit("close");
    return;
  }

  let title = `${profile.displayName} ${paneNumber}`;
  if (profile.kind === "shell") {
    title = `Terminal ${paneNumber}`;
  }

  emit("launch", {
    launch: {
      kind: profile.kind,
      displayName: profile.displayName,
    },
    title,
  });
  emit("close");
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;

  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
    return;
  }

  // If focus is in custom command input, don't steal arrow navigation
  const isInputFocused =
    document.activeElement === customCommandInputRef.value;

  if (e.key === "ArrowDown" && !isInputFocused) {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % profiles.value.length;
    return;
  }

  if (e.key === "ArrowUp" && !isInputFocused) {
    e.preventDefault();
    selectedIndex.value =
      (selectedIndex.value - 1 + profiles.value.length) % profiles.value.length;
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    handleLaunch();
    return;
  }

  // Quick select with 1..5 if not typing in custom command input
  if (!isInputFocused && e.key >= "1" && e.key <= "5") {
    const idx = parseInt(e.key) - 1;
    if (idx < profiles.value.length) {
      e.preventDefault();
      selectProfile(idx);
      if (profiles.value[idx].kind !== "custom") {
        handleLaunch();
      }
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="launcher-overlay" @click.self="emit('close')">
      <div class="launcher-card" role="dialog" aria-modal="true" aria-label="Mở Terminal Mới">
        <!-- Header -->
        <div class="launcher-header">
          <div class="header-left">
            <h3 class="launcher-title">Mở Terminal Mới</h3>
            <p class="launcher-subtitle">
              Chọn một môi trường shell hoặc công cụ AI CLI để mở trong pane mới.
            </p>
          </div>
          <button class="close-icon-btn" title="Đóng (Esc)" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Profiles List -->
        <div class="profiles-list">
          <div
            v-for="(profile, idx) in profiles"
            :key="profile.kind"
            class="profile-item"
            :class="{
              selected: idx === selectedIndex,
              disabled: !profile.available && profile.kind !== 'custom',
            }"
            @click="selectProfile(idx)"
            @dblclick="handleLaunch"
          >
            <div class="profile-key">{{ idx + 1 }}</div>

            <div class="profile-icon">
              <!-- Terminal Icon -->
              <svg v-if="profile.icon === 'terminal'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              <!-- Sparkles Icon -->
              <svg v-else-if="profile.icon === 'sparkles'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3v18"></path>
                <path d="M3 12h18"></path>
                <path d="m5 5 14 14"></path>
                <path d="m19 5-14 14"></path>
              </svg>
              <!-- Bot Icon -->
              <svg v-else-if="profile.icon === 'bot'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                <circle cx="12" cy="5" r="2"></circle>
                <path d="M12 7v4"></path>
                <line x1="8" y1="16" x2="8.01" y2="16"></line>
                <line x1="16" y1="16" x2="16.01" y2="16"></line>
              </svg>
              <!-- CPU Icon -->
              <svg v-else-if="profile.icon === 'cpu'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                <rect x="9" y="9" width="6" height="6"></rect>
                <line x1="9" y1="1" x2="9" y2="4"></line>
                <line x1="15" y1="1" x2="15" y2="4"></line>
                <line x1="9" y1="20" x2="9" y2="23"></line>
                <line x1="15" y1="20" x2="15" y2="23"></line>
                <line x1="20" y1="9" x2="23" y2="9"></line>
                <line x1="20" y1="14" x2="23" y2="14"></line>
                <line x1="1" y1="9" x2="4" y2="9"></line>
                <line x1="1" y1="14" x2="4" y2="14"></line>
              </svg>
              <!-- Command Icon -->
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </div>

            <div class="profile-details">
              <div class="profile-title-row">
                <span class="profile-name">{{ profile.displayName }}</span>
                
                <span v-if="profile.available" class="status-badge available">
                  Sẵn sàng
                </span>
                <span v-else-if="profile.kind !== 'custom'" class="status-badge unavailable" :title="profile.hint">
                  Chưa tìm thấy
                </span>
              </div>
              <p class="profile-desc">{{ profile.description }}</p>
              <p v-if="!profile.available && profile.kind !== 'custom'" class="profile-hint">
                {{ profile.hint }}
              </p>
            </div>
          </div>
        </div>

        <!-- Custom Command Expanded Box -->
        <div v-if="currentProfile?.kind === 'custom'" class="custom-command-box">
          <div class="input-group">
            <label for="custom-cmd-input" class="input-label">Lệnh cần chạy:</label>
            <input
              id="custom-cmd-input"
              ref="customCommandInputRef"
              v-model="customCommand"
              class="text-input"
              type="text"
              placeholder="Ví dụ: python script.py hoặc npm run dev"
              @keydown.enter.stop="handleLaunch"
            />
          </div>

          <div class="input-group">
            <label for="custom-args-input" class="input-label">Tham số bổ sung (tuỳ chọn):</label>
            <input
              id="custom-args-input"
              v-model="customArgs"
              class="text-input"
              type="text"
              placeholder="Ví dụ: --watch --port 8080"
              @keydown.enter.stop="handleLaunch"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="launcher-footer">
          <div class="footer-hint">
            <span>Dùng phím <kbd>1</kbd>..<kbd>5</kbd> hoặc <kbd>↑</kbd><kbd>↓</kbd> để chọn</span>
          </div>
          <div class="footer-actions">
            <button class="btn btn-secondary" @click="emit('close')">
              Hủy bỏ (Esc)
            </button>
            <button
              class="btn btn-primary"
              :disabled="currentProfile?.kind === 'custom' && !customCommand.trim()"
              @click="handleLaunch"
            >
              Khởi chạy (Enter)
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.launcher-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 16px;
}

.launcher-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  max-width: 540px;
  width: 100%;
  padding: 24px;
  animation: card-appear 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.launcher-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.launcher-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.launcher-subtitle {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-muted);
}

.close-icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.close-icon-btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.profile-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.profile-item:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-default);
}

.profile-item.selected {
  background: var(--bg-surface-active);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-color);
}

.profile-item.disabled {
  opacity: 0.65;
}

.profile-key {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--accent-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-details {
  flex: 1;
  min-width: 0;
}

.profile-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.profile-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 12px;
  font-weight: 500;
}

.status-badge.available {
  background: var(--success-bg);
  color: var(--success-color);
}

.status-badge.unavailable {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.profile-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.35;
}

.profile-hint {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.custom-command-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.text-input {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 13px;
  font-family: var(--font-mono);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease;
}

.text-input:focus {
  border-color: var(--accent-color);
}

.launcher-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.footer-hint {
  font-size: 11.5px;
  color: var(--text-muted);
}

.footer-hint kbd {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 10.5px;
  font-family: var(--font-mono);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 15px;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.btn-secondary {
  background: var(--bg-secondary);
  border-color: var(--border-default);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--accent-color);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
