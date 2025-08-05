-- TinkerTools Sample Data Seeding Script
-- Imports data from sample files and creates test data for development

\echo 'Starting sample data import...'

-- ============================================================================
-- Sample StatValues (Common game stats)
-- ============================================================================

\echo 'Inserting sample stat values...'

INSERT INTO stat_values (stat, value) VALUES
-- Basic character stats
(16, 100),   -- Strength 100
(17, 100),   -- Stamina 100
(18, 100),   -- Agility 100
(19, 100),   -- Sense 100
(20, 100),   -- Intelligence 100
(21, 100),   -- Psychic 100
-- Combat stats
(51, 500),   -- Attack Rating 500
(52, 300),   -- Defense Rating 300
(53, 1000),  -- Health 1000
(54, 500),   -- Nano Pool 500
-- Skill stats
(112, 200),  -- 1H Blunt 200
(113, 200),  -- 1H Edged 200
(114, 200),  -- 2H Blunt 200
(115, 200),  -- 2H Edged 200
(116, 200),  -- Ranged 200
(127, 300),  -- Material Creation 300
(128, 300),  -- Material Location 300
(142, 400),  -- Nano Program 400
-- Resistance stats
(214, 50),   -- Fire Resist 50
(215, 50),   -- Cold Resist 50
(216, 50),   -- Energy Resist 50
(217, 50),   -- Chemical Resist 50
-- Quality levels
(1, 1), (1, 50), (1, 100), (1, 150), (1, 200), (1, 250), (1, 300)
ON CONFLICT (stat, value) DO NOTHING;

\echo 'Stat values inserted successfully.'

-- ============================================================================
-- Sample Criteria (Common spell/action requirements)
-- ============================================================================

\echo 'Inserting sample criteria...'

INSERT INTO criteria (value1, value2, operator) VALUES
-- Skill requirements (operator 1 = >=)
(112, 200, 1),  -- 1H Blunt >= 200
(113, 200, 1),  -- 1H Edged >= 200
(127, 300, 1),  -- Material Creation >= 300
(142, 400, 1),  -- Nano Program >= 400
-- Level requirements
(54, 100, 1),   -- Level >= 100
(54, 150, 1),   -- Level >= 150
(54, 200, 1),   -- Level >= 200
-- Stat requirements
(16, 500, 1),   -- Strength >= 500
(20, 400, 1),   -- Intelligence >= 400
(21, 300, 1)    -- Psychic >= 300
ON CONFLICT (value1, value2, operator) DO NOTHING;

\echo 'Criteria inserted successfully.'

-- ============================================================================
-- Sample Spells (Nano effects and abilities)
-- ============================================================================

\echo 'Inserting sample spells...'

INSERT INTO spells (target, tick_count, tick_interval, spell_id, spell_format, spell_params) VALUES
-- Healing spells
(1, 1, 0, 1001, 'Heal {0} health', '["target"]'),
(1, 10, 1000, 1002, 'Heal {0} health over time', '["target"]'),
-- Damage spells
(2, 1, 0, 2001, 'Deal {0} damage', '["target"]'),
(2, 1, 0, 2002, 'Deal {0} energy damage', '["target"]'),
-- Buff spells
(1, 1800, 0, 3001, 'Increase {0} by {1}', '["skill", "amount"]'),
(1, 3600, 0, 3002, 'Increase all stats by {0}', '["amount"]'),
-- Debuff spells
(2, 600, 0, 4001, 'Decrease {0} by {1}', '["skill", "amount"]'),
(2, 300, 0, 4002, 'Root target for {0} seconds', '["duration"]');

\echo 'Spells inserted successfully.'

-- ============================================================================
-- Sample Attack/Defense Data
-- ============================================================================

\echo 'Inserting sample attack/defense data...'

-- Create attack/defense combinations
INSERT INTO attack_defense DEFAULT VALUES; -- ID 1
INSERT INTO attack_defense DEFAULT VALUES; -- ID 2
INSERT INTO attack_defense DEFAULT VALUES; -- ID 3

-- Link attack stats (using stat_values that exist)
INSERT INTO attack_defense_attack (attack_defense_id, stat_value_id) 
SELECT 1, id FROM stat_values WHERE stat = 51 AND value = 500; -- Attack Rating 500

INSERT INTO attack_defense_attack (attack_defense_id, stat_value_id) 
SELECT 2, id FROM stat_values WHERE stat = 112 AND value = 200; -- 1H Blunt 200

-- Link defense stats
INSERT INTO attack_defense_defense (attack_defense_id, stat_value_id) 
SELECT 1, id FROM stat_values WHERE stat = 52 AND value = 300; -- Defense Rating 300

\echo 'Attack/defense data inserted successfully.'

-- ============================================================================
-- Sample Items (Including some nanos)
-- ============================================================================

\echo 'Inserting sample items...'

