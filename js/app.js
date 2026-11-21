// Store Coach front end. Everything shown is computed from report.json, which pipeline/coach.py writes.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const inrShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e7) return "₹" + (n / 1e7).toFixed(1) + "Cr";
  if (a >= 1e5) return "₹" + (n / 1e5).toFixed(1) + "L";
  if (a >= 1e3) return "₹" + (n / 1e3).toFixed(1) + "K";
  return inr(n);
};
const pct = (x, d = 1) => (x == null || isNaN(x) ? "–" : (x * 100).toFixed(d) + "%");
const initials = (name) => String(name).replace(/\./g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: fine */ } },
};
const LEVER = { "More bills": "bills", "Bigger baskets": "baskets", "More repeat": "repeat" };

let R; // the report
const state = { am: null, coachStore: null, coachSp: null, store: null, storeTab: "overview" };

// ---------- aggregation (all from raw sums, so groups add up exactly) ----------
function agg(list) {
  const t = { bills: 0, rev: 0, items: 0, disc: 0, mrpv: 0, conv_bills: 0, footfall: 0 };
  list.forEach((x) => Object.keys(t).forEach((k) => (t[k] += x[k] || 0)));
  return {
    ...t,
    abv: t.bills ? t.rev / t.bills : NaN,
    ipb: t.bills ? t.items / t.bills : NaN,
    conv: t.footfall ? t.conv_bills / t.footfall : NaN,
    disc_rate: t.mrpv ? t.disc / t.mrpv : NaN,
  };
}
const storesOf = (am) => am.stores.filter((s) => R.kpis[s]);
const period = (ids, key) => agg(ids.map((s) => R.kpis[s][key]));
const weekly = (ids) => R.kpis[ids[0]].weeks.map((w, i) => ({ week: w.week_ending, ...agg(ids.map((s) => R.kpis[s].weeks[i])) }));
function repeatRate(ids) {
  let s = 0, c = 0;
  ids.forEach((id) => { s += R.kpis[id].repeat_sum; c += R.kpis[id].repeat_count; });
  return c ? s / c : NaN;
}
function delta(cur, prev, mode = "pct") {
  if (!isFinite(cur) || !isFinite(prev) || prev === 0) return `<div class="delta flat">no earlier data</div>`;
  const d = mode === "pts" ? (cur - prev) * 100 : (cur / prev - 1) * 100;
  const cls = Math.abs(d) < 0.05 ? "flat" : d > 0 ? "up" : "down";
  const arrow = cls === "up" ? "↑" : cls === "down" ? "↓" : "→";
  return `<div class="delta ${cls}">${arrow} ${d > 0 ? "+" : ""}${d.toFixed(1)}${mode === "pts" ? " pts" : "%"} vs previous 28 days</div>`;
}
const dShort = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// ---------- charts (single series each; no dual axes) ----------
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function barChart(points, val, fmt, axisFmt = fmt) {
  const W = 620, H = 210, L = 46, B = 26, T = 10, max = niceMax(Math.max(...points.map(val)));
  const step = (W - L) / points.length, bw = Math.min(28, step * 0.55);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  let g = "";
  [0, 0.5, 1].forEach((f) => { const yy = y(max * f); g += `<line class="gl" x1="${L}" x2="${W}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 4}" text-anchor="end">${axisFmt(max * f)}</text>`; });
  points.forEach((p, i) => {
    const x = L + step * i + (step - bw) / 2, v = val(p), yy = y(v), h = H - B - yy;
    const tip = `Week to ${dShort(p.week)}: ${fmt(v)}`;
    g += `<rect class="hit" x="${L + step * i}" y="${T}" width="${step}" height="${H - T - B}" data-tip="${esc(tip)}"/>`;
    g += `<path class="b" d="M${x},${H - B} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(h - 4, 0)} z" data-tip="${esc(tip)}"/>`;
    if (i % 2 === 1 || points.length <= 6) g += `<text class="ax" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${dShort(p.week)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg></div>`;
}
function lineChart(points, val, fmt, axisFmt = fmt, area = false) {
  const W = 620, H = 190, L = 46, B = 26, T = 12;
  const vals = points.map(val).filter(isFinite);
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = (hi0 - lo0) * 0.25 || hi0 * 0.1 || 1;
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const step = (W - L - 10) / (points.length - 1);
  const x = (i) => L + 5 + step * i, y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let g = "";
  [lo, (lo + hi) / 2, hi].forEach((v) => { g += `<line class="gl" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${axisFmt(v)}</text>`; });
  const pts = points.map((p, i) => [x(i), y(val(p))]).filter((q) => isFinite(q[1]));
  const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");
  if (area) g += `<path class="area" d="${d} L${pts.at(-1)[0]},${H - B} L${pts[0][0]},${H - B} Z"/>`;
  g += `<path class="ln" d="${d}"/>`;
  points.forEach((p, i) => {
    const v = val(p); if (!isFinite(v)) return;
    const tip = `Week to ${dShort(p.week)}: ${fmt(v)}`;
    g += `<rect class="hit" x="${x(i) - step / 2}" y="${T}" width="${step}" height="${H - T - B}" data-tip="${esc(tip)}"/>`;
    g += `<circle class="pt" cx="${x(i)}" cy="${y(v)}" r="4" data-tip="${esc(tip)}"/>`;
    if (i % 2 === 1) g += `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${dShort(p.week)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg></div>`;
}
document.addEventListener("mousemove", (e) => {
  const tip = $("#tip"), t = e.target.closest?.("[data-tip]");
  if (!t) { tip.style.opacity = 0; return; }
  tip.textContent = t.dataset.tip;
  tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + "px";
  tip.style.top = e.clientY - 34 + "px";
  tip.style.opacity = 1;
});

// ---------- pieces ----------
const kpi = (icon, value, label, deltaHtml = "") => `<div class="card kpi"><div class="kic">${icon}</div><div class="val">${value}</div><div class="lbl">${label}</div>${deltaHtml}</div>`;
const alertKey = (a) => `${R.as_of}|${a.store_id}|${a.title}`;
function alertRow(a, i) {
  return `<div class="alert">
    <span class="num">${i + 1}</span>
    <div><h3><span class="lever ${LEVER[a.lever] || ""}">${esc(a.lever)}</span>${esc(a.title)}</h3>
      <p><span class="lbl2">Why</span>${esc(a.cause)}</p>
      <p class="do"><span class="lbl2">Do</span>${esc(a.action)}</p></div>
    <div class="stake"><b>${inrShort(a.rupees_week)}</b><span>at stake / week</span></div>
  </div>`;
}
function roleModels(am) {
  if (!am.role_models?.length) return "";
  return `<div class="card"><h2>Role models: customers come back to them</h2>
    <ul class="rm">${am.role_models.map((m) => `<li><b>${esc(m.name)}</b> (${esc(m.store_id)}): ${pct(m.rate)} of first-time customers came back vs ${pct(m.store_rate)} for the store. Ask them to show the team how.</li>`).join("")}</ul></div>`;
}

// ---------- views ----------
function viewDashboard(am) {
  const ids = storesOf(am), cur = period(ids, "cur"), prev = period(ids, "prev"), wk = weekly(ids);
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const n = am.alerts.length;
  return `<div class="head"><div><h1>${greet}, ${esc(am.name.split(" ")[0])}</h1><p class="sub">Area Manager · ${esc(am.city)} · ${ids.length} stores</p></div><span class="pill">Last 28 days to ${dShort(R.as_of)}</span></div>
  <div class="stack">
    <div class="grid g4">
      ${kpi("🧾", cur.bills.toLocaleString("en-IN"), "Total bills", delta(cur.bills, prev.bills))}
      ${kpi("🛍", inr(cur.abv), "Avg basket (₹ per bill)", delta(cur.abv, prev.abv))}
      ${kpi("🚪", pct(cur.conv), "Conversion (bills ÷ walk-ins)", delta(cur.conv, prev.conv, "pts"))}
      ${kpi("↻", pct(repeatRate(ids)), "Repeat customers", `<div class="delta flat">of first-time buyers in the last 12 months</div>`)}
    </div>
    <a class="banner" href="#insights"><span class="spark">✦</span><div><b>You have ${n} action item${n === 1 ? "" : "s"} this week</b><span class="small muted">Ranked by rupees at stake. Each names the cause and one action.</span></div><span class="go">View all →</span></a>
    <div class="grid g2">
      <div class="card"><div class="chart-title"><h2>Bills per week</h2><span class="small muted">${esc(am.city)}, all stores</span></div>${barChart(wk, (p) => p.bills, (v) => Math.round(v).toLocaleString("en-IN") + " bills", (v) => Math.round(v))}</div>
      <div class="card"><div class="chart-title"><h2>Conversion per week</h2><span class="small muted">bills ÷ walk-ins</span></div>${lineChart(wk, (p) => p.conv, (v) => pct(v), (v) => pct(v, 0))}</div>
    </div>
    <div class="card"><div class="chart-title"><h2>Top actions</h2><a class="small" href="#insights">See all ${n}</a></div>${am.alerts.slice(0, 3).map(alertRow).join("") || `<p class="muted">No store needs attention this week.</p>`}</div>
    ${roleModels(am)}
  </div>`;
}

function viewInsights(am) {
  const total = am.alerts.reduce((s, a) => s + a.rupees_week, 0);
  return `<div class="head"><div><h1>AI Insights &amp; Alerts</h1><p class="sub">${esc(am.city)} · at most 5 a week, ranked by rupees at stake</p></div><span class="pill">This week</span></div>
  <div class="stack">
    <div class="banner"><span class="spark">✦</span><div><b>You have ${am.alerts.length} action items this week</b><span class="small muted">About ${inrShort(total)} a week at stake across your stores</span></div></div>
    <div class="card">${am.alerts.map(alertRow).join("") || `<p class="muted">No store needs attention this week.</p>`}</div>
    ${roleModels(am)}
    <p class="small muted">How it decides: each store is compared with what its own same weeks last year predict (so festival and wedding swings don't trigger alerts) and with other stores in the same city. If every store in a city slows down, it is reported as a market issue. Numbers that can't be right go to Data Issues, never here.</p>
  </div>`;
}

function viewCoach(am) {
  const ids = storesOf(am);
  if (!ids.includes(state.coachStore)) state.coachStore = ids[0];
  const cards = R.cards.filter((c) => c.store_id === state.coachStore);
  if (!cards.find((c) => c.salesperson_id === state.coachSp)) state.coachSp = (cards.find((c) => c.lever !== "strong") || cards[0])?.salesperson_id;
  const c = cards.find((x) => x.salesperson_id === state.coachSp);
  const people = cards.map((x) => `<button class="person ${x.salesperson_id === state.coachSp ? "on" : ""}" data-sp="${x.salesperson_id}"><span class="flag ${x.lever === "strong" ? "ok" : ""}"></span>${esc(x.name)}</button>`).join("");
  let body = `<div class="card"><p class="muted">No active salespeople with enough bills in this store yet.</p></div>`;
  if (c) {
    const fmt = (k, v) => (k === "ipb" ? v.toFixed(2) : pct(v, 1));
    const rows = Object.entries(c.metrics || {}).map(([k, m]) => {
      const max = Math.max(m.me, m.peer_median) * 1.3 || 1;
      return `<div class="row"><span>${esc(m.label)}${m.higher_is_better ? "" : ' <span class="muted small">(lower is better)</span>'}</span>
        <div class="track" data-tip="${esc(`You ${fmt(k, m.me)} · store peers' median ${fmt(k, m.peer_median)}`)}"><div class="fill" style="width:${(m.me / max) * 100}%"></div><div class="peerline" style="left:${(m.peer_median / max) * 100}%"></div></div>
        <span class="v">${fmt(k, m.me)}</span></div>`;
    }).join("");
    const gotKey = `got|${R.as_of}|${c.salesperson_id}`, got = store.get(gotKey, false);
    body = `<div class="grid g2">
      <div class="stack">
        <div class="card who"><span class="avatar lg">${initials(c.name)}</span><div><h2>${esc(c.name)}</h2><div class="muted small">${esc(c.salesperson_id)} · ${esc(c.store_id)} · ${c.bills_90d} bills in 90 days</div>
          <span class="status ${c.lever === "strong" ? "ok" : ""}">${c.lever === "strong" ? "On track: coach others" : "Needs focus"}</span></div></div>
        <div class="card bars"><h2>Your performance vs your store's peers</h2>${rows || '<p class="muted">Not enough bills to compare yet.</p>'}
          <div class="key">Orange bar = you · dark line = median of your store's peers · last 90 days</div></div>
      </div>
      <div class="dcoach"><div class="t">💡 Your daily coach</div>
        <blockquote>“${esc(c.action.replace(/^Today:\s*/, ""))}”</blockquote>
        <p class="why">${esc(c.behaviour)} ${esc(c.peer)}</p>
        <button class="btn ${got ? "done" : ""}" id="gotit">${got ? "✓ Done for today" : "Got it!"}</button>
        <div class="wc">Card: ${c.words} words (limit 60)</div></div>
    </div>`;
  }
  return `<div class="head"><div><h1>Salesperson Coach</h1><p class="sub">One behaviour, a peer from the same store, one action for today</p></div>
    <select class="pill" id="coach-store">${ids.map((s) => `<option ${s === state.coachStore ? "selected" : ""}>${s}</option>`).join("")}</select></div>
  <div class="stack"><div class="people">${people}</div>${body}</div>`;
}

function viewStores(am) {
  const ids = storesOf(am);
  if (!ids.includes(state.store)) state.store = (am.alerts[0]?.store_id.split(",")[0].trim()) || ids[0];
  if (!ids.includes(state.store)) state.store = ids[0];
  const s = state.store, cur = period([s], "cur"), prev = period([s], "prev"), wk = weekly([s]), info = R.stores[s];
  const tabs = `<div class="seg"><button data-tab="overview" class="${state.storeTab === "overview" ? "on" : ""}">Overview</button><button data-tab="people" class="${state.storeTab === "people" ? "on" : ""}">Salespeople</button></div>`;
  let body;
  if (state.storeTab === "people") {
    const cards = R.cards.filter((c) => c.store_id === s);
    const m = (c, k, f) => (c.metrics?.[k] ? f(c.metrics[k].me) : "–");
    body = `<div class="card tablewrap"><table><thead><tr><th>Salesperson</th><th class="n">Bills (90d)</th><th class="n">Items / bill</th><th class="n">Jacket with kurta</th><th class="n">Discount</th><th class="n">Return rate</th><th>Today's focus</th></tr></thead><tbody>
      ${cards.map((c) => `<tr><td><b>${esc(c.name)}</b><div class="small muted">${esc(c.salesperson_id)}</div></td><td class="n">${c.bills_90d}</td><td class="n">${m(c, "ipb", (v) => v.toFixed(2))}</td><td class="n">${m(c, "ku_att", (v) => pct(v, 0))}</td><td class="n">${m(c, "disc_rate", (v) => pct(v))}</td><td class="n">${m(c, "rep", (v) => pct(v))}</td><td class="small">${esc(c.behaviour)}</td></tr>`).join("")}
    </tbody></table></div>`;
  } else {
    const sa = am.alerts.filter((a) => a.store_id.includes(s));
    body = `<div class="grid g4">
        ${kpi("🧾", cur.bills.toLocaleString("en-IN"), "Bills", delta(cur.bills, prev.bills))}
        ${kpi("🚪", pct(cur.conv), "Conversion", delta(cur.conv, prev.conv, "pts"))}
        ${kpi("🛍", inr(cur.abv), "Avg basket", delta(cur.abv, prev.abv))}
        ${kpi("🧺", isFinite(cur.ipb) ? cur.ipb.toFixed(2) : "–", "Items per bill", delta(cur.ipb, prev.ipb))}
      </div>
      <div class="grid g2">
        <div class="card"><h2>Bills per week</h2>${barChart(wk, (p) => p.bills, (v) => Math.round(v) + " bills", (v) => Math.round(v))}</div>
        <div class="card"><h2>Conversion per week</h2>${lineChart(wk, (p) => p.conv, (v) => pct(v), (v) => pct(v, 0))}</div>
      </div>
      <div class="card"><h2>Alerts for ${s}</h2>${sa.map(alertRow).join("") || `<p class="muted">No alerts for this store this week.</p>`}</div>`;
  }
  return `<div class="head"><div><h1>Store Performance</h1><p class="sub">${esc(s)} · ${esc(info.city)} · tier ${esc(info.tier)}${info.new ? " · new store" : ""}</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><select class="pill" id="store-select">${ids.map((x) => `<option ${x === s ? "selected" : ""}>${x}</option>`).join("")}</select><span class="pill">Last 28 days</span></div></div>
  <div class="stack">${tabs}${body}</div>`;
}

function viewFollowup(am) {
  const pending = am.alerts.filter((a) => !store.get("done|" + alertKey(a), false)).length;
  const vcls = { improved: "improved", "got worse": "worse", "has not moved": "flat" };
  return `<div class="head"><div><h1>Follow-Up Tracker</h1><p class="sub">A week later: did the number move?</p></div></div>
  <div class="stack">
    <div class="banner"><span class="spark">📋</span><div><b>${pending} action${pending === 1 ? "" : "s"} pending</b><span class="small muted">Mark an action done once the store has carried it out</span></div></div>
    <div class="card"><h2>This week's actions</h2>${am.alerts.map((a, i) => {
      const done = store.get("done|" + alertKey(a), false);
      return `<div class="fu"><span class="num">${i + 1}</span><div><b>${esc(a.title)}</b><div class="small muted">${esc(a.action)}</div></div>
        <button class="btn ghost" data-done="${esc(alertKey(a))}">${done ? "✓ Done" : "Mark done"}</button></div>`;
    }).join("") || `<p class="muted">Nothing to do this week.</p>`}</div>
    <div class="card"><h2>Last week's alerts: checked today</h2>${am.follow_up.map((f, i) => `<div class="fu"><span class="num">${i + 1}</span><div><b>${esc(f.title)}</b><div class="small muted">${esc(f.text)}</div></div><span class="st ${vcls[f.verdict]}">${esc(f.verdict)}</span></div>`).join("") || `<p class="muted">No alerts last week to follow up.</p>`}</div>
  </div>`;
}

function viewImpact(am) {
  const ids = storesOf(am), cur = period(ids, "cur"), prev = period(ids, "prev"), wk = weekly(ids);
  const revChg = prev.rev ? cur.rev / prev.rev - 1 : NaN;
  const fu = am.follow_up, imp = fu.filter((f) => f.verdict === "improved").length, worse = fu.filter((f) => f.verdict === "got worse");
  const signed = (v, d = 1, unit = "%") => (isFinite(v) ? (v > 0 ? "+" : "") + v.toFixed(d) + unit : "–");
  const top = am.alerts[0];
  return `<div class="head"><div><h1>Impact Summary</h1><p class="sub">${esc(am.city)} · last 28 days vs the 28 days before</p></div></div>
  <div class="stack">
    <div class="hero"><div style="font-size:2rem">🏆</div><div class="big">${signed(revChg * 100)}</div><b>Revenue, last 28 days vs previous 28</b><div class="small muted">${inrShort(cur.rev)} vs ${inrShort(prev.rev)} · includes normal festival and wedding season swings</div></div>
    <div class="grid g3">
      ${kpi("🧾", signed((cur.bills / prev.bills - 1) * 100), "More bills")}
      ${kpi("🧺", signed((cur.ipb / prev.ipb - 1) * 100), "Bigger baskets (items per bill)")}
      ${kpi("🚪", signed((cur.conv - prev.conv) * 100, 1, " pts"), "Conversion")}
    </div>
    <div class="grid g2">
      <div class="card"><h2>Key takeaways</h2><ul class="ticks">
        <li>${imp} of last week's ${fu.length} alert${fu.length === 1 ? "" : "s"} improved after the action.</li>
        ${worse.map((f) => `<li class="warn">${esc(f.store_id)} got worse: ${esc(f.title)}. Escalate this week.</li>`).join("")}
        ${top ? `<li class="warn">Biggest at stake now: ${esc(top.title)} (${inrShort(top.rupees_week)} a week).</li>` : ""}
        ${am.role_models?.[0] ? `<li>Copy ${esc(am.role_models[0].name)} (${esc(am.role_models[0].store_id)}): ${pct(am.role_models[0].rate)} of customers come back.</li>` : ""}
      </ul></div>
      <div class="card"><h2>Revenue per week</h2>${lineChart(wk, (p) => p.rev, inrShort, inrShort, true)}</div>
    </div>
  </div>`;
}

function viewData() {
  return `<div class="head"><div><h1>Data Issues</h1><p class="sub">Numbers that can't be right. Left out of the analysis and never sent to area managers.</p></div></div>
  <div class="stack">${R.data_issues.map((d) => `<div class="card"><h2>${esc(d.store_id)}: ${esc(d.issue)}</h2><p class="muted">${esc(d.detail)}</p></div>`).join("") || `<div class="card"><p>No data issues found.</p></div>`}</div>`;
}

const VIEWS = { dashboard: viewDashboard, insights: viewInsights, coach: viewCoach, stores: viewStores, followup: viewFollowup, impact: viewImpact, data: viewData };
const TITLES = { dashboard: "Dashboard", insights: "AI Insights", coach: "Salesperson Coach", stores: "Store Performance", followup: "Follow-Up", impact: "Impact Summary", data: "Data Issues" };

function render() {
  const v = (location.hash || "#dashboard").slice(1);
  const view = VIEWS[v] ? v : "dashboard";
  const am = R.area_managers.find((a) => a.id === state.am) || R.area_managers[0];
  $("#view").innerHTML = VIEWS[view](am);
  $("#top-title").textContent = TITLES[view];
  document.querySelectorAll("[data-view]").forEach((a) => a.classList.toggle("on", a.dataset.view === view));
  $("#am-avatar").textContent = initials(am.name);
  $("#am-sub").textContent = `Area Manager · ${am.city}`;
  $("#nav-alerts").textContent = am.alerts.length || "";
  $("#bell-dot").style.display = am.alerts.length ? "" : "none";
  closeMenu();
}

// ---------- events ----------
function closeMenu() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("open"); }
$("#menu").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("open"); });
$("#scrim").addEventListener("click", closeMenu);
addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
$("#am-select").addEventListener("change", (e) => { state.am = e.target.value; store.set("am", state.am); state.coachSp = null; state.store = null; render(); });
$("#view").addEventListener("change", (e) => {
  if (e.target.id === "coach-store") { state.coachStore = e.target.value; state.coachSp = null; render(); }
  if (e.target.id === "store-select") { state.store = e.target.value; render(); }
});
$("#view").addEventListener("click", (e) => {
  const sp = e.target.closest("[data-sp]");
  if (sp) { state.coachSp = sp.dataset.sp; render(); return; }
  const tab = e.target.closest("[data-tab]");
  if (tab) { state.storeTab = tab.dataset.tab; render(); return; }
  const d = e.target.closest("[data-done]");
  if (d) { const k = "done|" + d.dataset.done; store.set(k, !store.get(k, false)); render(); return; }
  if (e.target.id === "gotit") { const k = `got|${R.as_of}|${state.coachSp}`; store.set(k, !store.get(k, false)); render(); }
});

async function main() {
  R = await (await fetch("report.json", { cache: "no-store" })).json();
  $("#am-select").innerHTML = R.area_managers.map((a) => `<option value="${a.id}">${esc(a.name)} · ${esc(a.city)}</option>`).join("");
  state.am = store.get("am", R.area_managers[0].id);
  if (!R.area_managers.find((a) => a.id === state.am)) state.am = R.area_managers[0].id;
  $("#am-select").value = state.am;
  const total = R.area_managers.reduce((s, a) => s + a.alerts.length, 0);
  $("#runbox").innerHTML = `Data to <b>${dShort(R.as_of)}</b> · runs every morning<br>Last run <b>${esc(R.generated_at)}</b><br>${total} alerts · ${R.cards.length} salesperson cards`;
  render();
}
main().catch((e) => { $("#view").innerHTML = `<div class="card"><p>Could not load today's report: ${esc(e.message)}</p></div>`; });
