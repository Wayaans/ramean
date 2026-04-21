# Ramean

Ramean is my personal collection of extensions for [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

Right now this package ships:

- subagents: agent, designer, and reviewer
  - `agent` for implementation-shaped non-UI work such as debugging, refactors, tests, tooling, and codebase analysis
  - `designer` for implementation-shaped UI/UX and front-end work such as layout, components, styling, accessibility, responsive behavior, and polish
  - `reviewer` for read-only review, critique, validation, and final-pass analysis, including UI/UX or front-end review when the task is primarily evaluative
  - route by task shape: implementation work goes to `agent` or `designer`; review work goes to `reviewer`; mixed work should implement first and review second
  - routing relies on main-agent instructions plus subagent self-check prompts rather than keyword-based preflight rejection
- custom top-level tools: grep, glob, list, todo_write, question, questionnaire, web_fetch, and find_docs
  - ramean keeps these prioritized ahead of bash without overriding explicit Pi tool allowlists such as `--tools` or `--no-tools`
- tools support commands: `/tools:status` and `/tools:compaction`
- custom compaction using `github-copilot/gemini-3-flash-preview`
- extra extensions: handoff, notify, minimal-mode, and git-guardrails
  - minimal-mode also adds a subtler animated working indicator and clearer compact previews for `web_fetch` and `find_docs`

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

Useful commands include `/agent`, `/agent:expand`, `/agent:insert`, `/agent:prompt`, `/agent:spawn`, `/agent:status`, `/flair:<skill-dir>`, `/tools:status`, `/tools:compaction`, `/handoff`, and `/guardrails:git`.

Routing at a glance:

- implementation-shaped non-UI task → `agent`
- implementation-shaped UI/UX or front-end task → `designer`
- review, audit, critique, or final-pass validation → `reviewer`
- task needs both implementation and review → dispatch `agent` or `designer` first, then dispatch `reviewer`

Dispatch also adds a lightweight role-specific reminder at run time so `agent` and `designer` default to implementation mode while `reviewer` stays evaluative.

`/agent:insert` adds or refreshes a managed hard-rule reminder in an existing project `AGENTS.md` so the main agent keeps the subagent routing rules in view.

`/agent:expand` and `Ctrl+Shift+O` control dispatch-only expansion for subagent dispatch cards without changing other tool output. `/agent:expand` supports `toggle`, `expand`, `collapse`, and `status`. This preference is session-local and resets on reload.

While the standalone dispatch widget is active above the editor, ramean also swaps Pi's normal streaming working indicator to a matching animated dispatch spinner.

`/flair:<skill-dir>` loads the matching ramean package skill from `skills/` and invokes it with the same hidden prompt style ramean used for `/ramean:commit`. The bundled commit helper is now `/flair:ramean-commit`.

`/guardrails:git` toggles the git-guardrails extension, which is disabled by default and blocks common dangerous git bash commands such as `git push` and `git reset --hard` when enabled. The command now leaves a visible status message showing whether guardrails are enabled or disabled and where the project override lives.

## Docs

- `docs/subagents.md`
- `docs/tools.md`
- `docs/others.md`
- `docs/installation_guides.md`
