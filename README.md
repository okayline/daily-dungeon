# Daily Digital Demon Dungeon

*One door a day. The dark rises with the moon.*

**Play it:** [okayline.itch.io/4dungeon](https://okayline.itch.io/4dungeon)

<img width="60%" alt="Daily Digital Demon Dungeon, build v1.05" src="screenshots/v1.05.png" />

An 80-column ASCII roguelike in the spirit of 80s CRPGs and Shin Megami Tensei, played on the real calendar. Open one door a day on the real Lunar calendar. The moon phase in real life impacts gameplay in different ways.

## The Moon Is Real

- **The Dark rises with the Moon.** Each quarter of the lunar month, the dark consumes a level. Ascend before the quarter ends to survive the floor, survive all four floors to complete one Lunar Cycle and finish the run!
- **The Moon sets the Mood.** The moon's real phase has in-game effects.  Near the new moon demons are more open, and near the full moon they are more wild.  In between it shifts a little each day.  Not only demons, but most of the game's mechanics are affected by the real moon phase.
- **Full moon nights are Rarer, and Stranger.** The deep gives up odd things that only show up under the brightest light of the moon.
- **Everyone is in the same pit.** Everyone playing in the same quarter is on the same level, and each day's rooms are the same for all. Which door is which is yours alone.
- **You're not alone down there.** The game tells you when others are in the pit right now, and how many are on your level. Only how many, never who.
- **Look up and ask her.** There is no ceiling, only the night sky and the real moon. Some nights she gives you hints about the rooms.  The fuller she is, the happier she seems?


## Good To Know

- **One key a day.** Spend it to unlock a door, or go on STANDBY and rest, which also keeps that day's omen.
- **Breath.** Actions like searching and walking tire you out. Looking around is free.  Breath shows on the strip under the map. Spend it too fast and you have to stop and recover for a few seconds.
- **The Omen.** Once a day the Moon gives her Omen.  It is the same Omen for everyone, and it changes the odds of what the day brings.
- **Alignment.** Choices can push you one way or the other, and demons (and your party members) can tell.
- **Your Party.** Start with some friends. Demons can join you (up to three), and each has patience.  Wear anybody's patience thin and they get restless and may leave. Gifts help.
- **The Exchange.** Deep in the pit, a screen is still trading. What you find down there doesn't have to stay yours.
- **The Board.** Finished runs can be posted, and the title screen carries numbers and rumors from everyone else.
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
