// The Thread-Keeper — a mid-sized, chaptered wuxia. Three chapters (one .dsl file
// each), per-scene word budgets, an entities/continuity registry, and a story
// bible the expand loop feeds to the model. Demonstrates length enforcement and
// chapter-level accounting toward a corpus target.
export default {
  meta: {
    id: "threadkeeper",
    title: "The Thread-Keeper",
    subtitle: "a wuxia of the drowned monastery and the loom of names",
    saveVersion: 1,
    art: { style: "wuxia" },
  },

  start: "ch1_road",

  length: { corpus: 3500, perScene: 280, tolerance: 0.12 },

  surfaces: {
    journal: { title: "The Pilgrimage", subtitle: "the climb so far", show: ["stats", "chronicle"], labels: { chronicle: "What you learned" } },
  },

  state: {
    name: "Wei",
    stats: { sight: 3, will: 2, mercy: 2 },
    vars: { paid_bo: false, found_thread: false, knows_bo: false },
    inventory: { coin: 2 },
    equipment: {},
  },

  items: {
    coin: { name: "Salt-Coin", desc: "soft grey metal pressed with a reed; the marsh-folk's money" },
  },

  cast: {
    you: { name: "Wei", pfp: "wei", self: true, color: "#e8c15a", brief: "a young woman disciple in mourning-grey, wet to the knee, wuxia character portrait" },
    bo: { name: "Old Bo", pfp: "bo", color: "#7ea7d8", brief: "a weathered old marsh ferryman with a long pole and a guilty stoop, wuxia character portrait" },
    yue: { name: "Master Yue", pfp: "yue", color: "#e0606a", brief: "an ancient blind woman loom-keeper with thread-scarred hands and white eyes, wuxia character portrait" },
  },

  entities: {
    characters: {
      bo: { name: "Old Bo", aliases: ["the ferryman"], first: "ch1_ferry" },
      yue: { name: "Master Yue", aliases: ["Yue"], first: "ch1_hall" },
    },
    places: {
      monastery: { name: "the Drowned Monastery", aliases: ["the monastery"], first: "ch1_road" },
      marsh: { name: "the Reed Marsh", aliases: ["the marsh"], first: "ch1_road" },
    },
    lore: {
      loom: { name: "the Loom of Names", aliases: ["the loom"] },
    },
  },

  systems: { checks: { die: 20 } },
  auditEdges: {},
  endings: ["ch3_end_cut", "ch3_end_mend", "ch3_end_let"],
};
