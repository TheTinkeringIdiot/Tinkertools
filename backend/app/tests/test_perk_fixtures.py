"""
Test cases demonstrating the use of perk identification fixtures.

This module shows how to use the perk fixtures for testing perk identification
functionality and validates that the fixtures are working correctly.
"""

import pytest
from app.models import Item
from app.tests.fixtures.perk_fixtures import PERK_AOIDS_IN_FIXTURES, NON_PERK_AOIDS_IN_FIXTURES


def test_perk_accumulator_fixture(perk_accumulator_level_1):
    """Test that the Accumulator perk fixture is created correctly."""
    assert perk_accumulator_level_1.aoid == 210830
    assert perk_accumulator_level_1.name == "Accumulator"
    assert perk_accumulator_level_1.is_perk is True
    assert perk_accumulator_level_1.is_nano is False
    assert perk_accumulator_level_1.ql == 10


def test_perk_acquisition_fixture(perk_acquisition_level_1):
    """Test that the Acquisition perk fixture is created correctly."""
    assert perk_acquisition_level_1.aoid == 261355
    assert perk_acquisition_level_1.name == "Acquisition"
    assert perk_acquisition_level_1.is_perk is True
    assert perk_acquisition_level_1.is_nano is False
    assert perk_acquisition_level_1.ql == 1


def test_non_perk_weapon_fixture(non_perk_weapon):
    """Test that the non-perk weapon fixture is created correctly."""
    assert non_perk_weapon.aoid == 100001
    assert non_perk_weapon.name == "Test Blaster"
    assert non_perk_weapon.is_perk is False
    assert non_perk_weapon.is_nano is False
    assert non_perk_weapon.item_class == 1


def test_non_perk_armor_fixture(non_perk_armor):
    """Test that the non-perk armor fixture is created correctly."""
    assert non_perk_armor.aoid == 200001
    assert non_perk_armor.name == "Test Armor"
    assert non_perk_armor.is_perk is False
    assert non_perk_armor.is_nano is False
    assert non_perk_armor.item_class == 2


def test_nano_program_fixture(nano_program):
    """Test that the nano program fixture is created correctly."""
    assert nano_program.aoid == 400001
    assert nano_program.name == "Test Nano Program"
    assert nano_program.is_perk is False  # Nano programs are never perks
    assert nano_program.is_nano is True
    assert nano_program.item_class == 4


def test_mixed_item_list_fixture(mixed_item_list):
    """Test that the mixed item list fixture contains the expected items."""
    assert len(mixed_item_list) == 5

    # Check that we have the expected mix of perk and non-perk items
    perk_items = [item for item in mixed_item_list if item.is_perk]
    non_perk_items = [item for item in mixed_item_list if not item.is_perk]

    assert len(perk_items) == 2  # Accumulator and Acquisition
    assert len(non_perk_items) == 3  # Weapon, Armor, Nano

    # Verify specific items are present
    aoids = {item.aoid for item in mixed_item_list}
    assert 210830 in aoids  # Accumulator
    assert 261355 in aoids  # Acquisition
    assert 100001 in aoids  # Test Blaster
    assert 200001 in aoids  # Test Armor
    assert 400001 in aoids  # Test Nano


def test_perk_aoids_constant():
    """Test that the PERK_AOIDS_IN_FIXTURES constant contains expected values."""
    expected_perk_aoids = {210830, 210834, 261355, 211655, 247748}
    assert PERK_AOIDS_IN_FIXTURES == expected_perk_aoids


def test_non_perk_aoids_constant():
    """Test that the NON_PERK_AOIDS_IN_FIXTURES constant contains expected values."""
    expected_non_perk_aoids = {100001, 200001, 300001, 400001}
    assert NON_PERK_AOIDS_IN_FIXTURES == expected_non_perk_aoids


def test_no_overlap_between_perk_and_non_perk_aoids():
    """Test that perk and non-perk AOID sets don't overlap."""
    overlap = PERK_AOIDS_IN_FIXTURES.intersection(NON_PERK_AOIDS_IN_FIXTURES)
    assert len(overlap) == 0, f"Found overlapping AOIDs: {overlap}"


def test_db_query_perks_only(db_session, mixed_item_list):
    """Test querying for perks only using the is_perk field."""
    # Query for all perks
    perks = db_session.query(Item).filter(Item.is_perk == True).all()

    # Should find exactly 2 perks from our fixtures
    assert len(perks) == 2

    perk_aoids = {perk.aoid for perk in perks}
    assert perk_aoids == {210830, 261355}

    # Verify all returned items are actually perks
    for perk in perks:
        assert perk.is_perk is True
        assert perk.is_nano is False  # Perks are never nanos


def test_db_query_non_perks_only(db_session, mixed_item_list):
    """Test querying for non-perks only using the is_perk field."""
    # Query for all non-perks
    non_perks = db_session.query(Item).filter(Item.is_perk == False).all()

    # Should find exactly 3 non-perks from our fixtures
    assert len(non_perks) == 3

    non_perk_aoids = {item.aoid for item in non_perks}
    assert non_perk_aoids == {100001, 200001, 400001}

    # Verify all returned items are actually non-perks
    for item in non_perks:
        assert item.is_perk is False


def test_db_query_exclude_nanos_from_perks(db_session, mixed_item_list):
    """Test that nano programs are properly excluded when querying for perks."""
    # Query for items that are perks and not nanos (this should be redundant,
    # but tests the business rule that perks are never nanos)
    perk_non_nanos = db_session.query(Item).filter(
        Item.is_perk == True,
        Item.is_nano == False
    ).all()

    # Should still find exactly 2 perks (same as querying is_perk only)
    assert len(perk_non_nanos) == 2

    # Query for items that are nanos (should exclude all perks)
    nanos = db_session.query(Item).filter(Item.is_nano == True).all()

    # Should find exactly 1 nano program
    assert len(nanos) == 1
    assert nanos[0].aoid == 400001
    assert nanos[0].is_perk is False  # Nano programs are never perks