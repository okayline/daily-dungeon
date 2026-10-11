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
