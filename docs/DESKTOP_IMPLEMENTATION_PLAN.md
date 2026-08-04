# Desktop Implementation Plan

Status: Approved plan structure; implementation has not started.

This plan implements [`DESKTOP_REQUIREMENTS.md`](DESKTOP_REQUIREMENTS.md) under the
boundaries in [`DESKTOP_ARCHITECTURE.md`](DESKTOP_ARCHITECTURE.md) and the scope fixed by
[`PRODUCT_DIRECTION.md`](PRODUCT_DIRECTION.md). It deliberately excludes worktrees,
agent orchestration, model APIs, MCP, plugins, editor features, persistence, and dynamic
layouts.

No later phase starts until the preceding phase exit gate has evidence. Commit titles
are proposed Conventional Commit sequences, not authorization to commit.

## Planning rules

- Preserve `view`, `ls`, `edit`, and `ui` throughout the MVP.
- Add only the modules that own behavior in the current phase.
- Prove one terminal end to end before building multi-pane state.
- Keep PTY output outside Vue reactive state from the first implementation.
- Test lifecycle against real processes on Windows; frontend metadata tests alone are
  insufficient.
- Measure before adding buffering libraries, state stores, process helpers, or Tauri
  plugins.
- Keep deterministic unit tests separate from explicit platform/packaging smoke tests.

## Phase 0 — Stabilize the current repository

### Objective

Create a truthful, terminating baseline for the existing CLI/TUI so desktop work does
not hide pre-existing failures. This is a narrow stabilization phase, not a refactor of
the Node application.

### Expected files/modules

- `package.json`;
- `README.md`;
- focused PTY lifecycle tests and helpers;
- `tools/phase0-check.js` and `tools/ui-smoke.js` if diagnostics require correction;
- CI configuration only if the chosen gate can terminate reliably.

### Tasks

1. Define the supported Node range from actual dependency engines and add it to package
   metadata and documentation.
2. Replace the placeholder `npm test` script with a deterministic default suite.
3. Separate deterministic tests from real-PTY and interactive-manual gates.
4. Fix lifecycle-test ownership so every PTY opened by a test is closed and the test
   runner exits naturally.
5. Diagnose the current real-PTY resize failure; record the root cause and either fix it
   or preserve it as a documented legacy limitation.
6. Re-run the Ctrl+C PTY probe and classify environment-specific behavior accurately.
7. Correct stale pass counts and avoid claiming unsupported environments.
8. Capture baseline CLI commands before any desktop scaffold is added.

### Dependencies

None beyond the approved specification.

### Risks

- ConPTY behavior may differ by Node, Windows, or terminal version.
- Expanding this phase into a TUI architecture cleanup would delay the desktop product.
- Forcing process exit in tests could hide ownership leaks rather than fix them.

### Tests

- `node bin/wsedit.js --help`;
- `node bin/wsedit.js ls`;
- `node bin/wsedit.js view package.json`;
- deterministic `npm test` gate;
- focused PTY lifecycle test with real process-death assertion;
- `node tools/phase0-check.js auto`;
- `node tools/ui-smoke.js` or an explicitly documented legacy exception.

### Acceptance criteria

- The default test command terminates and returns the real result.
- Every lifecycle test cleans all resources it creates.
- Current CLI command behavior remains unchanged.
- Known interactive/manual checks remain labeled manual or `Needs verification`.

### Exit gate

One canonical deterministic gate is green and terminating. PTY-specific failures are
either fixed with process evidence or explicitly isolated from the deterministic gate
with a documented owner and reproduction command.

### Proposed commit sequence

1. `test: define truthful repository test gates`
2. `fix: close all PTY resources created by lifecycle tests`
3. `docs: align Node and PTY support claims with evidence`

## Phase 1 — Desktop skeleton

### Objective

Create the smallest Tauri/Vue application that opens a window, displays an empty state,
and selects a workspace without starting a PTY.

### Expected files/modules

