// The Ashford Inheritance — weft game definition (manifest).
// Pure-narrative Gothic mystery: no combat system, no enemies.
export default {
  meta: {
    id: "mystery",
    title: "The Ashford Inheritance",
    subtitle: "a Gothic mystery in one long night",
    saveVersion: 1,
    theme: { "--accent": "#b08d57", "--bg": "#0d0b10" },
  },
  start: "start",
  state: {
    name: "Inspector Vane",
    stats: { wits: 3, nerve: 2 },                  // base abilities
    pools: { composure: { max: (s) => 4 + s.nerve * 2 } }, // derived from nerve
    vars: {
      ledger_clue: false,   // wits check: spotted the forged column
      cellar_ok: false,     // nerve check: held steady in the dark
      read_will: false,     // opened the trunk, read the forged will
      met_crane: false,     // spoke with the steward
    },
    abilities: [],
    inventory: {},
    equipment: {},
  },
  items: {
    letter: { name: "Scorched Letter", desc: "a threat in the late Lord's own ink" },
    key:    { name: "Brass Cellar Key", desc: "cold, toothed, attic-bound" },
    ledger: { name: "Estate Ledger", desc: "columns that do not add up" },
  },
  // No enemies, no combat — pure narrative.
  systems: {
    checks: { die: 20 },
  },
  // Dynamic go: targets must be declared for the reachability audit.
  auditEdges: {
    study: ["study_found", "study_miss"],
    cellar: ["cellar_key", "cellar_fail"],
    accuse: ["end_solved", "end_wrong"],
  },
  endings: ["end_solved", "end_wrong", "end_flee"],
};
