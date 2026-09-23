-- Migration 008: nano school, casting professions and minimum caster level
-- Derived from each nano's NanoSchool stat (405) and its Use action criteria by
-- app/core/nano_properties.py. The importer rebuilds this table after every
-- version load; for a schema imported before this migration, run
--   python import_cli.py nano-properties --version <slug>
-- which applies this migration and fills the table.

\echo 'Creating nano_properties table...'

CREATE TABLE IF NOT EXISTS nano_properties (
    item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    -- NanoSchool stat value 1-5 (Combat, Medical, Protection, Psi, Space)
    school SMALLINT,
    -- Profession ids that can satisfy the Use criteria; empty = not restricted
    professions INTEGER[] NOT NULL DEFAULT '{}',
    -- Lowest caster Level the Use criteria allow; NULL = no Use action
    min_level SMALLINT
);

CREATE INDEX IF NOT EXISTS idx_nano_properties_school ON nano_properties (school);
CREATE INDEX IF NOT EXISTS idx_nano_properties_professions ON nano_properties USING GIN (professions);
CREATE INDEX IF NOT EXISTS idx_nano_properties_min_level ON nano_properties (min_level);

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('008', 'add_nano_properties', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
