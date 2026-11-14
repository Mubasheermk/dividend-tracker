/* ───────── Firebase configuration ───────── */
const FB_VER = "13.3.0";
const firebaseConfig = {
  apiKey: "AIzaSyANiKAJGWSVSSiAm3v3vuUCGSg0wMXInmk",
  authDomain: "dividend-tracker-86b12.firebaseapp.com",
  projectId: "dividend-tracker-86b12",
  storageBucket: "dividend-tracker-86b12.firebasestorage.app",
  messagingSenderId: "304071822724",
  appId: "1:304071822724:web:ec028fd2fe018367a721d1",
  measurementId: "G-CWWFDWDE22"
};
/* Firestore collection → state key (all under users/{uid}/) */
const COLS = { dividends: "payments", holdings: "holdings", transactions: "txns", watchlist: "watch", settings: "settingsDocs", snapshots: "snapshots" };

/* ───────── State & helpers ───────── */
const state = { payments: [], holdings: [], txns: [], watch: [], settingsDocs: [], snapshots: [],
  mode: "connecting", tab: "dashboard", acct: "all", range: "12m", alloc: "holding", q: "", year: "all", sortK: "date", sortD: -1,
  banner: "", calMonth: "", calDay: "", quotes: {}, earnings: [], market: { tab: "news", news: null, ipos: null, busy: false }, apiErr: "", busy: false };
let store = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const usd = (n, d = 2) => (n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = n => (n >= 0 ? "+" : "−") + usd(Math.abs(n));
const pct = n => (isFinite(n) ? (n * 100).toFixed(2) + "%" : "—");
const spct = n => (isFinite(n) ? (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%" : "—");
const cls = n => (n >= 0 ? "up" : "down");
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const addMonths = (d, n, day = d.getDate()) => { const r = new Date(d.getFullYear(), d.getMonth() + n, 1); r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())); return r; };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = s => { const [y, m, d] = s.split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const sum = (a, f = x => x) => a.reduce((t, x) => t + (f(x) || 0), 0);
const uniq = a => [...new Set(a.filter(Boolean))].sort();
const hue = t => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const badge = t => `<span class="tk" style="background:hsl(${hue(t)} 65% 40%)">${esc(t.slice(0, 4))}</span>`;
const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400); };
const bad = m => { const e = new Error(m); e.user = true; throw e; };
const settings = () => state.settingsDocs.find(d => d.id === "main") || {};
const inAcct = x => state.acct === "all" || (x.account || "") === state.acct;
const PAL = ["#8b5cf6", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#fb923c", "#60a5fa", "#a1a1aa"];
const FREQ = { 12: "Monthly", 4: "Quarterly", 2: "Semi-annual", 1: "Annual" };
const ICON = {
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  coin: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/></svg>'
};

/* ───────── Storage: Firestore (per signed-in user) with a local fallback ───────── */
const LS = { get: k => { try { return JSON.parse(localStorage.getItem("dt_" + k)) || []; } catch { return []; } },
             set: (k, v) => { try { localStorage.setItem("dt_" + k, JSON.stringify(v)); } catch {} } };

function useLocal(reason) {
  state.mode = "local"; state.banner = reason || "";
  for (const c in COLS) state[COLS[c]] = LS.get(c);
  const save = c => LS.set(c, state[COLS[c]]);
  store = {
    add: async (c, d) => { state[COLS[c]].push({ id: crypto.randomUUID(), ...d }); save(c); render(); },
    update: async (c, id, d) => { const a = state[COLS[c]], i = a.findIndex(x => x.id === id); if (i > -1) a[i] = { ...a[i], ...d }; save(c); render(); },
    set: async (c, id, d) => { const a = state[COLS[c]], i = a.findIndex(x => x.id === id); if (i > -1) a[i] = { ...a[i], ...d }; else a.push({ id, ...d }); save(c); render(); },
    remove: async (c, id) => { state[COLS[c]] = state[COLS[c]].filter(x => x.id !== id); save(c); render(); }
  };
  render(); onReady();
}

let fb = null, unsubs = [], session = 0;
const RULES_HELP = "In the Firebase console open Firestore Database → Rules and publish the rules from the README in the GitHub repo.";

async function initCloud() {
  try {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    const [{ initializeApp }, fs, au] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js"), import(base + "firebase-auth.js")]);
    const app = initializeApp(firebaseConfig);
    fb = { fs, au, db: fs.getFirestore(app), auth: au.getAuth(app), user: null };
    import(base + "firebase-analytics.js").then(m => m.isSupported().then(ok => ok && m.getAnalytics(app))).catch(() => {});
    au.onAuthStateChanged(fb.auth, user => (user ? startSync(user) : signedOut()));
  } catch (e) {
    console.warn("Firebase unavailable:", e);
    useLocal("<b>Couldn't load Firebase.</b> Check your connection and reload. Until then, entries are saved in this browser only.");
  }
}
function stopSync() { session++; unsubs.forEach(u => u()); unsubs = []; }
function signedOut() {
  stopSync(); fb.user = null; store = null;
  for (const c in COLS) state[COLS[c]] = [];
  state.quotes = {}; state.earnings = []; state.banner = ""; state.mode = "signedout"; render();
}
async function startSync(user) {
  stopSync(); const my = session, { fs, db } = fb; fb.user = user;
  state.mode = "connecting"; state.banner = ""; render();
  const col = c => fs.collection(db, "users", user.uid, c);
  const ref = (c, id) => fs.doc(db, "users", user.uid, c, id);
  const listen = c => new Promise((res, rej) => {
    unsubs.push(fs.onSnapshot(col(c), snap => {
      if (my !== session) return;
      state[COLS[c]] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      res(); if (state.mode === "cloud") render();
    }, rej));
  });
  try {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
    await Promise.race([Promise.all(Object.keys(COLS).map(listen)), timeout]);
    if (my !== session) return;
    store = {
      add: (c, d) => fs.addDoc(col(c), { ...d, createdAt: fs.serverTimestamp() }),
      update: (c, id, d) => fs.updateDoc(ref(c, id), d),
      set: (c, id, d) => fs.setDoc(ref(c, id), d, { merge: true }),
      remove: (c, id) => fs.deleteDoc(ref(c, id))
    };
    state.mode = "cloud"; render(); onReady();
  } catch (e) {
    if (my !== session) return;
    console.warn("Firestore unavailable:", e); stopSync();
    useLocal(e && e.code === "permission-denied"
      ? "<b>Firestore refused access.</b> " + RULES_HELP + " Until then, entries are saved in this browser only."
      : "<b>Couldn't reach Firestore.</b> Check that a Firestore database exists for this project and that you're online. Until then, entries are saved in this browser only.");
  }
}
async function signIn() {
  const err = $("#signErr"); if (err) err.textContent = "";
  try { await fb.au.signInWithPopup(fb.auth, new fb.au.GoogleAuthProvider()); }
  catch (e) {
    console.warn(e); if (!err) return;
    err.textContent = ({
      "auth/unauthorized-domain": "This site's domain isn't authorized. In Firebase: Authentication → Settings → Authorized domains, add " + location.hostname + ".",
      "auth/operation-not-allowed": "Google sign-in isn't enabled. In Firebase: Authentication → Sign-in method, enable Google.",
      "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
      "auth/popup-closed-by-user": "", "auth/cancelled-popup-request": ""
    })[e.code] ?? "Sign-in failed. Please try again.";
  }
}

/* ───────── Market data (Finnhub, optional; key is stored in the user's settings) ───────── */
const FH = "https://finnhub.io/api/v1";
async function fh(path, params, ttlMin) {
  const key = settings().finnhubKey; if (!key) return null;
  const qs = new URLSearchParams(params).toString(), ck = "dt_fh:" + path + "?" + qs;
  if (ttlMin) try { const c = JSON.parse(localStorage.getItem(ck)); if (c && Date.now() - c.t < ttlMin * 6e4) return c.d; } catch {}
  const r = await fetch(`${FH}${path}?${qs}${qs ? "&" : ""}token=${encodeURIComponent(key)}`);
  if (r.status === 429) throw new Error("Finnhub rate limit reached. Try again in a minute.");
  if (r.status === 401 || r.status === 403) throw new Error("Finnhub rejected the API key or this data isn't on your plan.");
  if (!r.ok) throw new Error("Market data request failed (" + r.status + ").");
  const d = await r.json();
  if (ttlMin) try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d })); } catch {}
  return d;
}
async function pool(items, fn, n = 3) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }
const allTickers = () => uniq([...state.holdings, ...state.watch].map(x => x.ticker));

