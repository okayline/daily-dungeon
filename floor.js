// Floor generation for the daily dungeon.
// A floor is 3 rooms in a 3x3 grid, joined by doors in a line or an L.
// KURA starts in room 0 (stairs up). The stairs down are hidden in one of the other rooms,
// and every room holds 1-3 hidden things that SEARCH turns up one per day.
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

  function generate(seed = Math.floor(Math.random() * 2 ** 32)) {
    const rand = rng(seed);
    const R = n => Math.floor(rand() * n);
    const pick = a => a[R(a.length)];
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = R(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // Rooms: a random walk of 3 cells inside the 3x3 grid. Each step adds a door both ways.
    const rooms = [{ r: R(3), c: R(3), doors: {}, hidden: [] }];
    while (rooms.length < 3) {
      const last = rooms[rooms.length - 1];
      const open = Object.entries(DIRS)
        .map(([d, [dr, dc]]) => ({ d, r: last.r + dr, c: last.c + dc }))
        .filter(p => p.r >= 0 && p.r < 3 && p.c >= 0 && p.c < 3 && !rooms.some(q => q.r === p.r && q.c === p.c));
      const p = pick(open);
      const i = rooms.length;
      last.doors[p.d] = i;
      rooms.push({ r: p.r, c: p.c, doors: { [OPP[p.d]]: i - 1 }, hidden: [] });
    }

    // The stairs down: usually the farthest room, sometimes the middle one. Never the start.
    const stairs = rand() < 0.7 ? 2 : 1;
    // The ? locker (a rare item for now): about 1 floor in 4 has one, never in the start room.
    const lure = rand() < 0.25 ? pick([1, 2]) : -1;

    // Hidden things: 1-3 per room, in a random order. SEARCH reveals them front to back.
    for (let i = 0; i < 3; i++) {
      const pile = [];
      if (i === stairs) pile.push("stairs");
      if (i === lure) pile.push("lure");
      const n = Math.max(pile.length, 1 + R(3));
      while (pile.length < n) pile.push(pick(["demon", "demon", "item", "item", "silver"]));
      rooms[i].hidden = shuffle(pile);
    }

    // Promise: going straight to the stairs room and searching it always fits in the week.
    // (moves to get there + every search in that room + 1 to descend)
    const worst = stairs + rooms[stairs].hidden.length + 1;
    if (worst > DAYS) throw new Error(`floor ${seed} can't be finished in ${DAYS} days`);

    // Room kinds: rooms 1 and 2 each get a different one of six (drawn last, so the layout and
    // contents of older seeds stay as they were). The start room is plain. A Recharge Bay is safe:
    // its demons turn into items.
    const kinds = shuffle(KINDS.slice());
    rooms[1].kind = kinds[0]; rooms[2].kind = kinds[1];
    for (const rm of rooms) if (rm.kind === "bay") rm.hidden = rm.hidden.map(h => h === "demon" ? "item" : h);

    return { seed, rooms, start: 0, stairs, lure };
  }

  // Minimap: only rooms KURA has been in are drawn, with door stubs leading out of them.
  // The ? shows in the dark at the lure room until it's found.
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
    floor.rooms.forEach((room, i) => {
      const row = 2 + (room.r - here.r) * 2, col = 13 + (room.c - here.c) * 4;
      const found = state.found[i] || [];
      const lureHere = i === floor.lure && !found.includes("lure");
      if (!state.visited[i]) {
        if (lureHere) put(row, col + 1, "?");   // the lure, glimpsed in the dark
        return;
      }
      const mark = state.at === i ? "@" : i === floor.start ? "^"
        : found.includes("stairs") ? "v" : lureHere ? "?" : " ";
      put(row, col, "[" + mark + "]");
      // Door stubs out of a visited room, so the next room shows it exists.
      for (const d of Object.keys(room.doors)) {
        if (d === "E") put(row, col + 3, "=");
        if (d === "W") put(row, col - 1, "=");
        if (d === "S") put(row + 1, col + 1, "‖");
        if (d === "N") put(row - 1, col + 1, "‖");
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
    return { at: 0, visited: [true, false, false], found: [[], [], []], facing: facing || firstDoor };
  }

  const api = { generate, minimap, arrive, rng, DAYS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FLOOR = api;
})(this);
