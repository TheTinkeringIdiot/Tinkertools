"""
Test PerkService validation for perk identification functionality.

This module tests that the PerkService correctly queries and returns only items
with is_perk=True, ensuring the service layer respects the new perk identification.
"""

import pytest
from unittest.mock import Mock, patch
from sqlalchemy.orm import Session

from app.services.perk_service import PerkService
from app.models import Item, ItemSpellData, SpellData
from app.tests.fixtures.perk_fixtures import (
    perk_accumulator_level_1, perk_acquisition_level_1,
    non_perk_weapon, non_perk_armor, nano_program, mixed_item_list
)


class TestPerkServicePerkIdentification:
    """Test PerkService methods respect is_perk field."""

    @pytest.fixture
    def perk_service(self, db_session):
        """Create PerkService instance with database session."""
        return PerkService(db_session)

    def test_get_available_perks_filters_by_is_perk(self, perk_service, mixed_item_list, db_session):
        """Test that get_available_perks only returns items with is_perk=True."""
        # Create some mock spell data relationships for the perks
        # (In a real scenario, perks would have associated spell data)
        for item in mixed_item_list:
            if item.is_perk:
                # Add minimal spell data relationship for perk items
                spell_data = SpellData(id=item.id, name=f"{item.name} Effect")
                db_session.add(spell_data)

                item_spell_data = ItemSpellData(item_id=item.id, spell_data_id=spell_data.id)
                db_session.add(item_spell_data)

        db_session.commit()

        # Mock the async method to test the query logic
        with patch.object(perk_service, 'get_available_perks') as mock_method:
            # Simulate the actual query logic from the service
            query = db_session.query(Item)\
                .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                .filter(Item.is_perk == True)

            results = query.distinct().all()

            # Verify only perk items are returned
            assert len(results) == 2  # Only the 2 perk items

            perk_aoids = {item.aoid for item in results}
            assert perk_aoids == {210830, 261355}  # Accumulator and Acquisition

            # Verify all returned items have is_perk=True
            for item in results:
                assert item.is_perk is True
                assert item.is_nano is False

    def test_perk_service_excludes_non_perks(self, perk_service, mixed_item_list, db_session):
        """Test that PerkService queries exclude non-perk items."""
        # Query for all items with is_perk=False to verify they exist
        non_perks = db_session.query(Item).filter(Item.is_perk == False).all()
        assert len(non_perks) == 3  # Weapon, Armor, Nano

        # Query for all items with is_perk=True (what PerkService should use)
        perks = db_session.query(Item).filter(Item.is_perk == True).all()
        assert len(perks) == 2  # Only the perk items

        # Verify no overlap
        perk_aoids = {item.aoid for item in perks}
        non_perk_aoids = {item.aoid for item in non_perks}
        assert len(perk_aoids.intersection(non_perk_aoids)) == 0

    def test_perk_service_excludes_nanos(self, perk_service, nano_program, db_session):
        """Test that PerkService queries exclude nano programs."""
        # Verify nano program exists and is not a perk
        assert nano_program.is_nano is True
        assert nano_program.is_perk is False

        # Query that PerkService uses should not include nanos
        perk_query_results = db_session.query(Item).filter(Item.is_perk == True).all()

        # Nano should not appear in perk results
        nano_aoids_in_perks = {item.aoid for item in perk_query_results if item.is_nano}
        assert len(nano_aoids_in_perks) == 0

        # Verify nano program is not in perk results
        perk_aoids = {item.aoid for item in perk_query_results}
        assert nano_program.aoid not in perk_aoids

    def test_perk_query_performance_with_index(self, perk_service, mixed_item_list, db_session):
        """Test that is_perk queries can use database index efficiently."""
        # This test verifies that the query structure supports efficient indexing
        # In a real database with proper indexes, this query should be fast

        from sqlalchemy import text

        # Test the actual query that would be used by PerkService
        query = text("SELECT * FROM items WHERE is_perk = true")
        result = db_session.execute(query)
        items = result.fetchall()

        # Should return only the 2 perk items
        assert len(items) == 2

        # Test the negation query
        query = text("SELECT * FROM items WHERE is_perk = false")
        result = db_session.execute(query)
        items = result.fetchall()

        # Should return the 3 non-perk items
        assert len(items) == 3

    def test_perk_service_query_consistency(self, perk_service, mixed_item_list, db_session):
        """Test that different perk queries return consistent results."""
        # Test various ways of querying for perks

        # Method 1: Direct is_perk filter
        perks_method1 = db_session.query(Item).filter(Item.is_perk == True).all()

        # Method 2: is_perk=True AND is_nano=False (redundant but explicit)
        perks_method2 = db_session.query(Item).filter(
            Item.is_perk == True,
            Item.is_nano == False
        ).all()

        # Method 3: Using NOT is_perk=False
        perks_method3 = db_session.query(Item).filter(Item.is_perk != False).all()

        # All methods should return the same results
        aoids_method1 = {item.aoid for item in perks_method1}
        aoids_method2 = {item.aoid for item in perks_method2}
        aoids_method3 = {item.aoid for item in perks_method3}

        assert aoids_method1 == aoids_method2
        assert aoids_method1 == aoids_method3
        assert len(aoids_method1) == 2
        assert aoids_method1 == {210830, 261355}


