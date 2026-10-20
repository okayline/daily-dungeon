// Leaderboard for Daily Digital Demon Dungeon: a Cloudflare Worker with a D1 database.
//   POST /score   {run, name, floor, days, demons, turns, version, align}   -> {ok, rank}
//   GET  /top?n=20&run=ID                                      -> {rows: [...], you: {...} | null}
//   GET  /season                                               -> {epoch, law, chaos}
//   GET  /stats                                                -> {epoch, counts: {...}, lastFall}
//   POST /event   {t, v?, lv, d, k, a, p, c, dm, m, n}         -> {ok}        (a "this happened" ping: a tag, and where and who)
//   POST /here    {id, level}                                  -> {ok, now}   (a "someone is here" ping: daily, and every few minutes while playing; now = who is here right now)
//   GET  /feed                                                 -> everything the title screen shows, in one read
//   GET  /admin   (header x-admin-key)                         -> {ok} if the key is right, else 403 (the game's X menu asks this)
//   GET  /admin/here (header x-admin-key)                      -> every device seen this moon, for the X-mode board (v1.01.1)
// Ranked by deepest floor, then most days survived, then whoever got there first. TURNS are shown but never ranked (spam).
// The game saves in the player's browser, so scores can't be proven: the checks below only keep out the casual junk.
import { gameRoute } from "./game.js";
import { accountsRoute, playerOf } from "./accounts.js";
const MAX = { floor: 20, days: 400 };
// Same lunar-epoch math as screen.js's epochIndex -- a whole-number count of real lunar months since
// the same new-moon reference, so it's identical for every player (and this Worker) at every instant.
// Deliberately re-derived here rather than imported: the Worker never loads game code, just this one formula.
const EPOCH_REF = Date.UTC(2000, 0, 6, 18, 14), EPOCH_SYN = 29.530588853;
const epochIndex = () => Math.floor((Date.now() - EPOCH_REF) / 86400000 / EPOCH_SYN);
const SIDES = ["LAW", "CHAOS"];
// LIVE PRESENCE: a known device's row is rewritten at most once per this many seconds (unless its level changed).
const PRESENCE_WRITE_GAP = 120;
// "Right now" = seen in the last 5 minutes (a playing page pings every 3). Counts only, bots left out (their ids
// start "bot"). Worked out at most once a minute per Worker instance and shared by every /feed and /here reply,
// so a thousand title loads cost one small query, not a thousand.
const LIVE_WINDOW = 300, LIVE_CACHE_MS = 60000;
let liveCache = null;
async function liveNow(db) {
  const t = Date.now();
  if (liveCache && t - liveCache.t < LIVE_CACHE_MS) return liveCache.v;
  const v = { total: 0, levels: [] };
  try {
    for (const r of (await db.prepare(`SELECT level, COUNT(*) AS n FROM present WHERE at > ?1 AND id NOT LIKE 'bot%' GROUP BY level ORDER BY level LIMIT 30`).bind(Math.floor(t / 1000) - LIVE_WINDOW).all()).results) { v.levels.push({ level: r.level, n: r.n }); v.total += r.n; }
  } catch (e) {}
  liveCache = { t, v };
  return v;
}

