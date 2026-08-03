"use strict";

const blessed = require("blessed");
const path = require("path");
const { guessLang } = require("../core/language");

/**
 * Creates the Status Bar UI widget.
 *
 * @param {object} options
 * @param {object} options.screen - Blessed screen object
 * @param {object} options.state - Workspace state object
 * @param {object} options.geometry - { left, top, width, height }
 * @returns {object} { element, render, setGeometry, destroy, setStatus }
 */
function createStatusBar({ screen, state, geometry, actions }) {
  let tempMessage = "";
  let tempTimer = null;

  const element = blessed.box({
    parent: screen,
    left: geometry ? geometry.left : 0,
    top: geometry ? geometry.top : 0,
    width: geometry ? geometry.width : 0,
    height: geometry ? geometry.height : 1,
    style: {
      bg: "blue",
      fg: "white"
    },
    tags: false
  });

  /**
   * Sets a temporary notification message in the status bar.
   *
   * @param {string} msg
   * @param {number} [ttlMs=2000]
   */
  function setStatus(msg, ttlMs = 2000) {
    tempMessage = msg || "";
    render();
    if (tempTimer) clearTimeout(tempTimer);
    if (ttlMs && tempMessage) {
      tempTimer = setTimeout(() => {
        tempMessage = "";
        tempTimer = null;
        render();
        // Hết TTL là sự kiện nằm ngoài vòng render của ui.js. render() chỉ
        // setContent, widget không được tự gọi screen.render() — nếu không xin
        // vẽ lại thì chữ đã xoá vẫn nằm nguyên trên màn hình.
        if (actions && actions.requestRender) actions.requestRender();
      }, ttlMs);
    }
  }

  function render() {
    if (!geometry || geometry.height === 0 || geometry.width === 0) {
      element.hide();
      return;
    }
    element.show();

    const activeId = state && state.editors && state.editors.activeId;
    const tabs = (state && state.editors && state.editors.tabs) || [];
    const activeTab = tabs.find(t => t.id === activeId) || null;

    let leftText = "";
    let rightText = "";

    if (activeTab) {
      let relPath = activeTab.filePath;
      if (state.root) {
        relPath = path.relative(state.root, activeTab.filePath);
      }
      relPath = relPath.replace(/\\/g, "/");

      leftText = " " + relPath;
      if (activeTab.dirty) leftText += " ●";
      if (activeTab.readOnly) leftText += " [read-only: file lớn]";

      const line = (activeTab.cursor ? activeTab.cursor.line : 0) + 1;
      const col = (activeTab.cursor ? activeTab.cursor.col : 0) + 1;
      const eol = activeTab.eol || "LF";
      const lang = guessLang(activeTab.filePath).toUpperCase();

      rightText = `Ln ${line}, Col ${col}  ${eol}  UTF-8  ${lang} `;
    } else {
      leftText = " (khung soạn thảo trống)";
    }

    const width = geometry.width;
    let content = "";

    if (tempMessage) {
      const centerText = `[ ${tempMessage} ]`;
      const available = width - leftText.length - rightText.length;
      if (available >= centerText.length) {
        const padLeft = Math.floor((available - centerText.length) / 2);
        const padRight = available - centerText.length - padLeft;
        content = leftText + " ".repeat(padLeft) + centerText + " ".repeat(padRight) + rightText;
      } else {
        content = (leftText + " " + centerText).slice(0, width);
      }
    } else {
      const spaceCount = width - leftText.length - rightText.length;
      if (spaceCount >= 0) {
        content = leftText + " ".repeat(spaceCount) + rightText;
      } else {
        content = (leftText + " " + rightText).slice(0, width);
      }
    }

    element.setContent(content);
  }

  function setGeometry(newGeometry) {
    geometry = newGeometry;
    element.position.left = geometry.left;
    element.position.top = geometry.top;
    element.position.width = geometry.width;
    element.position.height = geometry.height;
    render();
  }

  function destroy() {
    if (tempTimer) clearTimeout(tempTimer);
    element.detach();
  }

  render();

  return {
    element,
    render,
    setGeometry,
    destroy,
    setStatus
  };
}

module.exports = { createStatusBar };
