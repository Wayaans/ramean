# Agent work tracker

This repo tracks PRDs, no-PRD indexes, plans, reviews, and implementation progress as local Markdown files under `docs/scratch/`.

## Artifact layout

Use this default local layout unless the user chooses a different path for a specific effort:

- PRD: `docs/scratch/<slug-or-feature-name>/PRD.md`
- No-PRD index: `docs/scratch/<slug-or-feature-name>/INDEX.md`
- Plans: `docs/scratch/<slug-or-feature-name>/plans/01-*.md`
- Reviews or reports: `docs/scratch/<slug-or-feature-name>/reviews/*.md` or another clearly named file under the same feature directory

Do not create empty PRDs, plans, reviews, reports, status files, or assessment files. Producer skills create artifacts only when they have real content.

## Status lifecycle

Status lives in visible metadata named `Status:`.

PRDs and no-PRD indexes use these statuses:

- `needs-assessing`
- `needs-revision`
- `blocked`
- `ready-to-build`

Plans use those statuses plus:

- `in-progress`
- `needs-fix`
- `implemented`

New PRDs, no-PRD indexes, and plans start as `needs-assessing`. `assessing` is the only workflow that may promote artifacts to `ready-to-build`, and it must ask the user before doing so. Assessment normally edits only visible `Status:` metadata and does not create a separate assessment artifact.

`assessing` may mark artifacts `needs-revision` or `blocked`. It may ask to invoke `create-plans` when plans are missing.

`build-me` may only build plans marked `ready-to-build` whose source PRD or no-PRD index is also `ready-to-build`. It skips `implemented` plans and stops on `needs-assessing`, `needs-revision`, `blocked`, or `needs-fix`. Treat `needs-fix` as non-buildable until assessment returns it to readiness.

## Validation and review

Use Bun for this repo. Run `bun test` at minimum after implementation changes. Run `bunx tsc --noEmit` when TypeScript-sensitive code changes.

Record progress by updating plan status and concise notes in the relevant local artifact. Keep reviews under the same feature directory when a durable review artifact is useful.
