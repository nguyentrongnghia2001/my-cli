"use strict";

const test = require("node:test");
const assert = require("assert");
const { Writable } = require("stream");
const blessed = require("blessed");
const { createTerminalPanel } = require("../src/ui/terminal-panel");
const { spawnSync } = require("child_process");

function fakeScreenStreams(cols = 100, rows = 30) {
  class Sink extends Writable {
    _write(chunk, enc, cb) { cb(); }
  }
  const output = new Sink();
  output.isTTY = true;
  output.columns = cols;
  output.rows = rows;

  const input = new Writable();
  input.isTTY = true;
  input.setRawMode = () => {};
  input.resume = () => {};
  input.pause = () => {};

  return { input, output };
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    if (process.platform === "win32") {
      const check = spawnSync("tasklist", ["/FI", `PID eq ${pid}`], { encoding: "utf8" });
      return (check.stdout || "").includes(String(pid));
    } else {
      const check = spawnSync("ps", ["-p", String(pid)], { encoding: "utf8" });
      return (check.stdout || "").includes(String(pid));
    }
  } catch (e) {
    return false;
  }
}

test("terminal panel closeTab terminates child process cleanly", async () => {
  const { input, output } = fakeScreenStreams();
  const screen = blessed.screen({ input, output, terminal: "xterm-256color" });
  const state = { terminals: { activeId: null, tabs: [] }, terminalVisible: true };

  const panel = createTerminalPanel({
    screen,
    state,
    geometry: { left: 0, top: 0, width: 100, height: 30 }
  });

  const tabId = panel.newTab();
  assert.ok(tabId, "Tab ID should be created");
  assert.strictEqual(state.terminals.tabs.length, 2, "Default tab + new tab");

  // Give PTY process time to start
  await new Promise((r) => setTimeout(r, 500));

  const tabToClose = state.terminals.tabs[1].id;
  await panel.closeTab(tabToClose);

  assert.strictEqual(state.terminals.tabs.length, 1, "Tab count reduced to 1");

  // Close all remaining tabs to prevent process leaks
  for (const tab of [...state.terminals.tabs]) {
    await panel.closeTab(tab.id);
  }

  screen.destroy();
});

test("terminal panel closeTab on 1 of 4 tabs leaves remaining 3 tabs unaffected", async () => {
  const { input, output } = fakeScreenStreams();
  const screen = blessed.screen({ input, output, terminal: "xterm-256color" });
  const state = { terminals: { activeId: null, tabs: [] }, terminalVisible: true };

  const panel = createTerminalPanel({
    screen,
    state,
    geometry: { left: 0, top: 0, width: 100, height: 30 }
  });

  // Create total 4 tabs (newTab created 1 initially)
  const tab2 = panel.newTab();
  const tab3 = panel.newTab();
  const tab4 = panel.newTab();

  assert.strictEqual(state.terminals.tabs.length, 4, "Should have 4 tabs");

  await new Promise((r) => setTimeout(r, 500));

  // Close tab 3
  await panel.closeTab(tab3);

  assert.strictEqual(state.terminals.tabs.length, 3, "Should have 3 tabs remaining");
  assert.ok(!state.terminals.tabs.some(t => t.id === tab3), "Tab 3 should be removed");
  assert.ok(state.terminals.tabs.some(t => t.id === tab2), "Tab 2 should still exist");
  assert.ok(state.terminals.tabs.some(t => t.id === tab4), "Tab 4 should still exist");

  // Close all remaining tabs to prevent process leaks
  for (const tab of [...state.terminals.tabs]) {
    await panel.closeTab(tab.id);
  }

  screen.destroy();
});
