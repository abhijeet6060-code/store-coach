// Follow-up tasks. Demo updates are saved in this browser (localStorage); there is no shared server.
const KEY = "sc_tasks_v1";
export const STATUSES = ["Pending", "In Progress", "Submitted", "Under Review", "Completed"];
const OPEN = new Set(["Pending", "In Progress", "Submitted", "Under Review"]);
let memory = []; // used if the browser blocks storage

function load() {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : memory; } catch { return memory; }
}
function save(list) {
  memory = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export const todayISO = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, local time
const nowStamp = () => new Date().toISOString();

export function all() { return load(); }
export function get(id) { return load().find((t) => t.id === id); }

// Overdue is derived: an open task (not yet submitted) past its deadline.
export function displayStatus(t) {
  if ((t.status === "Pending" || t.status === "In Progress") && t.deadline < todayISO()) return "Overdue";
  return t.status;
}
export const isOpen = (t) => OPEN.has(t.status);

// Same store + same issue still unresolved = duplicate.
export function findDuplicate({ store_id, issue_key, category }) {
  return load().find((t) => isOpen(t) && t.store_id === store_id && (t.issue_key === issue_key || (!issue_key && t.category === category && t.title === arguments[0].title)));
}

export function create(fields, by) {
  const dup = findDuplicate(fields);
  if (dup) return { error: `An open follow-up already exists for this issue at ${dup.store_id} (${dup.id}, ${dup.status}).`, dup };
  const list = load();
  const n = list.reduce((m, t) => Math.max(m, Number(t.id.slice(3)) || 0), 0) + 1;
  const t = {
    id: "FU-" + String(n).padStart(3, "0"),
    store_id: fields.store_id, title: fields.title, category: fields.category, problem: fields.problem,
    action: fields.action, deadline: fields.deadline, priority: fields.priority, assignee: `Store Manager, ${fields.store_id}`,
    issue_key: fields.issue_key || null, metric: fields.metric || null,
    status: "Pending", created_at: nowStamp(), created_by: by, completed_at: null,
    history: [{ at: nowStamp(), by, status: "Pending", note: "Follow-up created and assigned." }],
  };
  list.push(t);
  save(list);
  return { task: t };
}

// Allowed moves per role. Anything else is refused.
const MOVES = {
  "Store Manager": { Pending: ["In Progress"], "In Progress": ["Submitted"], Overdue: ["In Progress", "Submitted"] },
  "Area Manager": { Submitted: ["Under Review"], "Under Review": ["Completed", "In Progress"], Completed: ["In Progress"] },
};
export function allowed(t, role) { return (MOVES[role] || {})[displayStatus(t)] || (MOVES[role] || {})[t.status] || []; }

export function update(id, { status, note, photo }, by, role) {
  const list = load();
  const t = list.find((x) => x.id === id);
  if (!t) return { error: "Follow-up not found." };
  if (status && status !== t.status && !allowed(t, role).includes(status)) return { error: `${role} can't move ${t.id} from ${t.status} to ${status}.` };
  if (status === "Submitted" && !note && !t.history.some((h) => h.note && h.by === by)) return { error: "Add a remark describing what was done before submitting." };
  const entry = { at: nowStamp(), by, status: status || t.status, note: note || "" };
  if (photo) entry.photo = photo;
  if (status) t.status = status;
  if (status === "Completed") t.completed_at = nowStamp();
  if (status === "In Progress" && t.completed_at) t.completed_at = null;
  t.history.push(entry);
  if (!save(list) && photo) return { task: t, warn: "Photo too large to keep after reload on this device." };
  return { task: t };
}

export function resetAll() { save([]); }

// Downscale a photo so evidence fits in browser storage.
export function readPhoto(file, maxSide = 900) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = url;
  });
}

// Visit records (decision support; only what the manager records here)
const VKEY = "sc_visits_v1";
export function visits() { try { return JSON.parse(localStorage.getItem(VKEY) || "{}"); } catch { return {}; } }
export function saveVisit(store_id, rec) {
  const v = visits();
  v[store_id] = rec;
  try { localStorage.setItem(VKEY, JSON.stringify(v)); } catch { /* ignore */ }
}
