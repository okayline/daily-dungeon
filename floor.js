// Floor generation for the daily dungeon.
// A floor is four WINGS, each a small cluster of three spaces joined by open doors. KURA starts in the first wing.
// Each wing but the last has two LOCKED doors out of it: an OFFER of two rooms. The six room kinds are dealt out
// over the floor's three offers, so every kind is offered once, and she opens one door of each offer (one key a day).
// The room behind a door is the first space of the next wing. A wing holds:
//   - a room (the one she unlocked, with its kind; the start room has none),
//   - a PASSAGE (no kind, no demons, little in it), and
//   - a DEAD END, which hides a big clue about one of the wing's two locked doors,
// plus sometimes a FALSE DOOR (it looks locked, but it is only paint). The last wing has no locked doors:
// the stairs down are hidden in its passage or its dead end.
// A wing is built the moment its door is unlocked, so nothing past the next offer exists yet.
// Everything is rolled from the floor's seed, so a floor can be rolled again from it.
// Shared by the web page and node, like screen.js.
(function (root) {
  const DIRS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const KINDS = ["den", "bay", "relay", "vault", "forge", "altar"];
  const OPP = { N: "S", E: "W", S: "N", W: "E" };
  const OFFERS = 3, DAYS = 7;

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
  function shuffleWith(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function generate(seed = Math.floor(Math.random() * 2 ** 32)) {
    const rand = rng(seed);
    const deck = shuffleWith(KINDS.slice(), rand);
    const floor = { v: 5, seed, rooms: [], start: 0, stairs: -1, lure: -1, kinds: [],
      offers: [[deck[0], deck[1]], [deck[2], deck[3]], [deck[4], deck[5]]],      // the kinds offered, wing by wing
      lureStage: rand() < 0.6 ? 1 + Math.floor(rand() * 3) : -1,                // which wing hides the locker (?), if any
      wings: [], exits: {}, count: 0, pos: [], cells: {}, parent: [], depth: [] };
    buildWing(floor, book(floor, -1, 0, 0), null);
    return floor;
  }

  // Book a place on the grid for a space: its number, spot and depth. (The grid has no edges.)
  function book(floor, from, r, c) {
    const idx = floor.count++;
    floor.pos[idx] = { r, c }; floor.cells[r + "," + c] = idx;
    floor.parent[idx] = from; floor.depth[idx] = from < 0 ? 0 : floor.depth[from] + 1;
    return idx;
  }

  // Build the wing that begins with space k (booked, not built). `from` is the door it was entered by ({ dir, room }),
  // or null for the first wing. Lays out the three spaces, books the two locked exits, and fills every space.
  function buildWing(floor, k, from) {
    const stage = floor.wings.length;
    const rand = rng((floor.seed ^ Math.imul(stage + 7, 0x9e3779b1)) >>> 0);
    const R = n => Math.floor(rand() * n);
    const exitsWanted = stage < OFFERS ? 2 : 0;
    const back = from ? OPP[from.dir] : null;
    const at = (p, d) => ({ r: p.r + DIRS[d][0], c: p.c + DIRS[d][1] });
    const key = p => p.r + "," + p.c;

    // Cells to keep clear: next to any other door still locked (a sealed one never gets built), so that room keeps space to build its own wing.
    const halo = new Set();
    for (let j = 0; j < floor.count; j++) if (j !== k && !floor.rooms[j] && !(floor.sealed && floor.sealed[j])) for (const d of Object.keys(DIRS)) halo.add(key(at(floor.pos[j], d)));
    const roomy = (p, taken) => Object.keys(DIRS).filter(d => !(key(at(p, d)) in floor.cells) && !taken.has(key(at(p, d)))).length >= 3;

    // Try one layout: pick free cells for the spaces and the exits. Returns a plan, or null if it doesn't fit.
    // `tight` lets it ignore the keep-clear cells (only after many failed tries).
    function attempt(layout, tight) {
      const taken = new Set(), pos = { K: floor.pos[k] }, used = { K: new Set(back ? [back] : []), P: new Set(), X: new Set() };
      const out = (sp, isExit) => {                         // a free cell next to space sp, through a wall not yet used
        for (const d of shuffleWith(Object.keys(DIRS), rand)) {
          if (used[sp].has(d)) continue;
          const p = at(pos[sp], d), kk = key(p);
          if (kk in floor.cells || taken.has(kk) || (!tight && halo.has(kk))) continue;
          if (isExit && !tight && !roomy(p, taken)) continue;
          taken.add(kk); used[sp].add(d);
          return { d, p };
        }
        return null;
      };
      const plan = { layout, links: [], exits: [], falseDoors: { K: [], P: [], X: [] } };
      if (layout !== "solo") {
        const kp = out("K"); if (!kp) return null;
        pos.P = kp.p; used.P.add(OPP[kp.d]); plan.links.push({ a: "K", b: "P", d: kp.d });
        const host = layout === "chain" ? "P" : "K";        // the dead end hangs off the passage (chain) or the room (star)
        const x = out(host); if (!x) return null;
        pos.X = x.p; used.X.add(OPP[x.d]); plan.links.push({ a: host, b: "X", d: x.d });
      }
      const exitHosts = layout === "chain" ? ["K", "P"] : layout === "star" ? ["P", "P"] : ["K", "K"];
      for (let i = 0; i < exitsWanted; i++) {
        const e = out(exitHosts[i], true); if (!e) return null;
        plan.exits.push({ host: exitHosts[i], d: e.d, p: e.p });
      }
      // Sometimes a false door: one more door on a wall that has none (never the 4th door of a space).
      if (rand() < 0.4) {
        const spaces = Object.keys(pos).filter(s => used[s].size < 3);
        if (spaces.length) {
          const sp = spaces[R(spaces.length)], walls = Object.keys(DIRS).filter(d => !used[sp].has(d));
          if (walls.length) { const d = walls[R(walls.length)]; used[sp].add(d); plan.falseDoors[sp].push(d); }
        }
      }
      plan.pos = pos;
      return plan;
    }
    let plan = null;
    for (let tries = 0; !plan && tries < 600; tries++) plan = attempt(tries % 50 === 49 || tries >= 300 ? "solo" : rand() < 0.5 ? "chain" : "star", tries >= 40);
    if (!plan) { plan = { layout: "solo", links: [], exits: [], falseDoors: { K: [], P: [], X: [] }, pos: { K: floor.pos[k] } }; floor.stuck = (floor.stuck || 0) + 1; }   // never reached in practice

    // Commit the plan: book the spaces and the exits.
    const idx = { K: k };
    if (plan.pos.P) idx.P = book(floor, k, plan.pos.P.r, plan.pos.P.c);
    if (plan.pos.X) idx.X = book(floor, plan.links.find(l => l.b === "X").a === "P" ? idx.P : k, plan.pos.X.r, plan.pos.X.c);
    const doors = { K: {}, P: {}, X: {} };
    if (from) doors.K[back] = from.room;
    for (const l of plan.links) { doors[l.a][l.d] = idx[l.b]; doors[l.b][OPP[l.d]] = idx[l.a]; }
    const offer = shuffleWith(floor.offers[Math.min(stage, OFFERS - 1)].slice(), rand), exitIdx = [];
    plan.exits.forEach((e, i) => {
      const x = book(floor, idx[e.host], e.p.r, e.p.c);
      floor.kinds[x] = offer[i]; floor.exits[x] = { wing: stage, kind: offer[i], from: idx[e.host], dir: e.d };
      doors[e.host][e.d] = x; exitIdx.push(x);
    });
    const names = Object.keys(idx);
    // Where the special things go.
    const extra = { K: [], P: [], X: [] };
    if (stage === OFFERS) {                                  // the last wing: the stairs, in the passage or the dead end
      const home = names.includes("P") && names.includes("X") ? (R(2) ? "P" : "X") : names.includes("X") ? "X" : names.includes("P") ? "P" : "K";
      extra[home].push("stairs"); floor.stairs = idx[home];
    }
    if (stage === floor.lureStage) { const home = names.includes("X") ? "X" : "K"; extra[home].push("lure"); floor.lure = idx[home]; }
    const clueKind = exitIdx.length ? floor.kinds[exitIdx[R(exitIdx.length)]] : null;
    floor.wings[stage] = { rooms: names.map(n => idx[n]), exits: exitIdx, clueKind };

    for (const n of names) {
      const i = idx[n], rr = rng((floor.seed ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0);
      const RR = m => Math.floor(rr() * m), pickR = a => a[RR(a.length)];
      const kind = n === "K" ? floor.kinds[i] || null : null;
      const pile = extra[n].slice();
      const want = Math.max(extra[n].length, n === "P" ? RR(2) : n === "X" ? RR(3) : 1 + RR(3));
      while (pile.length < want) pile.push(pickR(n === "P" ? ["item", "silver"] : ["demon", "demon", "item", "item", "silver"]));
      if ((n === "X" || (n === "K" && !names.includes("X"))) && clueKind) pile.push("clue");          // the dead end's big clue (it doesn't count toward the pile's size)
      for (let j = pile.length - 1; j > 0; j--) { const m = RR(j + 1); [pile[j], pile[m]] = [pile[m], pile[j]]; }
      // A Recharge Bay is safe: its demons turn into items.
      const hidden = kind === "bay" ? pile.map(h => h === "demon" ? "item" : h) : pile;
      const room = { r: floor.pos[i].r, c: floor.pos[i].c, doors: doors[n], hidden, wing: stage };
      if (kind) room.kind = kind;
      if (n === "P") room.hall = true;                       // a passage
      if (n === "X") room.dead = true;                       // a dead end
      if (plan.falseDoors[n].length) room.falseDoors = plan.falseDoors[n];
      floor.rooms[i] = room;
    }
    return k;
  }

  // Open the door `dir` out of room `from`: build the wing behind it if it isn't built yet. Returns the room's number.
  function grow(floor, from, dir) {
    const i = floor.rooms[from].doors[dir];
    if (i === undefined) return undefined;
    if (!floor.sealed) floor.sealed = {};
    if (!floor.rooms[i]) {
      // Opening one door of an offer seals the other: she takes one room of the two.
      const e = floor.exits[i];
      if (e) for (const j of floor.wings[e.wing].exits) if (j !== i) floor.sealed[j] = true;
      buildWing(floor, i, { dir, room: from });
    }
    return i;
  }

  // A door whose offer was settled the other way: it stays shut for good.
  const isSealed = (floor, from, dir) => { const i = floor.rooms[from].doors[dir]; return i !== undefined && !floor.rooms[i] && !!(floor.sealed && floor.sealed[i]); };

  // What lies behind a locked door out of room `from`: its kind (the door's own room kind), or null.
  const kindBehind = (floor, from, dir) => {
    const i = floor.rooms[from].doors[dir];
    return i !== undefined && !floor.rooms[i] ? floor.kinds[i] || null : null;
  };

  // Minimap: only rooms KURA has been in are drawn, with door stubs leading out of them.
  // A visited room still holding the locker shows ?; a passage shows :; a locked (or false) door shows +.
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
    // Every room KURA has been in is outlined in + - | walls (neighbors share a wall), opened wherever there is a door
    // (open, locked, false or sealed), so a corner next to a door turns into - or |.
    const seen = [];
    floor.rooms.forEach((room, i) => {
      if (room && state.visited[i]) seen.push({ i, room, row: 2 + (room.r - here.r) * 2, col: 13 + (room.c - here.c) * 4 });
    });
    const wall = Array.from({ length: H }, () => Array(W).fill(false));
    const mark = (r, c, v) => { if (r >= 0 && r < H && c >= 0 && c < W) wall[r][c] = v; };
    for (const { row, col } of seen)
      for (let r = row - 1; r <= row + 1; r++) for (let c = col - 1; c <= col + 3; c++) if (r !== row || c === col - 1 || c === col + 3) mark(r, c, true);
    const open = (row, col, d) => {
      if (d === "E") mark(row, col + 3, false); if (d === "W") mark(row, col - 1, false);
      if (d === "S") for (let k = 0; k < 3; k++) mark(row + 1, col + k, false);
      if (d === "N") for (let k = 0; k < 3; k++) mark(row - 1, col + k, false);
    };
    for (const { room, row, col } of seen) { for (const d of Object.keys(room.doors)) open(row, col, d); for (const d of room.falseDoors || []) open(row, col, d); }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (wall[r][c]) {
      const n = r > 0 && wall[r - 1][c], s = r < H - 1 && wall[r + 1][c], w = c > 0 && wall[r][c - 1], e = c < W - 1 && wall[r][c + 1];
      rows[r][c] = (n || s) && (w || e) ? "+" : n || s ? "|" : "-";
    }
    seen.forEach(({ i, room, row, col }) => {
      const found = state.found[i] || [];
      const lureHere = i === floor.lure && !found.includes("lure");
      const mark = state.at === i ? "@" : i === floor.start ? "^"
        : found.includes("stairs") ? "v" : lureHere ? "?" : room.hall ? ":" : " ";   // : is a passage
      put(row, col, "[" + mark + "]");
      // Door marks sit in the opened gaps: = and ‖ for open doors, + for a locked or false one, x for a sealed one.
      const stub = (d, locked) => {
        if (d === "E") put(row, col + 3, locked ? "+" : "=");
        if (d === "W") put(row, col - 1, locked ? "+" : "=");
        if (d === "S") put(row + 1, col + 1, locked ? "+" : "‖");
        if (d === "N") put(row - 1, col + 1, locked ? "+" : "‖");
      };
      for (const d of Object.keys(room.doors)) {
        const j = room.doors[d], shut = !floor.rooms[j];
        stub(d, shut);
        if (shut && floor.sealed && floor.sealed[j]) {            // a sealed door shows x
          if (d === "E") put(row, col + 3, "x"); if (d === "W") put(row, col - 1, "x");
          if (d === "S") put(row + 1, col + 1, "x"); if (d === "N") put(row - 1, col + 1, "x");
        }
      }
      for (const d of room.falseDoors || []) stub(d, true);
    });
    // KURA's facing: an arrow in the gap on that side of her room (it covers the door mark there).
    const f = state.facing;
    if (f === "E") put(2, 16, ">"); else if (f === "W") put(2, 12, "<");
    else if (f === "N") put(1, 14, "^"); else if (f === "S") put(3, 14, "v");
    return rows.map(r => r.join("").replace(/\s+$/, ""));
  }

  // A fresh floor as KURA arrives: only the first wing is known.
  function arrive(floor, facing) {
    const firstDoor = Object.keys(floor.rooms[0].doors)[0];
    return { at: 0, visited: [true], found: [[]], facing: facing || firstDoor };
  }

  const api = { generate, grow, minimap, arrive, rng, kindBehind, isSealed, DAYS, OFFERS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FLOOR = api;
})(this);
