"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { createHeadlessScreen } = require("./smoke-ui.test.js");
const { createTabBar } = require("../src/ui/tab-bar.js");
const { createState, onChange } = require("../src/core/workspace-state.js");

test("TabBar renders entries and marks dirty tabs", (t) => {
  const screen = createHeadlessScreen();
  const state = createState("/root");
  
  state.editors.tabs = [
    { id: "e1", filePath: "/root/clean.txt", dirty: false },
    { id: "e2", filePath: "/root/dirty.txt", dirty: true }
  ];
  state.editors.activeId = "e1";
  
  const tabBar = createTabBar({
    screen,
    state,
    geometry: { left: 0, top: 0, width: 100, height: 1 },
    actions: {}
  });
  
  tabBar.render();
  // Using .content instead of .getContent() because blessed .getContent() might strip content before render
  const content = tabBar.element.content;
  
  assert.ok(content.includes("clean.txt"), "Should render clean tab");
  assert.ok(content.includes("dirty.txt"), "Should render dirty tab");
  assert.ok(content.includes("\u25CF"), "Should show bullet character for dirty tab");
  
  tabBar.destroy();
  screen.destroy();
});

test("TabBar overflow keeps active tab visible", (t) => {
  const screen = createHeadlessScreen();
  const state = createState("/root");
  
  const tabs = [];
  for (let i = 0; i < 20; i++) {
    tabs.push({ id: `e${i}`, filePath: `/root/file${i}.txt`, dirty: false });
  }
  state.editors.tabs = tabs;
  state.editors.activeId = "e15"; // active tab is somewhere in the end
  
  const tabBar = createTabBar({
    screen,
    state,
    geometry: { left: 0, top: 0, width: 30, height: 1 }, // 30 is enough for a few tabs but not all
    actions: {}
  });
  
  tabBar.render();
  const content = tabBar.element.content;
  
  assert.ok(content.includes("file15.txt"), "Active tab should be visible despite overflow");
  
  tabBar.destroy();
  screen.destroy();
});

test("TabBar render() does not mutate state", (t) => {
  const screen = createHeadlessScreen();
  const state = createState("/root");
  
  state.editors.tabs = [
    { id: "e1", filePath: "/root/a.txt", dirty: false }
  ];
  state.editors.activeId = "e1";
  
  let changeCount = 0;
  const unsubscribe = onChange(state, () => {
    changeCount++;
  });
  
  const tabBar = createTabBar({
    screen,
    state,
    geometry: { left: 0, top: 0, width: 100, height: 1 },
    actions: {}
  });
  
  for (let i = 0; i < 3; i++) {
    tabBar.render();
  }
  
  assert.strictEqual(changeCount, 0, "render() should not emit change events");
  
  tabBar.setGeometry({ left: 0, top: 0, width: 10, height: 1 });
  assert.strictEqual(changeCount, 0, "setGeometry() should not emit change events");
  
  unsubscribe();
  tabBar.destroy();
  screen.destroy();
});

test("TabBar setGeometry() with a smaller width does not throw and stays non-mutating", (t) => {
  const screen = createHeadlessScreen();
  const state = createState("/root");
  
  state.editors.tabs = [
    { id: "e1", filePath: "/root/a.txt", dirty: false },
    { id: "e2", filePath: "/root/b.txt", dirty: false }
  ];
  state.editors.activeId = "e1";
  
  const tabBar = createTabBar({
    screen,
    state,
    geometry: { left: 0, top: 0, width: 100, height: 1 },
    actions: {}
  });
  
  tabBar.render();
  
  let changeCount = 0;
  const unsubscribe = onChange(state, () => {
    changeCount++;
  });
  
  assert.doesNotThrow(() => {
    tabBar.setGeometry({ left: 0, top: 0, width: 5, height: 1 }); // Very small width
    tabBar.render();
  });
  
  assert.strictEqual(changeCount, 0, "setGeometry + render should not mutate state");
  
  unsubscribe();
  tabBar.destroy();
  screen.destroy();
});
