-- ============================================================================
-- Migration 002: Add Source System
-- ============================================================================
-- Adds flexible source tracking for items to support:
-- - Nanocrystals that upload nanoprograms
-- - NPCs/mobs that drop items (future)
-- - Bosses that drop items (future)
-- - Missions that reward items (future)
-- - Vendors that sell items (future)

-- Track migration
INSERT INTO migrations (migration_id, description, applied_at) 
VALUES (2, 'Add source system for item origins', NOW());

-- ============================================================================
-- Source Types Table
-- ============================================================================

CREATE TABLE source_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Insert initial source types
INSERT INTO source_types (name, description) VALUES
    ('item', 'Items that create/upload other items (e.g., nanocrystals)'),
    ('npc', 'NPCs and mobs that drop items'),
    ('boss', 'Boss encounters that drop items'),
    ('mission', 'Missions that reward items'),
    ('vendor', 'Vendors and shops that sell items');

-- ============================================================================
-- Sources Table
-- ============================================================================

CREATE TABLE sources (
    id SERIAL PRIMARY KEY,
    source_type_id INTEGER NOT NULL REFERENCES source_types(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL,  -- References the actual entity (item.id, npc.id, etc.)
    name VARCHAR(255) NOT NULL,  -- Denormalized name for performance
    metadata JSONB DEFAULT '{}',  -- Flexible metadata storage
    
    -- Unique constraint to prevent duplicate sources
    CONSTRAINT unique_source UNIQUE (source_type_id, source_id)
);

-- Performance indexes for sources
CREATE INDEX idx_sources_type_id ON sources(source_type_id);
CREATE INDEX idx_sources_source_id ON sources(source_id);
CREATE INDEX idx_sources_name ON sources(name);
CREATE INDEX idx_sources_metadata ON sources USING GIN (metadata);
CREATE INDEX idx_sources_type_source ON sources(source_type_id, source_id);

-- ============================================================================
-- Item Sources Junction Table
-- ============================================================================

CREATE TABLE item_sources (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    drop_rate DECIMAL(5,2),  -- Optional drop rate percentage (0.01 to 100.00)
    min_ql INTEGER,  -- Minimum QL for this source (for level-based drops)
    max_ql INTEGER,  -- Maximum QL for this source
    conditions TEXT,  -- Optional conditions or requirements
    metadata JSONB DEFAULT '{}',  -- Additional flexible data
    
    PRIMARY KEY (item_id, source_id)
);

-- Performance indexes for item_sources
CREATE INDEX idx_item_sources_item ON item_sources(item_id);
CREATE INDEX idx_item_sources_source ON item_sources(source_id);
CREATE INDEX idx_item_sources_ql_range ON item_sources(min_ql, max_ql);
CREATE INDEX idx_item_sources_drop_rate ON item_sources(drop_rate);
CREATE INDEX idx_item_sources_metadata ON item_sources USING GIN (metadata);

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON TABLE source_types IS 'Defines types of sources that can provide items (crystals, NPCs, missions, etc.)';
COMMENT ON TABLE sources IS 'Specific source instances that can provide items, polymorphic references to various entity types';
COMMENT ON TABLE item_sources IS 'Many-to-many relationship between items and their sources with optional metadata';

COMMENT ON COLUMN sources.source_id IS 'References the ID of the actual source entity (items.id for crystals, npc.id for mobs, etc.)';
COMMENT ON COLUMN sources.metadata IS 'Flexible JSONB field for source-specific data like location, level range, spawn conditions';
COMMENT ON COLUMN item_sources.drop_rate IS 'Optional drop rate as percentage (0.01 = 1%, 100.00 = 100%)';
COMMENT ON COLUMN item_sources.min_ql IS 'Minimum QL for items from this source (for level-scaled drops)';
COMMENT ON COLUMN item_sources.max_ql IS 'Maximum QL for items from this source (for level-scaled drops)';
COMMENT ON COLUMN item_sources.metadata IS 'Additional data like spawn conditions, special requirements, etc.';