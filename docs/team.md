# Project Sub‑Agent Team Overview

This document describes the **sub‑agents** (internal Claude agents) that implement the desktop MVP. The team follows the hierarchy and rules defined in `AGENTS.md`, `CLAUDE.md`, and the five normative documents (`PRODUCT_DIRECTION.md`, `DESKTOP_REQUIREMENTS.md`, `DESKTOP_ARCHITECTURE.md`, `DESKTOP_IMPLEMENTATION_PLAN.md`, `ROADMAP.md`).

## Roles & Ownership

| Role | Files owned | Primary responsibilities | Key phase(s) | Allowed tools |
|------|-------------|---------------------------|--------------|---------------|
| **frontend‑architect** | `desktop/src/**`, `desktop/index.html`, `desktop/package.json`, `desktop/vite.config.ts`, `desktop/tsconfig.json`, `desktop/src/styles/**` | Vue 3 + TypeScript UI, fixed CSS grid, xterm.js integration, dialogs, status UI. | 1‑7 | Read, Edit, Write, Glob, Grep, Bash (npm scripts) |
| **rust‑pty‑engineer** | `desktop/src‑tauri/**` (Rust source, Cargo.toml, tauri.conf.json, capabilities, build.rs) | Tauri command wrappers, `portable‑pty` lifecycle, launch‑profile detection, process‑tree cleanup, Windows‑specific command handling. | 1‑7 | Read, Edit, Write, Glob, Grep, Bash (cargo, rustc) |
| **cli‑baseline‑keeper** | `bin/**`, `src/**`, `test/**`, `tools/**`, top‑level `package.json`, `README.md` (CLI section) | Preserve the existing Node CLI/TUI, guarantee Phase 0 stability, keep test‑gate truthful. | 0 (Phase 0) | Read, Edit, Write, Glob, Grep, Bash (node, npm) |
| **launcher‑specialist** | `desktop/src‑tauri/src/launcher.rs`, `command_detection.rs`, launcher‑related tests & fixtures | Windows PATH/PATHEXT detection, profile resolution, safe `.cmd/.bat` launch, custom‑command handling. | 4 | Read, Edit, Write, Glob, Grep, Bash (cargo, pwsh, cmd) |
| **test‑gate‑engineer** | `test/**`, `tools/phase0‑check.js`, `tools/ui‑smoke.js`, `desktop/src/**/*.test.ts`, `desktop/src‑tauri/tests/**` | Write truthful, deterministic tests; enforce termination; verify real process cleanup; run phase‑specific regression suites. | All (focus per phase) | Read, Edit, Write, Glob, Grep, Bash (node, npm, cargo) |
| **docs‑and‑rules‑reviewer** | `docs/**`, `AGENTS.md`, `CLAUDE.md` (shared rule updates) | Keep documentation authoritative, resolve conflicts, ensure every change respects the document priority order, forbid accidental activation of non‑goals. | All | Read, Edit, Write, Glob, Grep, Bash (node, cargo) |

> **Conductor** – Claude (the main assistant) orchestrates these sub‑agents via the `Agent` tool. It never directly edits production files; it delegates to the appropriate role.

## Hand‑off & Collaboration Rules

1. **Ownership is exclusive** – only the owning role may edit its files. If another role needs a change, it must:
   * Open an issue (or comment) on the owning role’s task.
   * Receive explicit approval from the **conductor** before the owning role makes the edit.
2. **Phase exit gates** – a role may advance to the next phase only after the current phase’s gate (listed in `DESKTOP_IMPLEMENTATION_PLAN.md`) is satisfied and verified by **test‑gate‑engineer**.
3. **Documentation sync** – any rule change that touches multiple domains (e.g., adding a new launch profile) must be reflected in:
   * The owning role’s code file.
   * `docs/DESKTOP_ARCHITECTURE.md` (if ownership changes).
   * `docs/DESKTOP_REQUIREMENTS.md` (if a functional requirement changes).
   * `AGENTS.md` / `CLAUDE.md` (shared rule summary).
   The **docs‑and‑rules‑reviewer** ensures all three are updated atomically.
4. **Error handling** – all runtime errors are reported through typed events; no silent fallback. The **frontend‑architect** displays user‑friendly messages, the **rust‑pty‑engineer** provides error codes, and the **test‑gate‑engineer** adds a failing test if an unexpected path is taken.
5. **No non‑goals** – any request that would introduce Pinia, Nuxt, worktrees, agent orchestration, model APIs, MCP, plugins, dynamic layout trees, or persistence must be rejected outright. The **docs‑and‑rules‑reviewer** flags such attempts.

## Phase Alignment Matrix

| Phase | Targeted roles | Primary deliverable | Exit‑gate verification |
|------|----------------|--------------------|-----------------------|
| 0 – Stabilize repo | **cli‑baseline‑keeper**, **test‑gate‑engineer** | Truthful deterministic `npm test` suite, PTY cleanup, `tools/phase0‑check.js` green | All baseline tests pass, no orphan processes |
| 1 – Desktop skeleton | **frontend‑architect**, **rust‑pty‑engineer**, **test‑gate‑engineer** | Empty desktop window, workspace selection, no PTY | Workspace open flow passes UI + backend sanity check |
| 2 – Single terminal | **frontend‑architect**, **rust‑pty‑engineer**, **test‑gate‑engineer** | One pane with live shell, resize, Ctrl+C handling | Real‑PTY throughput, resize, exit test passes |
| 3 – Multi‑pane deck | **frontend‑architect**, **rust‑pty‑engineer**, **test‑gate‑engineer** | Fixed 1‑4 pane grid, focus, zoom, add/close/restart | Four‑pane isolation test, focus/zoom behavior test |
| 4 – Agent launcher | **launcher‑specialist**, **frontend‑architect**, **test‑gate‑engineer** | Launcher dialog, PATH/PATHEXT detection, `.cmd` launch, custom command | Detection + spawn parity test, missing‑command UI feedback |
| 5 – Lifecycle hardening | **rust‑pty‑engineer**, **test‑gate‑engineer**, **frontend‑architect** | Close‑all, app‑exit cleanup, bounded output, job‑object decision | Stress‑test of close‑all, repeated app exit with no orphan processes |
| 6 – Windows packaging | **rust‑pty‑engineer**, **frontend‑architect**, **docs‑and‑rules‑reviewer** | NSIS installer, signed/unsigned notes, WebView2 prerequisite doc | Clean‑machine install‑launch‑uninstall smoke passes |
| 7 – MVP polish | All roles (iteration) | Keyboard shortcuts, accessibility, performance tuning, final docs | Full acceptance checklist in `DESKTOP_REQUIREMENTS.md` passes |

## Communication Flow (high‑level)

```
Conductor
   ↕ (delegate)
Frontend‑Architect ↔ Rust‑PTy‑Engineer   (shared UI‑backend contract)
   ↕ (hand‑off)                     ↕ (hand‑off)
Launcher‑Specialist               Test‑Gate‑Engineer
   ↕ (report)                       ↕ (report)
Docs‑and‑Rules‑Reviewer ──────────► CLI‑Baseline‑Keeper
```

All hand‑offs are mediated by the **conductor** through the `Agent` tool. The conductor logs each request, the target role updates its task, and the conductor acknowledges completion.

## Updating the Team

If a new domain emerges (e.g., a future persistence feature) a **new role** must be created with its own `.claude/agents/*.md` file, added to the matrix, and approved by the conductor. Existing roles must never be repurposed to cover non‑goals.

---
*This overview is versioned via the normal commit workflow when the conductor creates a commit. It should be reviewed whenever a role’s file list changes.*
