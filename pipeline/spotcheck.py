"""Independent spot-check of headline numbers: plain pandas on the raw CSVs, no pipeline code.
Run from the repo root after the pipeline:  python pipeline/spotcheck.py"""
import pandas as pd, json
B=pd.read_csv("data/bills.csv",dtype=str); B["d"]=pd.to_datetime(B.bill_date)
L=pd.read_csv("data/bill_lines.csv",dtype={"bill_id":str,"sku_id":str})
I=pd.read_csv("data/items.csv",dtype=str); pk=set(I[I.is_packaging=="1"].sku_id)
F=pd.read_csv("data/footfall_daily.csv",dtype={"store_id":str}); F["d"]=pd.to_datetime(F.date)
R=pd.read_csv("data/roster_daily.csv",dtype=str); R["d"]=pd.to_datetime(R.date)
SP=pd.read_csv("data/salespeople.csv",dtype=str).set_index("salesperson_id")
rep=json.load(open("report.json",encoding="utf-8"))
P=L[~L.sku_id.isin(pk)].copy(); P["rev"]=P.qty*P.selling_price; P["mrpv"]=P.qty*P.mrp
pb=P.groupby("bill_id").agg(items=("qty","sum"),rev=("rev","sum"),mrpv=("mrpv","sum"))
B=B.join(pb,on="bill_id")
e=pd.Timestamp("2026-10-31"); s=e-pd.Timedelta(days=27)
def chk(name, mine, report, tol=0.005):
    ok = abs(mine-report) <= tol*max(abs(report),1e-9) + 1e-9
    print(("OK  " if ok else "DIFF"), name, "| independent:", round(mine,4), "| report:", round(report,4))
# 1. Lucknow dashboard tiles
lko=["LKO-01","LKO-02","LKO-03","LKO-04"]
b=B[B.store_id.isin(lko)&(B.d>=s)&(B.d<=e)]; f=F[F.store_id.isin(lko)&(F.d>=s)&(F.d<=e)]
K=rep["kpis"]; cur={k:sum(K[x]["cur"][k] for x in lko) for k in ["bills","rev","footfall","conv_bills","items"]}
chk("LKO bills 28d", len(b), cur["bills"]); chk("LKO avg basket", b.rev.sum()/len(b), cur["rev"]/cur["bills"])
chk("LKO conversion", len(b)/f.footfall.sum(), cur["conv_bills"]/cur["footfall"]); chk("LKO items/bill", b["items"].sum()/len(b), cur["items"]/cur["bills"])
# repeat: first bill (any store) 30-365 days before e, billed again 30+ days after first
first=B.groupby("customer_id").d.min(); fst=B.sort_values("d").drop_duplicates("customer_id").set_index("customer_id")
coh=first[(first<=e-pd.Timedelta(days=30))&(first>e-pd.Timedelta(days=365))]
later=B.merge(coh.rename("fd"),left_on="customer_id",right_index=True); came=set(later[later.d>=later.fd+pd.Timedelta(days=30)].customer_id)
c=fst.loc[coh.index]; c=c[c.store_id.isin(lko)]
chk("LKO repeat rate", c.index.isin(list(came)).mean(), sum(K[x]["repeat_sum"] for x in lko)/sum(K[x]["repeat_count"] for x in lko))
# 2. Imran C.
im=B[B.salesperson_id=="SP1018"]; print("Imran last bill", im.d.max().date(), "| last present", R[(R.salesperson_id=="SP1018")&(R.status=="Present")].d.max().date())
w=B[(B.store_id=="LKO-02")&(B.d>e-pd.Timedelta(days=150))&(B.d<=e-pd.Timedelta(days=21))]; sh=w.salesperson_id.value_counts(normalize=True)
print("Imran share", round(sh["SP1018"],3), "rank", list(sh.index).index("SP1018")+1)
lb=im.d.max(); print("Imran weekly rev (12 wks before last bill)", round(im[im.d>lb-pd.Timedelta(days=84)].rev.sum()/12))
print("Imran customers last 90d", im[im.d>lb-pd.Timedelta(days=90)].customer_id.nunique())
# 3. Manoj N. PAT-01 discount
p=B[(B.store_id=="PAT-01")&(B.d>=s)&(B.d<=e)]; me=p[p.salesperson_id=="SP1064"]; ot=p[p.salesperson_id!="SP1064"]
md=(me.mrpv-me.rev).sum()/me.mrpv.sum(); od=(ot.mrpv-ot.rev).sum()/ot.mrpv.sum()
print("Manoj N. disc", round(md,4), "others", round(od,4), "bills", len(me), "excess", round((md-od)*me.mrpv.sum()))
# 4. Kunal C.
k=c=fst.loc[coh.index]; k=k[(k.salesperson_id=="SP1033")]; print("Kunal C. cohort", len(k), "came back", k.index.isin(list(came)).sum())
# 5. PAT-03 camera
z=F[(F.store_id=="PAT-03")&(F.footfall==0)]; zb=B[(B.store_id=="PAT-03")&B.d.isin(z.d)]
print("PAT-03 zero days", len(z), z.d.min().date(), z.d.max().date(), "bills on them", len(zb))
# 6. Vijay N. off rate
for sp in ["SP1142","SP1141"]:
    r=R[R.salesperson_id==sp]; cu=r[r.d>=s]; be=r[(r.d<s)&(r.d>=s-pd.Timedelta(days=84))]
    print(SP.name[sp], "off now", round((cu.status=="Off").mean(),3), "before", round((be.status=="Off").mean(),3))
# 7. alerts per AM <= 5, cards <= 60 words
print("max alerts/AM", max(len(a["alerts"]) for a in rep["area_managers"]), "| max card words", max(len(" ".join([c["behaviour"],c["peer"],c["action"]]).split()) for c in rep["cards"]))
