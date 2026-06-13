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
    // Comic preset themes both the art prompts and the UI; override the accents to
    // a hot-magenta/cyan "for you page" neon for the internet-comedy mood.
    art: {
      style: "comic",
      palette: { "--accent": "#ff5fa2", "--accent2": "#c23d78", "--cool": "#5fd6d6" },
      // Drawn into every scene prompt so the crew stays on-model across images.
      cast: "Always draw the exact same recurring cast of cartoon profile-picture avatars as shown in the reference image — identical character designs, colours, and proportions; never redesign, rename, or swap them",
      // 'river' (the riverwalk) is the visual anchor; other scenes are generated to match its style + characters.
      anchor: "river",
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

  // CHARACTER REFERENCE SHEET. The brief is the canonical look — it matches the
  // characters as they appear in the art. `weft art --portraits` renders each
  // pfp to assets/<pfp>.png; scenes then declare `cast:` and are generated against
  // those portraits so the crew never drifts between images.
  cast: {
    you:   { name: "the main character", self: true, pfp: "pfp_you", color: "#ff5fa2",
             brief: "a glowing verified cartoon profile-picture avatar with electric-blue hair and a permanent smug signature smirk, a faint blue checkmark glow" },
    kit:   { name: "Kit", pfp: "pfp_kit", color: "#5fd6d6",
             brief: "a small teal pixel-cat VTuber avatar, big round eyes, little antennae, a faintly glitchy pixelated tail" },
    brett: { name: "Brett", pfp: "pfp_brett", color: "#c69c6d",
             brief: "a cartoon avatar whose entire head is a brown cardboard box with a blocky face drawn on in marker, in a plain dark tee" },
    woof:  { name: "Sir Woof", pfp: "pfp_woof", color: "#b7c0cb",
             brief: "a small meme-dog avatar wearing dented tin-knight armor and an oversized visored helmet" },
    chad:  { name: "ChadGPT", pfp: "pfp_chad", color: "#ffd23f",
             brief: "a smug square-jawed crypto-bro avatar in mirrored sunglasses with a big gold dollar-sign chain" },
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
    fries:       { name: "Whataburger Fries", desc: "hot, salty, real; spicy ketchup sold separately" },
  },

  // No enemies, no combat — the meme-off is a skill check, not a fight.
  systems: {
    checks: { die: 20 },
  },

  // Dynamic go: choices. List every possible destination so reachability stays complete.
  auditEdges: {
    alamo: ["alamo_win", "alamo_bust"],
    whataburger: ["fries_win", "whataburger"],
    barge: ["barge_win", "barge_ratiod"],
    ritual: ["end_portal", "ritual_fizzle"],
    ritual_fizzle: ["end_portal", "end_canceled"],
  },

  endings: ["end_portal", "end_canceled", "end_arrested", "end_job"],
};
