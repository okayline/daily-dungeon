# Daily Digital Demon Dungeon

*One door a day. The dark rises with the moon.*

**Play it:** [dungeon.88x31.app](https://dungeon.88x31.app). The older copy on [itch.io](https://okayline.itch.io/4dungeon) plays the run in your browser instead, without the server.

<img width="60%" alt="Daily Digital Demon Dungeon, build v1.26" src="screenshots/v1.26.png" />

An 80-column ASCII dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played on the real lunar calendar. Open one door a day. The real moon changes how the game plays.

## The Moon Is Real

Each quarter of the lunar month, the dark takes a level, so you have to climb out before the quarter ends. Survive all four and you finish the cycle, and the game! Everyone playing this quarter is in the same pit, on the same level with the same rooms. Which door is which is yours alone, and the game tells you how many others are down there, never who.

The moon sets the mood. Near the new moon demons are easier to talk to, and near the full moon they run wild. Full moons are rarer and stranger, too, and some things only turn up under the brightest light.

There's no ceiling, only the sky. Look up ([M]) and ask her as often as you like. Each quarter she wants something: a night, a way it came to you, and a kind of thing. She says so plainly. When you reach the stairs you can offer her up to two things. Anything passes, but what fits is remembered, and if all three fit, one thing is lifted a tier.

## Good to Know

You get one key a day, and you spend it on one of two doors. Everyone has the same choice, but a different context. A level is a run of wings, one a day, with the stairs in the last one, so if you start late your level is just shorter.

Searching, walking and talking take breath. If you run out, wait a few seconds. (At dungeon.88x31.app breath is resting for now and never runs out.) Face a wall and search to find things: every room hides one to three items, plus some coins and demons. Each search warms the room, and a hot room draws demons. You can fight, talk or run. A fallen demon may drop a thing or two, and some will offer a swap, take one or give one.

You start with three friends, and demons can join when there's room. Talk to them and they warm up to you, though they'll go quiet for a day if a room runs very hot. Everyone carries things, and sometimes they'll offer you one. On your own, TALK just has KURA listen to the room or the door she faces.

Every item is a numbered copy with a story. [H]ISTORY, in INVOKE, shows where and when it was found and every time it changed hands, down to the second. The bag holds nine, six to a page, and things can travel between the Dungeons games.

What you carry, who walks with you and what you've done lately make you louder and give you a colour, your aura, and demons, the dungeon and the moon can tell. Once a day she also whispers her Omen, which tilts what the day brings.

When a run is done, post it to the leaderboard. It starts under a placeholder name, so type your own when you post. At dungeon.88x31.app your run lives on the server, and the account page ([P]) keeps a save code and passkeys so you can pick it up on another device.

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
