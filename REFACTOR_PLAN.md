# Ordered Refactor Plan

## Strategy

Use a strangler refactor. Preserve the current commands and TUI while introducing a headless runtime beside them. Move one behavior at a time behind explicit ports, prove parity, then remove the old path. A big-bang rewrite would erase the few behaviors already tested and make PTY regressions much harder to isolate.

The sequence below is intentionally different from the existing v2 pane roadmap in `docs/agents/BOARD.md:75-86`. More panes, worktrees, and workspace bars should not precede lifecycle correctness, structured tasks, permissioned tools, and a durable runtime.

## Critical priority

### 1. Repair the verification and lifecycle baseline

**Why first**

The default suite never terminates, `npm test` fails by definition, and the current end-to-end smoke gate is 12/14. A long-running agent architecture cannot be built on unverified process ownership.

**Current files**

- `package.json:9-11`
- `test/terminal-lifecycle.test.js:43-98`
- `src/ui/terminal-panel.js:362-514`
- `src/commands/ui.js:68-76`, `src/commands/ui.js:376-401`
- `tools/ui-smoke.js:109-150`

**Ordered changes**

1. Inventory every resource created by `runUi`: process handlers, screen listeners, state listeners, timers, widgets, PTYs, and child processes.
2. Define a shutdown coordinator that disposes registered resources once, in reverse ownership order, with a deadline.
3. Give `createTerminalPanel` one explicit lifecycle contract for whole-panel disposal and individual-tab termination.
4. Make tests capture real child PIDs or robust process markers and assert death.
5. Ensure test cleanup runs in `finally`/test hooks and does not rely on host `process.exit`.
6. Diagnose the resize failure with raw error/exit capture; do not suppress teardown failures during tests.
7. Wire package scripts and CI only after the underlying suite exits cleanly.

**Acceptance**

- Full test command exits 0 without timeout or orphan processes.
- UI smoke is 14/14 across repeated runs.
- Shutdown is idempotent and observable; teardown errors are reported but do not strand the terminal.

### 2. Establish the target boundaries with ADRs and contracts

**Why**

The current specifications design an editor and PTY supervisor, while the requested product is a structured AI agent. Without an explicit boundary decision, implementation will continue to use terminal tabs as agents and view state as domain state.

**Current files**

- `SPEC.md`
- `SPEC-multi-agent.md:26-32`, `SPEC-multi-agent.md:91-106`
- `docs/agents/CONTRACTS.md`
- `src/core/workspace-state.js`

**Ordered changes**

1. Record domain definitions for workspace, session, task, attempt, agent run, terminal process, tool call, approval, checkpoint, and artifact.
2. Record the dependency rule: clients depend on application contracts; application depends on domain and ports; infrastructure implements ports.
3. Define versioned command/query/event envelopes and cancellation semantics.
4. Mark the existing widget factory contract as TUI-internal, not a plugin or runtime API.
5. Define supported Node/platform matrix based on actual package engines.

**Acceptance**

- Every roadmap feature maps to an owning component and stable boundary.
- No public contract exposes Blessed objects, PTY handles, raw provider SDK types, or the mutable workspace state shape.

### 3. Create a single safe side-effect path

**Why**

Direct `fs` and process operations are acceptable in a file editor prototype but unsafe once model output can invoke them. Permission and audit cannot be retrofitted reliably after many tool implementations exist.

**Current files**

- `src/commands/ui.js:247-285`
- `src/commands/view.js:10-31`
- `src/commands/ls.js:10-30`
- `src/core/fs-tree.js:13-39`
- `src/ui/terminal-panel.js:296-451`

**Ordered changes**

1. Introduce filesystem, process, clock, ID, and storage ports.
2. Implement workspace root canonicalization and containment in the filesystem adapter.
3. Move shell command execution out of the terminal widget into a process service; keep PTY rendering as an adapter.
4. Define tool descriptors and a tool execution pipeline before exposing tools to models.
5. Add permission classification, approval, deadline, cancellation, output limiting, and audit hooks.
6. Migrate existing file and command actions through application services without yet making them model-callable.

**Acceptance**

- Application controllers and widgets perform no direct agent-reachable filesystem/process side effects.
- Traversal and symlink/junction escape tests are green.
- Every side effect has an actor, workspace, correlation ID, permission decision, and result event.

### 4. Stop using UI state as the domain model

**Why**

`workspace-state.js` mixes editor tabs, focus, tree nodes, and terminal metadata. Extending this object for sessions, tasks, agents, and clients would create a global mutable god store and race conditions.

