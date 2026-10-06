// Day-by-day rules for the daily dungeon, played on the floors from floor.js.
// Actions that use up the day: SEARCH the room, GO through the door ahead, or take the stairs.
// Turning to face another door is free. NEXT picks a day's action by itself (a shortcut for testing).
// Shared by the web page (buttons) and node (the /smt-screen command).
(function (root) {
  const FLOOR = root.FLOOR || require("./floor.js");
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const NAME = { N: "NORTH", E: "EAST", S: "SOUTH", W: "WEST" };
  const CW = ["N", "E", "S", "W"];
  const LEFT = { N: "W", E: "N", S: "E", W: "S" }, RIGHT = { N: "E", E: "S", S: "W", W: "N" };
  const ITEMS = ["a vial of medicine", "a bead of smoky glass", "a bent silver charm", "a stub of black candle",
    "a cracked hand mirror", "a strip of prayer cloth"];

  const floorNum = st => parseInt(String(st.floor).replace(/\D/g, ""), 10) || 1;
  // Log lines only name a direction for KURA's own actions ("KURA goes WEST"), never for hints or doors.
  const doorList = room => Object.keys(room.doors).length > 1 ? "Two doors." : "A single door.";
  // The third log line. About half the time it carries a faint clue about the room KURA is in
  // or the door she faces (never a direction word); otherwise it's pure atmosphere.
  const MOOD = ["> The air is cold and still.", "> Water drips somewhere in the dark.", "> Dust hangs in the lamplight.",
    "> The stone hums faintly underfoot.", "> PIXIE's glow flickers, then steadies.", "> ELF listens. Nothing answers.",
    "> CU SITH sniffs the floor and growls low.", "> Old scratches line the walls.", "> A draft stirs, then dies.",
    "> The silence presses close."];
  const copy = st => JSON.parse(JSON.stringify(st));

  const CLUE = {
    stairsHere: ["> The stones underfoot ring hollow.", "> KURA's steps echo too long here.",
      "> A thin cold breath rises between the flagstones.", "> CU SITH paws at the floor and whines."],
    stairsBeyond: ["> A cold draft breathes under the door.", "> The door is beaded with chill damp.",
      "> PIXIE shivers and will not look at the door.", "> Air moves through the door, as if drawn downward."],
    lureHere: ["> Something glints between the stones.", "> ELF tilts her head, as if hearing a bell.",
      "> A faint warmth lingers in this room."],
    lureBeyond: ["> A thread of warm light leaks around the door.", "> Faint music, or the memory of it, behind the door.",
      "> PIXIE drifts toward the door, curious."],
  };
  function atmosphere(st) {
    const d = st.dungeon;
    if (!d || Math.random() < 0.5) return pick(MOOD);
    const here = d.found[d.at], room = d.floor.rooms[d.at];
    const ahead = room.doors[st.facing];
    const clues = [];
    if (d.floor.stairs === d.at && !here.includes("stairs")) clues.push(...CLUE.stairsHere);
    if (ahead !== undefined && d.floor.stairs === ahead && !d.found[ahead].includes("stairs")) clues.push(...CLUE.stairsBeyond);
    if (d.floor.lure === d.at && !here.includes("lure")) clues.push(...CLUE.lureHere);
    if (ahead !== undefined && d.floor.lure === ahead && !d.found[ahead].includes("lure")) clues.push(...CLUE.lureBeyond);
    return clues.length ? pick(clues) : pick(MOOD);
  }

  // The stairs sit against a wall with no door. Which wall is fixed by the floor's seed.
  function stairsDir(floor, i) {
    const free = CW.filter(d => !(d in floor.rooms[i].doors));
    return free[floor.seed % free.length];
  }

  // Ways out of KURA's room: its doors, plus the stairs once they've been found.
  function exits(d) {
    const out = Object.keys(d.floor.rooms[d.at].doors);
    if (d.found[d.at].includes("stairs")) out.push(stairsDir(d.floor, d.at));
    return CW.filter(x => out.includes(x));
  }

  // Draw the minimap and the first-person view from where KURA stands and faces.
  function show(st) {
    const d = st.dungeon, room = d.floor.rooms[d.at];
    st.map = FLOOR.minimap(d.floor, { ...d, facing: st.facing });
    const door = dir => dir in room.doors;
    const stairsAhead = d.found[d.at].includes("stairs") && st.facing === stairsDir(d.floor, d.at);
    st.view = {
      left: [!door(LEFT[st.facing]), true], right: [!door(RIGHT[st.facing]), true],
      end: stairsAhead ? "stairs" : door(st.facing) ? "door" : "wall",
    };
    return st;
  }

  // KURA arrives on a fresh floor (day 1 of that floor's week).
  function arrive(st, num) {
    const floor = FLOOR.generate();
    const a = FLOOR.arrive(floor);
    st.floor = `B${num}F`;
    st.facing = a.facing;
    st.dungeon = { seed: floor.seed, floor, at: a.at, visited: a.visited, found: a.found, floorDay: 1 };
    return floor;
  }

  // What a search turns up. Placeholder effects: random damage, SILVER and ICHOR.
  function reveal(st, thing) {
    const silver = st.silver ?? st.macca ?? 0, ichor = st.ichor ?? st.mag ?? 0;
    switch (thing) {
      case "stairs": return "A floor stone shifts. Stairs lead down.";
      case "lure": return "A hidden alcove, lit from within.";
      case "silver": { const n = R(20, 150); st.silver = silver + n; return `Coins in the rubble. ${n} SILVER.`; }
      case "item": return `KURA finds ${pick(ITEMS)}.`;
      case "demon": {
        st.party = st.party.map(p => ({ ...p, hp: Math.max(1, p.hp - R(0, Math.ceil(p.hpmax / 4))) }));
        const n = R(5, 30); st.ichor = ichor + n;
        return `A demon attacks. It falls. ${n} ICHOR.`;
      }
    }
    return "Dust. Nothing more here.";
  }

  // Start a day. Returns false if the day was used up some other way:
  // an old save with no floor starts one, and an action after the week runs out drops KURA a floor.
  function startDay(st, descending) {
    st.day += 1;
    st.unsaved = true;
    if (!st.dungeon) {
      const f = arrive(st, floorNum(st));
      st.log = `> Day ${st.day}. KURA enters ${st.floor}.`;
      return false;
    }
    if (!descending && st.dungeon.floorDay >= FLOOR.DAYS) {
      // Placeholder until the end-of-week rule is decided.
      arrive(st, floorNum(st) + 1);
      st.log = `> Day ${st.day}. The week ends. The floor gives way. KURA falls to ${st.floor}.`;
      return false;
    }
    return true;
  }

  // SEARCH: turn up the next hidden thing in this room. Uses the day.
  function search(st) {
    st = copy(st);
    const d = st.dungeon;
    if (d && d.found[d.at].length >= d.floor.rooms[d.at].hidden.length) {
      st.extra = "> Nothing left to find here. The day is not spent.";
      return show(st);
    }
    if (startDay(st, false)) {
      const dd = st.dungeon, room = dd.floor.rooms[dd.at], found = dd.found[dd.at];
      dd.floorDay += 1;
      const thing = room.hidden[found.length];
      found.push(thing);
      st.log = `> Day ${st.day}. KURA searches. ${reveal(st, thing)}`;
      // The first search of a room also takes stock of its doors.
      if (found.length === 1 && st.log.length + doorList(room).length < 77) st.log += " " + doorList(room);
      if (thing === "stairs") st.facing = stairsDir(dd.floor, dd.at);
    }
    st.extra = atmosphere(st);
    return show(st);
  }

  // GO: through the door ahead, or down the stairs ahead. Uses the day.
  // Facing a wall, GO turns KURA to the next way out instead, which is free.
  function go(st) {
    st = copy(st);
    const d = st.dungeon;
    if (d && !exits(d).includes(st.facing)) return turn(st, "next");
    const descending = d && d.found[d.at].includes("stairs") && st.facing === stairsDir(d.floor, d.at);
    if (startDay(st, descending)) {
      const dd = st.dungeon;
      if (descending) {
        const f = arrive(st, floorNum(st) + 1);
        st.log = `> Day ${st.day}. KURA descends to ${st.floor}.`;
      } else {
        const i = dd.floor.rooms[dd.at].doors[st.facing];
        const isNew = !dd.visited[i];
        dd.floorDay += 1;
        dd.at = i; dd.visited[i] = true;
        st.log = `> Day ${st.day}. KURA goes ${NAME[st.facing]} into ${isNew ? "a new room" : "a cleared room"}.`;
      }
    }
    st.extra = atmosphere(st);
    return show(st);
  }

  // Turning is free: "L" and "R" turn 90 degrees, "next" faces the next way out clockwise.
  function turn(st, how) {
    st = copy(st);
    const d = st.dungeon;
    if (!d) return st;
    if (how === "L") st.facing = LEFT[st.facing];
    else if (how === "R") st.facing = RIGHT[st.facing];
    else {
      const out = exits(d);
      if (!out.length) return st;
      const k = CW.indexOf(st.facing);
      st.facing = [1, 2, 3, 4].map(n => CW[(k + n) % 4]).find(x => out.includes(x));
    }
    // Turning leaves the log alone: the view, the map arrow and FACE show the new direction.
    st.unsaved = true;
    return show(st);
  }

  // NEXT: a day's action picked automatically (a testing shortcut).
  function next(st) {
    const d = st.dungeon;
    if (!d) return go(st);
    if (d.found[d.at].includes("stairs")) return go({ ...copy(st), facing: stairsDir(d.floor, d.at) });
    const rooms = d.floor.rooms, room = rooms[d.at];
    const doors = Object.entries(room.doors);
    const fresh = doors.filter(([, i]) => !d.visited[i]);
    const unsearched = doors.filter(([, i]) => d.found[i].length < rooms[i].hidden.length);
    const left = room.hidden.length - d.found[d.at].length;
    if (left > 0 && (Math.random() < 0.6 || !fresh.length)) return search(st);
    const [dir] = fresh.length ? pick(fresh) : unsearched.length ? pick(unsearched) : pick(doors);
    return go({ ...copy(st), facing: dir });
  }

  function reset(st) {
    st = copy(st);
    delete st.macca; delete st.mag;
    Object.assign(st, {
      day: 1, align: "NEUTRAL", silver: 0, ichor: 0,
      party: [
        { name: "KURA", lv: 1, hp: 30, hpmax: 30, mp: 8, mpmax: 8 },
        { name: "ELF", lv: 1, hp: 22, hpmax: 22, mp: 14, mpmax: 14 },
        { name: "PIXIE", lv: 1, hp: 18, hpmax: 18, mp: 12, mpmax: 12 },
        { name: "CU SITH", lv: 1, hp: 26, hpmax: 26, mp: 4, mpmax: 4 }],
    });
    const f = arrive(st, 1);
    st.log = `> Day 1. KURA descends into B1F.`;
    st.extra = atmosphere(st);
    st.unsaved = true;
    return show(st);
  }

  const api = { next, reset, search, go, turn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
