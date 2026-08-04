# Desktop Architecture

Status: Target MVP architecture. No desktop modules described here exist yet.

Product decisions come from [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md); observable
behavior comes from [`DESKTOP_REQUIREMENTS.md`](DESKTOP_REQUIREMENTS.md). This document
defines implementation boundaries and the minimum contracts needed to implement those
requirements consistently.

## System context

```text
User
  ↓ input and pane actions
Vue 3 frontend + xterm.js
  ↓ explicit Tauri commands        ↑ scoped Tauri events
Rust Tauri backend / PTY manager
  ↓ portable-pty
Shell / Codex CLI / Claude Code / Gemini CLI / custom command
  ↓ reads and writes in the selected workspace with user OS permissions
```

The desktop application is a local terminal host. It does not sit between an AI CLI
and its model provider, inspect model messages, or own the files modified by a CLI.

The existing Node CLI/TUI is a separate compatibility surface:

```text
Existing Node CLI/TUI                  New desktop application
Commander/Blessed                      Vue/Tauri
node-pty + blessed-xterm               portable-pty + xterm.js
remains operational                    added under desktop/
```

No runtime dependency is introduced between these two surfaces in the MVP.

## Repository boundary

The approved structure for implementation is:

```text
desktop/
  package.json
  index.html
  src/
    components/
    composables/
    lib/
    styles/
    types/
  src-tauri/
    Cargo.toml
    tauri.conf.json
    capabilities/
    src/
```

This is intentionally not:

```text
apps/
  desktop/
packages/
  shared/
```

The repository has one small legacy package and one new application. A workspace or
monorepo layer would add package management, build orchestration, and public-boundary
cost without a second concrete shared consumer. If future code is genuinely shared,
it should be extracted from working implementations after its contract is stable.

## Frontend responsibilities

The Vue frontend owns:

- workspace presentation and workspace-selection flow;
- pane metadata projections and user actions;
- fixed one-to-four pane CSS Grid layouts;
- focused and zoomed pane presentation;
- one xterm.js instance per mounted pane;
- terminal keyboard/paste input routing;
- terminal measurement and resize requests;
- subscription to pane-scoped backend output/status events;
- visible errors and confirmation dialogs;
- disposal of xterm instances, event listeners, and ResizeObservers.

The frontend does not own:

- PTY handles or process IDs;
- child-process creation, termination, or descendant cleanup;
- command discovery policy;
- terminal output history in Vue state;
- persistence, task state, model state, tool calls, or agent orchestration.

## Rust backend responsibilities

The Rust backend owns:

- validation of workspace paths used as cwd;
- launch-profile resolution and Windows command detection;
- `.cmd`/`.bat` wrapping and argument-safe spawn construction;
- creation and storage of `portable-pty` master/child handles;
- exactly one output reader lifecycle per process generation;
- routing PTY output to pane- and generation-scoped events;
- input writes and PTY resize operations;
- process exit observation and status classification;
- close, restart, close-all, and application-exit cleanup;
- bounded resource limits, including the four-pane maximum;
- typed command errors and cleanup diagnostics.

The backend does not implement a generic shell execution service, plugin registry,
event bus, session database, workspace filesystem API, or model provider.

## Module boundaries

The exact filenames may be adjusted during Phase 1 if Tauri scaffolding conventions
require it, but responsibilities shall remain narrow.

### Frontend

| Module | Responsibility |
| --- | --- |
| `App.vue` | Compose empty/workspace views and top-level shutdown confirmation |
| `components/WorkspaceView.vue` | Render workspace header, pane grid, and add action |
| `components/TerminalPane.vue` | Own one xterm instance and pane-local subscriptions |
| `components/PaneToolbar.vue` | Focus, status, restart, close, and zoom controls |
| `components/LauncherDialog.vue` | Choose profile or enter a custom command |
| `composables/useWorkspace.ts` | Singleton workspace and pane metadata actions |
| `composables/usePaneTerminal.ts` | xterm lifecycle, input, output, and resize binding |
| `lib/tauri.ts` | Narrow typed wrappers for commands and event subscriptions |
| `types/desktop.ts` | Frontend contract mirrors used by the wrappers |
| `styles/` | Tokens, fixed grid templates, focus/error/zoom states |

### Rust backend

| Module | Responsibility |
| --- | --- |
| `commands.rs` | Tauri command boundary and input validation |
| `pty_manager.rs` | Authoritative pane/generation registry and lifecycle operations |
| `pty_process.rs` | One PTY generation, reader, writer, resize, exit, and termination |
| `launcher.rs` | Launch profiles and spawn specifications |
| `command_detection.rs` | PATH/PATHEXT resolution and diagnostic result |
| `workspace.rs` | Validate and canonicalize selected cwd |
| `events.rs` | Small versioned event payloads emitted to the frontend |
| `error.rs` | Stable error codes and safe display messages |
| `lib.rs` | Construct shared state and register commands/lifecycle hooks |

