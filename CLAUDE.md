# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`wsedit` — a lightweight Node.js CLI (Node 18+) for viewing and editing files
directly in the terminal, installed once and used from any workspace.

Dependencies (the whole stack — keep it this small):

- **commander** — subcommand definition and argv parsing
- **blessed** — terminal UI widgets, used by `edit` and the whole `ui` layer
- **cli-highlight** — syntax highlighting for `view`
- **chalk** — colored output. **Pinned to `^4`, do not upgrade to 5.x**: chalk 5
  is ESM-only and this codebase is CommonJS, so `require("chalk")` would break.

`optionalDependencies` — **`blessed-xterm`** + **`node-pty`**, used only by the
terminal panel inside `ui`. They are optional on purpose: if they fail to install,
every other part of `ui` must still run. Load them through the `optional()` helper
in `src/commands/ui.js`, never with a bare top-level `require`.

## Commands

| Command                | Behaviour                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `wsedit ls [dir]`      | Recursive file list with paths relative to `dir`, plus a total count                      |
| `wsedit view <file>`   | Print the file highlighted, with a gray line-number gutter                                |
| `wsedit edit <file>`   | Full-screen `blessed` editor. `Ctrl+S` save, `Ctrl+Q`/`Esc` quit. Creates the file on save if missing |
| `wsedit ui [dir]`      | Workspace UI: file tree + multi-file tabs + editor + terminal panel                       |

`ls` skips `node_modules`, `.git`, `dist`, `build` (the `ignore` set in the `ls` action).
Running `wsedit` with no arguments prints help.

`ui` refuses to start without a real TTY — that is deliberate, not a bug to work
around. It is why headless tests can only assert the refusal; see Testing below.

## Development

```bash
npm install
npm link                  # creates the global `wsedit` command
npm unlink -g wsedit      # remove it
```

`npm link` symlinks the global binary to this working copy, so source edits take
effect on the next `wsedit` run — no reinstall needed. Changing the `"bin"` field
in package.json does require re-running `npm link`.

There is no linter or build step. Do not add tooling unless asked.

Windows: `npm link` can fail on PowerShell execution policy. Fix documented in
README.md (`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`).

## Testing

```bash
node --test                    # unit tests — 37 as of v1
node tools/ui-smoke.js         # runs `wsedit ui` inside a real pty and types at it
node tools/phase0-check.js     # re-verifies the PHASE0 terminal findings
```

**`npm test` is still the npm-init placeholder and exits 1** — it is not the gate.
Use bare `node --test`.

**Do not write `node --test test/`** — on Windows Node treats the directory as an
entrypoint module and the run fails. Bare `node --test` discovers `test/` correctly.

The two layers catch different things, so run both:

- `node --test` builds a blessed screen on fake TTY streams. The output sink must be
  a `stream.Writable` whose `_write` calls its callback exactly once — a `PassThrough`
  throws `ERR_MULTIPLE_CALLBACK` — and needs `isTTY = true` plus integer `columns`/`rows`.
- `tools/ui-smoke.js` is the only thing that exercises real key routing. Every
  integration bug found so far — the explorer receiving no keys, one `Enter` handled
  twice, `Ctrl+P` crashing the app — was invisible to `node --test`. It also checks
  that quitting leaves no orphaned child process.

## Structure

`bin/wsedit.js` is now **pure wiring** (~40 lines): requires, `program` setup, one
`program.command(...)` block per subcommand delegating to an action in `src/commands/`,
`program.parse`, no-args help fallback. Put no logic there.

```
src/commands/   view.js  ls.js  edit.js  ui.js       one action per subcommand
src/core/       no blessed, no node-pty — pure logic, unit-testable
src/ui/         blessed widgets — no file IO
```

