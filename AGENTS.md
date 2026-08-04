# AGENTS.md — Project Development Rules

This file is the canonical repository instruction set for Codex, Claude Code,
subagents, and human contributors. Read it completely before changing the repository.

## Product direction

`wsedit` is a small Node.js CLI/TUI that remains supported while a separate lightweight
Windows desktop terminal deck is added incrementally.

The desktop MVP uses Vue 3, TypeScript, Vite, Tauri 2, xterm.js, Rust
`portable-pty`, and plain CSS. It opens one workspace and runs at most four independent
interactive terminal panes for a shell, Codex CLI, Claude Code, Gemini CLI, or a custom
command.

The desktop MVP is not an AI agent platform or IDE. Do not introduce model APIs, agent
orchestration, tasks, worktrees, MCP, plugins, databases, web dashboards, file explorers,
editors, LSP, dynamic layout trees, or session restoration unless a later explicit user
decision changes the product scope.

External AI CLIs are terminal processes. The application does not understand their
model output, tool calls, progress, or file changes.

## Source of truth

Use this priority order when documents disagree:

1. The current user request and explicit acceptance criteria.
2. `docs/PRODUCT_DIRECTION.md` for product scope and fixed decisions.
3. `docs/DESKTOP_REQUIREMENTS.md` for observable desktop requirements.
4. `docs/DESKTOP_ARCHITECTURE.md` for desktop ownership and contracts.
5. `docs/DESKTOP_IMPLEMENTATION_PLAN.md` for implementation order and exit gates.
6. `docs/ROADMAP.md` for release milestones.
7. Current source code and executable tests for existing CLI/TUI behavior.
8. `README.md` for current user-facing CLI instructions.
9. Documents marked historical or superseded only as implementation evidence.

`SPEC.md`, `SPEC-multi-agent.md`, `ARCHITECTURE_REVIEW.md`, `MILESTONE.md`,
`REFACTOR_PLAN.md`, `FOLDER_STRUCTURE.md`, `TODO.md`, and `docs/agents/**` are not
active product authorities. Do not implement their former AI-agent-platform or
multi-agent TUI roadmaps unless explicitly requested.

When evidence conflicts, investigate and document the conflict. Do not silently choose
the more convenient interpretation or convert a historical claim into a current fact.

## Working principles

- Understand the related implementation and tests before editing.
- Find and fix root causes instead of masking symptoms.
- Make the smallest complete change that advances the current phase.
- Preserve working behavior unless the task explicitly changes it.
- Prefer changing existing code over parallel replacements.
- Do not create placeholder modules or abstractions for hypothetical future needs.
- Keep commits independently testable and revertible when commits are requested.
- Do not mix unrelated cleanup into a feature or fix.
- Do not modify runtime source for documentation-only tasks.
- Do not claim a result that was not verified.

## Migration strategy

- Keep `view`, `ls`, `edit`, and `ui` usable during desktop development.
- Add the desktop application under `desktop/` only when Phase 1 begins.
- Do not convert the repository into `apps/`/`packages/` or create `packages/shared`
  without at least one approved concrete shared implementation use case.
- Do not convert the existing CommonJS CLI/TUI to TypeScript merely for consistency.
- Prove one interactive desktop terminal before adding multi-pane behavior.
- Complete each phase exit gate in `docs/DESKTOP_IMPLEMENTATION_PLAN.md` before
  dependent phases.
- Remove a legacy path only after an explicit deprecation decision and replacement
  evidence.

## Desktop architectural boundaries

### Frontend

- Vue holds workspace and pane metadata only.
- Terminal output and scrollback must not be stored in Vue reactive state.
- Each mounted pane owns one xterm.js instance and its frontend subscriptions.
- Use a singleton Composition API composable in the MVP; do not add Pinia preemptively.
- Use fixed CSS Grid templates for one through four panes; do not add a layout tree.
- Keep components focused and use plain CSS without a UI framework.
- The frontend invokes narrow typed Tauri commands and does not own PTY handles or
  process IDs.

### Rust backend

- The backend owns every `portable-pty` process, reader, writer, resize, exit, and
  termination lifecycle.
- Key every process operation and event by pane ID and generation so stale events cannot
  target a restarted process.
- Enforce the four-pane limit in the backend as well as the UI.
- Make close, restart, and close-all bounded, idempotent, and observable.
- Verify Windows descendant cleanup with real processes; do not infer it from the legacy
  `node-pty` implementation.
- Resolve command detection and spawn through the same effective environment.
- Handle Windows `.cmd` and `.bat` launchers explicitly and preserve arguments safely.
- Return typed errors instead of panicking or silently ignoring background failures.

