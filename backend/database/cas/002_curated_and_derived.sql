-- Content-addressed game data store: curated data and tables derived from it.
-- Runs after 001_store.sql, with the same search_path.
--
-- Curated data is maintained by hand (CSV files), not extracted from a client
-- build. It is stored once, keyed by AOID. Derived tables are computed at
-- import from parts plus curated data and can be rebuilt at any time.
--
-- Where curated data applies. A curated fact is served for a build only when
--   1. the items it names are present in that build, and
--   2. the build's features flag for it is on (build.features, the keys of
--      public.game_versions.features today: items, nanos, perks, sources,
--      symbiants): "perks" for perk, "symbiants" for mob and for sources of
--      type mob, "sources" for sources of type item.
-- Today "perks" and "symbiants" are on only for the newest AO build and PRK,
-- and "sources" on every build. An old build therefore answers "not found"
-- for a perk lookup and lists no mobs even though the perk items and
-- symbiants exist in it. No route reads the flags today: the effect comes
-- from the per-version tables being empty. The new read path has to apply
-- the flags itself.
--
-- Inputs. backend/database/symbiants.csv (tracked) for mobs and their drops.
-- The nano CSV (all_nanos_compacted.csv) and the perk data (perks.json) are
-- not in the repository; their locations are given to the importer.

-- ---------------------------------------------------------------------------
-- Curated: nano metadata (all_nanos_compacted.csv)
-- ---------------------------------------------------------------------------

-- The client stores every nano with QL 1 and many without a strain; the real
-- values are curated. One row per nano AOID, the same for every build.
--
-- How these values reach the API:
--   * QL. item_revision.ql of a nano revision is nano_overlay.ql (1 when the
--     nano has no overlay row). It is a derived column outside the revision
--     hash and is rewritten for the AOID's revisions when this table changes.
--   * Strain and substrain. The effective values are in nano_properties. In
--     responses, a nano's stats are its stats part with stat 75 (NanoStrain)
--     and stat 1003 (NanoSubStrain) replaced by the effective values.
CREATE TABLE nano_overlay (
    aoid       integer PRIMARY KEY,
    ql         integer NOT NULL,
    strain     integer,
    substrain  integer
);

-- Which strain wins when a build's own data and the overlay disagree is a
-- property of the build: the newest AO build and PRK take the overlay's strain
-- (the overlay describes the current game); older builds keep their own
-- strain when they have a usable one (strains were reassigned over the years).
--
-- The exact rule, which reproduces backend/update_nanos.py. For a nano
-- revision with an overlay row, "own" being the revision's own stat 75 and
-- "usable" meaning not absent, not 0 and not 99999:
--   1. If the build is not overlay_strain_first, own is usable and own differs
--      from the overlay strain: keep own strain AND own substrain untouched.
--      Substrain always follows the strain decision; it is never filled in on
--      its own.
--   2. Otherwise: strain becomes the overlay strain when that is > 0, else it
--      stays as own; substrain becomes the overlay substrain when that is > 0,
--      else it stays as own.
-- A nano without an overlay row keeps its own values. Own values of 0 or 99999
-- that survive these rules are kept as they are, in nano_properties.strain and
-- in the stats of a response: they are not turned into NULL.
--
-- Everything that filters or groups by strain (/items?strain=, /nanos strain
-- filters, the "has a real strain" test of the profession lists, strain
-- counts) reads nano_properties, never stat_entry, because stat_entry holds
-- only the build's own value.
ALTER TABLE build ADD COLUMN overlay_strain_first boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Derived: nano properties
-- ---------------------------------------------------------------------------

