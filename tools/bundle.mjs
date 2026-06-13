// Bundle a game into ONE self-contained classic script: build/bundle.<hash>.js.
//
// Why not ship the ES modules directly? Browsers block ESM imports over file://
// (CORS, origin "null"), so a module game only runs behind a web server. Authors
// open games straight off disk, and finished games deploy as static files, so a
// single non-module bundle is the right artifact: it runs from file:// and from
// any static host. The hash in the filename busts HTTP caches with no query
// string (query strings break file:// fetches), so returning players always get
// the current build.
//
// The bundler is deliberately trivial: our module graph is small and ours, so we
// concatenate sources (stripping import/export) into one IIFE scope where the
// cross-module references resolve as locals. No external bundler dependency.

import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Definition order: dependencies before dependents. (Function declarations hoist,
// but we keep a sane order anyway; none of these run top-level code at load.)
const SRC_ORDER = ["rng.js", "markup.js", "state.js", "context.js", "combat.js", "engine.js", "storage.js", "render/dom.js"];

function strip(code, isGame) {
  let out = code.replace(/^[ \t]*import\s[^\n]*\n/gm, "");
  if (isGame) out = out.replace(/export\s+default\s+/, "const __GAME_DEF = ");
  out = out.replace(/^[ \t]*export\s+(?=(?:const|function|class|let|var)\b)/gm, "");
  return out;
}

export async function bundleGame(gameDir, srcDir, opts = {}) {
  const parts = [];
  for (const f of SRC_ORDER) parts.push(`/* ---- src/${f} ---- */\n` + strip(await readFile(join(srcDir, f), "utf8")));
  parts.push("/* ---- compiled scenes ---- */\n" + strip(await readFile(join(gameDir, "build", "scenes.js"), "utf8")));
  parts.push("/* ---- manifest ---- */\n" + strip(await readFile(join(gameDir, "game.js"), "utf8"), true));
  parts.push(`/* ---- bootstrap ---- */
var __THEME = ${JSON.stringify(opts.theme || null)};
var __game = createGame(__GAME_DEF, { scenes: scenes, enemies: __GAME_DEF.enemies || {}, storage: localStorageAdapter() });
var __jump = new URLSearchParams(location.search).get("scene");
if (__jump && scenes[__jump]) { __game.start(Date.now()); __game.goto(__jump); } else __game.resume(Date.now());
mount(__game, { root: document.getElementById("game"), assetPath: "assets/", theme: __THEME, home: (typeof window !== "undefined" && window.__WEFT_HOME) || null });
window.__weft = __game;`);

  const code = '(function(){\n"use strict";\n' + parts.join("\n\n") + "\n})();\n";
  const hash = createHash("sha1").update(code).digest("hex").slice(0, 10);
  const buildDir = join(gameDir, "build");
  for (const f of await readdir(buildDir).catch(() => []))
    if (/^bundle\.[0-9a-f]+\.js$/.test(f)) await unlink(join(buildDir, f)).catch(() => {});
  const name = "bundle." + hash + ".js";
  await writeFile(join(buildDir, name), code);
  return name;
}
