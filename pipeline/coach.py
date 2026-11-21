"""Store Coach daily run.

Reads the Manyavar CSVs, looks at every store and salesperson through three levers
(conversion, items per bill, repeat) plus discount, and writes:
  - up to 5 alerts per area manager, ranked by rupees at stake, each with lever, cause and one action
  - one card (<= 60 words) per active salesperson: one behaviour, a peer from the same store, one action
  - data issues (never sent to area managers)
  - a follow-up on last week's alerts: did the number move?

Usage: python pipeline/coach.py [--data data] [--as-of 2026-10-31] [--out report.json]
"""
import argparse, json, math
from pathlib import Path
import pandas as pd
import numpy as np

WINDOW = 28      # days in the "current" window
BASELINE = 84    # days before that used as the store's own norm
ROSTER_START = pd.Timestamp("2026-05-01")


def rs(x):
    """Format rupees the Indian way: 1,23,456."""
    x = int(round(x))
    s = str(abs(x))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:]); head = head[:-2]
        if head: parts.insert(0, head)
        s = ",".join(parts + [tail])
    return ("-" if x < 0 else "") + "₹" + s


def load(d: Path):
    S = pd.read_csv(d / "stores.csv", dtype=str)
    AM = pd.read_csv(d / "area_managers.csv", dtype=str)
    SP = pd.read_csv(d / "salespeople.csv", dtype=str)
    I = pd.read_csv(d / "items.csv", dtype=str)
    I["is_packaging"] = I.is_packaging.astype(int)
    B = pd.read_csv(d / "bills.csv", dtype=str)
    B["d"] = pd.to_datetime(B.bill_date)
    L = pd.read_csv(d / "bill_lines.csv", dtype={"bill_id": str, "sku_id": str})
    F = pd.read_csv(d / "footfall_daily.csv", dtype={"store_id": str})
    F["d"] = pd.to_datetime(F.date)
    R = pd.read_csv(d / "roster_daily.csv", dtype=str)
    R["d"] = pd.to_datetime(R.date)
    C = pd.read_csv(d / "calendar.csv", dtype=str)
    C["d"] = pd.to_datetime(C.date)

    L = L.merge(I[["sku_id", "category", "is_packaging"]], on="sku_id", how="left")
    L = L[L.is_packaging == 0]  # carry bags and covers are not products
    L["rev"] = L.qty * L.selling_price
    L["mrpv"] = L.qty * L.mrp
    L["disc"] = L.mrpv - L.rev
    per_bill = L.groupby("bill_id").agg(items=("qty", "sum"), rev=("rev", "sum"),
                                        mrpv=("mrpv", "sum"), disc=("disc", "sum"))
    cats = L.groupby("bill_id").category.agg(lambda c: frozenset(c))
    B = B.join(per_bill, on="bill_id").join(cats.rename("cats"), on="bill_id")
    B = B.dropna(subset=["items"])
    B["has_sherwani"] = B.cats.apply(lambda c: "Sherwani" in c)
    B["sherwani_attach"] = B.cats.apply(lambda c: bool(c & {"Safa", "Mojari", "Mala"}))
    B["has_kurta"] = B.cats.apply(lambda c: "Kurta Set" in c)
    B["kurta_jacket"] = B.cats.apply(lambda c: "Jacket" in c)
    return dict(S=S, AM=AM, SP=SP, I=I, B=B, L=L, F=F, R=R, C=C)


# ---------------------------------------------------------------- data issues
def data_issues(D, start, end):
    """Numbers that can't be right. Flag them; never alert the area manager on them."""
    B, F = D["B"], D["F"]
    out, bad = [], set()
    fb = F[(F.d >= start) & (F.d <= end)].set_index(["store_id", "d"]).footfall
    bb = B[(B.d >= start) & (B.d <= end)].groupby(["store_id", "d"]).size()
    j = pd.concat([fb.rename("footfall"), bb.rename("bills")], axis=1).fillna(0)
    # A run of consecutive zero-walk-in days is a camera fault if the store billed on any day of the run.
    zero = j[j.footfall == 0].reset_index().rename(columns={"level_0": "store_id", "level_1": "d"})
    zero.columns = ["store_id", "d", "footfall", "bills"]
    for store, g in zero.groupby("store_id"):
        g = g.sort_values("d")
        run_id = (g.d.diff().dt.days != 1).cumsum()
        for _, run in g.groupby(run_id):
            if run.bills.sum() == 0:
                continue
            out.append({"store_id": store, "issue": "Door camera shows 0 walk-ins while the store was selling",
                        "detail": f"{len(run)} days in a row ({run.d.min():%d %b}–{run.d.max():%d %b}) read 0 walk-ins, "
                                  f"but {int(run.bills.sum())} bills were made on those days. Conversion for these days is left out. "
                                  f"Ask the store to check the door camera.",
                        "days": len(run)})
            bad.update(zip(run.store_id, run.d))
    over = j[(j.footfall > 0) & (j.bills > j.footfall)]
    for store, g in over.groupby(level=0):
        out.append({"store_id": store, "issue": "More bills than walk-ins",
                    "detail": f"{len(g)} days where bills exceed the door count. Conversion for these days is left out.",
                    "days": len(g)})
        bad.update(g.index.tolist())
    neg = F[(F.d >= start) & (F.d <= end) & (F.footfall < 0)]
    for store, g in neg.groupby("store_id"):
        out.append({"store_id": store, "issue": "Negative walk-in count", "detail": f"{len(g)} days.", "days": len(g)})
        bad.update(zip(g.store_id, g.d))
    return out, bad


