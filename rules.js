// Placeholder "rules" for the daily dungeon: reroll the game with random values, or reset the run.
// Shared by the web page (buttons) and node. Nothing here is real game logic yet.
(function (root) {
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const NAME = { N: "NORTH", E: "EAST", S: "SOUTH", W: "WEST" };

  // A random minimap: up stairs, a trail of cleared rooms, KURA (@ becomes the facing arrow),
  // a door or two into the dark, and the distant ? somewhere above.
  function randomMap() {
    const trail = R(1, 5);
    let row = "⋰↑" + "-□".repeat(trail - 1) + "-@";
    const exits = [];
    if (Math.random() < 0.7) { row += "-"; exits.push("E"); }
    const at = row.length - (exits.length ? 2 : 1);
    const below = Math.random() < 0.5 ? " ".repeat(at) + "|" : "";
    if (below) exits.push("S");
    if (!exits.length) exits.push("N");
    const pad = Math.max(0, 12 - at);
    const goal = " ".repeat(Math.min(24, at + pad + R(3, 10))) + "?";
    return { map: [goal, "", " ".repeat(pad) + row, below ? " ".repeat(pad) + below : ""], exits };
  }

  const roll = p => ({ ...p, hp: R(Math.ceil(p.hpmax / 4), p.hpmax), mp: p.mpmax ? R(0, p.mpmax) : 0 });

  function reset(st) {
    return Object.assign({}, st, {
      day: 1, floor: "B1F", align: "NEUTRAL", macca: 0, mag: 0, facing: "E",
      party: [
        { name: "KURA", lv: 1, hp: 30, hpmax: 30, mp: 8, mpmax: 8 },
        { name: "ELF", lv: 1, hp: 22, hpmax: 22, mp: 14, mpmax: 14 },
        { name: "PIXIE", lv: 1, hp: 18, hpmax: 18, mp: 12, mpmax: 12 },
        { name: "CU SITH", lv: 1, hp: 26, hpmax: 26, mp: 4, mpmax: 4 }],
      map: ["                ?", "", "          ⋰↑-@-", ""],
      view: { left: [true, true], right: [true, true], end: "dark" },
      log: "> Day 1. KURA descends into B1F. The run begins.",
      extra: "> NEW RUN. Not saved.",
    });
  }

  function next(st) {
    const m = randomMap();
    const day = st.day + 1;
    return Object.assign({}, st, {
      day, facing: pick(["N", "E", "S", "W"]), map: m.map,
      party: st.party.map(roll),
      macca: st.macca + R(0, 150), mag: st.mag + R(0, 30),
      view: { left: [Math.random() < 0.6, Math.random() < 0.7], right: [Math.random() < 0.6, Math.random() < 0.7],
        end: pick(["dark", "dark", "wall", "door", "stairs"]) },
      log: `> Day ${day}. KURA enters a new room. Exits: ${m.exits.map(d => NAME[d]).join(", ")}.`,
      extra: "> REROLLED. Not saved.",
    });
  }

  const api = { next, reset };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RULES = api;
})(this);
