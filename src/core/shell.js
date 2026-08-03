"use strict";

const fs = require("fs");
const path = require("path");

// Tách khỏi src/ui/terminal-panel.js: theo CONTRACTS.md widget không được làm
// file IO, mà việc dò shell phải đọc đĩa. Đây cũng là logic thuần, test được
// mà không cần dựng blessed.

function executableExistsOnPath(command) {
  const pathValue = process.env.PATH || process.env.Path || "";
  const extensions = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  const commandExtension = path.extname(command);
  const candidates = commandExtension
    ? [command]
    : [command, ...extensions.map((ext) => command + ext)];

  return pathValue.split(path.delimiter).some((entry) => {
    const directory = entry.replace(/^"|"$/g, "");
    if (!directory) return false;
    return candidates.some((candidate) => fs.existsSync(path.join(directory, candidate)));
  });
}

// Windows: ưu tiên pwsh, lùi về powershell.exe. SPEC §12 câu 1 còn nhắc cmd.exe
// nhưng powershell.exe luôn có sẵn nên nhánh đó chưa cần tới.
function resolveShell() {
  if (process.platform === "win32") {
    return executableExistsOnPath("pwsh") ? "pwsh" : "powershell.exe";
  }
  return process.env.SHELL || "bash";
}

function createShellArgs(command) {
  if (!command) return [];
  if (process.platform === "win32") {
    return ["-NoLogo", "-NoProfile", "-Command", command];
  }
  return ["-lc", command];
}

function shellTitle(shell) {
  const title = path.basename(shell);
  return process.platform === "win32" ? title.replace(/\.exe$/i, "") : title;
}

module.exports = { executableExistsOnPath, resolveShell, createShellArgs, shellTitle };
