"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const stream = require("stream");
const blessed = require("blessed");

/**
 * Creates a headless blessed screen for testing UI widgets without a real TTY.
 * 
 * @param {object} [options]
 * @param {number} [options.columns=120]
 * @param {number} [options.rows=40]
 * @returns {object} The created blessed screen
 */
function createHeadlessScreen(options = {}) {
  const columns = options.columns || 120;
  const rows = options.rows || 40;

  // Fake input stream
  const input = new stream.Readable({
    read() {}
  });
  input.isTTY = true;
  input.setRawMode = () => {};

  // Fake output stream
  // MUST call callback exactly once to avoid ERR_MULTIPLE_CALLBACK from blessed.
  const output = new stream.Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  });
  
  // MUST have isTTY = true and integer columns/rows for blessed layout to work
  output.isTTY = true;
  output.columns = columns;
  output.rows = rows;

  const screen = blessed.screen({
    smartCSR: true,
    input,
    output,
    terminal: "xterm-256color",
    fullUnicode: true
  });

  return screen;
}

test("createHeadlessScreen constructs successfully and allows screenshot", (t) => {
  const screen = createHeadlessScreen();
  assert.ok(screen, "Screen should be created");
  assert.strictEqual(screen.width, 120, "Screen width should be 120");
  assert.strictEqual(screen.height, 40, "Screen height should be 40");
  
  // Test screenshot functionality
  const shot = screen.screenshot();
  assert.ok(shot !== undefined && shot !== null, "Screenshot should return a valid string/buffer");

  screen.destroy();
});

module.exports = {
  createHeadlessScreen
};
