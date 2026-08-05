# Desktop Roadmap

Status: Product milestones, not calendar commitments.

Product scope is defined in [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md). Detailed
sequencing and gates live in
[`DESKTOP_IMPLEMENTATION_PLAN.md`](DESKTOP_IMPLEMENTATION_PLAN.md).

## v0.1 — Desktop shell [Hoàn thành]

**Goal:** Establish a runnable Vue/Tauri application without changing the existing
CLI.

**Key features:** Open a local workspace, show the application shell and empty state,
validate the selected directory.

**Complete when:** A clean checkout launches the desktop development build, opens a
workspace, passes frontend/Rust checks, and preserves CLI behavior.

## v0.2 — Single interactive terminal [Hoàn thành]

**Goal:** Prove the complete xterm.js to Rust PTY path.

**Key features:** One shell pane, realtime ANSI output, interactive input, resize,
exit state, and bounded close.

**Complete when:** Repeated Windows integration tests verify interaction, throughput,
resize, and real process cleanup.

## v0.3 — Multi-pane terminal deck [Hoàn thành]

**Goal:** Deliver the central one-to-four pane experience.

**Key features:** Fixed CSS Grid layouts, independent PTYs, focus, add, close, restart,
zoom, and basic status.

**Complete when:** Four panes remain isolated under concurrent output and closing or
restarting one pane does not affect the others.

## v0.4 — Windows agent launcher [Hoàn thành]

**Goal:** Make common local AI CLIs easy and reliable to start.

**Key features:** Shell, Codex, Claude, Gemini, custom command, PATH/PATHEXT detection,
Windows `.cmd` handling, and clear missing-command errors.

**Complete when:** Supported installed CLIs launch interactively from a GUI-started
Windows build and unavailable commands fail without leaking resources.

## v0.5 — Reliability and lifecycle [Hoàn thành]

**Goal:** Harden long-running and failure behavior.

**Key features:** Race-safe generation handling, close-all, application-exit cleanup,
bounded output flow, lifecycle diagnostics, and process-tree verification.

**Complete when:** Stress tests terminate naturally and repeated app exits leave no
supported child or descendant processes.

## v0.6 — Windows MVP [Hoàn thành]

**Goal:** Produce an installable, usable Windows release candidate.

**Key features:** Release executable, NSIS installer, Start-menu launch, clean-machine
smoke tests, documented WebView2/signing requirements, and core UX polish.

**Complete when:** The packaged application passes install-to-uninstall acceptance and
the MVP Definition of Done.

## v1.0 — Stable desktop release [Kế hoạch tiếp theo]

**Goal:** Stabilize the approved desktop terminal-deck contract after MVP usage.

**Key features:** Resolved critical feedback, documented limits, repeatable release
process, stable pane lifecycle, and maintained CLI compatibility.

**Complete when:** Supported requirements and packaging gates pass consistently and no
critical lifecycle, security-boundary, or output-isolation defect remains.

## Future candidates

The following are ideas, not commitments:

- terminal/layout session persistence;
- custom themes;
- Git worktree isolation;
- advanced split layouts;
- auto updater;
- additional operating systems.

Agent orchestration, model APIs, MCP, plugins, editor/IDE features, collaboration,
cloud sync, and automatic merge/conflict resolution are not implied by this roadmap.