`src/core/` — `language.js` (extension → highlight.js language), `fs-tree.js` (one
directory level, dirs before files), `text-buffer.js` (line array, mutates in place,
preserves the file's original EOL), `workspace-state.js` (state + `onChange`),
`keymap.js` (focus-aware dispatcher), `fuzzy.js`, `file-index.js`.

`src/ui/` — `layout.js` (integer geometry for 7 regions), `explorer.js`, `editor-view.js`,
`tab-bar.js`, `status-bar.js`, `prompt.js`, `quick-open.js`, `terminal-panel.js`.

`src/commands/ui.js` is the only place these meet: it builds the screen, mounts the
widgets, owns `actions`, and routes keys.

Three boundaries that are **load-bearing** — breaking any of them was a real bug here,
not a hypothetical:

- **`src/core/` must not require `blessed` or `node-pty`.** That is what keeps it
  testable headlessly. `src/ui/` may require blessed but must do no file IO —
  it calls `actions.openFile(path)` instead.
- **Widgets follow the factory contract** in `docs/agents/CONTRACTS.md`:
  `create<Name>({ screen, state, geometry, actions })` → `{ element, render(),
  setGeometry(g), destroy() }`. `render()` must not call a mutator or `emitChange()`
  (infinite render loop), and a widget must never `throw` inside a blessed event
  handler — that becomes an `uncaughtException` and leaves the user's shell broken.
  Report errors via `actions.notify` instead.
- **Sizes passed to `blessed-xterm` must be integers**, never `"100%"` — its
  constructor resolves size before attach and throws on a percentage.

Adding work: new subcommand → `src/commands/<name>.js` + a block in `bin/wsedit.js`.
New highlight language → the `map` in `src/core/language.js`. New widget → `src/ui/`,
following the factory contract.

`docs/agents/PHASE0.md` records measured terminal findings and **overrides SPEC.md**
where they disagree. `docs/agents/BOARD.md` tracks task ownership.

## Coding style

Match the existing file exactly:

- **CommonJS** (`require`, no `"type": "module"` in package.json), `"use strict"` at the top
- Double-quoted strings, semicolons, 2-space indent
- Synchronous `fs` calls (`readFileSync`, `writeFileSync`, `readdirSync`) — this is
  a short-lived CLI process, so sync IO is deliberate and fine
- `console.log` for output, `console.error` + `process.exit(1)` for failures
- All user-facing text is **Vietnamese** — command descriptions, error messages,
  status lines, and the `edit` footer. Keep new strings Vietnamese; code
  identifiers and comments stay English
- `chalk` for all color: `chalk.red` errors, `chalk.gray` secondary info,
  `chalk.green` success
- Section comments in the `// ---------- name ----------` style separate the blocks
- Validate paths with `fs.existsSync` after `path.resolve(process.cwd(), file)`
  and fail with a readable message before doing work

## Terminal behaviour

- `edit` takes over the screen. Its layout is fixed: `header` (row 0),
  `textarea` (`100%-3`), `status` (row above footer, transient messages with a TTL),
  `footer` (key hints). Height math must stay consistent if a bar is added or removed.
- Quitting goes through `process.exit(0)`; `blessed` restores the terminal on
  process exit. Any new exit path must not bypass that, or the user's shell is
  left in a broken state.
- `Esc` and `Ctrl+Q` quit immediately and discard unsaved edits — intentional
  today, so don't add a confirmation prompt without being asked.

For `ui` specifically:

- **The exit path is `screen.destroy()` then `process.exit(0)`. Never call
  `pty.kill()`** — it makes ConPTY's helper crash with `AttachConsole failed` and
  dump a stack over the restored terminal. ConPTY cleans up its children on exit
  by itself; PHASE0 §7 verified no orphans remain.
- Setting `state.focus` is **not** enough to route keys. blessed only delivers
  keypresses to the currently focused element, so `applyFocus()` must also focus the
  matching blessed element.
- The terminal panel may keep only **two** reserved keys (`` Ctrl+` `` and `F6`) out
  of the pty. Every other key belongs to the agent running inside the pane. Keys that
  manage terminals therefore only fire when focus is *not* on the terminal.
- Known limitation (PHASE0 §4): resize reaches ConPTY, but child Node processes are
  not notified automatically, so a Node/ink-based agent may not re-layout. Not fixable
  from the parent.
