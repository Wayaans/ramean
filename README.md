# Ramean

Ramean is my personal collection of extensions for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

Right now this repository ships one extension set: **subagents**.

## What is in this repo today?

The current package adds a subagent workflow for Pi with:

- a `dispatch` tool for delegating one task to one subagent
- built-in subagents:
  - `agent` — general-purpose implementation and analysis
  - `designer` — UI/UX and front-end work
  - `reviewer` — read-only review and analysis
- commands for configuration, prompt overrides, direct spawning, and status
- custom UI for dispatch progress and results
- project-level configuration and prompt overrides

There is no separate orchestration tool. When the main agent needs parallel subagent work, it should issue multiple top-level `dispatch` calls.

## Documentation

The `docs/` directory is the source of truth for this repository.

Start here:

- `docs/subagents.md` — current subagent behavior and user-facing reference
- `docs/guidelines/subagents.md` — implementation and UI guidelines
- `docs/installation_guides.md` — install and setup notes
- `docs/project_structure.md` — repository layout
- `docs/plans/` — current and historical plans

## Install

Install this repository as a Pi package:

```bash
pi install /absolute/path/to/ramean
```

Or add it to project settings:

```json
{
  "packages": ["/absolute/path/to/ramean"]
}
```

## Repository layout

Main areas:

- `extensions/` — the actual Pi extension code
- `docs/` — repo guidelines, behavior docs, and plans
- `AGENTS.md` — instructions for coding agents working in this repo

## Development

This repo uses **Bun** for development.

### Requirements

- Bun
- TypeScript
- Pi-compatible peer dependencies available in your environment

### Install dependencies

```bash
bun install
```

### Run tests

```bash
bun test
```

### Type-check

If you want to run TypeScript directly with Bun tooling, use:

```bash
bunx tsc --noEmit
```

## Notes

- Use Bun commands, not npm, pnpm, or yarn.
- Keep docs in `docs/` in sync with behavior changes.
- If this repo grows beyond subagents, the README should describe the additional extension sets here.
