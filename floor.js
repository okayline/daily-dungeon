// Floor generation for the daily dungeon.
// A floor is a short run of ROOMS, one for each day of the week it lasts. KURA stands in exactly one at a time.
// Every room but the last two has two LOCKED doors, side by side in the wall ahead: LEFT and RIGHT, an OFFER of
// two rooms. She opens one (the day's one charge), the other SEALS for good, and once she steps through, the door
// shuts behind her: there is no going back. The six room kinds are dealt out over the floor's offers.
// A room has the door wall ahead (north), the way back behind, two bare walls and a floor to search, and the sky.
// The floor's last offer room hides the stairs down under its floor. It also has one more door, the WILDCARD:
// one extra room for anyone with a day to spare, with stairs of its own.
// A room is built the moment its door is unlocked, so nothing past the next offer exists yet.
// Everything is rolled from the floor's two seeds, so a floor can be rolled again from them.
// Shared by the web page and node, like screen.js.
(function (root) {
  const KINDS = ["den", "bay", "relay", "vault", "forge", "altar"];
  // The seventh and eighth kinds (THE ARCHIVE, a bonus room, and THE VOID, its opposite) are PARKED:
  // they used to take over a wing's passage or dead end, and a one-room floor has neither. Nothing
  // places them now (see BONUS_ROOMS in rules.js). To be redesigned for one-room floors.
  const BONUS_KIND = "archive", ANTI_KIND = "void";
  const AHEAD = "N", BACK = "S";                 // every room faces the same way: doors ahead, the way back behind
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
  //     which kind is behind the left door and which behind the right, where things are hidden, and the
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
    const floor = { v: 9, seed, pseed, days, pairs, rooms: [], start: 0, lure: -1, kinds: [],
      offers,                                                                  // the kinds offered, room by room (shared)
      lureStage: prand() < 0.6 ? 1 + Math.floor(prand() * pairs) : -1,         // which room hides the locker (?), if any (private)
      exits: {}, sealed: {}, count: 0 };
    buildRoom(floor, floor.count++, null);
    return floor;
  }

  // Build room k (numbered, not built). `from` is the room it was entered from, or null for the first room.
  // Numbers the rooms behind its doors and hides the room's things.
  function buildRoom(floor, k, from) {
    const stage = from === null ? 0 : floor.rooms[from].stage + 1;
    const prand = rng((floor.pseed ^ Math.imul(stage + 7, 0x9e3779b1)) >>> 0);   // private: this room's own stream
    const PR = n => Math.floor(prand() * n);
    const sides = stage < floor.pairs ? ["L", "R"] : stage === floor.pairs ? ["C"] : [];   // the last offer room has one door: the wildcard
    // Which paired kind is behind which door is private: the pair itself ("vault or forge today") is
    // shared and safe to say out loud, but which door is which would spoil it.
    const offer = shuffleWith(floor.offers[Math.min(stage, floor.pairs)].slice(), prand), doors = {}, exitIdx = [];
    sides.forEach((side, i) => {
      const x = floor.count++;
      floor.kinds[x] = offer[i]; floor.exits[x] = { from: k, kind: offer[i], side };
      doors[side] = x; exitIdx.push(x);
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

    const room = { doors, hidden, stage, exits: exitIdx, clueKind, ahead: AHEAD };
    if (from !== null) { room.back = BACK; room.from = from; room.side = floor.exits[k].side; }
    if (kind) room.kind = kind;
    floor.rooms[k] = room;
    return k;
  }

  // Open the door on `side` ("L", "R", or "C" for a lone door) of room `from`: build the room behind it if it
  // isn't built yet. Returns the room's number.
  function grow(floor, from, side) {
    const i = floor.rooms[from].doors[side];
    if (i === undefined) return undefined;
    if (!floor.rooms[i]) {
      // Opening one door of an offer seals the other: she takes one room of the two.
      for (const j of floor.rooms[from].exits) if (j !== i) floor.sealed[j] = true;
      buildRoom(floor, i, from);
    }
    return i;
  }

  // A door onward that will never open: the other door of an offer that was settled.
  const isSealed = (floor, from, side) => { const i = floor.rooms[from].doors[side]; return i !== undefined && !floor.rooms[i] && !!floor.sealed[i]; };

  // What lies behind a locked door of room `from`: its kind, or null.
  const kindBehind = (floor, from, side) => {
    const i = floor.rooms[from].doors[side];
    return i !== undefined && !floor.rooms[i] ? floor.kinds[i] || null : null;
  };

  // The map: the choices KURA has made on this floor, as a path climbing the panel. Her room is on the second
  // row; the rooms behind her run down from it, each one step left or right of the next (the door she took);
  // the doors ahead of her sit on the top row.
  //   [@] KURA   [^] where she came down   [ ] a room behind her
  //   #  a locked door   x  a door sealed for good   '  a door standing open
  // state: { at: room index }
  function minimap(floor, state) {
    const W = 29, H = 5, rows = Array.from({ length: H }, () => Array(W).fill(" "));
    const put = (r, c, s) => [...s].forEach((ch, k) => { if (r >= 0 && r < H && c + k >= 0 && c + k < W) rows[r][c + k] = ch; });
    const STEP = { L: -2, R: 2, C: 0 }, mid = 14;
    const here = floor.rooms[state.at];
    // The doors ahead, on the top row: left and right of her, or straight ahead for a lone door.
    for (const side of Object.keys(here.doors)) {
      const j = here.doors[side];
      put(0, mid + STEP[side], floor.rooms[j] ? "'" : floor.sealed[j] ? "x" : "#");
    }
    // Her room, then back down the way she came. Beside each room, the door she did not take.
    let i = state.at, col = mid;
    for (let row = 1; row < H && i !== undefined; row++) {
      const room = floor.rooms[i];
      put(row, col - 1, "[" + (i === state.at ? "@" : i === floor.start ? "^" : " ") + "]");
      if (room.from === undefined) break;
      const step = STEP[room.side];
      if (step) put(row, col - 2 * step, "x");               // where the other room would have been
      col -= step; i = room.from;
    }
    return rows.map(r => r.join("").replace(/\s+$/, ""));
  }

  // A fresh floor as KURA arrives: only the first room is known.
  function arrive(floor, facing) {
    return { at: 0, visited: [true], found: [[]], facing: facing || AHEAD };
  }

  const api = { generate, grow, minimap, arrive, rng, kindBehind, isSealed, DAYS, BONUS_KIND, ANTI_KIND };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FLOOR = api;
})(this);
