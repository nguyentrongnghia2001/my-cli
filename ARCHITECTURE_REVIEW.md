# Architecture Review

> **Historical audit snapshot.** The current-state source observations remain useful,
> but the proposed headless AI-agent-platform target is superseded. The approved target
> is the lightweight desktop terminal deck in
> [`docs/PRODUCT_DIRECTION.md`](docs/PRODUCT_DIRECTION.md) and
> [`docs/DESKTOP_ARCHITECTURE.md`](docs/DESKTOP_ARCHITECTURE.md). Measurements and pass
> counts in this snapshot require re-verification before reuse.

## Executive assessment

This repository is not yet an AI CLI agent. It is a small CommonJS terminal workspace editor named `wsedit` with a file explorer, editor, quick-open overlay, and a PTY-backed terminal. It can host existing agent CLIs as opaque terminal processes, but it does not implement an agent runtime, model provider, structured streaming, tool calling, MCP, sessions, memory, task scheduling, permissions, plugins, or durable events.

That distinction is visible in the executable entrypoint (`bin/wsedit.js:4-40`), the current composition root (`src/commands/ui.js:50-490`), and the v2 specification, which explicitly says the user still coordinates agents and that the application does not parse or understand their output (`SPEC-multi-agent.md:26-32`). The present architecture is therefore a useful TUI spike, not an early production implementation of the requested Codex CLI / Claude Code class of system.

The strongest parts are the small dependency footprint, separation of some pure modules, integer layout calculation, asynchronous file indexing, PTY feature probes, and focused regression tests. The central risks are the absence of the intended product core, a UI-centric composition root, untyped mutable shared state, direct process termination, missing permission boundaries, and a test suite that reports passing PTY assertions but never terminates.

### Audit basis

- All 48 tracked files were inspected, including the lockfile, 35 JavaScript files (4,033 lines), specifications, tests, and benchmark tools.
- `AGENTS.md` and `CLAUDE.md` are currently zero-byte working-tree files and already modified before this audit. They were not changed.
- `node --test` did not finish within 60 seconds. The 41 tests excluding `test/terminal-lifecycle.test.js` passed. The two terminal lifecycle assertions passed, but that test process stayed alive beyond a separate 15-second timeout.
- `npm.cmd test` exits with code 1 because `package.json:10` is still the npm-init placeholder.
- `node tools/phase0-check.js auto` passed 5/5 on Node 24.16.0.
- `node tools/ui-smoke.js` passed 12/14; “resize when terminal is open” and “Ctrl+Q exits cleanly” failed.
- A short `node tools/phaseA-bench.js 4 2` run observed about 58.3% host CPU and 138.34 MB RSS. This is a synthetic PTY benchmark, not an agent-runtime capacity test.
- Seven-run local medians were approximately 378.5 ms for `--help`, 377.4 ms for `ls`, and 406.9 ms for `view package.json`. `require("./src/commands/ui")` alone took about 286.8 ms. These are environment-specific, but they show that the repository’s `<300 ms` startup objective (`SPEC.md:16-20`) is not currently met.

## 1. Repository overview

### Project purpose

The implemented product is a lightweight terminal workspace editor. The published metadata calls it a CLI for viewing and editing files (`package.json:2-7`), and the README documents four commands: `view`, `ls`, `edit`, and `ui` (`README.md:25-42`). The terminal panel can run shells and third-party agent CLIs through a PTY (`README.md:55-61`).

There are three different product intentions in the repository:

1. Current executable: terminal file browser/editor and shell host.
2. Draft v2: a multi-pane supervisor for opaque external agent processes (`SPEC-multi-agent.md:15-32`).
3. Desired future product in this audit: a structured, provider-backed AI agent platform with tools, MCP, tasks, sessions, plugins, and multiple clients.

The first two can contribute terminal and workspace adapters to the third, but they are not the third.

### Current architecture summary

The architecture is a single npm package with three informal layers:

- CLI wiring in `bin/wsedit.js`.
- Commands and orchestration in `src/commands/`.
- reusable logic in `src/core/` and Blessed widgets in `src/ui/`.

`src/core/` is intended to be UI-independent (`docs/agents/CONTRACTS.md:7-13`), although `src/core/language.js` depends on `cli-highlight` and `src/core/workspace-state.js` exposes a mutable state object. The `ui` command creates every service and widget in one function and connects them through an open-ended `actions` object (`src/commands/ui.js:78-110`, `src/commands/ui.js:242-387`). State changes emit an undifferentiated “changed” notification, which schedules a full widget render (`src/core/workspace-state.js:24-38`, `src/commands/ui.js:169-175`, `src/commands/ui.js:475`).

