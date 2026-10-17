-- v1.20: the run on the server. Run once on the live board database before the v1.20 push.
ALTER TABLE players ADD COLUMN admin INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS runs (
  player_id   INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  state       TEXT NOT NULL,
  n           INTEGER NOT NULL,
  updated     INTEGER NOT NULL
);