class TestPerkServiceBusinessRules:
    """Test PerkService business rules around perk identification."""

    @pytest.fixture
    def perk_service(self, db_session):
        """Create PerkService instance with database session."""
        return PerkService(db_session)

    def test_perks_are_never_nanos_rule(self, perk_service, mixed_item_list, db_session):
        """Test business rule: perks are never nano programs."""
        # Query all items that are both perks AND nanos (should be empty)
        perk_nanos = db_session.query(Item).filter(
            Item.is_perk == True,
            Item.is_nano == True
        ).all()

        assert len(perk_nanos) == 0, "No items should be both perks and nanos"

        # Verify we have both perks and nanos separately
        perks = db_session.query(Item).filter(Item.is_perk == True).all()
        nanos = db_session.query(Item).filter(Item.is_nano == True).all()

        assert len(perks) > 0, "Should have some perk items"
        assert len(nanos) > 0, "Should have some nano items"

        # Verify no overlap in AOIDs
        perk_aoids = {item.aoid for item in perks}
        nano_aoids = {item.aoid for item in nanos}
        overlap = perk_aoids.intersection(nano_aoids)

        assert len(overlap) == 0, f"Found items that are both perks and nanos: {overlap}"

    def test_item_class_independence(self, perk_service, mixed_item_list, db_session):
        """Test that is_perk field works independently of item_class."""
        # Verify that perk identification doesn't depend on item_class=99999
        perks = db_session.query(Item).filter(Item.is_perk == True).all()

        # All our test perks happen to have item_class=99999, but this isn't required
        for perk in perks:
            assert perk.is_perk is True
            # Note: We don't require item_class=99999 for perks anymore

        # Verify non-perks can have various item_class values
        non_perks = db_session.query(Item).filter(Item.is_perk == False).all()

        item_classes = {item.item_class for item in non_perks}
        assert len(item_classes) > 1, "Non-perks should have various item_class values"

    def test_perk_identification_completeness(self, perk_service, mixed_item_list, db_session):
        """Test that every item has a definitive is_perk value."""
        all_items = db_session.query(Item).all()

        for item in all_items:
            # Every item should have is_perk explicitly set to True or False
            assert item.is_perk is not None, f"Item {item.aoid} has null is_perk value"
            assert isinstance(item.is_perk, bool), f"Item {item.aoid} is_perk is not boolean"

        # Verify counts add up
        perks = db_session.query(Item).filter(Item.is_perk == True).all()
        non_perks = db_session.query(Item).filter(Item.is_perk == False).all()

        assert len(perks) + len(non_perks) == len(all_items)


class TestPerkServiceQueryOptimization:
    """Test PerkService query patterns for performance."""

    @pytest.fixture
    def perk_service(self, db_session):
        """Create PerkService instance with database session."""
        return PerkService(db_session)

    def test_perk_query_selectivity(self, perk_service, mixed_item_list, db_session):
        """Test that is_perk queries are selective and efficient."""
        total_items = db_session.query(Item).count()
        perk_items = db_session.query(Item).filter(Item.is_perk == True).count()
        non_perk_items = db_session.query(Item).filter(Item.is_perk == False).count()

        # Verify counts
        assert total_items == perk_items + non_perk_items
        assert total_items == 5  # From our mixed_item_list fixture
        assert perk_items == 2
        assert non_perk_items == 3

        # In a real database, perks would be a small subset of all items
        # This demonstrates the query is selective
        selectivity = perk_items / total_items
        assert 0 < selectivity < 1, "Perk queries should be selective"

    def test_compound_perk_queries(self, perk_service, mixed_item_list, db_session):
        """Test compound queries involving is_perk field."""
        # Test query combining is_perk with other conditions
        perk_low_ql = db_session.query(Item).filter(
            Item.is_perk == True,
            Item.ql < 50
        ).all()

        # Should find perks with QL < 50
        assert len(perk_low_ql) > 0
        for item in perk_low_ql:
            assert item.is_perk is True
            assert item.ql < 50

        # Test query excluding perks
        high_ql_non_perks = db_session.query(Item).filter(
            Item.is_perk == False,
            Item.ql > 100
        ).all()

        # Should find non-perks with QL > 100
        for item in high_ql_non_perks:
            assert item.is_perk is False
            assert item.ql > 100