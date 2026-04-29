---
name: to-local-prd
description: "Turn the current conversation context or an external document into a detailed local PRD under .docs/issues/ with auto-increment numbering. Adds Success Metrics, Dependencies, and Risks & Constraints over the original to-prd template. Use when user wants to create a PRD locally, write a PRD from conversation context, or convert a spec into a PRD file."
---

This skill takes the current conversation context (or an external document the user provides) and produces a detailed local PRD. Do NOT interview the user — just synthesize what you already know.

## Process

1. **Gather context** — Work from whatever is already in the conversation context. If the user passes a source reference (file path, URL, etc.), fetch it.

2. **Explore the codebase** (optional) — If you haven't already and the PRD touches existing code, explore to understand current state. Skip if context is already sufficient.

3. **Sketch modules** — Identify major modules to build or modify. Look for deep modules with simple, testable interfaces. Note which modules warrant dedicated tests.

4. **Write the PRD** — Create a local PRD file in `.docs/issues/`. Determine the next number by scanning `.docs/issues/*.md` for the highest existing number and incrementing by 1. If no issues exist, start at 1. Use filename format `NNN-PRD-slug.md` where slug is auto-derived (kebab-case) from the Problem Statement. Write the PRD using the template below.

<prd-template>

---
number: N
title: "Short descriptive title"
date_created: YYYY-MM-DD
status: open
source: "file path, URL, or 'conversation context'"
issues: []
---

## Problem Statement

The problem the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## Success Metrics

Measurable outcomes that indicate the solution is working. Prefer concrete criteria over vague goals.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

What is explicitly not covered by this PRD.

## Dependencies

External systems, libraries, APIs, or other PRDs this work depends on.

## Risks & Constraints

Technical risks, known constraints, and mitigation strategies.

## Further Notes

Any additional context.

</prd-template>
