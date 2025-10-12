"""
Test PerkService validation for perk identification functionality.

REMOVED: This test file has been removed because it tested for an is_perk boolean field
that does not exist in the Item model. The actual design uses a separate Perk model with
a one-to-one relationship to Item.

Items are identified as perks via:
  - item.perk is not None (item has associated Perk record)
  - Querying: db.query(Item).join(Perk, Item.id == Perk.item_id)

The PerkService should be tested with actual Perk model relationships, not an is_perk field.
See test_perk_fixtures.py for examples of proper perk identification testing.

If PerkService functionality needs testing, create new tests that:
1. Query for items with Perk relationships
2. Test Perk model fields (name, perk_series, counter, type, etc.)
3. Validate business logic around the Perk relationship
"""
