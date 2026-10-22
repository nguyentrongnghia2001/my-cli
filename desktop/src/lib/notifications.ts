import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a gentle ascending chime when an agent needs user approval ([y/N]).
 * Dual pleasant bell chime: 587Hz (D5) -> 880Hz (A5).
 */
export function playApprovalSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.debug("Audio notification suppressed:", e);
  }
}

/**
 * Play a subtle completion chime when an agent finishes generating.
 * Harmonic chime: C6 (1046.5Hz).
 */
export function playCompletionSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1046.5, now); // C6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.debug("Audio notification suppressed:", e);
  }
}

/**
 * Flash the Windows taskbar icon if the application window is minimized or not focused.
 */
export async function flashTaskbar(type: "critical" | "informational" = "critical") {
  try {
    const win = getCurrentWindow();
    const isFocused = await win.isFocused();
    if (!isFocused || document.hidden) {
      const attentionType =
        type === "critical"
          ? UserAttentionType.Critical
          : UserAttentionType.Informational;
      await win.requestUserAttention(attentionType);
    }
  } catch (err) {
    console.debug("Taskbar attention flash skipped:", err);
  }
}

/**
 * Trigger both audio chime and Windows taskbar attention when an agent needs user approval.
 */
export function notifyAgentNeedsApproval() {
  playApprovalSound();
  flashTaskbar("critical");
}

/**
 * Trigger both audio chime and Windows taskbar attention when an agent completes execution.
 */
export function notifyAgentCompleted() {
  playCompletionSound();
  flashTaskbar("informational");
}
