// THE RUN ON THE SERVER (v1.20, stage 2 of dungeon-notes/4dungeon-server-move.md). The Worker keeps each player's run
// and applies actions to it with the same rules the page runs (act.js -> rules.js). The page doesn't use these yet.
//   POST /run {}               your run (a new one if you have none). Makes a guest player if this browser has none.
//   POST /run {fresh: true}    start a new run
//   POST /run {peek: true}     your run, or {run: null}: never makes a player or a run (the page's title screen)
//   POST /act {n, action}      do one action. n is how many actions the page has seen on this run, so a resend of the
//                              same action is refused instead of done twice. Answers {run, n}; a stale n gets 409 and the
//                              run as it really is.
// The rules' queues for the page (OUTBOX: finds, gone, events, tally, ...) are handed over once, in the answer, and
// not kept. An action that changes nothing answers {same: true, n} and writes nothing (the page's once-a-minute tick).
// Breath is off here (always full) until it's retuned for the server's feel. Admin tools (ACT.ADMIN) need players.admin.
import ACT from "../act.js";
import { playerOf, makePlayer, Oops, reply, body, originsOf, sha, readToken, ipOf } from "./accounts.js";

const MAX_RUN = 400000;
const now = () => Math.floor(Date.now() / 1000);
const tidy = (st) => { delete st.breath; return st; };          // breath off: no breath record means a full bar
const OUTBOX = ["finds", "gone", "events", "tally", "line3", "exchangeOpen"];
const kept = (st) => { const k = { ...st }; for (const f of OUTBOX) delete k[f]; return k; };

async function load(env, me) {
  return env.DB.prepare("SELECT state, n FROM runs WHERE player_id = ?").bind(me.id).first();
}
async function store(env, me, st, n) {
  const s = JSON.stringify(kept(st));
  if (s.length > MAX_RUN) throw new Oops("This run has grown too big to keep.", 413);
  await env.DB.prepare("INSERT INTO runs (player_id, state, n, updated) VALUES (?, ?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET state = excluded.state, n = excluded.n, updated = excluded.updated").bind(me.id, s, n, now()).run();
}
function fresh() {
  let st = ACT.apply({}, { t: "reset" });
  st = ACT.apply(st, { t: "named" });
  return tidy(ACT.apply(st, { t: "tick" }));
}

async function run(env, req, ctx) {
  const b = await body(req);
  if (b.peek === true) {
    const me = await playerOf(env, req), row = me && (await load(env, me));
    if (!row) return { run: null };
    const st = tidy(ACT.apply(JSON.parse(row.state), { t: "tick" }));
    await store(env, me, st, row.n);
    return { run: st, n: row.n };
  }
  const me = (await playerOf(env, req)) || (await makePlayer(env, req, ctx));
  const row = await load(env, me);
  if (!row || b.fresh === true) {
    const st = fresh(), n = row ? row.n + 1 : 0;
    await store(env, me, st, n);
    return { run: st, n };
  }
  const st = tidy(ACT.apply(JSON.parse(row.state), { t: "tick" }));   // catch up with the real date
  await store(env, me, st, row.n);
  return { run: st, n: row.n };
}

// (v1.21.1) One action is two trips to the database, each a single batch: (1) who this is, their run, and the rate
// limit's count; (2) the run saved, and when they were last seen. The rate limit's old rows are swept now and then,
// not on every move. (Each trip crosses the ocean from Hawaii to the database, so the count of trips is what lags.)
const ACT_LIMIT = 3600;          // actions an hour per address
async function act(env, req) {
  const b = await body(req), a = b.action;
  if (!a || typeof a !== "object" || typeof a.t !== "string" || !ACT.types.includes(a.t)) throw new Oops("Unknown action.");
  if (a.t === "reset") throw new Oops("Start a new run with /run.");
  const token = readToken(req);
  if (!token) throw new Oops("No player here.", 401);
  const h = await sha(token), t = now(), win = Math.floor(t / 3600) * 3600, lim = "act:" + (await sha("ip:" + ipOf(req))).slice(0, 32);
  const [who, count] = await env.DB.batch([
    env.DB.prepare("SELECT p.id, p.admin, r.state, r.n FROM players p LEFT JOIN runs r ON r.player_id = p.id WHERE p.token_hash = ?1 OR p.id = (SELECT player_id FROM player_sessions WHERE token_hash = ?1) LIMIT 1").bind(h),
    env.DB.prepare("INSERT INTO acct_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count").bind(lim, win),
  ]);
  if (count.results[0].count > ACT_LIMIT) throw new Oops("That's a lot of moves. Wait a little.", 429);
  const me = who.results[0];
  if (!me) throw new Oops("No player here.", 401);
  if (ACT.ADMIN.has(a.t) && !me.admin) throw new Oops("That's for the webmaster.", 403);
  const row = me.state == null ? null : { state: me.state, n: me.n };
  if (!row) throw new Oops("No run yet.", 404);
  if (b.n !== row.n) return { stale: true, run: JSON.parse(row.state), n: row.n };
  let st;
  try { st = tidy(ACT.apply(JSON.parse(row.state), a)); }
  catch (e) { console.error(e); throw new Oops("That didn't work.", 400); }
  const s = JSON.stringify(kept(st));
  if (s === row.state && !OUTBOX.some((f) => st[f] !== undefined)) return { same: true, n: row.n };
  if (s.length > MAX_RUN) throw new Oops("This run has grown too big to keep.", 413);
  const write = [
    env.DB.prepare("UPDATE runs SET state = ?, n = ?, updated = ? WHERE player_id = ?").bind(s, row.n + 1, t, me.id),
    env.DB.prepare("UPDATE players SET seen_at = ? WHERE id = ? AND seen_at < ?").bind(t, me.id, t - 300),   // at most every 5 minutes
  ];
  if (Math.random() < 0.01) write.push(env.DB.prepare("DELETE FROM acct_limits WHERE window_start < ?").bind(t - 86400));
  await env.DB.batch(write);
  return { run: st, n: row.n + 1 };
}

// Returns a Response for /run or /act, or null for any other path.
export async function gameRoute(req, env, url) {
  if (url.pathname !== "/run" && url.pathname !== "/act") return null;
  const from = (req.headers.get("origin") || "").replace(/\/$/, ""), ctx = { token: null };
  try {
    if (!originsOf(env).includes(from)) throw new Oops("The game runs at dungeon.88x31.app.", 403);
    if (req.method !== "POST") throw new Oops("No such thing.", 404);
    if (!/^application\/json\b/i.test(req.headers.get("content-type") || "")) throw new Oops("Send JSON.", 415);
    const out = url.pathname === "/run" ? await run(env, req, ctx) : await act(env, req);
    if (out.stale) return reply({ run: out.run, n: out.n, error: "The run moved on." }, 409);
    return reply(ctx.token === null ? out : { ...out, token: ctx.token });
  } catch (e) {
    if (e instanceof Oops) return reply({ error: e.message }, e.status);
    console.error(e);
    return reply({ error: "Something broke. Try again in a moment." }, 500);
  }
}
