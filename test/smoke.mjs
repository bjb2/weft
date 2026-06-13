// Core smoke test: exercises state, navigation, choices, skill checks, items,
// and a full deterministic combat — without the compiler or any renderer.
import { createGame } from "../src/engine.js";
import { toText } from "../src/markup.js";
import assert from "node:assert";

const def = {
  meta: { id: "smoke", title: "Smoke", saveVersion: 1 },
  start: "start",
  state: {
    name: "Tester",
    stats: { body: 3, mind: 4, heart: 2 },
    pools: { hp: { max: (s) => 16 + s.body * 2 }, thr: { max: 6 } },
    vars: {},
    abilities: ["snare", "mend"],
    inventory: {},
    items: {},
  },
  items: {
    charm: { name: "Mind Charm", slot: "trinket", mods: { mind: 2 } },
  },
  systems: {
    combat: {
      resource: "thr", power: "body", strikeBase: 2, startResourceFrac: 1,
      roundRegen: 1, guardRegen: 2, foeMul: 1, hpPool: "hp", winHpFloor: 1,
      techniques: {
        snare: { name: "Snare", desc: "bind", cost: 2, type: "bind", vsFlow: "fail" },
        mend: { name: "Mend", desc: "heal", cost: 2, type: "heal", pool: "hp", base: 4, stat: "heart", mul: 1 },
      },
      stances: { iron: { see: "braced", strike: "min1", kind: "iron" } },
    },
  },
  enemies: {
    dummy: {
      name: "Straw Dummy", hp: 10, open: "It stands there.",
      moves: [{ n: "Flail", d: 3 }, { n: "Wobble", d: 2 }],
    },
  },
};

const scenes = {
  start: {
    t: ($) => $.P(`Hello, ${$.G.name}. Mind is ${$.G.eff.mind}.`),
    c: ($) => [
      { id: "c0", l: "Take the charm", do: ($) => { $.give("charm"); $.equip("charm"); }, go: "after" },
      { id: "c1", l: "Skip it", go: "after" },
    ],
  },
  after: {
    t: ($) => $.P(`Mind is now ${$.G.eff.mind}. ${$.has("charm") || $.G.equip.trinket ? "Charm equipped." : "No charm."}`),
    c: ($) => [
      { id: "c0", l: "Test a check", do: ($) => { $.set("checked", $.check("mind", 5)); }, go: "fight" },
    ],
  },
  fight: { combat: "dummy", win: "win", lose: "lose", t: ($) => $.P("A dummy blocks the path.") },
  win: { ending: true, t: ($) => $.P("You win."), c: ($) => [{ id: "c0", l: "Restart", go: "start" }] },
  lose: { ending: true, t: ($) => $.P("You lose."), c: ($) => [{ id: "c0", l: "Restart", go: "start" }] },
};

const mem = new Map();
const storage = { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v), del: (k) => mem.delete(k) };

const game = createGame(def, { scenes, enemies: def.enemies, storage });
game.start(1234);

let v = game.view();
assert.equal(v.kind, "scene");
assert.equal(v.hud.stats.mind, 4, "base mind 4");
console.log("start:", toText(v.html));

game.choose("c0"); // take + equip charm
v = game.view();
assert.equal(v.hud.stats.mind, 6, "mind 4 + charm 2 = 6 effective");
assert.equal(v.hud.equip.trinket, "charm");
console.log("after:", toText(v.html), "| notes:", v.notes.map((n) => n.text).join("; "));

game.choose("c0"); // run check, go to fight
v = game.view();
assert.equal(v.kind, "combat", "entered combat");
console.log("combat opens:", v.intent);

// Drive combat deterministically: snare to skip, then strike until dead.
let guard = 0;
while (game.combat && guard++ < 50) {
  const acts = game.view().actions.filter((a) => a.enabled).map((a) => a.id);
  const pick = game.combat.hp > 6 && acts.includes("snare") && game.state.pools.thr.cur >= 2 ? "snare" : "strike";
  game.act(pick);
}
assert.ok(!game.combat, "combat resolved");
v = game.view();
assert.ok(v.scene === "win" || v.scene === "lose", "reached an ending: " + v.scene);
assert.ok(v.ending, "ending flagged");
console.log("ended at:", v.scene, "-", toText(v.html), "| hp:", game.state.pools.hp.cur);

// Save/migrate round-trip.
const raw = mem.get("smoke");
assert.ok(raw, "save written");
const g2 = createGame(def, { scenes, enemies: def.enemies, storage });
g2.resume(1);
assert.equal(g2.state.scene, v.scene, "resumed at saved scene");

console.log("\nSMOKE OK");
