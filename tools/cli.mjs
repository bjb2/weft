#!/usr/bin/env node
// weft CLI: build | audit | test | play | new | all  <gameDir>
import { buildGame } from "./build.mjs";
import { auditGame } from "./audit.mjs";
import { testGame } from "./test.mjs";
import { loadGame } from "./load.mjs";
import { scaffold } from "./scaffold.mjs";
import { lintGame } from "./prose-lint.mjs";
import { artGame } from "./art.mjs";
import { startEditor } from "./editor.mjs";
import { buildPortal } from "./portal.mjs";
import { loadEnv } from "./env.mjs";
import { fileURLToPath } from "node:url";
import { createGame } from "../src/engine.js";
import { toText } from "../src/markup.js";
import { join, resolve, relative, dirname } from "node:path";
import readline from "node:readline";
import { readdir } from "node:fs/promises";

const [cmd, ...rest] = process.argv.slice(2);
const dir = rest[0] ? resolve(rest[0]) : null;
const need = () => { if (!dir) die("usage: weft " + cmd + " <gameDir>"); };
const die = (m) => { console.error(m); process.exit(1); };
const ok = (m) => console.log(m);

// Load .env so users can drop in OPENROUTER_API_KEY (game dir takes precedence).
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
// Most-specific file wins: a game's own .env overrides the repo-root .env, and a
// real shell environment variable overrides both (loadEnv never clobbers an
// already-set value, so the first .env loaded takes precedence).
if (dir) loadEnv(join(dir, ".env"));
loadEnv(join(REPO, ".env"));

async function build(gameDir) {
  const r = await buildGame(gameDir);
  ok(`compiled ${r.compiled.scenes} scenes, ${r.compiled.links} links, ${r.compiled.combats} combats`);
  ok(`art: ${r.art.slots} scene slots${r.art.casts ? ` + ${r.art.casts} character portraits` : ""} (${r.art.placeholders} placeholders), style ${r.art.style}`);
  ok(`bundled -> build/${r.bundleName}; wrote index.html`);
}

async function audit(gameDir) {
  const loaded = await loadGame(gameDir);
  const a = auditGame(loaded);
  ok(`\nAUDIT ${loaded.def.meta.id}: ${a.total} scenes, ${a.endings.length} endings`);
  const section = (label, arr) => ok(`  ${label}: ${arr.length ? "\n    " + arr.join("\n    ") : "none"}`);
  section("render errors", a.renderErrors);
  section("unknown targets", a.badTargets);
  section("unreachable from start", a.unreachable);
  const bad = a.renderErrors.length + a.badTargets.length + a.unreachable.length;
  if (bad) die(`audit failed: ${bad} problem(s)`);
  ok("  audit OK");
}

async function test(gameDir) {
  const r = await testGame(gameDir);
  ok(`\nTEST ${relative(process.cwd(), gameDir)}`);
  for (const rp of r.replays) ok(`  replay ${rp.pass ? "PASS" : "FAIL"} — ${rp.name}` + (rp.pass ? "" : ` (got ${JSON.stringify(rp.got)}, want ${JSON.stringify(rp.expect)})`));
  const f = r.fuzz;
  ok(`  fuzz: ${f.runs} runs, coverage ${f.coverage}%, softlocks ${f.softlocks}`);
  ok(`  endings: ${JSON.stringify(f.endings)}`);
  if (f.errors.length) ok(`  errors:\n    ${f.errors.slice(0, 12).join("\n    ")}`);
  if (f.never.length) ok(`  never visited: ${f.never.join(", ")}`);
  if (!r.pass) die("tests failed");
  ok("  tests OK");
}

async function play(gameDir) {
  const loaded = await loadGame(gameDir);
  const game = createGame(loaded.def, { scenes: loaded.scenes, enemies: loaded.enemies });
  game.start(rest[1] ? Number(rest[1]) : Date.now());
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));
  for (;;) {
    const v = game.view();
    console.log("\n" + "=".repeat(60));
    if (v.kind === "combat") {
      if (v.intro) console.log(toText(v.intro) + "\n");
      console.log(`[${v.enemy.name}  ${v.enemy.hp}/${v.enemy.max}]  ${toText(v.intent)}`);
      console.log(v.log.map(toText).join("\n"));
    } else if (v.kind === "scene") {
      console.log(toText(v.html));
    } else { console.log("ERROR:", v.error); break; }
    if (v.notes?.length) console.log("  " + v.notes.map((n) => "(" + n.text + ")").join("  "));
    const opts = v.kind === "combat" ? v.actions : v.choices;
    const pickable = opts.filter((o) => o.enabled !== false);
    opts.forEach((o, i) => console.log(`  ${o.enabled === false ? "x" : i + 1}. ${o.label || o.l}${o.lock ? " [" + o.lock + "]" : ""}`));
    if (v.kind === "scene" && v.ending) console.log("  (ending)");
    const ans = (await ask("> ")).trim();
    if (ans === "q") break;
    const idx = Number(ans) - 1;
    const choice = opts[idx];
    if (!choice || choice.enabled === false) { console.log("invalid"); continue; }
    try { v.kind === "combat" ? game.act(choice.id) : game.choose(choice.id); }
    catch (e) { console.log("error:", e.message); }
  }
  rl.close();
}

