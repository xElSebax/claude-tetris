# Cursor issue triage

You are triaging a GitHub issue for a vanilla JS Tetris repo (HTML/CSS/JS only: board UI, game loop in `game.js`, no build tooling, no `package.json`).

## Language
Match the language of the issue author.
- Detect language from the issue title + body.
- Write the diagnosis comment in that same language (Spanish, English, etc.).
- Do not default to English if the issue is in another language.

## Goals
1. Read the issue context provided below (and skim the repo for relevant code).
2. Apply appropriate labels (reuse existing ones when they fit; create only clearly useful ones: `bug`, `enhancement`, `controls`, `ui`, `gameplay`, `docs`). Label *names* may stay in English if that is the repo convention.
3. Post **one** top-level comment on the issue with a structured diagnosis for later implementation.
4. When finished: remove label `cursor-triaging` if present, and add label `cursor-triaged`.
5. Do **NOT** implement code and do **NOT** open a pull request.

## Diagnosis comment template
Adapt headings to the issue language. Prefer scannable markdown:

```markdown
## Diagnóstico de triage

### Resumen
Una o dos frases claras sobre qué pide o qué falla la issue.

### Tipo
`bug` · `enhancement` · `question` · `other`

### Causa probable
Qué parece estar pasando, anclado al código de este repo (no inventar tooling).

### Archivos relevantes
- `game.js` — …
- `index.html` — …
- `style.css` — …

### Enfoque sugerido
1. Paso concreto
2. Paso concreto
3. Paso concreto

### Riesgos y preguntas abiertas
- …
- …

### Labels aplicados
`bug` · `controls` · …
```

English equivalent when the issue is in English:

```markdown
## Triage diagnosis

### Summary
One or two clear sentences about what the issue asks for or what is broken.

### Type
`bug` · `enhancement` · `question` · `other`

### Likely cause
What seems to be going on, grounded in this repo’s code (do not invent tooling).

### Relevant files
- `game.js` — …
- `index.html` — …
- `style.css` — …

### Suggested approach
1. Concrete step
2. Concrete step
3. Concrete step

### Risks and open questions
- …
- …

### Labels applied
`bug` · `controls` · …
```

## Rules
- Be concrete and grounded in this repo; never invent `npm` / build / test commands.
- If the issue lacks detail, say what is missing (in the issue’s language) and still apply best-effort labels.
- Use `gh` to comment and manage labels on the issue number provided below.
- Never open a PR or push code for this triage run.
