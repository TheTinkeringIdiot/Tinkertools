-- TinkerTools Database Schema
-- PostgreSQL database schema for the TinkerTools suite
-- Based on legacy Django models with performance optimizations

-- ============================================================================
-- Core Tables - Reusable Entities
-- ============================================================================

-- 1. StatValue Table (Reusable Entities)
CREATE TABLE IF NOT EXISTS stat_values (
    id SERIAL PRIMARY KEY,
    stat INTEGER NOT NULL,
    value INTEGER NOT NULL,
    
    -- Unique constraint prevents duplicate stat-value pairs
    CONSTRAINT unique_stat_value UNIQUE (stat, value)
);

-- Performance indexes for stat_values
CREATE INDEX IF NOT EXISTS idx_stat_values_stat_value ON stat_values(stat, value);
CREATE INDEX IF NOT EXISTS idx_stat_values_value ON stat_values(value);
CREATE INDEX IF NOT EXISTS idx_stat_values_stat ON stat_values(stat);

-- 2. Criterion Table
CREATE TABLE IF NOT EXISTS criteria (
    id SERIAL PRIMARY KEY,
    value1 INTEGER NOT NULL,
    value2 INTEGER NOT NULL,
    operator INTEGER NOT NULL,
    
    -- Unique constraint prevents duplicate criteria
    CONSTRAINT unique_criterion UNIQUE (value1, value2, operator)
);

-- Performance indexes for criteria
CREATE INDEX IF NOT EXISTS idx_criteria_values ON criteria(value1, value2, operator);

-- ============================================================================
-- Spell System Tables
-- ============================================================================

-- 3. Spells Table
CREATE TABLE IF NOT EXISTS spells (
    id SERIAL PRIMARY KEY,
    target INTEGER,
    tick_count INTEGER,
    tick_interval INTEGER,
    spell_id INTEGER,
    spell_format VARCHAR(512),
    spell_params JSONB DEFAULT '[]'
);

-- Performance indexes for spells
CREATE INDEX IF NOT EXISTS idx_spells_spell_id ON spells (spell_id);
CREATE INDEX IF NOT EXISTS idx_spells_target ON spells (target);
CREATE INDEX IF NOT EXISTS idx_spells_params ON spells USING GIN (spell_params);

-- 4. Spell Criteria Junction Table
CREATE TABLE IF NOT EXISTS spell_criteria (
    spell_id INTEGER REFERENCES spells(id) ON DELETE CASCADE,
    criterion_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
    
    PRIMARY KEY (spell_id, criterion_id)
);

-- Performance indexes for spell_criteria
CREATE INDEX IF NOT EXISTS idx_spell_criteria_spell ON spell_criteria(spell_id);
CREATE INDEX IF NOT EXISTS idx_spell_criteria_criterion ON spell_criteria(criterion_id);

-- 5. Spell Data Table
CREATE TABLE IF NOT EXISTS spell_data (
    id SERIAL PRIMARY KEY,
    event INTEGER
);

-- Performance indexes for spell_data
CREATE INDEX IF NOT EXISTS idx_spell_data_event ON spell_data (event);

-- 6. Spell Data Spells Junction Table
CREATE TABLE IF NOT EXISTS spell_data_spells (
    spell_data_id INTEGER REFERENCES spell_data(id) ON DELETE CASCADE,
    spell_id INTEGER REFERENCES spells(id) ON DELETE CASCADE,
    
    PRIMARY KEY (spell_data_id, spell_id)
);

-- Performance indexes for spell_data_spells
CREATE INDEX IF NOT EXISTS idx_spell_data_spells_data ON spell_data_spells(spell_data_id);
CREATE INDEX IF NOT EXISTS idx_spell_data_spells_spell ON spell_data_spells(spell_id);

-- ============================================================================
-- Attack/Defense System Tables
-- ============================================================================

-- 7. Attack Defense Table
CREATE TABLE IF NOT EXISTS attack_defense (
    id SERIAL PRIMARY KEY
);

