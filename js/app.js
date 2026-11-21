const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const leverClass = { "More bills": "bills", "Bigger baskets": "baskets", "More repeat": "repeat" };
const verdictClass = { improved: "ok", "got worse": "bad", "has not moved": "flat" };

function amView(r) {
  return r.area_managers.map((am) => `
    <article class="card">
      <div class="am-head">
        <div><h2>${esc(am.name)}</h2><p class="meta">${esc(am.city)} · ${am.stores.map(esc).join(", ")}</p></div>
        <span class="pill">${am.alerts.length} of 5 alerts</span>
      </div>
      ${am.alerts.length ? `<ol class="alerts">${am.alerts.map((a) => `
        <li>
          <div class="alert-top">
            <span class="lever ${leverClass[a.lever] || ""}">${esc(a.lever)}</span>
            <b>${esc(a.title)}</b>
            <span class="money" title="Estimated rupees at stake per week">${inr(a.rupees_week)}/week</span>
          </div>
          <p><span class="lbl">Why</span> ${esc(a.cause)}</p>
          <p class="action"><span class="lbl">Do</span> ${esc(a.action)}</p>
        </li>`).join("")}</ol>` : `<p class="quiet">No store needs attention this week.</p>`}
      ${am.role_models && am.role_models.length ? `<div class="rm"><span class="lbl">Role models</span> Customers come back to them. Ask them to show others how.
        <ul>${am.role_models.map((m) => `<li>${esc(m.text)}</li>`).join("")}</ul></div>` : ""}
      ${am.follow_up.length ? `<details class="fu"><summary>Follow-up on last week's alerts (${am.follow_up.length})</summary>
        <ul>${am.follow_up.map((f) => `<li><span class="v ${verdictClass[f.verdict]}">${esc(f.verdict)}</span> ${esc(f.text)}</li>`).join("")}</ul></details>` : ""}
    </article>`).join("");
}

function spView(r) {
  const stores = [...new Set(r.cards.map((c) => c.store_id))].sort();
  const sel = `<label class="filter">Store <select id="store-filter">${stores.map((s) => `<option>${s}</option>`).join("")}</select></label>`;
  return sel + `<div id="cards" class="cardgrid"></div>`;
}

function renderCards(r, store) {
  document.getElementById("cards").innerHTML = r.cards.filter((c) => c.store_id === store).map((c) => `
    <article class="card sp ${c.lever === "strong" ? "strong" : ""}">
      <h3>${esc(c.name)} <span class="meta">${esc(c.salesperson_id)}</span></h3>
      <p>${esc(c.behaviour)}</p>
      <p class="peer">${esc(c.peer)}</p>
      <p class="action">${esc(c.action)}</p>
      <p class="wc">${c.words} words</p>
    </article>`).join("");
}

function dataView(r) {
  if (!r.data_issues.length) return `<div class="card"><p>No data issues found.</p></div>`;
  return `<p class="meta">These are numbers that can't be right. They are left out of the analysis and never sent to area managers.</p>` +
    r.data_issues.map((d) => `<article class="card"><h3>${esc(d.store_id)}: ${esc(d.issue)}</h3><p>${esc(d.detail)}</p></article>`).join("");
}

async function main() {
  const r = await (await fetch("report.json", { cache: "no-store" })).json();
  const total = r.area_managers.reduce((s, a) => s + a.alerts.length, 0);
  document.getElementById("runinfo").textContent =
    `Data as of ${r.as_of} · last run ${r.generated_at} · ${total} alerts · ${r.cards.length} salesperson cards`;
  document.getElementById("tab-am").innerHTML = amView(r);
  document.getElementById("tab-sp").innerHTML = spView(r);
  document.getElementById("tab-data").innerHTML = dataView(r);
  const f = document.getElementById("store-filter");
  f.addEventListener("change", () => renderCards(r, f.value));
  renderCards(r, f.value);

  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    ["am", "sp", "data"].forEach((t) => (document.getElementById("tab-" + t).hidden = t !== b.dataset.tab));
  }));
}
main().catch((e) => {
  document.getElementById("runinfo").textContent = "Could not load today's report: " + e.message;
});
