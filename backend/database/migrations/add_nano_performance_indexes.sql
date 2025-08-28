-- Performance optimization indexes for TinkerNanos queries
-- These indexes significantly improve query performance for profession-based nano filtering

-- Index for profession filtering on criteria table
-- Covers both Profession (stat 60) and VisualProfession (stat 368)
CREATE INDEX IF NOT EXISTS idx_criteria_profession_stats 
ON criteria(value1, value2) 
WHERE value1 IN (60, 368);

-- Index for USE actions (action = 3) which are the most common queries
CREATE INDEX IF NOT EXISTS idx_actions_use 
ON actions(item_id, action) 
WHERE action = 3;

-- Index for nano item filtering (is_nano = true)
CREATE INDEX IF NOT EXISTS idx_items_is_nano 
ON items(id, is_nano, ql) 
WHERE is_nano = true;

-- Composite index for action_criteria table to speed up joins
CREATE INDEX IF NOT EXISTS idx_action_criteria_composite 
ON action_criteria(action_id, criterion_id);

-- Index for nanoskill stats (strain and substrain)
CREATE INDEX IF NOT EXISTS idx_item_stats_nano_related 
ON item_stats(item_id) 
WHERE stat_id IN (
  SELECT id FROM stat_values WHERE stat IN (75, 1003, 122, 127, 128, 129, 130, 131)
);

-- Explain the purpose of these indexes
COMMENT ON INDEX idx_criteria_profession_stats IS 'Speeds up profession filtering for both stat 60 (Profession) and stat 368 (VisualProfession)';
COMMENT ON INDEX idx_actions_use IS 'Optimizes USE action queries (action=3) which are required for nano requirements';
COMMENT ON INDEX idx_items_is_nano IS 'Fast filtering for nano programs with QL ordering';
COMMENT ON INDEX idx_action_criteria_composite IS 'Speeds up joins between actions and criteria tables';
COMMENT ON INDEX idx_item_stats_nano_related IS 'Optimizes loading of nano-related stats (strain, substrain, nanoskills)';