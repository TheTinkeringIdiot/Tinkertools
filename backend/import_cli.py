#!/usr/bin/env python3
"""
TinkerTools Data Import Utility

A standalone utility for importing game data into the TinkerTools database.
Uses the DATABASE_URL environment variable to connect to the database.

Usage:
    # Set database URL
    export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"
    
    # Import individual datasets
    python import_cli.py symbiants --clear
    python import_cli.py items --chunk-size 50
    python import_cli.py nanos

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

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.core.importer import DataImporter
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
    """Import symbiants from CSV."""
    logger.info("Starting symbiant import...")

    # Ensure database tables exist (unless we're doing a full reset)
    if not args.clear and not ensure_tables_exist():
        return False

    # Look for file in database directory
    file_path = Path(__file__).parent / "database" / "symbiants.csv"
    if not file_path.exists():
        logger.error(f"File {file_path} not found")
        return False

    importer = DataImporter(chunk_size=args.chunk_size)
    try:
        # Use full_reset=True when --clear is specified
        count = importer.import_symbiants_from_csv(
            str(file_path),
            clear_existing=False,  # Don't use old clear method
            full_reset=args.clear  # Use new full reset with migrations
        )
        logger.info(f"Successfully imported {count} symbiants")
        return True
    except Exception as e:
        logger.error(f"Symbiant import failed: {e}")
        return False


def import_items(args):
    """Import items from JSON."""
    logger.info("Starting items import...")

    # Ensure database tables exist (unless we're doing a full reset)
    if not args.clear and not ensure_tables_exist():
        return False

    # Look for file in database directory
    file_path = Path(__file__).parent / "database" / "items.json"
    if not file_path.exists():
        logger.error(f"File {file_path} not found")
        return False

    importer = DataImporter(chunk_size=args.chunk_size)
    try:
        stats = importer.import_items_from_json(
            str(file_path),
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
        return False


def import_nanos(args):
    """Import nanos from JSON."""
    logger.info("Starting nanos import...")

    # Ensure database tables exist (unless we're doing a full reset)
    if not args.clear and not ensure_tables_exist():
        return False

    # Look for file in database directory
    file_path = Path(__file__).parent / "database" / "nanos.json"
    if not file_path.exists():
        logger.error(f"File {file_path} not found")
        return False

    importer = DataImporter(chunk_size=args.chunk_size)
    try:
        # Note: For nanos, we typically don't want to reset the entire database
        # since they're usually imported after items. Only use full_reset if
        # this is the first/only import being done.
        stats = importer.import_items_from_json(
            str(file_path),
            is_nano=True,
            clear_existing=False,
            full_reset=False  # Don't reset for nanos (they're usually imported after items)
        )
        logger.info(f"Nanos import completed: "
                   f"Created={stats.items_created}, "
                   f"Updated={stats.items_updated}, "
                   f"Errors={stats.errors}")
        return stats.errors == 0
    except Exception as e:
        logger.error(f"Nanos import failed: {e}")
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

    # Import in order: symbiants (smallest), items, then nanos
    success = True

    # Create a modified args object that doesn't trigger reset for individual imports
    import argparse
    individual_args = argparse.Namespace(
        chunk_size=args.chunk_size,
        clear=False  # Don't reset for individual imports since we did it above
    )

    # Symbiants first (smallest file)
    logger.info("=== Importing Symbiants ===")
    if not import_symbiants(individual_args):
        success = False
        logger.error("Symbiant import failed, continuing with items...")

    # Items (largest file)
    logger.info("=== Importing Items ===")
    if not import_items(individual_args):
        success = False
        logger.error("Items import failed, continuing with nanos...")

    # Nanos
    logger.info("=== Importing Nanos ===")
    if not import_nanos(individual_args):
        success = False
        logger.error("Nanos import failed")

    if success:
        logger.info("All imports completed successfully!")
    else:
        logger.warning("Some imports failed, check logs for details")

    return success


def validate_files():
    """Validate that all required files exist."""
    # Files should be in the database directory
    base_dir = Path(__file__).parent / "database"
    files = ["symbiants.csv", "items.json", "nanos.json"]
    missing = []

    for file in files:
        path = base_dir / file
        if path.exists():
            size_mb = path.stat().st_size / (1024 * 1024)
            logger.info(f"✓ {file}: {size_mb:.1f} MB")
        else:
            missing.append(file)
            logger.error(f"✗ {file}: Not found")

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
  python import_cli.py validate                    # Check if files exist
  python import_cli.py symbiants --clear           # Import symbiants, clearing existing data
  python import_cli.py items --chunk-size 50       # Import items with smaller chunks
  python import_cli.py all --clear                 # Import everything, clearing existing data

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
        help="Number of items to process per chunk (default: 100)"
    )
    parser.add_argument(
        "--database-url",
        help="Database URL (overrides DATABASE_URL environment variable)"
    )
    
    args = parser.parse_args()
    
    # Validate files first (doesn't need DB connection)
    if args.command == "validate":
        success = validate_files()
        sys.exit(0 if success else 1)
    
    # Check DATABASE_URL is set for import operations
    if not args.database_url and not os.getenv("DATABASE_URL"):
        logger.error("DATABASE_URL environment variable must be set or --database-url provided")
        logger.error("Example: export DATABASE_URL='postgresql://user:pass@localhost:5432/tinkertools'")
        sys.exit(1)
    
    # Set database URL if provided
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url
    
    if not validate_files():
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