# Loading the TinkerTools database

Game data lives in one PostgreSQL schema, the content-addressed store (`cas`; design in `docs/plans/content-addressed-store/design.md`, tables in `database/cas/`). The application reads nothing else, and one command writes it: `python import_cli.py import-cas`. This is the guide to loading a database from nothing, checking it, and keeping it current.

## What goes in

| Input | Where | Maintained by |
|---|---|---|
| Extracted client builds | an extracts folder outside the repository: `index.json` and one `<slug>/{items.json,nanos.json,manifest.json}` per build (`docs/plans/content-addressed-store/extract-contract.md`) | `extract_builds.py` |
| Nano QL, strains, crystal sources | `all_nanos_compacted.csv` | hand |
| Perk metadata | `database/perks.json` | hand |
| Mobs and their drops | `database/symbiants.csv` | hand |
| How builds are presented: names, dates, the default build, curated features | `database/builds.toml` | hand |
| What a change means: relevance classes, build notes | `database/change_relevance.toml`, `database/build_notes.toml` | hand |
| Internal item ids of the old database (optional) | a file you export, see [Legacy item ids](#legacy-item-ids) | `tools/export_legacy_item_ids.py` |

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

Running it again changes nothing that is already right. A run that stopped can be repeated and picks up at the build it stopped on.

Then start the API (`uvicorn app.main:app`); it needs `DATABASE_URL` and nothing else from the database than schema `cas` (`CAS_SCHEMA` names another).

### Options

| option | meaning |
|---|---|
| `--extracts-dir DIR` | folder with `index.json` and the build folders (required) |
| `--slug SLUG` | build to import, repeatable (default: every importable build of the index). A slug outside the index is taken from its folder's manifest |
| `--schema NAME` | schema of the store (default `cas`) |
| `--workers N` | builds read and split in parallel, about 2 GB of memory each (default 4; 0 reads in the importer's process) |
| `--reset --yes` | drop the store's tables in `--schema` and import from scratch |
| `--builds-file PATH` | default `database/builds.toml` |
| `--legacy-ids-file PATH` | make the store's map of old internal ids equal to this file; without the option the map is left as it is |
| `--nanos-csv`, `--perks-file`, `--symbiants-file` | override the curated files (`~` and environment variables are expanded) |
| `--database-url URL` | override `DATABASE_URL` |

### Rules worth knowing

- Builds of a family are imported oldest first. A build older than the newest stored build of its family is refused: `--reset` and import again to insert one.
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

The API picks the new build up within a minute (`GAME_VERSION_REGISTRY_TTL`); the family alias (`ao`, `prk`) follows it. Commit `builds.toml`.

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
| `database/build_notes.toml` | build-wide events that explain many item changes at once, as rules over field transitions (`[[note]]` with `build`, `title`, `body`, `explains`, `alongside`) | notes, the note of each change and the shared transitions of each build are recomputed when either rules file changed (or the diff engine did: `ANALYSIS_VERSION`) |

The rules of the two change files are stated in the docstring of `app/core/change_rules.py`; the API's diff routes (`GET /changes`, `/compare/{base}`, `/items/{aoid}/timeline`; see `API.md`) read what is derived from them. A note whose build the store does not hold is ignored, and so is a `builds.toml` table for a build that is not extracted, so one set of files serves every store. The store records what it was analysed with; `verify_cas.py --store` reports a store either rules file has moved on from, and the API logs a warning at start-up when its files are not the store's.

Measured on the full store (147 builds, 263,959 revisions, 275,750 changes): the change analysis from scratch, as after a change to both rules files, takes 54 s. A new build adds the analysis of its own changes (5 s for the largest step, 14.8.0 with 48,881 changes).

Finding and checking build notes:

```bash
python tools/change_candidates.py --min-items 200            # every build
python tools/change_candidates.py ao-14-8-0 --min-items 100  # one build
```

It lists, per build, the field transitions shared by at least that many items, the change shapes shared by that many, and the number of changes each note of `build_notes.toml` explains as the file stands, before any import. `python -m pytest app/tests/test_change_rules_store.py` fails when a stat or effect type occurs in the store's changes and is in no section of `change_relevance.toml`.

## Legacy item ids

Before identity moved to the AOID, clients stored internal row ids of the database that served them: nano favorites, symbiant farm lists and symbiant comparison links (all three are ids of `items` rows). A store loaded from the extracts has never issued those ids. Clients translate what they still hold once, through `POST /legacy-item-ids/resolve`, which answers from a copy of `id -> aoid` taken from the old database.

```bash
# 1. against the database being replaced, before it is replaced (read-only)
DATABASE_URL=postgresql://...old... python tools/export_legacy_item_ids.py legacy_item_ids.csv

# 2. against the new database, with the first import or any later run
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --legacy-ids-file legacy_item_ids.csv
```

- The export knows two layouts: a database from before several versions were served (`public.items`; every id is filed under `--family`, default `ao`) and the shared revision store (`gd.items` with `public.game_versions`; each family gets the ids its versions held). If another family was served from a database of its own, export each with its `--family` and concatenate the files, keeping one header line.
- The file is CSV, `branch,item_id,aoid`. Keep it with the deployment's data, not in the repository: it belongs to one database.
- The import makes the table equal to the file. A run without the option leaves the table alone.
- An id is resolved for the family of the requested version, and only when the item is present in that version.
- Without the file the route answers `{"aoids": {}, "available": false}` for that family. The frontend then keeps the user's stored ids and asks again on the next load, so loading the file later loses nothing; it does not treat the ids as unknown.
- The old database is the only source of these ids. Export before dropping it.

## Removing the old store

A database that still holds the store this one replaced (schemas `gd` and `gv_*`, `public.game_versions`) can be cleared of it with `tools/drop_old_store.sql`, once the legacy ids are exported and a backup is taken. The script's header says what it removes; it is irreversible.

## Troubleshooting

- The import writes `import.log` in the directory it is run from. A failed build leaves the store as it was before that build (one transaction per build); fix the cause and run again.
- "Extracts folder not found", "No index.json", "No manifest for", "Data file not found", "Builds file not found": an input is missing; nothing was written.
- "is not newer than ..., the newest build of branch": a build cannot be inserted before stored ones. `--reset --yes` and import everything.
- `permission denied to create extension`: the role lacks `CREATE` on the database, or the extension's package is not installed on the server.
- The API answers 404 "Unknown game version": the slug is not a stored, enabled build. `GET /api/v1/versions` lists what is.
