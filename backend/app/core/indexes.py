"""
Database index definitions for performance optimization.
These indexes support the most common query patterns in TinkerTools API.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List
import logging

logger = logging.getLogger(__name__)

# Index definitions for performance optimization
PERFORMANCE_INDEXES = [
    # Items table indexes
    {
        'name': 'idx_items_ql',
        'query': 'CREATE INDEX IF NOT EXISTS idx_items_ql ON items(ql);'
    },
    {
        'name': 'idx_items_item_class',
        'query': 'CREATE INDEX IF NOT EXISTS idx_items_item_class ON items(item_class);'
    },
    {
        'name': 'idx_items_is_nano',
        'query': 'CREATE INDEX IF NOT EXISTS idx_items_is_nano ON items(is_nano);'
    },
    {
        'name': 'idx_items_name_lower',
        'query': 'CREATE INDEX IF NOT EXISTS idx_items_name_lower ON items(LOWER(name));'
    },
    # Composite index for common filter combinations
    {
        'name': 'idx_items_class_ql',
        'query': 'CREATE INDEX IF NOT EXISTS idx_items_class_ql ON items(item_class, ql);'
    },
    {
        'name': 'idx_items_nano_ql',
        'query': 'CREATE INDEX IF NOT EXISTS idx_items_nano_ql ON items(is_nano, ql) WHERE is_nano = true;'
    },
    # Weapon filtering composite indexes (TinkerFite performance)
    {
        'name': 'idx_items_weapon_composite',
        'query': '''CREATE INDEX IF NOT EXISTS idx_items_weapon_composite
                    ON items(item_class, atkdef_id) WHERE atkdef_id IS NOT NULL;'''
    },

    # Full-text search indexes
    {
        'name': 'idx_items_name_fts',
        'query': '''CREATE INDEX IF NOT EXISTS idx_items_name_fts ON items 
                     USING GIN (to_tsvector('english', name));'''
    },
    {
        'name': 'idx_items_name_desc_fts',
        'query': '''CREATE INDEX IF NOT EXISTS idx_items_name_desc_fts ON items 
                     USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));'''
    },
    
    # Item stats indexes for stat-based queries
    {
        'name': 'idx_item_stats_stat_id',
        'query': 'CREATE INDEX IF NOT EXISTS idx_item_stats_stat_id ON item_stats(stat_value_id);'
    },
    {
        'name': 'idx_item_stats_item_id',
        'query': 'CREATE INDEX IF NOT EXISTS idx_item_stats_item_id ON item_stats(item_id);'
    },
    
    # Stat values indexes
    {
        'name': 'idx_stat_values_stat_value',
        'query': 'CREATE INDEX IF NOT EXISTS idx_stat_values_stat_value ON stat_values(stat, value);'
    },
    {
        'name': 'idx_stat_values_stat',
        'query': 'CREATE INDEX IF NOT EXISTS idx_stat_values_stat ON stat_values(stat);'
    },
    {
        'name': 'idx_stat_values_weapon_skills',
        'query': 'CREATE INDEX IF NOT EXISTS idx_stat_values_weapon_skills ON stat_values(stat, value) WHERE value >= 50;'
    },

    # Attack/Defense indexes for weapon filtering
    {
        'name': 'idx_attack_defense_attack_lookup',
        'query': 'CREATE INDEX IF NOT EXISTS idx_attack_defense_attack_lookup ON attack_defense_attack(attack_defense_id, stat_value_id);'
    },
    {
        'name': 'idx_attack_defense_defense_lookup',
        'query': 'CREATE INDEX IF NOT EXISTS idx_attack_defense_defense_lookup ON attack_defense_defense(attack_defense_id, stat_value_id);'
    },
    
    # Spells indexes
    {
        'name': 'idx_spells_target',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spells_target ON spells(target);'
    },
    {
        'name': 'idx_spells_spell_format',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spells_spell_format ON spells(spell_format);'
    },
    {
        'name': 'idx_spells_spell_id',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spells_spell_id ON spells(spell_id);',
        'description': 'Index for spell_id lookups (e.g., Modify Stat spell 53045)'
    },
    {
        'name': 'idx_spells_modify_stat_param',
        'query': '''CREATE INDEX IF NOT EXISTS idx_spells_modify_stat_param
                    ON spells(((spell_params->>'Stat')::integer))
                    WHERE spell_id = 53045;''',
        'description': 'Functional index for Modify Stat spell parameter lookups (implant clusters)'
    },
    
    # Spell data junction table indexes
    {
        'name': 'idx_item_spell_data_item',
        'query': 'CREATE INDEX IF NOT EXISTS idx_item_spell_data_item ON item_spell_data(item_id);',
        'description': 'Index for item to spell data joins'
    },
    {
        'name': 'idx_item_spell_data_spell',
        'query': 'CREATE INDEX IF NOT EXISTS idx_item_spell_data_spell ON item_spell_data(spell_data_id);',
        'description': 'Index for spell data to item joins'
    },
    {
        'name': 'idx_spell_data_spells_data',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spell_data_spells_data ON spell_data_spells(spell_data_id);',
        'description': 'Index for spell data to spells joins'
    },
    {
        'name': 'idx_spell_data_spells_spell',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spell_data_spells_spell ON spell_data_spells(spell_id);',
        'description': 'Index for spells to spell data joins'
    },

    # Spell criteria indexes
    {
        'name': 'idx_spell_criteria_spell_id',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spell_criteria_spell_id ON spell_criteria(spell_id);'
    },
    {
        'name': 'idx_spell_criteria_criterion_id',
        'query': 'CREATE INDEX IF NOT EXISTS idx_spell_criteria_criterion_id ON spell_criteria(criterion_id);'
    },

    # Action criteria indexes for weapon filtering
    {
        'name': 'idx_action_criteria_composite',
        'query': 'CREATE INDEX IF NOT EXISTS idx_action_criteria_composite ON action_criteria(action_id, criterion_id);'
    },
    {
        'name': 'idx_actions_item_action',
        'query': 'CREATE INDEX IF NOT EXISTS idx_actions_item_action ON actions(item_id, action);'
    },

    # Phase 2: Strategic performance indexes for weapon filtering and criteria lookups
    # Partial index for criteria value1 lookups (used in weapon filtering)
    {
        'name': 'idx_criteria_value1_common_stats',
        'query': '''CREATE INDEX IF NOT EXISTS idx_criteria_value1_common_stats
                    ON criteria(value1)
                    WHERE value1 IN (4, 33, 60, 368, 455);''',
        'description': 'Partial index for common stat criteria (breed, faction, profession, NPC)'
    },
    # Covering index for Action + ActionCriteria join
    {
        'name': 'idx_action_criteria_covering',
        'query': '''CREATE INDEX IF NOT EXISTS idx_action_criteria_covering
                    ON action_criteria(action_id, criterion_id)
                    INCLUDE (order_index);''',
        'description': 'Covering index for action criteria lookups'
    },
    # Partial index for weapon items only
    {
        'name': 'idx_items_weapons_only',
        'query': '''CREATE INDEX IF NOT EXISTS idx_items_weapons_only
                    ON items(id, atkdef_id)
                    WHERE item_class = 1 AND atkdef_id IS NOT NULL;''',
        'description': 'Partial index for weapon-class items with attack/defense data'
    },
    # Composite index for item_stats faction filtering
    {
        'name': 'idx_item_stats_faction_lookup',
        'query': '''CREATE INDEX IF NOT EXISTS idx_item_stats_faction_lookup
                    ON item_stats(item_id, stat_value_id);''',
        'description': 'Composite index for item stats lookups'
    }
]


def create_performance_indexes(db: Session) -> List[str]:
    """
    Create all performance indexes for optimizing TinkerTools API queries.
    Each index is created in its own transaction to avoid rollback issues.

    Returns:
        List of successfully created index names
    """
    created_indexes = []

    for index_def in PERFORMANCE_INDEXES:
        try:
            logger.info(f"Creating index: {index_def['name']}")
            db.execute(text(index_def['query']))
            db.commit()  # Commit each index separately
            created_indexes.append(index_def['name'])
            logger.info(f"Successfully created index: {index_def['name']}")
        except Exception as e:
            logger.warning(f"Failed to create index {index_def['name']}: {e}")
            db.rollback()  # Rollback only this failed index
            continue

    logger.info(f"Successfully created {len(created_indexes)} performance indexes")
    return created_indexes


def check_index_usage(db: Session) -> dict:
    """
    Check index usage statistics for monitoring performance.
    
    Returns:
        Dictionary with index usage statistics
    """
    try:
        # Query to get index usage statistics from PostgreSQL
        query = text("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                idx_scan as times_used,
                idx_tup_read as tuples_read,
                idx_tup_fetch as tuples_fetched
            FROM pg_stat_user_indexes 
            WHERE schemaname = 'public'
            ORDER BY idx_scan DESC;
        """)
        
        result = db.execute(query)
        indexes = []
        
        for row in result:
            indexes.append({
                'schema': row.schemaname,
                'table': row.tablename,
                'index': row.indexname,
                'times_used': row.times_used,
                'tuples_read': row.tuples_read,
                'tuples_fetched': row.tuples_fetched
            })
        
        return {
            'total_indexes': len(indexes),
            'indexes': indexes
        }
        
    except Exception as e:
        logger.error(f"Failed to get index usage statistics: {e}")
        return {'error': str(e)}


