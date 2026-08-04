# CTO Implementation Plan and Milestones

> **Archived plan.** This document planned a headless AI-agent runtime and is no longer
> an implementation authority. Use
> [`docs/DESKTOP_IMPLEMENTATION_PLAN.md`](docs/DESKTOP_IMPLEMENTATION_PLAN.md) for the
> approved desktop phases and exit gates.

## Planning position

The next 30 commits should establish a trustworthy, headless, workspace-first runtime before model output is allowed to perform writes. They deliberately stop at `v0.3`: durable sessions and normalized provider streaming. Compressing tool security, agents, scheduling, MCP, plugins, four clients, and production hardening into the same 30 commits would create large, unreviewable changes and undermine the stated maintainability goal.

The milestone plan after the commit list continues from `v0.4` through `v1.0`. The existing `view`, `ls`, `edit`, and `ui` commands stay functional throughout the strangler migration.

Complexity includes tests and directly related documentation:

- **XS:** less than one engineer-day
- **S:** 1-2 engineer-days
- **M:** 3-5 engineer-days
- **L:** 1-2 engineer-weeks; use only where platform behavior makes a smaller safe slice impractical

Every commit below must leave `npm test` green and be independently revertible. New production behavior and its tests belong in the same commit.

## The next 30 commits

### 01. `docs(architecture): ratify domain boundaries and support policy`

**Why it is needed:** The current specs describe a terminal editor and opaque external-agent PTYs, while the target requires a structured agent runtime. Domain names, dependency direction, supported Node/platform matrix, compatibility policy, and v1 non-goals must be explicit before contracts are written.

**Files affected:** `docs/adr/0001-runtime-boundaries.md` (new), `docs/adr/0002-platform-support.md` (new), `SPEC.md`, `SPEC-multi-agent.md`, `README.md`, `package.json`.

**Estimated complexity:** S.

**Blocking dependencies:** None.

**Independent test:** Documentation links validate; the declared Node range agrees with dependency engine requirements and CI.

### 02. `test: replace the placeholder test command with explicit suites`

**Why it is needed:** `npm test` currently exits with an intentional error. A refactor cannot be trusted without one canonical entrypoint and separately diagnosable unit, integration, PTY, and smoke commands.

**Files affected:** `package.json`, `docs/testing.md` (new), `.github/workflows/ci.yml` (new).

**Estimated complexity:** S.

**Blocking dependencies:** Commit 01.

**Independent test:** Each script can run alone; `npm test` invokes the supported non-interactive gates and returns their real exit status.

### 03. `test: centralize fake terminal and process-probe fixtures`

**Why it is needed:** Terminal stream, screen, shell, PID, and orphan-detection setup is duplicated and inconsistent. Reliable shared fixtures are a prerequisite for fixing lifecycle behavior rather than masking it in tests.

**Files affected:** `test/helpers/fake-terminal.js` (new), `test/helpers/process-probe.js` (new), `test/terminal-lifecycle.test.js`, `test/smoke-ui.test.js`, `tools/ui-smoke.js`.

**Estimated complexity:** S.

**Blocking dependencies:** Commit 02.

**Independent test:** Existing assertions retain behavior using shared fixtures; fixture self-tests prove cleanup executes after a failed assertion.

### 04. `refactor(terminal): define mount dispose and terminate contracts`

**Why it is needed:** `src/ui/terminal-panel.js` owns widget state, PTYs, metadata, and teardown with unclear boundaries. Individual tab termination and whole-panel disposal need distinct, idempotent contracts.

**Files affected:** `src/ui/terminal-panel.js`, `src/core/terminal-lifecycle.js`, `test/terminal-lifecycle.test.js`.

**Estimated complexity:** M.

**Blocking dependencies:** Commit 03.

**Independent test:** Mount/dispose and tab-close tests cover success, repeated disposal, spawn failure, already-dead children, and deadline expiry without terminating the test runner.

### 05. `refactor(ui): introduce a single shutdown coordinator`

**Why it is needed:** `runUi` directly owns process handlers, screen cleanup, state listeners, timers, widgets, and PTYs. Shutdown must dispose registered resources once, in reverse ownership order, and report teardown failures.

**Files affected:** `src/core/shutdown-coordinator.js` (new), `src/commands/ui.js`, `src/ui/terminal-panel.js`, `test/shutdown-coordinator.test.js` (new).

**Estimated complexity:** M.

**Blocking dependencies:** Commit 04.

