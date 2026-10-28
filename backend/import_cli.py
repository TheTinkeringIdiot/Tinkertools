#!/usr/bin/env python3
"""
TinkerTools Data Import Utility

Game data lives in a shared revision store (schema ``gd``, design.md §12): one
row per distinct item revision, tagged with the versions that contain it. Each
game version ("snapshot") has a schema ``gv_<slug>`` of views over the store plus
its curated tables (perks, mobs, sources). The registry of versions lives in
``public.game_versions``.

Importing a version loads its dump into a staging schema with the classic
per-version importer, applies curated overlays there, then merges the staging
schema into the store by content fingerprint and turns it into ``gv_<slug>``.

Usage:
    # Set database URL
    export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"

    # One-time: convert per-version table schemas into the shared store
    python import_cli.py convert-shared --yes

    # Import extracted client builds (extract contract: index.json + <slug>/)
    python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts
    python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts --slug ao-17-10-5

    # Import a version from dump files (CSV pipeline, fastest)
    python import_cli.py all --version ao-2024-02 --csv-mode \
        --items-file ~/ao-data/items.json --nanos-file ~/ao-data/nanos.json \
        --nanos-csv all_nanos_compacted.csv

    # Import a private-server snapshot with no curated perk/symbiant data
    python import_cli.py all --version prk-2026-01 --csv-mode \
        --items-file ~/prk/items.json --nanos-file ~/prk/nanos.json \
        --no-perks --no-symbiants --display-name "Project Rubi-Ka" --family prk

    # Registry management
    python import_cli.py versions                 # list registered versions
    python import_cli.py register --version ao-2024-02 --set-default
    python import_cli.py drop-version --version old-snapshot --yes
    python import_cli.py nano-properties --version ao-2024-02  # re-derive nano school/profession/level

    # Validate files exist
    python import_cli.py validate

The single-dataset commands (``items``, ``nanos``, ``symbiants``) and
``adopt-public`` only work on databases that have not been converted to the
shared store.

Requirements:
    - items.json (407MB)
    - nanos.json (44MB)
    - symbiants.csv (208KB, omit with --no-symbiants)
    - perks.json (411KB, omit with --no-perks)
"""

import argparse
import logging
import sys
import os
from pathlib import Path
from typing import Optional

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('import.log')
    ]
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Paths and file resolution
# ---------------------------------------------------------------------------

def resolve_data_file_path(cli_path: Optional[str], default_filename: str) -> Path:
    """
    Resolve data file path from CLI argument or default location.
    Supports home directory (~) and environment variable expansion.

    Args:
        cli_path: Path provided via CLI argument (None if not provided)
        default_filename: Default filename to use in backend/database/

    Returns:
        Resolved Path object

    Raises:
        FileNotFoundError: If resolved path doesn't exist
    """
    if cli_path:
        # Expand environment variables and home directory
        expanded_path = os.path.expandvars(cli_path)
        file_path = Path(expanded_path).expanduser()
    else:
        file_path = Path(__file__).parent / "database" / default_filename

    if not file_path.exists():
        raise FileNotFoundError(f"Data file not found: {file_path}")

    return file_path


# ---------------------------------------------------------------------------
# Version helpers
# ---------------------------------------------------------------------------

def version_slug(args) -> str:
    """Game version slug for this invocation."""
    from app.core.config import settings
    return getattr(args, 'version', None) or settings.DEFAULT_GAME_VERSION


def version_family(args) -> str:
    """Registry family: explicit --family, else derived from the slug."""
    if getattr(args, 'family', None):
        return args.family
    return 'prk' if version_slug(args).startswith('prk') else 'ao'


def build_features(args, nanos: bool = True, items: bool = True) -> dict:
    """What this version has loaded; drives tool gating in the UI."""
    return {
        "items": items,
        "nanos": nanos,
        "perks": not args.no_perks,
        "symbiants": not args.no_symbiants,
        "sources": not args.no_symbiants or bool(getattr(args, 'nanos_csv', None)),
    }


def read_client_build(json_path: Path) -> Optional[str]:
    """Client build from the first record's ``Version`` field, read cheaply.

    Returns None if ijson is unavailable or the field is missing.
    """
    try:
        import ijson
    except ImportError:
        logger.debug("ijson not available, skipping client build detection")
        return None

    try:
        with open(json_path, 'rb') as f:
            for record in ijson.items(f, 'item'):
                build = record.get('Version')
                return str(build) if build is not None else None
    except Exception as e:
        logger.debug(f"Could not read client build from {json_path}: {e}")
    return None


