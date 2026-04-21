# Custom tools

Reference for the top-level custom tools shipped with the ramean package.

## Available tools

- `grep`
  - fast content search with regex support
  - prefer this over shell `grep` or `rg`
- `glob`
  - file discovery with glob patterns like `**/*.ts`
  - prefer this over shell `find` or `fd`
- `list`
  - list files and directories in a path
  - prefer this over shell `ls`, `tree`, `exa`, or `eza`
- `todo_write`
  - read, write, and clear session todo lists
  - rendered output shows only the checklist text, without a `todo_write` title line above it
- `question`
  - one interactive clarification question with curated options and optional freeform input
- `questionnaire`
  - multi-step interactive questionnaire with review before submit
- `web_fetch`
  - fetch web pages through `markdown.new`
  - prefer this over shell `curl` or `wget`
- `find_docs`
  - current framework and library docs through Context7
  - prefer this over invoking `ctx7` through shell

## Priority behavior

When these tools are enabled, ramean should prioritize them ahead of:

- `read`
- `edit`
- `write`
- `bash`

The main agent should prefer the dedicated top-level tool whenever it can satisfy the task.

Ramean now reorders the currently active tool set instead of silently re-enabling omitted tools.
That means explicit Pi tool selections such as `--tools ...` and `--no-tools` are preserved.

## Bash replacement guard

When a dedicated tool is enabled, ramean blocks common bash equivalents and tells the agent to use the tool instead.

Mappings:

- `grep`, `rg`, `ripgrep` -> `grep`
- `find`, `fd` -> `glob`
- `ls`, `tree`, `exa`, `eza`, `dir` -> `list`
- `curl`, `wget` -> `web_fetch`
- `ctx7`, `npx ctx7`, `bunx ctx7` -> `find_docs`

## Minimal mode interaction

When the `minimal-mode` extension is enabled:

- collapsed tool displays stay compact
- expanded tool displays still show the full result
- `web_fetch` and `find_docs` show the target URL or docs query in the collapsed UI instead of a generic tool-name-only row
- `write` and `edit` are intentionally left unchanged
- `todo_write`, `question`, and `questionnaire` keep their normal rendering
- subagent runtime is not changed by `minimal-mode`

Even when minimal mode is off, `web_fetch` and `find_docs` now keep their default collapsed view compact and only show the full fetched/docs output when expanded.

## Commands

- `/tools:status`
  - shows all currently available built-in and extension tools
  - active tools are shown first in highest-priority order
  - also shows available-but-inactive tools and custom tools disabled by tools config
- `/tools:compaction`
  - triggers session compaction with ramean custom summarization
  - default summarization model: `github-copilot/gemini-3-flash-preview`
  - optional command arguments are passed as custom compaction instructions

## Custom compaction

Ramean registers a custom `session_before_compact` hook for the main agent.

Behavior:

- uses `github-copilot/gemini-3-flash-preview` when that model is available
- falls back to Pi default compaction if the model is unavailable, auth fails, or summarization fails
- `/tools:compaction` and the built-in `/compact` both use the same custom summarization hook

## Config

Default and project config live in:

- `extensions/config.yaml`
- `.pi/ramean/config.yaml`

Docs-style config example:

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

- extension: minimal-mode
  enabled: true
```

Notes:

- project config overrides defaults
- if `enabled: false`, ramean removes these custom tools from the active tool set
- individual tools can be enabled or disabled under the `tools` block
- explicit Pi tool allowlists such as `--tools` and `--no-tools` are respected; ramean only reorders or filters tools that are already active
- malformed ramean config files trigger a warning and fall back to defaults for the affected extension

## Subagents

Subagents can use the read-only custom tools:

- `grep`
- `glob`
- `list`
- `web_fetch`
- `find_docs`

Subagents cannot use mutating or interactive custom tools:

- `todo_write`
- `question`
- `questionnaire`

Those tools are reserved for the main agent only.
