# Installation guide for ramean

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

Ramean can also insert a managed subagent reminder block into an existing project `AGENTS.md` with `/agent:insert`.

## Config shape

Default and project config support docs-style extension entries:

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

- extension: tools
  enabled: true
  tools:
    grep: true
    glob: true
    list: true
    todo_write: true
    question: true
    questionnaire: true
    web_fetch: true
    find_docs: true

- extension: handoff
  enabled: true

- extension: notify
  enabled: true

- extension: minimal-mode
  enabled: true

- extension: git-guardrails
  enabled: false
```

Notes:

- the `subagent` extension entry with `enabled: false` disables `dispatch` and `/agent:spawn`.
- `/agent`, `/agent:insert`, `/agent:prompt`, and `/agent:status` remain available even when subagents are disabled.
- the `tools` extension entry with `enabled: false` removes ramean custom tools from the default active tool set.
- the `handoff` extension entry with `enabled: false` disables `/handoff`.
- the `notify` extension entry with `enabled: false` disables terminal-ready notifications.
- the `minimal-mode` extension entry with `enabled: false` restores normal tool display behavior.
- the `git-guardrails` extension entry is disabled by default; when enabled, it blocks common dangerous git bash commands such as `git push` and `git reset --hard` using a pattern-based guard list.
- If a configured subagent model is unavailable, the subagent inherits the active main-agent model with `low` thinking.
- Legacy compact config shapes are still accepted for backward compatibility.
- Ramean config writers prefer docs-style extension entries for the settings they update.
- If `.pi/ramean/config.yaml` is malformed, ramean warns and falls back to default project config behavior.
- Legacy `parallel.max` fields are ignored silently.

## Commands

- `/agent`
  - interactive settings UI with:
    - `Subagent settings`
    - `Extension settings`
    - `Finish`
  - submenus include `Back`
  - extension settings manage `enabled`
- `/agent:insert`
  - inserts or refreshes a managed subagent hard-rule block in an existing project `AGENTS.md`
  - defaults to appending at the bottom
  - supports `/agent:insert top` and `/agent:insert bottom`
- `/agent:prompt`
- `/agent:spawn`
  - shows temporary live status above the editor while the subagent runs
  - final rendered output shows the final response without transcript history
- `/agent:status`
  - shows current runtime, prompt state, and whether the subagent extension is enabled
- `/tools:status`
  - shows available built-in and extension tools in current priority order
- `/tools:compaction`
  - triggers custom session compaction using `github-copilot/gemini-3-flash-preview`
- `/handoff <goal>`
  - generates a focused prompt for a new session from the current conversation
- `/guardrails:git`
  - toggles git-guardrails on or off
  - optional args: `enable`, `disable`, and `status`
  - reloads the extension runtime after state changes so the guard applies immediately

## Tools

Subagent tool:

- `dispatch` — dispatch one subagent directly
  - for parallel work, the main agent should issue multiple top-level `dispatch` calls
  - use `agent` for general coding and exploration
  - use `designer` only for UI/UX and front-end implementation work
  - use `reviewer` only for read-only review, feedback, and analysis
  - dispatch does not pre-classify task text with keyword heuristics; each subagent prompt self-checks scope and can refuse out-of-scope work
  - after non-trivial implementation, prefer a final `reviewer` pass unless the change is very small

Custom top-level tools:

- `grep`
- `glob`
- `list`
- `todo_write`
  - rendered output shows only the checklist text
- `question`
- `questionnaire`
- `web_fetch`
- `find_docs`

Notes:

- the main agent should prefer these dedicated tools before falling back to `bash`
- subagents cannot use `todo_write`, `question`, or `questionnaire`
- subagents can still use the read-only custom tools
- `/tools:compaction` and the built-in `/compact` use the same ramean custom compaction hook for the main agent
- if `minimal-mode` is enabled, collapsed displays stay compact while `write` and `edit` keep their normal rendering

## Other extensions

- `handoff`
  - adds `/handoff <goal>`
- `notify`
  - sends a terminal notification when the main agent is ready for input
- `minimal-mode`
  - enables compact tool rendering for most tools without changing `write` or `edit`
- `git-guardrails`
  - disabled by default
  - blocks common dangerous git bash commands such as `git push`, `git reset --hard`, `git clean -f`, and `git branch -D`

## UI notes

- status indicators use different colors for waiting, running, success, and failure
- completed dispatch cards keep the neutral tool background and add a left success/error accent instead of a full-card success/error fill
- running indicators animate with braille spinner frames
- concurrent standalone dispatches share one above-editor widget
