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
const EVENT_TAGS = ["out", "refused", "asked", "restored", "trickster", "altar", "joined", "silent", "deep", "left", "fall", "words", "traded", "parted", "moonpick"];
async function titleFeed(db, botsLive) {
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
  const market = await quiet(() => marketFeed(db, botsLive), { open: [], traded: [], count: 0 });
  return { market, epoch, law: tally.LAW, chaos: tally.CHAOS, counts, lastFall: (last && last.made) || null, lastOut: (out && out.made) || null, deepest: (top && top.floor) || null, events, here, names, deadliest };
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

// ============================================================================================================
// THE EXCHANGE (v1.00): the player economy. Only RARE, MYTHIC and MOON things are tradeable; silver isn't.
//
// WHO: a long secret key the page keeps (and every run's password carries), sent as the x-key header. The Worker
// keeps only its SHA-256 (the owner id), never the key. A key starting "bot" is a bot's: bots' offers are seen and
// taken only with the admin key (x-admin-key), and bots never see or take anyone else's.
//
// WHAT COUNTS: a thing only exists here if the Worker witnessed its find as it happened (POST /eco/find), within
// limits it keeps itself: so many finds a day per key and per sender, and MOON things only while the moon is near
// full. The page's save can be edited all it likes; nothing in it reaches this ledger.
//
// WHERE A THING IS (state):
//   bag    - in a living run's bag (RARE, MYTHIC). Dies with the run.
//   stash  - a MOON thing kept by the key, across runs. A MOON find goes straight here.
//   escrow - held by an open offer.
//   gone   - taken out of the economy: a MOON thing moved from the stash into a run (a one-way door), or a bag
//            thing the page says is no longer in the bag.
//   dead   - its run ended.
// A key has one run at a time. A request from a new run retires the old one (its bag things die, its offers end,
// a MOON thing in an offer goes back to the stash); a retired run can't come back.
//
// OFFERS: one thing, asking for nothing (a gift), any thing of a tier, or one named thing. A short code
// (ABC-DEF2). Public offers show in the market and the title's feed; private ones only by code. At most 3 open
// per key. Every offer closes, strictly, when the moon's quarter ends; the thing goes back to its owner (to the
// stash for MOON, to the run's bag if that run still lives, else it dies with the run).
// MOON CAP: a run may take in one MOON thing per quarter from outside (bought, or from the stash when someone else
// found it). Finding is never capped by it.
//
//   POST /eco/find      {run, name}                 -> {ok, id, name, stash} | {ok:false, why}   (name: the Worker's pick)
//   POST /eco/mine      {run, bag:[names]}          -> {stash, bag, offers, fresh, moonCap, quarterEnd}
//   GET  /eco/market                                -> {offers:[{code, name, tier, wants, bot?}]}
//   GET  /eco/peek?code=                            -> {offer} | {gone: why}
//   POST /eco/offer     {run, item, wants, public}  -> {code}
//   POST /eco/cancel    {run, code}                 -> {ok, back}
//   POST /eco/take      {run, code, pay}            -> {ok, got, stash}
//   POST /eco/withdraw  {run, item}                 -> {ok, name}
//   POST /eco/end       {run}                       -> {ok}     (the run is over: retire it now)
// ============================================================================================================
const ECO_CATALOG = {
  RARE: ["a rune scratched into a circuit board", "a salt-crusted network cable", "a candle stub in a soda can", "a charm bracelet of old keycards",
    "a rosary of fiber optic beads", "a sealed jar, humming faintly", "a SIM card in red thread", "a graffiti-stained saint's medal",
    "a bullet casing on a leather cord", "a keycard, one corner burned", "an old COMP chip", "a black pearl"],
  MYTHIC: ["a jar of grave salt", "a wax seal, unbroken", "a chipped bone die", "a sealed reliquary", "a ring of red gold", "a sword in a rotted sheath"],
  MOON: ["a moonstone", "a shard of pale moonlight", "a fang still warm", "a silver-veined horn"],
};
const ECO_TIER = {}; for (const t in ECO_CATALOG) for (const n of ECO_CATALOG[t]) ECO_TIER[n] = t;
// Finds a day (UTC): per key, and per sender across every key it uses (so a pile of fresh keys doesn't multiply them).
// v1.01: tighter, and MOON finds also have a cap for the whole lunar month.
const ECO_DAILY = { RARE: 3, MYTHIC: 2, MOON: 1 }, ECO_DAILY_SENDER = { RARE: 6, MYTHIC: 3, MOON: 2 };
const ECO_MOON_MONTH = 2, ECO_MOON_MONTH_SENDER = 3;
const ECO_NEW_KEYS_A_DAY = 5, ECO_OPEN_OFFERS = 3;
// The moon's quarters and phases: the same math as screen.js (quarterOf, moonIndex).
const ECO_QLEN = EPOCH_SYN / 4 * 86400000;
const ecoQuarter = (t = Date.now()) => Math.floor((t - EPOCH_REF) / ECO_QLEN);
const ecoQuarterEnd = q => Math.floor((EPOCH_REF + (q + 1) * ECO_QLEN) / 1000);
const ecoMoonIndex = (t = Date.now()) => { let age = ((t - EPOCH_REF) / 86400000) % EPOCH_SYN; if (age < 0) age += EPOCH_SYN; return Math.floor(age / EPOCH_SYN * 8 + 0.5) % 8; };
const ECO_MOON_PHASES = [3, 4, 5];       // MOON things only drop from waxing gibbous to waning gibbous (rules.js)
const fullHash = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const ECO_CODE_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ecoCode = () => { const r = crypto.getRandomValues(new Uint8Array(6)); const c = [...r].map(b => ECO_CODE_ABC[b % ECO_CODE_ABC.length]).join(""); return c.slice(0, 3) + "-" + c.slice(3); };
const ecoNorm = c => { const x = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return x.slice(0, 3) + "-" + x.slice(3, 6); };
const ecoWantsOk = w => w === "" || /^tier:(RARE|MYTHIC|MOON)$/.test(w) || (w.startsWith("name:") && !!ECO_TIER[w.slice(5)]);
const ecoMatches = (w, it) => w === "" || (w.startsWith("tier:") && it.tier === w.slice(5)) || (w.startsWith("name:") && it.name === w.slice(5));

// Retire a run: its bag things die, its open offers end (a MOON thing in one goes back to the stash).
async function ecoRetire(db, owner, run) {
  if (!run) return;
  const now = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO eco_retired (run, at) VALUES (?1, ?2)`).bind(run, now),
    db.prepare(`UPDATE eco_items SET state = 'stash', run = NULL WHERE owner = ?1 AND state = 'escrow' AND tier = 'MOON' AND id IN (SELECT item FROM eco_offers WHERE owner = ?1 AND run = ?2 AND state = 'open')`).bind(owner, run),
    db.prepare(`UPDATE eco_items SET state = 'dead' WHERE owner = ?1 AND run = ?2 AND state IN ('bag', 'escrow')`).bind(owner, run),
    db.prepare(`UPDATE eco_offers SET state = 'dead', done = ?3 WHERE owner = ?1 AND run = ?2 AND state = 'open'`).bind(owner, run, now),
  ]);
}
// Offers past their quarter: closed, and the thing goes back (stash for MOON; the run's bag if the run lives, as
// a delivery the page picks up; otherwise it dies with the run).
async function ecoSettle(db, owner, liveRun) {
  const q = ecoQuarter(), now = Math.floor(Date.now() / 1000);
  const old = (await db.prepare(`SELECT o.id, o.run, i.id AS item, i.tier FROM eco_offers o JOIN eco_items i ON i.id = o.item WHERE o.owner = ?1 AND o.state = 'open' AND o.quarter < ?2 LIMIT 20`).bind(owner, q).all()).results;
  if (!old.length) return;
  const ops = [];
  for (const o of old) {
    ops.push(db.prepare(`UPDATE eco_offers SET state = 'closed', done = ?2 WHERE id = ?1 AND state = 'open'`).bind(o.id, now));
    if (o.tier === "MOON") ops.push(db.prepare(`UPDATE eco_items SET state = 'stash', run = NULL WHERE id = ?1 AND state = 'escrow'`).bind(o.item));
    else if (o.run && o.run === liveRun) ops.push(db.prepare(`UPDATE eco_items SET state = 'bag', fresh = 1 WHERE id = ?1 AND state = 'escrow'`).bind(o.item));
    else ops.push(db.prepare(`UPDATE eco_items SET state = 'dead' WHERE id = ?1 AND state = 'escrow'`).bind(o.item));
  }
  await db.batch(ops);
}
async function economy(req, env, url, pageOk, from) {
  const db = env.DB, path = url.pathname.slice(5), now = Math.floor(Date.now() / 1000), q = ecoQuarter();
  const admin = !!env.ADMIN_KEY && req.headers.get("x-admin-key") === env.ADMIN_KEY;
  // BOTS_PUBLIC = "1" (wrangler.toml): the bots trade in the live market, with players, like anyone (it's all
  // anonymous). Anything else: bots trade only with bots, and only the admin sees their offers.
  const botsLive = String(env.BOTS_PUBLIC || "") === "1";
  if (!pageOk) return json({ error: "origin", seen: from }, 403);
  // The market and a code's offer can be read by anyone (no key needed). Bot offers only with the admin key.
  const offerOut = o => ({ code: o.code, name: o.name, tier: o.tier, wants: o.wants, ...(o.bot ? { bot: true } : {}) });
  if (path === "market" && req.method === "GET") {
    // With the bots live, everyone sees everyone's. Otherwise players see players', the admin everyone's, a bot only bots'.
    const asBot = (req.headers.get("x-key") || "").startsWith("bot");
    const rows = (await db.prepare(`SELECT o.code, o.wants, o.bot, i.name, i.tier FROM eco_offers o JOIN eco_items i ON i.id = o.item
      WHERE o.state = 'open' AND o.quarter = ?1 AND o.public = 1 ${botsLive ? "" : asBot ? "AND o.bot = 1" : admin ? "" : "AND o.bot = 0"} ORDER BY o.id DESC LIMIT 40`).bind(q).all()).results;
    return json({ offers: rows.map(offerOut), quarterEnd: ecoQuarterEnd(q) });
  }
  if (path === "peek" && req.method === "GET") {
    const o = await db.prepare(`SELECT o.code, o.wants, o.bot, o.state, o.quarter, i.name, i.tier FROM eco_offers o JOIN eco_items i ON i.id = o.item WHERE o.code = ?1`).bind(ecoNorm(url.searchParams.get("code"))).first();
    if (!o || (o.bot && !admin && !botsLive)) return json({ gone: "No offer has that code." });
    if (o.state === "taken") return json({ gone: "Someone already took it." });
    if (o.state === "dead") return json({ gone: "The run that made it has ended. The offer went with it." });
    if (o.state !== "open" || o.quarter < q) return json({ gone: "That offer closed when the quarter ended." });
    return json({ offer: offerOut(o) });
  }
  // Everything else needs the key, and the run it comes from.
  const key = req.headers.get("x-key") || "";
  if (!/^[a-z0-9]{32,80}$/.test(key)) return json({ error: "key" }, 400);
  let b = {}; if (req.method === "POST") { try { b = await req.json(); } catch (e) { return json({ error: "json" }, 400); } }
  const run = String(b.run || "");
  if (!/^[a-z0-9]{8,40}$/.test(run)) return json({ error: "run" }, 400);
  const owner = await fullHash(key + ":daily-dungeon-exchange"), bot = key.startsWith("bot") ? 1 : 0;
  const who = await hash((req.headers.get("cf-connecting-ip") || "?") + "daily-dungeon");
  let me = await db.prepare(`SELECT owner, run, bot, moon_q FROM eco_owners WHERE owner = ?1`).bind(owner).first();
  if (await db.prepare(`SELECT run FROM eco_retired WHERE run = ?1`).bind(run).first()) return json({ error: "ended", why: "This run has ended. The exchange only deals with a living run." }, 409);
  if (!me) {
    if (!bot) {
      const fresh = await db.prepare(`SELECT COUNT(*) AS n FROM eco_owners WHERE who = ?1 AND made > ?2`).bind(who, now - 86400).first();
      if (fresh.n >= ECO_NEW_KEYS_A_DAY) return json({ error: "slow down" }, 429);
    }
    await db.prepare(`INSERT OR IGNORE INTO eco_owners (owner, run, bot, made, who) VALUES (?1, ?2, ?3, ?4, ?5)`).bind(owner, run, bot, now, who).run();
    me = { owner, run, bot, moon_q: null };
  } else if (me.run !== run) {
    await ecoRetire(db, owner, me.run);
    await db.prepare(`UPDATE eco_owners SET run = ?2 WHERE owner = ?1`).bind(owner, run).run();
    me.run = run;
  }
  if (path === "end" && req.method === "POST") { await ecoRetire(db, owner, run); return json({ ok: true }); }
  await ecoSettle(db, owner, run);

  // A FIND, witnessed as it happens. The page says what it found; the Worker keeps the limits, and (v1.01) rolls its
  // own dice for WHICH thing of that tier it is, so nobody can ask for a particular one. The page renames its copy.
  if (path === "find" && req.method === "POST") {
    const claimed = String(b.name || ""), tier = ECO_TIER[claimed];
    if (!tier) return json({ ok: false, why: "not tradeable" });
    const pool = ECO_CATALOG[tier], name = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];
    if (tier === "MOON" && !ECO_MOON_PHASES.includes(ecoMoonIndex())) return json({ ok: false, why: "moon" });
    const day = now - (now % 86400);
    const mine = await db.prepare(`SELECT COUNT(*) AS n FROM eco_items WHERE finder = ?1 AND tier = ?2 AND made >= ?3`).bind(owner, tier, day).first();
    if (mine.n >= ECO_DAILY[tier]) return json({ ok: false, why: "enough today" });
    if (!bot) {
      const sender = await db.prepare(`SELECT COUNT(*) AS n FROM eco_items WHERE who = ?1 AND tier = ?2 AND made >= ?3`).bind(who, tier, day).first();
      if (sender.n >= ECO_DAILY_SENDER[tier]) return json({ ok: false, why: "enough today" });
    }
    if (tier === "MOON") {
      const month = epochStart();
      const kept = await db.prepare(`SELECT COUNT(*) AS n FROM eco_items WHERE finder = ?1 AND tier = 'MOON' AND made >= ?2`).bind(owner, month).first();
      if (kept.n >= ECO_MOON_MONTH) return json({ ok: false, why: "enough this moon" });
      if (!bot) {
        const sent = await db.prepare(`SELECT COUNT(*) AS n FROM eco_items WHERE who = ?1 AND tier = 'MOON' AND made >= ?2`).bind(who, month).first();
        if (sent.n >= ECO_MOON_MONTH_SENDER) return json({ ok: false, why: "enough this moon" });
      }
    }
    const stash = tier === "MOON";
    const r = await db.prepare(`INSERT INTO eco_items (owner, run, name, tier, state, finder, who, made) VALUES (?1, ?2, ?3, ?4, ?5, ?1, ?6, ?7)`)
      .bind(owner, stash ? null : run, name, tier, stash ? "stash" : "bag", who, now).run();
    // Now and then, clear out things long gone (kept a while so the day's limits can count them).
    if (Math.random() < 0.02) await db.prepare(`DELETE FROM eco_items WHERE state IN ('gone', 'dead') AND made < ?1`).bind(now - 60 * 86400).run();
    return json({ ok: true, id: r.meta.last_row_id, name, stash });
  }

  // WHAT'S MINE: the stash, this run's tradeable bag things, my open offers, things delivered to this run since
  // last time (a swap paid to me, an offer that came back), and whether the quarter's MOON intake is used.
  // The page sends its bag's names: a bag thing the bag no longer holds (given away, broken) leaves the economy.
  if (path === "mine" && req.method === "POST") {
    const bag = Array.isArray(b.bag) ? b.bag.map(String).slice(0, 200) : null;
    let rows = (await db.prepare(`SELECT id, name, tier, state, fresh FROM eco_items WHERE owner = ?1 AND (state = 'stash' OR (run = ?2 AND state = 'bag')) ORDER BY id LIMIT 200`).bind(owner, run).all()).results;
    const fresh = rows.filter(r => r.state === "bag" && r.fresh);
    if (fresh.length) await db.prepare(`UPDATE eco_items SET fresh = 0 WHERE owner = ?1 AND run = ?2 AND fresh = 1`).bind(owner, run).run();
    if (bag) {
      const count = {}; for (const n of bag) count[n] = (count[n] || 0) + 1;
      const lost = [];
      for (const r of rows) if (r.state === "bag" && !r.fresh) { if (count[r.name] > 0) count[r.name]--; else lost.push(r.id); }
      if (lost.length) {
        await db.prepare(`UPDATE eco_items SET state = 'gone' WHERE owner = ?1 AND state = 'bag' AND id IN (${lost.map(() => "?").join(",")})`).bind(owner, ...lost).run();
        rows = rows.filter(r => !lost.includes(r.id));
      }
    }
    const offers = (await db.prepare(`SELECT o.code, o.wants, o.public, i.name, i.tier FROM eco_offers o JOIN eco_items i ON i.id = o.item WHERE o.owner = ?1 AND o.state = 'open' AND o.quarter = ?2 ORDER BY o.id`).bind(owner, q).all()).results;
    // What happened to my offers lately (taken, and by what), so the page can say so once.
    const news = (await db.prepare(`SELECT o.code, i.name, p.name AS paid FROM eco_offers o JOIN eco_items i ON i.id = o.item LEFT JOIN eco_items p ON p.id = o.paid WHERE o.owner = ?1 AND o.state = 'taken' AND o.done > ?2 ORDER BY o.id DESC LIMIT 10`).bind(owner, Number(b.since) || 0).all()).results;
    return json({ stash: rows.filter(r => r.state === "stash").map(r => ({ id: r.id, name: r.name })), bag: rows.filter(r => r.state === "bag").map(r => ({ id: r.id, name: r.name, tier: r.tier })),
      fresh: fresh.map(r => ({ id: r.id, name: r.name })), offers: offers.map(o => ({ code: o.code, name: o.name, tier: o.tier, wants: o.wants, public: !!o.public })),
      news, now, moonCap: me.moon_q === q, quarterEnd: ecoQuarterEnd(q) });
  }

  // MAKE AN OFFER: one of my bag things (this run) or a stash thing goes into escrow.
  if (path === "offer" && req.method === "POST") {
    const id = Number(b.item), wants = String(b.wants || ""), pub = b.public ? 1 : 0;
    if (!Number.isInteger(id) || !ecoWantsOk(wants)) return json({ error: "invalid" }, 400);
    const open = await db.prepare(`SELECT COUNT(*) AS n FROM eco_offers WHERE owner = ?1 AND state = 'open' AND quarter = ?2`).bind(owner, q).first();
    if (open.n >= ECO_OPEN_OFFERS) return json({ error: "full", why: `At most ${ECO_OPEN_OFFERS} offers at once.` }, 409);
    const moved = await db.prepare(`UPDATE eco_items SET state = 'escrow' WHERE id = ?1 AND owner = ?2 AND (state = 'stash' OR (state = 'bag' AND run = ?3))`).bind(id, owner, run).run();
    if (!moved.meta.changes) return json({ error: "not yours", why: "That isn't yours to offer." }, 409);
    for (let tries = 0; tries < 5; tries++) {
      const code = ecoCode();
      try {
        await db.prepare(`INSERT INTO eco_offers (code, owner, run, item, wants, public, bot, quarter, made, state) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'open')`).bind(code, owner, run, id, wants, pub, bot, q, now).run();
        return json({ ok: true, code, quarterEnd: ecoQuarterEnd(q) });
      } catch (e) { /* a code already in use: try another */ }
    }
    await db.prepare(`UPDATE eco_items SET state = (CASE WHEN tier = 'MOON' THEN 'stash' ELSE 'bag' END) WHERE id = ?1 AND state = 'escrow'`).bind(id).run();
    return json({ error: "busy" }, 503);
  }

  // CANCEL: the thing comes back (MOON to the stash, the rest to this run's bag).
  if (path === "cancel" && req.method === "POST") {
    const o = await db.prepare(`SELECT o.id, o.item, i.name, i.tier FROM eco_offers o JOIN eco_items i ON i.id = o.item WHERE o.code = ?1 AND o.owner = ?2 AND o.state = 'open'`).bind(ecoNorm(b.code), owner).first();
    if (!o) return json({ error: "gone", why: "That offer isn't open." }, 409);
    const c = await db.prepare(`UPDATE eco_offers SET state = 'cancelled', done = ?2 WHERE id = ?1 AND state = 'open'`).bind(o.id, now).run();
    if (!c.meta.changes) return json({ error: "gone", why: "That offer isn't open." }, 409);
    const stash = o.tier === "MOON";
    await db.prepare(`UPDATE eco_items SET state = ?2, run = ?3, fresh = 0 WHERE id = ?1`).bind(o.item, stash ? "stash" : "bag", stash ? null : run).run();
    return json({ ok: true, back: { id: o.item, name: o.name, stash } });
  }

  // TAKE AN OFFER: pay with a matching thing if it asks for one. What I get: MOON to my stash, the rest into this
  // run's bag (returned here, so the page adds it). What I paid goes to the offer's maker the same way (to their
  // run's bag as a delivery, or their stash).
  if (path === "take" && req.method === "POST") {
    const code = ecoNorm(b.code);
    const o = await db.prepare(`SELECT o.*, i.name, i.tier FROM eco_offers o JOIN eco_items i ON i.id = o.item WHERE o.code = ?1`).bind(code).first();
    if (!o || o.state !== "open" || o.quarter !== q || (!botsLive && ((o.bot && !admin) || (bot && !o.bot)))) return json({ error: "gone", why: "That offer isn't open." }, 409);
    if (o.owner === owner) return json({ error: "own", why: "That's your own offer." }, 409);
    let pay = null;
    if (o.wants) {
      pay = await db.prepare(`SELECT id, name, tier FROM eco_items WHERE id = ?1 AND owner = ?2 AND (state = 'stash' OR (state = 'bag' AND run = ?3))`).bind(Number(b.pay), owner, run).first();
      if (!pay || !ecoMatches(o.wants, pay)) return json({ error: "pay", why: "It asks for something else." }, 409);
    }
    const t = await db.prepare(`UPDATE eco_offers SET state = 'taken', taker = ?2, paid = ?3, done = ?4 WHERE id = ?1 AND state = 'open'`).bind(o.id, owner, pay ? pay.id : null, now).run();
    if (!t.meta.changes) return json({ error: "gone", why: "Someone took it first." }, 409);
    const gotStash = o.tier === "MOON", ops = [
      db.prepare(`UPDATE eco_items SET owner = ?2, state = ?3, run = ?4, fresh = 0 WHERE id = ?1`).bind(o.item, owner, gotStash ? "stash" : "bag", gotStash ? null : run),
    ];
    if (pay) {
      const toStash = pay.tier === "MOON";
      ops.push(db.prepare(`UPDATE eco_items SET owner = ?2, state = ?3, run = ?4, fresh = ?5 WHERE id = ?1`).bind(pay.id, o.owner, toStash ? "stash" : "bag", toStash ? null : o.run, toStash ? 0 : 1));
    }
    await db.batch(ops);
    return json({ ok: true, got: { id: o.item, name: o.name, tier: o.tier }, stash: gotStash, paid: pay ? pay.name : null });
  }

  // TAKE A MOON THING INTO THE RUN: it leaves the economy for good. One a quarter, unless I found it myself.
  if (path === "withdraw" && req.method === "POST") {
    const it = await db.prepare(`SELECT id, name, finder FROM eco_items WHERE id = ?1 AND owner = ?2 AND state = 'stash'`).bind(Number(b.item), owner).first();
    if (!it) return json({ error: "gone", why: "That isn't in your stash." }, 409);
    const capped = it.finder !== owner;
    if (capped && me.moon_q === q) return json({ error: "cap", why: "One MOON thing from outside a quarter. This quarter's is used." }, 409);
    const ops = [db.prepare(`UPDATE eco_items SET state = 'gone', run = ?2 WHERE id = ?1 AND state = 'stash'`).bind(it.id, run)];
    if (capped) ops.push(db.prepare(`UPDATE eco_owners SET moon_q = ?2 WHERE owner = ?1`).bind(owner, q));
    await db.batch(ops);
    return json({ ok: true, name: it.name, capped });
  }
  return json({ error: "not found" }, 404);
}
// The title feed's market cards: the newest public offers and the latest trades, nobody named, no bots.
async function marketFeed(db, botsLive) {
  const q = ecoQuarter(), nb = botsLive ? "" : "AND o.bot = 0";
  const open = (await db.prepare(`SELECT o.code, o.wants, i.name FROM eco_offers o JOIN eco_items i ON i.id = o.item WHERE o.state = 'open' AND o.quarter = ?1 AND o.public = 1 ${nb} ORDER BY o.id DESC LIMIT 3`).bind(q).all()).results;
  const traded = (await db.prepare(`SELECT i.name, p.name AS paid FROM eco_offers o JOIN eco_items i ON i.id = o.item LEFT JOIN eco_items p ON p.id = o.paid WHERE o.state = 'taken' AND o.public = 1 ${nb} AND o.quarter = ?1 ORDER BY o.done DESC LIMIT 3`).bind(q).all()).results;
  const count = (await db.prepare(`SELECT COUNT(*) AS n FROM eco_offers o WHERE o.state = 'open' AND o.quarter = ?1 AND o.public = 1 ${nb}`).bind(q).first()).n;
  return { open, traded, count };
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url), allow = "*";
    // On the game's own address the Worker answers under /api/ (dungeon.88x31.app/api/score, /api/eco/..., /api/account):
    // the same routes as ever, with that prefix taken off. The old workers.dev address keeps working unchanged.
    if (url.pathname.startsWith("/api/")) url.pathname = url.pathname.slice(4);
    // ALLOW_ORIGIN: the pages allowed to post or delete, comma-separated (blank: any page). Everyone may read the board.
    const pages = String(env.ALLOW_ORIGIN || "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
    const from = req.headers.get("origin") || "", pageOk = !pages.length || pages.includes(from);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });   // a 204 must have no body, or the browser's preflight fails
    // PLAYER ACCOUNTS (v1.13): /account /codes /load /passkey /logout /save (accounts.js). Login is a bearer token the page keeps.
    const acct = await accountsRoute(req, env, url);
    if (acct) return acct;

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
    if (url.pathname === "/feed" && req.method === "GET") return json(await titleFeed(env.DB, String(env.BOTS_PUBLIC || "") === "1"), 200, allow);

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
    // THE EXCHANGE: everything under /eco/ (see economy() above).
    if (url.pathname.startsWith("/eco/")) return economy(req, env, url, pageOk, from);
    return json({ error: "not found" }, 404, allow);
  },
};
