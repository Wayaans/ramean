# Agent interaction policy

`ask-me` and `ask-me-with-docs` use hybrid question delivery. Prefer structured question tools when they are available and the choice is short enough for fixed options. Use Markdown/chat when the question is long, nuanced, open-ended, or needs context that does not fit a structured tool.

Ask one blocking question at a time during interviews. Provide a recommended answer with the trade-off or downstream impact. Accept custom answers and use them to revise the next question.

## Structured questions

Use structured question tools for small fixed-choice decisions, especially setup choices, format choices, routing choices, and short trade-offs with two to four clear options. Keep labels short and descriptions concrete.

Do not force structured tools when the user needs to explain a custom workflow, a long design rule, or a branch with many dependencies. Use Markdown/chat instead.

## Markdown fallback format

When using Markdown/chat, use this shared question shape unless the user asks for a different format:

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

If the user gives a custom answer, treat it as authoritative for the next step unless it conflicts with repo docs, code evidence, or an earlier decision. Surface conflicts directly.
