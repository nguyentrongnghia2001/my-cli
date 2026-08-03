# Architecture TODO

This is the executable backlog derived from the audit. Items are ordered by dependency and risk, not by UI visibility. Each checkbox requires tests and documentation appropriate to its scope.

## Critical — release and safety blockers

### Establish truth and ownership

- [ ] Replace the placeholder `npm test` script in `package.json:10` with the canonical test gate.
- [ ] Split test commands into unit, integration, PTY, smoke, and full suites with explicit platform requirements.
- [ ] Fix `test/terminal-lifecycle.test.js` so the process exits and verify that every spawned PTY child is dead.
- [ ] Diagnose and fix the current `tools/ui-smoke.js` failures for terminal resize and Ctrl+Q clean exit.
- [ ] Add a deterministic shutdown coordinator with registered resources and bounded disposal.
- [ ] Define one owner for process-global exception, rejection, signal, and exit handling.
- [ ] Remove application-level direct `process.exit` calls; return outcomes to the bootstrap.
- [ ] Enforce the actual Node engine range and reconcile it with `commander@15` and `blessed-xterm@1.6` requirements.
- [ ] Add CI on supported Windows and Unix targets, including orphan-process checks.
- [ ] Convert historical “done” labels into evidence-linked status or archive them so they cannot override current test results.

### Set the product architecture

- [ ] Approve ADR: current TUI is a client adapter, not the core runtime.
- [ ] Approve ADR: native structured agent runtime versus external PTY process supervision.
- [ ] Approve ADR: local SQLite event/session store and migration policy.
- [ ] Approve ADR: command/query/event client protocol and future daemon boundary.
- [ ] Approve ADR: workspace is the security/config/data boundary.
- [ ] Approve ADR: task, attempt, model run, and terminal process are separate entities.
- [ ] Define v1 non-goals to prevent recreating a full IDE before the agent core.

### Security boundary

- [ ] Define workspace path containment including symlinks, junctions, UNC paths, case normalization, and allowed extra roots.
- [ ] Prevent reads and writes outside approved roots by default.
- [ ] Define capability classes: read, workspace-write, process, network, credential, external-write, destructive.
- [ ] Define approval decisions, scope, expiry, provenance, and denial behavior.
- [ ] Route agent side effects through one permissioned tool executor.
- [ ] Add audit events for every permission decision and side effect.
- [ ] Define secret storage/redaction and prevent secrets from entering logs, events, prompts, and artifacts unintentionally.
- [ ] Replace shell-string process fallbacks such as `taskkill` construction in `src/ui/terminal-panel.js:443` with argument-safe process invocation.

## High — core platform prerequisites

### Startup and CLI

- [ ] Lazy-load command modules after command selection in `bin/wsedit.js`.
- [ ] Ensure help/version do not load Blessed, PTY, syntax highlighting, providers, MCP, or plugins.
- [ ] Read the package version from one source.
- [ ] Add startup benchmarks with p50/p95 budgets for help, `ls`, interactive shell, and first model event.
- [ ] Add non-interactive mode with JSON/JSONL output and stable exit codes.
- [ ] Separate CLI parsing/formatting from application command execution.
- [ ] Add `doctor` diagnostics for versions, config, credentials, storage, PTY, MCP, and plugin health.

### Typed contracts

- [ ] Adopt strict TypeScript for new packages and define a migration rule for existing CommonJS files.
- [ ] Define branded IDs for workspace, session, task, attempt, agent run, tool call, approval, artifact, and event.
- [ ] Define versioned command, query, event, and error envelopes.
- [ ] Define cancellation and deadline conventions based on `AbortSignal`.
- [ ] Define runtime schema validation at external boundaries.
- [ ] Define stable error categories and retryability; stop relying on localized message text for control flow.
- [ ] Add compatibility/conformance tests for public contracts.

### Workspace service

