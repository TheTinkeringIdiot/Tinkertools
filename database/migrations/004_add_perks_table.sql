-- Migration 004: Add Perks Table
-- Created: 2025-01-19
-- Description: Creates perks table to replace is_perk flag with proper relational structure

\echo 'Running Migration 004: Add Perks Table...'

-- Create perks table
CREATE TABLE perks (
    item_id INTEGER REFERENCES items(id) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    perk_series VARCHAR(128) NOT NULL,
    counter INTEGER NOT NULL,
    type VARCHAR(3) NOT NULL,
    level_required INTEGER NOT NULL,
    ai_level_required INTEGER,
    professions INTEGER[] DEFAULT '{}',
    breeds INTEGER[] DEFAULT '{}'
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_perks_series ON perks(perk_series);
CREATE INDEX IF NOT EXISTS idx_perks_type ON perks(type);
CREATE INDEX IF NOT EXISTS idx_perks_level ON perks(level_required);
CREATE INDEX IF NOT EXISTS idx_perks_professions ON perks USING GIN (professions);
CREATE INDEX IF NOT EXISTS idx_perks_breeds ON perks USING GIN (breeds);

-- Add table comment
COMMENT ON TABLE perks IS 'Perk metadata table with profession/breed requirements and series grouping';

-- Drop is_perk column and its index from items table
DROP INDEX IF EXISTS idx_items_is_perk;
ALTER TABLE items DROP COLUMN IF EXISTS is_perk;

-- Update items table comment
COMMENT ON TABLE items IS 'Main items table including nanos (is_nano=true) with perks in separate perks table';

-- Insert migration record
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('004', 'add_perks_table', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

\echo 'Migration 004 completed successfully!'