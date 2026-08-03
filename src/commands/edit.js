"use strict";

const fs = require("fs");
const path = require("path");
const blessed = require("blessed");
const chalk = require("chalk");

function editFile(file) {
  const filePath = path.resolve(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  const content = exists ? fs.readFileSync(filePath, "utf8") : "";

  const screen = blessed.screen({
    smartCSR: true,
    title: `wsedit — ${path.basename(filePath)}`,
  });

  const header = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    content: ` wsedit  ${filePath}${exists ? "" : "  (file mới)"}`,
    style: { fg: "black", bg: "cyan" },
  });

  const footer = blessed.box({
    bottom: 0,
    left: 0,
    width: "100%",
    height: 1,
    content: " Ctrl+S: Lưu   Ctrl+Q: Thoát   Ctrl+F: Tìm ",
    style: { fg: "white", bg: "blue" },
  });

  const status = blessed.box({
    bottom: 1,
    left: 0,
    width: "100%",
    height: 1,
    content: "",
    style: { fg: "yellow" },
  });

  const textarea = blessed.textarea({
    top: 1,
    left: 0,
    width: "100%",
    height: "100%-3",
    inputOnFocus: true,
    keys: true,
    mouse: true,
    vi: false,
    scrollable: true,
    alwaysScroll: true,
    style: {
      fg: "white",
      bg: "black",
      focus: { bg: "black" },
    },
  });

  screen.append(header);
  screen.append(textarea);
  screen.append(status);
  screen.append(footer);

  textarea.setValue(content);
  textarea.focus();

  function setStatus(msg, ttlMs = 1500) {
    status.setContent(" " + msg);
    screen.render();
    if (ttlMs) {
      setTimeout(() => {
        status.setContent("");
        screen.render();
      }, ttlMs);
    }
  }

  function save() {
    const value = textarea.getValue();
    fs.writeFileSync(filePath, value, "utf8");
    setStatus(chalk.green("Đã lưu ✔"));
  }

  screen.key(["C-s"], save);
  screen.key(["C-q"], () => process.exit(0));
  screen.key(["escape"], () => process.exit(0));

  screen.render();
}

module.exports = { editFile };
