"""
Streaming CSV-to-database loader using PostgreSQL COPY.

Eliminates Python overhead by streaming CSV files directly to PostgreSQL
using COPY FROM stdin. Works with remote databases.

Key features:
- Zero Python list building (file streaming)
- Respects foreign key dependencies (correct load order)
- Drops and rebuilds indexes for speed
- Transaction management
- Works with remote databases (uses stdin, not file paths)
"""

from pathlib import Path
import logging
from typing import List, Dict, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
import time

try:
    from psycopg2 import sql
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    logging.warning("psycopg2 not available - CSV loader will not work")

logger = logging.getLogger(__name__)


class StreamingCSVLoader:
    """Load CSV files to PostgreSQL using streaming COPY."""

    # Table load order - respects foreign key dependencies
    # Format: (table_name, columns, has_id_sequence)
    LOAD_ORDER = [
        # Singleton tables first (no dependencies)
        ('stat_values', ['id', 'stat', 'value'], True),
        ('criteria', ['id', 'value1', 'value2', 'operator'], True),

        # Entity tables with no dependencies
        ('attack_defense', ['id'], True),
        ('animation_mesh', ['id', 'animation_id', 'mesh_id'], True),

        # Items table (references attack_defense, animation_mesh)
        ('items', ['id', 'aoid', 'name', 'ql', 'item_class', 'description', 'is_nano', 'animation_mesh_id', 'atkdef_id'], True),

        # Actions (references items)
        ('actions', ['id', 'action', 'item_id'], True),

        # SpellData (standalone)
        ('spell_data', ['id', 'event'], True),

        # Spells (standalone) - column order must match CSV transformer output
        ('spells', ['id', 'target', 'tick_count', 'tick_interval', 'spell_id', 'spell_format', 'spell_params'], True),

        # Perks (references items, no separate id - item_id is PK)
        ('perks', ['item_id', 'name', 'perk_series', 'counter', 'type', 'level_required', 'ai_level_required', 'professions', 'breeds'], False),

        # === SYMBIANTS SECTION ===
        # Mobs (standalone pocket bosses)
        ('mobs', ['id', 'name', 'level', 'playfield', 'location', 'mob_names', 'is_pocket_boss', 'metadata'], True),
        # Sources (references mobs and source_types)
        ('sources', ['id', 'source_type_id', 'source_id', 'name', 'metadata'], True),
        # Note: item_sources handled separately (requires AOID resolution)

        # Junction tables (many-to-many relationships)
        ('item_stats', ['item_id', 'stat_value_id'], False),
        ('attack_defense_attack', ['attack_defense_id', 'stat_value_id'], False),
        ('attack_defense_defense', ['attack_defense_id', 'stat_value_id'], False),
        ('action_criteria', ['action_id', 'criterion_id', 'order_index'], False),
        ('spell_criteria', ['spell_id', 'criterion_id'], False),
        ('spell_data_spells', ['spell_data_id', 'spell_id'], False),
        ('item_spell_data', ['item_id', 'spell_data_id'], False),
    ]

    def __init__(self, db_session: Session, csv_dir: str = "/tmp/tinkertools_import"):
        """
        Initialize streaming CSV loader.

        Args:
            db_session: SQLAlchemy database session
            csv_dir: Directory containing CSV files
        """
        if not PSYCOPG2_AVAILABLE:
            raise ImportError("psycopg2 is required for CSV loader")

        self.db = db_session
        self.csv_dir = Path(csv_dir)
        self.dropped_indexes: Dict[str, List[Tuple[str, str]]] = {}
        self.stats = {
            'tables_loaded': 0,
            'total_rows': 0,
            'start_time': time.time(),
            'errors': []
        }

    def load_all(self) -> Dict:
        """
        Load all CSV files in dependency order.

        Returns:
            Statistics dictionary with load results
        """
        logger.info(f"Starting streaming CSV load from {self.csv_dir}")
        self.stats['start_time'] = time.time()

        # Verify CSV directory exists
        if not self.csv_dir.exists():
            raise FileNotFoundError(f"CSV directory not found: {self.csv_dir}")

        # Drop indexes first (for speed)
        logger.info("Dropping indexes...")
        self._drop_all_indexes()

        # Load tables in dependency order
        logger.info(f"Loading {len(self.LOAD_ORDER)} tables...")
        for table_name, columns, has_id_seq in self.LOAD_ORDER:
            csv_file = self.csv_dir / f"{table_name}.csv"

            if csv_file.exists():
                rows_loaded = self._stream_csv_to_table(table_name, columns, csv_file, has_id_seq)
                self.stats['tables_loaded'] += 1
                self.stats['total_rows'] += rows_loaded
                logger.info(f"Loaded {rows_loaded} rows into {table_name}")
            else:
                logger.warning(f"CSV file not found (skipping): {csv_file}")

        # === SPECIAL HANDLING: ItemSources with AOID resolution ===
        item_sources_csv = self.csv_dir / 'item_sources.csv'
        if item_sources_csv.exists():
            rows_loaded = self._load_item_sources_with_aoid_resolution(item_sources_csv)
            self.stats['tables_loaded'] += 1
            self.stats['total_rows'] += rows_loaded
            logger.info(f"Loaded {rows_loaded} rows into item_sources")

        # Rebuild indexes
        logger.info("Rebuilding indexes...")
        self._rebuild_all_indexes()

        # === POST-LOAD: Refresh materialized view ===
        try:
            symbiant_items_exists = self.db.execute(text(
                "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'symbiant_items')"
            )).scalar()

            if symbiant_items_exists:
                logger.info("Refreshing symbiant_items materialized view...")
                self.db.execute(text("REFRESH MATERIALIZED VIEW symbiant_items"))
                self.db.commit()
                logger.info("Materialized view refreshed")
        except Exception as e:
            logger.warning(f"Failed to refresh symbiant_items view: {e}")

        # Calculate final stats
        elapsed = time.time() - self.stats['start_time']
        self.stats['total_time'] = elapsed
        self.stats['rows_per_second'] = self.stats['total_rows'] / elapsed if elapsed > 0 else 0

        logger.info(f"Load complete: {self.stats['tables_loaded']} tables, "
                   f"{self.stats['total_rows']} rows in {elapsed:.1f}s "
                   f"({self.stats['rows_per_second']:.0f} rows/sec)")

        return self.stats

    def _stream_csv_to_table(self, table_name: str, columns: List[str],
                             csv_file: Path, has_id_sequence: bool) -> int:
        """
        Stream CSV file directly to database via COPY.

        Args:
            table_name: Target table name
            columns: List of column names
            csv_file: Path to CSV file
            has_id_sequence: Whether table has an auto-incrementing ID sequence

        Returns:
            Number of rows loaded
        """
        logger.info(f"Streaming {csv_file.name} to {table_name}...")
        start = time.time()

        # Get raw psycopg2 connection
        connection = self.db.connection().connection
        cursor = connection.cursor()

        # Build COPY SQL statement (TEXT format with tab delimiter, \\N as NULL)
        copy_sql = sql.SQL("COPY {} ({}) FROM STDIN").format(
            sql.Identifier(table_name),
            sql.SQL(', ').join(map(sql.Identifier, columns))
        )

        # Stream file directly to database (no Python list building!)
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                # Convert SQL object to string using cursor for proper context
                sql_string = copy_sql.as_string(cursor)
                cursor.copy_expert(sql_string, f)

            # Get row count
            count_sql = sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table_name))
            cursor.execute(count_sql.as_string(cursor))
            row_count = cursor.fetchone()[0]

            # Update sequence if table has auto-incrementing ID
            if has_id_sequence and 'id' in columns:
                self._update_sequence(table_name)

            elapsed = time.time() - start
            logger.info(f"Loaded {row_count} rows into {table_name} in {elapsed:.2f}s "
                       f"({row_count/elapsed:.0f} rows/sec)")

            return row_count

        except Exception as e:
            error_msg = f"Failed to load {table_name}: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
            # Re-raise to trigger rollback
            raise

    def _update_sequence(self, table_name: str):
        """
        Update PostgreSQL sequence after COPY.

        Args:
            table_name: Table name (sequence name derived as {table}_id_seq)
        """
        try:
            self.db.execute(text(
                f"SELECT setval('{table_name}_id_seq', "
                f"COALESCE((SELECT MAX(id) FROM {table_name}), 1), true)"
            ))
            logger.debug(f"Updated sequence for {table_name}")
        except Exception as e:
            logger.warning(f"Failed to update sequence for {table_name}: {e}")

    def _load_item_sources_with_aoid_resolution(self, csv_file: Path) -> int:
        """
        Load item_sources CSV with AOID-to-item_id resolution.

        CSV format: aoid, source_id, drop_rate, min_ql, max_ql, conditions, metadata
        DB format: item_id, source_id, drop_rate, min_ql, max_ql, conditions, metadata

        Returns:
            Number of rows loaded
        """
        logger.info("Loading item_sources with AOID resolution...")
        start = time.time()

        # Build AOID -> item_id mapping
        result = self.db.execute(text("SELECT id, aoid FROM items WHERE aoid IS NOT NULL"))
        aoid_to_id = {row[1]: row[0] for row in result}
        logger.info(f"Built AOID mapping for {len(aoid_to_id)} items")

        # Read CSV and resolve AOIDs
        resolved_rows = []
        skipped = 0

        with open(csv_file, 'r', encoding='utf-8') as f:
            for line in f:
                parts = line.strip().split('\t')
                if len(parts) < 7:
                    skipped += 1
                    continue

                aoid_str = parts[0]
                if aoid_str == '\\N':
                    skipped += 1
                    continue

                try:
                    aoid = int(aoid_str)
                except ValueError:
                    logger.warning(f"Invalid AOID value: {aoid_str}")
                    skipped += 1
                    continue

                if aoid not in aoid_to_id:
                    logger.warning(f"Item not found for AOID {aoid}")
                    skipped += 1
                    continue

                # Replace AOID with item_id
                item_id = aoid_to_id[aoid]
                resolved_row = [str(item_id)] + parts[1:]
                resolved_rows.append('\t'.join(resolved_row))

        logger.info(f"Resolved {len(resolved_rows)} item_sources, skipped {skipped}")

        # Stream to database via COPY
        import io

        buffer = io.StringIO('\n'.join(resolved_rows))
        connection = self.db.connection().connection
        cursor = connection.cursor()

        columns = ['item_id', 'source_id', 'drop_rate', 'min_ql', 'max_ql', 'conditions', 'metadata']
        copy_sql = sql.SQL("COPY item_sources ({}) FROM STDIN").format(
            sql.SQL(', ').join(map(sql.Identifier, columns))
        )

        cursor.copy_expert(copy_sql.as_string(cursor), buffer)

        elapsed = time.time() - start
        logger.info(f"Loaded {len(resolved_rows)} item_sources in {elapsed:.2f}s")

        return len(resolved_rows)

    def _drop_all_indexes(self):
        """Drop non-essential indexes from all tables before load."""
        tables = [table_name for table_name, _, _ in self.LOAD_ORDER]

        for table in tables:
            indexes = self._drop_indexes(table)
            if indexes:
                self.dropped_indexes[table] = indexes

        logger.info(f"Dropped indexes from {len(self.dropped_indexes)} tables")
        self.db.commit()

    def _drop_indexes(self, table_name: str) -> List[Tuple[str, str]]:
        """
        Drop non-essential indexes from a table.

        Args:
            table_name: Table to process

        Returns:
            List of (index_name, index_def) tuples for later rebuild
        """
        result = self.db.execute(text(f"""
            SELECT i.indexname, i.indexdef
            FROM pg_indexes i
            LEFT JOIN pg_constraint c ON i.indexname = c.conname
            WHERE i.tablename = '{table_name}'
            AND i.indexname NOT LIKE '%_pkey'
            AND c.conname IS NULL  -- Exclude constraint-backed indexes
        """))

        indexes = []
        for row in result:
            index_name, index_def = row
            try:
                self.db.execute(text(f"DROP INDEX IF EXISTS {index_name}"))
                indexes.append((index_name, index_def))
                logger.debug(f"Dropped index: {index_name}")
            except Exception as e:
                logger.warning(f"Failed to drop index {index_name}: {e}")
                # Rollback failed transaction to allow subsequent commands
                self.db.rollback()

        return indexes

    def _rebuild_all_indexes(self):
        """Rebuild all dropped indexes after load."""
        total_indexes = sum(len(indexes) for indexes in self.dropped_indexes.values())
        logger.info(f"Rebuilding {total_indexes} indexes...")

        for table, indexes in self.dropped_indexes.items():
            self._rebuild_indexes(table, indexes)

        self.db.commit()
        logger.info("Index rebuild complete")

    def _rebuild_indexes(self, table_name: str, indexes: List[Tuple[str, str]]):
        """
        Rebuild indexes for a table.

        Args:
            table_name: Table name (for logging)
            indexes: List of (index_name, index_def) tuples
        """
        for index_name, index_def in indexes:
            try:
                # Use regular CREATE INDEX (not CONCURRENTLY) since we're in a transaction
                # CONCURRENTLY cannot run inside transactions and would abort
                self.db.execute(text(index_def))
                logger.debug(f"Rebuilt index: {index_name}")
            except Exception as e:
                error_msg = f"Failed to rebuild index {index_name}: {e}"
                logger.error(error_msg)
                self.stats['errors'].append(error_msg)


def load_csv_to_database(db_session: Session, csv_dir: str) -> Dict:
    """
    Convenience function to load CSV files to database.

    Args:
        db_session: SQLAlchemy database session
        csv_dir: Directory containing CSV files

    Returns:
        Statistics dictionary
    """
    loader = StreamingCSVLoader(db_session, csv_dir)
    return loader.load_all()
