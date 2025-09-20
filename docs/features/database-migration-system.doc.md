# Database Migration System

## Overview

TinkerTools now includes a robust database migration and recreation system that handles complete database schema management with proper dependency ordering, foreign key constraint management, and migration tracking.

## Key Components

### DatabaseMigrator (`backend/app/core/db_migrator.py`)

The `DatabaseMigrator` class provides comprehensive database recreation capabilities:

- **Complete Database Recreation**: Drops and recreates the entire database schema
- **Dependency-Aware Operations**: Handles table dropping/creation in proper dependency order
- **Foreign Key Management**: Temporarily disables constraints during operations
- **Migration Tracking**: Maintains schema_migrations table for tracking applied changes
- **Schema Integrity Verification**: Validates database structure after operations

#### Key Methods

- `recreate_database(force=False)`: Complete database recreation with optional confirmation
- `get_migration_status()`: Returns current migration status and applied migrations
- `_drop_all_tables()`: Drops tables in dependency order
- `_create_schema()`: Creates schema from SQL files
- `_verify_schema_integrity()`: Validates the final schema

### MigrationRunner (`backend/app/core/migration_runner.py`)

The `MigrationRunner` class manages individual migration file execution:

- **Migration File Processing**: Executes SQL migration files in order
- **TinkerTools Table Management**: Identifies and manages only TinkerTools-specific tables
- **Cascade Operations**: Handles table drops with proper CASCADE behavior
- **Schema Verification**: Validates that essential tables exist after migrations

#### Key Methods

- `reset_database()`: Complete reset (drop + migrate)
- `run_migrations()`: Execute migration files in order
- `drop_all_tables()`: Drop only TinkerTools tables
- `verify_schema()`: Validate schema integrity

## Data Flow

1. **Migration Discovery**: System scans `database/migrations/` for `*.sql` files
2. **Dependency Resolution**: Tables are dropped/created in dependency order to avoid constraint violations
3. **Transaction Management**: Operations use appropriate transaction boundaries
4. **Validation**: Schema integrity is verified after each major operation

## Implementation Files

### Core System Files
- `backend/app/core/db_migrator.py` - Complete database recreation
- `backend/app/core/migration_runner.py` - Migration file execution
- `database/migrations/000_create_migration_table.sql` - Migration tracking table
- `database/migrations/001_initial_schema.sql` - Core schema definition
- `database/migrations/002_add_source_system.sql` - Source system tables
- `database/migrations/003_add_perk_support.sql` - Perk system integration
- `database/migrations/004_add_perks_table.sql` - New perk table structure

### Integration Points
- `backend/app/core/database.py` - Database connection management
- `backend/import_cli.py` - CLI integration for database operations

## Usage Examples

### Complete Database Recreation
```python
from app.core.db_migrator import DatabaseMigrator

migrator = DatabaseMigrator()
success = migrator.recreate_database(force=True)
```

### Migration Status Check
```python
status = migrator.get_migration_status()
print(f"Applied migrations: {len(status['applied_migrations'])}")
```

### CLI Usage
```bash
# Reset database with import CLI
python import_cli.py --clear

# Check migration status
python -c "from app.core.db_migrator import get_migration_status; print(get_migration_status())"
```

## Migration File Structure

Migration files follow a numbered naming convention:
- `000_create_migration_table.sql` - Creates tracking infrastructure
- `001_initial_schema.sql` - Base schema with core tables
- `002_add_source_system.sql` - Source system extension
- `003_add_perk_support.sql` - Perk system integration
- `004_add_perks_table.sql` - Enhanced perk table structure

## Safety Features

- **Confirmation Prompts**: Interactive confirmation for destructive operations
- **Non-Interactive Mode**: Automatic proceeding in CI/automated environments
- **Error Recovery**: Detailed error messages with debugging hints
- **Constraint Management**: Automatic foreign key constraint handling
- **Transaction Safety**: Proper transaction boundaries for atomic operations

## Performance Considerations

- **Connection Pooling**: Optimized pool size for migration operations
- **Batch Operations**: Single-transaction execution for related operations
- **Index Management**: Proper index creation timing to avoid conflicts
- **Memory Efficiency**: Streaming file processing for large migration files

## Future Enhancements

- **Rollback Capability**: Support for migration rollbacks
- **Incremental Migrations**: Apply only new migrations
- **Schema Diff**: Compare current schema with expected schema
- **Parallel Migrations**: Concurrent execution where dependencies allow