# AGENTS.md

## Agent skills

Before using ask-me, ask-me-with-docs, create-prd, create-plans, assessing, build-me, setup-me, or related agent skill workflows, read and respect the relevant setup docs under `docs/agents/`:

- `docs/agents/domain-structure.md` for context docs, design docs, ADRs, and domain layout.
- `docs/agents/work-tracker.md` for PRDs, plans, assessment gate status, reviews, artifact paths, testing, and review policy.
- `docs/agents/interaction-policy.md` for question delivery and shared question format.

## Source of truth

- Always read the relevant files in `docs/` before making non-trivial changes.
- Treat `docs/` as the primary source of truth for behavior, architecture, UI expectations, and repository conventions.
- If a task touches subagents, read these first:
  - `docs/subagents.md`
  - `docs/guidelines/subagents.md`
  - `docs/installation_guides.md`
  - `docs/project_structure.md`
  - relevant files in `docs/plans/` when the task is tied to an active or historical plan
- When code changes behavior, update the matching documentation in `docs/`.

## Package context

- This repository is `ramean`.
- Ramean is a personal collection of extensions for `pi-coding-agent`.
- Right now, the only available extension set in this repo is the subagent extension.

## Tooling

- This repo uses **Bun**.
- Use only Bun-based commands for dependency management, testing, and local TypeScript workflows.
- Do not use `npm`, `pnpm`, or `yarn`.

## Bun + TypeScript development rules

- Install dependencies with:
  - `bun install`
- Run tests with:
  - `bun test`
- Run TypeScript type-checking with:
  - `bunx tsc --noEmit`
- Prefer Bun for one-off TypeScript-compatible local commands.
- Keep changes compatible with the repo's ESM + TypeScript setup in `package.json` and `tsconfig.json`.

## Coding expectations

- Read existing code and docs before editing.
- Prefer small, targeted changes over broad rewrites unless the task requires a rewrite.
- Keep documentation and tests aligned with behavior changes.
- When changing extension behavior, check whether updates are needed in:
  - `docs/subagents.md`
  - `docs/guidelines/subagents.md`
  - `docs/installation_guides.md`
  - `README.md`
  - `extensions/tests/`

## Validation

- At minimum, run:
  - `bun test`
- When TypeScript-sensitive code changes, also run:
  - `bunx tsc --noEmit`

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
