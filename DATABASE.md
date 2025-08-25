# TinkerTools Database Documentation

## Overview

This document provides comprehensive information about the TinkerTools PostgreSQL database, including setup, schema design, operations, and maintenance procedures.

## Quick Start

### Prerequisites

- PostgreSQL 12+ installed and running
- `psql` command-line client available
- Bash shell (for setup scripts)

### Initial Setup

1. **Start PostgreSQL service** (if not already running):
   ```bash
   # On Ubuntu/Debian
   sudo systemctl start postgresql
   
   # On macOS with Homebrew
   brew services start postgresql
   ```

2. **Run the database setup**:
   ```bash
   cd database
   ./setup.sh
   ```

3. **Verify installation**:
   ```bash
   ./setup.sh verify
   ```

## Database Schema

### Design Principles

The TinkerTools database follows these design principles:

- **Legacy Fidelity**: Based on proven Django models from the original system
- **Data Separation**: Game data server-side, user data client-side only
- **Performance First**: Optimized for read-heavy workloads with proper indexing
- **No Timestamps**: Static game data doesn't need audit trails (except cache expiration)

### Schema Overview

The database contains **23 core tables** plus 1 cache table:

#### Core Entity Tables
- `stat_values` - Reusable stat-value pairs with unique constraints
- `criteria` - Reusable criteria for spells and actions
- `items` - Main items table (includes nanos with `is_nano` flag)
- `spells` - Individual spell definitions
- `symbiants` - Symbiant definitions
- `pocket_bosses` - Pocket boss information
- `source_types` - Types of sources that provide items (crystals, NPCs, missions, etc.)
- `sources` - Polymorphic source instances (references various entity types)

#### System Tables
- `attack_defense` - Attack/defense combinations
- `animation_mesh` - Animation and mesh data
- `shop_hash` - Shop/vendor mechanics
- `spell_data` - Spell data events
- `actions` - Item actions with ordered criteria

#### Junction Tables (Many-to-Many Relationships)
- `spell_criteria` - Spells ↔ Criteria
- `spell_data_spells` - Spell Data ↔ Spells
- `attack_defense_attack` - Attack Defense ↔ Attack Stats
- `attack_defense_defense` - Attack Defense ↔ Defense Stats
- `item_stats` - Items ↔ Stat Values
- `item_spell_data` - Items ↔ Spell Data
- `item_shop_hash` - Items ↔ Shop Hash
- `action_criteria` - Actions ↔ Criteria (with ordering)
- `pocket_boss_symbiant_drops` - Pocket Bosses ↔ Symbiants
- `item_sources` - Items ↔ Sources (with drop rates and metadata)

#### Cache Table
- `application_cache` - Application caching with TTL expiration

### Key Constraints

#### Unique Constraints
- `stat_values(stat, value)` - Prevents duplicate stat-value pairs
- `criteria(value1, value2, operator)` - Prevents duplicate criteria
- `action_criteria(action_id, criterion_id)` - Prevents duplicate action criteria

#### Foreign Key Constraints
All junction tables have proper foreign key relationships with CASCADE DELETE to maintain referential integrity.

## Database Operations

### Setup and Migration

#### Initial Setup
```bash
# Full setup with database creation
./database/setup.sh

# Reset everything and start fresh
./database/setup.sh reset
```

#### Manual Migration
```bash
# Create migration table
psql -U tinkertools_user -d tinkertools -f database/migrations/000_create_migration_table.sql

# Run initial schema
psql -U tinkertools_user -d tinkertools -f database/migrations/001_initial_schema.sql

# Add source system
psql -U tinkertools_user -d tinkertools -f database/migrations/002_add_source_system.sql
```

### Backup and Restore

#### Create Backup
```bash
# Full backup with compression
./database/backup.sh backup

# List available backups
./database/backup.sh list
```

#### Restore from Backup
```bash
# Restore from specific backup file
./database/backup.sh restore backups/tinkertools_20231201_120000.sql.gz

# Verify backup integrity
./database/backup.sh verify backups/tinkertools_20231201_120000.sql.gz
```

