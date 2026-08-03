"use strict";

// Lead-owned adversarial verification of the contracts in docs/agents/CONTRACTS.md.
// Deliberately independent of the agent-authored tests: it asserts the CONTRACT,
// not whatever the implementation happens to do.
const test = require("node:test");
const assert = require("node:assert");

const buf = require("../src/core/text-buffer");
const { createDispatcher } = require("../src/core/keymap");
const { computeLayout } = require("../src/ui/layout");

test("serialize() giữ nguyên EOL gốc — round-trip", () => {
  const cases = [
    "a\r\nb\r\n",       // CRLF, có newline cuối
    "a\r\nb",           // CRLF, không newline cuối
    "a\nb\n",           // LF, có newline cuối
    "a\nb",             // LF, không newline cuối
    "",                 // file rỗng
    "khong-newline",    // một dòng, không EOL
  ];
  for (const content of cases) {
    assert.strictEqual(
      buf.serialize(buf.createBuffer(content)),
      content,
      `round-trip that bai voi ${JSON.stringify(content)}`
    );
  }
});

test("detectEol() chọn theo số đông", () => {
  assert.strictEqual(buf.detectEol("a\r\nb\r\nc\nd"), "CRLF");
  assert.strictEqual(buf.detectEol("a\nb\nc\r\nd"), "LF");
  assert.strictEqual(buf.detectEol("khong co newline"), "LF");
  assert.strictEqual(buf.detectEol("\n"), "LF");
  assert.strictEqual(buf.detectEol("\r\n"), "CRLF");
});

test("moveCursor() giữ col mong muốn khi đi qua dòng ngắn", () => {
  // CONTRACTS.md: "up/down giữ col mong muốn khi đi qua dòng ngắn"
  const b = buf.createBuffer("0123456789ab\nxy\n0123456789ab");
  b.cursor.line = 0;
  b.cursor.col = 12;

  buf.moveCursor(b, "down");
  assert.strictEqual(b.cursor.line, 1);
  assert.strictEqual(b.cursor.col, 2, "phai clamp vao dong ngan");

  buf.moveCursor(b, "down");
  assert.strictEqual(b.cursor.line, 2);
  assert.strictEqual(b.cursor.col, 12, "phai TRO LAI col 12 tren dong dai");
});

test("moveCursor() reset col mong muốn sau khi di chuyển ngang", () => {
  const b = buf.createBuffer("0123456789ab\nxy\n0123456789ab");
  b.cursor.line = 0;
  b.cursor.col = 12;

  buf.moveCursor(b, "down");      // col -> 2 (clamp), desired van 12
  buf.moveCursor(b, "left");      // di chuyen ngang -> desired thanh 1
  buf.moveCursor(b, "down");
  assert.strictEqual(b.cursor.col, 1, "sau khi di ngang thi desired phai la col hien tai");
});

test("moveCursor() không làm dirty", () => {
  const b = buf.createBuffer("abc\ndef");
  for (const to of ["down", "up", "left", "right", "home", "end", "pageup", "pagedown"]) {
    buf.moveCursor(b, to);
  }
  assert.strictEqual(b.dirty, false);
});

test("keymap: focus=terminal chỉ giữ C-` và f6, mọi phím khác phải forward", () => {
  const called = [];
  const actions = {};
  for (const name of ["quit", "quickOpen", "save", "closeTab", "toggleSidebar", "toggleTerminal", "cycleFocus"]) {
    actions[name] = () => called.push(name);
  }
  const state = { focus: "terminal" };
  const dispatch = createDispatcher({ state, actions });

  // Phai forward (return false) — nguoc lai la agent trong pane khong dung duoc
  for (const full of ["C-c", "C-p", "C-s", "C-q", "C-w", "a", "escape", "up", "M-1"]) {
    assert.strictEqual(dispatch("", { full, name: full }), false, `${full} phai duoc forward xuong pty`);
  }
  assert.deepStrictEqual(called, [], "khong action nao duoc chay khi focus la terminal");

  assert.strictEqual(dispatch("", { full: "C-`", name: "`" }), true);
  assert.strictEqual(dispatch("", { full: "f6", name: "f6" }), true);
  assert.deepStrictEqual(called, ["toggleTerminal", "cycleFocus"]);
});