- [ ] Extract a headless workspace lifecycle service from `src/commands/ui.js` and `workspace-state.js`.
- [ ] Separate editor/TUI view state from workspace domain state.
- [ ] Centralize ignore rules and support standard ignore sources.
- [ ] Replace synchronous directory/file operations on interactive paths with asynchronous services.
- [ ] Add file watch events with debounce, rename handling, and overflow recovery.
- [ ] Add content/version fingerprints to detect concurrent changes before writes.
- [ ] Add workspace instruction discovery with explicit precedence and provenance.
- [ ] Add workspace-scoped configuration and diagnostics.
- [ ] Add repository metadata and Git adapter without shell-output parsing in domain code.
- [ ] Add multi-workspace manager with resource limits, but only after process lifecycle is green.

### Events and persistence

- [ ] Replace no-payload `emitChange` with typed domain events and separate UI invalidation.
- [ ] Add event sequence, timestamp, schema version, actor, source, correlation, and causation IDs.
- [ ] Persist durable events transactionally.
- [ ] Add projections for session, task, usage, approval, and client view state.
- [ ] Add event replay and resumable subscription cursor.
- [ ] Isolate subscriber failures and define slow-consumer/backpressure behavior.
- [ ] Add SQLite migrations, backup, restore, integrity check, and repair guidance.
- [ ] Add content-addressed artifact storage for large outputs.

### Provider and streaming core

- [ ] Define provider capability metadata and normalized request types.
- [ ] Define normalized semantic stream events and ordering rules.
- [ ] Implement provider cancellation, timeout, rate-limit, and retry handling.
- [ ] Track provider-reported usage separately from estimated tokens/cost.
- [ ] Build one provider adapter and a fake provider before adding a second vendor.
- [ ] Add recorded-stream conformance fixtures for partial text, tool calls, malformed chunks, disconnects, and cancellation.
- [ ] Add model metadata cache and explicit refresh policy.
- [ ] Implement context budgeting before adding automatic long-context features.

### Tool and patch pipeline

- [ ] Define tool descriptors with versioned schema, capabilities, timeouts, concurrency, and output limits.
- [ ] Build tool input/output validation and normalized results.
- [ ] Build permission evaluation and approval workflow.
- [ ] Persist tool proposal, approval, start, result, error, timeout, and cancellation events.
- [ ] Add read/list/search tools with workspace containment.
- [ ] Add a non-interactive command tool distinct from PTY terminals.
- [ ] Build a patch parser and validation model.
- [ ] Add path traversal, symlink, stale-hunk, binary, EOL, atomic-write, partial-failure, and rollback tests.
- [ ] Add patch preview and user approval projection for all clients.
- [ ] Add Git status/diff/worktree/checkpoint operations with dirty-state safeguards.

## Medium — agent execution and extensibility

### Sessions, context, and memory

- [ ] Define durable session metadata, messages, runs, usage, artifacts, and retention.
- [ ] Implement session list, inspect, resume, rename, archive, export, and delete.
- [ ] Ensure resume never automatically replays committed side effects.
- [ ] Build context assembly with source provenance and deterministic ordering.
- [ ] Add context compression thresholds, summary versioning, and raw-history retention policy.
- [ ] Add scoped memory for run, session, workspace, and user.
- [ ] Require provenance and deletion controls for persisted memory.
- [ ] Add retrieval quality and cross-workspace isolation tests.

### Task, planner, and executor

- [ ] Define task and attempt state machines with legal transitions.
- [ ] Add parent/child task DAG and dependency readiness.
- [ ] Add planner output as an inspectable, revisable artifact.
- [ ] Add executor loop with maximum turns and loop detection.
- [ ] Add progress events based on transitions, not output activity heuristics.
- [ ] Add checkpoint semantics for logical state and Git/file references.
- [ ] Propagate cancellation from session/task to descendants, provider streams, tools, and processes.
- [ ] Add idempotency keys and committed-result semantics around side effects.
- [ ] Add token, cost, time, turn, tool-call, and child-task budgets.

### Scheduler and background jobs

