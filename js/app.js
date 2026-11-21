import { OCCASIONS, ROLES, COLOURS, SIZES } from "./catalog.js";
import { recommend, inr } from "./engine.js";

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function fill(id, values, selected) {
  const el = document.getElementById(id);
  el.innerHTML = values.map((v) => `<option value="${v}"${v === selected ? " selected" : ""}>${cap(v)}</option>`).join("");
}
fill("occasion", OCCASIONS, "wedding");
fill("role", ROLES, "groom");
fill("colour", COLOURS, "any");
fill("size", SIZES, 40);

function render(results, brief) {
  const out = document.getElementById("results");
  if (!results.length) {
    out.innerHTML = `<div class="card"><p>No in-stock match for this brief. Try a different size or a higher budget.</p></div>`;
    return;
  }
  out.innerHTML = `<h2>Top ${results.length} looks for a ${esc(brief.role)} at a ${esc(brief.occasion)}</h2>` +
    results.map((r, i) => `
    <article class="card look">
      <div class="look-head">
        <span class="rank">#${i + 1}</span>
        <div>
          <h3>${esc(r.outfit.name)}</h3>
          <p class="meta">${esc(r.outfit.type)} · ${esc(r.outfit.fabric)} · ${inr(r.outfit.price)} · ${r.stock} in size ${brief.size}</p>
        </div>
        <span class="score" title="Match score">${r.score}</span>
      </div>
      <ul class="chips">
        ${r.reasons.map((x) => `<li class="ok">${esc(x)}</li>`).join("")}
        ${r.warnings.map((x) => `<li class="warn">${esc(x)}</li>`).join("")}
      </ul>
      <div class="cols">
        <div>
          <h4>Complete the look</h4>
          ${r.look.picked.length
            ? `<ul class="addons">${r.look.picked.map((a) => `<li>${esc(a.name)} <span>${inr(a.price)}</span></li>`).join("")}</ul>
               <p class="total">Total ${inr(r.look.total)} · ${inr(r.look.left)} left of budget</p>`
            : r.look.upsell
              ? `<p>No add-on fits the budget. Upsell: ${esc(r.look.upsell.name)} (${inr(r.look.upsell.price)})</p>`
              : `<p>No matching add-ons.</p>`}
        </div>
        <div>
          <h4>What to say</h4>
          <ol class="script">${r.coaching.lines.map((l) => `<li><b>${esc(l.kind)}:</b> ${esc(l.text)}</li>`).join("")}</ol>
        </div>
      </div>
      <details>
        <summary>Handle objections (${r.coaching.objections.length})</summary>
        <dl>${r.coaching.objections.map((o) => `<dt>“${esc(o.q)}”</dt><dd>${esc(o.a)}</dd>`).join("")}</dl>
      </details>
    </article>`).join("");
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("brief").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const brief = {
    occasion: f.get("occasion"),
    role: f.get("role"),
    budget: Number(f.get("budget")),
    colour: f.get("colour"),
    size: Number(f.get("size")),
    season: f.get("season"),
  };
  render(recommend(brief), brief);
});
