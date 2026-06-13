// The game state model. A state object is a plain, JSON-serializable bag built
// from the game definition's `state` block. Nothing game-specific is hardcoded
// here: stats, pools, vars, bonds, abilities, inventory and equipment all come
// from the manifest.
//
// `recompute` is the single source of truth for *derived* values. Effective
// stats = base stats + equipment modifiers; pool maxima are formulas over the
// effective stats. Every stat/equipment mutation must funnel through here so
// equipping and unequipping is always reversible and never drifts.

import { seedToState } from "./rng.js";

const clone = (o) => JSON.parse(JSON.stringify(o ?? {}));
const asMap = (x, val) =>
  Array.isArray(x) ? Object.fromEntries(x.map((k) => [k, val])) : clone(x);

export function createInitialState(def, seed) {
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
export function recompute(state, def) {
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
export function migrate(saved, def, scenes) {
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
