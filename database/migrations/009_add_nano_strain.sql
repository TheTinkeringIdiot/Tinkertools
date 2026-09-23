-- Migration 009: nano strain in nano_properties
-- The NanoStrain stat (75) of each nano, filled by app/core/nano_properties.py
-- with the other derived fields. For a schema imported before this migration, run
--   python import_cli.py nano-properties --version <slug>
-- which applies it and refills the table.

\echo 'Adding strain to nano_properties...'

ALTER TABLE nano_properties ADD COLUMN IF NOT EXISTS strain INTEGER;

CREATE INDEX IF NOT EXISTS idx_nano_properties_strain ON nano_properties (strain);

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('009', 'add_nano_strain', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