# ---------------------------------------------------------------- store metrics
def store_window(D, store, s, e, bad_days):
    B, F = D["B"], D["F"]
    b = B[(B.store_id == store) & (B.d >= s) & (B.d <= e)]
    f = F[(F.store_id == store) & (F.d >= s) & (F.d <= e)]
    ok = np.array([(store, d) not in bad_days for d in f.d], dtype=bool)
    f_ok = f.loc[ok] if len(f) else f
    good_days = set(f_ok.d)
    b_ok = b[b.d.isin(good_days)]
    ff = f_ok.footfall.sum()
    return {
        "bills": len(b), "rev": b.rev.sum(), "items": b["items"].sum(),
        "footfall": int(ff),
        "conv": (len(b_ok) / ff) if ff > 0 else np.nan,
        "ipb": b["items"].mean() if len(b) else np.nan,
        "abv": b.rev.mean() if len(b) else np.nan,
        "disc": (b.disc.sum() / b.mrpv.sum()) if len(b) else np.nan,
        "days": (e - s).days + 1,
        "sh_bills": int(b.has_sherwani.sum()),
        "sh_attach": b[b.has_sherwani].sherwani_attach.mean() if b.has_sherwani.any() else np.nan,
    }


def staffing(D, store, s, e, bad_days=frozenset()):
    """Floor strength on weekends vs weekdays, and who is missing shifts."""
    R, F = D["R"], D["F"]
    r = R[(R.store_id == store) & (R.d >= s) & (R.d <= e)]
    if r.empty:
        return None
    pres = r[r.status == "Present"].groupby("d").size()
    f = F[(F.store_id == store) & (F.d >= s) & (F.d <= e)].set_index("d").footfall
    j = pd.concat([pres.rename("staff"), f.rename("ff")], axis=1).fillna(0)
    j = j[[(store, d) not in bad_days for d in j.index]]  # drop days the door camera was wrong
    j["wkend"] = j.index.dayofweek >= 5
    j["ff_per_staff"] = j.ff / j.staff.replace(0, np.nan)
    return j


def absences(D, store, s, e, base_s):
    R = D["R"]
    r = R[(R.store_id == store) & (R.d >= base_s) & (R.d <= e)].copy()
    if r.empty:
        return []
    r["cur"] = r.d >= s
    r["off"] = r.status == "Off"
    t = r.groupby(["salesperson_id", "cur"]).off.mean().unstack()
    if True not in t or False not in t:
        return []
    t = t.dropna()
    t["jump"] = t[True] - t[False]
    t = t[(t[True] >= 0.30) & (t.jump >= 0.12)].sort_values(True, ascending=False)
    sp = D["SP"].set_index("salesperson_id")
    return [{"id": i, "name": sp.name.get(i, i), "off_now": float(t.loc[i, True]), "off_before": float(t.loc[i, False])} for i in t.index]


def leavers(D, store, s, e):
    """A good salesperson has left: was a top seller in the 90 days before, has not billed for 21+ days."""
    B = D["B"]
    b = B[(B.store_id == store) & (B.d > e - pd.Timedelta(days=150)) & (B.d <= e)]
    if b.empty:
        return []
    last = b.groupby("salesperson_id").d.max()
    prior = b[b.d <= e - pd.Timedelta(days=21)]
    share = prior.groupby("salesperson_id").size() / max(len(prior), 1)
    rank = share.rank(ascending=False)
    sp = D["SP"].set_index("salesperson_id")
    R = D["R"]
    out = []
    for i, d in last.items():
        if (e - d).days >= 21 and share.get(i, 0) >= 0.08 and d >= s - pd.Timedelta(days=60):
            r = R[(R.salesperson_id == i) & (R.d <= e)]
            pres = r[r.status == "Present"].d
            last_present = pres.max() if len(pres) else None
            if last_present is not None and (e - last_present).days < 14:
                continue  # still turning up; not a leaver
            mine = b[(b.salesperson_id == i) & (b.d > d - pd.Timedelta(days=84))]
            out.append({"id": i, "name": sp.name.get(i, i), "last_bill": d, "share": float(share[i]), "rank": int(rank[i]),
                        "last_present": last_present, "weekly_rev": float(mine.rev.sum() / 12),
                        "customers": int(b[(b.salesperson_id == i) & (b.d > d - pd.Timedelta(days=90))].customer_id.nunique())})
    return sorted(out, key=lambda x: -x["share"])


def basket_driver(D, sid, s, e, bs, be):
    """Salesperson whose items-per-bill fell the most (weighted by bills), and the best peer in the same store."""
    B = D["B"]
    b = B[(B.store_id == sid) & (B.d >= bs) & (B.d <= e)].assign(cur=lambda x: x.d >= s)
    g = b.groupby(["salesperson_id", "cur"])["items"].agg(["mean", "count"]).unstack()
    g = g.dropna()
    g = g[(g[("count", True)] >= 10) & (g[("count", False)] >= 20)]
    if len(g) < 3:
        return None
    drop = (g[("mean", False)] - g[("mean", True)]) * g[("count", True)]
    i = drop.idxmax()
    if drop[i] <= 0:
        return None
    peer = g[("mean", True)].drop(i).idxmax()
    names = D["SP"].set_index("salesperson_id").name
    return {"id": i, "name": names.get(i, i), "now": float(g.loc[i, ("mean", True)]), "before": float(g.loc[i, ("mean", False)]),
            "peer": names.get(peer, peer), "peer_ipb": float(g.loc[peer, ("mean", True)])}


