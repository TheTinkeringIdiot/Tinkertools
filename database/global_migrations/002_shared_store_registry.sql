-- Global migration 002: registry columns for the shared revision store (design.md §12).
--
-- vid                 small integer id stored in gd.items.vids for every revision the
--                     version contains. Assigned when a version is installed into the store.
-- extract_slug        extract folder that holds this version's data; differs from slug
--                     for a build whose client database is identical to another build's.
-- tinkerparse_commit  extractor commit that produced the data (extract manifest).
-- rdb_dat_sha256      sha256 of the client's ResourceDatabase.dat (extract manifest).
--
-- The table -> view swap of public.item_revisions is done by app/core/shared_store.py
-- when the store is created, because the view reads gd.items.

ALTER TABLE public.game_versions ADD COLUMN IF NOT EXISTS vid SMALLINT UNIQUE;
ALTER TABLE public.game_versions ADD COLUMN IF NOT EXISTS extract_slug VARCHAR(40);
ALTER TABLE public.game_versions ADD COLUMN IF NOT EXISTS tinkerparse_commit VARCHAR(64);
ALTER TABLE public.game_versions ADD COLUMN IF NOT EXISTS rdb_dat_sha256 CHAR(64);

INSERT INTO public.global_migrations (version, name)
VALUES ('002', 'shared_store_registry')
ON CONFLICT (version) DO NOTHING;
