// Length / density gate. Makes "how much was actually written" a machine-checked
// invariant — the missing piece that lets AI-authored books hit a real word
// target instead of quietly landing at a third of it.
//
// A game opts in with a top-level `length` block in its manifest:
//   length: {
//     corpus: 200000,     // total authored-word TARGET (reported as progress)
//     perScene: 600,      // default minimum narrative words per scene
//     tolerance: 0.15,    // a scene may come in up to 15% under before it FAILS
//     enforceCorpus: false // also hard-fail the total against `corpus`
//   }
// Per-scene overrides live in the DSL as `budget: N` (0 = exempt, e.g. hubs).
//
// "Narrative words" = prose paragraphs + dialogue + system boxes (the reader's
// story), counted via the SAME extractor the prose-linter uses. Choice labels are
// counted separately so a choice-heavy hub can't pad its way to budget.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { records } from "./prose-lint.mjs";

const wordCount = (s) => (String(s).trim().match(/\S+/g) || []).length;

// Scene headers + budget/beat/ending attrs, in source order, from one .dsl file.
function sceneMeta(body) {
  const out = [];
  let cur = null, inAttrs = false;
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim(); let m;
    if ((m = t.match(/^--- (\w+)( \[raw\])?$/))) { cur = { id: m[1], raw: !!m[2], budget: null, beat: null, ending: false }; out.push(cur); inAttrs = true; continue; }
    if (!cur || !inAttrs) continue;
    if ((m = t.match(/^budget:\s*(\d+)\s*$/))) { cur.budget = Number(m[1]); continue; }
    if ((m = t.match(/^beat:\s*(.+)$/))) { cur.beat = m[1].trim(); continue; }
    if (/^ending:\s*true\s*$/.test(t)) { cur.ending = true; continue; }
    if (/^(art|combat|win|lose|brief|cast|ref):/.test(t)) continue;
    if (t !== "") inAttrs = false;   // first prose/choice line ends the attr block
  }
  return out;
}

export async function lengthReport(gameDir) {
  const def = (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default;
  const cfg = def.length || null;
  if (!cfg) return { enabled: false };

  const perScene = cfg.perScene ?? 0;
  const tol = cfg.tolerance ?? 0.15;
  const srcDir = join(gameDir, "scenes");
  const files = (await readdir(srcDir).catch(() => [])).filter((f) => f.endsWith(".dsl")).sort();

  const scenes = [];
  for (const f of files) {
    const body = await readFile(join(srcDir, f), "utf8");
    const prose = {}, choice = {};
    for (const r of records(f, body)) {
      const w = wordCount(r.text);
      if (r.label) choice[r.scene] = (choice[r.scene] || 0) + w;
      else prose[r.scene] = (prose[r.scene] || 0) + w;   // prose + dialogue + system
    }
    const chapter = f.replace(/\.dsl$/, "");
    for (const s of sceneMeta(body)) {
      const words = prose[s.id] || 0;
      const budget = s.budget != null ? s.budget : (s.raw ? 0 : perScene);
      const enforced = budget > 0 && !s.raw;
      const min = Math.ceil(budget * (1 - tol));
      scenes.push({
        id: s.id, chapter, beat: s.beat, ending: s.ending,
        words, choiceWords: choice[s.id] || 0,
        budget, min, enforced, pass: !enforced || words >= min,
      });
    }
  }

  const total = scenes.reduce((a, s) => a + s.words, 0);
  const budgetSum = scenes.reduce((a, s) => a + s.budget, 0);
  const corpus = cfg.corpus || 0;
  const under = scenes.filter((s) => s.enforced && !s.pass);

  const byChapter = {};
  for (const s of scenes) {
    (byChapter[s.chapter] ||= { words: 0, budget: 0, scenes: 0 });
    byChapter[s.chapter].words += s.words;
    byChapter[s.chapter].budget += s.budget;
    byChapter[s.chapter].scenes += 1;
  }

  const corpusOk = !cfg.enforceCorpus || total >= Math.ceil(corpus * (1 - tol));
  return {
    enabled: true, total, corpus, budgetSum,
    pct: corpus ? Math.round((100 * total) / corpus) : null,
    enforceCorpus: !!cfg.enforceCorpus, corpusOk,
    scenes, under, byChapter,
    pass: under.length === 0 && corpusOk,
  };
}
