"""
Test fixtures for perk identification functionality.

This module provides test fixtures for items with `is_perk` field set to True/False,
using real AOIDs from the perks.json file for testing perk identification logic.
"""

import pytest
from app.models import Item


@pytest.fixture
def perk_accumulator_level_1(db_session):
    """Create Accumulator level 1 perk item (AOID 210830) for testing."""
    item = Item(
        aoid=210830,
        name="Accumulator",
        ql=10,
        item_class=99999,  # Traditional perk item_class
        description="Perk: Accumulator Level 1 - SL perk for Trader profession",
        is_nano=False,
        is_perk=True  # This should be set during import based on perks.json
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def perk_accumulator_level_5(db_session):
    """Create Accumulator level 5 perk item (AOID 210834) for testing."""
    item = Item(
        aoid=210834,
        name="Accumulator",
        ql=90,
        item_class=99999,
        description="Perk: Accumulator Level 5 - SL perk for Trader profession",
        is_nano=False,
        is_perk=True
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def perk_acquisition_level_1(db_session):
    """Create Acquisition level 1 perk item (AOID 261355) for testing."""
    item = Item(
        aoid=261355,
        name="Acquisition",
        ql=1,
        item_class=99999,
        description="Perk: Acquisition Level 1 - LE perk for Fixer profession",
        is_nano=False,
        is_perk=True
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def perk_acrobat_level_1(db_session):
    """Create Acrobat level 1 perk item (AOID 211655) for testing."""
    item = Item(
        aoid=211655,
        name="Acrobat",
        ql=30,
        item_class=99999,
        description="Perk: Acrobat Level 1 - SL perk for multiple professions",
        is_nano=False,
        is_perk=True
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def perk_alien_tech_expertise_level_1(db_session):
    """Create Alien Technology Expertise level 1 perk item (AOID 247748) for testing."""
    item = Item(
        aoid=247748,
        name="Alien Technology Expertise",
        ql=15,
        item_class=99999,
        description="Perk: Alien Technology Expertise Level 1 - AI perk",
        is_nano=False,
        is_perk=True
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def non_perk_weapon(db_session):
    """Create a regular weapon item that is NOT a perk for contrast testing."""
    item = Item(
        aoid=100001,  # Using a non-perk AOID
        name="Test Blaster",
        ql=150,
        item_class=1,  # Weapon item class
        description="A standard energy weapon for testing non-perk items",
        is_nano=False,
        is_perk=False  # This should be False for non-perk items
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def non_perk_armor(db_session):
    """Create a regular armor item that is NOT a perk for contrast testing."""
    item = Item(
        aoid=200001,  # Using a non-perk AOID
        name="Test Armor",
        ql=200,
        item_class=2,  # Armor item class
        description="Standard protective armor for testing non-perk items",
        is_nano=False,
        is_perk=False
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def non_perk_implant(db_session):
    """Create a regular implant item that is NOT a perk for contrast testing."""
    item = Item(
        aoid=300001,  # Using a non-perk AOID
        name="Test Implant",
        ql=100,
        item_class=3,  # Implant item class
        description="Basic enhancement implant for testing non-perk items",
        is_nano=False,
        is_perk=False
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def nano_program(db_session):
    """Create a nano program that is NOT a perk for contrast testing."""
    item = Item(
        aoid=400001,  # Using a non-perk AOID
        name="Test Nano Program",
        ql=75,
        item_class=4,  # Nano program item class
        description="Basic nano program for testing - not a perk, is a nano",
        is_nano=True,  # This is a nano program
        is_perk=False  # Nano programs are never perks
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def mixed_item_list(db_session, perk_accumulator_level_1, perk_acquisition_level_1,
                   non_perk_weapon, non_perk_armor, nano_program):
    """Create a mixed list of perk and non-perk items for comprehensive testing."""
    return [
        perk_accumulator_level_1,
        perk_acquisition_level_1,
        non_perk_weapon,
        non_perk_armor,
        nano_program
    ]


# AOIDs used in fixtures for reference
PERK_AOIDS_IN_FIXTURES = {
    210830,  # Accumulator Level 1
    210834,  # Accumulator Level 5
    261355,  # Acquisition Level 1
    211655,  # Acrobat Level 1
    247748,  # Alien Technology Expertise Level 1
}

NON_PERK_AOIDS_IN_FIXTURES = {
    100001,  # Test Blaster weapon
    200001,  # Test Armor
    300001,  # Test Implant
    400001,  # Test Nano Program
}