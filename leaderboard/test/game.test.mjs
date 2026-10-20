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
  return { prepare: (s) => prep(s), batch: async (st) => { db.exec("BEGIN"); try { const o = st.map((x) => ({ results: db.prepare(x.sql).all(...x.args), meta: {} })); db.exec("COMMIT"); return o; } catch (e) { db.exec("ROLLBACK"); throw e; } }, raw: db };
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

test("peek never makes a player; a no-change action writes nothing; the rules' queues are never kept", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  assert.deepEqual((await me("/run", { peek: true })).data, { run: null });
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM players").get().n, 0);
  await me("/run", {});
  const t1 = await me("/act", { n: 0, action: { t: "tick" } });
  assert.equal(t1.data.same, true); assert.equal(t1.data.n, 0);
  env.DB.raw.prepare("UPDATE runs SET state = json_set(state, '$.finds', json('[1]'))").run();
  const r = await me("/act", { n: 0, action: { t: "turn", dir: "L" } });
  assert.equal(r.data.run.finds, undefined, "(v1.22) the server sends the queues itself, not the page");
  assert.equal(JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state).finds, undefined);
});

test("each find in the bag gets its registry copy; a thing gone uses up that copy; the page never sends them", async () => {
  const env = { DB: fakeD1() }, me = browser(env), sent = [];
  env.REGISTRY = {
    async birth(b) { sent.push(["birth", b.itemId]); return { copy: 7, created: true }; },
    async spendCopy(b) { sent.push(["spend", b.itemId, b.copy]); return { ok: true }; },
  };
  await me("/run", {});
  const ACT = (await import("../../act.js")).default, name = ACT.nameOf(1);
  const put = (f) => { const st = JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state); f(st); env.DB.raw.prepare("UPDATE runs SET state = ?").run(JSON.stringify(st)); };
  put((st) => { st.finds = [{ id: 1, key: "r:1" }]; });
  const r = await me("/act", { n: 0, action: { t: "turn", dir: "L" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.run.finds, undefined);
  assert.deepEqual(r.data.run.copies[name], [{ k: "r:1", c: 7 }]);
  put((st) => { st.gone = [name]; });
  await me("/act", { n: 1, action: { t: "turn", dir: "R" } });
  assert.deepEqual(sent, [["birth", 1], ["spend", 1, 7]]);
  assert.equal((JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state).copies || {})[name], undefined);
});

test("the page is never sent the run's secrets (the webmaster is)", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  const r = (await me("/run", {})).data.run, d = r.dungeon, f = d.floor;
  assert.equal(r.pseed, undefined); assert.equal(d.seed, undefined); assert.equal(f.seed, undefined); assert.equal(f.kinds, undefined);
  assert.ok(f.rooms.every((x) => x.hidden === undefined));
  assert.ok(JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state).dungeon.floor.kinds, "the server keeps them");
  env.DB.raw.prepare("UPDATE players SET admin = 1").run();
  assert.ok((await me("/run", { peek: true })).data.run.dungeon.floor.kinds);
});

test("(v1.25) a find is stamped with its moon and its deed once numbered; a climb adds carried_up; INVOKE reads them", async () => {
  const env = { DB: fakeD1() }, me = browser(env), marks = [];
  env.REGISTRY = {
    async birth() { return { copy: 3, created: true }; },
    async addMark(m) { marks.push([m.copy, m.kind, m.value, m.key.split(":").slice(1).join(":")]); return { ok: true, n: marks.length, created: true }; },
  };
  await me("/run", {});
  const ACT = (await import("../../act.js")).default, RULES = (await import("../../rules.js")).default, name = ACT.nameOf(1);
  const put = (f) => { const st = JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state); f(st); env.DB.raw.prepare("UPDATE runs SET state = ?").run(JSON.stringify(st)); };
  put((st) => { st.finds = [{ id: 1, key: "r:1", p: 4, h: "found_wall" }]; st.items = (st.items || []).concat(name); });
  const r = await me("/act", { n: 0, action: { t: "turn", dir: "L" } });
  assert.deepEqual(r.data.run.copies[name].at(-1), { k: "r:1", c: 3, m: ["full", "found_wall"] });
  // a climb: the run before had climb 1, the run after climb 2 (settleCopies compares the two)
  const { settleCopies, stampMarks } = await import("../game.js");
  const st = { climb: 2, copies: { [name]: [{ ...r.data.run.copies[name].at(-1) }] } };
  await stampMarks(env, (await settleCopies(env, null, st, { t: "go" }, { id: 1 }, { climb: 1 })).marks);
  assert.deepEqual(st.copies[name][0].m, ["full", "found_wall", "carried_up"]);
  assert.deepEqual(marks.map((m) => m.slice(0, 3)), [[3, "night", "full"], [3, "deed", "found_wall"], [3, "deed", "carried_up"]]);
  assert.deepEqual(RULES.markLines(["full", "found_wall", "carried_up"]), ["Found in a wall under a full moon.", "Carried up a level."]);
  for (const ph of RULES.PHASE_MARK) for (const d of ["found_wall", "from_demon", "given_member", "from_stranger", "made_compiler", "copied_cache", "kit", "moon_gift", "found_inside"])
    assert.ok(RULES.markLines([ph, d])[0].length <= 41, "every history fits one line: " + RULES.markLines([ph, d])[0]);
});

