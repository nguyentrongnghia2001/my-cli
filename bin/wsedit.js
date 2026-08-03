#!/usr/bin/env node
"use strict";

const { Command } = require("commander");

const { viewFile } = require("../src/commands/view");
const { listFiles } = require("../src/commands/ls");
const { editFile } = require("../src/commands/edit");
const { runUi } = require("../src/commands/ui");

const program = new Command();
program
  .name("wsedit")
  .description("CLI nhẹ để xem & sửa file ngay trong workspace")
  .version("1.0.0");

program
  .command("view <file>")
  .description("In nội dung file ra terminal, có tô màu cú pháp")
  .action(viewFile);

program
  .command("ls [dir]")
  .description("Liệt kê file trong workspace (bỏ qua node_modules, .git)")
  .action(listFiles);

program
  .command("edit <file>")
  .description("Mở editor mini trong terminal để sửa file (Ctrl+S lưu, Ctrl+Q thoát)")
  .action(editFile);

program
  .command("ui [dir]")
  .description("Mở workspace UI: cây thư mục + tab + editor + terminal")
  .action(runUi);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
