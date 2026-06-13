// The Forking Path — weft game definition (manifest).
// Everything game-specific lives here: stats, pools, items, enemies, systems.
// Scenes live in scenes/*.dsl and compile to build/scenes.js.
export default {
  meta: { id: "sample", title: "The Forking Path", subtitle: "an interactive fiction", saveVersion: 1,
    theme: { "--accent": "#e8c15a" } },
  start: "start",
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
