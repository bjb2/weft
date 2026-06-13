# Authoring a weft game

This is the complete spec for building a game. A game is **two things**:

1. `game.js` — the **manifest**: a JS module `export default` of a definition object. All
   game-specific data (stats, pools, items, enemies, systems) lives here.
2. `scenes/*.dsl` — the **story**: scene files in the weft DSL. They compile to
   `build/scenes.js`.

You author both, then run `node tools/cli.mjs all games/<id>`, which **compiles**,
**audits** (reachability + render safety + reference/typo checks), and **tests**
(replay specs + seeded fuzz). If it prints `tests OK`, the game is sound.

A game can be **pure narrative** (no combat, just branching prose + flags + checks) or a
**stat/combat/inventory** game. Enable only the systems you use.

---

## 1. The manifest (`game.js`)

```js
export default {
  meta: {
    id: "mygame",                 // unique slug; also the save key
    title: "My Game",
    subtitle: "an interactive fiction",
    saveVersion: 1,               // bump only when you change state shape incompatibly
    theme: { "--accent": "#e8c15a", "--bg": "#0a0d14" }, // optional CSS variables
  },

  start: "start",                 // id of the opening scene

  state: {                        // the initial player state
    name: "Hero",
    stats:  { body: 2, mind: 3, heart: 2 },          // base stats (numbers)
    pools:  { hp: { max: (s) => 16 + s.body * 2 },   // max may be a number OR a fn of
              focus: { max: 6, start: "max" } },     //   *effective* stats; start defaults to max
    vars:   { met_oracle: false },  // DECLARE every flag/var you READ in scenes (see §4)
    bonds:  ["ally"],               // relationship counters (array → all start 0) or { ally: 0 }
    abilities: ["snare"],           // starting combat techniques (must be declared in systems.combat)
    inventory: { torch: 1 },        // starting items (id → qty)
    equipment: { weapon: "stick" }, // starting equipped items (slot → item id)
  },

  items: {
    stick:  { name: "Walking Stick", slot: "weapon", mods: { body: 1 } },
    amulet: { name: "Amulet of Wit", slot: "trinket", mods: { mind: 2 }, poolMax: { focus: 2 } },
    torch:  { name: "Torch", desc: "lights the dark" },   // plain item, no slot
  },

  // Speaking characters for attributed dialogue (see §2). Each `@id:` line in a
  // scene resolves to one of these. Omit entirely if your game has no dialogue.
  cast: {
    you:    { name: "You", pfp: "you", self: true, color: "#e8c15a" }, // self: right-aligned bubble
    oracle: { name: "The Oracle", pfp: "oracle", color: "#7ea7d8",     // pfp -> assets/oracle.{png,svg}
              brief: "a blind seer wrapped in moth-grey silk" },        // brief: the portrait art prompt
  },

  enemies: { /* see §5; omit if no combat */ },

  systems: {
    checks: { die: 20 },          // skill-check die size (default 20)
    combat: { /* see §5; omit entirely for pure-narrative games */ },
  },

  // For choices that use a dynamic `go:` expression, list the possible targets so the
  // reachability audit stays complete. Static `-> target` choices don't need this.
  auditEdges: { crossroads: ["north", "south", "east"] },

  endings: [],                    // optional, for your own bookkeeping
};
```

**Effective stats** = base stats + equipment `mods`. Pool maxima are formulas over the
effective stats, plus equipment `poolMax`. Equipping/unequipping always recomputes cleanly.

---

## 2. Scene DSL

A `.dsl` file holds one or more scenes. A scene:

```
--- sceneId
art: forest                  # optional: asset name -> assets/forest.png (svg fallback)
brief: a misty pine forest at dawn   # optional: subject for image generation (see §9)
cast: hero, guide            # optional: characters on screen, for on-model art (see §9)
ref: none                    # optional: skip anchor/character art conditioning (splash art)
ending: true                 # optional: marks a terminal scene (audit + autoplay)

Prose paragraph. Blank lines separate paragraphs. You can interpolate
expressions: Hello ${G.name}, your wits are ${G.eff.mind}.

!! A line in a system box (for chapter titles, rules, stingers).
~~~                          # a centered divider
:: <em>raw HTML passes through unwrapped</em>

[[if v.met_oracle]]
Shown only when the flag is set.
[[else]]
Shown otherwise.
[[end]]
@oracle: You came back. They always come back.
@you: I need the door that the river forgot.


* A choice label -> targetScene
* A gated choice -> otherScene
  req: G.eff.mind >= 4 | needs a sharp mind     # text after | shows when locked
* A choice with a side effect -> thirdScene
  do: give('key'); flag('took_key')             # statements run before navigating
* A hidden-until choice -> secret
  hide: !has('map')                             # choice is omitted entirely while true
* A dynamic destination
  do: set('route', 'north')
  go: v.route === 'north' ? 'northRoom' : 'southRoom'   # go: = computed target
```

