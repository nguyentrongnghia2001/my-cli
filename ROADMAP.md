# Roadmap to v1.0

## Roadmap assumptions

This roadmap treats the current repository as a TUI/editor prototype and preserves it as a client adapter. It does not treat PTY tabs as agents or the mutable workspace UI state as the future domain model.

Complexity estimates are engineering effort ranges, not calendar commitments. They assume one senior engineer familiar with Node.js and AI-agent runtimes; parallel work can reduce elapsed time only after contracts are stable. The overall path is approximately 32-48 engineer-weeks, excluding extensive vendor certification and third-party security review.

### Release principles

- Every phase has an executable acceptance gate.
- Schema, event, provider, tool, and plugin contracts are versioned before external use.
- New features do not bypass workspace containment, permissions, cancellation, or persistence.
- The existing `view`, `ls`, `edit`, and `ui` commands remain usable during migration or are explicitly deprecated with a compatibility window.
- The web dashboard and VSCode extension are clients, not alternate runtimes.

## Phase 0 — Establish a trustworthy baseline (v0.1)

**Goals**

- Make the repository’s build, test, runtime, and compatibility claims truthful.
- Stabilize process lifecycle before adding long-running agent jobs.
- Capture architectural decisions and measurable budgets.

**Features**

- One supported Node version range enforced through `package.json` and CI.
- Working `npm test` command with separate unit, integration, PTY, and smoke gates.
- Startup benchmark for help, non-TUI commands, interactive startup, and first token/event.
- Structured diagnostic command reporting platform, dependency, PTY, config, and storage readiness.

**Refactors**

- Lazy-load command handlers after Commander selects a command; do not load Blessed or `cli-highlight` for help/`ls`.
- Replace direct `process.exit` calls inside handlers with returned results and a single top-level lifecycle owner.
- Make terminal panel mount/dispose/terminate semantics explicit and fix the hanging PTY test plus current 12/14 UI smoke result.
- Remove soft-loading of present built-in widgets; reserve dynamic loading for real extension boundaries.
- Centralize shell discovery, ignore rules, fake terminal fixtures, clocks, and ID generation.

**Risks**

- ConPTY behavior differs across Windows versions and Node releases.
- Fixing whole-app shutdown may regress the measured “host exit cleans children” behavior documented in `docs/agents/PHASE0.md`.
- Lazy imports may expose hidden module initialization assumptions.

**Estimated complexity**

- High: 2-3 engineer-weeks.

**Exit criteria**

- `npm test` exits 0 and leaves no processes.
- PTY lifecycle tests assert actual process death, not only state-array changes.
- `tools/ui-smoke.js` passes 14/14 three consecutive times on supported Windows and at least one Unix platform.
- Help and simple commands meet an agreed startup budget; target p50 <150 ms and p95 <250 ms on the reference machine.
- No source feature changes beyond lifecycle, loading, and testability.

## Phase 1 — Headless core contracts and workspace boundary (v0.2)

**Goals**

- Create a reusable runtime independent of Blessed and CLI process globals.
- Make workspace a security, configuration, and data boundary.
- Establish typed commands, events, errors, IDs, and cancellation.

**Features**

- Stable IDs for workspace, session, task, attempt, run, tool call, and event.
- Typed runtime facade supporting commands, queries, and event subscriptions.
- Workspace discovery/open/close with canonical root containment and symlink policy.
- Layered configuration: defaults, user, workspace, environment, CLI.
- Workspace instruction discovery and ignore policy.
- File watcher and asynchronous index/search service.

**Refactors**

- Introduce TypeScript for new runtime packages with strict mode and generated public declarations.
- Split view/editor state from domain workspace state; freeze or encapsulate domain state mutations.
- Move filesystem and process access behind ports with production and in-memory test adapters.
- Replace `emitChange()` with typed local events and view projections.
- Convert the existing TUI into a client of the runtime facade while retaining current behavior.

**Risks**

- A broad rewrite would stall delivery; use a strangler migration around current commands.
- Windows path casing, UNC paths, junctions, and symlinks can break naïve containment checks.
- File watchers behave differently across platforms and large repositories.

**Estimated complexity**

- Very high: 4-6 engineer-weeks.

**Exit criteria**

