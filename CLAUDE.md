# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`wsedit` — a lightweight Node.js CLI (Node 18+) for viewing and editing files
directly in the terminal, installed once and used from any workspace.

Dependencies (the whole stack — keep it this small):

- **commander** — subcommand definition and argv parsing
- **blessed** — terminal UI widgets, used only by `edit`
- **cli-highlight** — syntax highlighting for `view`
- **chalk** — colored output. **Pinned to `^4`, do not upgrade to 5.x**: chalk 5
  is ESM-only and this codebase is CommonJS, so `require("chalk")` would break.

## Commands

| Command                | Behaviour                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `wsedit ls [dir]`      | Recursive file list with paths relative to `dir`, plus a total count                      |
| `wsedit view <file>`   | Print the file highlighted, with a gray line-number gutter                                |
| `wsedit edit <file>`   | Full-screen `blessed` editor. `Ctrl+S` save, `Ctrl+Q`/`Esc` quit. Creates the file on save if missing |

`ls` skips `node_modules`, `.git`, `dist`, `build` (the `ignore` set in the `ls` action).
Running `wsedit` with no arguments prints help.

## Development

```bash
npm install
npm link                  # creates the global `wsedit` command
npm unlink -g wsedit      # remove it
```

`npm link` symlinks the global binary to this working copy, so source edits take
effect on the next `wsedit` run — no reinstall needed. Changing the `"bin"` field
in package.json does require re-running `npm link`.

There is no test runner, linter, or build step — `npm test` is still the npm-init
placeholder that exits 1. Do not add tooling unless asked.

Windows: `npm link` can fail on PowerShell execution policy. Fix documented in
README.md (`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`).

## Structure

Everything lives in a single file, `bin/wsedit.js` (~180 lines), in this order:

1. Shebang, `"use strict"`, `require` calls, `program` setup with name/description/version
2. Helpers — `guessLang(file)` (extension → highlight.js language, falling back to
   `supportsLanguage(ext)` then `"plaintext"`) and `walk(dir, base, out, ignore)`
   (recursive sync directory walk, pushes relative paths)
3. One `program.command(...)` block per subcommand: `view`, `ls`, `edit` — each
   with its `.description()` and `.action()` inline
4. `program.parse(process.argv)`, then the no-args help fallback

Keep new work inside this shape rather than introducing a `src/` module tree:

- **New subcommand** → another `program.command(...)` block following the existing pattern
- **New highlight language** → an entry in the `map` object inside `guessLang()`
- Only extract a module if a helper is genuinely shared and the file has grown
  past the point of being readable.

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
