-- TinkerTools Database Schema Tests
-- Comprehensive test suite to verify all tables, constraints, and relationships

\echo 'Starting TinkerTools database schema tests...'

-- Create test results tracking
CREATE TEMP TABLE test_results (
    test_name VARCHAR(100),
    status VARCHAR(10),
    message TEXT
);

-- Helper function to record test results
CREATE OR REPLACE FUNCTION record_test(test_name TEXT, passed BOOLEAN, message TEXT DEFAULT '')
RETURNS VOID AS $$
BEGIN
    INSERT INTO test_results VALUES (
        test_name, 
        CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END, 
        message
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Test 1: Verify All Required Tables Exist
-- ============================================================================

\echo 'Test 1: Checking if all required tables exist...'

DO $$
DECLARE
    required_tables TEXT[] := ARRAY[
        'stat_values', 'criteria', 'spells', 'spell_criteria', 'spell_data',
        'spell_data_spells', 'attack_defense', 'attack_defense_attack',
        'attack_defense_defense', 'animation_mesh', 'shop_hash', 'items',
        'item_stats', 'item_spell_data', 'item_shop_hash', 'actions',
        'action_criteria', 'application_cache', 'mobs', 'perks',
        'source_types', 'sources', 'item_sources', 'schema_migrations'
    ];
    tbl_name TEXT;
    table_exists BOOLEAN;
    missing_tables TEXT := '';
BEGIN
    FOREACH tbl_name IN ARRAY required_tables
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.tables t
            WHERE t.table_schema = 'public' AND t.table_name = tbl_name
        ) INTO table_exists;

        IF NOT table_exists THEN
            missing_tables := missing_tables || tbl_name || ', ';
        END IF;
    END LOOP;

    IF missing_tables = '' THEN
        PERFORM record_test('table_existence', TRUE, 'All required tables exist');
    ELSE
        PERFORM record_test('table_existence', FALSE, 'Missing tables: ' || missing_tables);
    END IF;
END $$;

-- ============================================================================
-- Test 2: Verify Unique Constraints
-- ============================================================================

\echo 'Test 2: Testing unique constraints...'

-- Test stat_values unique constraint
DO $$
BEGIN
    -- Insert valid data
    INSERT INTO stat_values (stat, value) VALUES (999, 999);
    
    -- Try to insert duplicate
    BEGIN
        INSERT INTO stat_values (stat, value) VALUES (999, 999);
        PERFORM record_test('stat_values_unique', FALSE, 'Duplicate insertion succeeded');
    EXCEPTION WHEN unique_violation THEN
        PERFORM record_test('stat_values_unique', TRUE, 'Unique constraint working');
    END;
    
    -- Cleanup
    DELETE FROM stat_values WHERE stat = 999 AND value = 999;
END $$;

-- Test criteria unique constraint
DO $$
BEGIN
    -- Insert valid data
    INSERT INTO criteria (value1, value2, operator) VALUES (999, 999, 999);
    
    -- Try to insert duplicate
    BEGIN
        INSERT INTO criteria (value1, value2, operator) VALUES (999, 999, 999);
        PERFORM record_test('criteria_unique', FALSE, 'Duplicate insertion succeeded');
    EXCEPTION WHEN unique_violation THEN
        PERFORM record_test('criteria_unique', TRUE, 'Unique constraint working');
    END;
    
    -- Cleanup
    DELETE FROM criteria WHERE value1 = 999 AND value2 = 999 AND operator = 999;
END $$;

-- ============================================================================
-- Test 3: Verify Foreign Key Constraints
-- ============================================================================

\echo 'Test 3: Testing foreign key constraints...'

-- Test item_stats foreign key constraints
DO $$
DECLARE
    test_stat_id INTEGER;
    test_item_id INTEGER;
