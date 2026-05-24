# Design Doc Format

`DESIGN.html` or `DESIGN.md` records durable project-specific design decisions. Use the format and path configured in `docs/agents/domain-structure.md`. The design doc is for UI/UX, visual, interaction, accessibility, frontend behavior, component behavior, and project-specific design or architecture conventions. It is not a PRD, plan, style dump, or list of universal best practices.

## When to create or edit

Create the design doc lazily when the first durable design decision is resolved. Edit it immediately after a design branch crystallizes. Do not document tentative preferences, one-off implementation details, or generic advice. Do not create an ADR when a design-guide entry is enough.

## What belongs

Include decisions future agents must preserve: interaction rules, layout or component behavior, accessibility constraints, visual principles, project-specific code/design patterns, rejected design options, relationships between decisions, and resolved ambiguities. Skip generic advice like “write accessible HTML” unless the repo has a specific, non-obvious convention.

## Editing rules

State what the project does, not what it could do. Keep each decision as direct as possible, list avoided patterns explicitly, preserve the existing document's style and format, and keep diffs small. Use diagrams only when they clarify a real relationship or flow. For HTML artifacts, do not add JavaScript.

## HTML template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Design Name} Design Guide</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.55; max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3 { line-height: 1.2; }
    section { border-top: 1px solid #d7dce2; margin-top: 1.5rem; padding-top: 1rem; }
    .decision { margin: 1rem 0; }
    .avoid, .note { color: #5f6673; }
    blockquote { border-left: 4px solid #d7dce2; margin-left: 0; padding-left: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>{Design Name} Design Guide</h1>
    <p>{One or two sentences describing the design style and why it exists.}</p>

    <section aria-labelledby="decisions">
      <h2 id="decisions">Design decisions</h2>
      <article class="decision">
        <h3>{Decision Name}</h3>
        <p>{One strong sentence describing the durable rule.}</p>
        <p class="avoid"><strong>Avoid:</strong> {Rejected pattern}, {Rejected style}</p>
      </article>
    </section>

    <section aria-labelledby="relationships">
      <h2 id="relationships">Relationships</h2>
      <ul>
        <li><strong>{Decision A}</strong> depends on <strong>{Decision B}</strong> because {short reason}.</li>
      </ul>
    </section>

    <section aria-labelledby="ambiguities">
      <h2 id="ambiguities">Flagged ambiguities</h2>
      <ul>
        <li>“{ambiguous phrase}” was used to mean both {meaning A} and {meaning B}; resolved as {resolution}.</li>
      </ul>
    </section>

    <section aria-labelledby="anti-patterns">
      <h2 id="anti-patterns">Anti-patterns</h2>
      <ul>
        <li>Do not {rejected behavior} when {boundary condition}.</li>
      </ul>
    </section>

    <section aria-labelledby="dialogue">
      <h2 id="dialogue">Example dialogue</h2>
      <blockquote>
        <p><strong>Dev:</strong> “Should this surface use {rejected option}?”</p>
        <p><strong>Design lead:</strong> “No. This project uses <strong>{Decision Name}</strong>, so {boundary rule}.”</p>
      </blockquote>
    </section>
  </main>
</body>
</html>
```

## Markdown template

```md
# {Design Name} Design Guide

{One or two sentences describing the design style and why it exists.}

## Design decisions

### {Decision Name}

{One strong sentence describing the durable rule.}

**Avoid:** {Rejected pattern}, {Rejected style}

## Relationships

- **{Decision A}** depends on **{Decision B}** because {short reason}.

## Flagged ambiguities

- “{ambiguous phrase}” was used to mean both {meaning A} and {meaning B}; resolved as {resolution}.

## Anti-patterns

- Do not {rejected behavior} when {boundary condition}.

## Example dialogue

> **Dev:** “Should this surface use {rejected option}?”
>
> **Design lead:** “No. This project uses **{Decision Name}**, so {boundary rule}.”
```

## Good design-guide entries

“Order pages use transparent surfaces only; no card fills, overlays, or gradients.” “Business validation errors return typed results; exceptions are reserved for unexpected failures.” “Bulk actions require a pre-submit review step when they affect more than one account.”

## Bad design-guide entries

“Use good UX.” “Write maintainable code.” “This task modifies `src/components/Button.tsx`.”
