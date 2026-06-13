// Dead Air — weft game definition (manifest).
// A mage from a high-fantasy world is torn through a rift into contemporary
// Portland, where his magic is smothered by electromagnetic fields: it works
// only in true dead zones (deep forest, dead buildings, blackouts). Witty,
// melancholic fish-out-of-water; pure narrative + stats + checks + inventory.
export default {
  meta: {
    id: "deadair",
    title: "Dead Air",
    subtitle: "the most powerful man alive, and the city won't stop humming",
    saveVersion: 1,
    // Bespoke look (local SD 3.5 Medium via tools/comfy). A rain-soaked
    // contemporary city rendered in desaturated blue-grey, pierced by the one
    // luminous teal of working magic — the UI palette matches the art.
    art: {
      descriptor: "moody cinematic painterly digital illustration, contemporary 2026 American city in the rain at night, semi-realistic with loose oil-brush texture and soft focus, deep desaturated blue-grey and charcoal palette pierced by a single luminous bioluminescent teal magic glow, wet asphalt reflections and neon bokeh, volumetric haze, melancholic and atmospheric, dramatic film-still lighting, highly detailed",
      framing: "cinematic wide composition, atmospheric depth, no text, no words, no watermark, no signature, no caption, no logo, no border, no frame",
      palette: {
        "--bg": "#0a0e13", "--bg2": "#121a24", "--panel": "#0f161f",
        "--ink": "#d6dee7", "--dim": "#7b8794",
        "--accent": "#5fd6c0", "--accent2": "#2f7d74",
        "--good": "#6bbf9a", "--bad": "#d0635a", "--cool": "#6f9fc0", "--line": "#1f2a34",
      },
      cast: "recurring protagonist Elandor: a tall gaunt middle-aged man with a silver-streaked dark beard, hawk nose and weather-grey eyes, in soaked midnight-blue mage's robes under a grey thrift-store coat, holding a yew staff; keep his appearance consistent across scenes",
      anchor: "gorge",
    },
  },

  start: "start",

  // HUD panels. The journal is his interior ledger; the satchel is what he carries.
  surfaces: {
    journal: {
      title: "The Long Way Home",
      subtitle: "what the city has done to you",
      show: ["stats", "pools", "bonds", "chronicle"],
      labels: { chronicle: "What you remember", stats: "The Self", pools: "State" },
      bondTiers: { 3: "trusted", 2: "warm", 1: "met" },
    },
    satchel: { title: "What You Carry", subtitle: "the weight in your pockets", show: ["inventory"] },
  },

  // CHARACTER REFERENCE SHEET. `brief` is each character's canonical look; the
  // art pipeline renders portraits first, then conditions scenes on them so the
  // cast never drifts. The Knell is a creature, not a speaker — it has no entry.
  cast: {
    you:    { name: "Elandor", self: true, pfp: "pfp_elandor", color: "#6fd0c0",
              brief: "a tall gaunt middle-aged man with a silver-streaked dark beard, hawk nose, and weather-grey eyes, wearing soaked midnight-blue mage's robes over an ill-fitting thrift-store coat, holding a hairline-cracked yew staff" },
    mara:   { name: "Mara", pfp: "pfp_mara", color: "#e0a85a",
              brief: "a tired kind woman in her thirties with a brown undercut, freckles, and a coffee-stained green apron, a small silver nose ring" },
    okafor: { name: "Dr. Okafor", pfp: "pfp_okafor", color: "#7ea7d8",
              brief: "a sharp Black woman in her sixties with close-cropped grey hair and rimless glasses, in a rumpled corduroy blazer, holding a battered EMF meter" },
    dev:    { name: "Dev", pfp: "pfp_dev", color: "#c75a4a",
              brief: "a wiry young man with a patchy beard, beanie, and a ringlight reflected in his glasses, draped in three cameras and a power-bank vest" },
    tariq:  { name: "Tariq", pfp: "pfp_tariq", color: "#8aa86a",
              brief: "a stout calm older man with a grey moustache, in a cardigan behind a corner-store counter lit by humming coolers, a prayer-bead bracelet on one wrist" },
    reyes:  { name: "Agent Reyes", pfp: "pfp_reyes", color: "#9c8b78",
              brief: "a composed federal agent in her forties, charcoal suit, lanyard badge, an unremarkable face built for forgetting, holding a tablet" },
  },

  state: {
    name: "Elandor Voss",
    // arcana: raw magical power (rolled against a zone's EMF difficulty).
    // guile:  reading people, persuasion, stealth, blending in.
    // grasp:  understanding of the modern world — tech, money, the rules here.
    stats: { arcana: 4, guile: 1, grasp: 1 },
    pools: {
      // Composure: sanity / adaptation. Spent on humiliation, dread, despair;
      // regained by wonder, rest, and people who believe you. Max grows as the
      // world stops being a wall and starts being a place you understand.
      composure: { max: (s) => 6 + s.grasp * 2, start: "max" },
    },
    vars: {
      // resources (read in conditions)
      cash: 0,            // dollars scraped together
      suspicion: 0,       // how badly the city has noticed you

      // progress flags — declare every flag any scene READS
      went_viral: false,  // the plaza spell fizzled on camera
      met_mara: false,    // the woman from the plaza has a name
      knows_emf: false,   // you understand the rule that smothers you
      found_deadzone: false, // a reliable pocket of silence inside the city
      staff_fixed: false, // the cracked staff made whole
      has_ride: false,    // a way out of the city's grid
      shard_charged: false, // the rift-shard filled at full power
      knell_met: false,   // the thing that followed you through
      knell_beaten: false,// you drove it off
      knows_ritual: false,// you understand how to tear the rift open again
      told_truth: false,  // you let someone in, knowing the cost
      helped_quietly: false, // you spent magic on a stranger at real risk
      faced_agents: false,// the Office has put a face to the anomaly
    },
    abilities: [],
    inventory: { staff: 1, robes: 1, shard: 1, coin: 1 },
    equipment: {},
  },

  items: {
    staff: { name: "Cracked Staff", desc: "yew and old silver, split down one finger's length; a focus that no longer quite focuses" },
    robes: { name: "Sodden Robes", desc: "midnight wool stitched with cooling runes; magnificent, ruinous to wear in public" },
    shard: { name: "Rift-Shard", desc: "a sliver of the between-place; cold, and it hums when the air goes quiet" },
    coin:  { name: "Silver Mark", desc: "minted in a kingdom that does not exist here; worthless, and the only money you trust" },
    coat:  { name: "Thrift-Store Coat", desc: "grey, anonymous, smells of someone else's winter; the best disguise you own" },
    phone: { name: "Burner Phone", desc: "a slab of the thing that unmakes you; also, apparently, indispensable" },
  },

  // Pure narrative + checks + inventory. No combat: the Knell is faced with a
  // skill check, not a fight scene, because power here is a gamble, not a stat bar.
  systems: { checks: { die: 20 } },

  // Continuity registry. Only places with clean single introductions are
  // position-checked; the recurring cast is tracked (declared-and-used) but not
  // position-gated, since a hub-and-spoke names people across many routes.
  entities: {
    characters: {
      mara:   { name: "Mara", aliases: [] },
      okafor: { name: "Dr. Okafor", aliases: ["Okafor"] },
      dev:    { name: "Dev", aliases: ["PrismVox"] },
      tariq:  { name: "Tariq", aliases: [] },
      reyes:  { name: "Agent Reyes", aliases: ["Reyes", "the Office"] },
      knell:  { name: "the Knell", aliases: [] },
    },
    places: {
      portland:  { name: "Portland", aliases: ["the city"], first: "start" },
      forestpark:{ name: "Forest Park", aliases: [], first: "forestpark" },
      gorge:     { name: "the Gorge", aliases: ["the Columbia Gorge"], first: "roadtrip" },
    },
    lore: {
      rift:   { name: "the rift", aliases: ["the tear"] },
      reaches:{ name: "the Mistral Reaches", aliases: [] },
    },
  },

  // Length budget — the ~10,000-word target is enforced per scene (the teeth);
  // corpus is reported as progress. Hubs/endings carry explicit budgets below.
  length: { corpus: 10000, perScene: 380, tolerance: 0.12, enforceCorpus: false },

  // Dynamic go: destinations, listed so reachability stays provable.
  auditEdges: {
    plaza:      ["viral", "hub"],
    forestpark: ["knell", "forestpark_wonder"],
    knell:      ["knell_won", "knell_lost"],
    agents:     ["hub", "end_taken"],
    cafe:       ["cafe_truth", "hub"],
    ritual:     ["end_home", "ritual_fail"],
    ritual_fail:["end_exile", "end_hybrid"],
    gather:     ["ritual", "end_hybrid", "end_exile"],
  },

  endings: ["end_home", "end_exile", "end_hybrid", "end_despair", "end_taken"],
};
