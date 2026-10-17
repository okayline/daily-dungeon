// Player accounts for 4Dungeon (v1.13). The game still plays in the browser; an account lets a player keep their run
// (and the key that owns their stash) across devices, and ties their leaderboard posts to them.
//
// Save codes and passkeys belong to the shared Accounts service (the dungeon-items Worker, binding ACCOUNTS; see its
// ACCOUNTS.md), the same one the other 88x31 games use: one passkey for every game. This file keeps 4Dungeon's own
// side: its players (a login token), the player an account has here (game name "4dungeon"), and the cloud-saved run.
//
// The page (dungeon.88x31.app) calls this Worker on its own address (workers.dev), so there's no cookie: a login is a random
// token the page keeps in localStorage and sends as "Authorization: Bearer <token>" (only its hash is stored). Answers that
// log in carry {token}; logout answers {token: ""}. Only pages in ACCOUNT_ORIGINS may use these routes, and that page's
// origin is what the shared service checks passkeys against (RP ID 88x31.app).
//   GET  /account                       who you are here: save codes, passkeys, whether a run is saved
//   POST /codes {action: "new"|"remove", id}   make a save code (shown once) or forget one
//   POST /load {code}                   log this browser in as the player a save code belongs to
//   POST /passkey {action: register_options|register|login_options|login|remove}
//   POST /logout                        this browser forgets its player (needs a code or passkey first)
//   GET  /save                          the run saved to the cloud: {code, saved} or {code: null}
//   POST /save {code}                   save the run (its PASSWORD text) to the cloud
//   POST /found {finds: [{id, key}]}    (v1.14) register gained items as numbered copies in the shared registry
import SHARED from "../items.js";
const GAME = "4dungeon", MAX_SAVE = 400000, MAX_FOUND_A_DAY = 300;
const OUR_ITEMS = new Set(SHARED.filter((i) => !i.retired).map((i) => i.id));   // only 4Dungeon's own items are registered from here
const SAVE_ROUTES = new Set(["/account", "/codes", "/load", "/passkey", "/logout", "/save", "/found"]);

class Oops extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
const now = () => Math.floor(Date.now() / 1000);
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization", "access-control-max-age": "86400" };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS } });
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const newToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const readToken = (req) => { const m = (req.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]{20,200})$/); return m ? m[1] : null; };
const originsOf = (env) => String(env.ACCOUNT_ORIGINS || "https://dungeon.88x31.app").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const ipOf = (req) => req.headers.get("cf-connecting-ip") || "unknown";
const ACC = (env) => { if (!env.ACCOUNTS) throw new Oops("Accounts are unavailable right now. Try again in a moment.", 503); return env.ACCOUNTS; };
const ok = (r) => { if (r && r.error) throw new Oops(r.error, r.status || 400); return r; };

async function limited(env, req, action, limit, secs) {
  const start = Math.floor(now() / secs) * secs, key = action + ":" + (await sha("ip:" + ipOf(req))).slice(0, 32);
  await env.DB.prepare("DELETE FROM acct_limits WHERE window_start < ?").bind(now() - 86400).run();
  const r = await env.DB.prepare("INSERT INTO acct_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count").bind(key, start).first();
  return r.count <= limit;
}

