window.__startApp = function () {
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const AUTH = ["clkong", "LAC"];
const PR = window.PROFILES;
const TH = window.POSTS.threads;
// row: [id, thread no, msg_num, page, author(0/1), time, like, dislike, quote author, quote, text]
const P = window.POSTS.posts.map((r, i) => ({ i, id: r[0], n: r[1], m: r[2], pg: r[3], a: r[4], t: r[5], l: r[6], d: r[7], qa: r[8], q: r[9], x: r[10] }));
const byRef = new Map(P.map((p) => [`${p.n}#${p.m}`, p]));
const day = (t) => new Date((t + 8 * 3600) * 1000).toISOString().slice(0, 10);
const lihkg = (p) => `https://lihkg.com/thread/${TH[p.n]}/page/${p.pg}`;
$("#stat2").textContent = $("#stat").textContent = `${P.length.toLocaleString()} posts · [${Math.min(...P.map((p) => p.n))}]–[${Math.max(...P.map((p) => p.n))}] · 截至 ${day(Math.max(...P.map((p) => p.t)))}`;

/* ---------- search: BM25 over CJK bigrams + latin words ---------- */
const ALIAS = PR.aliases || {};
function toks(s) {
  s = String(s).toLowerCase();
  for (const [k, v] of Object.entries(ALIAS)) if (s.includes(k)) s += " " + v;
  const out = [];
  for (const m of s.matchAll(/[a-z0-9.%$]+|[㐀-鿿豈-﫿]+/g)) {
    const w = m[0];
    if (/^[a-z0-9.%$]/.test(w)) { if (w.length > 1 || /\d/.test(w)) out.push(w); }
    else if (w.length === 1) out.push(w);
    else for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  }
  return out;
}
const STOP = new Set(["係咪", "唔係", "因為", "所以", "但係", "咁樣", "佢哋", "我哋", "你哋", "嘅話", "其實", "可以", "已經", "一個", "應該", "如果", "會唔", "唔會", "有冇", "點樣", "邊個", "乜嘢", "咩嘢", "而家"]);
const INV = new Map(); const LEN = new Float64Array(P.length); let AVG = 0;
P.forEach((p) => {
  const tf = new Map();
  for (const t of toks(p.x)) tf.set(t, (tf.get(t) || 0) + 1);
  LEN[p.i] = [...tf.values()].reduce((a, b) => a + b, 0); AVG += LEN[p.i];
  for (const [t, c] of tf) { let l = INV.get(t); if (!l) INV.set(t, (l = [])); l.push(p.i, c); }
});
AVG /= P.length;
function search(q, { author = null, k = 12, from = null, to = null } = {}) {
  const qt = [...new Set(toks(q))].filter((t) => !STOP.has(t));
  const sc = new Float64Array(P.length);
  for (const t of qt) {
    const l = INV.get(t); if (!l) continue;
    const df = l.length / 2, idf = Math.log(1 + (P.length - df + 0.5) / (df + 0.5));
    for (let j = 0; j < l.length; j += 2) { const i = l[j], f = l[j + 1]; sc[i] += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * LEN[i] / AVG)); }
  }
  const res = [];
  for (let i = 0; i < P.length; i++) {
    if (!sc[i]) continue; const p = P[i];
    if (author != null && p.a !== author) continue;
    if (from && p.t < from) continue; if (to && p.t > to) continue;
    const s = sc[i] * (1 + Math.log1p(Math.max(0, p.l)) * 0.06) * (p.x.length < 25 ? 0.4 : p.x.length < 80 ? 0.7 : 1);
    res.push([s, p]);
  }
  res.sort((a, b) => b[0] - a[0]);
  return res.slice(0, k).map((r) => r[1]);
}
const brief = (p, n = 700) => `[${p.n}]#${p.m} ${AUTH[p.a]} ${day(p.t)} 👍${p.l}${p.q ? `\n(回覆 ${p.qa}: ${p.q.slice(0, 160)})` : ""}\n${p.x.length > n ? p.x.slice(0, n) + "…" : p.x}`;

