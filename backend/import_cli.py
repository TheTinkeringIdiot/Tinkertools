#!/usr/bin/env python3
"""
TinkerTools Data Import Utility

A standalone utility for importing game data into the TinkerTools database.
Uses the DATABASE_URL environment variable to connect to the database.

Usage:
    # Set database URL
    export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"

    # Import individual datasets (standard mode)
    python import_cli.py symbiants --clear
    python import_cli.py items --chunk-size 50
    python import_cli.py nanos

    # Import with optimized mode (10-20x faster)
    python import_cli.py items --optimized --batch-size 2000
    python import_cli.py nanos --optimized
    python import_cli.py all --optimized --clear

    # Import all data
    python import_cli.py all --clear

    # Validate files exist
    python import_cli.py validate

Requirements:
    - items.json (407MB)
    - nanos.json (44MB)
    - symbiants.csv (208KB)
"""

import argparse
import logging
import sys
import os
from pathlib import Path
from typing import Optional

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.core.importer import DataImporter
from app.core.optimized_importer import OptimizedImporter
from app.core.database import create_tables, get_table_count

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


def ensure_tables_exist():
    """Ensure database tables exist, create them if they don't."""
    try:
        table_count = get_table_count()
        logger.info(f"Current table count: {table_count}")
        
        if table_count == 0:
            logger.info("No tables found, creating database schema...")
            create_tables()
            new_count = get_table_count()
            logger.info(f"Created {new_count} tables")
        else:
            logger.info("Database tables already exist")
        
        return True
    except Exception as e:
        logger.error(f"Failed to ensure tables exist: {e}")
        return False


def import_symbiants(args):
    """Import mobs and sources from symbiants CSV."""
    logger.info(f"Starting mobs and sources import from symbiants.csv...")

    # Ensure database tables exist (unless we're doing a full reset)
    if not args.clear and not ensure_tables_exist():
        return False

    # Resolve file path (from CLI arg or default location)
    try:
        file_path = resolve_data_file_path(args.symbiants_file, "symbiants.csv")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

    # Use regular importer (optimized doesn't have this method)
    importer = DataImporter(chunk_size=args.chunk_size)
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


