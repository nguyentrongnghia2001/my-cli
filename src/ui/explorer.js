"use strict";

const path = require("path");
const blessed = require("blessed");
const { readDir } = require("../core/fs-tree");
const { setTreeCursor, setTreeNode } = require("../core/workspace-state");

function createExplorer({ screen, state, geometry, actions = {} }) {
  const element = blessed.box({
    parent: screen,
    left: geometry ? geometry.left : 0,
    top: geometry ? geometry.top : 0,
    width: geometry ? geometry.width : 0,
    height: geometry ? geometry.height : 0,
    style: {
      bg: "black",
      fg: "white",
      focus: {
        bg: "black",
        fg: "white"
      }
    },
    scrollable: true,
    alwaysScroll: true,
    tags: false,
    keys: false
  });

  let visibleNodes = [];

  // Nạp một cấp vào state. KHÔNG được gọi từ render(): mutate trong lúc render sẽ
  // phát change rồi kéo render lại thành vòng lặp (xem CONTRACTS.md).
  function loadDir(dirPath, expanded) {
    try {
      setTreeNode(state, dirPath, { expanded, loaded: true, children: readDir(dirPath) });
    } catch (error) {
      if (actions.notify) actions.notify(error.message);
      setTreeNode(state, dirPath, { expanded, loaded: true, children: [] });
    }
  }

  function ensureRootLoaded() {
    if (!state.root || state.tree[state.root]) return;
    loadDir(state.root, true);
  }

  function buildVisibleNodes() {
    const rootPath = state.root;
    if (!rootPath || !state.tree[rootPath]) return [];

    const result = [];

    function traverse(dirPath, depth) {
      const node = state.tree[dirPath];
      if (!node || !node.expanded || !node.loaded) return;

      for (const child of node.children) {
        result.push({
          path: child.path,
          name: child.name,
          isDirectory: child.isDirectory,
          depth: depth
        });

        if (child.isDirectory && state.tree[child.path] && state.tree[child.path].expanded) {
          traverse(child.path, depth + 1);
        }
      }
    }

    traverse(rootPath, 0);
    return result;
  }

  function render() {
    if (!geometry || geometry.width === 0 || geometry.height === 0 || !state.sidebarVisible) {
      element.hide();
      return;
    }
    element.show();

    visibleNodes = buildVisibleNodes();

    let content = "";
    const w = geometry.width;

    for (let i = 0; i < visibleNodes.length; i++) {
      const node = visibleNodes[i];
      const isSelected = state.treeCursor === node.path;
      
      const indent = "  ".repeat(node.depth);
      let marker = "  ";
      if (node.isDirectory) {
        const treeNode = state.tree[node.path];
        marker = (treeNode && treeNode.expanded) ? "▾ " : "▸ ";
      }

      let line = indent + marker + node.name;
      if (line.length > w) {
        line = line.substring(0, w - 1) + "…";
      } else {
        line = line.padEnd(w, " ");
      }

      if (isSelected) {
        // Highlight selected line
        line = "\x1b[7m" + line + "\x1b[27m"; // Invert colors
      }
      
      content += line + "\n";
    }

    element.setContent(content);

    // Scroll to cursor
    if (state.treeCursor) {
      const index = visibleNodes.findIndex(n => n.path === state.treeCursor);
      if (index !== -1) {
        const h = geometry.height;
        const currentTop = element.childBase || 0;
        if (index < currentTop) {
          element.scrollTo(index);
        } else if (index >= currentTop + h) {
          element.scrollTo(index - h + 1);
        }
      }
    }
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
    element.detach();
  }

  element.on("keypress", (ch, key) => {
    if (state.focus !== "explorer") return;
    
    if (!key) return;
    const keyName = key.full || key.name;

    visibleNodes = buildVisibleNodes();
    if (visibleNodes.length === 0) return;

    let currentIndex = visibleNodes.findIndex(n => n.path === state.treeCursor);
    if (currentIndex === -1) currentIndex = 0;

    if (keyName === "up") {
      if (currentIndex > 0) {
        setTreeCursor(state, visibleNodes[currentIndex - 1].path);
      }
    } else if (keyName === "down") {
      if (currentIndex < visibleNodes.length - 1) {
        setTreeCursor(state, visibleNodes[currentIndex + 1].path);
      }
    } else if (keyName === "right" || keyName === "enter") {
      const node = visibleNodes[currentIndex];
      if (node.isDirectory) {
        const treeNode = state.tree[node.path];
        if (!treeNode || !treeNode.expanded) {
          if (!treeNode || !treeNode.loaded) {
            loadDir(node.path, true);
          } else {
            setTreeNode(state, node.path, { ...treeNode, expanded: true });
          }
        }
        // Enter trên thư mục đã mở: giữ nguyên. SPEC §6 dành việc thu gọn cho phím ←.
      } else if (actions.openFile) {
        // Đọc file + policy (>2MB, binary) thuộc ui.js, không thuộc widget.
        actions.openFile(node.path);
      }
    } else if (keyName === "left") {
      const node = visibleNodes[currentIndex];
      if (node.isDirectory) {
        const treeNode = state.tree[node.path];
        if (treeNode && treeNode.expanded) {
          setTreeNode(state, node.path, { ...treeNode, expanded: false });
        } else if (node.depth > 0) {
          // Go to parent
          const parentDir = path.dirname(node.path);
          setTreeCursor(state, parentDir);
        }
      } else {
        const parentDir = path.dirname(node.path);
        setTreeCursor(state, parentDir);
      }
    } else if (keyName === "C-r") {
      // Reload current selected folder or parent
      const node = visibleNodes[currentIndex];
      let targetDir = node.path;
      if (!node.isDirectory) {
        targetDir = path.dirname(node.path);
      }
      loadDir(targetDir, true);
    }
  });

  ensureRootLoaded();
  render();

  return {
    element,
    render,
    setGeometry,
    destroy
  };
}

module.exports = { createExplorer };