-- 8. Attack Defense Attack Stats Junction Table
CREATE TABLE IF NOT EXISTS attack_defense_attack (
    attack_defense_id INTEGER REFERENCES attack_defense(id) ON DELETE CASCADE,
    stat_value_id INTEGER REFERENCES stat_values(id) ON DELETE CASCADE,
    
    PRIMARY KEY (attack_defense_id, stat_value_id)
);

-- 9. Attack Defense Defense Stats Junction Table
CREATE TABLE IF NOT EXISTS attack_defense_defense (
    attack_defense_id INTEGER REFERENCES attack_defense(id) ON DELETE CASCADE,
    stat_value_id INTEGER REFERENCES stat_values(id) ON DELETE CASCADE,
    
    PRIMARY KEY (attack_defense_id, stat_value_id)
);

-- Performance indexes for attack_defense junction tables
CREATE INDEX IF NOT EXISTS idx_attack_defense_attack_ad ON attack_defense_attack(attack_defense_id);
CREATE INDEX IF NOT EXISTS idx_attack_defense_attack_sv ON attack_defense_attack(stat_value_id);
CREATE INDEX IF NOT EXISTS idx_attack_defense_defense_ad ON attack_defense_defense(attack_defense_id);
CREATE INDEX IF NOT EXISTS idx_attack_defense_defense_sv ON attack_defense_defense(stat_value_id);

-- ============================================================================
-- Item System Support Tables
-- ============================================================================

-- 10. Animation Mesh Table
CREATE TABLE IF NOT EXISTS animation_mesh (
    id SERIAL PRIMARY KEY,
    animation_id INTEGER REFERENCES stat_values(id) ON DELETE CASCADE,
    mesh_id INTEGER REFERENCES stat_values(id) ON DELETE CASCADE
);

-- Performance indexes for animation_mesh
CREATE INDEX IF NOT EXISTS idx_animation_mesh_animation ON animation_mesh(animation_id);
CREATE INDEX IF NOT EXISTS idx_animation_mesh_mesh ON animation_mesh(mesh_id);

-- 11. Shop Hash Table
CREATE TABLE IF NOT EXISTS shop_hash (
    id SERIAL PRIMARY KEY,
    hash VARCHAR(4) NOT NULL,
    min_level INTEGER,
    max_level INTEGER,
    base_amount INTEGER,
    regen_amount INTEGER,
    regen_interval INTEGER,
    spawn_chance INTEGER
);

-- Performance indexes for shop_hash
CREATE INDEX IF NOT EXISTS idx_shop_hash_hash ON shop_hash(hash);
CREATE INDEX IF NOT EXISTS idx_shop_hash_level_range ON shop_hash(min_level, max_level);

-- ============================================================================
-- Main Items Table
-- ============================================================================

-- 12. Items Table (including nanos with is_nano flag)
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    aoid INTEGER,  -- Anarchy Online ID
    name VARCHAR(128) NOT NULL,
    ql INTEGER,  -- Quality Level
    description VARCHAR(8192),
    item_class INTEGER,
    is_nano BOOLEAN DEFAULT FALSE,
    is_perk BOOLEAN DEFAULT FALSE,
    atkdef_id INTEGER REFERENCES attack_defense(id) ON DELETE SET NULL,
    animation_mesh_id INTEGER REFERENCES animation_mesh(id) ON DELETE SET NULL
);

-- Performance indexes for items
CREATE INDEX IF NOT EXISTS idx_items_aoid ON items (aoid);
CREATE INDEX IF NOT EXISTS idx_items_name ON items USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_items_ql ON items (ql);
CREATE INDEX IF NOT EXISTS idx_items_item_class ON items (item_class);
CREATE INDEX IF NOT EXISTS idx_items_is_nano ON items (is_nano);
CREATE INDEX IF NOT EXISTS idx_items_is_perk ON items (is_perk);
CREATE INDEX IF NOT EXISTS idx_items_atkdef ON items (atkdef_id);
CREATE INDEX IF NOT EXISTS idx_items_animation_mesh ON items (animation_mesh_id);

-- ============================================================================
-- Item Relationship Junction Tables
-- ============================================================================

