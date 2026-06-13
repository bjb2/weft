// Headless play driver. Drives a started game with a *policy* (a function that
// picks a choice/action id from the current view) until it reaches a terminal,
// softlocks (no enabled choices), errors, or hits the step cap. This is the one
// engine consumer that the audit, fuzzer, and replay tests all share — it is why
// the whole test suite runs in Node with no browser.

function pickId(view) {
  return view.kind === "combat"
    ? view.actions.filter((a) => a.enabled).map((a) => a.id)
    : view.choices.filter((c) => c.enabled).map((c) => c.id);
}

export function autoplay(game, opts = {}) {
  const cap = opts.cap ?? 4000;
  const isTerminal = opts.terminal || ((v) => v.kind === "scene" && v.ending);
  const policy = opts.policy || ((v) => pickId(v)[0]);
  const path = [];
  for (let step = 0; step < cap; step++) {
    const v = game.view();
    path.push(game.state.scene); // scene id is correct in both scene and combat modes
    if (v.kind === "error") return { reason: "error", error: v.error, scene: game.state.scene, steps: step, path };
    if (v.kind === "scene" && isTerminal(v)) return { reason: "terminal", scene: v.scene, steps: step, path };
    const enabled = pickId(v);
    if (!enabled.length) return { reason: "softlock", scene: game.state.scene, steps: step, path };
    let id;
    try { id = policy(v, game, enabled); } catch (e) { return { reason: "policy-error", error: e.message, scene: game.state.scene, steps: step, path }; }
    if (id == null) return { reason: "policy-stop", scene: game.state.scene, steps: step, path };
    try { v.kind === "combat" ? game.act(id) : game.choose(id); }
    catch (e) { return { reason: "dispatch-error", error: e.message, choice: id, scene: game.state.scene, steps: step, path }; }
  }
  return { reason: "stepcap", scene: game.state.scene, steps: cap, path };
}

// Follow a recorded list of ids exactly (regression replay). Stops when the list
// is exhausted or a terminal/error is hit; returns where it ended up.
export function playScript(game, ids) {
  const path = [];
  for (let i = 0; i < ids.length; i++) {
    const v = game.view();
    path.push(game.state.scene);
    if (v.kind === "error") return { reason: "error", error: v.error, scene: game.state.scene, path, consumed: i };
    try { v.kind === "combat" ? game.act(ids[i]) : game.choose(ids[i]); }
    catch (e) { return { reason: "dispatch-error", error: e.message, choice: ids[i], scene: game.state.scene, path, consumed: i }; }
  }
  const v = game.view();
  return { reason: "done", scene: v.scene, ending: !!v.ending, kind: v.kind, path };
}

// A seeded random policy (so fuzz runs are reproducible).
export function randomPolicy(seed = 1) {
  let a = seed >>> 0;
  return (v, game, enabled) => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return enabled[Math.floor(r * enabled.length)];
  };
}
