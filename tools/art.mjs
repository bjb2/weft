// Art pipeline. Two jobs, both driven by the chosen style (def.meta.art.style):
//   1. Emit art/prompts.json — one composed image prompt per art slot, ready to
//      paste into any image generator (or feed an API; an optional OpenRouter
//      path runs if OPENROUTER_API_KEY is set).
//   2. Generate themed SVG *placeholders* into assets/<name>.svg so every game
//      looks intentional immediately and the engine's <img> fallback always
//      resolves. Placeholders use the style's palette, so they match the UI.
//
// Art briefs (the subject of each illustration) come from a scene's optional
// `brief:` attribute, falling back to the scene's first sentence.

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveStyle } from "../src/art/styles.js";

// Collect { name -> { brief, fallback } } from scene DSL files.
async function collectSlots(gameDir) {
  const srcDir = join(gameDir, "scenes");
  const files = (await readdir(srcDir).catch(() => [])).filter((f) => f.endsWith(".dsl"));
  const slots = {};
  for (const f of files) {
    const text = await readFile(join(srcDir, f), "utf8");
    let scene = null, art = null, brief = null, firstProse = null, inAttrs = false;
    const flush = () => { if (art) slots[art] = { brief: brief || firstProse || scene, scene }; art = brief = firstProse = null; };
    for (const raw of text.split(/\r?\n/)) {
      const t = raw.trim(); let m;
      if ((m = t.match(/^--- (\w+)/))) { flush(); scene = m[1]; inAttrs = true; continue; }
      if (!scene) continue;
      if (inAttrs && (m = t.match(/^art:\s*(\S+)$/))) { art = m[1]; continue; }
      if (inAttrs && (m = t.match(/^brief:\s*(.+)$/))) { brief = m[1].trim(); continue; }
      if (/^(combat|win|lose|ending):/.test(t)) continue;
      if (t === "" || t.startsWith("* ") || t.startsWith("!! ") || t.startsWith(":: ") || t === "~~~" || /^\[\[/.test(t)) { if (t) inAttrs = false; continue; }
      inAttrs = false;
      if (!firstProse) firstProse = t.replace(/\$\{[^}]*\}/g, "").replace(/<[^>]+>/g, "").split(/(?<=[.!?])\s/)[0].slice(0, 160);
    }
    flush();
  }
  return slots;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const titleCase = (s) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function placeholderSVG(name, palette, styleName) {
  const p = palette, bg = p["--bg"] || "#0a0d14", bg2 = p["--bg2"] || "#141b2c";
  const accent = p["--accent"] || "#e8c15a", dim = p["--dim"] || "#7d889e", line = p["--line"] || "#242e45";
  const label = esc(titleCase(name)), sub = esc(styleName || "weft");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid slice">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g stroke="${accent}" stroke-width="1.5" opacity="0.18" fill="none">
    <circle cx="600" cy="300" r="150"/><circle cx="600" cy="300" r="220"/>
    <path d="M0 470 Q300 410 600 470 T1200 470"/><path d="M0 510 Q300 450 600 510 T1200 510"/></g>
  <rect x="60" y="60" width="1080" height="510" fill="none" stroke="${line}" stroke-width="2"/>
  <text x="600" y="312" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="${accent}" letter-spacing="3">${label}</text>
  <text x="600" y="356" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="${dim}" letter-spacing="6">${sub.toUpperCase()}</text>
</svg>
`;
}

export async function artGame(gameDir, { generate = false } = {}) {
  const def = (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default;
  const style = resolveStyle(def.meta?.art) || { descriptor: "", framing: "no text", palette: {} };
  const slots = await collectSlots(gameDir);
  const names = Object.keys(slots);

  const prompts = {};
  for (const name of names) prompts[name] = [slots[name].brief, style.descriptor, style.framing].filter(Boolean).join(". ");
  await mkdir(join(gameDir, "art"), { recursive: true });
  await writeFile(join(gameDir, "art", "prompts.json"), JSON.stringify(prompts, null, 2) + "\n");

  await mkdir(join(gameDir, "assets"), { recursive: true });
  let made = 0;
  for (const name of names) {
    const file = join(gameDir, "assets", name + ".svg");
    // Don't clobber an SVG an author/generator already produced unless asked.
    try { await readFile(file); if (!generate) continue; } catch {}
    await writeFile(file, placeholderSVG(name, style.palette, def.meta?.art?.style));
    made++;
  }

  // Optional: real PNGs via OpenRouter image model when a key is present.
  if (generate && process.env.OPENROUTER_API_KEY) {
    const model = process.env.OR_IMAGE_MODEL || "google/gemini-2.5-flash-image";
    for (const name of names) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { Authorization: "Bearer " + process.env.OPENROUTER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model, modalities: ["image", "text"], messages: [{ role: "user", content: prompts[name] }] }),
      }).catch(() => null);
      if (!res || !res.ok) continue;
      const j = await res.json();
      const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (url?.startsWith("data:image")) await writeFile(join(gameDir, "assets", name + ".png"), Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
    }
  }
  return { slots: names.length, names, placeholders: made, style: def.meta?.art?.style || "(none)" };
}
