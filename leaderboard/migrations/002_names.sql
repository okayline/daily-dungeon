-- v1.40: every player has a rolled two-word board name (leaderboard/names.js). Run once on the live board database
-- before the v1.40 push:
--   npx wrangler d1 execute daily-dungeon-board --remote --file=leaderboard/migrations/002_names.sql
ALTER TABLE players ADD COLUMN name TEXT;
ALTER TABLE players ADD COLUMN name_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS players_name_key ON players (name_key);
