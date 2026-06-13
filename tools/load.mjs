// Load a compiled game from disk: manifest (game.js) + generated scenes.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadGame(gameDir) {
  const bust = "?t=" + Date.now();
  const def = (await import(pathToFileURL(join(gameDir, "game.js")).href + bust)).default;
  const { scenes } = await import(pathToFileURL(join(gameDir, "build", "scenes.js")).href + bust);
  return { def, scenes, enemies: def.enemies || {} };
}
