// Rebuild items.js from the shared item list (dungeon-items, the master for every game's items).
//   node tools/sync-items.mjs                         fetch https://club.88x31.app/api/items?source=4dungeon&all=1
//   node tools/sync-items.mjs saved.json              or use a saved copy of that answer ({ items: [...] } or a bare list)
// Only 4Dungeon's own items (source "4dungeon") are written, in shared-id order, retired ones included (an old save may
// still hold one). The game reads items.js at load like any other script: nothing is fetched while playing.
// What an item DOES (the three uncommons with a use) stays in rules.js, keyed by the item's source_key.
import { readFileSync, writeFileSync } from "node:fs";

const URL_ = "https://club.88x31.app/api/items?source=4dungeon&all=1";
const arg = process.argv[2];
const data = arg ? JSON.parse(readFileSync(arg, "utf8")) : await (await fetch(URL_)).json();
const list = (Array.isArray(data) ? data : data.items).filter((i) => i.source === "4dungeon").sort((a, b) => a.id - b.id);
if (!list.length) throw new Error("no 4dungeon items in that answer");

const rows = list.map((i) => {
  const extra = typeof i.extra === "string" ? JSON.parse(i.extra) : i.extra || {};
  return { id: i.id, key: i.source_key, rarity: i.rarity.toUpperCase(), name: i.name, note: i.note, align: i.alignment, nature: i.nature,
    ...(extra.both_name ? { both: extra.both_name } : {}), ...(i.retired ? { retired: true } : {}) };
});
const out = `// GENERATED from the shared item list (dungeon-items) by tools/sync-items.mjs. Don't edit by hand: change the item
// in the shared list, then run the script. ${rows.length} items. Each: shared id, key (its place in 4Dungeon's tiers),
// rarity tier, name, note, alignment, nature, and the two-word name for a "both" item.
(function (root) {
  const ITEMS = ${JSON.stringify(rows, null, 0).replace(/},{/g, "},\n    {").replace(/^\[/, "[\n    ").replace(/\]$/, ",\n  ]")};
  if (typeof module !== "undefined" && module.exports) module.exports = ITEMS;
  else root.DD_ITEMS = ITEMS;
})(typeof window !== "undefined" ? window : globalThis);
`;
writeFileSync(new URL("../items.js", import.meta.url), out);
console.log("items.js:", rows.length, "items");
