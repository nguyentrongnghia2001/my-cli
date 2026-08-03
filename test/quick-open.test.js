"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { createHeadlessScreen } = require("./smoke-ui.test.js");
const { createQuickOpen } = require("../src/ui/quick-open.js");

test("QuickOpen regression: construct and open() does not throw due to null parent", (t) => {
  const screen = createHeadlessScreen();
  const qo = createQuickOpen({
    screen,
    state: { root: "/root" },
    geometry: { left: 0, top: 0, width: 100, height: 100 },
    actions: { cycleFocus: () => {} },
    getCandidates: () => []
  });
  
  assert.doesNotThrow(() => {
    qo.open();
  });
  
  assert.doesNotThrow(() => {
    qo.close();
  });
  
  // screen is still usable
  assert.ok(screen.screenshot());
  
  qo.destroy();
  screen.destroy();
});

test("QuickOpen filtering, Enter, and ranking", async (t) => {
  const screen = createHeadlessScreen();
  const candidates = [
    "/root/src/app.js",
    "/root/src/util.js",
    "/root/test/app.test.js"
  ];
  
  let openedPath = null;
  const actions = {
    openFile: (path) => { openedPath = path; },
    cycleFocus: () => {}
  };
  
  const qo = createQuickOpen({
    screen,
    state: { root: "/root" },
    geometry: { left: 0, top: 0, width: 100, height: 100 },
    actions,
    getCandidates: () => candidates
  });
  
  qo.open();
  
  const input = qo.element.children.find(c => c.type === 'textbox');
  const list = qo.element.children.find(c => c.type === 'list');
  assert.ok(input);
  assert.ok(list);
  
  // Type 'app'
  input.value = "app";
  input.emit("keypress", null, { name: "a" });
  
  // Wait for 10ms debounce
  await new Promise(r => setTimeout(r, 20));
  
  // Filtering should happen and 'app.js' should be ranked above 'app.test.js'
  assert.strictEqual(list.items.length, 2, "Should filter out util.js");
  
  const firstItemText = list.items[0].content;
  assert.ok(firstItemText.includes("app.js"), "Best match app.js should be top");
  
  // Press enter
  input.emit("keypress", null, { name: "enter" });
  
  assert.strictEqual(openedPath, "/root/src/app.js", "Should call openFile with ABSOLUTE path");
  
  qo.destroy();
  screen.destroy();
});

test("QuickOpen Escape calls neither openFile nor throws", (t) => {
  const screen = createHeadlessScreen();
  let called = false;
  const qo = createQuickOpen({
    screen,
    state: { root: "/root" },
    geometry: { left: 0, top: 0, width: 100, height: 100 },
    actions: { 
      openFile: () => { called = true; },
      cycleFocus: () => {}
    },
    getCandidates: () => ["/root/a"]
  });
  
  qo.open();
  const input = qo.element.children.find(c => c.type === 'textbox');
  input.emit("keypress", null, { name: "escape" });
  
  assert.strictEqual(called, false, "Escape must not call openFile");
  
  qo.destroy();
  screen.destroy();
});

test("QuickOpen factory returns expected structure", (t) => {
  const screen = createHeadlessScreen();
  const qo = createQuickOpen({
    screen,
    state: { root: "/root" },
    geometry: { left: 0, top: 0, width: 100, height: 100 },
    actions: { cycleFocus: () => {} },
    getCandidates: () => []
  });
  
  assert.ok(qo.element, "Should have element");
  assert.strictEqual(typeof qo.render, "function");
  assert.strictEqual(typeof qo.setGeometry, "function");
  assert.strictEqual(typeof qo.destroy, "function");
  assert.strictEqual(typeof qo.open, "function");
  assert.strictEqual(typeof qo.close, "function");
  
  qo.destroy();
  screen.destroy();
});
