// THE RUN ON THE SERVER (v1.20, stage 2 of dungeon-notes/4dungeon-server-move.md). The Worker keeps each player's run
// and applies actions to it with the same rules the page runs (act.js -> rules.js). The page doesn't use these yet.
//   POST /run {}               your run (a new one if you have none). Makes a guest player if this browser has none.
//   POST /run {fresh: true}    start a new run
//   POST /act {n, action}      do one action. n is how many actions the page has seen on this run, so a resend of the
//                              same action is refused instead of done twice. Answers {run, n}; a stale n gets 409 and the
//                              run as it really is.
// Breath is off here (always full) until it's retuned for the server's feel. Admin tools (ACT.ADMIN) need players.admin.
import ACT from "../act.js";
import { playerOf, makePlayer, Oops, reply, body, limited, originsOf } from "./accounts.js";

const MAX_RUN = 400000;
const now = () => Math.floor(Date.now() / 1000);
const tidy = (st) => { delete st.breath; return st; };          // breath off: no breath record means a full bar

async function load(env, me) {
  return env.DB.prepare("SELECT state, n FROM runs WHERE player_id = ?").bind(me.id).first();
}
async function store(env, me, st, n) {
  const s = JSON.stringify(st);
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

async function act(env, req) {
  if (!(await limited(env, req, "act", 3600, 3600))) throw new Oops("That's a lot of moves. Wait a little.", 429);
  const b = await body(req), a = b.action;
  if (!a || typeof a !== "object" || typeof a.t !== "string" || !ACT.types.includes(a.t)) throw new Oops("Unknown action.");
  if (a.t === "reset") throw new Oops("Start a new run with /run.");
  const me = await playerOf(env, req);
  if (!me) throw new Oops("No player here.", 401);
  if (ACT.ADMIN.has(a.t) && !me.admin) throw new Oops("That's for the webmaster.", 403);
  const row = await load(env, me);
  if (!row) throw new Oops("No run yet.", 404);
  if (b.n !== row.n) return { stale: true, run: JSON.parse(row.state), n: row.n };
  let st;
  try { st = tidy(ACT.apply(JSON.parse(row.state), a)); }
  catch (e) { console.error(e); throw new Oops("That didn't work.", 400); }
  await store(env, me, st, row.n + 1);
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
