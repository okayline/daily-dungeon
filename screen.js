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

  function renderScreen(st, extra, now) {
    now = now || new Date(); extra = extra || "";
    const idx = moonIndex(now), when = hst(now);
    const v = st.view;
    const view = renderView(v.left, v.right, v.end, (v.end === "dark" || v.end === "door") ? 2 : 1);
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
    const mem = p => " " + ljust(p.name, 8) + ljust(`L${p.lv}`, 4) + "  " +
      `${rjust(String(p.hp), 3)}/${rjust(String(p.hpmax), 3)}  ${rjust(String(p.mp), 2)}/${rjust(String(p.mpmax), 2)}`;
    const party = st.party.map(mem); while (party.length < 4) party.push("");
    // KURA is drawn on the minimap as an arrow showing the facing direction.
    const arrow = { N: "^", E: ">", S: "v", W: "<" }[st.facing] || "@";
    const mp = st.map.slice(0, 4).map(m => m.replace("@", arrow)); while (mp.length < 4) mp.push("");
    const mapPad = Math.max(1, Math.floor((PW - Math.max(...mp.map(m => m.length))) / 2));
    const magStr = `MAG ${st.mag.toLocaleString("en-US")}`;
    const money = ljust(` MACCA ${st.macca.toLocaleString("en-US")}`, PW - magStr.length) + magStr;
    const title = ` MAP  ${st.floor} `, dash = PW - 1 - title.length;
    const mapHead = " " + "-".repeat(Math.floor(dash / 2)) + title + "-".repeat(Math.ceil(dash / 2));
    const align = `ALIGN [${String(st.align).slice(0, 3).toUpperCase()}]`;
    const face = `FACE ${st.facing || "?"}`, dayStr = `DAY ${String(st.day).padStart(3, "0")}`;
    const gap = PW - 1 - align.length - face.length - dayStr.length;
    const bottom = " " + align + " ".repeat(Math.floor(gap / 2)) + face + " ".repeat(Math.ceil(gap / 2)) + dayStr;
    const stat = [ljust(" PARTY", 20) + "HP" + " ".repeat(5) + "MP", rule, ...party.slice(0, 4),
      rule, money, mapHead, "", ...mp.map(m => " ".repeat(mapPad) + m), "", rule, bottom];
    for (let i = 0; i < VH; i++) S.push("|" + ljust(view[i], 47) + "|" + ljust(stat[i] || "", 30) + "|");
    S.push("+" + "=".repeat(78) + "+");
    const moonmsg = ["> NEW MOON. Demons are calm. Negotiation is favorable.", "> MOON 1/8. Demons begin to stir.",
      "> MOON 2/8. Demons are wary but will listen.", "> MOON 3/8. Demons grow restless.",
      "> FULL MOON. Demons will not negotiate.", "> MOON 5/8. Demons are still agitated.",
      "> MOON 6/8. Demons grow calmer.", "> MOON 7/8. Demons are docile. The new moon nears."];
    for (const m of [moonmsg[idx], st.log || "", extra]) S.push(r(" " + m));
    S.push("+" + "-".repeat(78) + "+");
    S.push(r(" [F]IGHT [T]ALK [S]UMMON [I]TEM [M]AGIC [C]OMP [E]QUIP [G]O"));
    S.push("+" + "=".repeat(78) + "+");
    for (const line of S) if (line.length !== W) throw new Error(`bad width ${line.length}: ${line}`);
    return S.join("\n");
  }

  const api = { renderScreen, moonIndex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SMT = api;
})(this);
