// (v1.20) The run on the server: /run and /act, with Node's SQLite standing in for D1.
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
  return { prepare: (s) => prep(s), batch: async (st) => Promise.all(st.map((x) => x.run())), raw: db };
}
const ORIGIN = "https://dungeon.88x31.app";
function browser(env) {
  let token = "";
  return async (path, body) => {
    const res = await worker.fetch(new Request("https://dungeon.88x31.app/api" + path, {
      method: "POST", body: JSON.stringify(body),
      headers: { "cf-connecting-ip": "203.0.113.9", origin: ORIGIN, "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    }), env);
    const data = await res.json();
    if (typeof data.token === "string") token = data.token;
    return { status: res.status, data };
  };
}

test("a guest gets a run; actions move it on; a resend is refused; breath stays full", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  const first = await me("/run", {});
  assert.equal(first.status, 200);
  assert.ok(first.data.token, "a guest player was made");
  assert.ok(first.data.run.dungeon && first.data.run.party, "a real run came back");
  assert.equal(first.data.n, 0);
  const a = await me("/act", { n: 0, action: { t: "search" } });
  assert.equal(a.status, 200); assert.equal(a.data.n, 1);
  assert.equal(a.data.run.breath, undefined);
  const again = await me("/act", { n: 0, action: { t: "search" } });
  assert.equal(again.status, 409); assert.equal(again.data.n, 1);
  assert.equal((await me("/run", {})).data.n, 1, "the run is kept");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 1);
  assert.equal((await me("/act", { n: 1, action: { t: "nope" } })).status, 400);
});

test("admin tools need the admin flag", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  await me("/run", {});
  assert.equal((await me("/act", { n: 0, action: { t: "freesteps" } })).status, 403);
  env.DB.raw.prepare("UPDATE players SET admin = 1").run();
  const r = await me("/act", { n: 0, action: { t: "freesteps" } });
  assert.equal(r.status, 200); assert.equal(r.data.run.freeSteps, true);
});

test("peek never makes a player; a no-change action writes nothing; the page's queues are handed over once", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  assert.deepEqual((await me("/run", { peek: true })).data, { run: null });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 0);
  await me("/run", {});
  const t1 = await me("/act", { n: 0, action: { t: "tick" } });
  assert.equal(t1.data.same, true); assert.equal(t1.data.n, 0);
  env.DB.raw.prepare("UPDATE runs SET state = json_set(state, '$.finds', json('[1]'))").run();
  const r = await me("/act", { n: 0, action: { t: "turn", dir: "L" } });
  assert.deepEqual(r.data.run.finds, [1]);
  assert.equal(JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state).finds, undefined);
});
