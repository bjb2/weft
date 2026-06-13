// Prose linter. Extracts player-visible text from a game's scene DSL and applies
// the writing ruleset (src/writing/rules.js + optional games/<id>/writing.js).
//
//   ERRORS (gate): bans, em-dash hard ceiling, reversal hard ceiling, over-cap
//     signatures/motifs, "not just X but Y" hard ceiling.
//   WARNINGS (census): soft budgets, simile/tricolon scaffolds, hedges, adverb
//     dialogue tags, thesis/stated-moral closers.
//
// Player-visible text = prose paragraphs + system (`!!`) lines + choice labels.
// `${...}` interpolations are blanked (they're code, not prose). Choice attribute
// lines (req/do/hide/go) and raw-scene JS are ignored.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_RULES, mergeRules, REVERSAL, NOT_JUST, SIMILE_SCAFFOLD, TRICOLON, HEDGE, ADVERB_TAG,
} from "../src/writing/rules.js";

const strip = (s) => s.replace(/\$\{[^}]*\}/g, "").replace(/<[^>]+>/g, "");

// Pull {file, ln, text, scene, sys, label} records of visible prose from one .dsl
// file. Shared by the linter and the length gate so "visible prose" has ONE
// definition. `sys` = !! box, `label` = choice label; everything else is a
// narrative paragraph or a dialogue line (speaker tag stripped).
export function records(file, body) {
  const recs = [];
  let scene = null, inChoices = false, raw = false;
  body.split(/\r?\n/).forEach((line, idx) => {
    const ln = idx + 1, t = line.trim();
    let m;
    if ((m = t.match(/^--- (\w+)( \[raw\])?$/))) { scene = m[1]; raw = !!m[2]; inChoices = false; return; }
    if (!scene || raw) return;
    if (/^(art|combat|win|lose|ending|brief|budget|beat|cast|ref):/.test(t)) return;
    if (/^(req|do|hide|go):/.test(t)) return;          // choice code
    if (t === "" || t === "~~~" || /^\[\[(if|else|end)/.test(t)) return;
    if (t.startsWith(":: ")) return;                    // raw html line
    if (t.startsWith("!! ")) { recs.push({ file, ln, scene, text: strip(t.slice(3)), sys: true }); return; }
    if ((m = t.match(/^@[\w$]+:\s?(.*)$/))) { recs.push({ file, ln, scene, text: strip(m[1]) }); return; }  // dialogue line: lint the spoken text, not the speaker tag
    if ((m = t.match(/^\* (.+?)(?:\s*->\s*\w+)?$/))) { recs.push({ file, ln, scene, text: strip(m[1]), label: true }); inChoices = true; return; }
    if (inChoices) return;                              // indented choice attrs handled above
    recs.push({ file, ln, scene, text: strip(t) });
  });
  return recs;
}

const count = (s, re) => (s.match(re) || []).length;

export async function lintGame(gameDir, { strict = false } = {}) {
  let rules = DEFAULT_RULES;
  try { rules = mergeRules((await import(pathToFileURL(join(gameDir, "writing.js")).href + "?t=" + Date.now())).default); } catch {}

  const srcDir = join(gameDir, "scenes");
  const files = (await readdir(srcDir).catch(() => [])).filter((f) => f.endsWith(".dsl")).sort();
  const errors = [], warns = [];
  const err = (f, ln, m) => errors.push(`${f}:${ln}: ${m}`);
  const warn = (f, ln, m) => warns.push(`${f}:${ln}: ${m}`);

  let totalWords = 0;
  const sigHits = {}, motifHits = {};

  for (const file of files) {
    const recs = records(file, await readFile(join(srcDir, file), "utf8"));
    let words = 0, dash = 0, reversal = 0, notJust = 0, simile = 0, tricolon = 0, hedge = 0, advtag = 0;

    for (const r of recs) {
      const text = r.text;
      words += text.split(/\s+/).filter(Boolean).length;
      dash += count(text, /\u2014/g);

      for (const [re, label] of rules.bans) if (re.test(text)) err(file, r.ln, `ban-list: ${label}`);
      if (REVERSAL.test(text)) reversal++;
      if (NOT_JUST.test(text)) notJust++;
      simile += count(text, SIMILE_SCAFFOLD);
      tricolon += count(text, TRICOLON);
      hedge += count(text, HEDGE);
      advtag += count(text, ADVERB_TAG);
      { const tm = rules.thesis && text.match(rules.thesis); if (tm) warn(file, r.ln, `stated-moral / thesis closer  «\u2026${tm[0]}\u2026»`); }
      if (r.sys && /\b(mercy|grief|love|the point|what it costs|the truth|matters most|in the end)\b/i.test(text))
        warn(file, r.ln, `system box editorializes (state rules, not theme)  «${text.slice(0, 56)}»`);

      for (const [phrase, cfg] of Object.entries(rules.signatures))
        if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) (sigHits[phrase] ??= []).push(`${file}:${r.ln}`);
      for (const [word, cfg] of Object.entries(rules.motifs))
        if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) (motifHits[word] ??= []).push(`${file}:${r.ln}`);
    }
    totalWords += words;

    const b = rules.budgets;
    const soft = Math.round(words / b.emDashPerWords), hard = Math.round(words / b.emDashHardPerWords);
    if (dash > hard) err(file, 0, `em-dash ${dash} over hard ceiling ${hard} (${words} words)`);
    else if (dash > soft) warn(file, 0, `em-dash ${dash} over soft budget ${soft} (${words} words)`);
    if (reversal > b.reversalHardPerFile) err(file, 0, `antithesis "not X. It's Y." ${reversal} over hard ceiling ${b.reversalHardPerFile}`);
    else if (reversal > b.reversalPerFile) warn(file, 0, `antithesis construction ${reversal} (budget ${b.reversalPerFile})`);
    if (notJust > b.notJustHardPerFile) err(file, 0, `"not just X but Y" ${notJust} over hard ceiling ${b.notJustHardPerFile}`);
    else if (notJust > b.notJustPerFile) warn(file, 0, `"not just X but Y" ${notJust} (budget ${b.notJustPerFile})`);
    if (simile > b.simileScaffoldPerFile) warn(file, 0, `"the way X…" simile scaffold ${simile} (budget ${b.simileScaffoldPerFile})`);
    if (tricolon > b.tricolonPerFile) warn(file, 0, `tricolon "X, Y, and Z" ${tricolon} (budget ${b.tricolonPerFile})`);
    if (words >= 200) {
      if (hedge / words * 1000 > rules.hedgePer1000) warn(file, 0, `hedges (seemed/somehow/as if) ${hedge} > ${rules.hedgePer1000}/1000 words`);
      if (advtag / words * 1000 > rules.adverbTagPer1000) warn(file, 0, `adverb dialogue tags ${advtag} > ${rules.adverbTagPer1000}/1000 words`);
    }
  }

  for (const [phrase, locs] of Object.entries(sigHits)) {
    const cap = rules.signatures[phrase].perFile ?? 1;
    if (locs.length > cap) for (const l of locs.slice(cap)) err(l.split(":")[0], l.split(":")[1], `signature "${phrase}" over cap ${cap} (game-wide ${locs.length})`);
  }
  for (const [word, locs] of Object.entries(motifHits)) {
    const cap = rules.motifs[word].perFile ?? 3;
    if (locs.length > cap) for (const l of locs.slice(cap)) warn(l.split(":")[0], l.split(":")[1], `motif "${word}" over cap ${cap}/file (game-wide ${locs.length})`);
  }

  return { files: files.length, words: totalWords, errors, warns, pass: errors.length === 0 && (!strict || warns.length === 0) };
}
