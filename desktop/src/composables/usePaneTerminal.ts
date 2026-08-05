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
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: {
      background: "#1e1e1e",
      foreground: "#ffffff",
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);

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