Rules the compiler enforces:
- Every non-combat, non-ending scene **must** have at least one choice (no dead ends).
- Every `-> target` and `win:`/`lose:` target must be a real scene id.
- `* label` with no `-> target` needs a `go:` line; `* label -> target` may still add
  `req`/`hide`/`do`.
- Choice attribute lines (`req`/`do`/`hide`/`go`) are indented under their `*` choice.
- Every `@speaker:` dialogue line must name a character declared in `def.cast`
  (an undeclared speaker is a fatal compile error — the same loud failure as a
  bad jump target or an undeclared variable).

**Dialogue** (`@id: line`) renders as an attributed chat bubble with the
character's profile picture, name, and accent color; the player's own lines
(`self: true`) align right. The CLI/test harness projects each line to plain
`Name: line`. The spoken text interpolates `${...}` and is linted as prose
(`WRITING.md`) — write `tele`-quality lines, not stage directions. Profile
pictures come from `assets/<pfp>.{png,svg}`; `weft build` auto-generates a
circular placeholder so every character shows immediately (see §9).

**`req`/`do`/`hide`/`go` and `${...}` are raw JavaScript — the compiler does NOT escape them.**
- Mind your quotes inside strings. Simplest: use double quotes around text with
  apostrophes — `chronicle("Buc-ee's")`. An unescaped quote produces a `SyntaxError` in the
  generated `build/scenes.js`, not a friendly DSL error.
- In `req:`, the hint after a **spaced** ` | ` is split off as the locked-message; everything
  before it is the condition. Use `&&`/`||` freely in the condition (e.g.
  `req: has('key') && v.brave | you hesitate`) — only a literal ` | ` (space-pipe-space)
  starts the hint.

---

## 3. The authoring context `$`

Every expression and statement (prose `${...}`, `[[if ...]]`, and `req`/`hide`/`do`/`go`)
runs with these names in scope:

| Read state | |
|---|---|
| `G` | the whole state object |
| `v` | `G.vars` — your flags/vars (use in conditions: `v.met_oracle`) |
| `G.eff` | **effective** stats (base + equipment) — use for checks/gates |
| `G.stats` | base stats · `G.pools.hp.cur` / `.max` · `G.bonds.ally` · `G.equip.weapon` |

| Mutate / act | |
|---|---|
| `set(name, val)` / `get(name)` | set/read a var |
| `flag(name, val=true)` | shorthand set |
| `add(stat, n)` | change a base stat (recomputes derived) |
| `gain(pool, n)` / `spend(pool, n)` | adjust a pool's current |
| `give(id, n=1)` / `take(id, n=1)` / `has(id, n=1)` | inventory |
| `equip(id)` / `unequip(slot)` | equipment (moves item to/from inventory) |
| `bond(name, n)` | adjust a relationship counter |
| `learn(id)` | grant a combat technique |
| `check(stat, dc)` | skill check: d20 + effective stat ≥ dc → `true` (seeded, deterministic) |
| `rand()` / `randint(n)` | seeded RNG: float [0,1) / int [0,n) |
| `note(text, cls)` | queue a one-line note (`cls`: `gain`/`loss`) shown on next render |
| `chronicle(text)` | record a permanent milestone in "the story so far" (idempotent) |

| Markup (in prose you rarely need these; use plain text) | |
|---|---|
| `P` `SYS` `DIV` `B` `I` `SMALL` | paragraph / system box / divider / bold / italic / small |

**Determinism matters.** All randomness goes through `check`/`rand`/`randint`, which use a
seeded PRNG stored in the save. This is what makes recorded playthroughs replay identically.

---

## 4. The variable typo guard (important)

Branching fiction silently rots when `[[if v.tookKey]]` is misspelled as `v.took_key`.
The compiler treats any var **read** (`v.NAME` or `get('NAME')`) that is never **written**
(`flag('NAME')`, `set('NAME', …)`, or declared in `state.vars`) as a **fatal error**.

Practical rule: **declare every flag in `state.vars`** (e.g. `tookKey: false`). Then a typo
in a read is caught at build time instead of becoming a dead branch.

---

## 5. Combat (optional)

Enable by adding `systems.combat` and at least one enemy. A combat scene has no choices;
it declares an enemy and where to go on win/lose:

