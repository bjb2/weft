#!/usr/bin/env node
// weft CLI: build | audit | test | play | new | all  <gameDir>
import { compileGame } from "./compile.mjs";
import { bundleGame } from "./bundle.mjs";
import { auditGame } from "./audit.mjs";
import { testGame } from "./test.mjs";
import { loadGame } from "./load.mjs";
import { scaffold } from "./scaffold.mjs";
import { lintGame } from "./prose-lint.mjs";
import { artGame } from "./art.mjs";
import { loadEnv } from "./env.mjs";
import { resolveStyle } from "../src/art/styles.js";
import { fileURLToPath } from "node:url";
import { createGame } from "../src/engine.js";
import { toText } from "../src/markup.js";
import { writeFile } from "node:fs/promises";
import { join, resolve, relative, dirname } from "node:path";
import readline from "node:readline";

const [cmd, ...rest] = process.argv.slice(2);
const dir = rest[0] ? resolve(rest[0]) : null;
const need = () => { if (!dir) die("usage: weft " + cmd + " <gameDir>"); };
const die = (m) => { console.error(m); process.exit(1); };
const ok = (m) => console.log(m);

// Load .env (project root, then game dir) so users can drop in OPENROUTER_API_KEY.
const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnv(join(REPO, ".env"));
if (dir) loadEnv(join(dir, ".env"));

async function writeIndex(gameDir, def, bundleName, theme) {
  const bg = (theme && theme["--bg"]) || "#0a0d14";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${bg}">
<title>${def.meta.title}</title>
<meta name="description" content="${(def.meta.subtitle || "").replace(/"/g, "&quot;")}">
<style>html,body{margin:0;background:${bg}}</style></head>
<body><div id="game"></div>
<!-- Self-contained bundle (works from file:// and any static host). The hash in
     the filename busts caches on deploy without a query string. -->
<script src="build/${bundleName}"></script>
</body></html>
`;
  await writeFile(join(gameDir, "index.html"), html);
}

async function build(gameDir) {
  const r = await compileGame(gameDir);
  ok(`compiled ${r.scenes} scenes, ${r.links} links, ${r.combats} combats`);
  const def = (await loadGame(gameDir)).def;
  // Art style sets both the illustration look and the UI palette; explicit
  // def.meta.theme overrides the preset palette.
  const style = resolveStyle(def.meta && def.meta.art);
  const theme = { ...(style ? style.palette : {}), ...((def.meta && def.meta.theme) || {}) };
  const art = await artGame(gameDir, { generate: false }); // ensure styled SVG placeholders + prompts.json
  const srcDir = resolve(gameDir, "../../src");
  const bundleName = await bundleGame(gameDir, srcDir, { theme });
  await writeIndex(gameDir, def, bundleName, theme);
  ok(`art: ${art.slots} slots (${art.placeholders} placeholders), style ${art.style}`);
  ok(`bundled -> build/${bundleName}; wrote index.html`);
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
  const generate = rest.includes("--generate") || rest.includes("-g");
  if (generate && !process.env.OPENROUTER_API_KEY) ok("  (no OPENROUTER_API_KEY in env/.env — writing SVG placeholders + prompts only)");
  const r = await artGame(gameDir, { generate });
  ok(`\nART ${relative(process.cwd(), gameDir)} — style ${r.style}`);
  ok(`  ${r.slots} art slots: ${r.names.join(", ")}`);
  ok(`  wrote art/prompts.json + ${r.placeholders} SVG placeholder(s) in assets/`);
  if (generate && process.env.OPENROUTER_API_KEY) ok("  generated PNGs via OpenRouter");
}

(async () => {
  switch (cmd) {
    case "build": need(); await build(dir); break;
    case "audit": need(); await build(dir); await audit(dir); break;
    case "test": need(); await build(dir); await test(dir); break;
    case "lint": need(); await lint(dir); break;
    case "art": need(); await art(dir); break;
    case "play": need(); await build(dir); await play(dir); break;
    case "all": need(); await build(dir); await audit(dir); await lint(dir, { gate: true }); await test(dir); break;
    case "new": {
      need(); const id = rest[1] || dir.split(/[\\/]/).pop(); const title = rest[2] || id;
      await scaffold(dir, id, title); ok(`scaffolded ${id} at ${relative(process.cwd(), dir)}`);
      await build(dir); await audit(dir); await test(dir); break;
    }
    default: die("usage: weft <build|audit|test|lint|art|play|all|new> <gameDir> [--warn|--generate]");
  }
})().catch((e) => die(e.stack || e.message));