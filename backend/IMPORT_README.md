# Loading the TinkerTools database

Game data lives in one PostgreSQL schema, the content-addressed store (`cas`; design in `docs/plans/content-addressed-store/design.md`, tables in `database/cas/`). The application reads nothing else, and one command writes it: `python import_cli.py import-cas`. This is the guide to loading a database from nothing, checking it, keeping it current, and replacing the production database of before the store ([Production cutover](#production-cutover)). A server is not loaded this way: it gets a dump of the store loaded here (`../DEPLOYMENT.md`).

## What goes in

| Input | Where | Maintained by |
|---|---|---|
| Extracted client builds | an extracts folder outside the repository: `index.json` and one `<slug>/{items.json,nanos.json,manifest.json}` per build (`docs/plans/content-addressed-store/extract-contract.md`) | `extract_builds.py` |
| Nano QL, strains, crystal sources | `all_nanos_compacted.csv` | hand |
| Perk metadata | `database/perks.json` | hand |
| Mobs and their drops | `database/symbiants.csv` | hand |
| The id of every mob | `database/mob_ids.csv` | hand, one line added per new mob |
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
- About 2 GB of memory per worker (`--workers`), and 1 GB of disk for the full store (147 builds: 934 MB with indexes when last measured, 979 MB the time before).

## Load a database from nothing

```bash
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --workers 8
```

It takes about 9 minutes for the 147 builds of the archive with 8 workers. Add `--legacy-ids-file` when replacing a database whose clients hold internal ids (see below).

What it does, in order:

1. Checks everything it will read before it writes anything: the extracts folder and its index, the manifest of every planned build, the curated files, `builds.toml`, the rules files, the legacy id file if one is given, and with that file whether the store will hold the newest build of each family it names. If one is missing or wrong, it stops.
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
| `--slug SLUG` | build to import, repeatable (default: every importable build of the index). A slug outside the index is taken from its folder's manifest. With `--legacy-ids-file` the selection must leave no family of the file without its newest build |
| `--schema NAME` | schema of the store (default `cas`) |
| `--workers N` | builds read and split in parallel, about 2 GB of memory each (default 4; 0 reads in the importer's process) |
| `--reset --yes` | drop the store's tables in `--schema`, the legacy id map with them, and import from scratch. Stop the API first and give `--legacy-ids-file` again |
| `--builds-file PATH` | default `database/builds.toml` |
| `--legacy-ids-file PATH` | make the store's map of old internal ids equal to this file; without the option the map is left as it is. Refused, before anything is written, unless the newest importable build of every family in the file is stored or among the builds of this run |
| `--nanos-csv`, `--perks-file`, `--symbiants-file`, `--mob-ids-file` | override the curated files (`~` and environment variables are expanded) |
| `--database-url URL` | override `DATABASE_URL` |

### Rules worth knowing

- Builds of a family are imported oldest first. A build older than the newest stored build of its family is refused: `--reset` and import again to insert one (with the API stopped).
- `duplicate` builds of the index (a client database identical to another build's) are stored without reading any data. `failed` and `missing_db` builds are skipped.
- The newest stored build of each family is the one served with the curated nano strains; the build before it goes back to its own strains in the transaction that stores the new one.
- A mob has the id `database/mob_ids.csv` gives its name, in every store and after every `--reset`, whatever the order of `symbiants.csv`. To add a mob, add its rows to `symbiants.csv` and a line with the next unused id to `mob_ids.csv`; the importer stops and names the line when it is missing. Never change or remove a line: browsers hold these ids. The importer refuses a file that would give a stored mob another id, or a stored id to another mob.
- A mob that leaves `symbiants.csv` is kept as a retired row while the store exists and keeps its line in `mob_ids.csv`, so its id is never given to another mob. A store loaded from nothing has no row for it.
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
| `all_nanos_compacted.csv`, `database/perks.json`, `database/symbiants.csv`, `database/mob_ids.csv` | curated data of every build | rows that differ are written on every run |
| `database/change_relevance.toml` | which stats and effect types are gameplay, economy or cosmetic, and how whole-part changes are classed (`id = "name"` under `[stats.<class>]` / `[effects.<class>]`; `unclassified` and unlisted ids take `default`) | `item_change.relevance` is recomputed for the whole log in one statement; the per-revision digests it is computed from are rebuilt first, as they are when the diff engine changed (`ANALYSIS_VERSION`) |
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

# into a store that is already loaded, without extracts: a server restored from a dump
python import_cli.py load-legacy-ids --legacy-ids-file legacy_item_ids.csv
```

- The file is CSV, `branch,item_id,aoid`.
- The import makes the table equal to the file, after the builds. A run without the option leaves the table alone.
- `load-legacy-ids` makes the table equal to the file in a store it does not import into (`--schema`, `--builds-file` and `--database-url` as for the import). It has no index of extracts to tell the newest build from, so it refuses when the store lacks a build that `database/builds.toml` describes, or holds no build of a family the file names. On a server it is run through `scripts/deploy/stack.sh legacy-ids` (`../DEPLOYMENT.md`).
- An id is resolved for the family of the requested version, and only when the item is present in that version.
- Without the file the route answers `{"aoids": {}, "available": false}` for that family. The frontend then keeps the user's stored ids and asks again on the next load, so loading the file later loses nothing; it does not treat the ids as unknown.
- A file from another database resolves ids to the wrong items, and a browser that got an answer for every id keeps no copy of what it held. Load only the file exported from the database the store replaces.

### Mob ids

`cas.mob` numbers mobs as `database/mob_ids.csv` says, and a mob that leaves `symbiants.csv` keeps its id. The committed ids are those of the development database. If the old database numbered its mobs differently, farm progress would tick the wrong bosses without any error. Check, against any loaded store (the two databases need not be the same one):

```bash
python tools/verify_cas.py --legacy-mobs-file legacy_mobs.csv
```

It ends with `N difference(s)` and exits 1 unless N is 0: an old id the store does not have, or one that names a mob of another name there. Mobs only the store has are new and are not differences. On the development database all 159 match. **Production has not been checked.** On a server the check is `./stack.sh mob-ids legacy_mobs.csv` (`../DEPLOYMENT.md`). If it differs, do not cut over. Mob ids are not translated; the store has to number its mobs as production did. `legacy_mobs.csv` has the two columns of `database/mob_ids.csv`: give the differing mobs production's ids there, keeping every id and every name on one line only, import with `--reset --yes` (the importer refuses to renumber a loaded store), check again, and dump and restore the store for the server. This has not been needed or rehearsed, and it renumbers the mobs of every store loaded from the repository afterwards, development's included.

A `--reset` reproduces the ids, since they come from the file and not from the order of `symbiants.csv`; the check can be repeated at any time against the same `legacy_mobs.csv`.

## Production cutover

Production today is the application of before the store: one game version, its tables in `public` (`items`, `item_stats`, `mobs`, ...), no `cas` schema, on its own server. It is not upgraded in place. A new server runs the container stack of `../DEPLOYMENT.md`, its database is restored from a dump of the development store, and the domains move last. The old production database is used for one thing: the two exports of the ids that browsers hold. Nothing is imported on either server.

Two things are **not done yet**:

- **The export has not been run against a production database.** `tools/export_legacy_item_ids.py` reads `public.items` and `public.mobs` with queries written from the schema on `main`; its tests use hand-made tables of that shape, and the only real database it has run against is development's shared store.
- **Production's mob ids have not been checked** against the store ([Mob ids](#mob-ids)).

In this order:

1. **Deploy the stack on the new server and restore the store**: `../DEPLOYMENT.md`, "Deploy with Coolify" steps 1 to 7. The site works under the server's address; the old production is untouched and serving.
2. **Export the ids** from the old production database with the command of [Ids that clients hold](#ids-that-clients-hold), run from a checkout of this code with `DATABASE_URL` naming that database (it only reads, and the database may be serving). Compare what it prints with `SELECT count(*) FROM items WHERE aoid IS NOT NULL` and `SELECT count(*) FROM mobs` there. Keep both files off the servers. Do not re-import the old database afterwards: that would issue new ids.
3. **Check the mob ids** on the new server: `./stack.sh mob-ids legacy_mobs.csv` must report 0 differences. Otherwise stop here and see [Mob ids](#mob-ids); the domains stay where they are.
4. **Load the map** on the new server: `./stack.sh legacy-ids legacy_item_ids.csv`. `./stack.sh status` then shows the counts per family that the export printed, and `POST /api/v1/ao/legacy-item-ids/resolve` with `{"item_ids": [<an id from the file>]}` answers `"available": true` and the AOID of the file.
5. **Move the domains** to the new server. Browsers translate their stored ids on their first load from it.
6. **Retire the old server**, days later, once nothing is missed. Keep the two CSV files.

Going back is possible at any point: the old server is not changed by any step, so the domains can be pointed at it again. A browser that has already translated its ids against the new server holds AOIDs, which the old application does not read; that part does not go back.

Steps 3 and 4 need the export of step 2 and nothing else. Until the map is loaded the new server answers `"available": false` and browsers keep their ids, so the domains can move before step 4 without loss, but not before step 3.

## Back up

What cannot be made again, and so must be kept somewhere other than the database server:

- `legacy_item_ids.csv` and `legacy_mobs.csv`: once the old database is gone they are the only record of its ids.
- The extracts folder: the store is built from it. Without it the store cannot be rebuilt or given a new build's predecessor.
- The repository holds the rest (curated files, `builds.toml`, the rules files).

The store itself is rebuilt from those in about 9 minutes ([Load a database from nothing](#load-a-database-from-nothing)) and comes out the same: a from-nothing import has been compared with the development store, digest by digest. That is the recovery procedure for the development database.

A server is not backed up at all. Its database is a copy of the development store, made with `../scripts/deploy/dump-store.sh` and loaded with `../scripts/deploy/stack.sh restore` (`../DEPLOYMENT.md`, "The data"), and can be made again from the development store at any time. That dump holds schema `cas` with its two extensions and leaves the legacy id map out, which a server gets from its own export. The restored store has been compared with the development store through the API (`tools/golden.py`, 977 of 977 responses).

A dump of the whole development database is the undo before something irreversible there:

```bash
pg_dump -Fc -f tinkertools.dump "$DATABASE_URL"                    # the whole database
pg_restore --no-owner -d "$EMPTY_DATABASE_URL" tinkertools.dump   # into an empty database
```

A plain `pg_dump --schema=cas` is not enough: the extensions the store's constraint and indexes depend on are objects of the database and are left out unless they are named (`--extension`, as `dump-store.sh` does).

## Removing the old store

`tools/drop_old_store.sql` removes the old store from a database that also holds the new one. It is irreversible; take the dump first. The production cutover above does not need it: the old production database is never given a store, and goes with its server.

```bash
psql "$DATABASE_URL" -f tools/drop_old_store.sql                    # report only
psql "$DATABASE_URL" -v confirm=drop -f tools/drop_old_store.sql    # drop what the report listed
```

- Without `confirm=drop` it lists what it would drop, how many of the old store's item ids the new store's map lacks per family, how many of its mob ids name another mob or none in the new store, and how many other sessions are connected, and drops nothing.
- It knows the two layouts the export knows. On production's (tables in `public`) it drops the tables of the old schema that exist and the materialized view `symbiant_items`, in one transaction and without `CASCADE`: if anything else depends on them it fails and drops nothing. What else is in `public` is left and listed. On development's it drops the `gv_*` schemas, `gd`, `public.item_revisions`, `public.game_versions` and `public.global_migrations`. There the schemas go one transaction each and with `CASCADE`, which also drops what depends on them from other schemas; the report lists the views and foreign keys it finds of that kind, and looks for no other kind.
- An item id is looked up under its family, as the API does. Development's layout names its families. Production's does not, so the script takes its ids to be of family `ao` and prints that; `-v family=NAME` says otherwise and must be the `--family` the ids were exported with. A map loaded under another family is reported as missing every id.
- Mob ids are compared on production's layout only. When the old store has no `mobs` table, or on development's layout, the report says that they were not checked.
- It refuses (exit status 3, nothing dropped) when schema `cas` has no enabled build or lacks `legacy_item_id` or `mob`, when it finds neither layout or both, when a `gv_*` schema is not in `public.game_versions`, and when an id of the old store is missing from the new one: an item id not in `cas.legacy_item_id` under its family with the same AOID, or a mob id that does not name the same mob in `cas.mob`. `-v skip_id_checks=yes` drops regardless of the ids; `-v store=NAME` names a store in another schema.
- It cannot tell whether an old application still runs against the database. Such an application fails once its tables are gone.
- It has been exercised on hand-made tables of both layouts in scratch schemas, not on a copy of production and, since development's old store was dropped with an earlier version of it, not on a real old store as it stands. Run the report first and read the list.

## Troubleshooting

- The import writes `import.log` in the directory it is run from. A failed build leaves the store as it was before that build (one transaction per build); fix the cause and run again.
- "Extracts folder not found", "No index.json", "No manifest for", "Data file not found", "Builds file not found": an input is missing; nothing was written.
- "is not newer than ..., the newest build of branch": a build cannot be inserted before stored ones. Stop the API, `--reset --yes` and import everything (with `--legacy-ids-file`: the reset empties the map), then start the API again; responses it cached before the reset are otherwise served until they expire.
- "--legacy-ids-file needs the newest build of every family it names": the run would have left the map in a store whose newest build of that family is an older one, against which browsers drop ids for good. Nothing was written. Add the build to the `--slug` selection, or load the map in a later run.
- "Mob '...' has no id: add the line ...": a mob was added to `symbiants.csv` without a line in `database/mob_ids.csv`. Add the line the message gives and commit both files.
- "has id N in the store and M in mob_ids.csv", "gives id N to ..., and the store holds it for ...": the id file contradicts the ids the store has served. Correct the file. Only when the store's ids are the wrong ones, `--reset --yes`.
- `permission denied to create extension`: the role lacks `CREATE` on the database, or the extension's package is not installed on the server.
- The API answers 404 "Unknown game version": the slug is not a stored, enabled build. `GET /api/v1/versions` lists what is.
- The API answers 503 "The game versions cannot be read": it could not read `cas.build` and holds no earlier copy of the list (database down, wrong `CAS_SCHEMA`, store not created). With a copy it keeps serving it and logs a warning each time a read fails (every `BUILD_REGISTRY_TTL` seconds); `GET /versions` answers from the list it read last in the same way.
