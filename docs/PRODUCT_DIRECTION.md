# Product Direction

Status: Approved direction for specification and planning. No desktop implementation exists yet.

This document is the highest product decision source for `wsedit`. When another
document conflicts with it, this document wins unless a later explicit user decision
supersedes it.

## Document authority

The normative desktop documents are, in order:

1. [`docs/PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md)
2. [`docs/DESKTOP_REQUIREMENTS.md`](DESKTOP_REQUIREMENTS.md)
3. [`docs/DESKTOP_ARCHITECTURE.md`](DESKTOP_ARCHITECTURE.md)
4. [`docs/DESKTOP_IMPLEMENTATION_PLAN.md`](DESKTOP_IMPLEMENTATION_PLAN.md)
5. [`docs/ROADMAP.md`](ROADMAP.md)

Current source and executable tests remain the truth for existing CLI/TUI behavior.
Historical specifications and plans are evidence only; they do not authorize desktop
features or an agent-platform refactor.

## Current state

`wsedit` is one CommonJS Node.js package. It exposes `view`, `ls`, `edit`, and
`ui` commands. The `ui` command combines a Blessed file explorer, multi-tab text
editor, quick-open overlay, and a `node-pty`/`blessed-xterm` terminal panel.

The terminal panel can host shells and external programs such as Codex CLI, Claude
Code, or Gemini CLI. Those programs are opaque terminal processes. The repository
does not implement model providers, structured agent streams, task planning, tool
calling, durable sessions, MCP, plugins, or agent orchestration.

The current verification baseline is not fully green:

- `npm test` is an npm-init placeholder and exits with an error;
- `node --test` has passing assertions but does not terminate because PTY resources
  remain alive in the lifecycle tests;
- the real-PTY smoke test currently fails terminal resize in one of fourteen checks;
- PTY behavior recorded in historical documents is environment-specific and must be
  re-verified before being used as a desktop acceptance claim.

## Product problem

Developers who use several local AI CLIs need to see and control multiple interactive
terminals in one lightweight workspace-oriented window. A normal terminal can do this
with tabs or manual splits, but it does not provide a small, purpose-built deck with a
fixed pane limit, consistent launch shortcuts, pane status, zoom, restart, and a
workspace lifecycle.

The previous repository direction attempted to grow the TUI into a general AI agent
platform. That scope included providers, tools, permissions, event storage, tasks,
schedulers, MCP, plugins, daemons, web, and VSCode clients. It is a different product,
has a much larger delivery and security surface, and delays the immediate terminal-deck
use case.

## New direction

Build a separate lightweight desktop application inside this repository. The desktop
application opens one local workspace and displays one to four interactive terminal
panes. Each pane runs an independent local shell or command through a Rust-owned PTY.

The intended stack is:

- Vue 3;
- TypeScript;
- Vite;
- Tauri 2;
- xterm.js;
- Rust `portable-pty`;
- plain CSS.

The existing CLI/TUI remains available during the initial desktop phases. The desktop
application is an additional product surface, not a rewrite of the Node CLI.

## Target user

The primary user is a developer on Windows who already uses local terminal tools such
as Codex CLI, Claude Code, Gemini CLI, PowerShell, or custom project commands. The user
is comfortable with terminals and remains responsible for assigning work and reviewing
file changes.

## Primary use cases

1. Open a local workspace directory.
2. Start a shell or an installed AI CLI in a terminal pane rooted at that workspace.
3. Add panes until at most four terminals are visible simultaneously.
4. Watch realtime ANSI output and provide interactive input to any pane.
5. Focus, zoom, resize, restart, or close a pane without affecting the others.
6. Close the application without leaving child processes behind.
7. Install and run the product as a Windows desktop application.

## Product differentiation

The product is deliberately narrower than an IDE, terminal multiplexer, or AI-agent
platform. Its value is a workspace-first desktop experience with a strict four-pane
limit, reliable interactive PTYs, one-click local CLI launch profiles, and explicit
pane lifecycle controls. It uses the AI CLIs users already trust instead of replacing
their model, authentication, permission, or tool systems.

## Product principles

- Keep the product a terminal deck, not an agent platform or IDE.
- Prefer a small explicit design over generic abstractions.
- Keep dependencies few and justified.
- Make every implementation phase runnable and verifiable.
- Preserve existing CLI behavior during the desktop migration.
- Treat the workspace as the initial working directory, not as a process sandbox.
- Keep PTY processes in the backend and rendering instances in the frontend.
- Keep terminal output out of Vue reactive state.
- Fail visibly when a command is missing or a process cannot be started.
- Bound process count, output flow, shutdown time, and resource ownership.

## MVP scope

The MVP includes:

- choosing or opening one workspace directory;
- one to four terminal panes;
- a fixed CSS Grid layout for each pane count;
- one independent PTY per pane;
- Shell, Codex CLI, Claude Code, Gemini CLI, and a basic custom command;
- realtime ANSI output and interactive input;
- terminal resize;
- focus, add, close, restart, and zoom pane actions;
- basic starting, running, exited, and error status;
- clear handling for commands that cannot be found or started;
- bounded cleanup of PTY processes and descendants where supported;
- a Windows executable and installer.

## Non-goals

The following are explicitly outside the MVP:

- Git worktree creation or isolation;
- task assignment or delegation between agents;
- automatic orchestration, merging, or conflict resolution;
- direct model APIs or an internal model runtime;
- MCP or a plugin system;
- code editor, file explorer, LSP, or debugger;
- multi-user collaboration, cloud sync, or a web dashboard;
- a database or full terminal-session restoration;
- application-specific authentication;
- auto updater;
- drag-and-drop pane layout or a dynamic split tree;
- claiming that output activity represents agent progress or completion.

Multiple CLI processes may write to the same workspace. The MVP does not isolate or
coordinate them. Documentation and UI copy must make that limitation clear.

## Success criteria

The MVP is successful when a user can install the Windows application, open a
workspace, run four independent interactive terminals, use supported launchers, resize
and manage panes, and exit repeatedly without orphaning tested process trees.

Success must be demonstrated by repeatable acceptance tests, including a high-output
stream test and real interactive launches of the supported CLIs on the reference
Windows environment. A visually complete UI without verified PTY lifecycle behavior
does not meet the MVP bar.

## Migration strategy

Use an additive migration:

1. Make existing repository claims and test gates truthful without refactoring the
   CLI architecture.
2. Add the desktop application as `desktop/` only when Phase 1 begins.
3. Implement one end-to-end terminal before introducing multi-pane state.
4. Add fixed multi-pane layouts and launch profiles after the single-terminal contract
   is proven.
5. Harden lifecycle and Windows packaging before polish.
6. Keep the Node CLI/TUI until a later explicit decision changes its support status.

No shared package is created initially. Shared code is introduced only after both the
CLI and desktop have a concrete, stable need for the same implementation. Documentation
and behavior parity alone are not sufficient reasons to create a package.

## Technology rationale

### Why Vue and Tauri

Vue 3 provides a small component and Composition API model suitable for four terminal
panes and a modest amount of UI state. TypeScript makes the Tauri command/event boundary
explicit. Vite is sufficient because the application has no server rendering, content
site, or complex routing requirement.

Tauri keeps native process ownership in Rust and uses the platform webview instead of
embedding a complete Node/Chromium runtime for the application. That matches the goal
of a lightweight desktop process and allows `portable-pty` to own PTYs without a Node
sidecar. Actual binary size, memory, and startup claims still require Phase 6 evidence.

### Why not Electron

Electron would allow more direct reuse of Node and `node-pty`, but it would also add a
bundled browser/Node runtime and keep desktop process management in the same ecosystem
as the lifecycle issues already present in the TUI. Reusing the current PTY adapter is
not valuable enough to outweigh the product's lightweight target and the cleaner Rust
ownership boundary.

### Why keep the existing CLI

The CLI already provides useful, tested behaviors and gives terminal users a compatible
fallback. Rewriting it does not help deliver the desktop terminal deck. Keeping it also
lets desktop lifecycle risk be measured independently from legacy TUI behavior.

### Why no Pinia, Nuxt, or UI framework

The MVP has one window, one workspace, at most four panes, and one small metadata state
domain. A singleton composable is easier to inspect than a store framework at this
size. Nuxt adds server-rendering, routing, and application conventions that this local
Vite application does not need. A UI framework adds dependencies and styling
constraints for a product whose core interface is a fixed grid, small toolbars, dialogs,
and xterm instances; plain CSS is sufficient.

### Why no agent orchestration

Orchestration would require task state, reliable agent protocols, permissions, writer
isolation, budgets, recovery, and merge/conflict behavior. External CLIs currently
provide only terminal streams to this application. Treating those streams as structured
agents would create unreliable state inference and expand the MVP into a different
product. The user remains the coordinator.

## Fixed decisions

- Repository structure uses `desktop/src/` and `desktop/src-tauri/`; the repository is
  not converted into a multi-package monorepo for the MVP.
- The existing Node CLI remains in place.
- Vue uses the Composition API and TypeScript.
- Desktop state starts with a singleton composable; Pinia is not used in the MVP.
- Nuxt and UI component frameworks are not used.
- Each pane owns exactly one xterm.js instance.
- Vue state contains pane metadata, not terminal output or scrollback.
- The Rust backend owns PTY processes and their lifecycle.
- The desktop backend uses `portable-pty`; the CLI continues using `node-pty`.
- The MVP has a fixed CSS Grid and a hard limit of four panes.
- There is no layout tree, Git worktree automation, or agent orchestration in the MVP.
- Shell/Codex/Claude/Gemini entries are launch profiles, not internal agent entities.
- Windows is the MVP packaging target.

## Deferred decisions

The following are deferred until their relevant implementation phase:

- final product name, bundle identifier, icon, and signing identity;
- exact minimum supported Windows build after the PTY/toolchain spike;
- installer format beyond the initial recommended NSIS target;
- exact event chunk encoding and batching thresholds after throughput measurement;
- whether Windows process-tree cleanup requires an additional job-object mechanism;
- session persistence, themes, advanced layouts, updater, and worktree isolation;
- the conditions for adding Pinia. Pinia becomes justified only if state spans multiple
  windows, independent feature domains, persistence, or sufficiently complex cross-view
  workflows that a singleton composable is no longer clear.

## Documentation migration

| Existing document | Problem | Action | New source of truth |
| --- | --- | --- | --- |
| `README.md` | Describes current CLI; Node support claim needs later correction | Keep as CLI guide and link this direction | This document for product direction |
| `AGENTS.md` | Authority order points at the former agent-platform plan | Rewrite authority section | The five documents listed above |
| `CLAUDE.md` | Required reading order follows the former plan | Rewrite authority summary | The five documents listed above |
| `SPEC.md` | Historical TUI v1 specification | Archive in place | Current source/tests for CLI behavior |
| `SPEC-multi-agent.md` | Worktree/multi-workspace proposal conflicts with the desktop MVP | Archive in place | This document and desktop requirements |
| `ARCHITECTURE_REVIEW.md` | Useful audit snapshot but its target architecture is superseded | Keep as historical snapshot | Desktop architecture |
| `MILESTONE.md` | Plans a headless AI agent runtime | Archive in place | Desktop implementation plan |
| `REFACTOR_PLAN.md` | Plans a large runtime refactor | Archive in place | Desktop implementation plan |
| `FOLDER_STRUCTURE.md` | Proposes a large monorepo | Archive in place | Desktop architecture |
| `TODO.md` | Agent-platform backlog is outside the current direction | Archive after carrying forward baseline items | Desktop implementation plan |
| Root `ROADMAP.md` | Former agent-platform roadmap | Replace with a redirect | `docs/ROADMAP.md` |
| `docs/agents/PHASE0.md` | Environment-specific TUI PTY evidence | Keep as historical evidence | Re-run desktop-specific spikes |
| `docs/agents/CONTRACTS.md` | Legacy TUI module contracts | Keep for CLI maintenance only | Desktop architecture for desktop contracts |
| `docs/agents/BOARD.md` | Historical work board | Archive in place | Desktop implementation plan |
| `docs/agents/CHANGELOG.md` | Historical implementation log with stale pass claims | Keep as history with a caveat | Current executable verification |

No historical document is deleted by this documentation reset.
