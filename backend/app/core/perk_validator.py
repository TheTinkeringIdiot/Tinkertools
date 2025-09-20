"""
Perk data validation utilities for converting perk metadata strings to database-compatible formats.

This module provides functions to:
- Map profession names from perks.json to integer IDs (1-15)
- Map breed names from perks.json to integer IDs (1-4)
- Validate perk types (SL/AI/LE)
- Validate counter values (1-10)
- Parse level requirements safely
"""

import logging
from typing import Any, List

logger = logging.getLogger(__name__)

# Profession name to ID mapping based on frontend/src/services/game-data.ts PROFESSION constant
PROFESSION_NAME_TO_ID = {
    "Soldier": 1,
    "Martial Artist": 2,
    "MartialArtist": 2,  # Handle both formats
    "Engineer": 3,
    "Fixer": 4,
    "Agent": 5,
    "Adventurer": 6,
    "Trader": 7,
    "Bureaucrat": 8,
    "Enforcer": 9,
    "Doctor": 10,
    "Nano-Technician": 11,
    "NanoTechnician": 11,  # Handle both formats
    "Meta Physicist": 12,
    "MetaPhysicist": 12,  # Handle both formats
    "Keeper": 14,
    "Shade": 15,
}

# Breed name to ID mapping based on frontend/src/services/game-data.ts BREED constant
BREED_NAME_TO_ID = {
    "Solitus": 1,
    "Opifex": 2,
    "Nanomage": 3,
    "Atrox": 4,
}

# Valid perk types
VALID_PERK_TYPES = {"SL", "AI", "LE"}

# Valid counter range
MIN_COUNTER = 1
MAX_COUNTER = 10


def map_profession_to_id(profession_name: str) -> int:
    """
    Map a profession name to its integer ID.

    Args:
        profession_name: The profession name as it appears in perks.json

    Returns:
        The profession ID (1-15)

    Raises:
        ValueError: If the profession name is not recognized
    """
    if not profession_name or not isinstance(profession_name, str):
        raise ValueError(f"Invalid profession name: {profession_name}")

    profession_id = PROFESSION_NAME_TO_ID.get(profession_name.strip())
    if profession_id is None:
        raise ValueError(f"Unknown profession name: '{profession_name}'. Valid names: {list(PROFESSION_NAME_TO_ID.keys())}")

    return profession_id


def map_breed_to_id(breed_name: str) -> int:
    """
    Map a breed name to its integer ID.

    Args:
        breed_name: The breed name as it appears in perks.json

    Returns:
        The breed ID (1-4)

    Raises:
        ValueError: If the breed name is not recognized
    """
    if not breed_name or not isinstance(breed_name, str):
        raise ValueError(f"Invalid breed name: {breed_name}")

    breed_id = BREED_NAME_TO_ID.get(breed_name.strip())
    if breed_id is None:
        raise ValueError(f"Unknown breed name: '{breed_name}'. Valid names: {list(BREED_NAME_TO_ID.keys())}")

    return breed_id


def validate_perk_type(perk_type: str) -> str:
    """
    Validate that a perk type is one of the allowed values.

    Args:
        perk_type: The perk type to validate

    Returns:
        The validated perk type

    Raises:
        ValueError: If the perk type is not valid
    """
    if not perk_type or not isinstance(perk_type, str):
        raise ValueError(f"Invalid perk type: {perk_type}")

    perk_type = perk_type.strip().upper()
    if perk_type not in VALID_PERK_TYPES:
        raise ValueError(f"Invalid perk type: '{perk_type}'. Valid types: {sorted(VALID_PERK_TYPES)}")

    return perk_type


def validate_counter(counter: int) -> int:
    """
    Validate that a counter value is within the allowed range.

    Args:
        counter: The counter value to validate

    Returns:
        The validated counter value

    Raises:
        ValueError: If the counter is not within the valid range
    """
    if not isinstance(counter, int):
        raise ValueError(f"Counter must be an integer, got: {type(counter).__name__}")

    if counter < MIN_COUNTER or counter > MAX_COUNTER:
        raise ValueError(f"Counter must be between {MIN_COUNTER} and {MAX_COUNTER}, got: {counter}")

    return counter


def parse_level_requirement(level: Any) -> int:
    """
    Safely parse a level requirement to an integer.

    Args:
        level: The level value to parse (can be int, str, None, etc.)

    Returns:
        The parsed level as an integer (0 if None/null)

    Raises:
        ValueError: If the level cannot be parsed to a valid integer
    """
    if level is None:
        return 0

    if isinstance(level, int):
        if level < 0:
            raise ValueError(f"Level requirement cannot be negative: {level}")
        return level

    if isinstance(level, str):
        level = level.strip()
        if not level or level.lower() in ('null', 'none', ''):
            return 0
        try:
            parsed_level = int(level)
            if parsed_level < 0:
                raise ValueError(f"Level requirement cannot be negative: {parsed_level}")
            return parsed_level
        except ValueError:
            raise ValueError(f"Cannot parse level requirement to integer: '{level}'")

    # Try to convert other types to int
    try:
        parsed_level = int(level)
        if parsed_level < 0:
            raise ValueError(f"Level requirement cannot be negative: {parsed_level}")
        return parsed_level
    except (ValueError, TypeError):
        raise ValueError(f"Cannot parse level requirement to integer: {level} (type: {type(level).__name__})")


def map_professions_list(professions: List[str]) -> List[int]:
    """
    Map a list of profession names to their integer IDs.

    Args:
        professions: List of profession names

    Returns:
        List of profession IDs

    Raises:
        ValueError: If any profession name is not recognized
    """
    if not isinstance(professions, list):
        raise ValueError(f"Professions must be a list, got: {type(professions).__name__}")

    profession_ids = []
    for profession in professions:
        try:
            profession_ids.append(map_profession_to_id(profession))
        except ValueError as e:
            logger.warning(f"Failed to map profession '{profession}': {e}")
            raise

    return profession_ids


def map_breeds_list(breeds: List[str]) -> List[int]:
    """
    Map a list of breed names to their integer IDs.

    Args:
        breeds: List of breed names

    Returns:
        List of breed IDs

    Raises:
        ValueError: If any breed name is not recognized
    """
    if not isinstance(breeds, list):
        raise ValueError(f"Breeds must be a list, got: {type(breeds).__name__}")

    breed_ids = []
    for breed in breeds:
        try:
            breed_ids.append(map_breed_to_id(breed))
        except ValueError as e:
            logger.warning(f"Failed to map breed '{breed}': {e}")
            raise

    return breed_ids