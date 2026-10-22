import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Replicates getSessionStatus logic from WorkspaceView.vue
 */
function getSessionStatus(session) {
  const waitingApprovalCount = session.panes.filter(
    (p) => p.status === "running" && p.activity === "waiting_approval"
  ).length;
  const executingCount = session.panes.filter(
    (p) => p.status === "running" && p.activity === "executing"
  ).length;
  const runningCount = session.panes.filter(
    (p) => p.status === "running"
  ).length;
  const errorCount = session.panes.filter((p) => p.status === "error").length;
  const exitedCount = session.panes.filter((p) => p.status === "exited").length;

  return {
    hasWaitingApproval: waitingApprovalCount > 0,
    waitingApprovalCount,
    isExecuting: executingCount > 0,
    executingCount,
    isRunning: runningCount > 0,
    runningCount,
    hasError: errorCount > 0,
    errorCount,
    isAllExited: session.panes.length > 0 && exitedCount === session.panes.length,
    totalCount: session.panes.length,
  };
}

/**
 * Replicates isSessionActive / normalizePath logic from useWorkspace.ts
 */
function normalizePath(p) {
  return p
    .trim()
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function isSessionActive(sessionRoot, activeRoot) {
  if (!activeRoot) return false;
  return normalizePath(sessionRoot) === normalizePath(activeRoot);
}

/**
 * Replicates terminal output activity classification from usePaneTerminal.ts
 */
function stripAnsi(text) {
  return text
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\x1b\].*?(\x07|\x1b\\)/g, "")
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
}

function classifyTerminalOutput(rawOutput, submittedPrompt = false) {
  const clean = stripAnsi(rawOutput).trim();
  if (!clean) return "idle";
  const lower = clean.toLowerCase();

  // 1. Waiting for approval
  const hasApprovalQuestion =
    /\[(?:y\/n|y\/N|Y\/n)\]/i.test(clean) ||
    /\(y\)\s*es\s*\/\s*\(n\)\s*o/i.test(clean) ||
    lower.includes("allow this command") ||
    lower.includes("do you want to run") ||
    lower.includes("allow tool") ||
    lower.includes("grant permission");

  if (hasApprovalQuestion) {
    return "waiting_approval";
  }

  // 2. Active agent signals
  const hasActiveAgentSignal =
    lower.includes("loading") ||
    lower.includes("thinking") ||
    lower.includes("generating") ||
    lower.includes("searching") ||
    lower.includes("reading") ||
    lower.includes("analyzing") ||
    lower.includes("working") ||
    /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(rawOutput);

  if (hasActiveAgentSignal) {
    return "executing";
  }

  // 3. Prompt detection -> idle
  const isAtPrompt =
    clean.endsWith(">") ||
    clean.endsWith("$") ||
    clean.endsWith("%") ||
    clean.endsWith("#") ||
    clean.endsWith("❯") ||
    lower.endsWith("? for shortcuts") ||
    lower.endsWith("ai: out of credits");

  if (isAtPrompt) {
    return "idle";
  }

  // 4. Fallback when user submitted prompt
  if (submittedPrompt && clean.length > 5) {
    return "executing";
  }

  return "idle";
}

describe("Case 1: Multi-Workspace Process Isolation", () => {
  it("when Project 1 is executing an agent, Project 2 must remain idle", () => {
    const project1 = {
      name: "project-1",
      root: "C:\\projects\\project-1",
      panes: [
        {
          id: "pane_1",
          status: "running",
          activity: "executing",
          title: "Terminal 1",
        },
      ],
    };

    const project2 = {
      name: "project-2",
      root: "C:\\projects\\project-2",
      panes: [
        {
          id: "pane_2",
          status: "running",
          activity: "idle",
          title: "Terminal 1",
        },
      ],
    };

    const status1 = getSessionStatus(project1);
    const status2 = getSessionStatus(project2);

    assert.equal(status1.isExecuting, true, "Project 1 should be executing");
    assert.equal(status1.executingCount, 1);

    assert.equal(status2.isExecuting, false, "Project 2 MUST NOT be executing");
    assert.equal(status2.executingCount, 0);
    assert.equal(status2.isRunning, true, "Project 2 is running idle");
    assert.equal(status2.runningCount, 1);
  });

  it("newly opened workspace with starting pane must NOT falsely show executing", () => {
    const project2Starting = {
      name: "project-2",
      root: "C:\\projects\\project-2",
      panes: [
        {
          id: "pane_2",
          status: "starting",
          activity: undefined,
          title: "Terminal 1",
        },
      ],
    };

    const status = getSessionStatus(project2Starting);
    assert.equal(status.isExecuting, false, "Starting status must never trigger executing");
  });
});

describe("Case 2: Tab Status Priority Ladder", () => {
  it("waiting_approval takes precedence over executing and error", () => {
    const session = {
      name: "mixed",
      root: "C:\\mixed",
      panes: [
        { id: "p1", status: "running", activity: "waiting_approval" },
        { id: "p2", status: "running", activity: "executing" },
        { id: "p3", status: "error" },
      ],
    };

    const status = getSessionStatus(session);
    assert.equal(status.hasWaitingApproval, true);
    assert.equal(status.isExecuting, true);
    assert.equal(status.hasError, true);
  });

  it("error is reported accurately when executing is false", () => {
    const session = {
      name: "error-session",
      root: "C:\\error-session",
      panes: [
        { id: "p1", status: "running", activity: "idle" },
        { id: "p2", status: "error" },
      ],
    };

    const status = getSessionStatus(session);
    assert.equal(status.isExecuting, false);
    assert.equal(status.hasError, true);
    assert.equal(status.errorCount, 1);
  });
});

describe("Case 3: Windows Path Format Normalization", () => {
  it("matches paths regardless of backslashes, forward slashes, UNC prefix, or casing", () => {
    const root1 = "C:\\DTSMART\\my-cli";
    const active1 = "c:/dtsmart/my-cli";
    const unc = "\\\\?\\C:\\DTSMART\\my-cli\\";

    assert.equal(isSessionActive(root1, active1), true);
    assert.equal(isSessionActive(unc, active1), true);
    assert.equal(isSessionActive(root1, unc), true);
  });

  it("distinguishes different workspaces correctly", () => {
    const proj1 = "C:\\projects\\app-1";
    const proj2 = "C:\\projects\\app-2";

    assert.equal(isSessionActive(proj1, proj2), false);
  });
});

describe("Case 4: Terminal Activity & Keystroke Classification", () => {
  it("keeps activity idle when user is typing on cmdline with ANSI colors", () => {
    // PSReadLine ANSI colored text: "npm run dev"
    const psReadLineData = "\x1b[93mnpm\x1b[0m \x1b[92mrun\x1b[0m \x1b[96mdev\x1b[0m";
    assert.equal(classifyTerminalOutput(psReadLineData, false), "idle");
  });

  it("keeps activity idle when shell prompt returns", () => {
    const powershellPrompt = "PS C:\\projects\\app-1> ";
    assert.equal(classifyTerminalOutput(powershellPrompt, false), "idle");
  });

  it("detects agent execution signals (spinners, thinking, generating)", () => {
    const agentThinking = "⠋ Thinking about your request...";
    assert.equal(classifyTerminalOutput(agentThinking, false), "executing");

    const agentGenerating = "Generating response: Creating component...";
    assert.equal(classifyTerminalOutput(agentGenerating, false), "executing");
  });

  it("detects agent approval prompt [y/N]", () => {
    const approvalPrompt = "Allow this command? [y/N]: ";
    assert.equal(classifyTerminalOutput(approvalPrompt, false), "waiting_approval");
  });
});
