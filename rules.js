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
  // ITEMS by rarity. COMMON: plain ruined-city junk. UNCOMMON: junk with a use. RARE: hybrids and odd tech.
  // MYTHIC: old-layer relics, deep in the walls and in lockers. MOON: only under a bright moon.
  // Each entry: [name, note, use?, what line 2 says when used].
  const CATALOG = {
    COMMON: [
      ["a bag of loose screws", "Rattles like teeth."],
      ["a spent battery", "Still faintly warm."],
      ["a vending machine coin", "The machines down here still take it."],
      ["a subway token", "For a line that was never built."],
      ["a burned-out circuit board", "Smells of ozone and incense."],
      ["a neon tube fragment", "Flickers pink in the dark."],
      ["a tangle of fiber cable", "It glows when nobody looks."],
      ["a scratched data disc", "Labelled in a hand you almost know."],
      ["an ID card, face scratched", "Clearance level: none."],
      ["a moth-eaten glove", "Too small for any hand you know."],
      ["a bead of smoky glass", "Something moves inside it."],
      ["a cracked hand mirror", "Shows a room that isn't here."],
    ],
    UNCOMMON: [
      ["a vial of medicine", "Heals everyone by a third.", st => heal(st, 1 / 3, false), "The party breathes easier."],
      ["a strip of prayer cloth", "Raises fallen allies a little.", st => heal(st, 1 / 4, true), "Fallen allies stir."],
      ["a stub of black candle", "Burns for a while. Calms the room.", st => calm(st), "The room settles a little."],
      ["a tin of old matches", "Half of them still strike."],
      ["a coil of copper wire", "Good for something. Probably."],
      ["a dead pager", "It buzzes once, every new moon."],
      ["a cracked phone", "The screen shows a map of somewhere else."],
      ["a cassette with no label", "Hiss, then breathing."],
      ["a VR visor, lens cracked", "Shows the room, but emptier."],
      ["a rusted iron key", "It opens nothing here."],
      ["a bent silver charm", "Warm to the touch at night."],
      ["a page of a burned book", 'One line survives: "down is not away."'],
    ],
    RARE: [
      ["a rune scratched into a circuit board", "Nobody taught the scratcher to read either language. It still works."],
      ["a salt-crusted network cable", "Whatever it carried, it carried something else too."],
      ["a candle stub in a soda can", "Somebody's shrine, somebody's lunch."],
      ["a charm bracelet of old keycards", "Every card opened a door that isn't there now."],
      ["a rosary of fiber optic beads", "It lights up one bead per prayer."],
      ["a sealed jar, humming faintly", "The label peeled off years ago. The hum changes pitch when you lie."],
      ["a SIM card in red thread", "The number still rings. Nobody answers."],
      ["a graffiti-stained saint's medal", "Somebody tagged a saint. The saint didn't mind."],
      ["a bullet casing on a leather cord", "Worn by someone who knew what it stopped."],
      ["a keycard, one corner burned", "Level 9. There is no level 9."],
      ["an old COMP chip", "Its last program is still running, very slowly."],
      ["a black pearl", "It reflects the wrong room."],
    ],
    MYTHIC: [
      ["a jar of grave salt", "Spirits don't like it."],
      ["a wax seal, unbroken", "Pressed with a sigil you don't know."],
      ["a chipped bone die", "Always lands on six."],
      ["a sealed reliquary", "Something inside knocks, politely."],
      ["a ring of red gold", "Heavier than it should be."],
      ["a sword in a rotted sheath", "The blade is clean. It always was."],
    ],
    MOON: [
      ["a moonstone", "Cold, and full of light that isn't from here."],
      ["a shard of pale moonlight", "It casts a shadow of its own."],
      ["a fang still warm", "Whatever it came from is still looking for it."],
      ["a silver-veined horn", "Hums a note only the moon can hear."],
    ],
  };
  // High-rarity items carry an alignment (commons and uncommons don't). Finding one pulls KURA a little
  // toward it, and offering one to a demon of the same alignment makes it likelier to join.
  const ITEM_ALIGN = {
    // RARE: hybrids and odd tech
    "a rune scratched into a circuit board": "NEUTRAL", "a salt-crusted network cable": "NEUTRAL",
    "a candle stub in a soda can": "CHAOS", "a charm bracelet of old keycards": "LAW",
    "a rosary of fiber optic beads": "LAW", "a sealed jar, humming faintly": "CHAOS",
    "a SIM card in red thread": "CHAOS", "a graffiti-stained saint's medal": "NEUTRAL",
    "a bullet casing on a leather cord": "CHAOS", "a keycard, one corner burned": "LAW",
    "an old COMP chip": "LAW", "a black pearl": "NEUTRAL",
    // MYTHIC: old-layer relics
    "a jar of grave salt": "LAW", "a wax seal, unbroken": "LAW", "a chipped bone die": "CHAOS",
    "a sealed reliquary": "LAW", "a ring of red gold": "CHAOS", "a sword in a rotted sheath": "NEUTRAL",
    // MOON
    "a moonstone": "NEUTRAL", "a shard of pale moonlight": "LAW", "a fang still warm": "CHAOS",
    "a silver-veined horn": "CHAOS",
  };
  const itemAlign = name => ITEM_ALIGN[name] || null;
  // KURA picks up an item; an aligned one tugs at her.
  function gain(st, it, lines) {
    st.items = (st.items || []).concat(it);
    note(st, "items", it, "found");
    tally(st, "items");
    const a = itemAlign(it);
    if (a && a !== "NEUTRAL") lean(st, "find" + a, lines);
  }
  const TIERS = ["COMMON", "UNCOMMON", "RARE", "MYTHIC", "MOON"];
  const ITEM_INFO = {}, TIER = {};
  for (const t of TIERS) for (const [name, text, use, say] of CATALOG[t]) { ITEM_INFO[name] = { text, use, say }; TIER[name] = t; }
  const names = t => CATALOG[t].map(x => x[0]);
  const ITEMS = names("COMMON").concat(names("UNCOMMON"));       // what a talked-down demon may leave
  const MOON_DROPS = names("MOON");
  // A found item's rarity: mostly common, sometimes uncommon, rarely rare.
  function rollItem(st) {
    const loot = st ? omen(clock(st)).fx.loot : 1, r = Math.random();
    const rare = 0.08 * loot;                            // a generous day makes rares three times as likely
    return pick(names(r < rare ? "RARE" : r < rare + 0.32 ? "UNCOMMON" : "COMMON"));
  }

  // DEMONS by family. The deeper the floor, the more data becomes flesh: pure data near the top,
  // haunted hardware, then hybrids, then old folklore. ATOM SLASHER is the rare named horror.
  const FAMILY = {
    data: ["PING", "DAEMON", "CRON", "NULL", "PACKET", "WORM", "TRACER"],
    hardware: ["STATIC RAT", "PAGER GHOUL", "VENDOR", "SCRAPPER", "DEADLINK", "LOOP SHADE"],
    hybrid: ["CHROME HOUND", "WIRE WITCH", "HEX DRONE", "SERVER GOLEM", "NEON DRYAD", "COIN WRAITH",
      "CHROME ONI", "KITSUNE.EXE", "PIXEL SPRITE", "STATIC BANSHEE", "LOOP LICH"],
    folklore: ["REDCAP", "GAKI", "BANSHEE", "BARGHEST", "TROLL", "GHOUL", "ONI", "KAPPA", "LAMIA", "WRAITH", "IMP",
      "PIXIE", "ELF", "CU SITH"],
  };
  const LADDER = [                                      // family weights by floor (B1F, B2F, B3F, B4F and deeper)
    { data: 7, hardware: 3, hybrid: 0, folklore: 0 },
    { data: 4, hardware: 5, hybrid: 1, folklore: 0 },
    { data: 1, hardware: 3, hybrid: 5, folklore: 2 },
    { data: 0, hardware: 1, hybrid: 4, folklore: 6 },
  ];
  const UNIQUE = { "ATOM SLASHER": { hp: 2, hit: 1.5, talks: false } };
  const A = n => (UNIQUE[n] ? n : (/^[AEIOU]/.test(n) ? "An " : "A ") + n), THE = n => (UNIQUE[n] ? n : "The " + n), the = n => (UNIQUE[n] ? n : "the " + n);
  // Pick a demon: the floor sets the families; noise and today's omen tilt them.
  // Repeating one wall draws data things; lingering in a room draws older things.
  function pickDemon(st) {
    if (Math.random() < 0.03) return "ATOM SLASHER";
    const d = st.dungeon, w = { ...LADDER[Math.min(floorNum(st), 4) - 1] }, om = omen(clock(st)).fx;
    const streak = d && d.streak && d.streak.room === d.at ? d.streak.count : 0;
    const linger = d && d.linger ? d.linger[d.at] || 0 : 0;
    if (streak >= 4) { w.data += 3; w.hardware += 2; }
    if (linger >= 15) { w.folklore += 3; w.hybrid += 2; }
    w.data *= om.data; w.hardware *= om.data; w.folklore *= om.folk; w.hybrid *= om.folk;
    const fams = Object.keys(w).filter(f => w[f] > 0), total = fams.reduce((n, f) => n + w[f], 0);
    let r = Math.random() * total;
    for (const f of fams) { if ((r -= w[f]) < 0) return pick(FAMILY[f]); }
    return pick(FAMILY.data);
  }

  // DAILY OMENS (line 1). One per real day, seeded from the date, so a reload can't reroll it.
  // About half the days are ordinary. Every omen is true: its effect is real all day.
  const OMENS = [
    // Ordinary days still read like omens: ambiguous, and they promise nothing that won't happen.
    { key: "none", fx: {}, lines: ["What you carry will be counted.", "The deep remembers a name. Not yours, yet.",
      "Someone walked this way before you.", "Count the doors. Then count them again.", "The ninth bell has not rung.",
      "What is below was once above.", "Somewhere a light is left on for you.", "The stone dreams of the sea.",
      "Not every silence is empty.", "A promise kept, a long way down."] },
    { key: "data", fx: { data: 2 }, lines: ["The wires remember.", "Something is counting down.", "A dial tone, far away."] },
    { key: "folk", fx: { folk: 2 }, lines: ["Old things walk early.", "Salt on the wind.", "The old ones stir."] },
    { key: "heat", fx: { heat: 2 }, lines: ["Do not linger.", "The room is listening today.", "Short stays. Quiet feet."] },
    { key: "hard", fx: { find: 0.5 }, lines: ["The walls keep their secrets.", "Every seam is sealed today.", "The stone stays shut."] },
    { key: "easy", fx: { find: 1.6 }, lines: ["A door is open somewhere.", "Something is loose in the stone.", "The seams are soft today."] },
    { key: "talk", fx: { talk: 1.6 }, lines: ["Strangers listen.", "Today, they will hear you out.", "Speak first. They are lonely."] },
    // Good days, plainly good.
    { key: "calm", fx: { heat: 0.5 }, lines: ["The halls are sleeping.", "Soft steps go unheard.", "Even the walls are tired."] },
    { key: "loot", fx: { loot: 3 }, lines: ["The deep is generous today.", "Something precious is near the surface.", "Fortune favors the patient."] },
  ];
  const hash = n => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
  function omen(t) {
    const h = hash(t), o = (h % 100) < 50 ? OMENS[0] : OMENS[1 + (h >>> 8) % (OMENS.length - 1)];
    const fx = { data: 1, folk: 1, heat: 1, find: 1, talk: 1, loot: 1, ...o.fx };
    return { key: o.key, fx, text: '> "' + o.lines[(h >>> 16) % o.lines.length] + '"' };
  }

  // HEAT: every search warms the room, and the hotter it is the likelier something comes.
  // From about 1 in 24 per search when cold, up to about 1 in 4 at its hottest. Heat fades by
  // half each night and never fully resets. Tiers are told on line 3, and the tells never lie.
  const HEAT_MAX = 20;
  const heatTier = h => (h >= 18 ? 3 : h >= 12 ? 2 : h >= 6 ? 1 : 0);
  const MOON_PULL = [0.8, 0.9, 1, 1.1, 1.25, 1.1, 1, 0.9];       // the moon still stirs things a little
  function encounterChance(st) {
    const d = st.dungeon, h = (d.heat || [])[d.at] || 0;
    return (1 / 24 + (1 / 4 - 1 / 24) * Math.min(1, h / HEAT_MAX)) * MOON_PULL[moon()];
  }
  const HEAT_TELL = {
    1: { plain: "> Your footsteps sound louder than before.", data: "> A dial tone, somewhere in the walls.", folk: "> The air smells of wet iron." },
    2: { plain: "> Something in the walls goes quiet.", data: "> Something is counting, very softly.", folk: "> Humming. Low, and getting closer." },
    3: { plain: "> The room is listening.", data: "> SIGNAL DETECTED", folk: "> Salt underfoot. You didn't spill it." },
  };
  function heatUp(st, amount) {
    const d = st.dungeon;
    d.heat = d.heat || [0, 0, 0];
    const before = heatTier(d.heat[d.at] || 0);
    d.heat[d.at] = Math.min(HEAT_MAX + 4, (d.heat[d.at] || 0) + amount * omen(clock(st)).fx.heat);
    const after = heatTier(d.heat[d.at]);
    st.stats = st.stats || {}; st.stats.maxHeat = Math.max(st.stats.maxHeat || 0, d.heat[d.at]);
    if (after > before) {
      const streak = d.streak && d.streak.room === d.at ? d.streak.count : 0, linger = (d.linger || [])[d.at] || 0;
      const kind = streak >= 4 ? "data" : linger >= 15 ? "folk" : "plain";
      st.tell = HEAT_TELL[after][kind];
    }
  }
  // A stub of black candle calms the room it's lit in.
  function calm(st) { const d = st.dungeon; if (d && d.heat) d.heat[d.at] = Math.max(0, (d.heat[d.at] || 0) - 8); }

  const floorNum = st => parseInt(String(st.floor).replace(/\D/g, ""), 10) || 1;
  // Log lines only name a direction when stating a character's action ("KURA goes WEST"), never for hints or doors.
  const doorList = room => Object.keys(room.doors).length > 1 ? "Two doors." : "A single door.";
  // The third log line. About half the time it carries a faint clue about the room KURA is in
  // or the door she faces (never a direction word); otherwise it's pure atmosphere.
  // Every action starts from a copy. The ALIGN arrow (st.pull) belongs to the action that set it,
  // so a new action clears it; the page's once-a-minute catch-up (tick) keeps it.
  const clone = st => JSON.parse(JSON.stringify(st));
  const copy = st => { const c = clone(st); delete c.pull; return c; };
  // Run stats for the end-of-run summary: counts kept in st.stats (steps, searches, demons, finds...).
  const tally = (st, k, n = 1) => { st.stats = st.stats || {}; st.stats[k] = (st.stats[k] || 0) + n; };

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
    const m = (root.SMT || require("./screen.js")).moonIndex((root.SMT || require("./screen.js")).now());
    const demonOdds = [0.08, 0.12, 0.16, 0.22, 0.32, 0.22, 0.16, 0.12][m];   // brighter moon, louder demons
    const r = Math.random();
    if (hurt.length && r < 0.25) return pick(HURT).replace("{n}", pick(hurt).name);
    if (r < 0.25 + demonOdds) return pick(DEMON);
    if (r < 0.55) return pick(CHATTER);
    // The moon is the calendar's weather: now and then line 3 mentions it.
    if (r < 0.72 && (root.SMT || require("./screen.js")).moonLines) return "> " + pick((root.SMT || require("./screen.js")).moonLines[m]);
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
    st.omenText = omen(clock(st)).text;                 // line 1
    if (st.tell) { st.extra = st.tell; delete st.tell; } // a heat tell takes line 3 right away
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

  // The real calendar, in the run's timezone (screen.js keeps the time: server time when the page has it).
  // A day number counts days since 1970. NEXT (key X) is a hidden testing cheat that pushes this game's clock a day ahead.
  const TIME = root.SMT || require("./screen.js");
  // The game never goes back in time: if the device clock is set earlier than a day this run has
  // already seen, the game stays on that day (so rewinding can't redo a day or dodge a deadline).
  // (If the server's time can't be had, e.g. offline, this guards the device clock.)
  const rawClock = st => TIME.localDay(TIME.now(), st.tz) + (st.clockOffset || 0);
  const clock = st => Math.max(rawClock(st), st.lastSeen || -Infinity);
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
  // A run whose calendar ran ahead of the real date (old X presses, a wrong device clock) snaps back
  // once, when the real time is known: its clock returns to today, and a deadline further out than a
  // fair one (next week's Sunday) is pulled in. After that, X works again as a testing cheat.
  function snapBack(st) {
    if (st.timeFixed || !TIME.trusted()) return;
    st.timeFixed = true;
    const real = TIME.localDay(TIME.now(), st.tz);
    if ((st.clockOffset || 0) === 0 && !(st.lastSeen > real)) return;
    delete st.clockOffset;
    st.lastSeen = real;
    delete st.rewindNoted;
    if (st.today && st.today.date > real) st.today = { date: real, stepped: !!st.today.stepped };
    if (st.startDay > real) st.startDay = real;
    if (st.dungeon && st.dungeon.deadline > sundayOf(real) + 7) st.dungeon.deadline = sundayOf(real) + 7;
    st.extra = "> The calendar shudders and settles on today.";
  }
  function sync(st) {
    snapBack(st);
    const t = clock(st);
    if (rawClock(st) < t && !st.rewindNoted) { st.extra = "> The calendar won't turn back."; st.rewindNoted = true; }
    if (rawClock(st) >= t) delete st.rewindNoted;
    st.lastSeen = t;
    if (st.startDay === undefined) st.startDay = t - ((st.day || 1) - 1);
    if (!st.today || st.today.date === undefined) st.today = { date: t, stepped: !!(st.today && st.today.stepped) };
    if (st.dungeon && st.dungeon.deadline === undefined) st.dungeon.deadline = firstDeadline(t);
    const newDay = st.today.date !== t;
    st.day = t - st.startDay + 1;
    if (!newDay || st.dead) return st;
    st.today = { date: t, stepped: false };
    st.unsaved = true;
    // Overnight every room's heat halves. It never quite resets.
    let settled = false;
    if (st.dungeon && st.dungeon.heat) {
      const at = st.dungeon.at, was = heatTier(st.dungeon.heat[at] || 0);
      st.dungeon.heat = st.dungeon.heat.map(h => Math.floor((h || 0) / 2));
      settled = was > 0 && heatTier(st.dungeon.heat[at]) < was;
    }
    if (st.dungeon) st.dungeon.linger = [0, 0, 0];
    // A night's rest gives back some patience.
    st.party = (st.party || []).map(p => p.patience === undefined ? p : { ...p, patience: Math.min(PATIENCE, p.patience + 3) });
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
    st.extra = d && t === d.deadline ? "> The air grows heavy. The way down closes tonight."
      : settled ? "> The room settles." : atmosphere(st);
    return st;
  }

  // What a search turns up. Placeholder effects: random damage, SILVER and ICHOR.
  function reveal(st, thing) {
    const silver = st.silver ?? st.macca ?? 0, ichor = st.ichor ?? st.mag ?? 0;
    switch (thing) {
      case "stairs": return "A floor stone shifts. Stairs lead down.";
      // The ? is a hidden locker. For now it holds a rare item (shops and special rooms come later).
      // The ? is a hidden locker: usually a RARE, sometimes MYTHIC; under a full moon, half the time a MOON item.
      case "lure": {
        const it = moon() === 4 && Math.random() < 0.5 ? pick(MOON_DROPS) : pick(names(Math.random() < 0.7 ? "RARE" : "MYTHIC"));
        gain(st, it); return `A locker holds ${it}.`;
      }
      case "silver": { const n = R(20, 150); st.silver = silver + n; tally(st, "silverFound", n); return `Coins in the rubble. ${n} SILVER.`; }
      case "item": { const it = rollItem(st); gain(st, it); return `KURA finds ${it}.`; }
      case "demon": {
        // A demon appears and stays until it's fought, talked down, or escaped (see the ENCOUNTER section).
        const name = pickDemon(st);
        const hpmax = Math.round((16 + 9 * floorNum(st) + R(0, 8)) * (UNIQUE[name] ? UNIQUE[name].hp : 1));
        st.encounter = { name, family: familyOf(name), align: alignOf(name), hp: hpmax, hpmax, round: 0, angered: false, stage: null };
        st.round = [`${A(name)} blocks the way.`, STANCE_LINE[stance(st, st.encounter)](name)];
        note(st, "demons", name, "met"); tally(st, "met");
        return `${A(name)} appears!`;
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
  const MISSES = ["Nothing.", "Nothing yet.", "Only stone.", "Nothing but dust.", "The wall gives nothing away.",
    "Cold stone, cold hands.", "Mortar, mostly. Some is older.", "Fingers come away gray.", "A crack. It goes nowhere.",
    "Damp. The smell of old pipes.", "Someone has looked here before.", "A dead cable runs in and stops.",
    "Faded paint. A number, or a sigil.", "Old tally marks, in groups of five.", "Salt along the base, in a line."];
  const moon = () => (root.SMT || require("./screen.js")).moonIndex((root.SMT || require("./screen.js")).now());
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
    if (k % 3 === 0) w.deep = { dir: free[(k >>> 4) % free.length], item: names("MYTHIC")[(k >>> 8) % CATALOG.MYTHIC.length], found: false };
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
    // Heat, and what kind of noise KURA is making: the same wall again and again, or just staying.
    d.streak = d.streak && d.streak.room === d.at && d.streak.dir === dir ? { ...d.streak, count: d.streak.count + 1 } : { room: d.at, dir, count: 1 };
    d.linger = d.linger || [0, 0, 0]; d.linger[d.at]++;
    const chance = encounterChance(st);
    tally(st, "searches");
    lean(st, heatTier((d.heat || [])[d.at] || 0) >= 2 ? "hot" : "search");
    heatUp(st, 1);
    const fx = omen(clock(st)).fx;
    const where = `KURA searches the ${NAME[dir]} wall.`;
    const say = text => {
      const long = `> Day ${st.day}. ${where} ${text}`;
      if (long.length <= 77) return long;
      const short = `> Day ${st.day}. KURA searches ${NAME[dir]}. ${text}`;
      return short.length <= 77 ? short : `> Day ${st.day}. ${text.replace(/^KURA finds /, "Found ")}`.slice(0, 77);
    };
    if (Math.random() < chance) {
      st.log = say(reveal(st, "demon").replace(" appears!", " wanders in!"));
      drift(st);
      if (st.drop) { st.extra = st.drop; delete st.drop; }
      return show(st);
    }
    const w = walls(d, d.at), pile = w[dir] || [];
    if (w.taken[dir] < pile.length && Math.random() < FIND * fx.find) {
      const thing = pile[w.taken[dir]++];
      found.push(thing);
      st.log = say(reveal(st, thing));
      // The first find in a room also takes stock of its doors.
      if (found.length === 1 && st.log.length + doorList(room).length < 77) st.log += " " + doorList(room);
      drift(st);
      if (st.drop) { st.extra = st.drop; delete st.drop; }
      return show(st);
    }
    if (w.deep && w.deep.dir === dir && !w.deep.found && Math.random() < DEEP_FIND * fx.find) {
      w.deep.found = true;
      gain(st, w.deep.item);
      st.log = say("Deep in the stone, something gives.");
      st.extra = `> KURA pulls out ${w.deep.item}.`;
      return show(st);
    }
    // A near-miss line only when it's true: this wall still hides something.
    const warm = w.taken[dir] < pile.length && Math.random() < 0.12;
    st.log = say(warm ? "The wall is warmer than the others." : pick(MISSES));
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
    const toStairs = d.found[d.at].includes("stairs") && dir === stairsDir(d.floor, d.at);
    if (today(st).stepped && !(toStairs && !st.encounter)) {
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
      lean(st, "run", lines);
      st.facing = dir;
      st.roundOver = false;
      if (Math.random() < 0.5) {
        lines.push(`KURA runs ${NAME[dir]}. ${THE(e.name)} blocks the door.`);
        st.log = `> Day ${st.day}. KURA tries to run ${NAME[dir]}. ${THE(e.name)} blocks it.`;
        demonTurn(st, lines);
        st.round = lines;
        if (st.dead) st.roundOver = true;
        return show(st);
      }
      st.encounter = null;
      st.roundOver = true;
      st.round = [`KURA runs ${NAME[dir]} and leaves ${the(e.name)} behind.`, ...lines];
      tally(st, "fled");
    } else act(st);
    const descending = d.found[d.at].includes("stairs") && dir === stairsDir(d.floor, d.at);
    // Taking the stairs down doesn't use the day's step; walking to another room does.
    if (!descending) { st.today.stepped = true; tally(st, "steps"); }
    else tally(st, "floors");
    st.facing = dir;
    if (descending) {
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
    st = clone(st);
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
    // A new run counts days in the player's own timezone (Honolulu for the chat run). Moving to a
    // new timezone starts the calendar guard fresh, so a zone behind the old one doesn't stall it.
    const tz = (root.SMT || require("./screen.js")).zone();
    if (st.tz !== tz) { delete st.lastSeen; delete st.rewindNoted; }
    // A new run starts on the real calendar: the X testing cheat doesn't carry over.
    if (st.clockOffset) { delete st.clockOffset; delete st.lastSeen; delete st.rewindNoted; }
    st.timeFixed = true;
    st.tz = tz;
    const t = clock(st);
    Object.assign(st, {
      day: 1, steps: 0, dead: false, startDay: t, today: { date: t, stepped: false },
      endShown: false, stats: {}, align: "NEUTRAL", alignScore: 0, alignShifts: 0, alignTold: false, silver: 0, ichor: 0, items: [], encounter: null,
      party: [
        { name: "KURA", lv: 1, hp: 30, hpmax: 30, mp: 8, mpmax: 8 },
        { name: "ELF", lv: 1, hp: 22, hpmax: 22, mp: 14, mpmax: 14, family: "folklore", align: "CHAOS", demon: true },
        { name: "PIXIE", lv: 1, hp: 18, hpmax: 18, mp: 12, mpmax: 12, family: "folklore", align: "NEUTRAL", demon: true },
        { name: "CU SITH", lv: 1, hp: 26, hpmax: 26, mp: 4, mpmax: 4, family: "folklore", align: "CHAOS", demon: true }],
    });
    // KURA starts with a few pieces of junk and one useful thing.
    const junk = names("COMMON").sort(() => Math.random() - 0.5).slice(0, R(2, 3));
    for (const it of [...junk, pick(names("UNCOMMON"))]) gain(st, it);
    // Very rarely, something good is already in the bag: 1 run in 40 a RARE, 1 in 200 a MYTHIC.
    const luck = Math.random(), lucky = luck < 0.005 ? "MYTHIC" : luck < 0.03 ? "RARE" : null;
    if (lucky) gain(st, pick(names(lucky)));
    st.stats = {};                                     // the starting bag doesn't count as finds
    const deadline = firstDeadline(t);
    arrive(st, 1, deadline);
    st.log = `> Day 1. KURA descends into B1F.${lucky ? " Her bag feels heavier than it should." : ""}`;
    st.extra = `> The way down from here closes ${fmt(deadline)}.`;
    st.unsaved = true;
    return show(st);
  }

  // Using an item from the INVOKE screen is free (no day spent).
  function heal(st, part, revive) {
    st.party = st.party.map(p => (p.hp > 0 || revive) ? { ...p, hp: Math.min(p.hpmax, p.hp + Math.ceil(p.hpmax * part)) } : p);
  }
  // The inventory, grouped: [{ name, count, text, usable }].
  function inventory(st) {
    const counts = {};
    for (const it of st.items || []) counts[it] = (counts[it] || 0) + 1;
    return Object.keys(counts).sort((x, y) => TIERS.indexOf(TIER[y]) - TIERS.indexOf(TIER[x])).map(name => {
      const info = ITEM_INFO[name] || { text: "" };
      return { name, count: counts[name], text: info.text, usable: !!info.use, tier: TIER[name] || "COMMON", align: itemAlign(name) };
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
    // Most things can't be used (yet): a placeholder line says so, and nothing is spent.
    if (!info.use) { act(st); st.log = `> KURA turns ${name.replace(/^an? /, "the ")} over. Nothing happens.`; return show(st); }
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
    const dmg = Math.min(target.hp, Math.max(1, Math.round(R(2, Math.ceil(target.hpmax / 3)) * RAGE[moon()] * (UNIQUE[e.name] ? UNIQUE[e.name].hit : 1))));
    st.party = st.party.map(p => p === target ? { ...p, hp: p.hp - dmg } : p);
    lines.push(`${THE(e.name)} strikes ${target.name}. -${dmg} HP` + (target.hp - dmg <= 0 ? ". FALLS" : ""));
    if (st.party[0].hp <= 0) {
      st.dead = true;
      st.party = st.party.map(p => ({ ...p, hp: 0 }));
      lines.push("KURA falls. The run is over.");
      st.log = `> Day ${st.day}. ${THE(e.name)} strikes KURA down.`;
      st.encounter = null;
      st.round = lines;
      st.roundOver = true;
    }
  }
  function win(st, lines) {
    const e = st.encounter;
    const n = R(5, 30) + 3 * floorNum(st);
    st.ichor = (st.ichor ?? st.mag ?? 0) + n;
    tally(st, "beaten"); tally(st, "ichorWon", n);
    lines.push(`${THE(e.name)} falls.  +${n} ICHOR`);
    const dropOdds = [0, 0, 0, 0.1, 0.25, 0.1, 0, 0][moon()];
    if (Math.random() < dropOdds) {
      const it = pick(MOON_DROPS);
      lines.push(`It leaves ${it}.`);
      gain(st, it, lines);
    }
    st.log = `> Day ${st.day}. ${THE(e.name)} falls. ${n} ICHOR.`;
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
      e.stage = null;
      let total = 0;
      for (const p of st.party) if (p.hp > 0) total += R(1, 4) + Math.floor((p.lv || 1) / 2);
      e.hp = Math.max(0, e.hp - total);
      lines.push(`The party strikes. -${total}`);
      st.log = `> Day ${st.day}. KURA's party fights ${the(e.name)}.`;
      if (e.hp <= 0) { win(st, lines); lean(st, "kill", lines); } else lean(st, "fight", lines);
    }, "> Nothing here to fight.");
  }
  // TALK: the demon may listen and leave (sometimes with a gift), ask a price, or take offense.
  // RECRUITING. KURA is the only human; everyone else in the party is a demon (ELF, PIXIE and CU SITH too).
  // Talking can turn a demon into an ally. Each family speaks its own way and wants something different:
  //   data:      system messages; wants a TASK (just say yes)
  //   hardware:  corrupted memory; wants what it lost (SILVER buys it a "home")
  //   hybrid:    half and half; wants SILVER
  //   folklore:  old words; wants an offering (an item from the inventory)
  // ALIGNMENT. Every demon has one: data things and clean machines are LAW, folklore is CHAOS,
  // hybrids and haunted hardware are NEUTRAL (with a few outliers). KURA starts NEUTRAL and leans
  // toward whatever she recruits, and her other choices nudge her too (see lean below).
  const ALIGN_OUTLIERS = { "WORM": "CHAOS", "VENDOR": "LAW", "PAGER GHOUL": "NEUTRAL", "KITSUNE.EXE": "CHAOS", "PIXIE": "NEUTRAL" };
  function alignOf(name) {
    if (ALIGN_OUTLIERS[name]) return ALIGN_OUTLIERS[name];
    const f = familyOf(name);
    return f === "data" ? "LAW" : f === "folklore" ? "CHAOS" : "NEUTRAL";
  }
  // How a demon sees KURA: "same", "neutral" or "opposite".
  function stance(st, e) {
    const me = String(st.align || "NEUTRAL").toUpperCase(), it = e.align || "NEUTRAL";
    if (me === it) return "same";
    if (me === "NEUTRAL" || it === "NEUTRAL") return "neutral";
    return "opposite";
  }
  const STANCE_LINE = { same: n => `KURA is recognized. ${THE(n)} lowers its guard.`,
    neutral: n => `${THE(n)} watches. Undecided.`, opposite: n => `${THE(n)} bares its teeth.` };
  const STANCE_TALK = { same: 1.5, neutral: 1, opposite: 0.6 };
  // KURA's lean. One hidden score (negative = LAW, positive = CHAOS) that choices nudge as she makes them.
  // Early choices weigh more (each shift counts a little less than the last, down to 40%), the score is
  // capped at +-6, and the tag only changes at thresholds: -3 LAW, +3 CHAOS, back to NEU within 1 of zero,
  // so it never flickers. Walking, turning and using items don't count; choices do.
  //   recruiting:            -1 LAW demon / +1 CHAOS demon
  //   searching a cool room: -0.03 (patience)      searching a hot room: +0.2 (pushing your luck)
  //   talking to a demon:    -0.15                 fighting a round:     +0.3    finishing it off: +0.6
  //   giving SILVER:         -0.4                  giving an item:        +0.4
  //   running through a door: +0.15
  //   finding a LAW / CHAOS relic (RARE and up): -0.3 / +0.3; offering one pulls toward it (+-0.4, NEUTRAL: none)
  const LEAN = { LAW: -1, CHAOS: 1, NEUTRAL: 0, search: -0.03, hot: 0.2, talk: -0.15, fight: 0.3, kill: 0.6,
    pay: -0.4, task: -0.4, offer: 0.4, run: 0.15, findLAW: -0.3, findCHAOS: 0.3, offerLAW: -0.4 };
  function lean(st, why, lines) {
    const base = LEAN[why] || 0;
    if (!base) return;
    st.alignShifts = (st.alignShifts || 0) + 1;
    const w = Math.max(0.4, 1 - 0.02 * (st.alignShifts - 1));
    st.alignScore = Math.max(-6, Math.min(6, Math.round(((st.alignScore || 0) + base * w) * 1000) / 1000));
    // Which way this action pulled, for the arrow on the ALIGN tag: <NEU] toward LAW, [NEU> toward CHAOS.
    // Only real choices show an arrow; tiny nudges (patient searching) move the score quietly.
    if (Math.abs(base) >= 0.1) st.pull = Math.round(((st.pull || 0) + base * w) * 1000) / 1000;
    const before = String(st.align || "NEUTRAL").toUpperCase(), s = st.alignScore;
    let after = before;
    if (s <= -3) after = "LAW"; else if (s >= 3) after = "CHAOS";
    else if (Math.abs(s) <= 1) after = "NEUTRAL";
    let say = null;
    if (after !== before) {
      st.align = after;
      st.alignTold = false;
      say = after === "LAW" ? "The system takes notice. [LAW]" : after === "CHAOS" ? "The old things take notice. [CHA]" : "KURA finds her balance. [NEU]";
    } else if (after === "NEUTRAL" && Math.abs(s) >= 2.4 && !st.alignTold) {
      // A tell just before a flip, once each time she drifts that close.
      st.alignTold = true;
      say = "Something is pulling at you.";
    } else if (Math.abs(s) < 1.5) st.alignTold = false;
    if (!say) return;
    if (lines) lines.push(say); else st.tell = "> " + say;
  }
  function familyOf(name) {
    for (const f of Object.keys(FAMILY)) if (FAMILY[f].includes(name)) return f;
    return "folklore";
  }
  const VOICE = {
    data: { open: ["PROCESS DETECTED", "SIGNAL FOUND", "AWAITING INPUT"], ask: "REQUEST: RESOURCES. INPUT ANY.",
      love: "VALUE EXCEEDS EXPECTED.", like: "ACCEPTABLE.", meh: "INSUFFICIENT. MORE.", hate: "INCOMPATIBLE FORMAT.",
      join: "TASK RECEIVED. LINKED TO USER.", no: "CONNECTION LOST", scorn: "INPUT REJECTED", leave: "PROCESS ENDED" },
    hardware: { open: ["ERROR 404: owner not found", "still here. still running", "are you my replacement?"],
      ask: "got anything? anything at all?",
      love: "oh. oh! it's perfect", like: "ok. that's ok", meh: "...is there more?", hate: "what is this. take it back", join: "NEW OWNER ACCEPTED. ok. I'll wait with you.",
      no: "...ok. I'll wait here then.", scorn: "ACCESS DENIED. go away", leave: "SHUTTING DOWN. bye" },
    hybrid: { open: ["ACCESS GRANTED, traveler.", "You smell of salt and static.", "What brings flesh this far down?"],
      ask: "A toll, traveler. Coin, or something with a pulse in it.",
      love: "Now THAT has a pulse.", like: "It'll do.", meh: "Thin. Give me more.", hate: "Dead thing. Useless.", join: "LINK ESTABLISHED. I walk with you now.",
      no: "Then we are strangers still.", scorn: "Your words are noise.", leave: "It folds back into the wires." },
    folklore: { open: ["Who comes into my hall?", "A living thing. How rare.", "You have the look of a beggar."],
      ask: "What will you give me, mortal?",
      love: "Ohh. Old, and lovely.", like: "Hm. Acceptable.", meh: "A crumb. Where's the rest?", hate: "Wires and plastic? You insult me.", join: "Then I am yours, little lantern.",
      no: "Keep it, then. And keep away.", scorn: "Hah. Go back up, child.", leave: "It is gone like smoke." },
  };
  const say2 = (e, k) => { const v = VOICE[e.family || "folklore"][k]; return Array.isArray(v) ? pick(v) : v; };

  // TALK, step by step. 1) The demon decides whether to listen (moon and omen). 2) It names its price.
  // 3) KURA answers YES or NO. 4) Paid, it may offer to join. Talking rounds are peaceful unless it's scorned.
  function talk(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    const e = st.encounter;
    if (!e) return chat(st);
    if (e.stage) return show(st);                        // waiting on a YES/NO already
    act(st);
    const lines = [];
    st.roundOver = false;
    st.log = `> Day ${st.day}. KURA speaks to ${the(e.name)}.`;
    tally(st, "demonTalks");
    lean(st, "talk", lines);
    if (e.angered || (UNIQUE[e.name] && !UNIQUE[e.name].talks)) {
      lines.push(`${THE(e.name)} won't listen.`);
      demonTurn(st, lines);
    } else if (Math.random() < Math.min(0.95, LISTEN[moon()] * omen(clock(st)).fx.talk * STANCE_TALK[stance(st, e)])) {
      lines.push(`${e.name}: "${say2(e, "open")}"`);
      // It asks for a gift: anything. What it gets decides how it reacts (see GIFTS below).
      e.stage = "gift"; e.got = 0; e.asks = 1;
      e.want = 2 + floorNum(st);
      e.silver = Math.round((20 + 10 * floorNum(st) + R(0, 20)) * { same: 0.7, neutral: 1, opposite: 1.5 }[stance(st, e)]);
      lines.push(`${e.name}: "${say2(e, "ask")}"`);
    } else {
      lines.push(`${e.name}: "${say2(e, "scorn")}"`);
      e.angered = Math.random() < 0.5;
      demonTurn(st, lines);
    }
    st.round = lines;
    if (!st.encounter || st.dead) st.roundOver = true;
    return show(st);
  }

  // TALK with no demon around: KURA talks to her party, and someone answers. Now and then something
  // that isn't the party answers instead (more often under a full moon). Pure flavor; it counts a TURN.
  const PARTY_TALK = {
    ELF: ['ELF: "Hush. The walls have ears."', 'ELF: "I have walked halls like this before. They all end."',
      'ELF: "You worry too much, little lantern."', 'ELF: "Ask me again when we are out."'],
    PIXIE: ['PIXIE: "Are we there yet? We\'re never there."', 'PIXIE: "I\'m not scared. YOU\'RE scared."',
      'PIXIE: "Talk louder! It keeps the dark away."', 'PIXIE: "Can the moon see us down here?"'],
    "CU SITH": ["CU SITH thumps its tail twice.", "CU SITH presses its head under KURA's hand.",
      "CU SITH answers with a low, happy rumble.", "CU SITH tilts its head, ears up."],
  };
  const FAMILY_TALK = {
    data: ['{n}: "QUERY NOT UNDERSTOOD. RETRY?"', '{n}: "ALL SYSTEMS NOMINAL. FOR NOW."',
      '{n}: "CONVERSATION LOGGED."', '{n}: "USER HEART RATE ELEVATED."'],
    hardware: ['{n}: "you talk to me? nobody talks to me"', '{n}: "battery 12%. don\'t worry about it"',
      '{n}: "is this a good room? I like it"', "{n} beeps, pleased."],
    hybrid: ['{n}: "Something in these walls is listening."', '{n}: "Half of me agrees with you."',
      "{n} flickers between two shapes, then shrugs.", '{n}: "Your voice carries. Careful."'],
    folklore: ['{n}: "Mortals and their chatter."', '{n}: "Mind the old marks on the stone."',
      '{n}: "Speak softly. Old things sleep here."', "{n} sniffs the air and says nothing."],
  };
  // The room's heat colors the answer: calm (tier 0) gets the lines above; as heat climbs, whoever
  // answers grows uneasy, then nervous, then alarmed. Talking is how KURA can read the room.
  const PARTY_HEAT = {
    ELF: [, ['ELF: "Something has noticed us. Not much yet."', 'ELF: "Lower your voice. The room is waking."'],
      ['ELF: "I can feel it watching. It has been for a while."', 'ELF: "Enough noise. Something is coming closer."'],
      ["ELF says nothing. Her hand stays on her blade.", 'ELF: "...Listen."']],
    PIXIE: [, ['PIXIE: "Did you hear that? ...No? Okay. Okay."', 'PIXIE: "It\'s getting a little crowded in here."'],
      ['PIXIE: "I don\'t like this room anymore. It doesn\'t like us either."', 'PIXIE: "Something keeps breathing. It isn\'t us."'],
      ["PIXIE hides in KURA's hood and won't come out.", "PIXIE tries to answer. Her voice won't come."]],
    "CU SITH": [, ["CU SITH's ears flick toward the walls.", "CU SITH answers, but keeps watching the corners."],
      ["CU SITH growls low at nothing KURA can see.", "CU SITH won't sit. Its hackles are up."],
      ["CU SITH stands between KURA and the dark, snarling.", "CU SITH's growl doesn't stop, even to breathe."]],
  };
  const FAMILY_HEAT = {
    data: [, ['{n}: "BACKGROUND ACTIVITY DETECTED."', '{n}: "MINOR SIGNAL NEARBY. MONITORING."'],
      ['{n}: "MULTIPLE SIGNALS. ORIGIN: EVERYWHERE."', '{n}: "WARNING: TRACE DETECTED."'],
      ['{n}: "0101 0101 0101 0101"', "{n}'s cursor blinks faster and faster."]],
    hardware: [, ['{n}: "fan\'s spinning up. probably nothing"', '{n}: "do you hear humming? not me. other humming"'],
      ['{n}: "something keeps pinging me. I don\'t like it"', '{n}: "temperature rising. not mine. the room\'s"'],
      ['{n}: "it\'s so loud in here. is it loud? it\'s loud"', "{n} sparks and refuses to answer."]],
    hybrid: [, ['{n}: "The wires here are starting to hum."', '{n}: "Static in the air. Someone\'s awake."'],
      ['{n}: "Both halves of me are cold."', '{n}: "The walls are listening harder now."'],
      ["{n} answers in a voice that isn't its own.", "{n} goes rigid, half its shape crackling."]],
    folklore: [, ['{n}: "The old things are stirring."', '{n}: "Mind your voice. We are being noticed."'],
      ['{n}: "This hall is hungry. We should not feed it."', '{n}: "I smell something old coming closer."'],
      ['{n}: "Hush. It knows our names now."', "{n} bares its teeth at the dark."]],
  };
  // PATIENCE. Each party member has a little (5); every time KURA talks to them it drops by one.
  // At 2 and below they get short with her, and at 0 they ignore her. A night's rest gives back 3.
  // (A hidden value with a tell: only the replies show it. May fold into Dissonance later.)
  const PATIENCE = 5;
  const PARTY_TIRED = {
    ELF: [['ELF pretends not to hear.', 'ELF has turned her back.'],
      ['ELF sighs, long and pointed.', 'ELF: "Talk to the dog."'],
      ['ELF: "You\'ve asked me that already."', 'ELF: "Must you?"']],
    PIXIE: [['PIXIE flies to the far side of the room.', 'PIXIE hums loudly over KURA.'],
      ['PIXIE: "I\'m not talking to you right now."', 'PIXIE sticks out her tongue.'],
      ['PIXIE: "You talk a LOT, you know that?"', 'PIXIE: "Again? Okay. Fine. Hi."']],
    "CU SITH": [['CU SITH pretends to be asleep.', 'CU SITH looks at KURA, then away.'],
      ['CU SITH lies down facing the wall.', 'CU SITH flattens its ears.'],
      ['CU SITH yawns at KURA.', 'CU SITH thumps its tail once. Just once.']],
  };
  const FAMILY_TIRED = {
    data: [['{n} does not respond. 0 bars.', '{n}: "429"'],
      ['{n}: "RATE LIMIT EXCEEDED."', '{n}: "PLEASE WAIT."'],
      ['{n}: "QUERY ALREADY ANSWERED."', '{n}: "REPEAT REQUEST DETECTED."']],
    hardware: [['{n} has switched itself off.', '{n}: "..."'],
      ['{n}: "sleep mode. sleep mode."', '{n} plays a hold tone.'],
      ['{n}: "you said that already. it\'s ok"', '{n}: "buffer full. sorry"']],
    hybrid: [['{n} folds into the wires and stays there.', '{n} is pretending to be furniture.'],
      ['{n} answers only in static.', '{n} turns half its face away.'],
      ['{n}: "Your voice is wearing a groove in me."', '{n}: "We have spoken. Enough."']],
    folklore: [['{n} will not look at KURA.', '{n} has gone very, very still.'],
      ['{n}: "Speak once more and I bite."', '{n} glares.'],
      ['{n}: "Mortals never know when to stop."', '{n}: "Again? Truly?"']],
  };
  const SNAP = { ELF: "ELF's blade flicks out. A thin cut on KURA's arm.", "CU SITH": "CU SITH bites KURA's hand. Not hard. Hard enough." };
  const QUIT = {
    PIXIE: 'PIXIE: "FINE. Bye!" She flies off and doesn\'t come back.',
    data: '{n}: "SESSION TERMINATED." {n} is gone.',
    hardware: '{n}: "ok. bye." {n} wanders off into the dark.',
    hybrid: "{n} unlinks without a word and is gone.",
    folklore: '{n}: "Find another servant." {n} is gone.',
  };
  const VOICE_FROM_DARK = ['A voice answers from the stone: "Not yet."', 'Something that is not the party says: "...yes..."',
    "The dark answers in KURA's own voice.", 'A voice, very close: "Keep going."', "Something laughs, then apologizes.",
    "A voice below counts to seven, then stops.", 'A whisper: "We heard you the first time."'];
  function chat(st) {
    if (!ensureFloor(st)) return show(st);
    act(st);
    tally(st, "partyTalks");
    const friends = (st.party || []).slice(1).filter(p => p.hp > 0);
    const odd = moon() === 4 ? 0.25 : 0.12;
    if (!friends.length || Math.random() < odd) {
      st.log = `> Day ${st.day}. KURA speaks into the dark.`;
      st.extra = "> " + pick(friends.length || Math.random() < 0.5 ? VOICE_FROM_DARK : ["Only the walls answer.", "Her voice comes back, thinner."]);
      return show(st);
    }
    const p = pick(friends);
    st.log = `> Day ${st.day}. KURA talks to ${p.name}.`;
    const tier = heatTier((st.dungeon.heat || [])[st.dungeon.at] || 0), fam = p.family || "folklore";
    // Out of patience and still being talked to: half the time they snap. CHAOS members lash out at
    // KURA (it never kills her); LAW and NEUTRAL ones leave the party for good.
    if (p.patience === 0 && Math.random() < 0.5) {
      if (p.align === "CHAOS") {
        const kura = st.party[0], dmg = Math.min(kura.hp - 1, R(2, Math.ceil(kura.hpmax / 5)));
        st.party = st.party.map((q, i) => i === 0 ? { ...q, hp: q.hp - Math.max(0, dmg) } : q);
        st.log = `> Day ${st.day}. ${p.name} has had enough.`;
        st.extra = "> " + (SNAP[p.name] || `${p.name} strikes KURA.`) + (dmg > 0 ? ` -${dmg} HP` : "");
      } else {
        st.party = st.party.filter(q => q !== p);
        st.log = `> Day ${st.day}. ${p.name} leaves the party.`;
        st.extra = "> " + (QUIT[p.name] || QUIT[fam]).replace(/\{n\}/g, p.name);
      }
      return show(st);
    }
    p.patience = Math.max(0, (p.patience ?? PATIENCE) - 1);
    // A dangerous room (nervous or worse) outranks being annoyed; otherwise a tired member says so.
    const lines = tier >= 2 ? (PARTY_HEAT[p.name] || FAMILY_HEAT[fam])[tier]
      : p.patience <= 2 ? (PARTY_TIRED[p.name] || FAMILY_TIRED[fam])[p.patience]
      : tier ? (PARTY_HEAT[p.name] || FAMILY_HEAT[fam])[tier] : (PARTY_TALK[p.name] || FAMILY_TALK[fam]);
    const pool = lines.map(l => "> " + l.replace(/\{n\}/g, p.name));
    st.extra = pick(pool.filter(l => l !== st.extra));        // never the same line twice in a row
    return show(st);
  }

  // KURA's answer to a demon's price or offer.
  function answer(st, yes) {
    st = copy(st);
    const e = st.encounter;
    if (!e || !e.stage) return show(st);
    const lines = [];
    if (e.stage === "gift") return give(st, yes ? 0 : null);
    if (e.stage === "join") {
      if (!yes) { lines.push(`KURA declines. ${say2(e, "leave")}`); leaves(st, e); }
      else if (st.party.length < 4) recruit(st, e, lines);
      else { e.stage = "swap"; lines.push("The party is full. Send someone away?"); }
    }
    st.round = lines;
    st.roundOver = !st.encounter || st.dead;
    return show(st);
  }
  // GIFTS. A talking demon asks for anything. KURA picks: SILVER, any item, or nothing.
  // Each family has a taste: data and hardware like tech, folklore likes old spirit things and hates tech,
  // hybrids love things that are both. Rarer things are worth more, and a relic of the demon's own
  // alignment is worth extra (an opposite one, less). Reactions:
  //   hate (worth < 0): it throws the gift back and attacks.   meh (not enough yet): it keeps it and asks for more.
  //   like (enough): it may offer to join.                      love (well over): it almost always does.
  // CHAOS demons are tricksters: they rarely join. Mostly they demand more, or run off laughing with it.
  const TECH = ["a bag of loose screws", "a spent battery", "a vending machine coin", "a subway token", "a neon tube fragment",
    "a scratched data disc", "an ID card, face scratched", "a coil of copper wire", "a dead pager", "a cracked phone",
    "a cassette with no label", "a VR visor, lens cracked"];
  const SPIRIT = ["a moth-eaten glove", "a bead of smoky glass", "a cracked hand mirror", "a strip of prayer cloth",
    "a stub of black candle", "a rusted iron key", "a bent silver charm", "a page of a burned book"];
  const BOTH = ["a burned-out circuit board", "a tangle of fiber cable"];
  function natureOf(it) {
    const t = TIER[it];
    if (t === "RARE" || BOTH.includes(it)) return "both";
    if (t === "MYTHIC" || t === "MOON" || SPIRIT.includes(it)) return "spirit";
    return TECH.includes(it) ? "tech" : "plain";
  }
  const TASTE = {
    data:     { tech: 1.5, both: 1, spirit: -1, plain: 0.5, silver: 0.6 },
    hardware: { tech: 1.5, both: 1, spirit: 0.5, plain: 0.5, silver: 1.5 },
    hybrid:   { tech: 1, both: 2, spirit: 1, plain: 0.5, silver: 1 },
    folklore: { tech: -1, both: 1, spirit: 1.5, plain: 0.5, silver: 0.6 },
  };
  const WORTH = { COMMON: 1, UNCOMMON: 2, RARE: 4, MYTHIC: 6, MOON: 8 };
  // What KURA can give: SILVER first (if she has enough), then each kind of item she carries, rarest first.
  function gifts(st) {
    const e = st.encounter, out = [];
    if (!e) return out;
    out.push({ silver: e.silver, ok: (st.silver ?? 0) >= e.silver, label: `${e.silver} SILVER` });
    for (const it of inventory(st).slice(0, 7)) out.push({ item: it.name, ok: true, label: it.name });
    return out;
  }
  function worth(e, g) {
    const taste = TASTE[e.family || "folklore"];
    if (g.silver) return e.want * taste.silver;
    const a = itemAlign(g.item);
    const bonus = !a || a === "NEUTRAL" || e.align === "NEUTRAL" ? 0 : a === e.align ? 2 : -2;
    const t = taste[natureOf(g.item)];
    return t < 0 ? -1 : WORTH[TIER[g.item] || "COMMON"] * t + bonus;
  }
  // KURA gives gift i (from gifts()), or nothing (i = null).
  // (st is already a copy: giveTo and answer make it.)
  function give(st, i) {
    const e = st.encounter;
    if (!e || e.stage !== "gift") return show(st);
    const lines = [], who = `${e.name}: `;
    const g = i === null ? null : gifts(st)[i];
    if (g && !g.ok) { lines.push(`KURA has only ${st.silver ?? 0} SILVER.`); st.round = lines; return show(st); }
    if (!g) {
      lines.push(`KURA gives nothing.`, who + `"${say2(e, "no")}"`);
      if (e.family === "data") { lines.push(`${THE(e.name)} drifts away.`); leaves(st, e); }
      else { e.stage = null; e.angered = true; demonTurn(st, lines); }
      st.round = lines; st.roundOver = !st.encounter || st.dead; return show(st);
    }
    const v = worth(e, g);
    if (v < 0) {
      // Hated: it throws the gift back (KURA keeps it) and attacks.
      lines.push(`KURA offers ${g.label}.`, who + `"${say2(e, "hate")}"`, `${THE(e.name)} throws it back.`);
      e.stage = null; e.angered = true; demonTurn(st, lines);
      st.round = lines; st.roundOver = !st.encounter || st.dead; return show(st);
    }
    tally(st, "gifts");
    if (g.silver) { st.silver -= g.silver; lines.push(`KURA gives ${g.label}.`); lean(st, "pay", lines); }
    else {
      st.items.splice(st.items.indexOf(g.item), 1); lines.push(`KURA gives ${g.item}.`);
      const ga = itemAlign(g.item); lean(st, ga === "LAW" ? "offerLAW" : ga === "NEUTRAL" ? null : "offer", lines);
    }
    e.got += v;
    const chaos = e.align === "CHAOS";
    if (e.got < e.want) {
      // Not enough yet. It keeps what it got. After three asks it loses patience and leaves with it all.
      if (e.asks >= 3) { lines.push(who + `"${say2(e, "meh")}"`, `${THE(e.name)} takes it all and goes.`); leaves(st, e); }
      else { e.asks++; lines.push(who + `"${say2(e, "meh")}"`); }
    } else {
      const love = v >= e.want * 1.5 || e.got >= e.want * 2;
      lines.push(who + `"${say2(e, love ? "love" : "like")}"`);
      const joins = chaos ? (love ? 0.3 : 0.1) : (love ? 0.9 : 0.65);
      if (Math.random() < joins) { e.stage = "join"; lines.push(`${THE(e.name)} offers to join the party.`); }
      else if (chaos && e.asks < 3 && Math.random() < 0.5) { e.asks++; lines.push(who + `"More. MORE."`); }
      else if (chaos) { lines.push(`${THE(e.name)} runs off laughing with it.`); leaves(st, e); }
      else { lines.push(`${THE(e.name)} is satisfied. ${say2(e, "leave")}`); leaves(st, e); }
    }
    st.round = lines;
    st.roundOver = !st.encounter || st.dead;
    return show(st);
  }
  function giveTo(st, i) { return give(copy(st), i); }

  // CODEX: an encyclopedia of every demon met and item found. It lives in the save but RST never
  // clears it, so it fills up over many runs. The how-it-works notes live here, not on the item itself.
  function note(st, kind, name, what) {
    const c = st.codex = st.codex || { demons: {}, items: {} };
    const e = c[kind][name] = c[kind][name] || {};
    e[what] = (e[what] || 0) + 1;
  }
  const FAM_NAME = { data: "data", hardware: "hardware", hybrid: "hybrid", folklore: "folklore" };
  const NATURE_NAME = { tech: "Tech", spirit: "Old spirit thing", both: "Half machine, half spirit", plain: "Plain stuff" };
  function tastes(nature) {
    const by = { loves: [], likes: [], hates: [] };
    for (const f of Object.keys(TASTE)) {
      const t = TASTE[f][nature];
      if (t >= 1.5) by.loves.push(f); else if (t >= 1) by.likes.push(f); else if (t < 0) by.hates.push(f);
    }
    const out = [], LABEL = { data: "data", hardware: "hardware", hybrid: "hybrids", folklore: "folklore" };
    const say = (fams, verb) => fams.length && out.push(`${fams.map(f => LABEL[f]).join(", ").replace(/, ([^,]*)$/, " and $1")} ${fams.length > 1 || fams[0] === "hybrid" ? verb : verb + "s"} it`);
    say(by.loves, "love"); say(by.likes, "like"); say(by.hates, "hate");
    return out.length ? out.join("; ").replace(/^./, c => c.toUpperCase()) + "." : "No demon cares much for it.";
  }
  const WANTS = {
    data: "Wants tech. Hates old spirit things. Shrugs at SILVER.",
    hardware: "Loves SILVER. Likes tech.",
    hybrid: "Loves things half machine, half spirit (most RARE finds). Takes coin.",
    folklore: "Wants old spirit things. Hates tech. Shrugs at SILVER.",
  };
  function codex(st) {
    const c = st.codex || { demons: {}, items: {} };
    const demons = Object.keys(FAMILY).map(f => ({ group: FAM_NAME[f], entries: FAMILY[f].concat(f === "folklore" ? Object.keys(UNIQUE) : []).map(name => {
      const seen = c.demons[name] || {}, fam = familyOf(name), al = alignOf(name);
      const known = !!(seen.met || seen.joined || (st.party || []).some(p => p.name === name));
      if (!known) return { name, known };
      const lines = [];
      if (UNIQUE[name]) lines.push("It does not talk. It does not stop.");
      else {
        lines.push(`"${VOICE[fam].open[0]}"`, WANTS[fam]);
        if (al === "CHAOS") lines.push("Trickster: takes gifts, rarely joins.");
      }
      lines.push(al === "NEUTRAL" ? "NEUTRAL: neither friend nor foe to anyone."
        : `${al}: friendlier to a ${al} KURA, hostile to a ${al === "LAW" ? "CHAOS" : "LAW"} one.`);
      return { name, known, tag: `${UNIQUE[name] ? "unique" : fam}   ${al}`, lines, count: `Met ${seen.met || 0}   Recruited ${seen.joined || 0}` };
    }) }));
    const items = TIERS.slice().reverse().map(t => ({ group: t, entries: names(t).map(name => {
      const seen = c.items[name] || {};
      if (!seen.found) return { name, known: false };
      const a = itemAlign(name), info = ITEM_INFO[name] || {}, nat = natureOf(name);
      const lines = [info.text, `${NATURE_NAME[nat]}. ${tastes(nat)}`];
      if (a === "LAW" || a === "CHAOS") lines.push(`${a}: finding or giving it pulls KURA toward ${a}.`,
        `${a} demons prize it. ${a === "LAW" ? "CHAOS" : "LAW"} demons think less of it.`);
      else if (a) lines.push("NEUTRAL: no pull either way.");
      if (info.use) lines.push("Can be used from INVOKE.");
      return { name, known: true, tag: `${t}${a ? "   " + a : ""}`, lines, count: `Found ${seen.found}` };
    }) }));
    return { demons, items };
  }

  // With a full party: send member i (1-3; KURA can't leave) away to make room, or keep everyone (i = null).
  function swap(st, i) {
    st = copy(st);
    const e = st.encounter;
    if (!e || e.stage !== "swap") return show(st);
    const lines = [];
    if (i === null || !st.party[i] || i === 0) { lines.push(`KURA keeps the party. ${say2(e, "leave")}`); leaves(st, e); }
    else { const gone = st.party.splice(i, 1)[0]; lines.push(`${gone.name} leaves the party.`); recruit(st, e, lines); }
    st.round = lines;
    st.roundOver = true;
    return show(st);
  }
  function leaves(st, e) { st.log = `> Day ${st.day}. ${THE(e.name)} leaves.`; st.encounter = null; }
  function recruit(st, e, lines) {
    const lv = Math.max(1, 2 * floorNum(st) + R(-1, 2));
    const hpmax = 12 + lv * 5, mpmax = lv * 2 + R(0, 4);
    st.party.push({ name: e.name, lv, hp: hpmax, hpmax, mp: mpmax, mpmax, family: e.family, align: e.align, demon: true });
    lines.push(`${e.name}: "${say2(e, "join")}"`, `${e.name} joins the party.`);
    note(st, "demons", e.name, "joined"); tally(st, "recruited");
    lean(st, e.align, lines);
    st.log = `> Day ${st.day}. ${e.name} joins the party.`;
    st.encounter = null;
  }

  // The end-of-run summary: label/value pairs for the log screen.
  function summary(st) {
    const k = st.stats || {}, d = st.dungeon, heat = d && d.heat ? d.heat[d.at] || 0 : 0;
    const TIER = ["calm", "uneasy", "nervous", "wrong"];
    const fixed = n => (n > 0 ? "+" : "") + (Math.round((n || 0) * 10) / 10);
    return [
      ["Reached", `${st.floor}  (${k.floors || 0} floor${k.floors === 1 ? "" : "s"} descended)`],
      ["Days", st.day], ["Turns", st.steps || 0], ["Steps walked", k.steps || 0], ["Searches", k.searches || 0],
      ["Alignment", `${st.align}  (lean ${fixed(st.alignScore)}, LAW - / CHAOS +)`],
      ["Heat here", `${Math.round(heat)}  (${TIER[heatTier(heat)]})`], ["Hottest room", Math.round(k.maxHeat || 0)],
      ["Demons met", k.met || 0], ["Beaten", k.beaten || 0], ["Talked to", k.demonTalks || 0],
      ["Gifts given", k.gifts || 0], ["Recruited", k.recruited || 0], ["Escaped", k.fled || 0],
      ["Party talks", k.partyTalks || 0], ["Items found", k.items || 0],
      ["SILVER", `${st.silver || 0}  (${k.silverFound || 0} found)`], ["ICHOR", `${st.ichor || 0}  (${k.ichorWon || 0} won)`],
      ["Party left", (st.party || []).slice(1).map(p => p.name).join(", ") || "nobody"],
    ];
  }

  const api = { summary, next, reset, search, go, turn, available, tick, inventory, useItem, fight, talk, answer, swap, give: giveTo, gifts, codex, omen: t => omen(t), tierOf: n => TIER[n] || "COMMON", itemAlign };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
