// 4Dungeon's player accounts in the board Worker, with Node's built-in SQLite standing in for D1 and a stand-in for the
// shared Accounts service (the real one, and its passkey crypto, are tested in dungeon-items).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker.js";

function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    sql, args, bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  const batch = async (st) => { db.exec("BEGIN"); try { const o = st.map((x) => ({ meta: { changes: Number(db.prepare(x.sql).run(...x.args).changes) } })); db.exec("COMMIT"); return o; } catch (e) { db.exec("ROLLBACK"); throw e; } };
  return { prepare: (s) => prep(s), batch, raw: db };
}
// A stand-in for the shared accounts (the Accounts entrypoint of dungeon-items, tested there): same answers, kept in maps.
// Codes are random; a "passkey" is any credential { id, account } that was registered. 10 wrong codes per address, then 429.
export function fakeAccounts() {
  let n = 0; const codes = new Map(), keys = new Map(), links = new Map(), tries = new Map(), imported = [];
  const acct = new Set(), err = (error, status = 400) => ({ error, status });
  const own = (id) => [...codes].filter(([, v]) => v.acct === id);
  return {
    imported, codes, links,
    async createAccount() { acct.add(++n); return { accountId: n }; },
    async addCode(id) {
      if (own(id).length >= 5) return err("You have 5 save codes already. Forget one first.");
      const A31 = "23456789ABCDEFGHJKMNPQRSTUVWXYZ", code = Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => A31[Math.floor(Math.random() * 31)]).join("")).join("-");
      codes.set(code.replace(/-/g, ""), { acct: id, id: codes.size + 1 }); return { code };
    },
    async importCode(id, h) { imported.push([id, h]); return { ok: true }; },
    async removeCode(id, cid) { const e = [...codes].find(([, v]) => v.acct === id && v.id === cid); if (!e) return err("No such save code.", 404); codes.delete(e[0]); return { ok: true }; },
    async loginCode({ code, ip }) {
      const c = (tries.get(ip) || 0) + 1; tries.set(ip, c);
      if (c > 10) return err("Too many tries. Wait 15 minutes and try again.", 429);
      const v = codes.get(String(code).toUpperCase().replace(/[^A-Z0-9]/g, "")); return v ? { accountId: v.acct } : err("That save code didn't work. Check it and try again.", 404);
    },
    async info(id) { return { codes: own(id).map(([, v]) => ({ id: v.id, created_at: 1, last_used_at: null })), passkeys: [...keys].filter(([, v]) => v.acct === id).map(([k, v]) => ({ id: v.id, label: v.label })), games: [] }; },
    async waysIn(id) { return own(id).length + [...keys].filter(([, v]) => v.acct === id).length; },
    async playerFor(id, g) { return { playerId: links.get(id + "|" + g) ?? null }; },
    async link(id, g, p) {
      const taken = [...links].find(([k, v]) => k.endsWith("|" + g) && v === p);
      if (links.has(id + "|" + g)) return { playerId: links.get(id + "|" + g), linked: links.get(id + "|" + g) === p };
      if (taken) return { playerId: null, linked: false, taken: true };
      links.set(id + "|" + g, p); return { playerId: p, linked: true };
    },
    async accountOf(g, p) { const e = [...links].find(([k, v]) => k.endsWith("|" + g) && v === p); return { accountId: e ? Number(e[0].split("|")[0]) : null }; },
    async passkeyRegisterOptions({ accountId, origin }) { return { challenge: "c-" + accountId, origin }; },
    async passkeyRegister({ accountId, credential, label }) { keys.set(credential.id, { acct: accountId, id: keys.size + 1, label }); return { ok: true }; },
    async passkeyLoginOptions({ origin }) { return { challenge: "login", origin }; },
    async passkeyLogin({ credential }) { const k = keys.get(credential?.id); return k ? { accountId: k.acct } : err("That passkey isn't saved here.", 400); },
    async passkeyRemove(id, kid) { const e = [...keys].find(([, v]) => v.acct === id && v.id === kid); if (!e) return err("No such passkey.", 404); keys.delete(e[0]); return { ok: true }; },
  };
}

