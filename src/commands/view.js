"use strict";

const fs = require("fs");
const path = require("path");
const { highlight } = require("cli-highlight");
const chalk = require("chalk");

const { guessLang } = require("../core/language");

function viewFile(file) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`Không tìm thấy file: ${filePath}`));
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lang = guessLang(filePath);
  let printed;
  try {
    printed = highlight(content, { language: lang, ignoreIllegals: true });
  } catch {
    printed = content;
  }

  const lines = printed.split("\n");
  const width = String(lines.length).length;
  lines.forEach((line, i) => {
    const num = chalk.gray(String(i + 1).padStart(width, " ") + " │ ");
    console.log(num + line);
  });
}

module.exports = { viewFile };