def discount_outliers(D, sid, s, e):
    """Salespeople discounting at least double the rest of their own store, and 2+ points above it."""
    B = D["B"]
    b = B[(B.store_id == sid) & (B.d >= s) & (B.d <= e)]
    if b.empty:
        return []
    g = b.groupby("salesperson_id").agg(disc=("disc", "sum"), mrpv=("mrpv", "sum"), bills=("bill_id", "count"))
    tot_d, tot_m = g.disc.sum(), g.mrpv.sum()
    names = D["SP"].set_index("salesperson_id").name
    out = []
    for i, x in g[g.bills >= 10].iterrows():
        rate = x.disc / x.mrpv
        others = (tot_d - x.disc) / (tot_m - x.mrpv)
        if rate >= 2 * others and rate - others >= 0.02:
            out.append({"id": i, "name": names.get(i, i), "rate": float(rate), "others": float(others), "bills": int(x.bills),
                        "excess": float((rate - others) * x.mrpv)})
    return sorted(out, key=lambda x: -x["excess"])


def repeat_stats(D, e):
    """Customers whose first bill was 30-365 days before as_of: share that billed again 30+ days after first bill."""
    B = D["B"][D["B"].d <= e]
    first = B.sort_values("d").groupby("customer_id").first()[["d", "store_id", "salesperson_id"]]
    cohort = first[(first.d <= e - pd.Timedelta(days=30)) & (first.d > e - pd.Timedelta(days=365))]
    again = B.merge(cohort.d.rename("fd"), left_on="customer_id", right_index=True)
    again = again[again.d >= again.fd + pd.Timedelta(days=30)].customer_id.unique()
    cohort = cohort.assign(rep=cohort.index.isin(again))
    return cohort


