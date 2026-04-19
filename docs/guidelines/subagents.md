# Subagent extension inside the ramean pi package

Goal: keep the subagent extension lightweight, easy to understand, and easy to drop into any project.

Subagents should always be available to the main agent with clear instructions, predictable behavior, and clear limits.

## Agents

- Agent : `AG`
  - general-purpose implementation and analysis subagent
  - not for UI/UX or front-end work
- Designer : `DS`
  - prompted subagent for UI/UX and front-end code work only
- Reviewer : `RV`
  - prompted subagent for review, feedback, and analysis
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
- `/agent:status`
  - show current subagent runtime, prompt state, and whether the extension is enabled

## System Prompt

- Each subagent has a default system prompt in `extensions/subagents/prompts/`
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
- Subagents can use all normal tools, custom tools, skills, and commands except `dispatch`
- Reviewer is read-only
  - no `write`
  - no `edit`
  - no mutating `bash`
  - custom tools are allowed only if they are read-only

## UI

- dispatch
  - show in messages while the tool is running
  - show a temporary widget above the editor while a standalone dispatch is running
  - show the selected subagent and live status icon
  - final visible output should focus on task, result, and warnings/errors
  - do not include the subagent transcript in the normal rendered output
  - concurrent standalone dispatches aggregate into one shared widget
- `/agent:spawn`
  - use the same runtime, message shape, and widget contract as standalone `dispatch`
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
