// Portal generator: scans games/*/ and writes a root index.html that links to
// each game's self-contained build. Data-driven like everything else — a game's
// manifest (title/subtitle/art) is the only source. Cards are themed with each
// game's own accent. The output is a plain static page: it deploys to GitHub
// Pages (or any static host) unchanged, and every link/asset path is relative so
// it works under a project subpath (e.g. user.github.io/weft/).
//
// An optional repo-root portal.json overrides the heading and adds EXTERNAL
// cards — games hosted elsewhere (their own engine / repo / Pages site) that
// open in a new tab. Shape:
//   { "title": "...", "subtitle": "...",
//     "external": [ { "title", "subtitle", "url", "cover"?, "accent"?, "tags"?, "id"? } ] }

import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadGame } from "./load.mjs";
import { resolveStyle } from "../src/art/styles.js";

const exists = (p) => access(p).then(() => true, () => false);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Pick a cover slot (base name, no extension) for a game: the start scene's art,
// then a `title`/`cover` asset, then the first asset present.
async function coverBase(gameDir, def, scenes) {
  const candidates = [scenes?.[def.start]?.art, "title", "cover"].filter(Boolean);
  for (const name of candidates) {
    for (const ext of ["png", "svg"]) {
      if (await exists(join(gameDir, "assets", `${name}.${ext}`))) return name;
    }
  }
  const files = await readdir(join(gameDir, "assets")).catch(() => []);
  const f = files.find((x) => /\.(png|svg)$/.test(x));
  return f ? f.replace(/\.(png|svg)$/, "") : null;
}

// Light blurb about the systems a game uses (for a small tag row on each card).
function tags(def) {
  const t = [];
  if (def.cast && Object.keys(def.cast).length) t.push("dialogue");
  if (def.systems?.combat) t.push("combat");
  if (def.items && Object.keys(def.items).length) t.push("inventory");
  if (def.systems?.checks) t.push("skill checks");
  const n = def.endings?.length;
  if (n) t.push(`${n} endings`);
  return t;
}

// A cover <img> with a graceful fallback: a remote/relative source, then (for
// game slots) an svg sibling, then the colored initial-disc behind it.
function coverImg(src, svgSrc) {
  const onerr = svgSrc
    ? `if(!this.dataset.f){this.dataset.f=1;this.src='${svgSrc}';}else this.closest('.thumb').classList.add('nocover');`
    : `this.closest('.thumb').classList.add('nocover');`;
  return `<img class="cover" loading="lazy" alt="" src="${src}" onerror="${onerr}">`;
}

