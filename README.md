# weft

A small, data-driven **interactive-fiction engine**. A game is a declarative manifest plus
scene files in a tiny DSL; the engine, systems (combat / inventory / equipment / skill
checks / bonds), renderers, and a headless test harness are reusable across games.

The design goal: make games **authorable from a spec by a human or an LLM**, and make
correctness **machine-checkable** — every game is compiled, audited (reachability + render
safety + reference/typo checks), and tested (replay + fuzz) before it ships.

## Why it's structured this way

- **Engine ⇄ content separation.** Nothing game-specific lives in the runtime. Stats, pools,
  items, enemies, techniques, and systems all come from `game.js`. The same engine runs a
  pure-text mystery and a stat-driven dungeon crawl.
- **Deterministic by construction.** All randomness flows through a seeded PRNG stored in the
  save, so any playthrough can be recorded and replayed exactly — that's what powers the
  regression tests.
- **Validation-first.** The compiler refuses dead-end scenes, unknown jump targets, undeclared
  combat techniques, and — crucially for branching fiction — any variable that is *read but
  never written* (the silent-typo bug). The audit then proves every scene is reachable.
- **Self-contained output.** `build` bundles a game into one classic `<script>` that runs from
  `file://` and from any static host, with the build hash in the filename for cache-busting.

## Quickstart

No dependencies beyond Node (ESM). From the repo root:

```bash
node tools/cli.mjs new   games/mygame mygame "My Game"   # scaffold a fresh, passing game
node tools/cli.mjs all   games/mygame                    # compile + audit + test
node tools/cli.mjs play  games/mygame                    # play in the terminal
# then open games/mygame/index.html in a browser
```

CLI: `build` · `audit` · `test` · `lint` · `art` · `play [seed]` · `all` · `new <id> "Title"`.
The `all` gate runs compile + audit + **prose lint** + test. Image generation
(`art --generate`) reads `OPENROUTER_API_KEY` from a `.env` (copy `.env.example`).

## Layout

```
src/                 platform-agnostic engine core (no DOM, no globals)
  rng.js             seeded, serializable PRNG
  state.js           state model + derived-stat recompute + save migration
  context.js         the authoring verb vocabulary ($) — the compiler's target
  engine.js          createGame(): navigation, choices, save/resume, view model
  combat.js          generic data-driven tactical combat
  driver.js          headless play driver (powers audit/fuzz/replay)
  storage.js         save adapters (memory / localStorage)
  markup.js          P/SYS/DIV + plain-text projection
  render/dom.js      browser renderer (themeable; journal/inventory surfaces)
  writing/rules.js   default anti-AI-tic ruleset (the linter's data)
  art/styles.js      art-style presets (image descriptor + UI palette)
tools/
  compile.mjs        scene DSL -> build/scenes.js (+ validation)
  bundle.mjs         single self-contained classic-script bundle
  audit.mjs          static reachability + render-safety audit
  test.mjs           replay (golden paths) + seeded fuzz
  prose-lint.mjs     anti-AI-tic prose linter
  art.mjs            art prompts.json + themed SVG placeholders
  env.mjs            .env loader (for OPENROUTER_API_KEY)
  cli.mjs            orchestrator (build/audit/test/lint/art/play/new/all)
  scaffold.mjs       new-game generator
games/
  sample/            minimal two-ending game (the scaffold output)
  mystery/           pure-narrative Gothic mystery — no combat, 3 endings
  crawl/             stat + combat + inventory dungeon crawl — 2 fights, 3 endings
AUTHORING.md         full game-format spec (read this to author a game)
WRITING.md           prose style guide + the anti-AI-tic rules the linter enforces
ONBOARDING.md        procedure for generating a game from a prompt (e.g. with an LLM)
.env.example         OPENROUTER_API_KEY for the art pipeline (copy to .env)
```

## The three example games (proof of genre range)

| Game | Systems exercised | Endings |
|---|---|---|
| `sample` | flags, one skill check | 2 |
| `mystery` | flags, clue inventory, gated/hidden choices, 2 skill checks, dynamic routing — **no combat** | 3 |
| `crawl` | stats, hp/resource pools, equipment, 5 techniques, iron/flow stances, 2-phase boss, bonds, ally interventions | 3 |

All pass `audit OK` + `tests OK` with 100% fuzz coverage, 0 softlocks, 0 errors.

## Authoring

See **[AUTHORING.md](./AUTHORING.md)** for the complete manifest + DSL spec (incl. control
surfaces and art), **[WRITING.md](./WRITING.md)** for prose discipline (the linter enforces
it), and **[ONBOARDING.md](./ONBOARDING.md)** for generating a game from a one-paragraph
concept.