// The player behind this request's token, or null. Reads never make players; making one is rate limited per address.
export async function playerOf(env, req) {
  const token = readToken(req);
  if (!token) return null;
  const h = await sha(token), db = env.DB, t = now();
  let p = await db.prepare("SELECT * FROM players WHERE token_hash = ?").bind(h).first();
  if (!p) {
    p = await db.prepare("SELECT p.* FROM player_sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?").bind(h).first();
    if (p) await db.prepare("UPDATE player_sessions SET seen_at = ? WHERE token_hash = ?").bind(t, h).run();
  }
  if (p) await db.prepare("UPDATE players SET seen_at = ? WHERE id = ?").bind(t, p.id).run();
  return p || null;
}
async function makePlayer(env, req, ctx) {
  if (!(await limited(env, req, "new-player", 20, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
  const token = newToken(), t = now();
  const p = await env.DB.prepare("INSERT INTO players (token_hash, created_at, seen_at) VALUES (?, ?, ?) RETURNING *").bind(await sha(token), t, t).first();
  ctx.token = token;
  return p;
}
const mustPlayer = async (env, req) => { const p = await playerOf(env, req); if (!p) throw new Oops("No player here.", 401); return p; };

// This player's account id. A player gets an account the first time they make a code or passkey.
async function accountFor(env, me, make = false) {
  const acc = ACC(env);
  let id = (await acc.accountOf(GAME, me.id)).accountId;
  if (!id && make) {
    id = (await acc.createAccount()).accountId;
    if (!ok(await acc.link(id, GAME, me.id)).linked) throw new Oops("That didn't work. Try again.");
  }
  return id || null;
}

// Log this browser in as the account's player here: the one it already has, else this browser's own player (if it has
// no account yet), else a new one. Its cloud-saved run comes with it.
async function enter(env, req, ctx, accountId) {
  const acc = ACC(env);
  let { playerId } = await acc.playerFor(accountId, GAME);
  if (!playerId) {
    const cur = await playerOf(env, req);
    const p = cur && !(await acc.accountOf(GAME, cur.id)).accountId ? cur : await makePlayer(env, req, {});
    playerId = ok(await acc.link(accountId, GAME, p.id)).playerId;
  }
  const t = now(), token = newToken();
  await env.DB.prepare("INSERT INTO player_sessions (token_hash, player_id, created_at, seen_at) VALUES (?, ?, ?, ?)").bind(await sha(token), playerId, t, t).run();
  ctx.token = token;
}

const body = async (req) => { let v; try { v = await req.json(); } catch { throw new Oops("That request didn't make sense."); } if (!v || typeof v !== "object" || Array.isArray(v)) throw new Oops("That request didn't make sense."); return v; };

async function account(env, req) {
  const me = await playerOf(env, req);
  if (!me) return { player: false, codes: [], passkeys: [], devices: 0, saved: null };
  const id = await accountFor(env, me);
  const ways = id ? ok(await ACC(env).info(id)) : { codes: [], passkeys: [] };
  const devices = 1 + (await env.DB.prepare("SELECT COUNT(*) AS n FROM player_sessions WHERE player_id = ?").bind(me.id).first()).n;
  const s = await env.DB.prepare("SELECT saved FROM cloud_saves WHERE player_id = ?").bind(me.id).first();
  return { player: true, codes: ways.codes, passkeys: ways.passkeys, devices, saved: s ? s.saved : null };
}

async function codes(env, req, ctx) {
  const b = await body(req);
  if (b.action === "new") {
    const me = (await playerOf(env, req)) || (await makePlayer(env, req, ctx));
    return { code: ok(await ACC(env).addCode(await accountFor(env, me, true))).code };
  }
  if (b.action === "remove") {
    const id = await accountFor(env, await mustPlayer(env, req));
    if (!id) throw new Oops("No such save code.", 404);
    ok(await ACC(env).removeCode(id, Number(b.id)));
    return { ok: true };
  }
  throw new Oops("Unknown action.");
}

async function load(env, req, ctx) {
  const r = await ACC(env).loginCode({ code: (await body(req)).code, ip: ipOf(req) });
  ok(r);
  await enter(env, req, ctx, r.accountId);
  return { ok: true };
}

async function passkey(env, req, ctx) {
  const b = await body(req), acc = ACC(env), origin = ctx.origin;
  if (b.action === "login_options") return ok(await acc.passkeyLoginOptions({ origin, ip: ipOf(req) }));
  if (b.action === "login") {
    const r = ok(await acc.passkeyLogin({ origin, ip: ipOf(req), credential: b.credential }));
    await enter(env, req, ctx, r.accountId);
    return { ok: true };
  }
  if (b.action === "register_options" || b.action === "register") {
    const me = (await playerOf(env, req)) || (await makePlayer(env, req, ctx)), accountId = await accountFor(env, me, true);
    if (b.action === "register_options") return ok(await acc.passkeyRegisterOptions({ accountId, origin }));
    return ok(await acc.passkeyRegister({ accountId, origin, credential: b.credential, label: b.label }));
  }
  if (b.action === "remove") {
    const id = await accountFor(env, await mustPlayer(env, req));
    if (!id) throw new Oops("No such passkey.", 404);
    return ok(await acc.passkeyRemove(id, Number(b.id)));
  }
  throw new Oops("Unknown action.");
}

async function logout(env, req, ctx) {
  const me = await playerOf(env, req);
  if (!me) { ctx.token = ""; return { ok: true }; }
  const id = await accountFor(env, me);
  if (!id || !(await ACC(env).waysIn(id))) throw new Oops("Make a save code or passkey first, or you'd have no way back in.");
  const h = await sha(readToken(req));
  const s = await env.DB.prepare("DELETE FROM player_sessions WHERE token_hash = ?").bind(h).run();
  if (!s.meta.changes) await env.DB.prepare("UPDATE players SET token_hash = ? WHERE id = ? AND token_hash = ?").bind(await sha(newToken()), me.id, h).run();
  ctx.token = "";
  return { ok: true };
}

// The run's PASSWORD text (base64 JSON, made by the page). Only checked for size and shape: the game's rules run in the
// browser, so the server can't judge a run, only keep it. One cloud save per player; the newest write wins.
async function saveRun(env, req, method) {
  const me = await mustPlayer(env, req);
  if (method === "GET") {
    const s = await env.DB.prepare("SELECT code, saved FROM cloud_saves WHERE player_id = ?").bind(me.id).first();
    return s ? { code: s.code, saved: s.saved } : { code: null, saved: null };
  }
  if (!(await limited(env, req, "cloud-save", 120, 3600))) throw new Oops("Saving too often. Try again in a bit.", 429);
  const code = String((await body(req)).code || "");
  if (!code || code.length > MAX_SAVE || !/^[A-Za-z0-9+/=]+$/.test(code)) throw new Oops("That doesn't look like a run.");
  let run; try { run = JSON.parse(decodeURIComponent(escape(atob(code)))); } catch { throw new Oops("That doesn't look like a run."); }
  if (!run || !run.dungeon || !run.party) throw new Oops("That doesn't look like a run.");
  const t = now();
  await env.DB.prepare("INSERT INTO cloud_saves (player_id, code, saved) VALUES (?, ?, ?) ON CONFLICT(player_id) DO UPDATE SET code = excluded.code, saved = excluded.saved").bind(me.id, code, t).run();
  return { ok: true, saved: t };
}

// Returns a Response for an account route, or null when the path isn't one (the caller carries on with the board).
export async function accountsRoute(req, env, url) {
  if (!SAVE_ROUTES.has(url.pathname)) return null;
  const from = (req.headers.get("origin") || "").replace(/\/$/, ""), ctx = { token: null, origin: from };
  try {
    if (!originsOf(env).includes(from)) throw new Oops("Accounts work at dungeon.88x31.app. Open the game there to use them.", 403);
    if (req.method === "POST" && !/^application\/json\b/i.test(req.headers.get("content-type") || "")) throw new Oops("Send JSON.", 415);
    const p = url.pathname, m = req.method;
    if (p !== "/save" && p !== "/found") ACC(env);   // no accounts service, no players made
    let out;
    if (p === "/account" && m === "GET") out = await account(env, req);
    else if (p === "/codes" && m === "POST") out = await codes(env, req, ctx);
    else if (p === "/load" && m === "POST") out = await load(env, req, ctx);
    else if (p === "/passkey" && m === "POST") out = await passkey(env, req, ctx);
    else if (p === "/logout" && m === "POST") out = await logout(env, req, ctx);
    else if (p === "/save" && (m === "GET" || m === "POST")) out = await saveRun(env, req, m);
    else if (p === "/found" && m === "POST") out = await found(env, req);
    else return reply({ error: "No such thing." }, 404);
    return reply(ctx.token === null ? out : { ...out, token: ctx.token });
  } catch (e) {
    if (e instanceof Oops) return reply({ error: e.message }, e.status);
    console.error(e);
    return reply({ error: "Something broke. Try again in a moment." }, 500);
  }
}

// (v1.14) Items a signed-in player gained, as numbered copies in the shared copy registry (dungeon-items, binding
// REGISTRY). The game runs in the browser, so this trusts the page the way the board does: only 4Dungeon's own items,
// at most MAX_FOUND_A_DAY a player a day, and each find's key (the player, the run, the nth item gained) makes a resend
// return the same copy instead of a new one. Answers { copies: [{ key, copy }] } for the ones that went in.
async function found(env, req) {
  const me = await mustPlayer(env, req);
  if (!env.REGISTRY) throw new Oops("The item registry is unavailable right now.", 503);
  const list = (await body(req)).finds;
  if (!Array.isArray(list) || list.length > 50) throw new Oops("Up to 50 finds at a time.");
  const finds = list.filter((f) => f && OUR_ITEMS.has(f.id) && typeof f.key === "string" && /^[A-Za-z0-9:_-]{1,80}$/.test(f.key));
  const day = Math.floor(now() / 86400) * 86400, key = "found:" + me.id;
  const r = await env.DB.prepare("INSERT INTO acct_limits (key, window_start, count) VALUES (?, ?, ?) ON CONFLICT(key, window_start) DO UPDATE SET count = count + excluded.count RETURNING count").bind(key, day, finds.length).first();
  if (r.count > MAX_FOUND_A_DAY) throw new Oops("That's a lot of finds for one day. Try again tomorrow.", 429);
  const copies = [];
  for (const f of finds) {
    const b = await env.REGISTRY.birth({ itemId: f.id, game: GAME, playerId: me.id, key: me.id + ":" + f.key });
    if (b && !b.error) copies.push({ key: f.key, copy: b.copy });
  }
  return { copies };
}