test("(v1.27) the copy that leaves the bag is the one the registry uses up; a blessing makes a copy louder", async () => {
  const ACT = (await import("../../act.js")).default, RULES = (await import("../../rules.js")).default, name = ACT.nameOf(1);
  const { settleCopies } = await import("../game.js");
  // two copies of one thing, the older one blessed: the bag says it was the SECOND one (k = 1) that left
  const spent = [];
  const env = { REGISTRY: { async addMark() { return { ok: true }; } } };
  const st = { copies: { [name]: [{ k: "a", c: 4, m: ["blessed"] }, { k: "b", c: 9 }] }, gone: [name], goneAt: [1] };
  const out = (await settleCopies(env, null, st, { t: "use" }, null, {})).spends;
  assert.deepEqual(out, [{ itemId: 1, copy: 9 }]);
  assert.deepEqual(st.copies[name], [{ k: "a", c: 4, m: ["blessed"] }]);
  // no slot named: the newest goes, as before
  const st2 = { copies: { [name]: [{ k: "a", c: 4 }, { k: "b", c: 9 }] }, gone: [name] };
  assert.deepEqual((await settleCopies(env, null, st2, { t: "use" }, null, {})).spends, [{ itemId: 1, copy: 9 }]);
  // the rules: using the second of two names records k = 1 (takeOut), and a blessed copy counts one tier up
  const tier = RULES.TIER ? RULES.TIER[name] : null;
  const run = { items: [name], copies: { [name]: [{ k: "a", c: 4, m: ["blessed"] }] } };
  const plain = { items: [name], copies: { [name]: [{ k: "a", c: 4 }] } };
  assert.equal(RULES.slotTier(run, 0), { COMMON: "UNCOMMON", UNCOMMON: "RARE", RARE: "MYTHIC", MYTHIC: "MYTHIC", MOON: "MOON" }[RULES.slotTier(plain, 0)]);
});

test("(v1.27) a thing handed to a friend keeps its copy and marks, and comes home with them", async () => {
  const ACT = (await import("../../act.js")).default, name = ACT.nameOf(1);
  const { settleCopies } = await import("../game.js");
  const env = {}, mine = { k: "a", c: 4, m: ["full", "blessed"] };
  const st = { copies: { [name]: [mine] }, gone: [name], goneAt: [0], goneTo: ["PIXIE"] };
  assert.deepEqual((await settleCopies(env, null, st, { t: "give" }, null, {})).spends, []);          // not used up
  assert.equal(st.copies, undefined);
  assert.deepEqual(st.pocketed, { PIXIE: [{ n: name, e: mine }] });
  const back = { pocketed: st.pocketed, finds: [{ id: 1, key: "r:9", h: "given_member", w: "PIXIE" }] };
  await settleCopies(env, null, back, { t: "ask" }, null, {});
  assert.deepEqual(back.copies[name], [mine]);                                                // same copy, same marks
  assert.equal(back.pocketed, undefined);
});