- [ ] Define durable job/lease/heartbeat model.
- [ ] Add global, per-workspace, per-provider, and per-tool concurrency limits.
- [ ] Add priority and fairness across sessions.
- [ ] Add error-class-based retry policy and dead-letter diagnostics.
- [ ] Add attach/detach and background job listing.
- [ ] Add resource accounting for memory, CPU, process count, tokens, and artifact size.
- [ ] Add daemon ownership before allowing jobs to outlive the CLI/TUI.
- [ ] Stress cancellation and restart with multiple workspaces and agent children.

### MCP

- [ ] Define MCP configuration schema and scope.
- [ ] Implement lifecycle and health for supported transports.
- [ ] Implement initialization and capability negotiation.
- [ ] Namespace MCP tools/resources/prompts and convert them into internal descriptors.
- [ ] Route MCP tools through normal validation, permission, approval, timeout, audit, and cancellation.
- [ ] Add authentication and secret redaction.
- [ ] Bound reconnects and output sizes; expose failures as diagnostics.
- [ ] Add protocol conformance and malicious-server tests.

### Plugin SDK

- [ ] Define plugin manifest, API versioning, engine compatibility, and settings schema.
- [ ] Define contribution points for tools, providers, commands, context sources, hooks, and client metadata.
- [ ] Define requested capabilities and user grants.
- [ ] Implement discovery, activation, deactivation, upgrade, and failure isolation.
- [ ] Keep mutable runtime state and renderer instances out of public APIs.
- [ ] Add plugin timeouts and out-of-process host plan for untrusted plugins.
- [ ] Record active plugin versions in sessions for provenance.
- [ ] Publish example plugin and compatibility test kit.

## Low — surfaces and operational maturity

### TUI modernization

- [ ] Move TUI to runtime commands, queries, and projections.
- [ ] Give overlays explicit stack/lifecycle semantics rather than shared focus flags.
- [ ] Remove direct `screen.render()` calls from widgets or revise and enforce the renderer contract.
- [ ] Remove reliance on private Blessed/`blessed-xterm` fields where feasible.
- [ ] Add accessible keybinding configuration and conflict diagnostics.
- [ ] Keep legacy editor improvements subordinate to agent workflow priorities.

### Local daemon and protocol

- [ ] Define versioned authenticated local IPC.
- [ ] Add command, query, artifact, approval, and event subscription endpoints.
- [ ] Support reconnect from event sequence.
- [ ] Add one-version compatibility and graceful daemon upgrade.
- [ ] Ensure daemon shutdown reports active jobs and follows explicit policy.

### Web dashboard

- [ ] Implement session/task/run projections without filesystem access.
- [ ] Add stream, approval, artifact, diff, usage, and diagnostics views.
- [ ] Add local authentication, CSRF/origin controls, and safe content rendering.
- [ ] Test slow/reconnecting clients and large event histories.

### VSCode extension

- [ ] Integrate workspace trust and runtime attach.
- [ ] Add task/session explorer, streaming output, approvals, diff review, and context selection.
- [ ] Support remote/WSL/container environments through the same protocol.
- [ ] Avoid bypassing runtime patch and permission paths with direct editor writes.

### Release engineering

- [ ] Add formatting, lint, typecheck, package build, and public API checks.
- [ ] Add dependency update and vulnerability policy, especially for native/beta PTY dependencies.
- [ ] Add SBOM, licenses, package provenance, and release signing strategy.
- [ ] Add storage migration, downgrade/rollback, and backup tests.
- [ ] Add fault injection for provider, MCP, plugin, disk, database, and process failures.
- [ ] Add opt-in/redacted telemetry and local performance diagnostics.
- [ ] Publish supported limits for files, workspaces, agents, tasks, tokens, output, and plugins.

## Explicitly deferred until after v1.0 unless product requirements change

- [ ] Distributed multi-machine worker execution.
- [ ] Shared multi-user collaboration and cloud account synchronization.
- [ ] General IDE replacement features such as full LSP/debugger ecosystem.
- [ ] Arbitrary untrusted in-process plugins.
- [ ] Automatic merge-conflict resolution without an explicit integration task and review.