- Core packages import no Blessed, Commander, `node-pty`, vendor SDK, or process-global UI object.
- Workspace escape attempts are rejected in tests, including symlink/junction cases.
- TUI and a headless test client execute the same workspace commands and observe the same typed events.
- Configuration diagnostics show value provenance and validation errors.

## Phase 2 — Providers, streaming, tokens, and durable sessions (v0.3)

**Goals**

- Produce structured model runs with normalized streaming.
- Persist sessions and resume without replaying side effects.
- Make token/cost/context budgets first-class.

**Features**

- Provider interface with capability discovery, normalized errors, authentication, retry hints, usage, and cancellation.
- At least two provider adapters to prove abstraction quality.
- Ordered semantic events for run lifecycle, text/reasoning deltas, tool-call deltas, usage, warnings, completion, failure, and cancellation.
- SQLite event/session store with migrations, snapshots, transcript, artifacts, and resume.
- Token estimator, context budget, usage ledger, model metadata, and cost policy.
- Context assembly with system/workspace instructions, history, selected files, and provenance.

**Refactors**

- Separate provider DTOs from domain messages and stream events.
- Build render projections so the TUI consumes events instead of provider/PTY output directly.
- Add `AbortSignal` propagation through provider calls and session run lifecycle.
- Create recorded-stream conformance tests for every provider adapter.

**Risks**

- Provider APIs differ in tool-call streaming, reasoning content, usage timing, and cancellation semantics.
- Persisting sensitive prompts/tool outputs requires redaction and retention policy.
- Token estimators can diverge from billed usage.

**Estimated complexity**

- Very high: 4-6 engineer-weeks.

**Exit criteria**

- A session can stream a response, be interrupted, restart the CLI, and resume its durable history.
- Events are ordered, versioned, replayable, and identical across TUI and headless clients.
- Provider adapter contract tests pass against recorded success, tool-call, rate-limit, malformed-stream, and cancellation cases.
- Usage totals reconcile with provider-reported values when available.

## Phase 3 — Permissioned tools, patch engine, and Git (v0.4)

**Goals**

- Make the system useful for coding while keeping every side effect governed and auditable.
- Provide safe, reviewable file edits and repository operations.

**Features**

- Versioned tool registry with JSON-schema inputs/outputs and capability metadata.
- Permission engine with read, workspace-write, process, network, credential, and destructive classes.
- Approval UX with once, session, workspace-policy, deny, and timeout decisions.
- Tool executor with validation, cancellation, timeout, output limits, audit events, and concurrency controls.
- Core tools for file read/list/search, safe command execution, patch apply, and diagnostics.
- Patch engine with unified diff parsing, path containment, expected-content checks, atomic writes, EOL preservation, conflict reporting, preview, and rollback strategy.
- Git adapter for status, diff, branch/worktree operations, checkpoint references, and dirty-worktree safeguards.

**Refactors**

- Route existing file saves and shell launches through infrastructure ports; agent-initiated actions must use tools.
- Remove direct `fs` and process execution from application controllers.
- Store large outputs as bounded artifacts and feed summarized observations back to the agent.
- Separate terminal processes from non-interactive command tools.

**Risks**

- Shell sandboxing is platform-specific; permission prompts alone are not containment.
- Patch application must handle concurrent user edits and mixed EOL safely.
- Git worktrees introduce cleanup and disk-consumption risks.

**Estimated complexity**

- Very high: 5-7 engineer-weeks.

**Exit criteria**

- No agent-originated side effect can bypass policy, approval, event logging, timeout, and cancellation.
- Patch tests cover traversal, symlink escape, stale hunks, binary files, EOL, partial failure, and concurrent change.
- Git integration never commits, resets, pushes, or rewrites history without explicit action and policy.
- Every tool invocation is reconstructable from the session event log.

## Phase 4 — Agent loop, planner/executor, and task system (v0.5)

**Goals**

- Implement the first complete coding-agent loop.
- Separate durable task intent from execution attempts and model runs.
- Support reliable cancellation, checkpoints, and bounded retries.

**Features**

