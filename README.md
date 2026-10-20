# Daily Digital Demon Dungeon

*One door a day. The dark rises with the moon.*

**Play it:** [dungeon.88x31.app](https://dungeon.88x31.app). The older copy on [itch.io](https://okayline.itch.io/4dungeon) plays the run in your browser instead, without the server.

<img width="60%" alt="Daily Digital Demon Dungeon, build v1.26" src="screenshots/v1.26.png" />

An 80-column ASCII dungeon crawler in the spirit of 80s CRPGs and Shin Megami Tensei, played on the real lunar calendar. You are KURA. You wake at the bottom of a pit, open one door a day, and climb before the dark catches you.

## The Moon Is Real

- **The dark rises with her.** Each level belongs to one quarter of the lunar month and is lost when that quarter ends. Find the stairs and climb before it does. Survive all four quarters to reach the surface. Start late in a quarter and you wake on that quarter's level, on a shorter floor.
- **She sets the mood.** Near the new moon demons would rather talk; near the full moon they hit harder and hardly listen.
- **She wants something.** Look up and she says her wish for this level, every time you ask: a night, how a thing came to you, and what kind of thing it is. In INVOKE, a + marks anything that has part of it.
- **The stairs are sealed.** You can see them, but they open only after KURA shows the moon up to two things from her bag (or nothing). She keeps nothing and always lets KURA by. Show her what she asked for and your things remember it, and a thing with all three parts is blessed.
- **Everyone's in the same pit.** Everyone playing this quarter is on the same level with the same layout. What's behind each door is yours alone. The game tells you how many others are down there, never who.

## Good to Know

- **One key a day.** Doors come in pairs. Opening one with the day's key seals the other for good. Walking through doors you've already opened is free, and turning is always free.
- **Search.** Every room's walls hide one to three things on top of its coins and demons. Search what KURA faces as often as you like, but searching the same spot over and over draws attention.
- **TALK.** Talk to a demon, or to your party. Everyone carries a few things, and sometimes they offer one: TAKE ONE or GIVE ONE. On your own, KURA listens to the room or the door she faces instead.
- **Your party.** You start with three friends: ELF, PIXIE and CU SITH. Demons can join when there's room. Members are talked out after a lot of talking in one day, and go quiet only in the hottest rooms. A night's sleep brings them back.
- **Fights.** FIGHT, TALK or RUN. A demon stays until it falls, is talked down, or you get away.
- **Aura.** What you carry and who walks with you make you louder, and give you a colour. Demons, the dungeon and the moon can tell.
- **The Omen.** Each real day has its own omen, and it tilts what the day brings.
- **The bag (INVOKE).** Nine things, six to a page. Press a number to choose one, [U]SE to use it, H for its HISTORY, and MAIL for things that travel between games. ICHOR is a flask KURA always carries: it fills from demons and the party drinks from it. SILVER cools the room and clears KURA's head.
- **Things remember.** Every find is a numbered copy in the shared item registry, the same one the other 88x31 games use. Its HISTORY shows how it came to you, under which moon and on which level, whether it was a first or hundredth copy, and what it has been through with you. The [L]EDGER button opens its page on the public ledger at [88x31.app/registry](https://88x31.app/registry).
- **Odd rooms.** The end of a wing has a small box: take what the last visitor left and leave something small for the next one. The altar room's terminal is still on the wall, but it takes nothing.
- **Visitors.** Buttons you send from 88x31 arrive in the bag. They can't be broken or used up, and one a demon wanders off with finds its way back to the bag.
- **The Board.** Post a finished run to the leaderboard. Your run starts under a placeholder name; type your own when you post.
- **Saves.** At dungeon.88x31.app every move is played on the server, so your run is the same on every device you sign in on. The account page ([P]) keeps save codes and passkeys, shared with the other 88x31 games.
- **Breath.** Searching, walking, talking and looking up take breath, but at dungeon.88x31.app breath is resting for now and never runs out. It still counts in the itch.io copy.

## Files

- `index.html`: the page: the screen, keys, boxes, title screen, account page and the `[?]` menu.
- `screen.js`: draws the 80-column screen and keeps time.
- `floor.js`: rolls each level and draws the minimap.
- `rules.js`: the rules.
- `act.js`: every action the page or the server can take on a run, in one list.
- `sky.js`: the real night sky and moon KURA sees when she looks up.
- `items.js`: the item list, generated from the shared item table (dungeon-items) by `tools/sync-items.mjs`. Don't edit it by hand.
- `leaderboard/`: the Cloudflare Worker and database behind the board, the title screen's numbers, accounts and the server-side run (`game.js`). Its own README covers setup.
- `CHANGELOG.md`: every update, with its time.
- `screenshots/`: screenshots from older builds.
- `fonts/`: VT323, with its license (SIL Open Font License).
- `archive/`: retired pieces, kept for history.

Star positions come from the [d3-celestial](https://github.com/ofrohn/d3-celestial) catalog (BSD license, Olaf Frohn).