**Independent test:** Normal exit, `Ctrl+C`, `Ctrl+Q`, startup failure, uncaught error, and repeated shutdown produce one terminal outcome and restore terminal state.

### 06. `fix(terminal): eliminate the PTY test handle leak`

**Why it is needed:** The terminal lifecycle assertions pass but the process remains alive. Background work and cancellation cannot be built on a runtime that loses child-process ownership.

**Files affected:** `src/core/terminal-lifecycle.js`, `src/ui/terminal-panel.js`, `test/terminal-lifecycle.test.js`, `tools/phase0-check.js`.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 04-05.

**Independent test:** The lifecycle test process exits naturally, asserts actual child death, and leaves no orphan on Windows or the supported Unix CI platform.

### 07. `fix(ui): make resize and Ctrl+Q smoke tests deterministic`

**Why it is needed:** The current smoke run is 12/14: resize with a terminal open and clean `Ctrl+Q` exit fail. These regressions must be closed before the TUI is decomposed.

**Files affected:** `tools/ui-smoke.js`, `src/commands/ui.js`, `src/ui/layout.js`, `src/ui/terminal-panel.js`, `test/smoke-ui.test.js`.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 05-06.

**Independent test:** The smoke tool passes 14/14 three consecutive runs, captures raw failure diagnostics, and verifies terminal restoration and orphan-free exit.

### 08. `perf(cli): lazy-load only the selected command`

**Why it is needed:** `bin/wsedit.js` eagerly imports all commands, so help and `ls` pay for Blessed and syntax-highlighting initialization. Startup cost will otherwise compound with providers, MCP, and plugins.

**Files affected:** `bin/wsedit.js`, `src/commands/view.js`, `src/commands/ls.js`, `src/commands/edit.js`, `src/commands/ui.js`, `test/cli-loading.test.js` (new).

**Estimated complexity:** S.

**Blocking dependencies:** Commits 02 and 05.

**Independent test:** Help and `ls` do not load Blessed, PTY, provider, MCP, or plugin modules; command handlers can be invoked in-process without calling `process.exit`.

### 09. `perf: add startup budgets and a diagnostics command`

**Why it is needed:** Performance goals need repeatable p50/p95 measures, and platform-specific PTY failures need actionable diagnostics rather than broad catches.

**Files affected:** `tools/startup-bench.js` (new), `src/commands/doctor.js` (new), `bin/wsedit.js`, `package.json`, `test/doctor.test.js` (new), CI workflow.

**Estimated complexity:** S.

**Blocking dependencies:** Commits 01, 02, and 08.

**Independent test:** Benchmarks cover help, `ls`, UI module load, and interactive-ready time with regression thresholds; `doctor` reports Node, platform, storage, shell, PTY, config, and redacted failure details.

### 10. `build: add strict TypeScript packages without migrating the TUI`

**Why it is needed:** New public runtime contracts should be typed, but a big-bang conversion of the working CommonJS TUI would create unnecessary risk. The package/build boundary lets new code be strict while legacy code is strangled gradually.

**Files affected:** root `tsconfig.json` (new), workspace configuration in `package.json`, `packages/contracts/package.json` (new), `packages/contracts/tsconfig.json` (new), `packages/contracts/src/index.ts` (new), build/typecheck scripts.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 01-02.

**Independent test:** Clean install, build, typecheck, and test work on every supported Node version; the current CLI still launches from source.

### 11. `feat(contracts): add branded IDs clock and ID ports`

**Why it is needed:** The current state generates IDs with `Date.now()` and randomness, which is collision-prone and nondeterministic. Workspaces, sessions, tasks, attempts, runs, tool calls, events, approvals, checkpoints, and artifacts need stable identities.

**Files affected:** `packages/contracts/src/ids.ts` (new), `packages/core/src/ports/clock.ts` (new), `packages/core/src/ports/id-generator.ts` (new), `packages/testing/src/fake-clock.ts` (new), `packages/testing/src/fake-id-generator.ts` (new), contract tests.

**Estimated complexity:** S.

**Blocking dependencies:** Commit 10.

**Independent test:** IDs validate by kind, sort/serialize consistently, and are deterministic under test adapters; cross-kind assignment fails typecheck.

### 12. `feat(contracts): define results errors cancellation and envelopes`

**Why it is needed:** Commands, queries, events, streaming, and future client protocols need one explicit success/failure model. Cancellation must be a first-class terminal outcome rather than an arbitrary thrown error.