test("keymap: ngoài terminal thì global key chạy đúng action", () => {
  const called = [];
  const actions = { quickOpen: () => called.push("quickOpen"), save: () => called.push("save") };
  const dispatch = createDispatcher({ state: { focus: "editor" }, actions });

  assert.strictEqual(dispatch("", { full: "C-p", name: "p" }), true);
  assert.strictEqual(dispatch("", { full: "C-s", name: "s" }), true);
  assert.strictEqual(dispatch("", { full: "a", name: "a" }), false, "phim thuong phai xuong pane");
  assert.deepStrictEqual(called, ["quickOpen", "save"]);
});

test("computeLayout: mọi giá trị là số nguyên >= 0", () => {
  // Gồm cả màn hình RỘNG nhưng THẤP: sidebar vẫn hiện (width >= 60) trong khi
  // chiều cao nhỏ hơn 2 dòng bar, nên sidebar.height dễ bị âm.
  const sizes = [
    [100, 30], [80, 24], [60, 16], [59, 15], [40, 10], [20, 5], [10, 3], [5, 2], [3, 1], [1, 1], [0, 0],
    [100, 2], [100, 1], [100, 0], [80, 3],
  ];
  for (const [screenWidth, screenHeight] of sizes) {
    for (const sidebarVisible of [true, false]) {
      for (const terminalVisible of [true, false]) {
        const l = computeLayout({ screenWidth, screenHeight, sidebarVisible, terminalVisible });
        for (const [name, box] of Object.entries(l)) {
          if (box === null) continue;
          for (const k of ["left", "top", "width", "height"]) {
            assert.ok(Number.isInteger(box[k]), `${name}.${k} khong phai so nguyen o ${screenWidth}x${screenHeight}`);
            assert.ok(box[k] >= 0, `${name}.${k}=${box[k]} < 0 o ${screenWidth}x${screenHeight}`);
          }
        }
      }
    }
  }
});

test("computeLayout: các vùng lấp kín chiều cao, không chồng nhau", () => {
  for (const [screenWidth, screenHeight] of [[100, 30], [80, 24], [120, 40], [60, 16]]) {
    for (const terminalVisible of [true, false]) {
      const l = computeLayout({ screenWidth, screenHeight, sidebarVisible: true, terminalVisible });
      // Cột chính: tabBar -> editor -> [terminalTabBar -> terminal] -> statusBar -> hintBar
      const stack = [l.tabBar, l.editor, l.terminalTabBar, l.terminal, l.statusBar, l.hintBar].filter(Boolean);
      let expectedTop = 0;
      for (const box of stack) {
        if (box.height === 0) continue;
        assert.strictEqual(box.top, expectedTop, `co khe/chong o ${screenWidth}x${screenHeight} terminal=${terminalVisible}`);
        expectedTop = box.top + box.height;
      }
      assert.strictEqual(expectedTop, screenHeight, `tong chieu cao != ${screenHeight}`);
    }
  }
});

test("computeLayout: tự ẩn theo ngưỡng trong SPEC §4", () => {
  assert.strictEqual(computeLayout({ screenWidth: 59, screenHeight: 30, sidebarVisible: true, terminalVisible: false }).sidebar, null);
  assert.notStrictEqual(computeLayout({ screenWidth: 60, screenHeight: 30, sidebarVisible: true, terminalVisible: false }).sidebar, null);
  assert.strictEqual(computeLayout({ screenWidth: 100, screenHeight: 15, sidebarVisible: false, terminalVisible: true }).terminal, null);
  assert.notStrictEqual(computeLayout({ screenWidth: 100, screenHeight: 16, sidebarVisible: false, terminalVisible: true }).terminal, null);
});
