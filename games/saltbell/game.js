// The Salt-Iron Bell — a short wuxia errand. Built to exercise the length gate
// (per-scene word budgets), the entities/continuity gate, and the expand loop.
export default {
  meta: {
    id: "saltbell",
    title: "The Salt-Iron Bell",
    subtitle: "a wuxia errand at the edge of a dying sect",
    saveVersion: 1,
    art: { style: "wuxia" },
  },

  start: "start",

  // Length budget: the new machine-checked invariant. Each narrative scene must
  // meet its `budget:` (declared in the DSL); the corpus target is reported.
  length: { corpus: 1300, perScene: 200, tolerance: 0.12 },

  surfaces: {
    scroll: { title: "The Errand", subtitle: "the road so far", show: ["stats", "chronicle"], labels: { chronicle: "What you did" } },
  },

  state: {
    name: "the courier",
    stats: { wit: 3, nerve: 2, mercy: 2 },
    vars: { paid_ren: false, read_letter: false },
    inventory: { letter: 1 },
    equipment: {},
  },

  items: {
    letter: { name: "A Sealed Letter", desc: "wax the colour of dried blood, no name on the face" },
  },

  cast: {
    you: { name: "You", pfp: "you", self: true, color: "#e8c15a", brief: "a young road-worn courier in grey travelling clothes, wuxia character portrait" },
    ren: { name: "Ren", pfp: "ren", color: "#7ea7d8", brief: "a lean gatekeeper monk leaning on a bamboo staff, wuxia character portrait" },
    lou: { name: "Master Lou", pfp: "lou", color: "#e0606a", brief: "a frail blind sect master in faded saffron robes, wuxia character portrait" },
  },

  // Continuity registry: each character/place names the scene that introduces it.
  // The continuity gate proves none is referenced on a path that skips that scene.
  entities: {
    characters: {
      ren: { name: "Ren", aliases: ["the gatekeeper"], first: "gate" },
      lou: { name: "Master Lou", aliases: ["the old master", "Lou"], first: "hall" },
    },
    places: { pass: { name: "the Salt-Iron Pass", aliases: ["the pass"], first: "start" } },
    lore: { bell: { name: "the salt-iron bell", aliases: ["the bell"] } },
  },

  systems: { checks: { die: 20 } },
  auditEdges: {},
  endings: ["end_deliver", "end_read", "end_burn"],
};