**Files affected:** `packages/contracts/src/results.ts` (new), `errors.ts` (new), `cancellation.ts` (new), `commands.ts` (new), `queries.ts` (new), `events.ts` (new), schema and serialization tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 10-11.

**Independent test:** Invalid envelopes and unknown versions are rejected; errors are serializable/redactable; cancellation is idempotent and distinguishable from failure.

### 13. `feat(config): implement typed layered configuration`

**Why it is needed:** Provider, workspace, permission, MCP, plugin, scheduler, and UI settings cannot safely evolve through scattered environment reads. Precedence and secret treatment must be deterministic.

**Files affected:** `packages/config/` (new), `packages/contracts/src/config.ts` (new), `apps/cli/src/config-adapter.ts` (new), `test/fixtures/config/` (new), `README.md`.

**Estimated complexity:** M.

**Blocking dependencies:** Commit 12.

**Independent test:** Tests prove defaults < user < workspace < environment < CLI precedence, schema validation, unknown-key diagnostics, platform paths, and secret redaction.

### 14. `feat(workspace): add open close and discovery lifecycle`

**Why it is needed:** The current UI treats a resolved path as the workspace. Multiple workspaces require an explicit lifecycle, canonical identity, configuration association, and close semantics independent of any screen.

**Files affected:** `packages/workspace/src/workspace-service.ts` (new), `packages/contracts/src/workspace.ts` (new), `packages/workspace/test/workspace-service.test.ts` (new), `apps/cli/src/commands/workspace.ts` (new).

**Estimated complexity:** M.

**Blocking dependencies:** Commits 11-13.

**Independent test:** Multiple roots can open concurrently; duplicate canonical roots coalesce; close is idempotent; missing/unreadable roots return typed failures.

### 15. `feat(workspace): reject traversal symlink and junction escapes`

**Why it is needed:** Workspace is the core security boundary. Lexical `path.resolve` checks are insufficient for symlinks, Windows junctions, case behavior, and UNC paths.

**Files affected:** `packages/workspace/src/path-policy.ts` (new), `packages/workspace/src/canonical-path.ts` (new), `packages/contracts/src/workspace.ts`, `test/fixtures/workspaces/`, path-policy tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commit 14.

**Independent test:** `..`, absolute escape, prefix confusion, case variants, symlinks, junctions, and UNC cases are covered on applicable platforms; denied paths include a safe diagnostic.

### 16. `feat(workspace): centralize ignore and instruction discovery`

**Why it is needed:** Ignore behavior is currently tied to `fs-tree`, while an agent also needs deterministic workspace instructions and safe context discovery. Explorer, index, tools, and context must not disagree about scope.

**Files affected:** `packages/workspace/src/ignore-policy.ts` (new), `instruction-discovery.ts` (new), `src/core/fs-tree.js`, `src/core/file-index.js`, `packages/workspace/test/`, instruction/ignore fixtures.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 14-15.

**Independent test:** Nested rules, explicit includes, generated/vendor directories, instruction precedence, inaccessible paths, and boundary escapes produce the same result across discovery consumers.

### 17. `refactor(index): expose asynchronous cancellable workspace search`

**Why it is needed:** The current recursive index is useful but sequential, silently ignores errors, and has only a file-count limit. A runtime service needs cancellation, bounded concurrency, diagnostics, and incremental results without blocking the UI.

**Files affected:** `packages/workspace/src/index-service.ts` (new), `src/core/file-index.js`, `src/core/fuzzy.js`, `src/ui/quick-open.js`, index/search tests and large-tree fixtures.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 12 and 14-16.

**Independent test:** Search cancellation, limit/truncation, permission errors, deterministic ordering, ignore parity, large trees, and concurrent workspace indexes are covered.

### 18. `refactor(io): route file access through a workspace filesystem port`

**Why it is needed:** Commands and `runUi` directly use `fs`, preventing deterministic tests and future permission/audit enforcement. The filesystem port must make containment non-optional.

**Files affected:** `packages/core/src/ports/filesystem.ts` (new), `packages/workspace/src/node-filesystem.ts` (new), `packages/testing/src/memory-filesystem.ts` (new), `src/commands/view.js`, `src/commands/ls.js`, `src/commands/edit.js`, `src/commands/ui.js`, adapter contract tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 15-17.

**Independent test:** Existing file commands pass against production and in-memory adapters; binary/large file policy, atomic writes, typed errors, and workspace escape rejection are identical.

### 19. `refactor(process): move shell and PTY spawning behind a process port`

