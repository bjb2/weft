# weft

A small, data-driven **interactive-fiction engine**. A game is a declarative manifest plus
scene files in a tiny DSL; the engine, systems (combat / inventory / equipment / skill
checks / bonds / dialogue), renderers, and a headless test harness are reusable across games.

The design goal: make games **authorable from a spec by a human or an LLM**, and make
correctness — and **scale** — **machine-checkable**. Every game is compiled, audited
(reachability + render safety + reference/typo checks), continuity- and length-gated where it
opts in, and tested (replay + fuzz) before it ships.

## Why it's structured this way

- **Engine ⇄ content separation.** Nothing game-specific lives in the runtime. Stats, pools,
  items, enemies, techniques, cast, and systems all come from `game.js`. The same engine runs a
  pure-text mystery, a stat-driven dungeon crawl, and a dialogue-driven comedy.
- **Deterministic by construction.** All randomness flows through a seeded PRNG stored in the
  save, so any playthrough can be recorded and replayed exactly — that's what powers the
  regression tests.
- **Validation-first.** The compiler refuses dead-end scenes, unknown jump targets, undeclared
  combat techniques, undeclared dialogue speakers, and — crucially for branching fiction — any
  variable that is *read but never written* (the silent-typo bug). The audit then proves every
  scene is reachable.
- **Scale and continuity are invariants too** (opt-in, for long-form / AI-authored books).
  A `length` budget makes "how much was actually written" machine-checked — per-scene word
  budgets that **fail the build when a node comes in short** (the reason AI books quietly land
  at a third of their target), with corpus progress reported. An `entities` registry powers a
  **path-aware continuity gate**: it proves no character/place is referenced on any branch that
  skips its introduction. `weft expand` turns each under-budget node into a ready generation
  prompt (bible + beat + routes), so the author/model fills it and the gate re-checks.
- **Self-contained output.** `build` bundles a game into one classic `<script>` that runs from
  `file://` and from any static host, with the build hash in the filename for cache-busting.

## Quickstart

No dependencies beyond Node (ESM). From the repo root:

```bash
node tools/cli.mjs new   games/mygame mygame "My Game"   # scaffold a fresh, passing game
node tools/cli.mjs all   games/mygame                    # compile + audit + lint + continuity + length + test
node tools/cli.mjs play  games/mygame                    # play in the terminal
node tools/cli.mjs edit  games/mygame                    # local scene editor + branch graph
node tools/cli.mjs site                                  # build every game + the landing portal
# then open games/mygame/index.html (or the root index.html) in a browser
```

CLI: `build` · `audit` · `test` · `lint` · `continuity` · `length` · `expand` · `art` ·
`play [seed]` · `edit` · `all` · `new <id> "Title"` · `portal` · `site`.
The `all` gate runs compile + audit + **prose lint** + **continuity** + **length** + test
(continuity/length no-op unless the game declares `entities` / `length`). Image generation
(`art --generate`) reads `OPENROUTER_API_KEY` from a `.env` (copy `.env.example`).

## Layout

```
src/                 platform-agnostic engine core (no DOM, no globals)
  rng.js             seeded, serializable PRNG
  state.js           state model + derived-stat recompute + save migration
  context.js         the authoring verb vocabulary ($) — the compiler's target (incl. SAY)
  engine.js          createGame(): navigation, choices, save/resume, view model
  combat.js          generic data-driven tactical combat
  driver.js          headless play driver (powers audit/fuzz/replay)
  storage.js         save adapters (memory / localStorage)
  markup.js          P/SYS/DIV + dialogue + plain-text projection
  render/dom.js      browser renderer (themeable; dialogue bubbles; journal/inventory; home link)
  writing/rules.js   default anti-AI-tic ruleset (the linter's data)
  art/styles.js      art-style presets (image descriptor + UI palette)
tools/
  compile.mjs        scene DSL -> build/scenes.js (+ validation)
  build.mjs          shared build step: compile -> art -> bundle -> index.html
  bundle.mjs         single self-contained classic-script bundle
  audit.mjs          static reachability + render-safety audit
  prose-lint.mjs     anti-AI-tic prose linter (exports the shared prose extractor)
  continuity.mjs     entity "referenced-before-introduced" gate (path-aware, uses the audit graph)
  length.mjs         per-scene / per-chapter / corpus word-budget gate
  expand.mjs         engine-driven generation prompts for under-budget nodes (bible + beat + routes)
  test.mjs           replay (golden paths) + seeded fuzz
  art.mjs            art prompts.json + themed SVG placeholders + character portraits
  portal.mjs         landing-page generator (cards for every game + external link-outs)
  editor.mjs         local scene-editor + branch-graph server (editor-ui.html, scene-io.mjs)
  scaffold.mjs       new-game generator       load.mjs / env.mjs   game loader / .env loader
  comfy/             optional LOCAL image generation via ComfyUI (SD 3.5 Medium GGUF) — see tools/comfy/README.md
  cli.mjs            orchestrator (build/audit/test/lint/continuity/length/expand/art/play/edit/all/new/portal/site)
games/               sample · mystery · crawl · lastcall · pfpd · saltbell · threadkeeper
portal.json          portal title/subtitle, excluded games, and external link-outs
AUTHORING.md         full game-format spec (manifest + DSL, dialogue, length budgets, entities, art)
WRITING.md           prose style guide + the anti-AI-tic rules the linter enforces
ONBOARDING.md        procedure for generating a game from a prompt (e.g. with an LLM)
.env.example         OPENROUTER_API_KEY for the art pipeline (copy to .env)
```

## Example games (proof of genre range)

| Game | Systems exercised | Endings |
|---|---|---|
| `sample` | flags, one skill check | 2 |
| `mystery` | flags, clue inventory, gated/hidden choices, 2 skill checks, dynamic routing — **no combat** | 3 |
| `crawl` | stats, hp/resource pools, equipment, 5 techniques, iron/flow stances, 2-phase boss, bonds, ally interventions | 3 |
| `lastcall` | **dialogue** (cast + profile-picture portraits), branching replies, skill check | 2 |
| `pfpd` | dialogue, stats/checks, inventory — reverse-isekai comedy | 4 |
| `saltbell` | dialogue + **length budgets** + **entity continuity** — short wuxia | 3 |
| `threadkeeper` | chaptered, length budgets + continuity, sight check — mid-size wuxia | 3 |

All pass `audit OK` + `tests OK` (and `continuity OK` / `length OK` where configured), with
100% fuzz coverage, 0 softlocks, 0 errors.

## Hosting

`weft site` builds every game and (re)generates a root `index.html` portal that links to each
game's self-contained build; it also writes `.nojekyll`. Commit and push to deploy on GitHub
Pages (or any static host) — every path is relative, so it works under a project subpath.
`weft portal` regenerates just the landing page. `portal.json` sets the heading, excludes
games from the listing, and adds **external** link-out cards (games hosted elsewhere).

## Authoring

See **[AUTHORING.md](./AUTHORING.md)** for the complete manifest + DSL spec — control surfaces,
dialogue (§2), art (§9), **length budgets + the expand loop (§11)**, and **entities + continuity
(§12)**. **[WRITING.md](./WRITING.md)** is the prose discipline the linter enforces, and
**[ONBOARDING.md](./ONBOARDING.md)** is the procedure for generating a game from a one-paragraph
concept (its acceptance gate now includes continuity and length).