test("(v1.27) occasions: real days are named, they mark a find, and every history line still fits", async () => {
  const S = (await import("../../screen.js")).default || (await import("../../screen.js"));
  const RULES = (await import("../../rules.js")).default, ACT = (await import("../../act.js")).default;
  const on = (iso) => S.occasions(new Date(iso + "T12:00:00Z"));
  assert.ok(on("2026-08-12").includes("eclipse_solar"));          // NASA: total solar eclipse
  assert.ok(on("2026-08-28").includes("eclipse_lunar"));
  assert.ok(on("2026-05-31").includes("blue_moon"));              // the second full moon of May 2026
  assert.ok(on("2028-12-31").includes("blue_moon") && on("2028-12-31").includes("thirteenth_moon"));
  assert.ok(on("2026-12-21").includes("solstice") && on("2026-09-23").includes("equinox") && on("2026-03-20").includes("equinox"));
  assert.ok(on("2026-07-07").includes("mirror_day") && !on("2026-07-08").includes("mirror_day"));
  assert.deepEqual(on("2026-10-18").filter((o) => o !== "mirror_day"), []);                     // an ordinary day
  for (const o of ACT.OCCASIONS) for (const d of ["found_wall", "from_demon", "given_member", "from_stranger", "made_compiler", "copied_cache", "kit", "moon_gift", "found_inside"])
    for (const first of [[], ["first_copy"], ["hundredth_copy"]])
      for (const l of RULES.markLines(["full", d, o, ...first, "carried_up", "carried_up", "carried_up"])) assert.ok(l.length <= 41, "fits: " + l);
  assert.equal(RULES.markLines(["full", "found_wall", "blue_moon"])[0], "Found in a wall under a blue moon.");
  // the first copy is stamped when numbered
  const { settleCopies, stampMarks } = await import("../game.js");
  const marks = [], env = { REGISTRY: { async addMark(m) { marks.push(m.value); return { ok: true, n: 1 }; } } };
  const name = ACT.nameOf(1), st = { copies: { [name]: [{ k: "r:1", c: null, q: ["full", "eclipse_solar"] }] }, finds: [] };
  const done = await settleCopies(env, async () => ({ json: async () => ({ copies: [{ key: "r:1", copy: 1 }] }) }), st, { t: "go" }, { id: 5 }, {});
  await stampMarks(env, done.marks);
  assert.deepEqual(marks, ["full", "eclipse_solar", "first_copy"]);
});

test("(v1.33) a find carries its finer place and level; copies in the bag get what they live through, once each", async () => {
  const ACT = (await import("../../act.js")).default, RULES = (await import("../../rules.js")).default, name = ACT.nameOf(1);
  const { settleCopies } = await import("../game.js");
  const marks = [], env = { REGISTRY: { async addMark(m) { marks.push(m.value); return { ok: true, n: marks.length }; } } };
  // a find from a locker on B3F, while a demon falls and a door opens: the old copy gets both, the new one neither
  const st = { stats: { beaten: 2, unlocks: 1, fled: 0 }, copies: { [name]: [{ k: "r:1", c: 7, m: ["full", "found_wall"] }] },
    finds: [{ id: 1, key: "r:2", p: 4, h: "found_wall", x: ["in_locker", "on_b3f", "bogus"] }] };
  const out = await settleCopies(env, null, st, { t: "fight" }, { id: 5 }, { stats: { beaten: 1, unlocks: 0, fled: 0 } });
  assert.deepEqual(marks, []);                                                         // (v1.36) nothing is written before the answer
  assert.deepEqual(out.marks.map((m) => [m.copy, m.value]), [[7, "beat_demon"], [7, "through_door"]]);   // they go after it (sendOut)
  assert.deepEqual(st.copies[name][0].m, ["full", "found_wall", "beat_demon", "through_door"]);
  assert.deepEqual(st.copies[name][1].q, ["full", "found_wall", "in_locker", "on_b3f"]);
  // another fight won: nothing new for a copy that already saw one
  marks.length = 0;
  await settleCopies(env, null, st, { t: "fight" }, { id: 5 }, { stats: { beaten: 1, unlocks: 1 } });
  assert.deepEqual(marks, []);
  assert.deepEqual(["in_locker", "deep_stone", "on_b4f", "on_1f", "talked_down", "fled_fight"].map((v) => RULES.markLabel("deed", v)),
    ["In a hidden locker", "Deep in the stone", "On B4F", "On 1F", "Saw a demon talked down", "Ran from a fight"]);
  assert.equal(RULES.markLines(["full", "found_wall", "in_locker", "on_b3f"])[0], "Found in a wall under a full moon.");   // the Moon still reads found_wall
});