```
--- bossFight
combat: warden
win: bossDown
lose: bossWin
You face the Warden.        # this prose shows as the fight's intro
```

### `systems.combat` config
```js
combat: {
  resource: "focus",          // pool spent on techniques
  power: "body",              // stat for the free Strike: dmg = strikeBase + eff[power]
  strikeBase: 2,
  startResourceFrac: 0.75,    // fraction of max resource at fight start
  roundRegen: 1, guardRegen: 2, foeMul: 1.0,  // per-round regen, Guard regen, enemy dmg mult
  hpPool: "hp",               // the pool that is "you"
  winHpFloor: 1,              // hp floor after a win
  techniques: {               // the moves a player can learn/use
    snare:   { name: "Snare", desc: "bind the foe a turn", cost: 2, type: "bind", vsFlow: "fail" },
    cut:     { name: "Cut",   desc: "sharp damage",        cost: 2, type: "damage", stat: "mind", base: 4, vsFlow: "half" },
    mend:    { name: "Mend",  desc: "heal",                cost: 3, type: "heal", pool: "hp", base: 3, stat: "heart", mul: 1 },
    mirror:  { name: "Mirror",desc: "reflect next blow",   cost: 3, type: "reflect" },
    break:   { name: "Break", desc: "interrupt a charge/stance", cost: 3, type: "interrupt", stat: "mind", base: 2, chargeBonus: 5, stanceBonus: 3 },
    turn:    { name: "Turn",  desc: "use the foe's move",  cost: 3, type: "turn" },
  },
  stances: {                  // optional enemy stances the player must read
    iron: { see: "Braced like bronze — fists glance off; threads slip between.", strike: "min1", kind: "iron" },
    flow: { see: "Running like water — knots slide off; a plain blow breaks it.", strike: "+2", kind: "flow" },
  },
}
```
Technique `type`s: `damage`, `bind`, `reflect`, `heal`, `interrupt`, `turn`, `counter`.
`vsFlow:"half"` halves damage vs a flow stance; `vsFlow:"fail"` makes a bind fail vs flow.

### Enemy
```js
warden: {
  name: "The Warden", hp: 40, open: "The Warden unfolds, needle in hand.",
  p2at: 16, p2text: "The needle snaps; what's left moves like flood-water.",  // optional phase 2
  moves: [                    // cycled in order; i advances each enemy turn
    { n: "Stance: lacquer", kind: "stance", st: "iron", text: "Lacquer sets over him.", tele: "He is bracing." },
    { n: "Needle", d: 6, drain: 2 },                       // d = damage; drain = drains your resource
    { n: "Threading", kind: "charge", text: "The needle threads.", tele: "A big strike is coming." },
    { n: "Spindle Strike", d: 12, kind: "release" },       // release: weak unless the charge landed
    { n: "Mend", kind: "heal", h: 5, text: "The house knits him whole.", tele: "He draws on the house." },
  ],
  p2: [ /* optional phase-2 move list, same shape */ ],
  interventions: [            // optional, data-driven ally hooks — no NPC names in the engine
    { on: "defeat", when: ($) => $.G.bonds.ally >= 2, once: true, hp: 8, log: "Your ally drags you up." },
    { on: "phase2", once: true, snare: true, log: "An ally cracks the floor — the foe is bound." },
    { on: "start",  when: ($) => v.scouted, charge: false, log: "You opened from cover." },
  ],
}
```
`interventions[].on` is `start` | `phase2` | `defeat`. `when($)` is optional. Effects:
`hp` (revive to at least n), `snare`, `charge`, `advance` (skip n enemy moves), `log`.

---

## 6. Replay specs (`replays.json`)

Golden-path regression tests. Each runs the script of choice/action ids from a seed and
asserts where it lands. Combat actions use the technique id or `"strike"`/`"guard"`.

```json
[
  { "name": "good ending", "seed": 1, "script": ["c0", "c1", "snare", "strike", "strike"],
    "expect": { "scene": "bossDown", "ending": true } }
]
```
Choice ids are `c0`, `c1`, … in the order the choices appear (after `hide` filtering at
author time they are still numbered by source order). Add a spec for **each ending** and any
tricky branch.

---

## 7. Build / verify

```
node tools/cli.mjs new   games/<id> <id> "Title"   # scaffold a fresh, passing game
node tools/cli.mjs build games/<id>                # compile + write index.html
node tools/cli.mjs audit games/<id>                # reachability + safety + typo checks
node tools/cli.mjs test  games/<id>                # replays + fuzz
node tools/cli.mjs all   games/<id>                # build + audit + test
node tools/cli.mjs play  games/<id> [seed]         # play in the terminal
```
Open `games/<id>/index.html` in a browser to play with the DOM renderer. Append
`?scene=<id>` to jump to any scene for spot-checking.

