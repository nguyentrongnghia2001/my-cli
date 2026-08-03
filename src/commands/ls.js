"use strict";

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// Kept local and recursive on purpose: `ls` wants the whole tree at once.
// The UI explorer must NOT reuse this — it reads one level at a time so it
// does not block on large repos (see docs/agents/CONTRACTS.md, fs-tree.js).
function walk(dir, base, out, ignore) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      walk(full, rel, out, ignore);
    } else {
      out.push(rel);
    }
  }
}

function listFiles(dir = ".") {
  const root = path.resolve(process.cwd(), dir);
  const ignore = new Set(["node_modules", ".git", "dist", "build"]);
  const files = [];
  walk(root, "", files, ignore);
  files.sort().forEach((f) => console.log(f));
  console.log(chalk.gray(`\n${files.length} file(s)`));
}

module.exports = { listFiles };
