// Leaderboard for Daily Digital Demon Dungeon: a Cloudflare Worker with a D1 database.
//   POST /score   {run, name, floor, days, demons, turns, version}   -> {ok, rank}
//   GET  /top?n=20&run=ID                                      -> {rows: [...], you: {...} | null}
// Ranked by deepest floor, then most days survived, then whoever got there first. TURNS are shown but never ranked (spam).
// The game saves in the player's browser, so scores can't be proven: the checks below only keep out the casual junk.
const MAX = { floor: 20, days: 400 };
const json = (data, status, origin) => new Response(JSON.stringify(data), { status: status || 200, headers: {
  "content-type": "application/json", "access-control-allow-origin": origin || "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS", "access-control-allow-headers": "content-type, x-admin-key" } });
const hash = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");

async function rankOf(db, row) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM scores WHERE floor > ?1 OR (floor = ?1 AND days > ?2) OR (floor = ?1 AND days = ?2 AND made < ?3)`)
    .bind(row.floor, row.days, row.made).first();
  return r.n + 1;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), allow = env.ALLOW_ORIGIN || "*";
    if (req.method === "OPTIONS") return json({}, 204, allow);

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

    // Removing an entry takes the admin key (a Worker secret: `npx wrangler secret put ADMIN_KEY`).
    if (url.pathname === "/score" && req.method === "DELETE") {
      if (!env.ADMIN_KEY || req.headers.get("x-admin-key") !== env.ADMIN_KEY) return json({ error: "forbidden" }, 403, allow);
      const id = Number(url.searchParams.get("id"));
      if (!Number.isInteger(id)) return json({ error: "invalid" }, 400, allow);
      const r = await env.DB.prepare(`DELETE FROM scores WHERE rowid = ?1`).bind(id).run();
      return json({ ok: true, removed: (r.meta && r.meta.changes) || 0 }, 200, allow);
    }

    if (url.pathname === "/score" && req.method === "POST") {
      if (env.ALLOW_ORIGIN && req.headers.get("origin") !== env.ALLOW_ORIGIN) return json({ error: "origin" }, 403, allow);
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
      await env.DB.prepare(`INSERT OR IGNORE INTO scores (run, name, floor, days, demons, turns, version, made, who) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
        .bind(run, name, floor, days, demons, turns, String(b.version || "").slice(0, 12), now, who).run();
      const row = await env.DB.prepare(`SELECT name, floor, days, demons, turns, made FROM scores WHERE run = ?1`).bind(run).first();
      return json({ ok: true, rank: await rankOf(env.DB, row) }, 200, allow);
    }
    return json({ error: "not found" }, 404, allow);
  },
};
