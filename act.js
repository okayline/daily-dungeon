// THE ACTION LIST (v1.19). Every way the page changes a run goes through apply(st, action), one entry per action.
// This is the list the Worker will run when the run moves to the server: the page will send { t, ...args } and get the
// run back. For now the page calls apply() itself, so nothing plays differently.
// An action is { t: "<type>", ... }. Unknown types throw, so a missing entry shows up at once instead of doing nothing.
(function (root) {
  const RULES = root.RULES || require("./rules.js");
  const n = v => (v === null || v === undefined ? null : Number(v));      // a picked slot, or null for "none"
  const ACTIONS = {
    // moving and looking
    search: st => RULES.search(st),
    go: (st, a) => RULES.go(st, a.dir),                         // N E S W
    turn: (st, a) => RULES.turn(st, a.dir),                     // L R U (U looks up, and back down)
    // a fight
    fight: st => RULES.fight(st),                             // (running is a "go" through runWay's door)
    // talking (alone, word() is the room or door read; see aura below)
    word: st => RULES.word(st),
    aura: st => RULES.word(st),                                 // (v1.19) was RULES.aura, which returns a reading, not a run
    answer: (st, a) => RULES.answer(st, !!a.yes),
    reply: (st, a) => RULES.reply(st, !!a.yes),
    // offers, trades, a full bag
    offerPick: (st, a) => RULES.offerPick(st, n(a.i)),
    offerTrade: (st, a) => RULES.offerTrade(st, n(a.i)),
    offerLeave: (st, a) => RULES.offerLeaveConfirm(st, !!a.yes),
    swap: (st, a) => RULES.swap(st, n(a.i)),
    keep: (st, a) => RULES.keepItem(st, n(a.i)),
    // the altar
    altarOpen: st => RULES.altarOpen(st),
    altarNext: st => RULES.altarNext(st),
    altarGive: (st, a) => RULES.altarGive(st, n(a.i)),
    // the bag
    useItem: (st, a) => RULES.useItem(st, a.name),
    giveIchor: (st, a) => RULES.giveIchor(st, Number(a.n) || 0),
    useSilver: st => RULES.useSilver(st),
    useBankedOmen: st => RULES.useBankedOmen(st),
    hold: st => RULES.hold(st),
    // shared things (the page fetches; the rules apply what came back)
    welcomeVisitor: (st, a) => RULES.welcomeVisitor(st, a.info),
    takeAway: (st, a) => RULES.takeAway(st, a.name),
    boxFound: (st, a) => RULES.boxFound(st, a.item, a.marks),
    boxDone: (st, a) => RULES.boxDone(st, !!a.ok, a.got === undefined ? null : a.got),
    boxCancel: st => { st = JSON.parse(JSON.stringify(st)); delete st.box; return st; },          // (v1.21) the box couldn't be reached
    roundClear: st => { st = JSON.parse(JSON.stringify(st)); delete st.round; delete st.roundOver; return st; },   // (v1.21) a fight's lines were read
    // the run itself
    tick: st => RULES.tick(st),
    reset: st => RULES.reset(st || {}),
    setName: (st, a) => RULES.setName(st, a.name),
    named: st => RULES.named(st),
    // admin tools (the page asks for the admin key first; on the server these will need the player's admin flag)
    freesteps: st => RULES.freesteps(st),                     // infinite steps on/off (marks the run)
    next: st => RULES.next(st),                               // jump the clock a day (marks the run)
  };
  const ADMIN = new Set(["freesteps", "next"]);
  // Running takes any way out, whichever way KURA faces: an open door first, a locked one (it takes the key) if that's
  // all there is. Null when there is no way out. (Moved here from the page in v1.19, so the server can make the roll.)
  function runWay(st) {
    const can = RULES.available(st), out = ["N", "E", "S", "W"].filter(d => can[d]), free = out.filter(d => !can.locked[d]);
    const pool = free.length ? free : out;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  function apply(st, a) {
    const f = a && ACTIONS[a.t];
    if (!f) throw new Error("unknown action: " + (a && a.t));
    return f(st, a);
  }
  // The page's old button names ("go-N", "opick-2", "altar-none", "yes", ...) as actions.
  function fromName(name) {
    const pick = (p, t) => (name.startsWith(p) ? { t, i: name === p + "none" ? null : Number(name.slice(p.length)) } : null);
    if (name === "yes" || name === "no") return { t: "answer", yes: name === "yes" };
    if (name === "left" || name === "right" || name === "look") return { t: "turn", dir: { left: "L", right: "R", look: "U" }[name] };
    if (name === "altar") return { t: "altarOpen" };
    if (name === "altar-next") return { t: "altarNext" };
    if (name.startsWith("oleave-")) return { t: "offerLeave", yes: name === "oleave-yes" };
    if (name.startsWith("go-")) return { t: "go", dir: name.slice(3) };
    return pick("opick-", "offerPick") || pick("otrade-", "offerTrade") || pick("swap-", "swap") || pick("altar-", "altarGive") || { t: name };
  }
  const api = { apply, fromName, runWay, ADMIN, types: Object.keys(ACTIONS), itemId: n => RULES.itemId(n), nameOf: id => RULES.nameOf(id) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ACT = api;
})(this);