def analyze_slow_queries(db: Session, min_duration_ms: int = 500) -> dict:
    """
    Analyze slow queries using PostgreSQL's pg_stat_statements extension.
    
    Args:
        min_duration_ms: Minimum query duration in milliseconds to include
    
    Returns:
        Dictionary with slow query statistics
    """
    try:
        # Check if pg_stat_statements extension is available
        check_ext_query = text("""
            SELECT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
            );
        """)
        
        result = db.execute(check_ext_query)
        ext_exists = result.scalar()
        
        if not ext_exists:
            return {
                'error': 'pg_stat_statements extension not available',
                'suggestion': 'Enable pg_stat_statements extension for query analysis'
            }
        
        # Get slow queries
        slow_query = text(f"""
            SELECT 
                query,
                calls,
                total_time,
                mean_time,
                rows,
                100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
            FROM pg_stat_statements 
            WHERE mean_time > {min_duration_ms}
            ORDER BY mean_time DESC 
            LIMIT 10;
        """)
        
        result = db.execute(slow_query)
        slow_queries = []
        
        for row in result:
            slow_queries.append({
                'query': row.query[:200] + ('...' if len(row.query) > 200 else ''),
                'calls': row.calls,
                'total_time_ms': round(row.total_time, 2),
                'mean_time_ms': round(row.mean_time, 2),
                'rows': row.rows,
                'hit_percent': round(row.hit_percent or 0, 2)
            })
        
        return {
            'min_duration_ms': min_duration_ms,
            'slow_queries': slow_queries
        }
        
    except Exception as e:
        logger.error(f"Failed to analyze slow queries: {e}")
        return {'error': str(e)}