# Daily Digital Demon Dungeon

*One key a day. The dark rises with the moon. Get out before it takes your level.*

**Play it:** [okayline.itch.io/4dungeon](https://okayline.itch.io/4dungeon) or [okayline.github.io/daily-dungeon](https://okayline.github.io/daily-dungeon/)

<img width="60%" alt="Daily Digital Demon Dungeon, build v1.02" src="screenshots/v1.02.png" />

An 80-column ASCII roguelike in the spirit of 80s CRPGs and Shin Megami Tensei, played on the real calendar. KURA wakes at the bottom of a pit four levels deep and climbs toward the surface, with the dark coming up behind her.

## The Moon Is Real

- **The dark rises with the moon.** Each quarter of the lunar month, the dark takes a level. Leave before your level's quarter ends, or the run is over. Leaving early banks the days you didn't use.
- **The moon sets the demons' mood.** Near the new moon they talk; near the full moon they're wild and hit harder.
- **Full moon nights are rarer, and stranger.** Some things only turn up deep in the walls when the moon is full.
- **Look up and ask her.** The real moon can tell you what a locked door hides, more often the fuller she is.
- **Everyone is in the same pit.** Everyone playing in the same quarter is on the same level, and each day's rooms are the same for all. Which door is which is yours alone.
- **You're not alone down there.** The game tells you when others are in the pit right now, and how many are on your level. Only how many, never who.

## Good To Know

- **One key a day.** Spend it to unlock a door, or go on STANDBY and rest, which also keeps that day's omen.
- **Breath.** Searching and asking the moon tire KURA; her breath is the bar under the map. Spend it too fast and she has to stop and recover.
- **The omen.** One a day, the same for everyone, and it shifts the odds.
- **Lean.** Every choice pulls you toward LAW, NEUTRAL or CHAOS. Three days leaning the same way in a row, and something unusual happens.
- **Your party.** Up to three demons can join you. They have patience: rudeness, breaking things or mixing opposite sides can drive them off. Gifts help.
- **The exchange.** Deep in the pit, a screen is still trading. What you find down there doesn't have to stay yours.
- **The board.** Finished runs can be posted, and the title screen carries numbers and rumors from everyone else.
- **Saves.** Your run saves in your browser. The `[?]` menu has a password to move a run to another device.

## Files

- `index.html`: the page. The screen, keys and boxes, the title screen, the in-browser save, the exchange window, and the `[?]` menu (password, codex, board).
- `screen.js`: draws the 80-column screen and keeps the time.
- `floor.js`: rolls each level (its wings, rooms, doors and the stairs up) and draws the minimap.
- `rules.js`: the rules.
- `leaderboard/`: the Cloudflare Worker and D1 database behind the board, the title's feed, presence and the exchange. Its own README says how to set one up.
- `CHANGELOG.md`: every update, with its time and a screenshot (in `screenshots/`).
- `fonts/`: the VT323 font the page uses, with its license (SIL Open Font License).
- `archive/`: retired pieces of the project, kept for history.
