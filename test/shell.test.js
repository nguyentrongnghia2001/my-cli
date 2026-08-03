"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const {
  executableExistsOnPath,
  resolveShell,
  createShellArgs,
  shellTitle
} = require("../src/core/shell.js");

test("executableExistsOnPath", () => {
  // 1. Trả về false với tên lệnh chắc chắn không tồn tại
  const resultNotExists = executableExistsOnPath("non_existent_command_xyz_123456789");
  assert.strictEqual(resultNotExists, false);

  // 2. Trả về false khi PATH rỗng
  const originalPath = process.env.PATH;
  const originalPathLower = process.env.Path;
  const originalPathext = process.env.PATHEXT;

  try {
    delete process.env.PATH;
    delete process.env.Path;
    delete process.env.PATHEXT;

    const resultEmptyPath = executableExistsOnPath("node");
    assert.strictEqual(resultEmptyPath, false);
  } finally {
    if (originalPath !== undefined) process.env.PATH = originalPath;
    if (originalPathLower !== undefined) process.env.Path = originalPathLower;
    if (originalPathext !== undefined) process.env.PATHEXT = originalPathext;
  }
});

test("resolveShell", () => {
  if (process.platform === "win32") {
    const result = resolveShell();
    assert.ok(result === "pwsh" || result === "powershell.exe");
  } else {
    const originalShell = process.env.SHELL;
    try {
      process.env.SHELL = "/usr/bin/zsh";
      assert.strictEqual(resolveShell(), "/usr/bin/zsh");

      delete process.env.SHELL;
      assert.strictEqual(resolveShell(), "bash");
    } finally {
      if (originalShell !== undefined) {
        process.env.SHELL = originalShell;
      } else {
        delete process.env.SHELL;
      }
    }
  }
});

test("createShellArgs", () => {
  assert.deepStrictEqual(createShellArgs(""), []);
  assert.deepStrictEqual(createShellArgs(null), []);
  assert.deepStrictEqual(createShellArgs(undefined), []);

  if (process.platform === "win32") {
    assert.deepStrictEqual(createShellArgs("echo hi"), ["-NoLogo", "-NoProfile", "-Command", "echo hi"]);
  } else {
    assert.deepStrictEqual(createShellArgs("echo hi"), ["-lc", "echo hi"]);
  }
});

test("shellTitle", () => {
  const fullPath = path.join("usr", "bin", "bash");
  assert.strictEqual(shellTitle(fullPath), "bash");

  if (process.platform === "win32") {
    assert.strictEqual(shellTitle("powershell.exe"), "powershell");
    assert.strictEqual(shellTitle("C:\\Windows\\System32\\cmd.exe"), "cmd");
    assert.strictEqual(shellTitle("powershell.EXE"), "powershell");
  } else {
    assert.strictEqual(shellTitle("powershell.exe"), "powershell.exe");
  }
});
