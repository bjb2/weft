// PFP'd: Stuck in Meatspace — weft game definition (manifest).
// Reverse-isekai comedy: a crew of profile-picture characters get yanked out of
// the infinite scroll and dumped, fully physical, into San Antonio, Texas, 2026.
// Pure narrative + stats + checks + inventory (no combat system).
export default {
  meta: {
    id: "pfpd",
    title: "PFP'd: Stuck in Meatspace",
    subtitle: "a reverse-isekai about getting un-canceled, un-arrested, and back online",
    saveVersion: 1,
    // Pixel preset themes both the art prompts and the UI; override the accents to
    // a hot-magenta/cyan "for you page" neon for the internet-comedy mood.
    art: {
      style: "pixel",
      palette: { "--accent": "#ff5fa2", "--accent2": "#c23d78", "--cool": "#5fd6d6" },
    },
  },

  start: "start",

  // HUD panels. The journal is the player's profile/timeline; the bag is loot.
  surfaces: {
    timeline: {
      title: "The Timeline",
      subtitle: "your main-character arc, so far",
      show: ["stats", "pools", "chronicle"],
      labels: { chronicle: "Receipts", stats: "The Numbers", pools: "Status" },
    },
    bag: { title: "The Hot Bag", subtitle: "what you are carrying IRL", show: ["inventory"] },
  },

  state: {
    name: "the main character",
    // Thematic stats. Higher is better; checks roll d20 + the effective stat.
    stats: { clout: 2, rizz: 3, vibes: 2 },
    pools: {
      // Phone battery: your last tether to the feed. Max scales with Vibes
      // (good vibes = better charge, obviously). Starts full.
      battery: { max: (s) => 10 + s.vibes * 5, start: "max" },
    },
    vars: {
      met_crew: false,    // the squad has reconvened and agreed on the quest
      got_wifi: false,    // tapped the Alamo gift-shop wifi (vibes check)
      went_viral: false,  // won the barge meme-off (clout check)
      ratiod: false,      // lost the barge meme-off
      ascended: false,    // the portal recitation worked (rizz check)
    },
    abilities: [],
    inventory: { phone: 1, vape: 1 },   // start with a cracked phone and a vape
    equipment: {},
  },

  items: {
    phone:       { name: "Cracked Phone", desc: "one bar, a spiderweb screen, 6% battery of pure hope" },
    vape:        { name: "Mango Vape", desc: "currency, comfort, and a small personal weather system" },
    checkmark:   { name: "Verified Checkmark", desc: "a small blue badge that means strangers must believe you" },
    energydrink: { name: "Buc-ee's Energy Drink", desc: "legally distinct from rocket fuel; tastes blue" },
    tacos:       { name: "Breakfast Tacos", desc: "bean and cheese, barbacoa, the true currency of San Antonio" },
  },

  // No enemies, no combat — the meme-off is a skill check, not a fight.
  systems: {
    checks: { die: 20 },
  },

  // Dynamic go: choices. List every possible destination so reachability stays complete.
  auditEdges: {
    alamo: ["alamo_win", "alamo_bust"],
    whataburger: ["taco_win", "whataburger"],
    barge: ["barge_win", "barge_ratiod"],
    ritual: ["end_portal", "ritual_fizzle"],
    ritual_fizzle: ["end_portal", "end_canceled"],
  },

  endings: ["end_portal", "end_canceled", "end_arrested", "end_job"],
};
