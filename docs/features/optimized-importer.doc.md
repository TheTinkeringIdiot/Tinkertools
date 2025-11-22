# Optimized Data Importer

## Overview

The Optimized Data Importer is a high-performance alternative to the standard data import system that provides **10-20x performance improvements** while maintaining complete data accuracy. It's designed to handle large-scale imports of game data (items, nanos, symbiants) into the TinkerTools database with minimal resource usage and significantly reduced processing time.

## Performance Improvements

### Key Optimizations (November 2025 Enhancement)

1. **Increased Batch Size**: Raised from 1000 to 5000 items per batch for remote databases
2. **Phased Import Strategy**: Processes relationships in distinct phases with strategic flush points:
   - Phase 1: Item entities (bulk creation with batch preloading)
   - Phase 2: ItemStats relationships (no flush needed, uses existing IDs)
   - Phase 3: AttackDefense objects (single flush for entire batch)
   - Phase 4: AnimationMesh objects (single flush for entire batch)
   - Phase 5: Actions with criteria (batch creation + flush)
   - Phase 6: SpellData with nested Spells (batch creation + flush)
   - Phase 7: Perks (final phase)
3. **N+1 Query Elimination**:
   - Batch preload all existing items in single query (`AOID IN (...)`)
   - Cache items by AOID for relationship processing
   - Eliminates duplicate queries at line 304 (was querying item twice)
4. **Singleton Preloading**: Loads all StatValues and Criteria upfront (unchanged)
5. **Reduced Flush Frequency**: 1 flush per phase instead of per item (previously flushed after every AttackDefense, Action, Spell)
6. **Bulk Inserts**: Uses SQLAlchemy's `bulk_insert_mappings()` for relationship data (unchanged)
7. **Connection Pool Optimization**: Optimized PostgreSQL connection pool settings (unchanged)
8. **Perk Metadata Caching**: Class-level caching of perk data to avoid repeated file reads (unchanged)

### Performance Results

Based on testing with 500-item datasets:
- **Standard Importer**: ~2-5 items/second
- **Optimized Importer (Original)**: ~50-100 items/second
- **Optimized Importer (November 2025)**: ~150-200 items/second (estimated)
- **Typical Speedup**: 30-40x faster (was 10-20x)

For the full items.json file (156,771 items):
- Standard mode: ~8-12 hours
- Optimized mode (original): ~30-45 minutes
- Optimized mode (enhanced): ~15-25 minutes (estimated)

## Usage

### Command Line Interface

The optimized importer is integrated into the existing `import_cli.py` with the `--optimized` flag:

```bash
# Basic optimized import
python import_cli.py items --optimized

# Optimized import with custom batch size
python import_cli.py items --optimized --batch-size 2000

# Import all data with optimization
python import_cli.py all --optimized --clear

# Standard vs Optimized comparison
python import_cli.py items --chunk-size 100     # Standard mode
python import_cli.py items --optimized          # Optimized mode
```

### Python API

```python
from app.core.optimized_importer import OptimizedImporter

# Initialize with custom batch size
importer = OptimizedImporter(batch_size=1500)

# Import items
stats = importer.import_items_from_json(
    'database/items.json',
    is_nano=False,
    clear_existing=False
)

print(f"Imported {stats['items_created']} items at {stats['items_per_second']:.1f} items/sec")
```

## Technical Architecture

### Data Flow (Enhanced November 2025)

1. **File Loading**: Loads entire JSON file into memory
2. **Singleton Preloading**:
   - Scans all data to identify needed StatValues and Criteria
   - Bulk creates missing singletons
   - Caches all singletons in memory
3. **Batch Processing** (Phased approach):
   - **Batch Preload**: Single query to fetch all existing items (`Item.aoid IN (...)`)
   - **Phase 1 - Items**: Create/update Item entities, cache by AOID
   - **Phase 2 - ItemStats**: Process all item_stats relationships (no flush)
   - **Phase 3 - AttackDefense**: Create all AttackDefense objects → single flush → process stats
   - **Phase 4 - AnimationMesh**: Create all AnimationMesh objects → single flush → link to items
   - **Phase 5 - Actions**: Create all Action objects → single flush → process criteria
   - **Phase 6 - SpellData**: Create SpellData + nested Spells → flush → process criteria
   - **Phase 7 - Perks**: Create perk relationships for items with perk data
4. **Relationship Creation**: Bulk inserts all buffered relationships after each phase
5. **Transaction Commit**: Commits entire batch atomically

### Key Architectural Changes (November 2025)

**Problem Solved**: N+1 query pattern
- **Before**: Each item queried database 2-3 times (once to check existence, once to get for relationships)
- **After**: Single batch query preloads all items, cached for relationship processing

**Problem Solved**: Excessive flush operations
- **Before**: Flushed after every AttackDefense, Action, AnimationMesh, SpellData, Spell (5N flushes for N items)
- **After**: 1 flush per phase (5 total flushes per batch regardless of batch size)

**Memory Trade-off**:
- Stores temporary data on model instances (`action._criteria_data`, `spell._criteria_data`)
- Maintains item cache dictionary for relationship lookups
- Batch size increased 5x (5000 vs 1000) but memory usage remains acceptable due to eliminated query overhead

