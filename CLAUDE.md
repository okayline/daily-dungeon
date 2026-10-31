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
- A release bumps `VERSION` in `screen.js` and `data-version` on the footer script in `index.html` (both say v1.44 now) and adds an entry at the top of `CHANGELOG.md`. No test checks that these match, so check by hand.
- This `CHANGELOG.md` is public and vague on purpose: no odds, no hidden mechanics, no room names. The detailed entry goes in `CHANGELOG.md` in the private dungeon-notes repo.
- Commits named `Day NNN ...` are save commits (the adventure log), not releases. Don't list them in the changelog.
- Treat a push to `main` as a release: the page and the Worker are built from this repo.

**Other things depend on this repo**
- clutch-feed-tilt copies the moon quarter (`QREF`, `QLEN` in `screen.js`) and `hash`, `seedFrom` and the level names (`rules.js`). irl-dungeon keeps trimmed copies of `floor.js` and `screen.js`. A change to those means copying it over (their CLAUDE.md files say how).
- dungeon-items extracts its starting item data from `rules.js` and treats this repo as read only.
- The bots in dungeon-notes clone this repo's latest `main` (and a pinned older build) every day. Renaming or removing something `rules.js` exports can crash them; the 2026-10-31 bot summary already shows `TypeError: R.setName is not a function`.
- The footer is the shared one from dungeon-items (`footer.js`).

<!-- BEGIN SHARED RULES v7 (2026-10-31). One copy of this block is in every Dungeons repo's CLAUDE.md. The source is dungeon-notes/SHARED-RULES.md. Don't edit the block inside a repo: change the source, then copy it into every repo. -->
## Working rules (shared by every repo)

"kura" is the owner. "4Dungeon" is the repo `daily-dungeon`. Other Claude chats work in these repos and share no memory with you: the repo and its changelog are the shared record. A repo section above beats a rule below, except rules 1 to 4.

**Honesty (never broken)**
1. Never lie. State as fact only what you opened, read or ran this turn; the rest is "not checked", or isn't said. Label opinions "my opinion". "Should work" and "probably" count as not checked.
2. Answers about code or data end with "Not checked:".
3. Check first, then reply once. If you were wrong, the first sentence says what you said, what is true, and the source.
4. Never say something was done, pushed or fixed unless you saw it succeed. Report failures plainly.

**Searching**
5. Before saying "no", or recommending something new, search the chat (if you can reach it), every repo you can reach, and the live state. Say what you searched and what you found. Say "I couldn't find it", never "that isn't true". If kura remembers something you can't find, don't call kura wrong, and don't state it as fact.

**Design**
6. Give honest answers, including "this isn't worth building". Give one recommendation. Never tell kura to playtest the game.
7. Before proposing, name the goal it serves (4Dungeon: `dungeon-notes/daily-dungeon-design.md`, section 15) and how it would most likely fail. No goal, no proposal. Propose the smallest version first.

**Building**
8. Commit locally as asked. Push only when kura says to. "Push" means: commit everything that's changed and push it all to `main` (in repos that deploy from `main`, that is also the release).
9. Don't add anything kura didn't ask for (a button, a screen, a page, a feature), change tables or scheduled tasks, or add a dependency: ask first.
10. Delete, don't park: no new flags or "off for now" code. Fix a shared problem once, in the shared place. Prefer changing what exists to adding a file. Each changelog line says what was removed as well as what was added.
11. No new secrets (passwords, tokens, keys such as `DAILY_SECRET`) in files, commits or replies. If you find one already committed, tell kura, and don't repeat it.

**Working with kura**
12. Don't act without kura's explicit permission. A question gets an answer, not an action: "Can you remove that rule?" is a request; "What happens if we remove that rule?" is a question. If you can't tell which, answer, then ask "want me to do it?" and wait. Reading and searching to find the answer is fine.
13. Disagree before building, not after. Silence means "not now": raise each item once.

**Defaults**
- Testing takes 2 to 3 minutes in total, with no edge cases. A repo's required check (such as `npm test`) counts toward that. Need more? Ask first.
- Times are Hawaii time (HST) unless a file says otherwise (88x31-anchors receipts are UTC).
- Some repos get automated commits: fetch before you push.
<!-- END SHARED RULES v7 -->