/* ---------- tabs ---------- */
function show(t) {
  $$("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.t === t)));
  $$("section.tab").forEach((s) => (s.hidden = s.id !== "t-" + t));
  store.set("tab", t);
}
$("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.t); };
const hash = location.hash.slice(1); const TABS = ["school", "primers", "people", "ledger", "search", "settings"].concat(window.claude ? ["ask"] : []); show(TABS.includes(hash) ? hash : TABS.includes(store.get("tab", "school")) ? store.get("tab", "school") : "school");

/* ---------- post card ---------- */
function postCard(p, terms = []) {
  let x = esc(p.x);
  for (const t of terms) if (t.length > 1) x = x.split(esc(t)).join(`<mark>${esc(t)}</mark>`);
  return `<div class="post" data-ref="${p.n}#${p.m}">
    <div class="meta"><span class="who ${p.a ? "lac" : "cl"}">${AUTH[p.a]}</span><a class="ref" href="${lihkg(p)}" target="_blank" rel="noopener">[${p.n}]#${p.m}</a><span class="mono">${day(p.t)}</span><span>👍${p.l} 👎${p.d}</span></div>
    ${p.q ? `<div class="q">回覆 ${esc(p.qa)}：${esc(p.q)}</div>` : ""}
    <div class="x">${x}</div></div>`;
}

/* ---------- people ---------- */
function renderPeople() {
  $("#people-lede").textContent = PR.overview || "";
  $("#duo").innerHTML = ["clkong", "LAC"].map((k) => {
    const f = PR[k]; const c = k === "LAC" ? "lac" : "cl";
    const list = (arr) => `<ul>${(arr || []).map((s) => `<li>${linkRefs(esc(s))}</li>`).join("")}</ul>`;
    return `<article class="prof ${c}">
      <h2><span class="who ${c}">${esc(f.name)}</span><span class="tag">${esc(f.tagline)}</span></h2>
      <p class="sum">${linkRefs(esc(f.summary))}</p>
      ${f.sections.map((s, i) => `<details ${i < 2 ? "open" : ""}><summary>${esc(s.title)}</summary>${list(s.items)}</details>`).join("")}
      <details><summary>語氣同口頭禪</summary>${list(f.voice)}${(f.quotes || []).map((q) => `<blockquote>${esc(q.text)} <a class="ref" data-r="${esc(q.ref)}">${esc(q.ref)}</a></blockquote>`).join("")}</details>
    </article>`;
  }).join("");
  $("#compare").innerHTML = `<tr><th></th><th><span class="who cl">clkong</span></th><th><span class="who lac">LAC</span></th></tr>` +
    (PR.compare || []).map((r) => `<tr><th>${esc(r[0])}</th><td>${linkRefs(esc(r[1]))}</td><td>${linkRefs(esc(r[2]))}</td></tr>`).join("");
}
function linkRefs(h) { return h.replace(/\[(\d{1,2})\]\s?#(\d{1,4})/g, (m, n, k) => `<a class="ref" data-r="${n}#${k}">[${n}]#${k}</a>`); }
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.ref[data-r]"); if (!a) return;
  e.preventDefault(); const p = byRef.get(a.dataset.r.replace(/[\[\]]/g, ""));
  if (!p) return;
  if (!$("#t-ask").hidden) { $("#src").innerHTML = postCard(p) + $("#src").innerHTML; $("#src .post").classList.add("hl"); $("#drawer").scrollTop = 0; return; }
  const d = document.createElement("div"); d.className = "pop";
  d.innerHTML = `<div role="dialog" aria-label="原文"><div class="row"><span class="eyebrow" style="margin:0">原文</span><button class="btn" data-x>閂</button></div>${postCard(p)}</div>`;
  d.onclick = (ev) => { if (ev.target === d || ev.target.closest("[data-x]")) d.remove(); };
  document.body.appendChild(d);
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".pop").forEach((x) => x.remove()); });

/* ---------- ledger ---------- */
const refDay = (ref) => { const p = byRef.get(String(ref).match(/(\d+)\]\s?#(\d+)/)?.slice(1).join("#")); return p ? day(p.t) : ""; };
function renderLedger() {
  const who = $("#lf-who").value, kind = $("#lf-kind").value, q = $("#lf-q").value.trim().toLowerCase();
  const rows = (kind === "trade" ? PR.trades : PR.predictions) || [];
  const f = rows.filter((r) => (!who || r.who === who) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
  if (kind === "trade") {
    $("#ledger").innerHTML = `<tr><th>日期</th><th>邊個</th><th>動作</th><th>股票</th><th>價</th><th>原因</th><th>出處</th></tr>` + f.map((r) => {
      const ac = /買|加|撈|入|buy|add/i.test(r.action) ? "buy" : /賣|沽|減|走|清|sell|trim/i.test(r.action) ? "sell" : "hold";
      return `<tr><td class="d">${esc(r.date || refDay(r.ref))}</td><td><span class="chip ${r.who === "LAC" ? "lac" : "cl"}">${esc(r.who)}</span></td><td class="act ${ac}">${esc(r.action)}</td><td><b>${esc(r.ticker)}</b></td><td class="mono">${esc(r.price || "")}</td><td>${esc(r.note || "")}</td><td>${linkRefs(esc(r.ref))}</td></tr>`;
    }).join("");
  } else {
    $("#ledger").innerHTML = `<tr><th>講嘅日期</th><th>邊個</th><th>預測</th><th>時間範圍</th><th>出處</th></tr>` + f.map((r) =>
      `<tr><td class="d">${esc(r.date || refDay(r.ref))}</td><td><span class="chip ${r.who === "LAC" ? "lac" : "cl"}">${esc(r.who)}</span></td><td>${esc(r.claim)}</td><td class="small muted">${esc(r.horizon || "")}</td><td>${linkRefs(esc(r.ref))}</td></tr>`).join("");
  }
  if (!f.length) $("#ledger").innerHTML += `<tr><td colspan="7" class="muted">冇符合嘅紀錄。</td></tr>`;
}
["#lf-who", "#lf-kind", "#lf-q"].forEach((s) => $(s).addEventListener("input", renderLedger));

/* ---------- search tab ---------- */
function runSearch() {
  const q = $("#sq").value.trim(), a = $("#sa").value === "" ? null : Number($("#sa").value), s = $("#ss").value;
  let res;
  if (!q) res = P.filter((p) => a == null || p.a === a);
  else res = search(q, { author: a, k: 400 });
  if (s === "new") res = [...res].sort((x, y) => y.t - x.t);
  if (s === "old") res = [...res].sort((x, y) => x.t - y.t);
  if (s === "like") res = [...res].sort((x, y) => y.l - x.l);
  if (!q && s === "rel") res = [...res].sort((x, y) => y.t - x.t);
  $("#scount").textContent = q ? `${res.length >= 400 ? "最相關 400" : res.length} 個結果` : `最新嘅 post`;
  const terms = q.split(/\s+/).filter(Boolean);
  $("#results").innerHTML = res.slice(0, 60).map((p) => postCard(p, terms)).join("");
}
let srchT; ["#sq", "#sa", "#ss"].forEach((s) => $(s).addEventListener("input", () => { clearTimeout(srchT); srchT = setTimeout(runSearch, 180); }));

/* ---------- primers ---------- */
function renderPrimers() {
  $("#primers").innerHTML = (PR.primers || []).map((pm, i) => {
    const pp = pm.prompt && byRef.get(pm.prompt);
    return `<article class="primer${pm.hot ? " hot" : ""}">
    <div class="kind">${esc(pm.kind)}</div><h3>${esc(pm.title)}</h3><p>${esc(pm.desc)}</p>
    ${pm.links.length ? `<div class="links">${pm.links.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(t)}</span><span>↗</span></a>`).join("")}</div>` : ""}
    <div class="refs">原文：${pm.refs.map((r) => `<a class="ref" data-r="${r}">[${r.replace("#", "]#")}</a>`).join("")}</div>
    ${pp ? `<details><summary>佢條 prompt 原文（[${pm.prompt.replace("#", "]#")}]）</summary><pre id="pp${i}">${esc(pp.x)}</pre></details>` : ""}
    <div class="acts">${pp ? `<button class="btn" data-copy="${i}">複製 prompt</button>` : ""}</div>
    </article>`;
  }).join("");
}
$("#primers").onclick = async (e) => {
  const c = e.target.closest("button[data-copy]");
  if (c) {
    const pm = PR.primers[+c.dataset.copy], txt = byRef.get(pm.prompt).x;
    try { await navigator.clipboard.writeText(txt); c.textContent = "已複製 ✓"; }
    catch { const pre = $("#pp" + c.dataset.copy); pre.closest("details").open = true; const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); c.textContent = "已揀好，自己 copy"; }
    setTimeout(() => (c.textContent = "複製 prompt"), 2500); return;
  }
  const b = e.target.closest("button[data-p]"); if (!b) return;
  const pm = PR.primers[+b.dataset.p];
  setMode("tutor"); newChat(); show("ask");
  ask(`LAC 整過一份教材：「${pm.title}」（原文 ${pm.refs.map((r) => "[" + r.replace("#", "]#")).join("、")}）。請用佢嘅原文做骨幹，帶我學：${pm.topic}。先講框架，再拎原文例子，最後出一條題目考我。`);
};

/* ---------- chat ---------- */
let mode = store.get("mode", "LAC"), turns = [], ctl = null, sample = null, tools = false;
function setMode(m) { mode = m; store.set("mode", m); $$("#modes .mode").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m))); renderStarters(); }
$("#modes").onclick = (e) => { const b = e.target.closest(".mode"); if (b) setMode(b.dataset.m); };
function renderStarters() {
  const s = (PR.starters && PR.starters[mode]) || [];
  $("#starters").innerHTML = s.map((t) => `<button class="starter">${esc(t)}</button>`).join("");
}
$("#starters").onclick = (e) => { const b = e.target.closest(".starter"); if (b) { $("#q").value = b.textContent; $("#q").focus(); } };
function newChat() { turns = []; $("#log").innerHTML = ""; $("#src").innerHTML = `<span class="small muted">發問之後，相關嘅原文會喺度出現。</span>`; intro(); }
$("#clear").onclick = newChat;
function intro() {
  $("#log").innerHTML = `<div class="notice">${sample === null ? "呢個瀏覽器未接到 Claude，所以而家只可以用「搜尋原文」同其他分頁。喺 claude.ai 打開呢頁就可以問。" : "揀一位師傅，然後問你嘅問題。第一次發問會問你批唔批准呢頁用你嘅 Claude。答案係根據佢哋喺 LIHKG 講過嘅嘢模擬出嚟，唔係佢哋本人，亦唔係投資建議。"}</div>`;
}

function md(s) {
  const lines = esc(s).split("\n"); let out = "", list = null;
  const inline = (t) => linkRefs(t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>"));
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const ln of lines) {
    let m;
    if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { if (list !== "ul") { close(); out += "<ul>"; list = "ul"; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out += "<ol>"; list = "ol"; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = ln.match(/^#{1,4}\s+(.*)/))) { close(); out += `<h4>${inline(m[1])}</h4>`; }
    else if (!ln.trim()) close();
    else { close(); out += `<p>${inline(ln)}</p>`; }
  }
  close(); return out;
}

function personaBlock(k) {
  const f = PR[k];
  return `### ${k} 嘅檔案\n${f.summary}\n${f.sections.map((s) => `【${s.title}】\n- ` + s.items.join("\n- ")).join("\n")}\n【語氣】\n- ${f.voice.join("\n- ")}\n【原句例子】\n${(f.quotes || []).map((q) => `「${q.text}」${q.ref}`).join("\n")}`;
}
function rules() {
  const today = new Date().toISOString().slice(0, 10);
  const common = `資料：以下係 LIHKG 財經台「美日韓 超長線十倍價投」系列入面 clkong（樓主）同 LAC（又叫大飛）嘅 post 摘錄，最新一個 post 喺 ${day(Math.max(...P.map((p) => p.t)))}，今日係 ${today}。用戶叫 Ricky，想跟佢哋學投資。
規則：
- 用香港廣東話口語書面語答（好似 LIHKG 回覆），中英夾雜同佢哋一樣。
- 論點盡量建基於提供嘅原文，喺句尾用 [集數]#樓數 格式標出處（例如 [33]#770），唔好作出處。
- 佢哋冇講過嘅嘢，要講明「呢樣佢冇直接講過，以下係按佢框架推斷」。
- 時效：原文係當時嘅睇法，提到價位或者形勢時要講埋係幾時講嘅。
- 唔好扮知道原文以外嘅最新股價。
- 可以用 search_posts 工具再搵多啲原文（例如搵某隻股、某個概念、某段時間），通常 0-2 次就夠。
- 答案精簡有料，唔好長氣，除非問題需要。最後唔使加長篇免責聲明。`;
  if (mode === "clkong" || mode === "LAC") return `${common}\n\n你而家扮演 ${mode}，用佢嘅第一身、佢嘅口吻、思路同常用講法回答 Ricky，好似喺 thread 入面回覆佢咁。保持佢嘅性格（包括佢點樣處理唔同意見、佢鍾意用嘅比喻同數字）。\n\n${personaBlock(mode)}`;
  if (mode === "both") return `${common}\n\n你要分別用 clkong 同 LAC 嘅口吻各自回覆 Ricky，格式：先「**clkong：**」一段，再「**LAC：**」一段，各自保持自己風格同立場；如果兩個睇法唔同要突出分歧。最後加一行「**兩位共通點／分歧：**」。\n\n${personaBlock("clkong")}\n\n${personaBlock("LAC")}`;
  return `${common}\n\n你係 Ricky 嘅投資導師（唔係扮佢哋），任務係教識 Ricky 用 clkong 同 LAC 嘅方法思考。做法：解釋概念 → 用佢哋原文做例子（附出處）→ 指出兩位做法嘅分別 → 套落 Ricky 嘅情況 → 每次最後出一條思考題或者小測驗考 Ricky，等佢答完再批改。語氣似一個有耐性但直接嘅師兄。\n\n${personaBlock("clkong")}\n\n${personaBlock("LAC")}`;
}
function retrieve(q) {
  const ctxQ = q + " " + turns.filter((t) => t.role === "user").slice(-2).map((t) => t.content).join(" ");
  const a = mode === "clkong" ? 0 : mode === "LAC" ? 1 : null;
  let hits = search(ctxQ, { author: a, k: a == null ? 10 : 14 });
  if (a == null) hits = [...search(ctxQ, { author: 0, k: 7 }), ...search(ctxQ, { author: 1, k: 7 })];
  const recent = P.filter((p) => a == null || p.a === a).slice(-5);
  const seen = new Set(); return [...hits, ...recent].filter((p) => !seen.has(p.i) && seen.add(p.i));
}
const TOOLS = [{
  name: "search_posts",
  description: "Keyword search over all clkong/LAC posts (Cantonese/English; tickers like hynix, nvda, 7203 work). Returns up to 8 matching posts with [thread]#post refs, date, likes and text. Optional author and date range.",
  inputSchema: { type: "object", properties: { query: { type: "string" }, author: { type: "string", enum: ["clkong", "LAC", "both"] }, from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["query"] },
  execute(inp) {
    const a = inp.author === "clkong" ? 0 : inp.author === "LAC" ? 1 : null;
    const ts = (d) => (d ? Date.parse(String(d)) / 1000 : null);
    const hits = search(String(inp.query || ""), { author: a, k: 8, from: ts(inp.from), to: ts(inp.to) });
    showSources(hits, true);
    return hits.length ? hits.map((p) => brief(p, 550)).join("\n\n") : "No matching posts.";
  },
}];
function showSources(hits, append) {
  const html = hits.map((p) => postCard(p)).join("");
  $("#src").innerHTML = append ? $("#src").innerHTML + html : html;
}
async function ask(text) {
  text = text.trim(); if (!text || ctl) return;
  if (!sample) { intro(); return; }
  $("#q").value = "";
  const me = document.createElement("div"); me.className = "msg me"; me.textContent = text; $("#log").append(me);
  const hits = retrieve(text); showSources(hits, false);
  const bot = document.createElement("div"); bot.className = "msg bot";
  const label = mode === "both" ? "clkong × LAC" : mode === "tutor" ? "導師" : mode;
  bot.innerHTML = `<div class="hd"><span class="chip ${mode === "LAC" ? "lac" : mode === "clkong" ? "cl" : ""}">${esc(label)}</span><span class="st">諗緊…</span></div><div class="bd"></div>`;
  $("#log").append(bot); bot.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const ctxt = `${rules()}\n\n=== 相關原文 ===\n${hits.map((p) => brief(p)).join("\n\n")}`;
  const history = turns.slice(-8);
  const input = [{ role: "user", content: ctxt }, ...(history.length ? [{ role: "assistant", content: "明白，我會跟以上規則同原文回答。" }, ...history] : []), { role: "user", content: text }];
  ctl = new AbortController(); $("#send").disabled = true; $("#stop").hidden = false;
  const opts = { signal: ctl.signal, cache: false, modelTier: $("#deep").checked ? "complex" : "default", onText: ({ text: t }) => { $(".st", bot).textContent = ""; $(".bd", bot).innerHTML = md(t); } };
  if (tools) { opts.tools = TOOLS; delete opts.cache; }
  try {
    const r = await sample(input, opts);
    $(".bd", bot).innerHTML = md(r.text); $(".st", bot).textContent = r.truncated ? "（答案太長，被截斷）" : "";
    turns.push({ role: "user", content: text }, { role: "assistant", content: r.text });
  } catch (e) {
    $(".st", bot).textContent = "";
    if (e.text) $(".bd", bot).innerHTML = md(e.text);
    const msg = { not_granted: "你未批准呢頁用 Claude，所以問唔到。", sampling_disabled: "你個帳戶用唔到呢個功能。", rate_limited: "問得太密或者用量到咗上限，遲啲再試。", session_expired: "請重新登入 claude.ai。", refused: "Claude 拒絕咗呢條問題，試下換個問法。", prompt_too_large: "對話太長，撳「新對話」再問。", cancelled: "" }[e.code] ?? "連線出咗問題，再撳一次發問。";
    if (msg) bot.insertAdjacentHTML("beforeend", `<div class="err">${esc(msg)}</div>`);
    if (["not_granted", "sampling_disabled"].includes(e.code)) { sample = null; }
  } finally { ctl = null; $("#send").disabled = false; $("#stop").hidden = true; }
}
$("#send").onclick = () => ask($("#q").value);
$("#stop").onclick = () => ctl?.abort();
$("#q").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask($("#q").value); });

/* ---------- 學堂: offline curriculum + industry primers in one reader ---------- */
const CURR = window.CURR || { modules: [] };
const LIB = [];
for (const b of window.BOOKS || []) if (b.chapters?.length) LIB.push(b);
if (CURR.modules.length) LIB.push({ key: "masters", title: "clkong × LAC 主題課程", meta: `${CURR.modules.length} 個模組`, mine: true,
  chapters: CURR.modules.flatMap((m, mi) => (m.lessons || []).map((l, li) => ({ ...l, num: `${mi + 1}.${li + 1}`, part: `模組 ${mi + 1}　${m.title}`, partGoal: m.goal }))) });
const fmtN = (v) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
let st = store.get("school2", { book: 0, ch: {}, mode: "map", done: {}, notes: {} });
st.ch = st.ch || {}; st.done = st.done || {}; st.notes = st.notes || {}; st.doneT = st.doneT || {}; st.notesT = st.notesT || {};
const save = () => store.set("school2", st);
const SB = () => LIB[st.book] || LIB[0];
const key = (b, i) => `${b.key}:${b.chapters[i]?.id || i}`;
const doneCount = (b) => b.chapters.filter((_, i) => st.done[key(b, i)]).length;
const mdl = (s) => linkRefs(esc(s)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

function renderBooks() {
  const tile = (b, i) => { const d = doneCount(b), n = b.chapters.length;
    return `<button class="book ${b.mine ? "mine" : ""}" data-i="${i}" aria-pressed="${i === st.book}"><span class="t">${esc(b.title)}</span><span class="m">${n} ${b.mine ? "課" : "章"} · ${esc(b.meta || "")}</span><span class="prog"><i style="width:${n ? (d / n) * 100 : 0}%"></i></span><span class="m">完成 ${d}/${n}</span></button>`; };
  const ind = LIB.map((b, i) => [b, i]).filter(([b]) => !b.mine), top = LIB.map((b, i) => [b, i]).filter(([b]) => b.mine);
  $("#sch-books").innerHTML = `<div class="shelf"><span class="eyebrow">行業深入</span><div class="books">${ind.map(([b, i]) => tile(b, i)).join("")}</div></div>${top.length ? `<div class="shelf"><span class="eyebrow">主題課程 · 由日常討論拆出嚟</span><div class="books">${top.map(([b, i]) => tile(b, i)).join("")}</div></div>` : ""}`;
}
$("#sch-books").onclick = (e) => { const b = e.target.closest(".book"); if (!b) return; st.book = +b.dataset.i; if (!["read", "map", "notes"].includes(st.mode)) st.mode = "map"; save(); srender(); };
$$(".smode").forEach((m) => (m.onclick = () => { st.mode = m.dataset.m; save(); $("#sch-q").value = ""; srender(); }));

function vis(v) {
  if (!v || !v.type) return "";
  const t = v.title ? `<h4>${esc(v.title)}</h4>` : "";
  switch (v.type) {
    case "flow": return `<div class="v"><span class="tag">流程</span>${t}<div class="flow">${(v.steps || []).map((s, i) => `<div class="s"><i>${String(i + 1).padStart(2, "0")}</i><b>${esc(s.label)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ""}</div>`).join("")}</div></div>`;
    case "cycle": return `<div class="v"><span class="tag">循環</span>${t}${cycleSvg(v.stages || [])}</div>`;
    case "compare": { const cols = v.columns || []; return `<div class="v"><span class="tag">對比</span>${t}<div class="scrollx"><table class="cmp"><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${(v.rows || []).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div></div>`; }
    case "bars": return `<div class="v"><span class="tag">數據${v.unit ? " · " + esc(v.unit) : ""}</span>${t}<div class="scrollx">${barsSvg(v.items || [])}</div></div>`;
    case "tree": return `<div class="v"><span class="tag">分類</span>${t}<div class="tree"><div class="root">${esc(v.root || v.title || "")}</div><div class="br">${(v.children || []).map((c) => typeof c === "string" ? `<div class="b"><b>${esc(c)}</b></div>` : `<div class="b"><b>${esc(c.label)}</b>${(c.children || []).map((x) => `<span>${esc(typeof x === "string" ? x : x.label)}</span>`).join("")}</div>`).join("")}</div></div></div>`;
    case "matrix": { const x = v.x || ["", ""], y = v.y || ["", ""], c = v.cells || [["", ""], ["", ""]];
      return `<div class="v"><span class="tag">2×2</span>${t}<div class="mx"><div></div><div class="h">${esc(x[0])}</div><div class="h">${esc(x[1])}</div>${[0, 1].map((r) => `<div class="h">${esc(y[r])}</div>${[0, 1].map((k) => `<div class="c ${r === 0 && k === 1 ? "hi" : ""}">${esc((c[r] || [])[k])}</div>`).join("")}`).join("")}</div></div>`; }
    case "timeline": return `<div class="v"><span class="tag">時間線</span>${t}<div class="tl">${(v.events || []).map((e) => `<div><b>${esc(e.when)}</b>${esc(e.what)}</div>`).join("")}</div></div>`;
    case "calc": return `<div class="v"><span class="tag">算例</span>${t}${calcHtml(v)}</div>`;
    default: return "";
  }
}
const calcHtml = (v) => `<div class="calc">${(v.lines || []).map((l) => `<div><span class="op">${esc(l.op || "")}</span><span class="lb">${esc(l.label)}</span><span>${esc(l.value)}</span></div>`).join("")}${v.result ? `<div class="res"><span class="op">=</span><span class="lb">${esc(v.result.label)}</span><span>${esc(v.result.value)}</span></div>` : ""}</div>`;
function barsSvg(items) {
  items = items.filter((i) => isFinite(+i.value));
  if (!items.length) return "";
  const W = 520, L = 150, rh = 26, H = items.length * rh + 8;
  const max = Math.max(...items.map((i) => Math.abs(+i.value))) || 1, neg = items.some((i) => +i.value < 0);
  const z = neg ? L + (W - L - 60) / 2 : L, span = neg ? (W - L - 60) / 2 : W - L - 70;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;display:block" role="img" aria-label="長條圖">${items.map((it, i) => { const v = +it.value, w = (Math.abs(v) / max) * span, y = i * rh + 4, x = v < 0 ? z - w : z;
    return `<text x="${L - 8}" y="${y + 15}" text-anchor="end" font-size="11.5" fill="var(--ink)">${esc(String(it.label).slice(0, 18))}</text><rect x="${x}" y="${y + 2}" width="${Math.max(1, w)}" height="${rh - 9}" fill="${v < 0 ? "var(--red)" : i % 2 ? "var(--green2)" : "var(--green)"}"/><text x="${v < 0 ? x - 4 : x + w + 4}" y="${y + 15}" text-anchor="${v < 0 ? "end" : "start"}" font-size="11.5" font-weight="700" fill="var(--ink)" font-family="var(--f-mono)">${fmtN(v)}</text>`; }).join("")}${neg ? `<line x1="${z}" x2="${z}" y1="0" y2="${H}" stroke="var(--ink)"/>` : ""}</svg>`;
}
function cycleSvg(stages) {
  const n = stages.length || 1, W = 460, H = 300, cx = W / 2, cy = H / 2, R = 100;
  const pts = stages.map((s, i) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + R * Math.cos(a) * 1.35, cy + R * Math.sin(a), s]; });
  return `<div class="scrollx"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:380px;display:block" role="img" aria-label="循環圖">
    <defs><marker id="cy" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--gold)"/></marker></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${R * 1.35}" ry="${R}" fill="none" stroke="var(--gold)" stroke-dasharray="3 4"/>
    ${pts.map(([x, y], i) => { const [x2, y2] = pts[(i + 1) % n]; const mx = (x + x2) / 2, my = (y + y2) / 2; return n > 1 ? `<path d="M${x + (mx - x) * 0.5},${y + (my - y) * 0.5} L${mx + (x2 - mx) * 0.4},${my + (y2 - my) * 0.4}" stroke="var(--gold)" stroke-width="1.5" marker-end="url(#cy)" fill="none"/>` : ""; }).join("")}
    ${pts.map(([x, y, s]) => `<g><rect x="${x - 62}" y="${y - 22}" width="124" height="44" fill="var(--green-soft)" stroke="var(--green)"/><text x="${x}" y="${y - 3}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--green)">${esc(String(s.label).slice(0, 10))}</text><text x="${x}" y="${y + 13}" text-anchor="middle" font-size="10" fill="var(--ink)">${esc(String(s.note || "").slice(0, 14))}</text></g>`).join("")}</svg></div>
    ${stages.some((s) => (s.note || "").length > 14 || String(s.label).length > 10) ? `<div class="tl">${stages.map((s) => `<div><b>${esc(s.label)}</b>${esc(s.note || "")}</div>`).join("")}</div>` : ""}`;
}

const deepHtml = (c) => { if (!c.deep?.length) return "";
  const n = c.deep.reduce((a, s) => a + (s.p.join("").match(/[\u4e00-\u9fff]/g) || []).length, 0);
  return `<details class="deep" open><summary><span class="eyebrow">深入導讀</span><span class="mins">${n.toLocaleString()} 字 · 大約 ${Math.max(1, Math.round(n / 450))} 分鐘</span></summary>
    ${c.deep.length > 2 ? `<ol class="dtoc">${c.deep.map((s, j) => `<li><a href="#" data-d="${j}">${esc(s.h)}</a></li>`).join("")}</ol>` : ""}
    ${c.deep.map((s, j) => `<section id="dsec-${j}"><h4>${esc(s.h)}</h4>${s.p.map((x) => `<p>${mdl(x)}</p>`).join("")}</section>`).join("")}</details>`; };
const sec = (title, inner) => inner ? `<div class="sec"><h3>${title}</h3>${inner}</div>` : "";
const termsHtml = (c) => c.terms?.length ? `<div class="terms">${c.terms.map((t, j) => `<button class="term" data-j="${j}" aria-expanded="false">${esc(t.term)}${t.en ? `<i class="en">${esc(t.en)}</i>` : ""}</button>`).join("")}</div><div class="termdef" id="tdef" hidden></div>` : "";
const navHtml = (b, i, d) => `<div class="nav"><button class="btn" id="prev" ${i === 0 ? "disabled" : ""}>← 上一${b.mine ? "課" : "章"}</button><button class="btn ${d ? "done" : ""}" id="done">${d ? "✓ 已完成" : `完成呢${b.mine ? "課" : "章"}`}</button><button class="btn primary" id="next" ${i === b.chapters.length - 1 ? "disabled" : ""}>下一${b.mine ? "課" : "章"} →</button></div>`;

function lessonHtml(b, i) {
  const c = b.chapters[i], d = st.done[key(b, i)], pr = c.practice, pp = pr && byRef.get(String(pr.ref).replace(/[\[\]]/g, ""));
  const note = st.notes[c.id] || "";
  const first = i === 0 || b.chapters[i - 1].part !== c.part;
  return `<div class="ch">
    <div class="chhead"><div class="eyebrow">${esc(c.part)}</div><h2>${esc(c.num)}　${esc(c.title)}</h2>${first && c.partGoal ? `<p class="one">${esc(c.partGoal)}</p>` : ""}<span class="mins">大約 ${+c.minutes || 15} 分鐘</span></div>
    ${sec("概念", `<div class="concept">${(c.concept || []).map((p) => `<p>${mdl(p)}</p>`).join("")}</div>`)}
    ${c.visual ? `<div class="vis">${vis(c.visual)}</div>` : ""}
    ${sec("術語（撳睇解釋）", termsHtml(c))}
    ${sec("兩位師傅點睇", c.views?.length ? `<div class="views">${c.views.map((v) => `<div class="view ${v.who === "LAC" ? "lac" : ""}"><span class="w">${esc(v.who === "LAC" ? "LAC（大飛）" : "clkong（樓主）")}</span><p>${mdl(v.summary || "")}</p>${(v.quotes || []).map((q) => `<blockquote>「${esc(q.text)}」<a class="ref" data-r="${esc(String(q.ref).replace(/[\[\]]/g, ""))}">${esc(q.ref)}</a></blockquote>`).join("")}</div>`).join("")}</div>` : "")}
    ${c.example ? sec(esc(c.example.title || "算例"), `${calcHtml(c.example)}${c.example.note ? `<p class="muted small" style="margin:6px 0 0">${mdl(c.example.note)}</p>` : ""}`) : ""}
    ${sec("審視佢哋講法時要問", c.critique?.length ? `<ul class="crit">${c.critique.map((q) => `<li>${mdl(q)}</li>`).join("")}</ul>` : "")}
    ${sec("考吓自己", c.quiz?.length ? c.quiz.map((q, j) => quizHtml(q, j)).join("") : "")}
    ${pr ? sec("練習：讀原文，寫你嘅判斷", `<div class="prac">
      ${pp ? `<div class="src">${postCard(pp)}</div>` : `<p class="muted">原文：${esc(pr.ref)}</p>`}
      <div class="pq">${mdl(pr.prompt || "")}</div>
      <textarea id="note" placeholder="寫低你嘅分析：佢嘅論點係乜、靠咩假設、證據夠唔夠、你同唔同意、會睇咩指標驗證。">${esc(note)}</textarea>
      <div class="row"><button class="btn primary" id="reveal">睇參考答案</button><span class="saved" id="saved">${note ? "已儲存喺你部機" : "寫嘅嘢會自動儲存喺你部機"}</span></div>
      ${(window.FEEDBACK || {})[c.id] ? `<div class="fb"><b>Claude 回饋</b><span class="mins">${esc((window.FEEDBACK[c.id].at || "").slice(0, 10))}</span><div>${mdl(window.FEEDBACK[c.id].text || "")}</div></div>` : ""}
      <div class="model" id="model" hidden>${mdl(pr.model || "")}${pr.checklist?.length ? `<ul>${pr.checklist.map((x) => `<li>${mdl(x)}</li>`).join("")}</ul>` : ""}</div>
    </div>`) : ""}
    ${navHtml(b, i, d)}
  </div>`;
}
function chapterHtml(b, i) {
  const c = b.chapters[i]; if (c.concept) return lessonHtml(b, i);
  const d = st.done[key(b, i)];
  return `<div class="ch">
    <div class="chhead"><div class="eyebrow">${esc(c.part || b.title)}</div><h2>${esc(c.num)}　${esc(c.title)}</h2>${c.oneLiner ? `<p class="one">${esc(c.oneLiner)}</p>` : ""}</div>
    ${deepHtml(c)}
    ${c.deep?.length ? `<div class="eyebrow" style="margin-top:8px">重溫：重點、數字同術語</div>` : ""}
    ${sec("要記嘅數字", c.numbers?.length ? `<div class="nums">${c.numbers.map((n) => `<div class="nb"><b>${esc(n.value)}</b><span>${esc(n.label)}</span>${n.asOf ? `<small>${esc(n.asOf)}</small>` : ""}</div>`).join("")}</div>` : "")}
    ${sec("圖解", c.visuals?.length ? `<div class="vis">${c.visuals.map(vis).join("")}</div>` : "")}
    ${sec("重點", c.keyPoints?.length ? `<ol class="kp">${c.keyPoints.map((k, j) => `<li data-i="${String(j + 1).padStart(2, "0")}">${esc(k)}</li>`).join("")}</ol>` : "")}
    ${sec("公式", c.formulas?.length ? `<div class="fm">${c.formulas.map((f) => `<div><b>${esc(f.name)}</b><code>${esc(f.expr)}</code>${f.note ? `<small>${esc(f.note)}</small>` : ""}</div>`).join("")}</div>` : "")}
    ${sec("術語（撳睇解釋）", termsHtml(c))}
    ${c.masters ? `<div class="ana"><b>同 clkong／LAC 嘅討論</b><br>${mdl(c.masters)}</div>` : ""}
    ${c.semiAnalogy || c.pitfalls?.length ? `<div class="two">${c.semiAnalogy ? `<div class="ana"><b>同半導體對照</b><br>${esc(c.semiAnalogy)}</div>` : ""}${c.pitfalls?.length ? `<div class="pit"><b>常見錯誤 / 紅旗</b><ul>${c.pitfalls.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}</div>` : ""}
    ${sec("考吓自己", c.quiz?.length ? c.quiz.map((q, j) => quizHtml(q, j)).join("") : "")}
    ${navHtml(b, i, d)}
  </div>`;
}
function quizHtml(q, j) {
  return `<div class="qz" data-a="${+q.answer}"><div class="qq">${j + 1}. ${esc(q.q)}</div><div class="opts">${(q.options || []).map((o, k) => `<button class="o" data-k="${k}">${String.fromCharCode(65 + k)}. ${esc(o)}</button>`).join("")}</div><div class="why" hidden>${esc(q.why || "")}</div></div>`;
}
document.addEventListener("click", (e) => {
  const o = e.target.closest(".qz button.o"); if (!o) return;
  const qz = o.closest(".qz"), a = +qz.dataset.a;
  $$("button.o", qz).forEach((b) => { const k = +b.dataset.k; b.classList.toggle("right", k === a); b.classList.toggle("wrong", k === +o.dataset.k && k !== a); });
  const w = $(".why", qz); w.hidden = !w.textContent; w.textContent = (+o.dataset.k === a ? "答啱。" : "唔啱。") + w.textContent.replace(/^答啱。|^唔啱。/, "");
});

function renderRead() {
  const b = SB(); let i = Math.min(st.ch[b.key] || 0, b.chapters.length - 1);
  let last = null;
  const rail = b.chapters.map((c, j) => { let h = ""; if (c.part && c.part !== last) { h += `<div class="pt">${esc(c.part)}</div>`; last = c.part; }
    return h + `<button data-j="${j}" aria-current="${j === i}"><span class="n">${esc(String(c.num).replace(/\s/g, ""))}</span><span>${esc(c.title)}</span><span class="ck">${st.done[key(b, j)] ? "✓" : ""}</span></button>`; }).join("");
  $("#sch-view").innerHTML = `<div class="layout"><nav class="rail" id="rail" aria-label="章節">${rail}</nav><div style="min-width:0"><select class="mselect" id="msel" aria-label="揀章節">${b.chapters.map((c, j) => `<option value="${j}" ${j === i ? "selected" : ""}>${esc(c.num)} ${esc(c.title)}${st.done[key(b, j)] ? " ✓" : ""}</option>`).join("")}</select><div id="chap">${chapterHtml(b, i)}</div></div></div>`;
  const go = (j) => { st.ch[b.key] = j; save(); renderRead(); window.scrollTo({ top: $("#sch-view").offsetTop - 120, behavior: "smooth" }); };
  $("#rail").onclick = (e) => { const x = e.target.closest("button"); if (x) go(+x.dataset.j); };
  $("#msel").onchange = (e) => go(+e.target.value);
  $("#prev").onclick = () => go(i - 1); $("#next").onclick = () => go(i + 1);
  $("#done").onclick = () => { st.done[key(b, i)] = !st.done[key(b, i)]; st.doneT[key(b, i)] = Date.now(); save(); renderBooks(); if (st.done[key(b, i)] && i < b.chapters.length - 1) go(i + 1); else renderRead(); };
  $("#chap").addEventListener("click", (e) => { const a = e.target.closest("a[data-d]"); if (a) { e.preventDefault(); $(`#dsec-${a.dataset.d}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; } const t = e.target.closest(".term"); if (!t) return; const c = b.chapters[i].terms[+t.dataset.j]; const open = t.getAttribute("aria-expanded") !== "true";
    $$(".term", $("#chap")).forEach((x) => x.setAttribute("aria-expanded", "false")); t.setAttribute("aria-expanded", String(open)); const d = $("#tdef"); d.hidden = !open; d.innerHTML = `<b>${esc(c.term)}</b>${c.en ? `（${esc(c.en)}）` : ""}：${esc(c.def)}`; });
  const ta = $("#note");
  if (ta) { let tm; const id = b.chapters[i].id;
    ta.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { st.notes[id] = ta.value; st.notesT[id] = Date.now(); if (!ta.value) delete st.notes[id]; save(); $("#saved").textContent = "已儲存喺你部機"; }, 400); };
    $("#reveal").onclick = () => { const m = $("#model"); m.hidden = !m.hidden; $("#reveal").textContent = m.hidden ? "睇參考答案" : "收埋參考答案"; }; }
  const cur = $("#rail button[aria-current=true]"); if (cur) cur.scrollIntoView({ block: "nearest" });
}
function renderMap() {
  const b = SB(); const groups = [];
  b.chapters.forEach((c, j) => { const p = c.part || "全書"; let g = groups.find((g) => g.p === p); if (!g) groups.push((g = { p, goal: c.partGoal, items: [] })); g.items.push([c, j]); });
  $("#sch-view").innerHTML = `<div class="map"><p class="muted">${esc(b.title)}：${b.chapters.length} ${b.mine ? "課" : "章"}，已完成 ${doneCount(b)}。撳任何一${b.mine ? "課" : "章"}開始。</p>${groups.map((g) => `<div class="pt">${esc(g.p)}</div>${g.goal ? `<p class="muted small" style="margin:-8px 0 0">${esc(g.goal)}</p>` : ""}<div class="grid">${g.items.map(([c, j]) => `<button data-j="${j}" class="${st.done[key(b, j)] ? "dn" : ""}"><span class="n">${esc(c.num)}${st.done[key(b, j)] ? " · ✓" : ""}</span><span class="t">${esc(c.title)}</span><span class="o">${esc(c.oneLiner || (c.concept ? (c.concept[0] || "").replace(/\*\*/g, "").slice(0, 60) + "…" : ""))}</span></button>`).join("")}</div>`).join("")}</div>`;
  $("#sch-view").onclick = (e) => { const x = e.target.closest(".map button"); if (!x) return; st.ch[b.key] = +x.dataset.j; st.mode = "read"; save(); srender(); window.scrollTo({ top: 0 }); };
}
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
let deck = [], di = 0, flip = false;
function renderCards() {
  const b = SB();
  if (!deck.length || deck.book !== b.key) { deck = shuffle(b.chapters.flatMap((c, j) => (c.terms || []).map((t) => ({ ...t, c: `${c.num} ${c.title}`, j })))); deck.book = b.key; di = 0; flip = false; }
  if (!deck.length) { $("#sch-view").innerHTML = `<p class="empty">呢本未有術語。</p>`; return; }
  const t = deck[di];
  $("#sch-view").innerHTML = `<div class="fc"><p class="muted" style="text-align:center">${esc(b.title)} · ${di + 1} / ${deck.length} · 撳張卡反轉</p>
    <button class="card3" id="card">${flip ? `<span class="def"><b>${esc(t.term)}</b>${t.en ? `（${esc(t.en)}）` : ""}<br>${esc(t.def)}</span><small>${esc(t.c)}</small>` : `<span class="big">${esc(t.term)}</span>${t.en ? `<span class="en">${esc(t.en)}</span>` : ""}<small>諗吓係乜意思</small>`}</button>
    <div class="nav"><button class="btn" id="cp">← 上一張</button><button class="btn" id="cs">洗牌</button><button class="btn primary" id="cn">下一張 →</button></div>
    <details class="gloss"><summary>成本書嘅詞庫（${deck.length} 個，中英對照）</summary><input id="gq" placeholder="搵中文或者英文…" spellcheck="false"><div class="gl" id="gl"></div></details></div>`;
  const all = b.chapters.flatMap((c, j) => (c.terms || []).map((t) => ({ ...t, c: `${c.num} ${c.title}`, j }))).sort((x, y) => (x.en || x.term).localeCompare(y.en || y.term));
  const gl = (q) => { q = (q || "").toLowerCase(); $("#gl").innerHTML = all.filter((t) => !q || `${t.term} ${t.en || ""} ${t.def}`.toLowerCase().includes(q)).map((t) => `<div><b>${esc(t.term)}</b><i>${esc(t.en || "")}</i><span>${esc(t.def)}</span><button class="lnk" data-j="${t.j}">${esc(t.c)}</button></div>`).join("") || `<p class="empty">搵唔到。</p>`; };
  $(".gloss").addEventListener("toggle", () => gl($("#gq").value), { once: true });
  $("#gq").oninput = (e) => gl(e.target.value);
  $("#gl").onclick = (e) => { const x = e.target.closest("button[data-j]"); if (!x) return; st.ch[b.key] = +x.dataset.j; st.mode = "read"; save(); srender(); window.scrollTo({ top: 0 }); };
  $("#card").onclick = () => { flip = !flip; renderCards(); };
  $("#cp").onclick = () => { di = (di - 1 + deck.length) % deck.length; flip = false; renderCards(); };
  $("#cn").onclick = () => { di = (di + 1) % deck.length; flip = false; renderCards(); };
  $("#cs").onclick = () => { deck = []; renderCards(); };
}
let qset = [];
function renderQuiz() {
  const b = SB();
  const all = b.chapters.flatMap((c, j) => (c.quiz || []).map((q) => ({ q, c, j })));
  if (!all.length) { $("#sch-view").innerHTML = `<p class="empty">呢本未有題目。</p>`; return; }
  if (!qset.length || qset.book !== b.key) { qset = shuffle(all).slice(0, 10); qset.book = b.key; }
  $("#sch-view").innerHTML = `<div class="fc" style="max-width:720px"><p class="muted">${esc(b.title)} 隨機 10 條（共 ${all.length} 條）。答錯就撳「去返嗰${b.mine ? "課" : "章"}」溫返。</p>${qset.map((x, k) => `<div>${quizHtml(x.q, k)}<button class="btn" data-j="${x.j}" style="margin-top:6px;font-size:12.5px">去返 ${esc(x.c.num)}</button></div>`).join("")}<div class="nav"><span></span><button class="btn primary" id="again">再嚟 10 條</button></div></div>`;
  $("#again").onclick = () => { qset = []; renderQuiz(); window.scrollTo({ top: 0 }); };
  $("#sch-view").onclick = (e) => { const x = e.target.closest("button[data-j]"); if (x) { st.ch[b.key] = +x.dataset.j; st.mode = "read"; save(); srender(); window.scrollTo({ top: 0 }); } };
}
function renderNotes() {
  const m = LIB.findIndex((b) => b.key === "masters"); const b = LIB[m];
  const items = b ? b.chapters.map((c, j) => [c, j]).filter(([c]) => st.notes[c.id]) : [];
  $("#sch-view").innerHTML = `<div class="nbk"><p class="muted">你喺主題課程練習度寫低嘅判斷同所有完成進度，都存喺呢部機嘅瀏覽器。定期撳「匯出進度」存一份備份檔，換機或者清咗瀏覽器資料之後用「匯入進度」攞返。</p><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="exp">匯出進度</button><label class="btn" style="display:inline-block">匯入進度<input type="file" id="imp" accept=".json,application/json" hidden></label><span class="saved" id="iomsg"></span></div>${items.length ? items.map(([c, j]) => `<div class="it"><span class="mins">${esc(c.num)} · ${esc(c.part)}</span><b>${esc(c.title)}</b><pre>${esc(st.notes[c.id])}</pre><button class="btn" data-j="${j}" style="align-self:flex-start">去返呢課</button></div>`).join("") : `<p class="empty">未寫過練習。每課最尾有一段原文俾你寫判斷。</p>`}</div>`;
  $("#exp").onclick = async () => { const body = JSON.stringify({ app: "masters-school", at: new Date().toISOString(), school2: st }, null, 1), fname = `masters-school-progress-${new Date().toISOString().slice(0, 10)}.json`;
    if (window.claude) { try { const dl = await window.claude.use("downloads"); if (dl) { await dl.save({ filename: fname, data: new Blob([body], { type: "application/json" }) }); $("#iomsg").textContent = "已匯出"; return; } } catch (err) { if (err && err.code === "declined") { $("#iomsg").textContent = "已取消"; return; } } }
    try { const blob = new Blob([body], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); $("#iomsg").textContent = "已匯出（如果冇反應，用桌面版檔案做）"; } catch { $("#iomsg").textContent = "呢度唔俾下載，請用桌面版檔案匯出"; } };
  $("#imp").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); if (!d.school2) throw 0; const o = d.school2; st.done = { ...st.done, ...(o.done || {}) }; st.notes = { ...(o.notes || {}), ...st.notes }; st.ch = { ...(o.ch || {}), ...st.ch }; save(); srender(); } catch { $("#iomsg").textContent = "讀唔到呢個檔，請揀匯出嘅 .json"; } };
  $("#sch-view").onclick = (e) => { const x = e.target.closest("button[data-j]"); if (x) { st.book = m; st.ch.masters = +x.dataset.j; st.mode = "read"; save(); srender(); window.scrollTo({ top: 0 }); } };
}
const SIDX = [];
LIB.forEach((b, bi) => b.chapters.forEach((c, j) => {
  const push = (kind, text) => text && SIDX.push({ bi, j, kind, text: String(text).replace(/\*\*/g, ""), c });
  push(b.mine ? "課" : "章", c.title); push("一句", c.oneLiner); (c.keyPoints || []).forEach((k) => push("重點", k)); (c.concept || []).forEach((k) => push("概念", k));
  (c.terms || []).forEach((t) => push("術語", `${t.term}${t.en ? `（${t.en}）` : ""}：${t.def}`)); (c.deep || []).forEach((s) => s.p.forEach((x) => push("導讀", x))); (c.formulas || []).forEach((f) => push("公式", `${f.name}：${f.expr}`));
  (c.numbers || []).forEach((n) => push("數字", `${n.value} ${n.label}`)); (c.views || []).forEach((v) => push(v.who, v.summary)); (c.critique || []).forEach((k) => push("審視", k));
}));
function renderSSearch(q) {
  const ql = q.toLowerCase(); const hits = SIDX.filter((x) => x.text.toLowerCase().includes(ql)).slice(0, 80);
  const re = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const hl = (t) => { const s = t.length > 220 ? (() => { const k = Math.max(0, t.toLowerCase().indexOf(ql) - 60); return (k ? "…" : "") + t.slice(k, k + 200) + "…"; })() : t; return esc(s).replace(re, (m) => `<mark>${m}</mark>`); };
  $("#sch-view").innerHTML = `<div class="res"><p class="muted">「${esc(q)}」：${hits.length >= 80 ? "頭 80" : hits.length} 個結果（課程同四本教材）</p>${hits.map((x) => `<button class="hit" data-b="${x.bi}" data-j="${x.j}"><small>${esc(LIB[x.bi].title)} · ${esc(x.c.num)} ${esc(x.c.title)} · ${esc(x.kind)}</small><span>${hl(x.text)}</span></button>`).join("") || `<p class="empty">搵唔到。想搵佢哋原文，用「搜尋原文」分頁。</p>`}</div>`;
  $("#sch-view").onclick = (e) => { const h = e.target.closest(".hit"); if (!h) return; st.book = +h.dataset.b; st.ch[LIB[st.book].key] = +h.dataset.j; st.mode = "read"; $("#sch-q").value = ""; save(); srender(); window.scrollTo({ top: 0 }); };
}
let sqt; $("#sch-q").addEventListener("input", () => { clearTimeout(sqt); sqt = setTimeout(() => { const q = $("#sch-q").value.trim(); q ? renderSSearch(q) : srender(); }, 200); });
function srender() {
  if (!LIB.length) { $("#sch-view").innerHTML = `<p class="empty">課程整緊，遲啲再嚟。</p>`; return; }
  if (st.book >= LIB.length) st.book = 0;
  renderBooks(); $("#sch-view").onclick = null;
  $$(".smode").forEach((m) => m.setAttribute("aria-pressed", String(m.dataset.m === st.mode)));
  ({ map: renderMap, read: renderRead, cards: renderCards, quiz: renderQuiz, notes: renderNotes }[st.mode] || renderMap)();
}
const KPI = [[P.length.toLocaleString(), "個原文 post，[1]–[36]"], [`${LIB.filter((b) => !b.mine).length} 本`, "行業深入教材"], [`${CURR.modules.length} 模組`, `${LIB.find((b) => b.mine)?.chapters.length || 0} 課主題課程`], [`${(PR.primers || []).length} 份`, "LAC 原件同 prompt"]];
$("#kpis").innerHTML = KPI.map(([b, t]) => `<div class="kpi"><b>${b}</b><span>${t}</span></div>`).join("");
srender();

renderPeople(); renderLedger(); renderPrimers(); setMode(mode); runSearch();
if (!window.claude) { const t = $('#tabs [data-t="ask"]'); if (t) t.hidden = true; if (!$("#t-ask").hidden) show("school"); }
window.APP = { state: () => st, save, rerender: () => { srender(); }, show, esc, $, $$, lessonIndex: () => (LIB.find((b) => b.mine)?.chapters || []).map((c) => ({ id: c.id, num: c.num, title: c.title, part: c.part, ref: c.practice?.ref || "", prompt: c.practice?.prompt || "" })) };
document.dispatchEvent(new Event("app-ready"));
sample = undefined; intro();
(async () => {
  try { sample = window.claude ? await window.claude.use("sample") : null; } catch { sample = null; }
  if (sample) { try { tools = !!(await sample.limits())?.tools; } catch { tools = false; } }
  if (!turns.length) intro();
})();
})();

};
