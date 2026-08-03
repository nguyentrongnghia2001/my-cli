#!/usr/bin/env node
"use strict";

// Kiểm tra Phase 0. Ba chế độ:
//
//   node tools/phase0-check.js auto    -> tự động, không cần TTY. Kiểm lại các LUẬT CỨNG
//                                         trong docs/agents/PHASE0.md trên đúng version đang cài.
//   node tools/phase0-check.js keys    -> in ra tên phím mà blessed nhận được. Dùng để trả lời
//                                         PHASE0 §8: Ctrl+Shift+<key> có phân biệt được không.
//   node tools/phase0-check.js ui      -> mở pane terminal thật để gõ / chạy agent trong đó.
//
// Hai chế độ sau CẦN terminal thật (Windows Terminal), không chạy qua pipe được.

const path = require("path");
const { Writable } = require("stream");

const mode = process.argv[2] || "auto";

// ---------- tiện ích ----------

function loadOptional(name) {
  try {
    return require(name);
  } catch (error) {
    console.error(`Thiếu dependency "${name}": ${error.message}`);
    console.error("Chạy: npm install");
    process.exit(1);
  }
}

// Sink cho blessed khi chạy headless: callback phải được gọi ĐÚNG một lần,
// dùng PassThrough sẽ ném ERR_MULTIPLE_CALLBACK.
function fakeScreenStreams(cols, rows) {
  class Sink extends Writable {
    _write(chunk, enc, cb) { cb(); }
  }
  const output = new Sink();
  output.isTTY = true;
  output.columns = cols;
  output.rows = rows;

  const input = new Writable();
  input.isTTY = true;
  input.setRawMode = () => {};
  input.resume = () => {};
  input.pause = () => {};

  return { input, output };
}

function resolveShell() {
  if (process.platform !== "win32") return process.env.SHELL || "bash";
  return "powershell.exe";
}

// ---------- mode: auto ----------

const results = [];
function record(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

function checkCtrlC(pty) {
  return new Promise((resolve) => {
    const shell = resolveShell();
    const args = process.platform === "win32"
      ? ["-NoLogo", "-NoProfile", "-Command", "Start-Sleep -Seconds 60"]
      : ["-c", "sleep 60"];
    const p = pty.spawn(shell, args, { cols: 80, rows: 24, cwd: process.cwd() });
    p.onData(() => {});

    const started = Date.now();
    let settled = false;
    p.onExit(() => {
      if (settled) return;
      settled = true;
      const ms = Date.now() - started;
      record("Ctrl+C (0x03) kill được child", ms < 8000, `child thoát sau ${ms}ms`);
      resolve();
    });
    setTimeout(() => p.write("\x03"), 800);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      record("Ctrl+C (0x03) kill được child", false, "child còn sống sau 8s");
      resolve();
    }, 8000);
  });
}

