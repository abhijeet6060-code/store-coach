# Store Coach: guide for recording the demo video

This guide is for whoever records our 2-minute video. It explains what we built, what every screen shows, the evidence behind the numbers, and exactly what to click and say.

- **Live app:** https://store-coach-mu.vercel.app (opens without any login)
- **Team:** Vibe Syndicate · Vibe Coders Hackathon Edition 3, Kolkata
- **Problem statement:** A · Store Coach, set by Manyavar (Vedant Fashions)
- **Video rules:** max **2 minutes**, the product must be **shown working**, uploaded as Loom, unlisted YouTube or Google Drive, and **anyone with the link must be able to open it**

---

## 1. The idea in 30 seconds

Manyavar's area managers each look after 2 to 5 stores. They can't visit every store every day, so problems are noticed late.

**Store Coach** looks at two years of sales, footfall and staff data every morning and tells:

- the **area manager**: which store has a problem, **why**, and **what to do today**
- the **store manager**: the tasks their area manager gave them
- each **salesperson**: one thing to do better today

Everything is about Manyavar's three growth levers:

| Lever | In plain words |
|---|---|
| **More bills** | More of the people who walk in actually buy something |
| **Bigger baskets** | Each customer buys more items, like a safa with a sherwani |
| **More repeat** | Customers come back to buy again |

---

## 2. Where to start (before you record)

1. Open **https://store-coach-mu.vercel.app** in Chrome, full screen. Zoom to **90%** (Ctrl and minus) so more fits on screen.
2. You land on the **welcome screen** with three cards: **Area Manager**, **Store Manager**, **Salesperson**. No password.
3. **Clear old test data:** click **Enter** on any card, scroll to the bottom of the left sidebar, click **Reset demo updates**, confirm, then click **⇄ Switch role** (top left) to go back to the welcome screen.
4. Record everything in **this one browser window**. Follow-ups, remarks and photos are saved in this browser only.
5. Keep a small photo ready on the computer (any picture, e.g. a staff rota), to attach as "evidence" in the store manager part.

---

## 3. Every screen, what it shows, and what to click

### 3.1 Welcome screen
- **What it is:** pick who you are: Area Manager, Store Manager or Salesperson. Each card has a dropdown and an **Enter** button.
- **For the video:** Area Manager → **Rakesh Srivastava · Lucknow** → **Enter**.
- **Switching later:** **⇄ Switch role** at the top of the sidebar brings you back here.

### 3.2 Area Manager: Overview
- **Top line:** *Total stores 4 · Healthy 1 · Need attention 3 · Pending follow-ups 0*.
- **Big orange button: Run AI Analysis.** On a phone, the orange **AI** button in the top-right corner does the same.
- **When you click it**, after a second it shows **Analysis results**:
  - "Checked all 4 stores."
  - "Found 4 problems: 1 × best seller missing, 1 × smaller baskets, 1 × customers not returning, 1 × too much discount."
  - "Fixing them could bring back about ₹1.3L of sales a week (estimate)."
  - **Follow-up drafts**, each with: priority (High / Medium / Low), a problem tag, an ⓘ line in simple words, **What to do**, ₹ per week, a deadline you can change, and an **Evidence** link to expand.
  - High and medium drafts are pre-ticked. **Approve 2 follow-ups** sends them to the store managers.
- **Top 3 issues** below, with an **Assign** button on each.
- **"What do these words mean?"** explains conversion, items per bill, repeat, ₹ at stake and store health in one line each.

### 3.3 Area Manager: Stores
- A searchable table: **store**, a **12-week sales trend line** with % change, **conversion**, **open follow-ups**, **status dot** (green healthy, amber needs attention, red critical).
- Type in **Search stores** to filter. **CSV** downloads the table.
- A **"Festival season"** note explains why the % jump is large (Dussehra this month, Diwali on 8 Nov), so nobody mistakes the season for growth.
- **Click any row** to open the store page:
  - **Overview:** sales, conversion, items per bill and repeat customers vs the previous 28 days, with weekly charts (hover for exact numbers)
  - **AI insights:** this store's problems
  - **Staff:** every salesperson's numbers, compared only with colleagues in the same store, plus a link to their coaching cards
  - **Follow-ups:** everything ever assigned to this store