**Current files**

- `src/core/workspace-state.js:5-137`
- `src/commands/ui.js:78-175`
- `src/ui/terminal-panel.js:195-233`, `src/ui/terminal-panel.js:335-359`

**Ordered changes**

1. Rename/constrain the current object as a TUI view model.
2. Create encapsulated headless services for workspace lifecycle and application state.
3. Replace hidden `_listeners` and no-payload `emitChange` with typed events.
4. Build TUI projections from events; local focus/scroll/tab layout remains client state.
5. Remove terminal metadata dual ownership by making the process service authoritative and projecting metadata to the TUI.

**Acceptance**

- Domain state cannot be mutated directly by widgets.
- A headless client and TUI observe identical workspace/process events.
- Rendering cannot cause domain transitions.

## High priority

### 5. Make startup lazy and commands embeddable

**Why**

`bin/wsedit.js:4-9` eagerly imports all commands. Local medians around 379 ms for help and 377 ms for `ls` miss the existing `<300 ms` objective and will worsen dramatically when provider and plugin SDKs are added.

**Ordered changes**

1. Keep only minimal CLI parsing and version metadata on the help path.
2. Lazy-load the selected command adapter.
3. Split `view` highlighting from workspace/TUI dependencies.
4. Replace handler-level `process.exit` with typed outcomes.
5. Add p50/p95 startup benchmarks to CI with controlled regression thresholds.

**Acceptance**

- Help and `ls` do not load Blessed, PTY, model, MCP, or plugin modules.
- Command handlers can be invoked in-process without terminating the test runner.

### 6. Decompose `runUi` along application seams

**Why**

`src/commands/ui.js` is the principal god object. Directly splitting it by line count would only redistribute coupling; extract by lifecycle and responsibility.

**Extraction order**

1. Bootstrap/lifecycle owner: screen creation, process hooks, disposal.
2. Render scheduler: invalidation coalescing and renderer lifecycle.
3. Focus/overlay controller: local TUI state only.
4. File application service: open/read policy, save, conflict detection.
5. Terminal process service: spawn, terminate, metadata, output.
6. Quick-open/index query service.
7. Thin TUI controller translating key actions into runtime commands.

**Acceptance**

- The command entry only validates CLI input, creates dependencies, starts the client, and awaits shutdown.
- Each extracted service has focused tests and no circular imports.
- The open-ended `actions` bag is replaced with explicit typed dependencies or command dispatch.

### 7. Introduce durable events and sessions

**Why**

Streaming, resume, background work, web/VSCode clients, and checkpoints all depend on ordered durable state. Adding any of them before persistence would create incompatible ad hoc histories.

**Ordered changes**

1. Define event envelope and schema versioning.
2. Add SQLite storage and migrations.
3. Implement append/query/subscribe with monotonic sequence.
4. Build session and task projections.
5. Add snapshots after correctness is proven through replay.
6. Add artifact references for large output instead of storing unbounded payloads in events.

**Acceptance**

- State reconstructs from the event log in deterministic tests.
- A subscriber can reconnect from a sequence without gaps or duplicate application.
- Secrets and oversized outputs are redacted/externalized before append.

### 8. Add provider abstraction and normalized streaming

**Why**

Provider-specific SDK types must not become the event protocol or agent domain. Two adapters are needed to prove the abstraction, but the interface should be learned from one fake and one real adapter first.

**Ordered changes**

1. Implement a deterministic fake provider and stream fixtures.
2. Define capability metadata and normalized stream events.
3. Implement one provider adapter with cancellation and usage.
4. Add context/token budgeting and structured error classification.
5. Implement a second adapter and adjust only where differences are genuinely semantic.
6. Add model router after capabilities and usage are stable.

**Acceptance**

- Agent/application code imports no vendor SDK types.
- Recorded streams cover partial tool calls, disconnect, retry hints, rate limits, and cancellation.
- Usage and model identity are persisted with each run.

### 9. Build permissioned tools and patch/Git infrastructure

**Why**

Tool calling is the core coding-agent capability and its highest-risk boundary. File writes should use a patch engine that detects stale content and provides reviewable artifacts.

**Ordered changes**

1. Registry and descriptor schema.
2. Policy and approvals.
3. Executor lifecycle and audit.
4. Read/search tools.
5. Command tool with platform adapter and sandbox policy.
6. Patch engine with atomic apply and conflict detection.
7. Git status/diff/worktree/checkpoint adapter.
8. Expose tools to providers only after the entire pipeline is covered.

