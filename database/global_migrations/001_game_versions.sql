-- Global migration 001: game version registry and cross-version item revision index.
-- Global migrations live in the `public` schema and are applied once per database.
-- Per-version data lives in one schema per game version (gv_<slug>), managed by
-- database/migrations/*.sql.

CREATE TABLE IF NOT EXISTS public.global_migrations (
    version VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.game_versions (
    slug VARCHAR(40) PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9.-]{0,39}$'),
    schema_name VARCHAR(64) NOT NULL UNIQUE CHECK (schema_name ~ '^gv_[a-z0-9_]{1,60}$'),
    display_name VARCHAR(120) NOT NULL,
    family VARCHAR(20) NOT NULL,
    parent_slug VARCHAR(40) REFERENCES public.game_versions(slug) ON DELETE SET NULL,
    client_build VARCHAR(40),
    snapshot_date DATE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- At most one default version.
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_versions_single_default
    ON public.game_versions ((1)) WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_game_versions_sort
    ON public.game_versions (enabled, sort_order);

-- One row per (item, version). Hashes are computed by the importer from the raw
-- client record (see app/core/content_hash.py) and used to find the snapshots at
-- which an item's definition changed.
CREATE TABLE IF NOT EXISTS public.item_revisions (
    aoid INTEGER NOT NULL,
    version_slug VARCHAR(40) NOT NULL REFERENCES public.game_versions(slug) ON DELETE CASCADE,
    content_hash CHAR(40) NOT NULL,
    stats_hash CHAR(40) NOT NULL,
    spells_hash CHAR(40) NOT NULL,
    actions_hash CHAR(40) NOT NULL,
    text_hash CHAR(40) NOT NULL,
    is_nano BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (aoid, version_slug)
);

CREATE INDEX IF NOT EXISTS idx_item_revisions_version
    ON public.item_revisions (version_slug);

INSERT INTO public.global_migrations (version, name)
VALUES ('001', 'game_versions')
ON CONFLICT (version) DO NOTHING;