async function refreshMarket(force) {
  if (!settings().finnhubKey || state.busy) return;
  state.busy = true; state.apiErr = ""; render();
  try {
    const T = allTickers();
    await pool(T, async t => { const q = await fh("/quote", { symbol: t }, force ? 0 : 3); if (q && q.c) state.quotes[t] = q; });
    render();
    const from = addDays(today(), -7), to = addDays(today(), 100), E = [];
    await pool(T, async t => { const r = await fh("/calendar/earnings", { from, to, symbol: t }, 720); (r?.earningsCalendar || []).forEach(e => e.date && E.push({ date: e.date, ticker: t, hour: e.hour, eps: e.epsEstimate })); });
    state.earnings = E; saveSnapshot();
  } catch (e) { console.warn(e); state.apiErr = e.message; }
  state.busy = false; render();
}
function saveSnapshot() {
  const P = positions(true), value = sum(P, p => p.value); if (!value || !store) return;
  const d = today(), prev = state.snapshots.find(s => s.id === d);
  if (prev && Math.abs(prev.value - value) < 0.01) return;
  store.set("snapshots", d, { date: d, value: Math.round(value * 100) / 100, basis: Math.round(sum(P, p => p.basis) * 100) / 100 }).catch(() => {});
}
async function loadMarketTab() {
  const m = state.market; if (!settings().finnhubKey || m.busy) return;
  m.busy = true; render();
  try {
    if (m.tab === "news" && !m.news) {
      const top = positions().sort((a, b) => b.value - a.value || b.income - a.income).slice(0, 8).map(p => p.ticker);
      const T = top.length ? top : state.watch.slice(0, 8).map(w => w.ticker), N = [];
      const from = addDays(today(), -7), to = today();
      if (T.length) await pool(T, async t => { const r = await fh("/company-news", { symbol: t, from, to }); (r || []).slice(0, 8).forEach(n => N.push({ ...n, ticker: t })); });
      else (await fh("/news", { category: "general" }) || []).slice(0, 30).forEach(n => N.push(n));
      const seen = new Set(); m.news = N.sort((a, b) => b.datetime - a.datetime).filter(n => !seen.has(n.headline) && seen.add(n.headline)).slice(0, 40);
    }
    if (m.tab === "ipos" && !m.ipos) { const r = await fh("/calendar/ipo", { from: today(), to: addDays(today(), 45) }, 360); m.ipos = (r?.ipoCalendar || []).sort((a, b) => a.date.localeCompare(b.date)); }
  } catch (e) { console.warn(e); state.apiErr = e.message; }
  m.busy = false; render();
}
let readyDone = false;
function onReady() { if (readyDone) return; readyDone = true; refreshMarket(); }

/* ───────── Calculations ───────── */
function positions(all) {
  return state.holdings.filter(h => all || inAcct(h)).map(h => {
    const tx = state.txns.filter(t => t.ticker === h.ticker && (t.account || "") === (h.account || "")).sort((a, b) => a.date.localeCompare(b.date));
    let shares = +h.shares || 0, cost = +h.cost || 0, realized = 0;
    if (tx.length) {
      let basis = 0; shares = 0;
      for (const t of tx) {
        if (t.type === "sell") { const avg = shares ? basis / shares : 0, s = Math.min(t.shares, shares); realized += s * (t.price - avg); basis -= s * avg; shares -= s; }
        else { basis += t.shares * t.price; shares += t.shares; }
      }
      cost = shares > 1e-9 ? basis / shares : 0; if (shares < 1e-9) shares = 0;
    }
    const q = state.quotes[h.ticker], price = q?.c || +h.price || 0, dps = +h.dps || 0, value = shares * price, basis = shares * cost;
    return { ...h, shares, cost, hasTx: tx.length > 0, realized, price, live: !!q?.c, value, basis, gain: price ? value - basis : 0,
      day: q?.d ? shares * q.d : 0, dayPct: q?.dp, income: shares * dps, yld: price && dps ? dps / price : NaN, yoc: cost && dps ? dps / cost : NaN,
      received: sum(state.payments.filter(p => p.ticker === h.ticker && (p.account || "") === (h.account || "")), p => p.amount) };
  });
}
/* Projected pay dates and ex-dividend dates for the next `months` months */
function schedule(months = 12) {
  const out = [], t0 = today(), end = iso(addMonths(new Date(), months));
  for (const p of positions()) {
    if (!(p.shares > 0)) continue;
    const f = +p.freq || 4, step = 12 / f;
    const roll = (start, type, amount, est, strict) => {
      const a = parse(start);
      for (let k = 0; k < 400; k++) { const d = iso(addMonths(a, k * step, a.getDate())); if (d > end) break; if (strict ? d > t0 : d >= t0) out.push({ date: d, ticker: p.ticker, type, amount, est }); }
    };
    if (p.dps > 0) {
      const last = state.payments.filter(x => x.ticker === p.ticker && (x.account || "") === (p.account || "")).map(x => x.date).sort().pop();
      if (p.nextPay) roll(p.nextPay, "proj", p.income / f, false, false);
      else if (last) roll(last, "proj", p.income / f, true, true);
    }
    if (p.exDate) roll(p.exDate, "ex", 0, false, false);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
function events() {
  const mine = new Set(allTickers());
  return [...state.payments.filter(inAcct).map(p => ({ date: p.date, ticker: p.ticker, type: "paid", amount: p.amount })), ...schedule(13),
    ...state.earnings.filter(e => mine.has(e.ticker)).map(e => ({ ...e, type: "earn" }))];
}
const evLabel = e => ({ paid: "Dividend received", proj: e.est ? "Dividend (estimated date)" : "Dividend expected", ex: "Ex-dividend date",
  earn: "Earnings" + ({ bmo: " · before open", amc: " · after close" }[e.hour] || "") }[e.type]);
const upcoming = (n, days = 120) => { const t0 = today(), end = addDays(t0, days); return events().filter(e => e.type !== "paid" && e.date >= t0 && e.date <= end).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n); };

function stats() {
  const now = new Date(), y = now.getFullYear(), t0 = today();
  const ttmStart = iso(new Date(y - 1, now.getMonth(), now.getDate() + 1)), lastYtdEnd = iso(new Date(y - 1, now.getMonth(), now.getDate()));
  const P = state.payments.filter(inAcct), pos = positions();
  const ytd = sum(P.filter(p => p.date.startsWith(y + "-") && p.date <= t0), p => p.amount);
  const prevYtd = sum(P.filter(p => p.date.startsWith((y - 1) + "-") && p.date <= lastYtdEnd), p => p.amount);
  const ttmList = P.filter(p => p.date >= ttmStart && p.date <= t0);
  const value = sum(pos, p => p.value), basis = sum(pos, p => p.basis), priced = pos.filter(p => p.price && p.shares > 0);
  const projected = sum(pos, p => p.income);
  return { y, P, pos, total: sum(P, p => p.amount), ytd, prevYtd, ttm: sum(ttmList, p => p.amount), ttmList, projected, basis, value,
    gain: sum(priced, p => p.gain), pricedBasis: sum(priced, p => p.basis), day: sum(pos, p => p.day), live: pos.some(p => p.live),
    yoc: basis ? projected / basis : NaN, yld: value ? sum(priced, p => p.income) / value : NaN, realized: sum(pos, p => p.realized) };
}
function series(P) {
  const now = new Date(), out = [];
  if (state.range === "fc") {
    const by = {}; schedule(12).filter(e => e.type === "proj").forEach(e => { const k = e.date.slice(0, 7); by[k] = (by[k] || 0) + e.amount; });
    for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1), k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      out.push({ label: MONTHS[d.getMonth()], full: `${MONTHS[d.getMonth()]} ${d.getFullYear()} (projected)`, v: by[k] || 0, now: i === 0 }); }
    return out;
  }
  if (state.range === "year") {
    const by = {}; P.forEach(p => { const k = p.date.slice(0, 4); by[k] = (by[k] || 0) + p.amount; });
    const ys = Object.keys(by).sort(); if (!ys.length) ys.push(String(now.getFullYear()));
    for (let k = +ys[0]; k <= Math.max(+ys.at(-1), now.getFullYear()); k++) out.push({ label: String(k), full: String(k), v: by[k] || 0, now: k === now.getFullYear() });
    return out.slice(-12);
  }
  const by = {}; P.forEach(p => { const k = p.date.slice(0, 7); by[k] = (by[k] || 0) + p.amount; });
  for (let i = 0; i < 12; i++) {
    const d = state.range === "ytd" ? new Date(now.getFullYear(), i, 1) : new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    out.push({ label: MONTHS[d.getMonth()], full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, v: by[k] || 0, now: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() });
  }
  return out;
}

