// Day-by-day rules for the daily dungeon, played on the floors from floor.js.
// Each day: one step (N/S/E/W through a door, or down found stairs). Searching is unlimited but chancy.
// Days follow the real calendar (Honolulu). Each floor's way down closes on a Sunday; miss it and the run is over.
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
  // Log lines only name a direction when stating a character's action ("KURA goes WEST"), never for hints or doors.
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
    if (st.dead) {
      // Game over: the view goes dark and the third line points to RST.
      st.view = { left: [true, true], right: [true, true], end: "dark" };
      st.extra = "> GAME OVER. Press [R]ST to begin a new run.";
      return st;
    }
    const stairsAhead = d.found[d.at].includes("stairs") && st.facing === stairsDir(d.floor, d.at);
    st.view = {
      left: [!door(LEFT[st.facing]), true], right: [!door(RIGHT[st.facing]), true],
      end: stairsAhead ? "stairs" : door(st.facing) ? "door" : "wall",
    };
    return st;
  }

  // The real calendar, in Honolulu time (UTC-10). A day number counts days since 1970.
  // NEXT (key X) is a hidden testing cheat that pushes this game's clock a day ahead.
  const dayNum = now => Math.floor((now.getTime() - 10 * 3600 * 1000) / 86400000);
  const clock = st => dayNum(new Date()) + (st.clockOffset || 0);
  const weekday = n => (n + 3) % 7;                    // 0 = MONDAY ... 6 = SUNDAY
  const sundayOf = n => n + (6 - weekday(n));
  const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MO = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const fmt = n => { const d = new Date(n * 86400000); return `${WD[d.getUTCDay()]} ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  // A new run's first floor closes this Sunday, unless that leaves fewer than 3 days; then next Sunday.
  const firstDeadline = t => (sundayOf(t) - t >= 2 ? sundayOf(t) : sundayOf(t) + 7);

  // KURA arrives on a fresh floor. Its way down closes at the end of `deadline` (a Sunday).
  function arrive(st, num, deadline) {
    const floor = FLOOR.generate();
    const a = FLOOR.arrive(floor);
    st.floor = `B${num}F`;
    st.facing = a.facing;
    st.dungeon = { seed: floor.seed, floor, at: a.at, visited: a.visited, found: a.found, deadline };
    return floor;
  }

  // Bring the game up to the real date: a new day resets the step; a missed deadline ends the run.
  function sync(st) {
    const t = clock(st);
    if (st.startDay === undefined) st.startDay = t - ((st.day || 1) - 1);
    if (!st.today || st.today.date === undefined) st.today = { date: t, stepped: !!(st.today && st.today.stepped) };
    if (st.dungeon && st.dungeon.deadline === undefined) st.dungeon.deadline = firstDeadline(t);
    const newDay = st.today.date !== t;
    st.day = t - st.startDay + 1;
    if (!newDay || st.dead) return st;
    st.today = { date: t, stepped: false };
    st.unsaved = true;
    const d = st.dungeon;
    if (d && t > d.deadline) {
      st.dead = true;
      st.party = st.party.map(p => ({ ...p, hp: 0 }));
      st.log = `> Day ${st.day}. The week ended. The dark closed over KURA.`;
      return st;
    }
    st.log = `> Day ${st.day}. KURA wakes on ${st.floor}.`;
    st.extra = d && t === d.deadline ? "> The air grows heavy. The way down closes tonight." : atmosphere(st);
    return st;
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

  // Each day KURA gets ONE step (through a door, or down found stairs).
  // Searching, turning and the free actions are unlimited. Days follow the real calendar.
  const OVER = "> GAME OVER. Press [R]ST to begin a new run.";
  const today = st => (st.today = st.today || { stepped: false });
  function act(st) {                       // every action counts a STEP and marks the game unsaved
    st.steps = (st.steps || 0) + 1;
    st.unsaved = true;
  }
  // Every action starts by catching up with the real date. An old save with no floor starts one.
  function ensureFloor(st) {
    sync(st);
    if (st.dungeon) return true;
    arrive(st, floorNum(st), firstDeadline(clock(st)));
    st.log = `> Day ${st.day}. KURA enters ${st.floor}.`;
    st.unsaved = true;
    return false;
  }

  // SEARCH, NetHack style: unlimited, but each search only has a small chance to turn up the
  // room's next hidden thing. An empty room never answers, and the player can't tell it apart
  // from an unlucky one. Every search passes a little time, and a demon may wander in;
  // that happens more under a bright moon.
  const FIND = 1 / 5;
  const WANDER = [1 / 30, 1 / 20, 1 / 14, 1 / 10, 1 / 6, 1 / 10, 1 / 14, 1 / 20];   // by moon phase, new -> full -> new
  const moon = () => (root.SMT || require("./screen.js")).moonIndex(new Date());
  function search(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const d = st.dungeon, room = d.floor.rooms[d.at], found = d.found[d.at];
    act(st);
    d.searches = d.searches || [0, 0, 0];
    const n = ++d.searches[d.at];
    if (Math.random() < WANDER[moon()]) {
      st.log = `> Day ${st.day}. KURA searches (${n}). ${reveal(st, "demon").replace("A demon attacks", "A demon wanders in")}`;
      return show(st);
    }
    if (found.length < room.hidden.length && Math.random() < FIND) {
      const thing = room.hidden[found.length];
      found.push(thing);
      d.searches[d.at] = 0;
      st.log = `> Day ${st.day}. KURA searches (${n}). ${reveal(st, thing)}`;
      // The first find in a room also takes stock of its doors.
      if (found.length === 1 && st.log.length + doorList(room).length < 77) st.log += " " + doorList(room);
      if (thing === "stairs") st.facing = stairsDir(d.floor, d.at);
      return show(st);
    }
    st.log = `> Day ${st.day}. KURA searches (${n}). ` + pick(["Nothing.", "Only stone.", "Nothing but dust.",
      "Nothing yet.", "The walls give nothing away."]);
    return show(st);
  }

  // GO: KURA's one step for the day, toward dir (N/E/S/W; default: the way she faces).
  // A wall, or a step already taken today, stops her with a message and costs nothing.
  function go(st, dir) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const d = st.dungeon;
    dir = dir || st.facing;
    if (!exits(d).includes(dir)) {
      st.facing = dir;
      st.log = pick([`> A wall to the ${NAME[dir]}. KURA can't go that way.`, `> KURA walks ${NAME[dir]} into solid stone.`,
        `> Only cold wall to the ${NAME[dir]}.`]);
      return show(st);
    }
    if (today(st).stepped) { st.facing = dir; st.log = "> KURA has already moved today. Rest until tomorrow."; return show(st); }
    act(st);
    st.today.stepped = true;
    st.facing = dir;
    if (d.found[d.at].includes("stairs") && dir === stairsDir(d.floor, d.at)) {
      // Bonus days: the next floor belongs to next week, so going down early banks the rest of this one.
      const deadline = sundayOf(clock(st)) + 7;
      arrive(st, floorNum(st) + 1, deadline);
      st.log = `> Day ${st.day}. KURA goes ${NAME[dir]} and descends to ${st.floor}.`;
      st.extra = `> The way down from here closes ${fmt(deadline)}.`;
      return show(st);
    } else {
      const i = d.floor.rooms[d.at].doors[dir];
      const isNew = !d.visited[i];
      d.at = i; d.visited[i] = true;
      st.log = `> Day ${st.day}. KURA goes ${NAME[dir]} into ${isNew ? "a new room" : "a cleared room"}.`;
    }
    st.extra = atmosphere(st);
    return show(st);
  }

  // Turning is free: "L" and "R" turn 90 degrees.
  function turn(st, how) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!st.dungeon) return st;
    st.facing = how === "L" ? LEFT[st.facing] : RIGHT[st.facing];
    act(st);
    st.log = `> KURA turns to face ${NAME[st.facing]}.`;
    return show(st);
  }

  // NEXT (hidden, key X): a testing cheat that jumps this game one day ahead of the real date.
  function next(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    st.clockOffset = (st.clockOffset || 0) + 1;
    sync(st);
    return show(st);
  }

  // Catch the game up with the real date without taking an action (the page calls this as it draws).
  function tick(st) {
    st = copy(st);
    if (!st.dungeon) return st;
    sync(st);
    return show(st);
  }

  // What KURA can still do today, for dimming buttons on the page.
  function available(st) {
    const d = st.dungeon, t = st.today || {};
    const out = d && !st.dead ? exits(d) : [];
    const res = { search: !!d && !st.dead };
    for (const x of CW) res[x] = !st.dead && !t.stepped && out.includes(x);
    return res;
  }

  function reset(st) {
    st = copy(st);
    delete st.macca; delete st.mag;
    const t = clock(st);
    Object.assign(st, {
      day: 1, steps: 0, dead: false, startDay: t, today: { date: t, stepped: false },
      align: "NEUTRAL", silver: 0, ichor: 0,
      party: [
        { name: "KURA", lv: 1, hp: 30, hpmax: 30, mp: 8, mpmax: 8 },
        { name: "ELF", lv: 1, hp: 22, hpmax: 22, mp: 14, mpmax: 14 },
        { name: "PIXIE", lv: 1, hp: 18, hpmax: 18, mp: 12, mpmax: 12 },
        { name: "CU SITH", lv: 1, hp: 26, hpmax: 26, mp: 4, mpmax: 4 }],
    });
    const deadline = firstDeadline(t);
    arrive(st, 1, deadline);
    st.log = `> Day 1. KURA descends into B1F.`;
    st.extra = `> The way down from here closes ${fmt(deadline)}.`;
    st.unsaved = true;
    return show(st);
  }

  const api = { next, reset, search, go, turn, available, tick };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