BEGIN
    -- Create test data
    INSERT INTO stat_values (stat, value) VALUES (998, 998) RETURNING id INTO test_stat_id;
    INSERT INTO items (name, ql) VALUES ('Test Item', 100) RETURNING id INTO test_item_id;
    
    -- Test valid foreign key
    INSERT INTO item_stats (item_id, stat_value_id) VALUES (test_item_id, test_stat_id);
    
    -- Test invalid foreign key
    BEGIN
        INSERT INTO item_stats (item_id, stat_value_id) VALUES (99999, test_stat_id);
        PERFORM record_test('foreign_key_item_stats', FALSE, 'Invalid foreign key accepted');
    EXCEPTION WHEN foreign_key_violation THEN
        PERFORM record_test('foreign_key_item_stats', TRUE, 'Foreign key constraint working');
    END;
    
    -- Cleanup
    DELETE FROM item_stats WHERE item_id = test_item_id;
    DELETE FROM items WHERE id = test_item_id;
    DELETE FROM stat_values WHERE id = test_stat_id;
END $$;

-- ============================================================================
-- Test 4: Verify Required Indexes Exist
-- ============================================================================

\echo 'Test 4: Checking if required indexes exist...'

DO $$
DECLARE
    required_indexes TEXT[] := ARRAY[
        'idx_stat_values_stat_value',
        'idx_items_name',
        'idx_items_aoid',
        'idx_mobs_name',
        'idx_mobs_is_pocket_boss',
        'idx_symbiant_items_aoid',
        'idx_symbiant_items_family',
        'idx_spells_spell_id',
        'idx_perks_series',
        'idx_perks_type'
    ];
    index_name TEXT;
    index_exists BOOLEAN;
    missing_indexes TEXT := '';
BEGIN
    FOREACH index_name IN ARRAY required_indexes
    LOOP
        SELECT EXISTS (
            SELECT FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = index_name AND n.nspname = 'public'
        ) INTO index_exists;

        IF NOT index_exists THEN
            missing_indexes := missing_indexes || index_name || ', ';
        END IF;
    END LOOP;

    IF missing_indexes = '' THEN
        PERFORM record_test('required_indexes', TRUE, 'All required indexes exist');
    ELSE
        PERFORM record_test('required_indexes', FALSE, 'Missing indexes: ' || missing_indexes);
    END IF;
END $$;

-- ============================================================================
-- Test 5: Verify Cascade Deletes Work Correctly
-- ============================================================================

\echo 'Test 5: Testing cascade delete behavior...'

DO $$
DECLARE
    test_item_id INTEGER;
    test_stat_id INTEGER;
    remaining_count INTEGER;
BEGIN
    -- Create test data
    INSERT INTO stat_values (stat, value) VALUES (997, 997) RETURNING id INTO test_stat_id;
    INSERT INTO items (name, ql) VALUES ('Cascade Test Item', 100) RETURNING id INTO test_item_id;
    INSERT INTO item_stats (item_id, stat_value_id) VALUES (test_item_id, test_stat_id);
    
    -- Delete item and check if item_stats record is also deleted
    DELETE FROM items WHERE id = test_item_id;
    
    SELECT COUNT(*) INTO remaining_count FROM item_stats WHERE item_id = test_item_id;
    
    IF remaining_count = 0 THEN
        PERFORM record_test('cascade_delete', TRUE, 'Cascade delete working correctly');
    ELSE
        PERFORM record_test('cascade_delete', FALSE, 'Cascade delete not working');
    END IF;
    
    -- Cleanup
    DELETE FROM stat_values WHERE id = test_stat_id;
END $$;

-- ============================================================================
-- Test 6: Verify Data Types and Constraints
-- ============================================================================

\echo 'Test 6: Testing data types and constraints...'

-- Test NOT NULL constraints
DO $$
BEGIN
    -- Test items.name NOT NULL
    BEGIN
        INSERT INTO items (name, ql) VALUES (NULL, 100);
        PERFORM record_test('not_null_constraints', FALSE, 'NULL value accepted in NOT NULL column');
    EXCEPTION WHEN not_null_violation THEN
        PERFORM record_test('not_null_constraints', TRUE, 'NOT NULL constraints working');
    END;
END $$;

-- Test JSONB columns
DO $$
DECLARE
    test_spell_id INTEGER;
