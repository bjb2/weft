// Browser renderer. Consumes the engine's view() model and paints it; wires
// buttons back to choose()/act(). Theme colors come from def.meta.theme (CSS
// variables), so a game restyles itself without touching this file.

const STYLE = `
:root{--bg:#0a0d14;--bg2:#141b2c;--panel:#121826;--ink:#cfd6e4;--dim:#7d889e;--accent:#e8c15a;--accent2:#a8862e;
 --good:#58b890;--bad:#e0606a;--cool:#7ea7d8;--line:#242e45}
.weft *{box-sizing:border-box}
.weft{margin:0 auto;max-width:680px;padding:18px 20px 80px;color:var(--ink);
 font:17px/1.62 Georgia,'Times New Roman',serif}
.weft #wf-hud{position:sticky;top:0;background:linear-gradient(var(--bg) 80%,transparent);padding:10px 0 6px;z-index:5;font-size:13px;color:var(--dim);letter-spacing:.4px}
.weft #wf-hud .row{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline}
.weft #wf-hud b{color:var(--accent);font-weight:normal}
.weft .bar{height:4px;background:#1d2435;border-radius:2px;margin-top:6px;overflow:hidden}
.weft .bar i{display:block;height:100%;background:var(--accent2);transition:width .3s}
.weft #wf-hud .pools{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:8px}
.weft #wf-hud .pool{flex:1 1 130px;min-width:108px;max-width:230px}
.weft #wf-hud .prow{display:flex;justify-content:space-between;align-items:baseline}
.weft #wf-hud .plabel{color:var(--dim);text-transform:uppercase;font-size:11px;letter-spacing:1px}
.weft #wf-hud .pnum{color:var(--ink);font-size:14px;font-variant-numeric:tabular-nums}
.weft #wf-hud .pbar{height:7px;background:#10141f;border:1px solid var(--line);border-radius:4px;overflow:hidden;margin-top:3px}
.weft #wf-hud .pbar i{display:block;height:100%;border-radius:3px;transition:width .35s ease}
.weft #wf-hud .pool.low .pnum{color:var(--bad)}
.weft #wf-hud .pools.in-combat{gap:10px 18px;margin-bottom:10px}
.weft #wf-hud .pools.in-combat .pool{flex:1 1 200px;max-width:none}
.weft #wf-hud .pools.in-combat .pbar{height:12px}
.weft #wf-hud .pools.in-combat .pnum{font-size:17px}
.weft #wf-hud .pools.in-combat .plabel{font-size:12px}
.weft #wf-hud .stats{font-size:13px;color:var(--dim)}
.weft h1{font-size:34px;color:var(--accent);font-weight:normal;letter-spacing:2px;text-align:center;margin:50px 0 4px}
.weft h2{font-size:15px;color:var(--dim);font-weight:normal;text-align:center;letter-spacing:4px;text-transform:uppercase;margin:0 0 36px}
.weft #wf-main p{margin:0 0 14px}
.weft .scene-art{display:block;width:100%;max-height:54vh;object-fit:cover;border-radius:8px;margin:0 0 18px;border:1px solid var(--line)}
.weft .sys{color:var(--accent);font-style:italic;border-left:2px solid var(--accent2);padding:6px 12px;margin:16px 0;background:rgba(232,193,90,.05)}
.weft .gain{color:var(--good);font-size:14px;font-style:italic}
.weft .loss{color:var(--bad);font-size:14px;font-style:italic}
.weft .choices{margin-top:24px;display:flex;flex-direction:column;gap:9px}
.weft button.ch{font:inherit;text-align:left;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:11px 15px;cursor:pointer;transition:border .15s,background .15s}
.weft button.ch:hover:not(:disabled){border-color:var(--accent2);background:#182137}
.weft button.ch:disabled{opacity:.4;cursor:default}
.weft button.ch .req{color:var(--dim);font-size:13px}
.weft button.ch .cost{color:var(--cool);font-size:13px}
.weft .say{display:flex;gap:10px;align-items:flex-start;margin:0 0 14px}
.weft .say .pfp{position:relative;flex:0 0 auto;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--cc,var(--accent2));color:var(--bg);display:flex;align-items:center;justify-content:center;font:600 16px/1 Georgia,serif;border:1px solid var(--line)}
.weft .say .pfp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.weft .say .utter{flex:1 1 auto;min-width:0}
.weft .say .who{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--cc,var(--accent));margin-bottom:3px}
.weft .say .bubble{display:inline-block;background:var(--panel);border:1px solid var(--line);border-left:2px solid var(--cc,var(--accent2));border-radius:4px;padding:8px 13px}
.weft .say.self{flex-direction:row-reverse}
.weft .say.self .utter{text-align:right}
.weft .say.self .bubble{text-align:left;border-left:none;border-right:2px solid var(--cc,var(--accent2))}
.weft .divider{text-align:center;color:var(--accent2);margin:22px 0;letter-spacing:6px}
.weft .combat{border:1px solid #36415e;border-radius:6px;padding:14px 16px;margin:14px 0;background:rgba(0,0,0,.3)}
.weft .combat .ename{color:var(--bad);letter-spacing:1px}
.weft .combat .intent{color:var(--dim);font-style:italic;font-size:14px;margin-top:4px}
.weft .combat .intent .stq{color:var(--accent)}
.weft .clog{font-size:14px;color:var(--dim);margin:10px 0;border-top:1px dashed var(--line);padding-top:8px}
.weft .clog .you{color:var(--ink)} .weft .clog .foe{color:var(--bad)} .weft .clog .good{color:var(--good)}
.weft .ebar{height:6px;background:#2a1a22;border-radius:3px;margin-top:6px}.weft .ebar i{display:block;height:100%;background:var(--bad);border-radius:3px;transition:width .3s}
.weft .small{font-size:13px;color:var(--dim)}
.weft .ending{border:1px solid var(--accent2);border-radius:6px;padding:4px 18px;margin-top:24px;background:rgba(232,193,90,.04)}
.weft .ending h3{color:var(--accent);font-weight:normal;letter-spacing:2px}
.weft #wf-foot{margin-top:40px;padding:14px 0 8px;border-top:1px solid #1a2236;text-align:center;font-size:12px}
.weft #wf-foot button{font:inherit;font-size:12px;background:none;border:none;color:var(--dim);cursor:pointer;letter-spacing:.5px;padding:4px 10px}
.weft #wf-foot button:hover{color:var(--ink)} .weft #wf-foot .danger{color:var(--bad)}
.weft #wf-foot a{font:inherit;font-size:12px;color:var(--dim);text-decoration:none;letter-spacing:.5px;padding:4px 10px}
.weft #wf-foot a:hover{color:var(--accent)}
.weft .jbtn{margin-left:auto;cursor:pointer;color:var(--accent2);font-size:13px;letter-spacing:.5px}
.weft .jbtn:hover{color:var(--accent)}
.weft .panel h2{font-size:23px;color:var(--accent);font-weight:normal;letter-spacing:1px;margin:6px 0 0}
.weft .panel .sub{color:var(--dim);font-size:14px;font-style:italic;margin:2px 0 14px}
.weft .panel h3{font-size:12px;text-transform:uppercase;letter-spacing:2.5px;color:var(--dim);font-weight:normal;border-bottom:1px solid var(--line);padding-bottom:5px;margin:24px 0 10px}
.weft .panel .grid{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--ink)}
.weft .panel .grid b{color:var(--accent);font-weight:normal}
.weft .panel .bond{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px dotted var(--line);padding:6px 0;font-size:15px}
.weft .panel .bond .w{color:var(--accent2);font-size:13px;font-style:italic;letter-spacing:.5px}
.weft .panel .item{display:flex;justify-content:space-between;border-bottom:1px dotted var(--line);padding:5px 0;font-size:15px}
.weft .panel .item .q{color:var(--dim);font-size:13px}
.weft .panel ul.chron{list-style:none;padding:0;margin:0}
.weft .panel ul.chron li{padding:6px 0 6px 12px;border-left:2px solid var(--accent2);margin:7px 0;background:rgba(232,193,90,.04);font-size:15px}
.weft .panel .none{color:var(--dim);font-style:italic;font-size:14px}
`;

