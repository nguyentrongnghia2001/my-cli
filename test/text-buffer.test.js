"use strict";

const test = require("node:test");
const assert = require("node:assert");
const {
  detectEol,
  createBuffer,
  serialize,
  insertText,
  insertNewline,
  deleteBackward,
  deleteForward,
  moveCursor
} = require("../src/core/text-buffer.js");

test("detectEol", () => {
  assert.strictEqual(detectEol("hello\nworld"), "LF");
  assert.strictEqual(detectEol("hello\r\nworld"), "CRLF");
  assert.strictEqual(detectEol("hello"), "LF");
});

test("createBuffer and serialize", () => {
  const buf1 = createBuffer("a\nb");
  assert.strictEqual(buf1.eol, "LF");
  assert.deepStrictEqual(buf1.lines, ["a", "b"]);
  assert.strictEqual(serialize(buf1), "a\nb");

  const buf2 = createBuffer("a\r\nb");
  assert.strictEqual(buf2.eol, "CRLF");
  assert.deepStrictEqual(buf2.lines, ["a", "b"]);
  assert.strictEqual(serialize(buf2), "a\r\nb");
  
  const buf3 = createBuffer("a\r\nb\nc\r\n");
  assert.strictEqual(buf3.eol, "CRLF");
  assert.strictEqual(serialize(buf3), "a\r\nb\r\nc\r\n");
  
  const buf4 = createBuffer("a");
  assert.strictEqual(buf4.eol, "LF");
  assert.deepStrictEqual(buf4.lines, ["a"]);
  assert.strictEqual(serialize(buf4), "a");
});

test("mutations", () => {
  const buf = createBuffer("hello\nworld");
  buf.cursor.line = 0;
  buf.cursor.col = 5;
  insertText(buf, "!");
  assert.strictEqual(buf.lines[0], "hello!");
  assert.strictEqual(buf.dirty, true);
  
  insertNewline(buf);
  assert.deepStrictEqual(buf.lines, ["hello!", "", "world"]);
  
  deleteBackward(buf);
  assert.deepStrictEqual(buf.lines, ["hello!", "world"]);
  
  buf.cursor.line = 0;
  buf.cursor.col = 6;
  deleteForward(buf);
  assert.deepStrictEqual(buf.lines, ["hello!world"]);
  
  moveCursor(buf, "left");
  assert.strictEqual(buf.cursor.col, 5);
});