- Agent state machine: created, preparing, streaming, awaiting approval, executing tool, observing, completing, failed, cancelled.
- Task state machine with parent/child DAG, dependencies, priority, owner, artifacts, progress, attempts, and terminal states.
- Planner producing an inspectable plan; executor scheduling ready steps and reporting results.
- Iterative model/tool loop with maximum turns, token/cost/time budgets, tool-result compaction, and loop detection.
- Cooperative cancellation across task, agent, provider, tool, child process, and stream.
- Logical checkpoints tied to session event sequence and Git/file snapshot metadata.
- Non-interactive CLI mode with deterministic exit codes and machine-readable event output.

**Refactors**

- Replace the `actions` service-locator pattern with explicit application command handlers.
- Make transitions transactional and idempotent.
- Move prompt/context policy into dedicated context and agent services.
- Treat external agent PTYs as optional supervised processes, not native agent attempts.

**Risks**

- Planner/executor separation can become over-engineered; begin with one planner and a small task state machine.
- Model loops can generate runaway cost or repeated side effects.
- Cancellation races around completed tools require clear “committed result” semantics.

**Estimated complexity**

- Very high: 5-7 engineer-weeks.

**Exit criteria**

- A coding task can inspect, plan, request approval, apply a patch, run tests, and produce a durable final result.
- Killing a client does not corrupt the task; cancelling a task stops all descendants and emits one terminal outcome.
- Restart recovery marks interrupted attempts correctly and never repeats a committed side effect automatically.
- Budget and maximum-turn violations terminate predictably.

## Phase 5 — MCP and Plugin SDK (v0.6)

**Goals**

- Add controlled extensibility without exposing internal state.
- Make MCP and native plugins use the same permission and audit paths.

**Features**

- MCP client manager with stdio and streamable HTTP transports as supported, initialization, capability negotiation, health, reconnect, cancellation, logging, and authentication hooks.
- MCP tools/resources/prompts namespaced into internal registries.
- Plugin manifest with API version, engine range, entrypoints, contributions, requested capabilities, settings schema, and activation events.
- Plugin SDK for tools, commands, providers, context sources, hooks, and client metadata.
- Plugin host lifecycle, timeouts, failure isolation, diagnostics, and compatibility checks.
- Trust/install policy and explicit capability grants.

**Refactors**

- Convert built-in tools and providers to the same public contribution contracts where practical.
- Add registry snapshots so a session records which plugin/tool versions influenced it.
- Keep renderer-specific extension points separate from headless runtime contributions.

**Risks**

- In-process plugins can crash or compromise the host; out-of-process hosting adds IPC complexity.
- MCP servers can expose powerful tools with misleading schemas or unbounded outputs.
- Early SDK instability creates long-term compatibility cost.

**Estimated complexity**

- Very high: 4-6 engineer-weeks.

**Exit criteria**

- An example plugin and an MCP server can contribute equivalent tools and receive identical permission/audit treatment.
- A crashing or hanging plugin/server does not terminate active sessions.
- API compatibility and manifest validation tests cover current and unsupported versions.
- Removing a plugin leaves historical sessions readable.

## Phase 6 — Multi-agent scheduler and background execution (v0.7)

**Goals**

- Run multiple tasks and agents concurrently with bounded resources.
- Allow execution to continue when no UI is attached.
- Isolate concurrent writers.

**Features**

- Durable job scheduler with priority, dependency readiness, per-workspace/provider/global concurrency, leases, heartbeats, retries, and dead-letter diagnostics.
- Parent agent delegation with maximum depth/fan-out and inherited budgets/permissions.
- Worktree/sandbox allocation for writing agents; shared mode only for read-only tasks by policy.
- Background job list, attach/detach, pause where semantically safe, cancel, and notifications.
- Model router using capability, policy, context size, cost ceiling, availability, and fallback rules.
- Fairness and rate-limit coordination across sessions.

**Refactors**

- Move long-lived ownership from CLI/TUI process to a local daemon.
- Introduce versioned local IPC for commands, queries, approvals, artifacts, and resumable event subscriptions.
- Make PTY, provider, MCP, and plugin resources daemon-owned.

**Risks**

- Worktree cleanup and merge conflicts can lose user trust if lifecycle is opaque.
- Concurrent tasks can contend for tokens, rate limits, CPU, memory, and repository locks.
- Daemon upgrades require protocol and schema compatibility.

