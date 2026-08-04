# Recommended Folder Structure

> **Archived target.** The large `apps/`/`packages/` monorepo below is not approved for
> the desktop MVP. The active decision is the lightweight `desktop/src` plus
> `desktop/src-tauri` structure in
> [`docs/DESKTOP_ARCHITECTURE.md`](docs/DESKTOP_ARCHITECTURE.md).

## Recommendation

Move toward a workspace/monorepo with narrowly scoped packages, but do it incrementally. The current repository has one npm package and only 4,033 lines of JavaScript; creating every package immediately would be over-engineering. Start with `contracts`, `core`, `workspace`, `events`, `terminal`, and `cli`, then add packages when a real implementation and independent boundary exist.

The structure below is the intended v1.0 end state.

    /
    ├─ apps/
    │  ├─ cli/
    │  ├─ tui/
    │  ├─ daemon/
    │  ├─ web/
    │  └─ vscode/
    ├─ packages/
    │  ├─ contracts/
    │  ├─ core/
    │  ├─ workspace/
    │  ├─ sessions/
    │  ├─ events/
    │  ├─ tasks/
    │  ├─ scheduler/
    │  ├─ agent/
    │  ├─ planner/
    │  ├─ executor/
    │  ├─ context/
    │  ├─ memory/
    │  ├─ providers/
    │  ├─ tools/
    │  ├─ permissions/
    │  ├─ patch/
    │  ├─ git/
    │  ├─ mcp/
    │  ├─ plugins/
    │  ├─ plugin-sdk/
    │  ├─ terminal/
    │  ├─ config/
    │  ├─ storage/
    │  ├─ protocol/
    │  ├─ observability/
    │  └─ testing/
    ├─ plugins/
    │  └─ examples/
    ├─ test/
    │  ├─ contract/
    │  ├─ integration/
    │  ├─ e2e/
    │  ├─ fixtures/
    │  └─ performance/
    ├─ tools/
    ├─ docs/
    │  ├─ architecture/
    │  ├─ adr/
    │  ├─ protocol/
    │  ├─ plugins/
    │  ├─ operations/
    │  └─ decisions/
    ├─ package.json
    ├─ tsconfig.base.json
    └─ workspace configuration

## Application folders

### `apps/cli/`

The non-interactive and command-line adapter.

Responsibilities:

- parse arguments and environment-facing options;
- lazy-load only the selected command;
- connect to the local runtime or daemon;
- translate typed outcomes into human, JSON, or JSONL output;
- map terminal outcomes to stable exit codes;
- own no agent, workspace, provider, tool, or storage logic.

The current `bin/wsedit.js` and `src/commands/{view,ls}.js` begin here, but direct `process.exit`, filesystem, and rendering behavior move behind application commands.

### `apps/tui/`

The interactive terminal client.

Responsibilities:

- Blessed or replacement renderer integration;
- local view state: focus, scroll, selected tab, overlays, keymap, layout;
- subscribe to runtime projections/events;
- send user commands and approval decisions;
- render terminal-process output without owning process policy;
- explicit mount/dispose lifecycle.

Most current `src/ui/*` files migrate here after they stop owning filesystem/process/domain state. The current legacy single-file editor in `src/commands/edit.js` should either become a small TUI mode or be deprecated.

### `apps/daemon/`

The long-lived local runtime host.

Responsibilities:

- own sessions, tasks, provider streams, tools, MCP connections, plugins, PTYs, and background jobs;
- expose authenticated local IPC;
- manage startup, shutdown, recovery, migrations, locks, and diagnostics;
- enforce one runtime owner per configured data directory;
- remain UI-agnostic.

This package is added only when background tasks or multiple simultaneous clients are introduced.

### `apps/web/`

The local web dashboard.

Responsibilities:

- session/task/run views;
- event-stream rendering;
- approvals, patch/diff review, artifacts, usage, and diagnostics;
- safe rendering of model/tool content;
- local authentication, origin protection, and no direct filesystem access.

### `apps/vscode/`

The VSCode extension client.

Responsibilities:

- attach to a workspace runtime;
- provide task/session tree views, streaming panels, approvals, diff review, and context selection;
- respect VSCode workspace trust and remote extension-host placement;
- use the same protocol as CLI/TUI/web rather than importing runtime internals.

