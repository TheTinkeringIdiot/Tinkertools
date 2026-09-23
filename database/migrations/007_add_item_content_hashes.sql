-- Migration 007: per-item content hashes
-- Computed by the importer from the raw client record. Copied into
-- public.item_revisions after each version load so item change history can be
-- answered across versions without touching the per-version schemas.

\echo 'Adding content hash columns to items...'

ALTER TABLE items ADD COLUMN IF NOT EXISTS content_hash CHAR(40);
ALTER TABLE items ADD COLUMN IF NOT EXISTS stats_hash CHAR(40);
ALTER TABLE items ADD COLUMN IF NOT EXISTS spells_hash CHAR(40);
ALTER TABLE items ADD COLUMN IF NOT EXISTS actions_hash CHAR(40);
ALTER TABLE items ADD COLUMN IF NOT EXISTS text_hash CHAR(40);

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('007', 'add_item_content_hashes', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
