// Continuity gate (P3). The narrative analogue of the variable-typo guard: it
// makes "you can't reference a character before you've met them — on ANY path" a
// machine-checked invariant. This is a real branching-fiction bug that's almost
// impossible to catch by hand once a book has dozens of routes.
//
// A game opts in with a top-level `entities` registry in its manifest:
//   entities: {
//     characters: {
//       suyin: { name: "Su Yin", aliases: ["the blind weaver"], first: "ch2_meet" },
//     },
//     places: { cocoon: { name: "the Cocoon House", first: "ch3_house" } },
//     lore:   { loom: { name: "the Loom" } },   // no `first` => not position-checked
//   }
// `first` is the scene that introduces the entity. The check proves that no scene
// mentioning the entity is reachable from start WITHOUT passing through `first`.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { records } from "./prose-lint.mjs";
import { loadGame } from "./load.mjs";
import { auditGame } from "./audit.mjs";

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KINDS = ["characters", "places", "lore", "factions"];
function flatten(entities) {
  const out = [];
  for (const kind of KINDS)
    for (const [id, e] of Object.entries(entities[kind] || {}))
      out.push({ id, kind, name: e.name || id, aliases: e.aliases || [], first: e.first || null });
  // also accept a flat map of entities directly under `entities`
  for (const [id, e] of Object.entries(entities)) {
    if (KINDS.includes(id)) continue;
    if (e && typeof e === "object") out.push({ id, kind: "entity", name: e.name || id, aliases: e.aliases || [], first: e.first || null });
  }
  return out;
}

// Scenes reachable from `start` along paths that never visit `block`.
function reachableWithout(edges, start, block) {
  const seen = new Set();
  if (start === block) return seen;
  seen.add(start);
  const q = [start];
  while (q.length) {
    const id = q.pop();
    for (const t of (edges[id] || [])) {
      if (t === block || seen.has(t)) continue;
      seen.add(t); q.push(t);
    }
  }
  return seen;
}

export async function continuityReport(gameDir) {
  const def = (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default;
  if (!def.entities) return { enabled: false };
  const ents = flatten(def.entities);

  // Per-scene narrative text (lowercased), via the shared prose extractor.
  const srcDir = join(gameDir, "scenes");
  const files = (await readdir(srcDir).catch(() => [])).filter((f) => f.endsWith(".dsl")).sort();
  const text = {};
  for (const f of files)
    for (const r of records(f, await readFile(join(srcDir, f), "utf8")))
      if (!r.label) text[r.scene] = (text[r.scene] || "") + " " + r.text.toLowerCase();

  const loaded = await loadGame(gameDir);
  let edges = {};
  try { edges = auditGame(loaded).edges; } catch { /* render errors surface in audit */ }

  const mentions = (e, t) =>
    [e.name, ...e.aliases].filter(Boolean).some((n) => new RegExp(`\\b${escRe(n.toLowerCase())}\\b`).test(t));

  const errors = [], warns = [];
  for (const e of ents) {
    const where = Object.keys(text).filter((id) => mentions(e, text[id]));
    if (!where.length) { warns.push(`"${e.name}" is declared but never appears in any scene`); continue; }
    if (!e.first) continue;
    if (!loaded.scenes[e.first]) { errors.push(`"${e.name}" first:"${e.first}" is not a real scene`); continue; }
    const before = reachableWithout(edges, def.start, e.first);
    for (const id of where)
      if (id !== e.first && before.has(id))
        errors.push(`"${e.name}" appears in "${id}", which is reachable before its introduction in "${e.first}"`);
  }
  return { enabled: true, entities: ents.length, errors, warns };
}
