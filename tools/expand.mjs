// Expand loop (P2). The engine drives long-form generation instead of the human:
// it finds every node that is under its word budget and, for the next one, emits a
// ready-to-use generation prompt assembled from the story bible, the node's beat,
// its inbound routes, and the choices it must lead into. Feed that to any model
// (or write it yourself), drop the prose in, and `weft length` re-checks. Because
// each node is bounded and validated independently, the loop is resumable: only
// under-budget nodes ever come back. Total length = nodes x budget, by construction.

import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { lengthReport } from "./length.mjs";
import { loadGame } from "./load.mjs";
import { auditGame } from "./audit.mjs";

const exists = (p) => access(p).then(() => true, () => false);

async function readBible(gameDir, def) {
  for (const p of [join(gameDir, "bible.md"), join(gameDir, "story", "bible.md")])
    if (await exists(p)) return await readFile(p, "utf8");
  return typeof def.bible === "string" ? def.bible : "";
}

// Parse each scene's choice labels and any existing prose lines from the DSL.
async function sceneDrafts(gameDir) {
  const srcDir = join(gameDir, "scenes");
  const files = (await readdir(srcDir).catch(() => [])).filter((f) => f.endsWith(".dsl")).sort();
  const choices = {}, prose = {};
  for (const f of files) {
    let cur = null, inAttrs = false, inChoices = false;
    for (const line of (await readFile(join(srcDir, f), "utf8")).split(/\r?\n/)) {
      const t = line.trim(); let m;
      if ((m = t.match(/^--- (\w+)/))) { cur = m[1]; inAttrs = true; inChoices = false; choices[cur] = []; prose[cur] = []; continue; }
      if (!cur) continue;
      if (inAttrs && /^(art|combat|win|lose|ending|brief|budget|beat|cast|ref):/.test(t)) continue;
      if (t !== "") inAttrs = false;
      if ((m = t.match(/^\* (.+?)(?:\s*->\s*(\w+))?$/))) { choices[cur].push(m[1]); inChoices = true; continue; }
      if (inChoices) continue;
      if (t === "" || /^(@|!!|::|~~~|\[\[)/.test(t)) continue;
      prose[cur].push(t);
    }
  }
  return { choices, prose };
}

export async function expandPlan(gameDir) {
  const def = (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default;
  const len = await lengthReport(gameDir);
  if (!len.enabled) return { pending: [], total: 0, corpus: 0, pct: null };

  const bible = (await readBible(gameDir, def)).trim();
  let voice = "";
  try {
    const w = (await import(pathToFileURL(join(gameDir, "writing.js")).href + "?t=" + Date.now())).default;
    if (w && (w.pov || w.tense)) voice = `${w.pov || ""}${w.pov && w.tense ? ", " : ""}${w.tense || ""}`;
  } catch { /* optional */ }

  // Inbound routes for context (which scenes lead here).
  const loaded = await loadGame(gameDir);
  let edges = {};
  try { edges = auditGame(loaded).edges; } catch { /* unbuilt/erroring */ }
  const preds = {};
  for (const [from, tos] of Object.entries(edges)) for (const to of tos) (preds[to] ||= []).push(from);

  const { choices, prose } = await sceneDrafts(gameDir);

  const pending = len.scenes.filter((s) => s.enforced && !s.pass).map((s) => {
    const ch = choices[s.id] || [], draft = prose[s.id] || [], inbound = preds[s.id] || [];
    const prompt = [
      `Write the narrative prose for scene "${s.id}" of "${def.meta.title}"${def.meta.subtitle ? ` — ${def.meta.subtitle}` : ""}.`,
      voice ? `Voice: ${voice}. Obey WRITING.md (no banned clichés; keep em-dashes sparse; vary sentence shape).` : `Obey WRITING.md.`,
      bible ? `\n--- STORY BIBLE (canon; stay consistent) ---\n${bible.slice(0, 2000)}\n--- end bible ---` : "",
      `\nBEAT — what must happen here: ${s.beat || "(none given; infer from the routes and choices below)"}`,
      inbound.length ? `Reached from: ${inbound.join(", ")}.` : "",
      ch.length
        ? `It must set up these choices without restating them verbatim:\n${ch.map((c) => "  * " + c).join("\n")}`
        : "This is a terminal/ending beat — land it.",
      draft.length ? `\nExisting draft to continue and deepen (keep what works):\n${draft.join(" ").slice(0, 700)}` : "",
      `\nTARGET: ~${s.budget} words (hard minimum ${s.min}). Output ONLY scene prose paragraphs and any "@speaker: line" dialogue. No scene header, no choices, no commentary.`,
    ].filter(Boolean).join("\n");
    return { id: s.id, chapter: s.chapter, words: s.words, budget: s.budget, deficit: Math.max(0, s.min - s.words), beat: s.beat, prompt };
  });

  return { pending, total: len.total, corpus: len.corpus, pct: len.pct };
}
