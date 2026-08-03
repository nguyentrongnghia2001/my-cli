#!/usr/bin/env node
"use strict";

// Chạy `wsedit ui` BÊN TRONG một pty thật rồi bấm phím vào nó.
// Test headless (`node --test`) không làm được việc này: nó chỉ chứng minh
// lệnh ui từ chối chạy khi thiếu TTY, không chứng minh nó chạy được khi có TTY.
//
//   node tools/ui-smoke.js
//
// Yêu cầu node-pty (optionalDependency). Thoát 0 nếu mọi mục PASS.

const path = require("path");

let pty;
try {
  pty = require("node-pty");
} catch (error) {
  console.error(`Cần node-pty để chạy smoke test: ${error.message}`);
  process.exit(1);
}

const REPO = path.join(__dirname, "..");
const results = [];

function check(name, ok) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

const term = pty.spawn(process.execPath, [path.join(REPO, "bin", "wsedit.js"), "ui"], {
  cols: 100,
  rows: 30,
  cwd: REPO,
});

let out = "";
let exitCode = null;
term.onData((data) => { out += data; });
term.onExit(({ exitCode: code }) => { exitCode = code; });

const plain = () => out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
const crashed = (text) => /Error|TypeError|ReferenceError|at Object\./.test(text);

function at(ms, fn) {
  setTimeout(fn, ms);
}

// 1. Khởi động
at(3500, () => {
  const screen = plain();
  check("dựng được màn hình, không crash", !crashed(screen));
  check("explorer vẽ ra tên file thật", /package\.json|SPEC\.md|AGENTS\.md/.test(screen));
  check("hint bar hiện ra", /Ctrl\+Q/.test(screen));

  // 2. Mở file. Thư mục xếp trước file nên phải đi qua chúng; Enter trên thư
  //    mục chỉ expand chứ không mở được gì.
  for (let i = 0; i < 5; i += 1) at(i * 150, () => term.write("\x1b[B"));
  at(900, () => { out = ""; term.write("\r"); });

  at(2400, () => {
    const afterOpen = plain();
    check("Enter trên file -> editor vẽ gutter số dòng", /1 │/.test(afterOpen));
    // Cùng một phím Enter từng bị xử lý 2 lần (explorer mở file, rồi handler
    // editor chèn thêm dòng trống) làm file vừa mở đã dirty. Chặn tái diễn.
    check("file vừa mở KHÔNG bị đánh dấu dirty", !/●/.test(afterOpen));

    // 3. Quick open
    out = "";
    term.write("\x10");
    at(600, () => term.write("pack"));

    at(1800, () => {
      const afterQuickOpen = plain();
      check("Ctrl+P lọc ra package.json", /package\.json/.test(afterQuickOpen));
      check("quick open không crash", !crashed(afterQuickOpen));
      term.write("\x1b");

      // 4. Resize
      at(600, () => { out = ""; term.resize(70, 20); });
      at(1800, () => {
        check("resize 100x30 -> 70x20 không vỡ", !crashed(plain()) && exitCode === null);

        // 5. Thoát sạch
        term.write("\x11");
        at(2000, () => {
          check("Ctrl+Q thoát sạch (exit 0)", exitCode === 0);
          if (results.some((ok) => !ok)) {
            console.log("\n--- màn hình (700 ký tự cuối) ---");
            console.log(JSON.stringify(plain().slice(-700)));
          }
          try { if (exitCode === null) term.kill(); } catch { /* NO-OP */ }
          const failed = results.filter((ok) => !ok).length;
          console.log(`\n${results.length - failed}/${results.length} pass`);
          process.exit(failed === 0 ? 0 : 1);
        });
      });
    });
  });
});
