# Desktop Requirements

Status: MVP requirements. Implementation has not started.

This document defines observable desktop behavior. Architecture and implementation
details are subordinate to these requirements. Product scope and non-goals are defined
in [`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md). Ownership is defined in
[`DESKTOP_ARCHITECTURE.md`](DESKTOP_ARCHITECTURE.md), and delivery order is defined in
[`DESKTOP_IMPLEMENTATION_PLAN.md`](DESKTOP_IMPLEMENTATION_PLAN.md).

## Terminology

- **Workspace:** one user-selected local directory used as the initial working
  directory for every pane.
- **Pane:** one visible terminal surface and its associated PTY lifecycle.
- **Launch profile:** a predefined way to start Shell, Codex CLI, Claude Code, or
  Gemini CLI.
- **Custom command:** a user-supplied command launched explicitly in a pane.
- **Agent:** user-facing shorthand for an external AI CLI process. It is not an
  internal task, model, or orchestration entity.
- **Generation:** one concrete process run inside a pane. Restarting a pane creates a
  new generation while retaining pane identity.

## Functional requirements

### Workspace

- **FR-001:** The application shall let the user select and open one local directory
  as the active workspace.
- **FR-002:** The application shall show the active workspace path in the main window.
- **FR-003:** Every newly created pane shall start with the active workspace as its
  working directory.
- **FR-004:** Opening another workspace shall require closing the current workspace
  and its panes in the MVP.
- **FR-005:** A missing, unreadable, or non-directory workspace shall produce a visible
  error without opening terminal processes.

### Pane management

- **FR-010:** An open workspace may contain zero to four pane records; when terminals
  are present, the supported deck contains one to four panes.
- **FR-011:** The user shall be able to add a pane while fewer than four exist.
- **FR-012:** The application shall disable or reject add-pane when four panes exist.
- **FR-013:** The user shall be able to focus a pane by clicking or using the defined
  keyboard navigation.
- **FR-014:** Exactly one pane shall be the focused pane when the workspace is active.
- **FR-015:** The user shall be able to close a pane. Closing a running pane shall ask
  for confirmation before termination.
- **FR-016:** Closing the last pane shall leave an empty workspace state with an
  explicit add-pane action; it shall not close the application automatically.
- **FR-017:** The user shall be able to restart a pane using the same launch
  configuration and workspace.
- **FR-018:** The user shall be able to zoom the focused pane and restore the previous
  grid without stopping or recreating any PTY.
- **FR-019:** Pane identity shall remain stable across restart; the process generation
  shall change so late events from the previous process can be ignored.
- **FR-020:** The UI shall show basic pane status: starting, running, exited, closing,
  or error.

### Launch profiles and commands

- **FR-030:** The add-pane flow shall offer Shell, Codex CLI, Claude Code, Gemini CLI,
  and Custom Command.
- **FR-031:** The backend shall check whether `codex`, `claude`, and `gemini` are
  resolvable in the same effective environment used to start them.
- **FR-032:** Unavailable launch profiles shall remain understandable in the UI and
  show a clear “not found” reason rather than failing silently.
- **FR-033:** A Shell pane shall start the selected default shell without wrapping it
  in another interactive shell.
- **FR-034:** On Windows, default shell preference shall be `pwsh`, then
  `powershell.exe`, then `cmd.exe`.
- **FR-035:** A Custom Command shall be launched only after explicit user input and
  shall support command paths and arguments containing spaces.
- **FR-036:** The application shall not parse terminal output to infer task progress,
  completion, token usage, cost, or model identity.
- **FR-037:** Exiting an external CLI shall leave the pane visible with its exit status
  and available restart action.

### Terminal behavior

- **FR-040:** Each pane shall have one independent PTY and one independent xterm.js
  instance.
- **FR-041:** Output from one pane shall never appear in another pane.
- **FR-042:** The terminal shall render ANSI colors, cursor movement, screen clearing,
  and common interactive terminal control sequences through xterm.js.
- **FR-043:** The terminal shall support normal interactive shell and CLI input,
  including Enter, Backspace, arrow keys, Ctrl+C, and paste.
- **FR-044:** Ctrl+C while a pane is focused shall be written to that pane's PTY; it
  shall not terminate the desktop application.
- **FR-045:** The frontend shall resize the active xterm instance to its visible pane
  and send resulting column/row dimensions to the matching backend PTY.
- **FR-046:** Resizing, zooming, or changing pane count shall update every visible PTY
  that changed dimensions.
- **FR-047:** Zero or invalid terminal dimensions during mount/unmount shall not be sent
  to the backend.
- **FR-048:** Terminal scrollback shall be bounded by an explicit MVP limit selected
  during Phase 2 testing.

### Input and output streaming

- **FR-050:** PTY output shall reach its pane incrementally without waiting for process
  completion.
- **FR-051:** Output events shall identify pane ID and generation.
- **FR-052:** The frontend shall write terminal output directly to the matching xterm
  instance; it shall not append output or scrollback to Vue reactive state.
- **FR-053:** Input writes shall identify pane ID and current generation.
- **FR-054:** Input for a missing, closed, or stale generation shall return a typed
  failure and shall not target another process.
- **FR-055:** Output delivery shall be batched or bounded so a noisy process cannot
  create unbounded frontend memory growth or freeze normal pane controls.
- **FR-056:** Terminal output shall not be persisted or restored in the MVP.

### Process lifecycle

- **FR-060:** Creating a pane process shall validate pane count, workspace, launch
  configuration, and dimensions before registering a running PTY.
- **FR-061:** A spawn failure shall leave no registered PTY or reader task and shall
  place the pane in an error state with a retry action.
- **FR-062:** Backend process exit shall emit exactly one terminal exit event for the
  current generation.
- **FR-063:** Closing a pane shall stop accepting new input, request termination, wait
  for a bounded grace period, force termination if required, stop its reader, and
  release its PTY record.
- **FR-064:** Closing an already closed or missing pane shall be idempotent from the
  user's perspective.
- **FR-065:** Restart shall complete closure of the old generation before creating the
  new generation.
- **FR-066:** Close-all shall attempt to terminate every pane even if one pane fails to
  close, and shall return an aggregate result.
- **FR-067:** Window close and application exit shall invoke close-all before backend
  shutdown, subject to a bounded total deadline.
- **FR-068:** The application shall report cleanup failures during development and test
  runs; it shall not silently classify an unverified process tree as terminated.

## User flows

### UF-001 — First launch and workspace open

1. User starts the desktop application.
2. Application displays an empty state and “Open workspace”.
3. User selects a directory.
4. Application validates it and opens the workspace.
5. Application offers launch profiles; it does not start an agent automatically.

### UF-002 — Start and use a terminal

1. User chooses Shell or a detected CLI.
2. A pane enters `starting`.
3. Backend creates the PTY with the workspace cwd.
4. Pane enters `running` and receives realtime output.
5. User focuses the terminal and types normally.

### UF-003 — Add panes

1. User chooses add-pane.
2. User selects a launch profile or custom command.
3. The fixed grid changes for the new pane count.
4. Existing processes continue running.
5. At four panes, add-pane is disabled with an explanatory label or tooltip.

### UF-004 — Restart a failed or exited pane

1. Pane displays exit or error information.
2. User selects restart.
3. Old generation is fully closed if needed.
4. Terminal display is cleared for the new generation.
5. Backend starts the same profile in the same workspace.

### UF-005 — Close app with running panes

1. User closes the window.
2. Application warns that active processes will be terminated.
3. On confirmation, frontend blocks new pane creation and invokes close-all.
4. Backend terminates or force-terminates all registered processes within its deadline.
5. Application exits and the process-tree test verifies no supported descendant remains.

## Pane model

Vue state shall hold only pane metadata needed to render controls and route commands:

- stable pane ID;
- current generation;
- launch profile and display title;
- status and optional exit/error summary;
- focused and zoomed identity at workspace level;
- last known columns and rows.

The pane model shall not hold PTY handles, xterm instances, terminal output, scrollback,
or backend reader tasks. Each pane component privately owns its xterm instance and
disposes it on unmount.

## Agent model

`shell`, `codex`, `claude`, `gemini`, and `custom` are launch-profile kinds. A launch
profile contains a display name and backend launch intent. It is not a task, agent run,
provider, session, or durable entity.

The application does not inspect prompts, model responses, tool calls, or file edits.
Two external CLIs may change the same files. The user owns coordination and conflict
avoidance in the MVP.

## PATH and Windows requirements

- **FR-070:** Command detection and process spawn shall use the same backend-computed
  effective PATH.
- **FR-071:** Windows detection shall respect `PATHEXT` and recognize `.exe`, `.com`,
  `.cmd`, and `.bat` launchers.
- **FR-072:** `.cmd` and `.bat` launchers shall be invoked through an appropriate
  Windows command shell rather than treated as native executables.
- **FR-073:** The UI shall show the resolved executable/script path in diagnostics or
  error details without exposing unrelated environment secrets.
- **FR-074:** When a desktop app launched from Explorer cannot see a newly installed
  command, the error shall recommend relaunching the application and shall allow an
  absolute custom command path.
- **FR-075:** MVP command detection shall not depend on PowerShell profile scripts.
- **FR-076:** Paths containing spaces and non-ASCII characters shall be covered by
  Windows integration tests.

## Error states

The UI shall distinguish at least:

- invalid or inaccessible workspace;
- command not found;
- command found but spawn failed;
- PTY creation failed;
- input or resize targeted a stale pane generation;
- process exited with code;
- output reader failed;
- termination timed out or process-tree death could not be verified;
- packaging/runtime prerequisite missing.

Errors shall remain visible long enough to act on and provide retry, restart, close,
or choose-command actions where applicable. Errors shall not be represented only by a
console log.

## Non-functional requirements

- **NFR-001:** The application shall remain responsive with four idle interactive
  terminals.
- **NFR-002:** Under the agreed high-output benchmark, pane controls and focused input
  shall remain responsive and output memory shall remain bounded.
- **NFR-003:** Opening the main window and empty workspace shall not start a PTY.
- **NFR-004:** The desktop application shall not require a Node runtime at end-user
  runtime unless a launched CLI itself requires Node.
- **NFR-005:** Frontend production code shall use TypeScript without `any` except at a
  documented external boundary.
- **NFR-006:** Rust process ownership and command handlers shall return explicit errors;
  background errors shall not be silently discarded.
- **NFR-007:** Every frontend subscription, ResizeObserver, xterm instance, backend
  reader, and PTY process shall have one owner and idempotent disposal.
- **NFR-008:** The MVP shall introduce no state library, UI framework, database, plugin
  framework, or generic event bus.
- **NFR-009:** New dependencies shall be justified by an MVP requirement and reviewed
  before addition.
- **NFR-010:** Windows packaging and PTY tests shall run on a documented reference
  environment.

## Performance expectations

Initial budgets are acceptance targets to validate and adjust with measured evidence:

- empty desktop ready for interaction: target within 2 seconds on the reference machine;
- first shell pane interactive: target within 1 second after user launch action;
- input echo under normal load: target p95 below 100 ms;
- resize propagation: target below 150 ms after layout settles;
- four idle panes: target below 250 MB total resident memory;
- sustained-output tests: no unbounded memory trend and no UI control freeze.

These are not claims about the current repository. Phase 1 and Phase 2 establish the
reference hardware and baseline before they become release gates.

## Security boundaries

- **NFR-020:** Only explicit Tauri commands required by the pane lifecycle shall be
  exposed to the frontend.
- **NFR-021:** The backend shall not expose arbitrary filesystem APIs to the frontend.
- **NFR-022:** The selected workspace controls cwd only. Shells and external CLIs retain
  the user's normal operating-system permissions; the MVP is not a sandbox.
- **NFR-023:** Custom commands shall require a direct user action and shall not be
  started from untrusted terminal output.
- **NFR-024:** Terminal output shall be treated as untrusted display data and rendered
  through xterm.js, not inserted as application HTML.
- **NFR-025:** Terminal output and command input shall not be logged by default because
  they may contain secrets.
- **NFR-026:** The application shall not claim isolation between panes sharing a
  workspace.

## Packaging requirements

- **PKG-001:** The MVP shall produce a Windows executable and at least one installable
  Windows bundle.
- **PKG-002:** The initial recommended installer target is NSIS; changing the target
  requires documented evidence.
- **PKG-003:** A clean-machine smoke test shall cover install, launch, workspace open,
  shell start, and uninstall.
- **PKG-004:** The supported WebView2 policy and minimum Windows version shall be stated
  in release documentation.
- **PKG-005:** Code-signing availability and unsigned SmartScreen behavior shall be
  documented before public distribution.
- **PKG-006:** Packaging shall not bundle the current Node CLI into the desktop backend
  unless a later requirement explicitly needs it.

## Acceptance criteria

The desktop MVP acceptance suite shall verify:

1. A valid workspace opens and an invalid one fails visibly.
2. Shell, Codex, Claude, and Gemini launch when installed and show “not found” when not.
3. `.cmd` launchers work from a packaged app started from the Windows Start menu.
4. One through four panes use the defined fixed layouts.
5. Each pane accepts input and renders independent ANSI output.
6. Ctrl+C affects the focused PTY rather than the host app.
7. Resize, focus, zoom, close, and restart behave without cross-pane effects.
8. A spawn failure leaks no registered process or reader task.
9. Closing one of four panes leaves the other three usable.
10. Application exit leaves no supported child or descendant process in repeated tests.
11. A sustained-output test remains bounded and responsive.
12. A packaged Windows build passes install/launch/uninstall smoke testing.
13. Existing CLI commands retain their verified behavior.

## MVP Definition of Done

The MVP is done only when:

- every in-scope functional requirement has an automated or explicitly documented
  manual acceptance result;
- lifecycle tests verify real processes, not only frontend state;
- all default deterministic tests terminate naturally;
- Windows packaging succeeds from a clean checkout using documented commands;
- supported CLI launchers are tested in the packaged application;
- limitations around shared-workspace writes, PATH refresh, sandboxing, signing, and
  terminal-session persistence are documented;
- no non-goal has been pulled into the implementation plan without an approved product
  change;
- the current CLI remains available and no runtime source was rewritten merely to
  share code with the desktop application.