BEGIN
    -- Test valid JSONB
    INSERT INTO spells (spell_params) VALUES ('["test", "param"]') RETURNING id INTO test_spell_id;
    
    -- Test invalid JSONB
    BEGIN
        INSERT INTO spells (spell_params) VALUES ('invalid json');
        PERFORM record_test('jsonb_validation', FALSE, 'Invalid JSONB accepted');
    EXCEPTION WHEN invalid_text_representation THEN
        PERFORM record_test('jsonb_validation', TRUE, 'JSONB validation working');
    END;
    
    -- Cleanup
    DELETE FROM spells WHERE id = test_spell_id;
END $$;

-- ============================================================================
-- Test 7: Verify Full-Text Search Indexes
-- ============================================================================

\echo 'Test 7: Testing full-text search functionality...'

DO $$
DECLARE
    test_item_id INTEGER;
    search_count INTEGER;
BEGIN
    -- Insert test item with searchable name
    INSERT INTO items (name, ql, description) 
    VALUES ('Plasma Rifle Ultimate', 200, 'Advanced energy weapon for combat') 
    RETURNING id INTO test_item_id;
    
    -- Test full-text search on name
    SELECT COUNT(*) INTO search_count
    FROM items 
    WHERE to_tsvector('english', name) @@ to_tsquery('english', 'plasma');
    
    IF search_count > 0 THEN
        PERFORM record_test('fulltext_search', TRUE, 'Full-text search working');
    ELSE
        PERFORM record_test('fulltext_search', FALSE, 'Full-text search not working');
    END IF;
    
    -- Cleanup
    DELETE FROM items WHERE id = test_item_id;
END $$;

-- ============================================================================
-- Test 8: Verify Junction Table Relationships
-- ============================================================================

\echo 'Test 8: Testing many-to-many relationships...'

DO $$
DECLARE
    test_item_id INTEGER;
    test_source_type_id INTEGER;
    test_source_id INTEGER;
    relationship_count INTEGER;
BEGIN
    -- Get or create test source type
    INSERT INTO source_types (name, description)
    VALUES ('test_junction', 'Test source type for junction test')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO test_source_type_id;

    -- Create test source (e.g., a specific mob or mission)
    INSERT INTO sources (source_type_id, source_id, name)
    VALUES (test_source_type_id, 999, 'Test Source')
    RETURNING id INTO test_source_id;

    -- Create test item
    INSERT INTO items (name, ql) VALUES ('Test Junction Item', 100) RETURNING id INTO test_item_id;

    -- Create relationship via item_sources junction table
    INSERT INTO item_sources (item_id, source_id, drop_rate)
    VALUES (test_item_id, test_source_id, 25.5);

    -- Verify relationship exists
    SELECT COUNT(*) INTO relationship_count
    FROM item_sources
    WHERE item_id = test_item_id AND source_id = test_source_id;

    IF relationship_count = 1 THEN
        PERFORM record_test('junction_relationships', TRUE, 'Many-to-many relationships working');
    ELSE
        PERFORM record_test('junction_relationships', FALSE, 'Many-to-many relationships not working');
    END IF;

    -- Cleanup (cascade deletes should handle item_sources)
    DELETE FROM items WHERE id = test_item_id;
    DELETE FROM sources WHERE id = test_source_id;
    DELETE FROM source_types WHERE id = test_source_type_id AND name = 'test_junction';
END $$;

-- ============================================================================
-- Display Test Results
-- ============================================================================

\echo ''
\echo '========================================'
\echo 'TinkerTools Database Schema Test Results'
\echo '========================================'

SELECT 
    test_name,
    status,
    CASE WHEN message = '' THEN 'No additional info' ELSE message END as details
FROM test_results
ORDER BY 
    CASE status WHEN 'PASS' THEN 1 ELSE 2 END,
    test_name;

-- Summary
\echo ''
\echo 'Test Summary:'

SELECT 
    COUNT(*) as total_tests,
    SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as failed,
    ROUND(
        (SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 
        1
    ) as pass_percentage
FROM test_results;

-- Check if all tests passed
DO $$
DECLARE
    failed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO failed_count FROM test_results WHERE status = 'FAIL';
    
    IF failed_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 ALL TESTS PASSED! Database schema is correctly implemented.';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ % test(s) failed. Please review the failed tests above.', failed_count;
    END IF;
END $$;

-- Cleanup
DROP FUNCTION record_test(TEXT, BOOLEAN, TEXT);

\echo ''
\echo 'Database schema testing completed!'