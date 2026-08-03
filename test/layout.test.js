"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { computeLayout } = require("../src/ui/layout.js");

test("layout with sidebar and terminal", () => {
  const layout = computeLayout({ screenWidth: 100, screenHeight: 40, sidebarVisible: true, terminalVisible: true });
  assert.ok(layout.sidebar);
  assert.ok(layout.terminal);
  assert.ok(layout.terminalTabBar);
  
  assert.strictEqual(layout.sidebar.width, 28);
  assert.strictEqual(layout.terminal.height, Math.floor(40 * 0.35)); // 14
  assert.strictEqual(layout.statusBar.top, 38);
  assert.strictEqual(layout.hintBar.top, 39);
});

test("layout with hidden sidebar and terminal", () => {
  const layout = computeLayout({ screenWidth: 100, screenHeight: 40, sidebarVisible: false, terminalVisible: false });
  assert.strictEqual(layout.sidebar, null);
  assert.strictEqual(layout.terminal, null);
  assert.strictEqual(layout.terminalTabBar, null);
});

test("layout auto hides on small screen", () => {
  const layout = computeLayout({ screenWidth: 50, screenHeight: 15, sidebarVisible: true, terminalVisible: true });
  assert.strictEqual(layout.sidebar, null);
  assert.strictEqual(layout.terminal, null);
});
