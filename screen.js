// Renders the 80-column SMT daily dungeon screen from a save object.
// Shared by the web page (index.html) and node (for testing).
(function (root) {
  // The build number: bumped with every release, so About and the changelog always match.
  const VERSION = "v0.78";
  const W = 80, VW = 47, VH = 17, OFF = [0, 3, 6];
  const L_ = o => 2 + o, R_ = o => 44 - o;
  const ljust = (s, n) => s.length >= n ? s : s + " ".repeat(n - s.length);
  const rjust = (s, n) => s.length >= n ? s : " ".repeat(n - s.length) + s;
  const center = (s, n) => {           // matches Python str.center
    if (s.length >= n) return s;
    const total = n - s.length;
    let left = Math.floor(total / 2);
    if (total % 2 === 1 && n % 2 === 1) left += 1;
    return " ".repeat(left) + s + " ".repeat(total - left);
  };

  function renderView(left, right, end, depth, lock) {
    const c = Array.from({ length: VH }, () => Array(VW).fill(" "));
    const put = (x, y, ch) => { if (x >= 0 && x < VW && y >= 0 && y < VH) c[y][x] = ch; };
    for (let k = 0; k < depth; k++) {
      const a = OFF[k], b = OFF[k + 1];
      for (const [side, closed] of [["L", left[k]], ["R", right[k]]]) {
        if (closed) {
          for (let i = 0; i < b - a; i++) {
            if (side === "L") { put(L_(a) + i, a + i, "\\"); put(L_(a) + i, 16 - a - i, "/"); }
            else { put(R_(a) - i, a + i, "/"); put(R_(a) - i, 16 - a - i, "\\"); }
          }
        } else {
          const [xa, xb] = side === "L" ? [L_(a), L_(b)] : [R_(b), R_(a)];
          if (!(end === "door" && !lock)) {                  // (the big arch stands clear of the side openings)
            for (let x = xa; x <= xb; x++) { put(x, b - 1, "_"); put(x, 16 - b, "_"); }
            for (let y = b; y < 17 - b; y++) put(side === "L" ? xa : xb, y, "|");
          }
        }
        const x = side === "L" ? L_(b) : R_(b);
        for (let y = b; y < 17 - b; y++) put(x, y, "|");
      }
    }
    const o = OFF[depth], l = L_(o), r = R_(o), t = o, bm = 16 - o;
    if (end === "dark") {
      for (let x = l + 1; x < r; x++) for (let y = t; y <= bm; y++) if ((x + y) % 3 === 0) put(x, y, ".");
    } else {
      for (let x = l; x <= r; x++) { put(x, t - 1, "_"); put(x, bm, "_"); }
      const cx = Math.floor((l + r) / 2);
      if (end === "door" && !lock) {       // an open door: a big double-line arch, with the room beyond left empty
        const arch = (x0, y0, w) => {
          const T = w - 20, b0 = Math.floor((w - T) / 2), top = (x, y, ch) => { if (y >= t && y < bm) put(x, y, ch); };
          for (let i = 0; i < T; i++) top(x0 + b0 + i, y0, "_");
          for (const [col, r] of [[7, 1], [4, 2]]) {
            [..."__/"].forEach((ch, k) => top(x0 + col + k, y0 + r, ch));
            [..."\\__"].forEach((ch, k) => top(x0 + w - col - 3 + k, y0 + r, ch));
          }
          for (let r = 3; r < 10; r++) { top(x0 + 3, y0 + r, "|"); top(x0 + w - 4, y0 + r, "|"); }
        };
        arch(cx - 16, t, 33); arch(cx - 13, t + 1, 27);
      } else if (end === "door") {
        const dl = cx - 4, dr = cx + 4, dt = depth === 2 ? t + 1 : t + 2;
        for (let x = dl; x <= dr; x++) { put(x, dt - 1, "_"); put(x, bm, "_"); }
        for (let y = dt; y <= bm; y++) { put(dl, y, "|"); put(dr, y, "|"); }
        put(cx + 2, Math.floor((dt + bm) / 2), lock);   // a locked (or false) door shows a + knob; a sealed one an x
      }
      if (end === "terminal") {            // a small screen set into the wall
        const T = [".---------.", "| > _     |", "|  :: ::  |", "'---------'", "   [===]"], y0 = Math.max(t + 1, bm - 8);
        T.forEach((ln, j) => [...ln].forEach((ch, k) => { if (ch !== " ") put(cx - 5 + k, y0 + j, ch); }));
      }
      if (end === "stairs") {
        for (let j = 0; j < 4; j++) {
          const y = bm - 4 + j, w = 2 + j * 2;
          for (let x = cx - w; x <= cx + w; x++) put(x, y, "_");
          put(cx - w - 1, y, "|"); put(cx + w + 1, y, "|");
        }
      }
    }
    return c.map(row => row.join(""));
  }

  // THE DOOR WALL: two doors side by side in the wall ahead, drawn over the plain wall view. A locked door
  // shows a + knob, a sealed one an x, and one that stands open has no knob and a rounded top.
  function renderDoors(view, doors) {
    const c = view.map(r => r.split(""));
    const put = (x, y, t) => [...t].forEach((ch, k) => { if (x + k >= 0 && x + k < VW && y >= 0 && y < VH) c[y][x + k] = ch; });
    for (const d of doors) {
      const x0 = d.side === "L" ? 9 : 27;
      if (d.state === "open") { put(x0, 4, " _________ "); put(x0, 5, "/         \\"); }
      else { put(x0, 4, "___________"); put(x0, 5, "|         |"); }
      for (let y = 6; y <= 13; y++) put(x0, y, y === 13 ? "|_________|" : "|         |");
      if (d.state !== "open") put(x0 + 8, 9, d.state === "sealed" ? "x" : "+");
    }
    return c.map(r => r.join(""));
  }

  // LOOKING UP OR DOWN. Up ("U") there is no ceiling: the room is open to the night sky, with the real moon in
  // it at today's phase (moonIdx 0-7, lit on the right while waxing, like the block moon in the header). Down
  // ("D") is the floor, seen straight on, with the stairs in it once they have been found.
  function renderLook(which, stairs, moonIdx) {
    const c = Array.from({ length: VH }, () => Array(VW).fill(" "));
    const put = (x, y, t) => [...t].forEach((ch, k) => { if (x + k >= 0 && x + k < VW && y >= 0 && y < VH && ch !== " ") c[y][x + k] = ch; });
    for (let i = 0; i < 3; i++) { put(2 + i, i, "\\"); put(44 - i, i, "/"); put(2 + i, 16 - i, "/"); put(44 - i, 16 - i, "\\"); }
    if (which === "U") {
      // The broken rim of the walls, and the sky inside it.
      put(5, 2, "_ __ _   ___  _ __   _  __ ___  _ _ __"); put(5, 13, "__ _  __ _ ___   __ _  _ __  ___ _  __");
      for (const y of [3, 4, 6, 7, 9, 11, 12]) put(5, y, "|");
      for (const y of [3, 5, 6, 8, 9, 10, 12]) put(41, y, "|");
      for (const [x, y, ch] of [[9, 4, "."], [34, 4, "*"], [13, 7, "+"], [37, 8, "."], [8, 10, "*"], [31, 11, "."], [15, 12, "."], [36, 5, "."], [11, 5, "."], [33, 9, "+"]]) put(x, y, ch);
      // The moon: a disc five rows tall. Each cell is lit or dark by how far across the disc it sits.
      const k = (1 - Math.cos(moonIdx / 8 * 2 * Math.PI)) / 2, waxing = moonIdx <= 4, HALF = [3, 5, 6, 5, 3];
      HALF.forEach((h, j) => {
        const y = 6 + j, cx = 23;
        for (let x = -h; x <= h; x++) {
          const t = h ? x / h : 0, lit = moonIdx !== 0 && (waxing ? t >= 1 - 2 * k : t <= -(1 - 2 * k));
          c[y][cx + x] = lit ? "#" : (x === -h ? "(" : x === h ? ")" : j === 0 || j === 4 ? (j === 0 ? "_" : "'") : " ");
        }
      });
    } else {
      put(5, 2, "_".repeat(37)); put(5, 13, "_".repeat(37));
      for (let y = 3; y <= 13; y++) { put(5, y, "|"); put(41, y, "|"); }
      if (stairs) {
        // A lifted stone, and steps going down into the dark.
        [".___________________.", "|___________________|", "| |_______________| |", "| | |___________| | |",
          "| | | |_______| | | |", "|_|_|_|_______|_|_|_|"].forEach((t, j) => put(13, 5 + j, t));
      } else {
        // Tiles: a grid of seams.
        for (const y of [5, 8, 11]) for (let x = 8; x <= 38; x += 6) put(x, y, "+");
        for (const y of [5, 8, 11]) for (let x = 8; x < 38; x += 6) put(x + 2, y, "- -");
        for (const y of [6, 7, 9, 10]) for (let x = 8; x <= 38; x += 6) put(x, y, ":");
      }
    }
    return c.map(row => row.join(""));
  }

  // TIME. The game's clock is the server's real time when the page could get it (SMT.setSkew), else
  // the device's. Days roll over at midnight in the run's own timezone (st.tz, set when the run starts);
  // runs without one, and the /smt-screen chat run, use Honolulu.
  const HOME = "Pacific/Honolulu";
  let skew = 0, synced = false;
  const now = () => new Date(Date.now() + skew);
  const setSkew = ms => { skew = ms || 0; synced = true; };
  const trusted = () => synced;                    // true once the server's time is known
  const zone = () => (typeof window !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || HOME;
  const fmts = {};
  // How far the timezone is from UTC at that moment, in ms (follows daylight saving).
  function offsetMs(tz, date) {
    try {
      const f = fmts[tz] = fmts[tz] || new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const p = {}; for (const x of f.formatToParts(date)) p[x.type] = x.value;
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(date.getTime() / 1000) * 1000;
    } catch (e) { return -10 * 3600 * 1000; }
  }
  // The date and time on the wall clock in that timezone, as a Date read with getUTC*.
  const wall = (date, tz) => new Date(date.getTime() + offsetMs(tz || HOME, date));
  // A day number (days since 1970) counted in that timezone.
  const localDay = (date, tz) => Math.floor(wall(date, tz).getTime() / 86400000);
  const localISO = tz => wall(now(), tz).toISOString().slice(0, 10);

  const zoneName = (date, tz) => {
    try {
      const p = new Intl.DateTimeFormat("en-US", { timeZone: tz || HOME, timeZoneName: "short" }).formatToParts(date);
      return (p.find(x => x.type === "timeZoneName") || {}).value.replace(/^GMT$/, "UTC").slice(0, 9);
    } catch (e) { return "HST"; }
  };
  function hst(date, tz) {               // the run's local date and time
    const d = wall(date, tz);
    const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const p2 = n => String(n).padStart(2, "0");
    return {
      date: `${DAYS[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${d.getUTCFullYear()}`,
      kanji: "日月火水木金土"[d.getUTCDay()],                // the Japanese weekday
      time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
      zone: zoneName(date, tz),                              // HST, EDT, or GMT+9 where there's no short name
    };
  }

  // The moon's age in days since the last new moon, and its phase name, for the marker row.
  function moonNote(date) {
    const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
    let age = ((date.getTime() - ref) / 86400000) % syn; if (age < 0) age += syn;
    const names = ["new moon", "waxing crescent", "first quarter", "waxing gibbous", "full moon", "waning gibbous", "last quarter", "waning crescent"];
    return `The moon is day ${Math.floor(age) + 1}, ${names[moonIndex(date)]}.`;
  }

  function moonIndex(date) {
    const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853;
    let age = ((date.getTime() - ref) / 86400000) % syn;
    if (age < 0) age += syn;
    return Math.floor(age / syn * 8 + 0.5) % 8;
  }

  // SEASON EPOCH: a whole-number count of real lunar months since the same new-moon reference moonIndex
  // uses, so it advances on its own (no manual bump) and is identical for every player at every instant.
  // Unlike moonIndex (a repeating 0-7 phase), this only ever increases, so it can seed a month's shared content.
  function epochIndex(date) {
    const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853;
    return Math.floor((date.getTime() - ref) / 86400000 / syn);
  }

  // MOON QUARTERS: the month in four equal parts, counted without end from the same new moon as everything
  // else. A quarter is { n: its number since the reference, q: 0-3 within its month, epoch, end: the instant it
  // gives way to the next }. Each LEVEL of the pit belongs to one quarter: q 0 is the bottom (B4F), q 3 the last
  // level under the surface (B1F), and the dark takes a level when its quarter ends.
  const QREF = Date.UTC(2000, 0, 6, 18, 14), QLEN = 29.530588853 / 4 * 86400000;
  function quarterOf(date) { const n = Math.floor((date.getTime() - QREF) / QLEN); return quarter(n); }
  function quarter(n) { return { n, q: ((n % 4) + 4) % 4, epoch: Math.floor(n / 4), end: new Date(QREF + (n + 1) * QLEN) }; }
  // What the moon is doing when each quarter of the month ends.
  const QUARTER_END = ["the half moon", "the full moon", "the waning half moon", "the new moon"];

  // UTC-DAY: a whole-number calendar day, in UTC only (no timezone), so it is the same for every
  // player at every instant. The one thing players can locally differ on is WHEN they last checked it
  // (see rules.js's omen stamping) -- never on what the number itself is for any given moment.
  const utcDay = date => Math.floor(date.getTime() / 86400000);

  // Moon and demon lines by phase: line 1 before omens existed, and line 3 now and then.
  const MOONLINE_ALL = [
    [ // new
      "The sky is empty. Below, the demons hold their breath.", "No moon. The dark listens.",
      "Demons sleep with one eye open.", "A black sky. Even old hungers rest tonight.",
      "Something below would rather talk than bite."],
    [ // waxing crescent
      "A thin blade of light cuts the dark.", "Demons stir in their sleep.",
      "The moon opens one eye. The deep begins to wake.", "Something below turns over, restless.",
      "A pale hook hangs overhead. Claws flex in the dark."],
    [ // first quarter
      "Half the moon watches. Half the dark watches back.", "Demons pace the edges of the light.",
      "The light and the dark weigh each other.", "Patient eyes follow from the corners.",
      "Demons will listen, but not for long."],
    [ // waxing gibbous
      "The moon swells. So does something below.", "The halls hum with a low growl.",
      "Light pours in. Tempers rise to meet it.", "Demons scratch at the walls, impatient.",
      "Almost full. The deep grows loud."],
    [ // full
      "The moon is a white eye, wide open.", "Full light. The deep howls back.",
      "Demons run wild beneath the open moon.", "No bargains tonight. Only hunger.",
      "Every shadow has teeth."],
    [ // waning gibbous
      "The moon bleeds slowly. The fever lingers.", "The howling fades, but the anger stays.",
      "Demons nurse their fury in the dark.", "The white eye begins to close.",
      "Something below still remembers the light."],
    [ // last quarter
      "Half the moon turns away.", "Demons tire of the hunt.",
      "The dark grows heavy and slow.", "Tempers cool in the waning light.",
      "Some below may hear an offer now."],
    [ // waning crescent
      "A thin moon. The deep grows drowsy.", "Demons drowse in the corners.",
      "The light is almost gone. So is the anger.", "Only a sliver left. The dark softens.",
      "The new moon is coming. The deep can feel it."],
  ];

  const SMT_now = now;
  // The top box: moon phase/date header. Shared by the in-run screen and the title screen,
  // since both show the same moon/date strip — only what sits below it differs.
  function headerLines(omenText, tz, now) {
    now = now || SMT_now();
    const idx = moonIndex(now), when = hst(now, tz);
    const moons = ["(     )", "(    ))", "(  ))))", "())))))", "(((O)))", "((((())", "((((  )", "((    )"];
    const names = ["NEW", "CRESC", "HALF", "GIBB", "FULL", "GIBB", "HALF", "CRESC"];
    const long = ["NEW", "WAX CRESC", "1ST QTR", "WAX GIBB", "FULL", "WANE GIBB", "LAST QTR", "WANE CRESC"];
    // The block moon at the far left: 4 rows. Lit columns fill in from the right as it waxes and empty toward the left as it wanes (northern sky: waxing is lit on the right, waning on the left).
    const LIT = ["    ", "   ░", "  ▓▓", " ███", "████", "███ ", "▓▓  ", "░   "][idx];
    const box = [" ╭────╮ ", ` │${LIT}│ `, ` │${LIT}│ `, " ╰────╯ "];
    const BW = W - 2 - box[0].length;      // 70 columns to the right of the moon
    const bar = s => box[0] && center(s, BW);
    const head = ` MOON  ${idx}/8  ${long[idx]}`;
    // The Japanese weekday kanji sits left of the date. A kanji is two columns wide on screen.
    const tail = `${when.kanji} ${when.date}   ${when.time} ${when.zone}  `;
    const S = ["+" + "=".repeat(78) + "+", "|" + box[0] + head + " ".repeat(BW - head.length - tail.length - 1) + tail + "|"];
    S.push("|" + box[1] + bar(moons.map(m => center(m, 8)).join("")) + "|");
    S.push("|" + box[2] + bar(names.map(n => center(n, 8)).join("")) + "|");
    // The marker row also carries a short moon update ("The moon is day 25, waning crescent."),
    // placed on whichever side of the row the ^^^ marker isn't, so the two never touch.
    const marks = bar(moons.map((_, i) => center(i === idx ? "^^^" : "", 8)).join(""));
    // The marker row holds only the ^^^ (the moon's day and phase are a line 1 status report).
    // The day's omen, in quotes and left-justified: at the left edge when it clears the ^^^, otherwise just after it.
    const omenT = omenText ? '"' + omenText.replace(/^> "?/, "").replace(/"$/, "").slice(0, 30) + '"' : "";
    let row = marks.split("");
    if (omenT) {
      const at = marks.indexOf("^^^");
      const start = 1 + omenT.length <= at - 2 ? 1 : at + 5;
      row.splice(start, omenT.length, ...omenT);
    }
    S.push("|" + box[3] + row.join("") + "|");
    S.push("+" + "=".repeat(78) + "+");
    return S;
  }

  // Width check counts CJK characters (the weekday kanji) as two columns, as they show on screen.
  // A line that comes out the wrong width would break the borders. In tests that is an error; on the
  // page the inside of the line is trimmed or padded so the frame stays straight (and the game keeps going).
  // Shared by every frame builder (the in-run screen and the title screen) since both end the same way.
  function finishFrame(S) {
    const cols = t => [...t].reduce((n, ch) => n + (/[　-鿿＀-￯]/.test(ch) ? 2 : 1), 0);
    const strict = typeof module !== "undefined" && module.exports;
    for (let n = 0; n < S.length; n++) {
      const w = cols(S[n]);
      if (w === W) continue;
      if (strict) throw new Error(`bad width ${w}: ${S[n]}`);
      const line = S[n], inner = line.slice(1, -1);
      S[n] = line[0] + (w > W ? inner.slice(0, Math.max(0, inner.length - (w - W))) : inner + " ".repeat(W - w)) + line.slice(-1);
    }
    return S.join("\n");
  }

  function renderScreen(st, extra, now) {
    now = now || SMT_now(); extra = extra || "";
    const idx = moonIndex(now);
    const v = st.view;
    const view = v.look ? renderLook(v.look, v.stairs, idx)
      : v.end === "doors" ? renderDoors(renderView(v.left, v.right, "wall", 1, null), v.doors)
      : renderView(v.left, v.right, v.end, (v.end === "dark" || (v.end === "door" && v.lock)) ? 2 : 1, v.lock);
    // Look controls at the foot of the 3D view: [ < ] and [ > ] turn KURA to look around (never move her),
    // and the letter between them is what she faces: a compass wall, or U (the sky) or D (the floor).
    // The controls at the foot of the view, top to bottom: [ < LEFT ] and [ RIGHT > ] while the two doors ahead are
    // locked, then the action button with its word inside ([ SEARCH ]), then the turn
    // buttons with what she faces between them: a compass wall, U (the sky) or D (the floor).
    const overlay = (row, col, t) => { view[row] = view[row].slice(0, col) + t + view[row].slice(col + t.length); };
    overlay(VH - 1, 16, `[ < ]  ${st.look || st.facing || "?"}  [ > ]`);
    // The one "do the obvious thing" button, with its word inside the brackets: [ SEARCH ], [ CONSULT ], [ ENTER ].
    // While one of the two doors stands open, [ ENTER ] sits under that door, so this one goes back to a plain [ ^ ].
    const openSide = !v.look && (v.doors || []).some(x => x.state === "open" && x.side !== "C");
    const actBtn = `[ ${st.actLabel && !openSide ? String(st.actLabel).slice(0, 8) : "^"} ]`;
    overlay(VH - 2, 23 - Math.floor((actBtn.length - 1) / 2), actBtn);
    for (const x of (!v.look && v.doors) || []) {
      if (x.side === "C") continue;
      if (x.state === "locked") overlay(VH - 3, x.side === "L" ? 9 : 27, x.side === "L" ? "[ < LEFT ]" : "[ RIGHT > ]");
      else if (x.state === "open") overlay(VH - 3, x.side === "L" ? 9 : 28, "[ ENTER ]");      // the door she opened: its label becomes the way in
    }
    const r = s => "|" + ljust(s, W - 2) + "|";
    const rc = s => "|" + center(s, W - 2) + "|";
    const S = headerLines(st.omenText, st.tz, now);
    // Right panel is 29 characters wide: a leading space plus 28.
    const PW = 29, rule = " " + "-".repeat(PW - 1);
    // Name gets 9 columns, level 3, then HP and MP each as 3/3 digits, so high levels still fit.
    // Long demon names are shortened to 8 columns: CHROME HOUND -> C.HOUND, STATIC BANSHEE -> S.BANSHE
    const short = n => n.length <= 8 ? n : n.includes(" ") ? (n[0] + "." + n.split(" ").pop()).slice(0, 8) : n.slice(0, 8);
    // A status effect shows as a mark after the name: KURA* while she's TRIPPING.
    const mem = p => " " + ljust(short(p.name) + (p.status ? "*" : ""), 9) + ljust(`L${p.lv}`, 3) + " " +
      `${rjust(String(p.hp), 3)}/${rjust(String(p.hpmax), 3)} ${rjust(String(p.mp), 3)}/${rjust(String(p.mpmax), 3)}`;
    const party = st.party.map((p, i) => mem(i === 0 && st.playerName ? { ...p, name: String(st.playerName).toUpperCase() } : p)); while (party.length < 4) party.push("");
    // KURA is drawn on the minimap as an arrow showing the facing direction.
    const arrow = { N: "^", E: ">", S: "v", W: "<" }[st.facing] || "@";
    // The map area is 6 rows. An old 4-row map gets a blank row above and below;
    // the 3x3 room grid uses 5 rows under one blank row.
    const mapRows = st.map.length > 4 ? 5 : 4;
    // Old 4-row maps drew KURA as a facing arrow; the room grid keeps her as @ (FACE shows the way).
    const mp = st.map.slice(0, mapRows).map(m => mapRows === 4 ? m.replace("@", arrow) : m); while (mp.length < mapRows) mp.push("");
    // The room grid comes already laid out across the panel, centered on KURA.
    const mapPad = mapRows === 5 ? 0
      : Math.max(1, Math.floor((PW - Math.max(...mp.map(m => m.length))) / 2));
    const magStr = `ICHOR ${(st.ichor ?? st.mag ?? 0).toLocaleString("en-US")}`;
    const silverStr = ` SILVER ${(st.silver ?? st.macca ?? 0).toLocaleString("en-US")}`;
    // The ALIGN tag sits between SILVER and ICHOR: < on the LAW side or > on the CHAOS side only when the last
    // action pulled that way. Spaced out when there is room (< [NEU] >), tight when the amounts are big.
    const pull = st.pull || 0, aTag = String(st.align).slice(0, 3).toUpperCase();
    const gapN = PW - silverStr.length - magStr.length;
    const lA = pull < 0 ? "<" : " ", rA = pull > 0 ? ">" : " ";
    const tag = gapN >= 11 ? `${lA} [${aTag}] ${rA}` : gapN >= 9 ? `${lA}[${aTag}]${rA}` : "";
    const tagPad = Math.floor((gapN - tag.length) / 2);
    const money = silverStr + " ".repeat(tagPad) + tag + " ".repeat(gapN - tagPad - tag.length) + magStr;
    const WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    // Each floor is a real week: the header shows today's weekday (Honolulu), MON to SUN.
    const today = localDay(now, st.tz) + (st.clockOffset || 0);
    const wk = st.dungeon ? WEEK[(today + 3) % 7] : "";
    const title = ` MAP  ${st.floor}${wk ? "  " + wk : ""} `, dash = PW - 1 - title.length;
    const mapHead = " " + "-".repeat(Math.floor(dash / 2)) + title + "-".repeat(Math.ceil(dash / 2));
    // TURN counts every action KURA has taken (stepping, searching, turning); facing shows in the turn controls.
    // While KURA is tripping, the TURN counter shows what she thinks it is (st.turnShown).
    const face = `TURN ${String(Math.max(0, st.turnShown ?? st.steps ?? 0)).padStart(4, "0")}`, dayStr = `DAY ${String(st.day).padStart(2, "0")}`;
    // The room name sits first, then TURN, then DAY (11 characters fit).
    // The room name sits first (up to 11 characters, padded), then TURN and DAY at fixed spots, so they never shift with the name.
    const rname = String(st.roomName || "").toUpperCase().slice(0, 11).padEnd(11);
    const bottom = " " + rname + " " + face + " " + dayStr;
    // The moon strip: the eight phases as 3-column blocks (lit on the right while waxing), a . above today's.
    const PHASE = ["   ", "  ▓", " ▓█", "▓██", "███", "██▓", "█▓ ", "▓  "];
    // The dot sits over the middle of the lit part of today's cell (a half column right of the printed spot for the two quarters, which the page shifts).
    const DOT = [1, 2, 1, 1, 1, 1, 0, 0][idx];
    const phaseV = " ".repeat(3 + 3 * idx + DOT) + ".", phaseRow = "   " + PHASE.join("");
    const stat = [ljust(" PARTY", 19) + "HP" + " ".repeat(6) + "MP", rule, ...party.slice(0, 4),
      rule, money, mapHead, ...mp.map(m => " ".repeat(mapPad) + m), "", ...(mapRows === 4 ? [""] : []), rule, bottom];
    stat.splice(stat.length - 3, 3, phaseV, phaseRow, bottom);
    for (let i = 0; i < VH; i++) S.push("|" + ljust(view[i], 47) + "|" + ljust(stat[i] || "", 30) + "|");
    S.push("+" + "=".repeat(78) + "+");
    // The moon line: a mysterious word on the moon, the demons, or both. No numbers; the moon bar
    // above already shows the phase. Several lines per phase, changing once per real day.
    const MOONLINE = MOONLINE_ALL;
    const lines = MOONLINE[idx];
    // Picked by the real date, so it changes once a day, not with every action.
    const realDay = localDay(now, st.tz);
    // Line 1 is the day's omen when the rules provide one; otherwise the moon line.
    // Line 1 is the status report when the rules provide one; otherwise the moon line.
    const moonLine = st.status || "> " + lines[realDay % lines.length];
    // A question's [Y]ES [N]O sit at the right end of line 3, beside the question.
    const answers = "[Y]ES  [N]O  [S]ILENT";
    const line3 = st.question ? ljust(" " + extra.slice(0, 77 - answers.length - 1), 77 - answers.length) + answers + " " : " " + extra;
    for (const m of [" " + moonLine, " " + (st.log || ""), line3]) S.push(r(m));
    S.push("+" + "-".repeat(78) + "+");
    // Free actions on the left (unlimited, searching included); the day's one charge is spent with the [^]
    // button in the 3D view, and HOLD/RELEASE live in INVOKE with everything else that isn't always available.
    const free = " [F]IGHT [T]ALK [I]NVOKE [S]EARCH " + (st.look === "U" ? "LOOK_[D]OWN" : "LOOK_[U]P");   // looking: up to the sky, then down to the floor, then level
    S.push("|" + free + " ".repeat(78 - free.length) + "|");
    const sys = " [?] [L]OG [R]ESET ";                 // system buttons tucked into the bottom border
    // Save status sits in the bottom border too, so it never takes one of the three log lines.
    const status = st.unsaved ? " NOT SAVED " : st.saved ? ` SAVED ${st.saved} ` : "";
    S.push("+==" + status + "=".repeat(74 - status.length - sys.length) + sys + "==+");
    return finishFrame(S);
  }

  // TITLE SCREEN: reuses the real in-game frame's five zones with new content in each (see Part 11
  // of the design doc), rather than a layout of its own. `opts` is supplied entirely by the caller
  // (index.html) -- this function only formats what it's given; it fetches and schedules nothing.
  //   opts.tz, opts.now        -- same as renderScreen, drive the header and the WEEK/EPOCH math
  //   opts.omenText             -- today's shared omen (RULES.omen(SMT.utcDay()).text), for the header strip
  //   opts.lean                 -- { law, chaos } vote counts for the current epoch, or null if not loaded yet
  //   opts.cards                -- ordered array of single-line card strings for the sidebar ticker
  //   opts.cardOffset           -- which line of the (wrapped) card ticker is on top this frame
  function renderTitle(opts) {
    opts = opts || {};
    const now = opts.now || SMT_now();
    const S = headerLines(opts.omenText || "", opts.tz, now);
    // 3D-view slot: a static centered wordmark standing in for the dungeon view (nothing to wire up).
    const view = Array.from({ length: VH }, () => " ".repeat(VW));
    const put = (row, text) => { view[row] = center(text.slice(0, VW), VW); };
    put(6, "DAILY DIGITAL");
    put(7, "DEMON DUNGEON");
    put(9, "a daily dungeon crawl");
    // Sidebar: a pinned "RUMORS AND SECRETS" header (never scrolls) over an auto-advancing card ticker.
    const PW = 29, rule = " " + "-".repeat(PW - 1);
    const cards = opts.cards && opts.cards.length ? opts.cards : ["..."];
    // One blank line between every card (Part 11), so the ticker's real cycle length is 2x the card count.
    // A card longer than the sidebar wraps onto more lines at a space, never clipped mid-word.
    const wrap = c => { const out = []; let cur = "";
      for (const w of String(c).split(" ")) {
        if (cur && (cur + " " + w).length > PW - 1) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
        while (cur.length > PW - 1) { out.push(cur.slice(0, PW - 1)); cur = cur.slice(PW - 1); }
      }
      if (cur || !out.length) out.push(cur); return out; };
    const content = []; for (const c of cards) { for (const l of wrap(c)) content.push(ljust(" " + l, PW)); content.push(""); }
    const off = ((opts.cardOffset || 0) % content.length + content.length) % content.length;
    const windowH = VH - 2;        // the header + rule take the first two sidebar rows
    const ticker = Array.from({ length: windowH }, (_, i) => content[(off + i) % content.length]);
    const stat = [ljust(" RUMORS AND SECRETS", PW), rule, ...ticker];
    for (let i = 0; i < VH; i++) S.push("|" + ljust(view[i], 47) + "|" + ljust(stat[i] || "", 30) + "|");
    S.push("+" + "=".repeat(78) + "+");
    // Log box repurposed as cold, stable facts (WEEK/EPOCH/LEAN) that hold until the day rolls over.
    const r = s => "|" + ljust(s, W - 2) + "|";
    const label = (t, s) => ljust(t, 10) + s;
    for (const m of [" > " + label("LEVEL", weekLine(now, opts.tz)), " > " + label("EPOCH", epochLine(now)),
      " > " + label("LEAN", leanLine(opts.lean))]) S.push(r(m));
    S.push("+" + "-".repeat(78) + "+");
    // Menu bar: same bracket-letter convention as the real in-game action bar.
    const menu = " [N]EW RUN   [C]ONTINUE   [B]OARD   [?] ABOUT";
    S.push("|" + menu + " ".repeat(78 - menu.length) + "|");
    S.push("+" + "=".repeat(78) + "+");
    return finishFrame(S);
  }

  // This real week's floor, as everyone sees it (not a personal countdown to any one save's own
  // deadline) -- a floor always closes the coming Sunday, so there's nothing but calendar math here.
  function weekLine(now, tz) {
    // The level the dark has reached, and when it takes it: the day this quarter of the moon ends.
    const Q = quarterOf(now), left = localDay(Q.end, tz) - localDay(now, tz), DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const when = `${DAYS[wall(Q.end, tz).getUTCDay()]}, at ${QUARTER_END[Q.q]}`;
    // With under two days left, a run that starts now wakes one level up instead (see startSlot in rules.js).
    if (left < 2) return `B${4 - Q.q}F  -  closes ${left ? "tomorrow" : "tonight"}. New runs wake a level higher.`;
    return `B${4 - Q.q}F  -  ${left} days left, closes ${when}`;
  }
  // The current lunar epoch (same reference moonIndex/epochIndex use) and how far into its ~29.5
  // real days we are. Display rounds the epoch length down to a steady 29 for a clean "day X of 29".
  function epochLine(now) {
    const ref = Date.UTC(2000, 0, 6, 18, 14), syn = 29.530588853;
    const idx = epochIndex(now), into = (now.getTime() - ref) / 86400000 - idx * syn;
    const total = Math.floor(syn), day = Math.min(total, Math.floor(into) + 1), left = Math.max(0, total - day);
    return `epoch ${idx}, day ${day} of ${total}  -  new shape in ${left} day${left === 1 ? "" : "s"}`;
  }

  // The current epoch's LAW/CHAOS tally (Part 10's faction seasons), as a lean + a little bar.
  // `lean` is { law, chaos } fetched from the /season endpoint by the caller, or null before/if that load fails.
  function leanLine(lean) {
    const law = (lean && lean.law) || 0, chaos = (lean && lean.chaos) || 0, total = law + chaos;
    if (!total) return "no votes logged yet this epoch";
    const lawPct = Math.round((law / total) * 100), chaosPct = 100 - lawPct;
    const side = law === chaos ? "EVEN" : law > chaos ? "LAW" : "CHAOS";
    const BAR = 17, lead = Math.max(lawPct, chaosPct), filled = Math.round((lead / 100) * BAR);
    const bar = "|".repeat(filled) + ".".repeat(BAR - filled);
    return `this season leans ${side}   [${bar}]  ${lawPct} / ${chaosPct}`;
  }

  const api = { VERSION, moonNote, renderView, renderScreen, renderTitle, moonIndex, epochIndex, quarterOf, quarter, QUARTER_END, utcDay, now, setSkew, trusted, zone, localDay, localISO, get moonLines() { return MOONLINE_ALL; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SMT = api;
})(this);
