---
name: to-local-issues
description: Break a plan, spec, PRD, or conversation context into local issues under .docs/issues/ with auto-increment numbers. Enforces 1:1 traceability between requirements and issues through a mandatory requirement-to-issue mapping. Use when user wants to convert requirements into local issues, create implementation tickets locally, or break down work into traceable issues.
---

# To Local Issues

Break requirements into local issues with mandatory traceability. Every requirement maps to at least one issue. Every issue maps back to the requirements it covers.

## Prerequisites

- A source of requirements: a PRD, a GitHub issue, or conversation context with enough detail to extract atomic requirements.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a source reference (GitHub issue number, PRD file path, etc.), fetch it.

### 2. Extract atomic requirements

Before drafting any issues, extract a **flat, numbered list of every atomic requirement** from the source material. An atomic requirement is the smallest unit of functionality that can be independently verified.

Present this list to the user and confirm completeness:
- Does the list miss any requirements from the source?
- Are any requirements too broad or too narrow?
- Is the granularity appropriate?

Iterate until the user confirms the requirement list is complete and correct.

### 3. Explore the codebase (optional)

If you have not already explored the codebase, and the requirements touch existing code, do so to understand the current state. Skip this step if the context is already sufficient.

### 4. Draft issues with requirement mapping

Break the requirements into **tracer bullet** local issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

For each issue, you must explicitly list which atomic requirements it covers using their numbered IDs from step 2.

Slices may be HITL or AFK:
- **HITL** slices require human interaction (architectural decision, design review, etc.)
- **AFK** slices can be implemented and merged without human interaction

Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Every atomic requirement must be covered by at least one issue
- No issue should cover requirements that are better separated into their own slice
</vertical-slice-rules>

### 5. Quiz the user

Present the proposed breakdown as a numbered list. For each issue, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other issues (if any) must complete first
- **Requirements covered**: which atomic requirement IDs this addresses
- **User stories covered**: if applicable, which user story IDs this addresses

Also show a **coverage check**: list every atomic requirement ID and which issue(s) cover it.

Ask the user:
- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any issues be merged or split further?
- Are the correct issues marked as HITL and AFK?
- Are there any uncovered requirements?

Iterate until the user approves the breakdown.

### 6. Create local issues

For each approved issue, create a local issue file in `.docs/issues/`.

Determine the next issue number by scanning `.docs/issues/*.md` for the highest existing number and incrementing by 1. If no issues exist, start at 1.

Use the filename format: `NNN-slug.md` (e.g., `001-add-user-auth.md`)

Use the issue file template below.

Create issues in dependency order (blockers first) so you can reference real issue numbers in the `blocked_by` field.

<issue-template>
```yaml
---
number: NNN
title: "Short descriptive name"
status: open
date_created: YYYY-MM-DD
blocked_by: [NNN]
requirements_covered: [R1, R2]
user_stories_covered: [U1, U2]
type: HITL | AFK
priority: high | medium | low
source_prd: "reference or path to source document"
parent_issue: null
---
```

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

## Why

Why this slice matters and what value it delivers.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #NNN (if any)

Or "None — can start immediately" if no blockers.

## Notes

Any additional context, implementation hints, or risks.

</issue-template>

Do NOT close or modify any parent issue or source document.

#### 6.1 Update local source PRDs
After all issue files are created, scan each issue's `source_prd` front matter field. Group issues by `source_prd`. For any `source_prd` that points to a local `.docs/issues/` markdown file, update only that file's front matter `issues` field to include the newly created issue numbers. If `issues` is `[]`, replace it with the new numbers. Otherwise, append the new numbers without duplicates. Ignore GitHub URLs, external references, and null values. Do not change any content below the front matter.
