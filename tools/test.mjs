// Test harness: deterministic replay specs (regression) + seeded fuzz (coverage,
// softlock/error detection). Both run headless through the shared driver.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createGame } from "../src/engine.js";
import { autoplay, playScript, randomPolicy } from "../src/driver.js";
import { loadGame } from "./load.mjs";

export async function testGame(gameDir, { fuzz = 80, cap = 5000 } = {}) {
  const loaded = await loadGame(gameDir);
  const fresh = () => createGame(loaded.def, { scenes: loaded.scenes, enemies: loaded.enemies });

  // --- replays (golden paths) ---
  let specs = [];
  try { specs = JSON.parse(await readFile(join(gameDir, "replays.json"), "utf8")); } catch {}
  const replays = specs.map((spec) => {
    const g = fresh(); g.start(spec.seed ?? 1);
    const r = playScript(g, spec.script);
    const okScene = !spec.expect?.scene || r.scene === spec.expect.scene;
    const okEnding = spec.expect?.ending == null || r.ending === spec.expect.ending;
    return { name: spec.name, pass: r.reason === "done" && okScene && okEnding, got: { scene: r.scene, ending: r.ending, reason: r.reason }, expect: spec.expect || {} };
  });

  // --- fuzz ---
  const endings = {}, errors = [], visited = new Set();
  let softlocks = 0;
  for (let i = 0; i < fuzz; i++) {
    const g = fresh(); g.start(1000 + i);
    const res = autoplay(g, { policy: randomPolicy(1000 + i), cap });
    res.path.forEach((s) => visited.add(s));
    if (res.reason === "terminal") endings[res.scene] = (endings[res.scene] || 0) + 1;
    else if (res.reason === "softlock") { softlocks++; endings["SOFTLOCK@" + res.scene] = (endings["SOFTLOCK@" + res.scene] || 0) + 1; }
    else if (res.reason.includes("error")) errors.push(`${res.reason}: ${res.error || ""} @${res.scene}${res.choice ? " (" + res.choice + ")" : ""}`);
    else if (res.reason === "stepcap") errors.push(`stepcap @${res.scene}`);
  }
  const sceneIds = Object.keys(loaded.scenes);
  const visitedScenes = [...visited].filter((s) => !s.startsWith("@"));
  const never = sceneIds.filter((s) => !visited.has(s));
  return {
    replays,
    fuzz: { runs: fuzz, endings, errors, softlocks, coverage: Math.round(100 * visitedScenes.length / sceneIds.length), never },
    pass: replays.every((r) => r.pass) && errors.length === 0,
  };
}
