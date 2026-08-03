"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { match, rank } = require("../src/core/fuzzy.js");

test("fuzzy match", () => {
  assert.deepStrictEqual(match("", "abc"), { score: 0, positions: [] });
  
  const m1 = match("abc", "a_b_c");
  assert.ok(m1);
  assert.deepStrictEqual(m1.positions, [0, 2, 4]);
  
  const m2 = match("abc", "abc");
  assert.ok(m2);
  assert.ok(m2.score > m1.score, "consecutive match should score higher");
  
  assert.strictEqual(match("xyz", "abc"), null);
});

test("fuzzy rank", () => {
  const results = rank("app", ["src/apple.js", "docs/app.md", "src/application/index.js"]);
  assert.strictEqual(results.length, 3);
  
  assert.ok(results[0].score >= results[1].score);
});
