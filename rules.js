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
    folklore: ["REDCAP", "GAKI", "BANSHEE", "BARGHEST", "TROLL", "GHOUL", "ONI", "KAPPA", "LAMIA", "WRAITH", "IMP"],
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

  // The real calendar, in Honolulu time (UTC-10). A day number counts days since 1970.
  // NEXT (key X) is a hidden testing cheat that pushes this game's clock a day ahead.
  const dayNum = now => Math.floor((now.getTime() - 10 * 3600 * 1000) / 86400000);
  // The game never goes back in time: if the device clock is set earlier than a day this run has
  // already seen, the game stays on that day (so rewinding can't redo a day or dodge a deadline).
  const rawClock = st => dayNum(new Date()) + (st.clockOffset || 0);
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
  function sync(st) {
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
        st.items = (st.items || []).concat(it); return `A locker holds ${it}.`;
      }
      case "silver": { const n = R(20, 150); st.silver = silver + n; return `Coins in the rubble. ${n} SILVER.`; }
      case "item": { const it = rollItem(st); st.items = (st.items || []).concat(it); return `KURA finds ${it}.`; }
      case "demon": {
        // A demon appears and stays until it's fought, talked down, or escaped (see the ENCOUNTER section).
        const name = pickDemon(st);
        const hpmax = Math.round((16 + 9 * floorNum(st) + R(0, 8)) * (UNIQUE[name] ? UNIQUE[name].hp : 1));
        st.encounter = { name, hp: hpmax, hpmax, round: 0, angered: false };
        st.round = [`${A(name)} blocks the way.`];
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
      st.items = (st.items || []).concat(w.deep.item);
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
      st.round = [`KURA runs ${NAME[dir]} and leaves ${the(e.name)} behind.`];
    } else act(st);
    const descending = d.found[d.at].includes("stairs") && dir === stairsDir(d.floor, d.at);
    // Taking the stairs down doesn't use the day's step; walking to another room does.
    if (!descending) st.today.stepped = true;
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
      return { name, count: counts[name], text: info.text, usable: !!info.use, tier: TIER[name] || "COMMON" };
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
    lines.push(`${THE(e.name)} falls.  +${n} ICHOR`);
    const dropOdds = [0, 0, 0, 0.1, 0.25, 0.1, 0, 0][moon()];
    if (Math.random() < dropOdds) {
      const it = pick(MOON_DROPS);
      st.items = (st.items || []).concat(it);
      lines.push(`It leaves ${it}.`);
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
      let total = 0;
      for (const p of st.party) if (p.hp > 0) total += R(1, 4) + Math.floor((p.lv || 1) / 2);
      e.hp = Math.max(0, e.hp - total);
      lines.push(`The party strikes. -${total}`);
      st.log = `> Day ${st.day}. KURA's party fights ${the(e.name)}.`;
      if (e.hp <= 0) win(st, lines);
    }, "> Nothing here to fight.");
  }
  // TALK: the demon may listen and leave (sometimes with a gift), ask a price, or take offense.
  function talk(st) {
    return round(st, (st, lines) => {
      const e = st.encounter;
      st.log = `> Day ${st.day}. KURA speaks to ${the(e.name)}.`;
      if (e.angered || (UNIQUE[e.name] && !UNIQUE[e.name].talks)) { lines.push(`${THE(e.name)} won't listen.`); return; }
      const r = Math.random(), ok = Math.min(0.95, LISTEN[moon()] * omen(clock(st)).fx.talk);
      if (r < ok * 0.6) {
        lines.push(`${THE(e.name)} listens, and slips away.`);
        if (Math.random() < 0.4) { const it = pick(ITEMS); st.items = (st.items || []).concat(it); lines.push(`It leaves ${it} behind.`); }
        st.log = `> Day ${st.day}. KURA talks ${the(e.name)} down. It leaves.`;
        st.encounter = null;
      } else if (r < ok) {
        const price = 20 + 10 * floorNum(st) + R(0, 20), have = st.silver ?? st.macca ?? 0;
        if (have >= price) {
          st.silver = have - price;
          lines.push(`${THE(e.name)} wants ${price} SILVER. KURA pays. It leaves.`);
          st.log = `> Day ${st.day}. KURA pays ${the(e.name)} ${price} SILVER. It leaves.`;
          st.encounter = null;
        } else { lines.push(`${THE(e.name)} wants ${price} SILVER. KURA has too little.`); e.angered = true; }
      } else { lines.push(`${THE(e.name)} laughs at KURA.`); e.angered = Math.random() < 0.5; }
    }, "> KURA speaks. Only the walls answer.");
  }
  const api = { next, reset, search, go, turn, available, tick, inventory, useItem, fight, talk, omen: t => omen(t), tierOf: n => TIER[n] || "COMMON" };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
