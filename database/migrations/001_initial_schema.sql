-- Migration 001: Initial TinkerTools Database Schema
-- Created: 2025-01-05
-- Description: Creates all 20 tables with proper indexes, constraints, and relationships

\echo 'Running Migration 001: Initial Schema Creation...'

-- Read and execute the main schema file
\i '../schema.sql'

-- Insert migration record
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES ('001', 'initial_schema', CURRENT_TIMESTAMP);

\echo 'Migration 001 completed successfully!'