"""
Pytest configuration and fixtures for TinkerTools backend tests.
"""

import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.main import app
from app.core.database import Base, get_db
from app.models import *

# Use PostgreSQL database from environment variable
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set for testing")

engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture
def db_session():
    """Create a new database session for a test."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    """Create a test client with overridden database."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_stat_value(db_session):
    """Create a sample stat value for testing."""
    from app.models import StatValue
    
    stat_value = StatValue(stat=16, value=500)  # Strength 500
    db_session.add(stat_value)
    db_session.commit()
    db_session.refresh(stat_value)
    return stat_value


@pytest.fixture
def sample_item(db_session):
    """Create a sample item for testing."""
    from app.models import Item
    
    item = Item(
        aoid=12345,
        name="Test Weapon",
        ql=200,
        item_class=1,  # Use integer item_class
        description="A test weapon for unit tests",
        is_nano=False
    )
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


@pytest.fixture
def sample_symbiant(db_session):
    """Create a sample symbiant for testing."""
    from app.models import Symbiant
    
    symbiant = Symbiant(
        aoid=54321,
        name="Test Symbiant",
        ql=200,
        family="Artillery",
        symbiant_class="Support",
        slot="Head"
    )
    db_session.add(symbiant)
    db_session.commit()
    db_session.refresh(symbiant)
    return symbiant


@pytest.fixture
def sample_pocket_boss(db_session):
    """Create a sample pocket boss for testing."""
    from app.models import PocketBoss
    
    boss = PocketBoss(
        name="Test Boss",
        level=200,
        location="Test Location",
        playfield="Test Playfield",
        encounter_info="Test encounter information"
    )
    db_session.add(boss)
    db_session.commit()
    db_session.refresh(boss)
    return boss


@pytest.fixture
def sample_item_with_all_fields(db_session):
    """Create a comprehensive sample item with all related data for testing."""
    from app.models import (
        Item, ItemStats, StatValue, SpellData, ItemSpellData, Spell, 
        SpellDataSpells, Action, ActionCriteria, Criterion, AttackDefense,
        AttackDefenseAttack, AttackDefenseDefense
    )
    
    # Create item
    item = Item(
        aoid=54321,
        name="Enhanced Test Weapon",
        ql=150,
        item_class=1,
        description="A comprehensive test weapon with all features",
        is_nano=False
    )
    db_session.add(item)
    db_session.flush()  # Get ID without committing
    
    # Create stat values
    stat1 = StatValue(stat=16, value=50)  # Strength
    stat2 = StatValue(stat=17, value=25)  # Intelligence
    db_session.add_all([stat1, stat2])
    db_session.flush()
    
    # Create item stats
    item_stat1 = ItemStats(item_id=item.id, stat_value_id=stat1.id)
    item_stat2 = ItemStats(item_id=item.id, stat_value_id=stat2.id)
    db_session.add_all([item_stat1, item_stat2])
    
    # Create attack/defense data
    attack_defense = AttackDefense()
    db_session.add(attack_defense)
    db_session.flush()
    
    # Set item's attack defense reference
    item.atkdef_id = attack_defense.id
    
    # Create attack and defense stats
    attack_stat = StatValue(stat=100, value=200)  # Attack rating
    defense_stat = StatValue(stat=101, value=150)  # Defense rating
    db_session.add_all([attack_stat, defense_stat])
    db_session.flush()
    
    # Link attack/defense stats
    attack_link = AttackDefenseAttack(attack_defense_id=attack_defense.id, stat_value_id=attack_stat.id)
    defense_link = AttackDefenseDefense(attack_defense_id=attack_defense.id, stat_value_id=defense_stat.id)
    db_session.add_all([attack_link, defense_link])
    
    # Create spell data
    spell_data = SpellData(event=1)  # On equip
    db_session.add(spell_data)
    db_session.flush()
    
    # Create item spell data link
    item_spell_data = ItemSpellData(item_id=item.id, spell_data_id=spell_data.id)
    db_session.add(item_spell_data)
    
    # Create spell
    spell = Spell(
        target=1,
        spell_id=98765,
        spell_format="Increase {stat} by {value}",
        spell_params={"stat": 96, "value": 15}
    )
    db_session.add(spell)
    db_session.flush()
    
    # Create spell data spells link
    spell_data_spell = SpellDataSpells(spell_data_id=spell_data.id, spell_id=spell.id)
    db_session.add(spell_data_spell)
    
    # Create criteria for requirements
    criterion = Criterion(value1=16, value2=100, operator=1)  # Strength >= 100
    db_session.add(criterion)
    db_session.flush()
    
    # Create action with criteria
    action = Action(item_id=item.id, action=1)  # Equip action
    db_session.add(action)
    db_session.flush()
    
    # Create action criteria link
    action_criteria = ActionCriteria(action_id=action.id, criterion_id=criterion.id)
    db_session.add(action_criteria)
    
    db_session.commit()
    db_session.refresh(item)
    return item