**Why it is needed:** PTY creation currently lives in a widget. Process spawn, input, resize, termination, output bounds, deadlines, and descendant cleanup must be headless capabilities before they can support tools or agents.

**Files affected:** `packages/core/src/ports/process.ts` (new), `packages/terminal/src/process-service.ts` (new), `packages/testing/src/fake-process-service.ts` (new), `src/core/shell.js`, `src/ui/terminal-panel.js`, process adapter tests.

**Estimated complexity:** L.

**Blocking dependencies:** Commits 04-06, 11-12, and 15.

**Independent test:** Widget-free tests cover spawn, stream, resize, timeout, cancellation, exit classification, output limit, and process-tree death; the TUI terminal remains behaviorally unchanged.

### 20. `feat(events): replace no-payload change notifications with typed local events`

**Why it is needed:** `workspace-state.emitChange()` tells every consumer that something changed but not what, forcing broad re-rendering and coupling. Typed events are needed before durable events and multiple clients.

**Files affected:** `packages/events/src/local-event-bus.ts` (new), `packages/contracts/src/local-events.ts` (new), `src/core/workspace-state.js`, `src/commands/ui.js`, `src/ui/terminal-panel.js`, event bus tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 11-12 and 18-19.

**Independent test:** Event order, unsubscribe, subscriber failure isolation, correlation metadata, and re-entrant publish behavior are deterministic; unchanged UI regions are not invalidated.

### 21. `refactor(tui): isolate local view state from workspace state`

**Why it is needed:** Focus, scroll, overlays, editor tabs, terminal tabs, tree cursors, and workspace identity currently share one mutable object. Domain state cannot remain safe if widgets mutate it directly.

**Files affected:** `apps/tui/src/view-model.ts` (new), `src/core/workspace-state.js`, `src/ui/editor-view.js`, `src/ui/explorer.js`, `src/ui/terminal-panel.js`, projection/view-model tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 18-20.

**Independent test:** Focus/layout mutations cannot alter workspace data; workspace/process events project into view state; rendering never causes a domain transition.

### 22. `refactor(tui): extract bootstrap lifecycle and render scheduling`

**Why it is needed:** `runUi` remains the lifecycle owner and render scheduler after state extraction. Separating these concerns reduces the god object without changing application behavior.

**Files affected:** `apps/tui/src/bootstrap.ts` (new), `apps/tui/src/render-scheduler.ts` (new), `src/commands/ui.js`, `src/ui/layout.js`, bootstrap/render tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 05, 20-21.

**Independent test:** Render invalidations coalesce; startup failure disposes partial resources; shutdown is idempotent; existing unit and 14/14 smoke tests remain green.

### 23. `refactor(tui): extract file application controller`

**Why it is needed:** File open, binary/size policy, save, dirty tracking, and error presentation are embedded in `runUi`. They need a UI-independent application service before agent tools can reuse file policy safely.

**Files affected:** `apps/tui/src/file-controller.ts` (new), `packages/workspace/src/file-service.ts` (new), `src/commands/ui.js`, `src/core/text-buffer.js`, file-controller tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 18 and 21-22.

**Independent test:** Open/save/conflict, binary/large read-only behavior, missing files, encoding/EOL preservation, and dirty-state transitions run without Blessed.

### 24. `refactor(tui): extract terminal application controller`

**Why it is needed:** Terminal tabs, process metadata, visibility, and process commands still cross UI and domain boundaries. The controller should translate user intent to the process service and project events back.

**Files affected:** `apps/tui/src/terminal-controller.ts` (new), `src/commands/ui.js`, `src/ui/terminal-panel.js`, `packages/terminal/`, terminal-controller tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 19, 21-22.

**Independent test:** New/select/close/input/resize actions work through a fake process service; controller disposal cancels subscriptions but does not mutate widget internals.

### 25. `refactor(tui): extract focus overlay and quick-open controllers`

**Why it is needed:** Key dispatch, focus order, overlay state, command prompt, and quick-open orchestration form the final large responsibility cluster in `runUi`.

**Files affected:** `apps/tui/src/focus-controller.ts` (new), `overlay-controller.ts` (new), `quick-open-controller.ts` (new), `src/commands/ui.js`, `src/core/keymap.js`, `src/ui/prompt.js`, `src/ui/quick-open.js`, controller tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 17 and 21-24.

**Independent test:** Focus/overlay transition tables, key conflicts, prompt cancellation, and async quick-open results are deterministic; `runUi` is reduced to input validation, composition, start, and await-shutdown.