These are planned boundaries, not authorization to create empty placeholder modules.
Each module is added only when its phase gives it real behavior and tests.

## State management

The MVP uses a singleton Composition API composable. It contains only small metadata:

```ts
interface PaneMetadata {
  id: string;
  generation: number;
  title: string;
  launch: LaunchRequest;
  status: "starting" | "running" | "exited" | "closing" | "error";
  exitCode?: number;
  errorCode?: string;
  errorMessage?: string;
  cols: number;
  rows: number;
}

interface WorkspaceViewState {
  root: string | null;
  panes: PaneMetadata[];
  focusedPaneId: string | null;
  zoomedPaneId: string | null;
  isClosing: boolean;
}
```

The real implementation may refine optional fields, but shall preserve the ownership
rule: xterm instances, output, scrollback, PTY handles, reader tasks, and process IDs do
not enter this state. `LaunchRequest` is the exact user-approved profile or custom
command configuration required for restart. It must not be logged, because custom
arguments may contain secrets.

Pinia is not used because there is one window, one workspace, a maximum of four panes,
and one small state domain. Pinia may be reconsidered only after multiple windows,
durable settings, independent feature domains, or cross-view workflows demonstrate a
clear need.

## Pane ownership

Ownership is split deliberately:

```text
Workspace composable
  owns pane metadata list, focus, and zoom

TerminalPane component
  owns xterm instance + frontend listeners/observer for one pane ID

PTY manager
  owns current generation record for one pane ID

PTY generation record
  owns portable-pty handles + reader + process lifecycle
```

A component unmount disposes frontend resources but does not silently kill a backend
process. Process closure is an explicit application action. During normal pane removal,
the backend close confirmation completes before metadata is removed and the component
unmounts.

## PTY lifecycle contracts

The command and event names below are logical contracts. Tauri-specific syntax may
differ, but behavior shall not.

### Create

```text
create_pane(pane_id, generation, workspace, launch, cols, rows)
  -> success metadata | typed error
```

Rules:

1. Reject invalid dimensions, missing workspace, duplicate active pane/generation, or
   a fifth pane.
2. Resolve the launch specification using backend PATH policy.
3. Create the PTY and child with workspace cwd.
4. Register the generation only when ownership is sufficient to clean it up.
5. Start exactly one output reader.
6. Emit `pane_started` after registration.
7. On any failure, release partial resources and return a typed error.

### Write

```text
write_pane(pane_id, generation, bytes)
  -> success | stale/not-running/write error
```

Writes are serialized per generation. A stale generation can never target the current
process after restart.

### Resize

```text
resize_pane(pane_id, generation, cols, rows)
  -> success | stale/not-running/invalid-size/resize error
```

The frontend coalesces resize requests after layout measurement. The backend validates
positive bounded integer dimensions. Resize errors update diagnostics but shall not
automatically terminate an otherwise usable pane.

### Close

```text
close_pane(pane_id, generation, reason)
  -> closed | already_closed | cleanup_failed
```

Close is idempotent and stops new input first. It requests graceful termination, waits
for a measured timeout, force-terminates when required, joins/stops the reader, removes
the registry entry, and returns the actual cleanup outcome. Exact Windows descendant
cleanup is a Phase 2/5 spike gate; it must not be assumed from the legacy Node PTY.

### Restart

```text
restart_pane(pane_id, old_generation, new_generation, launch, cols, rows)
  -> success metadata | close error | create error
```

Restart is serialized as close-old then create-new. Pane ID stays stable and generation
increments. Old output/exit events are ignored by the frontend. A close failure must be
visible; the backend shall not start a second generation under the same pane ID while
the old generation may still be live.

### Close all and application exit

```text
close_all(reason, total_deadline)
  -> per-pane cleanup outcomes
```

The manager snapshots registered panes, attempts every close even when another fails,
and returns an aggregate result. Window-close handling prevents new starts and calls
close-all. Application shutdown has a bounded deadline and reports failures in test and
development builds. Release behavior after the deadline is decided from measured
Windows process-tree evidence in Phase 5.

## Event flow

Events are scoped by pane and generation:

```text
PTY reader
  -> bounded/batched pane_output { paneId, generation, data }
  -> TerminalPane subscription
  -> xterm.write(data)

PTY exit observer
  -> pane_exited { paneId, generation, exitCode }
  -> workspace metadata projection
  -> pane toolbar/status update
```

Minimum event kinds are:

