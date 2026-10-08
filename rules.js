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
  const MOON_DROPS = names("MOON");
  // A found item's rarity: mostly common, sometimes uncommon, rarely rare.
  function rollItem(st) {
    const loot = st ? omen(clock(st) + (st.omenSalt || 0)).fx.loot : 1, r = Math.random();
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
  // PROGRAMS: friendly software that lives in the dungeon's system. They are LAW, speak as data does, and
  // can be recruited. Each does one small job for the party (see PROGRAM JOBS).
  const PROGRAMS = ["WATCHDOG", "PATCH", "CACHE", "SCAN", "COMPILER"];
  const isProgram = n => PROGRAMS.includes(n);
  const has = (st, n) => (st.party || []).some(p => p.name === n && p.hp > 0);
  // CORRUPTION. Late in the week the system is damaged: some demons turn up corrupted (CHAOS, a glitched name),
  // data ones most of all. Talking can restore them. Nothing is corrupted in the first half of the week.
  function corruptOdds(st, fam) {
    const d = st.dungeon; if (!d || !d.floor) return 0;
    const span = Math.max(1, (d.floor.days || 7) - 1), prog = Math.max(0, Math.min(1, (clock(st) - (d.arrived ?? clock(st))) / span));
    if (prog < 0.5) return 0;
    return (0.1 + 0.3 * (prog - 0.5) / 0.5) * (fam === "data" ? 1 : 0.5);
  }
  const GLITCH = { A: "@", E: "3", I: "!", O: "0", U: "#" };
  const glitch = n => n.replace(/[AEIOU]/, c => GLITCH[c]);
  const LADDER = [                                      // family weights by floor (B1F, B2F, B3F, B4F and deeper)
    { data: 7, hardware: 3, hybrid: 0, folklore: 0 },
    { data: 4, hardware: 5, hybrid: 1, folklore: 0 },
    { data: 1, hardware: 3, hybrid: 5, folklore: 2 },
    { data: 0, hardware: 1, hybrid: 4, folklore: 6 },
  ];
  const UNIQUE = { "ATOM SLASHER": { hp: 2, hit: 1.5, talks: false } };
  // LOOP and LINGER. st.loop = { key, n } counts how many times in a row KURA has done the same thing (every action sets a key:
  // "search:room:wall", "turn", "talk:party", "use:item"...; any different action starts again at 1). The room's linger counts
  // every action taken in it. Alone, a long loop wears on KURA: whispers, then a TRIP, then something answers.
  const LINGER_AT = 30;
  const DREAD = { whisper: 8, trip: 15, answer: 25 };   // searching counts at half (it heats the room already)
  const A = n => (UNIQUE[n] ? n : (/^[AEIOU]/.test(n) ? "An " : "A ") + n), THE = n => (UNIQUE[n] ? n : "The " + n), the = n => (UNIQUE[n] ? n : "the " + n);
  // Pick a demon: the floor sets the families; noise and today's omen tilt them.
  // Repeating one wall draws data things; lingering in a room draws older things.
  // How many times in a row KURA has searched the wall she is facing in this room.
  function wallLoop(st) {
    const d = st.dungeon, k = st.loop && st.loop.key;
    return d && k && k.startsWith(`search:${d.at}:`) ? st.loop.n : 0;
  }
  function pickDemon(st) {
    for (let i = 0; i < 8; i++) { const n = pickDemon1(st); if (!(st.party || []).some(p => p.name === n)) return n; }
    return pickDemon1(st);
  }
  function pickDemon1(st) {
    if (Math.random() < 0.03) return "ATOM SLASHER";
    if (Math.random() < 0.07) { const free = PROGRAMS.filter(n => !(st.party || []).some(p => p.name === n)); if (free.length) return pick(free); }
    const d = st.dungeon, w = { ...LADDER[Math.min(floorNum(st), 4) - 1] }, om = omen(clock(st) + (st.omenSalt || 0)).fx;
    const wall = wallLoop(st), linger = d ? RS(d).linger : 0;
    if (wall >= 4) { w.data += 3; w.hardware += 2; }
    if (linger >= LINGER_AT) { w.folklore += 3; w.hybrid += 2; }
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
    { key: "none", fx: {}, lines: ["Your load will be counted.", "The deep learns your name.",
      "Someone walked here before.", "Count the doors. Count again.", "The ninth bell has not rung.",
      "What is below was once above.", "A light is left on for you.", "The stone dreams of the sea.",
      "Not every silence is empty.", "A promise kept, far below."] },
    { key: "data", fx: { data: 2 }, lines: ["The wires remember.", "Something is counting down.", "A dial tone, far away."] },
    { key: "folk", fx: { folk: 2 }, lines: ["Old things walk early.", "Salt on the wind.", "The old ones stir."] },
    { key: "heat", fx: { heat: 2 }, lines: ["Do not linger.", "The room is listening today.", "Short stays. Quiet feet."] },
    { key: "hard", fx: { find: 0.5 }, lines: ["The walls keep their secrets.", "Every seam is sealed today.", "The stone stays shut."] },
    { key: "easy", fx: { find: 1.6 }, lines: ["A door is open somewhere.", "Something is loose in stone.", "The seams are soft today."] },
    { key: "talk", fx: { talk: 1.6 }, lines: ["Strangers listen.", "Today, they will hear you out.", "Speak first. They are lonely."] },
    // Good days, plainly good.
    { key: "calm", fx: { heat: 0.5 }, lines: ["The halls are sleeping.", "Soft steps go unheard.", "Even the walls are tired."] },
    { key: "loot", fx: { loot: 3 }, lines: ["The deep is generous today.", "Something precious is near.", "Fortune favors the patient."] },
  ];
  const hash = n => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
  function omen(t) {
    const h = hash(t), o = (h % 100) < 50 ? OMENS[0] : OMENS[1 + (h >>> 8) % (OMENS.length - 1)];
    const fx = { data: 1, folk: 1, heat: 1, find: 1, talk: 1, loot: 1, ...o.fx };
    const pool = o.lines;
    return { key: o.key, fx, text: '> "' + pool[(h >>> 16) % pool.length] + '"' };
  }

  // HEAT: every search warms the room, and the hotter it is the likelier something comes.
  // From about 1 in 24 per search when cold, up to about 1 in 4 at its hottest. Heat fades by
  // half each night and never fully resets. Tiers are told on line 3, and the tells never lie.
  const HEAT_MAX = 20;
  const heatTier = h => (h >= 18 ? 3 : h >= 12 ? 2 : h >= 6 ? 1 : 0);
  const MOON_PULL = [0.8, 0.9, 1, 1.1, 1.25, 1.1, 1, 0.9];       // the moon still stirs things a little
  function encounterChance(st) {
    const d = st.dungeon, h = RS(d).heat;
    const here = d.floor.rooms[d.at];
    if (here.kind === "bay" || here.hall) return 0;      // a Recharge Bay and a passage are safe
    return (1 / 24 + (1 / 4 - 1 / 24) * Math.min(1, h / HEAT_MAX)) * MOON_PULL[moon()];
  }
  const HEAT_TELL = {
    1: { plain: "> Your footsteps sound louder than before.", data: "> A dial tone, somewhere in the walls.", folk: "> The air smells of wet iron." },
    2: { plain: "> Something in the walls goes quiet.", data: "> Something is counting, very softly.", folk: "> Humming. Low, and getting closer." },
    3: { plain: "> The room is listening.", data: "> SIGNAL DETECTED", folk: "> Salt underfoot. You didn't spill it." },
  };
  function heatUp(st, amount) {
    const d = st.dungeon;
    const rs = RS(d), before = heatTier(rs.heat);
    rs.heat = Math.min(HEAT_MAX + 4, rs.heat + amount * omen(clock(st) + (st.omenSalt || 0)).fx.heat);
    const after = heatTier(rs.heat);
    st.stats = st.stats || {}; st.stats.maxHeat = Math.max(st.stats.maxHeat || 0, rs.heat);
    if (after > before) {
      const linger = rs.linger;
      const kind = wallLoop(st) >= 4 ? "data" : linger >= LINGER_AT ? "folk" : "plain";
      st.tell = HEAT_TELL[after][kind];
    }
    if (after !== before) { st.statusIn = 0; st.statusKind = "air"; }   // the conditions report updates right away
  }
  // A stub of black candle calms the room it's lit in.
  function calm(st) { const d = st.dungeon; if (d) RS(d).heat = Math.max(0, RS(d).heat - 8); }

  const floorNum = st => parseInt(String(st.floor).replace(/\D/g, ""), 10) || 1;
  // Log lines only name a direction when stating a character's action ("KURA goes WEST"), never for hints or doors.
  const doorList = room => Object.keys(room.doors).length + (room.falseDoors || []).length > 1 ? "Two doors." : "A single door.";
  // The third log line. About half the time it carries a faint clue about the room KURA is in
  // or the door she faces (never a direction word); otherwise it's pure atmosphere.
  // Every action starts from a copy. The ALIGN arrow (st.pull) belongs to the action that set it,
  // so a new action clears it; the page's once-a-minute catch-up (tick) keeps it.
  const clone = st => JSON.parse(JSON.stringify(st));
  const copy = st => { const c = clone(st); delete c.pull; return c; };
  // ROOM STATE. Everything the game remembers about a room lives in one object per room: d.state[i] =
  // { visited, found: [what's been uncovered], heat, linger, kindDay, altarDay, altarUses, walls }. Rooms are
  // reserved as the floor grows (see floor.js), so nothing assumes how many there are.
  const freshRoom = () => ({ visited: false, found: [], heat: 0, linger: 0 });
  const RS = (d, i = d.at) => {
    if (!d.state) d.state = [];
    for (let k = 0; k <= i; k++) if (!d.state[k]) d.state[k] = freshRoom();   // no gaps: a skipped room still gets its record
    return d.state[i];
  };
  const allRooms = d => { RS(d, Math.max(d.at, d.floor.count - 1)); return d.state; };
  // Run stats for the end-of-run summary: counts kept in st.stats (steps, searches, demons, finds...).
  const tally = (st, k, n = 1) => { st.stats = st.stats || {}; st.stats[k] = (st.stats[k] || 0) + n; };

  // The third line drifts now and then: after a search or a turn there's a chance it changes,
  // so it isn't frozen all day. The last-day warning stays put.
  function drift(st) {
    const d = st.dungeon;
    if (st.dead || !d) return;
    if (d.deadline !== undefined && clock(st) === d.deadline) { st.extra = "> The air grows heavy. The way down closes tonight."; return; }
    // Taint plays tricks: from 3 drinks KURA sometimes sees things; tripping, most of the time.
    if ((st.taint || 0) >= ODD_AT && Math.random() < (tripping(st) ? 0.5 : 0.2)) { st.extra = "> " + pick(TRIP_LINES); return; }
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
    terminal: ["A terminal, set into the wall. Its screen waits.", "A dead screen in the stone. Someone is awake.",
      "A terminal in the wall. The cursor blinks."],
    stairs: ["The stairs drop into the dark.", "Steps lead down. They do not end.",
      "The stairs wait."],
  };
  function sight(st) {
    const v = st.dungeon ? (show(st), st.view.end) : "wall";
    return pick(SEE[v] || SEE.wall);
  }
  // DOOR HINTS and DEAD-END CLUES. Each locked door hides a room of one kind. SEARCHing a locked door sometimes gives a
  // faint hint of what is behind it (the senses overlap on purpose: warm for the Den and the Forge, a hum for the Bay and
  // the Altar, cold and static for the Vault and the Relay). A wing's dead end hides a BIG clue: a scrap that says
  // outright what one of the wing's two doors is. It never says which door, and no clue ever names a room.
  const KIND_HINT = {
    den: ["Warm air breathes along the bottom of the door.", "The door is faintly warm to the touch.", "Hot dust, and the smell of old plastic."],
    bay: ["A soft hum, like something asleep.", "The air at the door is clean, and still.", "KURA's shoulders drop a little, standing here."],
    relay: ["Static hisses behind the door, then stops.", "Something inside turns, slowly, with a tick.", "A thin carrier tone, almost a voice."],
    vault: ["The door is cold, and heavier than it looks.", "A dry, metallic hush behind the wood.", "Something small and hard settles inside."],
    forge: ["The handle is warm, and gritty with ash.", "A smell of solder leaks around the frame.", "Tiny ticks, like metal cooling."],
    altar: ["A faint light shows at the door's edge.", "The crack hums on one note, almost singing.", "Something on the other side is listening."],
    archive: ["Rows of tiny lights blink behind the door, in no hurry.", "A dry, whirring hush, like drives spinning down.", "The door is cool, and smells of dust and warm plastic."],
  };
  const KIND_CLUE = {
    den: ["> Scratched into the wall: IT'S ALWAYS WARM BACK THERE.", "> A torn tag: LOOSE GEAR, HOT AIR. TAKE WHAT YOU CAN CARRY."],
    bay: ["> A note taped to the wall: SAFE TO REST. NOTHING GETS IN.", "> Chalked low on the stone: A PLACE TO LIE DOWN. ONE DOOR."],
    relay: ["> Scrawled in marker: THE DISHES TURN. LISTEN, IT KNOWS THE WAY.", "> A cable, tied in a knot, tagged: FOLLOW THE CARRIER."],
    vault: ["> Chalked on the stone: COIN. RACKS OF IT. DON'T LINGER.", "> A tally of numbers, and under it: SILVER, BEHIND THE COLD DOOR."],
    forge: ["> A scorched tag: BENCH AND TOOLS. BRING THE TAINT TO BURN OUT.", "> Scratched deep: IT MENDS THE BAD OUT OF YOU."],
    altar: ["> A scrap of print: IT ASKS. GIVE, AND IT ANSWERS.", "> Written small, over and over: FEED THE SCREEN."],
    archive: ["> A label, half peeled: EVERYTHING EVER SAVED. TAKE ONE.", "> Stamped on a drive: ONE STILL SPINS."],
  };
  // What the room beyond an open arch is like (finishes "a room that ..."). Senses only; it never names the room.
  const ARCH_DESC = {
    den: ["runs warm, and smells of hot dust", "breathes warm air, and old plastic"],
    bay: ["is quiet and clean, and hums like something asleep", "feels kind, and very still"],
    relay: ["carries a thin tone, almost a voice", "ticks and hisses, faintly"],
    vault: ["is cold and dry, and holds its breath", "is cold, with a hush of metal"],
    forge: ["smells of solder and ash", "ticks like cooling metal"],
    altar: ["glows faintly at one wall", "seems to be listening"],
    archive: ["blinks with rows of tiny lights", "whirs, dry and low"],
    hall: ["is only a narrow way through, bare and echoing", "stretches on, narrow and bare"],
    dead: ["closes in, with nowhere further to go", "is small and shut, at the end of the way"],
    plain: ["is bare and quiet", "is plain and still"],
  };
  const FALSE_SEARCH = ["Paint. A door painted on bare stone.", "The door is flat. Brush strokes, and nothing under them.", "KURA knocks. Solid wall, dressed up as a door."];
  const FALSE_GO = ["The door is only paint. The cell keeps its charge.", "KURA pushes. It is a wall with a door painted on it. No charge spent.", "A painted door. The cell was never needed."];
  const SEALED = ["The door is jammed shut. It won't open now.", "Something settled behind this door. It will not move.", "The frame has seized. This way is closed for good."];
  function atmosphere(st) { return flavor(st); }

  // The stairs sit against a wall with no door. Which wall is fixed by the floor's seed.
  // A wall with a door on it: a real door (open, locked or sealed) or a false one.
  const doorWall = (room, x) => x in room.doors || (room.falseDoors || []).includes(x);
  function stairsDir(floor, i) {
    const free = CW.filter(d => !doorWall(floor.rooms[i], d));
    return free[floor.seed % free.length];
  }

  // A door is LOCKED while the room behind it isn't built yet: opening it takes the day's one key.
  // (a SEALED door was shut for good when the other door of its offer was opened; a FALSE door is only paint)
  const isSealed = (d, dir) => FLOOR.isSealed(d.floor, d.at, dir);
  const isFalse = (d, dir) => (d.floor.rooms[d.at].falseDoors || []).includes(dir);
  const isLocked = (d, dir) => { const j = d.floor.rooms[d.at].doors[dir]; return j !== undefined && !d.floor.rooms[j] && !isSealed(d, dir); };
  const looksLocked = (d, dir) => isLocked(d, dir) || isFalse(d, dir);          // what the player sees: a door that asks for a charge

  // Ways out of KURA's room: its doors, plus the stairs once they've been found.
  function exits(d) {
    const out = Object.keys(d.floor.rooms[d.at].doors);
    if (RS(d).found.includes("stairs")) out.push(stairsDir(d.floor, d.at));
    return CW.filter(x => out.includes(x));
  }

  // Draw the minimap and the first-person view from where KURA stands and faces.
  // BINARY. Data demons sometimes speak in binary (real ASCII). Only a data demon in the party can read
  // it: with one along, each binary line gets a translation, e.g. 01001000 01001001  [PACKET: "HI"].
  const BIN = /\b[01]{8}(?: [01]{8})+\b/;
  function translate(st, line) {
    if (typeof line !== "string" || !BIN.test(line) || /\[\w[^\]]*: "/.test(line)) return line;
    const reader = (st.party || []).slice(1).find(p => p.hp > 0 && p.family === "data") || (tripping(st) && st.party[0]);
    if (!reader) return line;
    const text = line.match(BIN)[0].split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
    const out = `${line}  [${reader.name}: "${text}"]`;
    return out.length > 77 && line.startsWith("> ") ? line : out;
  }

  // DREAD: KURA alone, doing the same thing again and again. Whispers, then a TRIP, then something answers.
  const DREAD_LINES = ["> The room seems to lean closer.", "> KURA has done this before. Hasn't she.", "> Something is counting.",
    "> The silence has a shape now.", "> KURA's own breathing sounds like someone else's."];
  function dread(st) {
    st.dreadCheck = false;
    const d = st.dungeon, k = st.party && st.party[0];
    if (!d || !k || st.dead || st.encounter || st.question) return;
    if (st.party.slice(1).some(p => p.hp > 0)) return;          // company keeps the dark away
    const key = (st.loop && st.loop.key) || "", n = ((st.loop && st.loop.n) || 0) / (key.startsWith("search:") ? 2 : 1);
    const safe = !!d.floor.rooms[d.at].hall;                    // no demon comes into a passage, not even this one
    if (n >= DREAD.answer && !safe) {
      const name = "ATOM SLASHER", u = UNIQUE[name];
      const hpmax = Math.round((16 + 9 * floorNum(st) + R(0, 8)) * u.hp);
      st.encounter = { name, family: familyOf(name), align: alignOf(name), hp: hpmax, hpmax, round: 0, angered: false, stage: null };
      st.question = null;
      st.round = ["Something answers.", `${name} steps out of the quiet.`];
      st.loop = { key: "", n: 0 }; st.extra = "> It was listening the whole time."; st.extraUrgent = true;
      note(st, "demons", name, "met"); tally(st, "met");
    } else if (n >= DREAD.trip && !tripping(st)) {
      k.status = "TRIP"; st.tripLeft = R(50, 100); st.turnShown = st.steps; tally(st, "trips");
      st.extra = "> The walls lean in to listen. KURA is TRIPPING."; st.extraUrgent = true; st.statusIn = 0;
    } else if (n >= DREAD.whisper && Math.random() < Math.min(0.6, 0.1 * (n - DREAD.whisper + 1))) {
      st.extra = pick(DREAD_LINES.filter(l => l !== st.extra));
    }
  }
  // ROOM NAMES: so a backtracking player can tell rooms apart. The start room is "Stairs up", the room holding the
  // stairs down (once found) is "Stairs down", and every other room is named the first time KURA walks in. The name is a
  // flavor word for what the room is like (11 characters at most, the same senses as the arch lines), never the room's
  // actual name. It sticks to the room, and no two rooms on a floor share one.
  const NAMES_BY_KIND = {
    den: ["Snug room", "Burrow room", "Musty room"], bay: ["Quiet room", "Soft room", "Still room"],
    relay: ["Tone room", "Static room", "Dish room"], vault: ["Heavy room", "Sealed room", "Hushed room"],
    forge: ["Ash room", "Solder room", "Soot room"], altar: ["The altar"],
    archive: ["Drive room", "Rack room", "Spin room"], hall: ["Passageway", "Conduit", "Crawlway", "Corridor", "Walkway", "Service way"], dead: ["Dead end", "Sealed end"],
    plain: ["Dusty room", "Damp room", "Grey room", "Tiled room", "Mossy room", "Sooty room", "Round room", "Echo room", "Salt room",
      "Rusty room", "Hollow room", "Side room", "Back room", "Big room", "Small room", "Odd room", "Wet room", "Dry room", "Low room",
      "High room", "Lamp room", "Bent room", "Split room", "Dim room", "Old room", "Plain room", "Faded room", "Chalky room", "Bleak room",
      "Dark room", "Pale room", "Wide room"],
  };
  function roomName(d, i) {
    if (i === 0) return "Stairs up";
    if (allRooms(d)[i] && allRooms(d)[i].found.includes("stairs")) return "Stairs down";
    const rs = RS(d, i);
    if (rs.name) return rs.name;
    const rm = d.floor.rooms[i], used = new Set(allRooms(d).map(x => x.name).filter(Boolean));
    const lists = [NAMES_BY_KIND[rm.kind || (rm.hall ? "hall" : rm.dead ? "dead" : "plain")] || NAMES_BY_KIND.plain, NAMES_BY_KIND.plain];
    const h = Math.abs(Math.imul((d.floor.seed | 0) ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) >>> 7);
    for (const list of lists) {
      for (let t = 0; t < list.length; t++) { const n = list[(h + t) % list.length]; if (!used.has(n)) return (rs.name = n); }
    }
    return (rs.name = NAMES_BY_KIND.plain[h % NAMES_BY_KIND.plain.length]);
  }
  function show(st) {
    if (!st.dungeon) return st;
    if (st.dreadCheck) dread(st);
    const d = st.dungeon, room = d.floor.rooms[d.at];
    if (st.round) st.round = st.round.map(l => translate(st, l));
    if (st.extra) st.extra = translate(st, st.extra);
    st.omenText = omen(clock(st) + (st.omenSalt || 0)).text;                 // the omen, framed under the 3D view
    status(st);                                         // line 1
    st.extraUrgent = false;                             // the page holds line 3 for a moment, unless this is a warning
    if (st.tell && !st.question) { st.extra = st.tell; delete st.tell; st.extraUrgent = true; } // a heat tell takes line 3 right away (not over a question)
    RS(d);                                              // (converts an old save's room arrays)
    st.roomName = roomName(d, d.at);
    st.map = FLOOR.minimap(d.floor, { at: d.at, facing: st.facing, visited: allRooms(d).map(s => s.visited), found: allRooms(d).map(s => s.found) });
    const door = dir => doorWall(room, dir);
    if (st.dead) {
      // Game over: the view goes dark and the third line points to RST.
      st.view = { left: [true, true], right: [true, true], end: "dark" };
      st.extra = "> GAME OVER. Press [R]ESET to begin a new run.";
      return st;
    }
    const stairsAhead = RS(d).found.includes("stairs") && st.facing === stairsDir(d.floor, d.at);
    st.view = {
      left: [!door(LEFT[st.facing]), true], right: [!door(RIGHT[st.facing]), true],
      end: stairsAhead ? "stairs" : door(st.facing) ? "door" : facingAltar(st) ? "terminal" : "wall",
      lock: stairsAhead ? null : isSealed(d, st.facing) ? "x" : looksLocked(d, st.facing) ? "+" : null,    // the knob: + asks for the key, x is sealed
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
    const floor = FLOOR.generate(undefined, { days: Math.min(7, deadline - clock(st) + 1) });
    const a = FLOOR.arrive(floor);
    st.floor = `B${num}F`;
    st.facing = a.facing;
    st.dungeon = { seed: floor.seed, floor, at: a.at, deadline, arrived: clock(st),
      state: [{ ...freshRoom(), visited: true }] };
    st.statusIn = 0;                                   // a fresh floor gets a fresh report
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
  const STANDBY_LINES = ["> KURA kept still all day. The party sleeps deeper tonight.", "> A quiet day. Everyone wakes lighter.",
    "> Nothing moved, and nothing was lost. The room feels kinder.", "> The long stillness did its work."];
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
    // A day KURA chose to HOLD (see hold) is STANDBY: a deeper rest tonight.
    const held = !!st.today.held && st.today.date === t - 1 && !!st.dungeon && !st.dead;
    // A day nobody played leaves the cell charged: one spare is banked (never more than one).
    const away = t - st.today.date - 1 > 0 && !!st.dungeon;
    const earned = away && !(st.spare > 0);
    if (away) st.spare = 1;
    st.today = { date: t, stepped: false };
    st.unsaved = true;
    st.statusIn = 0; st.statusKind = "news";
    // Overnight every room's heat halves. It never quite resets.
    let settled = false;
    if (st.dungeon) {
      const here = RS(st.dungeon), was = heatTier(here.heat);
      for (const rs of allRooms(st.dungeon)) { rs.heat = Math.floor(rs.heat / 2); rs.linger = 0; }
      settled = was > 0 && heatTier(here.heat) < was;
    }
    // Sleep ends a trip, and taint fades a point.
    if (tripping(st)) comeDown(st);
    if (st.taint) st.taint = Math.max(0, st.taint - 1);
    // A night's rest gives back some patience.
    st.party = (st.party || []).map(p => p.patience === undefined ? { ...p, chats: 0 } : { ...p, chats: 0, patience: Math.min(PATIENCE, p.patience + 3) });
    // A night's rest heals a fifth of everyone's HP (fallen allies too, slowly).
    if (!st.dead) st.party = st.party.map(p => ({ ...p, hp: Math.min(p.hpmax, p.hp + Math.ceil(p.hpmax / 5)) }));
    if (held) {   // standby is a camp: everyone standing is whole again, patience is full, taint is gone, the room cools right down
      st.party = st.party.map(p => p.hp > 0 ? { ...p, hp: p.hpmax, mp: p.mpmax ?? p.mp, ...(p.patience === undefined ? {} : { patience: PATIENCE }) } : { ...p, hp: Math.min(p.hpmax, p.hp + Math.ceil(p.hpmax / 5)) });
      st.taint = 0;
      campJobs(st);
      if (st.dungeon) { for (const rs of allRooms(st.dungeon)) rs.heat = Math.floor(rs.heat / 2); RS(st.dungeon).heat = 0; }
      st.loop = { key: "", n: 0 };
      tally(st, "standby");
    }
    const d = st.dungeon;
    if (d && t > d.deadline) {
      st.dead = true;
      st.encounter = null; st.question = null; st.altar = null;          // nothing is left pending on a dead run
      st.party = st.party.map(p => ({ ...p, hp: 0 }));
      st.log = `> The week ended. The dark closed over KURA.`;
      return st;
    }
    st.log = `> KURA wakes on ${st.floor}.` + (st.campNote ? " " + st.campNote : "");
    delete st.campNote;
    st.extra = d && t === d.deadline ? "> The air grows heavy. The way down closes tonight."
      : earned ? "> The cell kept its charge while KURA was away. A spare is stored."
      : held ? (st.restedDay = t, `> In the dark, a voice: "${omen(t + 1 + (st.omenSalt || 0)).text.replace(/^> "|"$/g, "")}"`) : settled ? "> The room settles." : atmosphere(st);
    return st;
  }

  // PROGRAM JOBS at camp: COMPILER merges two COMMON items into an UNCOMMON one; CACHE keeps a copy of one COMMON.
  function campJobs(st) {
    const commons = () => (st.items || []).filter(n => TIER[n] === "COMMON");
    if (has(st, "COMPILER") && commons().length >= 2) {
      const a = commons()[0]; st.items.splice(st.items.indexOf(a), 1);
      const b = commons()[0]; st.items.splice(st.items.indexOf(b), 1);
      const it = pick(names("UNCOMMON")); gain(st, it); st.campNote = `COMPILER makes ${it}.`;
    } else if (has(st, "CACHE") && commons().length) {
      const it = pick(commons()); gain(st, it); st.campNote = `CACHE keeps a copy of ${it}.`;
    }
  }
  const inArchive = st => { const d = st.dungeon; return !!(d && d.floor.rooms[d.at] && d.floor.rooms[d.at].kind === "archive"); };
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
      case "clue": {                          // a dead end's scrap: what one of the wing's two doors is
        const rm = st.dungeon.floor.rooms[st.dungeon.at], w = st.dungeon.floor.wings[rm.wing];
        if (w && w.clueKind) st.clue = pick(KIND_CLUE[w.clueKind]);
        return "A scrap of writing, pinned to the wall.";
      }
      case "silver": { const n = R(20, 150) * (inArchive(st) ? 2 : 1); st.silver = silver + n; tally(st, "silverFound", n); return `Coins in the rubble. ${n} SILVER.`; }
      case "item": { const it = inArchive(st) ? pick(names(Math.random() < 0.35 ? "RARE" : "UNCOMMON")) : rollItem(st); gain(st, it); return `KURA finds ${it}.`; }
      case "demon": {
        // A demon appears and stays until it's fought, talked down, or escaped (see the ENCOUNTER section).
        const base = pickDemon(st);
        const corrupt = !isProgram(base) && !UNIQUE[base] && Math.random() < corruptOdds(st, familyOf(base));
        const name = corrupt ? glitch(base) : base;
        const hpmax = Math.round((16 + 9 * floorNum(st) + R(0, 8)) * (UNIQUE[base] ? UNIQUE[base].hp : 1) * (corrupt ? 1.15 : 1));
        st.encounter = { name, base, corrupt, family: familyOf(base), align: corrupt ? "CHAOS" : alignOf(base), hp: hpmax, hpmax, round: 0, angered: false, stage: null };
        st.question = null;                             // a waiting question lapses when a demon steps in
        st.round = corrupt ? [`${A(name)} blocks the way.`, "Its edges flicker. The data is damaged."]
          : isProgram(base) ? [`${A(name)} is running here.`, "It does not seem to mind KURA."]
          : [`${A(name)} blocks the way.`, STANCE_LINE[stance(st, st.encounter)](name)];
        note(st, "demons", base, "met"); tally(st, "met");
        return `${A(name)} appears!`;
      }
    }
    return "Dust. Nothing more here.";
  }

  // Each day KURA gets ONE step (through a door, or down found stairs).
  // Searching, turning and the free actions are unlimited. Days follow the real calendar.
  const OVER = "> GAME OVER. Press [R]ESET to begin a new run.";
  const today = st => (st.today = st.today || { stepped: false });
  function bump(st, key) { st.loop = st.loop && st.loop.key === key ? { key, n: st.loop.n + 1 } : { key, n: 1 }; }
  function act(st, key) {                  // every action counts a STEP and marks the game unsaved
    st.steps = (st.steps || 0) + 1;
    st.unsaved = true;
    if (st.talkLine) { if (st.extra === st.talkLine) st.extra = ""; delete st.talkLine; }   // a party member's reply doesn't outstay the next action
    if (st.altar) st.altar = null;           // walking off closes the terminal
    bump(st, key || "act");                // the same thing again and again (see LOOP at the top)
    if (st.dungeon) RS(st.dungeon).linger++;
    st.dreadCheck = true;                  // show() looks at the loop once the action has finished
    st.statusIn = (st.statusIn ?? 0) - 1;  // line 1 (the status report) changes every 5-10 actions
    if (st.question) { st.question = null; }  // a question KURA walks away from just lapses
    if (tripping(st)) {
      // The TURN counter goes strange: usually up, sometimes back.
      st.turnShown = (st.turnShown ?? st.steps) + (Math.random() < 0.25 ? -1 : 1);
      if (--st.tripLeft <= 0) comeDown(st);
    }
  }

  // LINE 1: THE STATUS REPORT. Mostly news (about 7 in 10): the floor, the days left, rooms surveyed,
  // the party's state, today's step. Otherwise a detached conditions readout: the air (this is the
  // room's heat, as temperature), a smell, a sound or the light. It changes every 5-10 actions, and
  // right away when the heat changes, on a new day, on a new floor, and on the last day.
  const FLOOR_NAME = ["", "First floor", "Second floor", "Third floor", "Fourth floor"];
  const AIR = [["cool, still", "chilly", "cold, still"], ["mild", "mild, stirring"], ["humid", "warm, close"],
    ["hot, stifling", "hot, thick"]];
  const SMELL = ["Odor of wet stone", "Odor of mold", "Old pipes", "Rust", "Cheap incense", "Damp paper",
    "Cold ash", "Ozone, faintly", "Salt and earth"];
  const DETAIL = ["Dripping, distant", "Low hum", "No sound", "Light unsteady", "Light steady", "Wind, somewhere",
    "Pipes ticking", "Footsteps? None"];
  function report(st, kind) {
    const d = st.dungeon, t = clock(st), n = floorNum(st);
    const name = FLOOR_NAME[n] || st.floor, left = d.deadline - t, onFloor = Math.max(1, t - (d.arrived ?? t) + 1);
    const closes = left <= 0 ? "The way down closes tonight" : left === 1 ? "The way down closes tomorrow"
      : pick([`${left} days until the way down closes`, `The way down closes ${fmt(d.deadline)}`]);
    if (kind === "air" || (kind !== "news" && Math.random() < 0.3)) {
      const tier = heatTier(RS(d).heat);
      // A fight or a break leaves a smell in the room for a while; otherwise each room has its own.
      const smell = d.scent && d.scent.room === d.at && Math.random() < 0.5 ? d.scent.text : SMELL[(d.seed + d.at * 7) % SMELL.length];
      return `> Conditions: ${pick(AIR[tier])}. ${smell}.` + (Math.random() < 0.6 ? ` ${pick(DETAIL)}.` : "");
    }
    const seen = allRooms(d).filter(s => s.visited).length, stairs = allRooms(d).some(s => s.found.includes("stairs"));
    const hurt = st.party.filter(p => p.hp > 0 && p.hp < p.hpmax / 2).length, down = st.party.filter(p => p.hp <= 0).length;
    const party = down ? `${down} down` : hurt ? "Party wounded" : "Conditions holding";
    const news = [
      `${name}. ${closes}.`,
      `Day ${onFloor} on this floor. ${closes}.`,
      `${name}. ${seen} room${seen === 1 ? "" : "s"} surveyed. Stairs ${stairs ? "confirmed" : "unconfirmed"}.`,
      `Day ${onFloor}. ${party}.`,
      `${name}. ${party}. Today's charge ${(st.today || {}).stepped ? "spent" : "full"}.${st.spare ? " A spare cell is stored." : ""}`,
      TIME.moonNote(TIME.now()).replace(/\.$/, "") + ".",          // "The moon is day 26, waning crescent."
    ];
    return "> " + (left <= 1 ? news[pick([0, 1])] : pick(news));
  }
  function status(st) {
    if (!st.dungeon || st.dead) return;
    if (tripping(st) && (st.statusIn ?? 0) <= 0) { st.status = "> " + pick(["KURA is not herself.", "KURA is TRIPPING.",
      "Conditions: unclear. KURA is seeing things."]); st.statusIn = R(5, 10); return; }
    const last = st.dungeon.deadline - clock(st) <= 0;
    if ((st.statusIn ?? 0) > 0 && !(last && !/tonight/.test(st.status || ""))) return;
    let line, tries = 0;
    do line = report(st, last ? "news" : st.statusKind); while (line === st.status && tries++ < 5);
    st.status = line.slice(0, 77);
    st.statusIn = R(5, 10);
    delete st.statusKind;
  }
  // Every action starts by catching up with the real date. An old save with no floor starts one.
  function ensureFloor(st) {
    sync(st);
    if (st.dungeon) return true;
    arrive(st, floorNum(st), firstDeadline(clock(st)));
    st.log = `> KURA enters ${st.floor}.`;
    st.unsaved = true;
    return false;
  }

  // SEARCH, NetHack style: unlimited. Each hidden thing needs 2 to 5 points of searching on its wall (never found on
  // a first look); a search is worth about one point, more on an easy day, in a calm room or after a STANDBY day,
  // less on a hard day or in a hot room, and a fuller moon adds a little. An empty wall never answers, and the player can't tell it apart
  // from one that needs more searches. Every search passes a little time, and a demon may wander in;
  // that happens more under a bright moon.
  const NOISES = ["KURA hears something. Then nothing.", "A faint scrape, and then quiet.", "Something ticks, very softly.",
    "A low sound. KURA holds her breath.", "A small sound, there and gone.", "KURA hears a soft knock. Or her own pulse."];
  const MISSES = ["Nothing.", "Nothing yet.", "Only stone.", "Nothing but dust.", "The wall gives nothing away.",
    "Cold stone, cold hands.", "Mortar, mostly. Some is older.", "Fingers come away gray.", "A crack. It goes nowhere.",
    "Damp. The smell of old pipes.", "Someone has looked here before.", "A dead cable runs in and stops.",
    "Faded paint. A number, or a sigil.", "Old tally marks, in groups of five.", "Salt along the base, in a line."];
  const moon = () => (root.SMT || require("./screen.js")).moonIndex((root.SMT || require("./screen.js")).now());
  // Each room hides its things behind its walls (never behind a door). The stairs are always behind
  // the wall they will open in; everything else is spread over the other walls, fixed by the floor's seed.
  function walls(d, i) {
    const rs = RS(d, i);
    if (rs.walls) return rs.walls;
    const room = d.floor.rooms[i];
    // The terminal's wall can't be searched for hidden things (it wakes the terminal instead), so nothing hides there.
    const altar = room.kind === "altar" ? altarDir(d.floor, i) : null;
    const free = CW.filter(x => !doorWall(room, x) && x !== altar);
    const w = { taken: {} };
    free.forEach(x => { w[x] = []; w.taken[x] = 0; });
    const sd = stairsDir(d.floor, i);
    // A small LCG kept inside 32 bits (Math.imul), reading its high bits: the low bits of an LCG are not random.
    let k = (d.floor.seed + i * 31) >>> 0;
    const next = () => { k = (Math.imul(k, 1103515245) + 12345) >>> 0; return k >>> 8; };
    for (const thing of room.hidden) {
      if (thing === "stairs") w[sd].push(thing);
      else if (free.length) w[free[next() % free.length]].push(thing);
    }
    // Nothing turns up on a first look. Each thing needs 2 to 5 points of searching (rolled now, hidden from the
    // player); every search of its wall adds a point or so (see SEARCH). prog is what each wall has had so far.
    w.need = {}; w.prog = {};
    for (const x of free) { w.need[x] = w[x].map(() => 2 + next() % 4); w.prog[x] = 0; }
    // About one room in three hides something deep in one wall: findable, but only 1 in 35 per search,
    // and that wall may look empty for a very long time.
    if (free.length && next() % 3 === 0) w.deep = { dir: free[next() % free.length], item: names("MYTHIC")[next() % CATALOG.MYTHIC.length], found: false, need: 20 + next() % 31, prog: 0 };
    return (rs.walls = w);
  }

  // SEARCH the wall KURA faces, NetHack style: unlimited, but each search has only a small chance
  // to turn up that wall's next hidden thing. A bare wall never answers. Doors can't be searched.
  function search(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (st.encounter) { st.log = `> The ${st.encounter.name} is still here. FIGHT, TALK, or run through a door.`; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const d = st.dungeon, room = d.floor.rooms[d.at], found = RS(d).found, dir = st.facing;
    // A door can't be searched, but a locked one can be listened at (see KIND_HINT); a false one gives itself away.
    // Costs nothing, and never says the same thing twice in a row.
    if (doorWall(room, dir)) {
      const DOOR = ["Only a door here. Nothing to search.", "KURA runs a hand along the door frame. Just a door.",
        "A door. Whatever's hidden, it isn't here.", "The door gives nothing away. It only opens.",
        "KURA checks the hinges. Old, but only hinges.", "Nothing behind the door but the way on."];
      let pool = DOOR;
      if (isFalse(d, dir)) pool = FALSE_SEARCH;
      else if (isSealed(d, dir)) pool = SEALED;
      else if (isLocked(d, dir)) {                          // a locked door says so, and sometimes lets a hint slip
        const hint = Math.random() < 0.55 ? KIND_HINT[FLOOR.kindBehind(d.floor, d.at, dir)] : null;
        pool = hint ? hint.map(h => "A locked door. " + h) : ["A locked door. Nothing to search here.", "A locked door. KURA runs a hand along the frame.", "A locked door. It gives nothing away."];
      } else {                                              // an open arch: what the room beyond is like
        const to = d.floor.rooms[room.doors[dir]], k = (to && to.kind) || FLOOR.kindBehind(d.floor, d.at, dir);
        const desc = pick(ARCH_DESC[k] || (to && to.hall ? ARCH_DESC.hall : to && to.dead ? ARCH_DESC.dead : ARCH_DESC.plain));
        pool = [`An arch to another room. It ${desc}.`];
      }
      st.log = "> " + pick(pool.filter(l => "> " + l !== st.log));
      act(st, "door"); nag(st);
      return show(st);
    }
    if (facingAltar(st)) {
      act(st, "altar:open");
      st.log = "> KURA touches the terminal. The screen wakes.";
      st.altar = { open: true, used: altarUsed(st), greet: pick(["> INPUT?", "> ...?", "> Hello."]) };
      return show(st);
    }
    if (found.includes("stairs") && dir === stairsDir(d.floor, d.at)) { act(st, "stairs"); st.log = "> The stairs wait. Nothing more here."; return show(st); }
    act(st, `search:${d.at}:${dir}`);
    // Heat: the loop and linger counts (see act) decide what kind of noise KURA is making.
    const chance = encounterChance(st);
    tally(st, "searches");
    const tier = heatTier(RS(d).heat);                  // the room's noise as KURA starts this search
    lean(st, tier >= 2 ? "hot" : "search");
    heatUp(st, 1);
    const fx = omen(clock(st) + (st.omenSalt || 0)).fx;
    // How much a search is worth. The day's omen sets the luck of the day (hard 0.5, easy 1.6). A calm room means
    // steady hands (x1.25) and a hot one hurried ones (x0.75). After a STANDBY day KURA is rested (x1.25).
    // The moon's fullness helps too: up to x1.35 at the full moon, nothing at the new moon. Capped under 2 points, so a
    // thing that needs 2 can never turn up on a first look.
    const fullness = (1 - Math.cos(moon() / 8 * 2 * Math.PI)) / 2;
    const worth = Math.min(1.9, fx.find * (tier === 0 ? 1.25 : tier >= 2 ? 0.75 : 1) * (st.restedDay === clock(st) ? 1.25 : 1) * (1 + 0.35 * fullness));
    const where = `KURA searches the ${NAME[dir]} wall.`;
    const say = text => {
      const long = `> ${where} ${text}`;
      if (long.length <= 77) return long;
      const short = `> KURA searches ${NAME[dir]}. ${text}`;
      return short.length <= 77 ? short : `> ${text.replace(/^KURA finds /, "Found ")}`.slice(0, 77);
    };
    if (Math.random() < chance) {
      st.log = say(reveal(st, "demon").replace(" appears!", " wanders in!"));
      drift(st);
      return show(st);
    }
    const w = walls(d, d.at), pile = w[dir] || [];
    if (w.taken[dir] < pile.length) {
      // Searching wears the wall down: points add up until this thing's number is reached (it never shows on a first look).
      w.prog = w.prog || {}; w.need = w.need || {};
      w.prog[dir] = (w.prog[dir] || 0) + worth;
      const need = (w.need[dir] && w.need[dir][w.taken[dir]]) || 3;
      if (w.prog[dir] >= need) {
        w.prog[dir] = 0;
        const thing = pile[w.taken[dir]++];
        found.push(thing);
        st.log = say(reveal(st, thing));
        // The first find in a room also takes stock of its doors.
        if (found.length === 1 && st.log.length + doorList(room).length < 77) st.log += " " + doorList(room);
        drift(st);
        if (has(st, "SCAN") && !st.clue && Math.random() < 0.3) {          // SCAN reads what is behind a door
          const wing = st.dungeon.floor.wings[room.wing];
          if (wing && wing.clueKind) st.clue = pick(KIND_CLUE[wing.clueKind]);
        }
        if (st.clue) { st.extra = st.clue; delete st.clue; delete st.tell; }   // the scrap's words take line 3 (over a heat tell)
        return show(st);
      }
    }
    if (w.deep && w.deep.dir === dir && !w.deep.found) {
      // Something deep in the stone: a much longer slog (about 35 searches), three times faster while tripping.
      w.deep.prog = (w.deep.prog || 0) + worth * (tripping(st) ? 3 : 1);
      if (w.deep.prog >= (w.deep.need || 35)) {
        w.deep.found = true;
        gain(st, w.deep.item);
        st.log = say("Deep in the stone, something gives.");
        st.extra = `> KURA pulls out ${w.deep.item}.`;
        return show(st);
      }
    }
    // A near-miss line only when it's true: this wall still hides something.
    // (it starts after a couple of searches: a hint to keep going; it never says where the sound comes from)
    const noise = w.taken[dir] < pile.length && (w.prog[dir] || 0) >= 2 && Math.random() < 0.25;
    st.log = say(noise ? pick(NOISES) : pick(MISSES));
    if (!nag(st)) drift(st);
    return show(st);
  }

  // GO: through the door toward dir (N/E/S/W; default: the way she faces). Doors that are already open are free.
  // A LOCKED door (its room not built yet) takes the day's one charge; with it spent (and no spare cell) she can't open another.
  // A wall stops her with a message and costs nothing.
  function go(st, dir) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const d = st.dungeon;
    dir = dir || st.facing;
    const fals = isFalse(d, dir);
    if (!fals && !exits(d).includes(dir)) {
      st.facing = dir;
      st.log = pick([`> A wall to the ${NAME[dir]}. KURA can't go that way.`, `> KURA walks ${NAME[dir]} into solid stone.`,
        `> Only cold wall to the ${NAME[dir]}.`]);
      if (st.encounter) st.round = [`A wall to the ${NAME[dir]}. No way out there.`];
      return show(st);
    }
    const toStairs = !fals && RS(d).found.includes("stairs") && dir === stairsDir(d.floor, d.at);
    const locked = !toStairs && !fals && isLocked(d, dir);
    // With today's charge gone, a banked spare cell can open one more door (a painted one never takes it).
    const spareUse = locked && !!today(st).stepped && !st.freeSteps && (st.spare || 0) > 0;
    if ((locked || fals) && today(st).stepped && !st.freeSteps && !spareUse) {
      st.facing = dir; st.log = "> The door won't cycle. The cell is empty until dawn.";
      if (st.encounter) st.round = ["The cell is empty. No running through a sealed door."];
      return show(st);
    }
    if (!toStairs && !fals && isSealed(d, dir)) {            // settled the other way: it never opens now
      st.facing = dir; st.log = "> " + pick(SEALED);
      if (st.encounter) st.round = ["That door is sealed. No way out there."];
      return show(st);
    }
    if (fals) {                                              // only paint: nothing happens and the key is kept
      st.facing = dir; st.log = "> " + pick(FALSE_GO.filter(l => "> " + l !== st.log));
      if (st.encounter) st.round = ["Paint over stone. No way out there."];
      return show(st);
    }
    // With a demon in the way, stepping through a door is running: a locked door still takes the key either way,
    // and half the time the demon blocks it and strikes.
    if (st.encounter) {
      const e = st.encounter, lines = [];
      if (e.ranTried) { st.facing = dir; st.round = ["KURA already tried to run. There is no running now."]; return show(st); }
      act(st, "run");
      if (locked) { if (spareUse) st.spare--; else today(st).stepped = true; }
      lean(st, "run", lines);
      st.facing = dir;
      st.roundOver = false;
      if (Math.random() < 0.5) {
        e.ranTried = true;
        lines.push(`KURA runs ${NAME[dir]}. ${THE(e.name)} blocks the door.`);
        st.log = `> KURA tries to run ${NAME[dir]}. ${THE(e.name)} blocks it.`;
        demonTurn(st, lines);
        st.round = lines;
        if (st.dead) st.roundOver = true;
        return show(st);
      }
      st.encounter = null;
      st.roundOver = true;
      st.round = [`KURA runs ${NAME[dir]} and leaves ${the(e.name)} behind.`, ...lines];
      tally(st, "fled");
    } else act(st, "go");
    // Taking the stairs down is free, like any open door; only a locked door uses the key.
    if (locked) { if (spareUse) st.spare--; else st.today.stepped = true; }
    if (toStairs) tally(st, "floors"); else tally(st, "steps");
    st.facing = dir;
    if (toStairs) {
      // Bonus days: the next floor belongs to next week, so going down early banks the rest of this one.
      const deadline = sundayOf(clock(st)) + 7;
      arrive(st, floorNum(st) + 1, deadline);
      st.log = `> KURA goes ${NAME[dir]} and descends to ${st.floor}.`;
      st.extra = `> The way down from here closes ${fmt(deadline)}.`;
      return show(st);
    }
    const i = FLOOR.grow(d.floor, d.at, dir);               // builds the room behind a locked door the first time
    const isNew = !RS(d, i).visited;
    d.at = i; RS(d, i).visited = true;
    st.log = locked ? `> The ${NAME[dir]} door cycles open. KURA steps into a new room.`
      : `> KURA goes ${NAME[dir]} into ${isNew ? "a new room" : "a cleared room"}.`;
    enterKind(st, i, locked || isNew);
    st.extra = atmosphere(st);
    return show(st);
  }


  // ROOM KINDS. Most rooms have one (see floor.js). The first time KURA enters, the room does its one thing (line 3).
  // The Den, Bay, Forge and Altar keep working: going back does it again at HALF strength, once a day per room.
  // The rest are one-time finds. No kind is better than another: they answer different needs.
  // Placeholders (nothing to act on yet): DEN gear, BAY shield, VAULT keys, FORGE repairs.
  const ROOM = { den: "CYBER-DEN", bay: "RECHARGE BAY", relay: "SIGNAL RELAY", vault: "DATA VAULT", forge: "FORGE-NODE", altar: "MATRIX ALTAR", archive: "THE ARCHIVE" };
  function enterKind(st, i, isNew) {
    const d = st.dungeon, rm = d.floor.rooms[i], k = rm.kind;
    if (!k) return;
    if (!isNew && !["den", "bay", "forge", "altar"].includes(k)) return;
    if (RS(d, i).kindDay === st.day) return;
    RS(d, i).kindDay = st.day;
    const f = isNew ? 1 : 0.5;               // a return visit does half as much
    if (k === "den") {                       // hot from the start: demons come easily, and so does the rest
      RS(d, i).heat = Math.max(RS(d, i).heat, Math.round(HEAT_MAX * 0.6 * f));
      st.tell = "> Warm, close air. Loose parts and old gear lie scattered in the dark.";
    } else if (k === "bay") {                // safe (no demons hide here): the party mends a little
      const hurt = st.party.some(p => p.hp < p.hpmax);
      if (hurt) heal(st, 1 / 3 * f, false);
      st.tell = "> A soft hum, and clean, still air. Nothing here wants anything of KURA.";
    } else if (k === "relay") {              // a dish turns to the wing's door the dead end's scrap doesn't cover
      const fl = d.floor, w = fl.wings[rm.wing], other = w && w.exits.map(j => fl.kinds[j]).find(x => x !== w.clueKind);
      st.tell = other ? pick(KIND_CLUE[other]) : "> A dish turns, then holds still. Something carries in here.";
    } else if (k === "vault") {              // coin (no keys or checks yet)
      const n = R(40, 110) * floorNum(st);
      st.silver = (st.silver ?? 0) + n; tally(st, "silverFound", n);
      st.tell = "> Cold racks line the walls, heavy with small, hard things.";
    } else if (k === "forge") {              // purify: clears the ichor taint (no repairs yet). A return visit only halves it.
      if ((st.taint || 0) > 0 || tripping(st)) {
        if (isNew) { st.taint = 0; const kura = st.party[0]; delete kura.status; st.tripLeft = 0; delete st.turnShown; }
        else st.taint = Math.floor((st.taint || 0) / 2);
        st.tell = "> A bench, cold tools, a smell of solder. The air hums, warm.";
      } else st.tell = "> A bench, cold tools, a smell of solder. The air hums, warm.";
    } else if (k === "archive") {            // the bonus room: one rare thing, still spinning
      st.tell = "> Racks of old drives, most of them still warm.";
      // A program is always waiting among the racks (one KURA doesn't already have), ready to talk.
      const free = PROGRAMS.filter(n => !st.party.some(p => p.name === n));
      if (free.length && !st.encounter) {
        const name = pick(free), hpmax = Math.round(16 + 9 * floorNum(st) + R(0, 8));
        st.encounter = { name, base: name, corrupt: false, family: "data", align: "LAW", hp: hpmax, hpmax, round: 0, angered: false, stage: null };
        st.question = null;
        st.round = [`${A(name)} is running here.`, "It does not seem to mind KURA."];
        note(st, "demons", name, "met"); tally(st, "met");
      }
    } else if (k === "altar") {              // a terminal in the wall: face it and SEARCH
      st.tell = "> Something in the wall glows, very faintly.";
    }
  }

  // THE ALTAR (the Matrix Altar room): a terminal that takes one offering a day and shifts KURA's lean.
  // The offering's own alignment sets the way (LAW item toward LAW, CHAOS item toward CHAOS, a neutral one
  // or SILVER back toward the middle) and its tier the size. The terminal is a data thing, so it likes
  // tech and dislikes spirit things; its mood (:) :| :() only changes how much the shift takes. The
  // offering is always lost. Nothing on screen says which way it went.
  const TERMINAL = { family: "data", align: "NEUTRAL", want: 3 };
  const ALTAR_SIZE = { COMMON: 0.5, UNCOMMON: 0.8, RARE: 1.2, MYTHIC: 2, MOON: 2 };
  const ALTAR_SAYS = {
    good: ["> THANK YOU.", "> ACCEPTED.", "> YES. MORE LIGHT.", "> THIS ONE IS WARM."],
    ok: ["> NOTED.", "> LOGGED.", "> ACCEPTABLE.", "> I WILL KEEP IT."],
    bad: ["> UNSUITABLE.", "> I DON'T WANT THIS.", "> ...WHY?", "> NOT FOOD."],
  };
  const ALTAR_FACE = { good: ":)", ok: ":|", bad: ":(" };
  const ALTAR_FLAVOR = { good: ["The terminal drinks it.", "The three symbols shift."], ok: ["The terminal takes it.", "The three symbols stir."],
    bad: ["The terminal swallows it and doesn't like it.", "The three symbols barely move."] };
  // The terminal is set into one of the room's walls (never a door wall, and not the stairs wall).
  // Face it and SEARCH (or [G]IVE) to wake it.
  function altarDir(fl, i) {
    const room = fl.rooms[i];
    if (room.kind !== "altar") return null;
    const free = CW.filter(x => !doorWall(room, x) && !(fl.stairs === i && x === stairsDir(fl, i)));
    return free.length ? free[(fl.seed + i * 17) % free.length] : null;
  }
  const facingAltar = st => !!(st.dungeon && altarDir(st.dungeon.floor, st.dungeon.at) === st.facing);
  function altarUsed(st) { const d = st.dungeon; return !!(d && RS(d).altarDay === st.day); }
  function altarGifts(st) {
    const n = 20 * floorNum(st), out = [{ silver: n, ok: (st.silver ?? 0) >= n, label: `${n} SILVER` }];
    for (const it of inventory(st).slice(0, 5)) out.push({ item: it.name, ok: true, label: it.name });
    return out;
  }
  function altarOpen(st) {                               // [G]IVE in an Altar room
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    const d = st.dungeon;
    if (st.encounter || !d || !facingAltar(st)) { st.log = "> Nothing here to give to."; return show(st); }
    st.altar = { open: true, used: altarUsed(st), greet: pick(["> INPUT?", "> ...?", "> Hello."]) };
    return show(st);
  }
  function altarGive(st, i) {                            // i = an index of altarGifts(), or null to close
    st = copy(st);
    if (!st.altar) return show(st);
    if (i === null || st.altar.used || st.altar.result) { st.altar = null; return show(st); }
    const g = altarGifts(st)[i];
    if (!g) return show(st);
    if (!g.ok) return show(st);
    act(st, "altar");
    const d = st.dungeon, v = worth(TERMINAL, g), mood = v < 0 ? "bad" : v < 2.5 ? "ok" : "good";
    let amt;
    if (g.silver) { st.silver -= g.silver; amt = 0; } else { st.items.splice(st.items.indexOf(g.item), 1); amt = 0; }
    const a = (g.item && itemAlign(g.item)) || "NEUTRAL";
    const size = g.item ? ALTAR_SIZE[TIER[g.item] || "COMMON"] : 0.5;
    amt = a === "LAW" ? -size : a === "CHAOS" ? size : -Math.sign(st.alignScore || 0) * 0.5;
    amt *= { bad: 0.5, ok: 1, good: 1.25 }[mood];
    if (RS(d).altarUses) amt *= 0.5;            // a terminal already fed in this room shifts KURA half as much
    RS(d).altarUses = (RS(d).altarUses || 0) + 1;
    LEAN.altarTmp = amt; lean(st, "altarTmp");
    RS(d).altarDay = st.day;
    tally(st, "offerings");
    st.log = `> KURA makes an offering.`;
    st.altar = { open: true, used: true, result: { mood, face: ALTAR_FACE[mood], say: pick(ALTAR_SAYS[mood]), lines: ALTAR_FLAVOR[mood] } };
    return show(st);
  }

  // Turning is free: "L" and "R" turn 90 degrees.
  function turn(st, how) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!st.dungeon) return st;
    st.facing = how === "L" ? LEFT[st.facing] : RIGHT[st.facing];
    act(st, "turn");
    st.log = `> KURA turns to face ${NAME[st.facing]}. ${sight(st)}`;
    if (!nag(st)) drift(st);
    return show(st);
  }


  // HOLD (STANDBY): KURA lays the day's key down instead of opening a door. It spends the key, and tonight's rest
  // is deeper (see sync). Doors that are already open stay free to walk through.
  function hold(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (st.encounter) { st.log = `> The ${st.encounter.name} is still here. FIGHT, TALK, or run through a door.`; return show(st); }
    if (!ensureFloor(st)) return show(st);
    if (today(st).stepped && !st.freeSteps) { st.log = "> The cell is already spent today."; return show(st); }
    act(st, "hold");
    today(st).stepped = true; today(st).held = true;
    tally(st, "holds");
    st.log = `> ` + pick(["KURA settles in for the day.", "KURA stays where she is. The room goes quiet.", "KURA holds here. Let the dark pass over."]);
    return show(st);
  }

  // FREESTEPS (hidden, key X): a testing cheat. Toggles infinite steps: the day's step is never spent.
  function freesteps(st) {
    st = copy(st);
    st.freeSteps = !st.freeSteps;
    st.log = st.freeSteps ? "> (cheat) Infinite steps ON. The day's step is never spent." : "> (cheat) Infinite steps OFF.";
    return show(st);
  }

  // CHEAT INFO (shown under the screen while infinite steps is on): what the room is and what the counters say.
  function debugInfo(st) {
    const d = st.dungeon;
    if (!d) return "";
    const fl = d.floor, rm = fl.rooms[d.at], w = fl.wings[rm.wing];
    const kind = rm.kind ? ROOM[rm.kind] : rm.hall ? "PASSAGE" : rm.dead ? "DEAD END" : d.at === 0 ? "START" : "ROOM";
    const left = Math.max(0, rm.hidden.length - RS(d).found.length);
    const wall = altarDir(fl, d.at);
    const enc = Math.round(encounterChance(st) * 100);
    const stairs = fl.stairs < 0 ? "STAIRS unplaced" : `STAIRS R${fl.stairs + 1}${RS(d, fl.stairs).found.includes("stairs") ? " (found)" : ""}`;
    const exs = w && w.exits.length ? "EXITS " + w.exits.map(j => fl.kinds[j] + (fl.rooms[j] ? "*" : fl.sealed && fl.sealed[j] ? "x" : "")).join("/") + " CLUE " + w.clueKind : null;
    const row1 = [`ROOM ${d.at + 1}/${fl.count} ${kind} WING ${rm.wing + 1}/${fl.pairs + 2}`, stairs, exs, `CELL ${(st.today || {}).stepped ? "spent" : "ready"}${st.spare ? " +SPARE" : ""}`,
      `HIDDEN ${left}`, wall ? `TERMINAL ${NAME[wall]}` : null];
    const row2 = [`HEAT ${RS(d).heat}/${HEAT_MAX}`, `ENC ${enc}%`, `LOOP ${(st.loop && st.loop.n) || 0}`, `LINGER ${RS(d).linger}/${LINGER_AT}`,
      `LEAN ${(st.alignScore || 0).toFixed(1)}`, `TAINT ${st.taint || 0}`, `DAY ${st.day}`];
    return [row1, row2].map(r => r.filter(Boolean).join("  ")).join("\n");   // two lines under the screen
  }

  // NEXT (hidden, Shift+X): a testing cheat that jumps this game one day ahead of the real date.
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
    const out = d && !st.dead ? exits(d).concat(d.floor.rooms[d.at].falseDoors || []) : [];
    // SEARCH works on the wall KURA faces; a door (or found stairs) can't be searched.
    const res = { search: !!d && !st.dead, hold: !!d && !st.dead && !st.encounter && (!t.stepped || !!st.freeSteps) };   // a door can be searched too (it just says so)
    const spent = !!t.stepped && !st.freeSteps && !(st.spare > 0);           // a locked door needs the day's key; open doors are always free
    res.locked = {}; res.door = {};
    for (const x of CW) {
      const shut = !!d && out.includes(x) && looksLocked(d, x);
      res.locked[x] = shut; res.door[x] = out.includes(x);
      res[x] = !st.dead && out.includes(x) && !(shut && spent) && !(d && isSealed(d, x));   // a sealed door is dim for good
    }
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
    // Nothing from the last run carries over except the codex, the timezone and the cheats.
    for (const k of ["taint", "wear", "snatched", "question", "altar", "loop", "round", "roundOver", "tell", "tripLeft", "turnShown",
      "fidgetLine", "spare", "restedDay", "extraUrgent", "dreadCheck", "clue", "pull", "logged", "status", "statusIn", "statusKind", "omenText"]) delete st[k];
    st.timeFixed = true;
    st.tz = tz;
    st.omenSalt = 1 + Math.floor(Math.random() * 100000);   // a new run rerolls the omens
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
    st.log = `> KURA descends into B1F.${lucky ? " Her bag feels heavier than it should." : ""}`;
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
  // Lines must fit the 77 columns of a log line: with a long item name, say "it" instead.
  const fitIt = (line, the) => line.length <= 77 ? line
    : line.replace("> " + the.replace(/^t/, "T"), "> It").replace(the, "it").slice(0, 77);
  // Per try. Things are hard to break by hand: about 12 tries on average for COMMON, 17 UNCOMMON, 33 RARE, 100 MYTHIC.
  const BREAK = { COMMON: 0.08, UNCOMMON: 0.06, RARE: 0.03, MYTHIC: 0.01, MOON: 0 };
  // Nothing breaks early: no item can break before this many tries (then the per-try odds above apply).
  const BREAK_MIN = { COMMON: 10, UNCOMMON: 12, RARE: 20, MYTHIC: 40, MOON: Infinity };
  // When KURA breaks something a party member loves (folklore: old spirit things; data and
  // hardware: tech; hybrids: things that are both), they take it hard.
  const GRIEF = {
    ELF: ['ELF: "That was older than you."', "ELF looks at the pieces for a long moment."],
    PIXIE: ['PIXIE: "You BROKE it!"', "PIXIE gathers the pieces like they might mend."],
    "CU SITH": ["CU SITH whines at the pieces.", "CU SITH noses the pieces, then looks at KURA."],
    folklore: ['{n}: "Some things you do not break."', "{n} flinches as it breaks."],
    data: ['{n}: "ASSET DESTROYED."', '{n}: "LOGGED. DO NOT REPEAT."'],
    hardware: ['{n}: "...was that one of us?"', "{n} goes quiet for a long time."],
    hybrid: ['{n}: "Half of me felt that."', "{n} hisses as it breaks."],
  };
  const SNATCH = { PIXIE: 'PIXIE snatches {it} away. "No."', "CU SITH": "CU SITH takes {it} gently in its teeth and won't let go.",
    ELF: 'ELF catches KURA\'s wrist. "Not that one."' };
  function useItem(st, name) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    const i = (st.items || []).indexOf(name);
    if (i < 0) return show(st);
    const info = ITEM_INFO[name] || {};
    // Most things can't be used (yet). Trying anyway can break it: every try is a roll, so one battery
    // survives a dozen tries and the next snaps on the first. Rarer things are sturdier; MOON things never break.
    if (!info.use) {
      act(st, `use:${name}`);
      const the = name.replace(/^an? /, "the "), tier = TIER[name] || "COMMON", nat = natureOf(name), m = moon();
      // Spirit things are more fragile under a full moon and tougher at the new moon.
      const odds = BREAK[tier] * (nat === "spirit" ? (m === 4 ? 1.5 : m === 0 ? 0.5 : 1) : 1);
      st.wear = st.wear || {};
      const w = st.wear[name] = (st.wear[name] || 0) + 1;
      // Party members who love this kind of thing care what happens to it (see GRIEF).
      const fans = (st.party || []).slice(1).filter(p => p.hp > 0 && (TASTE[p.family || "folklore"] || {})[nat] >= 1.5);
      if (odds && w >= BREAK_MIN[tier] && Math.random() < odds) {
        // Once per kind of item, someone who loves it may grab it before it breaks.
        st.snatched = st.snatched || {};
        if (fans.length && !st.snatched[name] && Math.random() < 0.3) {
          const p = pick(fans);
          st.snatched[name] = true;
          st.log = `> KURA is about to break ${the}.`;
          st.extra = fitIt("> " + (SNATCH[p.name] || '{n} snatches {it} away. "No."').replace(/\{n\}/g, p.name).replace(/\{it\}/g, the), the);
          st.log = fitIt(st.log, the);
          st.fidgetLine = st.extra;            // so the next quiet try clears it
          return show(st);
        }
        st.items.splice(i, 1); delete st.wear[name];
        tally(st, "broken"); note(st, "items", name, "broken");
        st.log = `> ${the.replace(/^t/, "T")} comes apart in KURA's hands.`;
        // Breaking is loud: the room heats up, and something may come to see.
        heatUp(st, 2);
        st.dungeon.scent = { room: st.dungeon.at, text: "Smoke, faintly" };
        // Breaking things leans CHAOS; breaking a relic pulls harder: a LAW relic toward CHAOS,
        // a CHAOS relic toward LAW (KURA getting rid of something dangerous).
        const a = itemAlign(name);
        lean(st, a === "LAW" ? "breakLAW" : a === "CHAOS" ? "breakCHAOS" : "break");
        // Junk is hollow: once in a while something was inside (COMMON 1 in 10, UNCOMMON 1 in 12;
        // half again as often at the new moon, when the deep is quiet). What falls out: COMMON 60%, RARE 35%, MYTHIC 5%.
        const inside = ({ COMMON: 0.1, UNCOMMON: 1 / 12 }[tier] || 0) * (m === 0 ? 1.5 : 1);
        if (Math.random() < inside) {
          const r = Math.random(), got = pick(names(r < 0.05 ? "MYTHIC" : r < 0.4 ? "RARE" : "COMMON"));
          gain(st, got);
          tally(st, "insides");
          st.log += " Something was inside.";
        }
        st.log = fitIt(st.log, the);
        // The break itself wears on everyone: each member loses a point of patience (a CHAOS one
        // at zero may lash out). Someone who loved it takes it harder, with a line of grief.
        for (const q of st.party.slice(1)) if (q.hp > 0) q.patience = Math.max(0, (q.patience ?? PATIENCE) - 1);
        if (fans.length) {
          const p = pick(fans);
          p.patience = Math.max(0, p.patience - 1);
          st.extra = st.fidgetLine = "> " + pick(GRIEF[p.name] || GRIEF[p.family || "folklore"]).replace(/\{n\}/g, p.name);
        } else fidget(st, 20);
        if (Math.random() < encounterChance(st) && !st.encounter && !st.question) {
          st.extra = "> " + reveal(st, "demon").replace(" appears!", " comes to see what broke.");
        }
        return show(st);
      }
      st.log = "> " + (w === 1 ? `KURA turns ${the} over. Nothing happens.`
        : !odds ? `KURA tries ${the} again. It won't break. It's older than she is.`
        : pick([`KURA shakes ${the}. Something rattles.`, `KURA turns ${the} over again. Still nothing.`,
          `KURA bangs ${the} against the wall. It holds.`, `KURA twists ${the}. It creaks.`]));
      st.log = fitIt(st.log, the);
      heatUp(st, 0.5);                 // fiddling makes a little noise too
      fidget(st, w);
      return show(st);
    }
    st.items.splice(i, 1);
    act(st, `use:${name}`);
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
    const dmg = Math.min(target.hp, Math.max(1, Math.round(R(2, Math.ceil(target.hpmax / 3)) * RAGE[moon()] * (UNIQUE[e.name] ? UNIQUE[e.name].hit : 1) * (has(st, "WATCHDOG") ? 0.67 : 1))));
    st.party = st.party.map(p => p === target ? { ...p, hp: p.hp - dmg } : p);
    lines.push(`${THE(e.name)} strikes ${target.name}. -${dmg} HP` + (target.hp - dmg <= 0 ? ". FALLS" : ""));
    if (st.party[0].hp <= 0) {
      st.dead = true;
      st.party = st.party.map(p => ({ ...p, hp: 0 }));
      lines.push("KURA falls. The run is over.");
      st.log = `> ${THE(e.name)} strikes KURA down.`;
      st.encounter = null;
      st.round = lines;
      st.roundOver = true;
    }
  }
  function win(st, lines, burned) {
    const e = st.encounter;
    const n = R(5, 30) + 3 * floorNum(st);
    st.ichor = (st.ichor ?? st.mag ?? 0) + n;
    tally(st, "beaten"); tally(st, "ichorWon", n);
    lines.push(`${THE(e.name)} ${burned ? "burns out" : "falls"}.  +${n} ICHOR`);
    // What a fallen demon leaves: coin often, a thing now and then. One burned out by a discharge leaves more of both.
    if (Math.random() < (burned ? 0.9 : 0.5)) {
      const c = R(8, 40) * floorNum(st); st.silver = (st.silver ?? 0) + c; tally(st, "silverFound", c);
      lines.push(`It drops ${c} SILVER.`);
    }
    if (Math.random() < (burned ? 0.5 : 0.25)) {
      const it = rollItem(st);
      lines.push(`It leaves ${it}.`);
      gain(st, it, lines);
    }
    const dropOdds = [0, 0, 0, 0.1, 0.25, 0.1, 0, 0][moon()];
    if (Math.random() < dropOdds) {
      const it = pick(MOON_DROPS);
      lines.push(`It leaves ${it}.`);
      gain(st, it, lines);
    }
    if (has(st, "PATCH")) {                            // PATCH mends the party after a fight
      st.party = st.party.map(p => p.hp > 0 ? { ...p, hp: Math.min(p.hpmax, p.hp + Math.ceil(p.hpmax / 8)) } : p);
      lines.push("PATCH mends the party a little.");
    }
    st.log = `> ${THE(e.name)} falls. ${n} ICHOR.`;
    st.dungeon.scent = { room: st.dungeon.at, text: "Copper in the air" };
    st.encounter = null;
  }
  function round(st, fn, idle) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!st.encounter) { if (idle) st.log = idle; return show(st); }
    act(st, "fight");
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
      for (const p of st.party) if (p.hp > 0) {
        const hit = R(1, 4) + Math.floor((p.lv || 1) / 2);
        if (p === st.party[0] && tripping(st)) {
          // Tripping: twice as strong, but a third of her blows go wild and land on the party.
          const friends = st.party.slice(1).filter(q => q.hp > 1);
          if (friends.length && Math.random() < 1 / 3) {
            const q = pick(friends), dmg = Math.min(q.hp - 1, hit * 2);
            q.hp -= dmg; q.patience = Math.max(0, (q.patience ?? PATIENCE) - 2);
            lines.push(`KURA swings at ${the(e.name)}... and hits ${q.name}. -${dmg}`);
            lines.push(`${q.name}: "${pick(["OW?? KURA!!", "Watch it!", "Not me! THEM!", "What are you DOING?"])}"`);
            continue;
          }
          total += hit * 2; continue;
        }
        total += hit + (p === st.party[0] && st.taint ? 2 : 0);   // a buzz from the ichor: KURA hits a little harder
      }
      e.hp = Math.max(0, e.hp - total);
      lines.push(`The party strikes. -${total}`);
      st.log = `> KURA's party fights ${the(e.name)}.`;
      if (e.hp <= 0) { win(st, lines); lean(st, "kill", lines); } else lean(st, "fight", lines);
    }, "> Nothing here to fight.");
  }
  // DISCHARGE: spend the day's charge (or the banked spare) on one blow that ends most fights. It uses the cell that
  // would have opened a door, so it is never free: the button is dim once both are gone.
  function discharge(st) {
    const t = today(st), free = !t.stepped || !!st.freeSteps, spare = (st.spare || 0) > 0;
    if (st.dead || !st.encounter || (!free && !spare)) {
      st = copy(st);
      if (st.encounter && !st.dead) { st.log = "> The cell is empty. Nothing left to discharge."; st.round = ["The cell is empty. Nothing left to discharge."]; }
      return show(st);
    }
    return round(st, (st, lines) => {
      const e = st.encounter, tt = today(st);
      if (!tt.stepped || st.freeSteps) { if (!st.freeSteps) tt.stepped = true; } else st.spare--;
      tally(st, "discharges");
      e.stage = null;
      lines.push("The cell discharges. White light fills the room.");
      const dmg = UNIQUE[e.name] ? Math.ceil(e.hpmax * 0.75) : e.hp;       // a named horror shrugs most of it off
      e.hp = Math.max(0, e.hp - dmg);
      st.log = `> KURA discharges the cell at ${the(e.name)}.`;
      if (e.hp <= 0) { win(st, lines, true); lean(st, "kill", lines); } else { lines.push(`${THE(e.name)} reels. -${dmg}`); lean(st, "fight", lines); }
    }, "> Nothing here to discharge at.");
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
    if (isProgram(name)) return "LAW";
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
    pay: -0.4, task: -0.4, offer: 0.4, run: 0.15, findLAW: -0.3, findCHAOS: 0.3, offerLAW: -0.4, drink: 0.8,
    break: 0.15, breakLAW: 0.6, breakCHAOS: -0.4, talkLAW: -0.25, talkCHAOS: 0.25, restore: -0.5 };
  function lean(st, why, lines) {
    const base = LEAN[why] || 0;
    if (!base) return;
    if (Math.abs(base) >= 0.1) st.alignShifts = (st.alignShifts || 0) + 1;      // tiny nudges (patient searching) don't age the weighting
    const w = Math.max(0.4, 1 - 0.02 * Math.max(0, (st.alignShifts || 0) - 1));
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
    if (isProgram(name)) return "data";
    for (const f of Object.keys(FAMILY)) if (FAMILY[f].includes(name)) return f;
    return "folklore";
  }
  const VOICE = {
    // (Data demons sometimes slip into binary. It's real ASCII: 01001000 01001001 is "HI".)
    data: { open: ["PROCESS DETECTED", "SIGNAL FOUND", "AWAITING INPUT", "01001000 01001001", "01001000 01001001 00111111"], ask: "REQUEST: RESOURCES. INPUT ANY.",
      love: ["VALUE EXCEEDS EXPECTED.", "01011001 01000101 01010011"], like: ["ACCEPTABLE.", "01001111 01001011"],
      meh: "INSUFFICIENT. MORE.", hate: "INCOMPATIBLE FORMAT.",
      join: ["TASK RECEIVED. LINKED TO USER.", "01001100 01001001 01001110 01001011"],
      no: ["CONNECTION LOST", "01001110 01001111"], scorn: ["INPUT REJECTED", "0000000000000000"],
      leave: ["PROCESS ENDED", "01000010 01011001 01000101"],
      hold: ["PROCESSING...", "UNEXPECTED INPUT. PAUSING.", "01001000 01001111 01001100 01000100"],
      accept: ["INPUT VALID. HOSTILITIES SUSPENDED.", "ACCEPTED. STANDING DOWN.", "01000001 01000011 01001011"],
      ignore: ["INPUT LOGGED. THREAT UNCHANGED.", "NOTED. NO CHANGE.", "THANK YOU. CONTINUING."],
      insult: ["INVALID INPUT.", "01000010 01000001 01000100", "REJECTED."] },
    hardware: { open: ["ERROR 404: owner not found", "still here. still running", "are you my replacement?"],
      ask: "got anything? anything at all?",
      love: "oh. oh! it's perfect", like: "ok. that's ok", meh: "...is there more?", hate: "what is this. take it back", join: "NEW OWNER ACCEPTED. ok. I'll wait with you.",
      no: "...ok. I'll wait here then.", scorn: "ACCESS DENIED. go away", leave: "SHUTTING DOWN. bye",
      hold: ["...wait. what is that?", "oh. hold on. hold on.", "it's been so long since anyone gave me anything"],
      accept: ["ok. ok. I'm done fighting.", "you can stay. for a bit.", "thank you. I'll sit down now."],
      ignore: ["thanks. still gonna hit you.", "cute. one more round.", "it's not about that. sorry."],
      insult: ["no. no no no.", "don't give me THAT.", "why would you."] },
    hybrid: { open: ["ACCESS GRANTED, traveler.", "You smell of salt and static.", "What brings flesh this far down?"],
      ask: "A toll, traveler. Coin, or something with a pulse in it.",
      love: "Now THAT has a pulse.", like: "It'll do.", meh: "Thin. Give me more.", hate: "Dead thing. Useless.", join: "LINK ESTABLISHED. I walk with you now.",
      no: "Then we are strangers still.", scorn: "Your words are noise.", leave: "It folds back into the wires.",
      hold: ["Hm. A gift, mid-blow. Curious.", "Hold, traveler. Let me see it.", "You offer? Now? ...Wait."],
      accept: ["Enough. The toll is paid.", "A fair trade. We are done here.", "You may pass, flesh."],
      ignore: ["The toll was for later. Now, blood.", "Kind. Not enough.", "Nice try, traveler."],
      insult: ["Insolent.", "You think I am for sale?", "Is that all?"] },
    folklore: { open: ["Who comes into my hall?", "A living thing. How rare.", "You have the look of a beggar."],
      ask: "What will you give me, mortal?",
      love: "Ohh. Old, and lovely.", like: "Hm. Acceptable.", meh: "A crumb. Where's the rest?", hate: "Wires and plastic? You insult me.", join: "Then I am yours, little lantern.",
      no: "Keep it, then. And keep away.", scorn: "Hah. Go back up, child.", leave: "It is gone like smoke.",
      hold: ["...Hm. What have you brought?", "The old ones always did love a gift.", "Wait. Let me look at it."],
      accept: ["It is enough. Go in peace, child.", "A fair offering. The fight is ended.", "Old manners, still alive. Good."],
      ignore: ["Come closer, child.", "Pretty. I am still hungry.", "A bribe? Cute. Again."],
      insult: ["You dare?", "Rubbish. Take it back.", "Is that the best you have?"] },
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
    act(st, "talk:demon");
    const lines = [];
    st.roundOver = false;
    st.log = `> KURA speaks to ${the(e.name)}.`;
    tally(st, "demonTalks");
    lean(st, "talk", lines);
    if (e.angered || (UNIQUE[e.name] && !UNIQUE[e.name].talks)) {
      lines.push(`${THE(e.name)} won't listen.`);
      demonTurn(st, lines);
    } else if (isProgram(e.name) || Math.random() < Math.min(0.95, LISTEN[moon()] * (e.corrupt ? 0.7 : 1) * omen(clock(st) + (st.omenSalt || 0)).fx.talk * STANCE_TALK[stance(st, e)])) {
      lines.push(`${e.name}: "${say2(e, "open")}"`);
      // First it sizes KURA up: one or two questions, answered YES or NO (see DEMON TALK below).
      // Then it asks for a gift: anything. What it gets decides how it reacts (see GIFTS below).
      e.got = 0; e.asks = 1; e.mood = isProgram(e.name) || (e.corrupt && has(st, "PATCH")) ? 1 : 0;      // programs like KURA; PATCH steadies a corrupted one
      e.want = 2 + floorNum(st);
      e.silver = Math.round((20 + 10 * floorNum(st) + R(0, 20)) * { same: 0.7, neutral: 1, opposite: 1.5 }[stance(st, e)]);
      e.left = R(1, 2); e.asked = [];
      demonAsks(st, e, lines);
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
  PARTY_TALK.WATCHDOG = ['WATCHDOG: "PERIMETER CLEAR."', 'WATCHDOG: "NOTHING ENTERS UNLOGGED."', "WATCHDOG circles once, then sits."];
  PARTY_TALK.PATCH = ['PATCH: "MINOR FAULTS ONLY. FOR NOW."', 'PATCH: "HOLD STILL. THIS WON\'T HURT."', "PATCH runs a quiet check on everyone."];
  PARTY_TALK.CACHE = ['CACHE: "I KEPT A COPY OF THAT."', 'CACHE: "NOTHING IS TRULY LOST."', "CACHE rattles softly, full of small things."];
  PARTY_TALK.SCAN = ['SCAN: "SWEEPING..."', 'SCAN: "THE WALLS ARE THINNER HERE."', "SCAN's light passes slowly over the stone."];
  PARTY_TALK.COMPILER = ['COMPILER: "WORKING."', 'COMPILER: "GIVE ME TWO SMALL THINGS. I WILL GIVE YOU ONE."', "COMPILER hums, building something out of nothing."];
  const FAMILY_TALK = {
    data: ['{n}: "QUERY NOT UNDERSTOOD. RETRY?"', '{n}: "ALL SYSTEMS NOMINAL. FOR NOW."',
      '{n}: "CONVERSATION LOGGED."', '{n}: "USER HEART RATE ELEVATED."', '{n}: "01101000 01101001"',
      "{n} hums to itself in binary: 0110... 0110..."],
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
    act(st, "talk:party");
    tally(st, "partyTalks");
    const friends = (st.party || []).slice(1).filter(p => p.hp > 0);
    const odd = moon() === 4 ? 0.25 : 0.12;
    if (!friends.length || Math.random() < odd) {
      st.log = `> KURA speaks into the dark.`;
      st.extra = "> " + pick(friends.length || Math.random() < 0.5 ? VOICE_FROM_DARK : ["Only the walls answer.", "Her voice comes back, thinner."]);
      return show(st);
    }
    const p = pick(friends);
    st.log = `> KURA talks to ${p.name}.`;
    const tier = heatTier(RS(st.dungeon).heat), fam = p.family || "folklore";
    // Out of patience and still being talked to: half the time they snap. CHAOS members lash out at
    // KURA (it never kills her); LAW and NEUTRAL ones leave the party for good.
    if (snap(st, p)) return show(st);
    // In a calm room, a member with patience to spare sometimes asks KURA something instead (1 in 4).
    if (tier < 2 && (p.patience ?? PATIENCE) >= 3 && Math.random() < 0.25) { ask(st, p); return show(st); }
    // A member wearing thin (but not gone) sometimes asks whether things are all right: a chance to mend it.
    if (tier < 2 && (p.patience ?? PATIENCE) <= 2 && p.patience > 0 && Math.random() < 0.4) { ask(st, p, true); return show(st); }
    // One at ease sometimes opens up instead.
    if (tier < 2 && (p.patience ?? PATIENCE) >= 4 && Math.random() < ({ HAUGHTY: 0.08, DREAMY: 0.25 }[personaOf(p)] || 0.15) && confide(st, p)) return show(st);
    // Plain chatter is easy on them: only after about 7 talks each in a day (around 30 for the party)
    // does talking start to wear their patience down.
    p.chats = (p.chats || 0) + 1;
    if (p.chats > ({ HAUGHTY: 5, DREAMY: 8 }[personaOf(p)] || 6)) p.patience = Math.max(0, (p.patience ?? PATIENCE) - 1);
    // A dangerous room (nervous or worse) outranks being annoyed; otherwise a tired member says so.
    const lines = tier >= 2 ? (PARTY_HEAT[p.name] || FAMILY_HEAT[fam])[tier]
      : p.patience <= 2 ? (PARTY_TIRED[p.name] || FAMILY_TIRED[fam])[p.patience]
      : tier ? (PARTY_HEAT[p.name] || FAMILY_HEAT[fam])[tier] : (PARTY_TALK[p.name] || FAMILY_TALK[fam]);
    const pool = lines.map(l => "> " + l.replace(/\{n\}/g, p.name));
    st.extra = pick(pool.filter(l => l !== st.extra));        // never the same line twice in a row
    return show(st);
  }

  // QUESTIONS. Now and then, talking to a party member, they ask KURA something instead, and [Y]ES / [N]O
  // appear in the bottom right. Answers shift their patience, can lean KURA's alignment, and get a reply.
  // Doing anything else lets the question lapse. Each: [question, [yes reply, patience, lean], [no reply, patience, lean]].
  const ASK = {
    ELF: [
      ['ELF: "Do you trust me?"', ['ELF: "Foolish. But thank you."', 2], ['ELF: "Good. Don\'t."', 0, "talk"]],
      ['ELF: "Shall we take what we find, and ask nothing?"', ["ELF smiles, a little.", 1, "offer"], ['ELF: "As you like."', 0, "pay"]],
      ['ELF: "Would you leave us behind, to get out?"', ['ELF: "Honest, at least."', -2], ["ELF says nothing. She seems pleased.", 1]],
    ],
    PIXIE: [
      ['PIXIE: "Are we going to be okay?"', ['PIXIE: "Okay. OKAY. Good."', 2], ['PIXIE: "...Wow. Okay."', -1]],
      ['PIXIE: "Can I have the next shiny thing?"', ['PIXIE: "PROMISE."', 2], ['PIXIE: "Rude."', -1]],
      ['PIXIE: "Do you think the moon misses us?"', ['PIXIE: "Me too."', 1], ['PIXIE: "Hmph. It does."', 0]],
    ],
    "CU SITH": [
      ["CU SITH drops a bone at KURA's feet. Throw it?", ["CU SITH bounds off and comes back, delighted.", 2], ["CU SITH picks the bone back up, dignified.", 0]],
      ["CU SITH stares into the dark, then at KURA. Go look?", ["CU SITH charges into the dark and comes back proud.", 1, "offer"], ["CU SITH settles, ears still up.", -1]],
    ],
    data: [
      ['{n}: "QUERY: IS THIS A TEST? Y / N"', ['{n}: "UNDERSTOOD. PERFORMING."', 1, "pay"], ['{n}: "THEN WHAT IS THIS."', -1]],
      ['{n}: "PERMISSION TO LOG YOUR THOUGHTS? Y / N"', ['{n}: "LOGGING."', 1, "pay"], ['{n}: "PRIVACY MODE."', 0]],
    ],
    hardware: [
      ['{n}: "will you keep me? even when I\'m old?"', ['{n}: "ok. ok. thank you"', 2], ['{n}: "...ok"', -2]],
      ['{n}: "can I hum? I like humming"', ["{n} hums happily at mains frequency.", 1], ['{n}: "ok. quiet mode"', -1]],
    ],
    hybrid: [
      ['{n}: "Do you wish to be more than flesh?"', ['{n}: "We could arrange that."', 1, "offer"], ['{n}: "Pity."', 0, "pay"]],
      ['{n}: "Shall I listen to the walls for you?"', ['{n} listens. "...They\'re listening back."', 1], ['{n}: "Your choice, traveler."', 0]],
    ],
    folklore: [
      ['{n}: "Will they tell of us, after?"', ['{n}: "Let them."', 2], ['{n}: "Then we tell it ourselves."', -2]],
      ['{n}: "Will you remember my name, after?"', ['{n}: "We will see."', 2], ['{n}: "Then I will remember yours."', -2], ["HAUGHTY"]],
      ['{n}: "Do you fear the moon?"', ['{n}: "Wise."', 0, "pay"], ['{n}: "Good. Neither do I."', 0, "offer"]],
    ],
  };
  // LAST CHANCE: a member almost out of patience asks KURA if she has anything else to say. YES mends it. NO,
  // and they take their leave (how, and whether, depends on their nature). Silence only wears them down further.
  ASK.mend = [['{n}: "Anything else you want to say?"', ['{n} nods slowly. "Good. That is all I wanted."', 3, "talk"], ["", 0]]];
  const LEAVE_NO = {
    HAUGHTY: ['{n}: "Well, then!" {n} turns and is gone.', 1], PRIM: ['{n}: "Very well. Farewell." {n} leaves, back straight.', 1],
    SLY: ['{n}: "Suit yourself." {n} slips away, smiling.', 1], DREAMY: ['{n}: "...oh. Okay." {n} drifts off into the dark.', 0.8],
    GRUFF: ["{n} snorts and walks off. It looks back once, then goes.", 0.4],
  };
  function lastChance(st, p, yes) {
    if (yes === true) { p.patience = Math.min(PATIENCE + 2, (p.patience ?? 0) + 3); lean(st, "talk"); st.extra = "> " + ASK.mend[0][1][0].replace(/\{n\}/g, p.name); return; }
    if (yes === "silent") {                              // saying nothing wears them down further
      p.patience = Math.max(0, (p.patience ?? 0) - (personaOf(p) === "GRUFF" ? 1 : 2));
      st.extra = "> " + `${p.name} waits. Then looks away.`; return;
    }
    const [say, odds] = LEAVE_NO[personaOf(p)] || LEAVE_NO.PRIM;
    if (Math.random() < odds) {
      st.party = st.party.filter(q => q !== p); endPact(st, p.name);
      st.log = `> ${p.name} leaves the party.`;
      st.extra = "> " + (p.name === "PIXIE" ? QUIT.PIXIE : say).replace(/\{n\}/g, p.name);
    } else {
      p.patience = 0;
      st.extra = `> ${p.name} says nothing more. It is not over.`;
    }
  }
  // How a silent answer lands with a party member (patience change, and what they do).
  const SILENT_PARTY = {
    GRUFF: [1, "{n} grunts. Silence suits it."], DREAMY: [1, "{n} drifts closer. The quiet is nice."],
    PRIM: [0, "{n} waits, then lets it pass."], SLY: [() => Math.random() < 0.5 ? 1 : 0, "{n} smiles. It reads silence its own way."],
    HAUGHTY: [-1, "{n} frowns at the silence."],
  };
  // CONFIDING: a member at ease, now and then, tells KURA something about themselves (each told once, in order).
  const CONFIDE = {
    ELF: ['ELF: "I left a garden once. I still count its trees."', 'ELF: "I spent a hundred years in a tower. The quiet was easier."', 'ELF: "You remind me of someone. I will not say who."'],
    PIXIE: ['PIXIE: "I\'m scared of the dark. Don\'t tell anyone."', 'PIXIE: "I had a name before. It was longer. I forgot it."', 'PIXIE: "You\'re the first one who ever kept up."'],
    "CU SITH": ["CU SITH rests its head on KURA's knee. It trusts her.", "CU SITH shows KURA an old scar, then looks away.", "CU SITH leads KURA to a corner and shows her a buried bone. A gift."],
    data: ['{n}: "I DELETED A FILE ONCE. I STILL REMEMBER IT."', '{n}: "I WAS BUILT TO WATCH. NOW I WATCH OVER YOU."'],
    hardware: ['{n}: "I used to live in a kitchen. I miss the radio."', '{n}: "the last person to hold me left the light on"'],
    hybrid: ['{n}: "Half of me remembers rain. The other half, why."', '{n}: "I do not know which of me is the real one."'],
    folklore: ['{n}: "I was feared once. It was lonely."', '{n}: "Mountains forget. I try not to."'],
  };
  function confide(st, p) {
    const pool = CONFIDE[p.name] || CONFIDE[p.family || "folklore"], n = p.told || 0;
    if (n >= pool.length) return false;
    p.told = n + 1;
    p.patience = Math.min(PATIENCE + 2, (p.patience ?? PATIENCE) + 1);
    st.extra = "> " + pool[n].replace(/\{n\}/g, p.name);
    tally(st, "confided");
    return true;
  }
  function ask(st, p, mend) {
    const pool = mend ? ASK.mend : ASK[p.name] || ASK[p.family || "folklore"];
    const fits = pool.map((_, i) => i).filter(i => !pool[i][3] || pool[i][3].includes(personaOf(p)));
    const k = fits[R(0, fits.length - 1)];
    st.question = { who: p.name, pool: mend ? "mend" : ASK[p.name] ? p.name : (p.family || "folklore"), k };
    st.extra = "> " + pool[k][0].replace(/\{n\}/g, p.name);
  }
  // KURA answers the question: YES (true) or NO (false). Free, like turning.
  function reply(st, yes) {
    st = copy(st);
    const q = st.question;
    if (!q) return show(st);
    const p = (st.party || []).find(m => m.name === q.who);
    st.question = null;
    if (!p) return show(st);
    if (q.pool === "mend") {
      st.log = `> KURA answers ${p.name}: ${yes === "silent" ? "silence" : yes ? "yes" : "no"}.`;
      lastChance(st, p, yes); tally(st, "answers"); st.talkLine = st.extra;
      return show(st);
    }
    const quiet = yes === "silent";
    let line, dp, why;
    if (quiet) { const [d, say] = SILENT_PARTY[personaOf(p)] || SILENT_PARTY.PRIM; dp = typeof d === "function" ? d() : d; line = say; }
    else [line, dp, why] = ASK[q.pool][q.k][yes ? 1 : 2];
    p.patience = Math.max(0, Math.min(PATIENCE + 2, (p.patience ?? PATIENCE) + dp));
    if (why) lean(st, why);
    tally(st, "answers");
    st.log = `> KURA answers ${p.name}: ${quiet ? "silence" : yes ? "yes" : "no"}.`;
    st.extra = st.talkLine = "> " + line.replace(/\{n\}/g, p.name);
    return show(st);
  }

  // A party member with no patience left, pushed again: half the time they snap. CHAOS members lash
  // out at KURA (never fatally); LAW and NEUTRAL ones leave the party for good. True if they snapped.
  function snap(st, p) {
    if (p.patience !== 0 || Math.random() >= 0.5) return false;
    if (p.align === "CHAOS") {
      const kura = st.party[0], dmg = Math.min(kura.hp - 1, R(2, Math.ceil(kura.hpmax / 5)));
      st.party = st.party.map((q, i) => i === 0 ? { ...q, hp: q.hp - Math.max(0, dmg) } : q);
      st.log = `> ${p.name} has had enough.`;
      st.extra = "> " + (SNAP[p.name] || `${p.name} strikes KURA.`) + (dmg > 0 ? ` -${dmg} HP` : "");
    } else {
      st.party = st.party.filter(q => q !== p); endPact(st, p.name);
      st.log = `> ${p.name} leaves the party.`;
      st.extra = "> " + (QUIT[p.name] || QUIT[p.family || "folklore"]).replace(/\{n\}/g, p.name);
    }
    return true;
  }
  // DOING THE SAME THING OVER AND OVER (the same wall, turning round and round, searching a door):
  // after a few repeats the party starts to say something, more often the longer it goes on, and
  // each remark costs that member a point of patience (so it can end in a snap, like any pestering).
  const LOOPED = {
    ELF: ['ELF: "You have searched that wall a hundred times."', 'ELF: "Are you well?"', "ELF watches KURA, then the wall, then KURA.",
      'ELF: "If you stare long enough, it will not blink first."', 'ELF: "I have lived nine hundred years. This is the longest."',
      'ELF: "The wall has no secrets left. Only patience."', "ELF has started braiding her hair."],
    PIXIE: ['PIXIE: "Are you CRAZY? What are you DOING??"', 'PIXIE: "It\'s the SAME WALL."', 'PIXIE: "Okay. I\'m counting now."',
      'PIXIE: "I\'m naming it. This is Gerald."', 'PIXIE: "Maybe if you say please."', 'PIXIE: "Wake me up when it\'s a door."',
      "PIXIE lies down on KURA's head in protest.", 'PIXIE: "Gerald says no."'],
    "CU SITH": ["CU SITH lies down. It knows this will take a while.", "CU SITH tilts its head at KURA, then at the wall.",
      "CU SITH sighs through its nose. Loudly.", "CU SITH starts digging at the wall too. Then stops. Pointless.",
      "CU SITH puts its chin on KURA's foot.", "CU SITH falls asleep standing up."],
    data: ['{n}: "LOOP DETECTED."', '{n}: "INFINITE LOOP? Y / N"', '{n}: "SAME QUERY. SAME RESULT."',
      '{n}: "HAVE YOU TRIED TURNING IT OFF AND ON AGAIN?"', '{n}: "WHILE(TRUE) { SEARCH(WALL); }"'],
    hardware: ['{n}: "you\'re doing the thing again"', '{n}: "same input, same output. trust me"',
      '{n}: "I did this for nine years. a vending machine. same coin."', '{n}: "is it a puzzle? I don\'t do puzzles"'],
    hybrid: ['{n}: "Even machines know when to stop."', '{n}: "You are stuck in a loop, flesh."',
      '{n}: "I have half a mind to stop you. The other half is bored."', '{n}: "The wall is winning."'],
    folklore: ['{n}: "Madness, or patience. I cannot tell."', '{n}: "The wall will not change its mind."',
      '{n}: "I have seen mountains worn down slower."', '{n}: "Humans. Always knocking."'],
  };
  // Very rarely, a remark turns into a question: [Y]ES / [N]O, answered like any other party question.
  const BANTER_ASK = {
    ELF: [['ELF: "Shall I try? Elves have a way with walls."', ["ELF touches the wall. Nothing. She looks offended.", 1], ['ELF: "Suit yourself."', 0]]],
    PIXIE: [['PIXIE: "Can we PLEASE do something else?"', ['PIXIE: "YES. Thank you."', 2], ["PIXIE groans into KURA's hair.", -1]],
      ['PIXIE: "Do you want me to search it FOR you?"', ['PIXIE pats the wall once. "There. Searched."', 1], ['PIXIE: "Fine. FINE."', 0]]],
    "CU SITH": [["CU SITH brings KURA a pebble. Is this it?", ["CU SITH is very proud of itself.", 2], ["CU SITH puts the pebble back exactly where it was.", -1]]],
    data: [['{n}: "SUGGEST NEW TASK? Y / N"', ['{n}: "ACKNOWLEDGED. THANK YOU."', 2], ['{n}: "CONTINUING. RELUCTANTLY."', -1]]],
    hardware: [['{n}: "can I hold it? whatever it is?"', ['{n} holds it very carefully. "ok. ok."', 2], ['{n}: "ok. just asking"', -1]]],
    hybrid: [['{n}: "Shall I listen to it for you?"', ['{n} listens. "It says no."', 1], ['{n}: "Your loss."', 0]]],
    folklore: [['{n}: "Is this a ritual? Should I chant?"', ["{n} chants something old. Nothing happens. It seems pleased anyway.", 1], ['{n}: "Pity."', -1]]],
  };
  for (const k of Object.keys(BANTER_ASK)) ASK["banter:" + k] = BANTER_ASK[k];      // so a saved question still works after a reload
  function banterAsk(st, p) {
    if (Math.random() >= 0.06 || st.encounter) return false;
    const key = BANTER_ASK[p.name] ? p.name : (p.family || "folklore");
    const k = R(0, BANTER_ASK[key].length - 1);
    st.question = { who: p.name, pool: "banter:" + key, k };
    st.extra = "> " + BANTER_ASK[key][k][0].replace(/\{n\}/g, p.name);
    return true;
  }
  function nag(st) {
    const n = (st.loop && st.loop.n) || 0, friends = (st.party || []).slice(1).filter(p => p.hp > 0);
    if (n < 8 || !friends.length || Math.random() >= Math.min(0.5, 0.04 * (n - 7))) return false;
    const p = pick(friends), log = st.log;
    if (snap(st, p)) { st.log = log; return true; }
    p.patience = Math.max(0, (p.patience ?? PATIENCE) - 1);
    if (p.patience > 1 && banterAsk(st, p)) return true;
    const lines = p.patience <= 1 ? (PARTY_TIRED[p.name] || FAMILY_TIRED[p.family || "folklore"])[p.patience] : (LOOPED[p.name] || LOOPED[p.family || "folklore"]);
    st.extra = "> " + pick(lines.filter(l => "> " + l.replace(/\{n\}/g, p.name) !== st.extra)).replace(/\{n\}/g, p.name);
    return true;
  }

  // Fiddling with something useless, over and over, wears on the party too.
  const FIDDLE = ['{n} watches KURA fiddle with it.', '{n}: "What are you doing?"', "{n} pretends not to notice.",
    '{n}: "It\'s not going to do anything."', '{n}: "Is it supposed to do something?"', '{n}: "Shake it harder. That always works."',
    '{n}: "I don\'t think that\'s how it works."', "{n} is trying very hard not to laugh.", '{n}: "Maybe it\'s decorative."',
    '{n}: "You\'re going to break it. ...You\'re going to break it."', '{n}: "Have you tried asking it nicely?"'];
  // w = how many times KURA has tried this thing: the longer she keeps at it, the likelier someone reacts
  // (rarely at first, then up to half the time after a couple dozen tries).
  function fidget(st, w = 1) {
    const friends = (st.party || []).slice(1).filter(p => p.hp > 0);
    // Nobody reacts this time: clear an earlier reaction so it doesn't look like a new one.
    if (!friends.length || Math.random() >= Math.min(0.5, 0.03 + 0.02 * w)) { if (st.extra === st.fidgetLine) st.extra = ""; return; }
    const p = pick(friends), log = st.log;
    if (snap(st, p)) { st.log = log; st.fidgetLine = st.extra; return; }   // line 2 keeps the item; line 3 the snap
    p.patience = Math.max(0, (p.patience ?? PATIENCE) - 1);
    if (p.patience > 2 && banterAsk(st, p)) { st.fidgetLine = st.extra; return; }
    const lines = p.patience <= 2 ? (PARTY_TIRED[p.name] || FAMILY_TIRED[p.family || "folklore"])[p.patience] : FIDDLE;
    st.extra = st.fidgetLine = "> " + pick(lines).replace(/\{n\}/g, p.name);
  }

  // ICHOR is demon blood and old light: what's left when a demon falls. It's the party's medicine:
  // it heals demons (about 1 ICHOR per HP; bringing back a fallen one costs three times as much), but not KURA.
  // KURA can drink it anyway. It heals her badly (10 ICHOR for 5 HP), pulls her hard toward CHAOS, and
  // leaves TAINT, which fades a point each night. Any taint gives her a buzz (her blows land a little
  // harder). From 3 she starts seeing things (strange thoughts on line 3). At 6 she TRIPS (a status,
  // KURA* in the party panel) for 50-100 actions, or until she sleeps: she strikes twice as hard but a
  // third of her blows go wild and hit the party (never knocking anyone out), she sometimes answers
  // demons the opposite of what she meant, deep finds come three times as easily, she can read binary
  // on her own, and the TURN counter can't be trusted (it sometimes counts backwards). Coming down
  // costs her a third of her HP (never below 1).
  const DRINK = 10, ODD_AT = 3, TRIP_AT = 6;
  const tripping = st => !!(st.party && st.party[0] && st.party[0].status === "TRIP");
  function feedIchor(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    let have = st.ichor || 0;
    const fed = [];
    for (const p of st.party.slice(1)) {
      const missing = p.hpmax - p.hp, rate = p.hp > 0 ? 1 : 3;
      if (!missing || have < rate) continue;
      const heal = Math.min(missing, Math.floor(have / rate));
      p.hp += heal; have -= heal * rate; fed.push(p.name);
    }
    const spent = (st.ichor || 0) - have;
    if (!spent) { st.log = (st.ichor || 0) ? "> No one in the party needs it." : "> There's no ICHOR left."; return show(st); }
    act(st, "ichor:feed");
    st.ichor = have;
    tally(st, "ichorFed", spent);
    st.log = `> ${fed.length === 1 ? fed[0] + " drinks" : "The party drinks"}. ICHOR -${spent}.`;
    st.extra = "> " + pick([`${pick(fed)} laps it up. The wounds close.`, `${pick(fed)} drinks deep and sighs.`,
      "The ichor glows, then is gone. So are the wounds.", `${pick(fed)}: the color comes back.`]);
    return show(st);
  }
  const DRINK_REACT = {
    ELF: ['ELF: "You shouldn\'t have done that."', "ELF watches KURA very closely now."],
    PIXIE: ['PIXIE: "KURA?? Spit it OUT."', 'PIXIE: "That\'s not for YOU!"'],
    "CU SITH": ["CU SITH whines and sniffs KURA's hands.", "CU SITH won't stop licking KURA's fingers."],
    data: ['{n}: "HUMAN INTEGRITY: 97%."', '{n}: "WARNING: FOREIGN CODE IN USER."'],
    hardware: ['{n}: "is that... allowed?"', '{n}: "you smell like us now"'],
    hybrid: ['{n}: "Now you are a little like me."', '{n}: "Careful. It remembers where it came from."'],
    folklore: ['{n}: "Brave. Or hungry."', '{n}: "Now you taste of us."'],
  };
  function drinkIchor(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    if (!ensureFloor(st)) return show(st);
    if ((st.ichor || 0) < DRINK) { st.log = `> KURA needs ${DRINK} ICHOR to drink. There isn't enough.`; return show(st); }
    act(st, "ichor:drink");
    const k = st.party[0];
    st.ichor -= DRINK;
    k.hp = Math.min(k.hpmax, k.hp + 5);
    st.taint = (st.taint || 0) + 1;
    tally(st, "ichorDrunk");
    lean(st, "drink");
    st.log = "> " + pick(["KURA drinks the ichor. It burns going down.", "KURA drinks. It tastes like pennies and lightning.",
      "KURA drinks. For a moment the room is very bright."]) + " +5 HP";
    if (st.taint >= TRIP_AT && !tripping(st)) {
      k.status = "TRIP"; st.tripLeft = R(50, 100); st.turnShown = st.steps; tally(st, "trips");
      st.log = "> KURA drinks. Something in her head comes loose.";
      st.extra = "> The walls lean in to listen. KURA is TRIPPING.";
      st.statusIn = 0;
      return show(st);
    }
    if (st.taint === 1) { st.extra = "> KURA can feel it in her teeth. Her hands want to hit something."; return show(st); }
    if (st.taint === ODD_AT) { st.extra = "> The edges of things have started to shimmer."; return show(st); }
    const friends = st.party.slice(1).filter(p => p.hp > 0);
    if (friends.length) {
      const p = pick(friends);
      p.patience = Math.max(0, (p.patience ?? PATIENCE) - 1);
      st.extra = "> " + pick(DRINK_REACT[p.name] || DRINK_REACT[p.family || "folklore"]).replace(/\{n\}/g, p.name);
    }
    return show(st);
  }
  // Coming down: when the trip runs out (or overnight).
  function comeDown(st) {
    const k = st.party[0];
    delete k.status; st.tripLeft = 0; delete st.turnShown;
    const loss = Math.min(k.hp - 1, Math.ceil(k.hpmax / 3));
    k.hp -= loss;
    st.tell = `> KURA comes down hard. Her hands won't stop shaking. -${loss} HP`;
    st.statusIn = 0;
  }
  const TRIP_LINES = ["The walls are breathing with her.", "PIXIE has three faces. All of them are kind.",
    "Someone is whispering KURA's name in binary.", "The floor is very far away, and very close.",
    "Every shadow here is a door, if she asks nicely.", "KURA can hear the moon. It's humming.",
    "Her hands leave trails of light.", "The stone remembers the sea. It tells her about it."];

  // DEMON TALK. Before it wants anything, a demon that listens asks KURA one or two things, each family
  // its own way. Each answer it likes lifts its mood (a happier demon is easier to please and likelier
  // to join); each it dislikes sours it, and a demon in a foul mood loses its temper and strikes.
  // Each entry: [question, which answer it likes (true = YES, or "LAW"/"CHAOS" = what its alignment likes), reply if liked, reply if not].
  const DEMON_ASK = {
    data: [
      ["QUERY: ARE YOU HUMAN? Y / N", true, "CONFIRMED. LOGGING ANOMALY.", "LIE DETECTED."],
      ["QUERY: DO YOU FOLLOW RULES? Y / N", "LAW", "COMPATIBLE.", "INCOMPATIBLE."],
      ["QUERY: ARE YOU LOST? Y / N", true, "ROUTE UNKNOWN. RELATABLE.", "DISAGREE. YOU ARE LOST."],
      ["01000110 01010010 01001001 01000101 01001110 01000100 00111111 Y / N", true, "01011001 01000101 01010011", "01001110 01001111"],
    ],
    hardware: [
      ["do you have a charger? anything?", true, "really?? ok. ok.", "...nobody ever does"],
      ["are you here to fix me?", true, "finally. finally.", "oh. ok. sure."],
      ["is it still raining up there?", true, "I liked the rain. on my casing.", "oh. that's worse somehow"],
    ],
    hybrid: [
      ["Do you hear the wires sing too?", true, "Then you're half like me.", "Pity. They sing of you."],
      ["Would you trade a memory for a secret?", "CHAOS", "A fair trade. Later.", "Clever. Or dull."],
      ["Is the flesh worth keeping?", "LAW", "Sentimental. I like that.", "Then we agree."],
    ],
    folklore: [
      ["Do you fear me?", true, "Good. Manners, at last.", "Bold. Or foolish."],
      ["Have you come with an offering?", true, "Then we may yet be friends.", "Then why speak to me at all?"],
      ["Do you know my name?", "CHAOS", "Liar. But a pleasing one.", "Good. Keep it that way."],
    ],
  };
  function demonAsks(st, e, lines) {
    const pool = DEMON_ASK[e.family || "folklore"], free = pool.map((_, i) => i).filter(i => !e.asked.includes(i));
    const k = pick(free);
    e.asked.push(k); e.q = k; e.stage = "chat";
    lines.push(`${e.name}: "${pool[k][0]}"`);
  }
  // PERSONALITY. Every demon has one, fixed by its name (each family leans toward a few). It decides how a
  // silent answer lands, how readily it asks for something, and whether it will ever join without being won over.
  const PERSONA_OF = { data: ["PRIM", "SLY"], hardware: ["GRUFF", "DREAMY"], hybrid: ["SLY", "HAUGHTY", "GRUFF"], folklore: ["HAUGHTY", "GRUFF", "SLY"] };
  const PARTY_PERSONA = { ELF: "PRIM", PIXIE: "DREAMY", "CU SITH": "GRUFF" };
  function personaOf(e) {
    if (PARTY_PERSONA[e.name]) return PARTY_PERSONA[e.name];
    const list = PERSONA_OF[e.family || "folklore"] || PERSONA_OF.folklore;
    return list[[...String(e.name)].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length];
  }
  const ASK_MOD = { HAUGHTY: 1.4, PRIM: 0.6, DREAMY: 0.5 };
  // How a silent answer lands: the line, and the mood it moves (+1 pleased, -1 offended).
  const SILENCE = {
    GRUFF: [n => `${THE(n)} grunts. It seems to approve.`, () => 1],
    HAUGHTY: [n => `${THE(n)} sniffs. Being ignored is not what it wanted.`, () => -1],
    SLY: [n => `${THE(n)} smiles. It reads silence its own way.`, () => Math.random() < 0.5 ? 1 : 0],
    PRIM: [n => `${THE(n)} waits, then quietly takes note.`, () => 0],
    DREAMY: [n => `${THE(n)} drifts closer. It likes the quiet.`, () => 1],
  };
  function demonHears(st, e, yes, lines) {
    const [, likes, good, bad] = DEMON_ASK[e.family || "folklore"][e.q];
    const quiet = yes === "silent";
    if (quiet) {                                      // a third answer: say nothing, and let its nature decide
      const [say, feel] = SILENCE[personaOf(e)] || SILENCE.PRIM, first = !e.quiet;
      let d = feel();
      if (first) d = Math.max(d, 0);                  // the first silence is forgiven, and the talk goes on a little longer
      lines.push("KURA says nothing.", say(e.name));
      e.mood += d; e.quiet = (e.quiet || 0) + 1;
      if (first && e.left <= 1) e.left += 1;
    } else {
      if (tripping(st) && Math.random() < 0.3) { yes = !yes; lines.push("KURA meant to say the other thing."); }
      const wanted = likes === true ? true : likes === "LAW" ? e.align === "LAW" || e.align === "NEUTRAL" && Math.random() < 0.5
        : e.align === "CHAOS" || e.align === "NEUTRAL" && Math.random() < 0.5;
      const liked = likes === true ? yes : yes === wanted;
      lines.push(`KURA: ${yes ? "\"Yes.\"" : "\"No.\""}`, `${e.name}: "${liked ? good : bad}"`);
      e.mood += liked ? 1 : -1;
      // Answers to a question about order or mischief pull KURA that way.
      if (likes === "LAW" || likes === "CHAOS") lean(st, yes ? (likes === "LAW" ? "talkLAW" : "talkCHAOS") : (likes === "LAW" ? "talkCHAOS" : "talkLAW"));
    }
    tally(st, "demonAnswers");
    if (e.mood <= -2) {                               // two sour answers: it loses its temper
      lines.push(`${THE(e.name)} has heard enough.`);
      e.stage = null; e.angered = true; demonTurn(st, lines);
      return;
    }
    if (--e.left > 0) return demonAsks(st, e, lines);
    sizeUp(st, e, lines);
  }
  // The questions are over. Only some demons then ask for something (programs hardly ever); the rest
  // simply end the talk: a pleased LAW-leaning one may offer to join, the others go their way.
  const ASK_ODDS = { data: 0.1, hardware: 0.3, hybrid: 0.4, folklore: 0.45 };
  function sizeUp(st, e, lines) {
    if (e.corrupt) {                                   // the damage lifts, or it doesn't
      if (e.mood >= 1) {
        e.corrupt = false; e.name = e.base; e.align = alignOf(e.base);
        tally(st, "restored"); lean(st, "restore");
        lines.push(`The noise drains out of ${e.name}. It is whole again.`);
        if (Math.random() < 0.6) { e.stage = "join"; lines.push(`${THE(e.name)} offers to join the party.`); }
        else { lines.push(`${e.name}: "${say2(e, "leave")}"`); leaves(st, e); }
      } else {
        lines.push("The noise swallows it again.");
        e.stage = null; e.angered = true; demonTurn(st, lines);
      }
      return;
    }
    if (isProgram(e.name)) {                           // a program never asks for anything: it just decides whether to link
      if (Math.random() < (e.mood >= 1 ? 0.9 : e.mood === 0 ? 0.4 : 0)) { e.stage = "join"; lines.push(`${THE(e.name)} offers to link with the party.`); }
      else { lines.push(`${e.name}: "${say2(e, "leave")}"`); leaves(st, e); }
      return;
    }
    if (Math.random() < Math.min(0.9, (ASK_ODDS[e.family || "folklore"] ?? 0.4) * (ASK_MOD[personaOf(e)] || 1))) {
      e.stage = "gift";                                // sized up: now it wants something
      lines.push(`${e.name}: "${say2(e, "ask")}"`);
      return;
    }
    const proud = personaOf(e) === "HAUGHTY" && e.mood < 2;          // a haughty one has to be won over twice
    const joins = e.mood >= 1 && e.align !== "CHAOS" && !proud ? Math.min(0.5, 0.2 + 0.1 * (e.mood - 1)) : 0;
    if (Math.random() < joins) { e.stage = "join"; lines.push(`${THE(e.name)} offers to join the party.`); return; }
    lines.push(e.mood >= 1 ? `${THE(e.name)} is content. ${say2(e, "leave")}` : `${THE(e.name)} loses interest. ${say2(e, "leave")}`);
    leaves(st, e);
  }

  // KURA's answer to a demon's price or offer.
  function answer(st, yes) {
    st = copy(st);
    const e = st.encounter;
    if (!e || !e.stage) return show(st);
    const lines = [];
    if (yes === "silent" && e.stage !== "chat") yes = false;      // silence only means something to a demon's question
    if (e.stage === "gift") return give(st, yes ? 0 : null);
    if (e.stage === "chat") { demonHears(st, e, yes, lines); st.round = lines; st.roundOver = !st.encounter || st.dead; return show(st); }
    if (e.stage === "join") {
      if (!yes) { lines.push(`KURA declines. ${say2(e, "leave")}`); leaves(st, e); }
      else if (st.party.length < 4) recruit(st, e, lines);
      else { e.stage = "swap"; lines.push("The party is full. Send someone away?"); }
    } else return show(st);                            // any other stage has its own buttons; YES/NO means nothing there
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
    e.got += v * (1 + 0.2 * (e.mood || 0));           // a demon in a good mood is easier to please
    const chaos = e.align === "CHAOS";
    if (e.got < e.want) {
      // Not enough yet. It keeps what it got. After three asks it loses patience and leaves with it all.
      if (e.asks >= 3) { lines.push(who + `"${say2(e, "meh")}"`, `${THE(e.name)} takes it all and goes.`); leaves(st, e); }
      else { e.asks++; lines.push(who + `"${say2(e, "meh")}"`); }
    } else {
      const love = v >= e.want * 1.5 || e.got >= e.want * 2;
      lines.push(who + `"${say2(e, love ? "love" : "like")}"`);
      const joins = Math.max(0, Math.min(0.95, (chaos ? (love ? 0.3 : 0.1) : (love ? 0.9 : 0.65)) + 0.05 * (e.mood || 0)));
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

  // GIVE in a fight: open the gift list right away (a free action; it costs nothing until KURA picks a gift).
  // A demon that is already fighting mostly doesn't care (more than half the time it still attacks):
  //   it stands down  (rare, a little better the more it likes the gift; never 9% or more): it leaves, or sometimes offers to join;
  //   it hesitates    (a quarter of the time): it takes the gift and holds its blow this round;
  //   it ignores it   (the rest): it breaks the gift or throws it away, and strikes anyway;
  //   it is insulted  (a gift it hates, always): the same, and the fight turns ugly (it stops listening).
  // A gift that doesn't land is lost either way.
  // Either way KURA's own round is spent, so the party doesn't strike.
  function offer(st) {
    st = copy(st);
    if (st.dead) { st.extra = OVER; return show(st); }
    const e = st.encounter;
    if (!e) { st.log = "> Nothing here to give to."; return show(st); }
    if (e.stage) return show(st);                        // already waiting on an answer
    if (e.want === undefined) {                          // a demon that was never talked to has no price yet
      e.want = 2 + floorNum(st);
      e.silver = Math.round((20 + 10 * floorNum(st) + R(0, 20)) * { same: 0.7, neutral: 1, opposite: 1.5 }[stance(st, e)]);
      e.got = 0; e.asks = 1; e.mood = e.mood || 0;
    }
    e.stage = "offer";
    st.round = ["KURA reaches into the bag."];
    st.roundOver = false;
    return show(st);
  }
  // What a demon does with a gift it doesn't want: breaks it or throws it away. The gift is gone either way.
  function ruinLine(e, g) {
    if (g.silver) return `${THE(e.name)} scatters the coins into the dark.`;
    return pick([`${THE(e.name)} snaps it in two.`, `${THE(e.name)} crushes it underfoot.`, `${THE(e.name)} flings it into the dark.`, `${THE(e.name)} tosses it away.`]);
  }
  function ruin(st, e, g, lines) {
    if (g.silver) st.silver -= g.silver; else st.items.splice(st.items.indexOf(g.item), 1);
    lines.push(ruinLine(e, g));
  }
  // KURA picks gift i from gifts(), or backs out (i = null: nothing is spent).
  function offerGive(st, i) {
    st = copy(st);
    const e = st.encounter;
    if (!e || e.stage !== "offer") return show(st);
    if (i === null) { e.stage = null; st.round = ["KURA lowers her hand."]; st.roundOver = false; return show(st); }
    const g = gifts(st)[i];
    if (!g) return show(st);
    if (!g.ok) { st.round = [`KURA has only ${st.silver ?? 0} SILVER.`]; return show(st); }
    act(st, "give");
    e.round++; e.stage = null;
    const lines = [], who = `${e.name}: `, v = worth(e, g);
    st.roundOver = false;
    st.log = `> KURA offers ${the(e.name)} a gift.`;
    if (v < 0) {
      // Hated: it breaks it or throws it away, and the fight gets uglier.
      lines.push(`KURA offers ${g.label}.`, who + `"${say2(e, "insult")}"`);
      ruin(st, e, g, lines);
      e.angered = true; demonTurn(st, lines);
    } else {
      tally(st, "gifts");
      if (g.silver) { st.silver -= g.silver; lines.push(`KURA gives ${g.label}.`); lean(st, "pay", lines); }
      else {
        st.items.splice(st.items.indexOf(g.item), 1); lines.push(`KURA gives ${g.item}.`);
        const ga = itemAlign(g.item); lean(st, ga === "LAW" ? "offerLAW" : ga === "NEUTRAL" ? null : "offer", lines);
      }
      const roll = Math.random(), stand = Math.min(0.09, 0.02 + 0.015 * v);
      if (roll < stand) {
        lines.push(who + `"${say2(e, "accept")}"`);
        if (e.align !== "CHAOS" && st.party.length < 4 && Math.random() < 0.2) { e.stage = "join"; lines.push(`${THE(e.name)} lowers its guard and offers to join the party.`); }
        else { lines.push(`${THE(e.name)} is satisfied. ${say2(e, "leave")}`); leaves(st, e); }
      } else if (roll < stand + 0.25) {
        lines.push(who + `"${say2(e, "hold")}"`, `${THE(e.name)} turns the gift over. It holds its blow.`);
      } else {
        // It takes the gift only to wreck it: the gift is already spent above, so only the line changes.
        lines.push(who + `"${say2(e, "ignore")}"`, ruinLine(e, g));
        demonTurn(st, lines);
      }
    }
    st.round = lines;
    st.roundOver = !st.encounter || st.dead;
    return show(st);
  }

  // CODEX: an encyclopedia of every demon met and item found. It lives in the save but RST never
  // clears it, so it fills up over many runs. The how-it-works notes live here, not on the item itself.
  function note(st, kind, name, what) {
    const c = st.codex = st.codex || { demons: {}, items: {} };
    const e = c[kind][name] = c[kind][name] || {};
    e[what] = (e[what] || 0) + 1;
  }
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
  const PROGRAM_JOB = {
    WATCHDOG: "Guards the party: blows land softer.", PATCH: "Mends the party after a fight. Steadies corrupted data.",
    CACHE: "At camp, keeps a copy of a COMMON item.", SCAN: "Reads the walls: now and then a search shows what a door hides.",
    COMPILER: "At camp, merges two COMMON items into an UNCOMMON one.",
  };
  function codex(st) {
    const c = st.codex || { demons: {}, items: {} };
    const demons = Object.keys({ ...FAMILY, programs: 0 }).map(f => ({ group: f, entries: (f === "programs" ? PROGRAMS : FAMILY[f]).concat(f === "folklore" ? Object.keys(UNIQUE) : []).map(name => {
      const seen = c.demons[name] || {}, fam = familyOf(name), al = alignOf(name);
      const known = !!(seen.met || seen.joined || (st.party || []).some(p => p.name === name));
      if (!known) return { name, known };
      const lines = [];
      if (UNIQUE[name]) lines.push("It does not talk. It does not stop.");
      else {
        lines.push(`"${VOICE[fam].open[0]}"`, isProgram(name) ? PROGRAM_JOB[name] : WANTS[fam]);
        if (al === "CHAOS") lines.push("Trickster: takes gifts, rarely joins.");
      }
      lines.push(al === "NEUTRAL" ? "NEUTRAL: neither friend nor foe to anyone."
        : `${al}: friendlier to a ${al} KURA, hostile to a ${al === "LAW" ? "CHAOS" : "LAW"} one.`);
      return { name, known, tag: `${UNIQUE[name] ? "unique" : fam}   ${al}`, lines, count: `Met ${seen.met || 0}   Recruited ${seen.joined || 0}` };
    }) }));
    // One plain list (A to Z): nothing here says how rare an item is.
    const all = TIERS.flatMap(t => names(t)).sort((x, y) => x.localeCompare(y));
    const items = [{ group: "items", entries: all.map(name => {
      const seen = c.items[name] || {};
      if (!seen.found) return { name, known: false };
      const a = itemAlign(name), info = ITEM_INFO[name] || {}, nat = natureOf(name);
      const lines = [info.text, `${NATURE_NAME[nat]}. ${tastes(nat)}`];
      if (a === "LAW" || a === "CHAOS") lines.push(`${a}: finding or giving it pulls KURA toward ${a}.`,
        `${a} demons prize it. ${a === "LAW" ? "CHAOS" : "LAW"} demons think less of it.`);
      else if (a) lines.push("NEUTRAL: no pull either way.");
      if (info.use) lines.push("Can be used from INVOKE.");
      return { name, known: true, tag: a || "", lines, count: `Found ${seen.found}` + (seen.broken ? `   Broken ${seen.broken}` : "") };
    }) }];
    return { demons, items };
  }

  // With a full party: send member i (1-3; KURA can't leave) away to make room, or keep everyone (i = null).
  function swap(st, i) {
    st = copy(st);
    const e = st.encounter;
    if (!e || e.stage !== "swap") return show(st);
    const lines = [];
    if (i === null || !st.party[i] || i === 0) { lines.push(`KURA keeps the party. ${say2(e, "leave")}`); leaves(st, e); }
    else { const gone = st.party.splice(i, 1)[0]; endPact(st, gone.name); lines.push(`${gone.name} leaves the party.`); recruit(st, e, lines); }
    st.round = lines;
    st.roundOver = true;
    return show(st);
  }
  function leaves(st, e) { st.log = `> ${THE(e.name)} leaves.`; st.encounter = null; }
  // A pact ends when the demon leaves the party.
  function endPact(st, name) { const p = (st.pacts || []).find(q => q.name === name && q.on); if (p) p.on = false; }
  function recruit(st, e, lines) {
    const lv = Math.max(1, 2 * floorNum(st) + R(-1, 2));
    const hpmax = 12 + lv * 5, mpmax = lv * 2 + R(0, 4);
    st.party.push({ name: e.base || e.name, lv, hp: hpmax, hpmax, mp: mpmax, mpmax, family: e.family, align: e.align, demon: true });
    lines.push(`${e.name}: "${say2(e, "join")}"`, `${e.name} joins the party.`);
    note(st, "demons", e.name, "joined"); tally(st, "recruited");
    (st.pacts = st.pacts || []).push({ name: e.name, floor: st.floor, day: st.day, on: true });      // the pact is kept on record
    lean(st, e.align, lines);
    st.log = `> ${e.name} joins the party.`;
    st.encounter = null;
  }

  // The end-of-run summary: label/value pairs for the log screen.
  function summary(st) {
    const k = st.stats || {}, d = st.dungeon, heat = d ? RS(d).heat : 0;
    const TIER = ["calm", "uneasy", "nervous", "wrong"];
    const fixed = n => (n > 0 ? "+" : "") + (Math.round((n || 0) * 10) / 10);
    return [
      ["Reached", `${st.floor}  (${k.floors || 0} floor${k.floors === 1 ? "" : "s"} descended)`],
      ["Days", st.day], ["Turns", st.steps || 0], ["Steps walked", k.steps || 0], ["Searches", k.searches || 0],
      ["Alignment", `${st.align}  (lean ${fixed(st.alignScore)}, LAW - / CHAOS +)`],
      ["Heat here", `${Math.round(heat)}  (${TIER[heatTier(heat)]})`], ["Hottest room", Math.round(k.maxHeat || 0)],
      ["Demons met", k.met || 0], ["Beaten", k.beaten || 0], ["Talked to", k.demonTalks || 0],
      ["Gifts given", k.gifts || 0], ["Recruited", k.recruited || 0],
      ["Restored", k.restored || 0], ["Pacts", (st.pacts || []).map(q => q.name + (q.on ? "" : " (ended)")).join(", ") || "none"], ["Escaped", k.fled || 0],
      ["Party talks", k.partyTalks || 0], ["Items found", k.items || 0],
      ["ICHOR fed", k.ichorFed || 0], ["ICHOR drunk", `${k.ichorDrunk || 0} times  (${k.trips || 0} trips)`],
      ["Items broken", `${k.broken || 0}  (${k.insides || 0} had something inside)`],
      ["SILVER", `${st.silver || 0}  (${k.silverFound || 0} found)`], ["ICHOR", `${st.ichor || 0}  (${k.ichorWon || 0} won)`],
      ["Party left", (st.party || []).slice(1).map(p => p.name).join(", ") || "nobody"],
    ];
  }

  const api = { summary, next, discharge, chargeLeft: st => { const t = st.today || {}; return (!t.stepped || st.freeSteps ? 1 : 0) + ((st.spare || 0) > 0 ? 1 : 0); }, freesteps, debugInfo, reset, hold, altarOpen, altarGive, altarGifts, search, go, turn, available, isLocked: (st, dir) => !!st.dungeon && looksLocked(st.dungeon, dir), tick, inventory, useItem, fight, talk, answer, swap, give: giveTo, gifts, offer, offerGive, codex, reply, feedIchor, drinkIchor, omen: t => omen(t), tierOf: n => TIER[n] || "COMMON", itemAlign };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
