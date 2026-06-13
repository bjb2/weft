// Last Call at the Undertow — weft demo game (manifest).
// A pure-narrative, dialogue-forward vignette built to show off the cast +
// `@speaker:` dialogue system: four voices, profile-picture portraits, two endings.
export default {
  meta: {
    id: "lastcall",
    title: "Last Call at the Undertow",
    subtitle: "a closing-time conversation in four voices",
    saveVersion: 1,
    art: { style: "noir" },   // noir preset themes both the portraits and the UI
  },

  start: "start",

  surfaces: {
    tab: {
      title: "Your Tab", subtitle: "the night so far",
      show: ["stats", "chronicle"],
      labels: { chronicle: "What you did", stats: "How you're holding up" },
    },
  },

  state: {
    name: "You",
    stats: { nerve: 2, heart: 3 },
    vars: { helped_finch: false, knows_truth: false, made_good: false },
    inventory: { key: 1 },
    equipment: {},
  },

  items: {
    key: { name: "The Bar Key", desc: "brass, worn smooth, trusted to you on your first week" },
  },

  // The speaking cast. Each `@id:` dialogue line resolves here for its name,
  // profile picture (assets/<pfp>.{png,svg}), and accent color. `brief` is the
  // portrait art prompt; `self: true` marks the player (right-aligned bubble).
  cast: {
    you:   { name: "You", pfp: "you", self: true, color: "#aab0c0",
             brief: "a tired young bartender in a dark apron behind a bar at 2am, soft honest face, sleeves rolled" },
    mara:  { name: "Mara", pfp: "mara", color: "#c0444c",
             brief: "a sharp-eyed woman in her sixties who owns the bar, silver hair pinned up, a cigarette behind one ear" },
    finch: { name: "Finch", pfp: "finch", color: "#7e9ad8",
             brief: "a jittery middle-aged man in a rumpled coat, thinning hair, fogged glasses, the look of a man who owes money" },
    dot:   { name: "Dot", pfp: "dot", color: "#d8b86a",
             brief: "a tiny ancient woman with bright knowing eyes and a worn fox-fur collar, a small cruel smile" },
  },

  systems: { checks: { die: 20 } },

  auditEdges: {},
  endings: ["end_stay", "end_leave"],
};
