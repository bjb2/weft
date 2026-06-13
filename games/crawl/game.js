// The Sunken Vault — weft game definition (manifest).
// A stat/combat/inventory dungeon crawl: equipment, abilities, bonds, a simple
// foe and a two-phase boss with a data-driven ally intervention.
export default {
  meta: {
    id: "crawl",
    title: "The Sunken Vault",
    subtitle: "a dive into the drowned reliquary",
    saveVersion: 1,
    theme: { "--accent": "#5ad6e8", "--bg": "#06090f" },
    art: { style: "ink-wash" },
  },

  start: "start",

  // HUD control panels (top-level). Each becomes a "✦ Title" button opening an overlay.
  surfaces: {
    journal: { title: "Dive Log", subtitle: "the descent so far", show: ["stats", "pools", "bonds", "chronicle"], bondTiers: { 3: "sworn", 2: "trusted", 1: "met" } },
    satchel: { title: "Satchel", show: ["inventory", "equipment", "abilities"] },
  },

  state: {
    name: "Diver",
    stats: { body: 3, mind: 2, heart: 2 },                       // base 2-3
    pools: {
      hp:    { max: (s) => 16 + s.body * 2 },                    // pool tied to body
      focus: { max: 6, start: "max" },                           // combat resource
    },
    vars: { warned: false, freed_companion: false },             // declared flags
    bonds: { companion: 0 },                                     // relationship counter
    abilities: ["snare", "cut", "mend", "mirror"],               // ⊆ declared techniques
    inventory: {},
    equipment: { weapon: "dagger" },                             // starts equipped
  },

  items: {
    dagger: { name: "Diver's Dagger", slot: "weapon", mods: { body: 1 }, desc: "a stubby blade for tight water" },
    blade:  { name: "Bronze Tideblade", slot: "weapon", mods: { body: 2 }, desc: "old guard-steel, still keen" },
    charm:  { name: "Pearl Charm", slot: "trinket", mods: { mind: 1 }, poolMax: { focus: 2 }, desc: "steadies the breath" },
    tonic:  { name: "Salt Tonic", desc: "a bitter restorative" },
    vaultkey: { name: "Gilded Vault Key", desc: "warm to the touch" },
  },

  enemies: {
    // Simple foe: a short linear cycle, no phases.
    sentinel: {
      name: "Bronze Sentinel", hp: 14,
      open: "A corroded automaton grinds upright, halberd swinging to guard.",
      moves: [
        { n: "Halberd Sweep", d: 4, tele: "It hauls the halberd back to sweep." },
        { n: "Shield Bash", d: 3, tele: "It cocks its shield arm." },
        { n: "Pike Thrust", d: 5, tele: "It levels the pike at your chest." },
      ],
    },

    // Boss: two phases, stance / charge+release / heal-with-drain, ally hooks.
    warden: {
      name: "The Drowned Warden", hp: 26,
      open: "The Warden rises from the flooded dais, brine sheeting off ancient bronze.",
      p2at: 11,
      p2text: "The shell of lacquer splits — what's left of the Warden moves like the tide itself.",
      moves: [
        { n: "Stance: Brine-lacquer", kind: "stance", st: "iron", text: "Lacquer hardens over the Warden.", tele: "It braces, hard as a hull." },
        { n: "Needle Lance", d: 5, drain: 2, tele: "It draws the long needle." },
        { n: "Gathering Tide", kind: "charge", text: "Water spirals up around the Warden.", tele: "A great surge is gathering." },
        { n: "Crashing Wave", d: 11, kind: "release", tele: "The wave hangs, ready to fall." },
        { n: "Drink the Deep", kind: "heal", h: 4, text: "It pulls the flood into its wounds and knits.", tele: "It draws on the deep." },
      ],
      p2: [
        { n: "Stance: Riptide", kind: "stance", st: "flow", text: "The Warden runs loose as a current.", tele: "It flows; a plain blow will break it." },
        { n: "Flood Strike", d: 6, tele: "It rakes a torrent at you." },
        { n: "Maelstrom", kind: "charge", text: "A whirl winds tight around it.", tele: "Something vast is winding up." },
        { n: "Undertow", d: 12, kind: "release", tele: "The undertow coils to drag you down." },
      ],
      interventions: [
        { on: "defeat", when: ($) => $.G.bonds.companion >= 2, once: true, hp: 10, log: "Mara hauls you out of the black water — you breathe, and stand." },
        { on: "phase2", once: true, snare: true, log: "Mara jams a pry-bar in the gears — the Warden seizes for a breath." },
      ],
    },
  },

  systems: {
    checks: { die: 20 },
    combat: {
      resource: "focus",
      power: "body",
      strikeBase: 2,
      startResourceFrac: 0.75,
      roundRegen: 1,
      guardRegen: 2,
      foeMul: 1.0,
      hpPool: "hp",
      winHpFloor: 1,
      techniques: {
        snare:  { name: "Snare",  desc: "bind the foe a turn", cost: 2, type: "bind", base: 1, vsFlow: "fail" },
        cut:    { name: "Cut",    desc: "sharp damage", cost: 2, type: "damage", stat: "body", base: 3, vsFlow: "half" },
        mend:   { name: "Mend",   desc: "knit your wounds", cost: 3, type: "heal", pool: "hp", base: 3, stat: "heart", mul: 1 },
        mirror: { name: "Mirror", desc: "reflect the next blow", cost: 3, type: "reflect" },
        rend:   { name: "Rend",   desc: "interrupt a charge or stance", cost: 3, type: "interrupt", stat: "mind", base: 2, chargeBonus: 6, stanceBonus: 3 },
      },
      stances: {
        iron: { see: "Braced like a hull — plain blows ring off; threads slip in.", strike: "min1", kind: "iron" },
        flow: { see: "Running like a current — knots slide off; a plain blow shears it.", strike: "+2", kind: "flow" },
      },
    },
  },

  // Dynamic go: in `gallery` one choice resolves its target via check(); declare
  // both possible destinations so reachability stays complete.
  auditEdges: { gallery: ["sealeddoor", "guardroom"] },

  endings: ["victory", "defeat", "escape"],
};
