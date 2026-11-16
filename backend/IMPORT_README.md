# Loading the TinkerTools database

Game data lives in one PostgreSQL schema, the content-addressed store (`cas`; design in `docs/plans/content-addressed-store/design.md`, tables in `database/cas/`). The application reads nothing else, and one command writes it: `python import_cli.py import-cas`. This is the guide to loading a database from nothing, checking it, keeping it current, and replacing the production database of before the store ([Production cutover](#production-cutover)).

## What goes in

| Input | Where | Maintained by |
|---|---|---|
| Extracted client builds | an extracts folder outside the repository: `index.json` and one `<slug>/{items.json,nanos.json,manifest.json}` per build (`docs/plans/content-addressed-store/extract-contract.md`) | `extract_builds.py` |
| Nano QL, strains, crystal sources | `all_nanos_compacted.csv` | hand |
| Perk metadata | `database/perks.json` | hand |
| Mobs and their drops | `database/symbiants.csv` | hand |
| How builds are presented: names, dates, the default build, curated features | `database/builds.toml` | hand |
| What a change means: relevance classes, build notes | `database/change_relevance.toml`, `database/build_notes.toml` | hand |
| Internal item ids of the old database (optional) | a file you export, see [Ids that clients hold](#ids-that-clients-hold) | `tools/export_legacy_item_ids.py` |

Everything but the extracts and the legacy id file is committed, and the importer reads it from the repository by default.

## Prerequisites

- PostgreSQL 13 or later and an empty database owned by the role in `DATABASE_URL`.
- The role may create a schema and the extensions `btree_gist` and `pg_trgm` in that database. Both extensions are trusted: `CREATE` on the database is enough, superuser is not needed. The importer creates the schema, the extensions and the tables itself.
- The extensions' packages are installed on the server (`postgresql-contrib` on Debian and Ubuntu).
- Python environment and connection:

  ```bash
  cd backend && source venv/bin/activate && set -a && . ./.env.local && set +a
  ```

  or `export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"`.
- The extracts folder on a local disk. Reading it from a network mount is slow and has failed part way.
- About 2 GB of memory per worker (`--workers`), and 1 GB of disk for the full store (147 builds: 920 MB).

## Load a database from nothing

```bash
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --workers 8
```

It takes about 9 minutes for the 147 builds of the archive with 8 workers. Add `--legacy-ids-file` when replacing a database whose clients hold internal ids (see below).

What it does, in order:

1. Checks everything it will read before it writes anything: the extracts folder and its index, the manifest of every planned build, the curated files, `builds.toml`, the rules files, the legacy id file if one is given. If one is missing or wrong, it stops.
2. Creates the schema, the extensions and the tables if they are not there; brings an existing store up to date with the SQL files otherwise.
3. Makes the curated tables equal to their files, the presentation of stored builds equal to `builds.toml`, and the change log's classification equal to the rules files.
4. Imports the builds the store does not hold, oldest first within each family, each in one transaction.
5. With `--legacy-ids-file`, makes the map of old internal ids equal to the file. This comes last on purpose: see below.

Running it again changes nothing that is already right. A run that stopped can be repeated and picks up at the build it stopped on.

Then start the API (`uvicorn app.main:app`); it needs `DATABASE_URL` and nothing else from the database than schema `cas` (`CAS_SCHEMA` names another).

**Do not serve a schema while it is first loaded or reset.** Every build is committed as it is stored, so an API reading the schema during those minutes serves a store whose newest build is an old one, and answers 404 while there is none. The legacy id map is written after the last build so that browsers cannot translate their stored ids against such a store (an id whose item the build lacks is dropped by the browser for good), but everything else a visitor sees would still be wrong. Stop the API, import, start it. Adding a build to a loaded store ([Add a new build](#add-a-new-build)) needs no stop.

### Options

| option | meaning |
|---|---|
| `--extracts-dir DIR` | folder with `index.json` and the build folders (required) |
| `--slug SLUG` | build to import, repeatable (default: every importable build of the index). A slug outside the index is taken from its folder's manifest |
| `--schema NAME` | schema of the store (default `cas`) |
| `--workers N` | builds read and split in parallel, about 2 GB of memory each (default 4; 0 reads in the importer's process) |
| `--reset --yes` | drop the store's tables in `--schema`, the legacy id map with them, and import from scratch. Stop the API first and give `--legacy-ids-file` again |
| `--builds-file PATH` | default `database/builds.toml` |
| `--legacy-ids-file PATH` | make the store's map of old internal ids equal to this file; without the option the map is left as it is |
| `--nanos-csv`, `--perks-file`, `--symbiants-file` | override the curated files (`~` and environment variables are expanded) |
| `--database-url URL` | override `DATABASE_URL` |

### Rules worth knowing

- Builds of a family are imported oldest first. A build older than the newest stored build of its family is refused: `--reset` and import again to insert one (with the API stopped).
- `duplicate` builds of the index (a client database identical to another build's) are stored without reading any data. `failed` and `missing_db` builds are skipped.
- The newest stored build of each family is the one served with the curated nano strains; the build before it goes back to its own strains in the transaction that stores the new one.
- A mob that leaves `symbiants.csv` is kept as a retired row, so its id is never given to another mob.
- **Never `DROP SCHEMA cas`.** `btree_gist` and `pg_trgm` live in the schema the first store of the database was created in, and dropping that schema takes them with it, and with them the presence constraint and the trigram indexes of every other store in the database. Use `--reset --yes`, which drops tables only.

## Verify

```bash
# the store as a whole: search projections against the part documents, presence,
# change log and strain policy rules, the change log against the rules files,
# and the item count of every build against its extract's manifest
python tools/verify_cas.py --store --extracts-dir ~/projects/AO/extracts

# one build, every part document against the raw extract
python tools/verify_cas.py ao-17-10-5 --extracts-dir ~/projects/AO/extracts
```

Both end with `N difference(s)` and exit 1 unless N is 0; exit 2 means the check could not be run (no store in `--schema`, no extract, a build the store does not hold). `--schema NAME` checks another store, `--show N` prints more examples. The store is only read.

Then the application: `GET /api/v1/versions` lists the builds, and `python -m pytest app/tests -q` passes against the loaded database (the tests of real game data read the `cas` store of `DATABASE_URL`).

A change that should not alter API responses is checked against responses captured before it, with `tools/golden.py` (see "Golden comparison" in `app/store/__init__.py`).

## Add a new build

After a game patch:

```bash
# 1. extract the installed clients into the extracts folder (no database involved)
python extract_builds.py --extracts-dir ~/projects/AO/extracts --tinkerparse ~/projects/TinkerParse \
    --live "~/.wine/drive_c/Funcom/Anarchy Online" --prk ~/.prk/drive_c/ProjectRubiKa

# 2. describe the new build: in database/builds.toml, move `default` and the curated
#    `features` from the old live build's table to a table for the new slug,
#    and give it a display name and a date

# 3. import: stores the new build and brings the old one's presentation in line
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts

# 4. check
python tools/verify_cas.py --store --extracts-dir ~/projects/AO/extracts
python tools/verify_cas.py <new-slug> --extracts-dir ~/projects/AO/extracts
```

The API picks the new build up within a minute (`BUILD_REGISTRY_TTL`); the family alias (`ao`, `prk`) follows it. Commit `builds.toml`.

`extract_builds.py` needs `git`, `dotnet` (.NET 8) and, for archives, `7z`:

- The parser is built from one pinned commit (`TINKERPARSE_COMMIT` in the script), whatever the checkout's working tree holds. Content hashes cover parser-generated fields, so change the pin for every build or for none: after changing it, extract every source again and import with `--reset`.
- A build is named by its client: `version.id` for `--live`, `patch.version` for `--prk`, the folder name otherwise. `18.8.62_EP1` becomes `ao-18-8-62-ep1`.
- A build whose folder already holds the same client database from the same parser commit is skipped (`--force` parses it again). Parsing is deterministic.
- Builds with an identical client database are parsed once; the others are indexed as `duplicate`. A client without `ResourceDatabase.dat` and `.idx` is `missing_db`. A build the parser cannot read is `failed` and gets no folder.
- Historical builds come from archives and folders of unpacked clients: `--archive DIR --builds-dir DIR --work-dir DIR`. Each archive is unpacked once into `--work-dir` (up to about 45 GB) and removed when its builds are done. Progress goes to `<extracts-dir>/extract.log`.
- `index.json` is rewritten after every source and keeps the builds of earlier runs.

## Edit the files and run again

Every committed input is applied by running `import-cas` again. With every build stored it imports nothing and takes seconds.

| File | What an edit changes | Applied |
|---|---|---|
| `database/builds.toml` | a build's name, date, list position, whether it is enabled or the default, its curated features, its notes (fields in the docstring of `app/core/cas_extract.py`). A build without a table takes the defaults. `parent` (the build a family forks from) is read only when the build is first imported | to stored builds on every run |
| `all_nanos_compacted.csv`, `database/perks.json`, `database/symbiants.csv` | curated data of every build | rows that differ are written on every run |
| `database/change_relevance.toml` | which stats and effect types are gameplay, economy or cosmetic, and how whole-part changes are classed (`id = "name"` under `[stats.<class>]` / `[effects.<class>]`; `unclassified` and unlisted ids take `default`) | `item_change.relevance` is recomputed for the whole log in one statement; the per-revision digests it is computed from are rebuilt first |
| `database/build_notes.toml` | build-wide events that explain many item changes at once, as rules over field transitions (`[[note]]` with `build`, `title`, `body`, `explains`, `alongside`, `partial`) | notes, the note of each change and the shared transitions of each build are recomputed when either rules file changed (or the diff engine did: `ANALYSIS_VERSION`) |

The rules of the two change files are stated in the docstring of `app/core/change_rules.py`; the API's diff routes (`GET /changes`, `/compare/{base}`, `/items/{aoid}/timeline`; see `API.md`) read what is derived from them. A note whose build the store does not hold is ignored, and so is a `builds.toml` table for a build that is not extracted, so one set of files serves every store. The store records what it was analysed with; `verify_cas.py --store` reports a store either rules file has moved on from, and the API logs a warning at start-up when its files are not the store's.

Measured on the full store (147 builds, 263,959 revisions, 275,750 changes): the change analysis from scratch, as after a change to both rules files, takes 54 s. A new build adds the analysis of its own changes (5 s for the largest step, 14.8.0 with 48,881 changes).

Finding and checking build notes:

```bash
python tools/change_candidates.py --min-items 200            # every build
python tools/change_candidates.py ao-14-8-0 --min-items 100  # one build
```

It lists, per build, the field transitions shared by at least that many items, the change shapes shared by that many, and the number of changes each note of `build_notes.toml` explains as the file stands, before any import. `python -m pytest app/tests/test_change_rules_store.py` fails when a stat or effect type occurs in the store's changes and is in no section of `change_relevance.toml`.

## Ids that clients hold

Users' data lives in their browsers, and some of it names rows of the database that served them. Two kinds of id outlive a database:

- **Internal item ids**: nano favorites and symbiant comparison links held `items.id` before identity moved to the AOID. The new store never issues those ids, so they are translated: [Legacy item ids](#legacy-item-ids). (Symbiant farm lists have held AOIDs since production first had them. The frontend also translates a farm list in an id-based shape, should a browser hold one.)
- **Mob ids**: farm progress and links to a boss hold `mobs.id`. These are not translated. The new store is expected to give every mob the id it had, and that is checked: [Mob ids](#mob-ids).

Both come from the old database and from nowhere else. Export them before it is replaced, and keep the two files with the deployment's data, not in the repository: they belong to one database.

```bash
# against the database being replaced (read-only; it may be serving)
DATABASE_URL=postgresql://...old... python tools/export_legacy_item_ids.py \
    legacy_item_ids.csv --mobs-file legacy_mobs.csv
```

The export knows two layouts: a database from before several versions were served (`public.items`, `public.mobs`; every item id is filed under `--family`, default `ao`) and the shared revision store of development (`gd.items` with `public.game_versions`; each family gets the ids its versions held, and the mobs are those of the default version). If another family was served from a database of its own, export each with its `--family` and concatenate the id files, keeping one header line. It prints the number of ids per family and of mobs; exit status 2 means the database has neither layout.

### Legacy item ids

Clients translate the item ids they still hold once, through `POST /legacy-item-ids/resolve`, which answers from the copy of `id -> aoid` in `cas.legacy_item_id`.

```bash
# against the new database, with the first import or any later run
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --legacy-ids-file legacy_item_ids.csv
```

- The file is CSV, `branch,item_id,aoid`.
- The import makes the table equal to the file, after the builds. A run without the option leaves the table alone.
- An id is resolved for the family of the requested version, and only when the item is present in that version.
- Without the file the route answers `{"aoids": {}, "available": false}` for that family. The frontend then keeps the user's stored ids and asks again on the next load, so loading the file later loses nothing; it does not treat the ids as unknown.
- A file from another database resolves ids to the wrong items, and a browser that got an answer for every id keeps no copy of what it held. Load only the file exported from the database the store replaces.

### Mob ids

`cas.mob` numbers mobs in the order they first appear in `database/symbiants.csv`, and a mob that leaves the file keeps its id. If the old database numbered them differently, farm progress would tick the wrong bosses without any error. Check, against any loaded store (the two databases need not be the same one):

```bash
python tools/verify_cas.py --legacy-mobs-file legacy_mobs.csv
```

It ends with `N difference(s)` and exits 1 unless N is 0: an old id the store does not have, or one that names a mob of another name there. Mobs only the store has are new and are not differences. On the development database all 159 match. **Production has not been checked.** If it differs, do not cut over: nothing translates mob ids yet, and that would have to be written first (the file is what it would be written from).

## Production cutover

Production today is the application of before the store: one game version, its tables in `public` (`items`, `item_stats`, `mobs`, ...), no `cas` schema. This is the order to replace it in. Two things are **not done yet**:

- **The deployment scripts and configuration have not been updated for the new store.** The steps below name what must happen, not the commands of the production host. Settings production does not have yet, all with defaults (`app/core/config.py`): `DEFAULT_GAME_VERSION`, `CAS_SCHEMA`, `BUILD_REGISTRY_TTL` and `RESPONSE_CACHE_MAX_BYTES`; see "Production Deployment" in `README.md` for what the last means for the number of workers. Requirements that went: `alembic`, `asyncpg`, `ijson`, `psutil`, `rich`.
- **The export has not been run against a production database.** `tools/export_legacy_item_ids.py` reads `public.items` and `public.mobs` with queries written from the schema on `main`; its tests use hand-made tables of that shape, and the only real database it has run against is development's shared store. Rehearse steps 1 and 2 on a copy of production before the day. The same holds for `tools/drop_old_store.sql` on that layout (step 9).

Before the day, production untouched and serving:

1. **Export the ids** from production with the command of [Ids that clients hold](#ids-that-clients-hold), run from a checkout of this code. Compare what it prints with `SELECT count(*) FROM items WHERE aoid IS NOT NULL` and `SELECT count(*) FROM mobs`. Copy both files off the server. Do not re-import the old database afterwards: that would issue new ids.
2. **Check the mob ids** against a loaded store, for example development's: `python tools/verify_cas.py --legacy-mobs-file legacy_mobs.csv` must report 0 differences. Otherwise stop here.
3. **Put the extracts folder on a local disk** of the machine that will run the import (40 GB with all 147 builds). The import needs the folder, this repository and `DATABASE_URL`, not the application server.

On the day:

4. **Back up** the production database: `pg_dump -Fc -f before_cutover.dump "$DATABASE_URL"`. Keep it off the server. It is the only undo for step 9.
5. **Stop the API.**
6. **Deploy the backend** of this code and install `requirements.txt`. Do not start it. The role in `DATABASE_URL` needs `CREATE` on the database (see [Prerequisites](#prerequisites)).
7. **Import**, with the map: `python import_cli.py import-cas --extracts-dir DIR --workers 8 --legacy-ids-file legacy_item_ids.csv`. About 9 minutes. It writes schema `cas` only; the old tables in `public` are not read or changed.
8. **Verify**, then start:
   - `python tools/verify_cas.py --store --extracts-dir DIR` and `python tools/verify_cas.py <live slug> --extracts-dir DIR`: 0 differences each.
   - `python tools/verify_cas.py --legacy-mobs-file legacy_mobs.csv`: 0 differences, now against production's own store.
   - `SELECT branch, count(*) FROM cas.legacy_item_id GROUP BY branch` gives the counts the export printed.
   - Start the API. `GET /health`, `GET /api/v1/versions`, an item page; `POST /api/v1/ao/legacy-item-ids/resolve` with `{"item_ids": [<an id from the file>]}` answers `"available": true` and the AOID of the file.
   - Deploy the frontend, after the backend: it needs the new API. Browsers translate their stored ids on their first load.
9. **Drop the old tables**, days later, once nothing is missed: [Removing the old store](#removing-the-old-store). Keep the two CSV files and the dump after that too.

Going back is possible until step 9: stop the API, deploy the old backend and frontend, start. The old tables are as they were. Browsers that loaded the new frontend have by then rewritten their stored lists as AOIDs, which the old frontend was not written for, so go back early or not at all.

The import of step 7 writes nothing the old application reads, so it could run while the old API still serves and shorten the stop to the switch of code. That has not been rehearsed.

A new, empty database instead of the same one works the same way: steps 1 to 8 with `DATABASE_URL` naming the new database from step 6 on, and in place of step 9 the old database is dropped whole (`DROP DATABASE`) once the dump is safe.

## Back up

What cannot be made again, and so must be kept somewhere other than the database server:

- `legacy_item_ids.csv` and `legacy_mobs.csv`: once the old database is gone they are the only record of its ids.
- The extracts folder: the store is built from it. Without it the store cannot be rebuilt or given a new build's predecessor.
- The repository holds the rest (curated files, `builds.toml`, the rules files).

The store itself is rebuilt from those in about 9 minutes ([Load a database from nothing](#load-a-database-from-nothing)) and comes out the same: a from-nothing import has been compared with the development store, digest by digest. That is the recovery procedure. A dump is a convenience on top of it, and the undo before something irreversible:

```bash
pg_dump -Fc -f tinkertools.dump "$DATABASE_URL"                    # the whole database
pg_restore --no-owner -d "$EMPTY_DATABASE_URL" tinkertools.dump   # into an empty database
```

Dump the whole database, not schema `cas` alone: the extensions the store's constraint and indexes depend on are objects of the database and are left out of a schema dump. Restoring a dump has not been rehearsed for this store; the import has.

## Removing the old store

`tools/drop_old_store.sql` removes the old store from a database that also holds the new one. It is irreversible; take the dump first.

```bash
psql "$DATABASE_URL" -f tools/drop_old_store.sql                    # report only
psql "$DATABASE_URL" -v confirm=drop -f tools/drop_old_store.sql    # drop what the report listed
```

- Without `confirm=drop` it lists what it would drop, how many of the old store's item and mob ids the new store does not hold, and how many other sessions are connected, and drops nothing.
- It knows the two layouts the export knows. On production's (tables in `public`) it drops the tables of the old schema that exist and the materialized view `symbiant_items`, in one transaction and without `CASCADE`: if anything else depends on them it fails and drops nothing. What else is in `public` is left and listed. On development's it drops the `gv_*` schemas, `gd`, `public.item_revisions`, `public.game_versions` and `public.global_migrations`.
- It refuses (exit status 3, nothing dropped) when schema `cas` has no enabled build, when it finds neither layout or both, when a `gv_*` schema is not in `public.game_versions`, and when an id of the old store is missing from the new one: an item id not in `cas.legacy_item_id` with the same AOID, or on production's layout a mob id that does not name the same mob in `cas.mob`. `-v skip_id_checks=yes` drops regardless; `-v store=NAME` names a store in another schema.
- It cannot tell whether an old application still runs against the database. Such an application fails once its tables are gone.
- It has been exercised on hand-made tables of both layouts, not on a copy of production. Run the report there first and read the list.

## Troubleshooting

- The import writes `import.log` in the directory it is run from. A failed build leaves the store as it was before that build (one transaction per build); fix the cause and run again.
- "Extracts folder not found", "No index.json", "No manifest for", "Data file not found", "Builds file not found": an input is missing; nothing was written.
- "is not newer than ..., the newest build of branch": a build cannot be inserted before stored ones. Stop the API, `--reset --yes` and import everything (with `--legacy-ids-file`: the reset empties the map), then start the API again; responses it cached before the reset are otherwise served until they expire.
- `permission denied to create extension`: the role lacks `CREATE` on the database, or the extension's package is not installed on the server.
- The API answers 404 "Unknown game version": the slug is not a stored, enabled build. `GET /api/v1/versions` lists what is.
- The API answers 503 "The game versions cannot be read": it could not read `cas.build` and holds no earlier copy of the list (database down, wrong `CAS_SCHEMA`, store not created). With a copy it keeps serving it and logs a warning each time a read fails (every `BUILD_REGISTRY_TTL` seconds).
