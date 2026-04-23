# Subagent extension inside the ramean pi package

Goal: keep the subagent extension lightweight, easy to understand, and easy to drop into any project.

Subagents should always be available to the main agent with clear instructions, predictable behavior, and clear limits.

## Agents

- Agent : `AG`
  - prompted subagent for implementation-shaped non-UI work such as debugging, refactors, tests, tooling, and codebase analysis
  - not for UI/UX or front-end work
  - not for review-only work when reviewer is the better fit
- Designer : `DS`
  - prompted subagent for implementation-shaped UI/UX and front-end work such as layout, components, styling, accessibility, responsive behavior, and polish
  - not for critique, feedback, review, or planning-only guidance
- Reviewer : `RV`
  - prompted subagent for read-only review, critique, validation, and analysis
  - used after implementation when a final validation pass is warranted
  - read-only

## Commands

- `/agent`
  - opens an interactive settings UI
  - home menu:
    - Subagent settings
    - Extension settings
    - Finish
  - submenus should include a clear `Back` action
  - after finishing a sub-flow, return to the home menu instead of closing immediately
  - extension settings should manage `enabled` only
- `/agent:insert`
  - insert or refresh a managed subagent hard-rule block in an existing project `AGENTS.md`
  - preserve existing `AGENTS.md` content and append the managed block by default
  - support optional position argument: `top` or `bottom`
- `/agent:prompt`
  - create an append or replace system prompt override for a selected subagent
  - save under project `.pi/ramean/agents/`
- `/agent:spawn`
  - dispatch a subagent directly without routing through the main-agent conversation
  - example:
    - `/agent:spawn reviewer help me find dead code in this codebase`
    - `/agent:spawn designer revamp dashboard icon to use bigger icon`
  - still show that the agent was dispatched in conversation output
  - show temporary live status in the widget while running
  - do not render the full transcript in the final visible output by default; show the final result only
- `/agent:expand`
  - toggle dispatch-only expansion for subagent dispatch cards
  - support optional args: `toggle`, `expand`, `collapse`, and `status`
  - leave non-dispatch tool output unchanged
  - keep the state session-local and let it reset on reload
- `/agent:status`
  - show current subagent execution path, runtime, prompt state, and whether the extension is enabled

## Runtime execution path

Current runtime state:

- `agent`, `designer`, and `reviewer` use the **resident runtime** path by default
- this changes the execution path only; it does not change the subagent product contract
- the earlier legacy child-launch path is no longer part of the active built-in subagent flow

Term:

- **resident runtime**: subagent execution inside the already loaded runtime

## System Prompt

- Each subagent has a default system prompt in `extensions/subagents/prompts/`
- Dispatch also adds a small role-specific per-run reminder so `agent` and `designer` default to implementation mode while `reviewer` stays in review mode
- A project-level prompt can append to or replace the default prompt from `.pi/ramean/agents/<agent>.md`
- Supported files:
  - `.pi/ramean/agents/reviewer.md`
  - `.pi/ramean/agents/designer.md`
  - `.pi/ramean/agents/agent.md`
- Prompt files use markdown with front matter

### Example subagent prompt

```markdown
---
name: agent/designer/reviewer
mode: append/replace
---

Hard rules:

- One
- Two
- Three
```

## Status indicator

- `❖` : waiting
- `⚏ ⚍ ⚎ ⚌` : running, animated like a braille spinner
- `✔` : success
- `✖` : failed

Rules:

- each status icon must use a different color
- the running icon must animate while the subagent is active

## Configuration

- Default behavior follows the global config from this extension
- Project config can override it in `.pi/ramean/config.yaml`
- If a configured model is unavailable, inherit the main agent model with `low` thinking
- Ignore stale legacy `parallel.max` values silently

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

## Tools

- dispatch
  - Description : dispatch one subagent to do one task
  - Label name : Dispatch
  - Short name : DP
  - Icon : `➽`
  - Canonical input shape : `{ agent, task }`
  - Example usage : `➽ agent`, `➽ designer`, `➽ reviewer`
  - Main-agent orchestration rule : when multiple subagents are needed, issue multiple top-level `dispatch` calls in parallel

## Rules

- Subagents cannot use `dispatch`
- Subagents can use normal tools, skills, commands, and read-only custom tools
- Subagents cannot use mutating or interactive custom tools
  - no `todo_write`
  - no `question`
  - no `questionnaire`
- Reviewer is read-only
  - no `write`
  - no `edit`
  - no mutating `bash`
  - custom tools are allowed only if they are read-only
- Do not rely on keyword or phrase classifiers to pre-route delegated tasks inside the extension runtime
- Let the main agent choose the subagent, then let the subagent prompt plus the per-run reminder self-check scope before doing work
- If a delegated task is out of scope, the subagent should refuse briefly, name the correct subagent, and stop
- Route by task shape first
  - implementation-shaped non-UI work belongs to Agent
  - implementation-shaped UI/UX and front-end work belongs to Designer
  - review-shaped, audit-shaped, critique-shaped, and final-pass validation work belong to Reviewer
- If a task needs both implementation and review, dispatch Agent or Designer first, then dispatch Reviewer as a separate pass
- Designer is for implementation, not critique-only or advisory-only work
  - if the user wants UI changed, fixed, built, or polished, prefer Designer over Reviewer
- Agent is for non-UI implementation, not UI implementation or review-only work
  - if the user wants non-UI code changed, prefer Agent over Reviewer

## UI

- dispatch
  - show in messages while the tool is running
  - completed message cards should keep the neutral tool background and use a left success/error accent instead of filling the whole card with success/error color
  - show a temporary widget above the editor while a standalone dispatch is running
  - show the selected subagent and live status icon
  - keep the task preview truncated to one line in the header
  - show a streamlined live progress summary from the latest subagent activity when available
  - final visible output should focus on task, result, and warnings/errors
  - do not show usage tracking in the normal dispatch UI
  - do not include the subagent transcript in the normal rendered output
  - support dispatch-only expansion via `Ctrl+Shift+O` and `/agent:expand` without changing other tool cards
  - dispatch-only expansion state should be session-local and reset on reload
  - concurrent standalone dispatches aggregate into one shared widget
  - widget stays compact and shows only the dispatch labels and live status icons
- `/agent:spawn`
  - use the same runtime and widget contract as standalone `dispatch`
  - keep the shared widget compact while running
  - final visible message should show the final response without dumping transcript history

### Example UI for each tool

Tools UI style in messages:

- Create a custom UI card using pi-tui components
- Container → stacks sections vertically
- Text → simple text blocks
- Spacer → empty space between sections
- Markdown → renders final output nicely
- Almost identical like tools calls from pi

1. dispatch tools in messages (when dispatch call from /agent:spawn command also using this format in messages):

- When not expanded:

```text
⚏ Reviewer ⟩ Review current codebase and provide feedback for ...
└╍ streamlined response from subagent in here
```

- When expanded:

```text
✔ Reviewer ⟩ Review current codebase and provide feedback for ...
└╍ streamlined response from subagent in here

❯ TASK :
The original task that is being dispatched to the subagent.

❯ OUTPUT :
The subagent final assistant response, rendered as Markdown.

❯ WARNING/ERROR : only shown when the subagent encounters any warning or error.
```

2. dispatch tools in widget when get call from standalone `dispatch` or `/agent:spawn`:

```text
⟩ [⚏Reviewer]
```

```text
⟩ [⚏Reviewer ✔Designer]
```

## Implementation note

- Behavior and UI should match the contracts above.
- There is no separate orchestration tool.
- Parallel delegated work is expressed by multiple top-level `dispatch` calls, not by grouped tool nesting.