# ---------------------------------------------------------------- alerts
def build_alerts(D, as_of, bad_days):
    S, AM, B = D["S"], D["AM"], D["B"]
    e = as_of
    s = e - pd.Timedelta(days=WINDOW - 1)
    bs = s - pd.Timedelta(days=BASELINE)
    be = s - pd.Timedelta(days=1)
    ly_s, ly_e = s - pd.Timedelta(days=364), e - pd.Timedelta(days=364)
    weeks = WINDOW / 7

    rows = []
    for _, st in S.iterrows():
        cur = store_window(D, st.store_id, s, e, bad_days)
        base = store_window(D, st.store_id, bs, be, bad_days)
        ly = store_window(D, st.store_id, ly_s, ly_e, bad_days)
        lyb = store_window(D, st.store_id, ly_s - pd.Timedelta(days=BASELINE), ly_s - pd.Timedelta(days=1), bad_days)
        opened = pd.Timestamp(st.opened_on)
        rows.append({**{f"cur_{k}": v for k, v in cur.items()}, **{f"base_{k}": v for k, v in base.items()},
                     **{f"ly_{k}": v for k, v in ly.items()}, **{f"lyb_{k}": v for k, v in lyb.items()},
                     "store_id": st.store_id, "city": st.city, "state": st.state, "tier": st.tier,
                     "am": st.area_manager_id, "new": (e - opened).days < 180})
    M = pd.DataFrame(rows).set_index("store_id")

    # Seasonal expectation: last year's change over the same weeks. This keeps festival and wedding swings out.
    for k in ["conv", "ipb", "disc"]:
        season = (M[f"ly_{k}"] / M[f"lyb_{k}"]).replace([np.inf, -np.inf], np.nan)
        season = season.fillna(season.median())
        M[f"exp_{k}"] = M[f"base_{k}"] * season
        M[f"chg_{k}"] = M[f"cur_{k}"] / M[f"exp_{k}"] - 1
    # Market: the city's median change. If the whole city slowed, it is a market issue, not one store's.
    M["city_chg_conv"] = M.groupby("city").chg_conv.transform("median")
    M["city_n"] = M.groupby("city").chg_conv.transform("count")

    alerts = []
    for city, g in M[~M.new].groupby("city"):
        if len(g) >= 2 and (g.chg_conv < -0.08).all():
            lost_bills = ((g.exp_conv - g.cur_conv) * g.cur_footfall).sum()
            rupees = lost_bills * g.cur_abv.mean() / weeks
            alerts.append({"am": g.am.iloc[0], "store_id": ", ".join(g.index), "lever": "More bills",
                           "title": f"All {city} stores converting less",
                           "cause": f"Conversion is down in every {city} store ({', '.join(f'{i} {v:+.0%}' for i, v in g.chg_conv.items())} vs what the season predicts). "
                                    f"This is a market slowdown, not one store's problem.",
                           "action": f"This weekend, run a joint {city} WhatsApp message to last season's wedding customers from all {len(g)} stores; review city-level next Monday.",
                           "who": "Area manager", "when": "This weekend",
                           "rupees_week": float(rupees), "metric": "conv", "market": True,
                           "now": float(g.cur_conv.mean()), "expected": float(g.exp_conv.mean())})
            M.loc[g.index, "market"] = True

    for sid, r in M.iterrows():
        if r.new:
            continue
        # ---- More bills: a good salesperson has left (checked even inside a slow market)
        lv = leavers(D, sid, s, e)
        for p in lv[:1]:
            peer = top_seller(D, sid, s, e)
            alerts.append({"am": r.am, "store_id": sid, "lever": "More bills",
                           "title": f"{sid}: top seller {p['name']} has stopped billing",
                           "cause": (f"{p['name']} ({p['id']}) was the #{p['rank']} seller with {p['share']:.0%} of the store's bills "
                                     f"({rs(p['weekly_rev'])} a week). No bill since {p['last_bill']:%d %b}"
                                     + (f" and not on the roster since {p['last_present']:%d %b}." if p.get("last_present") is not None else ".")
                                     + f" Store conversion now {r.cur_conv:.1%} vs expected {r.exp_conv:.1%}."),
                           "action": (f"Today: {peer} calls {p['name']}'s {p['customers']} customers from the last 90 days to introduce themselves; "
                                      f"store manager confirms with HR whether {p['name']} has left and moves one weekday off to cover Saturday."),
                           "rupees_week": float(p["weekly_rev"]), "metric": "conv",
                           "now": float(r.cur_conv), "expected": float(r.exp_conv)})
        # ---- Bigger baskets: one salesperson discounting well above the store's norm
        for dsp in discount_outliers(D, sid, s, e):
            alerts.append({"am": r.am, "store_id": sid, "lever": "Bigger baskets",
                           "title": f"{sid}: {dsp['name']} discounting {dsp['rate']:.1%} vs store {dsp['others']:.1%}",
                           "cause": (f"In the last {WINDOW} days {dsp['name']} ({dsp['id']}) gave {dsp['rate']:.1%} off MRP on {dsp['bills']} bills; "
                                     f"the rest of the store gave {dsp['others']:.1%}. Extra discount: {rs(dsp['excess'])} in {WINDOW} days."),
                           "action": f"From today, any discount by {dsp['name']} above {max(dsp['others'] * 100, 1):.0f}% needs the store manager's OK at the till; manager reviews their bills at close on Saturday.",
                           "rupees_week": float(dsp["excess"] / weeks), "metric": "sp_disc", "sp": dsp["id"],
                           "now": float(dsp["rate"]), "expected": float(dsp["others"])})
        if r.get("market") is True:
            continue
        # ---- More bills: conversion
        if pd.notna(r.chg_conv) and r.chg_conv < -0.08 and (r.chg_conv - r.city_chg_conv) < -0.05 and not lv:
            lost = (r.exp_conv - r.cur_conv) * r.cur_footfall
            rupees = lost * r.cur_abv / weeks
            ab = absences(D, sid, s, e, max(bs, ROSTER_START))
            st = staffing(D, sid, s, e, bad_days)
            if lv:
                p = lv[0]
                peer = top_seller(D, sid, s, e)
                cause = (f"{p['name']} ({p['id']}), the #{p['rank']} seller with {p['share']:.0%} of bills, has not billed since "
                         f"{p['last_bill']:%d %b}. Walk-ins held but conversion fell to {r.cur_conv:.1%} from an expected {r.exp_conv:.1%}.")
                action = (f"Today: put {peer} on the floor on the busy hours of every weekend and pair them with the newest salesperson; "
                          f"confirm with HR whether {p['name']} has left.")
            elif ab:
                names = ", ".join(f"{a['name']} (off {a['off_now']:.0%} of days, was {a['off_before']:.0%})" for a in ab[:2])
                cause = f"Shifts are being missed: {names}. Conversion fell to {r.cur_conv:.1%} from an expected {r.exp_conv:.1%}."
                wk = st[st.wkend] if st is not None else None
                action = (f"Store manager: lock {ab[0]['name']}'s rota for this Saturday and Sunday, and move weekly offs to Tuesday–Wednesday "
                          f"so at least {int(math.ceil(wk.staff.mean()) + 1) if wk is not None and len(wk) else 'one more'} people are on the floor at weekends.")
            elif st is not None and len(st) and st[st.wkend].ff_per_staff.mean() > 1.25 * st[~st.wkend].ff_per_staff.mean():
                wk = st[st.wkend]
                need = int(math.ceil(wk.ff.mean() / max(st[~st.wkend].ff_per_staff.mean(), 1)))
                cause = (f"Too few people on the floor on busy days: {wk.ff_per_staff.mean():.0f} walk-ins per salesperson at weekends vs "
                         f"{st[~st.wkend].ff_per_staff.mean():.0f} on weekdays. Conversion {r.cur_conv:.1%} vs expected {r.exp_conv:.1%}.")
                action = f"Keep {need} people on the floor this Saturday and Sunday, 4–8 pm; move weekend offs to Tuesday."
            else:
                cause = f"Walk-ins steady but fewer buying: conversion {r.cur_conv:.1%} vs expected {r.exp_conv:.1%}, while {r.city} peers moved {r.city_chg_conv:+.0%}."
                peer = top_seller(D, sid, s, e)
                action = f"Today: {peer} greets every walk-in between 5 and 8 pm and hands over only after the first trial."
            alerts.append({"am": r.am, "store_id": sid, "lever": "More bills", "title": f"{sid}: conversion down {-r.chg_conv:.0%}",
                           "cause": cause, "action": action, "rupees_week": float(rupees), "metric": "conv",
                           "now": float(r.cur_conv), "expected": float(r.exp_conv)})

        # ---- Bigger baskets: items per bill
        if pd.notna(r.chg_ipb) and r.chg_ipb < -0.06:
            avg_item = r.cur_rev / max(r.cur_items, 1)
            rupees = (r.exp_ipb - r.cur_ipb) * r.cur_bills * avg_item / weeks
            sh = r.cur_sh_attach
            cause = f"Items per bill {r.cur_ipb:.2f} vs expected {r.exp_ipb:.2f}."
            if pd.notna(sh) and r.cur_sh_bills >= 5:
                cause += f" Only {sh:.0%} of sherwani bills had a safa, mojari or mala."
            w = basket_driver(D, sid, s, e, bs, be)
            if w:
                cause += (f" Biggest drop: {w['name']} ({w['now']:.2f} items/bill, was {w['before']:.2f}); "
                          f"{w['peer']} holds {w['peer_ipb']:.2f}.")
                action = (f"Today: {w['peer']} shadows {w['name']} on the first three sherwani or kurta trials and shows the safa, "
                          f"mojari and jacket add-on; store manager checks {w['name']}'s bills at 6 pm.")
            else:
                action = "Show a safa and mojari with every sherwani trial today, and a jacket with every kurta trial; store manager checks at 6 pm."
            alerts.append({"am": r.am, "store_id": sid, "lever": "Bigger baskets", "title": f"{sid}: smaller baskets ({r.chg_ipb:+.0%})",
                           "cause": cause, "action": action, "rupees_week": float(rupees), "metric": "ipb",
                           "now": float(r.cur_ipb), "expected": float(r.exp_ipb)})

        # ---- Bigger baskets: discount above the store's norm
        if (pd.notna(r.cur_disc) and pd.notna(r.base_disc) and r.cur_disc > max(2 * r.exp_disc, r.exp_disc + 0.008)
                and not any(a["store_id"] == sid and a["metric"] == "sp_disc" for a in alerts)):
            rupees = (r.cur_disc - r.exp_disc) * r.cur_rev / (1 - r.cur_disc) / weeks
            who = discounters(D, sid, s, e)
            cause = f"Discount is {r.cur_disc:.1%} of MRP vs a norm of {r.exp_disc:.1%}."
            if who:
                cause += f" Most of it from {who[0]['name']} ({who[0]['disc']:.1%})."
            action = (f"From today, discounts above 5% need the store manager's OK at the till"
                      + (f"; manager talks to {who[0]['name']} before the shift." if who else "."))
            alerts.append({"am": r.am, "store_id": sid, "lever": "Bigger baskets", "title": f"{sid}: discounting above norm",
                           "cause": cause, "action": action, "rupees_week": float(rupees), "metric": "disc",
                           "now": float(r.cur_disc), "expected": float(r.exp_disc)})

    # ---- More repeat
    coh = repeat_stats(D, e)
    rep = coh.groupby("store_id").rep.agg(["mean", "count"])
    rep["state_mean"] = rep.join(M.state).groupby("state")["mean"].transform("median")
    M.attrs["coh"] = coh
    names = D["SP"].set_index("salesperson_id").name
    active = set(B[(B.d > e - pd.Timedelta(days=21)) & (B.d <= e)].salesperson_id)
    # Salespeople whose customers don't come back, against the rest of their own store
    sp = coh.groupby(["store_id", "salesperson_id"]).rep.agg(["sum", "count"]).reset_index()
    for sid, g in sp.groupby("store_id"):
        if sid not in M.index or M.loc[sid, "new"]:
            continue
        for _, x in g[(g["count"] >= 100) & g.salesperson_id.isin(active)].iterrows():
            rest = g[g.salesperson_id != x.salesperson_id]
            rest_rate = rest["sum"].sum() / max(rest["count"].sum(), 1)
            rate = x["sum"] / x["count"]
            if rest_rate >= 0.015 and rate <= 0.35 * rest_rate:
                model = repeat_role_model(coh, sid, exclude=x.salesperson_id, active=active)
                missing = (rest_rate - rate) * x["count"]
                nm = names.get(x.salesperson_id, x.salesperson_id)
                mn = names.get(model, model) if model else "the store manager"
                alerts.append({"am": M.loc[sid, "am"], "store_id": sid, "lever": "More repeat",
                               "title": f"{sid}: {nm}'s customers don't come back",
                               "cause": (f"Of {int(x['count'])} first-time customers {nm} ({x.salesperson_id}) served in the last year, "
                                         f"{int(x['sum'])} came back ({rate:.1%}); the rest of the store gets {rest_rate:.1%}. "
                                         f"Role model: {mn.rstrip('.')}."),
                               "action": (f"Today: {mn} shows {nm} how they take the customer's number and wedding date at billing; "
                                          f"from tomorrow {nm} sends a thank-you WhatsApp to every customer the day after they buy."),
                               "rupees_week": float(missing * M.loc[sid, "cur_abv"] / 52), "metric": "repeat",
                               "now": float(rate), "expected": float(rest_rate)})
    for sid, r in rep.iterrows():
        if sid not in M.index or M.loc[sid, "new"] or r["count"] < 300:
            continue
        if r["mean"] < 0.6 * r.state_mean:
            missing = (r.state_mean - r["mean"]) * r["count"]
            rupees = missing * M.loc[sid, "cur_abv"] / 52
            lapsed = lapsed_wedding(D, sid, e)
            model = repeat_role_model(coh, sid, active=active)
            model = names.get(model, model) if model else None
            alerts.append({"am": M.loc[sid, "am"], "store_id": sid, "lever": "More repeat",
                           "title": f"{sid}: customers not coming back",
                           "cause": f"{r['mean']:.1%} of first-time customers came back vs {r.state_mean:.1%} for stores in {M.loc[sid, 'state']}."
                                    + (f" Role model: {model} keeps the best repeat rate in the store." if model else ""),
                           "action": f"Today, {model or 'the store manager'} and one colleague call the {lapsed} customers who bought for a wedding 9–15 months ago and have not been back.",
                           "rupees_week": float(rupees), "metric": "repeat", "now": float(r["mean"]), "expected": float(r.state_mean)})

    M.attrs["all_alerts"] = alerts
    out = {}
    for am, g in pd.DataFrame(alerts).groupby("am") if alerts else []:
        g = g.sort_values("rupees_week", ascending=False)
        cap = int(AM.set_index("area_manager_id").max_alerts_per_week.get(am, 5))
        out[am] = g.head(cap).to_dict("records")
    return out, M


