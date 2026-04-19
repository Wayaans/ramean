# AGENTS.md

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
