import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { writePane, resizePane, listenToPaneEvents, type PaneBackendEvent } from "../lib/tauri";
import type { LaunchProfileKind, PaneActivity } from "../types/desktop";

export function usePaneTerminal(
  paneId: string,
  generation: number,
  container: HTMLElement,
  onExitCallback?: (code: number) => void,
  onErrorCallback?: (errCode: string, msg: string) => void,
  onActivityCallback?: (activity: PaneActivity) => void,
  onDetectedKindCallback?: (kind: LaunchProfileKind) => void
) {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, "Courier New", monospace',
    fontSize: 13.5,
    lineHeight: 1.25,
    theme: {
      background: "#0e1117",
      foreground: "#f0f6fc",
      cursor: "#58a6ff",
      cursorAccent: "#0e1117",
      selectionBackground: "rgba(56, 139, 253, 0.35)",
      black: "#161b22",
      red: "#ff7b72",
      green: "#3fb950",
      yellow: "#d29922",
      blue: "#58a6ff",
      magenta: "#bc8cff",
      cyan: "#39c5cf",
      white: "#d0d7de",
      brightBlack: "#484f58",
      brightRed: "#ffa198",
      brightGreen: "#56d364",
      brightYellow: "#e3b341",
      brightBlue: "#79c0ff",
      brightMagenta: "#d2a8ff",
      brightCyan: "#56d4dd",
      brightWhite: "#ffffff",
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);

  // Allow global window hotkeys (Alt+N, Alt+W, Alt+Z, Alt+1-4) to bubble up
  term.attachCustomKeyEventHandler((e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "n" || key === "w" || key === "z" || (key >= "1" && key <= "4")) {
        return false;
      }
    }
    return true;
  });

  // Measure dimensions after mount
  fitAddon.fit();
  const cols = term.cols;
  const rows = term.rows;

  const encoder = new TextEncoder();

  // Activity tracking state
  let currentActivity: PaneActivity = "idle";
  let idleTimer: number | null = null;
  let submittedPrompt = false;

  function stripAnsi(text: string): string {
    return text
      .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
      .replace(/\x1b\].*?(\x07|\x1b\\)/g, "")
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
  }

  function setActivity(activity: PaneActivity) {
    if (currentActivity !== activity) {
      currentActivity = activity;
      onActivityCallback?.(activity);
    }
  }

  function scheduleIdle(delayMs: number) {
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
    }
    idleTimer = window.setTimeout(() => {
      submittedPrompt = false;
      setActivity("idle");
    }, delayMs);
  }

  function processOutput(data: string) {
    // 1. Agent brand auto-detection from raw output
    if (onDetectedKindCallback) {
      const lowerRaw = data.toLowerCase();
      if (
        lowerRaw.includes("antigravity") ||
        lowerRaw.includes("agy ") ||
        data.includes("Antigravity CLI")
      ) {
        onDetectedKindCallback("claude"); // Antigravity uses rainbow arch
      } else if (lowerRaw.includes("claude code") || lowerRaw.includes("@anthropic-ai/claude-code")) {
        onDetectedKindCallback("claude");
      } else if (lowerRaw.includes("gemini cli") || lowerRaw.includes("gemini 3.8") || lowerRaw.includes("gemini-cli")) {
        onDetectedKindCallback("gemini");
      } else if (lowerRaw.includes("codex cli") || lowerRaw.includes("@openai/codex")) {
        onDetectedKindCallback("codex");
      }
    }

    const clean = stripAnsi(data).trim();
    if (!clean) return;
    const lower = clean.toLowerCase();

    // 2. Waiting for approval [y/N]
    const hasApprovalQuestion =
      /\[(?:y\/n|y\/N|Y\/n)\]/i.test(clean) ||
      /\(y\)\s*es\s*\/\s*\(n\)\s*o/i.test(clean) ||
      lower.includes("allow this command") ||
      lower.includes("do you want to run") ||
      lower.includes("allow tool") ||
      lower.includes("grant permission");

    if (hasApprovalQuestion) {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
      submittedPrompt = false;
      setActivity("waiting_approval");
      return;
    }

    // 3. Active Agent Execution Signals (Loading..., Thinking..., Spinners)
    // Only trigger executing when the agent is genuinely thinking, loading, or spinning!
    const hasActiveAgentSignal =
      lower.includes("loading") ||
      lower.includes("thinking") ||
      lower.includes("generating") ||
      lower.includes("searching") ||
      lower.includes("reading") ||
      lower.includes("analyzing") ||
      lower.includes("working") ||
      /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(data);

    if (hasActiveAgentSignal) {
      submittedPrompt = false;
      setActivity("executing");
      scheduleIdle(2500);
      return;
    }

    // 4. Prompt detection (Interactive prompt returned -> Agent is IDLE)
    const isAtPrompt =
      clean.endsWith(">") ||
      clean.endsWith("$") ||
      clean.endsWith("%") ||
      clean.endsWith("#") ||
      clean.endsWith("❯") ||
      lower.endsWith("? for shortcuts") ||
      lower.endsWith("ai: out of credits");

    if (isAtPrompt) {
      submittedPrompt = false;
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
      setActivity("idle");
      return;
    }

    // 5. If user submitted a prompt and agent is streaming response output (non-prompt stream)
    if (submittedPrompt && clean.length > 5) {
      setActivity("executing");
      scheduleIdle(1500);
    }
  }

  // Listen to terminal title changes from CLI
  term.onTitleChange((title) => {
    if (onDetectedKindCallback) {
      const lower = title.toLowerCase();
      if (lower.includes("antigravity")) {
        onDetectedKindCallback("claude");
      } else if (lower.includes("claude")) {
        onDetectedKindCallback("claude");
      } else if (lower.includes("gemini")) {
        onDetectedKindCallback("gemini");
      } else if (lower.includes("codex")) {
        onDetectedKindCallback("codex");
      }
    }
  });

  // Send input keys to PTY
  const inputDisposable = term.onData(async (data) => {
    // When user submits Enter or responds to approval:
    // Mark submittedPrompt = true so subsequent response stream is recognized,
    // but DO NOT setActivity("executing") until the agent actually responds!
    if (
      data.includes("\r") ||
      data.includes("\n") ||
      (currentActivity === "waiting_approval" && (data.toLowerCase() === "y" || data.toLowerCase() === "n"))
    ) {
      submittedPrompt = true;
    }
    const bytes = Array.from(encoder.encode(data));
    try {
      await writePane(paneId, generation, bytes);
    } catch (e) {
      console.error("Failed to write to pane PTY:", e);
    }
  });

  // Observe and propagate resize
  let resizeTimer: number | null = null;
  const resizeObserver = new ResizeObserver(() => {
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(async () => {
      if (!container.clientWidth || !container.clientHeight) return;
      try {
        fitAddon.fit();
        const nextCols = term.cols;
        const nextRows = term.rows;
        if (nextCols > 0 && nextRows > 0) {
          await resizePane(paneId, generation, nextCols, nextRows);
        }
      } catch (e) {
        console.warn("Resize error:", e);
      }
    }, 100);
  });
  resizeObserver.observe(container);

  // Listen to PTY events
  let unlistenFn: (() => void) | null = null;
  let isDisposed = false;

  listenToPaneEvents((event: PaneBackendEvent) => {
    if (isDisposed) return;
    if (event.paneId !== paneId || event.generation !== generation) {
      return;
    }

    if (event.type === "output" && event.data !== undefined) {
      term.write(event.data);
      processOutput(event.data);
    } else if (event.type === "exited" && event.exitCode !== undefined) {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
      setActivity("idle");
      if (onExitCallback) {
        onExitCallback(event.exitCode);
      }
    } else if (event.type === "error" && event.errorCode && event.message) {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
      setActivity("idle");
      if (onErrorCallback) {
        onErrorCallback(event.errorCode, event.message);
      }
    }
  }).then((unlisten) => {
    if (isDisposed) {
      unlisten();
    } else {
      unlistenFn = unlisten;
    }
  });

  function focus() {
    term.focus();
  }

  function fit() {
    try {
      fitAddon.fit();
    } catch (e) {
      console.debug("xterm fit skipped:", e);
    }
  }

  function dispose() {
    isDisposed = true;
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer);
    }
    inputDisposable.dispose();
    resizeObserver.disconnect();
    if (unlistenFn) {
      unlistenFn();
    }
    term.dispose();
  }

  return {
    cols,
    rows,
    focus,
    fit,
    dispose,
  };
}
