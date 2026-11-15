-- Content-addressed game data store: internal item ids of the store it replaced.
-- Design: docs/plans/content-addressed-store/design.md section 8 (2026-11-14).
-- Run like 001_store.sql, after it.
--
-- Clients used to persist the old store's internal item row ids (nano
-- favorites, symbiant farm lists, symbiant comparison links). This store never
-- issues such ids; POST /legacy-item-ids/resolve translates the ones clients
-- still hold from this table.
--
-- The rows are not derived from the extracts. They are a copy taken from the
-- database that issued the ids (backend/tools/export_legacy_item_ids.py) and
-- loaded by the importer when it is given the file (--legacy-ids-file). A
-- store loaded without the file has no rows here, and the route then says
-- that it has no map instead of reporting every id as unknown.
--
-- An id is scoped by branch, not by build: it was issued by the database that
-- served a family, and it keeps naming the same item in every later build of
-- that family. The route answers for an id only when the item is present in
-- the build asked about.
CREATE TABLE legacy_item_id (
    branch   varchar(20) NOT NULL,
    item_id  integer NOT NULL,
    aoid     integer NOT NULL,
    PRIMARY KEY (branch, item_id)
);
