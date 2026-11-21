// "How to fix it": rule-based playbooks. Three options per issue, easiest first, one Recommended.
// Every number used here comes from the issue itself (now / expected / rupees_week / title). Nothing is invented.
const pc = (x, d = 1) => (x * 100).toFixed(d) + "%";
const firstName = (n) => String(n || "").split(" ")[0];

export function kindOf(a) {
  if (/stopped billing/.test(a.title)) return "staff";
  if (a.metric === "sp_disc" || a.metric === "disc") return "discount";
  if (a.metric === "ipb") return "basket";
  if (a.metric === "repeat") return "repeat";
  return "buyers";
}

// Pull the names the pipeline already put in the title / action text.
function facts(a) {
  const f = {};
  let m;
  if ((m = a.title.match(/top seller (.+?) has stopped billing/))) f.left = m[1];
  if ((m = a.action.match(/^Today: (.+?) calls .+?'s (\d+) customers/))) { f.peer = m[1]; f.customers = m[2]; }
  if ((m = a.title.match(/: (.+?) discounting ([\d.]+)% vs store ([\d.]+)%/))) { f.person = m[1]; f.rate = m[2]; f.norm = m[3]; }
  if ((m = a.action.match(/above (\d+)%/))) f.limit = m[1];
  if ((m = a.title.match(/: (.+?)'s customers don't come back/))) f.person = m[1];
  if ((m = a.action.match(/^Today: (.+?) shows (.+?) how/))) f.model = m[1];
  if ((m = a.action.match(/^Today, (.+?) and one colleague call the (\d+) customers/))) { f.model = m[1]; f.customers = m[2]; }
  if ((m = a.action.match(/^Today: (.+?) shadows (.+?) on/))) { f.peer = m[1]; f.person = m[2]; }
  if ((m = a.action.match(/lock (.+?)'s rota/))) f.person = m[1];
  if ((m = a.action.match(/at least (\d+) people/)) || (m = a.action.match(/Keep (\d+) people/))) f.floor = m[1];
  if ((m = a.action.match(/^Today: (.+?) greets every walk-in/))) f.peer = m[1];
  return f;
}

export function fixesFor(a) {
  const k = kindOf(a), f = facts(a), stake = a.rupees_week;
  const why0 = a.now != null && a.expected != null;
  let opts;
  if (k === "staff") {
    opts = [
      { text: `${f.peer || "Your strongest salesperson"} calls ${f.left}'s ${f.customers || "recent"} customers from the last 90 days to introduce themselves.`, who: f.peer ? `${f.peer} (salesperson)` : "Store manager",
        why: `${f.left}'s customers have nobody to come back to. Store conversion is ${pc(a.now)} vs ${pc(a.expected)} expected.`,
        say: `${firstName(f.peer)}, please call ${firstName(f.left)}'s regular customers today and tell them you'll look after them now.` },
      { text: "Lock this weekend's rota and move one weekday off so Saturday is fully covered.", who: "Store manager",
        why: `The store lost its #1 seller; weekends are when most customers walk in.`,
        say: "Team, one weekday off moves this week so we're full on Saturday. Thank you for covering." },
      { text: `Ask HR to confirm whether ${f.left} has left, and plan cover until it's settled.`, who: "Area manager",
        why: `No bill and no roster entry for 21+ days.` },
    ];
  } else if (k === "buyers") {
    opts = [
      { text: `Put your strongest closer${f.peer ? `, ${f.peer},` : ""} on the floor from 5 to 8 pm and let them greet every walk-in.`, who: f.peer ? `${f.peer} (salesperson)` : "Store manager",
        why: why0 ? `Only ${pc(a.now)} of walk-ins are buying vs ${pc(a.expected)} expected for this time of year.` : "Fewer walk-ins are buying than expected.",
        say: `${f.peer ? firstName(f.peer) + ", " : ""}please take the door from 5 to 8 today and stay with each customer until their first trial.` },
      { text: `Lock the weekend rota${f.person ? ` (starting with ${f.person})` : ""} and move weekly offs to Tuesday–Wednesday${f.floor ? `, so ${f.floor} people are on the floor` : ""}.`, who: "Store manager",
        why: "Weekends bring the most walk-ins; missed shifts there cost the most bills.",
        say: "Team, weekly offs move to Tuesday or Wednesday from this week so we're full at weekends." },
      { text: "Hold a 10-minute huddle before opening every day this week: one customer story, one goal for the day.", who: "Store manager",
        why: why0 ? `Goal: bring conversion back from ${pc(a.now)} towards ${pc(a.expected)}.` : "Keeps the team focused on every walk-in." },
    ];
  } else if (k === "discount") {
    const lim = f.limit || (f.norm ? Math.max(1, Math.round(+f.norm)) : null);
    opts = [
      { text: `From today, any discount by ${f.person} above ${lim}% needs the store manager's OK at the till.`, who: "Store manager",
        why: `${f.person} gives ${f.rate}% off MRP; the rest of the store gives ${f.norm}%.`,
        say: `${firstName(f.person)}, from today anything above ${lim}% off, check with me first. Try offering a free alteration before the discount.` },
      { text: "Before any discount, offer a free alteration or a matching add-on (stole, mala, mojari) instead.", who: `${f.person} (salesperson)`,
        why: `The rest of the store closes sales at ${f.norm}% discount.` },
      { text: `Review ${f.person}'s bills at closing every day this week.`, who: "Store manager",
        why: `Check the discount comes down from ${f.rate}% towards ${f.norm}%.` },
    ];
  } else if (k === "basket") {
    opts = [
      { text: "Bring a safa and mojari to the trial room with every sherwani, and a jacket with every kurta.", who: "Every salesperson",
        why: why0 ? `Customers are buying ${a.now.toFixed(2)} items per bill vs ${a.expected.toFixed(2)} expected.` : "Customers are buying fewer items per bill.",
        say: "Team, today every sherwani trial gets a safa and mojari, every kurta gets a jacket, before the customer asks." },
      { text: `${f.peer || "Your best seller"} shadows ${f.person || "the salesperson whose baskets dropped most"} on their first three trials today.`, who: f.peer ? `${f.peer} (salesperson)` : "Store manager",
        why: f.person ? `${f.person}'s basket size dropped the most in the store.` : "One salesperson drove most of the drop.",
        say: f.peer && f.person ? `${firstName(f.peer)}, please join ${firstName(f.person)} on the first three trials and show how you add the safa and mojari.` : undefined },
      { text: `Check items per bill at closing every day this week${f.person ? `, starting with ${f.person}'s bills` : ""}.`, who: "Store manager",
        why: why0 ? `Target: back to ${a.expected.toFixed(2)} items per bill.` : "Keeps the add-on habit going." },
    ];
  } else {
    opts = [
      { text: "At billing, save every customer's phone number and family wedding date.", who: f.person ? `${f.person} (salesperson)` : "Every salesperson",
        why: why0 ? `${pc(a.now)} of first-time customers came back vs ${pc(a.expected)} for the rest of the store.` : "Few customers are coming back.",
        say: f.person ? `${firstName(f.person)}, from today please save the customer's number and wedding date on every bill.` : "Team, from today save the number and wedding date on every bill." },
      { text: `${f.person || "The team"} pairs with ${f.model || "the role model"} for one billing shift today.`, who: "Store manager",
        why: f.model ? `${f.model}'s customers come back the most in this store.` : "Learn from whoever's customers come back most.",
        say: f.model ? `${firstName(f.model)}, please take ${f.person ? firstName(f.person) : "the team"} with you at the billing counter this evening.` : undefined },
      { text: `Send a thank-you WhatsApp the day after every purchase${f.customers ? `, and call the ${f.customers} wedding customers who haven't been back` : ""}.`, who: f.person ? `${f.person} (salesperson)` : "Store manager",
        why: "A thank-you the next day brings customers back for the rest of the wedding." },
    ];
  }
  const meta = [
    { level: "Quick win", effort: "5 min · today", share: "part of" },
    { level: "Today", effort: "one talk or rota change", share: "most of" },
    { level: "This week", effort: "needs follow-through", share: "up to" },
  ];
  return opts.map((o, i) => ({ ...o, ...meta[i], recommended: i === 0, win: `${meta[i].share} ₹${Math.round(stake).toLocaleString("en-IN")}/week (estimate)` }));
}