#### Maintenance
```bash
# Clean old backups (older than 7 days)
./database/backup.sh clean

# Clean old backups (older than 14 days)
./database/backup.sh clean 14

# Show database size information
./database/backup.sh size
```

### Testing

#### Run Schema Tests
```bash
# Run comprehensive schema tests
psql -U tinkertools_user -d tinkertools -f database/tests/test_schema.sql
```

The test suite verifies:
- All 20 required tables exist
- Unique constraints work correctly
- Foreign key constraints prevent invalid data
- Required indexes exist
- Cascade deletes work properly
- Data types and validation work
- Full-text search indexes function
- Many-to-many relationships work

## Performance Considerations

### Indexing Strategy

#### B-Tree Indexes (Most queries)
- Primary keys (automatic)
- Foreign keys for join performance
- Frequently queried columns (AOID, name, level, etc.)
- Composite indexes for multi-column queries

#### GIN Indexes (Full-text search)
- `items.name` - Full-text search on item names
- `spells.spell_params` - JSONB parameter search

#### Specialized Indexes
- `shop_hash(min_level, max_level)` - Range queries
- `action_criteria(action_id, order_index)` - Ordered criteria

### Query Optimization

#### Common Query Patterns
```sql
-- Item search with stats (optimized with proper indexes)
SELECT i.*, sv.stat, sv.value
FROM items i
JOIN item_stats ist ON i.id = ist.item_id
JOIN stat_values sv ON ist.stat_value_id = sv.id
WHERE i.ql >= 100 AND sv.stat = 16; -- Strength items QL 100+

-- Full-text search (uses GIN index)
SELECT * FROM items 
WHERE to_tsvector('english', name) @@ to_tsquery('english', 'plasma & rifle');

-- Pocket boss drops (junction table optimization)
SELECT pb.name, s.family, s.aoid
FROM pocket_bosses pb
JOIN pocket_boss_symbiant_drops pbsd ON pb.id = pbsd.pocket_boss_id
JOIN symbiants s ON pbsd.symbiant_id = s.id
WHERE pb.level BETWEEN 150 AND 200;

-- Source system queries (polymorphic design)
SELECT i.name, s.name as source_name, st.name as source_type
FROM items i
JOIN item_sources is ON i.id = is.item_id
JOIN sources s ON is.source_id = s.id
JOIN source_types st ON s.source_type_id = st.id
WHERE i.aoid = 25980;  -- Find sources for a specific nano

-- Find all nanos uploaded by a specific crystal
SELECT i.name, i.ql, is.min_ql, is.max_ql
FROM items i
JOIN item_sources is ON i.id = is.item_id
JOIN sources s ON is.source_id = s.id
WHERE s.source_type_id = 1 AND s.source_id = 26017;  -- Crystal AOID
```

### Source System Design

The source system uses a polymorphic design to track where items come from:

- **source_types**: Defines categories (item, npc, mission, boss, vendor)
- **sources**: Polymorphic references to actual entities (crystal items, NPCs, etc.)
- **item_sources**: Junction table with metadata (drop rates, conditions, QL ranges)

This design allows tracking that:
- Nanocrystals upload nanoprograms
- NPCs drop specific items (future)
- Missions reward certain items (future)
- Bosses have loot tables (future)
- Vendors sell items at specific locations (future)

#### Performance Targets
- Complex stat-based queries: **< 500ms** (REQ-PERF-001)
- Simple lookups: **< 50ms**
- Full-text search: **< 200ms**

## Connection Configuration

### Environment Variables

```bash
# Database connection settings
DATABASE_URL="postgresql://tinkertools_user:tinkertools_dev@localhost:5432/tinkertools"

# Development settings
SQL_DEBUG=false  # Set to true to log all SQL queries

# Connection pool settings (handled by SQLAlchemy)
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
```

### FastAPI Integration

The backend uses SQLAlchemy for ORM and connection management:

```python
from backend.app.core.database import get_db, health_check

# Dependency injection for routes
@app.get("/items")
def get_items(db: Session = Depends(get_db)):
    return db.query(Item).all()

# Health check endpoint
@app.get("/health/database")
def database_health():
    return health_check()
```

