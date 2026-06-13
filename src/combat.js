// Generic tactical combat. The mechanics (charge/release telegraphs, iron/flow
// stances, bind/reflect/interrupt/turn/heal techniques, two-phase bosses, ally
// interventions) are the proven set from the reference game, but nothing here
// names a stat, a technique, or an NPC: it is all read from def.systems.combat,
// the enemy data, and per-enemy `interventions`. A game with no combat system
// simply never reaches this module.

const ceil = Math.ceil;

function cfg(game) { return game.def.systems?.combat || {}; }
function clog(c, s) { c.log.push(s); }

export function snapshot(game) { return JSON.stringify(game.state); }

export function startCombat(game) {
  const st = game.state;
  const sc = game.scenes[st.scene];
  const e = game.enemies[sc.combat];
  if (!e) throw new Error("unknown enemy '" + sc.combat + "' for scene " + st.scene);
  game.ckpt = snapshot(game);
  const c = cfg(game);
  const resPool = st.pools[c.resource];
  if (resPool) resPool.cur = Math.round(resPool.max * (c.startResourceFrac ?? 1));
  game.combat = {
    key: sc.combat, name: e.name, hp: e.hp, max: e.hp,
    moves: e.moves.slice(), p2: e.p2 || null, p2at: e.p2at ?? 0, p2text: e.p2text || null,
    i: 0, snared: false, mirror: false, guard: false, charged: false, stance: null,
    phase: 1, fired: {}, log: [e.open ? '<span class="foe">' + e.open + "</span>" : ""],
    win: sc.win, lose: sc.lose, intro: sc.t ? sc.t(game.context()) : "",
  };
  fireInterventions(game, "start");
}

function fireInterventions(game, phase) {
  const e = game.enemies[game.combat.key];
  const cx = game.context();
  const list = e.interventions || [];
  let revived = false;
  list.forEach((iv, idx) => {
    if (iv.on !== phase) return;
    if (iv.once && game.combat.fired[idx]) return;
    if (iv.when && !iv.when(cx)) return;
    game.combat.fired[idx] = true;
    if (iv.snare) game.combat.snared = true;
    if (iv.charge) game.combat.charged = true;
    if (iv.advance) game.combat.i += iv.advance;
    if (typeof iv.hp === "number") {
      const pool = game.state.pools[cfg(game).hpPool || "hp"];
      pool.cur = Math.max(pool.cur, iv.hp); revived = true;
    }
    if (iv.log) clog(game.combat, '<span class="good">' + iv.log + "</span>");
  });
  return revived;
}

function dmgEnemy(c, n, src) { c.hp -= n; clog(c, '<span class="you">' + src + " \u2014 " + n + " harm.</span>"); }

export function combatAct(game, actionId) {
  const st = game.state, c = game.combat, C = cfg(game);
  const eff = st.eff;
  const hpPool = st.pools[C.hpPool || "hp"];
  const resPool = st.pools[C.resource];
  const techs = C.techniques || {};
  const stances = C.stances || {};
  c.guard = false;

  if (actionId === "strike") {
    let d = (C.strikeBase ?? 2) + (eff[C.power] || 0), src = "You strike";
    if (c.stance && stances[c.stance]?.strike === "min1") { d = 1; src = "Your blow rings off the braced form"; }
    else if (c.stance && stances[c.stance]?.strike === "+2") { d += 2; src = "Your blow breaks the flowing form"; }
    dmgEnemy(c, d, src);
  } else if (actionId === "guard") {
    c.guard = true;
    if (resPool) resPool.cur = Math.min(resPool.max, resPool.cur + (C.guardRegen ?? 1));
    clog(c, '<span class="you">You guard and gather.</span>');
  } else {
    const t = techs[actionId];
    if (!t) throw new Error("unknown combat action: " + actionId);
    if (resPool && resPool.cur < (t.cost || 0)) throw new Error("not enough " + C.resource);
    if (resPool) resPool.cur -= t.cost || 0;
    applyTechnique(game, t);
  }

  if (c.hp <= 0) return endCombat(game, true);
  enemyAct(game);
  if (!game.combat) return; // ended via reflected blow
  if (hpPool.cur <= 0) {
    if (!fireInterventions(game, "defeat") || hpPool.cur <= 0) return endCombat(game, false);
  }
  if (c.p2 && c.phase === 1 && c.hp <= c.p2at) {
    c.phase = 2; c.moves = c.p2.slice(); c.i = 0; c.stance = null;
    clog(c, '<span class="foe">' + (c.p2text || "The foe sheds restraint.") + "</span>");
    fireInterventions(game, "phase2");
  }
  if (resPool) resPool.cur = Math.min(resPool.max, resPool.cur + (C.roundRegen ?? 0));
  game.save();
}