// LAW/CHAOS: a blind floor-weighted increment to that side's row for the current epoch (upsert, no
// read needed first). NEUTRAL: the kingmaker -- a single conditional UPDATE that only ever touches
// whichever row is currently lower, and does nothing on an exact tie. Both rows are guaranteed to
// exist first (0-count upserts) so the conditional UPDATE always has two rows to compare.
async function tallyFaction(db, align, floorPts) {
  const epoch = epochIndex();
  if (align === "LAW" || align === "CHAOS") {
    await db.prepare(`INSERT INTO faction_season (epoch, side, count) VALUES (?1, ?2, ?3)
      ON CONFLICT (epoch, side) DO UPDATE SET count = count + ?3`).bind(epoch, align, floorPts).run();
    return;
  }
  if (align !== "NEUTRAL") return;   // unknown tag: no season point, same as any other junk input
  for (const side of SIDES) {
    await db.prepare(`INSERT INTO faction_season (epoch, side, count) VALUES (?1, ?2, 0)
      ON CONFLICT (epoch, side) DO NOTHING`).bind(epoch, side).run();
  }
  // Exactly two rows per epoch: if they're not tied, this touches the (single) row sitting at the
  // epoch's minimum; if they are tied, COUNT(DISTINCT count) = 1 and nothing is written.
  await db.prepare(`UPDATE faction_season SET count = count + ?2
    WHERE epoch = ?1 AND count = (SELECT MIN(count) FROM faction_season WHERE epoch = ?1)
      AND (SELECT COUNT(DISTINCT count) FROM faction_season WHERE epoch = ?1) = 2`)
    .bind(epoch, floorPts).run();
}
// THE TITLE SCREEN'S RUNNING TOTALS: plain counts for the current lunar epoch, added up from the few
// numbers each finished run reports with its score. One row per (epoch, key); "wall" keeps the longest,
// everything else adds. "players" counts distinct senders, through the seen table (never a table scan).
// Each value is capped per run, so one forged post can't swing a total by much. None of this ranks anyone.
const STAT_CAPS = { pacts: 30, ended: 30, broken: 200, trips: 50, refused: 200, silent: 500,
  beaten: 300, talks: 500, joined: 30, unlocks: 400, standby: 400, climbs: 20, moon: 400, moonYes: 400, breath: 2000, silver: 100000, rare: 100,
  traded: 300, peace: 300, moonTook: 100 };
