// Floor generation for the daily dungeon.
// A floor is a short run of ROOMS, one for each day of the week it lasts. KURA stands in exactly one at a time.
// Every room but the last two has two LOCKED doors: an OFFER of two rooms. She opens one (the day's one charge),
// the other SEALS for good, and once she steps through, the door shuts behind her: there is no going back.
// The six room kinds are dealt out over the floor's offers, so each kind is offered before any repeats.
// A room is one space with six faces to search: its walls that have no door, its ceiling and its floor.
// The floor's last offer room hides the stairs down under its floor. It also has one more door, the WILDCARD:
// one extra room for anyone with a day to spare, with stairs of its own.
// A room is built the moment its door is unlocked, so nothing past the next offer exists yet.
// Everything is rolled from the floor's two seeds, so a floor can be rolled again from them.
// Shared by the web page and node, like screen.js.
(function (root) {
  const DIRS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const KINDS = ["den", "bay", "relay", "vault", "forge", "altar"];
  // The seventh and eighth kinds (THE ARCHIVE, a bonus room, and THE VOID, its opposite) are PARKED:
  // they used to take over a wing's passage or dead end, and a one-room floor has neither. Nothing
  // places them now (see BONUS_ROOMS in rules.js). To be redesigned for one-room floors.
  const BONUS_KIND = "archive", ANTI_KIND = "void";
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
  function shuffleWith(a, rand) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // The week's deck: the six kinds dealt twice into pairs (never the same kind twice in a pair), one pair for each of
  // days 1 to (days-1). The last door is a wildcard: one door of a random kind.
  // opts.days is how many days this floor lasts (up to 7).
  //
  // Two seeds, two different jobs (the "shared offers, private rooms" split):
  //   `seed` (shared) decides which two kinds are offered together, day by day. Every player on the same
  //     (epoch, floor depth) faces the same pairs in the same order.
  //   `pseed` (private, per account) decides everything that would turn that into a walkthrough if shared:
  //     which wall each door is on, which kind is behind which door, where things are hidden, and the
  //     wildcard's kind. Re-rolled every floor.
  function generate(seed = Math.floor(Math.random() * 2 ** 32), pseed = Math.floor(Math.random() * 2 ** 32), opts = {}) {
    const rand = rng(seed), prand = rng(pseed);
    const days = Math.max(3, Math.min(DAYS, opts.days || DAYS)), pairs = days - 1;
    let deck;
    for (let tries = 0; ; tries++) {
      deck = shuffleWith(KINDS.slice(), rand).concat(shuffleWith(KINDS.slice(), rand));
      if (tries > 200 || Array.from({ length: 6 }, (_, i) => deck[2 * i] !== deck[2 * i + 1]).every(Boolean)) break;
    }
    const offers = Array.from({ length: pairs }, (_, i) => [deck[(2 * i) % 12], deck[(2 * i + 1) % 12]]);
    offers.push([KINDS[Math.floor(prand() * KINDS.length)]]);      // the wildcard door: private, per account -- never drawn from the shared deck
    const floor = { v: 8, seed, pseed, days, pairs, rooms: [], start: 0, lure: -1, kinds: [],
      offers,                                                                  // the kinds offered, room by room (shared)
      lureStage: prand() < 0.6 ? 1 + Math.floor(prand() * pairs) : -1,         // which room hides the locker (?), if any (private)
      exits: {}, sealed: {}, count: 0, pos: [], cells: {} };
    buildRoom(floor, book(floor, 0, 0), null);
    return floor;
  }

  // Book a place on the grid for a room: its number and spot. (The grid has no edges.)
  function book(floor, r, c) {
    const idx = floor.count++;
    floor.pos[idx] = { r, c }; floor.cells[r + "," + c] = idx;
    return idx;
  }

  // Build room k (booked, not built). `from` is the room it was entered from, or null for the first room.
  // Picks the walls its locked doors sit on, books the rooms behind them, and hides the room's things.
  function buildRoom(floor, k, from) {
    const stage = from === null ? 0 : floor.rooms[from].stage + 1;
    const prand = rng((floor.pseed ^ Math.imul(stage + 7, 0x9e3779b1)) >>> 0);   // private: this room's own stream
    const PR = n => Math.floor(prand() * n);
    const exitsWanted = stage < floor.pairs ? 2 : stage === floor.pairs ? 1 : 0;   // the last offer room has one door: the wildcard
    const back = from === null ? null : OPP[floor.exits[k].dir];                   // the wall she came in by: shut for good behind her
    const here = floor.pos[k], at = d => ({ r: here.r + DIRS[d][0], c: here.c + DIRS[d][1] }), key = p => p.r + "," + p.c;

    // Which walls the doors are on is private. The path never doubles back over itself on the map: a door
    // prefers a wall with nothing behind it yet, then one whose only neighbor is a room that was sealed
    // off unbuilt (it never shows), and only then anything at all.
    const walls = shuffleWith(Object.keys(DIRS).filter(d => d !== back), prand);
    const rank = d => { const j = floor.cells[key(at(d))]; return j === undefined ? 0 : !floor.rooms[j] && floor.sealed[j] ? 1 : 2; };
    const chosen = walls.map((d, i) => ({ d, i, r: rank(d) })).sort((a, b) => a.r - b.r || a.i - b.i).slice(0, exitsWanted).map(x => x.d);

    // Which paired kind is behind which door is private too: the pair itself ("vault or forge today") is
    // shared and safe to say out loud, but which door is which would spoil it.
    const offer = shuffleWith(floor.offers[Math.min(stage, floor.pairs)].slice(), prand), doors = {}, exitIdx = [];
    chosen.forEach((d, i) => {
      const p = at(d), x = book(floor, p.r, p.c);
      floor.kinds[x] = offer[i]; floor.exits[x] = { from: k, kind: offer[i], dir: d };
      doors[d] = x; exitIdx.push(x);
    });
    const clueKind = exitIdx.length ? floor.kinds[exitIdx[PR(exitIdx.length)]] : null;   // what the room's scrap of writing gives away

    // What the room hides. The stairs are under the floor of the last offer room and of the wildcard room.
    const rr = rng((floor.pseed ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0), RR = m => Math.floor(rr() * m), pickR = a => a[RR(a.length)];
    const kind = floor.kinds[k] || null;
    const pile = [];
    if (stage >= floor.pairs) pile.push("stairs");
    if (stage === floor.lureStage) { pile.push("lure"); floor.lure = k; }
    for (let n = 2 + RR(3); n > 0; n--) pile.push(pickR(["demon", "demon", "item", "item", "silver"]));
    if (clueKind) pile.push("clue");                             // a scrap that says what one of the doors is (never which)
    for (let j = pile.length - 1; j > 0; j--) { const m = RR(j + 1); [pile[j], pile[m]] = [pile[m], pile[j]]; }
    const hidden = kind === "bay" ? pile.map(h => h === "demon" ? "item" : h) : pile;   // a Recharge Bay is safe: its demons turn into items

    const room = { r: here.r, c: here.c, doors, hidden, stage, exits: exitIdx, clueKind };
    if (back) { room.back = back; room.from = from; }
    if (kind) room.kind = kind;
    floor.rooms[k] = room;
    return k;
  }

  // Open the door `dir` out of room `from`: build the room behind it if it isn't built yet. Returns the room's number.
  function grow(floor, from, dir) {
    const i = floor.rooms[from].doors[dir];
    if (i === undefined) return undefined;
    if (!floor.rooms[i]) {
      // Opening one door of an offer seals the other: she takes one room of the two.
      for (const j of floor.rooms[from].exits) if (j !== i) floor.sealed[j] = true;
      buildRoom(floor, i, from);
    }
    return i;
  }

  // A door that will never open: the other door of an offer that was settled, or the door she came in by.
  const isSealed = (floor, from, dir) => {
    const room = floor.rooms[from], i = room.doors[dir];
    return room.back === dir || (i !== undefined && !floor.rooms[i] && !!floor.sealed[i]);
  };

  // What lies behind a locked door out of room `from`: its kind, or null.
  const kindBehind = (floor, from, dir) => {
    const i = floor.rooms[from].doors[dir];
    return i !== undefined && !floor.rooms[i] ? floor.kinds[i] || null : null;
  };

  // The map: the path KURA has taken across this floor, one box for each room she has stood in, laid out the
  // way she actually walked (the east door puts the next room to the east). Her room is always in the middle.
  //   [@] KURA   [^] where she came down   [ ] a room behind her
  //   #  a locked door   x  a door sealed for good   a gap in the wall: the way she went
  // state: { at: room index, visited: [bool...], facing }
  function minimap(floor, state) {
    const W = 29, H = 5, rows = Array.from({ length: H }, () => Array(W).fill(" "));
    const put = (r, c, s) => [...s].forEach((ch, k) => { if (r >= 0 && r < H && c + k >= 0 && c + k < W) rows[r][c + k] = ch; });
    const here = floor.rooms[state.at];
    const seen = [];
    floor.rooms.forEach((room, i) => {
      if (room && state.visited[i]) seen.push({ i, room, row: 2 + (room.r - here.r) * 2, col: 13 + (room.c - here.c) * 4 });
    });
    // Every room is outlined in + - | walls; rooms side by side share a wall.
    const wall = Array.from({ length: H }, () => Array(W).fill(false)), vert = Array.from({ length: H }, () => Array(W).fill(false));
    const mark = (r, c, v) => { if (r >= 0 && r < H && c >= 0 && c < W) wall[r][c] = v; };
    for (const { row, col } of seen)
      for (let r = row - 1; r <= row + 1; r++) for (let c = col - 1; c <= col + 3; c++) if (r !== row || c === col - 1 || c === col + 3) {
        mark(r, c, true);
        if ((c === col - 1 || c === col + 3) && r >= 0 && r < H && c >= 0 && c < W) vert[r][c] = true;   // a side wall keeps going past the edge of the window
      }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (wall[r][c]) {
      const n = r > 0 ? wall[r - 1][c] : vert[r][c], s = r < H - 1 ? wall[r + 1][c] : vert[r][c], w = c > 0 && wall[r][c - 1], e = c < W - 1 && wall[r][c + 1];
      rows[r][c] = (n || s) && (w || e) ? "+" : n || s ? "|" : "-";
    }
    // A mark in the middle of a room's wall on side d: one cell for E/W, the middle of the three for N/S.
    const stub = (row, col, d, ch) => {
      if (d === "E") put(row, col + 3, ch); if (d === "W") put(row, col - 1, ch);
      if (d === "S") put(row + 1, col + 1, ch); if (d === "N") put(row - 1, col + 1, ch);
    };
    seen.forEach(({ i, room, row, col }) => {
      put(row, col, "[" + (state.at === i ? "@" : i === floor.start ? "^" : " ") + "]");
      for (const d of Object.keys(room.doors)) {
        const j = room.doors[d];
        stub(row, col, d, floor.rooms[j] ? " " : floor.sealed[j] ? "x" : "#");     // the way she went, a sealed door, a locked one
      }
    });
    // KURA's facing: an arrow in the wall on that side of her room. A door's own mark always stays on top of it.
    const f = state.facing, arrow = (r, c, ch) => { if (!"#x".includes(rows[r][c])) put(r, c, ch); };
    if (f === "E") arrow(2, 16, ">"); else if (f === "W") arrow(2, 12, "<");
    else if (f === "N") arrow(1, 14, "^"); else if (f === "S") arrow(3, 14, "v");
    return rows.map(r => r.join("").replace(/\s+$/, ""));
  }

  // A fresh floor as KURA arrives: only the first room is known.
  function arrive(floor, facing) {
    const firstDoor = Object.keys(floor.rooms[0].doors)[0];
    return { at: 0, visited: [true], found: [[]], facing: facing || firstDoor };
  }

  const api = { generate, grow, minimap, arrive, rng, kindBehind, isSealed, DAYS, BONUS_KIND, ANTI_KIND };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FLOOR = api;
})(this);
