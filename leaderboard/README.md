# Leaderboard (Cloudflare Worker + D1)

Ranked by deepest floor, then most days survived, then earliest. TURNS are shown on the board but never ranked. One entry per run. Scores are not provable (the game
saves in the player's browser), so the Worker only blocks casual junk: value limits, one entry per run, five posts an
hour per sender, a name check and an origin check.

## Set it up (about four commands)

```sh
cd leaderboard
npx wrangler d1 create daily-dungeon-board        # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute daily-dungeon-board --remote --file=schema.sql
npx wrangler deploy                               # prints the Worker's address
```

Then put that address in `index.html` (`LEADERBOARD_URL`) and set `ALLOW_ORIGIN` in `wrangler.toml` to the game's address.
Until `LEADERBOARD_URL` is filled in, the game hides every leaderboard button.

## Removing an entry

Set a secret key once, then redeploy: `npx wrangler secret put ADMIN_KEY` (type any long password), `npx wrangler deploy`.
In the game, turn on the X cheat (infinite steps), open the board (B), pick a row with the up/down keys and press D.
The first time it asks for the key; the page remembers it in that browser.