## Data Import and Seeding

### Sample Data

The database includes sample data for development:

```bash
# Sample data is automatically loaded during setup
# Manual seeding:
psql -U tinkertools_user -d tinkertools -f database/seeds/sample_data.sql
```

Sample data includes:
- 25+ stat values (common game stats)
- 10+ criteria (skill requirements)
- 8+ spells (healing, damage, buffs, debuffs)
- 10+ items (weapons, armor, nanos, implants)
- 5+ symbiants (different families)
- 5+ pocket bosses (various levels and locations)

### Production Data Import

For production data import from existing sources:

1. **Prepare import scripts** in `database/imports/`
2. **Use transactions** for atomic imports
3. **Validate constraints** before committing
4. **Create backup** before major imports

## Security Considerations

### Database Access

- **No server-side user data**: All character profiles stored client-side only
- **Read-only API**: No modification endpoints for game data
- **Parameterized queries**: All queries use parameter binding
- **Connection pooling**: Prevents connection exhaustion attacks

### Development vs Production

#### Development
- User: `tinkertools_user`
- Password: `tinkertools_dev`
- Local PostgreSQL instance

#### Production
- Environment-specific credentials
- SSL connections required
- Connection string from environment variables
- Backup encryption enabled

## Troubleshooting

### Common Issues

#### Connection Problems
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test database connection
psql -U tinkertools_user -d tinkertools -c "SELECT 1;"
```

#### Schema Issues
```bash
# Verify table count
psql -U tinkertools_user -d tinkertools -c "
  SELECT COUNT(*) FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

# Run schema tests
psql -U tinkertools_user -d tinkertools -f database/tests/test_schema.sql
```

#### Performance Issues
```bash
# Check database size
./database/backup.sh size

# Analyze query performance
psql -U tinkertools_user -d tinkertools -c "
  EXPLAIN ANALYZE SELECT * FROM items WHERE ql > 200;"
```

### Logs and Monitoring

#### Enable SQL Logging
```bash
export SQL_DEBUG=true
# Restart FastAPI application
```

#### Database Metrics
```python
from backend.app.core.database import get_database_info, health_check

# Get connection pool info
info = get_database_info()

# Get health status
health = health_check()
```

## Maintenance Schedule

### Daily
- Monitor connection pool usage
- Check error logs
- Verify backup completion

### Weekly
- Run schema integrity tests
- Clean old backups (automatic via cron)
- Review slow query logs

### Monthly
- Update table statistics: `ANALYZE;`
- Vacuum unused space: `VACUUM;`
- Review index usage
- Performance baseline testing

## Schema Evolution

### Adding New Tables
1. Create migration script in `database/migrations/`
2. Update schema.sql
3. Add corresponding tests
4. Update documentation

### Modifying Existing Tables
1. **Never** drop columns with data
2. Add new columns as nullable
3. Create data migration scripts
4. Update constraints carefully
5. Test thoroughly in staging

### Index Management
1. Monitor query performance
2. Add indexes for slow queries
3. Remove unused indexes
4. Consider partial indexes for large tables

## Backup Strategy

### Automated Backups
- **Daily**: Full database backup with compression
- **Weekly**: Schema-only backup for quick restoration
- **Monthly**: Data-only backup for data analysis
- **Retention**: 30 days for daily, 12 weeks for weekly, 12 months for monthly

### Backup Verification
- **Integrity checks**: Automated verification of backup files
- **Restoration tests**: Monthly test restorations to staging
- **Offsite storage**: Encrypted backups stored in cloud storage

## Contact and Support

For database-related issues:

1. **Check logs**: Application and PostgreSQL logs
2. **Run diagnostics**: Use provided scripts and health checks
3. **Review documentation**: This document and inline SQL comments
4. **Test environment**: Use test scripts to isolate issues

---

**Last Updated**: 2025-01-05  
**Schema Version**: 001 (Initial Schema)  
**PostgreSQL Version**: 12+  
**Documentation Version**: 1.0