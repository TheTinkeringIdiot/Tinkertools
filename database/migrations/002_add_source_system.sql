-- ============================================================================
-- Migration 002: Add Source System
-- ============================================================================
-- NOTE: Source system tables were already added in migration 001_initial_schema.sql
-- This migration file is kept for historical compatibility but doesn't create any tables
-- as they already exist in the initial schema.

-- Track migration for compatibility
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('002', 'add_source_system', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;