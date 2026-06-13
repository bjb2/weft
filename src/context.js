// The authoring context `$` passed to every content function (scene text,
// choice req/hide/do/go). It exposes the game state plus a verb vocabulary that
// content uses to read and mutate state safely. The compiler destructures these
// keys, so a scene author can write `add('body',1)`, `flag('met_oracle')`,
// `check('mind',12)`, or read `v.met_oracle` / `G.bonds.mei` directly.
//
// CONTEXT_KEYS is the contract between the runtime and the compiler — keep them
// in sync; the compiler reads this list to build its destructuring prelude.

import { P, SYS, DIV, B, I, SMALL } from "./markup.js";
import { recompute } from "./state.js";
import { rngNext, rngInt } from "./rng.js";

export const CONTEXT_KEYS = [
  "G", "v", "P", "SYS", "DIV", "B", "I", "SMALL",
  "get", "set", "flag", "add", "gain", "spend",
  "has", "give", "take", "equip", "unequip",
  "bond", "learn", "check", "rand", "randint", "note", "chronicle",
];

export function makeContext(game) {
  const st = game.state;
  const def = game.def;
  const items = def.items || {};
  const note = (text, cls = "gain") => { st.log.push({ text, cls }); };

  return {
    G: st,
    v: st.vars,
    P, SYS, DIV, B, I, SMALL,

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
