"use strict";

const blessed = require("blessed");
const chalk = require("chalk");
const { rank } = require("../core/fuzzy");

/**
 * @param {{ screen: object, state: object, geometry: object, actions: object, getCandidates: function }} options
 */
function createQuickOpen({ screen, state, geometry, actions, getCandidates }) {
  const element = blessed.box({
    // Bắt buộc gắn vào screen. Thiếu parent thì input.focus() sẽ chạy
    // _updateCursor rồi đọc toạ độ của parent null -> TypeError, sập cả app.
    parent: screen,
    left: 'center',
    top: 'center',
    width: 60,
    height: 15,
    border: 'line',
    style: {
      border: { fg: 'gray' },
      bg: '#1e1e1e',
      fg: '#cccccc'
    },
    hidden: true
  });

  const input = blessed.textbox({
    parent: element,
    left: 1,
    top: 0,
    width: '100%-4',
    height: 1,
    keys: true,
    inputOnFocus: true,
    style: {
      bg: '#1e1e1e',
      fg: '#ffffff'
    }
  });

  const separator = blessed.line({
    parent: element,
    left: 0,
    top: 1,
    width: '100%-2',
    orientation: 'horizontal',
    style: {
      fg: 'gray',
      bg: '#1e1e1e'
    }
  });

  const list = blessed.list({
    parent: element,
    left: 1,
    top: 2,
    width: '100%-4',
    height: 10,
    keys: false,
    interactive: false,
    style: {
      bg: '#1e1e1e',
      fg: '#cccccc',
      selected: {
        bg: '#333333',
        fg: '#ffffff',
        bold: true
      }
    }
  });

  let isOpen = false;
  let candidates = [];
  let currentResults = [];
  let query = "";

  function updateList() {
    if (!query) {
      currentResults = candidates.slice(0, 12).map(c => ({ value: c }));
    } else {
      currentResults = rank(query, candidates, 12);
    }

    const items = currentResults.map(r => {
      const path = r.value;
      const basename = path.split(/[/\\]/).pop();
      
      let relPath = path;
      if (state.root && path.startsWith(state.root)) {
        relPath = path.substring(state.root.length);
        if (relPath.startsWith('/') || relPath.startsWith('\\')) {
          relPath = relPath.substring(1);
        }
      }
      
      const prominent = chalk.bold(basename);
      const dimmed = chalk.gray(relPath);
      return `${prominent} ${dimmed}`;
    });

    list.setItems(items);
    if (items.length > 0) {
      list.select(0);
    }
    screen.render();
  }

  input.on('keypress', (ch, key) => {
    if (key.name === 'up') {
      list.up();
      screen.render();
      return false;
    }
    if (key.name === 'down') {
      list.down();
      screen.render();
      return false;
    }
    if (key.name === 'enter') {
      const selected = list.selected;
      if (selected >= 0 && selected < currentResults.length) {
        const absPath = currentResults[selected].value;
        close();
        try {
          actions.openFile(absPath);
        } catch (e) {
          if (actions.notify) actions.notify(e.message);
        }
      }
      return false;
    }
    if (key.name === 'escape') {
      close();
      return false;
    }

    setTimeout(() => {
      if (input.value !== query) {
        query = input.value;
        updateList();
      }
    }, 10);
  });

  function open() {
    if (isOpen) return;
    isOpen = true;
    query = "";
    input.clearValue();
    if (getCandidates) {
      candidates = getCandidates();
    }
    element.show();
    element.setFront();
    updateList();
    input.focus();
    screen.render();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    element.hide();
    input.clearValue();
    // Trả focus về đúng chỗ trước khi mở overlay. cycleFocus() trước đây đẩy
    // focus sang vùng kế tiếp chứ không phải vùng cũ.
    try {
      if (actions.closeOverlay) actions.closeOverlay();
      else if (actions.cycleFocus) actions.cycleFocus();
    } catch (e) {
      if (actions.notify) actions.notify(e.message);
    }
    screen.render();
  }

  function render() {
    // Only reads state, does not mutate. Nothing to periodically render.
  }

  function setGeometry(geo) {
    if (geo.width < 60) {
      element.width = geo.width;
    } else {
      element.width = 60;
    }
    if (geo.height < 15) {
      element.height = geo.height;
    } else {
      element.height = 15;
    }
    element.left = 'center';
    element.top = 'center';
  }

  function destroy() {
    element.destroy();
  }

  return { element, render, setGeometry, destroy, open, close };
}

module.exports = { createQuickOpen };