The terminal is created lazily, but the CLI eagerly imports all command modules before parsing arguments (`bin/wsedit.js:4-9`). Consequently even `--help` and `ls` pay most of the UI and syntax-highlighting module-load cost.

### Current dependency graph

Static internal imports contain no circular dependency. The dependency direction is:

    bin/wsedit.js
      -> src/commands/{view,ls,edit,ui}
      -> src/commands/ui.js
           -> src/core/{keymap,file-index,text-buffer,workspace-state}
           -> src/ui/{layout,explorer,status-bar,editor-view,prompt}
           -> optional src/ui/{tab-bar,quick-open,terminal-panel}
      -> src/ui/explorer.js -> src/core/{fs-tree,workspace-state}
      -> src/ui/status-bar.js -> src/core/language.js
      -> src/ui/quick-open.js -> src/core/fuzzy.js
      -> src/ui/terminal-panel.js -> src/core/{workspace-state,shell}
      -> src/core/file-index.js -> src/core/fs-tree.js

External runtime dependencies are:

| Package | Current responsibility | Architectural impact |
|---|---|---|
| `commander@15.0.0` | CLI parsing | Good fit, but it requires Node >=22.12 while README claims Node 18+ (`README.md:5-7`). |
| `blessed@0.1.81` | TUI widgets/rendering | Old API and global terminal behavior increase lifecycle and testing risk. |
| `chalk@4.1.2` | ANSI styling | CommonJS-compatible and low risk. |
| `cli-highlight@2.1.11` | `view` syntax highlighting | Pulls a relatively broad tree into every CLI invocation because commands are eager-loaded. |
| `blessed-xterm@1.6.0` | PTY terminal widget | Optional native-facing adapter; requires Node >=20.19. |
| `node-pty@1.2.0-beta.14` | PTY process host | Optional beta native dependency; process cleanup is currently the most fragile runtime area. |

The lockfile contains 37 package entries. There is no HTTP client, schema validator, database, model SDK, MCP SDK, telemetry SDK, or plugin runtime.

### Folder responsibilities

| Folder/file | Current responsibility | Assessment |
|---|---|---|
| `bin/wsedit.js` | Commander command registration and parsing | Appropriately small, but eagerly imports every command. |
| `src/commands/` | `view`, `ls`, legacy single-file `edit`, and full TUI orchestration | Mixed application, infrastructure, policy, and UI-controller responsibilities. |
| `src/core/` | file index/tree, fuzzy search, keymap, language mapping, shell discovery, text buffer, mutable workspace state | Useful pure functions coexist with environment-dependent utilities and shared mutable state. It is not an AI-agent core. |
| `src/ui/` | Blessed widgets, layout, terminal integration | Mostly presentation code, except terminal lifecycle/state ownership and explorer IO coordination cross the boundary. |
| `test/` | Node test unit, widget, contract, CLI, and PTY lifecycle tests | Valuable regression coverage, but no working package test command and a PTY suite that hangs. |
| `tools/` | PTY feature probes, 4-pane benchmark, end-to-end UI smoke test | Good evidence-driven practice; scripts duplicate utilities and are not integrated into one reliable gate. |
| `docs/agents/` | historical contracts, work board, Phase 0 evidence, changelog | Useful context but not a reliable current source of truth; some “done” claims contradict current execution. |
| `SPEC*.md` | v1 TUI and draft multi-agent terminal-supervisor designs | Detailed for the old product direction, but explicitly excludes core capabilities needed by an AI agent platform. |

There are no packages in the monorepo sense despite the requested “package responsibilities.” The repository is one package with file-level modules.

### Startup flow

1. Node starts `bin/wsedit.js` from the package bin mapping (`package.json:5-8`).
2. Before argument parsing, it loads Commander plus all four command modules (`bin/wsedit.js:4-9`). This pulls in Blessed, `cli-highlight`, most core modules, and most widgets even for help or `ls`.
3. Commander builds the command tree and parses arguments (`bin/wsedit.js:11-40`).
4. For `ui`, `runUi` resolves the root, validates existence and TTY presence, then creates a Blessed screen (`src/commands/ui.js:50-66`).
5. It installs process-global exception and rejection handlers (`src/commands/ui.js:68-76`), constructs mutable workspace state, creates widgets and an actions bag, calculates layout, renders, and starts file indexing without awaiting it (`src/commands/ui.js:78-110`, `src/commands/ui.js:477-489`).
6. The PTY dependency and shell are loaded only when the terminal is first shown (`src/commands/ui.js:212-230`). This local lazy behavior is good, but it does not offset the eager imports at the bin boundary.

