# Ramean

Ramean is my personal collection of extensions for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

Right now this package ships:

- subagents: agent, designer, and reviewer
  - `agent` for general coding and exploration
  - `designer` for UI/UX and front-end implementation only
  - `reviewer` for read-only review, feedback, and analysis
- custom top-level tools: grep, glob, list, todo_write, question, questionnaire, web_fetch, and find_docs
- tools support commands: `/tools:status` and `/tools:compaction`
- custom compaction using `github-copilot/gemini-3-flash-preview`
- extra extensions: handoff, notify, and minimal-mode

## Included today

- [x] subagents
- [x] custom tools
- [x] question
- [x] questionnaire
- [x] custom compaction
- [x] handoff
- [x] notify
- [x] minimal tools

Useful commands include `/agent`, `/agent:insert`, `/agent:prompt`, `/agent:spawn`, `/agent:status`, `/tools:status`, `/tools:compaction`, and `/handoff`.

`/agent:insert` adds or refreshes a managed hard-rule reminder in an existing project `AGENTS.md` so the main agent keeps the subagent routing rules in view.

## Docs

- `docs/subagents.md`
- `docs/tools.md`
- `docs/others.md`
- `docs/installation_guides.md`
