-- ============================================================================
-- Migration 006: Fix Symbiant Slot Extraction
-- ============================================================================
-- This migration fixes the symbiant_items materialized view to extract slot
-- from stat 298 (Slot) instead of stat 54 (QL/Level).
--
-- Root Cause: The view was joining on stat 54 which contains QL values,
--             but it should join on stat 298 which contains equipment slot bitflags.
--
-- Impact: This caused slot filtering to fail (returned empty results).
-- ============================================================================

\echo 'Fixing symbiant_items materialized view slot extraction...'

-- Drop the existing view
DROP MATERIALIZED VIEW IF EXISTS symbiant_items;

-- Recreate with correct stat for slot (298 instead of 54)
CREATE MATERIALIZED VIEW symbiant_items AS
SELECT DISTINCT ON (i.id)
    i.id,
    i.aoid,
    i.name,
    i.ql,
    sv.value as slot_id,  -- Now extracts from stat 298 (Slot) instead of stat 54 (QL/Level)
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
LEFT JOIN stat_values sv ON istats.stat_value_id = sv.id AND sv.stat = 298  -- CHANGED FROM 54 TO 298
WHERE i.name ~ 'Symbiant.*Unit\s+Aban$'
ORDER BY i.id, sv.value DESC NULLS LAST;

-- Performance indexes for symbiant_items
CREATE INDEX IF NOT EXISTS idx_symbiant_items_family ON symbiant_items(family);
CREATE INDEX IF NOT EXISTS idx_symbiant_items_aoid ON symbiant_items(aoid);
CREATE INDEX IF NOT EXISTS idx_symbiant_items_slot ON symbiant_items(slot_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbiant_items_id ON symbiant_items(id);

-- Refresh to populate with correct data
REFRESH MATERIALIZED VIEW symbiant_items;

\echo 'Verifying symbiant slot values...'

-- Show distinct slot values (should be bitflags like 2, 4, 8, 16, 32, etc.)
SELECT 'Distinct slot_id values:' as info;
SELECT DISTINCT slot_id FROM symbiant_items ORDER BY slot_id;

-- Show count by slot
SELECT 'Count by slot_id:' as info;
SELECT slot_id, COUNT(*) as count FROM symbiant_items WHERE slot_id IS NOT NULL GROUP BY slot_id ORDER BY slot_id;

-- ============================================================================
-- Track migration
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('006', 'fix_symbiant_slot_extraction', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

\echo 'Symbiant slot extraction fix completed successfully!'
