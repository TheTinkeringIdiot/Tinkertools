# TinkerTools Data Import Utility

A standalone utility for importing game data into the TinkerTools database. It is separate from the main FastAPI application and uses the `DATABASE_URL` environment variable to connect to any database.

## Game versions

TinkerTools serves several snapshots of the game database side by side: live Anarchy Online, Project Rubi-Ka, and historical client builds. Each snapshot is a **game version** with a slug (`ao`, `prk`, `ao-15.0`) and lives in **its own PostgreSQL schema**, `gv_<slug>`, holding the complete table set.

The `public` schema holds only cross-version tables:

| table | purpose |
|---|---|
| `game_versions` | the registry: slug, display name, family, lineage, client build, feature flags |
| `item_revisions` | one row per (item, version) with content hashes, used for "changed in patch X" |
| `global_migrations` | tracking for `database/global_migrations/*.sql` |

Every import command:

1. applies pending global migrations to `public`,
2. rebuilds (`--clear`) or migrates the version's own schema from `database/migrations/*.sql`,
3. loads the data into that schema,
4. upserts the version's registry row,
5. rebuilds the version's `nano_properties` table (nano school, casting professions, minimum level; see below),
6. rebuilds the version's rows in `public.item_revisions` from the per-item content hashes.

Steps 4-6 run in `finalize_version`, which every import path ends with: single datasets (`items`, `nanos`, `symbiants`), `all`, and `all --csv-mode`.

Versions are independent: `--clear` on `prk` never touches `ao`.

## Requirements

### Data Files

Default locations are under `backend/database/`; override any of them with a `--*-file` flag (both `~` and environment variables are expanded).

- `items.json` (407 MB) - Item data
- `nanos.json` (44 MB) - Nano program data
- `symbiants.csv` (208 KB) - Curated mob and drop-source data (skip with `--no-symbiants`)
- `perks.json` (411 KB) - Curated perk metadata (skip with `--no-perks`)

Curated files are live-era Anarchy Online data. For a private server or an old client build, either supply that version's own copies or omit them with `--no-perks` / `--no-symbiants`; the registry then records the missing features and the UI hides the affected tools.

### Environment

```bash
export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"
```

For production deployment, change `DATABASE_URL` to point at the production database.

## Usage

### Validate files

```bash
python import_cli.py validate
python import_cli.py validate --no-perks --no-symbiants   # only items and nanos
```

### Import a whole version (recommended)

```bash
python import_cli.py all --version ao --csv-mode --clear \
    --items-file ~/ao-data/items.json \
    --nanos-file ~/ao-data/nanos.json
```

`--csv-mode` transforms the JSON into CSV files and loads them with PostgreSQL `COPY`. It is roughly 55x faster than the ORM path and is the normal way to load a version.

### Import a second version

```bash
python import_cli.py all --version prk --csv-mode --clear \
    --items-file ~/prk/items.json --nanos-file ~/prk/nanos.json \
    --no-perks --no-symbiants \
    --display-name "Project Rubi-Ka" --family prk --parent ao
```

### Import individual datasets

```bash
python import_cli.py items --version ao --chunk-size 50
python import_cli.py items --version ao --optimized
python import_cli.py nanos --version ao
python import_cli.py symbiants --version ao
```

### Registry commands

```bash
# Show every registered version, its schema, and what it has loaded
python import_cli.py versions

# Create or update a registry row without importing anything
python import_cli.py register --version ao --set-default \
    --display-name "Anarchy Online (Live)" --snapshot-date 2026-02-01

# One-time transition: adopt an existing single-version install
python import_cli.py adopt-public --version ao

# Remove a version's schema and registry row
python import_cli.py drop-version --version ao-15.0 --yes

# Apply pending migrations to an existing version and rebuild its nano_properties
python import_cli.py nano-properties --version ao
```

`adopt-public` moves the TinkerTools tables that still sit in `public` into `gv_<slug>` with `ALTER TABLE ... SET SCHEMA` (indexes, sequences and the `symbiant_items` materialized view follow), then applies any missing migrations. Adopted items have no content hashes, so they contribute no `item_revisions` rows until the version is re-imported from its dump files.

## Options

### Game version

| option | meaning |
|---|---|
| `--version SLUG` | version to operate on; data lands in `gv_<slug>` (default: `DEFAULT_GAME_VERSION`, normally `ao`) |
| `--display-name NAME` | name shown in the version selector (default: the slug) |
| `--family NAME` | selector grouping (default: `prk` for slugs starting with `prk`, else `ao`) |
| `--parent SLUG` | the snapshot this one follows; sets lineage for item history |
| `--client-build STR` | client build (default: the `Version` field of the first item record) |
| `--snapshot-date YYYY-MM-DD` | date of the dump |
| `--sort-order N` | position in the version selector |
| `--set-default` | serve this version for requests with no version segment |
| `--disabled` | register the version but hide it from the API and selector |
| `--notes TEXT` | provenance notes (client build, extractor, curated files used) |
| `--no-perks` | import without perk metadata |
| `--no-symbiants` | import without mobs, sources and symbiant drops |
| `--yes` | confirm a destructive registry command (required by `drop-version`) |

