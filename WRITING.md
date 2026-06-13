# Writing for weft (and not sounding like an AI)

Branching fiction lives or dies on prose. This guide is the human-readable half of a
two-part system; the other half is `tools/prose-lint.mjs`, which mechanically enforces the
rules below against your scene text. **`weft all` runs the linter and fails on hard
violations.** Treat a clean lint as the floor, not the ceiling.

The defaults live in `src/writing/rules.js`. A game tunes them with an optional
`games/<id>/writing.js` (merged over the defaults).

## 1. Voice baseline

- **Second person, present tense for action; past for memory.** (Configurable per game via
  `writing.js` `pov`/`tense` — these are informational, not enforced.)
- **One narrator, many mouths.** Someone in every conversation should talk like a tired,
  specific person — not a narrator. Vary sentence length. Vary chapter openings; never two
  same-shaped openings in a row.
- **Trust the reader.** State the image; do not state its meaning. If a paragraph ends by
  explaining what it meant, cut the explanation. The linter flags "thesis closers" for this.
- **Concrete over abstract.** "Her hands wouldn't stop folding the napkin" beats "her anxiety
  was obvious." The linter cannot see this; you must.

## 2. Hard bans (lint ERROR — gate)

These have no good use in fiction. The full list is in `rules.js`; the headline offenders:

> a testament to · couldn't help but · palpable · tapestry · delve into · nestled · a
> symphony/dance of · in the realm of · little did X know · the air was thick with · a stark
> reminder · sent shivers · whispered promises · orbs (for eyes) · with bated breath · a
> newfound · unbeknownst to · eyes sparkled/twinkled

If your game's premise legitimately needs a banned word, lift it for that game only:
`writing.js` → `allow: ['"tapestry"']`.

## 3. Budgeted constructions (counted per file)

These are not bannable — used once they're fine, used habitually they're the AI "tell." The
linter counts them and warns at the soft budget, errors at the hard ceiling.

- **The antithesis / reversal** — *"It wasn't X. It was Y."* The single most recognizable AI
  cadence. Budget **2/file**, hard ceiling **4**. Reserve it for a genuine turn.
- **"Not just X, but Y"** — same family. Budget **1/file**, hard ceiling **3**.
- **Em-dashes** — soft **1 per 90 words**, hard **1 per 60**. When tempted, reach first for a
  period, then a colon, then paired commas. Keep the dash for real interruption.
- **The "the way X does Y" simile scaffold** — budget **4/file**, never twice in a paragraph,
  never the same vehicle twice. Prefer direct description or apposition.
- **Tricolon "X, Y, and Z"** parallel triads — budget **3/file**. The rule-of-three is
  seductive and monotonous in bulk.

## 4. Census warnings (judgement calls)

The linter reports these without failing; you decide:

- **Hedges** — *seemed to / somehow / as if / something like* — > 6 per 1000 words.
- **Adverb dialogue tags** — *said softly / murmured quietly* — > 4 per 1000 words. Prefer a
  strong verb or an action beat.
- **Thesis / stated-moral closers** — the narrator explaining the point.
- **System boxes that editorialize** — `!!` lines are for rules and state ("FINAL BATTLE",
  "+1 Insight"), not theme ("and that is what mercy costs").

## 5. Per-game voice config (`games/<id>/writing.js`)

Optional. Anything you set merges over the defaults.

```js
export default {
  pov: "second", tense: "present for action, past for memory",
  allow: ['"tapestry"'],                       // lift a default ban for this game
  bans: [[/\bthe Weave itself\b/i, '"the Weave itself"']],  // add your own
  budgets: { reversalPerFile: 1, emDashPerWords: 110 },     // tighten/loosen
  signatures: { "which is how": { perFile: 1 } },  // a phrase you use ON PURPOSE, capped
  motifs: { "arithmetic": { perFile: 3 } },        // load-bearing theme word, capped/file
};
```
- **signatures** are phrases your narrator owns; the linter ERRORs if they exceed the cap, so
  they stay a signature instead of a verbal tic.
- **motifs** are theme words; WARN over the cap per file.

## 6. Combat and system prose

- Combat prose: short sentences. One sensory anchor (sound/temperature) per fight, not per
  line.
- Every enemy `open`/`tele` line is player-visible and IS linted — write them like prose, not
  stat blocks.

## 7. Workflow

```
node tools/cli.mjs lint games/<id>            # report (errors + warnings)
node tools/cli.mjs lint games/<id> --warn     # strict: fail on warnings too
node tools/cli.mjs all  games/<id>            # build/audit/lint(gate)/test
```
Run `lint --warn` before locking a chapter. Aim for zero warnings in finished prose; a couple
of intentional, justified ones are acceptable if you can defend each.
