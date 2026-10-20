# Daily Digital Demon Dungeon

*One door a day. The dark rises with the moon.*

**Play it:** [dungeon.88x31.app](https://dungeon.88x31.app). The older copy on [itch.io](https://okayline.itch.io/4dungeon) plays the run in your browser instead, without the server.

<img width="60%" alt="Daily Digital Demon Dungeon, build v1.26" src="screenshots/v1.26.png" />

An 80-column ASCII dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played on the real lunar calendar. Open one door a day. The real moon changes how the game plays.

## The Moon Is Real

- **The dark rises with her.** Each quarter of the lunar month, the dark takes a level. Climb out before the quarter ends. Survive all four to finish the cycle, and the game!
- **She wants something.** Each quarter the moon asks for three things: a night, a way it came to you, and a kind of thing. Look up ([M]) and she says it plainly. At the stairs, offer her up to two things. Anything passes; the ones that fit are remembered, and if all three fit, one thing is lifted a tier.
- **She sets the mood.** Near the new moon demons are easier to talk to; near the full moon they run wild. Most of the game shifts a little with her phase.
- **Full moons are rarer and stranger.** Some things only turn up under the brightest light.
- **Look up and ask her.** There's no ceiling, only the sky. Ask as often as you like.
- **Everyone's in the same pit.** Everyone playing this quarter is on the same level with the same rooms. Which door is which is yours alone. The game tells you how many others are down there, never who.

## Good to Know

- **One key a day.** Spend it on one of two doors every day. Everyone playing has the same choice, but a different context. A level is a run of wings, one a day, with the stairs in the last. Start late and your level is just shorter.
- **Breath.** Searching, walking and talking take breath. If you're out of breath, wait a few seconds. At dungeon.88x31.app breath is resting for now and never runs out.
- **Search the walls.** Face a wall and search. Every room hides one to three items, plus coins and demons. Each search warms the room, and a hot room draws demons.
- **Fights.** Fight, talk or run. A fallen demon may drop a thing or two, and some offer a swap: take one or give one.
- **TALK.** Talk to a demon, or to your party. Everyone carries things, and sometimes they'll offer you one. On your own, KURA listens to the room or the door she faces instead.
- **Your party.** Start with three friends. Demons can join when there's room. Talking builds good vibes with them, and they'll go quiet for a day if a room runs very hot.
- **Things have stories.** Every item is a numbered copy. [H]ISTORY, in INVOKE, shows where and when it was found and every time it changed hands, down to the second. The bag holds nine, six to a page. Things can travel between the Dungeons games.
- **Aura.** What you carry, who walks with you and what you've done lately make you louder, and give you a colour. Demons, the dungeon, and the moon can tell.
- **The Omen.** Once a day the moon whispers her Omen, and it tilts what the day brings.
- **The Board.** Post a finished run to the leaderboard. Your run starts under a placeholder name; type your own when you post.
- **Saves.** At dungeon.88x31.app your run lives on the server. The account page ([P]) keeps a save code and passkeys so you can pick it up on another device.

## Files

- `index.html`: the page: the screen, keys, boxes, title screen, saves and the `[?]` menu.
- `screen.js`: draws the 80-column screen and keeps time.
- `floor.js`: rolls each level and draws the minimap.
- `rules.js`: the rules.
- `act.js`: every action the page or the server can take on a run, in one list.
- `sky.js`: the real night sky and moon KURA sees when she looks up.
- `items.js`: the item list, generated from the shared item table (dungeon-items) by `tools/sync-items.mjs`. Don't edit it by hand.
- `leaderboard/`: the Cloudflare Worker and database behind the board, the title screen's numbers and the server-side run (`game.js`). Its own README covers setup.
- `CHANGELOG.md`: every update, with its time and a screenshot (in `screenshots/`).
- `fonts/`: VT323, with its license (SIL Open Font License).
- `archive/`: retired pieces, kept for history.

Star positions come from the [d3-celestial](https://github.com/ofrohn/d3-celestial) catalog (BSD license, Olaf Frohn).
