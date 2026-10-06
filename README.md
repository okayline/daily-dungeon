# Daily Dungeon

An 80-column ASCII roguelike in the spirit of 80s/90s dungeon crawlers. You get one move a day, and the real moon phase changes how demons behave.

- `index.html` draws the current screen from `save.json`, with the live Honolulu date, time and moon phase.
- `screen.js` is the renderer. Every line is checked to be exactly 80 characters.
- `save.json` is the game state. Each move will be committed here, so the commit history is the adventure log.

Status: the screen is live. Movement, rooms and the in-page save are being built piece by piece.
