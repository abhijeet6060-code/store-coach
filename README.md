# Store Coach

**Live:** https://store-coach-mu.vercel.app

Built by **Vibe Syndicate** at Vibe Coders Hackathon Edition 3, Kolkata, for Manyavar (Vedant Fashions), problem statement A.

Every morning, without anyone asking, Store Coach tells each **area manager** which stores need attention and why (max 5 a week, ranked by rupees at stake, each with lever, cause and one action), and gives each **salesperson** a card of 60 words or fewer: one behaviour, a peer from the same store, one action for today.

## How it works

- `pipeline/coach.py` reads the data pack in `data/` and writes `report.json`.
  - Three levers: conversion (bills ÷ footfall), items per bill, repeat customers. Plus discount vs the store's norm.
  - Fair comparison: each store against what its own same weeks last year predict (keeps festival and wedding swings out), and against city peers. A whole city slowing down is reported as a market issue.
  - Causes it can name: a top seller who has stopped billing, salespeople missing shifts, too few people on the floor at weekends, missing add-ons (safa / mojari / mala with sherwani, jacket with kurta), heavy discounting.
  - Data issues (e.g. door camera reading 0 on days with sales) are flagged and left out, never sent to area managers.
  - Follow-up: each run re-checks last week's alerts and says whether the number moved.
- `index.html` + `js/app.js` show the report.

## Run it

```
pip install -r requirements.txt
python pipeline/coach.py --data data --out report.json
```

Data is the synthetic Manyavar data pack provided at the hackathon (no real stores, staff or customers).
