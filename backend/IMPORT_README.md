# TinkerTools Data Import Utility

A standalone utility for importing game data into the TinkerTools database. It is separate from the main FastAPI application and uses the `DATABASE_URL` environment variable to connect to any database.

## Game versions and the shared store

TinkerTools serves several snapshots of the game database side by side: live Anarchy Online, Project Rubi-Ka, and historical client builds. Each snapshot is a **game version** with a slug (`ao-2024-02`, `prk-2026-01`, `ao-17-10-5`).

Game content is stored once, in the **shared revision store** (schema `gd`, design.md §12):

| where | what |
|---|---|
| `gd.items` | one row per distinct item revision; `vids SMALLINT[]` lists the versions holding it, `storage_fp` is the dedup key |
| `gd.*` | every other content table (`item_stats`, `spells`, `actions`, `attack_defense`, ...), the interned `stat_values` and `criteria`, and `nano_properties` keyed by revision id |
| `gd.schema_migrations` | which `database/migrations` files the store's content tables carry |
| `gv_<slug>` | views over `gd` (`items` filtered by the version's vid, the rest passed through), the version's `symbiant_items` materialized view, and its curated real tables: `perks`, `mobs`, `sources`, `source_types`, `item_sources`, `application_cache`, `schema_migrations` |
| `public.game_versions` | the registry: slug, vid, family, lineage, client build, feature flags, extract provenance (`extract_slug`, `tinkerparse_commit`, `rdb_dat_sha256`) |
| `public.item_revisions` | a view over `gd.items`: one row per (AOID, version) with the content hashes, for "changed in patch X" |
| `public.global_migrations` | tracking for `database/global_migrations/*.sql` |

An item that is identical in several versions is one row with several vids. A version's own `items.id` values are revision ids, so an unchanged item has the same id in every version.

The API is unchanged: a request's `search_path` is `gv_<slug>, public`, and the views look like the old tables.

### How an import works

1. Global migrations are applied to `public`.
2. The dump is loaded into a **staging schema** `gv_stage_<slug>`, built fresh from `database/migrations`, with the same importer code as before.
3. Curated overlays run in staging: `--nanos-csv` applies `update_nanos.py` (crystal sources, nano QL, strain and substrain). Then `nano_properties` is derived.
4. Install, in one transaction under an advisory lock (`app/core/shared_store.py`):
   - a fingerprint (`storage_fp`) is computed for every staged item from its stored rows, so the overlay is part of it;
   - if there is no store yet, the staging tables become `gd`; otherwise `(aoid, storage_fp)` is matched against `gd.items`: a match reuses the revision, a miss copies the item and its whole tree (stats, actions and criteria, spell data, spells, attack/defense, animation/mesh, nano properties) with fresh ids;
   - the version's vid is set on exactly the revisions it holds, and curated rows are pointed at revision ids;
   - the staging schema's content tables are replaced by views, `symbiant_items` is rebuilt, and the schema is renamed to `gv_<slug>`, replacing the previous one;
   - revisions no version holds any more are garbage-collected.
5. `gd.items` is vacuumed and the touched tables analyzed (the planner's `vids @>` estimates come from array statistics).

Re-importing a slug is a clean replace: its membership is rebuilt, and revisions only it held are collected. Other versions are never changed. Writes never go to shared rows in place, which is why curated edits must happen in staging.

## Requirements

### Data Files

Default locations are under `backend/database/`; override any of them with a `--*-file` flag (both `~` and environment variables are expanded).

- `items.json` (407 MB) - Item data
- `nanos.json` (44 MB) - Nano program data
- `symbiants.csv` (208 KB) - Curated mob and drop-source data (skip with `--no-symbiants`)
- `perks.json` (411 KB) - Curated perk metadata (skip with `--no-perks`)
- `all_nanos_compacted.csv` - Curated crystal/strain data, applied with `--nanos-csv`

Curated files are live-era Anarchy Online data. For a private server or an old client build, either supply that version's own copies or omit them; the registry then records the missing features and the UI hides the affected tools.

Use the same curated inputs for every version that should share revisions. The overlay is part of the fingerprint: importing one build with `--nanos-csv` and the next without it makes every overlaid nano a separate revision (the item history, which compares `content_hash` of the raw record, is not affected).

### Environment

```bash
cd backend && source venv/bin/activate && set -a && . ./.env.local && set +a
```

or `export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"`.

## Usage

### One-time: convert per-version schemas to the shared store

A database whose versions still have their own tables (before October 2026) must be converted once. Back it up first; afterwards a version is no longer self-contained in its schema.

```bash
pg_dump -Fc -f tinkertools_pre_shared.dump "$DATABASE_URL"
python import_cli.py convert-shared --yes
```

Every registered version is converted in place, in one transaction: the default version first, whose tables become `gd` (it keeps every surrogate id), then the others by sort order (their identical items take its ids; their own revisions get new ids). Then `gd.items` and the curated tables are vacuumed. Re-running it converts whatever is left and refreshes every version's views; it is a no-op on a converted database.

To go back, drop the store and the version schemas (this also drops the `item_revisions` view), then restore:

```bash
psql "$DATABASE_URL" -c 'DROP SCHEMA gd, gv_ao_2024_02, gv_prk_2026_01 CASCADE'
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" tinkertools_pre_shared.dump
```

The restored registry predates global migration 002, so run the pre-conversion code against it.

### Extract client builds

`extract_builds.py` runs [TinkerParse](https://github.com/TheTinkeringIdiot/TinkerParse) over client builds and writes the extracts folder. It needs `git`, `dotnet` (.NET 8) and, for archives, `7z`; it does not touch the database.

```bash
# a new game patch: the installed clients
python extract_builds.py --extracts-dir ~/projects/AO/extracts --tinkerparse ~/projects/TinkerParse \
    --live "~/.wine/drive_c/Funcom/Anarchy Online" --prk ~/.prk/drive_c/ProjectRubiKa

# historical builds: 7z archives and folders of unpacked clients, one sub-folder per build number
python extract_builds.py --extracts-dir ~/projects/AO/extracts --tinkerparse ~/projects/TinkerParse \
    --archive ~/versions/17.0.0_to_17.10.5 --builds-dir ~/versions/unpacked --work-dir /tmp/extract-work
```

- The parser is built from one pinned commit (`TINKERPARSE_COMMIT` in the script), whatever the checkout's working tree holds. Content hashes cover parser-generated fields, so change the pin for every build or for none: after changing it, run every source again.
- A build is named by its client: `version.id` for `--live`, `patch.version` for `--prk`, the folder name otherwise. `18.8.62_EP1` becomes `ao-18-8-62-ep1`.
- A build whose folder already holds the same client database from the same parser commit is skipped (`--force` parses it again). Parsing is deterministic: a second run writes identical files.
- Builds with an identical client database are parsed once; the others are indexed as `duplicate`. A client without `ResourceDatabase.dat` and `.idx` is `missing_db`. A build the parser cannot read (no items, or more than 1% of records in error) is `failed` and gets no folder.
- One build number with two different databases: the later one is parsed under a numbered slug (`ao-16-2-0-2`) and kept only if its items or nanos differ; a repack with the same content is dropped.
- `index.json` is rewritten after every source. Builds from earlier runs stay in it, so a run with only `--live` adds the new patch to the existing history.
- Each archive is unpacked once into `--work-dir` (database files only, up to about 45 GB) and removed when its builds are done. Progress goes to `<extracts-dir>/extract.log`.

Then import what was extracted:

### Import extracted client builds

The extractor writes one folder per build plus an index (`.docs/plans/multi-version-support/extract-contract.md`):

```bash
# every build in index.json
python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts

# one build, or several
python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts --slug ao-17-10-5 --slug ao-17-10-4

# reload a build that is already installed from the same extract
python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts --slug ao-17-10-5 --force
```

- `extracted` builds load in index order through staging (CSV pipeline). `client_build`, `tinkerparse_commit` and `rdb_dat_sha256` come from the build's `manifest.json`.
- `duplicate` builds (a client database identical to another build's) load after them: the version is registered, its vid is added to the revisions of its `extract_slug`, and it gets copies of that version's curated rows. Nothing is re-imported. The source must be installed.
- `failed` and `missing_db` builds are skipped.
- A build whose registry row already has the same `extract_slug`, `rdb_dat_sha256` and `tinkerparse_commit` is skipped unless `--force`. Re-importing a build also re-points its registered duplicates.
- Lineage: after the run, each registered build's `parent_slug` is the previous registered build of its family in index order (the first of a family keeps its parent).
- New rows get a display name like `AO 17.10.5` and a sort order that lists PRK, then AO, newest build first. Existing rows keep their display name, sort order, date, notes, default and enabled flags.
- Curated data is off by default for extracts. Pass `--perks-file`, `--symbiants-file` and/or `--nanos-csv` to apply them to every build of the run; `features` records what was loaded.

### Content-addressed store (`import-cas`, `tools/verify_cas.py`)

The content-addressed store (`docs/plans/content-addressed-store/design.md`, tables in `database/cas/`) is built next to the shared store, in its own schema (`cas`). The API does not read it yet. `import-cas` never writes to `public`, `gd` or a `gv_*` schema; it reads the registry (`public.game_versions`) for display names, order, flags and features.

```bash
# every importable build in index.json, oldest first
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --workers 8

# a scratch copy with a few builds
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --schema cas_dev \
    --slug ao-14-2-2 --slug ao-15-0-1 --slug ao-17-10-5

# start over: drops the tables of the schema, keeps the schema
python import_cli.py import-cas --extracts-dir ~/projects/AO/extracts --schema cas_dev --reset --yes
```

- The extracts folder, its `index.json`, the manifest of every planned build and the curated files are checked first; if one is missing the command stops before it writes anything.
- Curated data (`all_nanos_compacted.csv`, `database/perks.json`, `database/symbiants.csv`, or `--nanos-csv`, `--perks-file`, `--symbiants-file`) is synced on every run and applies to every build. A mob that leaves `symbiants.csv` is kept as a retired row, so its id is never given to another mob.
- Each build is one transaction. Builds already in the store are skipped, so a run that stopped can be repeated and picks up where it stopped. A build older than the newest stored build of its branch is refused: `--reset` and import again to insert one.
- The newest stored build of each branch is the one served with the curated nano strains; the build before it goes back to its own strains in the transaction that stores the new one.
- `--workers N` reads and splits N builds ahead of the importer, about 2 GB of memory each; `--workers 0` reads in the importer's process.
- **Never `DROP SCHEMA cas`.** The `btree_gist` extension lives in the schema the first store was created in, and dropping that schema takes the extension and the presence constraint of every other store with it. Use `--reset --yes`, which drops tables only.

Verify after an import (`DATABASE_URL` set as above; the current store is only read):

```bash
# the store as a whole: projections, presence, change log, strain policy, item counts
python tools/verify_cas.py --store

# one build against the current store and its raw extract
python tools/verify_cas.py ao-17-10-5 --extracts-dir ~/projects/AO/extracts
```

- Both end with `N difference(s)` and exit 1 unless N is 0; exit 2 means the check could not be run (no store in `--schema`, no extract, a build or `--against` build that is not in its store).
- A build check needs `--extracts-dir`: effect criteria order, effect descriptions and shop data can only be compared with the raw extract. `--skip-extract` leaves that part out and says so in its last line; it is not a complete check.
- `--schema NAME` checks another store, `--show N` prints more examples, `--against SLUG` compares with another build of the current store.

### Import a version from dump files

```bash
python import_cli.py all --version ao-2024-02 --csv-mode \
    --items-file ~/ao-data/items.json --nanos-file ~/ao-data/nanos.json \
    --nanos-csv all_nanos_compacted.csv

python import_cli.py all --version prk-2026-01 --csv-mode \
    --items-file ~/prk/items.json --nanos-file ~/prk/nanos.json \
    --nanos-csv all_nanos_compacted.csv \
    --display-name "Project Rubi-Ka" --family prk --parent ao-2024-02
```

`--csv-mode` transforms the JSON into CSV files and loads them with PostgreSQL `COPY`. It is roughly 55x faster than the ORM path (`--optimized`, standard) and is the normal way to load a version. Both dev versions were loaded with the crystal/strain overlay; pass `--nanos-csv` when re-importing them, or their nanos become new revisions. `--clear` is accepted but no longer needed: every `all` import replaces the version.

### Individual datasets

`items`, `nanos` and `symbiants` add rows to a version's own tables and only work on a database without the shared store. Against the store they refuse; re-import the whole version with `all`.

### Registry commands

```bash
# Every registered version: schema, vid, build, flags (default, disabled, dup of X)
python import_cli.py versions

# Create or update a registry row without importing anything
python import_cli.py register --version ao-2024-02 --set-default \
    --display-name "Anarchy Online (Live)" --snapshot-date 2024-02-24

# Remove a version: its vids, its schema and its registry row, then garbage-collect
python import_cli.py drop-version --version ao-15-0-0 --yes

# Re-derive nano_properties (shared store: for every revision at once)
python import_cli.py nano-properties --version ao-2024-02
```

`adopt-public` (move a pre-multi-version install from `public` into `gv_<slug>`) only runs on a database without the store; run `convert-shared` after it.

## Options

### Game version

| option | meaning |
|---|---|
| `--version SLUG` | version to operate on (default: `DEFAULT_GAME_VERSION`). Slugs starting with `stage-` are reserved |
| `--display-name NAME` | name shown in the version selector (default: the slug) |
| `--family NAME` | selector grouping (default: `prk` for slugs starting with `prk`, else `ao`) |
| `--parent SLUG` | the snapshot this one follows; sets lineage for item history |
| `--client-build STR` | client build (default: the `Version` field of the first item record) |
| `--snapshot-date YYYY-MM-DD` | date of the dump |
| `--sort-order N` | position in the version selector |
| `--set-default` | serve this version for requests with no version segment |
| `--disabled` | register the version but hide it from the API and selector |
| `--notes TEXT` | provenance notes |
| `--no-perks` | import without perk metadata |
| `--no-symbiants` | import without mobs, sources and symbiant drops |
| `--yes` | confirm a destructive command (`drop-version`, `convert-shared`, `import-cas --reset`) |

### Shared store and extracts

| option | meaning |
|---|---|
| `--extracts-dir DIR` | `import-extracts`, `import-cas`: folder with `index.json` and `<slug>/{items.json,nanos.json,manifest.json}` |
| `--slug SLUG` | `import-extracts`, `import-cas`: build to import, repeatable (default: every build in the index) |
| `--force` | `import-extracts`: reload builds already installed from the same extract |
| `--nanos-csv PATH` | curated crystal/strain CSV. `all`, `import-extracts`: applied in staging (`update_nanos.py`), off when not given. `import-cas`: default `all_nanos_compacted.csv` |

### Content-addressed store

| option | meaning |
|---|---|
| `--schema NAME` | `import-cas`: schema of the store (default: `cas`) |
| `--workers N` | `import-cas`: builds read and split in parallel (default: 4; 0 reads in the importer's process) |
| `--reset` | `import-cas`: drop the store's tables in `--schema` and import from scratch; needs `--yes` |

### Import

| option | meaning |
|---|---|
| `--csv-mode` | CSV + `COPY` pipeline, ~55x faster (`all` command only) |
| `--optimized` | batched ORM importer, 10-20x faster than standard |
| `--ultra` | experimental, 40-60x faster, data loss possible on crash; requires `--optimized` |
| `--chunk-size N` | items per chunk in standard mode (default: 100) |
| `--batch-size N` | batch size for the optimized importer |
| `--database-url URL` | override `DATABASE_URL` |
| `--items-file`, `--nanos-file`, `--symbiants-file`, `--perks-file` | override default file locations |

## Content hashes and item history

During import each raw record is hashed (`app/core/content_hash.py`):

- `content_hash` over the whole normalized record,
- `stats_hash`, `spells_hash`, `actions_hash`, `text_hash` over its parts.

`Version`, `DBType` and the internal nano marker are stripped, and `StatValues` plus the attack/defense stat lists are sorted, so two extractions of the same client hash identically. Criteria and spell arrays keep their order, because reordering them changes what the item requires or does.

The hashes are stored on `items` (migration 007). `public.item_revisions` derives one row per (AOID, version) from `gd.items` and the registry vids; nothing has to be rebuilt after an import. Comparing an AOID's hashes across versions in lineage order gives the patch points where the item changed, and which part of it changed.

`storage_fp`, the dedup key, is different from `content_hash`: it is computed from the stored rows (including curated overlays), so two versions share a revision only if they would show exactly the same item.

## Nano school, professions and level

The `/nanos` endpoints read each nano's school, casting professions, lowest casting level and strain from `nano_properties` (migration 008; `strain` added by 009). The values are derived from the revision alone: `app/core/nano_properties.py` reads the NanoSchool (405) and NanoStrain (75) stats and evaluates the Use action's criteria for every nano.

- **Import**: derived in staging; the install copies the rows of new revisions only (a reused revision already has them).
- **Re-deriving** after a change to `app/core/nano_properties.py`: `python import_cli.py nano-properties --version <any slug>` rebuilds `gd.nano_properties` for every revision. It is idempotent.

## Migrations

`database/migrations/*.sql` build staging schemas. `gd.schema_migrations` records which of them the store's content tables carry, and an install refuses a staging schema at a different migration level, or whose content tables have columns the merge does not know (`CONTENT_COLUMNS` in `shared_store.py`). A new migration that changes a content table must be applied to `gd` by hand (`SET search_path TO gd`, then record it in `gd.schema_migrations`), `CONTENT_COLUMNS` and the merge SQL updated, and the views refreshed with `convert-shared --yes`. A migration that changes a curated table must be applied to every `gv_*` schema.

## Never write to content tables in place

The per-version views are simple views, so PostgreSQL lets `INSERT`/`UPDATE`/`DELETE` through them into `gd`, where the change would reach every version holding the row. Nothing in the app writes to content tables. `update_nanos.py` refuses to run against a version schema made of views, and `POST /performance/indexes/create` creates its indexes on `gd`.

## Performance notes

- **CSV mode**: full load of items + nanos in about a minute; the merge into the store adds about 30 seconds per version (fingerprints and copy of new revisions).
- **Storage**: about 4.8 KB per distinct revision plus up to 7 MB of curated tables per version. The two dev versions take 777 MB (1,370 MB as separate schemas).

## Troubleshooting

### Import fails
- Check `import.log` for detailed error messages. A failed import leaves the version as it was (the install is one transaction) and drops its staging schema.
- "still use the per-version table layout": run `convert-shared --yes` first.
- "Migration levels differ" or "has columns ...": see Migrations above.
- "holds the same AOID more than once": the dump has duplicate records for an AOID; a version must have one item per AOID.

### Data went into the wrong schema
- Confirm the slug: `python import_cli.py versions`
- The API resolves a version through `public.game_versions`; a version with a schema but no registry row is invisible to it, and `versions` marks a registry row whose schema is missing as `NO SCHEMA`

### Backups
- `gd`, `public` and every `gv_*` schema depend on each other; back up and restore the whole database, not single schemas.