/* ───────── View pieces ───────── */
const needKey = what => `<div class="card empty"><div class="big">${what} needs live market data</div>
  <div>Add a free Finnhub API key in Settings to turn on live prices, earnings dates, news and IPOs.</div>
  <div class="actions"><button class="btn primary" data-act="settings">Open Settings</button></div></div>`;
function agendaRows(list) {
  return list.map(e => { const d = parse(e.date); return `<div class="agenda-row">
    <div class="datebox"><span>${MONTHS[d.getMonth()]}</span><b class="num">${d.getDate()}</b></div>
    <div><div class="tk-name">${esc(e.ticker)} <span class="ev ${e.type}">${{ paid: "Paid", proj: "Dividend", ex: "Ex-date", earn: "Earnings" }[e.type]}</span></div><div class="tk-sub">${evLabel(e)}</div></div>
    <div class="num ${e.type === "paid" ? "amt" : ""}">${e.amount ? (e.type === "proj" ? "~" : "+") + usd(e.amount) : e.type === "earn" && e.eps != null ? "EPS est. " + (+e.eps).toFixed(2) : ""}</div></div>`; }).join("");
}
function sparkline() {
  const S = [...state.snapshots].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
  if (state.acct !== "all" || S.length < 2) return "";
  const vs = S.map(s => s.value), mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1;
  const pts = S.map((s, i) => `${(i / (S.length - 1) * 100).toFixed(2)},${(34 - (s.value - mn) / r * 30).toFixed(2)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 100 38" preserveAspectRatio="none" role="img" aria-label="Portfolio value since ${fmtDate(S[0].date)}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
}
function allocation(pos) {
  const useVal = pos.some(p => p.value > 0), metric = p => (useVal ? p.value : p.income), by = {};
  pos.filter(p => p.shares > 0).forEach(p => { const k = state.alloc === "sector" ? (p.sector || "Unassigned") : p.ticker; by[k] = (by[k] || 0) + metric(p); });
  let rows = Object.entries(by).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]); const tot = sum(rows, r => r[1]);
  if (!tot) return `<p class="muted">Add holdings to see your allocation.</p>`;
  if (rows.length > 8) rows = [...rows.slice(0, 7), ["Other", sum(rows.slice(7), r => r[1])]];
  let acc = 0; const stops = rows.map((r, i) => { const a = acc; acc += r[1] / tot * 100; return `${PAL[i]} ${a.toFixed(2)}% ${acc.toFixed(2)}%`; });
  return `<div class="alloc"><div class="donut" style="background:conic-gradient(${stops.join(",")})" role="img" aria-label="Allocation by ${state.alloc}"></div>
    <div class="alloc-list">${rows.map((r, i) => `<div><i style="background:${PAL[i]}"></i><span>${esc(r[0])}</span><span class="num muted">${(r[1] / tot * 100).toFixed(1)}%</span></div>`).join("")}
    <div class="tk-sub" style="margin-top:4px">By ${useVal ? "market value" : "annual income"}</div></div></div>`;
}
const seg = (key, cur, opts) => `<div class="seg" role="group">${opts.map(([k, l]) => `<button data-set="${key}" data-val="${k}" aria-pressed="${cur === k}">${l}</button>`).join("")}</div>`;

/* ───────── Views ───────── */
function viewSignIn() {
  return `<div class="card empty">${ICON.coin}
    <div class="big">Sign in to your dividends</div>
    <div>Your portfolio, payments and watchlist are stored privately under your Google account.</div>
    <div class="actions"><button class="btn primary" data-act="signin">Sign in with Google</button></div>
    <div class="err" id="signErr" role="alert" style="max-width:460px;margin:14px auto 0"></div></div>`;
}
function emptyState() {
  return `<div class="card empty">${ICON.coin}
    <div class="big">Start tracking your dividends</div>
    <div>Add what you own, log each payment as it lands, and see what's coming next.</div>
    <div class="actions"><button class="btn primary" data-act="add-hold">Add a holding</button><button class="btn" data-act="add-pay">Log a dividend</button><button class="btn" data-act="sample">Load sample data</button></div></div>`;
}
function viewDashboard() {
  if (!state.payments.length && !state.holdings.length) return emptyState();
  const s = stats(), data = series(s.P), max = Math.max(...data.map(d => d.v), 1), g = +settings().goal || 0;
  const yoy = s.prevYtd > 0 ? (s.ytd - s.prevYtd) / s.prevYtd : null;
  const next = upcoming(60).find(e => e.type === "proj"), up = upcoming(5);
  const byT = {}; s.ttmList.forEach(p => { (byT[p.ticker] ??= { v: 0, n: 0 }); byT[p.ticker].v += p.amount; byT[p.ticker].n++; });
  const top = Object.entries(byT).sort((a, b) => b[1].v - a[1].v).slice(0, 6), topMax = top[0]?.[1].v || 1;
  const recent = [...s.P].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const rangeLabel = { "12m": "Last 12 months", ytd: `Calendar ${s.y}`, year: "By year", fc: "Next 12 months, projected" }[state.range];
  const hero = s.value
    ? `<div class="label">Portfolio value</div><div class="value">${usd(s.value)}</div>
       <div class="sub">${s.live ? `<span class="delta ${cls(s.day)}">${sgn(s.day)} today</span> ` : ""}<span class="num ${cls(s.gain)}">${sgn(s.gain)}</span> total${s.pricedBasis ? ` (${spct(s.gain / s.pricedBasis * 100)})` : ""}</div>${sparkline()}`
    : `<div class="label">Invested</div><div class="value">${usd(s.basis)}</div><div class="sub">Add prices or a market-data key to see value and gains</div>`;
  return `
  <section class="kpis">
    <div class="card kpi hero c1">${hero}</div>
    <div class="card kpi c2"><div class="label">Income this year</div><div class="value">${usd(s.ytd)}</div>
      <div class="sub">${yoy != null ? `<span class="delta ${cls(yoy)}">${yoy >= 0 ? "▲" : "▼"} ${Math.abs(yoy * 100).toFixed(1)}%</span> vs last year` : `<span class="num">${usd(s.ttm / 12)}</span> / month avg`}</div></div>
    <div class="card kpi c3"><div class="label">Projected annual</div><div class="value">${s.pos.length ? usd(s.projected) : "—"}</div>
      <div class="sub">${s.pos.length ? `Yield <span class="num">${pct(s.yld)}</span> · on cost <span class="num">${pct(s.yoc)}</span>` : "Add holdings to project"}</div>
      ${g ? `<div class="progress" title="${(s.projected / g * 100).toFixed(0)}% of goal"><i style="width:${Math.min(100, s.projected / g * 100).toFixed(1)}%"></i></div><div class="tk-sub" style="margin-top:5px">${(s.projected / g * 100).toFixed(0)}% of ${usd(g, 0)} goal</div>` : ""}</div>
    <div class="card kpi c4"><div class="label">Next payout</div><div class="value">${next ? "~" + usd(next.amount) : "—"}</div>
      <div class="sub">${next ? `${esc(next.ticker)} · ${fmtDate(next.date)}` : "Set a next pay date on a holding"}</div></div>
  </section>
  <section class="grid2">
    <div class="card panel">
      <div class="panel-head"><h2>Dividend income</h2><span class="hint hide-sm">${rangeLabel}</span>${seg("range", state.range, [["12m", "12M"], ["ytd", s.y], ["year", "Years"], ["fc", "Forecast"]])}</div>
      <div class="chart${state.range === "fc" ? " forecast" : ""}" role="img" aria-label="Dividend income bar chart, ${rangeLabel}">
        ${data.map(d => { const h = d.v / max * 100; return `<div class="col${d.now ? " now" : ""}" style="--h:${(h * 1.74).toFixed(0)}px"><span class="tip num">${esc(d.full)} · ${usd(d.v)}</span><div class="bar${d.v ? "" : " zero"}" style="height:${h.toFixed(1)}%"></div><span class="lbl">${d.label}</span></div>`; }).join("")}
      </div>
    </div>
    <div class="card panel">
      <div class="panel-head"><h2>Upcoming</h2><button class="btn sm ghost" data-tab="calendar">Calendar</button></div>
      ${up.length ? `<div class="agenda">${agendaRows(up)}</div>` : `<p class="muted">Nothing scheduled. Set a next pay date on your holdings to project upcoming dividends.</p>`}
    </div>
  </section>
  <section class="grid2 even">
    <div class="card panel"><div class="panel-head"><h2>Allocation</h2>${seg("alloc", state.alloc, [["holding", "Holding"], ["sector", "Sector"]])}</div>${allocation(s.pos)}</div>
    <div class="card panel"><div class="panel-head"><h2>Top payers</h2><span class="hint">12 months</span></div>
      ${top.length ? `<div class="rank">${top.map(([t, o], i) => `<div class="rank-row">${badge(t)}
          <div><div class="tk-name">${esc(t)}</div><div class="tk-sub">${o.n} payment${o.n > 1 ? "s" : ""} · ${(o.v / s.ttm * 100).toFixed(0)}%</div></div>
          <div class="num">${usd(o.v)}</div><div class="track"><div class="fill" style="width:${(o.v / topMax * 100).toFixed(1)}%;background:${PAL[i % PAL.length]}"></div></div></div>`).join("")}</div>` : `<p class="muted">No payments in the last 12 months.</p>`}</div>
  </section>
  <section class="card">
    <div class="panel-head" style="padding:20px 22px 0;margin-bottom:6px"><h2>Recent payments</h2><button class="btn sm ghost" data-tab="dividends">View all</button></div>
    ${recent.length ? `<div class="table-wrap"><table><tbody>${recent.map(p => `
      <tr><td><div class="cell-tk">${badge(p.ticker)}<div><div class="tk-name">${esc(p.ticker)}</div><div class="tk-sub">${fmtDate(p.date)}</div></div></div></td>
      <td class="muted hide-sm">${esc(p.account || "")}</td><td class="r num amt">+${usd(p.amount)}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty" style="padding:30px">No payments logged yet.</div>`}
  </section>`;
}

function viewPortfolio() {
  const s = stats(), H = [...s.pos].sort((a, b) => (b.shares > 0) - (a.shares > 0) || b.value - a.value || b.income - a.income);
  const T = state.txns.filter(inAcct).sort((a, b) => b.date.localeCompare(a.date));
  const num = (n, d = 4) => (+n).toLocaleString("en-US", { maximumFractionDigits: d });
  return `
  <div class="toolbar"><div class="muted">${settings().finnhubKey ? (state.busy ? "Refreshing prices…" : "Live prices from Finnhub.") : "Prices are the ones you enter on each holding. Add a market-data key in Settings for live quotes."}</div><span class="spacer"></span>
    <button class="btn" data-act="add-txn">Add transaction</button><button class="btn primary" data-act="add-hold">Add holding</button></div>
  <div class="card"><div class="table-wrap">${H.length ? `<table>
    <thead><tr><th>Holding</th><th class="r">Shares</th><th class="r hide-sm">Avg cost</th><th class="r">Price</th><th class="r">Value</th><th class="r hide-sm">Total gain</th><th class="r hide-sm">Yield / on cost</th><th class="r">Annual income</th><th></th></tr></thead>
    <tbody>${H.map(h => `<tr${h.shares > 0 ? "" : ' style="opacity:.55"'}>
      <td><div class="cell-tk">${badge(h.ticker)}<div><div class="tk-name">${esc(h.ticker)} ${h.shares > 0 ? "" : '<span class="tag">Closed</span>'}</div><div class="tk-sub">${esc([h.name, state.acct === "all" ? h.account : ""].filter(Boolean).join(" · "))}</div></div></div></td>
      <td class="r num">${num(h.shares)}</td>
      <td class="r num hide-sm">${h.cost ? usd(h.cost) : "—"}</td>
      <td class="r"><div class="num">${h.price ? usd(h.price) : "—"}</div>${h.live && h.dayPct != null ? `<div class="tk-sub num ${cls(h.dayPct)}">${spct(h.dayPct)}</div>` : ""}</td>
      <td class="r num">${h.price ? usd(h.value) : "—"}</td>
      <td class="r hide-sm">${h.price && h.basis ? `<div class="num ${cls(h.gain)}">${sgn(h.gain)}</div><div class="tk-sub num ${cls(h.gain)}">${spct(h.gain / h.basis * 100)}</div>` : "—"}</td>
      <td class="r num hide-sm">${pct(h.yld)} <span class="muted">/ ${pct(h.yoc)}</span></td>
      <td class="r"><div class="num amt">${usd(h.income)}</div><div class="tk-sub">${FREQ[h.freq] || "Quarterly"}</div></td>
      <td class="r"><span class="row-actions"><button data-act="add-txn" data-id="${esc(h.id)}" aria-label="Add ${esc(h.ticker)} transaction" title="Buy / sell">${ICON.plus}</button><button data-act="edit-hold" data-id="${esc(h.id)}" aria-label="Edit ${esc(h.ticker)}" title="Edit">${ICON.edit}</button></span></td></tr>`).join("")}</tbody>
    <tfoot><tr><td>${H.filter(h => h.shares > 0).length} holdings</td><td></td><td class="r num hide-sm">${usd(s.basis)}</td><td></td><td class="r num">${s.value ? usd(s.value) : "—"}</td>
      <td class="r num hide-sm ${cls(s.gain)}">${s.pricedBasis ? sgn(s.gain) : "—"}</td><td class="r num hide-sm">${pct(s.yld)} / ${pct(s.yoc)}</td>
      <td class="r"><div class="num">${usd(s.projected)}</div><div class="tk-sub num">${usd(s.projected / 12)} / month</div></td><td></td></tr></tfoot>
  </table>` : `<div class="empty"><div class="big">No holdings yet</div><div>Add what you own to see value, gains, yield and projected income.</div>
      <div class="actions"><button class="btn primary" data-act="add-hold">Add holding</button></div></div>`}</div></div>
  ${T.length ? `<div class="section-title">Transactions${s.realized ? `<span class="tag">Realized ${sgn(s.realized)}</span>` : ""}</div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Type</th><th class="r">Shares</th><th class="r">Price</th><th class="r">Total</th><th></th></tr></thead>
    <tbody>${T.map(t => `<tr><td class="num muted" style="white-space:nowrap">${fmtDate(t.date)}</td><td><div class="cell-tk">${badge(t.ticker)}<span class="tk-name">${esc(t.ticker)}</span></div></td>
      <td><span class="tag ${t.type === "sell" ? "down" : "up"}">${t.type === "sell" ? "Sell" : "Buy"}</span></td><td class="r num">${num(t.shares)}</td><td class="r num">${usd(t.price)}</td><td class="r num">${usd(t.shares * t.price)}</td>
      <td class="r"><span class="row-actions"><button data-act="edit-txn" data-id="${esc(t.id)}" aria-label="Edit transaction">${ICON.edit}</button></span></td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
}

function viewDividends() {
  const P = state.payments.filter(inAcct), years = uniq(P.map(p => p.date.slice(0, 4))).reverse();
  const q = state.q.trim().toLowerCase();
  const rows = P.filter(p => (state.year === "all" || p.date.startsWith(state.year)) && (!q || [p.ticker, p.account, p.notes].some(v => (v || "").toLowerCase().includes(q))));
  const k = state.sortK, d = state.sortD;
  rows.sort((a, b) => (k === "amount" ? a.amount - b.amount : String(a[k] || "").localeCompare(String(b[k] || ""))) * d || b.date.localeCompare(a.date));
  const arrow = c => (k === c ? (d > 0 ? " ↑" : " ↓") : "");
  const M = {}; P.forEach(p => { const y = p.date.slice(0, 4), m = +p.date.slice(5, 7) - 1; (M[y] ??= Array(12).fill(0))[m] += p.amount; });
  const mx = Math.max(1, ...Object.values(M).flat());
  const heat = years.length ? `<div class="card" style="margin-bottom:22px"><div class="panel-head" style="padding:20px 22px 0;margin-bottom:8px"><h2>Income by month</h2><span class="hint">Darker is more</span></div>
    <div class="table-wrap"><table class="heat"><thead><tr><th>Year</th>${MONTHS.map(m => `<th>${m}</th>`).join("")}<th>Total</th><th class="hide-sm">Growth</th></tr></thead><tbody>
    ${years.map(y => { const t = sum(M[y]), prev = M[y - 1] ? sum(M[y - 1]) : 0; return `<tr><td><b>${y}</b></td>${M[y].map(v => `<td class="c num" style="background:color-mix(in srgb, var(--violet) ${(v / mx * 60).toFixed(0)}%, transparent)">${v ? Math.round(v).toLocaleString("en-US") : '<span class="muted">·</span>'}</td>`).join("")}
      <td class="num"><b>${usd(t, 0)}</b></td><td class="num hide-sm ${prev ? cls(t - prev) : "muted"}">${prev ? spct((t - prev) / prev * 100) : "—"}</td></tr>`; }).join("")}</tbody></table></div></div>` : "";
  return `${heat}
  <div class="toolbar">
    <input class="input search" id="q" type="search" placeholder="Search ticker, account, notes" value="${esc(state.q)}" aria-label="Search payments">
    <select class="input" id="year" aria-label="Filter by year"><option value="all">All years</option>${years.map(y => `<option ${state.year === y ? "selected" : ""}>${y}</option>`).join("")}</select>
    <span class="spacer"></span>
    <button class="btn" data-act="import">Import CSV</button><button class="btn" data-act="csv" ${P.length ? "" : "disabled"}>Export CSV</button>
  </div>
  <div class="card"><div class="table-wrap">${rows.length ? `<table>
    <thead><tr><th class="sortable" data-sort="date">Date${arrow("date")}</th><th class="sortable" data-sort="ticker">Ticker${arrow("ticker")}</th>
      <th class="sortable hide-sm" data-sort="account">Account${arrow("account")}</th><th class="hide-sm">Notes</th><th class="sortable r" data-sort="amount">Amount${arrow("amount")}</th><th></th></tr></thead>
    <tbody>${rows.map(p => `<tr>
      <td class="num muted" style="white-space:nowrap">${fmtDate(p.date)}</td>
      <td><div class="cell-tk">${badge(p.ticker)}<span class="tk-name">${esc(p.ticker)}</span></div></td>
      <td class="hide-sm">${p.account ? `<span class="tag">${esc(p.account)}</span>` : ""}</td>
      <td class="muted hide-sm">${esc(p.notes || "")}</td>
      <td class="r num amt">+${usd(p.amount)}</td>
      <td class="r"><span class="row-actions"><button data-act="edit-pay" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.ticker)} payment">${ICON.edit}</button></span></td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="2">${rows.length} payment${rows.length > 1 ? "s" : ""}</td><td class="hide-sm"></td><td class="hide-sm"></td><td class="r num">${usd(sum(rows, p => p.amount))}</td><td></td></tr></tfoot>
  </table>` : `<div class="empty"><div class="big">${P.length ? "No matches" : "No payments yet"}</div>
      <div>${P.length ? "Try a different search or year." : "Log your first dividend, or import a CSV."}</div>
      ${P.length ? "" : `<div class="actions"><button class="btn primary" data-act="add-pay">Add dividend</button></div>`}</div>`}</div></div>`;
}

function viewCalendar() {
  const t0 = today(); state.calMonth ||= t0.slice(0, 7);
  const [y, m] = state.calMonth.split("-").map(Number), first = new Date(y, m - 1, 1), E = events(), by = {};
  E.forEach(e => (by[e.date] ??= []).push(e));
  const order = { paid: 0, proj: 1, ex: 2, earn: 3 };
  const start = new Date(y, m - 1, 1 - first.getDay()), weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7), cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = iso(d), ev = (by[k] || []).sort((a, b) => order[a.type] - order[b.type]);
    cells.push(`<button class="day${d.getMonth() !== m - 1 ? " out" : ""}${k === t0 ? " today" : ""}${k === state.calDay ? " sel" : ""}" data-day="${k}" aria-label="${fmtDate(k)}, ${ev.length} events">
      <span class="n num">${d.getDate()}</span>${ev.slice(0, 3).map(e => `<span class="ev ${e.type}">${esc(e.ticker)}</span>`).join("")}${ev.length > 3 ? `<span class="more">+${ev.length - 3} more</span>` : ""}</button>`);
  }
  const mk = state.calMonth, inMonth = E.filter(e => e.date.startsWith(mk));
  const got = sum(inMonth.filter(e => e.type === "paid"), e => e.amount), exp = sum(inMonth.filter(e => e.type === "proj"), e => e.amount);
  const sel = state.calDay && by[state.calDay] ? by[state.calDay] : null, up = upcoming(8, 90);
  return `
  <div class="cal-head"><h2>${first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
    <span class="tag">Received ${usd(got)}</span>${exp ? `<span class="tag">Expected ~${usd(exp)}</span>` : ""}
    <button class="btn sm" data-cal="-1" aria-label="Previous month">‹</button><button class="btn sm" data-cal="0">Today</button><button class="btn sm" data-cal="1" aria-label="Next month">›</button>
    <button class="btn sm" data-act="ics" title="Download upcoming events as an .ics calendar file">Export .ics</button></div>
  <section class="grid2">
    <div><div class="cal">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => `<div class="dow">${d}</div>`).join("")}${cells.join("")}</div>
      <div class="legend" style="margin-top:12px"><span class="ev paid">Paid</span><span class="ev proj">Expected dividend</span><span class="ev ex">Ex-dividend</span><span class="ev earn">Earnings</span>
      ${settings().finnhubKey ? "" : `<span>Earnings dates need a market-data key (Settings).</span>`}</div></div>
    <div class="card panel"><div class="panel-head"><h2>${sel ? fmtDate(state.calDay) : "Upcoming"}</h2>${sel ? `<button class="btn sm ghost" data-day="">Show upcoming</button>` : `<span class="hint">90 days</span>`}</div>
      ${sel ? `<div class="agenda">${agendaRows(sel)}</div>` : up.length ? `<div class="agenda">${agendaRows(up)}</div>` : `<p class="muted">Nothing scheduled. Open a holding and set its next pay date and ex-dividend date; the calendar repeats them at the holding's frequency.</p>`}
    </div>
  </section>`;
}

function viewWatchlist() {
  const key = settings().finnhubKey;
  const W = [...state.watch].sort((a, b) => a.ticker.localeCompare(b.ticker));
  return `
  <div class="toolbar"><div class="muted">${key ? "Target alerts show here when the price crosses your target." : "Add a market-data key in Settings to see live prices and target alerts."}</div><span class="spacer"></span>
    <button class="btn primary" data-act="add-watch">Add to watchlist</button></div>
  <div class="card"><div class="table-wrap">${W.length ? `<table>
    <thead><tr><th>Symbol</th><th class="r">Price</th><th class="r">Today</th><th class="r">Target</th><th class="hide-sm">Notes</th><th></th></tr></thead>
    <tbody>${W.map(w => { const q = state.quotes[w.ticker], hit = q?.c && w.target && (w.dir === "above" ? q.c >= w.target : q.c <= w.target); return `<tr>
      <td><div class="cell-tk">${badge(w.ticker)}<div><div class="tk-name">${esc(w.ticker)}</div><div class="tk-sub">${esc(w.name || "")}</div></div></div></td>
      <td class="r num">${q?.c ? usd(q.c) : "—"}</td>
      <td class="r num ${q?.dp != null ? cls(q.dp) : "muted"}">${q?.dp != null ? spct(q.dp) : "—"}</td>
      <td class="r">${w.target ? `<span class="num">${w.dir === "above" ? "≥" : "≤"} ${usd(w.target)}</span>${hit ? ' <span class="delta up">Target hit</span>' : ""}` : '<span class="muted">—</span>'}</td>
      <td class="muted hide-sm">${esc(w.notes || "")}</td>
      <td class="r"><span class="row-actions"><button data-act="edit-watch" data-id="${esc(w.id)}" aria-label="Edit ${esc(w.ticker)}">${ICON.edit}</button></span></td></tr>`; }).join("")}</tbody></table>`
    : `<div class="empty"><div class="big">Nothing on your watchlist</div><div>Follow stocks you don't own yet and set a target price.</div><div class="actions"><button class="btn primary" data-act="add-watch">Add to watchlist</button></div></div>`}</div></div>`;
}

function viewMarket() {
  if (!settings().finnhubKey) return needKey("The Market tab");
  const m = state.market, t0 = today();
  const head = `<div class="toolbar">${seg("mtab", m.tab, [["news", "News"], ["earnings", "Earnings"], ["ipos", "IPOs"]])}<span class="spacer"></span><span class="muted">${m.busy || state.busy ? "Loading…" : ""}</span></div>`;
  let body = "";
  if (m.tab === "news") body = m.news == null ? `<div class="skeleton"></div>` : m.news.length ? `<div class="card news">${m.news.map(n => `
      <a href="${esc(/^https?:\/\//.test(n.url) ? n.url : "#")}" target="_blank" rel="noopener noreferrer"><div class="m">${n.ticker ? `<span class="tag">${esc(n.ticker)}</span>` : ""}<span>${esc(n.source || "")}</span><span>${new Date(n.datetime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
      <div class="h">${esc(n.headline)}</div><div class="s">${esc(n.summary || "")}</div></a>`).join("")}</div>` : `<div class="card empty">No recent news for your holdings.</div>`;
  if (m.tab === "earnings") { const E = state.earnings.filter(e => e.date >= t0).sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ ...e, type: "earn" }));
    body = E.length ? `<div class="card panel"><div class="agenda">${agendaRows(E)}</div></div>` : `<div class="card empty">No upcoming earnings dates found for your holdings and watchlist.</div>`; }
  if (m.tab === "ipos") body = m.ipos == null ? `<div class="skeleton"></div>` : m.ipos.length ? `<div class="card"><div class="table-wrap"><table><thead><tr><th>Date</th><th>Company</th><th>Symbol</th><th class="hide-sm">Exchange</th><th class="r">Price</th><th class="hide-sm">Status</th></tr></thead>
      <tbody>${m.ipos.map(i => `<tr><td class="num muted" style="white-space:nowrap">${fmtDate(i.date)}</td><td class="tk-name">${esc(i.name || "")}</td><td>${esc(i.symbol || "—")}</td><td class="muted hide-sm">${esc(i.exchange || "")}</td><td class="r num">${esc(i.price || "—")}</td><td class="hide-sm"><span class="tag">${esc(i.status || "")}</span></td></tr>`).join("")}</tbody></table></div></div>` : `<div class="card empty">No IPOs scheduled in the next 45 days.</div>`;
  return head + body;
}

const VIEWS = { dashboard: viewDashboard, portfolio: viewPortfolio, dividends: viewDividends, calendar: viewCalendar, watchlist: viewWatchlist, market: viewMarket };
function render() {
  $("#status").className = "pill " + state.mode;
  $("#statusText").textContent = { connecting: "Connecting…", cloud: "Synced to Firebase", local: "Saved on this device", signedout: "Not signed in" }[state.mode];
  const app = state.mode === "cloud" || state.mode === "local";
  document.querySelectorAll(".app-only").forEach(e => (e.hidden = !app));
  $("#refreshBtn").hidden = !app || !settings().finnhubKey;
  $("#logoutBtn").hidden = !(fb && fb.user);
  $("#cPay").textContent = state.payments.filter(inAcct).length; $("#cHold").textContent = state.holdings.filter(inAcct).length; $("#cWatch").textContent = state.watch.length;
  const msgs = [state.banner, state.apiErr && `<b>Market data:</b> ${esc(state.apiErr)}`].filter(Boolean);
  $("#banner").innerHTML = msgs.map(m => `<div class="banner"><div>${m}</div><button aria-label="Dismiss" data-act="dismiss">×</button></div>`).join("");
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === state.tab));
  if (state.mode === "connecting") { $("#view").innerHTML = '<div class="skeleton"></div>'; return; }
  if (state.mode === "signedout") { $("#view").innerHTML = viewSignIn(); return; }
  const accts = uniq([...state.holdings, ...state.payments, ...state.txns].map(x => x.account));
  if (state.acct !== "all" && !accts.includes(state.acct)) state.acct = "all";
  $("#acct").innerHTML = `<option value="all">All portfolios</option>` + accts.map(a => `<option ${state.acct === a ? "selected" : ""}>${esc(a)}</option>`).join("");
  $("#acct").hidden = !accts.length;
  const active = document.activeElement?.id, pos = document.activeElement?.selectionStart;
  $("#view").innerHTML = VIEWS[state.tab]();
  if (active === "q") { const el = $("#q"); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
  $("#tickers").innerHTML = uniq([...state.holdings, ...state.payments, ...state.watch].map(x => x.ticker)).map(t => `<option value="${esc(t)}">`).join("");
  $("#accounts").innerHTML = accts.map(t => `<option value="${esc(t)}">`).join("");
  $("#sectors").innerHTML = uniq(state.holdings.map(h => h.sector)).map(t => `<option value="${esc(t)}">`).join("");
}

/* ───────── Generic form dialog ───────── */
let form = null;
function openForm(cfg) {
  form = cfg; $("#fTitle").textContent = cfg.title;
  $("#fFields").innerHTML = cfg.fields.map(f => {
    const common = `id="f_${f.id}" class="input${f.type === "number" ? " num" : ""}" ${f.disabled ? "disabled" : ""}`;
    const input = f.type === "select"
      ? `<select ${common}>${f.opts.map(([v, l]) => `<option value="${esc(v)}" ${String(f.value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
      : `<input ${common} type="${f.type || "text"}" value="${esc(f.value ?? "")}" placeholder="${esc(f.ph || "")}" ${f.type === "number" ? 'step="any" min="0" inputmode="decimal"' : ""} ${f.list ? `list="${f.list}"` : ""} maxlength="${f.max || 80}" autocomplete="off">`;
    return `<div class="field${f.full ? " full" : ""}"><label for="f_${f.id}">${esc(f.label)}${f.opt ? ' <span class="muted">(optional)</span>' : ""}</label>${input}${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ""}</div>`;
  }).join("");
  $("#fExtra").innerHTML = cfg.extra || ""; $("#fErr").textContent = "";
  $("#fSave").textContent = cfg.saveLabel || "Save";
  const del = $("#fDel"); del.hidden = !cfg.onDelete; del.textContent = cfg.deleteLabel || "Delete"; del.dataset.armed = "";
  $("#dlg").showModal(); $("#fFields").querySelector("input:not([disabled]),select")?.focus(); cfg.onOpen?.();
}
const fail = e => { console.error(e); $("#fErr").textContent = e.user ? e.message : e?.code === "permission-denied" ? "Firestore rules blocked this change." : "Couldn't save. Please try again."; };
$("#dlgForm").addEventListener("submit", async e => {
  e.preventDefault(); const v = {};
  form.fields.forEach(f => { const el = $("#f_" + f.id); v[f.id] = f.type === "number" ? (el.value === "" ? null : parseFloat(el.value)) : el.value.trim(); });
  try { const msg = await form.onSave(v); $("#dlg").close(); toast(msg || "Saved"); } catch (err) { fail(err); }
});
$("#fDel").addEventListener("click", async () => {
  const b = $("#fDel");
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Click again to confirm"; return; }
  try { const msg = await form.onDelete(); $("#dlg").close(); toast(msg || "Deleted"); } catch (err) { fail(err); }
});
$("#fCancel").addEventListener("click", () => $("#dlg").close());
$("#dlg").addEventListener("click", e => { if (e.target.id === "dlg") $("#dlg").close(); });
const up = s => s.toUpperCase().replace(/\s+/g, "");
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
const acctDefault = () => (state.acct === "all" ? "" : state.acct);

function openPay(id) {
  const p = state.payments.find(x => x.id === id);
  openForm({ title: p ? "Edit dividend" : "Add dividend", fields: [
    { id: "ticker", label: "Ticker", value: p?.ticker, ph: "SCHD", list: "tickers", max: 12 },
    { id: "amount", label: "Amount received ($)", type: "number", value: p?.amount, ph: "0.00" },
    { id: "date", label: "Pay date", type: "date", value: p?.date || today() },
    { id: "account", label: "Portfolio", opt: 1, value: p?.account ?? acctDefault(), ph: "Brokerage, Roth IRA…", list: "accounts", max: 40 },
    { id: "notes", label: "Notes", opt: 1, full: 1, value: p?.notes, ph: "Special dividend, reinvested…", max: 120 } ],
    onSave: async v => {
      v.ticker = up(v.ticker); if (!v.ticker) bad("Enter a ticker."); if (!(v.amount > 0)) bad("Enter an amount greater than zero."); if (!isDate(v.date)) bad("Pick a pay date.");
      v.amount = Math.round(v.amount * 100) / 100;
      await (p ? store.update("dividends", id, v) : store.add("dividends", v)); return p ? "Dividend updated" : `Added ${usd(v.amount)} from ${v.ticker}`;
    },
    onDelete: p && (() => store.remove("dividends", id)) });
}
function openHold(id) {
  const h = state.holdings.find(x => x.id === id), d = h && positions(true).find(x => x.id === id), key = settings().finnhubKey;
  openForm({ title: h ? `Edit ${h.ticker}` : "Add holding", fields: [
    { id: "ticker", label: "Ticker", value: h?.ticker, ph: "SCHD", max: 12, disabled: !!h },
    { id: "name", label: "Name", opt: 1, value: h?.name, ph: "Schwab US Dividend Equity", max: 60 },
    { id: "shares", label: "Shares", type: "number", value: d ? +d.shares.toFixed(6) : "", disabled: d?.hasTx, hint: d?.hasTx ? "Calculated from transactions" : "" },
    { id: "cost", label: "Avg cost / share ($)", type: "number", value: d?.cost ? +d.cost.toFixed(4) : "", disabled: d?.hasTx, hint: d?.hasTx ? "Calculated from transactions" : "" },
    { id: "dps", label: "Annual dividend / share ($)", type: "number", value: h?.dps || "", ph: "0.00" },
    { id: "freq", label: "Pays", type: "select", value: h?.freq || 4, opts: [[12, "Monthly"], [4, "Quarterly"], [2, "Semi-annually"], [1, "Annually"]] },
    { id: "nextPay", label: "Next pay date", opt: 1, type: "date", value: h?.nextPay, hint: "Repeats on the calendar" },
    { id: "exDate", label: "Next ex-dividend date", opt: 1, type: "date", value: h?.exDate },
    { id: "price", label: "Current price ($)", opt: 1, type: "number", value: h?.price || "", hint: key ? "Live price is used when available" : "Used for value and yield" },
    { id: "sector", label: "Sector", opt: 1, value: h?.sector, list: "sectors", ph: "Technology", max: 40 },
    { id: "account", label: "Portfolio", opt: 1, full: 1, value: h?.account ?? acctDefault(), list: "accounts", ph: "Brokerage, Roth IRA…", max: 40, disabled: !!h } ],
    onOpen: () => { if (h || !key) return; $("#f_ticker").addEventListener("change", async e => {
      const t = up(e.target.value); if (!t) return;
      try { const [p, m] = await Promise.all([fh("/stock/profile2", { symbol: t }, 43200), fh("/stock/metric", { symbol: t, metric: "all" }, 1440)]);
        const fill = (i, v) => { const el = $("#f_" + i); if (el && !el.value && v) el.value = v; };
        fill("name", p?.name); fill("sector", p?.finnhubIndustry); fill("dps", m?.metric?.dividendPerShareAnnual && +(+m.metric.dividendPerShareAnnual).toFixed(4));
      } catch (err) { console.warn(err); } }); },
    onSave: async v => {
      const data = { name: v.name, dps: v.dps || 0, freq: +v.freq, nextPay: isDate(v.nextPay) ? v.nextPay : "", exDate: isDate(v.exDate) ? v.exDate : "", price: v.price || 0, sector: v.sector };
      if (!d?.hasTx) { if (!(v.shares > 0)) bad("Enter the number of shares."); data.shares = v.shares; data.cost = v.cost || 0; }
      if (h) { await store.update("holdings", id, data); return "Holding updated"; }
      const ticker = up(v.ticker); if (!ticker) bad("Enter a ticker.");
      if (state.holdings.some(x => x.ticker === ticker && (x.account || "") === v.account)) bad(`${ticker} is already in ${v.account || "this portfolio"}. Edit it instead.`);
      await store.add("holdings", { ...data, ticker, account: v.account }); refreshSoon(); return `Added ${ticker}`;
    },
    onDelete: h && (async () => { await Promise.all(state.txns.filter(t => t.ticker === h.ticker && (t.account || "") === (h.account || "")).map(t => store.remove("transactions", t.id))); await store.remove("holdings", id); }),
    deleteLabel: d?.hasTx ? "Delete with transactions" : "Delete" });
}
function openTxn(id, holdId) {
  const t = state.txns.find(x => x.id === id), h = state.holdings.find(x => x.id === holdId);
  openForm({ title: t ? "Edit transaction" : "Add transaction", fields: [
    { id: "ticker", label: "Ticker", value: t?.ticker || h?.ticker, ph: "SCHD", list: "tickers", max: 12, disabled: !!t },
    { id: "type", label: "Type", type: "select", value: t?.type || "buy", opts: [["buy", "Buy"], ["sell", "Sell"]] },
    { id: "shares", label: "Shares", type: "number", value: t?.shares },
    { id: "price", label: "Price / share ($)", type: "number", value: t?.price ?? (h && state.quotes[h.ticker]?.c) },
    { id: "date", label: "Date", type: "date", value: t?.date || today() },
    { id: "account", label: "Portfolio", opt: 1, value: t?.account ?? h?.account ?? acctDefault(), list: "accounts", max: 40, disabled: !!t } ],
    onSave: async v => {
      if (!(v.shares > 0)) bad("Enter the number of shares."); if (!(v.price >= 0) || v.price == null) bad("Enter a price."); if (!isDate(v.date)) bad("Pick a date.");
      if (t) { await store.update("transactions", id, { type: v.type, shares: v.shares, price: v.price, date: v.date }); return "Transaction updated"; }
      const ticker = up(v.ticker); if (!ticker) bad("Enter a ticker.");
      const ex = state.holdings.find(x => x.ticker === ticker && (x.account || "") === v.account);
      if (!ex && v.type === "sell") bad(`You don't hold ${ticker} in ${v.account || "this portfolio"}.`);
      if (ex && !state.txns.some(x => x.ticker === ticker && (x.account || "") === v.account) && ex.shares > 0)
        await store.add("transactions", { ticker, account: v.account, type: "buy", shares: +ex.shares, price: +ex.cost || 0, date: addDays(v.date, -1), opening: true });
      if (!ex) await store.add("holdings", { ticker, account: v.account, name: "", shares: 0, cost: 0, dps: 0, freq: 4 });
      await store.add("transactions", { ticker, account: v.account, type: v.type, shares: v.shares, price: v.price, date: v.date });
      if (!ex) refreshSoon(); return `${v.type === "sell" ? "Sold" : "Bought"} ${v.shares} ${ticker}`;
    },
    onDelete: t && (() => store.remove("transactions", id)) });
}
function openWatch(id) {
  const w = state.watch.find(x => x.id === id);
  openForm({ title: w ? `Edit ${w.ticker}` : "Add to watchlist", fields: [
    { id: "ticker", label: "Ticker", value: w?.ticker, ph: "MSFT", max: 12, disabled: !!w },
    { id: "name", label: "Name", opt: 1, value: w?.name, max: 60 },
    { id: "target", label: "Target price ($)", opt: 1, type: "number", value: w?.target || "" },
    { id: "dir", label: "Alert when price is", type: "select", value: w?.dir || "below", opts: [["below", "At or below target"], ["above", "At or above target"]] },
    { id: "notes", label: "Notes", opt: 1, full: 1, value: w?.notes, max: 120 } ],
    onSave: async v => {
      const data = { name: v.name, target: v.target || 0, dir: v.dir, notes: v.notes };
      if (w) { await store.update("watchlist", id, data); return "Updated"; }
      const ticker = up(v.ticker); if (!ticker) bad("Enter a ticker."); if (state.watch.some(x => x.ticker === ticker)) bad(`${ticker} is already on your watchlist.`);
      await store.add("watchlist", { ...data, ticker }); refreshSoon(); return `Watching ${ticker}`;
    },
    onDelete: w && (() => store.remove("watchlist", id)) });
}
function openSettings() {
  const s = settings(), who = fb?.user ? esc(fb.user.email || fb.user.displayName || "") : "";
  openForm({ title: "Settings", fields: [
    { id: "finnhubKey", label: "Finnhub API key", opt: 1, full: 1, type: "password", value: s.finnhubKey, max: 80, hint: "Free key from finnhub.io. Turns on live prices, earnings dates, news and IPOs. Stored in your private settings, not in the site's code." },
    { id: "goal", label: "Annual dividend income goal ($)", opt: 1, full: 1, type: "number", value: s.goal || "" } ],
    extra: who ? `<p class="muted" style="margin:18px 0 0;font-size:13px">Signed in as <b>${who}</b> · <button type="button" class="btn sm ghost" data-act="signout">Sign out</button></p>` : "",
    onSave: async v => { const changed = v.finnhubKey !== (s.finnhubKey || ""); await store.set("settings", "main", { finnhubKey: v.finnhubKey, goal: v.goal || 0 });
      if (changed) { state.quotes = {}; state.earnings = []; state.market.news = state.market.ipos = null; state.apiErr = ""; setTimeout(() => refreshMarket(true), 300); } return "Settings saved"; } });
}
let rs; const refreshSoon = () => { clearTimeout(rs); rs = setTimeout(() => refreshMarket(), 800); };

/* ───────── Sample data, CSV, ICS ───────── */
async function loadSample() {
  const now = new Date(), nm = (d) => iso(new Date(now.getFullYear(), now.getMonth() + 1, d));
  const H = [["SCHD","Schwab US Dividend Equity",120,24.5,1.04,4,27.1,"ETF"],["O","Realty Income",85,54.2,3.22,12,58.3,"Real Estate"],["JNJ","Johnson & Johnson",30,152,5.2,4,161.4,"Healthcare"],["KO","Coca-Cola",75,58.4,2.04,4,63.2,"Consumer Staples"],["VYM","Vanguard High Dividend Yield",40,108,4.35,4,121.5,"ETF"]];
  const jobs = [];
  H.forEach(([ticker, name, shares, cost, dps, freq, price, sector], j) => jobs.push(store.add("holdings", { ticker, name, shares, cost, dps, freq, price, sector, account: j % 2 ? "Roth IRA" : "Brokerage", nextPay: nm(5 + j * 4), exDate: nm(1 + j * 3) })));
  for (let i = 0; i < 20; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    H.forEach(([ticker, , shares, , dps, freq], j) => {
      if (freq === 4 && (d.getMonth() + j) % 3) return;
      const day = new Date(d.getFullYear(), d.getMonth(), 5 + j * 4); if (day > now) return;
      jobs.push(store.add("dividends", { ticker, amount: Math.round(shares * dps / freq * (1 - i * 0.006) * 100) / 100, date: iso(day), account: j % 2 ? "Roth IRA" : "Brokerage", notes: "Sample" }));
    });
  }
  [["MSFT", "Microsoft", 380, "below"], ["PG", "Procter & Gamble", 150, "below"]].forEach(([ticker, name, target, dir]) => jobs.push(store.add("watchlist", { ticker, name, target, dir, notes: "Sample" })));
  try { await Promise.all(jobs); toast("Sample data loaded"); refreshSoon(); } catch (e) { console.error(e); toast("Couldn't load sample data"); }
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function exportCsv() {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Date","Ticker","Amount","Account","Notes"], ...state.payments.filter(inAcct).sort((a, b) => a.date.localeCompare(b.date)).map(p => [p.date, p.ticker, p.amount, p.account, p.notes])];
  download(`dividends-${today()}.csv`, rows.map(r => r.map(q).join(",")).join("\n"), "text/csv");
}
function parseCsv(text) {
  const rows = []; let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(x => x.trim())) rows.push(row); row = []; }
    else cur += c; }
  row.push(cur); if (row.some(x => x.trim())) rows.push(row); return rows;
}
async function importCsv(file) {
  try {
    const rows = parseCsv(await file.text()); if (rows.length < 2) return toast("That file has no rows to import");
    const head = rows[0].map(h => h.trim().toLowerCase()), ix = n => head.findIndex(h => n.some(x => h === x || h.includes(x)));
    const cD = ix(["date"]), cT = ix(["ticker", "symbol"]), cA = ix(["amount", "total", "value"]), cAc = ix(["account", "portfolio"]), cN = ix(["note", "description"]);
    if (cD < 0 || cT < 0 || cA < 0) return toast("CSV needs Date, Ticker and Amount columns");
    const toIso = s => { s = s.trim(); if (isDate(s.slice(0, 10))) return s.slice(0, 10); const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); return m ? `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(m[1])}-${pad(m[2])}` : ""; };
    const have = new Set(state.payments.map(p => [p.date, p.ticker, p.amount, p.account || ""].join("|"))), jobs = []; let skip = 0;
    for (const r of rows.slice(1)) {
      const d = { date: toIso(r[cD] || ""), ticker: up(r[cT] || ""), amount: Math.round(parseFloat(String(r[cA] || "").replace(/[$,\s]/g, "")) * 100) / 100, account: cAc > -1 ? (r[cAc] || "").trim() : "", notes: cN > -1 ? (r[cN] || "").trim().slice(0, 120) : "" };
      if (!d.date || !d.ticker || !(d.amount > 0) || have.has([d.date, d.ticker, d.amount, d.account].join("|"))) { skip++; continue; }
      jobs.push(store.add("dividends", d));
    }
    await Promise.all(jobs); toast(`Imported ${jobs.length} payment${jobs.length === 1 ? "" : "s"}${skip ? `, skipped ${skip}` : ""}`);
  } catch (e) { console.error(e); toast("Couldn't import that file"); }
}
function exportIcs() {
  const E = upcoming(500, 400); if (!E.length) return toast("No upcoming events to export");
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, ""), d8 = s => s.replace(/-/g, "");
  const ev = E.map((e, i) => ["BEGIN:VEVENT", `UID:${d8(e.date)}-${e.ticker}-${e.type}-${i}@dividend-tracker`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(e.date)}`, `DTEND;VALUE=DATE:${d8(addDays(e.date, 1))}`,
    `SUMMARY:${e.ticker} ${{ proj: "dividend" + (e.amount ? " ~" + usd(e.amount) : ""), ex: "ex-dividend date", earn: "earnings" }[e.type]}`, "END:VEVENT"].join("\r\n"));
  download("dividend-calendar.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dividend Tracker//EN", ...ev, "END:VCALENDAR"].join("\r\n"), "text/calendar");
  toast(`Exported ${E.length} events`);
}

/* ───────── Events ───────── */
const ACTS = {
  signin: signIn, signout: () => { $("#dlg").close(); fb.au.signOut(fb.auth); }, settings: openSettings, sample: (t) => { t.disabled = true; loadSample(); },
  "add-pay": () => openPay(), "edit-pay": t => openPay(t.dataset.id), "add-hold": () => openHold(), "edit-hold": t => openHold(t.dataset.id),
  "add-txn": t => openTxn(null, t.dataset.id), "edit-txn": t => openTxn(t.dataset.id), "add-watch": () => openWatch(), "edit-watch": t => openWatch(t.dataset.id),
  csv: exportCsv, import: () => $("#csvFile").click(), ics: exportIcs, dismiss: () => { state.banner = ""; state.apiErr = ""; render(); }
};
function go(tab) { state.tab = tab; render(); if (tab === "market") loadMarketTab(); window.scrollTo({ top: 0 }); }
document.addEventListener("click", e => {
  const t = e.target.closest("button, th.sortable"); if (!t) return;
  const d = t.dataset;
  if (d.act) { if (store || d.act === "signin" || d.act === "dismiss") ACTS[d.act]?.(t); }
  else if (d.tab) go(d.tab);
  else if (d.set) { const v = d.val; if (d.set === "mtab") { state.market.tab = v; render(); loadMarketTab(); } else { state[d.set] = v; render(); } }
  else if (d.sort) { state.sortD = state.sortK === d.sort ? -state.sortD : (d.sort === "ticker" || d.sort === "account" ? 1 : -1); state.sortK = d.sort; render(); }
  else if ("day" in d) { state.calDay = d.day === state.calDay ? "" : d.day; render(); }
  else if (d.cal) { const n = +d.cal; if (!n) { state.calMonth = today().slice(0, 7); state.calDay = ""; } else { const [y, m] = state.calMonth.split("-").map(Number); state.calMonth = iso(new Date(y, m - 1 + n, 1)).slice(0, 7); } render(); }
  else if (t.id === "addBtn") { if (store) openPay(); }
  else if (t.id === "settingsBtn") { if (store) openSettings(); }
  else if (t.id === "refreshBtn") refreshMarket(true);
  else if (t.id === "themeBtn") { const n = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; try { localStorage.setItem("dt_theme", n); } catch {} }
});
document.addEventListener("input", e => { if (e.target.id === "q") { state.q = e.target.value; render(); } });
document.addEventListener("change", e => {
  if (e.target.id === "year") { state.year = e.target.value; render(); }
  else if (e.target.id === "acct") { state.acct = e.target.value; render(); }
  else if (e.target.id === "csvFile") { const f = e.target.files[0]; e.target.value = ""; if (f && store) importCsv(f); }
});

try { const th = localStorage.getItem("dt_theme"); if (th) document.documentElement.dataset.theme = th; } catch {}
$("#today").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
render();
initCloud();