- `desktop/package.json`, Vite and TypeScript configuration;
- `desktop/index.html`, `desktop/src/main.ts`, `desktop/src/App.vue`;
- minimal `desktop/src/styles/`;
- `desktop/src-tauri/Cargo.toml`, Tauri config, capabilities, `src/lib.rs`;
- workspace-selection and validation boundary;
- desktop unit/build scripts.

### Tasks

1. Scaffold only the approved Vue 3 + TypeScript + Vite + Tauri 2 application.
2. Configure a minimal Tauri capability/CSP surface.
3. Implement empty state and native directory selection.
4. Validate the selected directory in Rust and return a canonical display path.
5. Add a singleton `useWorkspace` composable with root, panes, focus, zoom, and closing
   metadata, initially with no panes.
6. Add plain CSS tokens and a basic application frame.
7. Document development, typecheck, test, and build commands.
8. Confirm the Node CLI still runs independently from the desktop directory.

### Dependencies

- Phase 0 exit gate;
- installed Rust and Tauri prerequisites on the reference Windows machine.

### Risks

- Tauri/WebView2 prerequisites may differ from the development machine.
- Scaffold defaults may add unnecessary plugins or broad capabilities.
- Root npm workspace changes could accidentally couple the legacy CLI and desktop.

### Tests

- frontend typecheck and unit test harness;
- Rust unit tests for workspace validation;
- desktop development launch smoke;
- empty-state screenshot/manual visual check;
- existing CLI baseline commands.

### Acceptance criteria

- Desktop opens and displays an empty state.
- User can select a valid directory and sees its path.
- Invalid directory errors are visible.
- No PTY or child process is created.
- No Pinia, Nuxt, UI framework, database, or generic shared package is added.

### Exit gate

A clean checkout can run the documented desktop development command, select a
workspace, and pass frontend/Rust checks while the existing CLI baseline remains green.

### Proposed commit sequence

1. `feat(desktop): add minimal Vue and Tauri application`
2. `feat(desktop): open and validate a workspace directory`
3. `test(desktop): add skeleton build and workspace checks`

## Phase 2 — Single interactive terminal PTY

### Objective

Prove the complete Vue ↔ Tauri ↔ Rust ↔ PTY path with one shell terminal, including
streaming, input, resize, exit, and cleanup.

### Expected files/modules

- `TerminalPane.vue` and `usePaneTerminal.ts`;
- narrow typed Tauri wrapper and desktop contract types;
- Rust command, error, event, launcher, PTY manager, and single-process modules;
- focused frontend, Rust, and Windows integration tests.

### Tasks

1. Add xterm.js and only the addons proven necessary for measurement/rendering.
2. Create one xterm instance in `TerminalPane`, dispose it on unmount, and keep it out
   of shared state.
3. Define pane ID and generation types at the frontend/backend boundary.
4. Implement `create`, `write`, `resize`, and `close` for one shell PTY.
5. Stream output through pane/generation-scoped events directly into xterm.
6. Measure output event throughput and choose an ordered bounded chunk representation.
7. Coalesce ResizeObserver changes and reject zero dimensions.
8. Observe process exit exactly once and leave the pane available for inspection.
9. Implement bounded close and verify process death.
10. Test PowerShell, Unicode cwd, spaces in paths, ANSI, paste, Ctrl+C, and high output.

### Dependencies

- Phase 1 exit gate;
- `portable-pty` support on the reference Windows environment.

### Risks

- `portable-pty` descendant cleanup may not match legacy `node-pty` behavior.
- Tauri event serialization can become a bottleneck.
- Chunk boundaries can corrupt multibyte output if decoded incorrectly.
- xterm measurement can briefly produce invalid dimensions during mount.

### Tests

- Rust unit tests for registry validation and stale generations;
- real PTY integration test for create/write/resize/exit/close;
- frontend test proving output bypasses reactive state;
- ANSI and Unicode smoke;
- sustained-output latency and memory measurement;
- repeated close and app-exit orphan checks.

### Acceptance criteria

