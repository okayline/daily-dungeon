# Daily Dungeon

**Play it here: https://okayline.github.io/daily-dungeon/**

<img width="60%" alt="Daily Dungeon, build v0.28" src="screenshots/v0.28.png" />

An 80-column ASCII roguelike dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played one step a day on the real calendar. The real moon phase impacts gameplay in different ways.

## How it plays

- **One step a day.** `[^]` in the 3D view walks KURA the way she faces, through a door or down the stairs once found. Turn first with `[<]` and `[>]` (free). The up arrow works too. The step comes back at midnight, your local time.
- **Search as much as you like.** `[S]EARCH` digs at the wall KURA faces; each wall hides its own things, and finds are a matter of luck and patience. Every search heats the room up, and a hot room draws wandering demons, more often under a bright moon.
- **Demons stay until they're dealt with.** `[F]IGHT` them, `[T]ALK` to them, or `[R]UN` through a door (that uses the day's step, and they may block it). A demon that listens asks for a gift: SILVER, any item, or nothing. Each kind wants something different, and a good gift can win it over to the party. CHAOS demons are tricksters.
- **Alignment.** Every demon is LAW, NEUTRAL or CHAOS, and so is KURA. Her choices pull her one way or the other (an arrow on `ALIGN` shows which), and demons treat her by it.
- **Talk to your party.** With no demon around, `[T]ALK` gets a reply from the party. Their mood tells you how hot the room is getting. Don't pester them too much.
- **Items.** `[I]NVOKE` opens the bag. Rare finds have alignments, and the `CODEX` keeps track of every demon and item you've ever found.
- **Omens.** Every day opens with an omen. Some change the day's luck.
- **Each floor is a real week.** Its way down closes at the end of Sunday. Find the stairs early and the next floor gives you bonus days; miss the deadline, or let KURA fall to a demon, and the run is over.
- **Each run is a real month.** 4 weeks, 4 levels to explore.
- **Your run lives in your browser** and saves itself after every action. `[?]` is About (with a guide to every key), `[L]OG` shows the adventure log, `[P]ASS` gives your run's password (copy it to keep or move the run, or paste one in to continue it), and `[R]ESET` starts over. The game goes by the server's real time, not your device clock.

## Files

- `index.html` is the page: buttons, keys, popups and the in-browser save.
- `screen.js` draws the 80-column screen and keeps the time. Every line is checked to be exactly 80 characters.
- `floor.js` rolls each floor: 3 rooms in a 3x3 grid, joined by doors, with the stairs hidden behind a wall.
- `rules.js` holds the rules: steps, searching, heat, demons, talking and gifts, alignment, items, omens, real days and the weekly deadline.
- `save.json` is the chat version's run (`/smt-screen`). The page doesn't use it.
- `CHANGELOG.md` lists every update with its time and a screenshot.
- `screenshots/` holds a screenshot of each build (the page itself uses the VT323 font).
