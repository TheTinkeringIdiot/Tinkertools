-- Content-addressed game data store.
-- Design: docs/plans/content-addressed-store/design.md (sections 3 and 4).
-- Canonical part documents and hashes: backend/app/core/parts.py.
--
-- The file is unqualified: run it with search_path set to the store's schema
-- (cas in a normal install). It creates everything extracted from client
-- builds. Curated data (perks, mobs, sources, nano metadata) and the tables
-- derived from it (nano properties, symbiants) are in
-- 002_curated_and_derived.sql.
--
-- Conventions
--   * A part row is immutable once written, except display-only fields that
--     are excluded from its hash (effect descriptions), which a re-import with
--     a newer extractor may overwrite.
--   * Parts get a surrogate integer id so revisions and projections stay
--     narrow; the hash is the content address and is unique.
--   * No timestamps (project rule: static game data has no audit trail).

-- Needed for the no-overlap constraint on item_presence. The extension is
-- trusted, so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Needed for the trigram indexes on part_text (substring search). Trusted as
-- well. Both extensions live in the schema of the database's first store:
-- when btree_gist is already installed, the importer installs pg_trgm next to
-- it before this file runs (cas_store.ensure_trigram_extension).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Builds
-- ---------------------------------------------------------------------------

-- One row per client build. Builds of one branch are ordered by ordinal.
-- A branch that forks from another (PRK from AO 17.10.5) records its parent.
CREATE TABLE build (
    build_id            smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug                varchar(40)  NOT NULL UNIQUE,
    branch              varchar(20)  NOT NULL,
    ordinal             integer      NOT NULL,
    -- position in the version list the API returns (/versions), newest first
    sort_order          integer      NOT NULL DEFAULT 0,
    display_name        varchar(120) NOT NULL,
    client_build        varchar(40),
    released_on         date,
    parent_build_id     smallint REFERENCES build (build_id),
    enabled             boolean NOT NULL DEFAULT true,
    is_default          boolean NOT NULL DEFAULT false,
    features            jsonb   NOT NULL DEFAULT '{}'::jsonb,
    extract_slug        varchar(40),
    rdb_dat_sha256      char(64),
    tinkerparse_commit  varchar(64),
    item_count          integer,
    notes               text,
    UNIQUE (branch, ordinal)
);
CREATE UNIQUE INDEX build_one_default ON build (is_default) WHERE is_default;

-- ---------------------------------------------------------------------------
-- Parts
-- ---------------------------------------------------------------------------

CREATE TABLE part_text (
    text_id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash         char(40) NOT NULL UNIQUE,
    name         text NOT NULL,
    description  text NOT NULL,
    -- Both texts in lower case, for substring search whatever the case:
    -- `name_lower LIKE lower(pattern)` is `name ILIKE pattern`, which lowers
    -- the text it reads under the database's collation for every row of
    -- every search. That is four fifths of the cost of a search that reads
    -- every text (220 ms of ILIKE against 50 ms of LIKE on 129,000 texts).
    name_lower         text GENERATED ALWAYS AS (lower(name)) STORED,
    description_lower  text GENERATED ALWAYS AS (lower(description)) STORED
);
CREATE INDEX part_text_name ON part_text (name);
CREATE INDEX part_text_name_lower ON part_text (lower(name));
CREATE INDEX part_text_name_fts ON part_text USING gin (to_tsvector('english', name));
CREATE INDEX part_text_desc_fts ON part_text USING gin (to_tsvector('english', description));
CREATE INDEX part_text_name_desc_fts ON part_text
    USING gin (to_tsvector('english', name || ' ' || description));
-- Substring search (LIKE '%term%' on the lower-case columns) reads two more
-- indexes, part_text_name_lower_trgm and part_text_desc_lower_trgm: gin
-- (name_lower gin_trgm_ops) and gin (description_lower gin_trgm_ops). The
-- importer creates them (cas_store.ensure_trigram_indexes), because
-- gin_trgm_ops has to be named with the schema pg_trgm is installed in, which
-- this unqualified file cannot know.
-- Interpolation groups the QL variants of an item by identical name and description.
CREATE INDEX part_text_variant ON part_text (md5(name), md5(description));