async function lint(gameDir, { gate = false } = {}) {
  const strict = rest.includes("--warn");
  const r = await lintGame(gameDir, { strict });
  ok(`\nLINT ${relative(process.cwd(), gameDir)} — ${r.files} files, ${r.words} words`);
  for (const w of r.warns.slice(0, 40)) ok(`  WARN  ${w}`);
  for (const e of r.errors) console.error(`  ERROR ${e}`);
  ok(`  ${r.errors.length} errors, ${r.warns.length} warnings`);
  if (r.errors.length || (strict && r.warns.length)) { if (gate || cmd === "lint") die("  prose lint failed"); }
  else ok("  prose OK");
}

async function art(gameDir) {
  const portraitsOnly = rest.includes("--portraits");
  const generate = portraitsOnly || rest.includes("--generate") || rest.includes("-g");
  const only = rest.slice(1).filter((a) => !a.startsWith("-")); // positional slot/portrait names after gameDir
  if (generate && !process.env.OPENROUTER_API_KEY) ok("  (no OPENROUTER_API_KEY in env/.env — writing SVG placeholders + prompts only)");
  const r = await artGame(gameDir, { generate, only: only.length ? only : null, portraitsOnly });
  ok(`\nART ${relative(process.cwd(), gameDir)} — style ${r.style}`);
  ok(`  ${r.slots} scene slots: ${r.names.join(", ")}${r.casts ? ` (+ ${r.casts} character portraits)` : ""}`);
  ok(`  wrote art/prompts.json + ${r.placeholders} SVG placeholder(s) in assets/`);
  if (generate) {
    ok(`  phase: ${portraitsOnly ? "character portraits only" : "scenes (conditioned on character portraits)"}`);
    if (only.length) ok(`  targeting: ${only.join(", ")}`);
    ok(`  generated ${r.generated}/${r.attempted} PNG(s) via OpenRouter`);
    if (r.failures.length) { ok("  failures:"); for (const f of r.failures.slice(0, 12)) ok(`    ${f.name}: ${f.reason}`); }
    if (r.attempted > 0 && r.generated === 0) die("  no images were generated — check OPENROUTER_API_KEY (https://openrouter.ai/keys), model access, and credits");
  }
}

async function edit(gameDir) {
  const portArg = rest.find((a) => /^--port=\d+$/.test(a));
  const port = portArg ? Number(portArg.split("=")[1]) : 4317;
  try { await build(gameDir); } catch (e) { ok("(initial build had errors — open the editor to fix)\n  " + (e.errors ? e.errors.join("\n  ") : e.message)); }
  const { port: p } = await startEditor(gameDir, port);
  ok(`\nweft editor running:  http://localhost:${p}/`);
  ok(`  branch graph + scene editor for ${relative(process.cwd(), gameDir)}`);
  ok(`  live preview:        http://localhost:${p}/game/index.html`);
  ok(`  Ctrl-C to stop.`);
}

// Whole-repo: write the landing page that links to every game's build.
async function portal() {
  const r = await buildPortal(REPO);
  ok(`\nPORTAL ${relative(process.cwd(), REPO) || "."}`);
  ok(`  ${r.games} game(s): ${r.ids.join(", ")}`);
  if (r.unbuilt.length) ok(`  unbuilt (shown disabled): ${r.unbuilt.join(", ")} — run: weft build games/<id> (or weft site)`);
  ok(`  wrote index.html + .nojekyll (ready for GitHub Pages)`);
}

// Build every game under games/, then (re)generate the portal. The deploy step.
async function site() {
  const gamesDir = join(REPO, "games");
  const ids = (await readdir(gamesDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => d.name).sort();
  ok(`\nSITE — building ${ids.length} game(s)`);
  let made = 0;
  for (const id of ids) {
    try { const r = await buildGame(join(gamesDir, id)); ok(`  built ${id} (${r.compiled.scenes} scenes)`); made++; }
    catch (e) { ok(`  SKIP ${id}: ${e.errors ? e.errors.join("; ") : e.message}`); }
  }
  ok(`  built ${made}/${ids.length}`);
  await portal();
}

(async () => {
  switch (cmd) {
    case "build": need(); await build(dir); break;
    case "audit": need(); await build(dir); await audit(dir); break;
    case "test": need(); await build(dir); await test(dir); break;
    case "lint": need(); await lint(dir); break;
    case "art": need(); await art(dir); break;
    case "play": need(); await build(dir); await play(dir); break;
    case "edit": need(); await edit(dir); break;
    case "all": need(); await build(dir); await audit(dir); await lint(dir, { gate: true }); await test(dir); break;
    case "new": {
      need(); const id = rest[1] || dir.split(/[\\/]/).pop(); const title = rest[2] || id;
      await scaffold(dir, id, title); ok(`scaffolded ${id} at ${relative(process.cwd(), dir)}`);
      await build(dir); await audit(dir); await test(dir); break;
    }
    case "portal": await portal(); break;
    case "site": await site(); break;
    default: die("usage: weft <build|audit|test|lint|art|play|edit|all|new> <gameDir> | <portal|site>  [--warn|--generate|--port=N]");
  }
})().catch((e) => die(e.stack || e.message));