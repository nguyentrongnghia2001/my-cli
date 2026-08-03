"use strict";

const fs = require("fs");
const path = require("path");
const blessed = require("blessed");
const { emitChange } = require("../core/workspace-state");

let nodePty = null;
let nodePtyError = null;
let XTerm = null;
let xtermError = null;

try {
  nodePty = require("node-pty");
} catch (error) {
  nodePtyError = error;
}

try {
  XTerm = require("blessed-xterm");
} catch (error) {
  xtermError = error;
}

// ---------- geometry ----------

function toInteger(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeGeometry(geometry) {
  const terminalGeometry = geometry && geometry.terminal ? geometry.terminal : geometry;
  const normalizedTerminal = {
    left: toInteger(terminalGeometry && terminalGeometry.left),
    top: toInteger(terminalGeometry && terminalGeometry.top),
    width: toInteger(terminalGeometry && terminalGeometry.width),
    height: toInteger(terminalGeometry && terminalGeometry.height)
  };
  const providedTabBar = geometry && geometry.terminalTabBar;

  return {
    terminal: normalizedTerminal,
    tabBar: providedTabBar ? {
      left: toInteger(providedTabBar.left),
      top: toInteger(providedTabBar.top),
      width: toInteger(providedTabBar.width),
      height: toInteger(providedTabBar.height)
    } : {
      left: normalizedTerminal.left,
      top: Math.max(0, normalizedTerminal.top - 1),
      width: normalizedTerminal.width,
      height: normalizedTerminal.height > 0 ? 1 : 0
    }
  };
}

function applyGeometry(element, geometry) {
  element.left = geometry.left;
  element.top = geometry.top;
  element.width = geometry.width;
  element.height = geometry.height;
}

// ---------- shell ----------

function executableExistsOnPath(command) {
  const pathValue = process.env.PATH || process.env.Path || "";
  const extensions = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  const commandExtension = path.extname(command);
  const candidates = commandExtension ? [command] : [command, ...extensions.map((ext) => command + ext)];

  return pathValue.split(path.delimiter).some((entry) => {
    const directory = entry.replace(/^"|"$/g, "");
    if (!directory) {
      return false;
    }

    return candidates.some((candidate) => fs.existsSync(path.join(directory, candidate)));
  });
}

function resolveShell() {
  if (process.platform === "win32") {
    return executableExistsOnPath("pwsh") ? "pwsh" : "powershell.exe";
  }

  return process.env.SHELL || "bash";
}

function createShellArgs(command) {
  if (!command) {
    return [];
  }

  if (process.platform === "win32") {
    return ["-NoLogo", "-NoProfile", "-Command", command];
  }

  return ["-lc", command];
}

function shellTitle(shell) {
  const title = path.basename(shell);
  return process.platform === "win32" ? title.replace(/\.exe$/i, "") : title;
}

// ---------- unavailable fallback ----------

function createUnavailablePanel({ screen, state, geometry }) {
  let currentGeometry = normalizeGeometry(geometry).terminal;
  const missingPackages = [];

  if (!nodePty || nodePtyError) {
    missingPackages.push("node-pty");
  }
  if (!XTerm || xtermError) {
    missingPackages.push("blessed-xterm");
  }

  const installCommand = `npm install ${missingPackages.join(" ")}`;
  const message = [
    "Tính năng terminal không khả dụng.",
    `Không tải được: ${missingPackages.join(", ")}.`,
    `Hãy chạy: ${installCommand}`
  ].join("\n");
  const element = blessed.box({
    parent: screen,
    left: currentGeometry.left,
    top: currentGeometry.top,
    width: currentGeometry.width,
    height: currentGeometry.height,
    content: message,
    tags: false,
    style: {
      fg: "yellow",
      bg: "black"
    }
  });

  function render() {
    const isVisible = state.terminalVisible !== false && currentGeometry.width > 0 && currentGeometry.height > 0;
    if (isVisible) {
      element.show();
      return;
    }

    element.hide();
  }

  function setGeometry(nextGeometry) {
    currentGeometry = normalizeGeometry(nextGeometry).terminal;
    applyGeometry(element, currentGeometry);
    render();
  }

  function destroy() {
    element.destroy();
  }

  function newTab() {
    return "";
  }

  function closeTab() {}

  function setActiveTab() {}

  function focusActive() {
    element.focus();
  }

  render();

  return {
    element,
    render,
    setGeometry,
    destroy,
    newTab,
    closeTab,
    setActiveTab,
    focusActive
  };
}

// ---------- terminal panel ----------

/**
 * Creates the multi-tab terminal panel.
 *
 * @param {{ screen: object, state: object, geometry: object }} options
 * @returns {{ element: object[], render: () => void, setGeometry: (geometry: object) => void, destroy: () => void, newTab: (options?: { command?: string }) => string, closeTab: (id: string) => void, setActiveTab: (id: string) => void, focusActive: () => void }}
 */
function createTerminalPanel({ screen, state, geometry }) {
  if (!nodePty || !XTerm) {
    return createUnavailablePanel({ screen, state, geometry });
  }

  let currentGeometry = normalizeGeometry(geometry);
  let nextId = 1;
  let destroyed = false;
  const tabs = [];
  const elements = [];

  if (!state.terminals) {
    state.terminals = { activeId: null, tabs: [] };
  }
  if (!Array.isArray(state.terminals.tabs)) {
    state.terminals.tabs = [];
  }

  const tabBar = blessed.box({
    parent: screen,
    left: currentGeometry.tabBar.left,
    top: currentGeometry.tabBar.top,
    width: currentGeometry.tabBar.width,
    height: currentGeometry.tabBar.height,
    tags: false,
    style: {
      fg: "white",
      bg: "blue"
    }
  });
  elements.push(tabBar);

  function metadataFor(id) {
    return state.terminals.tabs.find((tab) => tab.id === id) || null;
  }

  function localTabFor(id) {
    return tabs.find((tab) => tab.id === id) || null;
  }

  function notifyChange() {
    if (!destroyed) {
      emitChange(state);
    }
  }

  function renderTabBar() {
    const labels = state.terminals.tabs.map((tab, index) => {
      const label = `${index + 1}: ${tab.title} ×`;
      return tab.id === state.terminals.activeId ? `[${label}]` : label;
    });
    const content = ` TERMINAL  ${labels.join("  ")}`;
    tabBar.setContent(content.slice(0, currentGeometry.tabBar.width));
  }

  function render() {
    if (destroyed) {
      return;
    }

    const isVisible = state.terminalVisible !== false &&
      currentGeometry.terminal.width > 0 && currentGeometry.terminal.height > 0;

    renderTabBar();
    if (isVisible && currentGeometry.tabBar.height > 0) {
      tabBar.show();
    } else {
      tabBar.hide();
    }

    for (const tab of tabs) {
      if (isVisible && tab.id === state.terminals.activeId) {
        tab.term.show();
      } else {
        tab.term.hide();
      }
    }
  }

  function setGeometry(nextGeometry) {
    currentGeometry = normalizeGeometry(nextGeometry);
    applyGeometry(tabBar, currentGeometry.tabBar);

    for (const tab of tabs) {
      applyGeometry(tab.term, currentGeometry.terminal);
    }

    render();
  }

  function markExited(tab, code) {
    if (tab.exited || destroyed) {
      return;
    }

    const exitCode = Number.isInteger(code) ? code : -1;
    const metadata = metadataFor(tab.id);
    tab.exited = true;
    if (metadata) {
      metadata.exited = true;
      metadata.title = `${metadata.title} [đã thoát: code ${exitCode}]`;
    }
    render();
    notifyChange();
  }

  function newTab(options = {}) {
    const command = typeof options.command === "string" ? options.command.trim() : "";
    const shell = resolveShell();
    const id = `t${Date.now()}-${nextId}`;
    const title = command || shellTitle(shell);
    nextId += 1;

    const term = new XTerm({
      left: currentGeometry.terminal.left,
      top: currentGeometry.terminal.top,
      width: currentGeometry.terminal.width,
      height: currentGeometry.terminal.height,
      shell,
      args: createShellArgs(command),
      cwd: state.root || process.cwd(),
      scrollback: 5000,
      controlKey: "none",
      ignoreKeys: ["C-`", "f6"],
      mousePassthrough: true,
      cursorType: "block",
      style: {
        fg: "default",
        bg: "default"
      }
    });

    screen.append(term);

    const tab = { id, term, exited: false };
    tabs.push(tab);
    elements.push(term);
    state.terminals.tabs.push({ id, title, exited: false });
    state.terminals.activeId = id;

    term.on("title", (nextTitle) => {
      const metadata = metadataFor(id);
      if (!metadata || tab.exited || typeof nextTitle !== "string" || !nextTitle.trim()) {
        return;
      }

      metadata.title = nextTitle.trim();
      render();
      notifyChange();
    });
    term.on("exit", (code) => markExited(tab, code));
    term.on("error", () => {
      term.write("\r\nKhông thể khởi động terminal.\r\n");
      markExited(tab, -1);
    });

    render();
    notifyChange();
    return id;
  }

  function releaseTerminal(tab) {
    const term = tab.term;

    // blessed-xterm destroys its PTY from the widget's destroy handler. Detach
    // and remove that handler so ConPTY can be reaped cleanly with the host.
    if (term._onScreenEventInputData) {
      screen.program.input.removeListener("data", term._onScreenEventInputData);
      term._onScreenEventInputData = null;
    }
    if (term._onScreenEventKeypress) {
      term.removeScreenEvent("keypress", term._onScreenEventKeypress);
      term._onScreenEventKeypress = null;
    }
    if (term._onScreenEventMouse) {
      term.removeScreenEvent("mouse", term._onScreenEventMouse);
      term._onScreenEventMouse = null;
    }
    if (term._resizeTimer !== null) {
      clearImmediate(term._resizeTimer);
      term._resizeTimer = null;
    }

    term.detach();
    term.removeAllListeners();
    term._onWidgetEventKeypress = null;
    if (term.term) {
      term.term.dispose();
      term.term = null;
    }
    if (term.pty && typeof term.pty.removeAllListeners === "function") {
      term.pty.removeAllListeners();
    }
    term._cell = null;
  }

  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return;
    }

    const [tab] = tabs.splice(index, 1);
    releaseTerminal(tab);

    const elementIndex = elements.indexOf(tab.term);
    if (elementIndex !== -1) {
      elements.splice(elementIndex, 1);
    }
    const metadataIndex = state.terminals.tabs.findIndex((item) => item.id === id);
    if (metadataIndex !== -1) {
      state.terminals.tabs.splice(metadataIndex, 1);
    }

    if (state.terminals.activeId === id) {
      const nextTab = tabs[Math.min(index, tabs.length - 1)] || null;
      state.terminals.activeId = nextTab ? nextTab.id : null;
    }

    render();
    notifyChange();
  }

  function setActiveTab(id) {
    if (!localTabFor(id)) {
      return;
    }

    state.terminals.activeId = id;
    render();
    notifyChange();
  }

  function focusActive() {
    const tab = localTabFor(state.terminals.activeId);
    if (tab) {
      tab.term.focus();
    }
  }

  function destroy() {
    if (destroyed) {
      return;
    }

    destroyed = true;
    for (const tab of tabs) {
      releaseTerminal(tab);
    }
    tabs.length = 0;
    state.terminals.tabs.length = 0;
    state.terminals.activeId = null;
    tabBar.destroy();
    elements.length = 0;
  }

  newTab();
  render();

  return {
    element: elements,
    render,
    setGeometry,
    destroy,
    newTab,
    closeTab,
    setActiveTab,
    focusActive
  };
}

module.exports = {
  createTerminalPanel
};
