# Ramean

Ramean is my personal collection of extensions for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

Right now this package ships:

- subagents: agent, designer, and reviewer
  - `agent` for general coding and exploration
  - `designer` for UI/UX and front-end implementation only
  - `reviewer` for read-only review, feedback, and analysis
  - routing relies on main-agent instructions plus subagent self-check prompts rather than keyword-based preflight rejection
- custom top-level tools: grep, glob, list, todo_write, question, questionnaire, web_fetch, and find_docs
- tools support commands: `/tools:status` and `/tools:compaction`
- custom compaction using `github-copilot/gemini-3-flash-preview`
- extra extensions: handoff, notify, minimal-mode, and git-guardrails

## Included today

- [x] subagents
- [x] custom tools
- [x] question
- [x] questionnaire
- [x] custom compaction
- [x] handoff
- [x] notify
- [x] minimal tools
- [x] git guardrails

Useful commands include `/agent`, `/agent:expand`, `/agent:insert`, `/agent:prompt`, `/agent:spawn`, `/agent:status`, `/ramean:commit`, `/tools:status`, `/tools:compaction`, `/handoff`, and `/guardrails:git`.

`/agent:insert` adds or refreshes a managed hard-rule reminder in an existing project `AGENTS.md` so the main agent keeps the subagent routing rules in view.

`/agent:expand` and `Ctrl+Shift+O` control dispatch-only expansion for subagent dispatch cards without changing other tool output. `/agent:expand` supports `toggle`, `expand`, `collapse`, and `status`. This preference is session-local and resets on reload.

`/ramean:commit` loads the `ramean-commit` skill instructions and generates a terse Conventional Commit message in code-block form.

`/guardrails:git` toggles the git-guardrails extension, which is disabled by default and blocks common dangerous git bash commands such as `git push` and `git reset --hard` when enabled. The command now leaves a visible status message showing whether guardrails are enabled or disabled and where the project override lives.

## Docs

- `docs/subagents.md`
- `docs/tools.md`
- `docs/others.md`
- `docs/installation_guides.md`
