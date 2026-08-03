"use strict";

const fs = require("fs").promises;
const path = require("path");
const { IGNORED } = require("./fs-tree");

/**
 * Builds a file index asynchronously.
 * 
 * @param {string} rootPath - The root directory to index
 * @param {object} [options]
 * @param {number} [options.limit=20000] - Maximum number of files to index
 * @returns {Promise<{ paths: string[], truncated: boolean }>}
 */
async function buildIndex(rootPath, options = {}) {
  const limit = options.limit || 20000;
  const paths = [];
  let truncated = false;

  async function walk(dir) {
    if (truncated) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      // Ignore directories we can't read
      return;
    }

    // Sort to be consistent, though not strictly required for index
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (truncated) break;
      if (IGNORED.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (paths.length >= limit) {
          truncated = true;
          break;
        }
        paths.push(fullPath);
      }
    }
  }

  await walk(rootPath);

  return {
    paths,
    truncated
  };
}

module.exports = {
  buildIndex
};
