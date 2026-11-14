-- Content-addressed game data store: curated data and tables derived from it.
-- Runs after 001_store.sql, with the same search_path.
--
-- Curated data is maintained by hand (CSV files), not extracted from a client
-- build. It is stored once, keyed by AOID, and applies to every build in which
-- the items it names are present. Derived tables are computed at import from
-- parts plus curated data and can be rebuilt at any time.

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
-- (the overlay describes the current game), older builds keep their own valid
-- strain and use the overlay only to fill gaps (strains were reassigned over
-- the years). A strain value of NULL, 0 or 99999 is not valid.
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

-- A perk is an item with perk metadata. The perk applies in every build in
-- which the item is present.
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

-- mob_id is assigned by the curated data and is part of the API
-- (/mobs/{mob_id}) and of players' stored farm progress: it must stay the same
-- across imports. The importer assigns ids by mob name and never renumbers.
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
-- type 'mob'.
CREATE TABLE source (
    source_id       integer PRIMARY KEY,
    source_type_id  integer NOT NULL REFERENCES source_type (source_type_id),
    entity_id       integer NOT NULL,
    name            varchar(255) NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (source_type_id, entity_id)
);

-- An item's sources. A link applies in a build when the item is present in it
-- and, for a source of type 'item', when the source item is present too.
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