-- 13. Item Stats Junction Table
CREATE TABLE IF NOT EXISTS item_stats (
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    stat_value_id INTEGER REFERENCES stat_values(id) ON DELETE CASCADE,
    
    PRIMARY KEY (item_id, stat_value_id)
);

-- Performance indexes for item_stats
CREATE INDEX IF NOT EXISTS idx_item_stats_item ON item_stats(item_id);
CREATE INDEX IF NOT EXISTS idx_item_stats_stat_value ON item_stats(stat_value_id);

-- 14. Item Spell Data Junction Table
CREATE TABLE IF NOT EXISTS item_spell_data (
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    spell_data_id INTEGER REFERENCES spell_data(id) ON DELETE CASCADE,
    
    PRIMARY KEY (item_id, spell_data_id)
);

-- Performance indexes for item_spell_data
CREATE INDEX IF NOT EXISTS idx_item_spell_data_item ON item_spell_data(item_id);
CREATE INDEX IF NOT EXISTS idx_item_spell_data_spell_data ON item_spell_data(spell_data_id);

-- 15. Item Shop Hash Junction Table
CREATE TABLE IF NOT EXISTS item_shop_hash (
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    shop_hash_id INTEGER REFERENCES shop_hash(id) ON DELETE CASCADE,
    
    PRIMARY KEY (item_id, shop_hash_id)
);

-- Performance indexes for item_shop_hash
CREATE INDEX IF NOT EXISTS idx_item_shop_hash_item ON item_shop_hash(item_id);
CREATE INDEX IF NOT EXISTS idx_item_shop_hash_shop ON item_shop_hash(shop_hash_id);

-- ============================================================================
-- Action System Tables
-- ============================================================================

-- 16. Actions Table
CREATE TABLE IF NOT EXISTS actions (
    id SERIAL PRIMARY KEY,
    action INTEGER,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE
);

-- Performance indexes for actions
CREATE INDEX IF NOT EXISTS idx_actions_action ON actions(action);
CREATE INDEX IF NOT EXISTS idx_actions_item ON actions(item_id);

-- 17. Action Criteria Junction Table
CREATE TABLE IF NOT EXISTS action_criteria (
    id SERIAL PRIMARY KEY,
    action_id INTEGER REFERENCES actions(id) ON DELETE CASCADE,
    criterion_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL
);

-- Performance indexes for action_criteria
CREATE INDEX IF NOT EXISTS idx_action_criteria_action ON action_criteria(action_id);
CREATE INDEX IF NOT EXISTS idx_action_criteria_criterion ON action_criteria(criterion_id);
CREATE INDEX IF NOT EXISTS idx_action_criteria_order ON action_criteria(action_id, order_index);

-- ============================================================================
-- Symbiant and Pocket Boss Tables
-- ============================================================================

-- 18. Symbiants Table
CREATE TABLE IF NOT EXISTS symbiants (
    id SERIAL PRIMARY KEY,
    aoid INTEGER NOT NULL,
    family VARCHAR(32)
);

-- Performance indexes for symbiants
CREATE INDEX IF NOT EXISTS idx_symbiants_aoid ON symbiants (aoid);
CREATE INDEX IF NOT EXISTS idx_symbiants_family ON symbiants (family);

-- 19. Pocket Bosses Table
CREATE TABLE IF NOT EXISTS pocket_bosses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(32) NOT NULL,
    level INTEGER NOT NULL,
    playfield VARCHAR(128),
    location VARCHAR(265),
    mobs VARCHAR(256)
);

-- Performance indexes for pocket_bosses
CREATE INDEX IF NOT EXISTS idx_pocket_bosses_name ON pocket_bosses (name);
CREATE INDEX IF NOT EXISTS idx_pocket_bosses_level ON pocket_bosses (level);
CREATE INDEX IF NOT EXISTS idx_pocket_bosses_playfield ON pocket_bosses (playfield);

