// Settings tab: GitHub sync with the private repo, restore, export/import, install.
// Repo layout: content/*.json (read), progress/progress.json + progress/backups/<date>.json,
// answers/answers.json (practice answers for Claude), feedback/feedback.json (written by Claude).
document.addEventListener("app-ready", () => {
const { kv, cfg, gh, pullContent, errText, DEF_REPO } = window.BOOT;
const A = window.APP, $ = A.$;
const st = () => A.state();
const today = () => new Date().toISOString().slice(0, 10);
const b64 = (s) => { const u = new TextEncoder().encode(s); let o = ""; for (let i = 0; i < u.length; i += 0x8000) o += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(o); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const say = (id, t, cls) => { const e = $(id); if (e) { e.textContent = t; e.className = `small ${cls || "muted"}`; } };

async function getJson(path) { const f = await gh(path); if (!f) return { sha: null, data: null }; return { sha: f.sha, data: JSON.parse(unb64(f.content)) }; }
async function putJson(path, data, sha, msg) {
  const body = { message: msg, content: b64(JSON.stringify(data, null, 1) + "\n"), ...(sha ? { sha } : {}) };
  try { return await gh(path, { method: "PUT", body }); }
  catch (e) { if (e.code === 409 || e.code === 422) { const cur = await getJson(path); return gh(path, { method: "PUT", body: { ...body, sha: cur.sha || undefined } }); } throw e; }
}

// Per-item last-writer-wins using the doneT / notesT timestamps; chapter positions fill gaps.
function merge(local, remote) {
  const out = { ...local, ch: { ...(remote.ch || {}), ...(local.ch || {}) } };
  for (const [f, t] of [["done", "doneT"], ["notes", "notesT"]]) {
    const L = local[f] || {}, R = remote[f] || {}, LT = local[t] || {}, RT = remote[t] || {};
    out[f] = {}; out[t] = {};
    for (const k of new Set([...Object.keys(L), ...Object.keys(R), ...Object.keys(LT), ...Object.keys(RT)])) {
      const useR = (RT[k] || 0) > (LT[k] || 0) || (!(k in L) && !(k in LT));
      const v = useR ? R[k] : L[k], ts = useR ? RT[k] : LT[k];
      if (v !== undefined && v !== "" && v !== false) out[f][k] = v;
      if (ts) out[t][k] = ts;
    }
  }
  return out;
}
function applyState(m) { const s = st(); for (const k of ["ch", "done", "notes", "doneT", "notesT"]) s[k] = m[k] || {}; A.save(); A.rerender(); }
const snap = () => { const s = st(); return JSON.stringify({ ch: s.ch, done: s.done, notes: s.notes, doneT: s.doneT, notesT: s.notesT }); };

function answersDoc() {
  const s = st(), items = {};
  for (const l of A.lessonIndex()) { const a = (s.notes[l.id] || "").trim(); if (a) items[l.id] = { num: l.num, title: l.title, part: l.part, ref: l.ref, prompt: l.prompt, answer: a, at: new Date(s.notesT[l.id] || Date.now()).toISOString() }; }
  return { note: "Ricky 喺師傅房主題課程嘅練習答案。Claude 會讀呢個檔，回饋寫入 feedback/feedback.json（{items:{lessonId:{text,at}}}）。", items };
}

let busy = false, lastPushed = null;
async function syncNow({ restore = false, quiet = false } = {}) {
  if (busy) return; const c = cfg.get();
  if (!c.token) { if (!quiet) say("#gh-status", "未設定 token。", "bad"); return; }
  if (!navigator.onLine) { say("#gh-status", "而家冇網。進度照樣存喺呢部機，有網再同步。"); return; }
  busy = true; say("#gh-status", "同步緊…");
  try {
    const s = st(), stamp = new Date().toISOString();
    const p = await getJson("progress/progress.json");
    const merged = p.data?.school2 ? merge(s, p.data.school2) : { ...s };
    applyState(merged);
    const cur = snap();
    if (cur !== JSON.stringify(p.data?.school2 && { ch: p.data.school2.ch, done: p.data.school2.done, notes: p.data.school2.notes, doneT: p.data.school2.doneT, notesT: p.data.school2.notesT })) {
      const doc = { app: "masters-school", at: stamp, device: navigator.userAgent.slice(0, 120), school2: JSON.parse(cur) };
      await putJson("progress/progress.json", doc, p.sha, `progress ${stamp}`);
      const bk = `progress/backups/${today()}.json`, old = await gh(bk);
      await putJson(bk, doc, old?.sha, `daily backup ${today()}`);
    }
    lastPushed = cur;
    const ans = answersDoc(), a = await getJson("answers/answers.json");
    if (JSON.stringify(ans.items) !== JSON.stringify(a.data?.items || {})) await putJson("answers/answers.json", { ...ans, at: stamp }, a.sha, `answers ${stamp}`);
    const fb = await gh("feedback/feedback.json", { raw: true });
    if (fb) { try { localStorage.setItem("feedback", fb); } catch {} window.FEEDBACK = JSON.parse(fb).items || {}; A.rerender(); }
    let note = "";
    if (window.CONTENT_SOURCE !== "embedded") { const r = await pullContent(false); if (r.changed) note = "；教材有新版本，重新載入就用到"; }
    c.last = stamp; cfg.set(c);
    say("#gh-status", `${restore ? "已恢復" : "已同步"} ${stamp.slice(0, 16).replace("T", " ")} UTC · ${Object.keys(ans.items).length} 份練習答案已交俾 Claude · ${Object.keys(window.FEEDBACK || {}).length} 份回饋${note}`, "ok");
    if (restore) $("#restore-msg").textContent = `已攞返 ${Object.keys(st().done).filter((k) => st().done[k]).length} 課完成紀錄同 ${Object.keys(st().notes).length} 份筆記。`;
    info();
  } catch (e) { say("#gh-status", errText(e), "bad"); if (restore) $("#restore-msg").textContent = errText(e); }
  finally { busy = false; }
}
window.SYNC = { syncNow };

const c0 = cfg.get();
$("#gh-repo").value = c0.repo || DEF_REPO;
if (c0.token) say("#gh-status", `已設定 token${c0.last ? `，上次同步 ${c0.last.slice(0, 16).replace("T", " ")} UTC` : ""}。`);
$("#gh-save").onclick = async () => {
  const repo = $("#gh-repo").value.trim() || DEF_REPO, token = $("#gh-token").value.trim() || cfg.get().token;
  if (!token) { say("#gh-status", "請貼 token。", "bad"); return; }
  cfg.set({ ...cfg.get(), repo, token }); $("#gh-token").value = "";
  try { const r = await gh("content/manifest.json", { raw: true }); say("#gh-status", r ? "Token 用得，連到私人 repo。" : "Token 用得，但 repo 未有 content/。", r ? "ok" : "bad"); if (r) syncNow(); }
  catch (e) { say("#gh-status", errText(e), "bad"); }
};
$("#gh-sync").onclick = () => syncNow();
$("#gh-restore").onclick = () => { if (!cfg.get().token) { $("#restore-msg").textContent = "先喺左邊貼 token。"; return; } $("#restore-msg").textContent = "攞緊…"; syncNow({ restore: true }); };
$("#gh-forget").onclick = () => { cfg.clear(); $("#gh-token").value = ""; say("#gh-status", "已喺呢部機刪除 token。進度仍然留喺呢部機。"); };

// Export / import (same file format as the 練習簿 tab).
$("#exp2").onclick = () => { const body = JSON.stringify({ app: "masters-school", at: new Date().toISOString(), school2: st() }, null, 1), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "application/json" })); a.download = `masters-school-progress-${today()}.json`; document.body.appendChild(a); a.click(); a.remove(); $("#io2").textContent = "已匯出"; };
$("#imp2").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (!d.school2) throw 0; applyState(merge(st(), d.school2)); $("#io2").textContent = "已匯入"; info(); } catch { $("#io2").textContent = "讀唔到呢個檔，請揀匯出嘅 .json"; } };