def prepare_schema(args):
    """Apply global migrations and bring this version's schema up to date.

    ``--clear`` drops and recreates the schema; otherwise missing migrations
    are applied to the existing one.

    Returns:
        (MigrationRunner, schema_name), or (None, None) on failure.
    """
    from app.core.migration_runner import MigrationRunner
    from app.core.versions import registry

    slug = version_slug(args)

    try:
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        runner.run_global_migrations()

        if getattr(args, 'clear', False):
            logger.info(f"=== Rebuilding schema for version '{slug}' (--clear) ===")
            schema = runner.reset_version_schema(slug)
        else:
            schema = runner.ensure_version_schema(slug)

        registry.invalidate()
        logger.info(f"Version '{slug}' -> schema {schema}")
        return runner, schema
    except Exception as e:
        logger.error(f"Failed to prepare schema for version '{slug}': {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None, None


def version_fields_from_args(args, existing: Optional[dict], features: dict,
                             client_build: Optional[str] = None) -> dict:
    """Registry row for this version: command-line values over the existing row,
    with ``features`` merged into the existing features."""
    slug = version_slug(args)
    merged_features = dict(existing['features'] or {}) if existing else {}
    merged_features.update(features)

    return dict(
        slug=slug,
        display_name=getattr(args, 'display_name', None)
            or (existing['display_name'] if existing else None)
            or slug,
        family=version_family(args),
        parent_slug=getattr(args, 'parent', None)
            or (existing['parent_slug'] if existing else None),
        client_build=client_build
            or getattr(args, 'client_build', None)
            or (existing['client_build'] if existing else None),
        snapshot_date=getattr(args, 'snapshot_date', None)
            or (existing['snapshot_date'] if existing else None),
        sort_order=getattr(args, 'sort_order', None)
            if getattr(args, 'sort_order', None) is not None
            else (existing['sort_order'] if existing else 0),
        enabled=not getattr(args, 'disabled', False),
        is_default=getattr(args, 'set_default', False)
            or bool(existing['is_default'] if existing else False),
        features=merged_features,
        notes=getattr(args, 'notes', None) or (existing['notes'] if existing else None),
    )


def register_version_from_args(args, runner, features: dict,
                               client_build: Optional[str] = None) -> bool:
    """Upsert this version's registry row, merging into any existing features."""
    from app.core.versions import registry

    slug = version_slug(args)

    try:
        existing = {row['slug']: row for row in runner.list_versions()}.get(slug)
        runner.register_version(
            **version_fields_from_args(args, existing, features, client_build))
        registry.invalidate()
        return True
    except Exception as e:
        logger.error(f"Failed to register version '{slug}': {e}")
        return False


def populate_item_revisions(slug: str) -> int:
    """Rebuild ``public.item_revisions`` for one version from its items table.

    Requires the version's registry row to exist (foreign key) and the items
    to carry content hashes; items imported before migration 007 have none and
    are skipped.

    Returns:
        Number of revision rows written.
    """
    from sqlalchemy import text
    from app.core.database import session_for_version

    logger.info(f"Rebuilding item_revisions for version '{slug}'...")

    with session_for_version(slug) as db:
        db.execute(
            text("DELETE FROM public.item_revisions WHERE version_slug = :slug"),
            {"slug": slug},
        )
        result = db.execute(
            text("""
                INSERT INTO public.item_revisions (
                    aoid, version_slug, content_hash, stats_hash,
                    spells_hash, actions_hash, text_hash, is_nano
                )
                SELECT aoid, :slug, content_hash, stats_hash,
                       spells_hash, actions_hash, text_hash, COALESCE(is_nano, false)
                FROM items
                WHERE content_hash IS NOT NULL AND aoid IS NOT NULL
                ON CONFLICT (aoid, version_slug) DO NOTHING
            """),
            {"slug": slug},
        )
        db.commit()
        count = result.rowcount

    logger.info(f"Wrote {count} item_revisions rows for version '{slug}'")
    return count


def populate_nano_properties(slug: str) -> int:
    """Rebuild ``nano_properties`` (school, professions, min level) for one version.

    Derived from the nanos' stats and Use action criteria already in the
    schema, so it runs after every import and can be re-run on its own.

    Returns:
        Number of nanos written.
    """
    from app.core.database import session_for_version
    from app.core.nano_properties import populate

    logger.info(f"Deriving nano properties for version '{slug}'...")
    with session_for_version(slug) as db:
        count = populate(db)
        db.commit()
    logger.info(f"Wrote nano_properties for {count} nanos in version '{slug}'")
    return count


def finalize_version(args, runner, features: dict, client_build: Optional[str] = None) -> bool:
    """Register the version, derive its nano properties (school, professions,
    level) and rebuild its cross-version revision index.

    Every import path ends here (single datasets, ``all`` and ``all --csv-mode``),
    so a freshly imported version always has its nano_properties filled.
    """
    slug = version_slug(args)

    if not register_version_from_args(args, runner, features, client_build):
        return False

    ok = True
    try:
        populate_nano_properties(slug)
    except Exception as e:
        logger.error(f"Failed to derive nano properties for '{slug}': {e}. "
                     f"Re-run: python import_cli.py nano-properties --version {slug}")
        ok = False

    try:
        rows = populate_item_revisions(slug)
        if rows == 0:
            logger.warning(
                "No item_revisions rows written: the items in this schema carry no "
                "content hashes. Re-import the version to build its change history."
            )
    except Exception as e:
        logger.error(f"Failed to populate item_revisions for '{slug}': {e}")
        ok = False

    return ok


def create_database_indexes(slug: str):
    """Create performance indexes after data import."""
    from app.core.database import session_for_version
    from app.core.indexes import create_performance_indexes

    logger.info("=== Creating Performance Indexes ===")

    try:
        with session_for_version(slug) as db_session:
            created_indexes = create_performance_indexes(db_session)
            logger.info(f"Successfully created {len(created_indexes)} performance indexes")
            logger.info("Indexes created:")
            for idx_name in created_indexes:
                logger.info(f"  ✓ {idx_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


# ---------------------------------------------------------------------------
# Import commands
# ---------------------------------------------------------------------------

def import_symbiants(args, runner=None):
    """Import mobs and sources from symbiants CSV."""
    from app.core.importer import DataImporter

    slug = version_slug(args)

    if args.no_symbiants:
        logger.info("--no-symbiants: skipping mobs and sources import")
        return True

    logger.info(f"Starting mobs and sources import from symbiants.csv into '{slug}'...")

    if runner is None:
        runner, schema = prepare_schema(args)
        if runner is None:
            return False

    # Resolve file path (from CLI arg or default location)
    try:
        file_path = resolve_data_file_path(args.symbiants_file, "symbiants.csv")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

    # Use regular importer (optimized doesn't have this method)
    importer = DataImporter(chunk_size=args.chunk_size, version_slug=slug,
                            skip_perks=args.no_perks)
    try:
        # Import mobs and sources from CSV
        stats = importer.import_mobs_and_sources(str(file_path))
        logger.info(f"Successfully imported mobs and sources:")
        logger.info(f"  - Mobs: {stats['mobs']}")
        logger.info(f"  - Sources: {stats['sources']}")
        logger.info(f"  - Item-Source links: {stats['item_sources']}")
        return True
    except Exception as e:
        logger.error(f"Mobs and sources import failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def import_items(args, runner=None):
    """Import items from JSON."""
    from app.core.importer import DataImporter
    from app.core.optimized_importer import OptimizedImporter

    slug = version_slug(args)

    if hasattr(args, 'ultra') and args.ultra:
        mode = "ULTRA"
    elif args.optimized:
        mode = "OPTIMIZED"
    else:
        mode = "STANDARD"
    logger.info(f"Starting items import into '{slug}' ({mode} mode)...")

    # Validate ultra mode requirements
    if hasattr(args, 'ultra') and args.ultra and not args.optimized:
        logger.error("--ultra flag requires --optimized flag")
        return False

    if runner is None:
        runner, schema = prepare_schema(args)
        if runner is None:
            return False

    # Resolve file paths
    try:
        items_path = resolve_data_file_path(args.items_file, "items.json")
        perks_path = None if args.no_perks else resolve_data_file_path(args.perks_file, "perks.json")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

    try:
        if args.optimized:
            # Ultra mode warning
            if hasattr(args, 'ultra') and args.ultra:
                logger.warning("⚠️  ULTRA MODE ENABLED")
                logger.warning("    - 40-60x faster than standard mode")
                logger.warning("    - synchronous_commit=OFF (data loss on crash)")
                logger.warning("    - UNLOGGED tables (not crash-safe)")
                logger.warning("    - Indexes dropped (database not queryable during import)")
                logger.warning("    - PostgreSQL COPY protocol (bypasses normal query path)")
                if not args.clear:
                    logger.error("--ultra mode requires --clear flag for safety")
                    return False

                try:
                    response = input("⚠️  Continue with ULTRA MODE? (yes/NO): ").strip().lower()
                    if response != 'yes':
                        logger.info("Import cancelled")
                        return False
                except EOFError:
                    # Non-interactive environment
                    logger.info("Non-interactive environment, proceeding with ULTRA MODE")

            # Use optimized importer with larger batch size
            batch_size = args.batch_size if args.batch_size else 5000
            ultra_mode = hasattr(args, 'ultra') and args.ultra
            logger.info(f"Using OptimizedImporter with batch_size={batch_size}, ultra_mode={ultra_mode}")
            importer = OptimizedImporter(
                batch_size=batch_size,
                perks_file=str(perks_path) if perks_path else None,
                ultra_mode=ultra_mode,
                version_slug=slug,
                skip_perks=args.no_perks,
            )

            stats = importer.import_items_from_json(
                str(items_path),
                is_nano=False,
                clear_existing=False  # Schema was already rebuilt by prepare_schema
            )

            logger.info(f"Items import completed: "
                       f"Created={stats['items_created']}, "
                       f"Updated={stats['items_updated']}, "
                       f"Errors={stats['errors']}, "
                       f"Rate={stats.get('items_per_second', 0):.1f} items/sec")
            return stats['errors'] == 0
        else:
            # Use standard importer
            importer = DataImporter(
                chunk_size=args.chunk_size,
                perks_file=str(perks_path) if perks_path else None,
                version_slug=slug,
                skip_perks=args.no_perks,
            )
            stats = importer.import_items_from_json(
                str(items_path),
                is_nano=False,
                clear_existing=False,
                full_reset=False  # Schema was already rebuilt by prepare_schema
            )
            logger.info(f"Items import completed: "
                       f"Created={stats.items_created}, "
                       f"Updated={stats.items_updated}, "
                       f"Errors={stats.errors}")
            return stats.errors == 0
    except Exception as e:
        logger.error(f"Items import failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def import_nanos(args, runner=None):
    """Import nanos from JSON."""
    from app.core.importer import DataImporter
    from app.core.optimized_importer import OptimizedImporter

    slug = version_slug(args)

    if hasattr(args, 'ultra') and args.ultra:
        mode = "ULTRA"
    elif args.optimized:
        mode = "OPTIMIZED"
    else:
        mode = "STANDARD"
    logger.info(f"Starting nanos import into '{slug}' ({mode} mode)...")

    # Validate ultra mode requirements
    if hasattr(args, 'ultra') and args.ultra and not args.optimized:
        logger.error("--ultra flag requires --optimized flag")
        return False

    if runner is None:
        runner, schema = prepare_schema(args)
        if runner is None:
            return False

    # Resolve file paths
    try:
        nanos_path = resolve_data_file_path(args.nanos_file, "nanos.json")
        perks_path = None if args.no_perks else resolve_data_file_path(args.perks_file, "perks.json")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

    try:
        if args.optimized:
            # Use optimized importer
            batch_size = args.batch_size if args.batch_size else 5000
            ultra_mode = hasattr(args, 'ultra') and args.ultra
            logger.info(f"Using OptimizedImporter with batch_size={batch_size}, ultra_mode={ultra_mode}")
            importer = OptimizedImporter(
                batch_size=batch_size,
                perks_file=str(perks_path) if perks_path else None,
                ultra_mode=ultra_mode,
                version_slug=slug,
                skip_perks=args.no_perks,
            )

            stats = importer.import_items_from_json(
                str(nanos_path),
                is_nano=True,
                clear_existing=False  # Don't clear for nanos
            )

            logger.info(f"Nanos import completed: "
                       f"Created={stats['items_created']}, "
                       f"Updated={stats['items_updated']}, "
                       f"Errors={stats['errors']}, "
                       f"Rate={stats.get('items_per_second', 0):.1f} items/sec")
            return stats['errors'] == 0
        else:
            # Use standard importer
            importer = DataImporter(
                chunk_size=args.chunk_size,
                perks_file=str(perks_path) if perks_path else None,
                version_slug=slug,
                skip_perks=args.no_perks,
            )
            # Note: For nanos, we typically don't want to reset the entire schema
            # since they're usually imported after items.
            stats = importer.import_items_from_json(
                str(nanos_path),
                is_nano=True,
                clear_existing=False,
                full_reset=False  # Don't reset for nanos
            )
            logger.info(f"Nanos import completed: "
                       f"Created={stats.items_created}, "
                       f"Updated={stats.items_updated}, "
                       f"Errors={stats.errors}")
            return stats.errors == 0
    except Exception as e:
        logger.error(f"Nanos import failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def load_csv_pipeline(args) -> Optional[dict]:
    """
    Load items, nanos and (unless --no-symbiants) symbiant sources into the
    schema of ``args.version`` with the CSV pipeline (55x faster).

    Workflow:
    1. Merge items.json + nanos.json
    2. Transform to CSV files
    3. Transform symbiants.csv to 3 CSV files (unless --no-symbiants)
    4. Load all CSVs via PostgreSQL COPY

    Returns:
        ``{"client_build": ...}`` on success, None on failure.
    """
    import tempfile
    import json
    import shutil

    from app.core.csv_transformer import StreamingCSVTransformer, load_perk_metadata
    from app.core.csv_loader import StreamingCSVLoader
    from app.core.database import session_for_version

    slug = version_slug(args)
    logger.info(f"Starting CSV pipeline load into '{slug}'...")

    # Resolve file paths
    try:
        items_path = resolve_data_file_path(args.items_file, "items.json")
        nanos_path = resolve_data_file_path(args.nanos_file, "nanos.json")
        perks_path = None if args.no_perks else resolve_data_file_path(args.perks_file, "perks.json")
        symbiants_path = None if args.no_symbiants else resolve_data_file_path(
            args.symbiants_file, "symbiants.csv")
    except FileNotFoundError as e:
        logger.error(str(e))
        return None

    csv_dir = tempfile.mkdtemp(prefix='tinkertools_csv_')
    logger.info(f"CSV directory: {csv_dir}")

    try:
        # === PHASE 1: Transform items + nanos ===
        logger.info("=== Phase 1: Items/Nanos ===")

        # Merge JSON (avoid CSV overwrite bug)
        logger.info("Merging items and nanos JSON...")
        with open(items_path) as f:
            items_data = json.load(f)
        with open(nanos_path) as f:
            nanos_data = json.load(f)

        # Mark nanos
        for nano in nanos_data:
            nano['__is_nano__'] = True

        merged_data = items_data + nanos_data
        logger.info(f"Merged {len(items_data)} items + {len(nanos_data)} nanos")

        # Client build comes from the dump itself (the records' Version field)
        client_build = args.client_build
        if not client_build and items_data:
            build = items_data[0].get('Version')
            client_build = str(build) if build is not None else None
        if client_build:
            logger.info(f"Client build: {client_build}")

        # Write temp file
        merged_json = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(merged_data, merged_json)
        merged_json.close()
        del items_data, nanos_data, merged_data

        # Transform
        perk_metadata = load_perk_metadata(str(perks_path)) if perks_path else {}
        if not perks_path:
            logger.info("--no-perks: importing without perk metadata")
        transformer = StreamingCSVTransformer(output_dir=csv_dir)
        transform_stats = transformer.transform_items(
            merged_json.name,
            is_nano=False,
            perk_metadata=perk_metadata
        )

        os.unlink(merged_json.name)
        logger.info(f"Transformed {transform_stats['items']} items in {transform_stats['total_time']:.1f}s")

        # === PHASE 2: Transform symbiants ===
        symbiant_stats = {'mobs': 0, 'sources': 0, 'item_sources': 0}
        if symbiants_path:
            logger.info("=== Phase 2: Symbiants ===")

            SOURCE_TYPE_MOB_ID = 3  # From migration 005
            symbiant_stats = transformer.transform_symbiants(
                str(symbiants_path),
                source_type_id=SOURCE_TYPE_MOB_ID
            )
            logger.info(f"Transformed {symbiant_stats['mobs']} mobs, "
                       f"{symbiant_stats['sources']} sources, "
                       f"{symbiant_stats['item_sources']} item_sources")
        else:
            logger.info("=== Phase 2: Symbiants (skipped, --no-symbiants) ===")

        # === PHASE 3: Load CSV ===
        logger.info("=== Phase 3: Loading ===")

        with session_for_version(slug) as db_session:
            loader = StreamingCSVLoader(db_session, csv_dir=csv_dir)
            load_stats = loader.load_all()
            db_session.commit()
            logger.info(f"Loaded {load_stats['tables_loaded']} tables, "
                       f"{load_stats['total_rows']} rows in {load_stats['total_time']:.1f}s")

        total_time = (transform_stats['total_time']
                      + symbiant_stats.get('symbiant_time', 0)
                      + load_stats['total_time'])
        logger.info(f"CSV pipeline loaded {transform_stats['items']} items, "
                    f"{symbiant_stats['mobs']} mobs in {total_time:.1f}s")
        return {"client_build": client_build}

    except Exception as e:
        logger.error(f"CSV import failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

    finally:
        shutil.rmtree(csv_dir, ignore_errors=True)


def load_standard(args, runner) -> bool:
    """Load items, nanos and symbiant sources into the schema of ``args.version``
    with the per-record importers (standard or --optimized)."""
    success = True

    # Items first (contains all symbiant items that mobs will reference)
    logger.info("=== Importing Items ===")
    if not import_items(args, runner=runner):
        success = False
        logger.error("Items import failed, continuing with nanos...")

    # Nanos
    logger.info("=== Importing Nanos ===")
    if not import_nanos(args, runner=runner):
        success = False
        logger.error("Nanos import failed, continuing with symbiants...")

    # Symbiants/Mobs last (creates links to items that now exist)
    logger.info("=== Importing Mobs and Sources ===")
    if not import_symbiants(args, runner=runner):
        success = False
        logger.error("Symbiant/Mobs import failed")

    return success


def import_all(args):
    """Import every dataset for one version: load into staging, then install."""
    from app.core.migration_runner import MigrationRunner

    slug = version_slug(args)
    logger.info(f"Starting full data import of version '{slug}'...")

    def fields(client_build: Optional[str]) -> dict:
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        existing = {row['slug']: row for row in runner.list_versions()}.get(slug)
        if not client_build and not args.csv_mode:
            try:
                client_build = read_client_build(
                    resolve_data_file_path(args.items_file, "items.json"))
            except FileNotFoundError:
                client_build = None
        return version_fields_from_args(args, existing, build_features(args), client_build)

    return stage_and_install(args, slug, fields)


# ---------------------------------------------------------------------------
# Shared revision store: staging + install (design.md §12)
# ---------------------------------------------------------------------------

STAGING_PREFIX = "stage-"
FAMILY_LABELS = {"ao": "AO", "prk": "PRK"}
# Selector position for versions first registered by import-extracts: per family,
# newest build first (PRK above AO, as in the selector's lineage order).
FAMILY_SORT_BASE = {"prk": 100, "ao": 1000}
OTHER_FAMILY_SORT_BASE = 5000
EXTRACT_STATUSES = {"extracted", "duplicate", "failed", "missing_db"}


def staging_slug_for(slug: str) -> str:
    """Slug whose schema (``gv_stage_<slug>``) stages a version before the merge."""
    from app.core.versions import validate_slug

    if slug.startswith(STAGING_PREFIX):
        raise ValueError(f"Version slugs starting with '{STAGING_PREFIX}' are reserved for staging")
    return validate_slug(f"{STAGING_PREFIX}{slug}")


def legacy_layout_versions() -> list:
    """Registered versions still in the per-version table layout."""
    from app.core import shared_store
    from app.core.database import engine

    with engine.connect() as conn:
        return [row['slug'] for row in shared_store.legacy_versions(conn)]


def shared_store_exists() -> bool:
    from app.core import shared_store
    from app.core.database import engine

    with engine.connect() as conn:
        return shared_store.store_exists(conn)


def prepare_staging(args, slug: str):
    """Apply global migrations and build an empty, migrated staging schema.

    Returns:
        (MigrationRunner, staging slug), or (None, None) on failure.
    """
    from app.core.migration_runner import MigrationRunner
    from app.core.versions import schema_name_for

    try:
        staging = staging_slug_for(slug)
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        runner.run_global_migrations()
        legacy = legacy_layout_versions()
        if legacy:
            logger.error(f"Version(s) {', '.join(legacy)} still use the per-version table "
                         "layout. Convert first: python import_cli.py convert-shared --yes")
            return None, None
        runner.reset_version_schema(staging)
        logger.info(f"Staging '{slug}' in schema {schema_name_for(staging)}")
        return runner, staging
    except Exception as e:
        logger.error(f"Failed to prepare staging for '{slug}': {e}")
        return None, None


def drop_staging(runner, staging: Optional[str]) -> None:
    """Drop a staging schema left behind by a failed import (no-op after install,
    which renames it)."""
    from app.core.versions import schema_name_for

    if runner is None or not staging:
        return
    if schema_name_for(staging) in runner.list_version_schemas():
        runner.drop_version_schema(staging)


def apply_nano_overlay(staging: str, csv_path: str) -> bool:
    """Run ``update_nanos.py`` (crystal sources, nano QL, strain and substrain)
    against the staging schema.

    This happens before the merge so the curated values are part of each
    revision's fingerprint and never written to rows other versions share.
    """
    import asyncio
    from update_nanos import NanoDataUpdater

    path = Path(os.path.expandvars(csv_path)).expanduser()
    if not path.exists():
        logger.error(f"Nano CSV not found: {path}")
        return False
    logger.info(f"Applying curated nano data from {path} in staging")
    asyncio.run(NanoDataUpdater(version_slug=staging, csv_path=str(path)).run())
    return True


def maintain_store(schema: str) -> None:
    """Vacuum the membership updates and refresh planner statistics.

    ``vids @>`` estimates come from the array's most-common-element statistics,
    so ``gd.items`` is analyzed after every install.
    """
    from sqlalchemy import text
    from app.core import shared_store
    from app.core.database import engine

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text(f"VACUUM (ANALYZE) {shared_store.STORE_SCHEMA}.items"))
        for table in shared_store.CONTENT_TABLES:
            if table != "items":
                conn.execute(text(f"ANALYZE {shared_store.STORE_SCHEMA}.{table}"))
        conn.execute(text(f'ANALYZE "{schema}".{shared_store.MATVIEW}'))
        for table in shared_store.CURATED_TABLES:
            conn.execute(text(f'ANALYZE "{schema}".{table}'))


def install_staging(staging: str, fields: dict):
    """Merge a loaded staging schema into the store as version ``fields['slug']``."""
    from app.core import shared_store
    from app.core.database import engine
    from app.core.versions import registry, schema_name_for

    with engine.begin() as conn:
        result = shared_store.install_schema(conn, schema_name_for(staging), fields)
        resynced = shared_store.resync_duplicates(conn, fields['slug'])
    registry.invalidate()
    maintain_store(result.schema)

    logger.info("=" * 60)
    logger.info(f"INSTALLED '{result.slug}' -> {result.schema} (vid {result.vid})")
    logger.info(f"  Items:            {result.members}")
    logger.info(f"  New revisions:    {result.merge.new}")
    logger.info(f"  Reused revisions: {result.merge.reused}")
    if result.created_store:
        logger.info("  Created the shared store from this version")
    if result.garbage.get('items'):
        logger.info(f"  Garbage-collected {result.garbage['items']} orphaned revisions")
    if resynced:
        logger.info(f"  Re-pointed duplicates: {', '.join(resynced)}")
    logger.info("=" * 60)
    return result


def stage_and_install(args, slug: str, build_fields) -> bool:
    """Load ``args``' files into staging, apply overlays, install as ``slug``.

    ``build_fields(client_build)`` returns the registry row to write.
    Re-running a slug replaces it cleanly: its membership is rebuilt and
    revisions only it held are garbage-collected.
    """
    import argparse as _argparse

    runner, staging = prepare_staging(args, slug)
    if runner is None:
        return False

    try:
        stage_args = _argparse.Namespace(**vars(args))
        stage_args.version = staging
        stage_args.clear = True  # the staging schema is always fresh (ultra mode requires it)

        if getattr(args, 'csv_mode', False):
            loaded = load_csv_pipeline(stage_args)
            if loaded is None:
                return False
            client_build = loaded["client_build"]
        else:
            if not load_standard(stage_args, runner):
                logger.error("Loading into staging failed; nothing was installed")
                return False
            client_build = getattr(args, 'client_build', None)

        if getattr(args, 'nanos_csv', None) and not apply_nano_overlay(staging, args.nanos_csv):
            return False

        populate_nano_properties(staging)
        install_staging(staging, build_fields(client_build))
        return True
    except Exception as e:
        logger.error(f"Import of '{slug}' failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        drop_staging(runner, staging)


def convert_shared(args) -> bool:
    """Convert every per-version table schema into the shared layout, in place."""
    from sqlalchemy import text
    from app.core import shared_store
    from app.core.database import engine
    from app.core.migration_runner import MigrationRunner
    from app.core.versions import registry

    if not args.yes:
        logger.error("convert-shared rewrites every version schema; re-run with --yes "
                     "(after a pg_dump backup)")
        return False

    runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
    runner.run_global_migrations()

    with engine.begin() as conn:
        legacy = [row['slug'] for row in shared_store.legacy_versions(conn)]
        if legacy:
            logger.info(f"Converting {', '.join(legacy)} (first keeps its ids)")
        else:
            logger.info("No per-version table schemas left; refreshing views only")
        results = shared_store.convert_existing(conn)
    registry.invalidate()

    for result in results:
        logger.info(f"  {result.slug}: vid {result.vid}, {result.members} items, "
                    f"{result.merge.new} new revisions, {result.merge.reused} reused")

    if results:
        # Adding storage_fp and vids rewrote every adopted row; reclaim the space.
        logger.info("VACUUM FULL of the store's items table...")
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f"VACUUM (FULL, ANALYZE) {shared_store.STORE_SCHEMA}.items"))
        for result in results:
            maintain_store(result.schema)
    return True


def read_extract_index(root: Path) -> list:
    path = root / "index.json"
    if not path.exists():
        return []
    import json

    with open(path) as f:
        entries = json.load(f)
    if not isinstance(entries, list):
        raise ValueError(f"{path} must hold a list of builds")
    for entry in entries:
        missing = {"slug", "family", "status"} - set(entry)
        if missing:
            raise ValueError(f"{path}: entry {entry} lacks {sorted(missing)}")
        if entry["status"] not in EXTRACT_STATUSES:
            raise ValueError(f"{path}: unknown status {entry['status']!r} for {entry['slug']}")
    return entries


def read_extract_manifest(root: Path, slug: str) -> dict:
    import json

    folder = root / slug
    path = folder / "manifest.json"
    if not path.exists():
        raise FileNotFoundError(f"No manifest for '{slug}': {path}")
    with open(path) as f:
        manifest = json.load(f)
    if manifest.get("slug") != slug:
        raise ValueError(f"{path} names slug {manifest.get('slug')!r}, expected {slug!r}")
    for name in ("items.json", "nanos.json"):
        if not (folder / name).exists():
            raise FileNotFoundError(f"Missing {folder / name}")
    return manifest


def extract_sort_order(entries: list, slug: str, family: str) -> int:
    same_family = [e["slug"] for e in entries if e["family"] == family]
    base = FAMILY_SORT_BASE.get(family, OTHER_FAMILY_SORT_BASE)
    if slug not in same_family:
        return base
    return base + len(same_family) - same_family.index(slug)


def extract_up_to_date(slug: str, extract_slug: str, sha: Optional[str],
                       commit: Optional[str]) -> bool:
    """Whether ``slug`` is installed from the same extract, build database and extractor."""
    from app.core import shared_store
    from app.core.database import engine

    with engine.connect() as conn:
        row = shared_store.version_row(conn, slug)
        return bool(
            row
            and row.get("vid") is not None
            and shared_store.schema_layout(conn, row["schema_name"]) == "shared"
            and row.get("extract_slug") == extract_slug
            and (row.get("rdb_dat_sha256") or None) == (sha or None)
            and (row.get("tinkerparse_commit") or None) == (commit or None)
        )


def extract_fields(args, entries: list, entry: dict, existing: Optional[dict], *,
                   client_build: Optional[str], features: dict, extract_slug: str,
                   commit: Optional[str], sha: Optional[str], notes: str) -> dict:
    """Registry row for an extracted build; manual edits of an existing row
    (display name, order, date, notes, default, enabled) are kept."""
    family = entry["family"]
    build = entry.get("build") or client_build or entry["slug"]
    return dict(
        slug=entry["slug"],
        display_name=existing["display_name"] if existing
        else f"{FAMILY_LABELS.get(family, family.upper())} {build}",
        family=family,
        parent_slug=existing["parent_slug"] if existing else None,
        client_build=client_build,
        snapshot_date=existing["snapshot_date"] if existing else None,
        sort_order=existing["sort_order"] if existing
        else extract_sort_order(entries, entry["slug"], family),
        enabled=existing["enabled"] if existing else not getattr(args, "disabled", False),
        is_default=bool(existing and existing["is_default"]),
        features=features,
        notes=existing["notes"] if existing and existing.get("notes") else notes,
        extract_slug=extract_slug,
        tinkerparse_commit=commit,
        rdb_dat_sha256=sha,
    )


def apply_lineage(entries: list) -> None:
    """Parent of each registered build = the previous registered build of its
    family, in index order. The first build of a family keeps its parent."""
    from sqlalchemy import text
    from app.core.database import engine

    with engine.begin() as conn:
        registered = set(conn.execute(text("SELECT slug FROM public.game_versions")).scalars())
        for family in dict.fromkeys(e["family"] for e in entries):
            chain = [e["slug"] for e in entries
                     if e["family"] == family and e["slug"] in registered]
            for parent, child in zip(chain, chain[1:]):
                conn.execute(
                    text("UPDATE public.game_versions SET parent_slug = :p, "
                         "updated_at = CURRENT_TIMESTAMP "
                         "WHERE slug = :c AND parent_slug IS DISTINCT FROM :p"),
                    {"p": parent, "c": child},
                )


def import_extract(args, root: Path, entries: list, entry: dict) -> bool:
    import argparse as _argparse
    from app.core.migration_runner import MigrationRunner

    slug = entry["slug"]
    manifest = read_extract_manifest(root, slug)
    sha = manifest.get("rdb_dat_sha256") or entry.get("rdb_dat_sha256")
    commit = manifest.get("tinkerparse_commit")

    if not args.force and extract_up_to_date(slug, slug, sha, commit):
        logger.info(f"'{slug}' is installed from this extract already; skipping (--force to reload)")
        return True
    if manifest.get("parse_errors"):
        logger.warning(f"'{slug}': the extractor reported {len(manifest['parse_errors'])} "
                       "parse errors; those records are missing from the dump")

    folder = root / slug
    load_args = _argparse.Namespace(
        version=slug,
        database_url=getattr(args, 'database_url', None),
        csv_mode=True,
        optimized=False,
        ultra=False,
        clear=True,
        chunk_size=args.chunk_size,
        batch_size=args.batch_size,
        items_file=str(folder / "items.json"),
        nanos_file=str(folder / "nanos.json"),
        perks_file=args.perks_file,
        symbiants_file=args.symbiants_file,
        no_perks=not args.perks_file,
        no_symbiants=not args.symbiants_file,
        nanos_csv=args.nanos_csv,
        client_build=manifest.get("client_build") or entry.get("build"),
    )
    features = {
        "items": True,
        "nanos": True,
        "perks": bool(args.perks_file),
        "symbiants": bool(args.symbiants_file),
        "sources": bool(args.symbiants_file or args.nanos_csv),
    }
    notes = (f"Client build {manifest.get('client_build') or entry.get('build')}, "
             f"extracted by TinkerParse {(commit or 'unknown')[:12]}")

    def fields(client_build: Optional[str]) -> dict:
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        existing = {row['slug']: row for row in runner.list_versions()}.get(slug)
        return extract_fields(args, entries, entry, existing,
                              client_build=load_args.client_build or client_build,
                              features=features, extract_slug=slug, commit=commit,
                              sha=sha, notes=notes)

    logger.info(f"=== Importing extract '{slug}' ({manifest.get('item_count')} items, "
                f"{manifest.get('nano_count')} nanos) ===")
    return stage_and_install(load_args, slug, fields)


def import_duplicate(args, entries: list, entry: dict) -> bool:
    """Register a build whose client database is identical to another build's."""
    from app.core import shared_store
    from app.core.database import engine
    from app.core.versions import registry, schema_name_for

    slug, source = entry["slug"], entry.get("extract_slug")
    if not source or source == slug:
        logger.error(f"'{slug}' is a duplicate without a distinct extract_slug")
        return False

    with engine.connect() as conn:
        source_row = shared_store.version_row(conn, source)
        existing = shared_store.version_row(conn, slug)
    if not source_row or source_row.get("vid") is None:
        logger.error(f"'{slug}' duplicates '{source}', which is not installed; import it first")
        return False

    sha = entry.get("rdb_dat_sha256") or source_row.get("rdb_dat_sha256")
    commit = source_row.get("tinkerparse_commit")
    if not args.force and extract_up_to_date(slug, source, sha, commit):
        logger.info(f"'{slug}' is registered as a duplicate of '{source}' already; skipping")
        return True

    runner, staging = prepare_staging(args, slug)
    if runner is None:
        return False
    try:
        fields = extract_fields(
            args, entries, entry, existing,
            client_build=entry.get("build") or source_row.get("client_build"),
            features=dict(source_row.get("features") or {}),
            extract_slug=source, commit=commit, sha=sha,
            notes=f"Client database identical to {source}",
        )
        with engine.begin() as conn:
            result = shared_store.install_duplicate(conn, schema_name_for(staging), fields, source)
        registry.invalidate()
        maintain_store(result.schema)
        logger.info(f"Registered '{slug}' (vid {result.vid}) with the {result.members} "
                    f"revisions of '{source}'")
        return True
    except Exception as e:
        logger.error(f"Registering duplicate '{slug}' failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        drop_staging(runner, staging)


def import_extracts(args) -> bool:
    """Import builds from an extracts folder (see .docs/plans/multi-version-support/extract-contract.md).

    Extracted builds load in index order, then duplicates; failed and
    missing_db builds are skipped. Finally each family's lineage is set from
    the index order.
    """
    if not args.extracts_dir:
        logger.error("--extracts-dir is required")
        return False
    root = Path(os.path.expandvars(args.extracts_dir)).expanduser()
    try:
        entries = read_extract_index(root)
    except Exception as e:
        logger.error(f"Cannot read {root / 'index.json'}: {e}")
        return False

    from app.core.migration_runner import MigrationRunner
    MigrationRunner(db_url=getattr(args, 'database_url', None)).run_global_migrations()

    by_slug = {e["slug"]: e for e in entries}
    wanted = args.slug or [e["slug"] for e in entries]
    if not wanted:
        logger.error(f"Nothing to import: {root} has no index.json and no --slug was given")
        return False

    targets = []
    for slug in wanted:
        entry = by_slug.get(slug)
        if entry is None:
            # A folder outside the index: take what the manifest says.
            try:
                manifest = read_extract_manifest(root, slug)
            except Exception as e:
                logger.error(str(e))
                return False
            entry = {"slug": slug, "family": manifest.get("family") or "ao",
                     "build": manifest.get("client_build"), "status": "extracted",
                     "extract_slug": slug, "rdb_dat_sha256": manifest.get("rdb_dat_sha256")}
        targets.append(entry)
    targets.sort(key=lambda e: e["status"] == "duplicate")  # stable: index order kept

    outcome = {}
    for entry in targets:
        slug, status = entry["slug"], entry["status"]
        if status in ("failed", "missing_db"):
            logger.warning(f"Skipping '{slug}': {status} {entry.get('error', '')}".rstrip())
            outcome[slug] = status
            continue
        try:
            ok = (import_duplicate(args, entries, entry) if status == "duplicate"
                  else import_extract(args, root, entries, entry))
        except Exception as e:
            logger.error(f"'{slug}': {e}")
            ok = False
        outcome[slug] = "ok" if ok else "FAILED"

    apply_lineage(entries or targets)
    from app.core.versions import registry
    registry.invalidate()

    logger.info("=" * 60)
    for slug, result in outcome.items():
        logger.info(f"  {slug:<24} {result}")
    logger.info("=" * 60)
    return all(r in ("ok", "failed", "missing_db") for r in outcome.values())


def import_single_dataset(args, importer_func, features: dict, reads_items: bool = False) -> bool:
    """Run one dataset import, then register the version and its revisions.

    ``features`` holds only the flags this command establishes; the rest of the
    registry row's features are left as they are. Only for databases without the
    shared store: these commands add rows to a version's own tables.
    """
    if shared_store_exists():
        logger.error("Single-dataset imports load into a version's own tables, which the "
                     "shared store layout does not have. Re-import the whole version: "
                     f"python import_cli.py all --version {version_slug(args)} --csv-mode ...")
        return False

    runner, schema = prepare_schema(args)
    if runner is None:
        return False

    if not importer_func(args, runner=runner):
        return False

    slug = version_slug(args)
    if not create_database_indexes(slug):
        logger.warning("Index creation failed, but data import succeeded")

    client_build = args.client_build
    if not client_build and reads_items:
        try:
            client_build = read_client_build(
                resolve_data_file_path(args.items_file, "items.json"))
        except FileNotFoundError:
            client_build = None

    if not finalize_version(args, runner, features, client_build):
        logger.warning("Version finalization failed, but data import succeeded")

    return True


# ---------------------------------------------------------------------------
# Registry commands
# ---------------------------------------------------------------------------

def list_versions(args) -> bool:
    """Print the game version registry."""
    from app.core.migration_runner import MigrationRunner

    runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
    rows = runner.list_versions()
    schemas = set(runner.list_version_schemas())

    if not rows:
        logger.info("No game versions registered yet")
        return True

    header = (f"{'SLUG':<16} {'SCHEMA':<20} {'VID':<5} {'FAMILY':<8} {'BUILD':<12} "
              f"{'DATE':<12} {'FLAGS':<20} DISPLAY NAME")
    print(header)
    print("-" * len(header))
    for row in rows:
        flags = []
        if row['is_default']:
            flags.append("default")
        if not row['enabled']:
            flags.append("disabled")
        if row['schema_name'] not in schemas:
            flags.append("NO SCHEMA")
        elif row.get('vid') is None:
            flags.append("own tables")
        if row.get('extract_slug') and row['extract_slug'] != row['slug']:
            flags.append(f"dup of {row['extract_slug']}")
        print(f"{row['slug']:<16} {row['schema_name']:<20} {str(row.get('vid') or '-'):<5} "
              f"{row['family']:<8} "
              f"{str(row['client_build'] or '-'):<12} {str(row['snapshot_date'] or '-'):<12} "
              f"{','.join(flags) or '-':<20} {row['display_name']}")

    for row in rows:
        if row['features']:
            enabled = sorted(k for k, v in row['features'].items() if v)
            missing = sorted(k for k, v in row['features'].items() if not v)
            print(f"\n{row['slug']}: has {', '.join(enabled) or 'nothing'}"
                  + (f"; missing {', '.join(missing)}" if missing else ""))
        if row['notes']:
            print(f"{row['slug']} notes: {row['notes']}")

    return True


def register_version_command(args) -> bool:
    """Create or update a registry row without importing anything."""
    from app.core.migration_runner import MigrationRunner

    runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
    runner.run_global_migrations()

    slug = version_slug(args)
    features = build_features(args) if (args.no_perks or args.no_symbiants) else {}
    if register_version_from_args(args, runner, features):
        logger.info(f"Version '{slug}' registered")
        return True
    return False


def adopt_public(args) -> bool:
    """Move an existing single-version install from public into gv_<slug>."""
    from app.core.migration_runner import MigrationRunner

    slug = version_slug(args)
    if shared_store_exists():
        logger.error("adopt-public predates the shared store. Adopt into a database without "
                     "one, then run convert-shared.")
        return False
    logger.warning(f"Adopting the tables in 'public' as game version '{slug}'")

    try:
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        runner.run_global_migrations()
        moved = runner.adopt_public_into_schema(slug)
        logger.info(f"Moved {len(moved)} objects into the schema for '{slug}': "
                    f"{', '.join(moved) if moved else '(none)'}")
    except Exception as e:
        logger.error(f"Adoption failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

    if not register_version_from_args(args, runner, build_features(args)):
        return False

    try:
        populate_nano_properties(slug)
        rows = populate_item_revisions(slug)
    except Exception as e:
        logger.error(f"Failed to populate nano_properties or item_revisions: {e}")
        return False

    if rows == 0:
        logger.warning(
            "Adopted items have no content hashes (they predate migration 007), so "
            "no item_revisions rows were written. Re-import this version from its "
            "dump files to build its change history."
        )

    return True


def nano_properties_command(args) -> bool:
    """Rebuild nano_properties without re-importing anything.

    Per-version table layout: apply pending migrations to the version's schema
    and rebuild its table. Shared store: nano properties derive from a revision
    alone, so the store's table is rebuilt for every revision at once.
    """
    from sqlalchemy import text
    from sqlalchemy.orm import Session
    from app.core import shared_store
    from app.core.database import engine
    from app.core.migration_runner import MigrationRunner
    from app.core.nano_properties import populate
    from app.core.versions import registry, schema_name_for

    slug = version_slug(args)
    schema = schema_name_for(slug)

    try:
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        if schema not in runner.list_version_schemas():
            logger.error(f"No schema {schema} for version '{slug}'; import it first")
            return False
        runner.run_global_migrations()
        with engine.connect() as conn:
            layout = shared_store.schema_layout(conn, schema)
        if layout == "shared":
            logger.info("Shared store: re-deriving nano_properties for every revision")
            with engine.connect() as conn:
                conn.execute(text(f"SET LOCAL search_path TO {shared_store.STORE_SCHEMA}, public"))
                db = Session(bind=conn)
                count = populate(db)
                db.commit()
            logger.info(f"Wrote nano_properties for {count} nano revisions")
            return True
        runner.run_migrations(schema)
        registry.invalidate()
        populate_nano_properties(slug)
        return True
    except Exception as e:
        logger.error(f"Failed to rebuild nano properties for '{slug}': {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def drop_version(args) -> bool:
    """Remove a version: its membership in the shared store, its schema and its
    registry row; then garbage-collect revisions no version holds."""
    from app.core import shared_store
    from app.core.database import engine
    from app.core.versions import registry, schema_name_for

    slug = version_slug(args)

    if not args.yes:
        logger.error(f"Refusing to drop version '{slug}' without --yes")
        return False

    try:
        with engine.begin() as conn:
            result = shared_store.remove_version(conn, slug)
        registry.invalidate()
        logger.info(f"Dropped schema {schema_name_for(slug)} for '{slug}': {result}")
        return True
    except Exception as e:
        logger.error(f"Failed to drop version '{slug}': {e}")
        return False


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_files(args=None):
    """
    Validate that all required files exist.

    Args:
        args: Optional argparse.Namespace with file path overrides
    """
    files_to_check = {
        'items.json': getattr(args, 'items_file', None) if args else None,
        'nanos.json': getattr(args, 'nanos_file', None) if args else None,
    }
    if not getattr(args, 'no_symbiants', False):
        files_to_check['symbiants.csv'] = getattr(args, 'symbiants_file', None) if args else None
    if not getattr(args, 'no_perks', False):
        files_to_check['perks.json'] = getattr(args, 'perks_file', None) if args else None

    missing = []

    for default_filename, cli_path in files_to_check.items():
        try:
            path = resolve_data_file_path(cli_path, default_filename)
            size_mb = path.stat().st_size / (1024 * 1024)
            logger.info(f"✓ {path}: {size_mb:.1f} MB")
        except FileNotFoundError:
            missing.append(default_filename)
            logger.error(f"✗ {default_filename}: Not found")

    if missing:
        logger.error(f"Missing files: {', '.join(missing)}")
        return False

    logger.info("All import files found")
    return True


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

DATA_COMMANDS = {"symbiants", "items", "nanos", "all"}
REGISTRY_COMMANDS = {"versions", "register", "adopt-public", "drop-version", "nano-properties"}
STORE_COMMANDS = {"convert-shared", "import-extracts"}


def main():
    parser = argparse.ArgumentParser(
        description="TinkerTools Data Import Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Default locations, default version
  python import_cli.py validate                    # Check if files exist
  python import_cli.py items --chunk-size 50       # Import items with smaller chunks (standard mode)
  python import_cli.py items --optimized           # Import items using optimized importer (10-20x faster)
  python import_cli.py all --csv-mode --clear      # Rebuild the default version from scratch (fastest)

  # A second game version, from its own dump files
  python import_cli.py all --version prk-2026-01 --csv-mode \\
      --items-file ~/prk/items.json --nanos-file ~/prk/nanos.json \\
      --no-perks --no-symbiants --display-name "Project Rubi-Ka" --family prk

  # Shared store
  python import_cli.py convert-shared --yes        # one-time: per-version tables -> gd + views
  python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts
  python import_cli.py import-extracts --extracts-dir ~/projects/AO/extracts --slug ao-17-10-5 --force

  # Registry
  python import_cli.py versions
  python import_cli.py register --version ao-2024-02 --set-default --display-name "Anarchy Online (Live)"
  python import_cli.py drop-version --version ao-15-0-0 --yes   # membership + schema + GC
  python import_cli.py nano-properties --version ao-2024-02     # re-derive nano school/profession/level

Game Versions:
  Content lives once in the shared store (schema gd); gv_<slug> holds views plus the
  version's curated tables. 'all' and 'import-extracts' load into a staging schema
  (gv_stage_<slug>) with the importers below, apply --nanos-csv there, then merge by
  content fingerprint and replace gv_<slug>. Other versions are not affected.

Optimization Modes:
  Standard mode: Uses original importer, processes items one at a time (slower but stable)
  Optimized mode (--optimized): Batch operations, singleton preloading, reduced flushes (10-20x faster)
  CSV mode (--csv-mode, 'all' only): Transform to CSV + PostgreSQL COPY (55x faster, recommended)
  ULTRA mode (--ultra --optimized --clear): EXPERIMENTAL! All aggressive optimizations (40-60x faster)
    WARNING: Data loss possible on crash! Uses PostgreSQL COPY, drops indexes, UNLOGGED tables,
    synchronous_commit=OFF. Requires --clear flag. Only use with backups!

Data Files (default locations):
  items.json       407 MB    backend/database/items.json
  nanos.json       44 MB     backend/database/nanos.json
  symbiants.csv    208 KB    backend/database/symbiants.csv (skip with --no-symbiants)
  perks.json       411 KB    backend/database/perks.json (skip with --no-perks)

  Use --{dataset}-file to override default locations. Supports ~ and environment variables.

Environment:
  DATABASE_URL    Database connection string (required)
                  Example: postgresql://user:pass@localhost:5432/tinkertools
        """
    )

    parser.add_argument(
        "command",
        choices=sorted(DATA_COMMANDS | REGISTRY_COMMANDS | STORE_COMMANDS | {"validate"}),
        help="Import or registry command to run"
    )

    # --- game version options ---
    version_group = parser.add_argument_group("game version")
    version_group.add_argument(
        "--version",
        type=str,
        default=None,
        help="Game version slug to import into (default: DEFAULT_GAME_VERSION, normally 'ao'). "
             "Data lands in the schema gv_<slug>."
    )
    version_group.add_argument(
        "--display-name",
        type=str,
        default=None,
        help="Display name for the version selector (default: the slug)"
    )
    version_group.add_argument(
        "--family",
        type=str,
        default=None,
        help="Registry family grouping versions in the selector "
             "(default: 'prk' for slugs starting with 'prk', else 'ao')"
    )
    version_group.add_argument(
        "--parent",
        type=str,
        default=None,
        help="Slug of the snapshot this version follows (lineage for item history)"
    )
    version_group.add_argument(
        "--client-build",
        type=str,
        default=None,
        help="Client build string (default: the Version field of the first item record)"
    )
    version_group.add_argument(
        "--snapshot-date",
        type=str,
        default=None,
        help="Date of the dump, YYYY-MM-DD"
    )
    version_group.add_argument(
        "--sort-order",
        type=int,
        default=None,
        help="Sort position in the version selector (default: 0)"
    )
    version_group.add_argument(
        "--set-default",
        action="store_true",
        help="Serve this version for requests without a version segment"
    )
    version_group.add_argument(
        "--disabled",
        action="store_true",
        help="Register the version but hide it from the API and the selector"
    )
    version_group.add_argument(
        "--notes",
        type=str,
        default=None,
        help="Provenance notes (client build, extractor, curated files used)"
    )
    version_group.add_argument(
        "--no-perks",
        action="store_true",
        help="Import without perk metadata (versions with no perks, e.g. pre-Shadowlands)"
    )
    version_group.add_argument(
        "--no-symbiants",
        action="store_true",
        help="Import without mobs, sources and symbiant drops (versions with no curated source data)"
    )
    version_group.add_argument(
        "--yes",
        action="store_true",
        help="Confirm a destructive registry command (required by drop-version)"
    )

    store_group = parser.add_argument_group("shared store and extracts")
    store_group.add_argument(
        "--extracts-dir",
        type=str,
        default=None,
        help="import-extracts: folder holding index.json and one <slug>/ per build"
    )
    store_group.add_argument(
        "--slug",
        action="append",
        default=None,
        help="import-extracts: build to import (repeatable; default: every build in index.json)"
    )
    store_group.add_argument(
        "--force",
        action="store_true",
        help="import-extracts: reload builds already installed from the same extract"
    )
    store_group.add_argument(
        "--nanos-csv",
        type=str,
        default=None,
        help="Curated crystal/strain CSV applied in staging before the merge "
             "(update_nanos.py), e.g. backend/all_nanos_compacted.csv"
    )

    parser.add_argument(
        "--clear",
        action="store_true",
        help="Accepted for compatibility: every 'all' import replaces the version "
             "(staged, then installed into the shared store)"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=100,
        help="Number of items to process per chunk (default: 100, used in standard mode)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Batch size for optimized importer (default: 1000, used with --optimized)"
    )
    parser.add_argument(
        "--optimized",
        action="store_true",
        help="Use optimized importer (10-20x faster, maintains data accuracy)"
    )
    parser.add_argument(
        "--ultra",
        action="store_true",
        help="EXPERIMENTAL: Enable ULTRA MODE (40-60x faster, DATA LOSS RISK ON CRASH). "
             "Uses all aggressive optimizations: PostgreSQL COPY, index dropping, "
             "UNLOGGED tables, synchronous_commit=OFF. Requires --optimized flag. "
             "WARNING: Data loss possible if server crashes during import!"
    )
    parser.add_argument(
        "--csv-mode",
        action="store_true",
        help="Use CSV pipeline (55x faster, recommended). Streams data through CSV files "
             "using PostgreSQL COPY for maximum performance. Works with 'all' command only."
    )
    parser.add_argument(
        "--database-url",
        help="Database URL (overrides DATABASE_URL environment variable)"
    )
    parser.add_argument(
        "--items-file",
        type=str,
        default=None,
        help="Path to items.json file (default: backend/database/items.json)"
    )
    parser.add_argument(
        "--nanos-file",
        type=str,
        default=None,
        help="Path to nanos.json file (default: backend/database/nanos.json)"
    )
    parser.add_argument(
        "--symbiants-file",
        type=str,
        default=None,
        help="Path to symbiants.csv file (default: backend/database/symbiants.csv)"
    )
    parser.add_argument(
        "--perks-file",
        type=str,
        default=None,
        help="Path to perks.json file (default: backend/database/perks.json)"
    )

    args = parser.parse_args()

    # Validate files first (doesn't need DB connection)
    if args.command == "validate":
        success = validate_files(args)
        sys.exit(0 if success else 1)

    # Check DATABASE_URL is set for database operations
    if not args.database_url and not os.getenv("DATABASE_URL"):
        logger.error("DATABASE_URL environment variable must be set or --database-url provided")
        logger.error("Example: export DATABASE_URL='postgresql://user:pass@localhost:5432/tinkertools'")
        sys.exit(1)

    # Set database URL before any app module builds an engine from it
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    # Slug validation happens up front so a typo fails before anything is touched
    from app.core.versions import InvalidVersionSlug, validate_slug
    try:
        validate_slug(version_slug(args))
    except InvalidVersionSlug as e:
        logger.error(str(e))
        sys.exit(1)

    if args.command in DATA_COMMANDS and not validate_files(args):
        logger.error("File validation failed, aborting import")
        sys.exit(1)

    # Warn about destructive operations
    if args.clear and args.command in DATA_COMMANDS:
        slug = version_slug(args)
        logger.warning(f"⚠️  --clear flag specified: schema gv_* for version '{slug}' will be "
                       f"DROPPED and rebuilt from the migrations!")
        logger.warning(f"    All existing data for version '{slug}' will be permanently deleted.")
        logger.warning("    Other game versions are not affected.")
        try:
            response = input("Are you sure you want to continue? (y/N): ").strip().lower()
            if response != 'y':
                logger.info("Import cancelled")
                sys.exit(0)
        except EOFError:
            # Non-interactive environment, assume yes
            logger.info("Non-interactive environment detected, proceeding with schema reset")

    # Run command
    success = False

    try:
        if args.command == "symbiants":
            success = import_single_dataset(
                args, import_symbiants,
                features={"symbiants": not args.no_symbiants, "sources": not args.no_symbiants})
        elif args.command == "items":
            success = import_single_dataset(
                args, import_items,
                features={"items": True, "perks": not args.no_perks},
                reads_items=True)
        elif args.command == "nanos":
            success = import_single_dataset(
                args, import_nanos, features={"nanos": True})
        elif args.command == "all":
            success = import_all(args)
        elif args.command == "versions":
            success = list_versions(args)
        elif args.command == "register":
            success = register_version_command(args)
        elif args.command == "adopt-public":
            success = adopt_public(args)
        elif args.command == "drop-version":
            success = drop_version(args)
        elif args.command == "nano-properties":
            success = nano_properties_command(args)
        elif args.command == "convert-shared":
            success = convert_shared(args)
        elif args.command == "import-extracts":
            success = import_extracts(args)
    except KeyboardInterrupt:
        logger.info("\nImport interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
