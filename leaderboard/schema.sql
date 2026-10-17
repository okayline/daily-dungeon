-- D1 schema for the Daily Digital Demon Dungeon leaderboard.
CREATE TABLE IF NOT EXISTS scores (
  run     TEXT PRIMARY KEY,          -- one entry per run (a random id the game makes)
  name    TEXT NOT NULL,
  floor   INTEGER NOT NULL,
  days    INTEGER NOT NULL,
  demons  INTEGER NOT NULL,
  turns   INTEGER NOT NULL DEFAULT 0, -- shown on the board, never used for rank
  version TEXT,
  made    INTEGER NOT NULL,          -- unix seconds
  who     TEXT                       -- hash of the sender, for the rate limit only
);
CREATE INDEX IF NOT EXISTS rank_idx ON scores (floor DESC, days DESC, made ASC);

-- Faction seasons: one lunar epoch at a time, two rows (LAW/CHAOS) -- NEUTRAL never gets a row of its
-- own, its point always lands on whichever side is currently behind. See leaderboard's /score POST.
CREATE TABLE IF NOT EXISTS faction_season (
  epoch INTEGER NOT NULL,
  side  TEXT NOT NULL,                -- 'LAW' or 'CHAOS'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (epoch, side)
);

-- The title screen's running totals: one row per (lunar epoch, key). See tallyStats in worker.js.
CREATE TABLE IF NOT EXISTS counters (
  period INTEGER NOT NULL,
  key    TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (period, key)
);
-- Who has posted this epoch (the same sender hash the rate limit uses), so "players seen" is a counter, not a scan.
CREATE TABLE IF NOT EXISTS seen (
  period INTEGER NOT NULL,
  who    TEXT NOT NULL,
  PRIMARY KEY (period, who)
);
CREATE INDEX IF NOT EXISTS made_idx ON scores (made);

-- Ambient events for the title screen's rumor cards: a tag, maybe a small number, and when. Nothing else.
-- The newest 20 of each tag are kept (see POST /event). `who` is only for the per-sender rate limit.
CREATE TABLE IF NOT EXISTS events (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  v    INTEGER,
  made INTEGER NOT NULL,
  who  TEXT
);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type, id);
CREATE INDEX IF NOT EXISTS events_who_idx ON events (who, made);

-- WHO IS HERE: one row a device with a living run (a random id the game makes; nothing personal), refreshed by
-- one ping a day. "Players seen" counts rows since the epoch began; "in the pit today" counts the last 24 hours.
CREATE TABLE IF NOT EXISTS present (
  id    TEXT PRIMARY KEY,
  level INTEGER NOT NULL,             -- height in the pit: 1 = B4F ... 4 = B1F, 5 = 1F
  at    INTEGER NOT NULL,             -- unix seconds of the last ping
  who   TEXT                          -- hash of the sender, for the rate limit only
);
CREATE INDEX IF NOT EXISTS present_at_idx ON present (at);
-- Live presence: lets a new device's rate-limit check read only that sender's rows. Bot ids start "bot".
CREATE INDEX IF NOT EXISTS present_who_idx ON present (who, at);

