#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { Command } = require("commander");
const blessed = require("blessed");
const { highlight, supportsLanguage } = require("cli-highlight");
const chalk = require("chalk");

const program = new Command();
program
  .name("wsedit")
  .description("CLI nhẹ để xem & sửa file ngay trong workspace")
  .version("1.0.0");

// ---------- helper ----------
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

// ---------- view ----------
program
  .command("view <file>")
  .description("In nội dung file ra terminal, có tô màu cú pháp")
  .action((file) => {
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
  });

// ---------- ls ----------
program
  .command("ls [dir]")
  .description("Liệt kê file trong workspace (bỏ qua node_modules, .git)")
  .action((dir = ".") => {
    const root = path.resolve(process.cwd(), dir);
    const ignore = new Set(["node_modules", ".git", "dist", "build"]);
    const files = [];
    walk(root, "", files, ignore);
    files.sort().forEach((f) => console.log(f));
    console.log(chalk.gray(`\n${files.length} file(s)`));
  });

// ---------- edit ----------
program
  .command("edit <file>")
  .description("Mở editor mini trong terminal để sửa file (Ctrl+S lưu, Ctrl+Q thoát)")
  .action((file) => {
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
    screen.append(textarea);
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
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