### Runtime flow

For the workspace UI:

    keypress
      -> screen-level dispatcher and/or focused widget handler
      -> function in mutable actions bag
      -> direct filesystem/process operation and/or workspace-state mutation
      -> emitChange() without event payload
      -> scheduleRender()
      -> every mounted widget render()
      -> one screen.render()

File opening is synchronous: `actions.openFile` resolves and stats the path, sniffs bytes, reads the full file, creates a buffer, inserts a tab, and changes focus (`src/commands/ui.js:247-271`). Saving is also synchronous (`src/commands/ui.js:274-285`). Explorer directory reads are synchronous (`src/core/fs-tree.js:13-39`). Quick-open indexing is asynchronous but recursively serial (`src/core/file-index.js:15-58`).

Terminal runtime is a second ownership model. `terminal-panel.js` keeps local PTY/widget handles while separately mutating terminal metadata in shared state (`src/ui/terminal-panel.js:195-233`, `src/ui/terminal-panel.js:335-359`). Closing a single terminal uses a three-stage asynchronous termination sequence (`src/ui/terminal-panel.js:397-481`), while whole-app shutdown destroys the screen and calls `process.exit(0)` without invoking widget teardown (`src/commands/ui.js:396-401`). These lifecycle paths are inconsistent and match the observed test hang/smoke failures.

## 2. Architecture review by subsystem

### CLI layer

**Current design.** Commander registers four commands in one bin file. Command handlers call `process.exit` directly on errors or quit paths (`src/commands/view.js:10-31`, `src/commands/ui.js:50-76`).

**Pros.** The CLI surface is easy to understand, the bin file is small, and command implementations are separated from registration.

**Cons.** All handlers are imported eagerly; handlers are not composable because they terminate the process; there is no non-interactive JSON/event mode, stdin prompt mode, global options, configuration resolution, authentication, or daemon/client boundary. Version `1.0.0` is duplicated in `package.json` and `bin/wsedit.js:15`.

**Scalability and maintainability.** Low for a multi-surface product. A web dashboard and VSCode extension cannot reuse commands that own stdout, TTY, and process exit.

**Suggested improvement.** Make the bin a lazy command loader. Have command adapters translate parsed input into application commands and translate results/events into exit codes. Move lifecycle ownership to a top-level bootstrap that creates and disposes a runtime exactly once. Add machine-readable and non-interactive modes before APIs become CLI-shaped.

### Agent layer

**Current design.** No structured agent layer exists. A user can start an external `claude`, `codex`, or other process in a PTY. The v2 spec deliberately treats it as an opaque byte stream (`SPEC-multi-agent.md:210-228`).

**Pros.** Hosting existing CLIs is provider-agnostic and cheap to prototype. PTY isolation keeps third-party terminal behavior out of the core.

**Cons.** There is no agent loop, prompt assembly, role/system instruction model, tool-call protocol, observation loop, model state, cancellation contract, budget, delegation, or structured outcome. Output activity is not task state.

**Scalability and maintainability.** Not applicable as an AI runtime; PTY process count is the only scaling dimension. It cannot safely coordinate agents or expose their state to other clients.

**Suggested improvement.** Introduce an `AgentRuntime` state machine independent of UI and provider. It should consume an immutable run request, emit versioned run events, use a provider stream, call tools only through a permissioned executor, and persist every meaningful transition. Keep “external CLI in PTY” as a separate terminal-process adapter, not the agent abstraction.

### Workspace

**Current design.** A workspace is one absolute root path in a mutable object (`src/core/workspace-state.js:5-21`). Explorer and index apply a hard-coded ignore set. Most paths are absolute across module boundaries. Only one root exists per process.

**Pros.** Workspace-first root resolution is explicit, directory browsing is lazy, file indexing does not block initial render, and file EOL/read-only/binary policies are considered.

**Cons.** There is no `Workspace` service or lifecycle, multi-root support, symlink policy, containment enforcement, file watcher, instruction discovery, repository metadata, per-workspace configuration, concurrent write coordination, snapshot, or resource limit. `path.resolve(root, filePath)` accepts an absolute path outside the root (`src/commands/ui.js:249`), so the boundary is convention rather than enforcement. Ignore lists are duplicated in `src/commands/ls.js:26` and `src/core/fs-tree.js:6`.

