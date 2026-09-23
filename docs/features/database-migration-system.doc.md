# Database Migration System

## Overview

TinkerTools serves several snapshots of the game database ("game versions") from one PostgreSQL database. Each version owns a schema, `gv_<slug>`, holding the full table set; `public` holds only the cross-version registry. The migration system therefore has two halves: migrations that run once per database, and migrations that run once per version schema.

## Key Components

### MigrationRunner (`backend/app/core/migration_runner.py`)

`MigrationRunner` is the single path for schema changes. It is a versioned runner: each file's version is the leading digits of its name, applied versions are read from a tracking table, and only missing files are executed, each in its own transaction.

#### Migration sets

| set | directory | target | tracking table |
|---|---|---|---|
| global | `database/global_migrations/` | `public` | `public.global_migrations` |
| per-version | `database/migrations/` | `gv_<slug>` | `<schema>.schema_migrations` |

Migration files are written unqualified; `search_path` decides which schema they land in.

#### Key methods

- `run_global_migrations()`: apply pending global migrations to `public`
- `run_migrations(schema_name)`: apply pending per-version migrations inside one schema
- `ensure_version_schema(slug)`: create the schema if missing, then migrate it
- `reset_version_schema(slug)`: drop and rebuild one version's schema
- `drop_version_schema(slug)`: drop one version's schema and its data
- `adopt_public_into_schema(slug)`: one-time move of an existing single-version install out of `public` into `gv_<slug>` with `ALTER TABLE ... SET SCHEMA`
- `list_version_schemas()`: every `gv_*` schema present
- `register_version(...)` / `set_default_version(slug)` / `unregister_version(slug)` / `list_versions()`: the `public.game_versions` registry
- `verify_schema(schema_name)`: check a version schema has the tables the API needs

## Data Flow

1. **Migration discovery**: the runner scans the two migration directories for `*.sql` files
2. **Version filtering**: versions already recorded in the tracking table are skipped
3. **Schema targeting**: `search_path` is set before the files execute
4. **Transaction management**: each file runs in its own transaction; a failure aborts that file only
5. **Tracking**: a row is written for any file that did not record itself
6. **Validation**: `verify_schema` checks the resulting schema

## Implementation Files

### Core system files
- `backend/app/core/migration_runner.py` - migration execution and schema lifecycle
- `backend/app/core/versions.py` - slug validation, slug to schema mapping, registry cache
- `database/global_migrations/001_game_versions.sql` - `game_versions`, `item_revisions`, `global_migrations`
- `database/migrations/000_create_migration_table.sql` - per-version migration tracking table
- `database/migrations/001_initial_schema.sql` - core schema definition
- `database/migrations/002_add_source_system.sql` - source system tables
- `database/migrations/003_add_perk_support.sql` - perk system integration
- `database/migrations/004_add_perks_table.sql` - new perk table structure
- `database/migrations/005_refactor_symbiant_system.sql` - symbiant refactor
- `database/migrations/006_fix_symbiant_slot_extraction.sql` - symbiant slot fix
- `database/migrations/007_add_item_content_hashes.sql` - per-item content hashes

`database/schema.sql` is a historical reference only and is not applied; `database/migrations/` is the source of truth. `backend/app/core/db_migrator.py` was retired along with it.

### Integration points
- `backend/app/core/database.py` - one engine, one pool, `search_path` per session
- `backend/import_cli.py` - CLI integration for import and registry operations
- `database/setup_env.sh` - psql-based setup, honours `GAME_VERSION` (default `ao`)

## Usage Examples

### From the CLI

```bash
# Rebuild one version's schema and load it
python import_cli.py all --version ao --csv-mode --clear

# Bring an existing version's schema up to date without reloading data
python import_cli.py register --version ao

# One-time: adopt the tables currently in public as version "ao"
python import_cli.py adopt-public --version ao

# Inspect the registry
python import_cli.py versions

# Remove a version entirely
python import_cli.py drop-version --version ao-15.0 --yes
```

### From Python

```python
from app.core.migration_runner import MigrationRunner

runner = MigrationRunner()
runner.run_global_migrations()
schema = runner.ensure_version_schema("prk")
runner.verify_schema(schema)
```

### With psql

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/tinkertools"
GAME_VERSION=ao ./database/setup_env.sh migrate
```

## Migration File Structure

Files are named `<version>_<name>.sql`. The version is the leading digits and must be unique within its set; files are applied in sorted order. A migration should be safe to run against an empty schema, since that is how a new version is built.

Per-version files must not name a schema. Global files may qualify names with `public`.

## Safety Features

- **Per-version isolation**: `--clear` rebuilds one schema; other versions are untouched
- **Slug validation**: slugs are checked against a pattern and mapped to schema names, never interpolated raw
- **Confirmation prompts**: interactive confirmation for destructive operations, `--yes` for `drop-version`
- **Non-interactive mode**: automatic proceeding in CI/automated environments
- **Skip-if-applied**: re-running the runner is a no-op, so `ALTER TABLE ADD COLUMN` migrations are safe
- **Transaction safety**: one transaction per file

## Performance Considerations

- **Connection reuse**: one connection for a whole migration run
- **Index management**: importers drop and rebuild indexes around bulk loads, scoped to the current schema
- **Storage**: roughly 600 MB per game version; no cross-version deduplication

## Future Enhancements

- **Rollback capability**: support for migration rollbacks
- **Fan-out**: apply a new migration to every `gv_*` schema in one command
- **Schema diff**: compare a version schema with the expected schema
- **Zero-downtime reload**: import into `gv_<slug>_new` and swap schema names in one transaction
