// Deterministic, serializable PRNG (mulberry32). The whole point: a game's
// randomness is reproducible from a seed, so playthroughs can be recorded and
// replayed as regression tests, and shared seeds reproduce a run exactly.
//
// State lives in `state.rngState` (a 32-bit integer). `rngNext` advances it and
// returns a float in [0,1). Nothing here touches globals or `Math.random`.

export function seedToState(seed) {
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

export function rngNext(state) {
  let a = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Integer in [0, n) and inclusive [lo, hi].
export const rngInt = (state, n) => Math.floor(rngNext(state) * n);
export const rngRange = (state, lo, hi) => lo + rngInt(state, hi - lo + 1);
export const rngPick = (state, arr) => arr[rngInt(state, arr.length)];