CREATE TABLE part_stats (
    stats_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash      char(40) NOT NULL UNIQUE,
    doc       jsonb NOT NULL
);

CREATE TABLE part_effects (
    effects_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash        char(40) NOT NULL UNIQUE,
    doc         jsonb NOT NULL
);

CREATE TABLE part_actions (
    actions_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash        char(40) NOT NULL UNIQUE,
    doc         jsonb NOT NULL
);

CREATE TABLE part_atkdef (
    atkdef_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash       char(40) NOT NULL UNIQUE,
    doc        jsonb NOT NULL
);

CREATE TABLE part_misc (
    misc_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hash     char(40) NOT NULL UNIQUE,
    doc      jsonb NOT NULL
);

-- Format template of each effect type, e.g. 53045 -> 'Modify {Stat} {Amount}'.
CREATE TABLE effect_type (
    spell_id  integer PRIMARY KEY,
    format    text NOT NULL
);

-- ---------------------------------------------------------------------------
-- Revisions and presence
-- ---------------------------------------------------------------------------

-- One row per distinct content an AOID has ever had. hash is the revision
-- hash of app/core/parts.py. ql and item_class are derived columns for
-- filtering and sorting and are not part of the hash: item_class is stat 76;
-- ql is stat 54 for an item and the curated QL for a nano (see nano_overlay in
-- 002_curated_and_derived.sql).
CREATE TABLE item_revision (
    rev_id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aoid        integer  NOT NULL,
    hash        char(40) NOT NULL,
    is_nano     boolean  NOT NULL,
    ql          integer  NOT NULL,
    item_class  integer  NOT NULL,
    text_id     integer  NOT NULL REFERENCES part_text (text_id),
    stats_id    integer  NOT NULL REFERENCES part_stats (stats_id),
    effects_id  integer  REFERENCES part_effects (effects_id),
    actions_id  integer  REFERENCES part_actions (actions_id),
    atkdef_id   integer  REFERENCES part_atkdef (atkdef_id),
    misc_id     integer  REFERENCES part_misc (misc_id),
    UNIQUE (aoid, hash)
);
CREATE INDEX item_revision_text ON item_revision (text_id);
CREATE INDEX item_revision_stats ON item_revision (stats_id);
CREATE INDEX item_revision_effects ON item_revision (effects_id) WHERE effects_id IS NOT NULL;
CREATE INDEX item_revision_actions ON item_revision (actions_id) WHERE actions_id IS NOT NULL;
CREATE INDEX item_revision_atkdef ON item_revision (atkdef_id) WHERE atkdef_id IS NOT NULL;

-- Which revision of an AOID a branch carries, as runs of consecutive builds:
-- the revision is the item's content in every build of the branch with
-- from_ordinal <= ordinal <= to_ordinal. A run that reaches the branch's newest
-- build is open and has to_ordinal = 2147483647, so importing a newer build
-- writes rows only for items that changed, appeared or disappeared. A closed
-- run must end at a build of the branch; the importer guarantees it (the
-- open-run sentinel rules out a foreign key).
-- "Item as of build N": aoid = ? AND from_ordinal <= N AND to_ordinal >= N.
CREATE TABLE item_presence (
    branch        varchar(20) NOT NULL,
    aoid          integer     NOT NULL,
    from_ordinal  integer     NOT NULL,
    to_ordinal    integer     NOT NULL DEFAULT 2147483647,
    rev_id        integer     NOT NULL REFERENCES item_revision (rev_id),
    PRIMARY KEY (branch, aoid, from_ordinal),
    CHECK (from_ordinal <= to_ordinal),
    -- the run starts at a build that exists
    FOREIGN KEY (branch, from_ordinal) REFERENCES build (branch, ordinal),
    -- an AOID has at most one revision in any build of a branch
    EXCLUDE USING gist (
        branch WITH =,
        aoid WITH =,
        int8range(from_ordinal, to_ordinal, '[]') WITH &&
    )
);
CREATE INDEX item_presence_range ON item_presence (branch, to_ordinal, from_ordinal);
CREATE INDEX item_presence_rev ON item_presence (rev_id);

-- ---------------------------------------------------------------------------
-- Search projections (derived from part documents at import)
-- ---------------------------------------------------------------------------

