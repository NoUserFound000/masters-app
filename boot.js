// Loads content (embedded → device cache → private GitHub repo), then starts the app.
// The public site ships no content; it only reads what the token can see.
(() => {
const DB = "masters-school", OS = "kv";
const idb = () => new Promise((ok, no) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(OS); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
const kv = {
  async get(k) { try { const d = await idb(); return await new Promise((ok, no) => { const q = d.transaction(OS).objectStore(OS).get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); } catch { return undefined; } },
  async set(k, v) { try { const d = await idb(); await new Promise((ok, no) => { const t = d.transaction(OS, "readwrite"); t.objectStore(OS).put(v, k); t.oncomplete = ok; t.onerror = () => no(t.error); }); return true; } catch { return false; } },
};
const cfg = { get() { try { return JSON.parse(localStorage.getItem("gh-sync") || "{}"); } catch { return {}; } }, set(v) { try { localStorage.setItem("gh-sync", JSON.stringify(v)); } catch {} }, clear() { try { localStorage.removeItem("gh-sync"); } catch {} } };
const DEF_REPO = "NoUserFound000/masters-school";

async function gh(path, { raw = false, method = "GET", body } = {}) {
  const c = cfg.get();
  if (!c.token) throw Object.assign(new Error("no token"), { code: "no_token" });
  const r = await fetch(`https://api.github.com/repos/${c.repo || DEF_REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}${method === "GET" ? `?t=${Date.now()}` : ""}`, {
    method, cache: "no-store",
    headers: { Authorization: `Bearer ${c.token}`, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { code: r.status });
  return raw ? r.text() : r.json();
}

const NAMES = { posts: "POSTS", profiles: "PROFILES", curriculum: "CURR", books: "BOOKS" };
async function pullContent(force) {
  const m = JSON.parse((await gh("content/manifest.json", { raw: true })) || "null");
  if (!m) throw Object.assign(new Error("私人 repo 入面搵唔到 content/manifest.json"), { code: "no_content" });
  const have = await kv.get("content");
  if (!force && have && have.version === m.version) return { changed: false, version: m.version };
  const out = { version: m.version, at: new Date().toISOString() };
  for (const k of Object.keys(NAMES)) { const t = await gh(`content/${k}.json`, { raw: true }); if (t == null) throw new Error(`缺少 content/${k}.json`); out[k] = JSON.parse(t); }
  await kv.set("content", out);
  return { changed: true, version: m.version, content: out };
}

function setGlobals(c) { for (const [k, g] of Object.entries(NAMES)) window[g] = c[k]; }
function loadFeedback() { try { window.FEEDBACK = JSON.parse(localStorage.getItem("feedback") || "{}").items || {}; } catch { window.FEEDBACK = {}; } }
let started = false;
function start(source) {
  if (started) return; started = true;
  loadFeedback();
  window.CONTENT_SOURCE = source;
  document.body.classList.remove("booting");
  const b = document.getElementById("boot"); if (b) b.hidden = true;
  window.__startApp();
}

function bootScreen(msg) {
  const b = document.getElementById("boot"); if (!b) return;
  b.hidden = false;
  const c = cfg.get();
  document.getElementById("boot-repo").value = c.repo || DEF_REPO;
  document.getElementById("boot-msg").textContent = msg || "";
  document.getElementById("boot-go").onclick = async () => {
    const repo = document.getElementById("boot-repo").value.trim() || DEF_REPO, token = document.getElementById("boot-token").value.trim();
    if (!token) { document.getElementById("boot-msg").textContent = "請先貼 token。"; return; }
    cfg.set({ repo, token });
    document.getElementById("boot-token").value = "";
    document.getElementById("boot-msg").textContent = "下載緊內容…（第一次要幾 MB）";
    try { const r = await pullContent(true); setGlobals(r.content); start("github"); window.SYNC?.syncNow?.({ restore: true }); }
    catch (e) { document.getElementById("boot-msg").textContent = errText(e); }
  };
}
const errText = (e) => e?.code === 401 ? "Token 無效或者過咗期。" : e?.code === 403 ? "Token 冇權讀呢個 repo（檢查 Contents 權限同揀咗邊個 repo）。" : e?.code === "no_content" ? e.message : !navigator.onLine ? "而家冇網，連到網再試。" : `連唔到 GitHub：${e?.message || e}`;

window.BOOT = { kv, cfg, gh, pullContent, errText, DEF_REPO };

(async () => {
  if (window.EMBEDDED) { start("embedded"); return; }
  const have = await kv.get("content");
  if (have && have.posts) { setGlobals(have); start("cache"); return; }
  if (cfg.get().token && navigator.onLine) {
    try { const r = await pullContent(true); setGlobals(r.content); start("github"); return; }
    catch (e) { bootScreen(errText(e)); return; }
  }
  bootScreen(cfg.get().token ? "而家冇網，而呢部機未有內容。連到網再開一次。" : "");
})();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
