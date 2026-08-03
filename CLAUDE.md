# CLAUDE.md — Claude Code Project Instructions

`AGENTS.md` is the canonical development rule set for this repository. Claude Code
must read and follow it completely before planning, editing, reviewing, or delegating
work. The rules below are Claude-specific additions and a safety summary; they do not
replace `AGENTS.md`.

## Required reading order

1. `AGENTS.md`
2. The current user request and referenced files
3. `MILESTONE.md`
4. `REFACTOR_PLAN.md`
5. `ARCHITECTURE_REVIEW.md`
6. Relevant current source and tests
7. Historical specs only when needed for compatibility

Do not treat `SPEC-multi-agent.md` or `docs/agents/**` as proof that a structured
multi-agent runtime exists. The current PTY panel hosts external processes; it does
not provide internal agent orchestration, durable tasks, permissions, or provider
stream semantics.

## Claude-specific working rules

- Plan from verified repository evidence, not assumed framework conventions.
- Follow the commit and milestone dependency order in `MILESTONE.md` unless the user
  explicitly reprioritizes it.
- Prefer a small vertical slice with tests over a broad scaffold.
- Do not create empty target folders merely to resemble `FOLDER_STRUCTURE.md`.
- Preserve the current CommonJS style in existing `bin/**` and `src/**` files.
- Use strict TypeScript only for new packages introduced by their approved milestone;
  do not perform an unsolicited whole-repository conversion.
- Keep the existing CLI/TUI operational during the strangler migration.
- Do not expose mutable UI state, Blessed objects, PTY handles, storage adapters, or
  provider SDK types as public runtime or plugin APIs.
- Do not implement model-callable writes, shell execution, MCP, or plugin tools before
  workspace containment and the shared permission/execution boundary exist.
- Never equate terminal tabs with tasks or agents.
- Do not build web or VSCode business logic outside the shared runtime protocol.

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
- For workspace work, test real path containment including platform-specific links.
- For events/storage, prove replay and migration behavior.
- For public contracts, verify that infrastructure and vendor types do not leak.

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
