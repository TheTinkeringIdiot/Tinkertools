-- Remove the game data store that the content-addressed store replaced, from
-- the database that holds both. IRREVERSIBLE: there is no undo but a backup
-- taken beforehand (IMPORT_README.md, "Back up").
--
-- Run with psql 11 or later. Without confirm=drop it only reports:
--
--   psql "$DATABASE_URL" -f tools/drop_old_store.sql                  # what would go
--   psql "$DATABASE_URL" -v confirm=drop -f tools/drop_old_store.sql  # drop it
--
-- Two layouts of the old store are known, and a database must hold exactly
-- one of them:
--
--   * Single version (production before several versions were served): the
--     tables of the old schema in `public`, items, item_stats, mobs and the
--     rest of the list further down, with the materialized view
--     symbiant_items. They are dropped in one transaction and without
--     CASCADE: if anything outside the list depends on them the script stops
--     and nothing is dropped. Whatever else is in `public` is left and listed
--     at the end.
--   * Shared revision store (development): every schema named gv_<slug>, the
--     view public.item_revisions, schema gd, and the tables
--     public.game_versions and public.global_migrations. Each schema is
--     dropped in a transaction of its own: together they hold far more
--     relations than one transaction can lock (max_locks_per_transaction).
--     A run that stops part way can be repeated.
--
-- Nothing else is touched: not the new store, not any other schema, not the
-- extensions.
--
-- The script refuses, with exit status 3 and nothing dropped, when
--   * the new store's schema (-v store=NAME, default cas) holds no enabled
--     build: nothing would be left to serve;
--   * the database holds neither layout, or both;
--   * a gv_ schema is not listed in public.game_versions: it may not be the
--     old store's;
--   * an item id of the old store is not in the new store's legacy_item_id
--     with the same AOID, or (single version) a mob id of the old store does
--     not name a mob of the same name in the new store. Clients hold those
--     ids, and the old tables are the only source of them: export and load
--     them first (IMPORT_README.md, "Legacy item ids" and "Mob ids"), or pass
--     -v skip_id_checks=yes to drop regardless.
--
-- It does not know whether an application of before the cutover still runs
-- against this database; such an application fails once its tables are gone.
-- The number of other sessions connected is reported. A drop that cannot get
-- its locks within 30 seconds fails instead of waiting.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned

-- Where the old store lives. Set here, not from the command line.
\set old_public public
\set old_shared gd
\set old_version_like 'gv\\_%'

\if :{?store}
\else
    \set store cas
\endif
\if :{?confirm}
\else
    \set confirm no
\endif
\if :{?skip_id_checks}
\else
    \set skip_id_checks no
\endif

SET lock_timeout = '30s';

CREATE FUNCTION pg_temp.refuse(reason text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'drop_old_store: % (nothing was dropped)', reason;
END
$$;

-- The kind of a relation as pg_class has it ('r' table, 'v' view,
-- 'm' materialized view), '' when there is none.
CREATE FUNCTION pg_temp.kind(in_schema text, relation text) RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT coalesce(
        (SELECT c.relkind::text FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = in_schema AND c.relname = relation),
        '')
$$;

-- ---------------------------------------------------------------------------
-- The new store must be there to serve
-- ---------------------------------------------------------------------------

SELECT :'store' <> :'old_public' AND :'store' <> :'old_shared'
       AND pg_temp.kind(:'store', 'build') = 'r' AS has_store \gset
\if :has_store
\else
    SELECT pg_temp.refuse(format(
        'schema %s holds no content-addressed store: nothing would be left to serve',
        :'store'));
\endif
SELECT EXISTS (SELECT 1 FROM :"store".build WHERE enabled) AS serves \gset
\if :serves
\else
    SELECT pg_temp.refuse(format(
        '%s.build has no enabled build: nothing would be left to serve', :'store'));
\endif

-- ---------------------------------------------------------------------------
-- Which layout the old store has
-- ---------------------------------------------------------------------------

SELECT to_regnamespace(quote_ident(:'old_shared')) IS NOT NULL
           OR pg_temp.kind(:'old_public', 'game_versions') = 'r'
           OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname LIKE :'old_version_like')
           AS shared_layout,
       pg_temp.kind(:'old_public', 'items') = 'r' AS single_layout \gset

