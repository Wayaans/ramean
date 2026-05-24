# ADR Format

ADRs record hard-to-reverse decisions that future agents would otherwise question. Use the ADR format, path, and numbering configured in `docs/agents/domain-structure.md`, either HTML or Markdown. Most resolved choices do not need ADRs; prefer `CONTEXT.*` or `DESIGN.*` unless the ADR threshold is met.

## ADR threshold

Create or offer an ADR only when all three conditions are true: the decision is hard to reverse, the choice would be surprising without context, and credible alternatives existed with a real trade-off. If any condition is missing, capture the decision in the relevant context doc, design doc, or final summary instead.

## Path and numbering

Use the configured ADR directory. If none is customized, default to `docs/adr/NNNN-short-slug.html` for HTML or `docs/adr/NNNN-short-slug.md` for Markdown. Start at `0001`, scan existing ADRs, and increment the highest number. In multi-context repos, place context-specific ADRs in the context's ADR directory when that layout exists or is configured. Create ADR directories lazily only when the first ADR is needed.

## What qualifies

Good ADR candidates include architecture shape, context boundaries, integration patterns, technology choices with lock-in, data ownership decisions, non-obvious rejected alternatives, external constraints not visible in code, and deliberate deviations from the expected approach. Poor candidates include easy-to-change naming choices, obvious implementation details, temporary task decisions, low-stakes library choices, and decisions already clear from context or design docs.

## Editing rules

Keep ADRs short. Record the decision and why, not a transcript. Include consequences only when they are non-obvious. Link to relevant context or design docs when useful. For HTML ADRs, use static HTML with small embedded CSS and no JavaScript.

## HTML template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ADR NNNN: {Decision Title}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.55; max-width: 850px; margin: 0 auto; padding: 2rem; }
    h1, h2 { line-height: 1.2; }
    section { border-top: 1px solid #d7dce2; margin-top: 1.5rem; padding-top: 1rem; }
    .status { color: #5f6673; }
  </style>
</head>
<body>
  <main>
    <h1>ADR NNNN: {Decision Title}</h1>
    <p class="status"><strong>Status:</strong> Accepted</p>

    <section aria-labelledby="context">
      <h2 id="context">Context</h2>
      <p>{What pressure, constraint, or trade-off forced this decision?}</p>
    </section>

    <section aria-labelledby="decision">
      <h2 id="decision">Decision</h2>
      <p>{What did we decide?}</p>
    </section>

    <section aria-labelledby="why">
      <h2 id="why">Why</h2>
      <p>{Why this option won over credible alternatives.}</p>
    </section>

    <section aria-labelledby="consequences">
      <h2 id="consequences">Consequences</h2>
      <ul>
        <li>{Non-obvious downstream effect, if worth recording.}</li>
      </ul>
    </section>
  </main>
</body>
</html>
```

## Markdown template

```md
# ADR NNNN: {Decision Title}

**Status:** Accepted

## Context

{What pressure, constraint, or trade-off forced this decision?}

## Decision

{What did we decide?}

## Why

{Why this option won over credible alternatives.}

## Consequences

- {Non-obvious downstream effect, if worth recording.}
```

## Minimal ADR option

When the decision is important but simple, one paragraph is enough inside the chosen format. For example: “Ordering and Billing communicate through domain events instead of synchronous HTTP because billing must not block order placement and both contexts need independent deployability. Synchronous calls were rejected because they couple checkout availability to billing availability.”