def top_seller(D, sid, s, e):
    B = D["B"]
    b = B[(B.store_id == sid) & (B.d >= s) & (B.d <= e)]
    if b.empty:
        return "the senior salesperson"
    i = b.groupby("salesperson_id").rev.sum().idxmax()
    return D["SP"].set_index("salesperson_id").name.get(i, i)


def discounters(D, sid, s, e):
    B = D["B"]
    b = B[(B.store_id == sid) & (B.d >= s) & (B.d <= e)]
    g = b.groupby("salesperson_id").agg(disc=("disc", "sum"), mrpv=("mrpv", "sum"), n=("bill_id", "count"))
    g = g[g.n >= 10]
    g["rate"] = g.disc / g.mrpv
    g = g.sort_values("disc", ascending=False)
    sp = D["SP"].set_index("salesperson_id")
    return [{"id": i, "name": sp.name.get(i, i), "disc": float(g.loc[i, "rate"])} for i in g.index[:2] if g.loc[i, "rate"] > 0.02]


def lapsed_wedding(D, sid, e):
    """Customers whose last bill at this store was 9-15 months ago, containing a sherwani or wedding wear, who haven't been back."""
    B = D["B"]
    last = B[B.d <= e].sort_values("d").groupby("customer_id").last()
    m = last[(last.store_id == sid) & (last.d <= e - pd.Timedelta(days=270)) & (last.d > e - pd.Timedelta(days=455))
             & (last.has_sherwani | last.cats.apply(lambda c: bool(c & {"Indo-Western", "Safa"})))]
    return len(m)