### Memory Management

- **Singleton Caches**: Loaded once per import session
- **Perk Cache**: Class-level cache shared across all importer instances
- **Relationship Buffers**: Cleared after each batch to prevent memory buildup
- **Connection Pooling**: Optimized pool settings for high-throughput operations

### Error Handling

- **Per-Item Error Isolation**: Failed items don't affect the entire batch
- **Transaction Rollback**: Batch-level rollback on critical failures
- **Comprehensive Logging**: Detailed progress tracking and error reporting
- **Statistics Tracking**: Real-time performance metrics

## Integration with Existing Systems

### Database Schema Compatibility

The optimized importer works with the existing database schema and produces identical results to the standard importer:

- Uses same SQLAlchemy models (`Item`, `StatValue`, `Criterion`, etc.)
- Maintains all foreign key relationships
- Preserves data integrity constraints
- Compatible with existing migrations

### Perk System Integration

- Integrates with the `perk_validator` module for data validation
- Uses cached perk metadata from `database/perks.json`
- Supports profession and breed mapping
- Maintains perk-to-item relationships

### Migration and Source Model Updates

The optimized importer includes compatibility fixes for the Source model:

```python
# Fixed metadata column aliasing in source.py
source_metadata = Column('metadata', JSONB, default={})

# Backward compatibility property
@property
def extra_data(self):
    return self.source_metadata
```

## Configuration Options

### Batch Size Tuning

```python
# Default for remote databases (November 2025 enhancement)
importer = OptimizedImporter(batch_size=5000)

# Small batches (more frequent commits, lower memory)
importer = OptimizedImporter(batch_size=1000)

# Very large batches (maximum throughput, requires adequate memory)
importer = OptimizedImporter(batch_size=10000)

# Memory-constrained environments
importer = OptimizedImporter(batch_size=500)
```

**November 2025 Update**: Default batch size increased from 1000 to 5000 for remote databases based on performance testing. The phased import strategy with reduced flush frequency makes larger batches more memory-efficient than before.

### Connection Pool Settings

```python
# Built-in optimized settings
engine = create_engine(
    db_url,
    pool_size=10,          # More concurrent connections
    max_overflow=20,       # Higher connection burst capacity
    pool_pre_ping=True     # Connection health checks
)
```

## Files Involved

### Core Implementation
- `/backend/app/core/optimized_importer.py` - Main OptimizedImporter class (major enhancement November 2025)
- `/backend/import_cli.py` - Command-line interface with --optimized flag
- `/backend/app/models/source.py` - Database model fixes for metadata compatibility
- `/backend/app/core/migration_runner.py` - Updated table list for schema verification (added mobs, pocket_bosses, shop tables)
- `/backend/app/models/mob.py` - Fixed TIMESTAMP column to use SQLAlchemy `text()` for compatibility
- `/backend/apply_new_indexes.py` - Utility script for applying performance indexes

### Testing and Profiling
- `/backend/test_optimized.py` - Performance comparison testing
- `/backend/profile_import.py` - Profiling utilities for bottleneck analysis
- `/backend/database/test_optimized.json` - Test dataset (500 items)
- `/backend/database/test_profile.json` - Profiling dataset (100 items)

### Dependencies
- `/backend/app/core/perk_validator.py` - Perk validation utilities
- `/backend/app/models/` - All SQLAlchemy model definitions
- `/backend/database/perks.json` - Perk metadata cache source

## Best Practices

### When to Use Optimized Mode

**Use optimized mode for:**
- Initial database setup and data loading
- Large-scale imports (>1000 items)
- Production database migrations
- Performance-critical batch operations

**Use standard mode for:**
- Small incremental updates
- Development and debugging
- When maximum stability is required over performance
- Single-item imports or updates

### Monitoring and Troubleshooting

```bash
# Monitor import progress
tail -f import.log

# Check database performance during import
SELECT count(*) FROM items;
SELECT pg_stat_activity FROM pg_stat_activity WHERE state = 'active';
```

### Performance Tuning

1. **Batch Size**: Larger batches = higher performance, more memory usage
2. **Connection Pool**: Increase pool_size for highly concurrent systems
3. **PostgreSQL Settings**: Tune `shared_buffers`, `work_mem` for large imports
4. **Disk I/O**: Use SSDs for optimal database performance during imports

## Comparison with Standard Importer

| Feature | Standard Importer | Optimized Importer |
|---------|------------------|-------------------|
| Performance | 2-5 items/sec | 50-100 items/sec |
| Memory Usage | Low | Moderate |
| Transaction Size | Per-item | Per-batch |
| Error Recovery | Per-item rollback | Per-batch rollback |
| Progress Tracking | Detailed | Batch-level |
| Stability | Maximum | High |
| Resource Usage | Minimal | Optimized |

## Future Enhancements

- **Parallel Processing**: Multi-threaded import for even higher performance
- **Incremental Updates**: Delta import capabilities for changed data only
- **Compression**: On-the-fly data compression for memory efficiency
- **Resume Capability**: Ability to resume interrupted imports
- **Real-time Monitoring**: Web dashboard for import progress tracking