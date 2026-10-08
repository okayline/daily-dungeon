// Renders the 80-column SMT daily dungeon screen from a save object.
// Shared by the web page (index.html) and node (for testing).
(function (root) {
  // The build number: bumped with every release, so About and the changelog always match.
  const VERSION = "v0.49";
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
  function renderScreen(st, extra, now) {
    now = now || SMT_now(); extra = extra || "";
    const idx = moonIndex(now), when = hst(now, st.tz);
    const v = st.view;
    const view = renderView(v.left, v.right, v.end, (v.end === "dark" || (v.end === "door" && v.lock)) ? 2 : 1, v.lock);
    // Look controls at the foot of the 3D view: [<] and [>] turn KURA to look around (never move her),
    // and the letter between them is the way she faces. Moving is N/S/E/W in the menu.
    const overlay = (row, col, t) => { view[row] = view[row].slice(0, col) + t + view[row].slice(col + t.length); };
    overlay(VH - 1, 18, `[<]  ${st.facing || "?"}  [>]`);
    overlay(VH - 2, 20, "[  ^  ]");          // the day's step: forward, the way KURA faces
    const moons = ["(     )", "(    ))", "(  ))))", "())))))", "(((O)))", "((((())", "((((  )", "((    )"];
    const names = ["NEW", "CRESC", "HALF", "GIBB", "FULL", "GIBB", "HALF", "CRESC"];
    const long = ["NEW", "WAX CRESC", "1ST QTR", "WAX GIBB", "FULL", "WANE GIBB", "LAST QTR", "WANE CRESC"];
    const r = s => "|" + ljust(s, W - 2) + "|";
    const rc = s => "|" + center(s, W - 2) + "|";
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
    const omenT = st.omenText ? '"' + st.omenText.replace(/^> "?/, "").replace(/"$/, "").slice(0, 30) + '"' : "";
    let row = marks.split("");
    if (omenT) {
      const at = marks.indexOf("^^^");
      const start = 1 + omenT.length <= at - 2 ? 1 : at + 5;
      row.splice(start, omenT.length, ...omenT);
    }
    S.push("|" + box[3] + row.join("") + "|");
    S.push("+" + "=".repeat(78) + "+");
    // Right panel is 29 characters wide: a leading space plus 28.
    const PW = 29, rule = " " + "-".repeat(PW - 1);
    // Name gets 9 columns, level 3, then HP and MP each as 3/3 digits, so high levels still fit.
    // Long demon names are shortened to 8 columns: CHROME HOUND -> C.HOUND, STATIC BANSHEE -> S.BANSHE
    const short = n => n.length <= 8 ? n : n.includes(" ") ? (n[0] + "." + n.split(" ").pop()).slice(0, 8) : n.slice(0, 8);
    // A status effect shows as a mark after the name: KURA* while she's TRIPPING.
    const mem = p => " " + ljust(short(p.name) + (p.status ? "*" : ""), 9) + ljust(`L${p.lv}`, 3) + " " +
      `${rjust(String(p.hp), 3)}/${rjust(String(p.hpmax), 3)} ${rjust(String(p.mp), 3)}/${rjust(String(p.mpmax), 3)}`;
    const party = st.party.map(mem); while (party.length < 4) party.push("");
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
    const rname = String(st.roomName || "").toUpperCase().slice(0, 11), rgap = PW - 1 - rname.length - face.length - dayStr.length;
    const bottom = " " + rname + " ".repeat(Math.max(1, Math.ceil(rgap / 2))) + face + " ".repeat(Math.max(1, Math.floor(rgap / 2))) + dayStr;
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
    // Free actions on the left (unlimited, searching included); the day's one step on the right.
    // The day's step is the [^] button in the 3D view now; the right side waits for answers ([Y]ES [N]O, later).
    // While a party member's question is open, [Y]ES and [N]O take STA[N]DBY's place at the right end of this bar
    // (nothing else can be done until it's answered anyway), so the log lines above keep their full width.
    const free = " [F]IGHT [T]ALK [I]NVOKE [S]EARCH", cell = `CELL [${(st.today || {}).stepped && !st.freeSteps ? " " : "#"}][${st.spare > 0 ? "+" : " "}]`,   // today's charge, and a stored spare
      daily = cell.padEnd(15) + "STA[N]DBY ";
    S.push("|" + free + " ".repeat(78 - free.length - daily.length) + daily + "|");
    const sys = " [?] [L]OG [R]ESET ";                 // system buttons tucked into the bottom border
    // Save status sits in the bottom border too, so it never takes one of the three log lines.
    const status = st.unsaved ? " NOT SAVED " : st.saved ? ` SAVED ${st.saved} ` : "";
    S.push("+==" + status + "=".repeat(74 - status.length - sys.length) + sys + "==+");
    // Width check counts CJK characters (the weekday kanji) as two columns, as they show on screen.
    const cols = t => [...t].reduce((n, ch) => n + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 2 : 1), 0);
    // A line that comes out the wrong width would break the borders. In tests that is an error; on the page the
    // inside of the line is trimmed or padded so the frame stays straight (and the game keeps going).
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

  const api = { VERSION, moonNote, renderView, renderScreen, moonIndex, now, setSkew, trusted, zone, localDay, localISO, get moonLines() { return MOONLINE_ALL; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SMT = api;
})(this);