## Core packages

### `packages/contracts/`

The smallest dependency and the only package broadly imported across layers.

Responsibilities:

- branded IDs and scalar value objects;
- versioned command/query/event envelopes;
- public error codes and result types;
- capability and budget types;
- cancellation/deadline conventions;
- runtime schemas for external boundaries.

It must not depend on providers, Node filesystem APIs, UI libraries, databases, or vendor SDKs.

### `packages/core/`

The application runtime facade and use-case composition.

Responsibilities:

- accept typed commands and queries;
- coordinate workspace, session, task, agent, tool, and scheduler services;
- enforce transaction and authorization boundaries;
- expose lifecycle and health;
- contain no vendor/provider, renderer, protocol transport, or direct database implementation.

This is not a miscellaneous utility folder. Generic helpers belong close to their owner or in `contracts` only if truly universal.

### `packages/workspace/`

Workspace lifecycle and filesystem boundary.

Responsibilities:

- canonical root and additional allowed roots;
- containment and symlink/junction policy;
- file metadata, reads, versioned writes, and watch events;
- ignore rules, index/search, workspace instructions, repository discovery;
- resource quotas and workspace-scoped services;
- multiple simultaneously open workspaces.

The current `fs-tree.js`, `file-index.js`, and appropriate file policies from `src/commands/ui.js` migrate here behind asynchronous ports.

### `packages/sessions/`

Conversation and run history.

Responsibilities:

- session lifecycle, metadata, messages, transcripts, and artifacts;
- resume/archive/export/delete;
- association to workspaces, tasks, runs, checkpoints, and usage;
- retention and privacy controls;
- projection building from durable events.

### `packages/events/`

Durable event and local fan-out semantics.

Responsibilities:

- event envelope creation and validation;
- append/read/replay/subscription interfaces;
- ordering, correlation, causation, and schema versions;
- in-process bus with subscriber error isolation;
- projection checkpoints and resumable cursors.

It replaces the architectural role currently attempted by no-payload `emitChange`, while TUI invalidation remains local to the client.

### `packages/tasks/`

Durable task intent and state machines.

Responsibilities:

- task, subtask, dependency DAG, attempt, progress, and artifact references;
- legal transitions and idempotency;
- priorities, ownership, retry eligibility, and terminal outcomes;
- no provider or rendering logic.

### `packages/scheduler/`

Runnable work selection and resource control.

Responsibilities:

- queues, priority, fairness, dependencies, leases, and heartbeats;
- concurrency limits by workspace/provider/tool/global scope;
- retry and dead-letter policy;
- background job attach/detach/cancel;
- resource and rate-limit coordination.

### `packages/agent/`

The structured agent run state machine.

Responsibilities:

- agent roles/configuration;
- bounded model/tool observation loop;
- run transitions and event emission;
- cancellation and aggregate budgets;
- delegation through the task service;
- no direct filesystem, shell, MCP, provider SDK, or UI calls.

An external CLI hosted in a PTY does not live here unless a dedicated adapter translates a stable structured protocol.

### `packages/planner/`

Planning policy and plan artifacts.

Responsibilities:

- produce inspectable plans from task/context inputs;
- revise plans based on outcomes;
- validate plan size, dependencies, and budgets;
- remain optional for simple direct tasks.

Do not make every agent request require a complex planner. The package exists to keep planning policy out of UI and executor code.

### `packages/executor/`

Execution of ready task steps.

Responsibilities:

- select an agent/execution strategy for a ready attempt;
- enforce turn/time/token/tool budgets;
- coordinate context, providers, tools, and task transitions;
- commit results/checkpoints atomically where possible;
- propagate cancellation.

### `packages/context/`

Prompt/context assembly and compression.

Responsibilities:

- deterministic source ordering and provenance;
- system/user/workspace instructions;
- selected files, search results, memory, task state, and tool summaries;
- model-specific token budgets through provider-neutral metadata;
- context compression and summary versioning.

### `packages/memory/`

Persisted derived knowledge and retrieval.

Responsibilities:

- scoped run/session/workspace/user memory;
- provenance, confidence, TTL, consent, and deletion;
- retrieval adapters and ranking;
- strict cross-workspace isolation;
- no silent promotion of transient model output to durable memory.

## Integration and capability packages

### `packages/providers/`