### 26. `feat(events): define durable event-store contracts with an in-memory adapter`

**Why it is needed:** Resume, reconnect, audit, tasks, background work, and future clients require ordered durable state. The contract should be proven with deterministic replay before choosing storage behavior.

**Files affected:** `packages/events/src/event-store.ts` (new), `packages/events/src/in-memory-event-store.ts` (new), `packages/contracts/src/events.ts`, `packages/contracts/src/artifacts.ts` (new), event-store conformance tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 11-12 and 20.

**Independent test:** Append/query/subscribe is monotonic; optimistic version conflicts are explicit; reconnect from a sequence has no gaps; subscriber retries do not duplicate projection application.

### 27. `feat(storage): persist events and artifacts with migrations`

**Why it is needed:** An in-memory log cannot support restart or background work. Storage needs transactions, migrations, corruption detection, redaction, bounded payloads, and a repairable artifact boundary.

**Files affected:** `packages/storage/` (new), `packages/storage/migrations/` (new), `packages/events/src/sqlite-event-store.ts` (new), `packages/observability/src/redaction.ts` (new), storage conformance/migration/failure tests.

**Estimated complexity:** L.

**Blocking dependencies:** Commit 26; commit 13 for storage configuration.

**Independent test:** The same event-store suite passes for memory and disk; transaction rollback, concurrent append, migration, disk-full simulation, corrupt records, redaction, and artifact cleanup are covered.

### 28. `feat(sessions): add transcript projections and safe resume`

**Why it is needed:** The repository currently loses all conversational state on exit. Session resume is the first user-facing proof that event persistence and projections are sufficient.

**Files affected:** `packages/sessions/` (new), `packages/contracts/src/sessions.ts` (new), `packages/events/`, `packages/storage/`, `apps/cli/src/commands/session.ts` (new), session replay/integration tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 14 and 26-27.

**Independent test:** Create/list/show/resume/fork/archive works after process restart; incompatible/corrupt sessions fail visibly; resume never starts an unfinished external action automatically.

### 29. `feat(providers): define normalized streams with a deterministic fake`

**Why it is needed:** Provider SDK types must not leak into sessions, events, agents, or clients. A deterministic fake proves text, usage, tool-call, error, and cancellation semantics without network variance.

**Files affected:** `packages/providers/src/contracts.ts` (new), `packages/providers/src/normalized-stream.ts` (new), `packages/providers/src/fake-provider.ts` (new), `packages/contracts/src/provider.ts` (new), recorded stream fixtures and conformance tests.

**Estimated complexity:** M.

**Blocking dependencies:** Commits 12 and 26-28.

**Independent test:** Fixtures cover text deltas, reasoning metadata, partial tool calls, usage, retry hints, rate limits, malformed/out-of-order input, disconnect, and cancellation.

### 30. `feat(runtime): stream one real provider through resumable sessions`

**Why it is needed:** One production adapter validates the provider abstraction and turns the project from a PTY host into the first usable slice of a structured AI CLI runtime.

**Files affected:** `packages/providers/src/adapters/` (new), `packages/core/src/runtime.ts` (new), `packages/events/src/stream-publisher.ts` (new), `packages/sessions/src/session-service.ts` (new), `apps/cli/src/commands/run.ts` (new), `bin/wsedit.js`, recorded contract fixtures and integration tests.

**Estimated complexity:** L.

**Blocking dependencies:** Commits 13, 26-29.

**Independent test:** A headless run streams normalized events, persists model/usage identity, cancels cleanly, classifies provider failures, resumes the transcript after restart, and replays in tests without network access.

## Milestone 1 — Trustworthy baseline (`v0.1`)

**Commits:** 01-09.

**Goals:** Truthful runtime requirements, one reliable verification entrypoint, deterministic process ownership, stable TUI lifecycle, lazy loading, and measurable startup budgets.

**Exit criteria:** `npm test` exits without forced termination; UI smoke passes 14/14 repeatedly; no orphan process remains; help and simple commands meet agreed p50/p95 budgets.

## Milestone 2 — Headless workspace foundation (`v0.2`)

**Commits:** 10-25.

**Goals:** Strict contracts, layered configuration, multiple canonical workspaces, containment, testable filesystem/process ports, typed events, and a TUI that is a thin client rather than the domain owner.

**Exit criteria:** Core packages import no Blessed, Commander, PTY widget, or provider SDK; workspace escape tests pass on supported platforms; `runUi` only composes dependencies and owns no business logic; existing commands retain behavior.