-- School, casting professions and minimum caster level of a nano revision
-- (app/core/nano_properties.py evaluates the Use action's criteria), with its
-- effective strain. A revision has one row per strain policy under which it is
-- served, so a query joins on the build's overlay_strain_first.
CREATE TABLE nano_properties (
    rev_id                integer  NOT NULL REFERENCES item_revision (rev_id) ON DELETE CASCADE,
    overlay_strain_first  boolean  NOT NULL,
    school                smallint,
    professions           integer[] NOT NULL DEFAULT '{}',
    min_level             smallint,
    strain                integer,
    substrain             integer,
    PRIMARY KEY (rev_id, overlay_strain_first)
);
CREATE INDEX nano_properties_strain ON nano_properties (strain, overlay_strain_first);
CREATE INDEX nano_properties_school ON nano_properties (school);
CREATE INDEX nano_properties_professions ON nano_properties USING gin (professions);
CREATE INDEX nano_properties_min_level ON nano_properties (min_level);

-- ---------------------------------------------------------------------------
-- Derived: symbiants
-- ---------------------------------------------------------------------------

-- Item revisions that are symbiants: name matches
-- 'Symbiant.*Unit (Aban|Alpha|Beta)$'. family is Artillery, Control,
-- Extermination, Infantry or Support, read from the name; slot_id is the
-- highest value of stat 298.
CREATE TABLE symbiant_items (
    rev_id   integer PRIMARY KEY REFERENCES item_revision (rev_id) ON DELETE CASCADE,
    aoid     integer NOT NULL,
    name     text    NOT NULL,
    ql       integer NOT NULL,
    slot_id  integer,
    family   text
);
CREATE INDEX symbiant_items_order ON symbiant_items (family, ql, name);
CREATE INDEX symbiant_items_aoid ON symbiant_items (aoid);

-- ---------------------------------------------------------------------------
-- Curated: perks
-- ---------------------------------------------------------------------------

-- A perk is an item with perk metadata.
CREATE TABLE perk (
    aoid               integer PRIMARY KEY,
    name               varchar(128) NOT NULL,
    perk_series        varchar(128) NOT NULL,
    counter            integer NOT NULL,
    type               varchar(3) NOT NULL,
    level_required     integer NOT NULL,
    ai_level_required  integer,
    professions        integer[] NOT NULL DEFAULT '{}',
    breeds             integer[] NOT NULL DEFAULT '{}'
);
CREATE INDEX perk_series ON perk (perk_series, counter);

-- ---------------------------------------------------------------------------
-- Curated: mobs and item sources
-- ---------------------------------------------------------------------------

-- mob_id is part of the API (/mobs/{mob_id}) and of players' stored farm
-- progress, so it must stay the same across imports. The ids in use today are
-- the order of first appearance in backend/database/symbiants.csv, identical
-- on the newest AO build and PRK. The importer keeps those ids: a mob already
-- known keeps its id whatever the file order, and a new mob gets the next
-- free one.
CREATE TABLE mob (
    mob_id          integer PRIMARY KEY,
    name            varchar(255) NOT NULL UNIQUE,
    level           integer,
    playfield       varchar(100),
    location        varchar(255),
    mob_names       text[],
    is_pocket_boss  boolean NOT NULL DEFAULT true,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX mob_playfield ON mob (playfield);
CREATE INDEX mob_level ON mob (level, name);

CREATE TABLE source_type (
    source_type_id  integer PRIMARY KEY,
    name            varchar(50) NOT NULL UNIQUE,
    description     text
);

-- Something an item comes from. entity_id names the thing itself: the AOID of
-- the item for type 'item' (a nanocrystal that uploads a nano), the mob_id for
-- type 'mob'. The API returns entity_id as "source_id".
--
-- source_id is an internal key: the API's "id" of a source is not stable
-- across builds today and is not part of the contract.
--
-- name is stored for sources that have a name of their own (mobs). For a
-- source of type 'item' it is NULL: the name returned is the source item's
-- name in the requested build, because item names change between builds. The
-- same holds for the "crystal_name" the API returns in an item source's
-- extra data; item_source.metadata does not store it.
CREATE TABLE source (
    source_id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_type_id  integer NOT NULL REFERENCES source_type (source_type_id),
    entity_id       integer NOT NULL,
    name            varchar(255),
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (source_type_id, entity_id)
);

-- An item's sources. A link applies in a build when the item is present in it
-- and, for a source of type 'item', when the source item is present too (and
-- the build's feature flag is on, see the top of this file).
CREATE TABLE item_source (
    aoid        integer NOT NULL,
    source_id   integer NOT NULL REFERENCES source (source_id) ON DELETE CASCADE,
    drop_rate   numeric(5, 2),
    min_ql      integer,
    max_ql      integer,
    conditions  text,
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (aoid, source_id)
);
CREATE INDEX item_source_source ON item_source (source_id);
