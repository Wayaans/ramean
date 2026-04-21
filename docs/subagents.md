# Subagents

Reference for the ramean subagent extension.

## Built-in subagents

- `agent` (`AG`) — non-UI implementation specialist for debugging, refactors, tests, tooling, and codebase analysis
- `designer` (`DS`) — UI/UX and front-end implementation specialist for accessibility, responsiveness, and polish
- `reviewer` (`RV`) — read-only reviewer for critique, validation, and final-pass analysis

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
- `/agent:insert`
  - insert or refresh a managed subagent hard-rule block in an existing project `AGENTS.md`
  - preserves existing content and appends the managed block by default
  - optional position: `/agent:insert top` or `/agent:insert bottom`
- `/agent:prompt`
  - create or edit a project prompt override in `.pi/ramean/agents/`
  - supports `append` and `replace`
- `/agent:spawn`
  - dispatch one task directly to a subagent
  - shows temporary live status and streamlined progress above the editor while running
  - final rendered output shows the final response without transcript history
- `/agent:expand`
  - toggles dispatch-only expansion for subagent dispatch cards
  - optional args: `toggle`, `expand`, `collapse`, and `status`
  - leaves other tool output unchanged
  - state is session-local and resets on reload
- `/agent:status`
  - shows current subagent runtime, prompt state, and whether the extension is enabled

## Tools

- `dispatch`
  - run one subagent on one task
  - route by task shape: implementation work goes to `agent` or `designer`; review, audit, critique, and final-pass validation go to `reviewer`
  - if a task needs both implementation and review, dispatch `agent` or `designer` first, then dispatch `reviewer` as a separate pass
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
- ramean config writers prefer docs-style extension entries for the settings they update
- malformed ramean config files trigger a warning and fall back to default project config behavior
- if a configured subagent model is unavailable, the subagent falls back to the active main-agent model with `low` thinking
- if `enabled: false`, the extension does not register `dispatch` or `/agent:spawn`
- even when disabled, `/agent`, `/agent:expand`, `/agent:insert`, `/agent:prompt`, and `/agent:status` stay available

## Prompt overrides

Each dispatch also adds a small role-specific per-run reminder so `agent` and `designer` default to implementation mode while `reviewer` stays in review mode.

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
- subagents preserve the current active tool selection and only remove tools that are disallowed for that role
- subagents can use normal tools, skills, commands, and read-only custom tools
- subagents cannot use mutating or interactive custom tools
  - no `todo_write`
  - no `question`
  - no `questionnaire`
- reviewer is read-only
  - no `edit`
  - no `write`
  - no mutating `bash`
- dispatch does not do keyword or phrase based task classification before launch
- subagent scope boundaries are enforced primarily by the subagent prompts themselves, plus a small role-specific per-run reminder that reinforces implementation-first routing
- if a delegated task is out of scope, the subagent should refuse briefly, point to the correct subagent, and stop
- route by task shape first
  - implementation-shaped non-UI work belongs to `agent`
  - implementation-shaped UI/UX and front-end work belongs to `designer`
  - review-shaped, audit-shaped, critique-shaped, and final-pass validation work belong to `reviewer`
- if a task needs both implementation and review, dispatch `agent` or `designer` first, then dispatch `reviewer` as a separate pass
- reviewer is for read-only review, critique, validation, and analysis
  - use reviewer after implementation when a final validation pass is warranted
- designer is for UI/UX and front-end implementation work
  - critique-only, feedback-only, advisory-only, and planning-only tasks should be refused by the designer prompt
  - when the user wants the UI changed, fixed, built, or polished, prefer `designer` over `reviewer`
- agent is for non-UI implementation work such as debugging, refactors, tests, tooling, and focused codebase analysis
  - UI/UX and review-only tasks should be refused by the agent prompt
  - when the user wants non-UI code changed, prefer `agent` over `reviewer`

## UI

- `dispatch` shows live running, waiting, failed, and success state in messages
- completed dispatch cards keep the neutral tool background and add a left success/error accent instead of switching the whole card to a success/error fill
- running dispatch UI shows streamlined live progress from the latest subagent activity when available
- dispatch task previews are truncated to one line in the message header
- `dispatch` and `/agent:spawn` render final output without transcript history in the normal visible UI
- `Ctrl+Shift+O` toggles dispatch-only expansion for subagent dispatch cards without changing other tool output
- `/agent:expand` provides the same dispatch-only expansion control from the command line
- dispatch-only expansion state is session-local and resets on reload
- concurrent top-level dispatches aggregate into one shared above-editor widget
- while that widget is active, ramean also switches the normal streaming working indicator to a matching animated dispatch spinner
- expanded results focus on task, output, and warnings/errors
- usage tracking is not shown in the normal dispatch UI

## Files

Core implementation lives under:

- `extensions/subagents/`
- `extensions/tools/dispatch.ts`
- `extensions/commands/agent.ts`
- `extensions/commands/agent-expand.ts`
- `extensions/commands/agent-insert.ts`
- `extensions/commands/agent-prompt.ts`
- `extensions/commands/agent-spawn.ts`
- `extensions/commands/agent-status.ts`
- `extensions/subagents/dispatch-expansion.ts`
