// Scene DSL compiler.  games/<id>/scenes/*.dsl  ->  games/<id>/build/scenes.js
//
// DSL (one file may hold many scenes):
//   --- sceneId                 begin a scene ("--- id [raw]" = verbatim JS body)
//   art: name                   attributes (until first prose/choice line):
//   combat: enemyId             a combat scene; requires win:/lose:
//   win: sceneId / lose: sceneId
//   ending: true                marks a terminal scene (for audit + autoplay)
//   <prose>                     blank-line-separated paragraphs; ${expr} interpolates
//   !! text                     system box        ~~~  divider        :: <html> raw line
//   [[if expr]] / [[else]] / [[end]]   conditional prose
//   * Label -> targetScene      a choice; indented attribute lines follow:
//       req: expr | locked-hint        do: statements
//       hide: expr                     go: expr   (dynamic target)
//
// Expressions/statements run in the authoring context ($): G, v, P, SYS, has,
// give, add, set, flag, check, bond, learn, equip, note, rand … (see CONTEXT_KEYS).
//
// Validation: every target resolves; combat scenes name a real enemy; starting
// and used abilities are declared techniques; and any variable that is *read*
// (v.x / get('x')) but never *written or declared* is a fatal typo.

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { CONTEXT_KEYS } from "../src/context.js";

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
const PRELUDE = `const {${CONTEXT_KEYS.join(",")}}=$;`;
const fn = (body) => `($)=>{${PRELUDE}${body}}`;

function compileBody(lines, file, id) {
  const parts = [], stack = [parts];
  let para = [];
  const top = () => stack[stack.length - 1];
  const flush = () => { if (para.length) { top().push("P(`" + esc(para.join(" ")) + "`)"); para = []; } };
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "") { flush(); continue; }
    let m;
    if ((m = t.match(/^\[\[if (.+)\]\]$/))) { flush(); const n = { cond: m[1], then: [], els: null }; top().push(n); stack.push(n.then); }
    else if (t === "[[else]]") { flush(); stack.pop(); const n = top()[top().length - 1]; if (!n || !n.cond) throw new Error(`${file}:${id}: [[else]] without [[if]]`); n.els = []; stack.push(n.els); }
    else if (t === "[[end]]") { flush(); stack.pop(); if (!stack.length) throw new Error(`${file}:${id}: unbalanced [[end]]`); }
    else if (t.startsWith("!! ")) { flush(); top().push("SYS(`" + esc(t.slice(3)) + "`)"); }
    else if (t === "~~~") { flush(); top().push("DIV"); }
    else if (t.startsWith(":: ")) { flush(); top().push("`" + esc(t.slice(3)) + "`"); }
    else if ((m = t.match(/^@([\w$]+):\s?(.*)$/))) { flush(); top().push("SAY(" + JSON.stringify(m[1]) + ",`" + esc(m[2]) + "`)"); }
    else para.push(t);
  }
  flush();
  if (stack.length !== 1) throw new Error(`${file}:${id}: unclosed [[if]]`);
  const emit = (arr) => arr.length
    ? arr.map((n) => typeof n === "string" ? n : `((${n.cond})?(${emit(n.then)}):(${n.els ? emit(n.els) : '""'}))`).join("+")
    : '""';
  return emit(parts);
}

function compileScene(sc, file, links, combats) {
  if (sc.raw) return sc.body.join("\n");
  const a = sc.attrs, props = [];
  if (a.art) props.push(`art:"${a.art}"`);
  if (a.ending === "true") props.push("ending:true");
  if (a.combat) {
    if (!a.win || !a.lose) throw new Error(`${file}:${sc.id}: combat scene needs win: and lose:`);
    props.push(`combat:"${a.combat}",win:"${a.win}",lose:"${a.lose}"`);
    combats.push({ id: sc.id, enemy: a.combat });
    links.push({ id: sc.id, t: a.win, f: file }, { id: sc.id, t: a.lose, f: file });
  }
  props.push(`t:${fn("return " + compileBody(sc.body, file, sc.id) + ";")}`);
  if (sc.choices.length) {
    const cs = sc.choices.map((c, i) => {
      const p = [`id:"c${i}"`, "l:`" + esc(c.label) + "`"];
      if (c.req) { const i = c.req.indexOf(" | "); const expr = (i >= 0 ? c.req.slice(0, i) : c.req).trim(); const rq = i >= 0 ? c.req.slice(i + 3).trim() : ""; p.push(`req:${fn("return (" + expr + ");")}`); if (rq) p.push(`rq:${JSON.stringify(rq)}`); }
      if (c.hide) p.push(`hide:${fn("return (" + c.hide + ");")}`);
      if (c.do) p.push(`do:${fn(c.do + ";")}`);
      if (c.goExpr) p.push(`go:${fn("return (" + c.goExpr + ");")}`);
      else if (c.target) { p.push(`go:"${c.target}"`); links.push({ id: sc.id, t: c.target, f: file }); }
      else throw new Error(`${file}:${sc.id}: choice "${c.label}" has no target`);
      return "{" + p.join(",") + "}";
    });
    props.push(`c:${fn("return [" + cs.join(",") + "];")}`);
  } else if (!a.combat && a.ending !== "true") {
    throw new Error(`${file}:${sc.id}: non-combat, non-ending scene has no choices (dead end)`);
  }
  return `S[${JSON.stringify(sc.id)}]={${props.join(",")}};`;
}

