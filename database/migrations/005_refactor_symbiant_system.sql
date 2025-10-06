-- ============================================================================
-- Migration 005: Refactor Symbiant System
-- ============================================================================
-- This migration refactors the symbiant/pocket boss system to:
-- 1. Remove broken/redundant tables (pocket_boss_symbiant_drops, symbiants, pocket_bosses)
-- 2. Create unified mobs table for pocket bosses and future mob drops
-- 3. Create materialized view for symbiant queries with computed family
-- 4. Update source_types to use 'mob' instead of 'boss'
--
-- See: .docs/plans/tinkerpocket/SYMBIANT_REFACTOR_PLAN.md

\echo 'Starting symbiant system refactor...'

-- ============================================================================
-- Step 1: Drop broken/redundant tables
-- ============================================================================

\echo 'Dropping old symbiant tables...'

DROP TABLE IF EXISTS pocket_boss_symbiant_drops CASCADE;
DROP TABLE IF EXISTS symbiants CASCADE;
DROP TABLE IF EXISTS pocket_bosses CASCADE;

-- ============================================================================
-- Step 2: Create mobs table (replaces pocket_bosses, supports future expansion)
-- ============================================================================

\echo 'Creating mobs table...'

CREATE TABLE IF NOT EXISTS mobs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    level INTEGER,
    playfield VARCHAR(100),
    location VARCHAR(255),
    mob_names TEXT[],  -- Array of mob names in the pocket/area
    is_pocket_boss BOOLEAN DEFAULT TRUE,
    metadata JSONB,  -- For future extensibility
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for mobs
CREATE INDEX IF NOT EXISTS idx_mobs_name ON mobs(name);
CREATE INDEX IF NOT EXISTS idx_mobs_is_pocket_boss ON mobs(is_pocket_boss);
CREATE INDEX IF NOT EXISTS idx_mobs_playfield ON mobs(playfield);

-- ============================================================================
-- Step 3: Create materialized view for symbiants
-- ============================================================================

\echo 'Creating symbiant_items materialized view...'

DROP MATERIALIZED VIEW IF EXISTS symbiant_items;

CREATE MATERIALIZED VIEW symbiant_items AS
SELECT DISTINCT ON (i.id)
    i.id,
    i.aoid,
    i.name,
    i.ql,
    sv.value as slot_id,
    CASE
        WHEN i.name ~ ',\s*Artillery\s+Unit\s+Aban$' THEN 'Artillery'
        WHEN i.name ~ ',\s*Control\s+Unit\s+Aban$' THEN 'Control'
        WHEN i.name ~ ',\s*Extermination\s+Unit\s+Aban$' THEN 'Extermination'
        WHEN i.name ~ ',\s*Infantry\s+Unit\s+Aban$' THEN 'Infantry'
        WHEN i.name ~ ',\s*Support\s+Unit\s+Aban$' THEN 'Support'
        ELSE NULL
    END as family
FROM items i
LEFT JOIN item_stats istats ON i.id = istats.item_id
LEFT JOIN stat_values sv ON istats.stat_value_id = sv.id AND sv.stat = 54
WHERE i.name ~ 'Symbiant.*Unit\s+Aban$'
ORDER BY i.id, sv.value DESC NULLS LAST;

-- Performance indexes for symbiant_items
CREATE INDEX IF NOT EXISTS idx_symbiant_items_family ON symbiant_items(family);
CREATE INDEX IF NOT EXISTS idx_symbiant_items_aoid ON symbiant_items(aoid);
CREATE INDEX IF NOT EXISTS idx_symbiant_items_slot ON symbiant_items(slot_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbiant_items_id ON symbiant_items(id);

-- ============================================================================
-- Step 4: Update source_types (rename 'boss' to 'mob')
-- ============================================================================

\echo 'Updating source_types...'

UPDATE source_types
SET name = 'mob', description = 'Items dropped by mobs'
WHERE name = 'boss';

-- ============================================================================
-- Step 5: Add documentation comments
-- ============================================================================

\echo 'Adding table comments...'

COMMENT ON TABLE mobs IS 'NPCs that drop items, including pocket bosses and regular mobs';
COMMENT ON COLUMN mobs.mob_names IS 'Array of mob names found in this pocket/area';
COMMENT ON COLUMN mobs.is_pocket_boss IS 'TRUE for pocket bosses, FALSE for regular mobs';
COMMENT ON MATERIALIZED VIEW symbiant_items IS 'Pre-computed view of all symbiants with extracted family information';

-- ============================================================================
-- Track migration
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('005', 'refactor_symbiant_system', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

\echo 'Symbiant system refactor completed successfully!'
