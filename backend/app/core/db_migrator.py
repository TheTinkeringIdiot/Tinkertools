"""
Database migration and recreation utility for TinkerTools.

Handles complete database recreation with proper dependency ordering,
foreign key constraint management, and migration tracking.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path
from sqlalchemy import create_engine, text, Connection
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


class DatabaseMigrator:
    """
    Handles database recreation with proper dependency ordering.

    Manages:
    - Complete database recreation with dependency-aware table dropping/creation
    - Foreign key constraint management
    - Migration tracking via schema_migrations table
    - Verification of schema integrity
    """

    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize the database migrator.

        Args:
            database_url: Database connection URL. If None, uses DATABASE_URL env var.
        """
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError("Database URL must be provided or set via DATABASE_URL environment variable")

        self.engine = create_engine(
            self.database_url,
            pool_pre_ping=True,
            pool_size=5,  # Smaller pool for migration operations
            max_overflow=10
        )

        # Table drop order (reverse dependency order)
        self.drop_order = [
            # Junction tables first (depend on other tables)
            'item_stats',
            'item_spell_data',
            'item_sources',
            'item_shop_hash',
            'spell_criteria',
            'action_criteria',
            'spell_data_spells',
            'attack_defense_attack',
            'attack_defense_defense',
            'pocket_boss_symbiant_drops',

            # Dependent entities
            'actions',
            'perks',  # One-to-one with items (added from migration 004)
            'items',  # Main items table

            # Core entities with foreign keys
            'spells',
            'spell_data',
            'attack_defense',
            'animation_mesh',
            'shop_hash',

            # Referenced entities (other tables reference these)
            'stat_values',
            'criteria',
            'sources',
            'source_types',

            # Base tables (standalone)
            'symbiants',
            'pocket_bosses',
            'application_cache',

            # Migration tracking (drop last, create first)
            'schema_migrations'
        ]

        # Create order is reverse of drop order
        self.create_order = list(reversed(self.drop_order))

    def recreate_database(self, force: bool = False) -> bool:
        """
        Completely recreate the database schema.

        Args:
            force: If True, skip confirmation prompts

        Returns:
            bool: True if successful, False otherwise
        """
        logger.info("Starting complete database recreation...")

        if not force:
            logger.warning("⚠️  This will DELETE ALL DATA in the database!")
            try:
                response = input("Continue? (y/N): ").strip().lower()
                if response != 'y':
                    logger.info("Database recreation cancelled")
                    return False
            except EOFError:
                logger.info("Non-interactive environment detected, proceeding...")

        try:
            with self.engine.connect() as conn:
                # Step 1: Drop all tables in dependency order
                if not self._drop_all_tables(conn):
                    return False

                # Step 2: Create schema from SQL file
                if not self._create_schema(conn):
                    return False

                # Step 3: Initialize migration tracking
                if not self._initialize_migration_tracking(conn):
                    return False

                # Step 4: Verify schema integrity
                if not self._verify_schema_integrity(conn):
                    return False

                # Commit all changes
                conn.commit()

                logger.info("✅ Database recreation completed successfully!")
                return True

        except Exception as e:
            logger.error(f"Database recreation failed: {e}")
            return False

    def _drop_all_tables(self, conn: Connection) -> bool:
        """
        Drop all tables in dependency order.

        Args:
            conn: Database connection

        Returns:
            bool: True if successful
        """
        logger.info("Dropping existing tables...")

        try:
            # Temporarily disable foreign key checks
            logger.debug("Disabling foreign key constraints...")
            conn.execute(text("SET CONSTRAINTS ALL DEFERRED"))

            # Get list of existing tables
            result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """))
            existing_tables = {row[0] for row in result.fetchall()}

            if not existing_tables:
                logger.info("No existing tables to drop")
                return True

            # Drop tables in dependency order
            dropped_count = 0
            for table_name in self.drop_order:
                if table_name in existing_tables:
                    logger.debug(f"Dropping table: {table_name}")
                    conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
                    dropped_count += 1

            # Drop any remaining tables not in our list
            remaining_result = conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """))
            remaining_tables = [row[0] for row in remaining_result.fetchall()]

            for table_name in remaining_tables:
                logger.warning(f"Dropping unexpected table: {table_name}")
                conn.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
                dropped_count += 1

            logger.info(f"Dropped {dropped_count} tables")
            return True

        except Exception as e:
            logger.error(f"Failed to drop tables: {e}")
            return False

    def _create_schema(self, conn: Connection) -> bool:
        """
        Create database schema from schema.sql file.

        Args:
            conn: Database connection

        Returns:
            bool: True if successful
        """
        logger.info("Creating database schema...")

        try:
            # Find schema.sql file
            schema_path = Path(__file__).parent.parent.parent.parent / "database" / "schema.sql"

            if not schema_path.exists():
                logger.error(f"Schema file not found: {schema_path}")
                return False

            # Read and execute schema file
            logger.debug(f"Reading schema from: {schema_path}")
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema_sql = f.read()

            # Execute schema creation
            logger.debug("Executing schema creation...")
            conn.execute(text(schema_sql))

            # Count created tables
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """))
            table_count = result.scalar()

            logger.info(f"Created {table_count} tables from schema")
            return True

        except Exception as e:
            logger.error(f"Failed to create schema: {e}")
            return False

    def _initialize_migration_tracking(self, conn: Connection) -> bool:
        """
        Initialize schema_migrations table if it doesn't exist.

        Args:
            conn: Database connection

        Returns:
            bool: True if successful
        """
        logger.info("Initializing migration tracking...")

        try:
            # Check if schema_migrations table exists
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'schema_migrations'
            """))

            if result.scalar() == 0:
                # Create schema_migrations table
                logger.debug("Creating schema_migrations table...")
                migration_sql = """
                CREATE TABLE schema_migrations (
                    version VARCHAR(10) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    checksum VARCHAR(64)
                );

                CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at);
                """
                conn.execute(text(migration_sql))

            # Record initial schema creation
            conn.execute(text("""
                INSERT INTO schema_migrations (version, name, checksum)
                VALUES ('000', 'Initial schema creation', 'recreated')
                ON CONFLICT (version) DO UPDATE SET
                    applied_at = CURRENT_TIMESTAMP,
                    checksum = 'recreated'
            """))

            logger.info("Migration tracking initialized")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize migration tracking: {e}")
            return False

    def _verify_schema_integrity(self, conn: Connection) -> bool:
        """
        Verify that the schema was created correctly.

        Args:
            conn: Database connection

        Returns:
            bool: True if schema is valid
        """
        logger.info("Verifying schema integrity...")

        try:
            # Re-enable foreign key constraints and check for violations
            logger.debug("Re-enabling foreign key constraints...")
            conn.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

            # Check table count
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """))
            table_count = result.scalar()

            # Expected minimum table count (core tables + junction tables)
            expected_min = 20
            if table_count < expected_min:
                logger.error(f"Expected at least {expected_min} tables, found {table_count}")
                return False

            # Verify key tables exist
            key_tables = ['items', 'stat_values', 'criteria', 'spells', 'schema_migrations']
            for table in key_tables:
                result = conn.execute(text(f"""
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = '{table}'
                """))
                if result.scalar() == 0:
                    logger.error(f"Key table missing: {table}")
                    return False

            # Test basic insert capability (will rollback)
            try:
                conn.execute(text("BEGIN"))
                conn.execute(text("INSERT INTO stat_values (stat, value) VALUES (999, 999)"))
                conn.execute(text("ROLLBACK"))
                logger.debug("Basic insert test passed")
            except Exception as e:
                logger.error(f"Basic insert test failed: {e}")
                return False

            logger.info(f"✅ Schema integrity verified ({table_count} tables)")
            return True

        except Exception as e:
            logger.error(f"Schema integrity verification failed: {e}")
            return False

    def get_migration_status(self) -> Dict[str, Any]:
        """
        Get current migration status.

        Returns:
            dict: Migration status information
        """
        try:
            with self.engine.connect() as conn:
                # Check if schema_migrations table exists
                result = conn.execute(text("""
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'schema_migrations'
                """))

                has_migration_table = result.scalar() > 0

                if not has_migration_table:
                    return {
                        "status": "uninitialized",
                        "migration_table_exists": False,
                        "applied_migrations": [],
                        "table_count": 0
                    }

                # Get applied migrations
                result = conn.execute(text("""
                    SELECT version, name, applied_at, checksum
                    FROM schema_migrations
                    ORDER BY applied_at
                """))
                migrations = [
                    {
                        "version": row[0],
                        "name": row[1],
                        "applied_at": row[2].isoformat() if row[2] else None,
                        "checksum": row[3]
                    }
                    for row in result.fetchall()
                ]

                # Get table count
                result = conn.execute(text("""
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """))
                table_count = result.scalar()

                return {
                    "status": "initialized",
                    "migration_table_exists": True,
                    "applied_migrations": migrations,
                    "table_count": table_count
                }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "migration_table_exists": False,
                "applied_migrations": [],
                "table_count": 0
            }


def recreate_database(database_url: Optional[str] = None, force: bool = False) -> bool:
    """
    Convenience function to recreate the database.

    Args:
        database_url: Database connection URL
        force: Skip confirmation prompts

    Returns:
        bool: True if successful
    """
    migrator = DatabaseMigrator(database_url)
    return migrator.recreate_database(force=force)


def get_migration_status(database_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to get migration status.

    Args:
        database_url: Database connection URL

    Returns:
        dict: Migration status information
    """
    migrator = DatabaseMigrator(database_url)
    return migrator.get_migration_status()