### Import

| option | meaning |
|---|---|
| `--clear` | drop and recreate this version's schema from the migrations first (destructive, this version only) |
| `--csv-mode` | CSV + `COPY` pipeline, ~55x faster (`all` command only) |
| `--optimized` | batched ORM importer, 10-20x faster than standard |
| `--ultra` | experimental, 40-60x faster, data loss possible on crash; requires `--optimized --clear` |
| `--chunk-size N` | items per chunk in standard mode (default: 100) |
| `--batch-size N` | batch size for the optimized importer |
| `--database-url URL` | override `DATABASE_URL` |
| `--items-file`, `--nanos-file`, `--symbiants-file`, `--perks-file` | override default file locations |

## Content hashes and item history

During import each raw record is hashed (`app/core/content_hash.py`):

- `content_hash` over the whole normalized record,
- `stats_hash`, `spells_hash`, `actions_hash`, `text_hash` over its parts.

`Version`, `DBType` and the internal nano marker are stripped, and `StatValues` plus the attack/defense stat lists are sorted, so two extractions of the same client hash identically. Criteria and spell arrays keep their order, because reordering them changes what the item requires or does.

The hashes are stored on `items` (migration 007) and copied into `public.item_revisions` after each load. Comparing an AOID's hashes across versions in lineage order gives the patch points where the item changed, and which part of it changed.

## Nano school, professions and level

The `/nanos` endpoints read each nano's school, casting professions, lowest casting level and strain from the per-version table `nano_properties` (migration 008; `strain` added by 009). The values are derived, not imported: `app/core/nano_properties.py` reads the NanoSchool (405) and NanoStrain (75) stats and evaluates the Use action's criteria (Profession/VisualProfession, Level, OR/NOT, OnTarget modifiers) for every nano in the schema.

- **Fresh import**: nothing to do. `finalize_version` rebuilds the table after the data is loaded, for every version and every import mode, `--csv-mode` included.
- **Existing version imported before migration 008** (a production rollout of this change, or after `adopt-public` on an old install): run once per version

  ```bash
  python import_cli.py nano-properties --version ao-2024-02
  python import_cli.py nano-properties --version prk-2026-01
  ```

  It applies pending migrations to that version's schema (creating `nano_properties` and its indexes, adding its `strain` column, and recording `008` and `009` in `schema_migrations`), then deletes and re-inserts the table's rows. It changes no other table and takes about a second per version. Until it runs, the `/nanos` endpoints fail with a missing `nano_properties` table or `strain` column; every other endpoint is unaffected.
- **Re-deriving** after a change to `app/core/nano_properties.py`: run the same command. It is idempotent.
- **Undo** (per version schema):

  ```sql
  -- only the strain column (009):
  ALTER TABLE gv_<slug>.nano_properties DROP COLUMN strain;
  DELETE FROM gv_<slug>.schema_migrations WHERE version = '009';
  -- the whole table (008 and 009):
  DROP TABLE gv_<slug>.nano_properties;
  DELETE FROM gv_<slug>.schema_migrations WHERE version IN ('008', '009');
  ```

  The code expecting the table must be rolled back with it.

## Performance notes

- **CSV mode**: full load of items + nanos in a few minutes; the fastest path.
- **Optimized mode**: 10-20x standard, still ORM-based.
- **Standard mode**: slowest, most conservative; useful for small or incremental loads.
- **Memory usage**: controlled by `--chunk-size` in standard mode; CSV mode streams.

## Implementation details

The import utility:

1. **Prepares the schema** - global migrations, then this version's migrations
2. **Preprocesses singletons** - extracts all StatValues and Criteria for bulk creation
3. **Processes in chunks** - handles large files without memory issues
4. **Uses transactions** - each chunk is committed separately for reliability
5. **Maintains relationships** - handles foreign keys and many-to-many relationships
6. **Hashes every record** - for cross-version item history
7. **Registers the version** - registry row, `nano_properties` and `item_revisions`
8. **Provides progress tracking** - logs progress and performance metrics

## Troubleshooting

### Import fails
- Check `import.log` for detailed error messages
- Verify `DATABASE_URL` is correct and the database is accessible
- Ensure sufficient disk space and memory (about 600 MB per version)
- Try a smaller `--chunk-size` for memory issues

### Data went into the wrong schema
- Confirm the slug: `python import_cli.py versions`
- The API resolves a version through `public.game_versions`; a version with a schema but no registry row is invisible to it, and `versions` marks a registry row whose schema is missing as `NO SCHEMA`

### No item history
- `item_revisions` is empty for a version whose items predate migration 007; re-import that version

### Performance issues
- Prefer `--csv-mode` for a full load
- Monitor database performance during import
- Run during off-peak hours in production

### Data quality
- The utility validates data during import
- Failed items are logged but do not stop the import
- Check logs for items that failed to import
