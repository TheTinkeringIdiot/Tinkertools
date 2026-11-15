-- Remove the game data store that the content-addressed store (schema cas)
-- replaced. IRREVERSIBLE: there is no undo but a backup taken beforehand.
--
-- It drops, with everything in them:
--   * every schema named gv_<slug>: the per-version views, curated tables
--     (perks, mobs, sources, source_types, item_sources, application_cache,
--     schema_migrations) and the symbiant_items materialized view;
--   * the view public.item_revisions (it reads gd.items);
--   * schema gd: the shared revision store (items, item_stats, spells,
--     actions, criteria, attack/defense, nano_properties, ...);
--   * the tables public.game_versions and public.global_migrations.
-- Nothing else is touched: not cas, not any other schema, not the extensions.
--
-- Before running it:
--   1. The application and the importer of this commit or later are deployed;
--      they read and write schema cas only.
--   2. If clients of this database may still hold internal item ids, export
--      them first: python tools/export_legacy_item_ids.py legacy_item_ids.csv
--      (and load the file with import_cli.py import-cas --legacy-ids-file).
--      The ids exist nowhere else once gd is gone.
--   3. Take a backup: pg_dump -Fc -f before_drop.dump "$DATABASE_URL"
--
-- Run with psql, which the script needs (\gexec):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tools/drop_old_store.sql
--
-- Each schema is dropped in a transaction of its own: together they hold far
-- more relations than one transaction can lock (max_locks_per_transaction).
-- A run that stops part way can simply be repeated.

\set ON_ERROR_STOP on

-- Refuse a database in which the new store is not loaded.
DO $$
BEGIN
    IF to_regclass('cas.build') IS NULL THEN
        RAISE EXCEPTION 'schema cas holds no store: nothing would be left to serve';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cas.build WHERE enabled) THEN
        RAISE EXCEPTION 'cas.build has no enabled build: nothing would be left to serve';
    END IF;
END
$$;

SELECT format('DROP SCHEMA %I CASCADE', nspname)
FROM pg_namespace
WHERE nspname LIKE 'gv\_%'
ORDER BY nspname
\gexec

DROP VIEW IF EXISTS public.item_revisions;
DROP SCHEMA IF EXISTS gd CASCADE;
DROP TABLE IF EXISTS public.game_versions;
DROP TABLE IF EXISTS public.global_migrations;