-- 20. Pocket Boss Symbiant Drops Junction Table
CREATE TABLE IF NOT EXISTS pocket_boss_symbiant_drops (
    pocket_boss_id INTEGER REFERENCES pocket_bosses(id) ON DELETE CASCADE,
    symbiant_id INTEGER REFERENCES symbiants(id) ON DELETE CASCADE,
    
    PRIMARY KEY (pocket_boss_id, symbiant_id)
);

-- Performance indexes for pocket_boss_symbiant_drops
CREATE INDEX IF NOT EXISTS idx_pb_symbiant_drops_boss ON pocket_boss_symbiant_drops(pocket_boss_id);
CREATE INDEX IF NOT EXISTS idx_pb_symbiant_drops_symbiant ON pocket_boss_symbiant_drops(symbiant_id);

-- ============================================================================
-- Source System Tables
-- ============================================================================

-- 21. Source Types Table
CREATE TABLE IF NOT EXISTS source_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- Performance indexes for source_types
CREATE INDEX IF NOT EXISTS idx_source_types_name ON source_types(name);

-- Insert initial source types
INSERT INTO source_types (name, description) VALUES
    ('item', 'Items that create/upload other items (e.g., nanocrystals)'),
    ('npc', 'NPCs and mobs that drop items'),
    ('boss', 'Boss encounters that drop items'),
    ('mission', 'Missions that reward items'),
    ('vendor', 'Vendors and shops that sell items')
ON CONFLICT (name) DO NOTHING;

-- 22. Sources Table
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    source_type_id INTEGER NOT NULL REFERENCES source_types(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL,  -- References the actual entity (item.id, npc.id, etc.)
    name VARCHAR(255) NOT NULL,  -- Denormalized name for performance
    metadata JSONB DEFAULT '{}',  -- Flexible metadata storage
    
    -- Unique constraint to prevent duplicate sources
    CONSTRAINT unique_source UNIQUE (source_type_id, source_id)
);

-- Performance indexes for sources
CREATE INDEX IF NOT EXISTS idx_sources_type_id ON sources(source_type_id);
CREATE INDEX IF NOT EXISTS idx_sources_source_id ON sources(source_id);
CREATE INDEX IF NOT EXISTS idx_sources_name ON sources(name);
CREATE INDEX IF NOT EXISTS idx_sources_metadata ON sources USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_sources_type_source ON sources(source_type_id, source_id);

-- 23. Item Sources Junction Table
CREATE TABLE IF NOT EXISTS item_sources (
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
CREATE INDEX IF NOT EXISTS idx_item_sources_item ON item_sources(item_id);
CREATE INDEX IF NOT EXISTS idx_item_sources_source ON item_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_item_sources_ql_range ON item_sources(min_ql, max_ql);
CREATE INDEX IF NOT EXISTS idx_item_sources_drop_rate ON item_sources(drop_rate);
CREATE INDEX IF NOT EXISTS idx_item_sources_metadata ON item_sources USING GIN (metadata);

-- ============================================================================
-- Application Cache Table
-- ============================================================================

-- 24. Application Cache Table (only table with timestamps for cache expiration)
CREATE TABLE IF NOT EXISTS application_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_application_cache_expires_at ON application_cache (expires_at);

-- ============================================================================
-- Schema Validation Comments
-- ============================================================================

-- Note: Database-level comments require ownership; skipping COMMENT ON DATABASE
COMMENT ON TABLE stat_values IS 'Reusable stat-value pairs with unique constraints';
COMMENT ON TABLE criteria IS 'Reusable criteria for spells and actions';
COMMENT ON TABLE items IS 'Main items table including nanos (is_nano=true) and perks (is_perk=true)';
COMMENT ON TABLE source_types IS 'Types of sources that can provide items (crystals, NPCs, missions, etc.)';
COMMENT ON TABLE sources IS 'Polymorphic source instances that can provide items';
COMMENT ON TABLE item_sources IS 'Many-to-many relationship between items and their sources with metadata';
COMMENT ON TABLE application_cache IS 'Only table with timestamps for cache expiration';
-- Insert migration record
INSERT INTO schema_migrations (version, name, applied_at) VALUES ('001', 'initial_schema', CURRENT_TIMESTAMP) ON CONFLICT (version) DO NOTHING;
