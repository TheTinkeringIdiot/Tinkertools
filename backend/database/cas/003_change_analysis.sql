-- Content-addressed game data store: what the importer derives about changes.
-- Design: docs/plans/content-addressed-store/design.md section 3.4.
-- Written by backend/app/core/change_analysis.py from the rules in
-- backend/database/change_relevance.toml and build_notes.toml
-- (backend/app/core/change_rules.py). Run like 001_store.sql, after it.
--
-- Everything here can be derived again from the store and the two files; the
-- importer does so when a file changes.

-- One digest per relevance class of what a revision holds in that class: its
-- stats of the class, its effects of the class (whatever event they hang on),
-- the misc fields of the class, and the actions and attack/defense parts
-- under the class the rules give them. Two revisions of an item differ in a
-- class exactly when the digests of that class differ, so the relevance of
-- the change between any two revisions is a comparison of four numbers:
--   gameplay, economy, cosmetic   differ -> that class
--   text_id of the revisions      differs -> text
--   effects_id differs but `effects` (all effects, without their events)
--   does not                      -> the class the rules give `event`
-- This is how item_change.relevance is filled, and how a comparison of two
-- arbitrary builds is classified without reading a part.
CREATE TABLE revision_relevance (
    rev_id    integer PRIMARY KEY REFERENCES item_revision (rev_id) ON DELETE CASCADE,
    gameplay  bigint NOT NULL,
    economy   bigint NOT NULL,
    cosmetic  bigint NOT NULL,
    effects   bigint NOT NULL
);

-- Field transitions that at least two changed items of a build share
-- ("effect 53089 Chance 60 -> 100 on 760 items"): app.core.item_diff
-- .transitions of every changed item, counted. old and new are JSON values;
-- NULL is a side that does not exist or a value particular to the item.
--   items        changed items with the transition
--   occurrences  times it occurs in them
CREATE TABLE build_transition (
    branch       varchar(20) NOT NULL,
    ordinal      integer     NOT NULL,
    part         varchar(10) NOT NULL,
    path         text        NOT NULL,
    old          jsonb,
    new          jsonb,
    items        integer     NOT NULL,
    occurrences  integer     NOT NULL,
    FOREIGN KEY (branch, ordinal) REFERENCES build (branch, ordinal) ON DELETE CASCADE
);
CREATE INDEX build_transition_build ON build_transition (branch, ordinal, items DESC);

CREATE INDEX item_change_note ON item_change (note_id) WHERE note_id IS NOT NULL;

-- What the derived data was last computed from, so an import run recomputes
-- it only when a rules file or the diff engine changed.
--   relevance_rules  digest of change_relevance.toml
--   change_analysis  digest of build_notes.toml and the engine version
CREATE TABLE store_state (
    name   varchar(40) PRIMARY KEY,
    value  text NOT NULL
);
