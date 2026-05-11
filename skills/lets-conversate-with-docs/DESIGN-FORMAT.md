# DESIGN.md Format

## Structure

```md
# {Design Name}

{One or two sentence description of what this design style is and why it exists.}

## Style decisions

**User pages**: Page title and section heading both left-aligned, stacked vertically with a tight gap. Content area uses a 2-column grid with compact spacing (8px gutters). No centered headings.
_Avoid_: Centered titles, single-column lists, spacious padding (>16px)

**Order pages**: Surface backgrounds must be fully transparent — no solid fills, no gradients, no linear overlays. Content reads directly against the parent background.
_Avoid_: Gradient cards, solid color fills, overlay tints

**Component Architecture**: Flat composition over deep inheritance hierarchies.
_Avoid_: Deep class hierarchies, mixin chains

**Error Handling**: Result objects with typed errors; exceptions only for truly unexpected failures.
_Avoid_: Throwing exceptions for business validation failures

## Relationships

- **User pages** depends on **Component Architecture** — page sections are flat composable blocks, not inherited shells
- **Error Handling** feeds into **Order pages** — inline error results must respect the transparent background rule

## Example dialogue

> **Dev:** "Should the order page use a gradient card background like the dashboard?"
> **Design lead:** "No — order pages are transparent-only. No fills, no gradients. That rule is settled for the entire order surface."

## Flagged ambiguities

- "heading" was used to mean both the page title and section subheadings — resolved: page-level is `Title`, section-level is `Heading`.

## Anti-patterns

- Do not apply gradient, solid fill, or overlay tint to any order page surface.
- Do not cascade error boundaries for business validation; return typed results instead.
```

## Rules

- **Be opinionated.** When multiple patterns exist for the same concern, pick one and list the alternatives as patterns to avoid.
- **Flag conflicts explicitly.** If a design approach is used ambiguously, call it out in "Flagged ambiguities" with a clear resolution.
- **Keep decisions tight.** One sentence max per decision. State what the project DOES, not just what it could do.
- **Show relationships.** Use bold decision names and express dependencies between design decisions.
- **Only include decisions specific to this project's design style.** General programming concepts (variable naming, basic OOP) don't belong even if the project uses them. Before adding a decision, ask: is this a design choice unique to this project, or a universal best practice? Only the former belongs.
- **Group decisions under subheadings** when natural clusters emerge (e.g., Architecture, UI Patterns, Error Handling). If all decisions belong to a single cohesive area, a flat list is fine.
- **Write an example dialogue.** A conversation between a dev and a design lead that demonstrates how the style decisions apply in practice and clarifies boundaries between competing approaches.

## Single vs multi-design repos

**Single design style (most repos):** One `DESIGN.md` at the repo root.

**Multiple design styles:** A `DESIGN-MAP.md` at the repo root lists the design styles, where they live, and how they relate to each other:

```md
# Design Map

## Design Styles

- [Frontend](./src/frontend/DESIGN.md) — component-driven UI with server-first state
- [Backend](./src/backend/DESIGN.md) — event-sourced domain with CQRS reads
- [Shared](./src/shared/DESIGN.md) — cross-cutting conventions for error handling and logging

## Relationships

- **Frontend → Backend**: Frontend consumes Backend APIs; error handling conventions must align
- **Backend → Shared**: Backend follows Shared error and logging conventions
- **Frontend → Shared**: Frontend follows Shared error and logging conventions
```

The skill infers which structure applies:

- If `DESIGN-MAP.md` exists, read it to find design styles
- If only a root `DESIGN.md` exists, single design style
- If neither exists, create a root `DESIGN.md` lazily when the first style decision is resolved

When multiple design styles exist, infer which one the current topic relates to. If unclear, ask.
