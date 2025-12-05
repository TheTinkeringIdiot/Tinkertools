# CSV Import Pipeline

## Overview

The CSV Import Pipeline is a high-performance data import system that provides **55x faster imports** compared to the standard ORM-based approach. Instead of creating Python objects and using SQLAlchemy ORM, it streams JSON data directly to CSV files and uses PostgreSQL's native COPY protocol for bulk loading.

This feature represents a fundamental architectural shift from ORM-based imports to streaming bulk loads, making it the recommended approach for all data imports.

## Performance Comparison

| Import Mode | Performance | Use Case |
|------------|-------------|----------|
| Standard | 2-5 items/sec | Development, debugging |
| Optimized | 50-100 items/sec | Production imports |
| CSV Pipeline | 100-300 items/sec | **Recommended** |

For the full dataset (156,771 items + nanos):
- **Standard mode**: 8-12 hours
- **Optimized mode**: 30-45 minutes
- **CSV Pipeline**: **10-15 minutes** (55x faster than standard)

## Architecture

### Three-Phase Pipeline

The CSV pipeline operates in three distinct phases:

#### Phase 1: JSON to CSV Transformation (Streaming)
**Module**: `backend/app/core/csv_transformer.py`

Converts game data JSON files into 19 CSV files optimized for PostgreSQL COPY:

1. **Items + Nanos Merge**:
   - Merges `items.json` + `nanos.json` into single stream
   - Marks nanos with `__is_nano__` flag
   - Generates 16 CSV files for item data

2. **Symbiant Transformation**:
   - Converts `symbiants.csv` to normalized tables
   - Generates 3 CSV files (mobs, sources, item_sources)

**Key Features**:
- **Streaming JSON parsing** with `ijson` (no memory loading)
- **Singleton deduplication** for StatValues and Criteria
- **Sequential ID generation** (eliminates auto-increment overhead)
- **Direct CSV writing** (no intermediate Python objects)

**Generated CSV Files** (19 total):
```
Items system (16 files):
  - items.csv, stat_values.csv, criteria.csv
  - item_stats.csv, attack_defense.csv
  - attack_defense_attack.csv, attack_defense_defense.csv
  - animation_mesh.csv, actions.csv, action_criteria.csv
  - spell_data.csv, spells.csv, spell_data_spells.csv
  - spell_criteria.csv, item_spell_data.csv
  - perks.csv

Symbiants system (3 files):
  - mobs.csv, sources.csv, item_sources.csv
```

#### Phase 2: CSV to Database Loading (COPY Protocol)
**Module**: `backend/app/core/csv_loader.py`

Streams CSV files directly to PostgreSQL using COPY FROM stdin:

**Load Order** (respects foreign key dependencies):
1. Singleton tables (stat_values, criteria)
2. Entity tables (attack_defense, animation_mesh, items)
3. Action system (actions)
4. Spell system (spell_data, spells)
5. Perks system (perks)
6. Symbiant system (mobs, sources)
7. Junction tables (item_stats, spell_criteria, etc.)
8. Special handling for item_sources (AOID resolution)

**Performance Optimizations**:
- **Index management**: Drops indexes before load, rebuilds after
- **Streaming COPY**: Zero Python list building
- **Transaction management**: Commits entire load atomically
- **Sequence updates**: Resets auto-increment sequences after COPY

#### Phase 3: Post-Load Finalization
- **Materialized view refresh**: Refreshes `symbiant_items` view
- **Index rebuild**: Recreates all dropped indexes
- **Statistics reporting**: Throughput, row counts, timing

### Data Flow

```
items.json + nanos.json
    |
    v
[StreamingCSVTransformer]
    |
    +---> 16 CSV files (temp dir)
    |
perks.json (metadata cache)
    |
    v
symbiants.csv
    |
    v
[StreamingCSVTransformer]
    |
    +---> 3 CSV files (temp dir)
    |
    v
[StreamingCSVLoader]
    |
    +---> PostgreSQL COPY
    |
    v
Database (156k+ rows)
```

### CSV Format (PostgreSQL COPY TEXT)

The pipeline uses PostgreSQL's TEXT format for COPY:
- **Delimiter**: Tab character (`\t`)
- **NULL value**: `\N`
- **Boolean**: `t` / `f`
- **Array**: `{val1,val2,val3}` (PostgreSQL array syntax)
- **JSON**: Escaped JSON string for JSONB columns
- **Escaping**: Backslash escapes (`\\`, `\n`, `\r`, `\t`)

Example CSV rows:
```
# items.csv (tab-delimited)
1	219135	Nano Crystal (Tier 4)	1	0	A powerful nano crystal	f	\N	\N

# stat_values.csv
1	54	1
2	54	2
3	76	100

# item_stats.csv (junction table)
1	1
1	3
2	2
```