**Scalability and maintainability.** Suitable for one local folder and tens of thousands of indexed files, not multiple concurrent workspaces or long-running jobs.

**Suggested improvement.** Give each workspace a stable ID and owned services: canonical root, filesystem adapter, ignore engine, watcher, index/search, instructions, git repository, and scoped config. Validate every read/write against a canonical allowed-root policy and handle symlinks deliberately. Keep editor view state out of the domain workspace model.

### Session management

**Current design.** Absent. State lives in memory until process exit. The draft proposal mentions saving pane layout to `~/.wsedit/projects.json`, but no implementation exists (`docs/agents/BOARD.md:86`).

**Pros.** No migration burden yet.

**Cons.** No conversation/session ID, resume, transcript, run history, durable tool results, crash recovery, schema versioning, or retention policy.

**Scalability and maintainability.** Zero readiness for production agent sessions.

**Suggested improvement.** Use an append-only event log plus periodic snapshots. Separate session metadata, messages, agent runs, tool invocations, and artifacts. Start with SQLite for local transactional durability and explicit schema migrations. Resume must reconstruct state without re-executing side effects.

### Memory

**Current design.** Absent. Open editor buffers are transient application state, not agent memory.

**Pros.** No accidental cross-workspace memory leakage today.

**Cons.** No working memory, persisted summaries, user preferences, project knowledge, retrieval index, provenance, TTL, or deletion controls.

**Scalability and maintainability.** No capability.

**Suggested improvement.** Define scoped memory (`run`, `session`, `workspace`, `user`) with explicit provenance and opt-in persistence. Keep raw conversation history separate from derived summaries. Retrieval should return cited source chunks and respect workspace boundaries.

### Tool registry and execution

**Current design.** Absent. Shell commands and file writes are direct application actions (`src/commands/ui.js:274-285`, `src/ui/terminal-panel.js:296-359`), not registered tools.

**Pros.** The current surface is small.

**Cons.** No tool schema, discovery, validation, execution context, permission classification, result normalization, timeout, cancellation, concurrency control, audit log, sandbox, or idempotency model.

**Scalability and maintainability.** Direct calls cannot support providers, plugins, MCP, or remote clients safely.

**Suggested improvement.** Build a registry of versioned tool descriptors and handlers. Route every invocation through validation, policy, approval, execution, output limiting, event emission, and persistence. Distinguish read-only, workspace-write, network, process, credential, and destructive capabilities.

### MCP

**Current design.** Absent.

**Pros.** No protocol compatibility debt.

**Cons.** No server configuration, transport, initialize/capability negotiation, tool/resource/prompt discovery, reconnect, cancellation, authentication, logging, or conversion into internal tool descriptors.

**Scalability and maintainability.** No readiness.

**Suggested improvement.** Implement MCP as an infrastructure adapter behind the internal registry. Use one managed connection per configured server scope, health state, bounded reconnect, schema validation, namespaced capabilities, and policy checks identical to native tools. Never let MCP bypass permission or audit pipelines.

### Provider abstraction

**Current design.** Absent. External CLI programs own their own model/provider integrations.

**Pros.** The repository has not coupled itself to a model vendor.

**Cons.** No common request/response types, capabilities, authentication, retries, rate limits, structured tool calls, usage accounting, error taxonomy, or model metadata.

**Scalability and maintainability.** No capability for model routing or controlled multi-agent execution.

**Suggested improvement.** Define a narrow `ModelProvider` port around normalized stream events and capability metadata. Keep vendor SDK types in adapters. Add conformance tests using recorded streams. Authentication and rate-limit state belong to provider infrastructure, not agents.

### Streaming

**Current design.** PTY bytes are streamed and rendered by `blessed-xterm`, but model responses are not represented. State changes are coalesced with `setImmediate`, not streamed as semantic events (`src/commands/ui.js:114-122`).

**Pros.** The TUI already handles incremental terminal output and batched screen render scheduling.

**Cons.** No semantic stream protocol, backpressure, partial tool call assembly, usage deltas, ordering guarantees, reconnect cursor, replay, or slow-consumer policy.

**Scalability and maintainability.** PTY streaming cannot feed a web dashboard or session resume.

**Suggested improvement.** Normalize provider output into ordered events such as run started, text delta, reasoning delta, tool-call delta, usage, warning, completed, failed, and cancelled. Persist sequence numbers before fan-out. Renderers should subscribe to projections rather than own transport streams.

