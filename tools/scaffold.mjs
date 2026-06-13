// Scaffold a new game project under games/<id>/. Produces a complete, buildable,
// passing minimal game so authors (human or LLM) start from green, not a blank page.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";

const GAME_JS = (id, title) => `// ${title} — weft game definition (manifest).
// Everything game-specific lives here: stats, pools, items, enemies, systems.
// Scenes live in scenes/*.dsl and compile to build/scenes.js.
export default {
  meta: { id: ${JSON.stringify(id)}, title: ${JSON.stringify(title)}, subtitle: "an interactive fiction", saveVersion: 1,
    theme: { "--accent": "#e8c15a" },
    art: { style: "ink-wash" } },          // ink-wash | noir | storybook | pixel | oil (sets art + UI palette)
  start: "start",
  // HUD panels (top-level). Each becomes a "✦ Title" button opening an overlay.
  surfaces: {
    journal: { title: "The Story So Far", show: ["stats", "bonds", "chronicle"] },
  },
  state: {
    name: "You",
    stats: { wits: 2, nerve: 2 },                 // base abilities
    pools: { resolve: { max: (s) => 6 + s.nerve * 2 } },
    vars: { met_stranger: false },                // declare flags you read in scenes
    abilities: [],
    inventory: {},
    equipment: {},
  },
  items: {
    // key: { name, slot?, mods?:{stat:+n}, poolMax?:{pool:+n}, desc? }
  },
  enemies: {
    // key: { name, hp, open, moves:[{n,d}], p2?, p2at?, p2text?, interventions? }
  },
  // Enable systems your game uses. Omit combat entirely for pure narrative.
  systems: {
    checks: { die: 20 },
  },
  // For dynamic go: choices, list their possible targets so the audit stays complete.
  auditEdges: {},
  endings: [],
};
`;

const START_DSL = `--- start
art: title
brief: a lone figure at a forked trailhead under a wide sky, a story not yet written
:: <h1>${"${G.def?.meta?.title||''}"}</h1>
You stand at the trailhead of a story not yet written. \${G.name}, the road forks.

* Take the high road -> high
* Take the low road
  do: flag('met_stranger'); chronicle('You took the low road, and did not walk it alone.')
  go: "low"

--- high
You climb. The air thins; the view opens. There is nothing here yet but possibility.

* Make a small wager on yourself -> end_high
  req: G.eff.nerve >= 1 | needs steady nerve
  do: check('nerve', 8) ? bond('fortune', 1) : note('The dice cool.', 'loss')
* Turn back -> start

--- end_high
ending: true
!! AN ENDING: THE HIGH ROAD
You reached the summit of the smallest possible story. Replace this with your own.

* Begin again -> start

--- low
[[if v.met_stranger]]
A stranger falls into step beside you and says nothing, which is somehow companionable.
[[else]]
You walk alone.
[[end]]
The low road ends, for now, at a quiet ending.

* Rest here -> end_low

--- end_low
ending: true
!! AN ENDING: THE LOW ROAD
A short, complete thread. Now make it longer.

* Begin again -> start
`;

const WRITING_JS = `// Optional per-game voice config (merged over src/writing/rules.js).
// See WRITING.md. Everything here is optional.
export default {
  pov: "second", tense: "present for action, past for memory",
  // allow: ['"tapestry"'],            // lift a default ban for this game only
  // bans: [[/\\\\bsome phrase\\\\b/i, '"some phrase"']],
  // budgets: { reversalPerFile: 1 },  // tighten/loosen the AI-tic ceilings
  // signatures: { "which is how": { perFile: 1 } },
  // motifs: {},
};
`;

const REPLAYS = `[
  { "name": "high road ending", "seed": 1, "script": ["c0", "c0"], "expect": { "scene": "end_high", "ending": true } },
  { "name": "low road ending", "seed": 1, "script": ["c1", "c0"], "expect": { "scene": "end_low", "ending": true } }
]
`;

export async function scaffold(gameDir, id, title) {
  await mkdir(join(gameDir, "scenes"), { recursive: true });
  await mkdir(join(gameDir, "assets"), { recursive: true });
  await writeFile(join(gameDir, "game.js"), GAME_JS(id, title || id));
  await writeFile(join(gameDir, "scenes", "start.dsl"), START_DSL);
  await writeFile(join(gameDir, "replays.json"), REPLAYS);
  await writeFile(join(gameDir, "writing.js"), WRITING_JS);
  return gameDir;
}