\if :shared_layout
    \if :single_layout
        SELECT pg_temp.refuse(format(
            'both layouts of the old store are here (a table %s.items and the '
            'shared store): decide by hand what is what', :'old_public'));
    \endif
\else
    \if :single_layout
    \else
        SELECT pg_temp.refuse(format(
            'no old store in database %s: neither a table %s.items (single '
            'version) nor schema %s, %s.game_versions or a schema like %s '
            '(shared store)',
            current_database(), :'old_public', :'old_shared', :'old_public',
            :'old_version_like'));
    \endif
\endif

-- What will go: `object` is reported, `statement` is run, both in `ord` order.
CREATE TEMP TABLE doomed (ord serial, object text, statement text);

\if :shared_layout
    SELECT pg_temp.kind(:'old_public', 'game_versions') = 'r' AS has_registry \gset
    \if :has_registry
        SELECT count(*) > 0 AS has_unlisted,
               coalesce(string_agg(nspname, ', ' ORDER BY nspname), '') AS unlisted
        FROM pg_namespace
        WHERE nspname LIKE :'old_version_like'
          AND nspname NOT IN (SELECT schema_name FROM :"old_public".game_versions) \gset
    \else
        SELECT count(*) > 0 AS has_unlisted,
               coalesce(string_agg(nspname, ', ' ORDER BY nspname), '') AS unlisted
        FROM pg_namespace
        WHERE nspname LIKE :'old_version_like' \gset
    \endif
    \if :has_unlisted
        SELECT pg_temp.refuse(format(
            'version schemas that %s.game_versions does not list, and so may '
            'not be the old store''s: %s', :'old_public', :'unlisted'));
    \endif

    INSERT INTO doomed (object, statement)
    SELECT format('schema %I with its %s relations', n.nspname,
                  (SELECT count(*) FROM pg_class c WHERE c.relnamespace = n.oid)),
           format('DROP SCHEMA %I CASCADE', n.nspname)
    FROM pg_namespace n
    WHERE n.nspname LIKE :'old_version_like'
    ORDER BY n.nspname;

    INSERT INTO doomed (object, statement)
    SELECT format('view %I.item_revisions', :'old_public'),
           format('DROP VIEW %I.item_revisions', :'old_public')
    WHERE pg_temp.kind(:'old_public', 'item_revisions') = 'v';

    INSERT INTO doomed (object, statement)
    SELECT format('schema %I with its %s relations', n.nspname,
                  (SELECT count(*) FROM pg_class c WHERE c.relnamespace = n.oid)),
           format('DROP SCHEMA %I CASCADE', n.nspname)
    FROM pg_namespace n
    WHERE n.nspname = :'old_shared';

    INSERT INTO doomed (object, statement)
    SELECT format('table %I.%I', :'old_public', name),
           format('DROP TABLE %I.%I', :'old_public', name)
    FROM unnest(ARRAY['game_versions', 'global_migrations']) AS name
    WHERE pg_temp.kind(:'old_public', name) = 'r';
\endif

\if :single_layout
    INSERT INTO doomed (object, statement)
    SELECT format('materialized view %I.symbiant_items', :'old_public'),
           format('DROP MATERIALIZED VIEW %I.symbiant_items', :'old_public')
    WHERE pg_temp.kind(:'old_public', 'symbiant_items') = 'm';

    -- Every table the old schema ever defined (database/schema.sql and
    -- database/migrations/ before the cutover); those that exist are dropped.
    CREATE TEMP TABLE old_tables AS
    SELECT name
    FROM unnest(ARRAY[
        'items', 'item_stats', 'stat_values',
        'item_spell_data', 'spell_data', 'spell_data_spells', 'spells',
        'spell_criteria', 'criteria',
        'actions', 'action_criteria',
        'attack_defense', 'attack_defense_attack', 'attack_defense_defense',
        'animation_mesh', 'item_shop_hash', 'shop_hash',
        'item_sources', 'sources', 'source_types',
        'mobs', 'perks', 'symbiants', 'pocket_bosses',
        'pocket_boss_symbiant_drops',
        'application_cache', 'schema_migrations'
    ]) AS name
    WHERE pg_temp.kind(:'old_public', name) = 'r';

    INSERT INTO doomed (object)
    SELECT format('table %I.%I', :'old_public', name) FROM old_tables ORDER BY name;

    INSERT INTO doomed (statement)
    SELECT 'DROP TABLE '
           || string_agg(format('%I.%I', :'old_public', name), ', ' ORDER BY name)
    FROM old_tables;
