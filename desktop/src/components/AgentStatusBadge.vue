<script setup lang="ts">
import { computed } from "vue";
import type { LaunchProfileKind, PaneActivity, PaneStatus } from "../types/desktop";

const props = withDefaults(
  defineProps<{
    kind: LaunchProfileKind;
    status: PaneStatus;
    activity?: PaneActivity;
    title?: string;
    compact?: boolean;
  }>(),
  {
    activity: "idle",
    title: "",
    compact: false,
  }
);

// Unique gradient IDs per instance to prevent SVG DOM collision
const instanceId = Math.random().toString(36).substring(2, 8);
const rainbowGradId = computed(() => `rainbow-grad-${instanceId}`);
const geminiGradId = computed(() => `gemini-grad-${instanceId}`);

const isWaitingApproval = computed(
  () => props.status === "running" && props.activity === "waiting_approval"
);

const isExecuting = computed(
  () => props.status === "starting" || (props.status === "running" && props.activity === "executing")
);

const isIdle = computed(
  () => props.status === "running" && props.activity === "idle"
);

const statusLabel = computed(() => {
  if (props.status === "starting") return "Starting";
  if (props.status === "running") {
    if (props.activity === "waiting_approval") return "Chờ duyệt [y/N]";
    return props.activity === "executing" ? "Executing" : "Idle";
  }
  if (props.status === "exited") return "Done";
  if (props.status === "error") return "Error";
  if (props.status === "closing") return "Closing";
  return props.status;
});
</script>

<template>
  <div
    class="agent-badge-pill"
    :class="[
      status,
      kind,
      { compact, executing: isExecuting, idle: isIdle, waiting_approval: isWaitingApproval }
    ]"
    :title="title ? `${title} (${kind}: ${statusLabel})` : `${kind}: ${statusLabel}`"
  >
    <!-- Left: Status Indicator / Execution Spinner -->
    <span class="indicator-slot">
      <!-- Waiting Approval: Amber Hourglass -->
      <span v-if="isWaitingApproval" class="waiting-approval-mark">⏳</span>

      <!-- Active Executing: Rotating Green Circle Spinner (matches uploaded user screenshot) -->
      <svg
        v-else-if="isExecuting"
        class="executing-spinner"
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="rgba(16, 185, 129, 0.25)"
          stroke-width="2.2"
        />
        <path
          d="M8 2a6 6 0 0 1 6 6"
          stroke="#10b981"
          stroke-width="2.2"
          stroke-linecap="round"
        />
      </svg>

      <!-- Exited: Green Checkmark -->
      <svg
        v-else-if="status === 'exited'"
        class="exited-check"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>

      <!-- Error: Red Exclamation -->
      <span v-else-if="status === 'error'" class="error-mark">!</span>

      <!-- Idle: Small yellow 'c' mark (matches uploaded user screenshot) -->
      <span v-else class="idle-mark">c</span>
    </span>

    <!-- Right: Agent Brand Logo -->
    <span class="agent-logo" :class="kind">
      <!-- Claude / Antigravity Rainbow Arch Icon (matches uploaded user screenshot) -->
      <svg
        v-if="kind === 'claude'"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
      >
        <defs>
          <linearGradient :id="rainbowGradId" x1="0%" y1="100%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="25%" stop-color="#34d399" />
            <stop offset="50%" stop-color="#fbbf24" />
            <stop offset="75%" stop-color="#fb923c" />
            <stop offset="100%" stop-color="#f43f5e" />
          </linearGradient>
        </defs>
        <path
          d="M4.5 19.5 C 4.5 11 8 5 12 5 C 16 5, 19.5 11, 19.5 19.5"
          :stroke="`url(#${rainbowGradId})`"
          stroke-width="3.2"
          stroke-linecap="round"
        />
      </svg>

      <!-- Gemini: Cyan/Purple Gradient 4-Pointed Sparkle Star -->
      <svg
        v-else-if="kind === 'gemini'"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
      >
        <defs>
          <linearGradient :id="geminiGradId" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="50%" stop-color="#818cf8" />
            <stop offset="100%" stop-color="#c084fc" />
          </linearGradient>
        </defs>
        <path
          d="M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4 Z"
          :fill="`url(#${geminiGradId})`"
        />
      </svg>

      <!-- Codex: Green Hexagon -->
      <svg
        v-else-if="kind === 'codex'"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#10b981"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
      </svg>

      <!-- Shell: Slate Terminal Prompt >_ -->
      <svg
        v-else-if="kind === 'shell'"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#94a3b8"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>

      <!-- Custom Command Icon -->
      <svg
        v-else
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#facc15"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
      </svg>
    </span>

    <!-- Optional Text Label (Shown in non-compact mode) -->
    <span v-if="!compact" class="pill-label">
      {{ statusLabel }}
    </span>
  </div>
</template>

<style scoped>
.agent-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(22, 27, 34, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 2.5px 8px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  line-height: 1;
}

.agent-badge-pill.compact {
  padding: 2px 6px;
  gap: 4px;
}

/* Waiting Approval state (inspired by Orca) */
.agent-badge-pill.waiting_approval {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
}

.waiting-approval-mark {
  font-size: 11px;
  line-height: 1;
  animation: pulse-amber-badge 1.2s infinite ease-out;
}

@keyframes pulse-amber-badge {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

/* Executing active state */
.agent-badge-pill.executing {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.45);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
}

.agent-badge-pill.idle {
  background: rgba(22, 27, 34, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
  opacity: 0.9;
}

.agent-badge-pill.starting {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
}

.agent-badge-pill.error {
  background: rgba(248, 81, 73, 0.14);
  border-color: rgba(248, 81, 73, 0.4);
}

.agent-badge-pill.exited {
  background: rgba(139, 148, 158, 0.1);
  border-color: rgba(255, 255, 255, 0.08);
  opacity: 0.8;
}

/* Slots */
.indicator-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Spinner Animation */
.executing-spinner {
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.exited-check {
  color: #10b981;
  flex-shrink: 0;
}

.error-mark {
  color: #f85149;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
}

.idle-mark {
  color: #eab308;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  line-height: 1;
}

.pill-label {
  font-size: 10.5px;
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.agent-badge-pill.executing .pill-label {
  color: #34d399;
}

.agent-badge-pill.idle .pill-label {
  color: #94a3b8;
}

.agent-badge-pill.starting .pill-label {
  color: #fbbf24;
}

.agent-badge-pill.exited .pill-label {
  color: #94a3b8;
}

.agent-badge-pill.error .pill-label {
  color: #f85149;
}
</style>
