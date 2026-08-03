"use strict";

const blessed = require("blessed");
const chalk = require("chalk");

/**
 * @param {{ screen: object, state: object, geometry: object, actions: object }} options
 */
function createTabBar({ screen, state, geometry, actions }) {
  const element = blessed.box({
    left: geometry.left,
    top: geometry.top,
    width: geometry.width,
    height: geometry.height,
    style: {
      bg: "#222222",
      fg: "#cccccc"
    }
  });

  let currentGeometry = { ...geometry };

  function render() {
    const tabs = state.editors?.tabs || [];
    const activeId = state.editors?.activeId;
    const width = currentGeometry.width;

    if (tabs.length === 0) {
      element.setContent("");
      return;
    }

    const tabItems = tabs.map((tab) => {
      const filename = tab.filePath.split(/[/\\]/).pop();
      const dirty = tab.dirty ? "\u25CF " : "";
      const close = "\u00D7";
      const plainText = ` ${filename} ${dirty}${close} `;
      
      let styledText;
      if (tab.id === activeId) {
        styledText = chalk.bgWhite.black(plainText);
      } else {
        styledText = chalk.bgGray.white(plainText);
      }
      
      return {
        id: tab.id,
        plainText,
        styledText,
        length: plainText.length
      };
    });

    let activeIndex = tabItems.findIndex(t => t.id === activeId);
    if (activeIndex === -1) activeIndex = 0;
    const activeTab = tabItems[activeIndex];

    let output = "";
    const totalLength = tabItems.reduce((sum, t) => sum + t.length, 0);

    if (totalLength <= width) {
      output = tabItems.map(t => t.styledText).join("");
    } else {
      if (activeTab.length > width) {
        const truncatedText = activeTab.plainText.substring(0, width - 1) + "\u2026";
        output = chalk.bgWhite.black(truncatedText);
      } else {
        let startIndex = activeIndex;
        let endIndex = activeIndex;
        let currentLength = activeTab.length;

        let expanded = true;
        while (expanded) {
          expanded = false;
          // Try expanding right
          if (endIndex + 1 < tabItems.length) {
            const rightTab = tabItems[endIndex + 1];
            const neededForRight = rightTab.length;
            const extraDots = (startIndex > 0 ? 1 : 0) + (endIndex + 1 < tabItems.length - 1 ? 1 : 0);
            if (currentLength + neededForRight + extraDots <= width) {
              endIndex++;
              currentLength += neededForRight;
              expanded = true;
            }
          }
          // Try expanding left
          if (startIndex - 1 >= 0) {
            const leftTab = tabItems[startIndex - 1];
            const neededForLeft = leftTab.length;
            const extraDots = (startIndex - 1 > 0 ? 1 : 0) + (endIndex < tabItems.length - 1 ? 1 : 0);
            if (currentLength + neededForLeft + extraDots <= width) {
              startIndex--;
              currentLength += neededForLeft;
              expanded = true;
            }
          }
        }

        const hasLeft = startIndex > 0;
        const hasRight = endIndex < tabItems.length - 1;
        
        const parts = [];
        if (hasLeft) parts.push(chalk.gray("\u2026"));
        for (let i = startIndex; i <= endIndex; i++) {
          parts.push(tabItems[i].styledText);
        }
        if (hasRight) parts.push(chalk.gray("\u2026"));
        
        output = parts.join("");
      }
    }

    element.setContent(output);
  }

  function setGeometry(geo) {
    currentGeometry = { ...geo };
    element.left = geo.left;
    element.top = geo.top;
    element.width = geo.width;
    element.height = geo.height;
  }

  function destroy() {
    element.destroy();
  }

  return { element, render, setGeometry, destroy };
}

module.exports = { createTabBar };
