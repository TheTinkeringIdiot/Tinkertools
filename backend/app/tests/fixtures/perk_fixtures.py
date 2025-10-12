"""
Test fixtures for perk identification functionality.

This module provides test fixtures that query real Perk and Item records from the database,
replacing mock data with actual game data. Items are perks if they have a related Perk record.
"""

import pytest
from sqlalchemy.orm import selectinload
from app.models import Perk, Item, ItemStats
from app.tests.db_test_constants import (
    # SL Perks - Accumulator series
    PERK_SL_ACCUMULATOR_1_ITEM_ID,
    PERK_SL_ACCUMULATOR_2_ITEM_ID,
    # AI Perks - Opportunist series
    PERK_AI_OPPORTUNIST_1_ITEM_ID,
    PERK_AI_OPPORTUNIST_2_ITEM_ID,
    # LE Perks - Exploration series
    PERK_LE_EXPLORATION_1_ITEM_ID,
    PERK_LE_EXPLORATION_2_ITEM_ID,
    PERK_LE_EXPLORATION_3_ITEM_ID,
    # AI Perk - Alien Technology Expertise
    PERK_AI_TECH_1_ITEM_ID,
    # Items for testing non-perks
    ITEM_CELL_SCANNER,
    ITEM_AGENT,
    ITEM_ADVENTURER,
    ITEM_ENGINEER,
)


# =============================================================================
# Perk Fixtures (8 total) - Real database perks
# =============================================================================


@pytest.fixture
def perk_sl_acc1(db_session):
    """Real Accumulator counter 1 perk (SL type, Level 10, AOID 210830)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_SL_ACCUMULATOR_1_ITEM_ID).one()


@pytest.fixture
def perk_sl_acc2(db_session):
    """Real Accumulator counter 2 perk (SL type, Level 20, AOID 210831)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_SL_ACCUMULATOR_2_ITEM_ID).one()


@pytest.fixture
def perk_ai_opp1(db_session):
    """Real Opportunist counter 1 perk (AI type, Level 15, AOID 252479)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_AI_OPPORTUNIST_1_ITEM_ID).one()


@pytest.fixture
def perk_ai_opp2(db_session):
    """Real Opportunist counter 2 perk (AI type, Level 25, AOID 252480)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_AI_OPPORTUNIST_2_ITEM_ID).one()


@pytest.fixture
def perk_le_exp1(db_session):
    """Real Exploration counter 1 perk (LE type, Level 1, AOID 260870)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_LE_EXPLORATION_1_ITEM_ID).one()


@pytest.fixture
def perk_le_exp2(db_session):
    """Real Exploration counter 2 perk (LE type, Level 50, AOID 260871)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_LE_EXPLORATION_2_ITEM_ID).one()


@pytest.fixture
def perk_le_exp3(db_session):
    """Real Exploration counter 3 perk (LE type, Level 75, AOID 260872)."""
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_LE_EXPLORATION_3_ITEM_ID).one()


@pytest.fixture
def perk_le_exp4(db_session):
    """Real Alien Technology Expertise counter 1 perk (AI type, Level 15, AOID 247748)."""
    # Note: Using AI Tech as a substitute for LE exp4 since only 3 Exploration perks exist
    return db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_AI_TECH_1_ITEM_ID).one()


# =============================================================================
# Non-Perk Item Fixtures (4 total) - Real database items without perks
# =============================================================================


@pytest.fixture
def item_no_perk(db_session):
    """Real item without perk: Cell Scanner (AOID 24562, 6 stats, QL 1)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_CELL_SCANNER).one()


@pytest.fixture
def item_with_other_data(db_session):
    """Real item without perk: Agent profession item (AOID 46228, 7 stats, QL 1)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_AGENT).one()


@pytest.fixture
def item_with_null_perk(db_session):
    """Real item without perk: Adventurer profession item (AOID 46226, 7 stats, QL 1)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_ADVENTURER).one()


@pytest.fixture
def item_different_category(db_session):
    """Real item without perk: Engineer profession item (AOID 46229, 7 stats, QL 1)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_ENGINEER).one()


# =============================================================================
# Legacy Fixtures (for backward compatibility with existing tests)
# =============================================================================


@pytest.fixture
def perk_accumulator_level_1(db_session):
    """Legacy fixture: Real Accumulator level 1 perk item (AOID 210830)."""
    perk = db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_SL_ACCUMULATOR_1_ITEM_ID).one()
    return perk.item


@pytest.fixture
def perk_accumulator_level_5(db_session):
    """Legacy fixture: Real Accumulator level 5 perk item (AOID 210834)."""
    # Note: Mapped to Accumulator 2 since that's what we have in constants
    perk = db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_SL_ACCUMULATOR_2_ITEM_ID).one()
    return perk.item


@pytest.fixture
def perk_acquisition_level_1(db_session):
    """Legacy fixture: Real Exploration level 1 perk item (LE type)."""
    perk = db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_LE_EXPLORATION_1_ITEM_ID).one()
    return perk.item


@pytest.fixture
def perk_acrobat_level_1(db_session):
    """Legacy fixture: Real Opportunist level 1 perk item (AI type)."""
    perk = db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_AI_OPPORTUNIST_1_ITEM_ID).one()
    return perk.item


@pytest.fixture
def perk_alien_tech_expertise_level_1(db_session):
    """Legacy fixture: Real Alien Technology Expertise level 1 perk item (AOID 247748)."""
    perk = db_session.query(Perk).options(
        selectinload(Perk.item)
    ).filter(Perk.item_id == PERK_AI_TECH_1_ITEM_ID).one()
    return perk.item


@pytest.fixture
def non_perk_weapon(db_session):
    """Legacy fixture: Real non-perk item (Cell Scanner)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_CELL_SCANNER).one()


@pytest.fixture
def non_perk_armor(db_session):
    """Legacy fixture: Real non-perk item (Agent profession)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_AGENT).one()


@pytest.fixture
def non_perk_implant(db_session):
    """Legacy fixture: Real non-perk item (Adventurer profession)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_ADVENTURER).one()


@pytest.fixture
def nano_program(db_session):
    """Legacy fixture: Real non-perk item (Engineer profession)."""
    return db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_ENGINEER).one()


@pytest.fixture
def mixed_item_list(
    perk_accumulator_level_1,
    perk_acquisition_level_1,
    non_perk_weapon,
    non_perk_armor,
    nano_program,
):
    """Legacy fixture: Mixed list of perk and non-perk items."""
    return [
        perk_accumulator_level_1,
        perk_acquisition_level_1,
        non_perk_weapon,
        non_perk_armor,
        nano_program,
    ]