INSERT INTO items (aoid, name, ql, description, item_class, is_nano, atkdef_id) VALUES
-- Weapons
(12345, 'Plasma Rifle', 200, 'High-tech energy weapon with devastating firepower', 4, FALSE, 1),
(12346, 'Molecular Sword', 180, 'Monofilament blade that cuts through armor', 3, FALSE, 2),
(12347, 'Quantum Pistol', 150, 'Compact sidearm for close encounters', 5, FALSE, 3),
-- Armor
(23456, 'Nano-Enhanced Suit', 220, 'Advanced armor with integrated nano-tech', 1, FALSE, NULL),
(23457, 'Combat Helmet', 180, 'Protective headgear with HUD display', 2, FALSE, NULL),
-- Nanos (is_nano = TRUE)
(34567, 'Complete Heal', 100, 'Instantly restores full health', 0, TRUE, NULL),
(34568, 'Combat Stim', 150, 'Temporary combat enhancement', 0, TRUE, NULL),
(34569, 'Energy Shield', 200, 'Protective barrier against damage', 0, TRUE, NULL),
-- Implants
(45678, 'Strength Booster', 180, 'Cybernetic enhancement for physical power', 6, FALSE, NULL),
(45679, 'Neural Interface', 200, 'Direct brain-computer connection', 6, FALSE, NULL);

\echo 'Items inserted successfully.'

-- ============================================================================
-- Sample Symbiants and Pocket Bosses
-- ============================================================================

\echo 'Inserting sample symbiants...'

INSERT INTO symbiants (aoid, family) VALUES
(56789, 'Aggressive'),
(56790, 'Defensive'),
(56791, 'Supportive'),
(56792, 'Sneaky'),
(56793, 'Artillery');

\echo 'Inserting sample pocket bosses...'

INSERT INTO pocket_bosses (name, level, playfield, location, mobs) VALUES
('Biomech Guardian', 150, 'Nascence', 'Central Complex', 'Biomechs, Security Bots'),
('Void Crawler', 180, 'Shadowlands', 'Dark Tunnels', 'Void Spawns, Shadow Beasts'),
('Crystal Entity', 200, 'Alien Ship', 'Power Core', 'Crystal Fragments, Energy Wisps'),
('Rogue AI Core', 220, 'Subway', 'Control Room', 'Security Drones, Hacked Bots'),
('Ancient Warden', 250, 'Temple', 'Inner Sanctum', 'Stone Golems, Spirit Guards');

\echo 'Pocket bosses inserted successfully.'

-- ============================================================================
-- Link Sample Data (Relationships)
-- ============================================================================

\echo 'Creating sample data relationships...'

-- Link items to stats
INSERT INTO item_stats (item_id, stat_value_id)
SELECT i.id, sv.id 
FROM items i, stat_values sv 
WHERE i.name = 'Plasma Rifle' AND sv.stat = 51 AND sv.value = 500; -- Attack Rating

INSERT INTO item_stats (item_id, stat_value_id)
SELECT i.id, sv.id 
FROM items i, stat_values sv 
WHERE i.name = 'Strength Booster' AND sv.stat = 16 AND sv.value = 100; -- Strength

-- Link spell criteria
INSERT INTO spell_criteria (spell_id, criterion_id)
SELECT s.id, c.id 
FROM spells s, criteria c 
WHERE s.spell_id = 3001 AND c.value1 = 142 AND c.value2 = 400; -- Buff requires Nano Program 400

-- Link pocket boss drops
INSERT INTO pocket_boss_symbiant_drops (pocket_boss_id, symbiant_id)
SELECT pb.id, s.id 
FROM pocket_bosses pb, symbiants s 
WHERE pb.name = 'Biomech Guardian' AND s.family = 'Aggressive';

INSERT INTO pocket_boss_symbiant_drops (pocket_boss_id, symbiant_id)
SELECT pb.id, s.id 
FROM pocket_bosses pb, symbiants s 
WHERE pb.name = 'Void Crawler' AND s.family = 'Sneaky';

\echo 'Sample data relationships created successfully.'

-- ============================================================================
-- Data Validation
-- ============================================================================

\echo 'Validating sample data...'

DO $$
DECLARE
    item_count INTEGER;
    stat_count INTEGER;
    spell_count INTEGER;
    symbiant_count INTEGER;
    boss_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO item_count FROM items;
    SELECT COUNT(*) INTO stat_count FROM stat_values;
    SELECT COUNT(*) INTO spell_count FROM spells;
    SELECT COUNT(*) INTO symbiant_count FROM symbiants;
    SELECT COUNT(*) INTO boss_count FROM pocket_bosses;
    
    RAISE NOTICE 'Sample data summary:';
    RAISE NOTICE '  Items: %', item_count;
    RAISE NOTICE '  Stat Values: %', stat_count;
    RAISE NOTICE '  Spells: %', spell_count;
    RAISE NOTICE '  Symbiants: %', symbiant_count;
    RAISE NOTICE '  Pocket Bosses: %', boss_count;
    
    IF item_count < 5 OR stat_count < 10 OR spell_count < 5 THEN
        RAISE EXCEPTION 'Sample data validation failed - insufficient records';
    END IF;
    
    RAISE NOTICE 'Sample data validation passed!';
END $$;

\echo 'Sample data import completed successfully!'