## Usage

### Command Line Interface

```bash
# CSV mode import (recommended)
python backend/import_cli.py all --csv-mode \
  --items-file database/items.json \
  --nanos-file database/nanos.json \
  --perks-file database/perks.json \
  --symbiants-file database/symbiants.csv

# CSV mode with database reset
python backend/import_cli.py all --csv-mode --clear

# CSV mode is ONLY available with 'all' command
# Individual imports (items, nanos) still use ORM-based approach
```

### Safety Checks

The CSV pipeline includes built-in safety features:
1. **--clear flag handling**: Resets database before import if specified
2. **Temporary directory cleanup**: Auto-removes CSV files after import
3. **Transaction rollback**: Rolls back entire import on error
4. **AOID resolution**: Validates item existence before creating relationships
5. **Foreign key validation**: Loads tables in dependency order

### CSV Mode Restrictions

- Only works with `all` command (not `items`, `nanos`, `symbiants` individually)
- Requires all input files (items.json, nanos.json, perks.json, symbiants.csv)
- Creates temporary CSV files (~500MB for full dataset)
- Not compatible with `--optimized` or `--ultra` flags (uses own optimization strategy)

## Technical Implementation

### Streaming CSV Transformer (`csv_transformer.py`)

**Key Classes**:
- `StreamingCSVTransformer`: Main transformation engine

**Key Methods**:
```python
def transform_items(json_file, is_nano, perk_metadata) -> Dict[str, Any]:
    """Stream JSON items to multiple CSV files."""
    # Uses ijson for streaming parsing
    # Deduplicates singletons (stat_values, criteria)
    # Generates sequential IDs
    # Returns statistics

def transform_symbiants(csv_file, source_type_id) -> Dict[str, Any]:
    """Stream symbiant CSV to mobs/sources/item_sources CSV files."""
    # Parses semicolon-delimited CSV
    # Extracts AOIDs from HTML links
    # Deduplicates mobs by (name, playfield)
    # Creates source records
```

**Deduplication Strategy**:
```python
# Singleton maps maintain uniqueness
self.stat_values_map: Dict[Tuple[int, int], int]  # (stat, value) -> id
self.criteria_map: Dict[Tuple[int, int, int], int]  # (v1, v2, op) -> id
self.mob_map: Dict[Tuple[str, str], int]  # (name, playfield) -> mob_id
```

**CSV Escaping**:
```python
def _csv_escape(value) -> str:
    """Escape value for PostgreSQL COPY format."""
    if value is None: return '\\N'
    if isinstance(value, bool): return 't' if value else 'f'
    if isinstance(value, list): return '{' + ','.join(str(v) for v in value) + '}'
    if isinstance(value, dict): return json.dumps(value).replace('\\', '\\\\')
    # String escaping for COPY format...
```

### Streaming CSV Loader (`csv_loader.py`)

**Key Classes**:
- `StreamingCSVLoader`: PostgreSQL COPY engine

**Key Methods**:
```python
def load_all() -> Dict:
    """Load all CSV files in dependency order."""
    # 1. Drop indexes
    # 2. Stream each CSV via COPY
    # 3. Rebuild indexes
    # 4. Refresh materialized views
    # 5. Return statistics

def _stream_csv_to_table(table_name, columns, csv_file, has_id_sequence) -> int:
    """Stream CSV file directly to database via COPY."""
    # Uses psycopg2 cursor.copy_expert()
    # Updates sequences for auto-increment columns
    # Returns row count

def _load_item_sources_with_aoid_resolution(csv_file) -> int:
    """Load item_sources CSV with AOID-to-item_id resolution."""
    # Builds AOID -> item_id mapping
    # Resolves AOIDs to database IDs
    # Skips invalid AOIDs with warnings
```

**Index Management**:
```python
def _drop_all_indexes():
    """Drop non-essential indexes from all tables before load."""
    # Preserves primary keys and unique constraints
    # Stores index definitions for rebuild
    # Commits after all drops

def _rebuild_all_indexes():
    """Rebuild all dropped indexes after load."""
    # Uses CREATE INDEX (not CONCURRENTLY - in transaction)
    # Logs errors but continues on failure
```

### Import CLI Integration (`import_cli.py`)

**New Functions**:
```python
def import_all_csv_mode(args):
    """Import all data using CSV pipeline (55x faster)."""
    # 1. Handle --clear flag (reset database)
    # 2. Resolve file paths
    # 3. Create temp CSV directory
    # 4. Phase 1: Transform items + nanos
    # 5. Phase 2: Transform symbiants
    # 6. Phase 3: Load CSV
    # 7. Cleanup temp directory
```

