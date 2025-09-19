"""
Test fixtures for import functionality testing.

This module provides fixtures for testing the import system's ability to correctly
identify perks based on the perks.json file and set the is_perk field appropriately.
"""

import pytest
import json
import tempfile
import os
from typing import Dict, Set


@pytest.fixture
def sample_perks_data():
    """Provide sample perks data structure matching perks.json format."""
    return {
        "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
        "values": [
            [210830, "Accumulator", 1, "SL", ["Trader"], [], 10, None],
            [210831, "Accumulator", 2, "SL", ["Trader"], [], 20, None],
            [210834, "Accumulator", 5, "SL", ["Trader"], [], 90, None],
            [261355, "Acquisition", 1, "LE", ["Fixer"], [], 1, None],
            [261356, "Acquisition", 2, "LE", ["Fixer"], [], 50, None],
            [211655, "Acrobat", 1, "SL", ["Fixer", "Martial Artist", "Shade", "Adventurer"], [], 30, None],
            [211656, "Acrobat", 2, "SL", ["Fixer", "Martial Artist", "Shade", "Adventurer"], [], 60, None],
            [247748, "Alien Technology Expertise", 1, "AI", [], [], 15, None],
            [247749, "Alien Technology Expertise", 2, "AI", [], [], 75, None],
            [252301, "Ancient Knowledge", 1, "AI", ["Meta Physicist"], [], 15, None]
        ]
    }


@pytest.fixture
def sample_perk_aoids(sample_perks_data):
    """Extract AOIDs from sample perks data for testing."""
    aoid_index = sample_perks_data["columns"].index("aoid")
    return {row[aoid_index] for row in sample_perks_data["values"]}


@pytest.fixture
def temp_perks_json_file(sample_perks_data):
    """Create a temporary perks.json file for testing import functionality."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
        json.dump(sample_perks_data, temp_file)
        temp_file_path = temp_file.name

    yield temp_file_path

    # Cleanup
    if os.path.exists(temp_file_path):
        os.unlink(temp_file_path)


@pytest.fixture
def item_import_data_with_perks():
    """Provide sample item data including both perks and non-perks for import testing."""
    return [
        {
            "aoid": 210830,  # This is a perk (Accumulator Level 1)
            "name": "Accumulator",
            "ql": 10,
            "item_class": 99999,
            "description": "Perk: Accumulator Level 1",
            "is_nano": False
        },
        {
            "aoid": 261355,  # This is a perk (Acquisition Level 1)
            "name": "Acquisition",
            "ql": 1,
            "item_class": 99999,
            "description": "Perk: Acquisition Level 1",
            "is_nano": False
        },
        {
            "aoid": 100001,  # This is NOT a perk (regular weapon)
            "name": "Test Blaster",
            "ql": 150,
            "item_class": 1,
            "description": "A standard energy weapon",
            "is_nano": False
        },
        {
            "aoid": 200001,  # This is NOT a perk (regular armor)
            "name": "Test Armor",
            "ql": 200,
            "item_class": 2,
            "description": "Standard protective armor",
            "is_nano": False
        },
        {
            "aoid": 400001,  # This is NOT a perk (nano program)
            "name": "Test Nano Program",
            "ql": 75,
            "item_class": 4,
            "description": "Basic nano program",
            "is_nano": True  # Nano programs can never be perks
        }
    ]


@pytest.fixture
def expected_perk_identification(sample_perk_aoids):
    """Define expected results for perk identification testing."""
    return {
        210830: True,   # Accumulator Level 1 - should be identified as perk
        261355: True,   # Acquisition Level 1 - should be identified as perk
        100001: False,  # Test Blaster - should NOT be identified as perk
        200001: False,  # Test Armor - should NOT be identified as perk
        400001: False,  # Test Nano Program - should NOT be identified as perk (is nano)
    }


@pytest.fixture
def empty_perks_json_file():
    """Create a temporary empty perks.json file for testing error handling."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
        json.dump({"columns": ["aoid"], "values": []}, temp_file)
        temp_file_path = temp_file.name

    yield temp_file_path

    # Cleanup
    if os.path.exists(temp_file_path):
        os.unlink(temp_file_path)


@pytest.fixture
def malformed_perks_json_file():
    """Create a temporary malformed perks.json file for testing error handling."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
        temp_file.write("{ invalid json content")
        temp_file_path = temp_file.name

    yield temp_file_path

    # Cleanup
    if os.path.exists(temp_file_path):
        os.unlink(temp_file_path)