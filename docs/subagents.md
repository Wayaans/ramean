# Subagents

Reference for the ramean subagent extension.

## Built-in subagents

- `agent` (`AG`) — general-purpose implementation and analysis worker, excluding UI/UX and front-end work
- `designer` (`DS`) — UI/UX and front-end specialist
- `reviewer` (`RV`) — read-only review and analysis specialist

## Commands

- `/agent`
  - interactive settings UI with a home menu
  - home menu:
    - `Subagent settings`
    - `Extension settings`
    - `Finish`
  - submenus include `Back`
  - after saving a setting, returns to the home menu instead of closing immediately
  - extension settings only manage `enabled`
- `/agent:prompt`
  - create or edit a project prompt override in `.pi/ramean/agents/`
  - supports `append` and `replace`
- `/agent:spawn`
  - dispatch one task directly to a subagent
  - shows temporary live status and streamlined progress above the editor while running
  - final rendered output shows the final response without transcript history
- `/agent:status`
  - shows current subagent runtime and prompt state

## Tools

- `dispatch`
  - run one subagent on one task
  - when the main agent needs multiple subagents, it should issue multiple top-level `dispatch` calls in parallel

## Orchestration behavior

There is no separate orchestration tool.

- one delegated task = one `dispatch`
- parallel delegated work = multiple top-level `dispatch` calls started by the main agent
- aggregate success/failure semantics are not computed by the extension
- the main agent interprets the individual dispatch results

## Status indicators

- `❖` — waiting
- `⚏ / ⚍ / ⚎ / ⚌` — running braille spinner
- `✔` — success
- `✖` — failed

Each status icon uses a different color. Running states animate through the braille frames.

## Config

Default and project config live in:

- `extensions/config.yaml`
- `.pi/ramean/config.yaml`

Docs-style config:

```yaml
- extension: subagent
  enabled: true
  subagents:
    agent:
      - provider: github-copilot
        model: gpt-5.4
        thinking: medium
    designer:
      - provider: github-copilot
        model: claude-sonnet-4.6
        thinking: medium
    reviewer:
      - provider: github-copilot
        model: gpt-5.4-mini
        thinking: high
```

Notes:

- legacy compact config shapes are still supported
- stale legacy `parallel.max` values are ignored silently
- project config writes are normalized to docs-style extension entries
- malformed ramean config files trigger a warning and fall back to defaults for that extension
- if a configured subagent model is unavailable, the subagent falls back to the active main-agent model with `low` thinking
- if `enabled: false`, the extension does not register `dispatch` or `/agent:spawn`
- even when disabled, `/agent`, `/agent:prompt`, and `/agent:status` stay available

## Prompt overrides

Project prompt overrides live in:

- `.pi/ramean/agents/agent.md`
- `.pi/ramean/agents/designer.md`
- `.pi/ramean/agents/reviewer.md`

Format:

```md
---
name: reviewer
mode: append
---

Hard rules:

- Example rule
```

## Rules

- subagents cannot use `dispatch`
- subagents can use normal tools, skills, commands, and read-only custom tools
- subagents cannot use the interactive question tools
  - no `question`
  - no `questionnaire`
- reviewer is read-only
  - no `edit`
  - no `write`
  - no mutating `bash`
- designer only accepts UI/UX and front-end work
- agent rejects UI/UX and front-end work

## UI

- `dispatch` shows live running, waiting, failed, and success state in messages
- completed dispatch cards keep the neutral tool background and add a left success/error accent instead of switching the whole card to a success/error fill
- running dispatch UI shows streamlined live progress from the latest subagent activity when available
- dispatch task previews are truncated to one line in the message header
- `dispatch` and `/agent:spawn` render final output without transcript history in the normal visible UI
- concurrent top-level dispatches aggregate into one shared above-editor widget
- expanded results focus on task, output, and warnings/errors
- usage tracking is not shown in the normal dispatch UI

## Files

Core implementation lives under:

- `extensions/subagents/`
- `extensions/tools/dispatch.ts`
- `extensions/commands/agent.ts`
- `extensions/commands/agent-prompt.ts`
- `extensions/commands/agent-spawn.ts`
- `extensions/commands/agent-status.ts`
