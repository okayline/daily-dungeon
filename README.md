# Daily Digital Demon Dungeon

**Play it here: https://okayline.github.io/daily-dungeon/**

<img width="60%" alt="Daily Digital Demon Dungeon, build v0.99.1" src="screenshots/v0.99.1.png" />

An 80-column ASCII roguelike dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played one key a day on the real calendar. The real moon phase impacts gameplay in different ways.

## How it plays

- **Climb out.** KURA wakes at the bottom of a pit four levels deep (B4F, B3F, B2F, B1F) and climbs toward the surface. There is no ceiling: look up and it's the night sky and the real moon. Past the surface, keep climbing.
- **The dark rises with the moon.** Each quarter of the lunar month the dark takes one level. Be gone before it takes yours, or the run is over. A level's last wing hides the way up.
- **One key a day.** Spend it to unlock a door, or go on STANDBY and rest. Everything else (searching, turning, talking, walking through doors you've already opened) is free of the key.
- **Wings and doors.** A level is a run of wings, one offer a day. Each wing hangs two locked doors off its rooms. Unlock one and the other seals for good.
- **Search all you like,** but searching tires KURA. Her breath shows on the moon strip under the map: spend it too fast and she has to stop and recover, and pressing on only makes the wait longer. Something else may notice you, too.
- **Listen at the doors.** Each gives away a little of what's behind it.
- **Ask the moon.** Look up and ask her. Some nights she answers.
- **Demons don't leave.** Fight them, talk to them, or run. Some want gifts. Some want to join you. Some are lying.
- **Your party has opinions.** Talk to them. Don't push your luck. Mixed company wears on tempers.
- **Every choice leans you.** LAW, NEUTRAL or CHAOS. The demons can tell.
- **The moon is real. So is the omen.** One omen a day, the same for everyone. Three LAW-leaning days or three CHAOS-leaning days in a row and something changes.
- **STANDBY can bank a day.** Hold instead of stepping and that day's omen is kept, to spend later instead of whatever the day brings.
- **Everyone is in the same pit.** Everyone playing in the same moon quarter is on the same level, and the rooms on offer each day are the same for every player. Which door is which, and what's hidden where, is yours alone. The title screen carries rumors and counts from everyone else, and finished runs can be posted to the board.
- **Don't drink the ichor.** Or do.

The header counts the lunar day (1 to 29) and names today's phase in Japanese, and the title carries a crescent over the lettering.

Your run saves itself in your browser. Finish a run and you can post it to the leaderboard. `[?]` explains the keys and holds the password (to move a run to another device) and the leaderboard. `[L]OG` keeps the story.

## Files

- `index.html` is the page: buttons, keys, popups, the typed log line, the title screen, the in-browser save, and the `[?]` menu (password, codex, leaderboard).
- `screen.js` draws the 80-column screen and keeps the time. Every line is checked to be exactly 80 characters.
- `floor.js` rolls each level: its wings, their rooms and doors, and the stairs up hidden in the last wing. It also draws the minimap. The level's shape and the pair of rooms on offer each day are shared with every player this lunar month; which door is which, and what's hidden where, is rolled privately, per account.
- `rules.js` holds the rules.
- `leaderboard/` is the Cloudflare Worker + D1 leaderboard the page posts finished runs, events and presence to, and reads the title's feed from. See its own README to set one up.
- `CHANGELOG.md` lists every update with its time and a screenshot.
- `screenshots/` holds a screenshot of each build (the page itself uses the VT323 font).
- `fonts/` holds the VT323 font the page uses, with its license (SIL Open Font License).
- `archive/` keeps retired pieces of the project, for history.
- `save.json` was the save file for the retired `/smt-screen` chat front end (see `archive/`); the page doesn't use it.
