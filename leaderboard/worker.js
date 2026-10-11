// Leaderboard for Daily Digital Demon Dungeon: a Cloudflare Worker with a D1 database.
//   POST /score   {run, name, floor, days, demons, turns, version, align}   -> {ok, rank}
//   GET  /top?n=20&run=ID                                      -> {rows: [...], you: {...} | null}
//   GET  /season                                               -> {epoch, law, chaos}
// Ranked by deepest floor, then most days survived, then whoever got there first. TURNS are shown but never ranked (spam).
// The game saves in the player's browser, so scores can't be proven: the checks below only keep out the casual junk.
const MAX = { floor: 20, days: 400 };
// Same lunar-epoch math as screen.js's epochIndex -- a whole-number count of real lunar months since
// the same new-moon reference, so it's identical for every player (and this Worker) at every instant.
// Deliberately re-derived here rather than imported: the Worker never loads game code, just this one formula.
const EPOCH_REF = Date.UTC(2000, 0, 6, 18, 14), EPOCH_SYN = 29.530588853;
const epochIndex = () => Math.floor((Date.now() - EPOCH_REF) / 86400000 / EPOCH_SYN);
const SIDES = ["LAW", "CHAOS"];

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
const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-admin-key", "access-control-max-age": "86400" });
const json = (data, status, origin) => new Response(JSON.stringify(data), { status: status || 200, headers: { "content-type": "application/json", ...cors() } });
const hash = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");

async function rankOf(db, row) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE floor > ?1 OR (floor = ?1 AND days > ?2) OR (floor = ?1 AND days = ?2 AND made < ?3)`)
    .bind(row.floor, row.days, row.made).first();
  return r.n + 1;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), allow = "*";
    // ALLOW_ORIGIN: the pages allowed to post or delete, comma-separated (blank: any page). Everyone may read the board.
    const pages = String(env.ALLOW_ORIGIN || "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
    const from = req.headers.get("origin") || "", pageOk = !pages.length || pages.includes(from);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });   // a 204 must have no body, or the browser's preflight fails

    if (url.pathname === "/top" && req.method === "GET") {
      const n = Math.max(1, Math.min(50, Number(url.searchParams.get("n")) || 20)), run = url.searchParams.get("run") || "";
      const top = await env.DB.prepare(`SELECT rowid AS id, run, name, floor, days, demons, turns FROM scores ORDER BY floor DESC, days DESC, made ASC LIMIT ?1`).bind(n).all();
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
      if (align && (ins.meta && ins.meta.changes)) await tallyFaction(env.DB, align, floor);
      const row = await env.DB.prepare(`SELECT name, floor, days, demons, turns, made FROM scores WHERE run = ?1`).bind(run).first();
      return json({ ok: true, rank: await rankOf(env.DB, row) }, 200, allow);
    }
    return json({ error: "not found" }, 404, allow);
  },
};
