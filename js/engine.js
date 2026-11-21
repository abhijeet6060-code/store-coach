import { OUTFITS, ADDONS } from "./catalog.js";

const inr = (n) => "₹" + n.toLocaleString("en-IN");

// Score one outfit against the customer brief. Returns score (0-100) plus reasons the salesperson can say out loud.
export function scoreOutfit(o, brief) {
  let score = 0;
  const reasons = [];
  const warnings = [];

  // Occasion fit: 35 pts
  if (o.occasions.includes(brief.occasion)) {
    score += 35;
    reasons.push(`Made for ${brief.occasion}`);
  } else {
    warnings.push(`Not a typical ${brief.occasion} look`);
  }

  // Role fit: 20 pts. The groom should stand out; guests should not out-dress the groom.
  if (o.roles.includes(brief.role)) {
    score += 20;
    if (brief.role === "groom" && o.weight === 3) reasons.push("Statement piece for the groom");
  } else if (brief.role !== "groom" && o.roles.includes("groom") && o.roles.length === 1) {
    warnings.push("Groom-level outfit, may out-dress the groom");
  }

  // Budget fit: 25 pts. Full marks within 60-100% of budget, partial below, falls off above.
  const ratio = o.price / brief.budget;
  if (ratio <= 1 && ratio >= 0.6) {
    score += 25;
    reasons.push(`Within budget (${inr(o.price)})`);
  } else if (ratio < 0.6) {
    score += 15;
    reasons.push(`Well under budget, room for add-ons`);
  } else if (ratio <= 1.2) {
    score += 10;
    warnings.push(`${inr(o.price - brief.budget)} over budget`);
  } else {
    warnings.push(`Far over budget (${inr(o.price)})`);
  }

  // Colour preference: 10 pts
  if (brief.colour === "any" || o.colours.includes(brief.colour)) {
    score += 10;
    if (brief.colour !== "any") reasons.push(`Has the ${brief.colour} they asked for`);
  }

  // Season / comfort: 10 pts. Heavy fabrics in summer or day events are a common complaint.
  const hot = brief.season === "summer" || ["haldi", "mehendi", "puja"].includes(brief.occasion);
  if (hot && o.weight === 1) { score += 10; reasons.push(`${o.fabric}, comfortable in the heat`); }
  else if (hot && o.weight === 3) { warnings.push(`Heavy ${o.fabric.toLowerCase()}, warm for a ${brief.season} event`); }
  else if (!hot) score += o.weight >= 2 ? 10 : 6;
  else score += 5;

  // Stock in the customer's size
  const stock = o.sizes[brief.size] ?? 0;
  if (stock === 0) warnings.push(`Out of stock in size ${brief.size}`);
  else if (stock === 1) warnings.push(`Only 1 left in size ${brief.size}`);

  return { outfit: o, score, reasons, warnings, stock };
}

// Pick add-ons that match colour, role and occasion, and fit in the money left.
export function completeTheLook(outfit, brief) {
  let left = brief.budget - outfit.price;
  const picked = [];
  const usedCats = new Set();
  const fits = ADDONS
    .filter((a) => a.occasions.includes(brief.occasion))
    .filter((a) => a.roles.includes("any") || a.roles.includes(brief.role))
    .map((a) => ({ a, match: a.colours.includes("any") ? 1 : outfit.colours.filter((c) => a.colours.includes(c)).length }))
    .filter((x) => x.match > 0)
    .sort((x, y) => y.match - x.match || y.a.price - x.a.price);

  for (const { a } of fits) {
    if (usedCats.has(a.category)) continue;
    if (a.price <= left) {
      picked.push(a);
      usedCats.add(a.category);
      left -= a.price;
    }
  }
  // If nothing fit the budget, still suggest the single best matching add-on as an optional upsell.
  const upsell = picked.length === 0 && fits.length ? fits[0].a : null;
  return { picked, total: outfit.price + picked.reduce((s, a) => s + a.price, 0), left: Math.max(left, 0), upsell };
}

// Coaching lines for the salesperson: opener, what to say, objections to expect.
export function coach(result, brief, look) {
  const o = result.outfit;
  const lines = [];
  const roleLine = {
    groom: "This is your day, so the outfit should make you the centre of every photo.",
    brother: "As the brother you'll be in most family photos, so you want to look sharp without competing with the groom.",
    father: "For the groom's or bride's father, a classic, rich look always reads well.",
    friend: "As a close friend you can go a little bolder, you'll be dancing in this.",
    guest: "As a guest, this keeps you elegant and appropriate.",
  }[brief.role];
  lines.push({ kind: "Open with", text: roleLine });
  lines.push({ kind: "Show", text: `${o.name}: ${o.fabric.toLowerCase()}, ${o.colours.join(" and ")} tones. ${result.reasons[0] || ""}.` });
  if (look.picked.length) {
    lines.push({ kind: "Complete the look", text: `Pair it with ${look.picked.map((a) => a.name.toLowerCase()).join(", ")}. Total ${inr(look.total)}, still inside the ${inr(brief.budget)} budget.` });
  } else if (look.upsell) {
    lines.push({ kind: "Optional upsell", text: `If they can stretch, the ${look.upsell.name.toLowerCase()} (${inr(look.upsell.price)}) finishes the look.` });
  }

  const objections = [];
  if (o.price > brief.budget) objections.push({ q: "It's over my budget.", a: `It's ${inr(o.price - brief.budget)} more, but it's the one that fits a ${brief.occasion} best. If budget is firm, show option #2.` });
  else objections.push({ q: "Can I get something cheaper?", a: `This is already within budget, and the add-ons are what make it look complete in photos. Offer a lower add-on instead of a lower outfit.` });
  if (o.weight === 3) objections.push({ q: "Won't it be too heavy?", a: "Lined inside for comfort; heavy work is what reads well under wedding lights. Suggest a lighter outfit for day functions." });
  else objections.push({ q: "Is it grand enough?", a: `The ${o.fabric.toLowerCase()} and the add-ons lift it. For the main ceremony, show a sherwani alongside.` });
  if (result.stock <= 1) objections.push({ q: "Let me think about it.", a: result.stock === 0 ? `Size ${brief.size} is out here; offer to order it from another store today.` : `Only one left in size ${brief.size}; offer a trial now and a hold until tonight.` });
  else objections.push({ q: "Let me think about it.", a: "Offer a trial right now and alteration timelines, so the decision feels easy." });

  return { lines, objections };
}

// Main flow: brief in, ranked looks with add-ons and coaching out.
export function recommend(brief, catalog = OUTFITS) {
  return catalog
    .map((o) => scoreOutfit(o, brief))
    .filter((r) => r.stock > 0 || r.score >= 70) // keep out-of-stock only if it's a great match
    .sort((a, b) => b.score - a.score || a.outfit.price - b.outfit.price)
    .slice(0, 3)
    .map((r) => {
      const look = completeTheLook(r.outfit, brief);
      return { ...r, look, coaching: coach(r, brief, look) };
    });
}

export { inr };