### Event bus

**Current design.** `workspace-state` stores listeners in a hidden `_listeners` property and emits a no-payload change notification (`src/core/workspace-state.js:24-38`).

**Pros.** It decouples state mutation from immediate screen rendering and allows render coalescing.

**Cons.** It is not an event bus: no type, payload, source, sequence, timestamp, correlation, replay, error isolation, filtering, or backpressure. A change causes every widget to render. Listener errors are not isolated. `_listeners` contaminates serializable domain state.

**Scalability and maintainability.** Low. It will become a global invalidation mechanism and cannot support durable sessions or remote clients.

**Suggested improvement.** Separate domain events from in-process notifications. Define versioned typed envelopes with workspace/session/run/task IDs and monotonic sequence. Persist durable events; use an in-memory bus for local fan-out; build projections for TUI, web, and VSCode.

### UI renderer

**Current design.** Blessed widgets read shared state and expose a common factory shape documented in `docs/agents/CONTRACTS.md:159-189`. `ui.js` schedules one complete render pass. Terminal widgets additionally own PTYs and metadata.

**Pros.** Integer geometry is pure and tested. One scheduled screen render reduces redundant terminal writes. Most widgets have focused responsibilities. Terminal creation is lazy.

**Cons.** Rendering, input, application actions, filesystem policy, and process lifecycle are interwoven. Several widgets call `screen.render()` themselves (`src/ui/prompt.js:65-78`, `src/ui/quick-open.js:106-107`), contradicting the stated contract. Geometry mutation uses inconsistent Blessed APIs. UI behavior depends on undocumented private members such as `_updateCursor` and PTY widget internals. `runUi` is a god controller.

**Scalability and maintainability.** Reasonable for one local TUI, poor for multiple frontends. The current state shape is view-oriented and not suitable as a shared server API.

**Suggested improvement.** Make the TUI a client adapter over application commands, queries, and events. Give it a local projection/view model. Keep PTY hosting in a process service and render only its output. Introduce explicit mount/dispose lifecycles and test renderer contracts without relying on private widget fields where possible.

### Configuration

**Current design.** Absent. Constants, ignore names, keybindings, limits, shell choices, colors, and paths are embedded in code (`src/commands/ui.js:21-24`, `src/core/fs-tree.js:6`, `src/core/keymap.js:3-20`). Environment variables are read ad hoc for shell discovery.

**Pros.** Deterministic behavior and no configuration complexity.

**Cons.** No user/workspace precedence, schema, validation, profiles, secrets, deprecation, hot reload, or diagnostics.

**Scalability and maintainability.** Low; every option becomes a code change and plugins have nowhere to declare settings.

**Suggested improvement.** Define typed configuration with defaults and precedence: built-in < user < workspace < environment < CLI. Validate once at startup, record provenance, redact secrets, and expose diagnostics. Keep behavioral policies separate from presentation preferences.

### Plugin architecture

**Current design.** Absent. The `optional()` helper in `src/commands/ui.js:28-34` is soft module loading for internal files, not a plugin system.

**Pros.** No compatibility commitments yet.

**Cons.** No manifest, API version, discovery, activation, capability declaration, isolation, lifecycle, contribution points, permission review, package signing/trust, or compatibility tests. The current helper catches every load error and silently treats a broken built-in as missing.

**Scalability and maintainability.** No readiness.

**Suggested improvement.** Create a versioned Plugin SDK over stable contracts, not internal state. Use explicit contributions for tools, commands, providers, hooks, render metadata, and MCP presets. Run untrusted plugins out of process with capability grants; at minimum isolate failures and enforce timeouts. Never expose the mutable store or renderer objects.

### Scheduler

**Current design.** Absent. PTYs run immediately. The Phase A benchmark limits its experiment to four panes but no runtime quota exists.

**Pros.** No scheduler overhead for the current single-user UI.

**Cons.** No queues, priorities, fairness, resource budgets, provider concurrency/rate-limit handling, retries, background job ownership, or recovery.

**Scalability and maintainability.** No multi-task or multi-agent production support.

**Suggested improvement.** Add a durable scheduler with per-provider, per-workspace, and global concurrency limits. Jobs need lease/heartbeat semantics, retry policy based on error class, cancellation, priority, dependency constraints, and persisted transitions. Local v1 may execute in one process, but the interface must not assume it.

### Task system