Provider ports, registry, router, and vendor adapters.

Suggested internal organization:

    providers/
    ├─ src/contracts/
    ├─ src/registry/
    ├─ src/routing/
    ├─ src/adapters/openai/
    ├─ src/adapters/anthropic/
    ├─ src/adapters/google/
    └─ test/conformance/

Responsibilities:

- normalized model requests and semantic stream events;
- provider capabilities and model metadata;
- authentication, retries, rate limits, usage, and errors;
- vendor SDK containment;
- conformance fixtures.

### `packages/tools/`

Native tool contracts, registry, and built-ins.

Responsibilities:

- descriptors and versioned input/output schemas;
- discovery and namespacing;
- read/search/command and other built-in implementations;
- result normalization and artifact references;
- no permission bypass: execution always goes through `permissions` and application executor policy.

### `packages/permissions/`

Capability and approval policy.

Responsibilities:

- classify requested actions;
- evaluate defaults, user/workspace policy, and session grants;
- create pending approvals and apply decisions;
- define scope/expiry/provenance;
- audit allow/deny/timeout decisions;
- sandbox/process policy integration.

### `packages/patch/`

Safe file mutation engine.

Responsibilities:

- parse and normalize patch formats;
- validate contained paths and expected base content;
- preview, apply atomically, preserve EOL/mode, and report conflicts;
- expose rollback/checkpoint references where safe;
- operate through the workspace filesystem port.

### `packages/git/`

Repository integration.

Responsibilities:

- status, diff, branch, worktree, and repository identity;
- safe checkpoints and change summaries;
- worktree allocation/cleanup for agent isolation;
- typed results instead of domain-level shell-output parsing;
- no automatic commit/push/history rewrite unless explicitly commanded and permitted.

### `packages/mcp/`

MCP infrastructure adapter.

Responsibilities:

- configuration and scope;
- transport lifecycle and protocol negotiation;
- health, reconnect, authentication, logging, and cancellation;
- convert namespaced tools/resources/prompts into internal registries;
- enforce the same permissions, limits, and audit as native capabilities.

### `packages/plugin-sdk/`

The stable public developer API.

Responsibilities:

- manifest and contribution types;
- API version and compatibility helpers;
- safe handles for commands, events, tools, providers, context sources, and settings;
- plugin test harness;
- no internal stores, database handles, renderer instances, or unrestricted Node capabilities.

### `packages/plugins/`

Plugin discovery and runtime host.

Responsibilities:

- install/discover/validate/activate/deactivate/upgrade;
- capability grants and trust records;
- contribution registration and cleanup;
- timeouts, diagnostics, crash isolation, and eventual worker-process hosting;
- record plugin identity/version in session provenance.

### `packages/terminal/`

Terminal process infrastructure independent of the TUI.

Responsibilities:

- shell/PTY spawn, input, output, resize, exit, termination, and process-tree lifecycle;
- platform adapters for Windows and Unix;
- terminal session metadata and bounded scrollback/artifacts;
- no Blessed rendering and no claim that a terminal process is an agent.

The process parts of `src/ui/terminal-panel.js` and `src/core/shell.js` migrate here; visual widgets remain in `apps/tui`.

### `packages/config/`

Layered validated configuration.

Responsibilities:

- defaults/user/workspace/environment/CLI precedence;
- schema validation and migration;
- value provenance and diagnostics;
- secure references to secrets;
- plugin/provider/MCP settings namespaces.

### `packages/storage/`

Persistence implementations.

Responsibilities:

- SQLite connection, transactions, migrations, integrity, and backup;
- event/session/task repositories implementing domain ports;
- content-addressed artifact storage;
- data directory locks and quotas;
- no application policy.

### `packages/protocol/`

Local client/daemon protocol.

Responsibilities:

- versioned IPC messages and authentication handshake;
- command, query, event subscription, approval, and artifact APIs;
- generated clients where practical;
- compatibility and reconnect behavior;
- transport implementation separated from contract types.

### `packages/observability/`

Diagnostics without leaking sensitive content.

Responsibilities:

- structured logs, metrics, traces, and correlation;
- redaction and sampling policy;
- local diagnostic bundles;
- performance measurements for startup, first token, stream, tools, indexing, and scheduler;
- opt-in telemetry controls.

### `packages/testing/`