function parseFile(text, file) {
  const scenes = [];
  let cur = null, inChoices = false;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim(); let m;
    if ((m = t.match(/^--- (\w+)( \[raw\])?$/))) { cur = { id: m[1], raw: !!m[2], attrs: {}, body: [], choices: [], inAttrs: true }; scenes.push(cur); inChoices = false; continue; }
    if (!cur) { if (t && !t.startsWith("#")) throw new Error(`${file}: content before first scene: ${t}`); continue; }
    if (cur.inAttrs && (m = t.match(/^(art|combat|win|lose|ending):\s*(\S+)$/))) { cur.attrs[m[1]] = m[2]; continue; }
    if (cur.inAttrs && /^brief:\s*/.test(t)) continue; // art-production metadata (used by tools/art.mjs), not prose
    if (cur.inAttrs && (m = t.match(/^cast:\s*(.+)$/))) { cur.castRefs = m[1].split(",").map((s) => s.trim()).filter(Boolean); continue; } // scene's on-screen characters (art references)
    if (cur.inAttrs && /^ref:\s*/.test(t)) continue; // art-generation conditioning hint (used by tools/art.mjs), not prose
    cur.inAttrs = false;
    if (cur.raw) { cur.body.push(raw); continue; }
    if ((m = t.match(/^\* (.+?)(?:\s*->\s*(\w+))?$/))) { cur.choices.push({ label: m[1], target: m[2] || null }); inChoices = true; continue; }
    if (inChoices && (m = t.match(/^(req|do|hide|go):\s*(.+)$/))) { const c = cur.choices[cur.choices.length - 1]; if (m[1] === "go") c.goExpr = m[2]; else c[m[1]] = m[2]; continue; }
    if (inChoices && t !== "") throw new Error(`${file}:${cur.id}: prose after choices: ${t}`);
    if (!inChoices) cur.body.push(raw);
  }
  return scenes;
}

export async function compileGame(gameDir) {
  const def = (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default;
  const srcDir = join(gameDir, "scenes");
  const files = (await readdir(srcDir).catch(() => [])).filter((f) => f.endsWith(".dsl"));
  if (!files.length) throw new Error("no .dsl files in " + srcDir);

  const ids = new Set(), links = [], combats = [], chunks = [], sceneCasts = [];
  for (const f of files.sort()) {
    const scenes = parseFile(await readFile(join(srcDir, f), "utf8"), f);
    for (const sc of scenes) {
      if (ids.has(sc.id)) throw new Error(`duplicate scene id: ${sc.id} (${f})`);
      ids.add(sc.id);
      if (sc.castRefs) sceneCasts.push({ id: sc.id, refs: sc.castRefs, f });
      chunks.push(compileScene(sc, f, links, combats));
    }
  }

  const errors = [];
  // 1. link integrity
  for (const { id, t, f } of links) if (!ids.has(t)) errors.push(`${f}: ${id} -> ${t} (unknown scene)`);
  if (!ids.has(def.start)) errors.push(`manifest start "${def.start}" is not a scene`);
  // 2. combat enemy references
  const enemies = def.enemies || {};
  for (const { id, enemy } of combats) if (!enemies[enemy]) errors.push(`${id}: combat enemy "${enemy}" not in def.enemies`);
  // 3. abilities: starting + every combat technique used must be declared
  const techs = def.systems?.combat?.techniques || {};
  for (const a of (Array.isArray(def.state?.abilities) ? def.state.abilities : Object.keys(def.state?.abilities || {})))
    if (def.systems?.combat && !techs[a]) errors.push(`starting ability "${a}" is not a declared combat technique`);
  // 4. variable typo guard: every var READ must be WRITTEN or declared somewhere
  const blob = chunks.join("\n");
  const writes = new Set(Object.keys(def.state?.vars || {}));
  for (const m of blob.matchAll(/\b(?:flag|set)\(\s*["'`]([\w$]+)["'`]/g)) writes.add(m[1]);
  const reads = new Set();
  for (const m of blob.matchAll(/\bv\.([\w$]+)/g)) reads.add(m[1]);
  for (const m of blob.matchAll(/\bget\(\s*["'`]([\w$]+)["'`]/g)) reads.add(m[1]);
  for (const r of reads) if (!writes.has(r)) errors.push(`variable "v.${r}" is read but never written or declared (typo?)`);
  // 5. dialogue speakers: every `@id:` line must name a declared character.
  const castIds = new Set(Object.keys(def.cast || {}));
  for (const m of blob.matchAll(/\bSAY\(\s*["']([\w$]+)["']/g))
    if (!castIds.has(m[1])) errors.push(`speaker "@${m[1]}" is not a declared character (add it to def.cast)`);
  // 6. scene cast (art references): every `cast:` id must be a declared character.
  for (const { id, refs, f } of sceneCasts) for (const r of refs)
    if (!castIds.has(r)) errors.push(`${f}: ${id} cast lists "${r}" which is not in def.cast`);

  if (errors.length) { const e = new Error("compile failed:\n  " + errors.join("\n  ")); e.errors = errors; throw e; }

  const out = `// generated by weft compile — do not edit\nexport const scenes = {};\nconst S = scenes;\n${chunks.join("\n")}\n`;
  await mkdir(join(gameDir, "build"), { recursive: true });
  await writeFile(join(gameDir, "build", "scenes.js"), out);
  return { scenes: ids.size, links: links.length, combats: combats.length, file: join(gameDir, "build", "scenes.js") };
}
