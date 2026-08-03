"use strict";

const path = require("path");

function createState(root) {
  return {
    root: root,
    focus: "explorer", // "explorer" | "editor" | "terminal" | "overlay"
    sidebarVisible: true,
    terminalVisible: false,
    tree: {},
    treeCursor: null,
    editors: {
      activeId: null,
      tabs: []
    },
    terminals: {
      activeId: null,
      tabs: []
    }
  };
}

function onChange(state, listener) {
  if (!state._listeners) {
    state._listeners = new Set();
  }
  state._listeners.add(listener);
  return () => state._listeners.delete(listener);
}

function emitChange(state) {
  if (state._listeners) {
    for (const listener of state._listeners) {
      listener();
    }
  }
}

function setFocus(state, focus) {
  state.focus = focus;
  emitChange(state);
}

function toggleSidebar(state) {
  state.sidebarVisible = !state.sidebarVisible;
  emitChange(state);
}

function toggleTerminal(state) {
  state.terminalVisible = !state.terminalVisible;
  emitChange(state);
}

function openFile(state, filePath, buffer) {
  const resolvedPath = path.resolve(state.root, filePath);
  
  const existingTab = state.editors.tabs.find(
    tab => path.resolve(state.root, tab.filePath) === resolvedPath
  );

  if (existingTab) {
    state.editors.activeId = existingTab.id;
    emitChange(state);
    return existingTab.id;
  }

  const newId = "e" + Date.now() + Math.floor(Math.random() * 1000);
  const newTab = {
    id: newId,
    filePath: filePath,
    lines: buffer.lines,
    eol: buffer.eol,
    cursor: buffer.cursor,
    scroll: buffer.scroll,
    dirty: buffer.dirty,
    readOnly: false // Will be set externally if needed, but we init to false
  };

  state.editors.tabs.push(newTab);
  state.editors.activeId = newId;
  emitChange(state);
  return newId;
}

function closeTab(state, tabId) {
  const index = state.editors.tabs.findIndex(t => t.id === tabId);
  if (index !== -1) {
    state.editors.tabs.splice(index, 1);
    if (state.editors.activeId === tabId) {
      if (state.editors.tabs.length > 0) {
        state.editors.activeId = state.editors.tabs[Math.max(0, index - 1)].id;
      } else {
        state.editors.activeId = null;
      }
    }
    emitChange(state);
  }
}

function setActiveTab(state, tabId) {
  const tab = state.editors.tabs.find(t => t.id === tabId);
  if (tab) {
    state.editors.activeId = tabId;
    emitChange(state);
  }
}

function activeTab(state) {
  if (!state.editors.activeId) return null;
  return state.editors.tabs.find(t => t.id === state.editors.activeId) || null;
}

function setTreeCursor(state, treePath) {
  state.treeCursor = treePath;
  emitChange(state);
}

function setTreeNode(state, treePath, node) {
  state.tree[treePath] = node;
  emitChange(state);
}

module.exports = {
  createState,
  onChange,
  emitChange,
  setFocus,
  toggleSidebar,
  toggleTerminal,
  openFile,
  closeTab,
  setActiveTab,
  activeTab,
  setTreeCursor,
  setTreeNode
};
