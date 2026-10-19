# Leaderboard (Cloudflare Worker + D1)

Ranked by deepest floor, then most days survived, then earliest. TURNS are shown on the board but never ranked. One entry per run. Scores are not provable (the page sends the numbers, and `POST /score` doesn't check them against the run the server keeps), so the Worker only blocks casual junk: value limits, one entry per run, five posts an
hour per sender, a name check and an origin check.

## Set it up (about four commands)

```sh
cd leaderboard
npx wrangler d1 create daily-dungeon-board        # copy the database_id it prints into wrangler.toml (repo root)
npx wrangler d1 execute daily-dungeon-board --remote --file=schema.sql
npx wrangler deploy                               # prints the Worker's address
```

Then put that address in `index.html` (`LEADERBOARD_URL`) and set `ALLOW_ORIGIN` in `wrangler.toml` to the game's address.
Until `LEADERBOARD_URL` is filled in, the game hides every leaderboard button.

If you set this up before v0.73, re-run the schema once to add the newer tables (`faction_season` from v0.60, `counters` and `seen` from v0.73, `events` from v0.74), then deploy again (it's additive,
`CREATE TABLE IF NOT EXISTS`, so this is safe on an existing database): `npx wrangler d1 execute daily-dungeon-board --remote --file=schema.sql`

## Removing an entry

Set a secret key once, then redeploy: `npx wrangler secret put ADMIN_KEY` (type any long password), `npx wrangler deploy`.
In the game, turn on the X cheat (infinite steps), open the board (B), pick a row with the up/down keys and press D.
The first time it asks for the key; the page remembers it in that browser.

## Player accounts (v1.13)

Optional. Save codes and passkeys come from the shared Accounts service in dungeon-items (`ACCOUNTS` service binding, entrypoint `Accounts`), game name `4dungeon`. Each player has a login token kept by the page; the run itself lives on the server (`runs`).

- Serve the game and this Worker from `dungeon.88x31.app` (page at `/`, Worker on `dungeon.88x31.app/api/*`). Passkeys and cookies need that one address; on github.io the ACCOUNT button just says so.
- Run `npx wrangler d1 execute daily-dungeon-board --remote --file=schema.sql` (adds players, player_sessions, score_players, acct_limits).
- Add the `ACCOUNTS` service binding in the dashboard if the deploy doesn't take it from `wrangler.toml`.
- Old addresses (no `/api`) keep working. Tests: `npm test`.