def import_items(args):
    """Import items from JSON."""
    mode = "OPTIMIZED" if args.optimized else "STANDARD"
    logger.info(f"Starting items import ({mode} mode)...")

    # Ensure database tables exist (unless we're doing a full reset)
    if not args.clear and not ensure_tables_exist():
        return False

    # Resolve file paths
    try:
        items_path = resolve_data_file_path(args.items_file, "items.json")
        perks_path = resolve_data_file_path(args.perks_file, "perks.json")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

    try:
        if args.optimized:
            # Use optimized importer with larger batch size
            batch_size = args.batch_size if args.batch_size else 1000
            logger.info(f"Using OptimizedImporter with batch_size={batch_size}")
            importer = OptimizedImporter(batch_size=batch_size, perks_file=str(perks_path))

            stats = importer.import_items_from_json(
                str(items_path),
                is_nano=False,
                clear_existing=args.clear
            )

            logger.info(f"Items import completed: "
                       f"Created={stats['items_created']}, "
                       f"Updated={stats['items_updated']}, "
                       f"Errors={stats['errors']}, "
                       f"Rate={stats.get('items_per_second', 0):.1f} items/sec")
            return stats['errors'] == 0
        else:
            # Use standard importer
            importer = DataImporter(chunk_size=args.chunk_size, perks_file=str(perks_path))
            stats = importer.import_items_from_json(
                str(items_path),
                is_nano=False,
                clear_existing=False,  # Don't use old clear method
                full_reset=args.clear  # Use new full reset with migrations
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


def import_nanos(args):
    """Import nanos from JSON."""
    mode = "OPTIMIZED" if args.optimized else "STANDARD"
    logger.info(f"Starting nanos import ({mode} mode)...")

    # Ensure database tables exist (unless we're doing a full reset)
    if not args.clear and not ensure_tables_exist():
        return False

    # Resolve file paths
    try:
        nanos_path = resolve_data_file_path(args.nanos_file, "nanos.json")
        perks_path = resolve_data_file_path(args.perks_file, "perks.json")
    except FileNotFoundError as e:
        logger.error(str(e))
        return False

    try:
        if args.optimized:
            # Use optimized importer
            batch_size = args.batch_size if args.batch_size else 1000
            logger.info(f"Using OptimizedImporter with batch_size={batch_size}")
            importer = OptimizedImporter(batch_size=batch_size, perks_file=str(perks_path))

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
            importer = DataImporter(chunk_size=args.chunk_size, perks_file=str(perks_path))
            # Note: For nanos, we typically don't want to reset the entire database
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


def import_all(args):
    """Import all data files in order."""
    logger.info("Starting full data import...")

    # If --clear is specified, do the full reset once at the beginning
    if args.clear:
        logger.info("=== Performing full database reset with --clear flag ===")
        from app.core.migration_runner import MigrationRunner

        try:
            runner = MigrationRunner()
            success = runner.reset_database()
            if not success:
                logger.error("Failed to reset database")
                return False
            logger.info("Database reset completed successfully")
        except Exception as e:
            logger.error(f"Failed to reset database: {e}")
            return False

    # Import in order: items (contains symbiants), nanos, then mobs/sources
    success = True

    # Create a modified args object that doesn't trigger reset for individual imports
    import argparse
    individual_args = argparse.Namespace(
        chunk_size=args.chunk_size if hasattr(args, 'chunk_size') else 100,
        batch_size=args.batch_size if hasattr(args, 'batch_size') else 1000,
        optimized=args.optimized if hasattr(args, 'optimized') else False,
        clear=False,  # Don't reset for individual imports since we did it above
        # PASS THROUGH FILE PATHS
        items_file=args.items_file if hasattr(args, 'items_file') else None,
        nanos_file=args.nanos_file if hasattr(args, 'nanos_file') else None,
        symbiants_file=args.symbiants_file if hasattr(args, 'symbiants_file') else None,
        perks_file=args.perks_file if hasattr(args, 'perks_file') else None
    )

    # Items first (contains all symbiant items that mobs will reference)
    logger.info("=== Importing Items ===")
    if not import_items(individual_args):
        success = False
        logger.error("Items import failed, continuing with nanos...")

    # Nanos
    logger.info("=== Importing Nanos ===")
    if not import_nanos(individual_args):
        success = False
        logger.error("Nanos import failed, continuing with symbiants...")

    # Symbiants/Mobs last (creates links to items that now exist)
    logger.info("=== Importing Mobs and Sources ===")
    if not import_symbiants(individual_args):
        success = False
        logger.error("Symbiant/Mobs import failed")

    if success:
        logger.info("All imports completed successfully!")
    else:
        logger.warning("Some imports failed, check logs for details")

    return success


def validate_files(args=None):
    """
    Validate that all required files exist.

    Args:
        args: Optional argparse.Namespace with file path overrides
    """
    files_to_check = {
        'items.json': getattr(args, 'items_file', None) if args else None,
        'nanos.json': getattr(args, 'nanos_file', None) if args else None,
        'symbiants.csv': getattr(args, 'symbiants_file', None) if args else None,
        'perks.json': getattr(args, 'perks_file', None) if args else None,
    }

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


def main():
    parser = argparse.ArgumentParser(
        description="TinkerTools Data Import Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Default locations
  python import_cli.py validate                    # Check if files exist
  python import_cli.py symbiants --clear           # Import symbiants, clearing existing data
  python import_cli.py items --chunk-size 50       # Import items with smaller chunks (standard mode)
  python import_cli.py items --optimized           # Import items using optimized importer (10-20x faster)
  python import_cli.py all --optimized --clear     # Import everything with optimized mode, clearing existing data

  # Custom file paths
  python import_cli.py items --items-file /data/items.json
  python import_cli.py all --items-file ~/ao-data/items.json --nanos-file ~/ao-data/nanos.json
  export AO_DATA=/mnt/data && python import_cli.py all --items-file $AO_DATA/items.json

Optimization Modes:
  Standard mode: Uses original importer, processes items one at a time (slower but stable)
  Optimized mode (--optimized): Batch operations, singleton preloading, reduced flushes (10-20x faster)

Data Files (default locations):
  items.json       407 MB    backend/database/items.json
  nanos.json       44 MB     backend/database/nanos.json
  symbiants.csv    208 KB    backend/database/symbiants.csv
  perks.json       411 KB    backend/database/perks.json (internal dependency)

  Use --{dataset}-file to override default locations. Supports ~ and environment variables.

Environment:
  DATABASE_URL    Database connection string (required)
                  Example: postgresql://user:pass@localhost:5432/tinkertools
        """
    )
    
    parser.add_argument(
        "command",
        choices=["symbiants", "items", "nanos", "all", "validate"],
        help="Import command to run"
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Drop all TinkerTools tables and recreate from migrations before import (WARNING: DESTRUCTIVE! All TinkerTools data will be lost!)"
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

    # Check DATABASE_URL is set for import operations
    if not args.database_url and not os.getenv("DATABASE_URL"):
        logger.error("DATABASE_URL environment variable must be set or --database-url provided")
        logger.error("Example: export DATABASE_URL='postgresql://user:pass@localhost:5432/tinkertools'")
        sys.exit(1)

    # Set database URL if provided
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    if not validate_files(args):
        logger.error("File validation failed, aborting import")
        sys.exit(1)
    
    # Warn about destructive operations
    if args.clear:
        logger.warning("⚠️  --clear flag specified: This will DROP ALL TINKERTOOLS TABLES and recreate them from migrations!")
        logger.warning("    All existing TinkerTools data will be permanently deleted.")
        logger.warning("    The TinkerTools schema will be rebuilt from scratch.")
        try:
            response = input("Are you sure you want to continue? (y/N): ").strip().lower()
            if response != 'y':
                logger.info("Import cancelled")
                sys.exit(0)
        except EOFError:
            # Non-interactive environment, assume yes
            logger.info("Non-interactive environment detected, proceeding with full database reset")
    
    # Run import command
    success = False
    
    try:
        if args.command == "symbiants":
            success = import_symbiants(args)
        elif args.command == "items":
            success = import_items(args)
        elif args.command == "nanos":
            success = import_nanos(args)
        elif args.command == "all":
            success = import_all(args)
    except KeyboardInterrupt:
        logger.info("\nImport interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()