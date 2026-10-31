# daily-dungeon (4Dungeon): working notes

## This repo

Daily Digital Demon Dungeon, "4Dungeon": an 80-column ASCII dungeon crawler played on the real lunar calendar. Public repo, live at dungeon.88x31.app. This is the master copy of the game's rules, and other repos copy from it.

**Layout** (the README has the full list)
- `index.html` is the page and its menus. `screen.js` draws the 80-column screen and keeps time, and holds `VERSION`. `floor.js` rolls the levels and the minimap. `rules.js` is the rules. `act.js` is every action on a run. `sky.js` is the night sky.
- `items.js` is generated from the shared item table in dungeon-items by `tools/sync-items.mjs`. Don't edit it by hand.
- `leaderboard/` is the Cloudflare Worker and D1 database behind the board, accounts and the server-side run (`game.js`). Its own README covers setup.
- `wrangler.toml` sits at the repo root on purpose (Workers Builds needs it there). It serves the game files as assets plus the Worker in `leaderboard/worker.js`.
- `archive/` and `screenshots/` are history. Leave them alone.

**Testing.** `npm test` runs `node --test leaderboard/test/*.test.mjs`. Those are the only tests in the repo, so nothing automated covers `rules.js`, `floor.js` or the page.

**Releases**
- A release bumps `VERSION` in `screen.js` and `data-version` on the footer script in `index.html` and adds an entry at the top of `CHANGELOG.md`. No test checks that these match, so check by hand.
- This `CHANGELOG.md` is public and vague on purpose: no odds, no hidden mechanics, no room names. The detailed entry goes in `CHANGELOG.md` in the private dungeon-notes repo.
- Commits named `Day NNN ...` are save commits (the adventure log), not releases. Don't list them in the changelog.
- Treat a push to `main` as a release: the page and the Worker are built from this repo.

**Other things depend on this repo**
- clutch-feed-tilt copies the moon quarter (`QREF`, `QLEN` in `screen.js`) and `hash`, `seedFrom` and the level names (`rules.js`). irl-dungeon keeps trimmed copies of `floor.js` and `screen.js`. A change to those means copying it over (their CLAUDE.md files say how).
- dungeon-items extracts its starting item data from `rules.js` and treats this repo as read only.
- The bots in dungeon-notes clone this repo's latest `main` (and a pinned older build) every day. Renaming or removing something `rules.js` exports can crash them.
- The footer is the shared one from dungeon-items (`footer.js`).