def repeat_role_model(coh, sid, exclude=None, active=None):
    c = coh[coh.store_id == sid].groupby("salesperson_id").rep.agg(["mean", "count"])
    c = c[(c["count"] >= 40) & (c.index != exclude)]
    if active is not None:
        c = c[c.index.isin(active)]
    if c.empty:
        return None
    return c["mean"].idxmax()


# ---------------------------------------------------------------- salesperson cards
def build_cards(D, as_of, coh=None):
    B, SP, L = D["B"], D["SP"], D["L"]
    e = as_of
    s = e - pd.Timedelta(days=89)
    b = B[(B.d >= s) & (B.d <= e)]
    active = set(B[(B.d > e - pd.Timedelta(days=21)) & (B.d <= e)].salesperson_id)
    g = b.groupby(["store_id", "salesperson_id"]).agg(
        bills=("bill_id", "count"), ipb=("items", "mean"),
        sh_n=("has_sherwani", "sum"), sh_att=("sherwani_attach", lambda x: np.nan),
        disc=("disc", "sum"), mrpv=("mrpv", "sum"))
    sh = b[b.has_sherwani].groupby(["store_id", "salesperson_id"]).sherwani_attach.mean()
    ku = b[b.has_kurta].groupby(["store_id", "salesperson_id"]).kurta_jacket.mean()
    kun = b[b.has_kurta].groupby(["store_id", "salesperson_id"]).size()
    g["sh_att"] = sh
    g["ku_att"] = ku
    g["ku_n"] = kun
    g["disc_rate"] = g.disc / g.mrpv
    if coh is not None:
        rp = coh.groupby(["store_id", "salesperson_id"]).rep.agg(["mean", "count"])
        g["rep"] = rp["mean"]
        g["rep_n"] = rp["count"]
    else:
        g["rep"], g["rep_n"] = np.nan, 0
    g["rep_n"] = g["rep_n"].fillna(0)
    # Category mix: units by category for each salesperson vs their city
    stores = D["S"].set_index("store_id")
    lb = L[L.bill_id.isin(b.bill_id)].merge(b[["bill_id", "store_id", "salesperson_id"]], on="bill_id")
    lb["city"] = lb.store_id.map(stores.city)
    main_cats = ["Sherwani", "Indo-Western", "Kurta Set", "Jacket"]
    city_mix = lb.groupby(["city", "category"]).qty.sum()
    city_mix = (city_mix / city_mix.groupby(level=0).transform("sum")).unstack().reindex(columns=main_cats)
    sp_mix = lb.groupby(["salesperson_id", "category"]).qty.sum()
    sp_mix = (sp_mix / sp_mix.groupby(level=0).transform("sum")).unstack().reindex(columns=main_cats).fillna(0)
    g = g.reset_index()
    g = g[g.salesperson_id.isin(active) & (g.bills >= 20)]
    names = SP.set_index("salesperson_id").name

    levers = [
        ("sh_att", "sh_n", 6, +1, lambda me, peer, pv: (
            f"Only {me:.0%} of your sherwani bills had a safa, mojari or mala.",
            f"{peer} adds one {pv:.0%} of the time.",
            "Today: bring a safa and mojari to the trial room with every sherwani, before the customer asks.")),
        ("ku_att", "ku_n", 12, +1, lambda me, peer, pv: (
            f"Only {me:.0%} of your kurta bills had a jacket.",
            f"{peer} sells a jacket with {pv:.0%} of kurtas.",
            "Today: offer a matching Nehru jacket with every kurta trial, on the customer, not on the hanger.")),
        ("ipb", "bills", 20, +1, lambda me, peer, pv: (
            f"Your bills average {me:.2f} items.",
            f"{peer} averages {pv:.2f}.",
            "Today: before billing, suggest one add-on that completes the look: stole, mala or mojari.")),
        ("disc_rate", "bills", 20, -1, lambda me, peer, pv: (
            f"You give {me:.1%} discount on MRP.",
            f"{peer} gives {pv:.1%} and still closes.",
            "Today: offer a free alteration or add-on suggestion before any discount; ask the manager before going above 5%.")),
    ]
    levers.append(("rep", "rep_n", 100, +1, lambda me, peer, pv: (
        f"Only {me:.1%} of your first-time customers came back.",
        f"{peer} brings back {pv:.1%}.",
        "Today: at billing, save every customer's number and family wedding date, and send a thank-you WhatsApp tomorrow.")))
    sp_join = SP.set_index("salesperson_id").join_date
    cards = []
    for store, grp in g.groupby("store_id"):
        city = stores.city[store]
        for _, me in grp.iterrows():
            best = None
            # Avoiding a category the city buys
            if me.salesperson_id in sp_mix.index and me.bills >= 40:
                for cat in main_cats:
                    cs, ms = city_mix.loc[city, cat], sp_mix.loc[me.salesperson_id, cat]
                    if pd.notna(cs) and cs >= 0.08 and ms < 0.5 * cs:
                        rel = 1 - ms / cs
                        pool = [x for x in grp.salesperson_id if x != me.salesperson_id and x in sp_mix.index]
                        if not pool:
                            continue
                        pr = max(pool, key=lambda x: sp_mix.loc[x, cat])
                        txt = (f"{cat} is {cs:.0%} of what {city} buys, but only {ms:.0%} of what you sell.",
                               f"{names.get(pr, pr)} sells {sp_mix.loc[pr, cat]:.0%} {cat}.",
                               f"Today: show at least one {cat} to every customer who asks for wedding or festive wear.")
                        if best is None or rel > best[0]:
                            best = (rel, "cat_" + cat, txt)
            for col, ncol, minn, sign, text in levers:
                if pd.isna(me[col]) or me[ncol] < minn:
                    continue
                peers = grp[(grp.salesperson_id != me.salesperson_id) & (grp[ncol] >= minn) & grp[col].notna()]
                if len(peers) < 2:
                    continue
                med = peers[col].median()
                gap = (med - me[col]) * sign
                rel = gap / (abs(med) + 1e-9)
                if col == "disc_rate":
                    rel = gap / 0.02  # discount: compare in absolute points
                if col == "rep":
                    rel *= 0.4  # repeat rates are small and noisy; only lead with it when the gap is large
                if gap <= 0:
                    continue
                pr = peers.loc[(peers[col] * sign).idxmax()]
                if best is None or rel > best[0]:
                    best = (rel, col, text(me[col], names.get(pr.salesperson_id, pr.salesperson_id), pr[col]))
            if best is None or best[0] < 0.08:
                others = [x for x in grp.salesperson_id if x != me.salesperson_id]
                newest = max(others, key=lambda x: sp_join.get(x, "")) if others else None
                nn = names.get(newest, newest) if newest else "the newest colleague"
                text = ("You are at or above your store's peers on add-ons, basket size, discount and repeat customers.",
                        f"{nn} joined most recently and can learn from you.",
                        f"Today: take {nn} on your first sherwani trial and show how you add the safa and mojari.")
                col = "strong"
            else:
                _, col, text = best
            # Me vs the median of my store's peers, for the coach screen bars
            metrics = {}
            for mcol, label, ncol, minn, sign in [("ipb", "Items per bill", "bills", 20, +1),
                                                  ("ku_att", "Jacket with kurta", "ku_n", 12, +1),
                                                  ("sh_att", "Add-on with sherwani", "sh_n", 6, +1),
                                                  ("disc_rate", "Discount on MRP", "bills", 20, -1),
                                                  ("rep", "Customers who return", "rep_n", 100, +1)]:
                if pd.isna(me[mcol]) or me[ncol] < minn:
                    continue
                pv = grp[(grp.salesperson_id != me.salesperson_id) & (grp[ncol] >= minn)][mcol].dropna()
                if len(pv) < 2:
                    continue
                metrics[mcol] = {"label": label, "me": float(me[mcol]), "peer_median": float(pv.median()),
                                 "higher_is_better": sign > 0}
            body = " ".join(text)
            words = len(body.split())
            assert words <= 60, body
            cards.append({"salesperson_id": me.salesperson_id, "name": names.get(me.salesperson_id, me.salesperson_id),
                          "store_id": store, "lever": col, "behaviour": text[0], "peer": text[1], "action": text[2],
                          "words": words, "value": None if col.startswith("cat_") or col == "strong" else float(me[col]),
                          "bills_90d": int(me.bills), "metrics": metrics})
    return cards