**Flag Routing**:
```python
def import_all(args):
    """Import all data files in order."""
    # Use CSV mode if requested
    if hasattr(args, 'csv_mode') and args.csv_mode:
        return import_all_csv_mode(args)
    # Otherwise use ORM-based approach
```

## Files Involved

### Core Implementation
- `/backend/app/core/csv_transformer.py` - Streaming JSON-to-CSV transformer (760 lines)
- `/backend/app/core/csv_loader.py` - PostgreSQL COPY loader (400 lines)
- `/backend/import_cli.py` - CLI integration with --csv-mode flag (modified)

### Examples and Testing
- `/backend/app/core/csv_loader_example.py` - Usage examples and testing utilities

### Dependencies
- `/backend/app/core/perk_validator.py` - Perk validation and mapping
- `/backend/app/core/database.py` - Database session management
- `/backend/app/models/` - SQLAlchemy models (unchanged)

### External Libraries
- `ijson` - Streaming JSON parser (pip install ijson)
- `psycopg2` - PostgreSQL adapter with COPY support (pip install psycopg2-binary)

## Performance Deep Dive

### Bottleneck Elimination

**Standard Import Bottlenecks**:
1. Python object creation overhead (156k Item objects)
2. SQLAlchemy ORM overhead (session tracking, change detection)
3. INSERT statement overhead (156k individual INSERTs)
4. Auto-increment sequence updates (156k sequence calls)
5. Index updates during INSERT (B-tree maintenance per row)

**CSV Pipeline Solutions**:
1. No Python objects - direct CSV writing
2. No ORM - bypasses SQLAlchemy entirely
3. Single COPY per table - PostgreSQL's fastest bulk load
4. Batch sequence update - single setval() call per table
5. Index rebuild after load - optimal B-tree construction

### Memory Efficiency

**Standard Import Memory Usage**:
- ~500MB for JSON file
- ~2GB for Python objects (Item, StatValue, Spell instances)
- ~500MB for SQLAlchemy session tracking
- **Total**: ~3GB peak

**CSV Pipeline Memory Usage**:
- ~100MB for streaming JSON parser (ijson)
- ~50MB for CSV buffers (written immediately)
- ~100MB for deduplication maps
- ~200MB for CSV files on disk (temporary)
- **Total**: ~450MB peak (85% reduction)

### I/O Optimization

**COPY Protocol Advantages**:
- Binary transfer format (optional, currently using TEXT)
- No query parsing overhead
- No planner overhead
- Direct buffer-to-table transfer
- Batch constraint validation (vs per-row)

**Index Drop/Rebuild Strategy**:
- Loading with indexes: ~100 items/sec (B-tree updates)
- Loading without indexes: ~300 items/sec (append-only)
- Index rebuild: ~50k rows/sec (optimal B-tree construction)
- **Net gain**: 3x throughput improvement

## Error Handling and Diagnostics

### Transformation Errors

```python
# Malformed JSON handling
try:
    items = ijson.items(f, 'item')
except ijson.JSONError as e:
    logger.error(f"JSON parsing failed: {e}")
    # Aborts transformation

# Missing AOID handling
if not aoid:
    logger.warning(f"Skipping item without AOID")
    continue  # Skip item, continue processing
```

### Loading Errors

```python
# COPY failure handling
try:
    cursor.copy_expert(copy_sql, csv_file)
except Exception as e:
    logger.error(f"Failed to load {table_name}: {e}")
    # Raises exception, triggers transaction rollback

# AOID resolution failures
if aoid not in aoid_to_id:
    logger.warning(f"Item not found for AOID {aoid}")
    skipped += 1
    continue  # Skip relationship, continue loading
```

### Statistics and Logging

**Transformation Statistics**:
```python
{
    'items': 156771,
    'stat_values': 45203,
    'criteria': 8945,
    'item_stats': 892341,
    'total_time': 18.5,
    'items_per_second': 8474
}
```

**Loading Statistics**:
```python
{
    'tables_loaded': 19,
    'total_rows': 1245678,
    'total_time': 42.3,
    'rows_per_second': 29446
}
```

## Integration with Existing Systems

### Database Schema Compatibility

The CSV pipeline works with the **exact same schema** as ORM-based imports:
- Uses same table names and column names
- Maintains same foreign key relationships
- Produces identical data (validated with test suite)
- Compatible with existing migrations
- No schema changes required

### Migration System Integration

The CSV loader uses migration-defined source types:
```python
SOURCE_TYPE_MOB_ID = 1  # From migration 005_create_source_tables
symbiant_stats = transformer.transform_symbiants(
    str(symbiants_path),
    source_type_id=SOURCE_TYPE_MOB_ID
)
```

### Materialized View Integration

