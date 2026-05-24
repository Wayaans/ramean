---
name: setup-me
description: Creates the per-repo setup docs that planning, assessment, and build skills must follow, including artifact formats, domain structure, work tracking, status lifecycle, and interaction policy.
---

# Setup Me

Set up the repo-level instructions consumed by these agent skills. This is a prompt-driven workflow, not a deterministic script: explore the repo, explain what you found, ask one setup section at a time, show a concise summary of the intended changes, then write. The setup must encode the readiness gate used by this skill family: PRDs, no-PRD indexes, and plans start as `needs-assessing`, `assessing` is mandatory before `build-me`, and `build-me` only implements ready plans.

## Output contract

Setup always writes Markdown setup docs under `docs/agents/`. The three supported setup files are `docs/agents/domain-structure.md`, `docs/agents/work-tracker.md`, and `docs/agents/interaction-policy.md`. These replace the old `docs/agents/skill-config.*` file entirely. If an old `skill-config.html` or `skill-config.md` exists, delete it when possible; if deletion fails, leave it in place and warn the user that it is stale and unsupported.

Do not create empty `CONTEXT.*`, `DESIGN.*`, `CONTEXT-MAP.*`, ADR, PRD, plan, review, assessment, or status files during setup. Setup records the chosen structure, paths, status lifecycle, and gate policy. Producer skills create durable artifacts later when real content exists.

## Explore first

Inspect the repo before asking. Look for root agent files, existing setup docs, old `skill-config.*`, existing domain docs, ADR directories, scratch/work artifact directories, git remotes, issue tracker clues, package boundaries, apps, packages, major languages, and existing test/review conventions. Do not assume a GitHub workflow just because `gh` is installed; use the repo evidence.

After exploration, summarize what is present and what is missing. Then walk the user through the setup sections in order. Each section should start with a short explainer: what the decision controls, why the skills need it, and what default you recommend from the repo evidence. Ask one section at a time and wait for the answer before continuing.

## Section order

First ask artifact formats. Setup docs stay Markdown, but work artifacts and domain docs can use different formats. Ask for the work artifact format for PRDs, plans, no-PRD indexes, reviews, and any optional status or report artifacts. Ask for the domain documentation format for context docs, design docs, and ADRs. Recommend HTML for both unless the repo clearly favors Markdown.

Next ask domain structure. Always ask whether the repo should use a single context or a context map, even if the repo looks simple. Present the package, app, domain, and language boundaries you found. Recommend repo/package/app/domain boundaries when they are meaningful, and use language only as a fallback signal. If the user chooses a custom layout, record the intended context paths. Otherwise use defaults such as `CONTEXT.<format>`, `DESIGN.<format>`, `docs/adr/*.<format>`, and `CONTEXT-MAP.<format>` for multi-context repos. Ask for custom paths only when the user wants to override the defaults.

Then ask work tracking. Explain that this controls where PRDs, plans, reviews, and implementation progress live, and that this skill family uses status metadata instead of separate assessment files by default. Offer local files, GitHub, GitLab, or another tracker described by the user. Recommend GitHub when a GitHub remote is present, GitLab when a GitLab remote is present, and local files otherwise. If local files are chosen, ask whether to use the default artifact root `docs/scratch/` or a custom root. Recommend this default local layout unless the repo already uses a different convention: `docs/scratch/<slug-or-feature-name>/PRD.md` for the PRD and `docs/scratch/<slug-or-feature-name>/plans/01-*.md` for plans.

Record the mandatory status lifecycle in the work-tracker setup unless the user explicitly asks to redesign the lifecycle. PRDs and no-PRD indexes use `needs-assessing`, `needs-revision`, `blocked`, and `ready-to-build`. Plans use those same gate statuses plus `in-progress`, `needs-fix`, and `implemented`. Status lives in visible metadata named `Status:`. New PRDs, indexes, and plans start as `needs-assessing`. `assessing` is the only workflow that may promote artifacts to `ready-to-build`, and it must ask the user before doing so. `build-me` only implements plans whose source ledger and plan are `ready-to-build`, skips `implemented` plans, and stops on `needs-assessing`, `needs-revision`, `blocked`, or `needs-fix`.