**Current design.** Absent. Terminal tabs are processes, not tasks. The work board in `docs/agents/BOARD.md` is development documentation, not runtime state.

**Pros.** No false task abstraction in code.

**Cons.** No task identity, state machine, dependency graph, ownership, inputs/outputs, progress, checkpoints, artifacts, retries, cancellation, or parent/child relationship.

**Scalability and maintainability.** No capability.

**Suggested improvement.** Model tasks as durable state machines independent of agents. A task may have subtasks and attempts; an agent run is one executor attempt, not the task itself. Make transitions explicit and idempotent, and project them to all clients.

## 3. Architecture smells ranked by severity

### Critical

1. **Product-core absence.** The repository’s executable architecture cannot satisfy the stated AI-agent goal. The v2 design is a PTY multiplexer, explicitly not an orchestrator (`SPEC-multi-agent.md:26-32`). Building more pane features first would deepen the wrong abstraction.
2. **No security or permission boundary.** File writes and arbitrary shell execution are direct calls. There is no approval, workspace containment, sandbox, audit event, or destructive-action classification. Tool calling cannot safely be added on top of this path.
3. **Lifecycle correctness is not proven and currently fails system gates.** The PTY test assertions pass but the process hangs; the end-to-end smoke test fails resize and clean exit. Whole-app shutdown, single-tab termination, widget disposal, and process-global handlers follow different paths (`src/commands/ui.js:396-401`, `src/ui/terminal-panel.js:397-514`).
4. **`runUi` is a god object/composition root.** Its 492 lines own validation, exception policy, state, widgets, rendering, layout, focus, overlays, file IO/policy, saving, terminal creation, command execution, quick-open, shutdown, input dispatch, and background indexing.
5. **Mutable shared state has no ownership enforcement.** Any module can mutate nested state. `terminal-panel.js` directly edits `state.terminals` and manually calls `emitChange` (`src/ui/terminal-panel.js:201-233`, `src/ui/terminal-panel.js:335-359`). This will become race-prone with concurrent streams/tasks.

### High

6. **Eager dependency loading violates fast startup.** `bin/wsedit.js:4-9` imports all commands before parsing. Even `ls` loads Blessed and syntax highlighting. Measured help median was ~379 ms and `require(ui)` ~287 ms.
7. **The event API is an invalidation signal, not a scalable event model.** No-payload `emitChange` forces global render work and cannot support replay, clients, auditing, or task orchestration.
8. **Blocking filesystem work occurs on the UI thread.** Directory read, file stat/sniff/read, and save are synchronous. Large or remote filesystems can freeze input.
9. **Open-ended action bags and raw state shapes are unstable APIs.** Widgets depend on optional properties and mutable object conventions. There are no compile-time types or runtime schemas.
10. **Process termination uses hidden timers and suppressed errors.** `terminatePtyAsync` swallows failures and declares completion after a timeout even if the process status was not verified (`src/ui/terminal-panel.js:397-451`). The Windows fallback constructs a shell command string rather than using argument-safe process spawning (`src/ui/terminal-panel.js:439-449`).
11. **Declared compatibility is inconsistent.** README says Node 18+, while installed Commander requires Node >=22.12 and `blessed-xterm` requires >=20.19. No `engines` field enforces either.
12. **Tests are not a usable release gate.** `npm test` fails by design; the default suite hangs; PTY tests do not assert process death despite their names; UI smoke currently fails 2 checks.

### Medium

13. **Dependency inversion violations.** Application orchestration depends directly on `fs`, Blessed, concrete widgets, and process exit. `core/language.js` depends on a presentation/highlighting package. There are no ports for filesystem, process, provider, clock, ID generation, or persistence.
14. **Duplicated policy/fixtures.** Ignore sets are duplicated; shell resolution and fake screen streams appear in core, tools, and tests; error/notification patterns are repeated.
15. **Broad exception swallowing hides defects.** The `optional()` loader converts any transitive exception into “module absent” (`src/commands/ui.js:28-34`). Several PTY cleanup catches discard all errors.
16. **Two sources of truth for terminal tabs.** Local `tabs` holds handles and shared `state.terminals.tabs` holds metadata. Manual synchronization can drift.
17. **Inconsistent widget contract.** Contracts say widgets do not call `screen.render`, but prompt and quick-open do. `setGeometry` uses `position` in some widgets and direct properties in others.
18. **Long methods and under-abstraction.** `createTerminalPanel`, `newTab`, `releaseTerminal`, and `runUi` combine domain policy with infrastructure details. Filesystem and process behavior cannot be substituted in tests.
19. **Non-deterministic IDs.** Timestamp plus randomness (`src/core/workspace-state.js:68`) is neither deterministic for tests nor collision-safe as a distributed identifier.
20. **Process-global handlers are installed without removal.** Repeated embedded invocations would accumulate handlers, and `restoreThenRethrow` does not rethrow despite its name.

