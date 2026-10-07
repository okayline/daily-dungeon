# Daily Dungeon

**Play it here: https://okayline.github.io/daily-dungeon/**

<img width="60%" height="60%" alt="Screenshot 2026-10-06 at 16-25-22 Daily Dungeon" src="https://github.com/user-attachments/assets/cd7c038d-e306-4f0f-82a7-f45fd878ed80" />


An 80-column ASCII rougelike dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played one step a day on the real calendar. The real moon phase impacts gameplay in different ways.

## How it plays

- **One step a day.** `[N] [S] [E] [W]` walk through a door (or down the stairs once found). The step comes back at midnight, your local time.
- **Search as much as you like.** `SE[A]RCH` digs at the wall KURA faces; each wall hides its own things, and finds are a matter of luck and patience. Every search risks a rare reward or a wandering demon, more often under a bright moon.
- **Look around for free** with `[<]` and `[>]` under the 3D view.
- **Each floor is a real week.** Its way down closes at the end of Sunday. Find the stairs early and the next floor gives you bonus days; miss the deadline, or let KURA fall to a demon, and the run is over.
- **Each run is a real month.** 4 weeks, 4 levels to explore.
- **Your run lives in your browser** and saves itself after every action. `[L]OG` shows the adventure log, `[B]ACKUP` gives a code to keep or move your run, `[R]ST` starts over.

## Files

- `index.html` is the page: buttons, keys and the in-browser save.
- `screen.js` draws the 80-column screen. Every line is checked to be exactly 80 characters.
- `floor.js` rolls each floor: 3 rooms in a 3x3 grid, joined by doors, with the stairs hidden behind a wall.
- `rules.js` holds the rules: steps, searching, demons, real days and the weekly deadline.
- `save.json` is an old save from before browser saves, kept for the chat version (`/smt-screen`). The page doesn't use it.
- `CHANGELOG.md` lists every update with its time.
- `screenshot.png` is the picture above (the page itself uses the VT323 font).
