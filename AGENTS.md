# AGENTS.md

Vanilla JS Tetris. No build, no dependencies, no tests, no `package.json`.

## Running

Open `index.html` in a browser, or serve the folder statically:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Verifying changes

There is no automated test, lint, or typecheck. Verify by reloading `index.html`
in a browser and exercising the controls (arrows, Space, P). Do not invent
`npm`/`npx`/`yarn` commands — there is no `package.json` and nothing to install.

## Architecture

- Three files only: `index.html` (DOM + two `<canvas>` elements), `style.css`,
  `game.js` (all logic, ~300 lines).
- `game.js` is loaded via a plain `<script src="game.js">` tag — **no module
  system**. It relies on top-level globals; do not add `import`/`export` or
  convert to ES modules without also changing the script tag in `index.html`.
- Entry point is `init()` (invoked at the end of `game.js`). The game loop is
  `requestAnimationFrame`-driven via `loop()`; mutable state lives in
  module-level `let` vars (`board`, `current`, `next`, `score`, `lines`,
  `level`, `dropInterval`, ...).

## Coupling to remember

`COLS`, `ROWS`, `BLOCK` in `game.js` are tied to the `<canvas id="board">`
`width`/`height` in `index.html`: `width = COLS * BLOCK`, `height = ROWS * BLOCK`.
Changing one without the other breaks rendering. The next-piece canvas
(`#next-canvas`) is independent (fixed 120×120).

## Conventions

- Code identifiers and code comments: English. `game.js` starts with
  `'use strict'` and uses ES6+ (`const`/`let`, arrow functions, spread,
  `Array.from`, template literals).
- UI strings and `README.md`: Spanish. Match the existing language when
  editing each kind — don't translate one to the other.

## Issue triage (GitHub Actions)

On issue **opened** or **edited** (not PRs), `.github/workflows/cursor-issue-triage.yml`
launches a Cursor Cloud Agent, waits for it to finish, then posts the diagnosis
as an issue comment and applies labels (via Actions `gh`, not the agent).

- Prompt: `.github/prompts/cursor-issue-triage.md`
- Skips when `cursor-triaging` / `cursor-triaged` exist, or a prior diagnosis
  heading is already on the issue.
- Requires repo secret `CURSOR_ACTION_TOKEN` (Cloud Agents API key).
- Prefer this Action over Cursor Automations on issue comments (comment
  triggers can loop).