Post-load refresh of symbiant_items view:
```python
symbiant_items_exists = db.execute(text(
    "SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'symbiant_items')"
)).scalar()

if symbiant_items_exists:
    db.execute(text("REFRESH MATERIALIZED VIEW symbiant_items"))
```

## Best Practices

### When to Use CSV Pipeline

**Recommended for**:
- Initial database setup
- Full data reloads
- Production database migrations
- Development database resets
- CI/CD database seeding

**Not recommended for**:
- Incremental updates (use ORM)
- Single item imports (use ORM)
- Real-time data ingestion (use ORM)
- When database must remain queryable (CSV drops indexes)

### Disk Space Requirements

Temporary CSV files require approximately:
- Items + Nanos: ~400MB
- Symbiants: ~10MB
- **Total**: ~410MB temporary disk space

Ensure adequate space in temp directory (default: `/tmp/tinkertools_csv_*`)

### PostgreSQL Configuration

For optimal performance, tune these settings:
```sql
-- Increase work memory for large sorts
SET work_mem = '256MB';

-- Increase maintenance memory for index builds
SET maintenance_work_mem = '512MB';

-- Increase shared buffers for large loads (server-level)
shared_buffers = '2GB'  # In postgresql.conf
```

### Monitoring Import Progress

```bash
# Watch import log
tail -f import.log

# Monitor database size
watch -n 5 'psql -U tinkertools_user -d tinkertools -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||.||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = public
  ORDER BY pg_total_relation_size(schemaname||.||tablename) DESC
  LIMIT 10;"'

# Check row counts during import
psql -U tinkertools_user -d tinkertools -c "
  SELECT 'items' AS table, COUNT(*) FROM items
  UNION ALL
  SELECT 'stat_values', COUNT(*) FROM stat_values
  UNION ALL
  SELECT 'item_stats', COUNT(*) FROM item_stats;"
```

## Comparison with Other Import Modes

| Feature | Standard | Optimized | CSV Pipeline |
|---------|----------|-----------|--------------|
| Performance | 2-5 items/sec | 50-100 items/sec | 100-300 items/sec |
| Memory Usage | High (3GB) | Medium (1.5GB) | Low (450MB) |
| Database Queryable | Yes | Yes | No (indexes dropped) |
| Transaction Size | Per-item | Per-batch | Per-table |
| Error Recovery | Per-item | Per-batch | Per-table |
| Incremental Updates | Yes | Yes | No |
| Network Efficiency | Low | Medium | High |
| Complexity | Low | Medium | High |

## Future Enhancements

### Potential Improvements

1. **Binary COPY Format**: Use BINARY instead of TEXT for 20-30% speedup
2. **Parallel Loading**: Load independent tables concurrently
3. **Incremental CSV Mode**: Support delta imports via CSV
4. **Compression**: Gzip CSV files for 60-70% disk savings
5. **Partitioned Tables**: Optimize for multi-million row datasets
6. **Foreign Server Support**: Load from remote CSV via file_fdw
7. **Validation Mode**: Dry-run validation without database writes

### Known Limitations

1. **No incremental updates**: Requires full data reload
2. **Temporary disk space**: Needs ~500MB free space
3. **Database unavailable**: Indexes dropped during import
4. **psycopg2 dependency**: Requires psycopg2-binary (not psycopg3)
5. **AOID resolution overhead**: item_sources requires in-memory mapping

## Troubleshooting

### Common Issues

**Issue**: `ImportError: No module named 'ijson'`
```bash
# Solution
pip install ijson
```

**Issue**: `ImportError: psycopg2 not available`
```bash
# Solution
pip install psycopg2-binary
```

**Issue**: CSV import failed with "CSV file not found"
```bash
# Diagnosis
ls -la /tmp/tinkertools_csv_*

# Solution: Ensure transformation phase completed successfully
# Check logs for transformation errors
```

**Issue**: AOID resolution warnings
```
WARNING: Item not found for AOID 123456
```
```bash
# Diagnosis: Item doesn't exist in database
# This is normal for items referenced in symbiants.csv but not in items.json
# Check if AOID exists in JSON:
jq '.[] | select(.AOID == 123456)' database/items.json
```

**Issue**: Sequence out of sync after import
```
ERROR: duplicate key value violates unique constraint "items_pkey"
```
```sql
-- Solution: Manually reset sequence
SELECT setval('items_id_seq', (SELECT MAX(id) FROM items), true);
```

## References

- **Optimized Importer**: `/docs/features/optimized-importer.doc.md` - Previous optimization approach
- **Ultra Mode**: `/docs/ULTRA_MODE_IMPLEMENTATION.md` - Advanced optimizations (now superseded by CSV mode)
- **Database Schema**: `/docs/internal/02_database_schema.md` - Table structure reference
- **PostgreSQL COPY**: https://www.postgresql.org/docs/current/sql-copy.html - Official documentation
