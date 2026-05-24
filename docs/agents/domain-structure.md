# Agent domain structure

This repo uses Markdown for durable domain docs. Setup docs live under `docs/agents/`, but domain docs are created lazily at the repo root or under `docs/adr/` only when real content exists.

## Layout

Use a single-context layout for the repo:

- `CONTEXT.md` records project-specific domain language, canonical terms, relationships, avoided aliases, and resolved ambiguities.
- `DESIGN.md` records durable design rules, interaction rules, UI/UX conventions, accessibility constraints, frontend behavior, component behavior, and project-specific design or architecture conventions.
- `docs/adr/NNNN-short-slug.md` records ADRs.

Do not create empty `CONTEXT.md`, `DESIGN.md`, or ADR files. Producer skills create them only after a real term, relationship, design rule, or ADR-worthy decision is resolved.

## ADRs

Place ADRs under `docs/adr/`. Use four-digit numbering starting at `0001`; scan existing ADRs and increment the highest number. Keep ADRs short and record the decision, why it won, and non-obvious consequences.

Create an ADR only when the decision is hard to reverse, surprising without context, and the result of a real trade-off. Otherwise, capture the decision in `CONTEXT.md`, `DESIGN.md`, or the final summary.

## Consumer rules

Before making domain, design, or architecture claims, read the relevant existing domain docs and ADRs. If documented language or decisions conflict with the user, code, or request, surface the conflict instead of silently overriding it.

Keep `CONTEXT.md` free of implementation details. Keep `DESIGN.md` free of task-specific implementation notes and generic design advice.
