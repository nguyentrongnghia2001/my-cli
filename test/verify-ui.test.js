"use strict";

// T1.8: entrypoint `wsedit ui`. Không dựng được UI thật trong test (cần TTY),
// nên kiểm những gì kiểm được: module nạp sạch, lệnh có mặt, guard non-TTY
// chặn đúng thay vì crash, và 3 lệnh cũ không bị ảnh hưởng.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const BIN = path.join(__dirname, "..", "bin", "wsedit.js");

function runCli(args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", timeout: 20000 });
}

test("src/commands/ui.js nạp được và export runUi", () => {
  const { runUi } = require("../src/commands/ui");
  assert.strictEqual(typeof runUi, "function");
});

test("wsedit --help có liệt kê lệnh ui", () => {
  const out = execFileSync(process.execPath, [BIN, "--help"], { encoding: "utf8" });
  assert.match(out, /\bui \[dir\]/, "lenh ui phai xuat hien trong help");
});

test("wsedit ui khi không phải TTY thì báo lỗi rõ, không crash", () => {
  // spawnSync luôn cho stdout dạng pipe -> isTTY false, đúng kịch bản cần chặn.
  const result = runCli(["ui"]);
  assert.strictEqual(result.status, 1, "phai exit 1");
  assert.match(result.stderr, /terminal thật/, "phai bao bang tieng Viet, khong phai stack trace");
  assert.doesNotMatch(result.stderr, /at Object\.|TypeError|ReferenceError/, "khong duoc la crash");
});

test("wsedit ui với thư mục không tồn tại thì báo lỗi rõ", () => {
  const result = runCli(["ui", "thu-muc-khong-ton-tai-12345"]);
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Không tìm thấy thư mục/);
});

test("3 lệnh cũ không bị ảnh hưởng bởi T1.8", () => {
  assert.strictEqual(runCli(["--help"]).status, 0);
  assert.strictEqual(runCli(["ls"]).status, 0);
  assert.strictEqual(runCli(["view", "package.json"]).status, 0);
  assert.strictEqual(runCli(["view", "khong-ton-tai.txt"]).status, 1);
});
