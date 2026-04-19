# Installation guide for ramean subagents

## Local package usage

Install this repository as a pi package:

```bash
pi install /absolute/path/to/ramean
```

Or add it to project settings:

```json
{
  "packages": ["/absolute/path/to/ramean"]
}
```

## Resources loaded by pi

This package exposes one extension entry:

- `extensions/index.ts`

## Project-level files

Ramean stores project overrides in:

- `.pi/ramean/config.yaml`
- `.pi/ramean/agents/agent.md`
- `.pi/ramean/agents/designer.md`
- `.pi/ramean/agents/reviewer.md`

## Config shape

Default and project config support the docs-style extension entry:

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

- `enabled: false` disables `dispatch` and `/agent:spawn`.
- `/agent`, `/agent:prompt`, and `/agent:status` remain available even when subagents are disabled.
- If a configured subagent model is unavailable, the subagent inherits the active main-agent model with `low` thinking.
- Legacy compact config shapes are still accepted for backward compatibility.
- Legacy `parallel.max` fields are ignored silently.

## Commands

- `/agent`
  - interactive settings UI with:
    - `Subagent settings`
    - `Extension settings`
    - `Finish`
  - submenus include `Back`
  - extension settings manage `enabled`
- `/agent:prompt`
- `/agent:spawn`
  - shows temporary live status above the editor while the subagent runs
  - final rendered output shows the final response without transcript history
- `/agent:status`
  - shows current runtime and prompt state for each subagent

## Tools

- `dispatch` — dispatch one subagent directly
  - for parallel work, the main agent should issue multiple top-level `dispatch` calls

## UI notes

- status indicators use different colors for waiting, running, success, and failure
- running indicators animate with braille spinner frames
- concurrent standalone dispatches share one above-editor widget
