// The platform-agnostic engine core. No DOM, no localStorage, no globals.
// `createGame(def, content)` returns a game instance that produces render-neutral
// *view models* and accepts choice/action dispatches. Renderers (DOM, CLI, the
// test driver) consume `view()` and call `choose()` / `act()`.

import { createInitialState, migrate, recompute } from "./state.js";
import { makeContext } from "./context.js";
import { startCombat, combatView, combatAct, snapshot } from "./combat.js";

export function createGame(def, content = {}) {
  const scenes = content.scenes || {};
  const enemies = content.enemies || def.enemies || {};
  const storage = content.storage || null;
  const saveKey = (def.meta && def.meta.id) || "weft-save";

  const game = {
    def, scenes, enemies, storage, saveKey,
    state: null,
    combat: null,
    ckpt: null,

    start(seed = Date.now()) {
      this.state = createInitialState(def, seed);
      this.combat = null;
      this.ckpt = null;
      const sc = scenes[this.state.scene];
      if (sc && sc.combat) startCombat(this);
      return this;
    },

    // Resume a saved game if one exists and is compatible; otherwise start fresh.
    resume(seed = Date.now()) {
      const loaded = this.load();
      if (loaded) {
        this.state = loaded;
        const sc = scenes[this.state.scene];
        if (sc && sc.combat) startCombat(this);
      } else {
        this.start(seed);
      }
      return this;
    },

    context() { return makeContext(this); },

    goto(id) {
      const sc = scenes[id];
      this.state.scene = sc ? id : def.start;
      this.combat = null;
      const target = scenes[this.state.scene];
      if (target && target.combat) startCombat(this);
      this.save();
      return this;
    },

    // Resolve a scene choice: run its side-effect, then navigate.
    choose(choiceId) {
      if (this.combat) throw new Error("in combat; use act()");
      const sc = scenes[this.state.scene];
      const cx = this.context();
      const list = sc.c ? sc.c(cx) : [];
      const c = list.find((x) => x.id === choiceId);
      if (!c) throw new Error("no such choice '" + choiceId + "' in " + this.state.scene);
      if (c.hide && c.hide(cx)) throw new Error("choice hidden: " + choiceId);
      if (c.req && !c.req(cx)) throw new Error("choice locked: " + choiceId);
      if (c.do) c.do(cx);
      const target = typeof c.go === "function" ? c.go(cx) : c.go;
      if (target) this.goto(target);
      return this;
    },

    // One combat round.
    act(actionId) {
      if (!this.combat) throw new Error("not in combat");
      combatAct(this, actionId);
      return this;
    },

    // Restore the pre-combat checkpoint (for retry-after-defeat flows).
    retry() {
      if (this.ckpt) { this.state = JSON.parse(this.ckpt); recompute(this.state, def); }
      this.combat = null;
      const sc = scenes[this.state.scene];
      if (sc && sc.combat) startCombat(this);
      return this;
    },

    // Render-neutral snapshot of what to show now.
    view() {
      const st = this.state;
      const notes = st.log.splice(0);
      const hud = {
        name: st.name, stats: st.eff, base: st.stats, pools: st.pools,
        bonds: st.bonds, abilities: Object.keys(st.abilities),
        inv: st.inv, equip: st.equip, vars: st.vars, journal: st.journal,
      };
      if (this.combat) return Object.assign({ kind: "combat", notes, hud }, combatView(this));
      const sc = this.scenes[st.scene];
      if (!sc) return { kind: "error", error: "missing scene: " + st.scene, notes, hud };
      const cx = this.context();
      const list = sc.c ? sc.c(cx) : [];
      const choices = list
        .filter((c) => !(c.hide && c.hide(cx)))
        .map((c) => {
          const enabled = !c.req || !!c.req(cx);
          return { id: c.id, label: c.l, enabled, lock: enabled ? null : (c.rq || "locked") };
        });
      // notes produced while evaluating text/choices are merged in.
      const html = sc.t ? sc.t(cx) : "";
      const merged = notes.concat(st.log.splice(0));
      return {
        kind: "scene", scene: st.scene, art: sc.art || null, ending: !!sc.ending,
        html, choices, notes: merged, hud,
      };
    },

    save() {
      if (!this.storage) return;
      try {
        this.state.v = (def.meta && def.meta.saveVersion) || 1;
        this.storage.set(this.saveKey, JSON.stringify(this.state));
      } catch (_) {}
    },
    load() {
      if (!this.storage) return null;
      try {
        const raw = this.storage.get(this.saveKey);
        if (!raw) return null;
        return migrate(JSON.parse(raw), def, scenes);
      } catch (_) { return null; }
    },
    clearSave() { if (this.storage) try { this.storage.del(this.saveKey); } catch (_) {} },
  };

  // expose for combat module
  game._snapshot = () => snapshot(game);
  return game;
}