async function info() {
  const s = st(), done = Object.values(s.done).filter(Boolean).length, notes = Object.keys(s.notes).length;
  const src = { embedded: "桌面檔案（內容已內置）", cache: "呢部機嘅離線副本", github: "私人 repo（已存落呢部機）" }[window.CONTENT_SOURCE] || "";
  const have = await kv.get("content");
  $("#local-info").textContent = `呢部機：完成 ${done} 課 · ${notes} 份筆記 · 內容來源：${src}${have?.version ? ` · 教材版本 ${have.version}` : ""}`;
}
info();

// Install + offline status.
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("#install-btn").hidden = false; });
$("#install-btn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("#install-btn").hidden = true; };
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const off = () => $("#offline-info").textContent = `${standalone ? "已安裝。" : ""}${location.protocol === "file:" ? "桌面檔案版：唔使網都用到。" : navigator.serviceWorker?.controller ? "離線已準備好：冇網都開得。" : "第一次開完之後就可以離線用。"}${navigator.onLine ? "" : " 而家冇網。"}`;
off(); addEventListener("online", off); addEventListener("offline", off); navigator.serviceWorker?.addEventListener?.("controllerchange", off);

// Auto sync: on open, when the page is hidden, and every few minutes if progress changed.
if (cfg.get().token) setTimeout(() => syncNow({ quiet: true }), 1500);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && cfg.get().token && snap() !== lastPushed) syncNow({ quiet: true }); });
setInterval(() => { if (cfg.get().token && lastPushed && snap() !== lastPushed) syncNow({ quiet: true }); }, 180000);
addEventListener("online", () => { if (cfg.get().token) syncNow({ quiet: true }); });
});
