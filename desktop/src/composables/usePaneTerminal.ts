import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { writePane, resizePane, listenToPaneEvents, type PaneBackendEvent } from "../lib/tauri";

export function usePaneTerminal(
  paneId: string,
  generation: number,
  container: HTMLElement,
  onExitCallback?: (code: number) => void,
  onErrorCallback?: (errCode: string, msg: string) => void
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

  // Send input keys to PTY
  const inputDisposable = term.onData(async (data) => {
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

  listenToPaneEvents((event: PaneBackendEvent) => {
    if (event.paneId !== paneId || event.generation !== generation) {
      return;
    }

    if (event.type === "output" && event.data !== undefined) {
      term.write(event.data);
    } else if (event.type === "exited" && event.exitCode !== undefined) {
      if (onExitCallback) {
        onExitCallback(event.exitCode);
      }
    } else if (event.type === "error" && event.errorCode && event.message) {
      if (onErrorCallback) {
        onErrorCallback(event.errorCode, event.message);
      }
    }
  }).then((unlisten) => {
    unlistenFn = unlisten;
  });

  function focus() {
    term.focus();
  }

  function dispose() {
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
    dispose,
  };
}
