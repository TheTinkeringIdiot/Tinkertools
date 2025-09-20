-- Migration 000: Create Schema Migrations Table
-- This must be run first to set up the migration tracking system

\echo 'Creating schema_migrations table...'

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at);

\echo 'Schema migrations table created successfully!'