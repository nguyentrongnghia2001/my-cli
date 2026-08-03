"use strict";

const fs = require("fs");
const path = require("path");
const blessed = require("blessed");

const { computeLayout } = require("../ui/layout");
const { createDispatcher } = require("../core/keymap");
const { buildIndex } = require("../core/file-index");
const { createBuffer, serialize, insertText, insertNewline, deleteBackward, deleteForward, moveCursor } = require("../core/text-buffer");
const {
  createState, onChange, setFocus, toggleSidebar, toggleTerminal,
  openFile, closeTab, setActiveTab, activeTab,
} = require("../core/workspace-state");

const { createExplorer } = require("../ui/explorer");
const { createStatusBar } = require("../ui/status-bar");
const { createEditorView } = require("../ui/editor-view");
const { createPrompt } = require("../ui/prompt");

const MAX_EDITABLE_BYTES = 2 * 1024 * 1024;
const BINARY_SNIFF_BYTES = 8192;
const FOCUS_ORDER = ["explorer", "editor", "terminal"];
const EMPTY_GEOMETRY = { left: 0, top: 0, width: 0, height: 0 };

// Vài widget còn đang được làm ở task khác (T2.4 tab-bar, T3.3 quick-open).
// Nạp mềm để `wsedit ui` vẫn chạy được thay vì chết vì thiếu file.
function optional(modulePath, exportName) {
  try {
    return require(modulePath)[exportName] || null;
  } catch {
    return null;
  }
}

function isBinaryFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const chunk = Buffer.alloc(BINARY_SNIFF_BYTES);
    const read = fs.readSync(fd, chunk, 0, BINARY_SNIFF_BYTES, 0);
    return chunk.subarray(0, read).includes(0);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function runUi(dir = ".") {
  const root = path.resolve(process.cwd(), dir);

  if (!fs.existsSync(root)) {
    console.error(`Không tìm thấy thư mục: ${root}`);
    process.exit(1);
  }
  if (!process.stdout.isTTY) {
    console.error("Lệnh ui cần chạy trong terminal thật, không dùng qua pipe được.");
    process.exit(1);
  }

  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: `wsedit — ${path.basename(root)}`,
  });

  // Nếu có gì đó ném lỗi ngoài tầm kiểm soát, phải trả terminal về trạng thái
  // dùng được TRƯỚC khi in stack, nếu không shell của người dùng bị hỏng.
  const restoreThenRethrow = (error) => {
    try { screen.destroy(); } catch { /* NO-OP */ }
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  };
  process.on("uncaughtException", restoreThenRethrow);
  process.on("unhandledRejection", restoreThenRethrow);

  const state = createState(root);

  // ----- widget -----

  // Khai báo trước widget: các widget nhận tham chiếu này rồi đọc thuộc tính
  // lúc gọi, nên phần thân được gắn ở dưới.
  const actions = {};

  const statusBar = createStatusBar({ screen, state, geometry: EMPTY_GEOMETRY, actions });
  const prompt = createPrompt({ screen });

  const notify = (message) => statusBar.setStatus(message);

  const explorer = createExplorer({ screen, state, geometry: EMPTY_GEOMETRY, actions });
  const editorView = createEditorView({ screen, state, geometry: EMPTY_GEOMETRY, actions });

  const createTabBar = optional("../ui/tab-bar", "createTabBar");
  const tabBar = createTabBar ? createTabBar({ screen, state, geometry: EMPTY_GEOMETRY, actions }) : null;

  const hintBar = blessed.box({
    parent: screen,
    left: 0, top: 0, width: 0, height: 1,
    style: { fg: "white", bg: "blue" },
    content: " Ctrl+P tệp   Ctrl+` terminal   Ctrl+T tab mới   Ctrl+S lưu   F6 đổi vùng   Ctrl+Q thoát",
  });

  // Terminal tạo trễ: khởi tạo panel là spawn shell ngay, không nên làm khi
  // panel còn đang ẩn (SPEC §4: mặc định ẩn).
  let terminalPanel = null;
  let quickOpen = null;
  let fileIndex = { paths: [], truncated: false, ready: false };

  const widgets = () => [explorer, tabBar, editorView, terminalPanel, statusBar].filter(Boolean);

  // ----- render -----

  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    setImmediate(() => {
      renderScheduled = false;
      renderAll();
    });
  }

  // blessed chỉ gửi keypress tới element ĐANG focus. Widget nghe phím trên
  // element của nó, nên đổi state.focus thôi là chưa đủ — phải focus element
  // tương ứng, nếu không explorer sẽ không nhận được phím nào.
  function applyFocus() {
    const target =
      state.focus === "explorer" ? explorer.element :
      state.focus === "editor" ? editorView.element :
      null;

    if (state.focus === "terminal" && terminalPanel && terminalPanel.focusActive) {
      terminalPanel.focusActive();
      return;
    }
    if (target && screen.focused !== target && target.focus) target.focus();
  }

  // ----- overlay -----
  // Handler cấp screen bỏ qua phím khi state.focus === "overlay", nhưng trước
  // đây KHÔNG chỗ nào đặt giá trị đó. Hậu quả: gõ vào ô nhập của prompt hoặc
  // quick open thì phím chảy tiếp xuống editor và sửa luôn file đang mở —
  // cùng loại lỗi với vụ Enter bị xử lý hai lần ở T2.6.
  let focusBeforeOverlay = null;

  function enterOverlay() {
    if (state.focus !== "overlay") focusBeforeOverlay = state.focus;
    setFocus(state, "overlay");
  }

  function leaveOverlay() {
    if (state.focus !== "overlay") return;
    setFocus(state, focusBeforeOverlay || "editor");
    focusBeforeOverlay = null;
    scheduleRender();
  }

  // Overlay phải được gỡ dù promise reject, nếu không cả UI kẹt ở trạng thái
  // không nhận phím nào.
  function withOverlay(run) {
    enterOverlay();
    return run().then(
      (value) => { leaveOverlay(); return value; },
      (error) => { leaveOverlay(); throw error; }
    );
  }

  function renderAll() {
    applyFocus();
    for (const widget of widgets()) widget.render();
    // Widget không tự gọi screen.render(); gọi một lần ở đây để một thay đổi
    // chỉ vẽ lại màn hình đúng một lượt.
    screen.render();
  }

  function applyLayout() {
    const geo = computeLayout({
      screenWidth: screen.width,
      screenHeight: screen.height,
      sidebarVisible: state.sidebarVisible,
      terminalVisible: state.terminalVisible,
    });

    explorer.setGeometry(geo.sidebar || EMPTY_GEOMETRY);
    if (tabBar) tabBar.setGeometry(geo.tabBar);
    editorView.setGeometry(geo.editor);
    statusBar.setGeometry(geo.statusBar);

    hintBar.position.left = geo.hintBar.left;
    hintBar.position.top = geo.hintBar.top;
    hintBar.position.width = geo.hintBar.width;

    // Overlay tự canh giữa nhưng vẫn cần biết vùng khả dụng để không tràn.
    if (quickOpen) quickOpen.setGeometry(geo.editor);

    if (terminalPanel && geo.terminal && geo.terminalTabBar) {
      // Panel tự vẽ thanh tab của nó, nên đưa cả vùng gộp.
      terminalPanel.setGeometry({
        left: geo.terminalTabBar.left,
        top: geo.terminalTabBar.top,
        width: geo.terminalTabBar.width,
        height: geo.terminalTabBar.height + geo.terminal.height,
      });
    }
    // Dùng quyết định của layout, không dùng state thô: computeLayout tự tắt
    // terminal khi màn hình < 16 dòng và trả geo.terminal = null. Bám theo
    // state.terminalVisible thì panel vẫn hiện với hình học cũ.
    setTerminalVisible(Boolean(geo.terminal));
  }

  // Panel tạo trễ vì khởi tạo là spawn shell ngay.
  function ensureTerminalPanel() {
    if (terminalPanel) return true;
    const createTerminalPanel = optional("../ui/terminal-panel", "createTerminalPanel");
    if (!createTerminalPanel) {
      notify("Chưa có terminal panel (T4.1)");
      return false;
    }
    terminalPanel = createTerminalPanel({ screen, state, geometry: EMPTY_GEOMETRY, actions });
    return true;
  }

  function showTerminal() {
    if (!ensureTerminalPanel()) return false;
    if (!state.terminalVisible) toggleTerminal(state);
    applyLayout();
    setFocus(state, "terminal");
    if (terminalPanel.focusActive) terminalPanel.focusActive();
    return true;
  }

  function setTerminalVisible(visible) {
    if (!terminalPanel) return;
    for (const element of [].concat(terminalPanel.element)) {
      if (!element) continue;
      if (visible) element.show();
      else element.hide();
    }
  }

  // ----- actions -----

  Object.assign(actions, {
    notify,

    openFile(filePath) {
      try {
        const absolute = path.resolve(root, filePath);
        const stats = fs.statSync(absolute);
        const readOnly = stats.size > MAX_EDITABLE_BYTES;

        if (!readOnly && isBinaryFile(absolute)) {
          notify("Không mở được tệp nhị phân");
          return;
        }

        const content = fs.readFileSync(absolute, "utf8");
        const tabId = openFile(state, absolute, createBuffer(content));
        const tab = state.editors.tabs.find((item) => item.id === tabId);
        if (tab) tab.readOnly = readOnly;
        if (readOnly) notify("Tệp lớn hơn 2MB — mở ở chế độ chỉ đọc");

        // Hoãn sang tick sau: blessed đưa keypress cho element đang focus TRƯỚC
        // rồi mới tới handler cấp screen. Nếu đổi focus ngay tại đây thì chính
        // phím Enter vừa mở file sẽ bị handler editor xử lý tiếp và chèn thêm
        // một dòng trống vào file vừa mở.
        setImmediate(() => setFocus(state, "editor"));
      } catch (error) {
        notify(`Không đọc được tệp: ${error.message}`);
      }
    },

    save() {
      const tab = activeTab(state);
      if (!tab) return notify("Không có tệp nào đang mở");
      if (tab.readOnly) return notify("Tệp chỉ đọc, không lưu được");
      try {
        fs.writeFileSync(tab.filePath, serialize(tab), "utf8");
        tab.dirty = false;
        notify(`Đã lưu ${path.basename(tab.filePath)}`);
        scheduleRender();
      } catch (error) {
        notify(`Không lưu được: ${error.message}`);
      }
    },

    closeTab() {
      const tab = activeTab(state);
      if (!tab) return;
      if (!tab.dirty) return closeTab(state, tab.id);

      withOverlay(() => prompt.confirm(`${path.basename(tab.filePath)} chưa lưu. Đóng và bỏ thay đổi?`))
        .then((answer) => {
          if (answer === "yes") closeTab(state, tab.id);
          scheduleRender();
        })
        .catch((error) => notify(`Lỗi: ${error.message}`));
    },

    toggleSidebar() {
      toggleSidebar(state);
      applyLayout();
    },

    toggleTerminal() {
      if (!state.terminalVisible) return void showTerminal();

      toggleTerminal(state);
      applyLayout();
      if (state.focus === "terminal") setFocus(state, "editor");
    },

    newTerminalTab() {
      if (!showTerminal()) return;
      terminalPanel.newTab();
      scheduleRender();
    },

    runCommand() {
      withOverlay(() => prompt.ask("Chạy lệnh:"))
        .then((command) => {
          if (!command) return scheduleRender();
          if (!showTerminal()) return;
          terminalPanel.newTab({ command });
          scheduleRender();
        })
        .catch((error) => notify(`Không chạy được: ${error.message}`));
    },

    shiftTerminalTab(step) {
      if (!terminalPanel || !state.terminalVisible) return;
      const tabs = state.terminals.tabs;
      if (tabs.length < 2) return;
      const current = tabs.findIndex((tab) => tab.id === state.terminals.activeId);
      const next = tabs[(current + step + tabs.length) % tabs.length];
      if (next) terminalPanel.setActiveTab(next.id);
      scheduleRender();
    },

    cycleFocus() {
      const available = FOCUS_ORDER.filter((name) => name !== "terminal" || state.terminalVisible);
      const index = available.indexOf(state.focus);
      setFocus(state, available[(index + 1) % available.length]);
    },

    quickOpen() {
      const createQuickOpen = optional("../ui/quick-open", "createQuickOpen");
      if (!createQuickOpen) return notify("Chưa có quick open (T3.3)");
      if (!quickOpen) {
        quickOpen = createQuickOpen({
          screen, state, geometry: EMPTY_GEOMETRY, actions,
          getCandidates: () => fileIndex.paths,
        });
        applyLayout();
      }
      // Index chạy nền. Mở quick open sớm mà không báo gì thì danh sách rỗng
      // trông y như "không tìm thấy tệp nào".
      if (!fileIndex.ready) notify("Đang lập index tệp — kết quả có thể chưa đủ");
      else if (fileIndex.truncated) notify("Index bị cắt ở 20.000 tệp — có thể thiếu kết quả");
      enterOverlay();
      quickOpen.open();
    },

    // quick-open tự gọi khi nó đóng; không có promise để bọc như prompt.
    closeOverlay() {
      leaveOverlay();
    },

    // Cho widget xin vẽ lại khi nó thay đổi ngoài vòng render (ví dụ hết TTL
    // của thông báo). Widget vẫn không được tự gọi screen.render().
    requestRender() {
      scheduleRender();
    },

    quit() {
      const dirty = state.editors.tabs.filter((tab) => tab.dirty);
      if (dirty.length === 0) return shutdown();

      withOverlay(() => prompt.confirm(`Còn ${dirty.length} tệp chưa lưu. Thoát và bỏ thay đổi?`))
        .then((answer) => {
          if (answer === "yes") shutdown();
          else scheduleRender();
        })
        .catch(() => shutdown());
    },
  });

  for (let i = 1; i <= 9; i += 1) {
    actions[`focusTab${i}`] = () => {
      const tab = state.editors.tabs[i - 1];
      if (tab) setActiveTab(state, tab.id);
    };
  }

  function shutdown() {
    // PHASE0 §7: destroy screen rồi exit ngay. KHÔNG gọi pty.kill() — nó làm
    // treo đường thoát và đổ stack trace ra terminal. ConPTY tự dọn child.
    screen.destroy();
    process.exit(0);
  }

  // ----- phím -----

  const dispatch = createDispatcher({ state, actions });

  function handleEditorKey(ch, key) {
    const tab = activeTab(state);
    if (!tab) return false;

    const name = key && (key.full || key.name);
    const navigation = {
      left: "left", right: "right", up: "up", down: "down",
      home: "home", end: "end", pageup: "pageup", pagedown: "pagedown",
    };

    if (navigation[name]) {
      moveCursor(tab, navigation[name], Math.max(1, screen.height - 4));
      return true;
    }
    if (tab.readOnly) {
      if (ch || name) notify("Tệp chỉ đọc");
      return true;
    }
    if (name === "enter" || name === "return") return !!insertNewline(tab);
    if (name === "backspace") return !!deleteBackward(tab);
    if (name === "delete") return !!deleteForward(tab);
    if (name === "tab") return !!insertText(tab, "  ");
    if (ch && !key.ctrl && !key.meta && ch >= " ") return !!insertText(tab, ch);

    return false;
  }

  // SPEC §6 xếp các phím quản lý terminal vào nhóm "khi focus panel", nhưng luật
  // cứng chỉ cho đúng 2 phím không xuống pty — thêm phím dành riêng là cướp phím
  // của agent đang chạy trong pane. Nên chúng chỉ ăn khi focus KHÔNG ở terminal.
  // Dùng Ctrl+T/Ctrl+R thay cho Ctrl+Shift+… vì PHASE0 §8 chưa xác nhận terminal
  // có phân biệt được Ctrl+Shift+<key>.
  function handleTerminalKey(key) {
    const name = key && (key.full || key.name);

    if (name === "C-t") {
      actions.newTerminalTab();
      return true;
    }
    if (name === "M-left") {
      actions.shiftTerminalTab(-1);
      return true;
    }
    if (name === "M-right") {
      actions.shiftTerminalTab(1);
      return true;
    }
    // Ctrl+R đã thuộc về explorer (reload thư mục) theo SPEC §6. Chỉ nhận ở
    // editor, nếu không một phím sẽ chạy hai hành động.
    if (name === "C-r" && state.focus === "editor") {
      actions.runCommand();
      return true;
    }
    return false;
  }

  screen.on("keypress", (ch, key) => {
    if (state.focus === "overlay") return;
    if (dispatch(ch, key)) return scheduleRender();
    if (state.focus !== "terminal" && handleTerminalKey(key)) return scheduleRender();
    if (state.focus === "editor" && handleEditorKey(ch, key)) scheduleRender();
  });

  screen.on("resize", () => {
    applyLayout();
    scheduleRender();
  });

  onChange(state, scheduleRender);

  // ----- khởi động -----

  setFocus(state, "explorer");
  applyLayout();
  renderAll();

  // Index chạy nền, không chặn UI mở lên.
  buildIndex(root)
    .then((index) => {
      fileIndex = { ...index, ready: true };
      if (index.truncated) notify("Index bị cắt ở 20.000 tệp");
    })
    .catch((error) => notify(`Không lập được index: ${error.message}`));
}

module.exports = { runUi };
