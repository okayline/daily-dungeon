# Daily Dungeon

**Play it here: https://okayline.github.io/daily-dungeon/**

An 80-column ASCII roguelike in the spirit of 80s CRPG dungeon crawlers. You get one move a day, and the real moon phase changes how demons behave.

- `index.html` draws the current screen from `save.json`, with the live Honolulu date, time and moon phase.
- `screen.js` is the renderer. Every line is checked to be exactly 80 characters.
- `floor.js` rolls each floor and `rules.js` holds the day-by-day rules (GO, SEARCH, turning).
- `save.json` is the game state. Each move will be committed here, so the commit history is the adventure log.

Status: floors, GO and SEARCH work on the page. Play there stays in your browser until it's saved from chat; the in-page save and the once-a-day limit come later.
