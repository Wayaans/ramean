# Context Doc Format

Context docs are glossaries for project-specific domain language. They are not specs, plans, architecture maps, task notes, or code indexes. Use the domain documentation format and paths configured in `docs/agents/domain-structure.md`: create `CONTEXT.html` / `CONTEXT.md` and `CONTEXT-MAP.html` / `CONTEXT-MAP.md` according to that setup.

## When to create or edit

Create a context doc lazily when the first durable term, relationship, avoided alias, or resolved ambiguity exists. If a context map already exists, follow it and update the relevant context file. If the setup says the repo is multi-context but the map does not exist yet, create the map only when there is real context content to point at. Never create empty placeholders.

## What belongs

Include only language a domain expert or future agent must use consistently: canonical terms, tight one-sentence definitions, avoided aliases, relationships, resolved ambiguities, and short example dialogue when it clarifies a boundary. Do not include implementation details, file paths, tickets, transient task notes, or general programming concepts.

## Editing rules

Be opinionated about names. Choose the canonical term and list avoided aliases. Preserve the existing document's style and format. Keep diffs small by updating the relevant section instead of rewriting the whole file.

## HTML single-context template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Context Name} Context</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.55; max-width: 900px; margin: 0 auto; padding: 2rem; }
    h1, h2, h3 { line-height: 1.2; }
    section { border-top: 1px solid #d7dce2; margin-top: 1.5rem; padding-top: 1rem; }
    .term { margin: 1rem 0; }
    .avoid, .note { color: #5f6673; }
    blockquote { border-left: 4px solid #d7dce2; margin-left: 0; padding-left: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>{Context Name}</h1>
    <p>{One or two sentences describing the context and why the language matters.}</p>

    <section aria-labelledby="language">
      <h2 id="language">Language</h2>
      <article class="term">
        <h3>{Canonical Term}</h3>
        <p>{One-sentence definition.}</p>
        <p class="avoid"><strong>Avoid:</strong> {Alias}, {Overloaded phrase}</p>
      </article>
    </section>

    <section aria-labelledby="relationships">
      <h2 id="relationships">Relationships</h2>
      <ul>
        <li>A <strong>{Term}</strong> belongs to exactly one <strong>{Other Term}</strong>.</li>
      </ul>
    </section>

    <section aria-labelledby="ambiguities">
      <h2 id="ambiguities">Flagged ambiguities</h2>
      <ul>
        <li>“{ambiguous word}” was used to mean both <strong>{Term A}</strong> and <strong>{Term B}</strong>; resolved as {resolution}.</li>
      </ul>
    </section>

    <section aria-labelledby="dialogue">
      <h2 id="dialogue">Example dialogue</h2>
      <blockquote>
        <p><strong>Dev:</strong> “When a <strong>{Term}</strong> changes, does the <strong>{Other Term}</strong> change too?”</p>
        <p><strong>Domain expert:</strong> “No. A <strong>{Other Term}</strong> only changes when {boundary rule}.”</p>
      </blockquote>
    </section>
  </main>
</body>
</html>
```

## Markdown single-context template

```md
# {Context Name}

{One or two sentences describing the context and why the language matters.}

## Language

### {Canonical Term}

{One-sentence definition.}

**Avoid:** {Alias}, {Overloaded phrase}

## Relationships

- A **{Term}** belongs to exactly one **{Other Term}**.

## Flagged ambiguities

- “{ambiguous word}” was used to mean both **{Term A}** and **{Term B}**; resolved as {resolution}.

## Example dialogue

> **Dev:** “When a **{Term}** changes, does the **{Other Term}** change too?”
>
> **Domain expert:** “No. A **{Other Term}** only changes when {boundary rule}.”
```

## HTML context-map template

Use a context map only when the setup configures multiple contexts or the user explicitly chooses that layout.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Context Map</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.55; max-width: 900px; margin: 0 auto; padding: 2rem; }
    section { border-top: 1px solid #d7dce2; margin-top: 1.5rem; padding-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <h1>Context Map</h1>
    <section>
      <h2>Contexts</h2>
      <ul>
        <li><a href="./path/to/CONTEXT.html">{Context}</a> — {what this context owns}</li>
      </ul>
    </section>
    <section>
      <h2>Relationships</h2>
      <ul>
        <li><strong>{Context A} → {Context B}</strong>: {integration or ownership relationship}</li>
      </ul>
    </section>
  </main>
</body>
</html>
```

## Markdown context-map template

```md
# Context Map

## Contexts

- [{Context}](./path/to/CONTEXT.md) — {what this context owns}

## Relationships

- **{Context A} → {Context B}:** {integration or ownership relationship}
```
