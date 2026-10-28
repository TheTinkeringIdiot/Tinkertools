-- Migration 010: btree index on items.name
-- Interpolation looks up every QL variant of an item by exact name and
-- description (app/services/interpolation.py). The only name indexes were
-- GIN full-text and lower(name), so that lookup scanned the whole items table.
-- Harmless at one version per schema; a scan of every version once content
-- tables are shared (design.md section 12).

\echo 'Adding btree index on items.name...'

CREATE INDEX IF NOT EXISTS idx_items_name_btree ON items (name);

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('010', 'add_items_name_index', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
