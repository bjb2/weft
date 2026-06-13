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
.weft .say .pfp{flex:0 0 auto;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--cc,var(--accent2));color:var(--bg);display:flex;align-items:center;justify-content:center;font:600 16px/1 Georgia,serif;border:1px solid var(--line)}
.weft .say .pfp img{width:100%;height:100%;object-fit:cover;display:block}
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
    if (v.scene === game.def.start && v.kind === "scene") { footEl.innerHTML = ""; return; }
    footEl.innerHTML = `<button id="wf-rst">\u21BA restart</button>`;
    footEl.querySelector("#wf-rst").onclick = () => {
      footEl.innerHTML = `<span class="small">Erase progress and restart?</span> <button class="danger" id="wf-y">Yes</button> <button id="wf-n">No</button>`;
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
S["alamo"]={art:"alamo",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The Alamo sits in the middle of downtown being extremely serious about itself. Tour guides whisper. A plaque asks you to remember it. You mostly want to remember the wifi password, which a sign says belongs to the gift shop and is definitely not for loitering ghosts from the internet.`)+P(`Brett salutes the building for reasons he cannot explain. Kit is already scanning for bars.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Siphon the gift-shop wifi like the true patriot you are`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;check('vibes', 12) ? flag('got_wifi') : note('A captcha demands you select every crosswalk. You are a literal JPEG. You cannot.', 'loss');},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (v.got_wifi ? 'alamo_win' : 'alamo_bust');}},{id:"c1",l:`Leave the poor shrine alone`,go:"riverwalk"}];}};
S["alamo_win"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The password is taped under the register. It is the word "Remember" followed by four exclamation points, which is the most San Antonio thing that has ever happened. Your phone drinks deep. Bars bloom across the cracked glass like spring.`)+P(`For one shining moment you can feel the feed again, distant and warm, calling you home.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Strut back to the river, fully charged`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;gain('battery', 8); chronicle('Tapped the Alamo gift-shop wifi. Password was Remember!!!! Bars restored.');},go:"riverwalk"}];}};
S["alamo_bust"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`A volunteer docent in a period costume materializes with the silent fury of a man who has caught teenagers vaping behind the cannon. He is already reaching for a radio. Brett has frozen mid-salute. This can go two ways, and one of them has handcuffs.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Hop the fence and sprint across the plaza screaming`,go:"end_arrested"},{id:"c1",l:`Apologize in crisp 4K and back away slowly`,go:"riverwalk"}];}};
S["barge"]={art:"barge",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`You board a river-barge tour by simply walking on and acting like you belong, which is ninety percent of everything. The captain narrates local history nobody is listening to. Forty tourists hold up forty phones. This is not a boat. This is a stage, and a stage is the only church you have ever prayed in.`)+P(`A rival catches your eye: a smug crypto-bro avatar named ChadGPT, also clearly isekai'd, also clearly hungry for the algorithm. He smirks. The barge goes quiet. It is a meme-off, and the river itself is watching.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Post your single most cursed meme and let God sort it out`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;check('clout', 12) ? flag('went_viral') : flag('ratiod');},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (v.went_viral ? 'barge_win' : 'barge_ratiod');}},{id:"c1",l:`Quietly get off the boat at the next stop`,go:"riverwalk"}];}};
S["barge_win"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`Your meme lands like a meteor. The barge erupts. Strangers repost you before they finish laughing. ChadGPT bursts into a small cloud of NFTs and is gone. A blue checkmark literally falls from the sky, bonks you on the head, and clips to your collar with a satisfying chime.`)+((v.went_viral)?(P(`You are trending in a forty-foot radius. It feels like home, which is exactly the problem.`)):(""));},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Take the checkmark and get off the boat a legend`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;give('checkmark'); add('clout', 1); chronicle('Won the barge meme-off, vaporized ChadGPT, got verified. The system worked.');},go:"riverwalk"},{id:"c1",l:`Cash the moment in immediately with one extremely problematic post`,go:"end_canceled"}];}};
S["barge_ratiod"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`Your meme does not land. It does worse than not land. It gets a community note, then a thread, then a single reply with eight hundred thousand likes that just says "who is going to tell him." ChadGPT is already selling a course about your downfall. The barge has turned on you. The river smells like consequences.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Double down with a take so bad it loops back to a war crime`,go:"end_canceled"},{id:"c1",l:`Delete everything, jump ship, go touch grass`,go:"riverwalk"}];}};
S["end_portal"]={art:"portal",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return SYS(`ENDING: BACK ONLINE`)+P(`The seam tears wide and the feed pours out, warm and infinite and stupid and perfect. You feel yourself flatten into glorious two dimensions again. Kit's tail pixelates first. Brett gives one last salute, this time to the whole city. Sir Woof uploads the final episode of his podcast, titled simply "We Were Always Going Home."`)+P(`You snap back into the scroll between a recipe video and a man falling off a ladder. Eleven million people see your face the next morning and feel, briefly, that everything is fine. You never tell them about the tacos. Some things are yours.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Scroll on forever`,go:"start"}];}};
S["end_canceled"]={art:"canceled",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return SYS(`ENDING: CANCELED`)+P(`It happens in the time it takes to refresh. The discourse comes for you like weather. By sunset there are think-pieces. By midnight there is a fifty-minute video essay with chapter markers.`)+((v.ratiod)?(P(`ChadGPT narrates the whole arc with visible joy.`)):(""))+P(`The city does not arrest you and does not hire you. It simply stops making eye contact. You are still physical, still stuck, and now radioactive. The crew quietly unfollows you and splits a cab. Somewhere a brand sends thoughts and prayers, then deletes them for engagement reasons.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Log off in shame`,go:"start"}];}};
S["end_arrested"]={art:"arrested",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return SYS(`ENDING: ARRESTED`)+P(`The cuffs are real and surprisingly cold. The deputy spends a long time trying to spell your username in the incident report and eventually just writes "the blue one." Booking has no category for what you are. The fingerprint scanner returns an error. The mugshot, however, is incredible, and leaks within the hour.`)+P(`You get one phone call. You spend it doomscrolling. Brett is in the next cell teaching the pigeon to bail him out. The feed feels very far away, on the other side of bars that are, for once, not the wifi kind.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Await your arraignment`,go:"start"}];}};
S["end_job"]={art:"job",ending:true,t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return SYS(`ENDING: GAINFULLY EMPLOYED`)+P(`The apron fits. That is the horror of it. They give you a visor and a name tag and a schedule, and the schedule has your real name on it, which you did not know you had. You learn the register. You learn the fryer. You learn that "spicy ketchup is by the napkins" until it lives in your dreams.`)+P(`Months pass. You stop checking for the portal. You get pretty good at the lunch rush. One day a tourist holds up a phone to film you and you flinch toward it out of pure muscle memory, then ring up their order instead. The crew visits sometimes. You give them free taquitos. Out here you age, and out here, it turns out, you also clock in.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Take out the trash. The non-glowing kind`,go:"start"}];}};
S["whataburger"]={art:"whataburger",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The Whataburger glows orange and white like a beacon for the hungry and the lost, which currently is all of you. Inside, the air smells like salvation and seasoned fries. A help-wanted sign hangs in the window with the quiet menace of a job.`)+P(`The cashier has the thousand-yard stare of someone who closes on weekends. She has seen everything. She is about to see four cartoons try to order.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Sweet-talk her into a free order of taquitos`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;check('rizz', 12) ? give('tacos') : note('She has met every kind of guy. You are merely the newest kind.', 'loss');},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (has('tacos') ? 'taco_win' : 'whataburger');}},{id:"c1",l:`Put on the apron. Get a real job. Become a person.`,go:"end_job"},{id:"c2",l:`Leave before the manager makes eye contact`,go:"riverwalk"}];}};
S["taco_win"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`She slides a paper boat of taquitos across the counter and says "spicy ketchup is by the napkins" in the voice of a prophet. Brett weeps openly. You have eaten in the digital world before, but it was always a tasteful zero-calorie smoothie emoji. This is grease. This is real. This is breakfast tacos at 4 p.m. and nobody can stop you.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Float back to the river on a cloud of meat`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;chronicle('Conned a free order of taquitos out of a tired prophet. San Antonio provides.');},go:"riverwalk"}];}};
S["ritual"]={art:"ritual",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`Kit found the weak spot: a dumpster behind a vacant storefront where the wifi of nine different businesses overlaps into a shimmering seam. Hold up a verified phone, recite the right incantation, and the membrane between meatspace and the feed goes thin. The trash can is already glowing. It smells like ozone and old nachos.`)+P(`You raise your cracked phone like a relic. Battery ${G.pools.battery.cur} percent. Checkmark gleaming.`)+((v.got_wifi)?(P(`The Alamo wifi still hums in your bones. The signal here is strong. This might actually work.`)):(P(`There is barely any signal. You will have to carry this recitation on charm alone.`)));},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Recite the Terms of Service backward and ascend`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;check('rizz', v.got_wifi ? 10 : 14) ? flag('ascended') : note('The portal buffers. The portal always buffers.', 'loss');},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (v.ascended ? 'end_portal' : 'ritual_fizzle');}},{id:"c1",l:`Chug the energy drink and brute-force the upload by sheer caffeine`,hide:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (!has('energydrink'));},do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;take('energydrink'); chronicle('Brute-forced the portal on a blue energy drink. Skill issue: resolved.');},go:"end_portal"},{id:"c2",l:`Step back from the glowing trash can and regroup`,go:"riverwalk"}];}};
S["ritual_fizzle"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The portal flickers, shows a spinning loading wheel, and then displays the worst thing a portal can display: a small grey message reading "Something went wrong. Try again later." Sir Woof howls. The seam is closing.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Dump your entire remaining battery into one desperate final upload`,req:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (G.pools.battery.cur >= 5);},rq:"your phone is at one percent and your hands are shaking",do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;spend('battery', 5);},go:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (check('clout', 12) ? 'end_portal' : 'end_canceled');}},{id:"c1",l:`Give up, walk back to the Whataburger, ask if they are still hiring`,go:"end_job"}];}};
S["start"]={art:"title",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return `<h1>${G.def?.meta?.title||''}</h1>`+P(`You were the single most reposted profile picture of the third quarter. Eleven million people woke up to your face every morning. You had a verified glow, a signature smirk, and, by design, exactly zero physical body.`)+P(`Then someone with a cracked phone and a dream zoomed in too hard, the feed hiccuped, and the four of you fell out of the scroll like loose change out of a couch.`)+P(`You land in a fountain. A real one. With water that is wet in a way no render has ever been. ${G.name}, you are in San Antonio, Texas, and the year is 2026, and a duck is judging you.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Pull your face out of the fountain`,go:"squad"}];}};
S["squad"]={t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`A pixel-cat VTuber named Kit is wringing out her tail. A bored-looking ape in a tracksuit, Brett, keeps trying to long-press a pigeon. Sir Woof, who is a dog, who is also a meme, who is also somehow wearing a tiny hat, has already started a podcast about the experience.`)+P(`The math is grim. Out here you age. Out here you can be arrested, canceled, or, worst of all, scheduled. The only way home is back through a portal, and portals run on clout, charge, and a verified account none of you currently have.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Rally the crew and lock in the quest`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('met_crew'); chronicle('The squad reconvened beside a judgmental duck. Main quest: get back online before meatspace gets us.');},go:"riverwalk"},{id:"c1",l:`Doomscroll your own trauma for a bit, THEN rally`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;flag('met_crew'); spend('battery', 2); chronicle('Spent two percent of battery doomscrolling the incident. Worth it. Probably not.');},go:"riverwalk"}];}};
S["riverwalk"]={art:"river",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`The River Walk curls below the city like a loading bar that never fills. Tourists drift past with margaritas the size of fire extinguishers. String lights buzz. Somewhere a mariachi band tunes up, sounding suspiciously like a notification.`)+((v.met_crew)?(P(`Kit checks an imaginary minimap. Brett has befriended the pigeon. Everyone is looking at you, because out of habit, you are still the main character.`)):(""))+P(`You need a plan, and the city has four bad ideas on offer.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Storm the Alamo for free gift-shop wifi`,go:"alamo"},{id:"c1",l:`Drift into a Whataburger that glows like a small orange sun`,go:"whataburger"},{id:"c2",l:`Hijack a river-barge tour and turn it into content`,go:"barge"},{id:"c3",l:`Brave the great river of cars they call I-35`,go:"i35"},{id:"c4",l:`Crack the portal back open and go home`,req:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (has('checkmark'));},rq:"the portal only opens for the verified",go:"ritual"}];}};
S["i35"]={art:"i35",t:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return P(`I-35 is not a road. It is a parking lot having an identity crisis at seventy miles an hour, except for the part where nobody is moving at all. Brake lights stretch to the curve of the Earth. A man in a stalled truck has simply begun to live there.`);},c:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return [{id:"c0",l:`Loot a stalled truck's cupholder for an energy drink`,do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;give('energydrink'); gain('battery', 4); chronicle('Looted a blue energy drink from a man who had given up on the freeway. He understood.');},go:"riverwalk"},{id:"c1",l:`Trade your vape to a stranded commuter for a phone charger`,hide:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;return (!has('vape'));},do:($)=>{const {G,v,P,SYS,DIV,B,I,SMALL,SAY,get,set,flag,add,gain,spend,has,give,take,equip,unequip,bond,learn,check,rand,randint,note,chronicle}=$;take('vape'); gain('battery', 8); chronicle('Traded the mango vape for a car charger in standstill traffic. The circle of life.');},go:"riverwalk"},{id:"c2",l:`Cross all twelve lanes on foot like an absolute legend`,go:"end_arrested"}];}};


/* ---- manifest ---- */
// PFP'd: Stuck in Meatspace — weft game definition (manifest).
// Reverse-isekai comedy: a crew of profile-picture characters get yanked out of
// the infinite scroll and dumped, fully physical, into San Antonio, Texas, 2026.
// Pure narrative + stats + checks + inventory (no combat system).
const __GAME_DEF = {
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


/* ---- bootstrap ---- */
var __THEME = {"--bg":"#0d0e1b","--bg2":"#1a1c2e","--panel":"#161827","--ink":"#c7d0e0","--dim":"#6f7aa0","--accent":"#ff5fa2","--accent2":"#c23d78","--good":"#5fd68a","--bad":"#e05f6a","--cool":"#5fd6d6","--line":"#262a44"};
var __game = createGame(__GAME_DEF, { scenes: scenes, enemies: __GAME_DEF.enemies || {}, storage: localStorageAdapter() });
var __jump = new URLSearchParams(location.search).get("scene");
if (__jump && scenes[__jump]) { __game.start(Date.now()); __game.goto(__jump); } else __game.resume(Date.now());
mount(__game, { root: document.getElementById("game"), assetPath: "assets/", theme: __THEME });
window.__weft = __game;
})();