// The instant the current lunar epoch began, in unix seconds.
const epochStart = () => Math.floor((EPOCH_REF + epochIndex() * EPOCH_SYN * 86400000) / 1000);
async function tallyStats(db, b, turns, who) {
  const epoch = epochIndex(), s = (b && typeof b.stats === "object" && b.stats) || {};
  const add = (key, n) => db.prepare(`INSERT INTO counters (period, key, count) VALUES (?1, ?2, ?3)
    ON CONFLICT (period, key) DO UPDATE SET count = count + ?3`).bind(epoch, key, n).run();
  await add("runs", 1);
  await add("turns", Math.max(0, Math.min(turns, 100000)));
  for (const key of Object.keys(STAT_CAPS)) {
    const n = Math.floor(Number(s[key]));
    if (Number.isFinite(n) && n > 0) await add(key, Math.min(n, STAT_CAPS[key]));
  }
  const wall = Math.floor(Number(s.wall));
  if (Number.isFinite(wall) && wall > 0) await db.prepare(`INSERT INTO counters (period, key, count) VALUES (?1, 'wall', ?2)
    ON CONFLICT (period, key) DO UPDATE SET count = MAX(count, ?2)`).bind(epoch, Math.min(wall, 9999)).run();
  // What struck the run down, if anything did: one counter a demon ("k:NAME"), for the title's "Most falls".
  const killer = String((b && b.killer) || "").toUpperCase();
  if (/^[A-Z][A-Z0-9 .\-]{1,19}$/.test(killer)) await add("k:" + killer, 1);
  const seen = await db.prepare(`INSERT OR IGNORE INTO seen (period, who) VALUES (?1, ?2)`).bind(epoch, who).run();
  if (seen.meta && seen.meta.changes) await add("players", 1);
}
// AMBIENT EVENTS, for the title screen's rumor cards: a tag from a fixed list, an optional small number, and
// the time. No name, no run, no free text, so nothing here can carry a message or a spoiler. The newest 20 of
// each tag are kept. Forging one is cheap and harmless: nothing ranks on these or rewards them.
const EVENT_KINDS = ["den", "bay", "relay", "vault", "forge", "altar", "archive", "void", "hall", "dead", "plain"];
const EVENT_TAGS = ["out", "refused", "asked", "restored", "trickster", "joined", "silent", "deep", "left", "fall", "words", "traded", "parted", "moonpick"];
async function titleFeed(db) {
  const epoch = epochIndex(), counts = {}, tally = { LAW: 0, CHAOS: 0 };
  const quiet = async (fn, fallback) => { try { return await fn(); } catch (e) { return fallback; } };   // a table missing on an old database just leaves its part empty
  for (const r of await quiet(async () => (await db.prepare(`SELECT key, count FROM counters WHERE period = ?1 LIMIT 400`).bind(epoch).all()).results, [])) counts[r.key] = r.count;
  // The demon most runs fell to this epoch (its "k:" counters are folded into one answer, not sent one by one).
  let deadliest = null;
  for (const key of Object.keys(counts)) if (key.startsWith("k:")) { if (!deadliest || counts[key] > deadliest.n) deadliest = { name: key.slice(2), n: counts[key] }; delete counts[key]; }
  // WHO IS HERE: one row a device (a random id, nothing personal), kept fresh by one ping a day while a run is alive.
  const since = epochStart(), dayAgo = Math.floor(Date.now() / 1000) - 86400;
  const here = { month: 0, today: 0, levels: [] };
  await quiet(async () => {
    here.month = (await db.prepare(`SELECT COUNT(*) AS n FROM present WHERE at > ?1`).bind(since).first()).n;
    for (const r of (await db.prepare(`SELECT level, COUNT(*) AS n FROM present WHERE at > ?1 GROUP BY level ORDER BY level LIMIT 30`).bind(dayAgo).all()).results) { here.levels.push({ level: r.level, n: r.n }); here.today += r.n; }
  });
  const names = await quiet(async () => (await db.prepare(`SELECT COUNT(DISTINCT name) AS n FROM scores WHERE ${NOT_BOT} AND made > ?1`).bind(since).first()).n, 0);
  for (const r of await quiet(async () => (await db.prepare(`SELECT side, count FROM faction_season WHERE epoch = ?1`).bind(epoch).all()).results, [])) if (r.side in tally) tally[r.side] = r.count;
  const last = await quiet(() => db.prepare(`SELECT MAX(made) AS made FROM scores`).first(), null);
  const top = await quiet(() => db.prepare(`SELECT floor FROM scores ORDER BY floor DESC, days DESC, made ASC LIMIT 1`).first(), null);
  const out = await quiet(() => db.prepare(`SELECT MAX(made) AS made FROM news WHERE type = 'out'`).first(), null);   // the latest climb out, for "Last climb out"
  // The latest events, with where and who (never the name). Since v0.90 they live in `news`; while that is still
  // filling, the older `events` rows (tag and number only) top the list up.
  const events = [];
  for (const r of await quiet(async () => (await db.prepare(`SELECT type AS t, v, made, x FROM news ORDER BY id DESC LIMIT 40`).all()).results, [])) {
    let x = {}; try { x = JSON.parse(r.x || "{}") || {}; } catch (e) {}
    delete x.n;
    events.push({ t: r.t, v: r.v, made: r.made, ...x });
  }
  if (events.length < 40) for (const r of await quiet(async () => (await db.prepare(`SELECT type AS t, v, made FROM events ORDER BY id DESC LIMIT ?1`).bind(40 - events.length).all()).results, [])) events.push(r);
  here.now = await liveNow(db);
  return { epoch, law: tally.LAW, chaos: tally.CHAOS, counts, lastFall: (last && last.made) || null, lastOut: (out && out.made) || null, deepest: (top && top.floor) || null, events, here, names, deadliest };
}
const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, x-admin-key, x-key", "access-control-max-age": "86400" });
const json = (data, status, origin) => new Response(JSON.stringify(data), { status: status || 200, headers: { "content-type": "application/json", ...cors() } });
const hash = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");