Then ask interaction policy. Explain that this controls how `ask-me` and `ask-me-with-docs` ask questions. Offer hybrid delivery, Markdown/chat questions, or structured question tools when available. Hybrid is the default: use chat questions for nuanced interview branches and structured tools for small fixed-choice decisions when the user prefers them and the tool is available. Record one shared default question format for both ask skills.

Finally decide the root pointer file only if needed. If `CLAUDE.md` exists, update it. Else if `AGENTS.md` exists, update it. If neither exists, ask the user which one to create. Never create one root agent file when the other already exists, and never append a duplicate `## Agent skills` block; update the existing block in place.

## Confirm before writing

Before writing, show a concise summary only. Include the chosen artifact formats, domain structure, work tracker, artifact root, readiness gate and status lifecycle, interaction policy, files to create or update, root pointer target, and whether old `skill-config.*` files will be deleted or warned about. Do not paste full setup docs into chat unless the user asks.

## Write setup docs

`domain-structure.md` should explain the domain documentation format, single-context or multi-context layout, context map rules, default or custom paths, ADR location and numbering, and the rule that docs are created lazily. It should tell consumer skills to read relevant context docs and ADRs before making domain, design, or architecture claims, and to surface conflicts instead of silently overriding documented decisions.

`work-tracker.md` should explain where work is tracked, the work artifact format, artifact root and naming conventions, PRD and plan paths, local or external tracker behavior, testing policy, review policy, and how implementation progress is represented. It must include the mandatory status lifecycle and ownership rules. For local-file tracking, the default suggested layout is `docs/scratch/<slug-or-feature-name>/PRD.md` for the PRD and `docs/scratch/<slug-or-feature-name>/plans/01-*.md` for plans unless the user chooses a different root or naming scheme. PRDs and no-PRD indexes use `needs-assessing`, `needs-revision`, `blocked`, and `ready-to-build`. Plans use those statuses plus `in-progress`, `needs-fix`, and `implemented`. New PRDs, indexes, and plans start as `needs-assessing`. Assessment normally edits only visible `Status:` metadata and does not create a separate assessment artifact. `assessing` may mark `needs-revision` or `blocked`, must ask before `ready-to-build`, and may ask to invoke `create-plans` when plans are missing. `build-me` may only build `ready-to-build` plans whose source ledger is also `ready-to-build`; it moves plans through implementation statuses and treats `needs-fix` as non-buildable until assessment returns it to readiness.

`interaction-policy.md` should explain question delivery preference, the shared question format, when to use structured question tools, when to stay in Markdown/chat, and how to handle custom answers. Unless the user chooses a custom format, record this shared Markdown question shape for `ask-me` and `ask-me-with-docs`:

```md
**Question N:** [single blocking question]

**Options:**
A. Option A
B. Option B
C. Option C
D. Other (please specify)

**My recommended answer:**
[direct recommendation]

**Why:** [reason tied to trade-offs or downstream impact]
```

It should not contain prose-style preferences for how skill files should be authored.

Update the chosen root agent file with a compact `## Agent skills` block that points to the three setup docs and says these related skills must read the relevant setup docs before acting: `ask-me`, `ask-me-with-docs`, `create-prd`, `create-plans`, `assessing`, `build-me`, and `setup-me`. Use this shape unless the existing root file already has a compatible style:

```md
## Agent skills

Before using ask-me, ask-me-with-docs, create-prd, create-plans, assessing, build-me, setup-me, or related agent skill workflows, read and respect the relevant setup docs under `docs/agents/`:

- `docs/agents/domain-structure.md` for context docs, design docs, ADRs, and domain layout.
- `docs/agents/work-tracker.md` for PRDs, plans, assessment gate status, reviews, artifact paths, testing, and review policy.
- `docs/agents/interaction-policy.md` for question delivery and shared question format.
```

## Done

Report the files created, updated, deleted, or left stale with warnings. Remind the user that rerunning setup is only necessary when the repo changes artifact formats, domain structure, work tracking, status lifecycle, readiness gate, or interaction policy.
