"""
Database migration runner for TinkerTools.

Handles dropping and recreating database schema from migration files.
Used by the import system with --clear flag to ensure clean database state.
"""

import logging
import os
from pathlib import Path
from typing import List, Optional
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session, sessionmaker

logger = logging.getLogger(__name__)


class MigrationRunner:
    """Manages database migrations and schema operations."""

    def __init__(self, db_url: str = None):
        """Initialize migration runner with database connection."""
        self.db_url = db_url or os.getenv("DATABASE_URL")
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable must be set or db_url parameter provided")

        # Create engine with autocommit for DDL operations
        self.engine = create_engine(self.db_url, isolation_level="AUTOCOMMIT")
        self.SessionLocal = sessionmaker(bind=self.engine)

        # Path to migrations directory
        self.migrations_dir = Path(__file__).parent.parent.parent.parent / "database" / "migrations"
        if not self.migrations_dir.exists():
            raise ValueError(f"Migrations directory not found: {self.migrations_dir}")

    def get_all_tables(self) -> List[str]:
        """Get list of all tables in the database."""
        inspector = inspect(self.engine)
        return inspector.get_table_names()

    def get_tinkertools_tables(self) -> List[str]:
        """
        Get list of TinkerTools-specific tables.

        Returns only tables that are part of the TinkerTools schema,
        not all tables in the database.
        """
        # Define the tables that TinkerTools manages
        tinkertools_tables = [
            # Core tables
            'items', 'stat_values', 'criteria', 'spells', 'spell_data',
            'actions', 'attack_defense', 'animation_mesh', 'symbiants',
            'perks', 'mobs', 'pocket_bosses',

            # Junction/relationship tables
            'item_stats', 'spell_criteria', 'action_criteria',
            'attack_defense_attack', 'attack_defense_defense',
            'spell_data_spells', 'item_spell_data',
            'pocket_boss_symbiant_drops', 'symbiant_items',

            # Shop system tables
            'shop_hash', 'item_shop_hash',

            # Source system tables
            'source_types', 'sources', 'item_sources',
            'crystal_sources', 'npc_sources', 'mission_sources',
            'quest_sources', 'shop_sources', 'tradeskill_sources',
            'other_sources',

            # Cache and migrations
            'application_cache', 'schema_migrations'
        ]

        # Get actual tables in database
        inspector = inspect(self.engine)
        existing_tables = inspector.get_table_names()

        # Return intersection of TinkerTools tables and existing tables
        return [t for t in tinkertools_tables if t in existing_tables]

    def drop_all_tables(self, cascade: bool = True) -> int:
        """
        Drop all TinkerTools tables in the database.

        Args:
            cascade: If True, use CASCADE to automatically drop dependent objects

        Returns:
            Number of tables dropped
        """
        logger.info("Starting TinkerTools table drop operation...")

        with self.engine.connect() as conn:
            # Get only TinkerTools tables
            tables = self.get_tinkertools_tables()

            if not tables:
                logger.info("No TinkerTools tables found to drop")
                return 0

            logger.info(f"Found {len(tables)} TinkerTools tables to drop")

            # Drop tables in reverse order to handle dependencies better
            # Put junction tables first, then main tables
            junction_tables = [
                'item_sources', 'item_stats', 'spell_criteria', 'action_criteria',
                'attack_defense_attack', 'attack_defense_defense',
                'spell_data_spells', 'item_spell_data',
                'crystal_sources', 'npc_sources', 'mission_sources',
                'quest_sources', 'shop_sources', 'tradeskill_sources',
                'other_sources'
            ]

            main_tables = [
                'perks', 'spells', 'spell_data', 'actions',
                'items', 'attack_defense', 'animation_mesh',
                'stat_values', 'criteria', 'symbiants',
                'sources', 'source_types', 'pocket_bosses',
                'schema_migrations'
            ]

            # Order tables for dropping
            ordered_tables = []
            for t in junction_tables:
                if t in tables:
                    ordered_tables.append(t)
            for t in main_tables:
                if t in tables:
                    ordered_tables.append(t)
            # Add any remaining tables not in our lists
            for t in tables:
                if t not in ordered_tables:
                    ordered_tables.append(t)

            # Drop tables
            dropped_count = 0
            try:
                for table in ordered_tables:
                    if cascade:
                        drop_sql = f'DROP TABLE IF EXISTS "{table}" CASCADE'
                    else:
                        drop_sql = f'DROP TABLE IF EXISTS "{table}"'

                    logger.debug(f"Executing: {drop_sql}")
                    conn.execute(text(drop_sql))
                    logger.info(f"Dropped table: {table}")
                    dropped_count += 1

            except Exception as e:
                logger.error(f"Error dropping tables: {e}")
                raise

            logger.info(f"Successfully dropped {dropped_count} TinkerTools tables")
            return dropped_count

    def run_migrations(self) -> int:
        """
        Run all migration files in order.

        Returns:
            Number of migrations executed
        """
        logger.info(f"Running migrations from {self.migrations_dir}")

        # Get all SQL migration files
        migration_files = sorted(self.migrations_dir.glob("*.sql"))

        if not migration_files:
            logger.warning(f"No migration files found in {self.migrations_dir}")
            return 0

        logger.info(f"Found {len(migration_files)} migration files")

        executed = 0

        # Use a raw connection for better control over transactions
        with self.engine.begin() as conn:
            for migration_file in migration_files:
                try:
                    logger.info(f"Running migration: {migration_file.name}")

                    # Read the migration file
                    with open(migration_file, 'r', encoding='utf-8') as f:
                        migration_sql = f.read()

                    # Remove \echo commands (PostgreSQL specific)
                    lines = migration_sql.split('\n')
                    clean_lines = []
                    for line in lines:
                        if line.strip().startswith('\\echo'):
                            logger.info(line.replace('\\echo', '').strip().strip("'"))
                        else:
                            clean_lines.append(line)

                    migration_sql = '\n'.join(clean_lines)

                    # Execute the entire migration as a single script
                    # Use execute with text() for better compatibility
                    conn.execute(text(migration_sql))

                    executed += 1
                    logger.info(f"✓ Completed migration: {migration_file.name}")

                except Exception as e:
                    logger.error(f"Failed to run migration {migration_file.name}: {e}")
                    # Try to provide more helpful error messages
                    if "relation" in str(e) and "does not exist" in str(e):
                        logger.error("This might be a timing issue with CREATE TABLE and CREATE INDEX.")
                        logger.error("Consider separating index creation into a separate migration file.")
                    raise

        logger.info(f"Successfully executed {executed} migrations")
        return executed

    def reset_database(self) -> bool:
        """
        Complete database reset: drop all tables and re-run migrations.

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info("=== Starting complete database reset ===")

            # Step 1: Drop all existing tables
            dropped_count = self.drop_all_tables(cascade=True)
            logger.info(f"Dropped {dropped_count} tables")

            # Step 2: Run all migrations to recreate schema
            migration_count = self.run_migrations()
            logger.info(f"Executed {migration_count} migrations")

            # Step 3: Verify the schema was created
            new_tables = self.get_tinkertools_tables()
            logger.info(f"Created {len(new_tables)} TinkerTools tables")

            # We expect at least 20 TinkerTools tables from our migrations
            if len(new_tables) < 20:
                logger.warning(f"Expected at least 20 TinkerTools tables, but only found {len(new_tables)}")
                logger.warning(f"Tables created: {', '.join(sorted(new_tables))}")
                return False

            logger.info("=== Database reset completed successfully ===")
            return True

        except Exception as e:
            logger.error(f"Database reset failed: {e}")
            return False

    def verify_schema(self) -> bool:
        """
        Verify that the database schema is correctly set up.

        Returns:
            True if schema is valid, False otherwise
        """
        try:
            tables = self.get_all_tables()

            # Check for essential tables
            required_tables = [
                'items', 'stat_values', 'criteria', 'spells', 'spell_data',
                'actions', 'attack_defense', 'animation_mesh', 'symbiants',
                'item_stats', 'spell_criteria', 'action_criteria', 'perks'
            ]

            missing_tables = [t for t in required_tables if t not in tables]

            if missing_tables:
                logger.error(f"Missing required tables: {', '.join(missing_tables)}")
                return False

            logger.info(f"Schema verification passed. Found {len(tables)} tables.")
            return True

        except Exception as e:
            logger.error(f"Schema verification failed: {e}")
            return False