- `pane_started`;
- `pane_output`;
- `pane_exited`;
- `pane_error`;
- `pane_cleanup_completed` when needed for close coordination.

This is a small transport contract, not a generic event bus. Event payloads carry a
schema version if they cross the Tauri boundary so incompatible changes fail visibly.

The output payload representation and batching threshold are finalized after the
single-terminal throughput spike. The selected representation must preserve output
ordering and multibyte text across chunks, be consumable by xterm.js, and remain
bounded under noisy output.

## Layout

The MVP uses fixed CSS Grid templates:

```text
1 pane:  1 × 1
2 panes: 2 columns
3 panes: pane 1 spans two rows on the left; panes 2 and 3 stack on the right
4 panes: 2 × 2
zoom:    focused pane fills the grid; other panes remain mounted but hidden
```

This accepts several limitations:

- users cannot drag dividers or choose split direction;
- pane sizes are determined by window size and pane count;
- a narrow window may make four panes impractical;
- the application may enforce a documented minimum window size rather than invent a
  dynamic layout tree.

Zoom changes presentation only. It does not stop hidden PTYs, discard output, or
recreate xterm instances.

## Agent and command detection

Launch profiles are backend data with stable profile IDs and user-facing labels.

Detection shall:

1. compute the effective environment once for the operation;
2. resolve `codex`, `claude`, and `gemini` using PATH and Windows PATHEXT rules;
3. return availability plus safe diagnostic information;
4. use the same resolution result or environment for spawn;
5. support refresh without restarting the workspace.

On Windows, `.cmd` and `.bat` files are launched through the appropriate shell. Native
executables may be spawned directly. Shell profiles are not sourced merely to discover
commands because profile behavior is user-specific and may have side effects.

A packaged app launched from Explorer can inherit an environment that predates a CLI
installation. MVP behavior is to show the missing command clearly, recommend relaunch,
support refresh, and allow an absolute custom path. Reading registry PATH values or
adding a Windows environment helper is considered only if Phase 4 evidence shows the
simple policy is inadequate.

## Error handling

Backend errors use stable codes plus safe display messages. Expected errors are returned
through command results or pane events rather than panicking. The UI maps codes to
actions such as retry, choose command, restart, or close.

At minimum, codes distinguish invalid workspace, command not found, invalid launch,
PTY create failure, spawn failure, stale generation, write failure, resize failure,
reader failure, termination timeout, and cleanup unverified.

Terminal output is never used as an error-control channel. A process may print the word
“Error” while still running; only backend lifecycle results change pane status.

## Security boundary

The Tauri frontend receives only the commands required for workspace selection and PTY
lifecycle. It does not receive general filesystem or unrestricted Rust execution APIs.

The security boundary is local user intent, not sandboxing:

- selected workspace becomes cwd;
- shell and CLI processes keep the user's OS permissions;
- custom command can execute arbitrary local commands when the user explicitly starts it;
- panes sharing a workspace are not isolated from one another;
- terminal output may contain control sequences and secrets;
- output is written through xterm.js and is not injected as HTML or logged by default.

Tauri capabilities/CSP shall remain minimal and be reviewed during packaging. Native,
shell, filesystem, updater, and network plugins are not added merely for convenience.

## Packaging boundary

The desktop application builds and packages independently from the Node CLI. Its
frontend build artifacts are consumed by Tauri; the Windows bundle contains the Rust
backend and web assets but does not embed the legacy CLI.

Initial packaging targets one Windows executable and an NSIS installer. WebView2
requirements, minimum Windows version, icon/bundle metadata, signing, and uninstall
behavior are verified in Phase 6. Auto-update infrastructure is outside the MVP.

## Decisions and trade-offs

| Decision | Benefit | Accepted trade-off |
| --- | --- | --- |
| Tauri instead of Electron | Smaller intended runtime footprint and Rust-native PTY ownership | Rust toolchain and Windows backend work |
| `portable-pty` in desktop | Avoid Node sidecar and keep PTY in backend | Cannot directly reuse `node-pty` implementation |
| Vue Composition API | Small explicit UI state and familiar components | No global-store tooling |
| No Pinia | Fewer dependencies and indirection | Revisit if state domains/windows grow |
| Plain CSS | Direct control over four fixed layouts | No design-system component library |
| Fixed grid | Predictable, testable MVP | No user-resizable split tree |
| Maximum four panes | Bounded resources and simple UX | Power users cannot exceed the limit |
| Output outside reactive state | Avoid render/memory pressure | Terminal content is not available as normal Vue data |
| Separate CLI and desktop stacks | Low migration risk | Some duplicated concepts and tests |
| No worktree/orchestration | Fast, focused MVP | Concurrent writers can conflict; user coordinates |
