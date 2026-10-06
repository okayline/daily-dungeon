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
  // Rare things. MOON_DROPS only fall from demons under a gibbous or full moon; DEEP ones sit far
  // inside a wall and take dozens of searches to reach.
  // Demons from old folklore (none borrowed from the SMT games).
  const DEMONS = ["GHOUL", "IMP", "BOGEY", "WRAITH", "KAPPA", "ONI", "GAKI", "BARGHEST", "REDCAP", "LAMIA", "NUE", "DULLAHAN"];
  const MOON_DROPS = ["a moonstone", "a shard of pale moonlight", "a fang still warm", "a silver-veined horn"];
  const DEEP = ["a sealed reliquary", "a black pearl", "an old COMP chip", "a ring of red gold", "a sword in a rotted sheath"];
  const ITEMS = [
    "a vial of medicine",
    "a bead of smoky glass",
    "a bent silver charm",
    "a stub of black candle",
    "a cracked hand mirror",
    "a strip of prayer cloth",
    "a rusted iron key",
    "a chipped bone die",
    "a tin of old matches",
    "a moth-eaten glove",
    "a page of a burned book",
    "a jar of grave salt",
    "a wax seal, unbroken",
    "a dead pager",
    "a cracked phone",
    "a spent battery",
    "a subway token",
    "a tangle of fiber cable",
    "a scratched data disc",
    "a burned-out circuit board",
    "a cassette with no label",
    "a neon tube fragment",
    "an ID card, face scratched",
    "a vending machine coin",
    "a VR visor, lens cracked",
    "a bag of loose screws",
  ];

  const floorNum = st => parseInt(String(st.floor).replace(/\D/g, ""), 10) || 1;
  // Log lines only name a direction when stating a character's action ("KURA goes WEST"), never for hints or doors.
  const doorList = room => Object.keys(room.doors).length > 1 ? "Two doors." : "A single door.";
  // The third log line. About half the time it carries a faint clue about the room KURA is in
  // or the door she faces (never a direction word); otherwise it's pure atmosphere.
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
  // The third line drifts now and then: after a search or a turn there's a chance it changes,
  // so it isn't frozen all day. The last-day warning stays put.
  function drift(st) {
    const d = st.dungeon;
    if (st.dead || !d) return;
    if (d.deadline !== undefined && clock(st) === d.deadline) { st.extra = "> The air grows heavy. The way down closes tonight."; return; }
    if (Math.random() < 0.3) st.extra = atmosphere(st);
  }
  // Plain flavor for the third line: party chatter, how the party is holding up, demon sounds
  // (more of them under a bright moon), or the dungeon itself. Never a direction, never a clue.
  const CHATTER = ["> PIXIE hums an old song, off key.", "> ELF counts the coins twice, frowning.",
    "> CU SITH yawns, all teeth.", "> PIXIE: \"It's too quiet. I hate quiet.\"",
    "> ELF: \"Keep your voice down.\"", "> CU SITH circles twice and lies down.",
    "> PIXIE lands on KURA's shoulder to rest.", "> ELF traces a sigil on the wall, then wipes it away."];
  const HURT = ["> {n} is breathing hard.", "> {n} looks tired.", "> {n} favors one side.",
    "> {n} says nothing, but the wounds show."];
  const DEMON = ["> Claws scrape stone somewhere far off.", "> A low laugh echoes, then stops.",
    "> Something large shifts in the dark.", "> Wings beat once, close by.", "> A howl rises from below."];
  const AMBIENT = ["> Water drips somewhere in the dark.", "> The stone ticks as it cools.",
    "> A draft stirs, then dies.", "> Dust sifts down from the ceiling.", "> The silence presses close.",
    "> Old scratches line the walls.", "> The lamp gutters, then steadies.", "> Pipes groan inside the walls."];
  function flavor(st) {
    const hurt = (st.party || []).filter(p => p.hpmax && p.hp > 0 && p.hp < p.hpmax / 2);
    const m = (root.SMT || require("./screen.js")).moonIndex(new Date());
    const demonOdds = [0.08, 0.12, 0.16, 0.22, 0.32, 0.22, 0.16, 0.12][m];   // brighter moon, louder demons
    const r = Math.random();
    if (hurt.length && r < 0.25) return pick(HURT).replace("{n}", pick(hurt).name);
    if (r < 0.25 + demonOdds) return pick(DEMON);
    if (r < 0.6) return pick(CHATTER);
    return pick(AMBIENT);
  }
  // What KURA sees when she turns: only what the 3D view already shows (wall, door, found stairs).
  const SEE = {
    wall: ["Bare stone.", "A blank wall, slick with damp.", "Cracked stone, nothing more.",
      "Old mortar, older stains.", "The wall stares back.", "Scratch marks, long dried."],
    door: ["A door, shut tight.", "A heavy door, iron-banded.", "A door, swollen with damp.",
      "A warped door in its frame.", "A door, its handle worn smooth."],
    stairs: ["The stairs drop into the dark.", "Steps lead down. They do not end.",
      "The stairs wait."],
  };
  function sight(st) {
    const v = st.dungeon ? (show(st), st.view.end) : "wall";
    return pick(SEE[v] || SEE.wall);
  }
  function atmosphere(st) {
    const d = st.dungeon;
    if (!d || Math.random() < 0.5) return flavor(st);
    const here = d.found[d.at], room = d.floor.rooms[d.at];
    const ahead = room.doors[st.facing];
    const clues = [];
    if (d.floor.stairs === d.at && !here.includes("stairs")) clues.push(...CLUE.stairsHere);
    if (ahead !== undefined && d.floor.stairs === ahead && !d.found[ahead].includes("stairs")) clues.push(...CLUE.stairsBeyond);
    if (d.floor.lure === d.at && !here.includes("lure")) clues.push(...CLUE.lureHere);
    if (ahead !== undefined && d.floor.lure === ahead && !d.found[ahead].includes("lure")) clues.push(...CLUE.lureBeyond);
    return clues.length ? pick(clues) : flavor(st);
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
    // A night's rest heals a fifth of everyone's HP (fallen allies too, slowly).
    if (!st.dead) st.party = st.party.map(p => ({ ...p, hp: Math.min(p.hpmax, p.hp + Math.ceil(p.hpmax / 5)) }));
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
      case "item": { const it = pick(ITEMS); st.items = (st.items || []).concat(it); return `KURA finds ${it}.`; }
      case "demon": {
        // A demon appears and stays until it's fought, talked down, or escaped (see the ENCOUNTER section).
        const name = pick(DEMONS);
        const hpmax = 16 + 9 * floorNum(st) + R(0, 8);
        st.encounter = { name, hp: hpmax, hpmax, round: 0, angered: false };
        st.round = [`A ${name} blocks the way.`];
        return `A ${name} appears!`;
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
  const FIND = 1 / 5, DEEP_FIND = 1 / 35;
  const WANDER = [1 / 30, 1 / 20, 1 / 14, 1 / 10, 1 / 6, 1 / 10, 1 / 14, 1 / 20];   // by moon phase, new -> full -> new
  const moon = () => (root.SMT || require("./screen.js")).moonIndex(new Date());
  // Each room hides its things behind its walls (never behind a door). The stairs are always behind
  // the wall they will open in; everything else is spread over the other walls, fixed by the floor's seed.
  function walls(d, i) {
    d.walls = d.walls || [];
    if (d.walls[i]) return d.walls[i];
    const room = d.floor.rooms[i];
    const free = CW.filter(x => !(x in room.doors));
    const w = { taken: {} };
    free.forEach(x => { w[x] = []; w.taken[x] = 0; });
    const sd = stairsDir(d.floor, i);
    let k = (d.floor.seed + i * 31) >>> 0;
    for (const thing of room.hidden) {
      if (thing === "stairs") w[sd].push(thing);
      else { w[free[k % free.length]].push(thing); k = (k * 1103515245 + 12345) >>> 0; }
    }
    // About one room in three hides something deep in one wall: findable, but only 1 in 35 per search,
    // and that wall may look empty for a very long time.
    if (k % 3 === 0) w.deep = { dir: free[(k >>> 4) % free.length], item: DEEP[(k >>> 8) % DEEP.length], found: false };
    return (d.walls[i] = w);
  }

  // SEARCH the wall KURA faces, NetHack style: unlimited, but each search has only a small chance
  // to turn up that wall's next hidden thing. A bare wall never answers. Doors can't be searched.
  function search(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (st.encounter) { st.log = `> The ${st.encounter.name} is still here. FIGHT, TALK, or run through a door.`; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const d = st.dungeon, room = d.floor.rooms[d.at], found = d.found[d.at], dir = st.facing;
    if (dir in room.doors) { st.log = "> Only a door here. Nothing to search."; return show(st); }
    if (found.includes("stairs") && dir === stairsDir(d.floor, d.at)) { st.log = "> The stairs wait. Nothing more here."; return show(st); }
    act(st);
    const where = `KURA searches the ${NAME[dir]} wall.`;
    const say = text => {
      const long = `> Day ${st.day}. ${where} ${text}`;
      return long.length <= 77 ? long : `> Day ${st.day}. KURA searches ${NAME[dir]}. ${text}`;
    };
    if (Math.random() < WANDER[moon()]) {
      st.log = say(reveal(st, "demon").replace(/^A (\w+) appears!/, "A $1 wanders in!"));
      drift(st);
      if (st.drop) { st.extra = st.drop; delete st.drop; }
      return show(st);
    }
    const w = walls(d, d.at), pile = w[dir] || [];
    if (w.taken[dir] < pile.length && Math.random() < FIND) {
      const thing = pile[w.taken[dir]++];
      found.push(thing);
      st.log = say(reveal(st, thing));
      // The first find in a room also takes stock of its doors.
      if (found.length === 1 && st.log.length + doorList(room).length < 77) st.log += " " + doorList(room);
      drift(st);
      if (st.drop) { st.extra = st.drop; delete st.drop; }
      return show(st);
    }
    if (w.deep && w.deep.dir === dir && !w.deep.found && Math.random() < DEEP_FIND) {
      w.deep.found = true;
      st.items = (st.items || []).concat(w.deep.item);
      st.log = say("Deep in the stone, something gives.");
      st.extra = `> KURA pulls out ${w.deep.item}.`;
      return show(st);
    }
    st.log = say(pick(["Nothing.", "Only stone.", "Nothing but dust.", "Nothing yet.", "The wall gives nothing away."]));
    drift(st);
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
      if (st.encounter) st.round = [`A wall to the ${NAME[dir]}. No way out there.`];
      return show(st);
    }
    if (today(st).stepped) {
      st.facing = dir; st.log = "> KURA has already moved today. Rest until tomorrow.";
      if (st.encounter) st.round = ["Today's step is spent. No running now."];
      return show(st);
    }
    // With a demon in the way, stepping through a door is running: it uses the day's step either way,
    // and half the time the demon blocks it and strikes.
    if (st.encounter) {
      const e = st.encounter, lines = [];
      act(st);
      today(st).stepped = true;
      st.facing = dir;
      st.roundOver = false;
      if (Math.random() < 0.5) {
        lines.push(`KURA runs ${NAME[dir]}. The ${e.name} blocks the door.`);
        st.log = `> Day ${st.day}. KURA tries to run ${NAME[dir]}. The ${e.name} blocks it.`;
        demonTurn(st, lines);
        st.round = lines;
        if (st.dead) st.roundOver = true;
        return show(st);
      }
      st.encounter = null;
      st.roundOver = true;
      st.round = [`KURA runs ${NAME[dir]} and leaves the ${e.name} behind.`];
    } else act(st);
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
    st.log = `> KURA turns to face ${NAME[st.facing]}. ${sight(st)}`;
    drift(st);
    return show(st);
  }

  // NEXT (hidden, key X): a testing cheat that jumps this game one day ahead of the real date.
  function next(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (st.encounter) { st.log = `> The ${st.encounter.name} is still here. FIGHT, TALK, or run through a door.`; return show(st); }
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
    // SEARCH works on the wall KURA faces; a door (or found stairs) can't be searched.
    const facingWall = !!d && !(st.facing in d.floor.rooms[d.at].doors) &&
      !(d.found[d.at].includes("stairs") && st.facing === stairsDir(d.floor, d.at));
    const res = { search: !!d && !st.dead && facingWall };
    for (const x of CW) res[x] = !st.dead && !t.stepped && out.includes(x);
    return res;
  }

  function reset(st) {
    st = copy(st);
    delete st.macca; delete st.mag;
    const t = clock(st);
    Object.assign(st, {
      day: 1, steps: 0, dead: false, startDay: t, today: { date: t, stepped: false },
      align: "NEUTRAL", silver: 0, ichor: 0, items: [], encounter: null,
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

  // ITEMS: what each one does when used from the INVOKE screen. Using an item is free (no day spent).
  const ITEM_INFO = {
    "a vial of medicine": { text: "Heals everyone by a third.", use: st => heal(st, 1 / 3, false), say: "The party breathes easier." },
    "a strip of prayer cloth": { text: "Raises fallen allies a little.", use: st => heal(st, 1 / 4, true), say: "Fallen allies stir." },
    "a stub of black candle": { text: "Burns for a while. Calms the dark.", use: st => { st.extra = "> The candle burns low. The dark draws back."; }, say: "A small light holds." },
    "a bead of smoky glass": { text: "Something moves inside it." },
    "a bent silver charm": { text: "Warm to the touch at night." },
    "a cracked hand mirror": { text: "Shows a room that isn't here." },
    "a moonstone": { text: "Rare. Fell under a bright moon." },
    "a shard of pale moonlight": { text: "Rare. Fell under a bright moon." },
    "a fang still warm": { text: "Rare. Fell under a bright moon." },
    "a silver-veined horn": { text: "Rare. Fell under a bright moon." },
    "a sealed reliquary": { text: "Rare. Pulled from deep in a wall." },
    "a black pearl": { text: "Rare. Pulled from deep in a wall." },
    "an old COMP chip": { text: "Rare. Pulled from deep in a wall." },
    "a ring of red gold": { text: "Rare. Pulled from deep in a wall." },
    "a sword in a rotted sheath": { text: "Rare. Pulled from deep in a wall." },
    "a rusted iron key": { text: "It opens nothing here." },
    "a chipped bone die": { text: "Always lands on six." },
    "a tin of old matches": { text: "Half of them still strike." },
    "a moth-eaten glove": { text: "Too small for any hand you know." },
    "a page of a burned book": { text: 'One line survives: "down is not away."' },
    "a jar of grave salt": { text: "Spirits don't like it." },
    "a wax seal, unbroken": { text: "Pressed with a sigil you don't know." },
    "a dead pager": { text: "It buzzes once, every new moon." },
    "a cracked phone": { text: "The screen shows a map of somewhere else." },
    "a spent battery": { text: "Still faintly warm." },
    "a subway token": { text: "For a line that was never built." },
    "a tangle of fiber cable": { text: "It glows when nobody looks." },
    "a scratched data disc": { text: "Labelled in a hand you almost know." },
    "a burned-out circuit board": { text: "Smells of ozone and incense." },
    "a cassette with no label": { text: "Hiss, then breathing." },
    "a neon tube fragment": { text: "Flickers pink in the dark." },
    "an ID card, face scratched": { text: "Clearance level: none." },
    "a vending machine coin": { text: "The machines down here still take it." },
    "a VR visor, lens cracked": { text: "Shows the room, but emptier." },
    "a bag of loose screws": { text: "Rattles like teeth." },
  };
  function heal(st, part, revive) {
    st.party = st.party.map(p => (p.hp > 0 || revive) ? { ...p, hp: Math.min(p.hpmax, p.hp + Math.ceil(p.hpmax * part)) } : p);
  }
  // The inventory, grouped: [{ name, count, text, usable }].
  function inventory(st) {
    const counts = {};
    for (const it of st.items || []) counts[it] = (counts[it] || 0) + 1;
    return Object.keys(counts).map(name => {
      const info = ITEM_INFO[name] || { text: "" };
      return { name, count: counts[name], text: info.text, usable: !!info.use };
    });
  }
  // Use one of an item. Things that can't be used yet just get looked at.
  function useItem(st, name) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const i = (st.items || []).indexOf(name);
    if (i < 0) return show(st);
    const info = ITEM_INFO[name] || {};
    if (!info.use) { st.log = `> KURA turns ${name.replace(/^an? /, "the ")} over. Not now.`; return show(st); }
    st.items.splice(i, 1);
    act(st);
    info.use(st);
    st.log = `> KURA uses ${name}. ${info.say}`;
    return show(st);
  }

  // ENCOUNTER: a demon stays until it is beaten, talked down, or escaped. Each choice is one round,
  // and the demon answers every round it's still standing. The moon decides how wild it is:
  // under a full moon demons hit harder and almost never listen; under a new moon they'd rather talk.
  const RAGE = [0.8, 0.9, 1.0, 1.15, 1.3, 1.15, 1.0, 0.9];          // demon damage by moon phase
  const LISTEN = [0.7, 0.55, 0.45, 0.3, 0.1, 0.3, 0.45, 0.55];      // chance a talk works, by moon phase
  function demonTurn(st, lines) {
    const e = st.encounter, up = st.party.filter(p => p.hp > 0);
    if (!up.length) return;
    const target = Math.random() < 0.4 ? st.party[0].hp > 0 ? st.party[0] : pick(up) : pick(up);
    const dmg = Math.min(target.hp, Math.max(1, Math.round(R(2, Math.ceil(target.hpmax / 3)) * RAGE[moon()])));
    st.party = st.party.map(p => p === target ? { ...p, hp: p.hp - dmg } : p);
    lines.push(`The ${e.name} strikes ${target.name}. -${dmg} HP` + (target.hp - dmg <= 0 ? ". FALLS" : ""));
    if (st.party[0].hp <= 0) {
      st.dead = true;
      st.party = st.party.map(p => ({ ...p, hp: 0 }));
      lines.push("KURA falls. The run is over.");
      st.log = `> Day ${st.day}. The ${e.name} strikes KURA down.`;
      st.encounter = null;
      st.round = lines;
      st.roundOver = true;
    }
  }
  function win(st, lines) {
    const e = st.encounter;
    const n = R(5, 30) + 3 * floorNum(st);
    st.ichor = (st.ichor ?? st.mag ?? 0) + n;
    lines.push(`The ${e.name} falls.  +${n} ICHOR`);
    const dropOdds = [0, 0, 0, 0.1, 0.25, 0.1, 0, 0][moon()];
    if (Math.random() < dropOdds) {
      const it = pick(MOON_DROPS);
      st.items = (st.items || []).concat(it);
      lines.push(`It leaves ${it}.`);
    }
    st.log = `> Day ${st.day}. The ${e.name} falls. ${n} ICHOR.`;
    st.encounter = null;
  }
  function round(st, fn, idle) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!st.encounter) { if (idle) st.log = idle; return show(st); }
    act(st);
    st.encounter.round++;
    const lines = [];
    st.roundOver = false;
    fn(st, lines);
    if (st.encounter && !st.dead) demonTurn(st, lines);
    if (!st.encounter || st.dead) st.roundOver = true;
    st.round = lines;
    return show(st);
  }
  // FIGHT: everyone still standing strikes once; then the demon answers.
  function fight(st) {
    return round(st, (st, lines) => {
      const e = st.encounter;
      let total = 0;
      for (const p of st.party) if (p.hp > 0) total += R(1, 4) + Math.floor((p.lv || 1) / 2);
      e.hp = Math.max(0, e.hp - total);
      lines.push(`The party strikes. -${total}`);
      st.log = `> Day ${st.day}. KURA's party fights the ${e.name}.`;
      if (e.hp <= 0) win(st, lines);
    }, "> Nothing here to fight.");
  }
  // TALK: the demon may listen and leave (sometimes with a gift), ask a price, or take offense.
  function talk(st) {
    return round(st, (st, lines) => {
      const e = st.encounter;
      st.log = `> Day ${st.day}. KURA speaks to the ${e.name}.`;
      if (e.angered) { lines.push(`The ${e.name} won't listen anymore.`); return; }
      const r = Math.random(), ok = LISTEN[moon()];
      if (r < ok * 0.6) {
        lines.push(`The ${e.name} listens, and slips away.`);
        if (Math.random() < 0.4) { const it = pick(ITEMS); st.items = (st.items || []).concat(it); lines.push(`It leaves ${it} behind.`); }
        st.log = `> Day ${st.day}. KURA talks the ${e.name} down. It leaves.`;
        st.encounter = null;
      } else if (r < ok) {
        const price = 20 + 10 * floorNum(st) + R(0, 20), have = st.silver ?? st.macca ?? 0;
        if (have >= price) {
          st.silver = have - price;
          lines.push(`The ${e.name} wants ${price} SILVER. KURA pays. It leaves.`);
          st.log = `> Day ${st.day}. KURA pays the ${e.name} ${price} SILVER. It leaves.`;
          st.encounter = null;
        } else { lines.push(`The ${e.name} wants ${price} SILVER. KURA has too little.`); e.angered = true; }
      } else { lines.push(`The ${e.name} laughs at KURA.`); e.angered = Math.random() < 0.5; }
    }, "> KURA speaks. Only the walls answer.");
  }
  const api = { next, reset, search, go, turn, available, tick, inventory, useItem, fight, talk };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