-- "Item has stat S with value op V", bitmask tests, absence of a stat.
CREATE TABLE stat_entry (
    stats_id  integer NOT NULL REFERENCES part_stats (stats_id) ON DELETE CASCADE,
    stat      integer NOT NULL,
    value     integer NOT NULL
);
CREATE INDEX stat_entry_stat_value ON stat_entry (stat, value, stats_id);
CREATE INDEX stat_entry_set ON stat_entry (stats_id, stat);

-- One row per criterion of each action, in evaluation order.
-- "Requires stat S op V", optionally scoped to an action (3 use, 8 wield).
CREATE TABLE requirement (
    actions_id  integer NOT NULL REFERENCES part_actions (actions_id) ON DELETE CASCADE,
    action      integer NOT NULL,
    position    integer NOT NULL,
    value1      integer NOT NULL,
    value2      integer NOT NULL,
    operator    integer NOT NULL,
    PRIMARY KEY (actions_id, action, position)
);
CREATE INDEX requirement_value ON requirement (value1, value2, actions_id);
CREATE INDEX requirement_action_value ON requirement (action, value1, value2, actions_id);

-- One row per effect. subject is the stat, skill or nano the effect acts on
-- (params Stat, else Skill, else NanoID); amount is params Amount. subject is
-- bigint because some nano ids in the client data exceed the integer range.
-- "Modifies stat S by op V", the offensive nano test, implant cluster sets.
CREATE TABLE effect_entry (
    effects_id  integer NOT NULL REFERENCES part_effects (effects_id) ON DELETE CASCADE,
    event       integer NOT NULL,
    spell_id    integer NOT NULL,
    target      integer,
    subject     bigint,
    amount      integer
);
CREATE INDEX effect_entry_subject ON effect_entry (spell_id, subject, amount, effects_id);
CREATE INDEX effect_entry_set ON effect_entry (effects_id, spell_id);

-- Attack and defense skill contributions. "Attack block has skill S >= V".
CREATE TABLE atkdef_entry (
    atkdef_id  integer NOT NULL REFERENCES part_atkdef (atkdef_id) ON DELETE CASCADE,
    is_attack  boolean NOT NULL,
    stat       integer NOT NULL,
    value      integer NOT NULL
);
CREATE INDEX atkdef_entry_stat ON atkdef_entry (is_attack, stat, value, atkdef_id);
CREATE INDEX atkdef_entry_set ON atkdef_entry (atkdef_id);

-- ---------------------------------------------------------------------------
-- Change log (written at import)
-- ---------------------------------------------------------------------------

-- A build-wide event that explains many item changes at once, such as a mass
-- rename or a renumbering, so default views can collapse them.
CREATE TABLE build_note (
    note_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    build_id  smallint NOT NULL REFERENCES build (build_id) ON DELETE CASCADE,
    title     text NOT NULL,
    body      text
);

-- One row per item per build in which it was added, removed or changed,
-- relative to the previous build of the branch (or, for a branch's first
-- build, relative to its parent build).
--   kind           'A' added, 'R' removed, 'C' changed
--   parts_changed  bitmask: 1 text, 2 stats, 4 effects, 8 actions, 16 atkdef, 32 misc
--   relevance      bitmask: 1 gameplay, 2 economy, 4 cosmetic, 8 text; NULL until classified
CREATE TABLE item_change (
    branch         varchar(20) NOT NULL,
    ordinal        integer     NOT NULL,
    aoid           integer     NOT NULL,
    kind           char(1)     NOT NULL CHECK (kind IN ('A', 'R', 'C')),
    old_rev_id     integer REFERENCES item_revision (rev_id),
    new_rev_id     integer REFERENCES item_revision (rev_id),
    parts_changed  smallint NOT NULL DEFAULT 0,
    relevance      smallint,
    note_id        integer REFERENCES build_note (note_id) ON DELETE SET NULL,
    PRIMARY KEY (branch, ordinal, aoid),
    FOREIGN KEY (branch, ordinal) REFERENCES build (branch, ordinal),
    CHECK ((kind = 'A') = (old_rev_id IS NULL)),
    CHECK ((kind = 'R') = (new_rev_id IS NULL))
);
CREATE INDEX item_change_aoid ON item_change (aoid, branch, ordinal);