**Acceptance**

- Native, plugin, and later MCP tools share one executor path.
- No write occurs if expected content changed after proposal.
- Destructive and external actions cannot inherit a lower-risk approval accidentally.

## Medium priority

### 10. Add task, planner, executor, and agent state machines

**Why**

The runtime needs durable intent and legal transitions before multi-agent concurrency. Output recency cannot serve as task progress.

**Ordered changes**

1. Task and attempt entities with explicit transition tables.
2. Agent-run state machine and bounded model/tool loop.
3. Inspectable planner artifact.
4. Executor for ready steps with cancellation and budgets.
5. Checkpoint metadata and restart behavior.
6. Parent/child tasks with bounded delegation.

**Acceptance**

- Illegal transitions fail visibly.
- Restart never repeats committed side effects automatically.
- Cancellation propagates and produces exactly one terminal task outcome.

### 11. Add scheduler and daemon boundary

**Why**

Background tasks cannot be owned by a TUI process that calls `process.exit`. Multiple clients require a stable runtime owner.

**Ordered changes**

1. In-process scheduler interface and deterministic tests.
2. Durable leases, heartbeats, retries, priorities, and concurrency quotas.
3. Move runtime ownership into a local daemon.
4. Add authenticated, versioned IPC and resumable event subscription.
5. Make TUI a client and validate detach/reattach.
6. Add isolated worktree allocation for concurrent writers.

**Acceptance**

- Jobs continue without a connected UI.
- Daemon restart recovers or marks interrupted work without duplication.
- Resource and provider rate limits are enforced under stress.

### 12. Add MCP through the tool boundary

**Why**

MCP should extend capabilities, not create a second ungoverned execution path.

**Ordered changes**

1. Configuration and lifecycle manager.
2. Transport, negotiation, health, and reconnect.
3. Descriptor conversion/namespacing.
4. Permissioned execution through the internal tool executor.
5. Resource/prompt integration through context services.
6. Conformance, hostile-server, timeout, and output-bound tests.

**Acceptance**

- Disabling an MCP server removes its live capabilities without corrupting sessions.
- MCP actions have identical approval and audit behavior to native tools.

### 13. Add a versioned Plugin SDK and host

**Why**

The SDK must be built on stable registries and runtime commands/events. Exposing current internals now would permanently freeze accidental APIs.

**Ordered changes**

1. Manifest and compatibility rules.
2. Capability grants and activation lifecycle.
3. Contribution APIs for tools/providers/commands/context/hooks.
4. Failure isolation and timeouts.
5. Out-of-process host for untrusted plugins.
6. Example plugin, test kit, upgrade/uninstall provenance.

**Acceptance**

- Plugins cannot access mutable internal state or bypass permissions.
- Plugin failure cannot crash or block the runtime.

## Low priority

### 14. Migrate and improve the TUI

**Why later**

The current UI is useful, but further pane/editor investment before runtime seams would deepen coupling. Once the protocol exists, UI improvements become safer.

**Work**

- Consume runtime projections and event stream.
- Remove direct filesystem/process ownership.
- Standardize geometry and render contracts.
- Replace overlay focus flags with a stack/controller.
- Reduce reliance on private Blessed/`blessed-xterm` members.
- Add keybinding configuration, conflict detection, accessibility, and large-output virtualization.

### 15. Add web and VSCode clients

**Why later**

They should prove the shared protocol, not force its design while core state is still mutable.

**Work**

- Generate clients from protocol schemas.
- Build task/session/approval/artifact projections.
- Enforce local authentication and workspace authorization.
- Test reconnect, slow consumers, remote VSCode environments, and protocol upgrades.

### 16. Remove compatibility debt and freeze v1 APIs

**Work**

- Remove `optional()` loading for built-ins.
- Remove dual terminal geometry inputs.
- Remove old mutable state APIs after TUI migration.
- Reconcile and archive superseded specs/contracts.
- Freeze event schema v1, client protocol v1, Plugin SDK v1, storage migration policy, and supported limits.

## Dependency order summary

    Test/lifecycle baseline
      -> architecture contracts
      -> side-effect/workspace boundary
      -> domain events + persistence
      -> provider streaming + tool pipeline
      -> agent/task state machines
      -> scheduler + daemon + isolation
      -> MCP and plugins
      -> web/VSCode and v1 API freeze

The critical constraint is that security, lifecycle, persistence, and event semantics come before concurrency and ecosystem extensibility.
