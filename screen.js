// Renders the 80-column SMT daily dungeon screen from a save object.
// Shared by the web page (index.html) and node (for testing).
(function (root) {
  const W = 80, VW = 47, VH = 17, OFF = [0, 3, 6];
  const L_ = o => 2 + o, R_ = o => 44 - o;
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, Math.max(n, s.length));
  const ljust = (s, n) => s.length >= n ? s : s + " ".repeat(n - s.length);
  const rjust = (s, n) => s.length >= n ? s : " ".repeat(n - s.length) + s;
  const center = (s, n) => {           // matches Python str.center
    if (s.length >= n) return s;
    const total = n - s.length;
    let left = Math.floor(total / 2);
    if (total % 2 === 1 && n % 2 === 1) left += 1;
    return " ".repeat(left) + s + " ".repeat(total - left);
  };

  function renderView(left, right, end, depth) {
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
          for (let x = xa; x <= xb; x++) { put(x, b - 1, "_"); put(x, 16 - b, "_"); }
          for (let y = b; y < 17 - b; y++) put(side === "L" ? xa : xb, y, "|");
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
      if (end === "door") {
        const dl = cx - 4, dr = cx + 4, dt = depth === 2 ? t + 1 : t + 2;
        for (let x = dl; x <= dr; x++) { put(x, dt - 1, "_"); put(x, bm, "_"); }
        for (let y = dt; y <= bm; y++) { put(dl, y, "|"); put(dr, y, "|"); }
        put(cx + 2, Math.floor((dt + bm) / 2), "o");
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

  function hst(date) {                   // Honolulu is UTC-10 year round
    const d = new Date(date.getTime() - 10 * 3600 * 1000);
    const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const p2 = n => String(n).padStart(2, "0");
    return {
      date: `${DAYS[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${d.getUTCFullYear()}`,
      time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
    };
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

  function renderScreen(st, extra, now) {
    now = now || new Date(); extra = extra || "";
    const idx = moonIndex(now), when = hst(now);
    const v = st.view;
    const view = renderView(v.left, v.right, v.end, (v.end === "dark" || v.end === "door") ? 2 : 1);
    // Look controls at the foot of the 3D view: [<] and [>] turn KURA to look around (never move her),
    // and the letter between them is the way she faces. Moving is N/S/E/W in the menu.
    const overlay = (row, col, t) => { view[row] = view[row].slice(0, col) + t + view[row].slice(col + t.length); };
    overlay(VH - 1, 18, `[<]  ${st.facing || "?"}  [>]`);
    const moons = ["(     )", "(    ))", "(  ))))", "())))))", "(((O)))", "((((())", "((((  )", "((    )"];
    const names = ["NEW", "CRESC", "HALF", "GIBB", "FULL", "GIBB", "HALF", "CRESC"];
    const long = ["NEW", "WAX CRESC", "1ST QTR", "WAX GIBB", "FULL", "WANE GIBB", "LAST QTR", "WANE CRESC"];
    const r = s => "|" + ljust(s, W - 2) + "|";
    const rc = s => "|" + center(s, W - 2) + "|";
    const head = `  MOON  ${idx}/8  ${long[idx]}`;
    const tail = `${when.date}   ${when.time}  `;
    const S = ["+" + "=".repeat(78) + "+", r(head + " ".repeat(78 - head.length - tail.length) + tail)];
    S.push(rc(moons.map(m => center(m, 9)).join("")));
    S.push(rc(names.map(n => center(n, 9)).join("")));
    S.push(rc(moons.map((_, i) => center(i === idx ? "^^^" : "", 9)).join("")));
    S.push("+" + "=".repeat(78) + "+");
    // Right panel is 29 characters wide: a leading space plus 28.
    const PW = 29, rule = " " + "-".repeat(PW - 1);
    // Name gets 9 columns, level 3, then HP and MP each as 3/3 digits, so high levels still fit.
    const mem = p => " " + ljust(p.name, 9) + ljust(`L${p.lv}`, 3) + " " +
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
    const money = ljust(` SILVER ${(st.silver ?? st.macca ?? 0).toLocaleString("en-US")}`, PW - magStr.length) + magStr;
    const WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    // Each floor is a real week: the header shows today's weekday (Honolulu), MON to SUN.
    const today = Math.floor((now.getTime() - 10 * 3600 * 1000) / 86400000) + (st.clockOffset || 0);
    const wk = st.dungeon ? WEEK[(today + 3) % 7] : "";
    const title = ` MAP  ${st.floor}${wk ? "  " + wk : ""} `, dash = PW - 1 - title.length;
    const mapHead = " " + "-".repeat(Math.floor(dash / 2)) + title + "-".repeat(Math.ceil(dash / 2));
    const align = `ALIGN [${String(st.align).slice(0, 3).toUpperCase()}]`;
    // TURN counts every action KURA has taken (stepping, searching, turning); facing shows in the turn controls.
    const face = `TURN ${String(st.steps || 0).padStart(3, "0")}`, dayStr = `DAY ${String(st.day).padStart(3, "0")}`;
    const gap = PW - 1 - align.length - face.length - dayStr.length;
    const bottom = " " + align + " ".repeat(Math.floor(gap / 2)) + face + " ".repeat(Math.ceil(gap / 2)) + dayStr;
    const stat = [ljust(" PARTY", 19) + "HP" + " ".repeat(6) + "MP", rule, ...party.slice(0, 4),
      rule, money, mapHead, "", ...mp.map(m => " ".repeat(mapPad) + m), ...(mapRows === 4 ? [""] : []), rule, bottom];
    for (let i = 0; i < VH; i++) S.push("|" + ljust(view[i], 47) + "|" + ljust(stat[i] || "", 30) + "|");
    S.push("+" + "=".repeat(78) + "+");
    // The moon line: a mysterious word on the moon, the demons, or both. No numbers; the moon bar
    // above already shows the phase. Several lines per phase, changing once per real day.
    const MOONLINE = MOONLINE_ALL;
    const lines = MOONLINE[idx];
    // Picked by the real date (Honolulu), so it changes once a day, not with every action.
    const realDay = Math.floor((now.getTime() - 10 * 3600 * 1000) / 86400000);
    // Line 1 is the day's omen when the rules provide one; otherwise the moon line.
    const moonLine = st.omenText || "> " + lines[realDay % lines.length];
    for (const m of [moonLine, st.log || "", extra]) S.push(r(" " + m));
    S.push("+" + "-".repeat(78) + "+");
    // Free actions on the left (unlimited, searching included); the day's one step on the right.
    const free = " [F]IGHT [T]ALK [I]NVOKE SE[A]RCH", daily = "| [N]ORTH [S]OUTH [E]AST [W]EST ";
    S.push("|" + free + " ".repeat(78 - free.length - daily.length) + daily + "|");
    const sys = " [L]OG [B]ACKUP [R]ST ";                 // system buttons tucked into the bottom border
    // Save status sits in the bottom border too, so it never takes one of the three log lines.
    const status = st.unsaved ? " NOT SAVED " : st.saved ? ` SAVED ${st.saved} ` : "";
    S.push("+==" + status + "=".repeat(74 - status.length - sys.length) + sys + "==+");
    for (const line of S) if (line.length !== W) throw new Error(`bad width ${line.length}: ${line}`);
    return S.join("\n");
  }

  const api = { renderScreen, moonIndex, get moonLines() { return MOONLINE_ALL; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SMT = api;
})(this);