## Milestone 3 — Durable streaming sessions (`v0.3`)

**Commits:** 26-30.

**Goals:** Versioned durable events, migrated storage, resumable sessions, provider-neutral streams, and one production provider through a headless `run` command.

**Exit criteria:** A structured session streams, persists, stops, and resumes after restart; event subscribers reconnect by sequence; usage and provider errors are recorded; no vendor type appears in public runtime contracts.

## Milestone 4 — Permissioned coding capabilities (`v0.4`)

**Planned work:** Add token/context budgets and compression; implement one tool registry/executor; enforce deny/ask/allow policy and approvals; add bounded read/search/shell tools; build conflict-safe patches, Git diff/status, and workspace-scoped checkpoints.

**Exit criteria:** Every model-reachable side effect passes one permission/audit/cancellation path; patch conflicts never partially write; destructive actions fail closed; checkpoints restore only verified workspace paths.

## Milestone 5 — Task and agent runtime (`v0.5`)

**Planned work:** Add durable task/attempt state machines, inspectable plans, a bounded executor loop, end-to-end cancellation, token/cost/turn/time budgets, no-progress detection, recovery rules, and capability-aware model routing.

**Exit criteria:** Illegal transitions are rejected; a deterministic agent simulation covers success, denial, re-plan, provider failure, budget exhaustion, and cancellation; restart never blindly repeats an ambiguous side effect.

## Milestone 6 — MCP and Plugin SDK (`v0.6`)

**Planned work:** Integrate MCP lifecycle/transports through the internal tool boundary; publish a versioned, capability-scoped Plugin SDK; isolate activation failures; ship a conformance kit and example plugin.

**Exit criteria:** Native, MCP, and plugin tools have permission/audit parity; a hostile server or broken plugin cannot escape workspace policy, block shutdown, access mutable internal state, or crash the runtime.

## Milestone 7 — Scheduler and background execution (`v0.7`)

**Planned work:** Add durable jobs, priorities, leases, heartbeats, retries, quotas, fairness, provider rate limits, and a local runtime daemon with authenticated versioned IPC and resumable event subscriptions.

**Exit criteria:** Jobs survive client disconnect and daemon restart; cancellation is orphan-free; clients never own background state; ambiguous external effects are surfaced for human resolution rather than repeated.

## Milestone 8 — Multi-workspace and multi-agent (`v0.8`)

**Planned work:** Add bounded delegation, parent/child tasks, workspace resource leases, Git worktree isolation for writers, read-only snapshot sharing, integration artifacts, concurrency controls, and stress tests.

**Exit criteria:** Multiple workspaces and tasks run concurrently within resource ceilings; two writing agents cannot overwrite one another; delegation depth/fan-out is bounded; worktree cleanup validates every target path.

## Milestone 9 — Shared clients and public beta (`v0.9`)

**Planned work:** Migrate CLI and TUI to the daemon protocol; add web dashboard and VSCode extension as thin clients; implement local authentication, workspace authorization/trust, reconnect, projections, approval flows, diagnostics, import/export, and plugin/MCP documentation.

**Exit criteria:** The same task can start in CLI, stream in web, receive approval from VSCode, and resume in TUI; no client imports runtime internals or reads storage directly; slow or unauthorized clients cannot affect other workspaces.

## Milestone 10 — Production release (`v1.0`)

**Planned work:** Freeze event schema v1, client protocol v1, Plugin SDK v1, and storage migration policy; add upgrade/rollback, backup/restore, safe mode, failure injection, soak/security/performance tests, SBOM, signed release artifacts where applicable, telemetry controls, support matrices, and vulnerability response procedures.

**Exit criteria:** All contract, migration, recovery, security, soak, and performance gates pass on supported platforms; no critical/high security finding remains; sessions, tasks, approvals, checkpoints, and jobs recover after forced termination without duplicated committed effects.

## Critical path to v1.0

    Baseline and lifecycle
      -> contracts and workspace containment
      -> ports, events, persistence, and sessions
      -> provider streaming
      -> permissions, tools, patches, and Git
      -> tasks, planner, executor, and cancellation
      -> MCP and plugins
      -> scheduler and daemon
      -> worktree-isolated multi-agent execution
      -> shared clients
      -> v1 hardening and contract freeze

The non-negotiable maintainability rule is that no native feature, MCP server, plugin, agent, scheduler, or client may create an alternate path around workspace containment, permission checks, durable events, cancellation, or the shared runtime protocol.
