// Shared scene read/write for the editor. Parses a .dsl file into structured
// scenes (attrs + verbatim body + choices), serializes a scene back to canonical
// DSL, and replaces/inserts a single scene block inside a file's text without
// disturbing the other scenes. The grammar mirrors tools/compile.mjs.
//
// Body is kept VERBATIM (prose, !!/::/~~~ lines, [[if]] conditionals) so the form
// editor can present attrs + choices as fields while leaving prose as free text.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const ATTR = /^(art|brief|cast|ref|combat|win|lose|ending):\s*(.+)$/;
const SCENE = /^--- (\w+)( \[raw\])?$/;
const CHOICE = /^\* (.+?)(?:\s*->\s*(\w+))?$/;
const CHOICE_ATTR = /^(req|do|hide|go):\s*(.+)$/;

// Parse one file's text into { preamble, scenes:[{id,raw,attrs,body,choices,startLine,endLine}] }.
export function parseFile(text) {
  const lines = text.split(/\r?\n/);
  const scenes = [];
  let cur = null, inAttrs = false, inChoices = false, body = [], preamble = [];
  const close = (endLine) => { if (cur) { cur.body = body.join("\n").replace(/\s+$/, ""); cur.endLine = endLine; scenes.push(cur); } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], t = line.trim();
    let m;
    if ((m = t.match(SCENE))) {
      close(i - 1);
      cur = { id: m[1], raw: !!m[2], attrs: {}, body: "", choices: [], startLine: i, endLine: i };
      inAttrs = true; inChoices = false; body = [];
      continue;
    }
    if (!cur) { preamble.push(line); continue; }
    if (cur.raw) { body.push(line); continue; }
    if (inAttrs && (m = t.match(ATTR))) { cur.attrs[m[1]] = m[2].trim(); continue; }
    inAttrs = false;
    if ((m = t.match(CHOICE))) { cur.choices.push({ label: m[1], target: m[2] || null }); inChoices = true; continue; }
    if (inChoices && (m = t.match(CHOICE_ATTR))) { cur.choices[cur.choices.length - 1][m[1]] = m[2].trim(); continue; }
    if (!inChoices) body.push(line);
    // (a non-blank line after choices is a DSL error; the compiler will catch it.)
  }
  close(lines.length - 1);
  return { preamble: preamble.join("\n"), scenes };
}

const ATTR_ORDER = ["art", "brief", "cast", "ref", "combat", "win", "lose", "ending"];

// Serialize a structured scene back to canonical DSL text (no trailing newline).
export function serializeScene(s) {
  if (s.raw) return `--- ${s.id} [raw]\n${(s.body || "").replace(/\s+$/, "")}`;
  const out = [`--- ${s.id}`];
  for (const k of ATTR_ORDER) if (s.attrs && s.attrs[k] != null && s.attrs[k] !== "") out.push(`${k}: ${s.attrs[k]}`);
  const body = (s.body || "").replace(/\s+$/, "");
  if (body) { out.push(""); out.push(body); }
  if (s.choices && s.choices.length) {
    out.push("");
    for (const c of s.choices) {
      const tgt = !c.go && c.target ? ` -> ${c.target}` : "";
      out.push(`* ${c.label}${tgt}`);
      for (const k of ["req", "do", "hide", "go"]) if (c[k] != null && c[k] !== "") out.push(`  ${k}: ${c[k]}`);
    }
  }
  return out.join("\n");
}

// Replace scene `id`'s block in `text` with `block` (verbatim, no trailing NL).
// If the scene is absent, append it. Returns the new file text.
export function replaceScene(text, id, block) {
  const { scenes } = parseFile(text);
  const lines = text.split(/\r?\n/);
  const sc = scenes.find((s) => s.id === id);
  if (!sc) {
    const trimmed = text.replace(/\s+$/, "");
    return (trimmed ? trimmed + "\n\n" : "") + block + "\n";
  }
  const before = lines.slice(0, sc.startLine);
  const after = lines.slice(sc.endLine + 1);
  return [...before, ...block.split("\n"), ...after].join("\n");
}

// Index every scene across a game's scenes/*.dsl: id -> { file, scene }.
export async function indexScenes(gameDir) {
  const dir = join(gameDir, "scenes");
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".dsl")).sort();
  const index = {}, byFile = {};
  for (const f of files) {
    const { scenes } = parseFile(await readFile(join(dir, f), "utf8"));
    byFile[f] = scenes.map((s) => s.id);
    for (const s of scenes) index[s.id] = { file: f, scene: s };
  }
  return { files, index, byFile };
}

// Build the branch graph straight from the DSL (no compile needed): nodes with
// metadata + static edges (choice targets, combat win/lose) + manifest auditEdges.
export async function buildGraph(gameDir, def) {
  const { index } = await indexScenes(gameDir);
  const auditEdges = (def && def.auditEdges) || {};
  const start = (def && def.start) || "start";
  const nodes = [], edges = [];
  for (const [id, { file, scene }] of Object.entries(index)) {
    const dyn = scene.choices.some((c) => c.go);
    nodes.push({
      id, file,
      ending: scene.attrs.ending === "true",
      combat: !!scene.attrs.combat,
      art: scene.attrs.art || null,
      choices: scene.choices.length,
      dynamic: dyn,
      isStart: id === start,
    });
    for (const c of scene.choices) if (c.target) edges.push({ from: id, to: c.target, kind: "choice", label: c.label });
    if (scene.attrs.combat) { for (const k of ["win", "lose"]) if (scene.attrs[k]) edges.push({ from: id, to: scene.attrs[k], kind: k }); }
    for (const t of (auditEdges[id] || [])) edges.push({ from: id, to: t, kind: "dynamic" });
  }
  // reachability from start
  const adj = {};
  for (const e of edges) (adj[e.from] ??= []).push(e.to);
  const seen = new Set([start]), q = [start];
  while (q.length) { const n = q.pop(); for (const t of (adj[n] || [])) if (index[t] && !seen.has(t)) { seen.add(t); q.push(t); } }
  for (const n of nodes) n.reachable = seen.has(n.id);
  const ids = new Set(nodes.map((n) => n.id));
  const dangling = edges.filter((e) => !ids.has(e.to)).map((e) => `${e.from} -> ${e.to}`);
  return { nodes, edges, start, dangling };
}
