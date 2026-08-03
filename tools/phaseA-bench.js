#!/usr/bin/env node
"use strict";

/**
 * Benchmark Phase A — SPEC-multi-agent.md §9 Phase A
 * Đo hiệu năng CPU, RAM, throughput và rendering latency khi chạy 1, 2, 3, 4 PTY pane song song.
 *
 * Cách chạy:
 *   node tools/phaseA-bench.js           -> chạy đo lần lượt 1..4 pane (mỗi mode 5s)
 *   node tools/phaseA-bench.js 4 10      -> đo riêng 4 pane trong 10 giây
 */

const path = require("path");
const { Writable } = require("stream");
const nodePty = require("node-pty");
const blessed = require("blessed");
const XTerm = require("blessed-xterm");

function resolveShell() {
  if (process.platform !== "win32") return process.env.SHELL || "bash";
  return "powershell.exe";
}

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

async function benchmarkPanes(numPanes, durationSeconds) {
  console.log(`\n=== BAT DAU BENCHMARK: ${numPanes} PANE (${durationSeconds}s) ===`);

  const cols = 120;
  const rows = 40;
  const { input, output } = fakeScreenStreams(cols, rows);

  const screen = blessed.screen({
    input,
    output,
    terminal: "xterm-256color",
    smartCSR: true
  });

  const paneWidth = Math.floor(cols / (numPanes > 2 ? 2 : numPanes));
  const paneHeight = numPanes > 2 ? Math.floor((rows - 2) / 2) : (rows - 2);

  const terms = [];
  const ptys = [];
  let totalDataEvents = 0;
  let totalDataBytes = 0;
  let renderCount = 0;

  // Track screen renders
  const origRender = screen.render.bind(screen);
  screen.render = function () {
    renderCount += 1;
    return origRender();
  };

  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();
  const startTime = Date.now();

  const shell = resolveShell();
  const fastOutputScript = "let i=0; setInterval(() => { console.log('BENCHMARK_PANE_LINE_' + (++i) + '_' + 'X'.repeat(40)); }, 5);";
  const shellArgs = process.platform === "win32"
    ? ["-NoLogo", "-NoProfile", "-Command", fastOutputScript]
    : ["-c", `node -e "${fastOutputScript}"`];

  for (let i = 0; i < numPanes; i++) {
    const colIdx = i % 2;
    const rowIdx = Math.floor(i / 2);
    const left = numPanes > 2 ? colIdx * paneWidth : i * paneWidth;
    const top = numPanes > 2 ? rowIdx * paneHeight : 0;

    const term = new XTerm({
      left,
      top,
      width: paneWidth,
      height: paneHeight,
      shell,
      args: shellArgs,
      cwd: process.cwd(),
      scrollback: 2000,
      ignoreKeys: ["C-`", "f6"]
    });

    if (term.pty) {
      term.pty.on("data", (chunk) => {
        totalDataEvents += 1;
        totalDataBytes += chunk.length;
      });
    }

    screen.append(term);
    terms.push(term);
  }

  screen.render();

  // Run benchmark interval
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  const elapsedTimeSec = (Date.now() - startTime) / 1000;
  const endCpu = process.cpuUsage(startCpu);
  const endMem = process.memoryUsage();

  const userCpuMs = endCpu.user / 1000;
  const sysCpuMs = endCpu.system / 1000;
  const totalCpuMs = userCpuMs + sysCpuMs;
  const cpuPercent = ((totalCpuMs / (elapsedTimeSec * 1000)) * 100).toFixed(1);
  const heapUsedMb = ((endMem.heapUsed - startMem.heapUsed) / (1024 * 1024)).toFixed(2);
  const rssMb = (endMem.rss / (1024 * 1024)).toFixed(2);

  console.log(`- Thoi gian chay: ${elapsedTimeSec.toFixed(2)}s`);
  console.log(`- CPU Host visualizer: ${cpuPercent}% (${totalCpuMs.toFixed(0)}ms total)`);
  console.log(`- RSS Memory: ${rssMb} MB (Heap delta: ${heapUsedMb} MB)`);
  console.log(`- Visual render cycles: ${renderCount} (${(renderCount / elapsedTimeSec).toFixed(1)} FPS)`);
  console.log(`- Data events from PTYs: ${totalDataEvents} (${(totalDataEvents / elapsedTimeSec).toFixed(0)} events/s)`);
  console.log(`- Data volume: ${(totalDataBytes / 1024).toFixed(1)} KB (${(totalDataBytes / (1024 * elapsedTimeSec)).toFixed(1)} KB/s)`);

  // Cleanup screen & PTYs
  try {
    screen.destroy();
  } catch (e) {
    /* NO-OP */
  }

  return {
    numPanes,
    cpuPercent: parseFloat(cpuPercent),
    rssMb: parseFloat(rssMb),
    fps: parseFloat((renderCount / elapsedTimeSec).toFixed(1)),
    eventsPerSec: parseFloat((totalDataEvents / elapsedTimeSec).toFixed(0)),
    kbPerSec: parseFloat((totalDataBytes / (1024 * elapsedTimeSec)).toFixed(1))
  };
}

async function main() {
  const targetPaneCount = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const duration = process.argv[3] ? parseInt(process.argv[3], 10) : 5;

  console.log("=== PHASE A BENCHMARK — DO GIOI HAN NUM PANE ===");
  console.log(`Node: ${process.version} | OS: ${process.platform} ${process.arch}`);

  const summary = [];

  if (targetPaneCount && targetPaneCount >= 1 && targetPaneCount <= 4) {
    const res = await benchmarkPanes(targetPaneCount, duration);
    summary.push(res);
  } else {
    for (let count = 1; count <= 4; count++) {
      const res = await benchmarkPanes(count, duration);
      summary.push(res);
      // nghi 1 sec giua cac dot bench
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("\n================ SUMMARY BENCHMARK ================");
  console.table(summary);
  console.log("===================================================\n");
  console.log("KLUAT PHASE A:");
  const pane4 = summary.find((s) => s.numPanes === 4);
  if (pane4) {
    if (pane4.cpuPercent < 80) {
      console.log("-> 4 pane hoat dong TOT. CPU & UI throughput dat yeu cau (<80% CPU).");
    } else {
      console.log("-> 4 pane co tai CPU cao. Can chu y debounce render hoac thu nho scrollback.");
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Benchmark fail:", err);
    process.exit(1);
  });
}