### Low

21. **Version and capability metadata are duplicated or absent.** CLI version is hard-coded separately; no feature/capability negotiation exists.
22. **Historical documentation is internally stale.** `docs/agents/CHANGELOG.md:166-169` says terminal close is not fixed, while current code contains a later termination implementation. Status labels should not be architecture truth.
23. **No circular imports detected.** This is positive. There is, however, a conceptual feedback cycle: state emits change -> UI renders -> widget callbacks mutate state -> change. It is currently controlled by convention rather than an enforced unidirectional architecture.
24. **Over-abstraction is limited but present in compatibility shims.** `terminal-panel` accepts two geometry shapes and `ui.js` soft-loads built-in modules even though all files are present. These branches increase states without creating a stable extension mechanism.

## 4. Architecture scorecard

Scores reflect readiness for the requested production AI CLI, not quality relative to the repository’s narrower editor prototype.

| Dimension | Score | Explanation |
|---|---:|---|
| Architecture | 3/10 | Some UI/core separation exists, but the architecture centers on one TUI controller and has none of the requested agent platform boundaries. |
| Maintainability | 4/10 | The codebase is small and readable, but mutable shared state, god controllers, undocumented Blessed internals, inconsistent lifecycle paths, and stale status docs will degrade quickly. |
| Extensibility | 2/10 | New widgets can be added by convention, but providers, tools, MCP, plugins, and clients have no stable extension points. The actions bag is not an extensibility contract. |
| Performance | 4/10 | Lazy file indexing and terminal creation are good. Eager command loading misses the startup goal, sync filesystem operations block the loop, and the short 4-pane probe used ~58% CPU/138 MB RSS. |
| Developer Experience | 3/10 | Small CommonJS modules and Node built-in tests help, but `npm test` fails, the default suite hangs, compatibility claims conflict, there is no lint/type/build/release setup, and docs are partly historical. |
| Testing | 4/10 | There are useful pure, widget, CLI, PTY, and smoke tests. However, passing assertions do not imply process cleanup, the full gate never completes, UI smoke is red, and core future subsystems have no contract tests. |
| Plugin readiness | 1/10 | No manifest, SDK, host, isolation, capabilities, lifecycle, or compatibility strategy exists. |
| Workspace readiness | 4/10 | One rooted workspace has explorer, indexing, buffers, and terminal cwd. It lacks containment, watches, instructions, git abstraction, persistence, multi-root/multi-workspace runtime, and concurrency safety. |
| Agent readiness | 2/10 | It can host opaque external agent CLIs in PTYs. It has no structured agent loop, provider stream, tools, tasks, sessions, memory, planning, budgets, or orchestration. |

## 5. Production target architecture

### Architectural principles

1. **Headless core first.** The TUI, web dashboard, VSCode extension, and automation CLI are clients of the same application runtime.
2. **Workspace is a security and data boundary.** Paths, config, memory, sessions, tools, and permissions are explicitly scoped.
3. **Commands in, events out.** Client actions become typed application commands; durable state transitions emit versioned events.
4. **Tasks, attempts, and agents are different concepts.** Tasks express durable intent; agents are executors; attempts capture one execution history.
5. **Provider and MCP types stop at adapter boundaries.** Core contracts are vendor-neutral.
6. **All side effects use capability-aware ports.** Filesystem, processes, network, git, tools, clock, IDs, and storage are replaceable and auditable.
7. **Cancellation and budgets are mandatory inputs.** Every provider stream, tool, process, task, and background job accepts cancellation and resource limits.
8. **Events are replayable; rendering is disposable.** A UI may disconnect and reconstruct state without affecting execution.
9. **Fast paths are lazy.** CLI parsing and help do not load provider SDKs, TUI libraries, MCP servers, plugins, or PTY modules.
10. **Local-first, daemon-capable.** Start as a local single-user runtime with interfaces that allow a persistent local daemon and multiple clients later.

### Logical component model

    CLI / TUI / Web / VSCode
             |
      Client protocol (commands, queries, event subscriptions)
             |
       Application services / Runtime facade
        |        |         |         |
    Workspace  Sessions   Tasks   Agent runtime
        |        |         |         |
       Git     Event log Scheduler  Context + provider
        |                  |         |
    Filesystem         Tool executor + permissions
                               |
                   Native tools / MCP / plugins

