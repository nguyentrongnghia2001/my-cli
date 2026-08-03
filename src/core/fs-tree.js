"use strict";

const fs = require("fs");
const path = require("path");

const IGNORED = new Set(["node_modules", ".git", "dist", "build"]);

/**
 * Đọc ĐÚNG MỘT cấp. Không đệ quy.
 * @param {string} dirPath
 * @returns {Array<{ name: string, path: string, isDirectory: boolean }>}
 */
function readDir(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Không đọc được thư mục: ${dirPath}`);
  }

  const result = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) {
      continue;
    }
    result.push({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory()
    });
  }

  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

module.exports = {
  IGNORED,
  readDir
};
