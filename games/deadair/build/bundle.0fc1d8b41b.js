(function(){
"use strict";
/* ---- src/rng.js ---- */
// Deterministic, serializable PRNG (mulberry32). The whole point: a game's
// randomness is reproducible from a seed, so playthroughs can be recorded and
// replayed as regression tests, and shared seeds reproduce a run exactly.
//
// State lives in `state.rngState` (a 32-bit integer). `rngNext` advances it and
// returns a float in [0,1). Nothing here touches globals or `Math.random`.

function seedToState(seed) {
  // Accept numbers or strings; hash strings to a 32-bit seed.
  if (typeof seed === "number") return seed >>> 0;
  let h = 2166136261 >>> 0;
  const s = String(seed ?? Date.now());
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngNext(state) {
  let a = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Integer in [0, n) and inclusive [lo, hi].
const rngInt = (state, n) => Math.floor(rngNext(state) * n);
const rngRange = (state, lo, hi) => lo + rngInt(state, hi - lo + 1);
const rngPick = (state, arr) => arr[rngInt(state, arr.length)];


/* ---- src/markup.js ---- */
// Markup helpers shared by content. Content builds strings with these; renderers
// decide how to present them. The DOM renderer injects the HTML as-is; the CLI
// renderer strips tags to plain text. Keeping a tiny neutral vocabulary (instead
// of letting content emit arbitrary HTML everywhere) is what lets the same game
// run in a browser and in a terminal test harness unchanged.

const P = (t) => "<p>" + t + "</p>";
const SYS = (t) => '<div class="sys">' + t + "</div>";
const DIV = '<div class="divider">\u2042</div>';
const B = (t) => "<b>" + t + "</b>";
const I = (t) => "<i>" + t + "</i>";
const SMALL = (t) => '<span class="small">' + t + "</span>";

// Plain-text projection for terminal / logs. Block tags become newlines,
// the divider becomes a rule, dialogue becomes "Name: line", inline tags drop.
function toText(html) {
  return String(html)
    .replace(/<div class="say[^"]*"[^>]*>[\s\S]*?<span class="who">([^<]*)<\/span>[\s\S]*?<span class="bubble">([\s\S]*?)<\/span>[\s\S]*?<\/div>/g, "\n$1: $2\n")
    .replace(/<div class="divider">[^<]*<\/div>/g, "\n   * * *\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<div class="sys">/g, "\n~ ")
    .replace(/<\/div>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u2042/g, "*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


/* ---- src/state.js ---- */
// The game state model. A state object is a plain, JSON-serializable bag built
// from the game definition's `state` block. Nothing game-specific is hardcoded
// here: stats, pools, vars, bonds, abilities, inventory and equipment all come
// from the manifest.
//
// `recompute` is the single source of truth for *derived* values. Effective
// stats = base stats + equipment modifiers; pool maxima are formulas over the
// effective stats. Every stat/equipment mutation must funnel through here so
// equipping and unequipping is always reversible and never drifts.


const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
const asMap = (x, val) =>
  Array.isArray(x) ? Object.fromEntries(x.map((k) => [k, val])) : clone(x);

function createInitialState(def, seed) {
  const s = def.state || {};
  const state = {
    v: (def.meta && def.meta.saveVersion) || 1,
    seed: seedToState(seed),
    rngState: seedToState(seed),
    scene: def.start,
    name: s.name ?? "",
    stats: clone(s.stats),
    pools: {}, // filled by recompute, then started
    vars: clone(s.vars),
    bonds: asMap(s.bonds, 0),
    abilities: asMap(s.abilities, true),
    inv: clone(s.inventory),
    equip: clone(s.equipment),
    eff: {}, // effective stats, filled by recompute
    log: [], // transient notes, cleared each view
    journal: [], // persistent milestone entries ("the story so far"); see chronicle()
  };
  // Initialise pool current values to their start (default: full).
  for (const [name, cfg] of Object.entries(s.pools || {})) {
    state.pools[name] = { cur: 0, max: 0 };
  }
  recompute(state, def);
  for (const [name, cfg] of Object.entries(s.pools || {})) {
    const start = cfg.start ?? "max";
    state.pools[name].cur = start === "max" ? state.pools[name].max : start;
  }
  return state;
}

// Recompute effective stats and pool maxima from base + equipment. Clamps each
// pool current into [0, max]. Idempotent.
function recompute(state, def) {
  const items = def.items || {};
  const eff = clone(state.stats);
  const poolMax = {};
  for (const [slot, id] of Object.entries(state.equip || {})) {
    if (!id) continue;
    const it = items[id];
    if (!it) continue;
    for (const [k, dv] of Object.entries(it.mods || {})) eff[k] = (eff[k] || 0) + dv;
    for (const [k, dv] of Object.entries(it.poolMax || {})) poolMax[k] = (poolMax[k] || 0) + dv;
  }
  state.eff = eff;
  const pools = (def.state && def.state.pools) || {};
  for (const [name, cfg] of Object.entries(pools)) {
    const base = typeof cfg.max === "function" ? cfg.max(eff, state) : cfg.max;
    const max = Math.max(0, Math.round(base + (poolMax[name] || 0)));
    const p = state.pools[name] || (state.pools[name] = { cur: max, max });
    p.max = max;
    p.cur = Math.max(0, Math.min(p.cur, max));
  }
  return state;
}

// Migrate an older save forward. Additive bumps merge onto a fresh state of the
// current shape (backfilling new fields); a missing/removed start scene snaps to
// the manifest start. Genuinely incompatible saves (no version, or newer than we
// understand) are refused — callers treat null as "no resumable save".
function migrate(saved, def, scenes) {
  const cur = (def.meta && def.meta.saveVersion) || 1;
  if (!saved || typeof saved.v !== "number" || saved.v > cur) return null; // none / from a newer build
  // Always rebuild on a fresh skeleton so additive fields (new vars, new structural
  // members like `journal`) are backfilled even when the save version is unchanged —
  // adding a field shouldn't require a version bump to stay loadable.
  const fresh = createInitialState(def, saved.seed ?? saved.rngState ?? 0);
  const st = Object.assign(fresh, saved); // saved values win; fresh fills any missing top-level key
  st.stats = Object.assign({}, fresh.stats, saved.stats);
  st.vars = Object.assign({}, fresh.vars, saved.vars);
  st.bonds = Object.assign({}, fresh.bonds, saved.bonds);
  if (!Array.isArray(st.journal)) st.journal = [];
  if (!Array.isArray(st.log)) st.log = [];
  for (const k of ["inv", "equip", "abilities", "pools"]) if (!st[k] || typeof st[k] !== "object") st[k] = fresh[k];
  st.v = cur;
  if (scenes && !scenes[st.scene]) st.scene = def.start;
  recompute(st, def);
  return st;
}


/* ---- src/context.js ---- */
// The authoring context `$` passed to every content function (scene text,
// choice req/hide/do/go). It exposes the game state plus a verb vocabulary that
// content uses to read and mutate state safely. The compiler destructures these
// keys, so a scene author can write `add('body',1)`, `flag('met_oracle')`,
// `check('mind',12)`, or read `v.met_oracle` / `G.bonds.mei` directly.
//
// CONTEXT_KEYS is the contract between the runtime and the compiler — keep them
// in sync; the compiler reads this list to build its destructuring prelude.


const CONTEXT_KEYS = [
  "G", "v", "P", "SYS", "DIV", "B", "I", "SMALL", "SAY",
  "get", "set", "flag", "add", "gain", "spend",
  "has", "give", "take", "equip", "unequip",
  "bond", "learn", "check", "rand", "randint", "note", "chronicle",
];

function makeContext(game) {
  const st = game.state;
  const def = game.def;
  const items = def.items || {};
  const cast = def.cast || {};
  const note = (text, cls = "gain") => { st.log.push({ text, cls }); };

  return {
    G: st,
    v: st.vars,
    P, SYS, DIV, B, I, SMALL,

    // Attributed dialogue line. The compiler turns `@id: text` in a scene into
    // SAY("id", `text`). The character is looked up in def.cast for its display
    // name, profile-picture asset, accent color, and whether it is the player
    // ("self"). Output is render-neutral: the DOM renderer paints a chat bubble
    // and resolves the pfp image; toText() projects it to "Name: text".
    SAY: (id, text = "") => {
      const ch = cast[id] || {};
      const who = ch.name || (ch.self ? st.name : id);
      const self = ch.self ? " self" : "";
      const cc = ch.color ? ` style="--cc:${ch.color}"` : "";
      const initial = (who.trim()[0] || "?").toUpperCase();
      const pfp = `<span class="pfp"${ch.pfp ? ` data-pfp="${ch.pfp}"` : ""}>${initial}</span>`;
      return `<div class="say${self}"${cc}>${pfp}<span class="utter"><span class="who">${who}</span><span class="bubble">${text}</span></span></div>`;
    },

    get: (k) => st.vars[k],
    set: (k, val) => ((st.vars[k] = val), val),
    flag: (k, val = true) => ((st.vars[k] = val), val),

    add: (stat, n) => {
      st.stats[stat] = (st.stats[stat] || 0) + n;
      recompute(st, def);
      note((n > 0 ? "+" : "") + n + " " + stat);
      return st.stats[stat];
    },
    gain: (pool, n) => {
      const p = st.pools[pool]; if (!p) return;
      p.cur = Math.max(0, Math.min(p.max, p.cur + n));
      return p.cur;
    },
    spend: (pool, n) => {
      const p = st.pools[pool]; if (!p) return;
      p.cur = Math.max(0, p.cur - n);
      return p.cur;
    },

    has: (id, n = 1) => (st.inv[id] || 0) >= n,
    give: (id, n = 1) => {
      st.inv[id] = (st.inv[id] || 0) + n;
      const it = items[id];
      note("Got " + (it ? it.name : id) + (n > 1 ? " \u00d7" + n : ""));
      return st.inv[id];
    },
    take: (id, n = 1) => {
      const have = st.inv[id] || 0, used = Math.min(have, n);
      st.inv[id] = have - used;
      if (st.inv[id] <= 0) delete st.inv[id];
      return used;
    },
    equip: (id) => {
      const it = items[id];
      if (!it || !it.slot || !((st.inv[id] || 0) > 0)) return false;
      const prev = st.equip[it.slot];
      if (prev) st.inv[prev] = (st.inv[prev] || 0) + 1;
      st.inv[id] -= 1; if (st.inv[id] <= 0) delete st.inv[id];
      st.equip[it.slot] = id;
      recompute(st, def);
      note("Equipped " + it.name);
      return true;
    },
    unequip: (slot) => {
      const id = st.equip[slot];
      if (!id) return false;
      st.equip[slot] = null;
      st.inv[id] = (st.inv[id] || 0) + 1;
      recompute(st, def);
      note("Unequipped " + (items[id] ? items[id].name : id));
      return true;
    },

    bond: (name, n) => {
      st.bonds[name] = (st.bonds[name] || 0) + n;
      note((n > 0 ? "+" : "") + n + " " + name, n < 0 ? "loss" : "gain");
      return st.bonds[name];
    },
    learn: (id) => {
      if (st.abilities[id]) return false;
      st.abilities[id] = true;
      const tech = def.systems?.combat?.techniques?.[id];
      note("Learned " + (tech ? tech.name : id));
      return true;
    },
    // Skill check: dN + effective stat vs dc. Deterministic via the seeded rng.
    check: (stat, dc, die = (def.systems?.checks?.die ?? 20)) => {
      const roll = rngInt(st, die) + 1;
      const val = st.eff[stat] || 0;
      const pass = roll + val >= dc;
      note(
        "Check " + stat + " (" + val + ") + d" + die + " (" + roll + ") vs " + dc +
        " \u2014 " + (pass ? "success" : "failure"),
        pass ? "gain" : "loss"
      );
      return pass;
    },
    rand: () => rngNext(st),
    randint: (n) => rngInt(st, n),
    note,
    // Record a permanent milestone in "the story so far" (idempotent by text).
    chronicle: (text) => { if (!st.journal.some((e) => e.text === text)) st.journal.push({ text, scene: st.scene }); },
  };
}


/* ---- src/combat.js ---- */
// Generic tactical combat. The mechanics (charge/release telegraphs, iron/flow
// stances, bind/reflect/interrupt/turn/heal techniques, two-phase bosses, ally
// interventions) are the proven set from the reference game, but nothing here
// names a stat, a technique, or an NPC: it is all read from def.systems.combat,
// the enemy data, and per-enemy `interventions`. A game with no combat system
// simply never reaches this module.

const ceil = Math.ceil;

function cfg(game) { return game.def.systems?.combat || {}; }
function clog(c, s) { c.log.push(s); }

function snapshot(game) { return JSON.stringify(game.state); }

function startCombat(game) {
  const st = game.state;
  const sc = game.scenes[st.scene];
  const e = game.enemies[sc.combat];
  if (!e) throw new Error("unknown enemy '" + sc.combat + "' for scene " + st.scene);
  game.ckpt = snapshot(game);
  const c = cfg(game);
  const resPool = st.pools[c.resource];
  if (resPool) resPool.cur = Math.round(resPool.max * (c.startResourceFrac ?? 1));
  game.combat = {
    key: sc.combat, name: e.name, hp: e.hp, max: e.hp,
    moves: e.moves.slice(), p2: e.p2 || null, p2at: e.p2at ?? 0, p2text: e.p2text || null,
    i: 0, snared: false, mirror: false, guard: false, charged: false, stance: null,
    phase: 1, fired: {}, log: [e.open ? '<span class="foe">' + e.open + "</span>" : ""],
    win: sc.win, lose: sc.lose, intro: sc.t ? sc.t(game.context()) : "",
  };
  fireInterventions(game, "start");
}

function fireInterventions(game, phase) {
  const e = game.enemies[game.combat.key];
  const cx = game.context();
  const list = e.interventions || [];
  let revived = false;
  list.forEach((iv, idx) => {
    if (iv.on !== phase) return;
    if (iv.once && game.combat.fired[idx]) return;
    if (iv.when && !iv.when(cx)) return;
    game.combat.fired[idx] = true;
    if (iv.snare) game.combat.snared = true;
    if (iv.charge) game.combat.charged = true;
    if (iv.advance) game.combat.i += iv.advance;
    if (typeof iv.hp === "number") {
      const pool = game.state.pools[cfg(game).hpPool || "hp"];
      pool.cur = Math.max(pool.cur, iv.hp); revived = true;
    }
    if (iv.log) clog(game.combat, '<span class="good">' + iv.log + "</span>");
  });
  return revived;
}

function dmgEnemy(c, n, src) { c.hp -= n; clog(c, '<span class="you">' + src + " \u2014 " + n + " harm.</span>"); }

function combatAct(game, actionId) {
  const st = game.state, c = game.combat, C = cfg(game);
  const eff = st.eff;
  const hpPool = st.pools[C.hpPool || "hp"];
  const resPool = st.pools[C.resource];
  const techs = C.techniques || {};
  const stances = C.stances || {};
  c.guard = false;

  if (actionId === "strike") {
    let d = (C.strikeBase ?? 2) + (eff[C.power] || 0), src = "You strike";
    if (c.stance && stances[c.stance]?.strike === "min1") { d = 1; src = "Your blow rings off the braced form"; }
    else if (c.stance && stances[c.stance]?.strike === "+2") { d += 2; src = "Your blow breaks the flowing form"; }
    dmgEnemy(c, d, src);
  } else if (actionId === "guard") {
    c.guard = true;
    if (resPool) resPool.cur = Math.min(resPool.max, resPool.cur + (C.guardRegen ?? 1));
    clog(c, '<span class="you">You guard and gather.</span>');
  } else {
    const t = techs[actionId];
    if (!t) throw new Error("unknown combat action: " + actionId);
    if (resPool && resPool.cur < (t.cost || 0)) throw new Error("not enough " + C.resource);
    if (resPool) resPool.cur -= t.cost || 0;
    applyTechnique(game, t);
  }

  if (c.hp <= 0) return endCombat(game, true);
  enemyAct(game);
  if (!game.combat) return; // ended via reflected blow
  if (hpPool.cur <= 0) {
    if (!fireInterventions(game, "defeat") || hpPool.cur <= 0) return endCombat(game, false);
  }
  if (c.p2 && c.phase === 1 && c.hp <= c.p2at) {
    c.phase = 2; c.moves = c.p2.slice(); c.i = 0; c.stance = null;
    clog(c, '<span class="foe">' + (c.p2text || "The foe sheds restraint.") + "</span>");
    fireInterventions(game, "phase2");
  }
  if (resPool) resPool.cur = Math.min(resPool.max, resPool.cur + (C.roundRegen ?? 0));
  game.save();
}

function applyTechnique(game, t) {
  const st = game.state, c = game.combat, eff = st.eff;
  const stanceFlow = c.stance && (game.def.systems.combat.stances?.[c.stance]?.kind === "flow");
  switch (t.type) {
    case "damage": {
      let d = (t.base || 0) + (eff[t.stat] || 0);
      if (stanceFlow && t.vsFlow === "half") d = ceil(d / 2);
      dmgEnemy(c, d, (t.name || "Technique") + " strikes"); break;
    }
    case "bind": {
      if (stanceFlow && t.vsFlow === "fail") { clog(c, '<span class="foe">The knot slides off the flowing form.</span>'); break; }
      c.snared = true; dmgEnemy(c, t.base || 1, (t.name || "Bind") + " binds"); break;
    }
    case "reflect": c.mirror = true; clog(c, '<span class="you">' + (t.name || "Reflect") + " hangs ready.</span>"); break;
    case "heal": {
      const pool = st.pools[t.pool || "hp"], h = (t.base || 0) + (eff[t.stat] || 0) * (t.mul ?? 1);
      pool.cur = Math.min(pool.max, pool.cur + h);
      clog(c, '<span class="good">' + (t.name || "Heal") + " reknits you. +" + h + " " + (t.pool || "hp") + ".</span>"); break;
    }
    case "interrupt": {
      let d = (t.base || 0) + (eff[t.stat] || 0);
      if (c.charged) { d += t.chargeBonus || 0; c.charged = false; c.i++; clog(c, '<span class="good">You tear the gathering technique apart!</span>'); }
      if (c.stance) { d += t.stanceBonus || 0; c.stance = null; clog(c, '<span class="good">The stance\u2019s anchor rips loose; the form collapses.</span>'); }
      dmgEnemy(c, d, (t.name || "Interrupt") + " rips it open"); break;
    }
    case "turn": {
      const nm = c.moves[c.i % c.moves.length];
      let d = nm.d != null ? nm.d : 4;
      if (nm.kind === "release" && !c.charged) d = ceil(d / 3);
      if (stanceFlow) d = ceil(d / 2);
      c.charged = false; c.i++;
      dmgEnemy(c, d, (t.name || "Turn") + " turns " + nm.n + " inward"); break;
    }
    case "counter": {
      let d = (t.base || 0) + (eff[t.stat] || 0);
      if (c.stance) { c.stance = null; clog(c, '<span class="good">The counter mends past the stance; the form simply isn\u2019t there.</span>'); }
      if (t.heal) { const pool = st.pools[t.healPool || "hp"]; pool.cur = Math.min(pool.max, pool.cur + t.heal); }
      dmgEnemy(c, d, (t.name || "Counter") + " runs through the foe\u2019s fray"); break;
    }
    default: throw new Error("unknown technique type: " + t.type);
  }
}

function enemyAct(game) {
  const st = game.state, c = game.combat, C = cfg(game);
  const hpPool = st.pools[C.hpPool || "hp"], resPool = st.pools[C.resource];
  if (c.snared) { c.snared = false; clog(c, '<span class="foe">' + c.name + " thrashes against your bind.</span>"); return; }
  const mv = c.moves[c.i % c.moves.length]; c.i++;
  if (mv.kind === "stance") { c.stance = mv.st; clog(c, '<span class="foe">' + mv.text + "</span>"); return; }
  if (mv.kind === "heal") { c.hp = Math.min(c.max, c.hp + mv.h); clog(c, '<span class="foe">' + mv.text + "</span>"); return; }
  if (mv.kind === "charge") { c.charged = true; clog(c, '<span class="foe">' + mv.text + "</span>"); return; }
  let d = mv.d;
  if (mv.kind === "release") { if (!c.charged) { d = ceil(d / 3); clog(c, '<span class="foe">The broken technique sputters.</span>'); } c.charged = false; }
  if (c.mirror) {
    c.mirror = false; c.hp -= d;
    clog(c, '<span class="good">Reflected \u2014 ' + d + " harm hurled back.</span>");
    if (c.hp <= 0) endCombat(game, true);
    return;
  }
  if (c.guard) d = ceil(d / 2);
  d = Math.max(1, Math.round(d * (C.foeMul ?? 1)));
  hpPool.cur -= d;
  clog(c, '<span class="foe">' + mv.n + " \u2014 " + d + " harm to you.</span>");
  if (mv.drain && resPool) { resPool.cur = Math.max(0, resPool.cur - mv.drain); clog(c, '<span class="foe">It drains ' + mv.drain + " " + C.resource + ".</span>"); }
}

function endCombat(game, won) {
  const C = cfg(game), c = game.combat, hpPool = game.state.pools[C.hpPool || "hp"];
  game.combat = null;
  if (won) hpPool.cur = Math.max(hpPool.cur, C.winHpFloor ?? 1);
  else hpPool.cur = Math.max(hpPool.cur, 0);
  game.goto(won ? c.win : c.lose);
}

function combatView(game) {
  const st = game.state, c = game.combat, C = cfg(game);
  const stances = C.stances || {}, techs = C.techniques || {};
  const resPool = st.pools[C.resource];
  const mv = c.moves[c.i % c.moves.length];
  let intent = c.snared ? "It strains against your bind." : (mv.tele || "Prepares: " + mv.n);
  if (c.stance && stances[c.stance]) intent = '<span class="stq">' + stances[c.stance].see + "</span><br>" + intent;
  const actions = [{ id: "strike", label: "Strike", enabled: true, cost: 0 }];
  for (const id of Object.keys(st.abilities)) {
    const t = techs[id]; if (!t) continue;
    actions.push({ id, label: t.name + " \u2014 " + (t.desc || ""), cost: t.cost || 0, enabled: !resPool || resPool.cur >= (t.cost || 0) });
  }
  actions.push({ id: "guard", label: "Guard", enabled: true, cost: 0 });
  const intro = c.intro; c.intro = "";
  return {
    enemy: { name: c.name, hp: Math.max(0, c.hp), max: c.max },
    intent, log: c.log.slice(-5).filter(Boolean), intro,
    art: game.scenes[st.scene].art || null, actions,
  };
}


/* ---- src/engine.js ---- */
// The platform-agnostic engine core. No DOM, no localStorage, no globals.
// `createGame(def, content)` returns a game instance that produces render-neutral
// *view models* and accepts choice/action dispatches. Renderers (DOM, CLI, the
// test driver) consume `view()` and call `choose()` / `act()`.


function createGame(def, content = {}) {
  const scenes = content.scenes || {};
  const enemies = content.enemies || def.enemies || {};
  const storage = content.storage || null;
  const saveKey = (def.meta && def.meta.id) || "weft-save";

  const game = {
    def, scenes, enemies, storage, saveKey,
    state: null,
    combat: null,
    ckpt: null,

    start(seed = Date.now()) {
      this.state = createInitialState(def, seed);
      this.combat = null;
      this.ckpt = null;
      const sc = scenes[this.state.scene];
      if (sc && sc.combat) startCombat(this);
      return this;
    },

    // Resume a saved game if one exists and is compatible; otherwise start fresh.
    resume(seed = Date.now()) {
      const loaded = this.load();
      if (loaded) {
        this.state = loaded;
        const sc = scenes[this.state.scene];
        if (sc && sc.combat) startCombat(this);
      } else {
        this.start(seed);
      }
      return this;
    },

    context() { return makeContext(this); },

    goto(id) {
      const sc = scenes[id];
      this.state.scene = sc ? id : def.start;
      this.combat = null;
      const target = scenes[this.state.scene];
      if (target && target.combat) startCombat(this);
      this.save();
      return this;
    },

    // Resolve a scene choice: run its side-effect, then navigate.
    choose(choiceId) {
      if (this.combat) throw new Error("in combat; use act()");
      const sc = scenes[this.state.scene];
      const cx = this.context();
      const list = sc.c ? sc.c(cx) : [];
      const c = list.find((x) => x.id === choiceId);
      if (!c) throw new Error("no such choice '" + choiceId + "' in " + this.state.scene);
      if (c.hide && c.hide(cx)) throw new Error("choice hidden: " + choiceId);
      if (c.req && !c.req(cx)) throw new Error("choice locked: " + choiceId);
      if (c.do) c.do(cx);
      const target = typeof c.go === "function" ? c.go(cx) : c.go;
      if (target) this.goto(target);
      return this;
    },

    // One combat round.
    act(actionId) {
      if (!this.combat) throw new Error("not in combat");
      combatAct(this, actionId);
      return this;
    },

    // Restore the pre-combat checkpoint (for retry-after-defeat flows).
    retry() {
      if (this.ckpt) { this.state = JSON.parse(this.ckpt); recompute(this.state, def); }
      this.combat = null;
      const sc = scenes[this.state.scene];
      if (sc && sc.combat) startCombat(this);
      return this;
    },

    // Render-neutral snapshot of what to show now.
    view() {
      const st = this.state;
      const notes = st.log.splice(0);
      const hud = {
        name: st.name, stats: st.eff, base: st.stats, pools: st.pools,
        bonds: st.bonds, abilities: Object.keys(st.abilities),
        inv: st.inv, equip: st.equip, vars: st.vars, journal: st.journal,
      };
      if (this.combat) return Object.assign({ kind: "combat", notes, hud }, combatView(this));
      const sc = this.scenes[st.scene];
      if (!sc) return { kind: "error", error: "missing scene: " + st.scene, notes, hud };
      const cx = this.context();
      const list = sc.c ? sc.c(cx) : [];
      const choices = list
        .filter((c) => !(c.hide && c.hide(cx)))
        .map((c) => {
          const enabled = !c.req || !!c.req(cx);
          return { id: c.id, label: c.l, enabled, lock: enabled ? null : (c.rq || "locked") };
        });
      // notes produced while evaluating text/choices are merged in.
      const html = sc.t ? sc.t(cx) : "";
      const merged = notes.concat(st.log.splice(0));
      return {
        kind: "scene", scene: st.scene, art: sc.art || null, ending: !!sc.ending,
        html, choices, notes: merged, hud,
      };
    },

    save() {
      if (!this.storage) return;
      try {
        this.state.v = (def.meta && def.meta.saveVersion) || 1;
        this.storage.set(this.saveKey, JSON.stringify(this.state));
      } catch (_) {}
    },
    load() {
      if (!this.storage) return null;
      try {
        const raw = this.storage.get(this.saveKey);
        if (!raw) return null;
        return migrate(JSON.parse(raw), def, scenes);
      } catch (_) { return null; }
    },
    clearSave() { if (this.storage) try { this.storage.del(this.saveKey); } catch (_) {} },
  };

  // expose for combat module
  game._snapshot = () => snapshot(game);
  return game;
}


/* ---- src/storage.js ---- */
// Save-storage adapters. The engine only needs { get, set, del }. This keeps the
// core free of any platform assumption: browser uses localStorage, tests use
// memory, tooling can use the filesystem.

function memoryStorage() {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), del: (k) => void m.delete(k) };
}

function localStorageAdapter() {
  return {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };
}


/* ---- src/render/dom.js ---- */
// Browser renderer. Consumes the engine's view() model and paints it; wires
// buttons back to choose()/act(). Theme colors come from def.meta.theme (CSS
// variables), so a game restyles itself without touching this file.

const STYLE = `
:root{--bg:#0a0d14;--bg2:#141b2c;--panel:#121826;--ink:#cfd6e4;--dim:#7d889e;--accent:#e8c15a;--accent2:#a8862e;
 --good:#58b890;--bad:#e0606a;--cool:#7ea7d8;--line:#242e45}
.weft *{box-sizing:border-box}
.weft{margin:0 auto;max-width:680px;padding:18px 20px 80px;color:var(--ink);
 font:17px/1.62 Georgia,'Times New Roman',serif}
.weft #wf-hud{position:sticky;top:0;background:linear-gradient(var(--bg) 80%,transparent);padding:10px 0 6px;z-index:5;font-size:13px;color:var(--dim);letter-spacing:.4px}
.weft #wf-hud .row{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline}
.weft #wf-hud b{color:var(--accent);font-weight:normal}
.weft .bar{height:4px;background:#1d2435;border-radius:2px;margin-top:6px;overflow:hidden}
.weft .bar i{display:block;height:100%;background:var(--accent2);transition:width .3s}
.weft #wf-hud .pools{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:8px}
.weft #wf-hud .pool{flex:1 1 130px;min-width:108px;max-width:230px}
.weft #wf-hud .prow{display:flex;justify-content:space-between;align-items:baseline}
.weft #wf-hud .plabel{color:var(--dim);text-transform:uppercase;font-size:11px;letter-spacing:1px}
.weft #wf-hud .pnum{color:var(--ink);font-size:14px;font-variant-numeric:tabular-nums}
.weft #wf-hud .pbar{height:7px;background:#10141f;border:1px solid var(--line);border-radius:4px;overflow:hidden;margin-top:3px}
.weft #wf-hud .pbar i{display:block;height:100%;border-radius:3px;transition:width .35s ease}
.weft #wf-hud .pool.low .pnum{color:var(--bad)}
.weft #wf-hud .pools.in-combat{gap:10px 18px;margin-bottom:10px}
.weft #wf-hud .pools.in-combat .pool{flex:1 1 200px;max-width:none}
.weft #wf-hud .pools.in-combat .pbar{height:12px}
.weft #wf-hud .pools.in-combat .pnum{font-size:17px}
.weft #wf-hud .pools.in-combat .plabel{font-size:12px}
.weft #wf-hud .stats{font-size:13px;color:var(--dim)}
.weft h1{font-size:34px;color:var(--accent);font-weight:normal;letter-spacing:2px;text-align:center;margin:50px 0 4px}
.weft h2{font-size:15px;color:var(--dim);font-weight:normal;text-align:center;letter-spacing:4px;text-transform:uppercase;margin:0 0 36px}
.weft #wf-main p{margin:0 0 14px}
.weft .scene-art{display:block;width:100%;max-height:54vh;object-fit:cover;border-radius:8px;margin:0 0 18px;border:1px solid var(--line)}
.weft .sys{color:var(--accent);font-style:italic;border-left:2px solid var(--accent2);padding:6px 12px;margin:16px 0;background:rgba(232,193,90,.05)}
.weft .gain{color:var(--good);font-size:14px;font-style:italic}
.weft .loss{color:var(--bad);font-size:14px;font-style:italic}
.weft .choices{margin-top:24px;display:flex;flex-direction:column;gap:9px}
.weft button.ch{font:inherit;text-align:left;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:11px 15px;cursor:pointer;transition:border .15s,background .15s}
.weft button.ch:hover:not(:disabled){border-color:var(--accent2);background:#182137}
.weft button.ch:disabled{opacity:.4;cursor:default}
.weft button.ch .req{color:var(--dim);font-size:13px}
.weft button.ch .cost{color:var(--cool);font-size:13px}
.weft .say{display:flex;gap:10px;align-items:flex-start;margin:0 0 14px}
.weft .say .pfp{position:relative;flex:0 0 auto;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--cc,var(--accent2));color:var(--bg);display:flex;align-items:center;justify-content:center;font:600 16px/1 Georgia,serif;border:1px solid var(--line)}
.weft .say .pfp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.weft .say .utter{flex:1 1 auto;min-width:0}
.weft .say .who{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--cc,var(--accent));margin-bottom:3px}
.weft .say .bubble{display:inline-block;background:var(--panel);border:1px solid var(--line);border-left:2px solid var(--cc,var(--accent2));border-radius:4px;padding:8px 13px}
.weft .say.self{flex-direction:row-reverse}
.weft .say.self .utter{text-align:right}
.weft .say.self .bubble{text-align:left;border-left:none;border-right:2px solid var(--cc,var(--accent2))}
.weft .divider{text-align:center;color:var(--accent2);margin:22px 0;letter-spacing:6px}
.weft .combat{border:1px solid #36415e;border-radius:6px;padding:14px 16px;margin:14px 0;background:rgba(0,0,0,.3)}
.weft .combat .ename{color:var(--bad);letter-spacing:1px}
.weft .combat .intent{color:var(--dim);font-style:italic;font-size:14px;margin-top:4px}
.weft .combat .intent .stq{color:var(--accent)}
.weft .clog{font-size:14px;color:var(--dim);margin:10px 0;border-top:1px dashed var(--line);padding-top:8px}
.weft .clog .you{color:var(--ink)} .weft .clog .foe{color:var(--bad)} .weft .clog .good{color:var(--good)}
.weft .ebar{height:6px;background:#2a1a22;border-radius:3px;margin-top:6px}.weft .ebar i{display:block;height:100%;background:var(--bad);border-radius:3px;transition:width .3s}
.weft .small{font-size:13px;color:var(--dim)}
.weft .ending{border:1px solid var(--accent2);border-radius:6px;padding:4px 18px;margin-top:24px;background:rgba(232,193,90,.04)}
.weft .ending h3{color:var(--accent);font-weight:normal;letter-spacing:2px}
.weft #wf-foot{margin-top:40px;padding:14px 0 8px;border-top:1px solid #1a2236;text-align:center;font-size:12px}
.weft #wf-foot button{font:inherit;font-size:12px;background:none;border:none;color:var(--dim);cursor:pointer;letter-spacing:.5px;padding:4px 10px}
.weft #wf-foot button:hover{color:var(--ink)} .weft #wf-foot .danger{color:var(--bad)}
.weft #wf-foot a{font:inherit;font-size:12px;color:var(--dim);text-decoration:none;letter-spacing:.5px;padding:4px 10px}
.weft #wf-foot a:hover{color:var(--accent)}
.weft .jbtn{margin-left:auto;cursor:pointer;color:var(--accent2);font-size:13px;letter-spacing:.5px}
.weft .jbtn:hover{color:var(--accent)}
.weft .panel h2{font-size:23px;color:var(--accent);font-weight:normal;letter-spacing:1px;margin:6px 0 0}
.weft .panel .sub{color:var(--dim);font-size:14px;font-style:italic;margin:2px 0 14px}
.weft .panel h3{font-size:12px;text-transform:uppercase;letter-spacing:2.5px;color:var(--dim);font-weight:normal;border-bottom:1px solid var(--line);padding-bottom:5px;margin:24px 0 10px}
.weft .panel .grid{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--ink)}
.weft .panel .grid b{color:var(--accent);font-weight:normal}
.weft .panel .bond{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px dotted var(--line);padding:6px 0;font-size:15px}
.weft .panel .bond .w{color:var(--accent2);font-size:13px;font-style:italic;letter-spacing:.5px}
.weft .panel .item{display:flex;justify-content:space-between;border-bottom:1px dotted var(--line);padding:5px 0;font-size:15px}
.weft .panel .item .q{color:var(--dim);font-size:13px}
.weft .panel ul.chron{list-style:none;padding:0;margin:0}
.weft .panel ul.chron li{padding:6px 0 6px 12px;border-left:2px solid var(--accent2);margin:7px 0;background:rgba(232,193,90,.04);font-size:15px}
.weft .panel .none{color:var(--dim);font-style:italic;font-size:14px}
`;

let styled = false;
function injectStyle(theme) {
  if (!styled) {
    const s = document.createElement("style");
    s.textContent = STYLE; (document.head || document.documentElement).appendChild(s); styled = true;
  }
  if (theme) for (const [k, val] of Object.entries(theme)) document.documentElement.style.setProperty(k, val);
}

function mount(game, opts = {}) {
  const root = opts.root || document.body;
  const assetPath = opts.assetPath ?? "assets/";
  // Optional "back to portal" link shown in the footer. Deploy context only —
  // the index.html sets window.__WEFT_HOME; standalone/editor previews omit it.
  const home = opts.home || null;
  injectStyle(opts.theme || (game.def.meta && game.def.meta.theme));
  root.classList.add("weft");
  root.innerHTML = `<div id="wf-hud"></div><div id="wf-main"></div><div id="wf-foot"></div>`;
  const hudEl = root.querySelector("#wf-hud"), mainEl = root.querySelector("#wf-main"), footEl = root.querySelector("#wf-foot");

  const art = (name) => {
    if (!name) return "";
    const b = assetPath + name;
    return `<img class="scene-art" src="${b}.png" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${b}.svg';}else this.style.display='none';">`;
  };
  // Resolve dialogue profile pictures: inject an <img> per `.pfp[data-pfp]`,
  // using the same png -> svg fallback as scene art; if both fail, the colored
  // disc with the speaker's initial (already in the span) shows through.
  const wirePfp = (el) => el.querySelectorAll(".pfp[data-pfp]").forEach((p) => {
    const b = assetPath + p.dataset.pfp;
    p.insertAdjacentHTML("afterbegin",
      `<img src="${b}.png" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${b}.svg';}else this.remove();">`);
  });
  const notesHtml = (notes) => notes && notes.length
    ? "<p>" + notes.map((n) => `<span class="${n.cls || "gain"}">${n.text}</span>`).join("<br>") + "</p>" : "";

  function render() {
    const v = game.view();
    // HUD
    if (v.scene === game.def.start && v.kind === "scene") hudEl.style.display = "none";
    else { hudEl.style.display = "block"; hudEl.innerHTML = hud(v.hud, v.kind); }

    if (v.kind === "combat") {
      const pct = 100 * v.enemy.hp / v.enemy.max;
      mainEl.innerHTML = art(v.art) + (v.intro || "") + notesHtml(v.notes) +
        `<div class="combat"><span class="ename">${v.enemy.name}</span> — ${v.enemy.hp}/${v.enemy.max}
         <div class="ebar"><i style="width:${pct}%"></i></div>
         <div class="intent">${v.intent}</div>
         <div class="clog">${v.log.join("<br>")}</div></div>` +
        '<div class="choices">' + v.actions.map((a) =>
          `<button class="ch" ${a.enabled ? "" : "disabled"} data-act="${a.id}">${a.label}${a.cost ? ` <span class="cost">(${a.cost})</span>` : ""}</button>`).join("") + "</div>";
      mainEl.querySelectorAll("button[data-act]").forEach((b) =>
        b.onclick = () => { game.act(b.dataset.act); render(); });
    } else if (v.kind === "scene") {
      mainEl.innerHTML = art(v.art) + v.html + notesHtml(v.notes) +
        '<div class="choices">' + v.choices.map((c) =>
          `<button class="ch" ${c.enabled ? "" : "disabled"} data-ch="${c.id}">${c.label}${c.enabled ? "" : ` <span class="req">${c.lock}</span>`}</button>`).join("") + "</div>";
      mainEl.querySelectorAll("button[data-ch]").forEach((b) =>
        b.onclick = () => { game.choose(b.dataset.ch); render(); });
    } else {
      mainEl.innerHTML = `<p class="loss">Error: ${v.error}</p>`;
    }
    wirePfp(mainEl);
    window.scrollTo(0, 0);
    wireHud();
    foot(v);
  }

  const SECTION_LABELS = { stats: "Attributes", pools: "Condition", bonds: "Bonds", abilities: "Skills", inventory: "Carried", equipment: "Equipped", chronicle: "The story so far" };
  const surfaces = () => (game.def.surfaces && typeof game.def.surfaces === "object") ? game.def.surfaces : null;
  function hud(h, kind) {
    const cb = (game.def.systems && game.def.systems.combat) || {};
    const hpName = cb.hpPool || "hp", resName = cb.resource;
    const color = (k) => k === hpName ? "var(--bad)" : (k === resName ? "var(--cool)" : "var(--accent2)");
    const pools = Object.entries(h.pools).map(([k, p]) => {
      const pct = p.max ? Math.max(0, Math.min(100, 100 * p.cur / p.max)) : 0;
      const low = k === hpName && pct <= 33 ? " low" : "";
      return `<div class="pool${low}"><div class="prow"><span class="plabel">${cap(k)}</span><span class="pnum">${p.cur}/${p.max}</span></div><div class="pbar"><i style="width:${pct}%;background:${color(k)}"></i></div></div>`;
    }).join("");
    const stats = Object.entries(h.stats).map(([k, val]) => `${cap(k)} ${val}`).join(" \u00b7 ");
    const bonds = Object.entries(h.bonds).filter(([, n]) => n > 0).map(([k, n]) => `${cap(k)} ${n}`).join(" \u00b7 ");
    const panels = surfaces() ? Object.entries(surfaces()).map(([key, cfg]) =>
      `<span class="jbtn" data-panel="${key}">\u2766 ${cfg.title || cap(key)}</span>`).join("") : "";
    return `<div class="pools ${kind === "combat" ? "in-combat" : ""}">${pools}</div>` +
      `<div class="row stats"><span>${stats}</span>${bonds ? `<span>${bonds}</span>` : ""}${panels}</div>`;
  }
  function wireHud() {
    hudEl.querySelectorAll(".jbtn[data-panel]").forEach((b) => { b.onclick = () => openPanel(b.dataset.panel); });
  }
  function openPanel(key) {
    const cfg = surfaces()[key], st = game.state, items = game.def.items || {};
    const techs = game.def.systems?.combat?.techniques || {};
    const show = cfg.show || ["stats", "pools", "bonds", "abilities", "inventory", "equipment", "chronicle"];
    const tier = cfg.bondTiers || { 3: "close", 2: "firm", 1: "known" };
    const sec = {
      stats: () => `<div class="grid">${Object.entries(st.eff).map(([k, val]) => `<span>${cap(k)} <b>${val}</b></span>`).join("")}</div>`,
      pools: () => `<div class="grid">${Object.entries(st.pools).map(([k, p]) => `<span>${cap(k)} <b>${p.cur}/${p.max}</b></span>`).join("")}</div>`,
      bonds: () => { const e = Object.entries(st.bonds).filter(([, n]) => n > 0); return e.length ? e.map(([k, n]) => `<div class="bond"><span>${cap(k)}</span><span class="w">${tier[Math.min(3, n)] || "known"}</span></div>`).join("") : `<div class="none">No bonds yet.</div>`; },
      abilities: () => { const a = Object.keys(st.abilities); return a.length ? `<div class="grid">${a.map((id) => `<span>${techs[id]?.name || cap(id)}</span>`).join("")}</div>` : `<div class="none">None learned.</div>`; },
      inventory: () => { const e = Object.entries(st.inv).filter(([, q]) => q > 0); return e.length ? e.map(([id, q]) => `<div class="item"><span>${items[id]?.name || id}</span><span class="q">${q > 1 ? "\u00d7" + q : ""}</span></div>`).join("") : `<div class="none">Empty.</div>`; },
      equipment: () => { const e = Object.entries(st.equip).filter(([, id]) => id); return e.length ? e.map(([slot, id]) => `<div class="item"><span>${items[id]?.name || id}</span><span class="q">${cap(slot)}</span></div>`).join("") : `<div class="none">Nothing equipped.</div>`; },
      chronicle: () => st.journal.length ? `<ul class="chron">${st.journal.map((j) => `<li>${j.text}</li>`).join("")}</ul>` : `<div class="none">Your story is only beginning.</div>`,
    };
    let h = `<div class="panel"><h2>${st.name || cfg.title || cap(key)}</h2><div class="sub">${cfg.subtitle || cfg.title || ""}</div>`;
    for (const s of show) if (sec[s]) h += `<h3>${(cfg.labels && cfg.labels[s]) || SECTION_LABELS[s] || cap(s)}</h3>` + sec[s]();
    h += `<div class="choices"><button class="ch" id="wf-back">\u2190 back to the story</button></div></div>`;
    mainEl.innerHTML = h;
    mainEl.querySelector("#wf-back").onclick = () => render();
    window.scrollTo(0, 0);
  }
  function foot(v) {
    const homeLink = home ? `<a id="wf-home" href="${home.href}">${home.label}</a>` : "";
    const onStart = v.scene === game.def.start && v.kind === "scene";
    if (onStart) { footEl.innerHTML = homeLink; return; }
    footEl.innerHTML = homeLink + `<button id="wf-rst">\u21BA restart</button>`;
    footEl.querySelector("#wf-rst").onclick = () => {
      footEl.innerHTML = homeLink + `<span class="small">Erase progress and restart?</span> <button class="danger" id="wf-y">Yes</button> <button id="wf-n">No</button>`;
      footEl.querySelector("#wf-y").onclick = () => { game.clearSave(); game.start(Date.now()); render(); };
      footEl.querySelector("#wf-n").onclick = () => foot(v);
    };
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  render();
  return { render };
}


/* ---- compiled scenes ---- */
// generated by weft compile — do not edit
const scenes = {};
const S = scenes;
S["hub"]={art:"cityhub",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The city does not sleep so much as it changes shifts. Rain comes and goes like a tide that cannot commit. You have learned to read it now: the bridges, the river, the long avenues that all run down toward water, the green hills crouched at the western edge where the buildings give out.`)+P(`And under all of it, always, the hum. You feel it in your fillings, in the staff, in the dark behind your eyes. Nine days now, or ten. You have started to lose the count, which frightens you more than the cold does.`)+((v.went_viral)?(P(`Somewhere in ten thousand pockets, a small video of a sad man with a stick. You catch a stranger's glance held a half-second too long and your stomach drops every time.`)):(""))+((v.knows_emf)?(P(`At least you understand the cage now. Iron and current and signal, a net thrown over the whole grid. Knowing the shape of a wall does not pull it down, but it tells you where the door must be.`)):(""))+P(`You have ${v.cash} dollars to your name, a cracked stick of power, and a choice about where to spend the daylight.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Go to the cafe on the corner`,go:"cafe"},{id:"c1",l:`Cross town to the university and find someone who studies the hum`,go:"professor"},{id:"c2",l:`Climb to the green dark on the western hills, where the city thins`,go:"forestpark"},{id:"c3",l:`Find the man who films the sky and warns the comments`,go:"youtuber"},{id:"c4",l:`Sit awhile with the keeper of the all-night corner store`,go:"tariq"},{id:"c5",l:`Find somewhere out of the rain to sleep`,go:"shelter"},{id:"c6",l:`Work the street for what coin this world runs on`,go:"busk"},{id:"c7",l:`The woman in the charcoal suit has been across the road too long. Cross to her.`,hide:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (v.suspicion < 4 || v.faced_agents);},go:"agents"},{id:"c8",l:`Load the van and leave the grid behind for open country`,hide:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (!v.has_ride);},go:"roadtrip"},{id:"c9",l:`Begin the long working that might tear the way home open again`,hide:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (!v.shard_charged);},go:"gather"},{id:"c10",l:`Let the hum in. Sit against a warm wall in the noise until it hollows you.`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;spend('composure', 2);},go:"hub"},{id:"c11",l:`Stop. You cannot carry the cage one more day. Lie down on the wet brick and let go.`,hide:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (G.pools.composure.cur > 2);},go:"end_despair"}];}};
S["cafe"]={art:"cafe",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The cafe is the first warm place you have stood in since the rift, and warmth, you have learned, is a kind of mercy this city sells by the cup. The windows weep. A machine behind the counter shrieks steam at intervals, and each time it does, the staff at your hip gives a small unhappy buzz, because of course even coffee here runs on the hum.`)+P(`The woman from the square is behind the counter. Her apron is the green of old moss and stained the brown of every morning she has worked. A name tag, hand-lettered: Mara.`)+((v.met_mara)?(SAY("mara",`The wizard. You came back. Most of my disasters don't come back, they just get new and exciting somewhere else. Sit. You look like a coat-rack somebody left in the rain.`)):(SAY("mara",`You've been standing in my doorway dripping for a full minute, which is either a medical event or you want something. Sit before you fall down. First cup's on the house. The second one you have to be interesting for.`)))+P(`You sit. The chair holds you, which is more than the morning has done. She sets down a cup of something black and brutal and a roll that is still warm, and she does not ask for the money you do not have, and you feel your throat do something inconvenient.`)+P(`The cafe holds its own small weather. A spider plant gone leggy in the window. A corkboard furred with flyers for bands and lost cats and rooms to rent, each one a life you cannot have. Two regulars argue gently about a sport over by the milk station, and the machine shrieks, and the warmth works its way into your hands one knuckle at a time, and you understand that you would commit minor crimes to be allowed to keep this chair.`)+SAY("you",`You are kind to a stranger with no coin. In my country this would be remarked upon.`)+SAY("mara",`In your country. Sure. Drink your coffee, Merlin.`)+P(`She leans on the counter and looks at you the way a vet looks at an animal that bit someone, deciding how much of it is mean and how much is hurt. She is not stupid. She has clocked the robes under the coat, the way you flinch from the steam-machine, the accent that belongs to no map.`)+SAY("mara",`Look. I don't know your deal, and I've decided I don't need to. But you've got the thousand-yard stare of somebody a long way from home with no way back, and I've seen that stare in the mirror, so. The couch in the back is lumpy and the heat works. You can crash a few nights if you sweep up. Don't make me regret being soft.`)+P(`It is not a throne, but it is the first roof anyone has offered you in this whole humming world, and a magister of the Obsidian Order finds he cannot speak for a moment.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Tell her the truth — all of it`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 1); bond('mara', 1); chronicle('Mara fed you and offered her couch. You decided to tell her everything.');},go:"cafe_truth"},{id:"c1",l:`Take the kindness, keep the secret, sweep her floor`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 2); add('grasp', 1); bond('mara', 1); flag('met_mara'); (has('coat') || give('coat')); chronicle('Mara gave you a couch, a coat, and no questions. You kept your secret and learned the names of small things.');},go:"hub"}];}};
S["cafe_truth"]={art:"cafe",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You tell her. Quietly, over the dying steam, you tell her about the Mistral Reaches and the Obsidian Sanctum and the binding that went wrong, about a world of dragons and weather you could command, about a tear in the dark that dropped you into her doorway. You tell her your power lives in you still and only the hum has it by the throat.`)+P(`And then, because words are nothing here, you try to show her. You cup your hands over the counter and you reach for the smallest light, the bead of teal you found in the dead-end. You reach with everything you have.`)+P(`The machine hisses. A spark crawls across your knuckles, cold and wrong, and dies. Nothing more. In this warm bright humming room you are exactly as powerful as the spoon in her hand.`)+P(`You stare at your own empty hands. You have split mountains with these hands. You have held back a flood for the length of a battle. And in a warm room that smells of coffee you cannot summon the light a child could be taught in an afternoon, because somewhere overhead a wire is carrying the city's endless conversation, and that conversation is louder than you are. You have never once in your life been louder than nothing.`)+P(`Mara watches your hands. She watches your face do the math. When she speaks her voice has gone careful, the voice you would use on a man standing too near an edge.`)+SAY("mara",`Hey. Hey, okay. I believe that you believe it. That's real, what you're feeling, I'm not saying it isn't. But there are people who can help with the part where the world tore open. Good people, not the lock-you-up kind, I know some. Will you let me make a call?`)+P(`She means it gently and that is the blade of it. You have told the truth to the first kind face in this world and the truth has made you, in her eyes, a man who needs a doctor. The cage is not only around your magic. It is around your word.`)+SAY("you",`You are good, Mara. Better than my proof. Keep your call. I will earn your belief in a quieter place than this.`)+P(`She does not push. She squeezes your hand once, dry and warm, and goes to pull a shot for a man in a suit, and you sit with the cost of honesty cooling in front of you.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Drink the coffee. Carry it. Go.`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('told_truth'); flag('met_mara'); (has('coat') || give('coat')); bond('mara', 1); spend('composure', 1); chronicle('You told Mara the truth. She heard a sick man, not a mage. She offered a doctor and her couch both. You took the couch.');},go:"hub"}];}};
S["shelter"]={art:"shelter",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The shelter is a church basement that smells of bleach and wet wool and the particular patience of people waiting out a hard season. Cots in rows. A volunteer with a clipboard and a soft voice writes down a name you invent on the spot. Overhead, long tubes of light hum the flat dead note you have come to hate, and you understand that even here, even among the discarded, the cage holds. There is no charity in the current.`)+P(`You take a cot at the wall. Around you the room settles into its small noises: a cough, a radio turned low, a man two cots down arguing softly with someone who is not there, and you think, without unkindness, that he and you are not so different to the volunteer with the clipboard. Two men insisting on a world no one else can see.`)+P(`When the lights finally drop to a single emergency bulb across the room, the hum thins, and in the dimness under your blanket you try the bead of light again. It comes, faint and teal and trembling, no brighter than a coal. You hold it cupped in both hands where no one can see, and for a moment the basement is not a basement. It is a campfire on the high passes of home, and the dragons turning slow circles in the cold above, and your old teacher's voice naming the stars. Then a cot creaks and you snuff it, fast, heart pounding, a king hiding a candle.`)+P(`This is the joke the universe has built for you. The most powerful man alive, learning to disappear. You lie in the dark counting the breaths of strangers and you let the count slow you down, and somewhere before dawn you sleep, which is its own small magic and the only kind that works in a crowded room.`)+P(`You learn the shelter's grammar fast, because a court taught you to read a room and a room is a room in any world. Who guards a little hoard under the cot. Who is gentle. Who is one bad night from coming apart. The volunteers move among them with a worn-down tenderness that humbles you, these people doing real and unglamorous good with no magic at all, while you, who once raised a keep from bare rock, can offer nothing here but a folded blanket and your place in the breakfast line. There is a lesson in that, and you are not yet ready to learn it.`)+P(`You wake stiff and rested and harder to find. A man who sleeps in shadows leaves fewer tracks for whoever might be hunting them.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Fold your blanket and rejoin the day`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 3); set('suspicion', Math.max(0, v.suspicion - 1)); chronicle('You slept in a church-basement shelter, hiding a candle-sized spell under a blanket like a child. You rested. You laid low.');},go:"hub"}];}};
S["busk"]={art:"busk",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You need money, which is a word this world uses for the right to exist indoors. You have no trade it recognizes. You have, however, a stick, a costume, and a reputation you did not ask for.`)+P(`So you busk. You, who once held a war-council spellbound, stand on wet brick and do tricks. Real magic is out of the question with a crowd's worth of slabs aimed at you, so you fall back on the oldest art, the one that needs no power at all: the hand is quicker than the eye, the coin is never where they look, the patter matters more than the trick. Your old master would weep. Your old master also never went a day hungry.`)+P(`A small crowd gathers. They are warmer than the square was. A child gasps when the silver mark vanishes from your palm, and the gasp is real, and it is the first uncomplicated good thing that has happened to you here.`)+P(`You find the patter comes back faster than you would like. You learned sleight as a boy, before you learned anything true, palming coins for bread in a market town two worlds and forty years from here, and the hands remember even when the heart objects. You make the silver mark walk across your knuckles. You pull a scarf of colored light from your sleeve, which is only a scarf and only the suggestion of light, and the crowd cannot tell the difference and would not care if they could. They want the wonder. They do not audit its source.`)+P(`A man stops to heckle, sees the cracked staff, says something about the video, and a few phones come up like reeds turning to the sun. Your stomach clenches. This is the knife-edge you live on now: the same fame that fills the hat also draws the eyes you most need to avoid, and every coin you earn as the wizard from the screen is a coin that makes you easier to find. You have traded for armies in your time. You know a poor exchange when you are standing in one.`)+P(`And yet the child is still there at the front, mouth open, watching the silver mark vanish and return, vanish and return, certain in the way only the young are certain that the world is exactly as strange as it looks. For her sake you make it good. For her sake you are, for ninety seconds, a wizard again, even if the only true magic in the act is that she believes.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Lean into it — be the wizard from the video, sell the bit`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;set('cash', v.cash + (check('guile', 11) ? 30 : 12)); set('suspicion', v.suspicion + 2); add('guile', 1); chronicle('You became the wizard from the video on purpose, for tips. It paid. It also painted a target.');},go:"hub"},{id:"c1",l:`Keep your hood up, work quiet, take what honest coin comes`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;set('cash', v.cash + (check('guile', 13) ? 18 : 8)); gain('composure', 1); add('grasp', 1); chronicle('You worked the street with your hood up, quiet and forgettable, for honest small coin.');},go:"hub"}];}};
S["gather"]={art:"gather",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The shard burns in your cupped hands, a captured star heavy with enough silence to tear a door in the dark, and you stand at a high window over the glowing city you fell into ten days or a lifetime ago, and for the first time since the rift you have a real choice instead of a desperate one.`)+P(`You have learned this world. You can read its cage now, find its quiet pockets, talk past its watchers, sleep unseen. You know which kindnesses are real.`)+P(`Ten days. It is absurd that ten days should be enough to remake a man, and they have remade you down to the floor of yourself. The Elandor who fell through the rift would have torn this city apart looking for the door, would have spent its people like coin and never bothered to count them. That man could not have lasted a week here. This one has learned to ask, to wait, to be small, to take bread from a stranger and call it grace. You are not certain you like who the cage made of you, only that he is more worth keeping than the one who arrived.`)+((G.bonds.mara >= 1)?(P(`You think of Mara, who fed a coat-rack she found in the rain and asked nothing.`)):(""))+((G.bonds.tariq >= 1)?(P(`You think of Tariq, who drove you to the silence and asked you nothing, who knows exactly what it is to have a door behind you that will not open the same way twice.`)):(""))+((v.helped_quietly)?(P(`You think of the man on the rest-stop concrete who breathed because you chose to be seen, and how that was the most like yourself you have felt in this whole humming world.`)):(""))+((v.faced_agents)?(P(`And you think of Agent Reyes, patient as rust, and the shielded rooms where they would take such good care of you forever.`)):(""))+P(`Home is dragons and weather and a binding you must still answer for. Here is a couch, a van, a cup of mint tea, and a war with the hum you can never fully win. The shard does not care which you choose. It only waits, burning, for you to decide what kind of exile you are going to be.`)+P(`You weigh it as you have weighed every grave decision of your life, which is to say badly, with your heart shouting over your reason. To open the rift is to leave the people who saved you without a word of farewell. To stay is to leave a world that needs its magister and a binding only you can answer. There is no clean choice on offer here, only the honest naming of what each one costs, and the strange new freedom of getting to pay it on purpose. The shard pulses against your palms, patient as the tide, and waits for the man you have become to decide.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Carry the shard back to the deep silence and tear the way home open`,go:"ritual"},{id:"c1",l:`Stay, and spend what you are in secret, mending the small broken things here`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;chronicle('You set the way home aside and chose to stay with a purpose: to be the quiet hand in the dead zones, the one who knows what slips through the tears in the dark.');},go:"end_exile"},{id:"c2",l:`Set the working down. Choose a small human life, with the people who held you.`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;chronicle('You set the shard down still burning, and chose a life here: small, warm, human, and only secretly lit.');},go:"end_hybrid"}];}};
S["ritual"]={art:"ritual",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You take the shard back out past the grid, to the wild silence where your whole self returns, and you cut the runes into the black stone and you begin the working that should never be attempted twice in one life. The shard rises from your palm and hangs burning, and you pour ten days of grief and forty years of discipline into the High Tongue, and the air begins to part. A seam of light opens in the dark, vertical, and through it, faint, the howl of the Mistral Reaches and the cold clean smell of home.`)+P(`You have done large workings before, sieges broken, rivers turned, but never one like this, never a thing that asks you to unmake the wall between two worlds with a splinter of the wall itself. The runes take light as you cut them, teal pooling in the grooves, and the cold of the place between presses out through the widening seam and frosts your breath to silver. Your mended staff sings in your hand, whole and willing. For the length of one held breath the working is beautiful and it is going to succeed, and you let yourself believe it.`)+P(`And the silence calls its other answer.`)+((v.knell_beaten)?(P(`The Knell comes, drawn to the deepest quiet you have ever made, tolling out of the dark between the trees. But you have faced it, and your staff is whole, and you do not break this time. You hold the seam open with one hand and you shatter the death-herald's charge with the other, and it reels back into the night, and the door holds.`)):(P(`The Knell comes, drawn to the deepest quiet you have ever made, a thing of bell-iron you have never tested, and you have a charged shard in one hand and a working in the other and no hand left for it. Its toll goes through your concentration like a stone through ice. The runes scatter. The seam shudders.`)))+P(`The door is open. The way home hangs in front of you, exactly as wide as your nerve. Now, while it holds, you must step.`)+P(`Everything in you leans toward the seam. Home is on the far side of an arm's length of torn air: the storms, the order, the unfinished binding, your whole self restored to its proper sky. The shard is spending itself fast to hold the way open, and you can feel the window narrowing, the cold pouring through, the smell of the Mistral Reaches sharp as a remembered name. One step. After ten days of being no one, one step and you are a magister in your own world again.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Step through, while the way home still holds`,go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return ((v.knell_beaten && check('arcana', 9)) ? 'end_home' : 'ritual_fail');}}];}};
S["ritual_fail"]={art:"ritual",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The seam shudders and folds. You lunge for it and your hand closes on cold night air where a moment ago there was the howl of home, and then there is nothing, only the spent shard going grey in your palm and the wild dark settling back around you as if no door had ever been. You used the charge. There is no second star to gather. Whatever this was, it was your one tear in the dark, and it has sealed.`)+P(`You kneel on the black stone for a long time. The grief is enormous and then, slowly, it is only large, and then it is a thing you can stand up while carrying.`)+P(`There will be time later to hate yourself properly. Now there is only the cold stone under your knees and the enormous quiet where the door used to be, and the spent shard gone the dull grey of any ordinary pebble, light as a lie in your palm. You came so far. You climbed out of a fountain of a city and learned its cage and charged the silence and stood one step from your own sky, and the silence answered, and the answer was no. Some doors, it turns out, only open the once.`)+P(`The way home is gone. But you are not gone: you are a magister still, whole, in a world that has dead zones enough to live a life of quiet power in, and people in it who held a stranger out of the rain. Exile is no longer a sentence handed to you. It is a shape you get to choose.`)+P(`You get to your feet. It costs you nearly everything you have left, and you do it anyway, because a man who can stand up carrying his grief is a man who can still be of use, and use is the only cure you have ever found for despair. The wild dark does not mourn with you. The river goes on. The stars wheel overhead, indifferent and beautiful. Somewhere far below the city hums its endless hum, and you will go back down into it, and you will learn what you are for.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Choose exile with a purpose — guard the silence, mend what slips through`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;chronicle('The rift sealed with you on the wrong side of it. You knelt in the dark and chose, at last, to stay with a purpose.');},go:"end_exile"},{id:"c1",l:`Choose a small warm human life, and let the magic be a private thing`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;chronicle('The rift sealed and the way home with it. You stood up carrying it, and chose a quiet human life over a war you could not win.');},go:"end_hybrid"}];}};
S["end_home"]={art:"home",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You step through, and the cage falls away forever, and the Mistral Reaches take you back into a sky full of weather you can command and dragons turning their slow cold circles overhead. You are home. Your power is a sea again and not a candle hidden under a blanket. The binding still waits, and the Order, and the great unfinished work, and all of it is yours once more.`)+P(`And you stand on the high passes in your whole strength and you find you are weeping, again, for a humming city you spent ten days hating.`)+P(`You will tell no one here the truth of where you went, because there is no telling it. Already the city is becoming a thing that happened to you rather than a place, a ten-day fever of rain and humiliation and unlooked-for kindness. But the kindness you will keep. You came back to your own sky a colder and prouder thing than you left it, a worse mage by far, and somehow a better man.`)+((G.bonds.mara >= 1 || G.bonds.tariq >= 1)?(P(`You did not get to say goodbye. There was no way to explain it that would not have sounded like the wizard from the video. Somewhere a couch goes unswept and a van waits at a corner store and two people you cannot reach will wonder, for years, whatever happened to the strange tired man who came in out of the rain.`)):(""))+P(`You are the most powerful man in two worlds and you carry the smaller one home in your chest like a coal you will never quite set down. You learned to disappear. You learned to be helped. You learned what your power was worth in a room where it could not work, which is the only place anyone ever finds out. You raise the mended staff to the storm, and the storm answers, and you go to finish what the rift interrupted, a little kinder than the man who left.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Begin again`,go:"start"}];}};
S["end_exile"]={art:"guardian",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You stay. Not because you must now, but because you have decided what you are for.`)+P(`The tears in the dark do not only spit out mages. Other things come through, the Knell and worse, and they go where the silence is, into the deep woods and the dead buildings and the bones of old tunnels, the same map of quiet you alone know how to read. So you become its keeper. You learn every dead zone in a hundred miles. You walk them in your full strength, the most powerful man in the city precisely where the city cannot see, and you put down the things that hunt the silence, and you leave no proof, and you are never thanked.`)+((v.helped_quietly)?(P(`Sometimes, where the air goes thin enough, you steady a stranger who will never know why they lived, and that small mercy is enough, and you have made it be enough.`)):(""))+((v.faced_agents)?(P(`Agent Reyes keeps a file that never closes and never quite fills. You have made peace with being a rumor. A rumor cannot be put in a shielded room.`)):(""))+P(`It is a lonely vocation and you chose it with your eyes open. You are an exile with a purpose, which is the only kind of exile that can be borne. On clear nights you stand at the tree-line above the glowing grid, leaning on a whole staff, and you keep the watch no one knows is kept, and the hum, for once, sounds almost like the sea.`)+P(`You do not pretend it costs you nothing. There are nights when the loneliness is a physical weight, when you would trade the whole of your power for one person who knew your real name and what you are. But you chose the watch over the going-home, and a thing chosen sits lighter than a thing endured, and the work is real even on the nights no thanks ever comes. The valley needs its quiet hand. You have decided to be it.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Keep the watch`,go:"start"}];}};
S["end_hybrid"]={art:"hybrid",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You set the shard down still burning and you do not pick it back up. The way home can wait, or close, or stay a possibility you carry and never spend. Either way, you are tired of being a magister. You would like, for a while, to just be a man who came in out of the rain.`)+P(`So you stay, and you make the smallest life. You sweep Mara's floor and learn her regulars by their orders. You sit the long nights with Tariq and learn to read labels like poetry on purpose now, for the pleasure of it. You get a name this world will recognize, and papers, and a key to a door that opens the same way twice.`)+P(`And the magic does not die. It just goes quiet and private and yours. In the dead-air pockets only you can find, in a powerless cellar, in a blackout, you still call the small teal lights and let them drift, and once you brought Mara to a dead zone at last and lit a single flame in the dark in your bare hand, and watched her face change, and finally, finally, was believed.`)+P(`It is not the life you were born to, this small strange thing with its fluorescent lights and a coffee machine that still makes the staff buzz, and you have come to love it with the particular ferocity of a man who chose it on purpose, out of every world he might have had.`)+((v.told_truth)?(P(`She had been kind to you when she thought you were ill. She is fierce for you now that she knows you are not.`)):(""))+P(`You are the most powerful man alive, and you spend that power on small joys in dark rooms, and you have decided that this is not a tragedy but a home. You built it out of strangers and rain. It will do. It will more than do.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Live the quiet life`,go:"start"}];}};
S["end_despair"]={art:"despair",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You stop fighting the hum. It is easier. You sit down against a warm humming wall with the staff across your knees and you let the noise come in and fill the places where the working used to live, and after a while you cannot quite remember the shape of the drying-cantrip, the first thing you ever learned.`)+P(`The city does not need to lock you away. It has a gentler method. It simply agrees with you less and less until you stop insisting. You become a fixture, a man who talks about dragons, who waves a cracked stick at the transmitters and weeps when nothing happens. People step around you. The video of you was funny once and now it is only sad and mostly forgotten. You are the most powerful man alive in a band of silence you can no longer make yourself walk to.`)+P(`Some days you are almost content, in the flat way of a fever that has finally broken down into nothing. You stop reaching for the word that will not come. You stop flinching from the slabs. You learn which grates breathe warm air and which doorways stay dry, and you grow very good at being no one, which is the single skill this world ever rewarded you for, and the saddest mastery of your long and storied life.`)+P(`Somewhere far out past the grid the air is still quiet, and your whole strength is still waiting there for you, a sea behind a door you can no longer find the will to open. The shard goes cold in your pocket. The hum goes on. You sit in it, and it hollows you, and the city flows past, and no one, not one of them, will ever know that a king sat here and forgot he was one.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Sit in the hum`,go:"start"}];}};
S["end_taken"]={art:"facility",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`Agent Reyes was right that the offer was worse than the threat, and she was right that you were smart enough to know it, and none of that saved you. They take you somewhere clean and quiet, and the cruelest joke of your whole exile is waiting for you there: the rooms are shielded down to nothing, dead air, perfect silence, and so your magic works.`)+P(`It works beautifully. You stand in a windowless white room and call a flame that burns steady and teal and perfect, and behind the thick glass they take their readings and nod and write, and somewhere a graph finally has the data it wanted. You are not cold, not hungry, never alone, never once unwatched, and you will not leave.`)+P(`They are not cruel, which is the worst of it. They bring you tea exactly as you like it and they ask you, so politely, to do the thing again, a little brighter this time, for the instruments. You are the most powerful man alive and you have become a reading on someone's screen, a resource, a wonder behind glass. The door opens the same way twice and it only opens for them.`)+P(`You turn the irony over until it stops being funny, which takes about a week. The whole of your exile you fought to find one room quiet enough to prove what you are, and in the end they simply built it for you, and put the lock on the outside, and now the proof happens daily for an audience that owns the footage.`)+P(`On the worst nights you call the small teal lights and let them drift around the white room, just for yourself, until a kind voice over the speaker asks what you are doing, and you let them go dark, and you understand that the cage was never the city. The cage was always being seen.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Do it again, a little brighter`,go:"start"}];}};
S["tariq"]={art:"store",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The corner store hums like everywhere else, the coolers breathing their cold electric breath, but the man behind the counter has made an island of it. There is a kettle. There is a stool he pushes toward you without being asked. There is, taped by the register, a photograph of a hillside town the color of honey that is plainly not in this country.`)+SAY("tariq",`You come in three nights now. You buy nothing. You stand by the warm cooler and you read the labels like they are poetry. I am Tariq. Sit. The tea is mint, it is good, and you look like a man who has forgotten the taste of a thing made by hands.`)+P(`You take the stool. The tea is hot and sweet and it undoes something in your chest. Tariq does not pry. He restocks cigarettes and rings up a man buying lottery tickets and comes back to you, unhurried, a person whose whole trade is the long patient night.`)+SAY("tariq",`You have the look. I know it because I wore it. I came here twenty-two years ago from a place I cannot go back to, and for the first year I also read the labels like poetry, because they were the only thing that would hold still and let me understand them. Everyone here is from somewhere they cannot return to. We just do not all admit how far.`)+SAY("you",`My somewhere is farther than most.`)+SAY("tariq",`They are all the farthest, to the one who left. Distance is not the thing. The thing is the door behind you that does not open the same way twice.`)+P(`He says it plainly, refilling your cup, and you feel seen in a way none of your spells ever managed, by a man who has not the faintest idea what you are. He does not ask you to prove anything. He has decided you are a person who is tired and far from home, and that is enough fact for him to act on.`)+SAY("tariq",`I have a van. It is old, it complains, but it goes where the buses do not. The mountains, the river, the empty places. Sometimes I drive out on my night off just to stand where it is dark and there is no one to sell anything to. If you need to get out of this city for a while, to somewhere quiet, you tell me. I will drive. We do not even have to talk. Sometimes the not-talking is the whole medicine.`)+P(`A way out. Open country, beyond the grid, beyond the hum. The thing the forest taught you that you needed, offered over a paper cup of mint tea by a man who simply recognized a fellow exile.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Accept the offer, and the friendship under it`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('has_ride'); bond('tariq', 2); gain('composure', 3); add('grasp', 1); chronicle('Tariq, who left his own country twenty-two years ago, offered his van and his quiet. He does not know what you are. He knows what you carry. It is the same thing.');},go:"hub"},{id:"c1",l:`Thank him, but keep your distance — he could be hurt by knowing you`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;bond('tariq', 1); gain('composure', 1); chronicle("Tariq offered his van and his friendship. You kept him at arm's length to keep him safe, and hated that you had to.");},go:"hub"}];}};
S["knell"]={art:"knell",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You climb toward the toll, and the toll climbs toward you, and you meet it in a stand of firs so old and so dark that no light from the city has reached here in a thousand years. It is the most silent place you have found. It is therefore the most dangerous, and you understand why only when you see what is waiting.`)+P(`The Knell. It came through with you, or after you, drawn through the same tear in the dark. You knew its kind at home, where the death-heralds toll on the night a great one dies. Here it has found what you have found: that in the dead air, it too is whole. A tall wrongness of grey mist hung with bell-iron, its head a cracked bronze bell, and where it steps the silence deepens until your own heartbeat sounds obscene.`)+P(`It tolls once, and the note goes through your bones and tells you, in the old plain grammar of bells, that it has been hunting the quiet places, and the quiet places are exactly where you must go to ever get home, and so the two of you were always going to stand here.`)+P(`You have stood across from death-heralds before, in the proper world, where they were rare and terrible and bound by old law to toll once and then depart. This one is bound by nothing. It came through the same wound you did, and like you it has spent ten days learning that this world keeps rules its own kind never imagined, and like you it has found the loophole: the silence, the dead places, the pockets where the old powers still answer. You were never the only thing that fell out of the sky; you were only the one who landed believing himself alone.`)+P(`No witnesses. No slabs. No hum. For the first time since the rift, you may use everything you are.`)+P(`You plant the cracked staff and you stop being a busker.`)+P(`The fear is enormous, and it is also, distantly, a relief. For ten days you have been a joke, a wet man with a stick, smothered and filmed and pitied. Here at last is a thing that takes you seriously, a thing worth the whole of your art, and some old soldier in you stands straight for the first time since the rift. Whatever happens in the next minute, it will be true. The staff is cracked and you are far from your best, but in this one black wood, for this one moment, you are entirely yourself again.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Strike with the full weight of the Obsidian Order`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 1);},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (check('arcana', 11) ? 'knell_won' : 'knell_lost');}}];}};
S["knell_won"]={art:"knell",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You speak the Word of Unsealing and this time, in the dead air, the world obeys. Force leaves you in a line of cold teal fire and the Knell's bell-iron rings and cracks and the grey mist of it shreds like fog in a gale. It does not die. Its kind does not die so easily. It comes apart into the dark between the trunks, tolling its retreat, and the silence it leaves is clean again and yours.`)+P(`For a moment you simply breathe in the after-quiet, staff still lit, the cold teal throwing your shadow huge against the firs. You had forgotten this feeling, the clean exhaustion of power well spent, the particular hush that follows a thing done right. Your hands are steady now. The crack in the yew smokes faintly where the working forced through it, and you make a note, somewhere beneath the triumph, that the staff failed you on precision at the worst possible instant and will have to be mended before you trust it with your life again.`)+P(`You stand shaking with the staff blazing in your fist, more alive than you have felt since home, and underneath the triumph a cold understanding settles. It will heal. It will come again. And it will always find you in the same places you must go to be whole, because silence calls to both of you. Your sanctuary is its hunting ground. You have won a wood you can never quite rest in.`)+P(`You think of the dead zones laid across the city like a secret map, every one of them now a place you must enter armed and leave quickly. The forest you wept in this afternoon is the same forest you will fear tonight. There is no clean refuge anymore, only borrowed quiet with a thing in it that knows your name. You start down the dark trail, listening behind you the whole way. And the city's hum, when it rises to meet you at the trailhead, sounds for the first time almost like a wall, and a wall, tonight, is a thing you are absurdly grateful for.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Carry the victory and the warning back down`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('knell_met'); flag('knell_beaten'); add('arcana', 1); chronicle('Deep in the dead zone you fought the Knell, the death-herald that followed you through, and drove it off with real magic. It did not die. It will find you wherever the air goes quiet. Your only refuge is also its hunting ground.');},go:"hub"}];}};
S["knell_lost"]={art:"knell",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You speak the Word and the dead air should have made it a hammer. But the staff is cracked, and the crack chooses now to matter. The force that should have shredded the Knell stutters through the broken yew and comes out wrong, half of it, sideways, and the bell-iron only rings and rolls toward you unbroken.`)+P(`The toll hits you full in the chest, the death-note, and your knees go and your courage with them. You run. A magister of the Obsidian Order turns and scrambles down a muddy trail in the dark with a death-herald tolling behind him, and the only mercy is that the Knell, having driven you off its silence, does not bother to chase a thing already this broken.`)+P(`There is a particular shame in running, and you taste all of it. Not the clean ache of a fair fight lost, but the sick knowledge that your own instrument failed you, that the crack you have been nursing like a hangnail is the whole difference between a magister and a corpse. You should have mended it. You had the silence and the hours and you spent them weeping at pretty lights instead, and the wood remembered your neglect at the exact moment your life turned on it.`)+P(`You sit on the cold curb until the shaking stops. Joggers pass. A bus sighs at the stop and pulls away. None of them can see the death-herald pacing the tree-line a quarter mile up the hill, kept back only by the very hum that keeps your power down, the two of you fenced apart by a wall that cages you both. You understand now that the staff's wound is not cosmetic, that the dead zones you need are the only ground that thing can reach you on, and that you cannot go home until you have made yourself whole enough to cross that wood alive.`)+P(`You come out at the trailhead under the buzzing lights and the hum closes over you, and for once you are grateful for the cage, because the Knell will not follow you into the noise. Neither will your power. You trade one prison for the other and you sit on the curb and shake.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Limp back into the loud safe city`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('knell_met'); spend('composure', 5); chronicle('The cracked staff betrayed you. The Knell broke your nerve and drove you out of the dead zone. You fled into the hum, where it cannot follow, and neither can you do anything at all.');},go:"hub"}];}};
S["agents"]={art:"agents",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The woman in the charcoal suit does not run when you cross to her, which tells you everything. People who chase you are afraid of losing you. People who wait for you have already decided they have you. She holds up a tablet, and on it is the plaza video, and beside it a graph of something spiking, and she lets you look at both before she speaks.`)+SAY("reyes",`Agent Reyes. I'm not with the people who'd make a scene. We're quieter than that. We've been watching a class of electromagnetic anomalies in the Pacific Northwest for some years, and about ten days ago they started having a center, and the center has your face. I'm not here to arrest you. I'm here to make you an offer, which is so much worse, and I think you're smart enough to know it.`)+P(`She is calm and she is kind in the way of a person who has read the manual on being kind, and your skin crawls worse than near any transmitter. She is the hum given a face. She is the cage with a pension and a parking spot.`)+P(`You have bargained with worse than her. You have sat across fire-pits from warlords and across cold marble from kings, and you learned young that the most dangerous person in any room is the one who is not angry. Reyes is not angry. Reyes has a budget and a mandate and patience without a bottom to it, and she has decided, with the serene certainty of an institution, that you are already hers and have merely not finished arriving. The terrible thing is how good the offer sounds. A bed. Warmth. Quiet you could do real work in. You are so tired, and the tiredness makes its own argument, whispering that surrender would at least be rest. You let it whisper. Then you remember the shielded rooms, and the door that locks from outside, and the plain fact that a wonder behind glass is still behind glass.`)+SAY("reyes",`Come in voluntarily. Clean facility, no charges, all the quiet you could want — we have rooms shielded down to nothing, did you know that, rooms where I'm told a man might do remarkable things. We'd take such good care of you. You'd never be cold again. You'd just never leave.`)+P(`The offer hangs there, reasonable and total. Behind your ribs the shard has gone very cold. You have one move, and it is not magic, because the street hums and her car hums and the cage is everywhere out here. It is words. It is the oldest spell of all.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Talk your way clear — be too dull, too mad, too poor to be worth the file`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('faced_agents'); set('suspicion', v.suspicion + 1); spend('composure', 2);},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (check('guile', 13) ? 'hub' : 'end_taken');}},{id:"c1",l:`Refuse her flatly and walk, and pray the hum hides you in the crowd`,req:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (G.eff.guile >= 3);},rq:"you do not yet have the nerve to simply walk from a federal offer",do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('faced_agents'); set('suspicion', v.suspicion + 2); spend('composure', 1); chronicle('You walked away from Agent Reyes and the Office. You felt her watching you the whole length of the block. The clock is running now.');},go:"hub"}];}};
S["start"]={art:"alley",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return `<h1>${G.def?.meta?.title||''}</h1>`+P(`The rift spits you out the way the sea returns a drowned man: all at once, face-first, and with no ceremony at all. One moment you stand in the Obsidian Sanctum with the binding half-spoken and the Mistral Reaches howling at the windows. The next, you are on your knees on cold wet stone, and the howling has become the hiss of rain on a hundred hard surfaces, and the windows are everywhere, lit, and full of strangers who are not there.`)+P(`You breathe. The air tastes of metal and old water and something burnt that is not smoke. Above you a thing the size of a coffin hangs on a pole and hums. It hums the way a hornets' nest hums, a flat insistent note with no music in it, and your teeth ache to hear it.`)+P(`Magister Elandor Voss, ninth of that name, who has called lightning down a mountain and read a dragon to sleep, kneels in a puddle and shakes.`)+P(`You take inventory the way you were trained to, because the body remembers discipline when the mind has none. The robes, soaked through, every cooling rune gone dark. The staff, in your fist still, and split: a hairline crack runs the length of one finger, yew gone to grey. In your sleeve, against the pulse, the shard you tore loose at the last instant, cold as a held breath. And around you a city, if it is a city, drawn in colors you have no names for.`)+P(`The rain does not fall so much as hang, a fine cold suspension that beads on the wool and will not be shaken off. You get one knee under you and look up the length of the alley. Sheer walls of brick and glass climb past any honest height, pricked all over with squares of cold light, and the rain catches the colors of signs you cannot read and lays them in broken ribbons across the wet ground. It is beautiful and it is monstrous and it is entirely indifferent to you, which is a thing kings forget the world can be.`)+P(`You do the smallest thing. The drying-cantrip, the one apprentices learn before they learn their letters, a turn of the wrist and a word. You speak it.`)+P(`Nothing. Worse than nothing. The word leaves your mouth and the air around the staff curdles, goes thick and reluctant, and a smell of scorched hair rises off the wood. A spark crawls up the crack, gutters, dies. You are as wet as before, and now you are also afraid, because in forty years of practice your magic has refused you exactly never, and the hornet-thing on the pole hums on, pleased with itself.`)+P(`Somewhere close, a great deal of voices and light. Somewhere behind you, the alley narrows into dark.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Go toward the light and the voices`,go:"plaza"},{id:"c1",l:`Go deeper into the dark, where the hum is faint`,go:"alley_dark"}];}};
S["alley_dark"]={art:"deadzone",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You back away from the humming pole, deeper, until the neon falls behind a corner and the dark closes like water over your head. Here is the rear of some shuttered place, brick and a steel door with no light behind it, a dead-end stacked with the city's leavings. The hornet-note thins. Two steps more and it is almost gone, and the silence it leaves is enormous, the first silence you have heard since you arrived.`)+P(`You try the cantrip again. Not because you hope. Because a drowning man tries the water.`)+P(`The word goes out, and this time the air does not fight you. A bead of light kindles at the staff's broken tip, small as a candle and the wrong color, a cold teal you do not recognize, flickering where it should be steady. But it is light, and it is yours, and it holds for the length of three breaths before the crack in the wood swallows it.`)+P(`You laugh, once, an ugly sound that surprises you. So. The power has not abandoned you. The power is being smothered. Out there, by the pole, by the humming, by whatever runs in the veins of this place, your magic chokes like a fire in a sealed jar. Here, in the dark and the quiet, it breathes. You do not understand the rule yet. You only know there is a rule, and a rule can be learned, and a thing that can be learned can be beaten.`)+P(`For a moment you let yourself remember it properly: the practice yard at dawn, the cold ringing off the flagstones, your hands learning the small words before the large ones, your master's patience and your own arrogance. All of it intact, all of it real, all of it sealed behind a wall of noise whose edges you cannot yet find. You press your palm flat to the cold brick and feel, faintly, how the silence pools here like water in a low place. Pools, and could be deepened, if a man knew how.`)+P(`The wonder lasts exactly as long as your stomach lets it. Then the cold reminds you that you are a man and not a principle, that you have not eaten, that the rain is still falling and the dark gives no shelter worth the name. The little teal light is gone. You are alone with a cracked stick and a wet conviction.`)+P(`You cannot eat a theory. Whatever this city is, the food and the fire are where the people are, and the people are where the light is, and the light is where your power goes to die.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Steel yourself and head back toward the crowd`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 1); chronicle('In a dead-end with no power, the cantrip lit. The magic is not gone. It is being smothered. There is a rule.');},go:"plaza"}];}};
S["plaza"]={art:"plaza",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The square opens in front of you like a stage that has forgotten it has an audience, or has too much of one. Brick underfoot, slick and red. Storefronts ring it, blazing, selling things in windows you cannot parse: a wall of moving pictures, a woman thirty feet tall drinking from a cup, words that scroll and change. A man plays a guitar with a hat in front of him. Two others argue about a god you do not know. And everywhere, in every hand, a small bright slab, held up like an offering, its owner's face washed pale by the glow.`)+P(`The hum here is not one pole. It is the whole square, a chord of it, ten thousand small fires you cannot see, and your skin crawls with the wrongness of it. Whatever smothers your power, these are its altars, and the people tend them without knowing they are priests.`)+P(`You make yourself walk the edge of it, hood up, reading the crowd as you once read a court. They are not unhappy, these people, only absent, each of them half-here and half-inside the bright slab in their palm, conducting some business with a world you cannot see. A girl laughs at something no one beside her said. A man weeps quietly at his slab and no one marks it. They have built a second city on top of this one, invisible and humming, and they all live in it, and you have washed up on the shore of the first city alone.`)+P(`Your stomach folds on itself. You have not eaten since a world ago. The smells reach you in layers, frying oil and sugar and roasting meat, and your mouth floods and your pride bridles in the same instant, because a magister does not beg, a magister is fed, a magister is feared. And yet here is the plain arithmetic of it: you have no coin this world will take, no name it will know, and a stick that makes light only where no one is looking.`)+P(`You are cold and you are hungry and you are, you remind yourself, the most dangerous man on whatever this is for a world. A word from you once emptied a battlefield. Surely a word can fill a stomach.`)+P(`The trouble is the witnesses. To do anything here is to do it in front of a hundred raised slabs, and you have already learned what your magic does near them. But pride is a furnace that burns whatever you feed it, and you have fed it forty years.`)+P(`A woman in a green apron stands smoking by a service door, watching you with the flat patient attention of someone reading weather. She has a kind face and a tired one. She has not raised a slab at all.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Raise the staff and show them what you are`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;chronicle('You tried to prove yourself to the square.');},go:"viral"},{id:"c1",l:`Swallow it, and ask the guitarist where a cold man can sleep`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 1); chronicle('You swallowed your pride and asked a stranger where a cold man could sleep.');},go:"hub"}];}};
S["viral"]={art:"viral",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You plant the staff and you raise your free hand and you speak the Word of Unsealing in the High Tongue, the word that once split a fortress gate, and you put forty years behind it.`)+P(`The square does not split. The square turns to look.`)+P(`What happens is small and horrible. The crack in the staff lights up that wrong, cold teal, and a fistful of sparks coughs out of it and dies in the rain, and a sound comes that is mostly your own voice cracking on a syllable too large for this air. The runes on your robes try to wake and cannot. For one instant the hum of the square seems to lean in around you, curious, and then it simply wins, the way water wins against a match.`)+P(`You are left standing in the wet with your arm up and your mouth open and nothing, nothing, coming out of you but breath.`)+P(`The slabs do not lower. They lift higher. People are laughing, not cruelly, which is worse. Someone says wizard the way you would say poor soul. Someone else is narrating you to the little slab in a bright performing voice. You understand, with a clarity that arrives like cold water, that you are not being witnessed. You are being collected. By morning your humiliation will live in ten thousand of those hands and you will never know which ones.`)+P(`You lower the staff. There is no dignity left to salvage, only the choice of how to carry the lack of it, and you have carried worse. But something has broken loose in your chest, some last assumption that the truth would, given time, out. It will not. You could stand here a thousand nights and burn yourself down to the wick, and every single time the hum would get there first, killing the proof in your hands, and the slabs would catch only the failure and never the cause. The cruelty of it is so complete it is almost elegant.`)+P(`A hand closes on your sleeve. The woman in the apron, close now, steering, her voice low and flat under the noise.`)+SAY("mara",`Okay. Big finish, we're done, take a bow, off we go. There's a cop on the corner and you are about three seconds from a very boring night. Walk. Don't perform. Just walk.`)+P(`She walks you out of the light with the unbothered efficiency of someone who has peeled drunk men off this brick a hundred times. Behind you the laughter folds back into the general roar of the place, already forgetting you, already moving on to the next bright thing.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Let her walk you into the dark`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('went_viral'); flag('met_mara'); set('suspicion', v.suspicion + 2); spend('composure', 2); bond('mara', 1); chronicle('You tried to prove your power to a crowd. The spell died on camera. You are, somewhere out there, a video of a sad man with a stick.');},go:"hub"}];}};
S["roadtrip"]={art:"highway",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`Tariq's van complains exactly as promised, a rattle for every pothole, but it goes where the buses do not. He drives east along the great river at dawn with the city shrinking in the mirror, and you watch the grid let go of you mile by mile. You can feel it in your teeth: the hum thinning, the cage loosening one notch at a time, the world you knew rising to meet you in cliffs and falling water as the river cuts its road into the Gorge.`)+SAY("tariq",`I do not ask where the quiet you need is. I only drive. But you have the look of a man going to either bury something or dig it up. I hope it is the second. Burying, you can do anywhere. Digging up, you need a friend with a van.`)+P(`You almost tell him. The word is right there. But the van has a radio and a clock that glows and you have learned what proof costs near the glowing things, so you let it pass, and Tariq, who reads silences for a living, lets it pass too.`)+P(`Instead you talk of small things, which is its own relief. He tells you about the town in the photograph, the bread his mother made, the particular blue of a sea you will never see. You tell him, careful and edited, about a cold country of mountains and storms, and he takes it for an immigrant's grief like his own, which it is, only larger. The miles unspool. Fir gives way to bare basalt and the river widens and the last bars on the van's glowing clock lose their signal, and you feel the cage thin past anything the forest ever offered, and your hands, resting on your knees, begin without your leave to remember what they are for.`)+P(`You stop at a rest area where the river bends, half the lights dead, the hum here already a murmur instead of a scream. And there, by the restrooms, a small crowd has formed around a man on the concrete, gone grey and shaking, a woman over him shouting for an ambulance that the signs say is twenty minutes out. Phones are up. Of course they are. And under the thin murmur of this half-dead place you can feel, faint but real, that a steadying working might reach him. The quieting of a body's storm. A thing you could do in your sleep at home.`)+P(`But not unseen. Never unseen. To save him you would have to do something true with a dozen cameras pointed at the concrete, and whatever the cage left intact would be enough to film, and the woman in the charcoal suit watches every feed there is.`)+P(`Tariq has gone still beside you, watching you watch the man, understanding that some decision is happening that he is not part of.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Kneel, and risk everything to quiet the storm in a stranger`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('helped_quietly'); gain('composure', 3); set('suspicion', v.suspicion + 2); add('arcana', 1); chronicle('At a half-dead rest stop you knelt and worked, openly, to steady a dying stranger. It held. He breathed. Somewhere a camera caught a glow it cannot explain, and you did not care, and that was the most yourself you have felt since the rift.');},go:"gorge"},{id:"c1",l:`Stay in the van. Save yourself. Hate it the whole way.`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;spend('composure', 2); chronicle('You stayed in the van while a stranger shook on the concrete, because being seen would cost you the way home. He lived; the ambulance came. You will not forget that you chose. Neither, you think, will the part of you that used to be a healer.');},go:"gorge"}];}};
S["gorge"]={art:"gorge",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The waterfall is the loudest thing for miles and it makes the silence underneath it total, because it is the silence that matters: no grid, no signal, no current within a day's walk. The stars come out the way they never do over the city, the old familiar wheel of them, and though they are not your stars they are stars, and the cage is gone. Entirely gone. You stand on a wet black rock above the river and you feel your whole self pour back into you like a tide returning to a flat that has been dry for a generation.`)+P(`You begin small, because you have learned humility the hard way. The drying-cantrip. A light. Then larger. You call the river-mist up into a turning column and set it alight in cold teal and let it fall as a rain of sparks, and you laugh, and the laugh has no madness in it this time, only joy. You speak to the wind and the wind answers. You lay your hand on the cracked staff and pour power into the wound in the yew and watch it close, the silver running whole again, the crack sealing seamless, and the staff blazes in your grip the way it did the day your master first put it in your hands.`)+P(`Then the shard. You hold it up to the wheeled stars and it drinks. Here there is no ceiling. It fills and fills, the deep teal of the between-place burning brighter than any light around it, until it is a small captured star of its own, heavy with enough of the quiet to tear a door in the dark. You feel the weight of it settle in your palm. The way home, charged and ready. It is, suddenly, possible, and the possibility is so large you have to sit down on the rock.`)+P(`For a while you do nothing at all. You sit on the cold rock with the spent joy still ringing in you and you let yourself feel the full size of what was taken and what was given back, both at once, until you can no longer tell the grief from the gratitude and stop trying to. This is the thing the city could never allow you: not the power only, but the room to be wrecked by it in private, with no slab raised, no witness but a man at a fire who will not ask.`)+P(`Below, by the van, Tariq has lit a small fire and is not watching you, on purpose, the way you give a man room to grieve. When you climb down he hands you tea and looks once at the staff that is no longer cracked, and at your dry robes stitched with waking stars, and he does not ask. He nods, slowly, like a man confirming something he had already decided to believe.`)+SAY("tariq",`There. Now you have dug it up. Whatever it is. I will not ask its name. But you carried it well, and a thing carried well that long deserves to see the sky. Drink your tea. We have a long drive back to the noise.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Pocket the burning shard and carry the possibility home`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('shard_charged'); flag('staff_fixed'); gain('composure', 5); add('arcana', 1); chronicle('Beyond the grid, in the silence under a waterfall, your full power returned. You mended the staff, and charged the shard to a captured star. The way home is possible now. Tariq watched the fire and asked you nothing, and that was its own kind of grace.');},go:"hub"}];}};
S["forestpark"]={art:"forestpark",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The bus lets you off at the edge of the trees and you climb. Forest Park is what they call it, a green spine of old forest laid along the city's western ribs, and the deeper you go the more the world you knew bleeds back into the world you are in. The roar of the avenues drops away. The light goes green and underwater. Fir trunks rise like the pillars of a hall built before there were kings to sit in it, and the rain comes down through a hundred feet of branches softened to a whisper.`)+P(`And the hum dies. Not all at once. It thins with each switchback, each hundred feet of wet earth and root you put between yourself and the grid, until you stop on a muddy trail with the city a far-off rumor below and you realize you can no longer feel it in your teeth. The silence is so total it rings.`)+P(`You are almost afraid to try. You raise the cracked staff and you speak the drying-cantrip, the apprentice's word, the first thing you ever learned.`)+P(`The light comes. Steady. Clean. It runs up the yew in a line of cold fire and pools at the broken tip and holds, and the rain around you turns to a fine warm steam, and your robes dry on your body, and the runes stitched into them wake one by one like stars coming out. You are dry. You are warm. You did it with a turn of your wrist, the way you breathe, and your eyes are streaming and you tell yourself it is only the steam.`)+P(`Forty years you carried this and never once felt it. You feel it now. You feel all of it, the whole drowned weight of who you were, and you stand in a city's forgotten forest and laugh and weep at the same time like the madman they already think you are.`)+P(`When it passes you are clear-headed and you understand the rule in your bones, not your theory: where the current cannot reach, you are a magister still. The city has thousands of these pockets, surely. Cellars. Tunnels. Dead buildings. The deep woods. A map of silence laid under the map of noise. You have found the door in the wall.`)+P(`You stand a while longer than you need to, just to be inside the quiet, just to feel the cold clean current of yourself run unobstructed. A bird you do not know answers a bird you do not know. Water finds a hundred small ways down the slope. The dread you have carried since the alley loosens one full turn, because a man with a door can survive almost any wall.`)+P(`The trail forks. Down one way the trees thin back toward the trailhead and the bus and the warm safe edge of things. Up the other, the old growth deepens into true dark, and from somewhere up there, faint, you hear a sound you know and have not heard since home: a single low toll, like a bell rung underwater.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Climb toward the tolling and test the limit of your power`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('found_deadzone'); gain('composure', 3); add('arcana', 1); chronicle('In Forest Park, deep enough that the hum died, your magic came back whole. You wept. You found the door in the wall.');},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (v.knell_beaten ? 'forestpark_wonder' : 'knell');}},{id:"c1",l:`Stay near the tree-line and simply let the power breathe`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('found_deadzone'); gain('composure', 4); chronicle('In Forest Park you found a true dead zone and, for once, you did not push your luck. You let the magic breathe and you breathed with it.');},go:"forestpark_wonder"}];}};
S["forestpark_wonder"]={art:"forestpark",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You find a fallen log gone soft with moss and you sit, and for an hour you are simply a mage in a quiet wood, which is the only thing you ever wanted to be on the days you were honest. You call small lights and let them drift between the ferns like the lantern-flies of home. You mend the crack in the staff a hair's width, just to feel the wood answer. You warm a stone and hold it like a heart.`)+P(`It is not spectacle. No one will film this. That is the whole of its worth.`)+P(`You sit with the grief and let it be grief instead of fighting it, which is a thing you never had time for at home, where there was always a binding to hold or a council to win. Here there is only the drip of the canopy and the small lights you have made for no audience but yourself. You think of your apprentices. You think of the dragon you read to sleep, and whether anyone has thought to wake her. You think of how badly you have wanted, the whole of your life, exactly this much quiet and no more, and how you had to fall through the floor of the world to be handed it.`)+P(`You take out the rift-shard and hold it up, and here, in the silence, it answers. It glows the deep teal of the place between worlds and it drinks the quiet, charging like a vessel held under a slow spring. But only so far. After a while it dims, full as it will go in a pocket this small, and you understand the limit. This forest is a cup of silence inside an ocean of noise. To fill the shard the way the working home would need it filled, you would have to leave the city's whole humming field behind. Real wilderness. Open country. Somewhere the grid has never reached.`)+P(`You pocket the shard, lighter than you came. The grief is still there. It has just stopped being the only thing in the room.`)+P(`You sit until the cold finds your bones and the light begins to fail, and then you rise, and pocket the cooling stone, and start the long walk back down toward the place that will switch your power off again at the property line. You go willingly. A man can bear the cage better once he has remembered, in his body, what the open air feels like.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Walk back down toward the noise, changed`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('composure', 2); chronicle('You learned the dead zone has a ceiling. To charge the shard for the working home, you must leave the city entirely. You need open country.');},go:"hub"}];}};
S["professor"]={art:"lab",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`Dr. Okafor's office is in the basement of the physics building, which is the only reason she agrees to see the strange man asking strange questions: down here the students do not come, and she is, you gather, between the kind of grants that buy company. She is sixty-some, sharp as a flensing knife, and she has the specific weariness of someone who stopped being surprised by the universe a long time ago and resents that it keeps trying.`)+P(`The office is a museum of dead ends: a Faraday cage the size of a birdcage on the bench, coils and old oscilloscopes, a poster of the electromagnetic spectrum gone amber at the edges. It smells of solder and cold coffee. She does not offer you a chair, which you respect. She offers you exactly two minutes, which you respect more, because it is the first honest unit of value anyone in this city has named to your face.`)+SAY("okafor",`You said on the phone you wanted to understand electromagnetic interference. People who say that to me usually want me to validate a story about their fillings receiving radio. So. Two minutes. Impress me or leave me to my misery.`)+P(`You set the shard on her desk. Her meter, idling, jumps. She frowns, taps it, holds it closer, and the needle climbs into a region she clearly does not see often. For a moment the weariness falls off her face and something younger looks out.`)+SAY("okafor",`Huh. That's. Okay, that's not nothing. Where did you get this.`)+P(`You tell her a careful half-truth: a place very far away, where the air is quiet, where you could do things you cannot do here. And to your surprise she does not reach for the doctor's number. She reaches for a whiteboard.`)+SAY("okafor",`Fine. Forget where. Here's the boring magic, since you like that word. You live inside a field now. Power lines, transmitters, every device, the whole grid, all of it bathing you in electromagnetic noise around the clock. A century ago this city was nearly silent in that band. Now it screams. If whatever you do depends on a clean signal, the city is the worst place on Earth to do it.`)+P(`She draws a box, and inside the box, a smaller box.`)+SAY("okafor",`A Faraday cage. Conductive shell, and the field can't get in. Dead air inside. You want your quiet? Old buildings with the power cut. Deep rock. A blackout. Get far enough from the grid and the noise floor drops to nothing. The desert. The deep woods. Out there you'd have whatever this is back at full strength, I'd bet money. Which I don't have, on account of the grants.`)+P(`She caps the marker and looks at you, and the skepticism is back but it has a crack in it now, a scientist's helpless interest in a thing that should not read on her meter.`)+SAY("okafor",`I don't believe you. I want to be clear about that. But I've been bored for nine years and you are not boring. Bring me the data and I'll tell you what it means. That's the only kind of help I've got.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Show her enough that she sees the shape of the working`,req:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (G.eff.grasp >= 2);},rq:"you cannot yet explain it in words she would credit",do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('knows_emf'); flag('knows_ritual'); bond('okafor', 2); add('grasp', 1); set('suspicion', v.suspicion + 1); chronicle('Dr. Okafor gave you the science of your cage: a field you live in, and the dead zones where it cannot reach. Between her physics and your lore, you begin to see how the way home might be torn open: resonance, in true silence.');},go:"hub"},{id:"c1",l:`Take the theory and keep the shard's secret close`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('knows_emf'); bond('okafor', 1); add('grasp', 1); chronicle('Dr. Okafor named your cage in the language of physics: dead zones, noise floors, the silence beyond the grid. You kept the rest to yourself.');},go:"hub"}];}};
S["youtuber"]={art:"youtuber",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You find PrismVox in a one-room apartment that has been eaten alive by its own equipment. Lights on stands. Screens within screens. A wall of cork and red string connecting photographs you do not understand to headlines you understand even less. His name is Dev. He has not slept in what looks like a presidency, and when he opens the door and sees you he makes a sound usually reserved for religious experiences.`)+SAY("dev",`It's you. It's actually you. The plaza guy, the staff, the — dude, that video, everybody thinks it's a bit, a viral marketing thing, but I ran the audio, the EM signature on that clip is INSANE, it's the same profile as the Cascadia anomalies and I KNEW it, I knew somebody real would —`)+SAY("you",`Peace. Peace, friend. Yes. I am the man with the stick.`)+P(`He pulls you inside before the neighbors can witness his joy. The room hums like a hive; every device he owns is awake, and your skin crawls, and you understand that for Dev the hum is not a cage, it is a congregation. He lives inside the very thing that strangles you, and he loves it.`)+SAY("dev",`Okay so here's the thing, here's the THING. You do one real spell, on camera, in good light, and we don't drop it for free, we build it, we tease it, I've got forty thousand subs who would lose their minds. We could fund you for a year. You'd never busk again. We just need it on video.`)+P(`There it is. The oldest trap in this world, dressed as salvation: be seen, be paid, be real at last. And you have learned exactly what being seen costs, and exactly what your magic does in a room that hums like this one. His camera would catch another dead spark and another humiliation, or, worse, if you somehow found a way, it would catch something true and hand it to everyone with eyes.`)+P(`You look at him properly. Under the equipment and the caffeine he is just a young man who needs the world to be larger than it admits to being, and you, of all the souls alive, cannot fault him for that. He has built a shrine to the hidden true thing, and the hidden true thing has walked through his door, and it is you, and now you must be the one to tell him that the proof he has hunted for years would burn to nothing the instant his lenses found it. The hum that feeds his cameras is the very hum that gags your magic. He is asking you to be a god in the one room least able to permit it.`)+SAY("dev",`Come on. People deserve to know magic is real. I deserve to be the one who proved it. That's not even a bad reason, is it?`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Refuse the camera, but take his help in the shadows`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;bond('dev', 1); set('cash', v.cash + 40); add('grasp', 1); chronicle('Dev believed you instantly, which was its own danger. You took his money and his maps of the dead zones, and you kept the camera dark.');},go:"hub"},{id:"c1",l:`Give him one careful demonstration for the funding and the reach`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;bond('dev', 1); set('cash', v.cash + 80); set('suspicion', v.suspicion + 3); flag('went_viral'); chronicle('You let Dev film you. The money was real. So was the spike of every eye in the city turning, slowly, toward the man who might be magic.');},go:"hub"}];}};


/* ---- manifest ---- */
// Dead Air — weft game definition (manifest).
// A mage from a high-fantasy world is torn through a rift into contemporary
// Portland, where his magic is smothered by electromagnetic fields: it works
// only in true dead zones (deep forest, dead buildings, blackouts). Witty,
// melancholic fish-out-of-water; pure narrative + stats + checks + inventory.
const __GAME_DEF = {
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


/* ---- bootstrap ---- */
var __THEME = {"--bg":"#0a0e13","--bg2":"#121a24","--panel":"#0f161f","--ink":"#d6dee7","--dim":"#7b8794","--accent":"#5fd6c0","--accent2":"#2f7d74","--good":"#6bbf9a","--bad":"#d0635a","--cool":"#6f9fc0","--line":"#1f2a34"};
var __game = createGame(__GAME_DEF, { scenes: scenes, enemies: __GAME_DEF.enemies || {}, storage: localStorageAdapter() });
var __jump = new URLSearchParams(location.search).get("scene");
if (__jump && scenes[__jump]) { __game.start(Date.now()); __game.goto(__jump); } else __game.resume(Date.now());
mount(__game, { root: document.getElementById("game"), assetPath: "assets/", theme: __THEME, home: (typeof window !== "undefined" && window.__WEFT_HOME) || null });
window.__weft = __game;
})();
