// Default writing ruleset — the machine-checkable half of WRITING.md. The linter
// (tools/prose-lint.mjs) enforces these against scene prose; a game may override
// or extend them with a games/<id>/writing.js module (merged over these defaults).
//
// Two tiers:
//   bans         -> hard ERROR (gate). Clichés/AI-isms with no good use in fiction.
//   budgets      -> per-file density ceilings (soft = WARN, hard = ERROR).
//   constructions-> the AI "voice" tells; counted and capped.
//   signatures   -> phrases YOUR game intentionally uses, capped so they stay rare.
//   motifs       -> load-bearing theme words, capped outside their home scenes.
//   thesis/hedge/tag -> WARN-tier census; need authorial judgement, not a clean gate.

export const DEFAULT_RULES = {
  // Narrative defaults; informational (the linter doesn't enforce POV/tense).
  pov: "second",
  tense: "present for action, past for memory",

  // Hard bans — the most recognizable AI-prose tells and tired clichés.
  bans: [
    [/\ba testament to\b/i, '"a testament to"'],
    [/\bcouldn['’]t help but\b/i, '"couldn\'t help but"'],
    [/\bcan['’]t help but feel\b/i, '"can\'t help but feel"'],
    [/\bpalpable\b/i, '"palpable"'],
    [/\bit['’]s worth noting\b|\bit is worth noting\b/i, '"it\'s worth noting"'],
    [/\bnavigat(?:e|ing) the (?:complexities|landscape|intricacies)\b/i, '"navigate the complexities/landscape"'],
    [/\b(?:rich |intricate |vast )?tapestry\b/i, '"tapestry"'],
    [/\bdelv(?:e|ed|ing) into\b/i, '"delve into"'],
    [/\bnestled\b/i, '"nestled"'],
    [/\ba (?:symphony|dance|ballet|chorus) of\b/i, '"a symphony/dance of"'],
    [/\bin the realm of\b/i, '"in the realm of"'],
    [/\blittle did (?:he|she|they|i|we|you) know\b/i, '"little did X know"'],
    [/\bthe air (?:was|grew|hung) (?:thick|heavy) with\b/i, '"the air was thick with"'],
    [/\ba stark reminder\b/i, '"a stark reminder"'],
    [/\bsent (?:a )?shivers?\b/i, '"sent shivers"'],
    [/\bwhispered promises?\b/i, '"whispered promises"'],
    [/\bstood as a (?:testament|beacon)\b/i, '"stood as a testament/beacon"'],
    [/\borbs?\b/i, '"orbs" (for eyes)'],
    [/\bministrations\b/i, '"ministrations"'],
    [/\bbarely above a whisper\b/i, '"barely above a whisper"'],
    [/\ba mischievous glint\b/i, '"a mischievous glint"'],
    [/\beyes (?:sparkl|twinkl)(?:ed|ing)\b/i, '"eyes sparkled/twinkled"'],
    [/\bbreath(?:e|ed) a sigh of relief\b/i, '"breathed a sigh of relief"'],
    [/\bwith (?:bated|baited) breath\b/i, '"with bated breath"'],
    [/\ba newfound\b/i, '"a newfound"'],
    [/\bunbeknownst to\b/i, '"unbeknownst to"'],
  ],

  // Per-file density ceilings. Soft = WARN, hard = ERROR. *PerWords = "1 per N words".
  budgets: {
    emDashPerWords: 90,        // soft: more than 1 dash per 90 words of prose
    emDashHardPerWords: 60,    // hard: more than 1 per 60 words
    reversalPerFile: 2,        // soft: antithesis "not X. It's Y."
    reversalHardPerFile: 4,    // hard
    notJustPerFile: 1,         // "not just X, but Y" — soft
    notJustHardPerFile: 3,     // hard
    simileScaffoldPerFile: 4,  // "the way X does Y" — soft
    tricolonPerFile: 3,        // "X, Y, and Z" parallel triads — soft census
  },

  // WARN-tier censuses (judgement calls).
  hedgePer1000: 6,             // seemed to / somehow / as if / something like
  adverbTagPer1000: 4,         // said softly / murmured quietly

  // Thesis / stated-moral closers — the narrator explaining the meaning. WARN.
  thesis: /\bwhich (?:is|was)(?:,| ,)? (?:in the end|of course|the (?:whole|entire) (?:point|thing|design))\b|\bthat (?:was|is) always (?:the|what|why)\b|\band that(?:'s| is| was) the (?:point|thing)\b/i,

  // Phrases your game may use on purpose, capped so they stay a signature not a tic:
  //   "which is how": { perFile: 1 }
  signatures: {},

  // Theme words that are load-bearing but tic-prone; cap per file:
  //   "arithmetic": { perFile: 3 }
  motifs: {},
};

// Construction detectors used by the linter (kept here so WRITING.md and the linter
// describe the exact same patterns).
export const REVERSAL = /\b(?:not|isn['’]t|wasn['’]t|aren['’]t|weren['’]t|never)\b[^.!?\n]{2,60}[.!?]\s+(?:It|That|This|They|He|She|You)(?:['’]s| is| was| are| were| do| did)\b/;
export const NOT_JUST = /\bnot (?:just|only|merely|simply)\b[^.!?\n]{2,80}\b(?:but|it['’]s|it is|they['’]re)\b/i;
export const SIMILE_SCAFFOLD = /\bthe way (?:a|an|the|that|you|he|she|they|it|some)\b/gi;
export const TRICOLON = /\b\w+,\s+\w+,\s+and\s+\w+\b/g;
export const HEDGE = /\b(?:seemed to|somehow|as if|as though|something like|a sort of|a kind of|almost as though)\b/gi;
export const ADVERB_TAG = /\b(?:said|asked|whispered|murmured|replied|breathed|muttered|hissed|growled)\s+\w+ly\b/gi;

// Merge a game's writing.js over the defaults (shallow + nested for budgets/sig/motif).
export function mergeRules(overrides = {}) {
  const r = { ...DEFAULT_RULES, ...overrides };
  r.budgets = { ...DEFAULT_RULES.budgets, ...(overrides.budgets || {}) };
  r.signatures = { ...DEFAULT_RULES.signatures, ...(overrides.signatures || {}) };
  r.motifs = { ...DEFAULT_RULES.motifs, ...(overrides.motifs || {}) };
  r.bans = DEFAULT_RULES.bans.concat(overrides.bans || []);
  // A game may *lift* a default ban (e.g. its title legitimately uses the word):
  if (overrides.allow) r.bans = r.bans.filter(([, label]) => !overrides.allow.includes(label));
  return r;
}
