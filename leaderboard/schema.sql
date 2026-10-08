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