A finished game: **audit OK**, **tests OK**, fuzz shows 100% coverage, 0 softlocks, 0 errors,
and every ending appears in the fuzz histogram.

---

## 8. Control surfaces (journal / inventory panels)

Different mechanics need different control surfaces. Declare named panels at the top level of
the manifest under `surfaces`; each becomes a button in the HUD (e.g. "✦ The Story So Far")
that opens an overlay built from the player's current state.

```js
surfaces: {
  journal: { title: "The Story So Far", subtitle: "what you've done",
             show: ["stats", "bonds", "chronicle"] },
  satchel: { title: "Satchel", show: ["inventory", "equipment"] },
},
```
Sections (`show`): `stats` · `pools` · `bonds` · `abilities` · `inventory` · `equipment` ·
`chronicle`. Defaults to all if omitted. Override section labels with `labels: { chronicle:
"Case notes" }` and bond tiers with `bondTiers: { 3:"sworn", 2:"firm", 1:"met" }`.

**The chronicle** is "the story so far": call `chronicle('You freed the sleepers of the Cocoon
House.')` in a choice `do:` block to record a permanent milestone. Entries are idempotent by
text and shown in any panel whose `show` includes `chronicle`. This is the generic version of
golden-thread's "the thread so far" / a mystery's "case notes".

## 9. Art (optional)

### Style
Pick a style once; it sets both the illustration look and the UI palette:
```js
meta: { /* … */ art: { style: "ink-wash" } }   // ink-wash | comic | flat | anime | storybook | noir | oil
// or fully custom: art: { descriptor: "…image style…", framing: "…", palette: { "--accent": "#f0c" } }
```

### Scene art
Mark a scene to illustrate with `art:`, describe the subject with `brief:`, and list
who is on screen with `cast:` (see character references below):
```
--- vault
art: vault
cast: hero, warden
brief: a drowned vault hall, a vast loom of glowing threads over black water
combat: warden
win: victory
lose: defeat
```

### Character references — lock these BEFORE generating character art
Independently-generated images invent a different version of each character every
time. weft prevents that drift with a character reference sheet and an ordered,
enforced pipeline:

1. **Declare the cast** with a canonical visual `brief` + a `pfp` asset name:
```js
cast: {
  hero:   { name: "Mei", self: true, pfp: "pfp_mei", color: "#e8c15a",
            brief: "a teenage girl in patched grey robes with a single jade hairpin" },
  warden: { name: "The Warden", pfp: "pfp_warden", color: "#e0606a",
            brief: "a gaunt figure sewn into lacquer-black armor, a needle for one hand" },
}
```
2. **Generate the portraits first** — these become the references:
   `weft art <game> --portraits`  → `assets/<pfp>.png`
3. **Tag each scene** with `cast:` (the character ids on screen).
4. **Generate scene art** — each scene is rendered *conditioned on the portraits of
   its `cast`* (so they stay on-model) plus the style:
   `weft art <game> --generate`

The order is enforced: a scene naming a character whose portrait does not exist yet
is **skipped** with `missing character reference … run --portraits first` — you
cannot draw a character before locking their look. (Compile also rejects a `cast:`
or `@speaker:` that names a character absent from `def.cast`.)

### Anchors and opt-outs
- `meta.art.anchor: "<scene>"` — a scene whose image is an extra *style* reference
  for every other scene (and the source for extracting character portraits).
- `ref: none` on a scene — generate it standalone, ignoring anchor + cast
  conditioning. Use for splash/title/abstract art that shouldn't match scene style.

### Commands
```
weft art <game>                  # prompts.json + styled SVG placeholders (no API key)
weft art <game> --portraits      # render character reference portraits (DO THIS FIRST)
weft art <game> --generate       # render scenes, conditioned on the portraits
weft art <game> --generate a b   # only those scene/portrait slots (cheap iteration)
```
`build` always refreshes SVG placeholders so a game looks intentional immediately;
the engine prefers `assets/<name>.png` and falls back to `.svg`. Drop
`OPENROUTER_API_KEY` into a `.env` (see `.env.example`) for real generation.
Dialogue bubbles use the same `pfp` portraits (falling back to a colored disc).


## 10. Writing

Prose quality is part of the build. See **[WRITING.md](./WRITING.md)** — `weft all` runs the
prose linter and **fails on hard violations** (cliché bans, em-dash/antithesis ceilings).
Tune per game with `games/<id>/writing.js`.