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
const ORPHAN_MARKER = "WSEDIT_ORPHAN_PROBE";

// Tiến trình chạy trong pane là cháu chắt của process này, không lấy pid trực
// tiếp được — nên nhận diện bằng dấu trong dòng lệnh.
function orphanAlive() {
  const { spawnSync } = require("child_process");
  if (process.platform !== "win32") {
    const ps = spawnSync("ps", ["-eo", "args"], { encoding: "utf8" });
    return (ps.stdout || "").includes(ORPHAN_MARKER);
  }
  const query = spawnSync("powershell.exe", [
    "-NoProfile", "-Command",
    `(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${ORPHAN_MARKER}*' } | Measure-Object).Count`,
  ], { encoding: "utf8" });
  return parseInt((query.stdout || "0").trim(), 10) > 0;
}

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
    // Tab bar từng thiếu parent VÀ gán hình học sai chỗ (element.left thay vì
    // element.position.left) nên không bao giờ hiện — khiến chính check dirty
    // ở trên luôn xanh một cách vô nghĩa. Nhận diện bằng nút đóng "×".
    check("tab bar được vẽ ra", /×/.test(afterOpen));

    // 3. Quick open
    out = "";
    term.write("\x10");
    at(600, () => term.write("pack"));

    at(1800, () => {
      const afterQuickOpen = plain();
      check("Ctrl+P lọc ra package.json", /package\.json/.test(afterQuickOpen));
      check("quick open không crash", !crashed(afterQuickOpen));
      // KHÔNG xoá `out` ở đây: blessed dùng smartCSR nên chỉ phát lại vùng có
      // thay đổi. Xoá buffer thì tab bar (không đổi) sẽ vắng mặt trong phần
      // còn lại và check bên dưới báo sai.
      term.write("\x1b");

      at(900, () => {
        const afterEscape = plain();
        // Overlay từng không đặt state.focus = "overlay", nên chữ gõ vào ô
        // quick open chảy tiếp xuống editor và sửa luôn file đang mở. Chuỗi
        // "pack" ở trên là phép thử: nếu rò thì file thành dirty.
        check("gõ trong quick open KHÔNG rò xuống editor", !/●/.test(afterEscape));
      });

      // 4. Terminal pane (T4.2). Dùng Ctrl+T (0x14) chứ không dùng Ctrl+` —
      //    chính Ctrl+` là thứ PHASE0 §8 chưa xác nhận là gửi được.
      at(1400, () => { out = ""; term.write("\x14"); });
      at(3900, () => {
        check("Ctrl+T mở được terminal pane, không crash", !crashed(plain()));
        out = "";
        term.write("echo WSEDIT_TERM_OK\r");
      });

      at(6700, () => {
        const shellOut = plain();
        check("gõ được vào pane và shell chạy lệnh", /WSEDIT_TERM_OK/.test(shellOut));

        // Tiêu chí Done Phase 4: thoát không được để sót tiến trình. Chạy một
        // tiến trình sống lâu có dấu nhận dạng để kiểm chính xác sau khi thoát.
        term.write(`node -e "setTimeout(()=>{},600000)" ${ORPHAN_MARKER}\r`);
      });

      at(7500, () => {
        // F6 để rời terminal; khi còn ở trong pane thì Ctrl+Q phải xuống pty
        // chứ không được thoát app.
        term.write("\x1b[17~");
      });

      // 5. Resize khi terminal đang mở
      at(7700, () => { out = ""; term.resize(70, 20); });
      at(9200, () => {
        check("resize khi terminal đang mở không vỡ", !crashed(plain()) && exitCode === null);

        // 6. Thoát sạch, không để lại tiến trình mồ côi
        term.write("\x11");
        at(2500, () => {
          check("Ctrl+Q thoát sạch (exit 0)", exitCode === 0);
          check("thoát không để sót tiến trình con", !orphanAlive());
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
