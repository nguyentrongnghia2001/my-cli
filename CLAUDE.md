# CLAUDE.md — Claude Code Project Instructions

`AGENTS.md` is the canonical development rule set for this repository. Claude Code
must read and follow it completely before planning, editing, reviewing, or delegating
work. The rules below are Claude-specific additions and a safety summary; they do not
replace `AGENTS.md`.

## Required reading order

1. `AGENTS.md`
2. The current user request and referenced files
3. `docs/PRODUCT_DIRECTION.md`
4. `docs/DESKTOP_REQUIREMENTS.md`
5. `docs/DESKTOP_ARCHITECTURE.md`
6. `docs/DESKTOP_IMPLEMENTATION_PLAN.md`
7. `docs/ROADMAP.md`
8. Relevant current source and tests
9. Historical documents only when needed for existing CLI compatibility or evidence

Do not treat `MILESTONE.md`, `REFACTOR_PLAN.md`, `FOLDER_STRUCTURE.md`,
`SPEC-multi-agent.md`, or `docs/agents/**` as active product plans. They are historical.
The current PTY panel hosts external processes; neither the CLI nor the planned desktop
implements internal agent orchestration, model APIs, durable tasks, MCP, or plugins.

## Claude-specific working rules

- Plan from verified repository evidence, not assumed framework conventions.
- Follow the phase and exit-gate order in `docs/DESKTOP_IMPLEMENTATION_PLAN.md` unless
  the user explicitly reprioritizes it.
- Prefer a small vertical slice with tests over a broad scaffold.
- Do not create empty target folders merely to resemble a planned architecture.
- Preserve the current CommonJS style in existing `bin/**` and `src/**` files.
- Use strict TypeScript in the desktop frontend; do not convert the current CLI/TUI.
- Keep the existing CLI/TUI operational during the additive desktop migration.
- Add the desktop application under `desktop/`; do not create a monorepo or shared
  package without an approved concrete use case.
- Keep terminal output outside Vue reactive state and keep PTY ownership in Rust.
- Do not add Pinia, Nuxt, a UI framework, database, model runtime, MCP, plugins,
  worktrees, orchestration, editor features, or a dynamic layout tree to the MVP.
- Never equate a launch profile or external CLI process with an internal agent model.

## Delegation

When delegation is explicitly requested:

- Assign bounded tasks with non-overlapping file ownership.
- Give each subagent the relevant contract, acceptance criteria, and test command.
- Keep architecture decisions and shared contract changes with one owner.
- Review delegated output against current files; do not accept summaries as proof.
- Do not allow concurrent writers to edit the same files or working tree area without
  explicit coordination.

## Verification and reporting

- Run focused tests first, then relevant regression gates.
- Current known baseline issues are documented in `AGENTS.md`; report them honestly
  until the corresponding milestone commits fix them.
- Never add `process.exit()` merely to make a hanging test appear green.
- For terminal work, verify process-tree cleanup and terminal restoration, not only
  in-memory tab state.
- For desktop workspace work, verify cwd validation and Windows paths with spaces and
  Unicode; do not claim the workspace is a sandbox.
- For terminal work, test pane/generation routing, bounded output, resize, and real
  process-tree cleanup.
- For packaging work, verify the installed GUI-started application, not only dev mode.

## Repository safety

- Do not commit, push, publish, install global tools, or rewrite history without an
  explicit user request.
- Preserve unrelated working-tree changes.
- Do not silently update dependencies or lockfiles.
- Do not modify source when the request is documentation-only.

## Rule maintenance

Shared project rules belong in `AGENTS.md`. When a shared rule changes, update the
summary or Claude-specific implication here in the same change so the two files do
not contradict each other.