- One shell terminal is fully interactive.
- Output is realtime and correctly routed.
- Ctrl+C reaches the child without closing the app.
- Resize reaches the correct PTY with valid dimensions.
- Closing the pane is idempotent and leaves no tested process behind.
- No output or scrollback is stored in the workspace composable.

### Exit gate

The single-terminal acceptance scenario passes repeatedly in development and test
builds on Windows, including high-output and orphan-process checks.

### Proposed commit sequence

1. `feat(desktop): render one xterm terminal pane`
2. `feat(desktop): manage one portable PTY process`
3. `feat(desktop): stream terminal input and output`
4. `feat(desktop): resize and close the terminal safely`
5. `test(desktop): verify PTY throughput and process cleanup`

## Phase 3 — Multi-pane fixed grid

### Objective

Extend the proven single-terminal model to one through four independent panes with
fixed layout, focus, close, restart, and zoom.

### Expected files/modules

- workspace view, pane grid, pane toolbar, and launcher dialog components;
- pane metadata actions in `useWorkspace`;
- PTY manager registry generalized to four records;
- CSS grid templates and responsive minimum-window rules;
- multi-pane lifecycle and isolation tests.

### Tasks

1. Generalize the backend registry without introducing a service container or event bus.
2. Enforce the four-pane maximum in both UI affordances and backend validation.
3. Implement fixed layouts: 1×1, two columns, three-pane primary-plus-stack, and 2×2.
4. Implement focus selection and a visible focused-pane treatment.
5. Implement add and close with running-process confirmation.
6. Implement restart with stable pane ID and incremented generation.
7. Implement zoom without unmounting or restarting hidden panes.
8. Resize every pane whose visible dimensions changed.
9. Ignore late output and exit events from stale generations.
10. Verify closing one pane does not affect the other three.

### Dependencies

Phase 2 exit gate.

### Risks

- Concurrent output can expose event-routing or lock contention bugs.
- Zooming by unmounting components would lose xterm state or frontend subscriptions.
- Resize storms can overload the backend.
- Closing metadata before backend confirmation can orphan a process.

### Tests

- frontend layout tests for one through four panes and zoom;
- maximum-pane and focus state tests;
- backend registry concurrency and stale-generation tests;
- four real PTYs with distinct marker output;
- close one of four and verify the other three remain interactive;
- restart under late output/exit events;
- resize and zoom stress smoke.

### Acceptance criteria

- One through four panes render in the specified fixed layouts.
- Input and output never cross pane IDs.
- Focus and zoom do not restart processes.
- Restart cannot create two live generations for one pane.
- Add is unavailable at four panes.
- Close-one-of-four cleanup is verified by process identity.

### Exit gate

The four-pane interaction and lifecycle suite passes repeatedly without output mixing,
stale-event state corruption, UI freeze, or orphan processes.

### Proposed commit sequence

1. `feat(desktop): add fixed terminal pane grid`
2. `feat(desktop): add pane focus close and zoom`
3. `feat(desktop): restart panes with generation isolation`
4. `test(desktop): verify four independent PTY panes`

## Phase 4 — Agent launcher and Windows command handling

### Objective

Add reliable Shell, Codex, Claude, Gemini, and custom-command launch flows using the
same Windows environment for detection and spawn.

### Expected files/modules

- launcher dialog and profile presentation;
- Rust launch profiles and command detection;
- PATH/PATHEXT and `.cmd`/`.bat` handling;
- diagnostics/error presentation;
- Windows launcher fixtures and integration tests.

### Tasks

1. Define the four fixed launch profile IDs and custom-command input.
2. Detect availability from backend PATH/PATHEXT with safe resolved-path diagnostics.
3. Use `pwsh` → `powershell.exe` → `cmd.exe` for the Shell profile.
4. Spawn `.cmd` and `.bat` launchers through an appropriate command shell.
5. Preserve arguments and paths with spaces without unsafe string concatenation.
6. Add refresh detection, relaunch guidance, and absolute custom path support.
7. Keep profile availability separate from process running status.
8. Launch real installed Codex, Claude, and Gemini CLIs in manual/reference-machine tests.
9. State clearly that launch profiles are not orchestrated agents.

