# Daily Digital Demon Dungeon

*One door a day. The dark rises with the moon.*

**Play it:** [okayline.itch.io/4dungeon](https://okayline.itch.io/4dungeon)

<img width="60%" alt="Daily Digital Demon Dungeon, build v1.05.1" src="screenshots/v1.05.1.png" />

An 80-column ASCII dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played on the real lunar calendar. Open one door a day. The real moon changes how the game plays.

## The Moon Is Real

- **The dark rises with her.** Each quarter of the lunar month, the dark takes a level. Climb out before the quarter ends. Survive all four to finish the cycle.
- **She sets the mood.** Near the new moon demons are easier to talk to; near the full moon they run wild. Most of the game shifts a little with her phase.
- **Full moons are rarer and stranger.** Some things only turn up under the brightest light.
- **Look up and ask her.** There's no ceiling, only the sky. Some nights she drops a hint about the rooms.
- **Everyone's in the same pit.** Everyone playing this quarter is on the same level with the same rooms. Which door is which is yours alone. The game tells you how many others are down there, never who.

## Good To Know

- **One key a day.** Spend it on a door, or go on STANDBY and rest deeper tonight.
- **Breath.** Searching and walking tire KURA out. Turning and looking around are free. If she's out of breath, wait a few seconds.
- **AURA.** Read a demon in a fight, get a hunch about what's behind a door (costs a breath), or check how KURA and the party are feeling.
- **TALK.** Talk to a demon, or to your party, who can tell you how the room feels.
- **Your party.** Start with three friends. Demons can join when there's room. Everyone has patience, so don't wear it thin.
- **Alignment.** Your choices pull KURA one way or another, and demons can tell.
- **The Omen.** Once a day the moon gives everyone the same omen, and it tilts what the day brings.
- **The Board.** Post a finished run to the leaderboard. Your run starts under a placeholder name; type your own when you post.
- **Saves.** Your run lives in your browser. The `[?]` menu has a password to move it to another device.

## Files

- `index.html`: the page: the screen, keys, boxes, title screen, saves and the `[?]` menu.
- `screen.js`: draws the 80-column screen and keeps time.
- `floor.js`: rolls each level and draws the minimap.
- `rules.js`: the rules.
- `leaderboard/`: the Cloudflare Worker and database behind the board and the title screen's numbers. Its own README covers setup.
- `CHANGELOG.md`: every update, with its time and a screenshot (in `screenshots/`).
- `fonts/`: VT323, with its license (SIL Open Font License).
- `archive/`: retired pieces, kept for history.