**Estimated complexity**

- Very high: 5-7 engineer-weeks.

**Exit criteria**

- Multiple clients can observe the same jobs without owning them.
- Two writing agents operate in isolated worktrees and return integration artifacts without overwriting each other.
- Scheduler recovery after daemon restart preserves exactly one logical attempt outcome and flags ambiguous external side effects.
- Resource ceilings are enforced under stress and cancellation leaves no orphan process.

## Phase 7 — Multi-client surfaces and ecosystem hardening (v0.8)

**Goals**

- Prove that the headless runtime supports TUI, web, and VSCode without duplicated business logic.
- Complete operational and developer experience needed for a public beta.

**Features**

- Reworked TUI using runtime projections and approval/event APIs.
- Local web dashboard for workspaces, sessions, tasks, streams, approvals, usage, and artifacts.
- VSCode extension for workspace attach, task/session views, diff/patch review, approvals, and editor context selection.
- Authentication for local clients, origin/CSRF protection for web, and scoped IPC authorization.
- Export/import, diagnostics bundle, log redaction, update checks, and migration tooling.
- Public plugin/MCP documentation and compatibility matrix.

**Refactors**

- Extract shared client protocol types and generated clients.
- Remove remaining UI-specific decisions from runtime packages.
- Make projections incremental so clients do not reload entire session state per event.

**Risks**

- Multiple surfaces can cause feature drift if one bypasses the common protocol.
- Local web serving expands attack surface.
- VSCode workspace trust and remote-development modes add security variants.

**Estimated complexity**

- Very high: 5-8 engineer-weeks, with frontend work parallelizable after protocol freeze.

**Exit criteria**

- The same active task can be started in CLI, observed in web, approved in VSCode, and resumed in TUI.
- No client package imports runtime internals or accesses session storage directly.
- Protocol compatibility tests cover one-version rolling upgrade.
- Security review finds no cross-workspace data or permission leakage.

## Phase 8 — v1.0 release hardening

**Goals**

- Turn the beta architecture into a supportable production release.
- Freeze public contracts deliberately and publish operating limits.

**Features**

- Release channels, signed artifacts where applicable, SBOM, dependency policy, and vulnerability response process.
- Migration, backup, restore, repair, and safe-mode flows.
- Telemetry that is opt-in or clearly controlled, redacted, and documented.
- Performance dashboards for startup, first token, stream latency, tool latency, indexing, memory, and scheduler queueing.
- Failure-injection and soak tests for provider disconnects, MCP crashes, plugin hangs, daemon restarts, disk full, corrupted storage, and process trees.
- Compatibility matrices for OS, terminals, Node, providers, MCP transports, web browsers, and VSCode.

**Refactors**

- Remove deprecated internal compatibility shims and undocumented APIs.
- Freeze Plugin SDK v1, event schema v1, client protocol v1, and storage migration policy.
- Review every `catch` for observable error classification and every side effect for permission/audit coverage.

**Risks**

- Public API freeze before sufficient ecosystem feedback.
- Provider behavior changes during release stabilization.
- Native PTY and platform-specific sandbox differences remain operational risks.

**Estimated complexity**

- High: 3-5 engineer-weeks plus external review time.

**v1.0 acceptance criteria**

- Fast startup budgets are met on supported platforms.
- Sessions, tasks, approvals, checkpoints, and events recover after forced termination without duplicate side effects.
- Multi-workspace and multi-agent stress tests meet documented concurrency and resource limits.
- Provider, MCP, plugin, web, VSCode, and TUI contract suites are green.
- No critical/high security findings remain; destructive actions always require explicit applicable policy.
- Upgrade and rollback are tested from every supported pre-1.0 schema.

## What not to schedule before the foundations

- Do not implement split-pane multi-agent UI before structured tasks, lifecycle correctness, and writer isolation.
- Do not expose `workspace-state` or the current `actions` object as a plugin API.
- Do not add multiple provider SDKs before defining normalized provider and stream contracts.
- Do not build web or VSCode business logic separately from the headless runtime.
- Do not persist live PTY handles or auto-restart paid agent runs during session resume.
- Do not call a PTY process an agent unless it supplies structured, versioned state and tool semantics.
