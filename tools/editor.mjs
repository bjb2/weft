// Local scene-editor + branch-visualizer server. No dependencies (node:http).
// Serves a single-page UI and a small JSON API backed by scene-io (safe DSL
// round-trip) + the compiler (live validation). Also serves the game itself
// under /game/ so a scene can be previewed live (?scene=id).

import { createServer } from "node:http";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFile, serializeScene, replaceScene, indexScenes, buildGraph } from "./scene-io.mjs";
import { buildGame } from "./build.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon" };

const loadDef = async (gameDir) => (await import(pathToFileURL(join(gameDir, "game.js")).href + "?t=" + Date.now())).default;

async function compileState(gameDir) {
  try { await buildGame(gameDir); return { ok: true, errors: [] }; }
  catch (e) { return { ok: false, errors: e.errors || [e.message] }; }
}

async function statePayload(gameDir) {
  const def = await loadDef(gameDir);
  const graph = await buildGraph(gameDir, def);
  const { files } = await indexScenes(gameDir);
  const compile = await compileState(gameDir);
  return {
    meta: { id: def.meta?.id, title: def.meta?.title, start: def.start },
    enemies: Object.keys(def.enemies || {}),
    files, graph, compile,
    sceneIds: graph.nodes.map((n) => n.id).sort(),
  };
}

export async function startEditor(gameDir, port = 4317) {
  const send = (res, code, body, type = "application/json") => {
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const readJson = (req) => new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } }); });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const p = url.pathname;

      if (p === "/") return send(res, 200, await readFile(join(HERE, "editor-ui.html"), "utf8"), "text/html");
      if (p === "/api/state") return send(res, 200, await statePayload(gameDir));

      if (p === "/api/scene" && req.method === "GET") {
        const id = url.searchParams.get("id");
        const { index } = await indexScenes(gameDir);
        const e = index[id];
        if (!e) return send(res, 404, { error: "no such scene: " + id });
        const s = e.scene;
        return send(res, 200, { id: s.id, file: e.file, raw: s.raw, attrs: s.attrs, body: s.body, choices: s.choices, rawText: serializeScene(s) });
      }

      if (p === "/api/scene" && req.method === "POST") {
        const sc = await readJson(req);
        if (!sc.id || !/^\w+$/.test(sc.id)) return send(res, 400, { error: "scene id must be a word (letters/digits/_)" });
        const { index, files } = await indexScenes(gameDir);
        const file = (index[sc.id] && index[sc.id].file) || sc.file || files[0];
        if (!file) return send(res, 400, { error: "no target .dsl file" });
        const path = join(gameDir, "scenes", file);
        const block = sc.raw ? `--- ${sc.id} [raw]\n${(sc.body || "").replace(/\s+$/, "")}` : serializeScene(sc);
        const text = await readFile(path, "utf8").catch(() => "");
        await writeFile(path, replaceScene(text, sc.id, block));
        const state = await statePayload(gameDir);
        return send(res, 200, { ok: true, savedTo: file, ...state });
      }

      if (p === "/api/delete" && req.method === "POST") {
        const { id } = await readJson(req);
        const { index } = await indexScenes(gameDir);
        const e = index[id];
        if (!e) return send(res, 404, { error: "no such scene" });
        const path = join(gameDir, "scenes", e.file);
        const { scenes } = parseFile(await readFile(path, "utf8"));
        const lines = (await readFile(path, "utf8")).split(/\r?\n/);
        const s = scenes.find((x) => x.id === id);
        const kept = [...lines.slice(0, s.startLine), ...lines.slice(s.endLine + 1)].join("\n").replace(/\n{3,}/g, "\n\n");
        await writeFile(path, kept);
        return send(res, 200, { ok: true, ...(await statePayload(gameDir)) });
      }

      // Serve the game itself for live preview: /game/...  -> files under gameDir.
      if (p.startsWith("/game/")) {
        const rel = normalize(decodeURIComponent(p.slice("/game/".length))).replace(/^(\.\.[/\\])+/, "");
        const file = join(gameDir, rel || "index.html");
        const buf = await readFile(file).catch(() => null);
        if (!buf) return send(res, 404, "not found", "text/plain");
        return send(res, 200, buf, MIME[extname(file)] || "application/octet-stream");
      }

      send(res, 404, { error: "not found" });
    } catch (e) { send(res, 500, { error: e.message }); }
  });

  return new Promise((resolve) => server.listen(port, () => resolve({ server, port })));
}
