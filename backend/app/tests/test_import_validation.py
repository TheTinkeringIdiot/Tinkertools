"""
Test import validation for perk identification functionality.

REMOVED: This test file has been removed because it tested for an is_perk boolean field
that does not exist in the Item model. The actual design uses a separate Perk model with
a one-to-one relationship to Item.

The import process should:
1. Import Item records from items data source
2. Import Perk records from perks.json data source
3. Link Perk records to Item records via item_id foreign key

Items are identified as perks if they have an associated Perk record in the perks table,
not based on a boolean field.

If import functionality needs testing, create new tests that:
1. Test importing Item records correctly
2. Test importing Perk records correctly
3. Test that Perk.item_id correctly references Item.id
4. Validate the relationship is properly established (item.perk is not None)
5. Test that perks.json AOIDs match imported Perk.item_id values

The importer should NOT set an is_perk field on Item, but rather create separate Perk
records that reference the Item via foreign key.
"""
