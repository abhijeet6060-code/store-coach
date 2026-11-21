// Store Coach: front end. Analysis numbers come only from report.json (pipeline/coach.py).
// Follow-ups, remarks, photos and visit notes are demo updates saved in this browser.
import * as T from "./tasks.js";
import { icon } from "./icons.js";

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
const pct = (x, d = 1) => (x == null || !isFinite(x) ? "–" : (x * 100).toFixed(d) + "%");
const initials = (name) => String(name).replace(/[.,]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const LEVER = { "More bills": "bills", "Bigger baskets": "baskets", "More repeat": "repeat" };
const actionText = (a) => { const t = String(a).replace(/^Today:\s*/, ""); return t.charAt(0).toUpperCase() + t.slice(1); };
const dShort = (iso) => new Date(String(iso).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const dTime = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

let R;
const S = { role: "Area Manager", am: null, sm: null, sp: null, spStore: null, coachStore: null, coachSp: null, storeTab: "overview", fuFilter: "open", sort: "status", q: "", health: "all", draft: null, flash: null };

// ---------------- aggregation ----------------
function agg(list) {
  const t = { bills: 0, rev: 0, items: 0, disc: 0, mrpv: 0, conv_bills: 0, footfall: 0 };
  list.forEach((x) => Object.keys(t).forEach((k) => (t[k] += x[k] || 0)));
  return { ...t, abv: t.bills ? t.rev / t.bills : NaN, ipb: t.bills ? t.items / t.bills : NaN, conv: t.footfall ? t.conv_bills / t.footfall : NaN };
}
const amObj = () => R.area_managers.find((a) => a.id === S.am) || R.area_managers[0];
const storesOf = (am) => am.stores.filter((s) => R.kpis[s]);
const period = (ids, key) => agg(ids.map((s) => R.kpis[s][key]));
const weekly = (ids) => R.kpis[ids[0]].weeks.map((w, i) => ({ week: w.week_ending, ...agg(ids.map((s) => R.kpis[s].weeks[i])) }));
const repeatRate = (ids) => { let s = 0, c = 0; ids.forEach((id) => { s += R.kpis[id].repeat_sum; c += R.kpis[id].repeat_count; }); return c ? s / c : NaN; };
function delta(cur, prev, mode = "pct") {
  if (!isFinite(cur) || !isFinite(prev) || prev === 0) return `<div class="delta flat">no earlier data</div>`;
  const d = mode === "pts" ? (cur - prev) * 100 : (cur / prev - 1) * 100;
  const cls = Math.abs(d) < 0.05 ? "flat" : d > 0 ? "up" : "down";
  return `<div class="delta ${cls}">${cls === "up" ? "↑" : cls === "down" ? "↓" : "→"} ${d > 0 ? "+" : ""}${d.toFixed(1)}${mode === "pts" ? " pts" : "%"} vs previous 28 days</div>`;
}
// Why a 28-day comparison may jump: festivals / wedding days in each window (from calendar.csv).
function seasonText(ids) {
  const states = [...new Set(ids.map((s) => R.stores[s]?.state).filter(Boolean))];
  const parts = new Set();
  states.forEach((st) => {
    const x = R.season?.[st];
    if (!x) return;
    const now = x.cur_festivals.filter((f) => !x.prev_festivals.includes(f));
    if (now.length) parts.add(`${now.join(", ")} falls in the latest 28 days, not the 28 before`);
    if (x.cur_wedding_days !== x.prev_wedding_days) parts.add(`${x.cur_wedding_days} vs ${x.prev_wedding_days} wedding days`);
    if (x.next_festival) parts.add(`${x.next_festival.name} on ${dShort(x.next_festival.date)} (pre-festival buying)`);
  });
  return parts.size ? [...parts].join(" · ") : "";
}
const seasonTag = (ids) => { const t = seasonText(ids); return t ? `<div class="season"><span class="stag">Festival season</span>${esc(t)}. Growth here is not a like-for-like comparison; alerts use season-adjusted baselines.</div>` : ""; };
const growth = (sid) => { const c = R.kpis[sid].cur.rev, p = R.kpis[sid].prev.rev; return p ? c / p - 1 : NaN; };
const tasksFor = (sid) => T.all().filter((t) => t.store_id === sid);
const issuesFor = (sid) => R.data_issues.filter((d) => d.store_id === sid);

// Store health: from real alerts + follow-up state. Grey when the store is too new to judge.
function health(sid) {
  const info = R.stores[sid], al = R.store_alerts[sid] || [];
  const overdue = tasksFor(sid).filter((t) => T.displayStatus(t) === "Overdue").length;
  const stake = al.reduce((s, a) => s + a.rupees_week, 0);
  if (info.new) return { k: "grey", label: "Insufficient data", why: "Opened less than 6 months ago" };
  if (al.some((a) => a.lever === "More bills" && a.rupees_week >= 20000) || stake >= 40000 || overdue >= 2)
    return { k: "red", label: "Critical", why: `${al.length} issue${al.length === 1 ? "" : "s"}, ${inrShort(stake)}/week at stake${overdue ? `, ${overdue} overdue` : ""}` };
  if (al.length || overdue) return { k: "amber", label: "Needs attention", why: `${al.length} issue${al.length === 1 ? "" : "s"}${stake ? `, ${inrShort(stake)}/week at stake` : ""}${overdue ? `, ${overdue} overdue` : ""}` };
  return { k: "green", label: "Healthy", why: "No issues found this week" };
}

// ---------------- charts (one series each, no dual axes) ----------------
function niceMax(v) { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
function barChart(points, val, fmt, axisFmt = fmt) {
  const W = 620, H = 210, L = 46, B = 26, T0 = 10, max = niceMax(Math.max(...points.map(val)));
  const step = (W - L) / points.length, bw = Math.min(28, step * 0.55), y = (v) => T0 + (H - T0 - B) * (1 - v / max);
  let g = "";
  [0, 0.5, 1].forEach((f) => { const yy = y(max * f); g += `<line class="gl" x1="${L}" x2="${W}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 4}" text-anchor="end">${axisFmt(max * f)}</text>`; });
  points.forEach((p, i) => {
    const x = L + step * i + (step - bw) / 2, v = val(p), h = Math.max(H - B - y(v), 0), tip = esc(`Week to ${dShort(p.week)}: ${fmt(v)}`);
    g += `<rect class="hit" x="${L + step * i}" y="${T0}" width="${step}" height="${H - T0 - B}" data-tip="${tip}"/>`;
    g += `<path class="b" d="M${x},${H - B} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(h - 4, 0)} z" data-tip="${tip}"/>`;
    if (i % 2 === 1) g += `<text class="ax" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${dShort(p.week)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg></div>`;
}
function lineChart(points, val, fmt, axisFmt = fmt, area = false) {
  const W = 620, H = 190, L = 46, B = 26, T0 = 12, vals = points.map(val).filter(isFinite);
  if (!vals.length) return `<p class="muted">No data.</p>`;
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = (hi0 - lo0) * 0.25 || hi0 * 0.1 || 1, lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const step = (W - L - 10) / (points.length - 1), x = (i) => L + 5 + step * i, y = (v) => T0 + (H - T0 - B) * (1 - (v - lo) / (hi - lo));
  let g = "";
  [lo, (lo + hi) / 2, hi].forEach((v) => { g += `<line class="gl" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${axisFmt(v)}</text>`; });
  const pts = points.map((p, i) => [x(i), y(val(p))]).filter((q) => isFinite(q[1]));
  const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + "," + q[1].toFixed(1)).join(" ");
  if (area) g += `<path class="area" d="${d} L${pts.at(-1)[0]},${H - B} L${pts[0][0]},${H - B} Z"/>`;
  g += `<path class="ln" d="${d}"/>`;
  points.forEach((p, i) => {
    const v = val(p); if (!isFinite(v)) return;
    const tip = esc(`Week to ${dShort(p.week)}: ${fmt(v)}`);
    g += `<rect class="hit" x="${x(i) - step / 2}" y="${T0}" width="${step}" height="${H - T0 - B}" data-tip="${tip}"/><circle class="pt" cx="${x(i)}" cy="${y(v)}" r="4" data-tip="${tip}"/>`;
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

// ---------------- shared pieces ----------------
const kpi = (icon, value, label, sub = "", cls = "") => `<div class="card kpi ${cls}"><div class="kic">${icon}</div><div class="val">${value}</div><div class="lbl">${label}</div>${sub}</div>`;
const flash = () => { if (!S.flash) return ""; const f = S.flash; S.flash = null; return `<div class="flash ${f.k}">${esc(f.msg)}</div>`; };
const head = (title, sub, right = "") => `<div class="head"><div><h1>${title}</h1><p class="sub">${sub}</p></div>${right}</div>${flash()}`;
const issueKey = (sid, a) => `${sid}|${a.title}`;
const openTaskFor = (sid, a) => T.all().find((t) => T.isOpen(t) && t.issue_key === issueKey(sid, a));
const stClass = (s) => ({ Pending: "pending", "In Progress": "progress", Submitted: "submitted", "Under Review": "review", Completed: "done", Overdue: "overdue" }[s]);
const stPill = (t) => { const s = T.displayStatus(t); return `<span class="st ${stClass(s)}">${s}</span>`; };

function alertRow(a, i, sid, withFU = true) {
  const store = sid || a.store_id.split(",")[0].trim();
  const ft = withFU && S.role === "Area Manager" ? openTaskFor(store, a) : null;
  const fu = !withFU ? "" : S.role !== "Area Manager" ? "" : ft
    ? `<a class="btn ghost" href="#task/${ft.id}">${ft.id} · ${T.displayStatus(ft)}</a>`
    : `<button class="btn ghost" data-newfu="${esc(store)}" data-title="${esc(a.title)}">+ Create follow-up</button>`;
  return `<div class="alert">
    <span class="num">${i + 1}</span>
    <div><h3><span class="lever ${LEVER[a.lever] || ""}">${esc(a.lever)}</span>${esc(a.title)}</h3>
      <p class="do">${esc(a.action)}</p>
      <details class="more"><summary>Why? Evidence &amp; details</summary>
        <p>${esc(a.cause)}</p>
        <div class="meta-row"><span>Owner: Store Manager, ${esc(store)}</span><span>Confidence: ${confidence(a)}</span></div></details>
      ${fu ? `<div class="fu-btn">${fu}</div>` : ""}</div>
    <div class="stake"><b>${inrShort(a.rupees_week)}</b><span>at stake / week</span></div>
  </div>`;
}
function confidence(a) {
  // Confidence from how far the metric is from its baseline (all measured, not guessed).
  if (a.now == null || a.expected == null || !a.expected) return "Medium";
  const gap = Math.abs(a.now / a.expected - 1);
  return gap >= 0.5 ? "High" : gap >= 0.15 ? "Medium" : "Low";
}
function roleModels(am) {
  if (!am.role_models?.length) return "";
  return `<div class="card"><h2>Role models: customers come back to them</h2><ul class="rm">${am.role_models.map((m) => `<li><b>${esc(m.name)}</b> (${esc(m.store_id)}): ${pct(m.rate)} of first-time customers came back vs ${pct(m.store_rate)} for the store.</li>`).join("")}</ul></div>`;
}
function coachDetail(c, showGot = true) {
  const fmt = (k, v) => (k === "ipb" ? v.toFixed(2) : pct(v, 1));
  const rows = Object.entries(c.metrics || {}).map(([k, m]) => {
    const max = Math.max(m.me, m.peer_median) * 1.3 || 1;
    return `<div class="row"><span>${esc(m.label)}${m.higher_is_better ? "" : ' <span class="muted small">(lower is better)</span>'}</span>
      <div class="track" data-tip="${esc(`You ${fmt(k, m.me)} · store peers' median ${fmt(k, m.peer_median)}`)}"><div class="fill" style="width:${(m.me / max) * 100}%"></div><div class="peerline" style="left:${(m.peer_median / max) * 100}%"></div></div>
      <span class="v">${fmt(k, m.me)}</span></div>`;
  }).join("");
  const got = ls.get(`got|${R.as_of}|${c.salesperson_id}`, false);
  return `<div class="grid g2">
    <div class="stack">
      <div class="card who"><span class="avatar lg">${initials(c.name)}</span><div><h2>${esc(c.name)}</h2><div class="muted small">${esc(c.salesperson_id)} · ${esc(c.store_id)} · ${c.bills_90d} bills in 90 days</div>
        <span class="status ${c.lever === "strong" ? "ok" : ""}">${c.lever === "strong" ? "On track: coach others" : "One thing to work on"}</span></div></div>
      <div class="card bars"><h2>You vs your store's peers</h2>${rows || '<p class="muted">Not enough bills to compare yet.</p>'}<div class="key">Orange bar = you · dark line = median of your store's peers · last 90 days</div></div>
    </div>
    <div class="dcoach"><div class="t">${icon("bulb")} Your coaching for today</div>
      <blockquote>“${esc(actionText(c.action))}”</blockquote>
      <p class="why">${esc(c.behaviour)} ${esc(c.peer)}</p>
      ${showGot ? `<button class="btn ${got ? "done" : ""}" data-got="${esc(c.salesperson_id)}">${got ? "✓ Done for today" : "Got it!"}</button>` : ""}
      <div class="wc">Card: ${c.words} words (limit 60)</div></div>
  </div>`;
}

// ---------------- AREA MANAGER ----------------
function vOverview() {
  const am = amObj(), ids = storesOf(am), cur = period(ids, "cur"), prev = period(ids, "prev");
  const H = ids.map((s) => ({ s, h: health(s) }));
  const cnt = (k) => H.filter((x) => x.h.k === k).length;
  const tasks = T.all().filter((t) => ids.includes(t.store_id));
  const pending = tasks.filter((t) => T.isOpen(t)).length, overdue = tasks.filter((t) => T.displayStatus(t) === "Overdue").length;
  const review = tasks.filter((t) => t.status === "Submitted" || t.status === "Under Review").length;
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const filt = S.health;
  const shown = H.filter((x) => filt === "all" || (filt === "attention" ? x.h.k === "amber" : filt === "critical" ? x.h.k === "red" : filt === "healthy" ? x.h.k === "green" : filt === "fu" ? tasksFor(x.s).some(T.isOpen) : true));
  const top = (am.alerts || []).slice(0, 3);
  return head(`${greet}, ${esc(am.name.split(" ")[0])}`, `${esc(am.city)} · ${ids.length} stores · data to ${dShort(R.as_of)}`) + `
  <div class="stack">
    <div class="grid g4 kpis-compact">
      ${kpi("", `${cnt("amber") + cnt("red")} <small>of ${ids.length}</small>`, "Stores need attention", `<div class="delta ${cnt("red") ? "down" : "flat"}">${cnt("red")} critical · ${cnt("green")} healthy</div>`)}
      ${kpi("", inrShort(cur.rev), "Sales, last 28 days", delta(cur.rev, prev.rev))}
      ${kpi("", pending, "Open follow-ups", `<div class="delta flat">${review} to review</div>`)}
      ${kpi("", overdue, "Overdue tasks", "", overdue ? "alarm" : "")}
    </div>
    ${review ? `<a class="banner" href="#followups"><span class="spark">${icon("inbox", 22)}</span><div><b>${review} follow-up${review === 1 ? "" : "s"} submitted by store managers</b><span class="small muted">Review the remarks and evidence, then approve or send back.</span></div><span class="go">Review →</span></a>` : ""}
    <div class="card">
      <div class="chart-title"><h2>Store health</h2>
        <div class="seg">${[["all", "All"], ["healthy", "Healthy"], ["attention", "Attention"], ["critical", "Critical"], ["fu", "Follow-up pending"]].map(([k, l]) => `<button data-health="${k}" class="${filt === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="hgrid">${shown.sort((a, b) => "rag".indexOf(a.h.k[0]) - "rag".indexOf(b.h.k[0])).map(({ s, h }) => `<a class="hcell ${h.k}" href="#store/${s}"><b>${s}</b><span class="hl">${h.label}</span><span class="small">${esc(h.why)}</span></a>`).join("") || `<p class="muted">No stores match this filter.</p>`}</div>
      <div class="legend"><span class="dotk green"></span>Healthy <span class="dotk amber"></span>Needs attention <span class="dotk red"></span>Critical <span class="dotk grey"></span>Insufficient data</div>
    </div>
    <div class="card"><div class="chart-title"><h2>Top issues this week</h2><a class="small" href="#insights">All ${am.alerts.length} →</a></div>${top.map((a, i) => alertRow(a, i)).join("") || `<p class="muted">No store needs attention this week.</p>`}</div>
  </div>`;
}

function vStores() {
  const am = amObj(), ids = storesOf(am), q = S.q.toLowerCase();
  let rows = ids.map((s) => {
    const k = R.kpis[s], c = agg([k.cur]), h = health(s), info = R.stores[s];
    return { s, info, h, rev: k.cur.rev, g: growth(s), conv: c.conv, ipb: c.ipb, rep: k.repeat_count ? k.repeat_sum / k.repeat_count : NaN,
      pend: tasksFor(s).filter(T.isOpen).length, stake: (R.store_alerts[s] || []).reduce((x, a) => x + a.rupees_week, 0), issues: (R.store_alerts[s] || []).length };
  }).filter((r) => !q || (r.s + " " + r.info.city + " " + r.info.tier).toLowerCase().includes(q));
  const sorters = { status: (a, b) => "rag".indexOf(a.h.k[0]) - "rag".indexOf(b.h.k[0]) || b.stake - a.stake, growth: (a, b) => (a.g || 0) - (b.g || 0), conv: (a, b) => (a.conv || 0) - (b.conv || 0), pend: (a, b) => b.pend - a.pend, stake: (a, b) => b.stake - a.stake };
  rows.sort(sorters[S.sort]);
  const sg = (v) => (isFinite(v) ? `<span class="${v >= 0 ? "pos" : "neg"}">${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%</span>` : "–");
  return head("My Stores", `${esc(am.city)} · ${ids.length} stores · last 28 days to ${dShort(R.as_of)}`) + `
  <div class="toolbar"><input class="pill search" id="store-q" placeholder="Search store, city, tier" value="${esc(S.q)}">
    <select class="pill" id="store-sort">${[["status", "Status (worst first)"], ["stake", "Highest opportunity (₹ at stake)"], ["growth", "Lowest sales growth"], ["conv", "Lowest conversion"], ["pend", "Most pending follow-ups"]].map(([k, l]) => `<option value="${k}" ${S.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    <button class="btn ghost" data-csv="stores">${icon("download", 16)} CSV</button></div>
  <div class="card tablewrap"><table><thead><tr><th>Store</th><th>City</th><th>Manager</th><th class="n">Sales (28d)</th><th class="n">Growth</th><th class="n">Conversion</th><th class="n">Items/bill</th><th class="n">Repeat</th><th class="n">Issues</th><th class="n">Open FUs</th><th>Status</th></tr></thead><tbody>
  ${rows.map((r) => `<tr class="click" data-href="#store/${r.s}"><td><b>${r.s}</b><div class="small muted">Tier ${esc(r.info.tier)}${r.info.new ? " · new" : ""}</div></td><td>${esc(r.info.city)}</td><td class="small">Store Manager, ${r.s}</td><td class="n">${inrShort(r.rev)}</td><td class="n">${sg(r.g)}</td><td class="n">${pct(r.conv)}</td><td class="n">${isFinite(r.ipb) ? r.ipb.toFixed(2) : "–"}</td><td class="n">${pct(r.rep)}</td><td class="n">${r.issues}</td><td class="n">${r.pend}</td><td><span class="hs ${r.h.k}">${r.h.label}</span></td></tr>`).join("")}
  </tbody></table></div>
  ${seasonTag(ids)}
  <p class="small muted">Click a store to open it. Growth = last 28 days vs the 28 before.</p>`;
}

function vStoreProfile(sid) {
  const info = R.stores[sid];
  if (!info) return head("Store not found", "");
  const k = R.kpis[sid], cur = agg([k.cur]), prev = agg([k.prev]), wk = weekly([sid]), h = health(sid);
  const al = R.store_alerts[sid] || [], tasks = tasksFor(sid), cards = R.cards.filter((c) => c.store_id === sid);
  const tabs = [["overview", "Overview"], ["insights", `AI insights (${al.length})`], ["staff", "Staff"], ["followups", `Follow-ups (${tasks.length})`]];
  if (!tabs.some(([t]) => t === S.storeTab)) S.storeTab = "overview";
  let body = "";
  if (S.storeTab === "overview") {
    body = `<div class="grid g4">
        ${kpi("", inrShort(cur.rev), "Sales", delta(cur.rev, prev.rev))}
        ${kpi("", pct(cur.conv), "Conversion", delta(cur.conv, prev.conv, "pts"))}
        ${kpi("", isFinite(cur.ipb) ? cur.ipb.toFixed(2) : "–", "Items per bill", delta(cur.ipb, prev.ipb))}
        ${kpi("", pct(k.repeat_count ? k.repeat_sum / k.repeat_count : NaN), "Repeat customers", `<div class="delta flat">first-time buyers, last 12 months</div>`)}
      </div>
      ${seasonTag([sid])}
      <div class="grid g2">
        <div class="card"><h2>Bills per week</h2>${barChart(wk, (p) => p.bills, (v) => Math.round(v) + " bills", (v) => Math.round(v))}</div>
        <div class="card"><h2>Conversion per week</h2>${lineChart(wk, (p) => p.conv, (v) => pct(v), (v) => pct(v, 0))}</div>
      </div>
      ${issuesFor(sid).map((d) => `<div class="card warnbox"><b>Data issue:</b> ${esc(d.issue)}. ${esc(d.detail)}</div>`).join("")}`;
  } else if (S.storeTab === "insights") {
    body = `<div class="card">${al.map((a, i) => alertRow(a, i, sid)).join("") || `<p class="muted">No issues found for this store this week.</p>`}</div>`;
  } else if (S.storeTab === "staff") {
    const m = (c, key, f) => (c.metrics?.[key] ? f(c.metrics[key].me) : "–");
    body = `<div class="card tablewrap"><table><thead><tr><th>Salesperson</th><th class="n">Bills (90d)</th><th class="n">Items/bill</th><th class="n">Jacket w/ kurta</th><th class="n">Discount</th><th class="n">Return rate</th><th>Coaching focus</th></tr></thead><tbody>
      ${cards.map((c) => `<tr><td><b>${esc(c.name)}</b><div class="small muted">${esc(c.salesperson_id)}</div></td><td class="n">${c.bills_90d}</td><td class="n">${m(c, "ipb", (v) => v.toFixed(2))}</td><td class="n">${m(c, "ku_att", (v) => pct(v, 0))}</td><td class="n">${m(c, "disc_rate", (v) => pct(v))}</td><td class="n">${m(c, "rep", (v) => pct(v))}</td><td class="small">${esc(c.behaviour)}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">No active salespeople with enough bills yet.</td></tr>`}
    </tbody></table></div><p class="small muted">Salespeople are compared only with peers in their own store.</p>`;
  } else {
    body = `<div class="card">${taskList(tasks) || `<p class="muted">No follow-ups for this store yet.</p>`}</div>`;
  }
  const back = S.role === "Area Manager" ? `<a class="pill" href="#stores">← All stores</a>` : "";
  return head(`${sid}`, `${esc(info.city)} · tier ${esc(info.tier)} · Store Manager, ${sid}`, `<div class="row-gap">${back}<span class="hs ${h.k}">${h.label}</span>${S.role === "Area Manager" ? `<button class="btn" data-newfu="${sid}">+ New follow-up</button>` : ""}</div>`) +
    `<div class="stack"><div class="seg">${tabs.map(([t, l]) => `<button data-stab="${t}" class="${S.storeTab === t ? "on" : ""}">${l}</button>`).join("")}</div>${body}</div>`;
}

function vInsights() {
  const am = amObj(), total = am.alerts.reduce((s, a) => s + a.rupees_week, 0);
  return head("Alerts", `${am.alerts.length} this week · ${inrShort(total)} a week at stake (estimate)`, `<button class="btn ghost" data-csv="alerts">${icon("download", 16)} CSV</button>`) + `
  <div class="stack">
    <p class="hint">${icon("info", 16)} Click <b>+ Create follow-up</b> on an alert to assign it to the store manager and track it.</p>
    <div class="card">${am.alerts.map((a, i) => alertRow(a, i)).join("") || `<p class="muted">No store needs attention this week.</p>`}</div>
    ${roleModels(am)}
    <details class="more"><summary>How are these found?</summary><p class="small muted">Numbers are calculated from the data, never generated. Each store is compared with its own same weeks last year (so festival and wedding swings don't trigger alerts) and with stores in the same city. A whole city slowing down is reported as a market issue. Numbers that can't be right go to Data Issues.</p></details>
  </div>`;
}

// ---------------- follow-ups ----------------
function taskList(list) {
  return list.slice().sort((a, b) => (a.deadline > b.deadline ? 1 : -1)).map((t) => `
    <a class="fu click" href="#task/${t.id}"><span class="num pri-${t.priority.toLowerCase()}">${t.priority[0]}</span>
      <div><b>${esc(t.id)} · ${esc(t.store_id)}: ${esc(t.title)}</b><div class="small muted">${esc(t.action)}</div>
      <div class="small muted">Due ${dShort(t.deadline)} · ${esc(t.assignee)} · ${t.history.length} update${t.history.length === 1 ? "" : "s"}</div></div>${stPill(t)}</a>`).join("");
}
function fuForm() {
  const am = amObj(), ids = storesOf(am), d = S.draft || {};
  return `<form class="card form" id="fu-form">
    <h2>New follow-up</h2>
    <div class="fgrid">
      <label>Store<select name="store_id" required>${ids.map((s) => `<option ${s === d.store_id ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label>Issue category<select name="category">${["More bills", "Bigger baskets", "More repeat", "Team", "Data issue", "Other"].map((c) => `<option ${c === d.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>Priority<select name="priority">${["High", "Medium", "Low"].map((p) => `<option ${p === (d.priority || "High") ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label>Deadline<input type="date" name="deadline" required min="${T.todayISO()}" value="${d.deadline || addDays(T.todayISO(), 3)}"></label>
      <label class="wide">Title<input name="title" required maxlength="120" value="${esc(d.title || "")}" placeholder="e.g. LKO-02: conversion down"></label>
      <label class="wide">Problem (evidence)<textarea name="problem" rows="3" required>${esc(d.problem || "")}</textarea></label>
      <label class="wide">Required action (who, what, when)<textarea name="action" rows="3" required>${esc(d.action || "")}</textarea></label>
    </div>
    <div class="small muted">Assigned to: Store Manager of the selected store.</div>
    <div class="row-gap"><button class="btn" type="submit">Assign follow-up</button><button class="btn ghost" type="button" data-cancel>Cancel</button></div>
  </form>`;
}
function vFollowups() {
  const scope = S.role === "Area Manager" ? storesOf(amObj()) : [S.sm];
  const list = T.all().filter((t) => scope.includes(t.store_id));
  const F = {
    open: ["Open", (t) => T.isOpen(t)],
    today: ["Due today", (t) => T.isOpen(t) && t.deadline === T.todayISO()],
    overdue: ["Overdue", (t) => T.displayStatus(t) === "Overdue"],
    review: [S.role === "Area Manager" ? "To review" : "Submitted", (t) => t.status === "Submitted" || t.status === "Under Review"],
    done: ["Completed", (t) => t.status === "Completed"],
    all: ["History (all)", () => true],
  };
  if (!F[S.fuFilter]) S.fuFilter = "open";
  const shown = list.filter(F[S.fuFilter][1]);
  const title = S.role === "Area Manager" ? "Follow-up Manager" : "My Tasks";
  const sub = S.role === "Area Manager" ? "Assign, track, review and close actions across your stores" : `Follow-ups assigned to Store Manager, ${S.sm}`;
  return head(title, sub, S.role === "Area Manager" ? `<div class="row-gap"><button class="btn ghost" data-csv="followups">${icon("download", 16)} CSV</button><button class="btn" data-newfu="">+ New follow-up</button></div>` : "") + `
  <div class="stack">
    ${S.draft && S.role === "Area Manager" ? fuForm() : ""}
    <div class="seg wrap">${Object.entries(F).map(([k, [l, fn]]) => `<button data-fuf="${k}" class="${S.fuFilter === k ? "on" : ""}">${l} (${list.filter(fn).length})</button>`).join("")}</div>
    <div class="card">${taskList(shown) || `<p class="muted">${list.length ? "Nothing in this list." : S.role === "Area Manager" ? "No follow-ups yet. Open AI Insights and click “Create follow-up” on an alert, or use “New follow-up”." : "No tasks assigned to your store yet."}</p>`}</div>
    <p class="small muted">Demo updates (tasks, remarks, photos) are saved in this browser only, with timestamps. They are not live company data.</p>
  </div>`;
}
function vTask(id) {
  const t = T.get(id);
  if (!t) return head("Follow-up not found", "It may have been created in another browser.");
  if (S.role === "Store Manager" && t.store_id !== S.sm) return head("Not your store", "Store managers can only see their own store's follow-ups.");
  const role = S.role, by = role === "Area Manager" ? amObj().name : `Store Manager, ${t.store_id}`;
  const moves = T.allowed(t, role);
  const label = { "In Progress": t.status === "Completed" ? "Reopen" : t.status === "Under Review" ? "Send back (reject)" : "Start work", Submitted: "Submit as done", "Under Review": "Start review", Completed: "Approve & close" };
  const after = t.completed_at ? addDays(t.completed_at.slice(0, 10), 7) : null;
  const m = t.metric;
  const fmtM = (v) => (m && v != null ? (m.name === "ipb" ? Number(v).toFixed(2) : pct(v)) : "–");
  return head(`${esc(t.id)} · ${esc(t.title)}`, `${esc(t.store_id)} · ${esc(t.category)} · priority ${esc(t.priority)} · due ${dShort(t.deadline)} · ${esc(t.assignee)}`, `<div class="row-gap"><a class="pill" href="#followups">← Back</a>${stPill(t)}${role === "Area Manager" ? `<button class="btn danger" data-del="${t.id}">${icon("trash", 16)} Delete</button>` : ""}</div>`) + `
  <div class="stack">
    <div class="grid g2">
      <div class="card"><h2>Problem</h2><p>${esc(t.problem)}</p><h2>Required action</h2><p class="do">${esc(t.action)}</p></div>
      <div class="card"><h2>7-day tracking</h2>
        <div class="bar4"><div><span class="lbl2">Before</span><b>${fmtM(m?.before)}</b><span class="small muted">${m ? esc(m.label) : "no metric"} at detection</span></div>
        <div><span class="lbl2">Action</span><b>${t.completed_at ? "Done " + dShort(t.completed_at) : T.displayStatus(t)}</b><span class="small muted">${esc(t.assignee)}</span></div>
        <div><span class="lbl2">After</span><b>${after ? dShort(after) : "–"}</b><span class="small muted">${after ? "measured 7 days after completion" : "starts when completed"}</span></div>
        <div><span class="lbl2">Result</span><b>Waiting for data</b><span class="small muted">The data pack ends ${dShort(R.as_of)}; the next daily run fills this in.</span></div></div>
        <p class="small muted">A change after an action is shown as measured, not as proof the action caused it.</p></div>
    </div>
    <div class="card"><h2>Updates</h2><ol class="timeline">${t.history.slice().reverse().map((h) => `<li><div><b>${esc(h.status)}</b> · ${esc(h.by)} · <span class="muted small">${dTime(h.at)}</span></div>${h.note ? `<p>${esc(h.note)}</p>` : ""}${h.photo ? `<img class="evidence" src="${h.photo}" alt="Evidence photo from ${esc(h.by)}">` : ""}</li>`).join("")}</ol></div>
    ${moves.length || role === "Store Manager" ? `<form class="card form" id="task-form" data-id="${t.id}">
      <h2>${role === "Store Manager" ? "Update this task" : "Your review"}</h2>
      <label class="wide">${role === "Store Manager" ? "Remark (what was done, or why it is delayed)" : "Comment for the store manager"}<textarea name="note" rows="3"></textarea></label>
      ${role === "Store Manager" ? `<label class="wide">Evidence photo (optional)<input type="file" name="photo" accept="image/*"></label>` : ""}
      <div class="row-gap">${moves.map((s) => `<button class="btn ${s === "In Progress" && role === "Area Manager" && t.status === "Under Review" ? "ghost" : ""}" name="status" value="${s}" type="submit">${label[s] || s}</button>`).join("")}
        ${role === "Store Manager" ? `<button class="btn ghost" name="status" value="" type="submit">Add remark only</button>` : ""}</div>
    </form>` : ""}
  </div>`;
}

function vCoach(storeLocked) {
  const ids = storeLocked ? [storeLocked] : storesOf(amObj());
  if (!ids.includes(S.coachStore)) S.coachStore = ids[0];
  const cards = R.cards.filter((c) => c.store_id === S.coachStore);
  if (!cards.find((c) => c.salesperson_id === S.coachSp)) S.coachSp = (cards.find((c) => c.lever !== "strong") || cards[0])?.salesperson_id;
  const c = cards.find((x) => x.salesperson_id === S.coachSp);
  const done = cards.filter((x) => ls.get(`got|${R.as_of}|${x.salesperson_id}`, false)).length;
  const people = cards.map((x) => `<button class="person ${x.salesperson_id === S.coachSp ? "on" : ""}" data-sp="${x.salesperson_id}" title="${esc(x.name)} · ${x.salesperson_id}"><span class="flag ${ls.get(`got|${R.as_of}|${x.salesperson_id}`, false) ? "ok" : ""}"></span>${esc(x.name)}</button>`).join("");
  return head(storeLocked ? "Team Coaching" : "Salesperson Coach", `One behaviour, a peer from the same store, one action for today · ${done} of ${cards.length} acknowledged today`,
    storeLocked ? "" : `<select class="pill" id="coach-store">${ids.map((s) => `<option ${s === S.coachStore ? "selected" : ""}>${s}</option>`).join("")}</select>`) +
    `<div class="stack"><div class="people">${people}</div>${c ? coachDetail(c, false) : `<div class="card"><p class="muted">No active salespeople with enough bills in this store yet.</p></div>`}
    <p class="small muted">Green dot = the salesperson tapped “Got it” on their card today. Cards are private coaching, not a public ranking.</p></div>`;
}

function vVisits(embedded) {
  const am = amObj(), ids = storesOf(am), V = T.visits();
  const rows = ids.map((s) => {
    const al = R.store_alerts[s] || [], tasks = tasksFor(s), reasons = [];
    let score = 0;
    const big = al.filter((a) => a.rupees_week >= 20000);
    if (big.length) { score += 3 * big.length; reasons.push(`${big.length} high-impact issue${big.length > 1 ? "s" : ""} (${inrShort(big.reduce((x, a) => x + a.rupees_week, 0))}/week)`); }
    if (al.length - big.length > 0) { score += al.length - big.length; reasons.push(`${al.length - big.length} other issue${al.length - big.length > 1 ? "s" : ""}`); }
    const od = tasks.filter((t) => T.displayStatus(t) === "Overdue").length;
    if (od) { score += 2 * od; reasons.push(`${od} overdue follow-up${od > 1 ? "s" : ""}`); }
    const rej = tasks.filter((t) => t.history.some((h) => h.status === "In Progress" && h.by === am.name)).length;
    if (rej) { score += 1; reasons.push(`${rej} follow-up${rej > 1 ? "s" : ""} sent back after review`); }
    if (issuesFor(s).length) { score += 2; reasons.push("data issue to check on site"); }
    const silent = tasks.filter((t) => T.isOpen(t) && t.history.length === 1 && (Date.now() - new Date(t.created_at)) > 2 * 864e5).length;
    if (silent) { score += 2; reasons.push(`${silent} task${silent > 1 ? "s" : ""} with no response for 2+ days`); }
    return { s, score, reasons, al };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  return (embedded ? "" : head("Visit Planner", `Where a physical visit is worth it this week · ${esc(am.city)}`)) + `
  <div class="stack">${rows.map((r, i) => {
    const v = V[r.s];
    return `<div class="card visit"><div class="chart-title"><h2>${i + 1}. ${r.s} <span class="pri ${r.score >= 6 ? "hi" : r.score >= 3 ? "md" : "lo"}">${r.score >= 6 ? "High" : r.score >= 3 ? "Medium" : "Low"} priority</span></h2><span class="small muted">Previous visit: ${v?.date ? dShort(v.date) + " (recorded here)" : "none recorded"}</span></div>
      <p><span class="lbl2">Why</span>${esc(r.reasons.join(" · "))}</p>
      ${r.al.length ? `<p><span class="lbl2">Inspect</span>${r.al.slice(0, 3).map((a) => esc(a.title.replace(r.s + ": ", ""))).join(" · ")}</p>` : ""}
      <form class="vform" data-store="${r.s}"><input type="date" name="date" value="${v?.date || ""}" max="${T.todayISO()}" aria-label="Visit date"><input name="notes" placeholder="Visit notes / post-visit actions" value="${esc(v?.notes || "")}"><button class="btn ghost" type="submit">Save visit</button></form>
    </div>`;
  }).join("") || `<div class="card"><p>No store needs a visit this week.</p></div>`}
  <p class="small muted">Decision support only. Visit dates and notes appear only after you record them here.</p></div>`;
}

function vReports() {
  const tabs = [["impact", "Impact"], ["visits", "Visit planner"], ["data", `Data issues (${R.data_issues.filter((d) => storesOf(amObj()).includes(d.store_id)).length})`], ["downloads", "Downloads"]];
  if (!tabs.some(([t]) => t === S.repTab)) S.repTab = "impact";
  const seg = `<div class="seg">${tabs.map(([t, l]) => `<button data-rtab="${t}" class="${S.repTab === t ? "on" : ""}">${l}</button>`).join("")}</div>`;
  if (S.repTab === "visits") return head("Reports", "Where a visit is worth it this week") + `<div class="stack">${seg}${vVisits(true)}</div>`;
  if (S.repTab === "data") return head("Reports", "Data quality") + `<div class="stack">${seg}${vData(true)}</div>`;
  if (S.repTab === "downloads") return head("Reports", "Download as CSV, or print any page to PDF", `<button class="btn ghost" data-print>${icon("print", 16)} Print / PDF</button>`) + `<div class="stack">${seg}<div class="card panel"><ul class="tl">
    ${[["stores", "Store performance", "Sales, conversion, items per bill, repeat, status"], ["alerts", "Alerts & opportunities", "Every issue with evidence, action and rupees at stake"], ["followups", "Follow-ups", "Status, deadline, remarks (demo updates on this device)"], ["cards", "Salesperson coaching", "Every coaching card"], ["weekly", "Weekly area performance", "12 weeks of bills, revenue, conversion"]].map(([k, l, d]) => `<li class="ti"><span class="tick static">${icon("download", 16)}</span><div class="tt"><span class="txt">${l}</span><span class="meta">${d}</span></div><div class="ti-right"><button class="chip" data-csv="${k}">CSV</button></div></li>`).join("")}</ul></div></div>`;
  return reportsImpact(seg);
}
function reportsImpact(seg) {
  const am = amObj(), ids = storesOf(am), cur = period(ids, "cur"), prev = period(ids, "prev"), wk = weekly(ids);
  const fu = am.follow_up, imp = fu.filter((f) => f.verdict === "improved").length;
  const tasks = T.all().filter((t) => ids.includes(t.store_id)), closed = tasks.filter((t) => t.status === "Completed").length;
  const signed = (v, u = "%") => (isFinite(v) ? (v > 0 ? "+" : "") + v.toFixed(1) + u : "–");
  return head("Reports", `${esc(am.city)} · last 28 days vs the 28 days before`, `<button class="btn ghost" data-print>${icon("print", 16)} Print / PDF</button>`) + `
  <div class="stack">${seg}
    <h2 class="sec">Measured (from the data)</h2>
    ${seasonTag(ids)}
    <div class="grid g4">
      ${kpi("", signed((cur.rev / prev.rev - 1) * 100), "Revenue", `<div class="delta flat">${inrShort(cur.rev)} vs ${inrShort(prev.rev)}</div>`)}
      ${kpi("", signed((cur.bills / prev.bills - 1) * 100), "More bills")}
      ${kpi("", signed((cur.ipb / prev.ipb - 1) * 100), "Items per bill")}
      ${kpi("", signed((cur.conv - prev.conv) * 100, " pts"), "Conversion")}
    </div>
    <div class="grid g2">
      <div class="card"><h2>Last week's alerts, one week later</h2>${fu.map((f) => `<div class="fu"><span class="num">${icon("switch", 14)}</span><div><b>${esc(f.title)}</b><div class="small muted">Before ${f.metric === "ipb" ? f.before.toFixed(2) : pct(f.before)} → after ${f.metric === "ipb" ? f.now.toFixed(2) : pct(f.now)}</div></div><span class="st ${f.verdict === "improved" ? "done" : f.verdict === "got worse" ? "overdue" : "pending"}">${esc(f.verdict)}</span></div>`).join("") || `<p class="muted">Nothing to follow up.</p>`}
        <p class="small muted">${imp} of ${fu.length} improved. Measured change, not proof the action caused it.</p></div>
      <div class="card"><h2>Revenue per week</h2>${lineChart(wk, (p) => p.rev, inrShort, inrShort, true)}</div>
    </div>
    <h2 class="sec">Estimates and workflow</h2>
    <div class="grid g3">
      ${kpi("", inrShort(am.alerts.reduce((s, a) => s + a.rupees_week, 0)), "Estimated weekly opportunity", `<div class="delta flat">sum of this week's alerts (estimate)</div>`)}
      ${kpi("", `${closed} / ${tasks.length}`, "Follow-ups completed", `<div class="delta flat">demo updates on this device</div>`)}
      ${kpi("", R.cards.filter((c) => ids.includes(c.store_id)).length, "Coaching cards today")}
    </div>
  </div>`;
}

function vData(embedded) {
  return (embedded ? `<p class="small muted">Numbers that can't be right. Left out of the analysis and never sent as alerts.</p>` : head("Data Issues", "Numbers that can't be right. Left out of the analysis and never sent as alerts.")) +
    `<div class="stack">${R.data_issues.map((d) => `<div class="card"><h2>${esc(d.store_id)}: ${esc(d.issue)}</h2><p class="muted">${esc(d.detail)}</p></div>`).join("") || `<div class="card"><p>No data issues found.</p></div>`}</div>`;
}

// ---------------- STORE MANAGER & SALESPERSON ----------------
function vSmHome() {
  const sid = S.sm, tasks = tasksFor(sid), open = tasks.filter(T.isOpen);
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  return `<div class="smhello"><h1>${greet}, Store Manager</h1><p class="sub">${sid} · ${esc(R.stores[sid].city)} · ${open.length} open task${open.length === 1 ? "" : "s"} from your area manager</p></div>` +
    (open.length ? `<a class="banner" href="#followups"><span class="spark">${icon("followups", 22)}</span><div><b>${open.length} task${open.length === 1 ? "" : "s"} to act on</b><span class="small muted">Update progress, add remarks and photos, then submit.</span></div><span class="go">Open →</span></a>` : "") +
    vStoreProfile(sid);
}
function vSpCard() {
  const c = R.cards.find((x) => x.salesperson_id === S.sp);
  if (!c) return head("No card yet", "Not enough recent bills to build a card.");
  return head(`Hi ${esc(c.name.split(" ")[0])}`, `Your coaching card for today · ${esc(c.store_id)}`) + coachDetail(c, true);
}

// ---------------- TODAY (one list per role) ----------------
const ackKey = (title) => `ack|${R.as_of}|${owner()}|${title}`;
const dot = (k) => `<span class="sdot ${k}" aria-hidden="true"></span>`;
function todoRows(withDone = true) {
  const today = T.todayISO(), list = T.todos(owner());
  const rows = list.filter((t) => withDone || !t.done).map((t) => `<li class="ti ${t.done ? "is-done" : ""}">
      <label class="tick"><input type="checkbox" data-todo-toggle="${t.id}" ${t.done ? "checked" : ""} aria-label="Done"><span class="box"></span></label>
      <div class="tt"><span class="txt">${esc(t.text)}</span>
        <span class="meta">To-do · ${t.done ? "done " + dTime(t.done_at) : t.due ? (t.due < today ? `<span class="neg">overdue, was due ${dShort(t.due)}</span>` : t.due === today ? "due today" : "due " + dShort(t.due)) : "added " + dTime(t.created_at)}</span></div>
      <button class="iconbtn" data-todo-del="${t.id}" aria-label="Delete to-do">${icon("trash", 16)}</button></li>`);
  return rows.join("");
}
const addRow = (ph) => `<li class="ti add"><form id="todo-form" class="addform">
    <span class="plus">${icon("plus", 16)}</span><input name="text" maxlength="200" placeholder="${esc(ph)}" autocomplete="off" required>
    <input type="date" name="due" min="${T.todayISO()}" aria-label="Due date (optional)"><button class="btn sm" type="submit">Add</button></form></li>`;
function issueRow(a, store) {
  const done = ls.get(ackKey(a.title), false), ft = S.role === "Area Manager" ? openTaskFor(store, a) : null;
  const act = S.role !== "Area Manager" ? "" : ft ? `<a class="chip" href="#task/${ft.id}">${ft.id} · ${T.displayStatus(ft)}</a>` : `<button class="chip accent" data-newfu="${esc(store)}" data-title="${esc(a.title)}">Assign</button>`;
  return `<li class="ti ${done ? "is-done" : ""}">
      <label class="tick"><input type="checkbox" data-ack="${esc(a.title)}" ${done ? "checked" : ""} aria-label="Handled"><span class="box"></span></label>
      <div class="tt"><span class="txt"><span class="lever ${LEVER[a.lever] || ""}">${esc(a.lever)}</span>${esc(a.title)}</span>
        <span class="meta">${esc(a.action)}</span>
        <details class="more"><summary>Why?</summary><p>${esc(a.cause)}</p><p class="small muted">Owner: Store Manager, ${esc(store)} · Confidence: ${confidence(a)} · ${inrShort(a.rupees_week)}/week at stake (estimate)</p></details></div>
      <div class="ti-right"><span class="amt">${inrShort(a.rupees_week)}<small>/wk</small></span>${act}</div></li>`;
}
function taskRow(t, verb) {
  const st = T.displayStatus(t);
  return `<li class="ti"><span class="tick static">${dot(st === "Overdue" ? "red" : st === "Submitted" || st === "Under Review" ? "amber" : "blue")}</span>
      <div class="tt"><span class="txt">${esc(t.store_id)}: ${esc(t.title)}</span><span class="meta">Follow-up ${esc(t.id)} · ${st} · due ${dShort(t.deadline)}</span></div>
      <div class="ti-right"><a class="chip accent" href="#task/${t.id}">${verb}</a></div></li>`;
}
function vToday() {
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const today = T.todayISO(), todos = T.todos(owner());
  if (S.role === "Salesperson") return vSpToday(greet);
  if (S.role === "Store Manager") {
    const sid = S.sm, tasks = tasksFor(sid).filter((t) => T.isOpen(t) && t.status !== "Submitted" && t.status !== "Under Review");
    const al = R.store_alerts[sid] || [];
    const due = tasks.filter((t) => t.deadline <= today).length + todos.filter((t) => !t.done && t.due && t.due <= today).length;
    return `<div class="head"><div><h1>${greet}</h1><p class="sub">Store Manager, ${sid} · ${tasks.length} task${tasks.length === 1 ? "" : "s"} from your area manager · ${due} due today</p></div></div>${flash()}
    <div class="stack"><div class="card panel"><h2>Today</h2><ul class="tl">
      ${tasks.map((t) => taskRow(t, "Update")).join("")}
      ${al.map((a) => issueRow(a, sid)).join("")}
      ${todoRows()}
      ${addRow("Add a to-do for today")}
    </ul>${!tasks.length && !al.length && !todos.length ? `<p class="muted small">Nothing urgent for ${sid} today.</p>` : ""}</div>
    <p class="small muted">Open <a href="#home">My store</a> for numbers and charts, or <a href="#team">Team</a> for coaching cards.</p></div>`;
  }
  const am = amObj(), ids = storesOf(am), H = ids.map((s) => ({ s, h: health(s) }));
  const need = H.filter((x) => x.h.k === "amber" || x.h.k === "red").length;
  const tasks = T.all().filter((t) => ids.includes(t.store_id));
  const review = tasks.filter((t) => t.status === "Submitted" || t.status === "Under Review");
  const overdue = tasks.filter((t) => T.displayStatus(t) === "Overdue");
  const due = tasks.filter((t) => T.isOpen(t) && t.deadline === today).length + todos.filter((t) => !t.done && t.due === today).length;
  const cur = period(ids, "cur"), prev = period(ids, "prev"), g = prev.rev ? (cur.rev / prev.rev - 1) * 100 : NaN;
  const filt = S.health === "attention" ? "attention" : "all";
  const strip = H.filter((x) => filt === "all" || x.h.k === "amber" || x.h.k === "red").sort((a, b) => "rag".indexOf(a.h.k[0]) - "rag".indexOf(b.h.k[0]));
  return `<div class="head"><div><h1>${greet}, ${esc(am.name.split(" ")[0])}</h1>
      <p class="sub">${need} of ${ids.length} stores need attention · ${due} due today${review.length ? ` · ${review.length} to review` : ""}</p></div></div>${flash()}
  <div class="stack">
    <div class="card panel"><div class="chart-title"><h2>Today</h2><span class="small muted">Tick when handled</span></div><ul class="tl">
      ${review.map((t) => taskRow(t, "Review")).join("")}
      ${overdue.filter((t) => !review.includes(t)).map((t) => taskRow(t, "Chase")).join("")}
      ${am.alerts.slice(0, 3).map((a) => issueRow(a, a.store_id.split(",")[0].trim())).join("")}
      ${todoRows()}
      ${addRow("Add a to-do, e.g. Call LKO-02 about weekend cover")}
    </ul>${am.alerts.length > 3 ? `<p class="small muted more-link">${am.alerts.length - 3} more issue${am.alerts.length - 3 === 1 ? "" : "s"} on the <a href="#stores">store pages</a>.</p>` : ""}</div>
    <div class="card panel"><div class="chart-title"><h2>Stores</h2>
      <div class="seg"><button data-health="all" class="${filt === "all" ? "on" : ""}">All</button><button data-health="attention" class="${filt === "attention" ? "on" : ""}">Needs attention</button></div></div>
      <ul class="tl">${strip.map(({ s, h }) => `<li class="ti click" data-href="#store/${s}"><span class="tick static">${dot(h.k)}</span>
        <div class="tt"><span class="txt">${s} <span class="muted">· ${esc(R.stores[s].city)} · tier ${esc(R.stores[s].tier)}</span></span><span class="meta">${h.label} · ${esc(h.why)}</span></div>
        <div class="ti-right"><span class="go-arrow">›</span></div></li>`).join("") || `<li class="ti"><span class="muted small">All stores are healthy.</span></li>`}</ul></div>
    <div class="statline">
      <div><span>Sales, 28 days</span><b>${inrShort(cur.rev)}</b><em class="${g >= 0 ? "pos" : "neg"}">${isFinite(g) ? (g > 0 ? "+" : "") + g.toFixed(1) + "% vs prior 28 days" : ""}${seasonText(ids) ? ' <span class="stag sm">festival season</span>' : ""}</em></div>
      <div><span>Conversion</span><b>${pct(cur.conv)}</b></div>
      <div><span>Open follow-ups</span><b>${tasks.filter(T.isOpen).length}</b></div>
      <div><span>Overdue</span><b class="${overdue.length ? "neg" : ""}">${overdue.length}</b></div>
    </div>
    ${seasonTag(ids)}
  </div>`;
}
function vSpToday(greet) {
  const c = R.cards.find((x) => x.salesperson_id === S.sp);
  if (!c) return head("No card yet", "Not enough recent bills to build a card.");
  const k = `got|${R.as_of}|${c.salesperson_id}`, got = ls.get(k, false);
  const fmt = (key, v) => (key === "ipb" ? v.toFixed(2) : pct(v, 1));
  const rows = Object.entries(c.metrics || {}).map(([key, m]) => {
    const max = Math.max(m.me, m.peer_median) * 1.3 || 1;
    return `<div class="row"><span>${esc(m.label)}${m.higher_is_better ? "" : ' <span class="muted small">(lower is better)</span>'}</span>
      <div class="track" data-tip="${esc(`You ${fmt(key, m.me)} · store peers' median ${fmt(key, m.peer_median)}`)}"><div class="fill" style="width:${(m.me / max) * 100}%"></div><div class="peerline" style="left:${(m.peer_median / max) * 100}%"></div></div>
      <span class="v">${fmt(key, m.me)}</span></div>`;
  }).join("");
  return `<div class="head"><div><h1>${greet}, ${esc(c.name.split(" ")[0])}</h1><p class="sub">${esc(c.store_id)} · your coaching for today</p></div></div>${flash()}
  <div class="stack">
    <div class="card panel onething ${got ? "is-done" : ""}">
      <span class="eyebrow">${icon("bulb", 16)} One thing to do today</span>
      <label class="bigtick"><input type="checkbox" data-got="${esc(c.salesperson_id)}" ${got ? "checked" : ""}><span class="box"></span>
        <span class="act">${esc(actionText(c.action))}</span></label>
      <p class="why">${esc(c.behaviour)} ${esc(c.peer)}</p>
      <p class="small muted">${got ? "Done for today. Nice work." : "Tick it when you've done it."} · ${c.words} words</p>
    </div>
    <details class="card panel more"><summary>How you compare with your store's peers</summary><div class="bars">${rows || '<p class="muted">Not enough bills to compare yet.</p>'}<div class="key">Orange bar = you · line = median of your store's peers · last 90 days</div></div></details>
    <div class="card panel"><h2>My to-dos</h2><ul class="tl">${todoRows()}${addRow("Add a to-do")}</ul></div>
  </div>`;
}

// ---------------- to-do ----------------
const owner = () => S.role === "Area Manager" ? `AM|${S.am}` : S.role === "Store Manager" ? `SM|${S.sm}` : `SP|${S.sp}`;
function vTodo() {
  const list = T.todos(owner()), open = list.filter((t) => !t.done), done = list.filter((t) => t.done);
  const today = T.todayISO();
  const row = (t) => `<li class="todo ${t.done ? "is-done" : ""}">
      <label class="tick"><input type="checkbox" data-todo-toggle="${t.id}" ${t.done ? "checked" : ""}><span class="box"></span></label>
      <div class="tt"><span class="txt">${esc(t.text)}</span>
        <span class="small muted">${t.done ? "Done " + dTime(t.done_at) : t.due ? (t.due < today ? `<span class="neg">Overdue · was due ${dShort(t.due)}</span>` : "Due " + dShort(t.due)) : "Added " + dTime(t.created_at)}</span></div>
      <button class="iconbtn" data-todo-del="${t.id}" aria-label="Delete">${icon("trash", 16)}</button></li>`;
  return head("To-do", `Your own checklist · ${open.length} open, ${done.length} done`) + `
  <div class="stack">
    <form class="card todo-add" id="todo-form">
      <input name="text" maxlength="200" placeholder="Add a to-do, e.g. Call LKO-02 store manager about weekend cover" autocomplete="off" required>
      <input type="date" name="due" min="${today}" aria-label="Due date (optional)">
      <button class="btn" type="submit">${icon("plus", 16)} Add</button>
    </form>
    <div class="card"><h2>Open</h2><ul class="todos">${open.map(row).join("") || `<li class="muted small">Nothing open. Add your first to-do above.</li>`}</ul></div>
    ${done.length ? `<div class="card"><div class="chart-title"><h2>Done</h2><button class="btn ghost" data-todo-clear>Clear done</button></div><ul class="todos">${done.map(row).join("")}</ul></div>` : ""}
    <p class="small muted">Saved in this browser for ${esc($("#who-name").textContent)}.</p>
  </div>`;
}

// ---------------- welcome ----------------
function vWelcome() {
  const stores = Object.keys(R.stores);
  const byStore = {};
  R.cards.forEach((c) => (byStore[c.store_id] = byStore[c.store_id] || []).push(c));
  return `<div class="welcome">
    <span class="mark big" aria-hidden="true">SC</span>
    <h1>Store Coach</h1>
    <p class="tag">More bills · Bigger baskets · More repeat</p>
    <p class="sub">Every morning it tells area managers which stores need attention and why, and gives every salesperson one thing to do better today.</p>
    <h2>Look around as…</h2>
    <div class="roles">
      <div class="role-card"><div class="ri">${icon("compass", 28)}</div><b>Area Manager</b><span>See all your stores, alerts and follow-ups</span>
        <select id="w-am" aria-label="Area manager">${R.area_managers.map((a) => `<option value="${a.id}" ${a.id === S.am ? "selected" : ""}>${esc(a.name)} · ${esc(a.city)}</option>`).join("")}</select>
        <button class="btn" data-enter="Area Manager">Enter</button></div>
      <div class="role-card"><div class="ri">${icon("stores", 28)}</div><b>Store Manager</b><span>Your store, your tasks, your team</span>
        <select id="w-sm" aria-label="Store">${stores.map((s) => `<option ${s === S.sm ? "selected" : ""}>${s} · ${esc(R.stores[s].city)}</option>`).join("")}</select>
        <button class="btn" data-enter="Store Manager">Enter</button></div>
      <div class="role-card"><div class="ri">${icon("user", 28)}</div><b>Salesperson</b><span>Your coaching card for today</span>
        <select id="w-sp" aria-label="Salesperson">${Object.keys(byStore).sort().map((s) => `<optgroup label="${s} · ${esc(R.stores[s].city)}">${byStore[s].slice().sort((x, y) => x.name.localeCompare(y.name)).map((c) => `<option value="${c.salesperson_id}" ${c.salesperson_id === S.sp ? "selected" : ""}>${esc(c.name)} · ${c.salesperson_id} · ${s}</option>`).join("")}</optgroup>`).join("")}</select>
        <button class="btn" data-enter="Salesperson">Enter</button></div>
    </div>
    <p class="small muted">Demo access, no password. Built on the synthetic Manyavar data pack (to ${dShort(R.as_of)}). Not an official Manyavar product.</p>
  </div>`;
}

// ---------------- routing / navigation ----------------
const NAV = {
  "Area Manager": [["today", "todo", "Today"], ["stores", "stores", "Stores"], ["followups", "followups", "Follow-ups"], ["coach", "coach", "Coaching"], ["reports", "reports", "Reports"]],
  "Store Manager": [["today", "todo", "Today"], ["home", "home", "My store"], ["followups", "followups", "Tasks"], ["team", "team", "Team"]],
  Salesperson: [["today", "todo", "Today"]],
};
const VIEWS = {
  overview: vOverview, stores: vStores, insights: vInsights, followups: vFollowups, coach: () => vCoach(null), visits: vVisits, reports: vReports, data: vData,
  home: () => vStoreProfile(S.sm), team: () => vCoach(S.sm), card: vSpCard, todo: vTodo, today: vToday,
};
function route() {
  const h = (location.hash || "").slice(1);
  let [v, arg] = h.split("/");
  if (["overview", "insights", "todo", "card"].includes(v)) v = "today"; // old links still work
  if ((v === "visits" || v === "data") && S.role === "Area Manager") { S.repTab = v; v = "reports"; history.replaceState(null, "", "#reports"); }
  const allowed = NAV[S.role].map((n) => n[0]);
  if (v === "store" && arg && (S.role === "Area Manager" ? storesOf(amObj()).includes(arg) : S.role === "Store Manager" && arg === S.sm)) return { v, html: () => vStoreProfile(arg) };
  if (v === "task" && arg && S.role !== "Salesperson") return { v: "followups", html: () => vTask(arg) };
  return { v: allowed.includes(v) ? v : allowed[0], html: null };
}
function render() {
  const welcome = (location.hash || "#welcome") === "#welcome";
  document.querySelector(".app").classList.toggle("welcome-mode", welcome);
  if (welcome) { $("#view").innerHTML = vWelcome(); closeMenu(); return; }
  const r = route(), view = r.v;
  $("#view").innerHTML = r.html ? r.html() : VIEWS[view]();
  const nav = NAV[S.role];
  const badge = (k) => {
    if (k === "followups") {
      const scope = S.role === "Area Manager" ? storesOf(amObj()) : [S.sm];
      const list = T.all().filter((t) => scope.includes(t.store_id));
      const n = S.role === "Area Manager" ? list.filter((t) => t.status === "Submitted" || T.displayStatus(t) === "Overdue").length : list.filter((t) => T.isOpen(t) && t.status !== "Submitted" && t.status !== "Under Review").length;
      return n ? `<span class="count">${n}</span>` : "";
    }
    if (k === "today") { const n = T.todos(owner()).filter((t) => !t.done).length; return n ? `<span class="count soft">${n}</span>` : ""; }
    if (k === "todo") { const n = T.todos(owner()).filter((t) => !t.done).length; return n ? `<span class="count soft">${n}</span>` : ""; }
    if (k === "insights") return amObj().alerts.length ? `<span class="count">${amObj().alerts.length}</span>` : "";
    return "";
  };
  $("#nav").innerHTML = nav.map(([k, ic, l]) => `<a href="#${k}" class="${k === view || (view === "store" && k === "stores") ? "on" : ""}"><span class="ic">${icon(ic)}</span>${esc(l)}${badge(k)}</a>`).join("");
  $("#bottomnav").innerHTML = nav.slice(0, 5).map(([k, ic, l]) => `<a href="#${k}" class="${k === view ? "on" : ""}"><span>${icon(ic, 20)}</span>${esc(l.replace("My ", "").split(" ")[0])}</a>`).join("");
  $("#bottomnav").style.gridTemplateColumns = `repeat(${Math.min(nav.length, 5)}, 1fr)`;
  $("#top-title").textContent = (nav.find((n) => n[0] === view) || [0, 0, "Store Coach"])[2];
  const who = S.role === "Area Manager" ? amObj().name : S.role === "Store Manager" ? "Store Manager " + S.sm : (R.cards.find((c) => c.salesperson_id === S.sp)?.name || "");
  $("#am-avatar").textContent = initials(who);
  const bell = $("#bell-dot"), b = badge("followups"); bell.style.display = b ? "" : "none";
  closeMenu();
}
function renderWho() {
  const who = S.role === "Area Manager" ? amObj().name : S.role === "Store Manager" ? `Store Manager, ${S.sm}` : (R.cards.find((c) => c.salesperson_id === S.sp)?.name || "");
  $("#who-name").textContent = who;
  $("#am-sub").textContent = S.role === "Area Manager" ? `Area Manager · ${amObj().city}` : S.role === "Store Manager" ? `${R.stores[S.sm]?.city || ""} · sees only ${S.sm}` : `Salesperson · ${R.cards.find((c) => c.salesperson_id === S.sp)?.store_id || ""}`;
}
function persist() { ls.set("who", { role: S.role, am: S.am, sm: S.sm, sp: S.sp }); }

// ---------------- CSV ----------------
function csv(name, rows) {
  const cols = Object.keys(rows[0] || { empty: "" });
  const q = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = `store-coach-${name}-${R.as_of}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}
function exportCsv(kind) {
  const am = amObj(), ids = storesOf(am);
  const r4 = (v) => (isFinite(v) ? Math.round(v * 10000) / 10000 : "");
  if (kind === "stores") csv("stores", ids.map((s) => { const c = agg([R.kpis[s].cur]), p = agg([R.kpis[s].prev]); return { store: s, city: R.stores[s].city, tier: R.stores[s].tier, status: health(s).label, sales_28d: Math.round(c.rev), sales_prev_28d: Math.round(p.rev), bills_28d: c.bills, conversion: r4(c.conv), items_per_bill: r4(c.ipb), repeat_rate: r4(R.kpis[s].repeat_sum / R.kpis[s].repeat_count), open_issues: (R.store_alerts[s] || []).length, open_followups: tasksFor(s).filter(T.isOpen).length }; }));
  if (kind === "alerts") csv("alerts", ids.flatMap((s) => (R.store_alerts[s] || []).map((a) => ({ store: s, lever: a.lever, title: a.title, evidence: a.cause, action: a.action, est_rupees_per_week: Math.round(a.rupees_week), confidence: confidence(a) }))));
  if (kind === "followups") csv("followups", T.all().filter((t) => ids.includes(t.store_id)).map((t) => ({ id: t.id, store: t.store_id, title: t.title, category: t.category, priority: t.priority, status: T.displayStatus(t), deadline: t.deadline, assignee: t.assignee, created_at: t.created_at, completed_at: t.completed_at || "", updates: t.history.length, last_remark: [...t.history].reverse().find((h) => h.note)?.note || "" })));
  if (kind === "cards") csv("coaching", R.cards.filter((c) => ids.includes(c.store_id)).map((c) => ({ salesperson: c.name, id: c.salesperson_id, store: c.store_id, behaviour: c.behaviour, peer: c.peer, action: c.action, words: c.words })));
  if (kind === "weekly") csv("weekly", weekly(ids).map((w) => ({ week_ending: w.week, bills: w.bills, revenue: Math.round(w.rev), conversion: r4(w.conv), items_per_bill: r4(w.ipb) })));
}

// ---------------- events ----------------
function closeMenu() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("open"); }
$("#menu").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("open"); });
$("#scrim").addEventListener("click", closeMenu);
addEventListener("hashchange", () => { render(); scrollTo(0, 0); });
$("#view").addEventListener("input", (e) => { if (e.target.id === "store-q") { S.q = e.target.value; const pos = e.target.selectionStart; render(); const el = $("#store-q"); el.focus(); el.setSelectionRange(pos, pos); } });
$("#view").addEventListener("change", (e) => {
  if (e.target.dataset.ack) { const k = ackKey(e.target.dataset.ack); ls.set(k, !ls.get(k, false)); render(); return; }
  if (e.target.dataset.got && e.target.type === "checkbox") { const k = `got|${R.as_of}|${e.target.dataset.got}`; ls.set(k, !ls.get(k, false)); render(); return; }
  if (e.target.dataset.todoToggle) { T.todoToggle(owner(), e.target.dataset.todoToggle); render(); return; }
  if (e.target.id === "coach-store") { S.coachStore = e.target.value; S.coachSp = null; render(); }
  if (e.target.id === "store-sort") { S.sort = e.target.value; render(); }
});
$("#view").addEventListener("click", (e) => {
  const el = (sel) => e.target.closest(sel);
  let x;
  if ((x = el("[data-href]")) && !el("a,button")) { location.hash = x.dataset.href; return; }
  if ((x = el("[data-sp]"))) { S.coachSp = x.dataset.sp; render(); return; }
  if ((x = el("[data-stab]"))) { S.storeTab = x.dataset.stab; render(); return; }
  if ((x = el("[data-health]"))) { S.health = x.dataset.health; render(); return; }
  if ((x = el("[data-fuf]"))) { S.fuFilter = x.dataset.fuf; render(); return; }
  if ((x = el("[data-csv]"))) { exportCsv(x.dataset.csv); return; }
  if (el("[data-print]")) { print(); return; }
  if (el("[data-cancel]")) { S.draft = null; render(); return; }
  if ((x = el("[data-enter]"))) {
    S.role = x.dataset.enter;
    if (S.role === "Area Manager") S.am = $("#w-am").value;
    if (S.role === "Store Manager") S.sm = $("#w-sm").value.split(" ")[0];
    if (S.role === "Salesperson") S.sp = $("#w-sp").value;
    S.coachSp = null; S.coachStore = null; S.draft = null;
    persist(); renderWho(); location.hash = "#" + NAV[S.role][0][0];
    return;
  }
  if ((x = el("[data-rtab]"))) { S.repTab = x.dataset.rtab; render(); return; }
  if ((x = el("[data-todo-del]"))) { T.todoRemove(owner(), x.dataset.todoDel); render(); return; }
  if (el("[data-todo-clear]")) { T.todoClearDone(owner()); render(); return; }
  if ((x = el("[data-del]"))) {
    const t = T.get(x.dataset.del);
    if (!t || !confirm(`Delete ${t.id} (${t.title})?\n\nThis removes the follow-up and all its remarks and photos. It can't be undone.`)) return;
    const res = T.remove(t.id, S.role);
    S.flash = res.error ? { k: "bad", msg: res.error } : { k: "ok", msg: `${t.id} deleted.` };
    if (res.error) render(); else location.hash = "#followups";
    return;
  }
  if ((x = el("[data-got]"))) { const k = `got|${R.as_of}|${x.dataset.got}`; ls.set(k, !ls.get(k, false)); render(); return; }
  if ((x = el("[data-newfu]"))) {
    const sid = x.dataset.newfu, title = x.dataset.title;
    const a = sid && title ? (R.store_alerts[sid] || []).find((y) => y.title === title) || amObj().alerts.find((y) => y.title === title) : null;
    S.draft = a ? { store_id: sid, category: a.lever, title: a.title, problem: a.cause, action: a.action, priority: a.rupees_week >= 20000 ? "High" : "Medium", issue_key: issueKey(sid, a),
      metric: ["conv", "ipb", "disc", "sp_disc", "repeat"].includes(a.metric) ? { name: a.metric === "ipb" ? "ipb" : "rate", label: { conv: "Conversion", ipb: "Items per bill", disc: "Discount", sp_disc: "Discount", repeat: "Return rate" }[a.metric], before: a.now } : null }
      : { store_id: sid || storesOf(amObj())[0] };
    if (a) {
      const dup = openTaskFor(sid, a);
      if (dup) { location.hash = "#task/" + dup.id; return; }
    }
    S.fuFilter = "open";
    if (location.hash !== "#followups") location.hash = "#followups"; else render();
    setTimeout(() => $("#fu-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
});
$("#view").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "fu-form") {
    const d = Object.fromEntries(new FormData(f));
    if (d.deadline < T.todayISO()) { S.flash = { k: "bad", msg: "Deadline can't be in the past." }; render(); return; }
    const res = T.create({ ...S.draft, ...d, issue_key: S.draft?.store_id === d.store_id ? S.draft?.issue_key : null, metric: S.draft?.store_id === d.store_id ? S.draft?.metric : null }, amObj().name);
    if (res.error) { S.flash = { k: "bad", msg: res.error }; render(); return; }
    S.draft = null; S.flash = { k: "ok", msg: `${res.task.id} assigned to ${res.task.assignee}, due ${dShort(res.task.deadline)}.` };
    location.hash = "#task/" + res.task.id; return; // hashchange renders (and shows the message once)
  }
  if (f.id === "todo-form") {
    const res = T.todoAdd(owner(), f.text.value, f.due.value);
    if (res.error) S.flash = { k: "bad", msg: res.error };
    render(); setTimeout(() => $("#todo-form input[name=text]")?.focus(), 0); return;
  }
  if (f.id === "task-form") {
    const status = e.submitter?.value || "", note = f.note.value.trim();
    let photo = null;
    if (f.photo?.files?.[0]) { try { photo = await T.readPhoto(f.photo.files[0]); } catch (err) { S.flash = { k: "bad", msg: err.message }; render(); return; } }
    if (!status && !note && !photo) { S.flash = { k: "bad", msg: "Write a remark or attach a photo first." }; render(); return; }
    const by = S.role === "Area Manager" ? amObj().name : `Store Manager, ${S.sm}`;
    const res = T.update(f.dataset.id, { status: status || null, note, photo }, by, S.role);
    S.flash = res.error ? { k: "bad", msg: res.error } : { k: "ok", msg: res.warn || `Saved: ${res.task.id} is now ${T.displayStatus(res.task)}.` };
    render(); return;
  }
  if (f.classList.contains("vform")) {
    const d = Object.fromEntries(new FormData(f));
    T.saveVisit(f.dataset.store, d); S.flash = { k: "ok", msg: `Visit record saved for ${f.dataset.store}.` }; render();
  }
});

async function main() {
  R = await (await fetch("report.json", { cache: "no-store" })).json();
  const w = ls.get("who", {});
  S.am = R.area_managers.find((a) => a.id === w.am) ? w.am : R.area_managers[0].id;
  S.sm = R.stores[w.sm] ? w.sm : null;
  S.sp = R.cards.find((c) => c.salesperson_id === w.sp) ? w.sp : null;
  S.role = NAV[w.role] && (w.role === "Area Manager" || (w.role === "Store Manager" && S.sm) || (w.role === "Salesperson" && S.sp)) ? w.role : "Area Manager";
  const total = R.area_managers.reduce((s, a) => s + a.alerts.length, 0);
  $("#runbox").innerHTML = `Data to <b>${dShort(R.as_of)}</b> · analysis runs every morning<br>Last run <b>${esc(R.generated_at)}</b><br>${total} alerts · ${R.cards.length} coaching cards<br><button class="linkbtn" id="reset-demo">Reset demo updates</button>`;
  $("#reset-demo").addEventListener("click", () => { if (confirm("Clear all follow-ups, remarks, photos, to-dos and visit notes saved in this browser?")) { T.resetAll(); try { localStorage.removeItem("sc_visits_v1"); localStorage.removeItem("sc_todo_v1"); } catch {} S.flash = { k: "ok", msg: "Demo updates cleared." }; render(); } });
  renderWho();
  render();
}
main().catch((e) => { $("#view").innerHTML = `<div class="card"><p>Could not load today's report: ${esc(e.message)}</p></div>`; console.error(e); });
