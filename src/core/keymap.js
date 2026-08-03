"use strict";

const GLOBAL_KEYS = {
  "C-q": "quit",
  "C-p": "quickOpen",
  "C-b": "toggleSidebar",
  "C-`": "toggleTerminal",
  "f6": "cycleFocus",
  "C-s": "save",
  "C-w": "closeTab",
  "M-1": "focusTab1",
  "M-2": "focusTab2",
  "M-3": "focusTab3",
  "M-4": "focusTab4",
  "M-5": "focusTab5",
  "M-6": "focusTab6",
  "M-7": "focusTab7",
  "M-8": "focusTab8",
  "M-9": "focusTab9",
};

/**
 * @param {{ state: any, actions: any }} deps
 * @returns {(ch: string, key: any) => boolean}
 */
function createDispatcher({ state, actions }) {
  return function dispatch(ch, key) {
    if (!key) return false;
    const keyName = key.full || key.name;
    
    // LUẬT CỨNG: khi state.focus === "terminal", CHỈ "C-`" và "f6" được xử lý ở đây
    if (state.focus === "terminal") {
      if (keyName === "C-`") {
        if (actions.toggleTerminal) actions.toggleTerminal();
        return true;
      }
      if (keyName === "f6") {
        if (actions.cycleFocus) actions.cycleFocus();
        return true;
      }
      return false; // forward xuống pty
    }
    
    // Global
    const actionName = GLOBAL_KEYS[keyName];
    if (actionName && actions[actionName]) {
      actions[actionName]();
      return true;
    }
    
    return false;
  };
}

module.exports = {
  createDispatcher,
  GLOBAL_KEYS
};
