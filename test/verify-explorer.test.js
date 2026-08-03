"use strict";

// Lead-owned regression test cho hai defect tìm thấy khi review batch 2 của agy:
//   1. render() gọi mutator -> emitChange -> kéo render lại -> vòng lặp.
//   2. mở file binary throw ngay trong keypress handler -> uncaughtException -> hỏng terminal.
const test = require("node:test");
const assert = require("node:assert");
const { Writable } = require("stream");
const blessed = require("blessed");

const { createState, onChange } = require("../src/core/workspace-state");
const { createExplorer } = require("../src/ui/explorer");

function headlessScreen(cols = 100, rows = 30) {
  class Sink extends Writable {
    _write(chunk, enc, cb) { cb(); }
  }
  const output = new Sink();
  output.isTTY = true;
  output.columns = cols;
  output.rows = rows;

  const input = new Writable();
  input.isTTY = true;
  input.setRawMode = () => {};
  input.resume = () => {};
  input.pause = () => {};

  return blessed.screen({ input, output, terminal: "xterm-256color", smartCSR: true });
}

const GEOMETRY = { left: 0, top: 0, width: 28, height: 20 };

test("explorer.render() không được mutate state (chống vòng lặp render)", () => {
  const screen = headlessScreen();
  try {
    const state = createState(process.cwd());
    const explorer = createExplorer({ screen, state, geometry: GEOMETRY, actions: {} });

    // Sau khi khởi tạo, cây gốc đã nạp xong. Từ đây render phải hoàn toàn read-only.
    let changes = 0;
    onChange(state, () => { changes++; });

    explorer.render();
    explorer.render();
    explorer.render();

    assert.strictEqual(changes, 0, "render() da phat emitChange -> se gay vong lap render");
    explorer.destroy();
  } finally {
    screen.destroy();
  }
});

test("explorer không tự đọc file — phải gọi actions.openFile", () => {
  const src = require("fs").readFileSync(require.resolve("../src/ui/explorer.js"), "utf8");
  assert.ok(!/readFileSync|statSync|openSync/.test(src), "widget khong duoc lam file IO (CONTRACTS)");
  assert.ok(src.includes("actions.openFile"), "phai uy quyen mo file cho ui.js qua actions.openFile");
});

test("explorer.setGeometry() không throw và vẫn read-only", () => {
  const screen = headlessScreen();
  try {
    const state = createState(process.cwd());
    const explorer = createExplorer({ screen, state, geometry: GEOMETRY, actions: {} });

    let changes = 0;
    onChange(state, () => { changes++; });

    explorer.setGeometry({ left: 0, top: 0, width: 40, height: 10 });
    assert.strictEqual(changes, 0, "setGeometry -> render cung khong duoc mutate");
    explorer.destroy();
  } finally {
    screen.destroy();
  }
});