const ORIGIN = "https://dungeon.88x31.app";
const makeEnv = (extra = {}) => ({ DB: fakeD1(), ACCOUNTS: fakeAccounts(), ALLOW_ORIGIN: ORIGIN, ...extra });
function browser(env, { ip = "203.0.113.1", origin = ORIGIN } = {}) {
  let token = "";
  const me = async (path, body, { method, headers = {} } = {}) => {
    const res = await worker.fetch(new Request("https://daily-dungeon-board.ddddungeon.workers.dev" + path, {
      method: method || (body !== undefined ? "POST" : "GET"),
      headers: { "cf-connecting-ip": ip, ...(origin ? { origin } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
    let data = null; try { data = await res.json(); } catch { /* not JSON */ }
    if (data && typeof data.token === "string") token = data.token;
    return { status: res.status, data, headers: res.headers };
  };
  return me;
}
// a run as the page's PASSWORD makes it (base64 of JSON), only what the Worker checks for
const passwordOf = (extra = {}) => Buffer.from(JSON.stringify({ dungeon: { floor: { v: 11 } }, party: [], key: "k".repeat(48), ...extra })).toString("base64");

test("a save code makes a player and account; another browser logs in with it and is the same player", async () => {
  const env = makeEnv(), a = browser(env, { ip: "203.0.113.1" }), b = browser(env, { ip: "203.0.113.2" });
  const { data } = await a("/api/codes", { action: "new" });
  assert.match(data.code, /^([2-9A-HJKMNP-Z]{4}-){4}[2-9A-HJKMNP-Z]{4}$/);
  assert.equal((await a("/api/account")).data.codes.length, 1);
  assert.equal((await b("/api/load", { code: "AAAA-BBBB-CCCC-DDDD-EEEE" })).status, 404);
  assert.equal((await b("/api/load", { code: data.code.toLowerCase() })).status, 200);
  const acct = (await b("/api/account")).data;
  assert.equal(acct.player, true); assert.equal(acct.codes.length, 1); assert.equal(acct.devices, 2);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 1);
  assert.equal(env.ACCOUNTS.links.get("1|4dungeon"), 1);
});

test("the run saves to the cloud and a second device gets it; bad runs are refused; logged-out callers get nothing", async () => {
  const env = makeEnv(), a = browser(env, { ip: "203.0.113.3" }), b = browser(env, { ip: "203.0.113.4" });
  assert.equal((await a("/api/save")).status, 401);
  const { data } = await a("/api/codes", { action: "new" });
  assert.deepEqual((await a("/api/save")).data, { code: null, saved: null });
  const code = passwordOf();
  assert.equal((await a("/api/save", { code })).status, 200);
  await b("/api/load", { code: data.code });
  assert.equal((await b("/api/save")).data.code, code);
  assert.equal((await a("/api/account")).data.saved > 0, true);
  const code2 = passwordOf({ steps: 9 });
  await a("/api/save", { code: code2 });                                  // the newest write wins
  assert.equal((await b("/api/save")).data.code, code2);
  for (const bad of ["", "not base64!!", Buffer.from("{}").toString("base64"), Buffer.from("nope").toString("base64"), "A".repeat(400001)]) assert.equal((await a("/api/save", { code: bad })).status, 400);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM cloud_saves").get().n, 1);
});

test("a post from a logged-in player is remembered as theirs; the old address (no /api) still works for the board", async () => {
  const env = makeEnv(), a = browser(env, { ip: "203.0.113.5" });
  await a("/api/codes", { action: "new" });
  const run = "abcdefgh12345678";
  const r = await a("/api/score", { run, name: "KURA", floor: 3, days: 5, demons: 2, turns: 100, version: "v1.13" });
  assert.equal(r.status, 200);
  assert.deepEqual(env.DB.raw.prepare("SELECT run, player_id FROM score_players").all().map((x) => ({ ...x })), [{ run, player_id: 1 }]);
  const stranger = browser(env, { ip: "203.0.113.6" });
  assert.equal((await stranger("/score", { run: "zzzzzzzz12345678", name: "NOBODY", floor: 2, days: 3, demons: 0, turns: 5, version: "v1.13" })).status, 200);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM score_players").get().n, 1);   // no token, no link
  assert.equal((await stranger("/top")).status, 200);
});

test("another site can't act for a player; JSON is required; no ACCOUNTS binding says so", async () => {
  const env = makeEnv(), a = browser(env, { ip: "203.0.113.7" }), evil = browser(env, { ip: "203.0.113.8", origin: "https://evil.example" });
  assert.equal((await evil("/api/codes", { action: "new" })).status, 403);
  assert.equal((await a("/api/codes", undefined, { method: "POST", headers: { "content-type": "text/plain" } })).status, 415);
  assert.equal((await browser({ ...env, ACCOUNTS: undefined })("/api/codes", { action: "new" })).status, 503);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 0);
});

test("logout needs a way back in; making players is rate limited per address", async () => {
  const env = makeEnv(), a = browser(env, { ip: "203.0.113.9" });
  await a("/api/passkey", { action: "register_options" });                 // makes a player, but no code or passkey yet
  assert.equal((await a("/api/logout", {})).status, 400);
  const { data } = await a("/api/codes", { action: "new" });
  assert.equal((await a("/api/logout", {})).status, 200);
  assert.equal((await a("/api/account")).data.player, false);
  assert.equal((await a("/api/load", { code: data.code })).status, 200);
  for (let i = 0; i < 20; i++) assert.equal((await browser(env, { ip: "198.51.100.7" })("/api/codes", { action: "new" })).status, 200);
  assert.equal((await browser(env, { ip: "198.51.100.7" })("/api/codes", { action: "new" })).status, 429);
});

test("a signed-in player's finds become registry copies: own items only, resends count once, signed-out refused", async () => {
  const born = new Map(), calls = [];
  const REGISTRY = { async birth(a) { calls.push(a); if (!born.has(a.key)) born.set(a.key, born.size + 1); return { itemId: a.itemId, copy: born.get(a.key) }; } };
  const env = makeEnv({ REGISTRY }), a = browser(env, { ip: "203.0.113.30" }), anon = browser(env, { ip: "203.0.113.31" });
  assert.equal((await anon("/found", { finds: [{ id: 1, key: "r:1" }] })).status, 401);
  await a("/codes", { action: "new" });   // makes this browser a player
  const finds = [{ id: 1, key: "run1:1" }, { id: 47, key: "run1:2" }, { id: 46, key: "run1:3" }];   // 47 is an 88x31 button: not ours
  const r1 = await a("/found", { finds });
  assert.deepEqual(r1.data.copies.map((c) => c.key), ["run1:1", "run1:3"]);
  const r2 = await a("/found", { finds });   // a resend: same keys, same copies
  assert.deepEqual(r2.data.copies, r1.data.copies);
  assert.deepEqual([...new Set(calls.map((c) => c.game))], ["4dungeon"]);
  assert.ok(calls.every((c) => c.key.startsWith(c.playerId + ":")));
});
