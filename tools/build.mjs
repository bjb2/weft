// Shared build step: compile scenes -> validate -> refresh art placeholders ->
// bundle -> write index.html. Used by the CLI `build`/`all` and by the editor's
// save (so the live preview always reflects the latest edits). Throws on compile
// error (with .errors), so callers can surface validation feedback.

import { compileGame } from "./compile.mjs";
import { bundleGame } from "./bundle.mjs";
import { artGame } from "./art.mjs";
import { loadGame } from "./load.mjs";
import { resolveStyle } from "../src/art/styles.js";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// `home` (optional, { href, label }) adds a "back to portal" link in the
// deployed page only — set by the CLI build/site, omitted by the editor preview
// (which serves this same file from a path where the portal link wouldn't
// resolve). The link itself is rendered by the engine when window.__WEFT_HOME set.
async function writeIndex(gameDir, def, bundleName, theme, home) {
  const bg = (theme && theme["--bg"]) || "#0a0d14";
  const homeScript = home ? `\n<script>window.__WEFT_HOME=${JSON.stringify(home)}</script>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${bg}">
<title>${def.meta.title}</title>
<meta name="description" content="${(def.meta.subtitle || "").replace(/"/g, "&quot;")}">
<style>html,body{margin:0;background:${bg}}</style></head>
<body><div id="game"></div>${homeScript}
<script src="build/${bundleName}"></script>
</body></html>
`;
  await writeFile(join(gameDir, "index.html"), html);
}

export async function buildGame(gameDir, opts = {}) {
  const compiled = await compileGame(gameDir); // throws on validation error
  const def = (await loadGame(gameDir)).def;
  const style = resolveStyle(def.meta && def.meta.art);
  const theme = { ...(style ? style.palette : {}), ...((def.meta && def.meta.theme) || {}) };
  const art = await artGame(gameDir, { generate: false });
  const bundleName = await bundleGame(gameDir, resolve(gameDir, "../../src"), { theme });
  await writeIndex(gameDir, def, bundleName, theme, opts.home || null);
  return { compiled, art, bundleName, theme, def };
}