### Dependencies

Phase 3 exit gate.

### Risks

- Explorer-launched PATH can be stale after CLI installation.
- npm-installed CLIs commonly resolve to `.cmd` shims.
- Shell quoting rules differ among PowerShell and cmd.exe.
- A command may be detected but still fail due to its own runtime/configuration.

### Tests

- unit tests with synthetic PATH/PATHEXT directories;
- `.exe`, `.cmd`, `.bat`, missing command, spaces, Unicode, and arguments cases;
- detection/spawn parity test;
- packaged-style launch environment test;
- manual interactive acceptance for each installed supported CLI.

### Acceptance criteria

- All installed profiles are detected and start using the same environment.
- Missing commands show a useful error and recovery path.
- `.cmd` launchers work interactively.
- Custom commands with spaces and arguments work without injection-prone construction.
- No output parsing or agent status inference is introduced.

### Exit gate

Shell and all available supported CLIs launch interactively from a Windows GUI-started
test build; unavailable profiles fail clearly without leaked processes.

### Proposed commit sequence

1. `feat(desktop): detect supported CLI launchers`
2. `feat(desktop): launch Windows command shims safely`
3. `feat(desktop): add custom command pane flow`
4. `test(desktop): verify GUI PATH and launcher behavior`

## Phase 5 — Process lifecycle hardening

### Objective

Make pane close, restart, close-all, and application exit deterministic under normal,
hung, nested, and failing process conditions.

### Expected files/modules

- PTY manager and process termination implementation;
- Tauri window/application lifecycle hooks;
- close confirmation and aggregate cleanup UI;
- Windows process-tree probes and fixtures;
- lifecycle diagnostics.

### Tasks

1. Measure graceful and forced termination behavior for the default shell and supported
   CLIs, including descendant processes.
2. Set evidence-based per-pane and total shutdown deadlines.
3. Ensure reader tasks end and registry records are removed exactly once.
4. Make close and close-all idempotent under concurrent exit events.
5. Prevent new pane actions after application shutdown begins.
6. Attempt cleanup of all panes even when one fails.
7. Decide from evidence whether Windows job-object ownership or another mechanism is
   required; add it only if `portable-pty` is insufficient.
8. Handle startup failure, reader failure, forced termination, and unverified cleanup.
9. Run repeated close/restart/exit stress tests and inspect real PIDs/markers.

### Dependencies

Phase 4 exit gate.

### Risks

- Force-killing a shell may not kill every descendant.
- Aggressive termination can affect the wrong process if identity is reused or stale.
- Waiting indefinitely can hang application exit and installers.
- Hiding cleanup errors can create false confidence.

### Tests

- close already exited, close twice, close during start, and simultaneous close/exit;
- one-of-four close and restart stress;
- nested long-running descendant process probes;
- hung process forced-close case;
- close-all with one injected failure;
- repeated window-close and host-exit orphan checks;
- frontend shutdown-state tests.

### Acceptance criteria

- Every created resource has one idempotent disposal path.
- No stale process can receive input or resize after restart.
- Close-all returns a per-pane outcome and attempts every pane.
- Supported process trees are dead after app exit in repeated Windows tests.
- Unverified cleanup is reported as failure, not success.

### Exit gate

All lifecycle stress tests terminate naturally and pass the process-tree checks on the
reference Windows environment. Any unsupported descendant behavior is explicitly
documented and blocks public MVP release if it affects supported launchers.

### Proposed commit sequence

1. `refactor(desktop): centralize PTY generation disposal`
2. `fix(desktop): harden pane restart and close races`
3. `feat(desktop): close all panes on application exit`
4. `test(desktop): verify Windows process tree cleanup`

## Phase 6 — Windows packaging

### Objective

Produce an installable Windows MVP candidate and validate behavior outside the
development shell.

### Expected files/modules

- Tauri bundle metadata and capabilities;
- icons and Windows resources;
- release/build scripts and documentation;
- NSIS configuration if customization is required;
- clean-machine packaging checklist or automation.

### Tasks