def build_role_models(D, coh, e):
    """Salespeople whose customers come back the most, per store. Name them so others can learn."""
    if coh is None:
        return []
    B = D["B"]
    active = set(B[(B.d > e - pd.Timedelta(days=21)) & (B.d <= e)].salesperson_id)
    names = D["SP"].set_index("salesperson_id").name
    c = coh.groupby(["store_id", "salesperson_id"]).rep.agg(["mean", "sum", "count"]).reset_index()
    c = c[(c["count"] >= 60) & c.salesperson_id.isin(active)]
    out = []
    for sid, g in c.groupby("store_id"):
        top = g.sort_values("mean", ascending=False).iloc[0]
        store_rate = coh[coh.store_id == sid].rep.mean()
        if top["mean"] >= 1.5 * store_rate and top["sum"] >= 3:
            out.append({"store_id": sid, "salesperson_id": top.salesperson_id, "name": names.get(top.salesperson_id),
                        "rate": float(top["mean"]), "store_rate": float(store_rate), "customers": int(top["count"]),
                        "text": f"{names.get(top.salesperson_id)} ({sid}): {top['mean']:.1%} of first-time customers came back vs {store_rate:.1%} for the store."})
    return out


# ---------------------------------------------------------------- follow-up
def follow_up(prev_alerts, M):
    out = []
    for am, items in prev_alerts.items():
        for a in items:
            sid = a["store_id"].split(",")[0].strip()
            if sid not in M.index:
                continue
            key = {"conv": "cur_conv", "ipb": "cur_ipb", "disc": "cur_disc"}.get(a["metric"])
            if key is None:
                continue
            now = float(M.loc[sid, key])
            before = a["now"]
            better = now > before if a["metric"] in ("conv", "ipb") else now < before
            moved = abs(now - before) / (abs(before) + 1e-9) > 0.02
            fmt = (lambda v: f"{v:.1%}") if a["metric"] in ("conv", "disc") else (lambda v: f"{v:.2f}")
            verdict = "improved" if moved and better else ("got worse" if moved else "has not moved")
            out.append({"am": am, "store_id": a["store_id"], "title": a["title"], "metric": a["metric"],
                        "before": before, "now": now, "verdict": verdict,
                        "text": f"Last week: {a['title']}. {fmt(before)} then, {fmt(now)} now: {verdict}."})
    return out