let styled = false;
function injectStyle(theme) {
  if (!styled) {
    const s = document.createElement("style");
    s.textContent = STYLE; (document.head || document.documentElement).appendChild(s); styled = true;
  }
  if (theme) for (const [k, val] of Object.entries(theme)) document.documentElement.style.setProperty(k, val);
}

export function mount(game, opts = {}) {
  const root = opts.root || document.body;
  const assetPath = opts.assetPath ?? "assets/";
  // Optional "back to portal" link shown in the footer. Deploy context only —
  // the index.html sets window.__WEFT_HOME; standalone/editor previews omit it.
  const home = opts.home || null;
  injectStyle(opts.theme || (game.def.meta && game.def.meta.theme));
  root.classList.add("weft");
  root.innerHTML = `<div id="wf-hud"></div><div id="wf-main"></div><div id="wf-foot"></div>`;
  const hudEl = root.querySelector("#wf-hud"), mainEl = root.querySelector("#wf-main"), footEl = root.querySelector("#wf-foot");

  const art = (name) => {
    if (!name) return "";
    const b = assetPath + name;
    return `<img class="scene-art" src="${b}.png" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${b}.svg';}else this.style.display='none';">`;
  };
  // Resolve dialogue profile pictures: inject an <img> per `.pfp[data-pfp]`,
  // using the same png -> svg fallback as scene art; if both fail, the colored
  // disc with the speaker's initial (already in the span) shows through.
  const wirePfp = (el) => el.querySelectorAll(".pfp[data-pfp]").forEach((p) => {
    const b = assetPath + p.dataset.pfp;
    p.insertAdjacentHTML("afterbegin",
      `<img src="${b}.png" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${b}.svg';}else this.remove();">`);
  });
  const notesHtml = (notes) => notes && notes.length
    ? "<p>" + notes.map((n) => `<span class="${n.cls || "gain"}">${n.text}</span>`).join("<br>") + "</p>" : "";

  function render() {
    const v = game.view();
    // HUD
    if (v.scene === game.def.start && v.kind === "scene") hudEl.style.display = "none";
    else { hudEl.style.display = "block"; hudEl.innerHTML = hud(v.hud, v.kind); }

    if (v.kind === "combat") {
      const pct = 100 * v.enemy.hp / v.enemy.max;
      mainEl.innerHTML = art(v.art) + (v.intro || "") + notesHtml(v.notes) +
        `<div class="combat"><span class="ename">${v.enemy.name}</span> — ${v.enemy.hp}/${v.enemy.max}
         <div class="ebar"><i style="width:${pct}%"></i></div>
         <div class="intent">${v.intent}</div>
         <div class="clog">${v.log.join("<br>")}</div></div>` +
        '<div class="choices">' + v.actions.map((a) =>
          `<button class="ch" ${a.enabled ? "" : "disabled"} data-act="${a.id}">${a.label}${a.cost ? ` <span class="cost">(${a.cost})</span>` : ""}</button>`).join("") + "</div>";
      mainEl.querySelectorAll("button[data-act]").forEach((b) =>
        b.onclick = () => { game.act(b.dataset.act); render(); });
    } else if (v.kind === "scene") {
      mainEl.innerHTML = art(v.art) + v.html + notesHtml(v.notes) +
        '<div class="choices">' + v.choices.map((c) =>
          `<button class="ch" ${c.enabled ? "" : "disabled"} data-ch="${c.id}">${c.label}${c.enabled ? "" : ` <span class="req">${c.lock}</span>`}</button>`).join("") + "</div>";
      mainEl.querySelectorAll("button[data-ch]").forEach((b) =>
        b.onclick = () => { game.choose(b.dataset.ch); render(); });
    } else {
      mainEl.innerHTML = `<p class="loss">Error: ${v.error}</p>`;
    }
    wirePfp(mainEl);
    window.scrollTo(0, 0);
    wireHud();
    foot(v);
  }

  const SECTION_LABELS = { stats: "Attributes", pools: "Condition", bonds: "Bonds", abilities: "Skills", inventory: "Carried", equipment: "Equipped", chronicle: "The story so far" };
  const surfaces = () => (game.def.surfaces && typeof game.def.surfaces === "object") ? game.def.surfaces : null;
  function hud(h, kind) {
    const cb = (game.def.systems && game.def.systems.combat) || {};
    const hpName = cb.hpPool || "hp", resName = cb.resource;
    const color = (k) => k === hpName ? "var(--bad)" : (k === resName ? "var(--cool)" : "var(--accent2)");
    const pools = Object.entries(h.pools).map(([k, p]) => {
      const pct = p.max ? Math.max(0, Math.min(100, 100 * p.cur / p.max)) : 0;
      const low = k === hpName && pct <= 33 ? " low" : "";
      return `<div class="pool${low}"><div class="prow"><span class="plabel">${cap(k)}</span><span class="pnum">${p.cur}/${p.max}</span></div><div class="pbar"><i style="width:${pct}%;background:${color(k)}"></i></div></div>`;
    }).join("");
    const stats = Object.entries(h.stats).map(([k, val]) => `${cap(k)} ${val}`).join(" \u00b7 ");
    const bonds = Object.entries(h.bonds).filter(([, n]) => n > 0).map(([k, n]) => `${cap(k)} ${n}`).join(" \u00b7 ");
    const panels = surfaces() ? Object.entries(surfaces()).map(([key, cfg]) =>
      `<span class="jbtn" data-panel="${key}">\u2766 ${cfg.title || cap(key)}</span>`).join("") : "";
    return `<div class="pools ${kind === "combat" ? "in-combat" : ""}">${pools}</div>` +
      `<div class="row stats"><span>${stats}</span>${bonds ? `<span>${bonds}</span>` : ""}${panels}</div>`;
  }
  function wireHud() {
    hudEl.querySelectorAll(".jbtn[data-panel]").forEach((b) => { b.onclick = () => openPanel(b.dataset.panel); });
  }
  function openPanel(key) {
    const cfg = surfaces()[key], st = game.state, items = game.def.items || {};
    const techs = game.def.systems?.combat?.techniques || {};
    const show = cfg.show || ["stats", "pools", "bonds", "abilities", "inventory", "equipment", "chronicle"];
    const tier = cfg.bondTiers || { 3: "close", 2: "firm", 1: "known" };
    const sec = {
      stats: () => `<div class="grid">${Object.entries(st.eff).map(([k, val]) => `<span>${cap(k)} <b>${val}</b></span>`).join("")}</div>`,
      pools: () => `<div class="grid">${Object.entries(st.pools).map(([k, p]) => `<span>${cap(k)} <b>${p.cur}/${p.max}</b></span>`).join("")}</div>`,
      bonds: () => { const e = Object.entries(st.bonds).filter(([, n]) => n > 0); return e.length ? e.map(([k, n]) => `<div class="bond"><span>${cap(k)}</span><span class="w">${tier[Math.min(3, n)] || "known"}</span></div>`).join("") : `<div class="none">No bonds yet.</div>`; },
      abilities: () => { const a = Object.keys(st.abilities); return a.length ? `<div class="grid">${a.map((id) => `<span>${techs[id]?.name || cap(id)}</span>`).join("")}</div>` : `<div class="none">None learned.</div>`; },
      inventory: () => { const e = Object.entries(st.inv).filter(([, q]) => q > 0); return e.length ? e.map(([id, q]) => `<div class="item"><span>${items[id]?.name || id}</span><span class="q">${q > 1 ? "\u00d7" + q : ""}</span></div>`).join("") : `<div class="none">Empty.</div>`; },
      equipment: () => { const e = Object.entries(st.equip).filter(([, id]) => id); return e.length ? e.map(([slot, id]) => `<div class="item"><span>${items[id]?.name || id}</span><span class="q">${cap(slot)}</span></div>`).join("") : `<div class="none">Nothing equipped.</div>`; },
      chronicle: () => st.journal.length ? `<ul class="chron">${st.journal.map((j) => `<li>${j.text}</li>`).join("")}</ul>` : `<div class="none">Your story is only beginning.</div>`,
    };
    let h = `<div class="panel"><h2>${st.name || cfg.title || cap(key)}</h2><div class="sub">${cfg.subtitle || cfg.title || ""}</div>`;
    for (const s of show) if (sec[s]) h += `<h3>${(cfg.labels && cfg.labels[s]) || SECTION_LABELS[s] || cap(s)}</h3>` + sec[s]();
    h += `<div class="choices"><button class="ch" id="wf-back">\u2190 back to the story</button></div></div>`;
    mainEl.innerHTML = h;
    mainEl.querySelector("#wf-back").onclick = () => render();
    window.scrollTo(0, 0);
  }
  function foot(v) {
    const homeLink = home ? `<a id="wf-home" href="${home.href}">${home.label}</a>` : "";
    const onStart = v.scene === game.def.start && v.kind === "scene";
    if (onStart) { footEl.innerHTML = homeLink; return; }
    footEl.innerHTML = homeLink + `<button id="wf-rst">\u21BA restart</button>`;
    footEl.querySelector("#wf-rst").onclick = () => {
      footEl.innerHTML = homeLink + `<span class="small">Erase progress and restart?</span> <button class="danger" id="wf-y">Yes</button> <button id="wf-n">No</button>`;
      footEl.querySelector("#wf-y").onclick = () => { game.clearSave(); game.start(Date.now()); render(); };
      footEl.querySelector("#wf-n").onclick = () => foot(v);
    };
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  render();
  return { render };
}
