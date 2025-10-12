"""
Test fixtures for import functionality testing.

REMOVED: This fixture file has been removed because it provided fixtures for testing
an is_perk boolean field that does not exist in the Item model.

The actual design uses a separate Perk model with a one-to-one relationship to Item.

If import testing fixtures are needed, create new fixtures that:
1. Provide sample Item data (without is_perk field)
2. Provide sample Perk data matching perks.json structure
3. Provide expected Perk-to-Item relationship mappings
4. Test that Perk records correctly reference Item records via item_id

Example structure for new fixtures:
- sample_items_data: List of item dictionaries (aoid, name, ql, etc.)
- sample_perks_data: Matching perks.json format with aoid, name, counter, type, etc.
- expected_perk_items: Set of AOIDs that should have associated Perk records

See test_perk_fixtures.py for examples of proper Perk model fixture creation.
"""