-- NEWS (v0.90): the ambient events again, now with where and who. x is a small JSON object of checked fields:
-- lv (level height), d (day on the level), k (room kind), a (L/N/C), p (party size), c (levels into the run),
-- dm (the demon involved), m (moon phase 0-7), n (the player's name: kept for later, never sent out by /feed).
-- The older `events` table is left as it is and only read from while this one fills.
CREATE TABLE IF NOT EXISTS news (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  v    INTEGER,
  made INTEGER NOT NULL,
  who  TEXT,
  x    TEXT
);
CREATE INDEX IF NOT EXISTS news_type_idx ON news (type, id);
CREATE INDEX IF NOT EXISTS news_who_idx ON news (who, made);

-- THE EXCHANGE (v1.00): the player economy. See the long note in worker.js above economy().
-- OWNERS: one row a key (only its SHA-256 is kept). run: the one living run it deals for; moon_q: the quarter its
-- one outside MOON thing was taken in; who: the sender's hash, to slow down piles of new keys.
CREATE TABLE IF NOT EXISTS eco_owners (
  owner  TEXT PRIMARY KEY,
  run    TEXT,
  bot    INTEGER NOT NULL DEFAULT 0,
  made   INTEGER NOT NULL,
  moon_q INTEGER,
  who    TEXT
);
CREATE INDEX IF NOT EXISTS eco_owners_who_idx ON eco_owners (who, made);
-- ITEMS: every RARE, MYTHIC or MOON thing the Worker saw found. state: bag | stash | escrow | gone | dead.
-- finder and who count the day's finds; fresh = delivered to a run's bag, not yet picked up by its page.
CREATE TABLE IF NOT EXISTS eco_items (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  owner  TEXT NOT NULL,
  run    TEXT,
  name   TEXT NOT NULL,
  tier   TEXT NOT NULL,
  state  TEXT NOT NULL,
  finder TEXT NOT NULL,
  who    TEXT,
  made   INTEGER NOT NULL,
  fresh  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS eco_items_owner_idx ON eco_items (owner, state);
CREATE INDEX IF NOT EXISTS eco_items_finder_idx ON eco_items (finder, tier, made);
CREATE INDEX IF NOT EXISTS eco_items_who_idx ON eco_items (who, tier, made);
-- OFFERS: one thing for nothing, any thing of a tier ("tier:RARE") or one named thing ("name:a moonstone").
-- state: open | taken | cancelled | closed (the quarter ended) | dead (its run ended).
CREATE TABLE IF NOT EXISTS eco_offers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  code    TEXT NOT NULL UNIQUE,
  owner   TEXT NOT NULL,
  run     TEXT,
  item    INTEGER NOT NULL,
  wants   TEXT NOT NULL DEFAULT '',
  public  INTEGER NOT NULL DEFAULT 0,
  bot     INTEGER NOT NULL DEFAULT 0,
  quarter INTEGER NOT NULL,
  made    INTEGER NOT NULL,
  state   TEXT NOT NULL,
  taker   TEXT,
  paid    INTEGER,
  done    INTEGER
);
CREATE INDEX IF NOT EXISTS eco_offers_market_idx ON eco_offers (state, quarter, public, bot, id);
CREATE INDEX IF NOT EXISTS eco_offers_owner_idx ON eco_offers (owner, state);
-- RETIRED RUNS: a run that ended (or was replaced by a newer one on the same key) can't deal again.
CREATE TABLE IF NOT EXISTS eco_retired (
  run TEXT PRIMARY KEY,
  at  INTEGER NOT NULL
);

-- PLAYER ACCOUNTS (v1.13). Save codes and passkeys live in the shared Accounts service (the dungeon-items Worker); these are
-- this game's own side. A player is a browser cookie (only the token's hash is kept); the account's player here is linked
-- in the shared service under the game name "4dungeon". No names, no email.
CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL,
  admin       INTEGER NOT NULL DEFAULT 0      -- (v1.20) 1 = the webmaster: the admin tools work for this player (set by hand)
);
-- other devices a player is logged in on (the first device uses players.token_hash)
CREATE TABLE IF NOT EXISTS player_sessions (
  token_hash  TEXT PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS player_sessions_player ON player_sessions (player_id);
-- the run saved to the cloud: the page's PASSWORD text, one per player, the newest write wins
CREATE TABLE IF NOT EXISTS cloud_saves (
  player_id   INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  saved       INTEGER NOT NULL
);
-- which player posted which run to the board (never shown; the board stays anonymous)
CREATE TABLE IF NOT EXISTS score_players (
  run         TEXT PRIMARY KEY,
  player_id   INTEGER NOT NULL
);
-- slows down making players and cloud saves
CREATE TABLE IF NOT EXISTS acct_limits (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

-- (v1.20) each player's run, kept and played on the server (leaderboard/game.js). n counts the actions taken on it.
CREATE TABLE IF NOT EXISTS runs (
  player_id   INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  state       TEXT NOT NULL,
  n           INTEGER NOT NULL,
  updated     INTEGER NOT NULL
);