function checkRenderInPane(pty) {
  const blessed = loadOptional("blessed");
  const XTerm = loadOptional("blessed-xterm");
  const { input, output } = fakeScreenStreams(100, 30);
  const screen = blessed.screen({ input, output, terminal: "xterm-256color", smartCSR: true });

  const marker = "PHASE0_RENDER_OK";
  const shell = resolveShell();
  const args = process.platform === "win32"
    ? ["-NoLogo", "-NoProfile", "-Command", `Write-Host '${marker}'`]
    : ["-c", `echo ${marker}`];

  // Không truyền parent (options bị deep-clone) và width/height phải là số nguyên.
  const term = new XTerm({
    left: 0, top: 0, width: screen.width, height: screen.height - 1,
    shell, args, cwd: process.cwd(), scrollback: 1000, ignoreKeys: ["C-`", "f6"],
  });
  screen.append(term);

  return new Promise((resolve) => {
    setTimeout(() => {
      screen.render();
      let plain = "";
      try {
        plain = (screen.screenshot() || "").replace(/\x1b\[[0-9;]*m/g, "");
      } catch (error) {
        plain = `SCREENSHOT_ERR ${error.message}`;
      }
      record("output pty được vẽ vào pane blessed", plain.includes(marker));
      record("pane nhận geometry số nguyên không throw", Number.isInteger(term.width));
      try { screen.destroy(); } catch { /* NO-OP */ }
      resolve();
    }, 3500);
  });
}

function checkExitPath() {
  // Chạy chính file này ở mode nội bộ _exitchild: nó spawn 1 pty rồi process.exit(0).
  // Sau đó kiểm pid của child xem ConPTY có tự dọn không (PHASE0 §7).
  const { execFileSync, spawnSync } = require("child_process");
  let out = "";
  const started = Date.now();
  try {
    out = execFileSync(process.execPath, [__filename, "_exitchild"], {
      encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    record("process.exit(0) thoát được ngay", false, `host không thoát: ${error.message}`);
    return;
  }
  const ms = Date.now() - started;
  record("process.exit(0) thoát được ngay (không treo)", ms < 15000, `${ms}ms`);

  const m = /CHILD_PID=(\d+)/.exec(out);
  if (!m) {
    record("không để lại tiến trình mồ côi", false, "không đọc được pid của child");
    return;
  }
  const childPid = m[1];
  const check = process.platform === "win32"
    ? spawnSync("tasklist", ["/FI", `PID eq ${childPid}`], { encoding: "utf8" })
    : spawnSync("ps", ["-p", childPid], { encoding: "utf8" });
  const alive = (check.stdout || "").includes(childPid);
  record("không để lại tiến trình mồ côi", !alive, `pid ${childPid} ${alive ? "VẪN SỐNG" : "đã chết"}`);
}

async function runAuto() {
  const pty = loadOptional("node-pty");
  console.log(`node ${process.version} · node-pty ${require("node-pty/package.json").version} · blessed-xterm ${require("blessed-xterm/package.json").version}`);
  console.log("Kiểm lại các luật cứng trong docs/agents/PHASE0.md:\n");

  await checkCtrlC(pty);
  await checkRenderInPane(pty);
  checkExitPath();

  const failed = results.filter((ok) => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} pass`);
  console.log("\nCÒN LẠI phải xác nhận bằng mắt trong terminal thật (PHASE0 §8):");
  console.log("  node tools/phase0-check.js keys   -> Ctrl+Shift+<key> có phân biệt được?");
  console.log("  node tools/phase0-check.js ui     -> gõ có nháy? màu đúng? agent chạy được?");
  process.exit(failed === 0 ? 0 : 1);
}

// mode nội bộ, không dành cho người dùng gọi trực tiếp
function runExitChild() {
  const pty = require("node-pty");
  const shell = resolveShell();
  const args = process.platform === "win32"
    ? ["-NoLogo", "-NoProfile", "-Command", "Start-Sleep -Seconds 120"]
    : ["-c", "sleep 120"];
  const p = pty.spawn(shell, args, { cols: 80, rows: 24, cwd: process.cwd() });
  p.onData(() => {});
  setTimeout(() => {
    process.stdout.write(`CHILD_PID=${p.pid}\n`);
    // PHASE0 §7: KHÔNG gọi p.kill() — chỉ exit.
    process.exit(0);
  }, 1500);
}

// ---------- mode: keys ----------

function runKeys() {
  const blessed = loadOptional("blessed");
  if (!process.stdout.isTTY) {
    console.error("Mode 'keys' cần terminal thật. Đừng chạy qua pipe.");
    process.exit(1);
  }
  const screen = blessed.screen({ smartCSR: true, title: "wsedit — key probe" });
  const log = blessed.log({
    parent: screen, top: 0, left: 0, width: "100%", height: "100%-2",
    scrollback: 500, tags: false,
  });
  blessed.box({
    parent: screen, bottom: 0, left: 0, width: "100%", height: 2,
    content: " Gõ thử: Ctrl+Shift+` · Ctrl+` · Ctrl+T · Ctrl+R · Ctrl+Shift+R · F6 · Alt+1\n Nhấn q để thoát",
    style: { fg: "black", bg: "cyan" },
  });

  log.log("Ghi lại phím blessed NHẬN ĐƯỢC. Nếu Ctrl+Shift+X hiện y như Ctrl+X thì terminal KHÔNG phân biệt được.");
  log.log("");

  screen.on("keypress", (ch, key) => {
    if (key && key.name === "q" && !key.ctrl && !key.meta && !key.shift) {
      screen.destroy();
      process.exit(0);
    }
    const seq = key && key.sequence ? JSON.stringify(key.sequence) : "?";
    log.log(
      `full=${String(key && key.full).padEnd(12)} name=${String(key && key.name).padEnd(10)} ` +
      `ctrl=${key && key.ctrl ? 1 : 0} meta=${key && key.meta ? 1 : 0} shift=${key && key.shift ? 1 : 0}  seq=${seq}`
    );
    screen.render();
  });

  screen.render();
}

// ---------- mode: ui ----------

function runUi() {
  const blessed = loadOptional("blessed");
  const XTerm = loadOptional("blessed-xterm");
  const { computeLayout } = require(path.join("..", "src", "ui", "layout.js"));

  if (!process.stdout.isTTY) {
    console.error("Mode 'ui' cần terminal thật. Đừng chạy qua pipe.");
    process.exit(1);
  }

  const screen = blessed.screen({ smartCSR: true, fullUnicode: true, title: "wsedit — phase0 ui" });

  // Dogfood layout.js thật thay vì tự tính, để lộ luôn lỗi hình học nếu có.
  const geo = computeLayout({
    screenWidth: screen.width,
    screenHeight: screen.height,
    sidebarVisible: true,
    terminalVisible: true,
  });

  const box = (g, label, bg) => blessed.box({
    parent: screen, left: g.left, top: g.top, width: g.width, height: g.height,
    content: ` ${label}`, style: { fg: "white", bg },
  });

  box(geo.sidebar, "EXPLORER (giả lập)", "black");
  box(geo.tabBar, "index.js ●   app.vue", "blue");
  box(geo.editor, "vùng editor (giả lập) — Phase 2 mới có thật", "black");
  box(geo.terminalTabBar, "TERMINAL  1: shell", "blue");

  const term = new XTerm({
    left: geo.terminal.left, top: geo.terminal.top,
    width: geo.terminal.width, height: geo.terminal.height,
    shell: resolveShell(),
    args: process.platform === "win32" ? ["-NoLogo"] : [],
    cwd: process.cwd(),
    scrollback: 5000,
    ignoreKeys: ["C-`", "f6"],
  });
  screen.append(term);

  const status = blessed.box({
    parent: screen, left: geo.statusBar.left, top: geo.statusBar.top,
    width: geo.statusBar.width, height: 1, style: { fg: "black", bg: "white" },
    content: ` ${screen.width}x${screen.height}  ·  terminal ${geo.terminal.width}x${geo.terminal.height}`,
  });

  blessed.box({
    parent: screen, left: geo.hintBar.left, top: geo.hintBar.top,
    width: geo.hintBar.width, height: 1, style: { fg: "white", bg: "blue" },
    content: " Ctrl+` hoặc F6: rời terminal   ·   sau đó Ctrl+Q: thoát   ·   Ctrl+C: kill tiến trình trong pane",
  });

  let inTerminal = true;
  const leaveTerminal = () => {
    inTerminal = false;
    status.setContent(" Đã rời terminal — giờ Ctrl+Q thoát được. Ctrl+` để vào lại.");
    screen.render();
  };
  const enterTerminal = () => {
    inTerminal = true;
    term.focus();
    status.setContent(" Đang trong terminal — mọi phím xuống pty, kể cả Ctrl+C. Ctrl+` để ra.");
    screen.render();
  };

  const quit = () => {
    // PHASE0 §7: destroy screen rồi exit ngay, KHÔNG kill pty.
    screen.destroy();
    process.exit(0);
  };

  screen.key(["C-`"], () => (inTerminal ? leaveTerminal() : enterTerminal()));
  screen.key(["f6"], () => (inTerminal ? leaveTerminal() : enterTerminal()));
  screen.key(["C-q"], () => { if (!inTerminal) quit(); });

  screen.on("resize", () => {
    const g = computeLayout({
      screenWidth: screen.width, screenHeight: screen.height,
      sidebarVisible: true, terminalVisible: true,
    });
    if (!g.terminal) return;
    term.left = g.terminal.left;
    term.top = g.terminal.top;
    term.width = g.terminal.width;
    term.height = g.terminal.height;
    status.setContent(` ${screen.width}x${screen.height}  ·  terminal ${g.terminal.width}x${g.terminal.height}`);
    screen.render();
  });

  term.on("exit", () => {
    status.setContent(" Tiến trình trong pane đã thoát. Ctrl+` rồi Ctrl+Q để ra.");
    screen.render();
  });

  enterTerminal();
  screen.render();
}

// ---------- dispatch ----------

if (mode === "auto") {
  runAuto();
} else if (mode === "_exitchild") {
  runExitChild();
} else if (mode === "keys") {
  runKeys();
} else if (mode === "ui") {
  runUi();
} else {
  console.error(`Mode không hợp lệ: ${mode}. Dùng: auto | keys | ui`);
  process.exit(1);
}