1. Finalize product name, bundle identifier, version source, and icons.
2. Build the release executable and NSIS installer.
3. Document Rust, Node, WebView2, and Windows prerequisites for builders and users.
4. Install and launch from Start menu to verify GUI PATH behavior.
5. Test workspace paths with spaces and Unicode after installation.
6. Run the supported launcher and lifecycle suite against the packaged app.
7. Verify uninstall behavior and user-data policy; MVP should not create a database.
8. Document code-signing status and SmartScreen implications.
9. Record application size, startup time, and memory measurements.

### Dependencies

Phase 5 exit gate and release identity decisions.

### Risks

- Development builds can pass while packaged capabilities or PATH differ.
- Unsigned installers can trigger warnings.
- WebView2 availability varies across Windows installations.
- Native artifacts may accidentally depend on the development machine.

### Tests

- clean release build from documented commands;
- installer install/launch/uninstall smoke;
- Start-menu PATH and `.cmd` launcher test;
- packaged four-pane and app-exit smoke;
- binary/dependency inspection as appropriate;
- startup, memory, and footprint measurement.

### Acceptance criteria

- Executable and NSIS installer are produced reproducibly.
- Installed app opens a workspace and runs supported terminals.
- Packaged lifecycle tests leave no supported child processes.
- Minimum Windows/WebView2 and signing status are documented.
- The existing Node CLI remains separately usable.

### Exit gate

A clean-machine or clean-VM checklist passes installation through uninstall, including
real launcher and process cleanup tests.

### Proposed commit sequence

1. `build(desktop): configure Windows release bundle`
2. `docs(desktop): document Windows installation requirements`
3. `test(desktop): add packaged application smoke checklist`

## Phase 7 — MVP polish

### Objective

Resolve usability and reliability issues found through real daily use without adding
new product domains.

### Expected files/modules

- existing desktop components, styles, error messages, and focused tests;
- accessibility and keyboard behavior;
- performance thresholds and release documentation.

### Tasks

1. Run the full MVP acceptance checklist with real supported CLIs.
2. Refine empty, starting, exited, missing-command, and cleanup-error states.
3. Finalize keyboard shortcuts without stealing normal terminal keys.
4. Validate focus visibility, zoom recovery, minimum window size, and high-DPI behavior.
5. Tune output batching, scrollback, and resize coalescing from measurements.
6. Check keyboard-only access and accessible names for non-terminal controls.
7. Verify no terminal output, input, or secrets are logged by default.
8. Update user documentation, known limitations, and troubleshooting.
9. Re-run current CLI regression gates and packaged desktop gates.

### Dependencies

Phase 6 exit gate.

### Risks

- Polish can become a path for deferred features such as themes or persistence.
- Keyboard shortcuts may conflict with hosted CLIs.
- Performance tuning without repeatable benchmarks can cause regressions.

### Tests

- all requirement acceptance cases;
- keyboard and focus tests;
- high-output and resize regression benchmarks;
- four-pane real-CLI soak;
- packaged install/launch/exit test;
- CLI compatibility tests.

### Acceptance criteria

- Every MVP requirement has evidence or an explicit approved exception.
- No known critical process leak, output mixing, or stale-generation bug remains.
- Errors are actionable and the fixed layout is usable at documented minimum size.
- Non-goals remain outside the codebase and roadmap commitments.

### Exit gate

The `DESKTOP_REQUIREMENTS.md` MVP Definition of Done is satisfied and a packaged
Windows release candidate passes the complete acceptance run.

### Proposed commit sequence

1. `fix(desktop): resolve MVP usability findings`
2. `perf(desktop): tune terminal streaming and resize behavior`
3. `docs(desktop): finalize MVP usage and limitations`
4. `chore(desktop): prepare Windows MVP release candidate`

## Post-MVP candidates

Post-MVP ideas are evaluated separately and are not implementation commitments:

- limited layout/session persistence;
- custom terminal themes;
- Git worktree isolation;
- advanced split layouts;
- an updater;
- additional platforms.

None of these should be scaffolded during the MVP phases.
