// Floor generation for the daily dungeon.
// A floor grows door by door on a 5x5 grid. Only the start room exists when KURA arrives, but two places are fixed
// from the start: the stairs down, at the end of a hidden PATH of 2-4 doors, and (usually) the locker ?, one door off
// that path. The path cells are claimed up front so no other branch can block them. A room on the path always has a
// door to the next path cell, plus other doors rolled freely, so some doors lead closer and some don't. A door out of
// a room only books a spot; what the place IS (a room with a kind, or a passage with more locked doors) is rolled the
// moment the day's key opens the door. KURA starts in room 0 (stairs up).
// Shared by the web page and node, like screen.js.
(function (root) {
  const DIRS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const KINDS = ["den", "bay", "relay", "vault", "forge", "altar"];
  const OPP = { N: "S", E: "W", S: "N", W: "E" };
  const DAYS = 7;

  // Small seeded random generator, so a floor can be rolled again from its seed.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const GRID = 5, MAX = 12;

  function generate(seed = Math.floor(Math.random() * 2 ** 32), days = 7) {
    const rand = rng(seed);
    const R = n => Math.floor(rand() * n);
    const deck = shuffleWith(KINDS.slice(), rand);
    const start = { r: 1 + R(3), c: 1 + R(3) };
    // The path to the stairs: a random walk of D doors that never crosses itself. D is limited by the days the floor
    // is open (3 days: 2 doors; a week: up to 4), so it can always be finished in time.
    const D = 2 + R(Math.max(2, Math.min(4, Math.floor(days / 2) + 1)) - 1);
    let path;
    for (let tries = 0; ; tries++) {
      path = [start];
      while (path.length <= D) {
        const at = path[path.length - 1];
        const opts = Object.values(DIRS).map(([dr, dc]) => ({ r: at.r + dr, c: at.c + dc }))
          .filter(p => p.r >= 0 && p.r < GRID && p.c >= 0 && p.c < GRID && !path.some(q => q.r === p.r && q.c === p.c));
        if (!opts.length) break;
        path.push(opts[R(opts.length)]);
      }
      if (path.length > D) break;
    }
    const plan = {};
    path.forEach((p, k) => { plan[p.r + "," + p.c] = "path"; });
    // The locker: usually, one cell off the path (not off the stairs room), reached by a door out of path room lureStep.
    let lureAt = null, lureStep = -1;
    if (rand() < 0.6) {
      const k = R(D), at = path[k];
      const opts = Object.values(DIRS).map(([dr, dc]) => ({ r: at.r + dr, c: at.c + dc }))
        .filter(p => p.r >= 0 && p.r < GRID && p.c >= 0 && p.c < GRID && !(p.r + "," + p.c in plan));
      if (opts.length) { lureAt = opts[R(opts.length)]; lureStep = k; plan[lureAt.r + "," + lureAt.c] = "lure"; }
    }
    const floor = { v: 4, seed, size: GRID, max: MAX, rooms: [], start: 0, stairs: -1, lure: -1, lureAt, lureStep,
      path, D, plan, onPath: { 0: 0 }, kinds: [], halls: {}, deck, count: 1, pos: [start], cells: { [start.r + "," + start.c]: 0 },
      parent: [-1], depth: [0] };
    floor.rooms[0] = build(floor, 0, null);
    return floor;
  }
  function shuffleWith(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Book a place behind a door out of room `from`, toward cell (r, c): its number, spot and depth are fixed now.
  // A place on the path knows its step; the last step is the stairs, and the locker's cell is the locker.
  function reserve(floor, from, r, c) {
    const idx = floor.count++;
    floor.pos[idx] = { r, c }; floor.cells[r + "," + c] = idx;
    floor.parent[idx] = from; floor.depth[idx] = floor.depth[from] + 1;
    const plan = floor.plan[r + "," + c];
    if (plan === "path") {
      const k = floor.path.findIndex(p => p.r === r && p.c === c);
      floor.onPath[idx] = k;
      if (k === floor.D) floor.stairs = idx;
    } else if (plan === "lure") floor.lure = idx;
    return idx;
  }

  // Decide what a booked place is, the moment its door is opened: two places in five are a PASSAGE (no kind, little
  // in it, no demons, but two more locked doors), otherwise a room with a kind. The stairs and the locker are always rooms.
  // This roll ignores the party and the run entirely.
  function decide(floor, idx) {
    const rand = rng((floor.seed ^ Math.imul(idx + 101, 0x85ebca6b)) >>> 0);
    if (idx !== floor.stairs && idx !== floor.lure && floor.depth[idx] >= 1 && rand() < 0.4) floor.halls[idx] = true;
    else {
      if (!floor.deck.length) floor.deck = shuffleWith(KINDS.slice(), rand);   // every kind turns up before any repeats
      floor.kinds[idx] = floor.deck.pop();
    }
  }

  // Build room i (its walls, doors and hidden things). `from` is the door it was entered by ({ dir, room }), or null for the start room.
  // Hidden things: 0-3 per room, in a random order. SEARCH reveals them front to back.
  function build(floor, i, from) {
    const rand = rng((floor.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    const R = n => Math.floor(rand() * n);
    const pick = a => a[R(a.length)];
    const { r, c } = floor.pos[i], doors = {};
    if (from) doors[OPP[from.dir]] = from.room;
    const hall = !!floor.halls[i];
    // New doors out of this room, onto free cells. An Altar room keeps 2+ bare walls (the terminal's, and the stairs' if
    // they are here); a passage opens two. The stairs room looks like any other: same door counts.
    const kind = floor.kinds[i], cap = kind === "altar" ? 1 : 2;
    const want = i === 0 ? 2 + R(2) : hall ? 2 : 1 + R(cap);
    const dirTo = (a, b) => Object.keys(DIRS).find(d => a.r + DIRS[d][0] === b.r && a.c + DIRS[d][1] === b.c);
    // The doors the plan needs come first: on to the next path cell, and off to the locker.
    const k = floor.onPath[i];
    if (k !== undefined && k < floor.D) { const d = dirTo(floor.pos[i], floor.path[k + 1]); doors[d] = reserve(floor, i, floor.path[k + 1].r, floor.path[k + 1].c); }
    if (k === floor.lureStep && floor.lureAt) { const d = dirTo(floor.pos[i], floor.lureAt); doors[d] = reserve(floor, i, floor.lureAt.r, floor.lureAt.c); }
    // Then other doors, rolled freely onto cells the plan doesn't need.
    const free = shuffleWith(Object.keys(DIRS).filter(d => !(d in doors)).filter(d => {
      const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
      return nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !(nr + "," + nc in floor.cells) && !(nr + "," + nc in floor.plan);
    }), rand);
    for (const d of free) {
      if (Object.keys(doors).length - (from ? 1 : 0) >= want || floor.count >= floor.max) break;
      doors[d] = reserve(floor, i, r + DIRS[d][0], c + DIRS[d][1]);
    }
    const isHall = !!floor.halls[i];
    const pile = [];
    if (i === floor.stairs) pile.push("stairs");
    if (i === floor.lure) pile.push("lure");
    const n = Math.max(pile.length, isHall ? R(2) : 1 + R(3));
    while (pile.length < n) pile.push(pick(["demon", "demon", "item", "item", "silver"]));
    for (let k = pile.length - 1; k > 0; k--) { const j = R(k + 1); [pile[k], pile[j]] = [pile[j], pile[k]]; }
    // A Recharge Bay or a passage is safe: its demons turn into items.
    const k2 = floor.kinds[i];
    const hidden = k2 === "bay" || isHall ? pile.map(h => h === "demon" ? "item" : h) : pile;   // no demons hide in a Bay or a passage
    const room = { r, c, doors, hidden };
    if (isHall) room.hall = true; else if (k2) room.kind = k2;
    return room;
  }

  // Open the door `dir` out of room `from`: decide and build the room behind it if it isn't built yet. Returns its number.
  function grow(floor, from, dir) {
    const i = floor.rooms[from].doors[dir];
    if (i === undefined) return undefined;
    if (!floor.rooms[i]) { decide(floor, i); floor.rooms[i] = build(floor, i, { dir, room: from }); }
    return i;
  }

  // Minimap: only rooms KURA has been in are drawn, with door stubs leading out of them.
  // A visited room still holding the locker shows ?; a passage shows :; a locked door shows +.
  // state: { at: room index, visited: [bool,bool,bool], found: [names found per room], facing }
  // The map is centered on KURA: her room is always in the middle and the floor moves around her.
  // Rooms two steps away up or down fall outside the 5 rows and stay off the map.
  function minimap(floor, state) {
    // One symbol per room: [@] KURA, [^] the way up, [v] stairs down once found, [?] the lure,
    // [ ] a visited room. Doors: = between rooms side by side, ‖ between stacked rooms.
    const W = 29, H = 5, rows = Array.from({ length: H }, () => Array(W).fill(" "));
    const put = (r, c, s) => [...s].forEach((ch, k) => {
      if (r >= 0 && r < H && c + k >= 0 && c + k < W) rows[r][c + k] = ch;
    });
    const here = floor.rooms[state.at];
    // The locker's room may not be built yet: its ? still shows in the dark where it will be.
    if (floor.lureAt && !floor.rooms[floor.lure]) {
      const row = 2 + (floor.lureAt.r - here.r) * 2, col = 13 + (floor.lureAt.c - here.c) * 4;
      put(row, col + 1, "?");
    }
    floor.rooms.forEach((room, i) => {
      if (!room) return;                        // (a saved floor has null where a room isn't built yet)
      const row = 2 + (room.r - here.r) * 2, col = 13 + (room.c - here.c) * 4;
      const found = state.found[i] || [];
      const lureHere = i === floor.lure && !found.includes("lure");
      if (!state.visited[i]) return;
      const mark = state.at === i ? "@" : i === floor.start ? "^"
        : found.includes("stairs") ? "v" : lureHere ? "?" : room.hall ? ":" : " ";   // : is a passage
      put(row, col, "[" + mark + "]");
      // Door stubs out of a visited room, so the next room shows it exists.
      // (a locked door, whose room isn't built yet, shows as +)
      for (const d of Object.keys(room.doors)) {
        const locked = !floor.rooms[room.doors[d]];
        if (d === "E") put(row, col + 3, locked ? "+" : "=");
        if (d === "W") put(row, col - 1, locked ? "+" : "=");
        if (d === "S") put(row + 1, col + 1, locked ? "+" : "‖");
        if (d === "N") put(row - 1, col + 1, locked ? "+" : "‖");
      }
    });
    // KURA's facing: an arrow in the gap on that side of her room (it covers the door mark there).
    const f = state.facing;
    if (f === "E") put(2, 16, ">"); else if (f === "W") put(2, 12, "<");
    else if (f === "N") put(1, 14, "^"); else if (f === "S") put(3, 14, "v");
    return rows.map(r => r.join("").replace(/\s+$/, ""));
  }

  // A fresh floor as KURA arrives: only the start room is known.
  function arrive(floor, facing) {
    const firstDoor = Object.keys(floor.rooms[0].doors)[0];
    return { at: 0, visited: [true], found: [[]], facing: facing || firstDoor };
  }

  // Which door out of room i leads toward the stairs: on the path, the next path door; off it, back toward the path.
  // null in the stairs room itself.
  function towardStairs(floor, i) {
    const k = floor.onPath[i];
    if (k === floor.D) return null;
    const to = k !== undefined ? Object.keys(floor.rooms[i].doors).find(d => floor.rooms[i].doors[d] !== floor.parent[i] && floor.onPath[floor.rooms[i].doors[d]] === k + 1)
      : Object.keys(floor.rooms[i].doors).find(d => floor.rooms[i].doors[d] === floor.parent[i]);
    return to || null;
  }
  // How many doors from room i to the stairs, along the floor: down the path, plus the climb back to it from a side room.
  function distToStairs(floor, i) {
    let up = 0;
    while (floor.onPath[i] === undefined) { i = floor.parent[i]; up++; }
    return up + floor.D - floor.onPath[i];
  }
  const api = { generate, grow, minimap, arrive, rng, DAYS, towardStairs, distToStairs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FLOOR = api;
})(this);