function applyTechnique(game, t) {
  const st = game.state, c = game.combat, eff = st.eff;
  const stanceFlow = c.stance && (game.def.systems.combat.stances?.[c.stance]?.kind === "flow");
  switch (t.type) {
    case "damage": {
      let d = (t.base || 0) + (eff[t.stat] || 0);
      if (stanceFlow && t.vsFlow === "half") d = ceil(d / 2);
      dmgEnemy(c, d, (t.name || "Technique") + " strikes"); break;
    }
    case "bind": {
      if (stanceFlow && t.vsFlow === "fail") { clog(c, '<span class="foe">The knot slides off the flowing form.</span>'); break; }
      c.snared = true; dmgEnemy(c, t.base || 1, (t.name || "Bind") + " binds"); break;
    }
    case "reflect": c.mirror = true; clog(c, '<span class="you">' + (t.name || "Reflect") + " hangs ready.</span>"); break;
    case "heal": {
      const pool = st.pools[t.pool || "hp"], h = (t.base || 0) + (eff[t.stat] || 0) * (t.mul ?? 1);
      pool.cur = Math.min(pool.max, pool.cur + h);
      clog(c, '<span class="good">' + (t.name || "Heal") + " reknits you. +" + h + " " + (t.pool || "hp") + ".</span>"); break;
    }
    case "interrupt": {
      let d = (t.base || 0) + (eff[t.stat] || 0);
      if (c.charged) { d += t.chargeBonus || 0; c.charged = false; c.i++; clog(c, '<span class="good">You tear the gathering technique apart!</span>'); }
      if (c.stance) { d += t.stanceBonus || 0; c.stance = null; clog(c, '<span class="good">The stance\u2019s anchor rips loose; the form collapses.</span>'); }
      dmgEnemy(c, d, (t.name || "Interrupt") + " rips it open"); break;
    }
    case "turn": {
      const nm = c.moves[c.i % c.moves.length];
      let d = nm.d != null ? nm.d : 4;
      if (nm.kind === "release" && !c.charged) d = ceil(d / 3);
      if (stanceFlow) d = ceil(d / 2);
      c.charged = false; c.i++;
      dmgEnemy(c, d, (t.name || "Turn") + " turns " + nm.n + " inward"); break;
    }
    case "counter": {
      let d = (t.base || 0) + (eff[t.stat] || 0);
      if (c.stance) { c.stance = null; clog(c, '<span class="good">The counter mends past the stance; the form simply isn\u2019t there.</span>'); }
      if (t.heal) { const pool = st.pools[t.healPool || "hp"]; pool.cur = Math.min(pool.max, pool.cur + t.heal); }
      dmgEnemy(c, d, (t.name || "Counter") + " runs through the foe\u2019s fray"); break;
    }
    default: throw new Error("unknown technique type: " + t.type);
  }
}

function enemyAct(game) {
  const st = game.state, c = game.combat, C = cfg(game);
  const hpPool = st.pools[C.hpPool || "hp"], resPool = st.pools[C.resource];
  if (c.snared) { c.snared = false; clog(c, '<span class="foe">' + c.name + " thrashes against your bind.</span>"); return; }
  const mv = c.moves[c.i % c.moves.length]; c.i++;
  if (mv.kind === "stance") { c.stance = mv.st; clog(c, '<span class="foe">' + mv.text + "</span>"); return; }
  if (mv.kind === "heal") { c.hp = Math.min(c.max, c.hp + mv.h); clog(c, '<span class="foe">' + mv.text + "</span>"); return; }
  if (mv.kind === "charge") { c.charged = true; clog(c, '<span class="foe">' + mv.text + "</span>"); return; }
  let d = mv.d;
  if (mv.kind === "release") { if (!c.charged) { d = ceil(d / 3); clog(c, '<span class="foe">The broken technique sputters.</span>'); } c.charged = false; }
  if (c.mirror) {
    c.mirror = false; c.hp -= d;
    clog(c, '<span class="good">Reflected \u2014 ' + d + " harm hurled back.</span>");
    if (c.hp <= 0) endCombat(game, true);
    return;
  }
  if (c.guard) d = ceil(d / 2);
  d = Math.max(1, Math.round(d * (C.foeMul ?? 1)));
  hpPool.cur -= d;
  clog(c, '<span class="foe">' + mv.n + " \u2014 " + d + " harm to you.</span>");
  if (mv.drain && resPool) { resPool.cur = Math.max(0, resPool.cur - mv.drain); clog(c, '<span class="foe">It drains ' + mv.drain + " " + C.resource + ".</span>"); }
}

function endCombat(game, won) {
  const C = cfg(game), c = game.combat, hpPool = game.state.pools[C.hpPool || "hp"];
  game.combat = null;
  if (won) hpPool.cur = Math.max(hpPool.cur, C.winHpFloor ?? 1);
  else hpPool.cur = Math.max(hpPool.cur, 0);
  game.goto(won ? c.win : c.lose);
}

export function combatView(game) {
  const st = game.state, c = game.combat, C = cfg(game);
  const stances = C.stances || {}, techs = C.techniques || {};
  const resPool = st.pools[C.resource];
  const mv = c.moves[c.i % c.moves.length];
  let intent = c.snared ? "It strains against your bind." : (mv.tele || "Prepares: " + mv.n);
  if (c.stance && stances[c.stance]) intent = '<span class="stq">' + stances[c.stance].see + "</span><br>" + intent;
  const actions = [{ id: "strike", label: "Strike", enabled: true, cost: 0 }];
  for (const id of Object.keys(st.abilities)) {
    const t = techs[id]; if (!t) continue;
    actions.push({ id, label: t.name + " \u2014 " + (t.desc || ""), cost: t.cost || 0, enabled: !resPool || resPool.cur >= (t.cost || 0) });
  }
  actions.push({ id: "guard", label: "Guard", enabled: true, cost: 0 });
  const intro = c.intro; c.intro = "";
  return {
    enemy: { name: c.name, hp: Math.max(0, c.hp), max: c.max },
    intent, log: c.log.slice(-5).filter(Boolean), intro,
    art: game.scenes[st.scene].art || null, actions,
  };
}
