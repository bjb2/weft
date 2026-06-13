// Static graph audit, headless. For every scene it runs t() and c() under a rich
// synthetic state (catching render throws), collects edges (static choice targets,
// combat win/lose, and dynamic go() evaluated under the synthetic state), then
// reports unknown targets, render errors, and scenes unreachable from start.
//
// Dynamic go() targets that depend on branch-specific state can't all be found by
// one evaluation; a manifest may declare them via def.auditEdges[sceneId] = [...]
// so reachability stays complete (the engine equivalent of a sitemap).

import { createGame } from "../src/engine.js";
import { recompute } from "../src/state.js";

export function auditGame({ def, scenes, enemies }) {
  const game = createGame(def, { scenes, enemies });
  game.start(99);
  const baseline = JSON.parse(JSON.stringify(game.state));
  // Boost the baseline so most gated content evaluates without throwing.
  const techs = def.systems?.combat?.techniques || {};
  for (const k of Object.keys(baseline.stats)) baseline.stats[k] = Math.max(baseline.stats[k], 12);
  for (const k of Object.keys(techs)) baseline.abilities[k] = true;
  for (const k of Object.keys(def.items || {})) baseline.inv[k] = (baseline.inv[k] || 0) + 1;

  const reset = (id) => {
    game.state = JSON.parse(JSON.stringify(baseline));
    game.state.scene = id; game.combat = null;
    recompute(game.state, def);
    return game.context();
  };

  const ids = Object.keys(scenes);
  const edges = {}, renderErrors = [], badTargets = [];
  for (const id of ids) {
    const sc = scenes[id], out = new Set();
    let $ = reset(id);
    try { if (sc.t) sc.t($); } catch (e) { renderErrors.push(`${id}: t() threw: ${e.message}`); }
    if (sc.combat) { out.add(sc.win); out.add(sc.lose); }
    if (sc.c) {
      try {
        for (const c of sc.c($)) {
          $ = reset(id);
          try { if (c.req) c.req($); if (c.hide) c.hide($); } catch (e) { renderErrors.push(`${id}/${c.id}: req|hide threw: ${e.message}`); }
          if (typeof c.go === "string") out.add(c.go);
          else if (typeof c.go === "function") { $ = reset(id); try { const t = c.go($); if (typeof t === "string") out.add(t); } catch (e) { renderErrors.push(`${id}/${c.id}: go() threw: ${e.message}`); } }
        }
      } catch (e) { renderErrors.push(`${id}: c() threw: ${e.message}`); }
    }
    for (const t of (def.auditEdges?.[id] || [])) out.add(t);
    edges[id] = out;
    for (const t of out) if (!scenes[t]) badTargets.push(`${id} -> ${t}`);
  }

  const seen = new Set([def.start]), q = [def.start];
  while (q.length) { const id = q.pop(); for (const t of (edges[id] || [])) if (scenes[t] && !seen.has(t)) { seen.add(t); q.push(t); } }
  const unreachable = ids.filter((i) => !seen.has(i));
  const endings = ids.filter((i) => scenes[i].ending);

  return { total: ids.length, renderErrors, badTargets, unreachable, endings, edges };
}
