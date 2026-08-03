"use strict";

const blessed = require("blessed");
const chalk = require("chalk");

/**
 * @param {object} state
 * @returns {object | null}
 */
function getActiveTab(state) {
  const editors = state.editors;
  if (!editors || !editors.activeId || !Array.isArray(editors.tabs)) {
    return null;
  }

  return editors.tabs.find((tab) => tab.id === editors.activeId) || null;
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} geometry
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function normalizeGeometry(geometry) {
  return {
    left: Math.max(0, Math.floor(geometry.left)),
    top: Math.max(0, Math.floor(geometry.top)),
    width: Math.max(0, Math.floor(geometry.width)),
    height: Math.max(0, Math.floor(geometry.height))
  };
}

/**
 * @param {object} tab
 * @param {{ width: number, height: number }} geometry
 * @returns {{ top: number, left: number, gutterWidth: number, textWidth: number }}
 */
function computeViewport(tab, geometry) {
  const lineCount = Math.max(1, tab.lines.length);
  const gutterWidth = String(lineCount).length + 2;
  const textWidth = Math.max(0, geometry.width - gutterWidth);
  const maxTop = Math.max(0, tab.lines.length - geometry.height);
  let top = Math.min(Math.max(0, tab.scroll.top), maxTop);
  let left = Math.max(0, tab.scroll.left);

  if (tab.cursor.line < top) {
    top = tab.cursor.line;
  } else if (geometry.height > 0 && tab.cursor.line >= top + geometry.height) {
    top = tab.cursor.line - geometry.height + 1;
  }

  if (tab.cursor.col < left) {
    left = tab.cursor.col;
  } else if (textWidth > 0 && tab.cursor.col >= left + textWidth) {
    left = tab.cursor.col - textWidth + 1;
  }

  return { top, left, gutterWidth, textWidth };
}

/**
 * @param {{ screen: object, state: object, geometry: { left: number, top: number, width: number, height: number } }} options
 * @returns {{ element: object, render: () => void, setGeometry: (geometry: object) => void, destroy: () => void }}
 */
function createEditorView({ screen, state, geometry }) {
  let currentGeometry = normalizeGeometry(geometry);
  let cursorPosition = null;

  const element = blessed.box({
    parent: screen,
    left: currentGeometry.left,
    top: currentGeometry.top,
    width: currentGeometry.width,
    height: currentGeometry.height,
    tags: false,
    focusable: true,
    style: {
      fg: "white",
      bg: "black"
    }
  });

  element._updateCursor = function updateCursor() {
    if (state.focus !== "editor") {
      return;
    }

    if (!cursorPosition) {
      screen.program.hideCursor();
      return;
    }

    screen.program.cup(cursorPosition.top, cursorPosition.left);
    screen.program.showCursor();
  };

  function render() {
    const tab = getActiveTab(state);
    cursorPosition = null;

    if (!tab) {
      element.setContent(chalk.gray("Không có tệp đang mở"));
      if (state.focus === "editor" && screen.focused !== element) {
        element.focus();
      }
      return;
    }

    const viewport = computeViewport(tab, currentGeometry);
    const lastLine = Math.min(tab.lines.length, viewport.top + currentGeometry.height);
    const renderedLines = [];

    for (let lineIndex = viewport.top; lineIndex < lastLine; lineIndex += 1) {
      const lineNumber = String(lineIndex + 1).padStart(viewport.gutterWidth - 2, " ");
      const gutter = chalk.gray(`${lineNumber} │`);
      const text = tab.lines[lineIndex].slice(
        viewport.left,
        viewport.left + viewport.textWidth
      );
      renderedLines.push(gutter + text);
    }

    element.setContent(renderedLines.join("\n"));

    const cursorRow = tab.cursor.line - viewport.top;
    const cursorCol = tab.cursor.col - viewport.left;
    if (
      currentGeometry.height > 0 &&
      viewport.textWidth > 0 &&
      cursorRow >= 0 &&
      cursorRow < currentGeometry.height &&
      cursorCol >= 0 &&
      cursorCol < viewport.textWidth
    ) {
      cursorPosition = {
        top: currentGeometry.top + cursorRow,
        left: currentGeometry.left + viewport.gutterWidth + cursorCol
      };
    }

    if (state.focus === "editor" && screen.focused !== element) {
      element.focus();
    }
  }

  function setGeometry(nextGeometry) {
    currentGeometry = normalizeGeometry(nextGeometry);
    element.left = currentGeometry.left;
    element.top = currentGeometry.top;
    element.width = currentGeometry.width;
    element.height = currentGeometry.height;
  }

  function destroy() {
    if (screen.focused === element) {
      screen.program.hideCursor();
    }
    element.destroy();
  }

  return {
    element,
    render,
    setGeometry,
    destroy
  };
}

module.exports = {
  createEditorView
};
