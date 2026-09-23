#!/usr/bin/env python3
"""
TinkerTools Data Import Utility

Imports one game-data snapshot (a "game version") into its own PostgreSQL
schema, ``gv_<slug>``. The registry of versions lives in ``public.game_versions``
and is written by this tool after each successful load.

Usage:
    # Set database URL
    export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"

    # Import a version (CSV pipeline, fastest)
    python import_cli.py all --version ao --csv-mode --clear \
        --items-file ~/ao-data/items.json --nanos-file ~/ao-data/nanos.json

    # Import a private-server snapshot with no curated perk/symbiant data
    python import_cli.py all --version prk --csv-mode --clear \
        --items-file ~/prk/items.json --nanos-file ~/prk/nanos.json \
        --no-perks --no-symbiants --display-name "Project Rubi-Ka" --family prk

    # Import individual datasets (standard mode)
    python import_cli.py symbiants --version ao
    python import_cli.py items --version ao --chunk-size 50
    python import_cli.py nanos --version ao --optimized

    # Registry management
    python import_cli.py versions                 # list registered versions
    python import_cli.py register --version ao --set-default
    python import_cli.py adopt-public --version ao   # one-time public -> gv_ao move
    python import_cli.py drop-version --version old-snapshot --yes

    # Validate files exist
    python import_cli.py validate

Every import command applies pending global migrations (``public``) and then
either rebuilds (``--clear``) or migrates the version's own schema before
loading. After the load it registers the version and rebuilds its rows in
``public.item_revisions`` from the per-item content hashes.

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
        "sources": not args.no_symbiants,
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


def register_version_from_args(args, runner, features: dict,
                               client_build: Optional[str] = None) -> bool:
    """Upsert this version's registry row, merging into any existing features."""
    from app.core.versions import registry

    slug = version_slug(args)

    try:
        existing = {row['slug']: row for row in runner.list_versions()}.get(slug)
        merged_features = dict(existing['features'] or {}) if existing else {}
        merged_features.update(features)

        runner.register_version(
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


def finalize_version(args, runner, features: dict, client_build: Optional[str] = None) -> bool:
    """Register the version, then rebuild its cross-version revision index."""
    slug = version_slug(args)

    if not register_version_from_args(args, runner, features, client_build):
        return False

    try:
        rows = populate_item_revisions(slug)
        if rows == 0:
            logger.warning(
                "No item_revisions rows written: the items in this schema carry no "
                "content hashes. Re-import the version to build its change history."
            )
        return True
    except Exception as e:
        logger.error(f"Failed to populate item_revisions for '{slug}': {e}")
        return False


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


def import_all_csv_mode(args, runner=None):
    """
    Import all data using CSV pipeline (55x faster).

    Workflow:
    1. Prepare the version schema (global migrations + per-version migrations)
    2. Merge items.json + nanos.json
    3. Transform to CSV files
    4. Transform symbiants.csv to 3 CSV files (unless --no-symbiants)
    5. Load all CSVs via PostgreSQL COPY
    6. Refresh symbiant_items view, create indexes, register the version
    """
    import tempfile
    import json
    import shutil

    from app.core.csv_transformer import StreamingCSVTransformer, load_perk_metadata
    from app.core.csv_loader import StreamingCSVLoader
    from app.core.database import session_for_version

    slug = version_slug(args)
    logger.info(f"Starting CSV pipeline import into version '{slug}'...")

    if runner is None:
        runner, schema = prepare_schema(args)
        if runner is None:
            return False

    # Resolve file paths
    try:
        items_path = resolve_data_file_path(args.items_file, "items.json")
        nanos_path = resolve_data_file_path(args.nanos_file, "nanos.json")
        perks_path = None if args.no_perks else resolve_data_file_path(args.perks_file, "perks.json")
        symbiants_path = None if args.no_symbiants else resolve_data_file_path(
            args.symbiants_file, "symbiants.csv")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

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
            logger.info(f"Client build from dump: {client_build}")

        # Write temp file
        merged_json = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(merged_data, merged_json)
        merged_json.close()

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

        # === PHASE 4: Create Indexes ===
        logger.info("=== Phase 4: Indexes ===")
        if not create_database_indexes(slug):
            logger.warning("Index creation failed, but data import succeeded")

        # === PHASE 5: Registry + revision index ===
        logger.info("=== Phase 5: Version registry ===")
        features = build_features(args, nanos=True, items=True)
        if not finalize_version(args, runner, features, client_build):
            logger.warning("Version registration failed, but data import succeeded")

        # === SUMMARY ===
        total_time = (transform_stats['total_time']
                      + symbiant_stats.get('symbiant_time', 0)
                      + load_stats['total_time'])
        logger.info("="*60)
        logger.info("CSV PIPELINE COMPLETE")
        logger.info(f"  Version:    {slug}")
        logger.info(f"  Total:      {total_time:.1f}s")
        logger.info(f"  Items:      {transform_stats['items']}")
        logger.info(f"  Mobs:       {symbiant_stats['mobs']}")
        logger.info(f"  Throughput: {load_stats['rows_per_second']:.0f} rows/sec")
        logger.info("="*60)

        return True

    except Exception as e:
        logger.error(f"CSV import failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

    finally:
        shutil.rmtree(csv_dir, ignore_errors=True)


def import_all(args):
    """Import all data files in order."""
    slug = version_slug(args)

    # The schema is prepared once for the whole run
    runner, schema = prepare_schema(args)
    if runner is None:
        return False

    # Use CSV mode if requested
    if hasattr(args, 'csv_mode') and args.csv_mode:
        return import_all_csv_mode(args, runner=runner)

    logger.info(f"Starting full data import into version '{slug}'...")

    success = True

    # Create a modified args object that doesn't re-prepare the schema
    import argparse as _argparse
    ultra_mode = args.ultra if hasattr(args, 'ultra') else False
    individual_args = _argparse.Namespace(
        version=slug,
        chunk_size=args.chunk_size if hasattr(args, 'chunk_size') else 100,
        batch_size=args.batch_size if hasattr(args, 'batch_size') else 5000,
        optimized=args.optimized if hasattr(args, 'optimized') else False,
        ultra=ultra_mode,
        # Keep clear=True for ultra mode safety checks; the schema reset already happened
        clear=ultra_mode if ultra_mode else False,
        no_perks=args.no_perks,
        no_symbiants=args.no_symbiants,
        database_url=getattr(args, 'database_url', None),
        # PASS THROUGH FILE PATHS
        items_file=args.items_file if hasattr(args, 'items_file') else None,
        nanos_file=args.nanos_file if hasattr(args, 'nanos_file') else None,
        symbiants_file=args.symbiants_file if hasattr(args, 'symbiants_file') else None,
        perks_file=args.perks_file if hasattr(args, 'perks_file') else None
    )

    # Items first (contains all symbiant items that mobs will reference)
    logger.info("=== Importing Items ===")
    if not import_items(individual_args, runner=runner):
        success = False
        logger.error("Items import failed, continuing with nanos...")

    # Nanos
    logger.info("=== Importing Nanos ===")
    if not import_nanos(individual_args, runner=runner):
        success = False
        logger.error("Nanos import failed, continuing with symbiants...")

    # Symbiants/Mobs last (creates links to items that now exist)
    logger.info("=== Importing Mobs and Sources ===")
    if not import_symbiants(individual_args, runner=runner):
        success = False
        logger.error("Symbiant/Mobs import failed")

    # Create performance indexes after all data is imported
    logger.info("=== Creating Performance Indexes ===")
    if not create_database_indexes(slug):
        logger.warning("Index creation failed, but data import succeeded")

    # Registry + cross-version revision index
    logger.info("=== Version registry ===")
    client_build = args.client_build
    if not client_build:
        try:
            client_build = read_client_build(
                resolve_data_file_path(args.items_file, "items.json"))
        except FileNotFoundError:
            client_build = None
    if not finalize_version(args, runner, build_features(args), client_build):
        logger.warning("Version registration failed, but data import succeeded")

    if success:
        logger.info("All imports completed successfully!")
    else:
        logger.warning("Some imports failed, check logs for details")

    return success


def import_single_dataset(args, importer_func, features: dict, reads_items: bool = False) -> bool:
    """Run one dataset import, then register the version and its revisions.

    ``features`` holds only the flags this command establishes; the rest of the
    registry row's features are left as they are.
    """
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
        logger.warning("Version registration failed, but data import succeeded")

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

    header = f"{'SLUG':<16} {'SCHEMA':<20} {'FAMILY':<8} {'BUILD':<12} {'DATE':<12} {'FLAGS':<16} DISPLAY NAME"
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
        print(f"{row['slug']:<16} {row['schema_name']:<20} {row['family']:<8} "
              f"{str(row['client_build'] or '-'):<12} {str(row['snapshot_date'] or '-'):<12} "
              f"{','.join(flags) or '-':<16} {row['display_name']}")

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
        rows = populate_item_revisions(slug)
    except Exception as e:
        logger.error(f"Failed to populate item_revisions: {e}")
        return False

    if rows == 0:
        logger.warning(
            "Adopted items have no content hashes (they predate migration 007), so "
            "no item_revisions rows were written. Re-import this version from its "
            "dump files to build its change history."
        )

    return True


def drop_version(args) -> bool:
    """Drop a version's schema and its registry row."""
    from app.core.migration_runner import MigrationRunner

    slug = version_slug(args)

    if not args.yes:
        logger.error(f"Refusing to drop version '{slug}' without --yes")
        return False

    try:
        runner = MigrationRunner(db_url=getattr(args, 'database_url', None))
        schema = runner.drop_version_schema(slug)
        removed = runner.unregister_version(slug)
        logger.info(f"Dropped schema {schema} and {removed} registry row(s) for '{slug}'")

        from app.core.versions import registry
        registry.invalidate()
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
REGISTRY_COMMANDS = {"versions", "register", "adopt-public", "drop-version"}


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
  python import_cli.py all --version prk --csv-mode --clear \\
      --items-file ~/prk/items.json --nanos-file ~/prk/nanos.json \\
      --no-perks --no-symbiants --display-name "Project Rubi-Ka" --family prk

  # Registry
  python import_cli.py versions
  python import_cli.py register --version ao --set-default --display-name "Anarchy Online (Live)"
  python import_cli.py adopt-public --version ao   # move existing public tables into gv_ao
  python import_cli.py drop-version --version ao-15.0 --yes

Game Versions:
  Each version lives in its own PostgreSQL schema, gv_<slug>. --clear rebuilds only
  that schema; other versions are untouched. Every import applies pending global
  migrations (public.game_versions, public.item_revisions), migrates the version's
  schema, then registers the version and rebuilds its item_revisions rows.

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
        choices=sorted(DATA_COMMANDS | REGISTRY_COMMANDS | {"validate"}),
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

    parser.add_argument(
        "--clear",
        action="store_true",
        help="Drop and recreate this version's schema from the migrations before import "
             "(WARNING: DESTRUCTIVE! All data for this game version will be lost!)"
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