\endif

-- ---------------------------------------------------------------------------
-- The ids clients hold
-- ---------------------------------------------------------------------------

\if :single_layout
    \set old_items_schema :old_public
\else
    \set old_items_schema :old_shared
\endif
SELECT pg_temp.kind(:'old_items_schema', 'items') = 'r' AS has_old_items,
       pg_temp.kind(:'store', 'legacy_item_id') = 'r' AS has_map,
       :'single_layout'::boolean
           AND pg_temp.kind(:'old_public', 'mobs') = 'r' AS has_old_mobs \gset

\if :has_old_items
    \if :has_map
        SELECT count(*) AS old_items
        FROM :"old_items_schema".items
        WHERE aoid IS NOT NULL \gset
        SELECT count(*) AS unmapped
        FROM :"old_items_schema".items i
        WHERE i.aoid IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM :"store".legacy_item_id l
                          WHERE l.item_id = i.id AND l.aoid = i.aoid) \gset
    \else
        SELECT count(*) AS old_items, count(*) AS unmapped
        FROM :"old_items_schema".items
        WHERE aoid IS NOT NULL \gset
    \endif
\else
    \set old_items 0
    \set unmapped 0
\endif

\if :has_old_mobs
    SELECT count(*) AS old_mobs FROM :"old_public".mobs \gset
    SELECT count(*) AS mobs_differing
    FROM :"old_public".mobs o
    WHERE NOT EXISTS (SELECT 1 FROM :"store".mob m
                      WHERE m.mob_id = o.id AND m.name = o.name) \gset
\else
    \set old_mobs 0
    \set mobs_differing 0
\endif

SELECT count(*) AS other_sessions
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND backend_type = 'client backend' \gset

-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------

\echo Database :DBNAME - new store in schema :store
\echo Old store, to be dropped:
SELECT '  ' || object FROM doomed WHERE object IS NOT NULL ORDER BY ord;
\echo Item ids of the old store: :old_items - of them not in legacy_item_id of the new store with the same AOID: :unmapped
\if :has_old_mobs
    \echo Mob ids of the old store: :old_mobs - of them not naming the same mob in the new store: :mobs_differing
\endif
\echo Other sessions connected to this database: :other_sessions

SELECT (:unmapped > 0 OR :mobs_differing > 0)
       AND :'skip_id_checks' <> 'yes' AS ids_would_be_lost \gset
\if :ids_would_be_lost
    SELECT pg_temp.refuse(
        'ids that clients hold exist only in the old store: export and load '
        'them first (IMPORT_README.md), or pass -v skip_id_checks=yes');
\endif

SELECT :'confirm' = 'drop' AS confirmed \gset
\if :confirmed
\else
    \echo Nothing was dropped: this was a report. Run again with -v confirm=drop to drop the above.
    \quit
\endif

-- ---------------------------------------------------------------------------
-- Drop
-- ---------------------------------------------------------------------------

\if :single_layout
    BEGIN;
\endif
SELECT statement FROM doomed WHERE statement IS NOT NULL ORDER BY ord \gexec
\if :single_layout
    COMMIT;
\endif

\echo Dropped.
SELECT count(*) > 0 AS has_rest
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = :'old_public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f') \gset
\if :has_rest
    \echo Left in schema :old_public (not part of the old store as this script knows it):
    SELECT format('  %s %I', CASE c.relkind WHEN 'v' THEN 'view'
                                             WHEN 'm' THEN 'materialized view'
                                             ELSE 'table' END, c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = :'old_public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    ORDER BY c.relname;
\endif
