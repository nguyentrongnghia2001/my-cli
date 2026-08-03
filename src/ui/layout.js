"use strict";

/**
 * Trả về hình học SỐ NGUYÊN cho mọi vùng.
 * @param {{ screenWidth: number, screenHeight: number, sidebarVisible: boolean, terminalVisible: boolean }} input
 * @returns {object}
 */
function computeLayout(input) {
  const width = Math.max(0, Math.floor(input.screenWidth));
  const height = Math.max(0, Math.floor(input.screenHeight));
  let sidebarVisible = input.sidebarVisible;
  let terminalVisible = input.terminalVisible;

  if (width < 60) {
    sidebarVisible = false;
  }
  if (height < 16) {
    terminalVisible = false;
  }

  let sidebarWidth = 0;
  if (sidebarVisible) {
    sidebarWidth = 28;
    const maxSidebarWidth = Math.floor(width / 2);
    if (sidebarWidth > maxSidebarWidth) {
      sidebarWidth = maxSidebarWidth;
    }
    if (sidebarWidth < 18) {
      sidebarWidth = Math.min(18, maxSidebarWidth);
    }
  }

  const mainWidth = width - sidebarWidth;
  const mainLeft = sidebarWidth;

  const statusBarHeight = 1;
  const hintBarHeight = 1;
  const bottomBarHeight = statusBarHeight + hintBarHeight;

  let terminalHeight = 0;
  if (terminalVisible) {
    terminalHeight = Math.floor(height * 0.35);
    if (terminalHeight < 6) {
      terminalHeight = 6;
    }
    const maxTerminalHeight = height - bottomBarHeight - 1; // 1 for tab bar
    if (terminalHeight > maxTerminalHeight) {
      terminalHeight = Math.max(0, maxTerminalHeight);
    }
  }

  const terminalTabBarHeight = terminalVisible && terminalHeight > 0 ? 1 : 0;
  const totalTerminalAreaHeight = terminalHeight + terminalTabBarHeight;

  const editorTop = 1; // 1 for tab bar
  const editorHeight = height - editorTop - totalTerminalAreaHeight - bottomBarHeight;

  const layout = {
    sidebar: sidebarVisible ? {
      left: 0,
      top: 0,
      width: sidebarWidth,
      height: Math.max(0, height - bottomBarHeight)
    } : null,
    tabBar: {
      left: mainLeft,
      top: 0,
      width: mainWidth,
      height: 1
    },
    editor: {
      left: mainLeft,
      top: 1,
      width: mainWidth,
      height: Math.max(0, editorHeight)
    },
    terminalTabBar: terminalVisible && terminalHeight > 0 ? {
      left: mainLeft,
      top: 1 + Math.max(0, editorHeight),
      width: mainWidth,
      height: 1
    } : null,
    terminal: terminalVisible && terminalHeight > 0 ? {
      left: mainLeft,
      top: 1 + Math.max(0, editorHeight) + 1,
      width: mainWidth,
      height: Math.max(0, terminalHeight)
    } : null,
    // Clamp: ở màn hình cực thấp (height <= 1) phép trừ cho ra top âm, mà
    // CONTRACTS yêu cầu mọi giá trị >= 0. Các vùng sẽ chồng nhau ở kích thước
    // suy biến này — chấp nhận được, miễn không âm và không crash.
    statusBar: {
      left: 0,
      top: Math.max(0, height - 2),
      width: width,
      height: 1
    },
    hintBar: {
      left: 0,
      top: Math.max(0, height - 1),
      width: width,
      height: 1
    }
  };

  return layout;
}

module.exports = {
  computeLayout
};