test("(v1.31) a demon the player has answered stays seen on the server, so the page does not open its APPEARS screen again", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  let run = (await me("/run", {})).data, n = run.n, seenAfter = null;
  for (let i = 0; i < 600 && seenAfter === null; i++) {
    const a = await me("/act", { n, action: run.run.encounter ? { t: "fight" } : i % 8 === 7 ? { t: "turn", dir: "R" } : { t: "search" } });   // (turning, so it is not always a door wall)
    assert.equal(a.status, 200); n = a.data.n;
    if (run.run.encounter && !run.run.encounter.seen && a.data.run.encounter) seenAfter = a.data.run.encounter.seen;   // a fight began unseen, and the demon is still standing
    run = a.data;
    if (run.run.dead) run = (await me("/run", { fresh: true })).data, n = run.n;
  }
  assert.equal(seenAfter, true, "the demon the player just fought is marked seen");
});

test("a new run keeps the codex and a chosen name, and nothing else from the last run", async () => {
  const env = { DB: fakeD1() }, me = browser(env);
  await me("/run", {});
  const st = JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state);
  Object.assign(st, { codex: { demons: { ELF: { met: 3 } }, items: {} }, playerName: "MINNIE", pacts: [{ name: "ELF", on: true }], tags: ["fought"], raiseOk: true, silver: 40 });
  env.DB.raw.prepare("UPDATE runs SET state = ?").run(JSON.stringify(st));
  const run = (await me("/run", { fresh: true })).data.run;
  assert.equal(run.codex.demons.ELF.met, 3);
  assert.equal(run.playerName, "MINNIE");
  for (const k of ["pacts", "tags", "raiseOk"]) assert.equal(run[k], undefined, k);
  assert.equal(run.silver, 0);
});

test("(v1.36) a run's moments are sealed in the registry after the answer, and the board posts the server's numbers", async () => {
  const { createHash } = await import("node:crypto");
  const env = { DB: fakeD1() }, me = browser(env), sealed = [];
  env.REGISTRY = { async sealRun(a) { sealed.push(a); return { ok: true, created: true }; }, async addMark() { return { ok: true }; } };
  await me("/run", {});
  const put = (f) => { const st = JSON.parse(env.DB.raw.prepare("SELECT state FROM runs").get().state); f(st); env.DB.raw.prepare("UPDATE runs SET state = ?").run(JSON.stringify(st)); return st; };
  const st0 = put(() => {});
  const fp = createHash("sha256").update("4dungeon-run:" + st0.runId).digest("hex").slice(0, 32);
  // a new run: KURA wakes in the pit
  assert.deepEqual(sealed.map((m) => [m.game, m.run, m.moment, m.detail.turn]), [["4dungeon", fp, "enter", 0]]);
  // a plain move seals nothing
  await me("/act", { n: 0, action: { t: "turn", dir: "L" } });
  assert.equal(sealed.length, 1);
  // a demon appeased: the peace tally goes up on a move during the fight with THE HOUND
  const { runMoments } = await import("../game.js");
  const after = { ...st0, steps: 5, stats: { peace: 1 } };
  assert.deepEqual((await runMoments(after, { ...st0, encounter: { name: "THE HOUND" }, stats: { peace: 0 } })).map((m) => [m.moment, m.detail.demon, m.detail.turn]), [["talked_down", "THE HOUND", 5]]);
  // the run's end: the dark has risen and a new day comes
  const st = put((s) => { s.dungeon.deadline = -1; s.today.date -= 1; s.steps = 12; });
  const r = await me("/act", { n: 1, action: { t: "tick" } });
  assert.equal(r.data.run.dead, true);
  const end = sealed.at(-1);
  assert.equal(end.moment, "end"); assert.equal(end.run, fp); assert.equal(end.detail.end, "dark"); assert.equal(end.detail.turn, 12);
  assert.ok(!JSON.stringify(sealed).includes(st.runId), "the run id itself is never sent");
  const count = sealed.length;
  await me("/act", { n: 2, action: { t: "tick" } });                           // already over: nothing sealed again
  assert.equal(sealed.length, count);
  // the page claims a deeper floor and more turns; the board keeps the server's
  const post = await me("/score", { run: st.runId, name: "TESTER", floor: 4, days: 4, demons: 9, turns: 999, version: "t" });
  assert.equal(post.status, 200);
  assert.deepEqual({ ...env.DB.raw.prepare("SELECT floor, demons, turns FROM scores").get() }, { floor: st.climb || 1, demons: 0, turns: 12 });
  assert.equal((await me("/score", { run: "zzzzzzzzzzzzzzzz", name: "TESTER", floor: 1, days: 1, demons: 0, turns: 1 })).status, 400);   // not this player's run
});
