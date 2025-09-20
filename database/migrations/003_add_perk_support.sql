-- Migration: Add support for perks in items table
-- Date: 2025-01-19
-- Description: Adds is_perk column to items table to identify perk items

-- Add is_perk column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_perk BOOLEAN DEFAULT FALSE;

-- Create index for efficient perk queries
CREATE INDEX IF NOT EXISTS idx_items_is_perk ON items (is_perk);

-- Update table comment to reflect new functionality
COMMENT ON TABLE items IS 'Main items table including nanos (is_nano=true) and perks (is_perk=true)';

-- Record migration
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('003', 'add_perk_support', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;