### Workspace and security

- The selected workspace is the cwd and product boundary, not an OS sandbox.
- Shells and external CLIs retain the user's normal filesystem and process permissions.
- Do not claim isolation between panes sharing a workspace.
- Custom commands require explicit user action.
- Do not log terminal input/output by default because it may contain secrets.
- Keep Tauri capabilities and CSP minimal; do not add generic filesystem, shell,
  updater, network, or plugin access without an approved requirement.

### Lifecycle

- Every resource has exactly one owner and an idempotent disposal contract.
- Window close and application exit must call backend close-all with a bounded deadline.
- Closing one pane must not affect the other panes.
- Restart must fully close the old generation before starting the new one.
- A process cleanup test must inspect real process death, not only metadata removal.

## Existing JavaScript

When changing current `bin/**` or `src/**` files, preserve local conventions:

- CommonJS, `"use strict"`, double quotes, semicolons, and two-space indentation.
- User-facing CLI/TUI text remains Vietnamese unless product requirements change.
- Code identifiers and technical comments remain English.
- Preserve EOL and encoding behavior for edited user files.
- `src/core/**` must not require Blessed, `blessed-xterm`, or `node-pty`.

Do not promote `src/core/workspace-state.js`, Blessed widget contracts, or the current
terminal-tab model into public desktop contracts.

## Vue and TypeScript

- Use Vue 3 Composition API and `<script setup lang="ts">`.
- Use TypeScript for desktop frontend code.
- Never use `any` unless an external boundary makes it unavoidable; contain and explain
  the exception.
- Prefer computed values over duplicated state or unnecessary watchers.
- Never mutate props.
- Keep business and process logic out of templates.
- Use composables only for genuinely reusable UI behavior.

## Rust

- Keep Tauri command handlers thin and delegate PTY behavior to focused modules.
- Avoid `unwrap`/`expect` on user, process, or platform-controlled paths in production
  code.
- Keep locks narrow and never hold a manager lock while blocking on process or reader
  completion.
- Do not add a generic service container, repository pattern, or event bus.
- Treat output ordering, bounded buffering, cancellation, and cleanup as explicit
  contracts.

## Code quality

- Keep functions and modules focused on one responsibility.
- Prefer explicit dependencies and typed outcomes.
- Use early returns instead of deeply nested conditions.
- Handle loading, cancellation, and errors explicitly.
- Comments explain non-obvious reasons, business rules, workarounds, or platform
  limitations—not obvious code.
- Remove unused imports, dead code, commented-out code, and duplicated logic touched by
  the change.
- Avoid new dependencies unless they materially implement an approved MVP requirement.

## Testing and verification

Before handing off a change:

1. Run the smallest focused test that proves the behavior.
2. Run relevant regression tests for every affected boundary.
3. Run the owning frontend typecheck or Rust test suite.
4. Run the repository-wide gate when it terminates reliably.
5. Report failures, timeouts, skipped platform checks, and assumptions.

Current CLI baseline commands include:

```powershell
node bin/wsedit.js --help
node bin/wsedit.js ls
node bin/wsedit.js view package.json
node --test
node tools/phase0-check.js auto
node tools/ui-smoke.js
```

Until Phase 0 is completed, `npm test` is a placeholder, `node --test` may hang because
of PTY lifecycle handles, and real-PTY gates may be environment-specific. Do not
describe these known failures as green or hide them with forced exits.

Additional desktop gates are introduced phase by phase. PTY, command detection,
packaging, and process-tree behavior require Windows integration evidence.

## Git and scope safety

- Never commit, push, create tags, publish packages, or rewrite history unless the user
  explicitly requests it.
- Do not discard or overwrite unrelated working-tree changes.
- Review `git status` before and after work.
- Do not delete lockfiles, reinstall dependencies, or regenerate broad artifacts unless
  required by the approved phase.
- Use concise Conventional Commit titles when a commit is requested.

## Documentation discipline

- Update product scope only in `PRODUCT_DIRECTION.md` and reflect approved implications
  in lower-priority documents.
- Requirements describe observable behavior; architecture describes ownership;
  implementation plan describes order; roadmap remains short.
- Update `AGENTS.md` and `CLAUDE.md` together whenever shared rules change.
- Historical documents keep a status notice and must not claim current authority.
- Do not mark a phase complete until every exit criterion has evidence.

## Final handoff

State what changed, why, what was verified, what remains unverified, and any migration
or compatibility impact. Keep the report concise, factual, and linked to actual files.
