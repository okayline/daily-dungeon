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