### 3.4 Area Manager: Follow-ups
- Tabs: **Pending · In progress · Completed · My to-dos** (personal checklist with tick boxes).
- **+ New follow-up:** choose the store, category, priority and deadline, then write the problem and the action.
- **Click a follow-up** to open it:
  - Problem and required action
  - **7-day tracking:** Before → Action → After → Result (the number at the start, re-measured 7 days after the task is done)
  - **Deadline:** change it and give a reason (recorded in the history)
  - **Updates:** a timeline of every remark and photo
  - Buttons by status: **Start review → Approve & close** or **Send back (reject)**, later **Reopen**, and **Delete** for mistakes

### 3.5 Area Manager: AI Insights
- Every issue across your stores, highest ₹ first. Each one has:
  - **Priority:** High (₹20K+/week), Medium (₹5K+), Low
  - **Problem tag** and an **"in simple words"** line
  - **Evidence:** the exact numbers
  - **What to do:** who, what, when
  - Owner, confidence, ₹ per week, and **Assign** (or the follow-up's status if one already exists)
- Below that:
  - **Role models:** salespeople whose customers come back the most
  - **Last week's issues, one week later:** did the number improve?
  - **Data issues**

### 3.6 Store Manager (Switch role → Store Manager → e.g. LKO-02)
- **Today:** one list of the tasks from their area manager (**Update** button), their store's problems, and their to-dos with tick boxes.
- **Task page:** **Start work** → write a remark → attach a photo → **Submit as done**. **Add remark only** explains a delay.
- **My store:** the same store page the area manager sees, for their store only. They can't open other stores.
- **Team:** the coaching card of each salesperson in their store.

### 3.7 Salesperson (Switch role → Salesperson → e.g. Karthik J. · SP1110 · BLR-01)
- **One thing to do today**, with a big tick box. Example for Karthik: *"Offer a free alteration or add-on suggestion before any discount; ask the manager before going above 5%."*
- **Why:** *"You give 1.3% discount on MRP. Nithin J. gives 0.4% and still closes."* (a colleague in the same store)
- The card is 31 words; the brief's limit is 60.
- **How you compare with your store's peers** (click to open): your numbers vs the store's middle value.
- **My to-dos.**

---

## 4. The evidence: what the app found in Manyavar's data

Data: 20 stores, 6 cities, **1 Nov 2024 – 31 Oct 2026**, about 90,000 bills (synthetic data from Manyavar's data pack).

| Finding | Numbers (from the data) | Where to see it |
|---|---|---|
| **Best seller has left** (LKO-02, Lucknow) | Imran C. made **19% of the store's bills**, about **₹1.12 lakh a week**. No bill since **13 Sep**, not on the staff roster since **14 Sep**. | Rakesh → Overview / AI Insights |
| **Smaller baskets** (LKO-03) | Items per bill **1.69 vs 1.79** expected. Biggest drop: Rizwan J. **1.59** (was **2.17**). | Rakesh → AI Insights |
| **Customers not returning** (LKO-04) | Kunal C.: **0 of 235** first-time customers came back; the rest of the store gets **2.9%**. | Rakesh → AI Insights |
| **Too much discount** (PAT-01, Patna) | Manoj N. gives **4.7%** off MRP vs **1.8%** for the rest of the store. | Nitin Sinha → AI Insights |
| **Missing shifts** (BLR-03, Bengaluru) | Vijay N. off **46%** of days (was **30%**), Manjunath K. **43%** (was **29%**). Conversion down. | Harish Gowda → AI Insights |
| **Role model** (BLR-01) | Karthik J.: **6.5%** of customers came back vs **2.4%** for the store. | Harish Gowda → AI Insights |
| **Data issue, kept out of alerts** (PAT-03) | Door camera read **0 walk-ins for 12 days** (5–16 Oct) while **24 bills** were made. | Nitin Sinha → AI Insights → Data issues |

**How we know the numbers are right:** `pipeline/spotcheck.py` recalculates the headline numbers straight from the raw data with separate code, and every one matches.

**Why festivals don't cause false alarms:** each store is compared with what its own same weeks last year predict, not just last month.

---

## 5. The 2-minute recording plan

Start on the welcome screen with demo data reset. Everything below is shown working, live.

| Time | Click this | Say this (your own words are fine) |
|---|---|---|
| **0:00–0:10** | Welcome → Area Manager **Rakesh Srivastava · Lucknow** → **Enter** | "This is Store Coach. Every morning it tells each Manyavar area manager which stores need attention and why, and gives every salesperson one thing to do better today. No login, you just pick a role." |
| **0:10–0:20** | Point at the top line on **Overview** | "Rakesh runs four Lucknow stores. In ten seconds he sees one is healthy and three need attention." |
| **0:20–0:45** | Click **Run AI Analysis** → read the summary → open **Evidence** on the first draft | "One click checks every store. It found four problems and about 1.3 lakh rupees of sales a week to win back. The biggest: LKO-02's best salesperson, Imran, made one in five of the store's sales and hasn't billed since 13 September. Every number comes straight from the data." |
| **0:45–0:55** | Change one deadline → **Approve 2 follow-ups** | "It drafts the tasks for him. He changes a deadline and approves. Each goes to that store's manager with the evidence and the action filled in." |
| **0:55–1:15** | **⇄ Switch role** → Store Manager **LKO-02** → **Enter** → **Update** on the Imran task → **Start work** → type a remark → attach the photo → **Submit as done** | "The store manager sees only their own store. They start the task, write what they did, attach a photo, and submit." |
| **1:15–1:30** | **⇄ Switch role** → Area Manager → **Enter** → **Follow-ups** → **In progress** → open the task → **Start review** → **Approve & close** → point at Before → After | "Back to Rakesh. He checks the remark and photo and approves. The app re-measures the number seven days later to see if it moved." |
| **1:30–1:40** | **Stores** → point at a trend line → click **LKO-02** → **Staff** | "Every store has its trend, its problems, its task history, and each salesperson compared only with colleagues in the same store." |
| **1:40–1:50** | **⇄ Switch role** → **Salesperson** → **Enter** → tick **One thing to do today** | "Every salesperson gets one simple thing to do today, with a colleague from the same store as the example, and ticks it off." |
| **1:50–2:00** | **⇄ Switch role** → Area Manager **Nitin Sinha · Patna** → **Enter** → **AI Insights** → scroll to **Data issues** (PAT-03 camera). Lucknow has no data issue, so it must be Patna. | "It also spots numbers that can't be right, like a door camera reading zero for 12 days, and keeps them out. Store Coach: more bills, bigger baskets, more repeat." |

**If you run long,** cut 1:30–1:40 (Stores).

---

## 6. Recording tips

- Use **Loom** (screen + mic). Close other tabs and notifications.
- Do one practice run, then **Reset demo updates** again before the real take.
- Move the mouse **slowly**, and keep it still while you talk.
- Speak to someone who has never worked in retail: say "people who walk in and buy" rather than "conversion".
- After uploading, set sharing to **"Anyone with the link"**, then **open the link in an incognito window** to make sure it plays without logging in. If a mentor can't open it, it counts as no video.

## 7. What not to say

- Don't say the AI "invented" or "predicted" numbers. Every number is **calculated from the data**; the ₹ amounts are **estimates** and the app labels them that way.
- Don't call it an official Manyavar app. It's a **hackathon prototype on Manyavar's synthetic data**.
- Don't promise stock or inventory features. Stock is a different problem statement.
- Don't say it's connected to live store systems. It runs on the data pack provided (up to 31 Oct 2026).

## 8. Final checklist

- [ ] Video is 2:00 or shorter
- [ ] The app is shown **working** (clicks, not slides)
- [ ] Link opens in an incognito window
- [ ] Link pasted on the hackathon page before **4:45 pm**
