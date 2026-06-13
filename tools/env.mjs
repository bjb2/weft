// Tiny .env loader (no dependency). Prefers Node's built-in process.loadEnvFile
// (Node >= 20.12), falls back to a minimal parser. Existing process.env values
// win, so real environment variables override file values. Used so a user can
// drop OPENROUTER_API_KEY into a .env file for the art pipeline.
import { readFileSync } from "node:fs";

export function loadEnv(...paths) {
  for (const p of paths) {
    try { process.loadEnvFile(p); continue; } catch { /* missing or unsupported -> manual */ }
    let txt;
    try { txt = readFileSync(p, "utf8"); } catch { continue; }
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  }
}