def store_kpis(D, e, bad_days, coh):
    """Per store: last 28 days vs the 28 days before, plus 12 weekly points. Raw sums so any group can be added up."""
    B, F = D["B"], D["F"]
    out = {}
    rep = coh.groupby("store_id").rep.agg(["sum", "count"]) if coh is not None else None

    def sums(sid, s, t):
        b = B[(B.store_id == sid) & (B.d >= s) & (B.d <= t)]
        f = F[(F.store_id == sid) & (F.d >= s) & (F.d <= t)]
        ok = np.array([(sid, d) not in bad_days for d in f.d], dtype=bool)
        good = set(f.d[ok]) if len(f) else set()
        return {"bills": int(len(b)), "rev": float(b.rev.sum()), "items": int(b["items"].sum()),
                "disc": float(b.disc.sum()), "mrpv": float(b.mrpv.sum()),
                "conv_bills": int(b.d.isin(good).sum()), "footfall": int(f.footfall[ok].sum()) if len(f) else 0}

    for sid in D["S"].store_id:
        cur = sums(sid, e - pd.Timedelta(days=27), e)
        prev = sums(sid, e - pd.Timedelta(days=55), e - pd.Timedelta(days=28))
        weeks = []
        for k in range(11, -1, -1):
            we = e - pd.Timedelta(days=7 * k)
            w = sums(sid, we - pd.Timedelta(days=6), we)
            w["week_ending"] = f"{we:%Y-%m-%d}"
            weeks.append(w)
        out[sid] = {"cur": cur, "prev": prev, "weeks": weeks,
                    "repeat_sum": int(rep.loc[sid, "sum"]) if rep is not None and sid in rep.index else 0,
                    "repeat_count": int(rep.loc[sid, "count"]) if rep is not None and sid in rep.index else 0}
    return out


def season_context(C, e):
    """Festivals and wedding dates in the last 28 days vs the 28 before, per state, so growth figures can say why."""
    out = {}
    for state, g in C.groupby("state"):
        cur = g[(g.d > e - pd.Timedelta(days=28)) & (g.d <= e)]
        prev = g[(g.d > e - pd.Timedelta(days=56)) & (g.d <= e - pd.Timedelta(days=28))]
        nxt = g[(g.d > e) & (g.d <= e + pd.Timedelta(days=30)) & g.festival.notna()].sort_values("d")
        out[state] = {"cur_festivals": sorted(set(cur.festival.dropna())), "prev_festivals": sorted(set(prev.festival.dropna())),
                      "cur_wedding_days": int((cur.is_wedding_date == "1").sum()), "prev_wedding_days": int((prev.is_wedding_date == "1").sum()),
                      "next_festival": {"name": nxt.festival.iloc[0], "date": f"{nxt.d.iloc[0]:%Y-%m-%d}"} if len(nxt) else None}
    return out


def run(data_dir, as_of=None):
    D = load(Path(data_dir))
    end = D["B"].d.max() if as_of is None else pd.Timestamp(as_of)
    issues, bad = data_issues(D, end - pd.Timedelta(days=WINDOW + BASELINE + 400), end)
    alerts, M = build_alerts(D, end, bad)
    prev_alerts, _ = build_alerts(D, end - pd.Timedelta(days=7), bad)
    fu = follow_up(prev_alerts, M)
    cards = build_cards(D, end, M.attrs.get("coh"))
    role_models = build_role_models(D, M.attrs.get("coh"), end)
    ams = D["AM"].set_index("area_manager_id")
    stores = D["S"].set_index("store_id")
    return {
        "as_of": f"{end:%Y-%m-%d}",
        "generated_at": pd.Timestamp.now(tz="Asia/Kolkata").strftime("%Y-%m-%d %H:%M IST"),
        "window_days": WINDOW,
        "area_managers": [{"id": i, "name": r["name"], "city": r.city, "stores": [x.strip() for x in r.stores.split(",")],
                           "alerts": alerts.get(i, []), "follow_up": [f for f in fu if f["am"] == i],
                           "role_models": [m for m in role_models if m["store_id"] in [x.strip() for x in r.stores.split(",")]]}
                          for i, r in ams.iterrows()],
        "cards": cards,
        "data_issues": [d for d in issues if d["store_id"] in stores.index],
        "kpis": store_kpis(D, end, bad, M.attrs.get("coh")),
        "season": season_context(D["C"], end),
        "store_alerts": {sid: sorted([{k: a[k] for k in ("lever", "title", "cause", "action", "rupees_week", "metric", "now", "expected")}
                                      for a in M.attrs.get("all_alerts", []) if sid in [x.strip() for x in a["store_id"].split(",")]],
                                     key=lambda a: -a["rupees_week"])
                         for sid in stores.index},
        "stores": {sid: {"city": r.city, "state": r.state, "tier": r.tier, "am": r.area_manager_id,
                         "conv": None if pd.isna(M.loc[sid, "cur_conv"]) else float(M.loc[sid, "cur_conv"]),
                         "ipb": None if pd.isna(M.loc[sid, "cur_ipb"]) else float(M.loc[sid, "cur_ipb"]),
                         "rev": float(M.loc[sid, "cur_rev"]), "bills": int(M.loc[sid, "cur_bills"]),
                         "new": bool(M.loc[sid, "new"])}
                   for sid, r in stores.iterrows()},
    }


def _clean(o):
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    if isinstance(o, (pd.Timestamp,)):
        return f"{o:%Y-%m-%d}"
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        return None if math.isnan(o) else round(float(o), 4)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--as-of", default=None)
    ap.add_argument("--out", default="report.json")
    a = ap.parse_args()
    rep = _clean(run(a.data, a.as_of))
    Path(a.out).write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    n = sum(len(x["alerts"]) for x in rep["area_managers"])
    print(f"as of {rep['as_of']}: {n} alerts, {len(rep['cards'])} cards, {len(rep['data_issues'])} data issues -> {a.out}")