async function collectGames(gamesDir) {
  const names = (await readdir(gamesDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => d.name).sort();
  const cards = [];
  for (const id of names) {
    const gameDir = join(gamesDir, id);
    if (!(await exists(join(gameDir, "game.js")))) continue;
    let def, scenes = null;
    try { ({ def, scenes } = await loadGame(gameDir)); }
    catch {
      try { def = (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default; }
      catch { continue; }
    }
    if (!def?.meta) continue;
    const style = resolveStyle(def.meta.art);
    const accent = def.meta.theme?.["--accent"] || style?.palette?.["--accent"] || "#e8c15a";
    const base = await coverBase(gameDir, def, scenes);
    cards.push({
      external: false,
      built: await exists(join(gameDir, "index.html")),
      href: `games/${id}/index.html`,
      label: id,
      title: def.meta.title || id,
      subtitle: def.meta.subtitle || "",
      accent,
      tags: tags(def),
      cover: base ? coverImg(`games/${id}/assets/${base}.png`, `games/${id}/assets/${base}.svg`) : "",
    });
  }
  return cards;
}

function externalCards(list) {
  return (Array.isArray(list) ? list : []).filter((e) => e && e.url).map((e) => ({
    external: true,
    built: true,
    href: e.url,
    label: e.id || (() => { try { return new URL(e.url).hostname.replace(/^www\./, ""); } catch { return "↗"; } })(),
    title: e.title || e.url,
    subtitle: e.subtitle || "",
    accent: e.accent || "#e8c15a",
    tags: Array.isArray(e.tags) ? e.tags : [],
    cover: e.cover ? coverImg(e.cover, null) : "",
  }));
}

function renderCard(c) {
  const cov = c.cover || "";
  const tagRow = c.tags.length ? `<div class="tags">${c.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "";
  const badge = c.external
    ? `<span class="badge ext">external ↗</span>`
    : (c.built ? "" : `<span class="badge">unbuilt</span>`);
  const inner = `<div class="thumb${cov ? "" : " nocover"}">${cov}<span class="mono">${esc(c.label)}</span>${badge}</div>
      <div class="body"><h2>${esc(c.title)}</h2><p>${esc(c.subtitle)}</p>${tagRow}</div>`;
  if (c.external) return `<a class="card" style="--ac:${esc(c.accent)}" href="${esc(c.href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  if (!c.built) return `<div class="card unbuilt" style="--ac:${esc(c.accent)}" title="not built yet — run: node tools/cli.mjs build games/${esc(c.label)}">${inner}</div>`;
  return `<a class="card" style="--ac:${esc(c.accent)}" href="${esc(c.href)}">${inner}</a>`;
}

function page(cards, { title, subtitle }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0d14">
<title>${esc(title)}</title>
<meta name="description" content="${esc(subtitle)}">
<style>
:root{--bg:#0a0d14;--bg2:#121826;--panel:#141b2c;--ink:#cfd6e4;--dim:#7d889e;--accent:#e8c15a;--line:#242e45}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#16203a 0%,var(--bg) 60%);color:var(--ink);
 font:17px/1.6 Georgia,'Times New Roman',serif;-webkit-font-smoothing:antialiased}
header{max-width:1040px;margin:0 auto;padding:64px 24px 8px;text-align:center}
header h1{font-size:46px;font-weight:normal;letter-spacing:8px;text-transform:lowercase;color:var(--accent);margin:0}
header p{color:var(--dim);font-style:italic;margin:10px 0 0;font-size:18px}
header .rule{width:56px;height:2px;background:var(--accent);opacity:.5;margin:26px auto 0}
main{max-width:1040px;margin:0 auto;padding:34px 24px 80px;
 display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
.card{display:flex;flex-direction:column;text-decoration:none;color:inherit;background:var(--panel);
 border:1px solid var(--line);border-radius:10px;overflow:hidden;position:relative;
 transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
.card:hover{transform:translateY(-3px);border-color:var(--ac);box-shadow:0 14px 36px rgba(0,0,0,.45)}
.card.unbuilt{opacity:.55;cursor:default}
.thumb{position:relative;aspect-ratio:3/2;background:linear-gradient(135deg,var(--bg2),#0b0e16);overflow:hidden}
.thumb .cover{width:100%;height:100%;object-fit:cover;display:block}
.thumb .mono{display:none;position:absolute;inset:0;align-items:center;justify-content:center;
 font:600 22px/1 ui-monospace,monospace;letter-spacing:4px;color:var(--ac);text-transform:uppercase;opacity:.7}
.thumb.nocover .cover{display:none}.thumb.nocover .mono{display:flex}
.thumb::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--ac);opacity:.9}
.body{padding:16px 18px 18px}
.body h2{margin:0;font-size:21px;font-weight:normal;letter-spacing:.4px;color:var(--ink)}
.body p{margin:6px 0 0;color:var(--dim);font-size:15px;font-style:italic}
.tags{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}
.tags span{font:12px/1 Georgia,serif;letter-spacing:.6px;color:var(--dim);
 border:1px solid var(--line);border-radius:999px;padding:4px 9px}
.badge{position:absolute;top:10px;right:10px;font:11px/1 ui-monospace,monospace;letter-spacing:1px;
 color:var(--bg);background:var(--ac);border-radius:4px;padding:4px 7px;text-transform:uppercase}
.badge.ext{background:transparent;color:var(--ac);border:1px solid var(--ac)}
footer{max-width:1040px;margin:0 auto;padding:0 24px 64px;text-align:center;color:var(--dim);font-size:13px}
footer code{color:var(--ink);font-family:ui-monospace,monospace}
@media(max-width:560px){header{padding-top:44px}header h1{font-size:34px;letter-spacing:5px}}
</style></head>
<body>
<header><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><div class="rule"></div></header>
<main>
${cards.map(renderCard).join("\n")}
</main>
<footer>${cards.length} title${cards.length === 1 ? "" : "s"} · built with the <code>weft</code> interactive-fiction engine</footer>
</body></html>
`;
}

export async function buildPortal(repoRoot, opts = {}) {
  let cfg = {};
  try { cfg = JSON.parse(await readFile(join(repoRoot, "portal.json"), "utf8")); } catch { /* optional */ }
  const title = opts.title || cfg.title || "weft";
  const subtitle = opts.subtitle || cfg.subtitle || "a shelf of small, machine-checked interactive fictions";

  const games = await collectGames(join(repoRoot, "games"));
  const externals = externalCards(cfg.external);
  const cards = [...games, ...externals];

  await writeFile(join(repoRoot, "index.html"), page(cards, { title, subtitle }));
  // GitHub Pages: skip Jekyll so build/ and asset folders are served verbatim.
  await writeFile(join(repoRoot, ".nojekyll"), "");
  return {
    games: games.length,
    ids: games.map((c) => c.label),
    unbuilt: games.filter((c) => !c.built).map((c) => c.label),
    external: externals.map((c) => c.title),
  };
}