Reusable test infrastructure.

Responsibilities:

- fake clock, IDs, filesystem, event store, provider, MCP server, plugin host, and process runner;
- recorded provider stream fixtures;
- platform-aware orphan-process assertions;
- contract/conformance suites reusable by adapters and plugins;
- no production behavior.

## Non-package folders

### `plugins/examples/`

Small publishable examples proving the public Plugin SDK. Examples should never import private workspace packages.

### `test/contract/`

Public contract compatibility: events, protocol, providers, tools, plugins, MCP conversion, and storage migrations.

### `test/integration/`

Cross-package tests using real SQLite and controlled subprocesses but fake providers/network by default.

### `test/e2e/`

CLI/TUI/daemon/web/VSCode workflow tests. PTY and real-provider tests are explicitly tagged and separated from deterministic default gates.

### `test/fixtures/`

Versioned workspaces, Git repositories, provider streams, MCP servers, plugins, patches, corrupted databases, and platform path cases.

### `test/performance/`

Repeatable startup, first-event, indexing, memory, stream, scheduler, and multi-agent benchmarks with stored baselines and regression thresholds.

### `tools/`

Developer/release scripts only: diagnostics, fixtures, migration verification, packaging, benchmarks, and smoke orchestration. Shared runtime logic must live in packages rather than be copied into tools as shell resolution and fake screens are today.

### `docs/architecture/`

Current architecture, dependency rules, diagrams, data model, security model, and operational limits.

### `docs/adr/`

Immutable architectural decision records with status and supersession links.

### `docs/protocol/`

Client protocol, event schemas, compatibility rules, and examples.

### `docs/plugins/`

Plugin SDK, manifest, capability review, testing, publishing, and migration guides.

### `docs/operations/`

Data locations, backup/restore, diagnostics, daemon management, security, troubleshooting, and platform compatibility.

### `docs/decisions/`

Product decisions and non-goals. Development work boards/changelogs should not be mixed with normative runtime contracts.

## Dependency rules

Allowed dependency direction:

    apps -> protocol/core/contracts
    core -> domain packages + contracts
    agent/executor -> tasks/context/provider ports/tool ports/events/contracts
    infrastructure adapters -> their domain ports + contracts
    storage -> repository/event-store ports + contracts
    plugin-sdk -> contracts only
    plugins host -> plugin-sdk + registries + permissions

Forbidden dependencies:

- Domain packages must not import apps, Blessed, Commander, vendor SDKs, SQLite drivers, or process globals.
- UI clients must not import storage implementations or mutate domain state.
- Providers must not execute tools or make permission decisions.
- MCP and plugins must not bypass the tool registry/executor/permission pipeline.
- Scheduler must not contain UI or provider-specific logic.
- `contracts` must not become a dumping ground for implementation helpers.
- No package may import another package’s private source path.

## Incremental migration from the current tree

| Current source | First target | Notes |
|---|---|---|
| `bin/wsedit.js` | `apps/cli` | Keep thin and lazy. |
| `src/commands/ui.js` | `apps/tui` + `packages/core` + `packages/workspace` | Extract by lifecycle/use case, not by copying the file. |
| `src/core/workspace-state.js` | `apps/tui` view model, then domain projections | Do not promote its shape to public runtime state. |
| `src/core/fs-tree.js`, `file-index.js` | `packages/workspace` | Replace sync IO and centralize ignore/containment. |
| `src/core/text-buffer.js` | `apps/tui` editor model or dedicated editor utility | It is not agent memory or workspace domain state. |
| `src/core/keymap.js`, `src/ui/layout.js` | `apps/tui` | Presentation-local. |
| `src/core/shell.js` | `packages/terminal` | Platform process infrastructure. |
| `src/ui/terminal-panel.js` | `packages/terminal` + `apps/tui` | Split process lifecycle from rendering. |
| `src/ui/*` | `apps/tui` | Consume runtime projections/commands. |
| `test/*` | layered test folders | Preserve current regressions while adding contract and lifecycle coverage. |
| `tools/phase0-check.js`, `phaseA-bench.js`, `ui-smoke.js` | `tools` + `packages/testing` helpers | Remove duplicated shell/fake-screen/process utilities. |

The first migration should create only the boundaries required by Phase 0/1. Empty placeholder packages should not be committed.
