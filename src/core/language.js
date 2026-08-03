"use strict";

const path = require("path");
const { supportsLanguage } = require("cli-highlight");

// Extension -> highlight.js language. Unlisted extensions fall back to asking
// cli-highlight whether the bare extension is itself a language name.
function guessLang(file) {
  const ext = path.extname(file).replace(".", "");
  const map = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    c: "c", h: "c", cpp: "cpp", cs: "csharp", php: "php",
    html: "html", css: "css", json: "json", md: "markdown",
    sh: "bash", yml: "yaml", yaml: "yaml", sql: "sql",
  };
  return map[ext] || (supportsLanguage(ext) ? ext : "plaintext");
}

module.exports = { guessLang };