Cross-cutting components are configuration, secrets, logging/telemetry, IDs, cancellation, quotas, and schema/version management.

### Core runtime boundaries

- **Runtime host:** owns startup/shutdown and registries; does not contain business logic.
- **Workspace service:** canonicalizes roots, enforces containment, loads instructions/config, owns file/index/git services, and publishes workspace events.
- **Session service:** persists messages, run metadata, events, summaries, checkpoints, and artifacts.
- **Task service:** owns task DAGs and state transitions.
- **Scheduler:** leases runnable attempts under concurrency, rate, and budget constraints.
- **Agent runtime:** assembles context, calls a provider, interprets normalized stream events, requests tool execution, and terminates deterministically.
- **Tool executor:** validates schemas, evaluates policy, requests approval, applies sandbox/capability restrictions, executes, limits output, and records results.
- **Provider registry/router:** selects providers/models by capabilities, policy, availability, latency, and budget.
- **MCP manager:** manages protocol connections and contributes namespaced tools/resources/prompts through internal registries.
- **Plugin host:** discovers manifests, checks API versions and grants, activates contributions, isolates failures, and supports unload.
- **Event store/bus:** persists domain events and fans them out to projections and clients.
- **Client adapters:** keep only view state and interaction logic. They do not own agent or task execution.

### Multiple workspaces, agents, and tasks

Each open workspace has a stable identity and owned resources. Sessions reference one primary workspace plus explicit additional roots. Tasks belong to a session and form a DAG. The scheduler may run multiple attempts across workspaces, but it enforces per-workspace write serialization unless tasks use isolated worktrees. Agents receive immutable workspace snapshots plus capability grants; they do not share mutable prompt state.

Multi-agent execution should use explicit coordination primitives:

- parent/child task relationships;
- declared read/write scopes;
- worktree or sandbox isolation for writers;
- artifact/result handoff through the task store;
- bounded fan-out and recursion;
- a merge/integration task with conflict reporting;
- cancellation propagation from parent to children;
- per-agent and aggregate token/cost/time budgets.

PTY panes may visualize external processes, but they remain `TerminalProcess` resources, not `AgentRun` records unless an adapter can provide a versioned structured protocol.

### Background jobs

Background work must survive UI disconnects. A local daemon becomes the owner of provider streams, PTYs, tasks, MCP connections, and plugins. Clients connect over a versioned local IPC protocol, request commands, query projections, and subscribe from an event sequence. Jobs use leases and heartbeats so a crash can mark attempts interrupted and make safe work resumable. Side-effecting tools are never blindly replayed.

### Web dashboard and VSCode extension

Both clients use the same protocol as the TUI:

- command endpoint for user intent;
- query endpoint for workspace/session/task projections;
- ordered event stream with resume cursor;
- artifact/file APIs with workspace authorization;
- approval channel for pending tool actions.

The web UI should not import core packages or access the filesystem. The VSCode extension may contribute an editor-aware client adapter, but file mutations still go through the runtime so permissions, patches, sessions, and events remain consistent.

### Data and consistency model

- SQLite is the recommended local store for sessions, tasks, attempts, approvals, event envelopes, checkpoints, usage, and plugin state.
- Large tool outputs and artifacts live in a content-addressed artifact store referenced by hash.
- Event append and projection updates use transactions where consistency matters.
- Every event carries schema version, sequence, timestamp, workspace/session/task/run correlation IDs, and causal parent where applicable.
- Sensitive values are redacted before persistence and logging.
- Checkpoints record logical state and file/git references; they do not serialize live process handles.

### Deployment evolution

For early phases, all services can run in one Node process behind interfaces. Before adding web/VSCode clients and durable background tasks, introduce a local daemon boundary. Production scale here means controlled concurrency and reliable local durability first, not premature distributed microservices. The same contracts can later support worker processes for plugin isolation, CPU-heavy indexing, or parallel tool execution.

## Decision summary

Do not extend `workspace-state.js` into the global state of an AI platform, and do not turn `terminal-panel.js` into the agent layer. Preserve the current editor/TUI as an adapter, then build a headless runtime with explicit workspace, session, task, agent, tool, provider, MCP, event, and scheduler boundaries. The first implementation milestone must stabilize lifecycle and test gates while introducing contracts—not add more panes or UI features.