// BOTS: the scripted players' names end in "-bot". Their scores are stored and counted in every feed total (season, counters,
// deepest, last fall) but kept off the board and out of everyone's rank. A person who names themselves "...-bot" only hides themselves.
const NOT_BOT = `name NOT LIKE '%-bot'`;
async function rankOf(db, row) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE ${NOT_BOT} AND (floor > ?1 OR (floor = ?1 AND days > ?2) OR (floor = ?1 AND days = ?2 AND made < ?3))`)
    .bind(row.floor, row.days, row.made).first();
  return r.n + 1;
}

// THE GIFT BOX (v1.10): one small box per wing, level and day, holding one thing. GET /gift?k= looks inside;
// POST /gift {k, give} swaps (give what you leave, get what was there; give null just takes). k is "day:level:wing".
// The table makes itself the first time it is used, so there is nothing to run for it. Items are only names; the page
// accepts nothing but small (COMMON / UNCOMMON) things it knows, so a made-up name does nothing.
// The same key also holds the signal room's TALLIES: how many players opened each of the wing's two locked doors that day
// (POST /tally {k, door}); GET /gift sends them as marks, and the page shows the two counts without saying which door is which.
let giftReady = false;
const giftKeyOk = k => {
  const m = /^(\d{4,6}):(\d{1,2}):(\d{1,2})$/.exec(String(k || "")), today = Math.floor(Date.now() / 86400000);
  return !!m && Math.abs(Number(m[1]) - today) <= 2 && Number(m[2]) >= 1 && Number(m[2]) <= 60;
};
async function giftTable(db) {
  if (giftReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS gifts (k TEXT PRIMARY KEY, item TEXT NOT NULL, made INTEGER NOT NULL, who TEXT)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS tallies (k TEXT NOT NULL, door INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, made INTEGER NOT NULL, PRIMARY KEY (k, door))`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS tally_seen (k TEXT NOT NULL, who TEXT NOT NULL, PRIMARY KEY (k, who))`).run();
  giftReady = true;
}
async function tallyDoor(req, env, pageOk, from, allow) {
  if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
  if (req.method !== "POST") return json({ error: "not found" }, 404, allow);
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400, allow); }
  const k = String(b.k || ""), door = Number(b.door);
  if (!giftKeyOk(k) || (door !== 0 && door !== 1)) return json({ error: "invalid" }, 400, allow);
  try {
    const db = env.DB, now = Math.floor(Date.now() / 1000);
    await giftTable(db);
    const who = await hash((req.headers.get("cf-connecting-ip") || "?") + "daily-dungeon");
    const seen = await db.prepare(`INSERT OR IGNORE INTO tally_seen (k, who) VALUES (?1, ?2)`).bind(k, who).run();   // one mark per player (by address) per wing and day
    if (!(seen.meta && seen.meta.changes)) return json({ ok: true, counted: false }, 200, allow);
    await db.prepare(`INSERT INTO tallies (k, door, n, made) VALUES (?1, ?2, 1, ?3) ON CONFLICT (k, door) DO UPDATE SET n = n + 1, made = ?3`).bind(k, door, now).run();
    if (Math.random() < 0.02) {
      await db.prepare(`DELETE FROM tallies WHERE made < ?1`).bind(now - 3 * 86400).run();
      await db.prepare(`DELETE FROM tally_seen WHERE k NOT IN (SELECT k FROM tallies)`).run();
    }
    return json({ ok: true, counted: true }, 200, allow);
  } catch (e) {
    return json({ error: "tally" }, 500, allow);
  }
}
async function giftBox(req, env, pageOk, from, allow) {
  if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
  const db = env.DB, now = Math.floor(Date.now() / 1000), okKey = giftKeyOk;
  try {
    await giftTable(db);
    if (req.method === "GET") {
      const k = new URL(req.url).searchParams.get("k");
      if (!okKey(k)) return json({ error: "invalid" }, 400, allow);
      const row = await db.prepare(`SELECT item FROM gifts WHERE k = ?1`).bind(k).first();
      const marks = [0, 0];
      for (const r of (await db.prepare(`SELECT door, n FROM tallies WHERE k = ?1`).bind(k).all()).results) if (r.door === 0 || r.door === 1) marks[r.door] = r.n;
      return json({ item: row ? row.item : null, marks }, 200, allow);
    }
    if (req.method !== "POST") return json({ error: "not found" }, 404, allow);
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400, allow); }
    const k = String(b.k || ""), give = b.give === null || b.give === undefined ? null : String(b.give).trim();
    if (!okKey(k) || (give !== null && !/^[A-Za-z0-9 '.,\-]{3,40}$/.test(give))) return json({ error: "invalid" }, 400, allow);
    const who = await hash((req.headers.get("cf-connecting-ip") || "?") + "daily-dungeon");
    const recent = await db.prepare(`SELECT COUNT(*) AS n FROM gifts WHERE who = ?1 AND made > ?2`).bind(who, now - 3600).first();
    if (recent.n >= 12) return json({ error: "slow down" }, 429, allow);
    for (let tries = 0; tries < 4; tries++) {
      const row = await db.prepare(`SELECT item FROM gifts WHERE k = ?1`).bind(k).first();
      if (!row) {
        if (give === null) return json({ ok: true, got: null }, 200, allow);
        const ins = await db.prepare(`INSERT OR IGNORE INTO gifts (k, item, made, who) VALUES (?1, ?2, ?3, ?4)`).bind(k, give, now, who).run();
        if (ins.meta && ins.meta.changes) return json({ ok: true, got: null }, 200, allow);
        continue;
      }
      const moved = give === null
        ? await db.prepare(`DELETE FROM gifts WHERE k = ?1 AND item = ?2`).bind(k, row.item).run()
        : await db.prepare(`UPDATE gifts SET item = ?3, made = ?4, who = ?5 WHERE k = ?1 AND item = ?2`).bind(k, row.item, give, now, who).run();
      if (moved.meta && moved.meta.changes) {
        if (Math.random() < 0.02) await db.prepare(`DELETE FROM gifts WHERE made < ?1`).bind(now - 3 * 86400).run();
        return json({ ok: true, got: row.item }, 200, allow);
      }
    }
    return json({ error: "busy" }, 503, allow);
  } catch (e) {
    return json({ error: "box" }, 500, allow);
  }
}

const WORKER = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), allow = "*";
    // On the game's own address the Worker answers under /api/ (dungeon.88x31.app/api/score, /api/account):
    // the same routes as ever, with that prefix taken off. The old workers.dev address keeps working unchanged.
    if (url.pathname.startsWith("/api/")) url.pathname = url.pathname.slice(4);
    // ALLOW_ORIGIN: the pages allowed to post or delete, comma-separated (blank: any page). Everyone may read the board.
    const pages = String(env.ALLOW_ORIGIN || "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
    const from = req.headers.get("origin") || "", pageOk = !pages.length || pages.includes(from);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });   // a 204 must have no body, or the browser's preflight fails
    // PLAYER ACCOUNTS (v1.13): /account /codes /load /passkey /logout /save (accounts.js). Login is a bearer token the page keeps.
    const acct = await accountsRoute(req, env, url);
    if (acct) return acct;
    // (v1.20) THE RUN ON THE SERVER: /run and /act (game.js). Not used by the page yet.
    // (v1.22) The game's own follow-up calls (registry, tallies, events) go through these same routes, as the player.
    const inner = (path, data) => WORKER.fetch(new Request(new URL(path, req.url), { method: "POST", body: JSON.stringify(data),
      headers: { "content-type": "application/json", origin: req.headers.get("origin") || "", "cf-connecting-ip": req.headers.get("cf-connecting-ip") || "", authorization: req.headers.get("authorization") || "" } }), env, ctx);
    const game = await gameRoute(req, env, url, ctx, inner);
    if (game) return game;

    if (url.pathname === "/top" && req.method === "GET") {
      const n = Math.max(1, Math.min(50, Number(url.searchParams.get("n")) || 20)), run = url.searchParams.get("run") || "";
      const top = await env.DB.prepare(`SELECT rowid AS id, run, name, floor, days, demons, turns FROM scores WHERE ${NOT_BOT} ORDER BY floor DESC, days DESC, made ASC LIMIT ?1`).bind(n).all();
      const rows = top.results.map(r => ({ id: r.id, name: r.name, floor: r.floor, days: r.days, demons: r.demons, turns: r.turns, you: r.run === run }));
      let you = null;
      if (run && !rows.some(r => r.you)) {
        const mine = await env.DB.prepare(`SELECT name, floor, days, demons, turns, made FROM scores WHERE run = ?1`).bind(run).first();
        if (mine) you = { name: mine.name, floor: mine.floor, days: mine.days, demons: mine.demons, turns: mine.turns, rank: await rankOf(env.DB, mine) };
      }
      return json({ rows, you }, 200, allow);
    }

    // Current lunar epoch's faction tally, for the title screen's LEAN bar. Rows may not exist yet
    // (no LAW/CHAOS/NEUTRAL run posted this epoch) -- 0/0 is a legitimate, tied answer, not an error.
    if (url.pathname === "/season" && req.method === "GET") {
      const epoch = epochIndex();
      const rows = await env.DB.prepare(`SELECT side, count FROM faction_season WHERE epoch = ?1`).bind(epoch).all();
      const tally = { LAW: 0, CHAOS: 0 };
      for (const r of rows.results) if (r.side in tally) tally[r.side] = r.count;
      return json({ epoch, law: tally.LAW, chaos: tally.CHAOS }, 200, allow);
    }

    // This epoch's running totals, for the title screen's cards. One small indexed read; an empty epoch is just {}.
    if (url.pathname === "/stats" && req.method === "GET") {
      const epoch = epochIndex(), counts = {};
      const rows = await env.DB.prepare(`SELECT key, count FROM counters WHERE period = ?1 LIMIT 40`).bind(epoch).all();
      for (const r of rows.results) counts[r.key] = r.count;
      const last = await env.DB.prepare(`SELECT MAX(made) AS made FROM scores`).first();
      return json({ epoch, counts, lastFall: (last && last.made) || null }, 200, allow);
    }

    // One read for the whole title screen: season, totals, deepest floor, and the latest ambient events.
    if (url.pathname === "/feed" && req.method === "GET") return json(await titleFeed(env.DB), 200, allow);

    // "Someone is here": { id: a random id the game made, level }. One row a device, overwritten; `at` is when it was
    // last seen. Built to take a ping every few minutes (live presence) without costing much of D1's free tier:
    //   - a known id costs one row read, and is only written when the level changed or the row is 2+ minutes old,
    //     so a page that pings too often writes nothing extra;
    //   - only a new id pays for the rate limit (a sender may keep at most 40 ids fresh in a day; the bots share
    //     one sender) and for clearing out rows unseen for 60 days.
    // The bots' ids start "bot" (a page's id is hex, so it never can); the live count leaves them out.
    if (url.pathname === "/here" && req.method === "POST") {
      if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
      let b; try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400, allow); }
      const id = String(b.id || ""), level = Number(b.level);
      if (!/^[a-z0-9]{12,40}$/.test(id) || !Number.isInteger(level) || level < 1 || level > 60) return json({ error: "invalid" }, 400, allow);
      const now = Math.floor(Date.now() / 1000);
      const row = await env.DB.prepare(`SELECT level, at FROM present WHERE id = ?1`).bind(id).first();
      if (row) {
        if (row.level !== level || now - row.at >= PRESENCE_WRITE_GAP)
          await env.DB.prepare(`UPDATE present SET level = ?2, at = ?3 WHERE id = ?1`).bind(id, level, now).run();
        return json({ ok: true, now: await liveNow(env.DB) }, 200, allow);
      }
      const who = await hash((req.headers.get("cf-connecting-ip") || "?") + "daily-dungeon");
      const mine = await env.DB.prepare(`SELECT COUNT(*) AS n FROM present WHERE who = ?1 AND at > ?2`).bind(who, now - 86400).first();
      if (mine.n >= 40) return json({ error: "slow down" }, 429, allow);
      await env.DB.prepare(`INSERT INTO present (id, level, at, who) VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT (id) DO UPDATE SET level = ?2, at = ?3, who = ?4`).bind(id, level, now, who).run();
      await env.DB.prepare(`DELETE FROM present WHERE at < ?1`).bind(now - 60 * 86400).run();
      return json({ ok: true, now: await liveNow(env.DB) }, 200, allow);
    }

    // An ambient event: a tag (and maybe a small number). Thirty an hour per sender is plenty for real play.
    if (url.pathname === "/event" && req.method === "POST") {
      if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
      let b; try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400, allow); }
      const t = String(b.t || ""), v = b.v === undefined || b.v === null ? null : Number(b.v);
      if (!EVENT_TAGS.includes(t) || (v !== null && (!Number.isInteger(v) || v < 0 || v > 199))) return json({ error: "invalid" }, 400, allow);
      // WHERE AND WHO, in a few small fields. Each is checked against a fixed shape and dropped if it doesn't fit;
      // a bad one never fails the event. The name is kept for later and is never sent back out by /feed.
      const x = {}, int = (k, lo, hi) => { const n = Number(b[k]); if (Number.isInteger(n) && n >= lo && n <= hi) x[k] = n; };
      int("lv", 1, 60); int("d", 1, 9); int("p", 0, 4); int("c", 1, 60); int("m", 0, 7);
      if (EVENT_KINDS.includes(b.k)) x.k = b.k;
      if (["L", "N", "C"].includes(b.a)) x.a = b.a;
      if (/^[A-Z][A-Z0-9 .\-]{1,19}$/.test(String(b.dm || ""))) x.dm = String(b.dm);
      const name = String(b.n || "").trim(), words = String(env.BLOCKLIST || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
      if (/^[A-Za-z0-9 _.\-]{3,10}$/.test(name) && !words.some(q => name.toLowerCase().includes(q))) x.n = name;
      const who = await hash((req.headers.get("cf-connecting-ip") || "?") + "daily-dungeon"), now = Math.floor(Date.now() / 1000);
      const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM news WHERE who = ?1 AND made > ?2`).bind(who, now - 3600).first();
      if (recent.n >= 30) return json({ error: "slow down" }, 429, allow);
      await env.DB.prepare(`INSERT INTO news (type, v, made, who, x) VALUES (?1, ?2, ?3, ?4, ?5)`).bind(t, v, now, who, JSON.stringify(x)).run();
      // Keep the newest 20 of this tag. Rows from the last hour stay regardless, so the rate limit above can count them.
      await env.DB.prepare(`DELETE FROM news WHERE type = ?1 AND made <= ?2 AND id NOT IN (SELECT id FROM news WHERE type = ?1 ORDER BY id DESC LIMIT 20)`).bind(t, now - 3600).run();
      return json({ ok: true }, 200, allow);
    }

    // ADMIN CHECK: lets the game ask "is this the admin key?" without changing anything (the X testing menu asks it
    // before it unlocks). 200 {ok} or 403. The key is the same Worker secret ADMIN_KEY; use a long one.
    if (url.pathname === "/admin" && req.method === "GET") {
      if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
      if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "forbidden" }, 403, allow);
      return json({ ok: true }, 200, allow);
    }

    // ADMIN PRESENCE (v1.01.1): every device seen this moon, newest first, for the game's X-mode board. The admin key
    // only. A row is a short piece of its random id, its level, how long ago it was seen, and whether it's a bot;
    // never the sender's hash. Plus the counts: right now (no bots), the last day, and this moon.
    if (url.pathname === "/admin/here" && req.method === "GET") {
      if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
      if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "forbidden" }, 403, allow);
      const now = Math.floor(Date.now() / 1000), since = epochStart();
      const rows = (await env.DB.prepare(`SELECT id, level, at FROM present WHERE at > ?1 ORDER BY at DESC LIMIT 60`).bind(since).all()).results;
      const count = async (where, ...args) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM present WHERE ${where}`).bind(...args).first()).n;
      return json({
        now: await count(`at > ?1 AND id NOT LIKE 'bot%'`, now - LIVE_WINDOW), today: await count(`at > ?1`, now - 86400), month: await count(`at > ?1`, since),
        rows: rows.map(r => ({ id: r.id.startsWith("bot") ? r.id.slice(3, 9) : r.id.slice(0, 6), bot: r.id.startsWith("bot"), level: r.level, ago: now - r.at })),
      }, 200, allow);
    }

    // Removing an entry takes the admin key (a Worker secret: `npx wrangler secret put ADMIN_KEY`).
    if (url.pathname === "/score" && req.method === "DELETE") {
      if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
      if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "forbidden" }, 403, allow);
      const id = Number(url.searchParams.get("id"));
      if (!Number.isInteger(id)) return json({ error: "invalid" }, 400, allow);
      const r = await env.DB.prepare(`DELETE FROM scores WHERE rowid = ?1`).bind(id).run();
      return json({ ok: true, removed: (r.meta && r.meta.changes) || 0 }, 200, allow);
    }

    if (url.pathname === "/score" && req.method === "POST") {
      if (!pageOk) return json({ error: "origin", seen: from }, 403, allow);
      let b; try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400, allow); }
      const name = String(b.name || "").trim().replace(/\s+/g, " "), run = String(b.run || "");
      const floor = Number(b.floor), days = Number(b.days), demons = Number(b.demons), turns = Number(b.turns);
      const bad = !/^[A-Za-z0-9 _.\-]{3,10}$/.test(name) || !/^[a-z0-9]{8,40}$/.test(run)
        || ![floor, days, demons, turns].every(Number.isInteger) || floor < 1 || floor > MAX.floor || days < 1 || days > MAX.days
        || demons < 0 || demons > days * 40 || turns < 0 || turns > days * 5000 || floor > days;           // a floor needs at least a day
      if (bad) return json({ error: "invalid" }, 400, allow);
      const words = String(env.BLOCKLIST || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
      if (words.some(w => name.toLowerCase().includes(w))) return json({ error: "name" }, 400, allow);
      const who = await hash((req.headers.get("cf-connecting-ip") || "?") + "daily-dungeon"), now = Math.floor(Date.now() / 1000);
      const recent = await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE who = ?1 AND made > ?2`).bind(who, now - 3600).first();
      if (recent.n >= 5) return json({ error: "slow down" }, 429, allow);
      const ins = await env.DB.prepare(`INSERT OR IGNORE INTO scores (run, name, floor, days, demons, turns, version, made, who) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
        .bind(run, name, floor, days, demons, turns, String(b.version || "").slice(0, 12), now, who).run();
      // Faction seasons: only on a genuinely new row -- a retried post of the same run (same PRIMARY
      // KEY, INSERT OR IGNORE no-ops) must never double up a season point. An unrecognized/missing
      // align just skips the season tally; it doesn't invalidate the run itself.
      const alignIn = String(b.align || "").toUpperCase(), align = [...SIDES, "NEUTRAL"].includes(alignIn) ? alignIn : null;
      // The season and the running totals are flavor: if either can't be written (a table missing on an old
      // database, say), the score itself must still stand.
      if (ins.meta && ins.meta.changes) {
        if (align) try { await tallyFaction(env.DB, align, floor); } catch (e) {}
        try { await tallyStats(env.DB, b, turns, who); } catch (e) {}
      }
      // A post from a logged-in player is remembered as theirs (the board itself stays as anonymous as it was).
      try { const me = await playerOf(env, req); if (me) await env.DB.prepare(`INSERT OR IGNORE INTO score_players (run, player_id) VALUES (?1, ?2)`).bind(run, me.id).run(); } catch (e) {}
      const row = await env.DB.prepare(`SELECT name, floor, days, demons, turns, made FROM scores WHERE run = ?1`).bind(run).first();
      return json({ ok: true, rank: await rankOf(env.DB, row) }, 200, allow);
    }
    // THE GIFT BOX (v1.10): /gift (see giftBox() above).
    if (url.pathname === "/gift") return giftBox(req, env, pageOk, from, allow);
    if (url.pathname === "/tally") return tallyDoor(req, env, pageOk, from, allow);
    return json({ error: "not found" }, 404, allow);
  },
};
export default WORKER;
