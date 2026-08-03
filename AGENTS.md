# AGENTS.md — Project Development Rules

This file is the canonical repository instruction set for Codex, Claude Code,
subagents, and human contributors. Read it completely before changing code.

## Product direction

`wsedit` is transitioning from a terminal editor/PTY prototype into a lightweight,
production-grade AI CLI agent. The target is a headless, workspace-first runtime
supporting structured provider streams, safe tool calling, durable sessions,
multiple tasks and agents, MCP, plugins, background execution, and multiple clients.

The existing CLI and TUI are compatibility surfaces during this migration. A PTY
running an external AI CLI is a terminal process, not an internal agent runtime.

## Source of truth

Use this priority order when documents disagree:

1. The current user request and explicit acceptance criteria.
2. `MILESTONE.md` for implementation order and milestone exit gates.
3. `REFACTOR_PLAN.md` for migration sequencing and dependency boundaries.
4. `ARCHITECTURE_REVIEW.md` for audited current-state evidence and target design.
5. `ROADMAP.md`, `TODO.md`, `FOLDER_STRUCTURE.md`, and
   `MISSING_FEATURES.md` when present.
6. Current source code and executable tests for actual behavior.
7. `SPEC.md`, `SPEC-multi-agent.md`, and `docs/agents/**` as historical context.

Historical files do not override verified current behavior or the approved migration
plan. When evidence conflicts, investigate and document the conflict; do not silently
choose the more convenient interpretation.

## Working principles

- Understand the related implementation and tests before editing.
- Find and fix root causes instead of masking symptoms.
- Make the smallest complete change that advances the current milestone.
- Preserve working behavior unless the task explicitly changes it.
- Prefer changing existing code over parallel replacement implementations.
- Do not create empty placeholder packages or abstractions for hypothetical needs.
- Keep each commit independently testable and revertible.
- Do not mix unrelated cleanup into a feature or fix.
- Do not modify source code for documentation-only tasks.
- Do not claim a result that was not verified.

## Migration strategy

Use a strangler migration, not a big-bang rewrite.

- Keep `view`, `ls`, `edit`, and `ui` usable while headless packages are introduced.
- Complete milestone prerequisites in `MILESTONE.md` before dependent features.
- New TypeScript packages may coexist with the current CommonJS code. Do not convert
  the existing TUI merely for consistency.
- Remove a legacy path only after its replacement has parity tests and all callers
  use the new boundary.
- Keep compatibility shims private and time-bounded; document their removal gate.

## Architectural boundaries

### Dependency direction

- Applications and clients depend on public contracts and runtime facades.
- Application services depend on domain packages and ports.
- Infrastructure adapters implement ports.
- Domain packages must not import UI frameworks, Commander, PTY widgets, process
  globals, storage implementations, or provider SDKs.
- Provider SDK types must never appear in public events, sessions, tasks, tools, or
  client protocol contracts.
- Web, VSCode, CLI, and TUI clients must not read runtime storage directly.

For the current tree, `src/core/**` must not require `blessed`, `blessed-xterm`, or
`node-pty`. `src/ui/**` may render UI but must not become the owner of domain logic.

### Workspace boundary

- Treat each workspace as a security, configuration, persistence, and resource
  boundary.
- Canonicalize and validate every path before access.
- Cover traversal, symlink, Windows junction, case, prefix-confusion, and UNC cases.
- Never assume that lexical `path.resolve()` containment is sufficient.
- Never perform destructive cleanup against an unresolved path, workspace root, home
  directory, or broad glob.

### Side effects and permissions

- Filesystem, process, network, Git, storage, clock, and ID access must move behind
  explicit ports as their milestone is implemented.
- All model-reachable side effects must use one governed execution path with actor,
  workspace, correlation ID, permission decision, timeout, cancellation, bounded
  output, audit event, and typed result.
- Do not expose model-callable writes before the permission and approval pipeline is
  present.
- Native, MCP, and plugin capabilities must not have separate security paths.
- Headless execution fails closed when an approval is required but unavailable.

### State and events

- Do not extend `src/core/workspace-state.js` into the agent domain model.
- Keep focus, scroll, overlays, widget geometry, and local tab presentation in client
  view state.
- Encapsulate domain mutations behind application commands.
- Prefer typed events with payloads over generic change notifications.
- Durable events require stable IDs, schema versions, correlation/causation metadata,
  ordering, redaction, and migration policy.
- Persist references to large artifacts instead of unbounded event payloads.

### Providers, agents, and tasks

