# Daily Digital Demon Dungeon

**Play it here: https://okayline.github.io/daily-dungeon/**

<img width="60%" alt="Daily Digital Demon Dungeon, build v0.77" src="screenshots/v0.77.png" />

An 80-column ASCII roguelike dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played one step a day on the real calendar. The real moon phase impacts gameplay in different ways.

## How it plays

- **Climb out.** You wake in the pit, on whichever level the dark has reached. Every level is one closer to the surface, and the moon is overhead the whole way. Past the surface, keep climbing.
- **One room a day.** Every room has two locked doors. Open one and the other seals for good. Step through and the door shuts behind you. Then wait for tomorrow.
- **Search all you like.** The walls and the floor hide things. Something else may notice.
- **Look up.** There's no ceiling, only the sky and the real moon. Ask her; some nights she answers.
- **Listen at the doors.** The two are side by side in the wall ahead, and each gives away a little of what's behind it.
- **Demons don't leave.** Fight them, talk to them, or run. Some want gifts. Some want to join you. Some are lying.
- **Your party has opinions.** Talk to them. Don't push your luck.
- **Every choice leans you.** LAW, NEUTRAL or CHAOS. The demons can tell.
- **The moon is real. So is the omen.** One omen a day, the same for everyone. Three LAW-leaning days or three CHAOS-leaning days in a row and something changes.
- **STANDBY can bank a day.** Hold instead of stepping and that day's omen is kept, to spend later instead of whatever the day brings.
- **Everyone faces the same choice.** The two rooms on offer each day are the same for every player this lunar month. Which door is which is yours alone.
- **The dark rises with the moon.** The pit is four levels deep, B4F at the bottom, and each quarter of the moon the dark takes one. A level's last room hides the way up. Be gone before the half moon, the full, the half, the new. Miss it and the run is over.
- **Don't drink the ichor.** Or do.

Your run saves itself in your browser. Finish a run and you can post it to the leaderboard. `[?]` explains the keys and holds the password (to move a run to another device) and the leaderboard. `[L]OG` keeps the story.

## Files

- `index.html` is the page: buttons, keys, popups, the in-browser save, and the `[?]` menu (password, codex, leaderboard).
- `screen.js` draws the 80-column screen and keeps the time. Every line is checked to be exactly 80 characters.
- `floor.js` rolls each floor: a short run of rooms, one a day, each built the moment its door is unlocked, with the stairs up hidden in a wall of the last one. It also draws the map of the path you took. The pair of rooms on offer each day is shared with every player this lunar month; which door is which, and what's hidden where, is rolled privately, per account.
- `rules.js` holds the rules.
- `leaderboard/` is the Cloudflare Worker + D1 leaderboard the page posts finished runs to — see its own README to set one up.
- `CHANGELOG.md` lists every update with its time and a screenshot.
- `screenshots/` holds a screenshot of each build (the page itself uses the VT323 font).
- `fonts/` holds the VT323 font the page uses, with its license (SIL Open Font License).
- `archive/` keeps retired pieces of the project, for history.
- `save.json` was the save file for the retired `/smt-screen` chat front end (see `archive/`); the page doesn't use it.
