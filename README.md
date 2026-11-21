# Store Coach

**Live:** https://store-coach-mu.vercel.app (opens without sign-in)

Built by **Vibe Syndicate** at Vibe Coders Hackathon Edition 3, Kolkata, for problem statement **A · Store Coach** (Manyavar / Vedant Fashions). Hackathon prototype on the synthetic data pack; not an official Manyavar product.

> Every morning, without anyone asking, tell each **area manager** which stores need attention and why, and tell each **salesperson** one thing to do better today.

## What it does

| For | What they get |
|---|---|
| **Area manager** | Store health at a glance (healthy / needs attention / critical / insufficient data), max 5 alerts a week ranked by ₹ at stake, each with lever, evidence, cause, one action, owner and confidence. Turns any alert into a tracked follow-up, reviews store manager submissions, plans visits, downloads reports. |
| **Store manager** | Own store only: performance, alerts, team coaching progress, and assigned tasks to update with remarks and photo evidence. |
| **Salesperson** | A coaching card of 60 words or fewer: one behaviour, a better peer from the same store, one action for today. |

The link opens on a **welcome screen**: pick a role (no password). Each role starts on **Today**, one tick-box list of what needs doing (issues, follow-ups to review or chase, personal to-dos). Use **⇄ Switch role** in the sidebar to change. Area managers can delete a follow-up created by mistake.

## What it finds in the data (as of 31 Oct 2026)

- **A good salesperson has left:** LKO-02's #1 seller Imran C. (19% of bills, ₹1,12,159 a week) has not billed since 13 Sep and is off the roster since 14 Sep.
- **Missing shifts:** BLR-03's Vijay N. off 46% of days (was 30%), Manjunath K. 43% (was 29%); store conversion down.
- **Too few people on busy days**, **basket drops** with the salesperson who drove them, **missing add-ons** (safa/mojari/mala with sherwani, jacket with kurta).
- **Discounts well above the store's norm:** e.g. PAT-01's Manoj N. at 4.7% of MRP vs 1.8% for the rest of the store.
- **Repeat customers:** salespeople whose customers don't come back (LKO-04's Kunal C.: 0 of 235) and **role models** whose customers do.
- **Data issues kept out of alerts:** PAT-03's door camera read 0 walk-ins for 12 days (5–16 Oct) while 24 bills were made.
- **Follow-up:** each run re-checks last week's alerts and says whether the number improved, got worse or has not moved.

## How it works

```
data/*.csv ──► pipeline/coach.py ──► report.json ──► index.html + js/ (static web app on Vercel)
                                                         └─ follow-ups, remarks, photos, visit notes:
                                                            demo updates saved in the browser
```

- **Levers:** conversion = bills ÷ walk-ins; items per bill (packaging excluded); repeat = first-time customers who bill again 30+ days later.
- **Fair comparison:** each store vs what its own same weeks last year predict (keeps Diwali and wedding-season swings out), and vs other stores in its city. If every store in a city slows, it's flagged as a market issue. Salespeople are compared only with peers in their own store.
- **Numbers are calculated, never generated.** ₹ at stake is an estimate and labelled as one; measured results are shown separately.
- **Runs on its own:** `.github/workflows/daily.yml` runs the analysis every morning at 06:00 IST (and can deploy the result to Vercel when the deploy secrets are set).

## Check the numbers

```
pip install -r requirements.txt
python pipeline/coach.py --data data --out report.json
python pipeline/spotcheck.py
```

`spotcheck.py` recomputes the headline figures from the raw CSVs with separate code and compares them to the report.

## Honest limits

- The data is a historical synthetic pack (to 31 Oct 2026), not a live feed.
- Follow-ups and remarks are stored per browser (no shared database in this prototype).
- No real login: demo access by role, as required for a public link.