- Normalize provider streams at the adapter boundary.
- Record provider/model identity, usage, cancellation, and classified failures.
- Define task, attempt, agent run, tool call, approval, and checkpoint as distinct
  concepts with explicit legal transitions.
- Planner output must be inspectable; executor loops must have turn, token, cost,
  time, and no-progress limits.
- Multi-agent writers require isolated worktrees or an equivalent verified isolation
  mechanism. Shared mutable working directories are not acceptable.

### Lifecycle and background work

- Every resource has exactly one owner and an idempotent disposal contract.
- Internal services return typed outcomes; only the top-level process owner decides
  exit codes.
- Cancellation must propagate through client request, task, agent, provider, tool,
  PTY/process tree, and persistence.
- Never rely on host `process.exit()` as the primary child-process cleanup strategy.
- Background work belongs to the scheduler/runtime host, not a TUI widget or client.
- Recovery must not automatically repeat an external side effect with an unknown
  outcome.

## Code quality rules

- Keep functions and modules focused on one responsibility.
- Prefer explicit dependencies over open-ended action bags or mutable globals.
- Prefer computed/derived projections over duplicated state.
- Use early returns instead of deeply nested conditions.
- Never use `any` in new TypeScript unless an external boundary makes it unavoidable;
  contain and explain the exception.
- Keep public types close to their owning package and version external schemas.
- Handle loading, cancellation, and errors explicitly. Never silently swallow errors.
- Comments explain non-obvious reasons, business rules, workarounds, or platform
  limitations—not obvious code.
- Remove unused imports, dead code, commented-out code, and duplicated logic touched
  by the change.
- Avoid new dependencies unless they materially reduce risk or implement an approved
  roadmap capability. Document the reason and commit lockfile changes together.

### Existing JavaScript

When changing current `bin/**` or `src/**` files, preserve the local conventions:

- CommonJS, `"use strict"`, double quotes, semicolons, and two-space indentation.
- User-facing CLI/TUI text remains Vietnamese unless product requirements change.
- Code identifiers and technical comments remain English.
- Preserve EOL and encoding behavior for edited user files.

### New packages

New runtime packages follow the target structure in `FOLDER_STRUCTURE.md` and use
strict TypeScript when their milestone begins. Do not introduce a package before it
owns real behavior and tests.

## Testing and verification

Before handing off a change:

1. Run the smallest focused test that proves the new behavior.
2. Run relevant regression tests for every affected boundary.
3. Run the repository-wide gate when it can terminate reliably.
4. Report failures, timeouts, skipped platform checks, and unverified assumptions.

Current baseline commands include:

```powershell
node bin/wsedit.js --help
node bin/wsedit.js ls
node bin/wsedit.js view package.json
node --test
node tools/phase0-check.js auto
node tools/ui-smoke.js
```

Until the baseline lifecycle commits in `MILESTONE.md` are complete, `node --test`
may hang after terminal lifecycle assertions and `tools/ui-smoke.js` may report 12/14.
Do not describe these known failures as green, and do not hide them with forced exits.

Additional gates:

- Changed JavaScript: `node --check <file>`.
- Changed TypeScript: typecheck the owning package plus its contract consumers.
- UI/terminal changes: focused tests, Phase 0 checks, real-PTY smoke, and orphan check.
- Workspace changes: traversal, symlink/junction, case, and multi-root tests.
- Contract/storage changes: schema compatibility, replay, migration, and failure tests.
- Performance-sensitive changes: compare p50/p95 startup or runtime budgets.

Tests may fake clocks, IDs, providers, processes, storage, and filesystems to make
behavior deterministic. They must not mock away the boundary being verified.

## Git and scope safety

- Never commit, push, create tags, publish packages, or rewrite history unless the
  user explicitly requests it.
- Do not discard or overwrite unrelated working-tree changes.
- Review `git status` before and after work; distinguish pre-existing changes from
  your own.
- Do not delete lockfiles, reinstall dependencies, or regenerate broad artifacts
  unless required by the task.
- Use concise Conventional Commit titles when the user requests a commit.

## Documentation discipline

- Update architecture documents only when a decision, contract, milestone, or
  verified fact changes.
- Do not mark a milestone complete until every exit criterion has evidence.
- Record architecture decisions as ADRs; do not bury them in code comments.
- Keep examples aligned with the supported platform and actual commands.
- Update `AGENTS.md` and `CLAUDE.md` together whenever shared rules change.

## Final handoff

State what changed, why, what was verified, what remains unverified, and any migration
or compatibility impact. Keep the report concise, factual, and linked to actual files.
