"""
Unit tests for SQLAlchemy models.
"""

import pytest
from sqlalchemy.exc import IntegrityError


def test_stat_value_creation(db_session):
    """Test StatValue model creation."""
    from app.models import StatValue
    
    stat_value = StatValue(stat=16, value=500)
    db_session.add(stat_value)
    db_session.commit()
    
    assert stat_value.id is not None
    assert stat_value.stat == 16
    assert stat_value.value == 500


def test_stat_value_unique_constraint(db_session):
    """Test StatValue unique constraint."""
    from app.models import StatValue
    
    # Create first stat value
    stat_value1 = StatValue(stat=16, value=500)
    db_session.add(stat_value1)
    db_session.commit()
    
    # Try to create duplicate
    stat_value2 = StatValue(stat=16, value=500)
    db_session.add(stat_value2)
    
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_item_creation(db_session):
    """Test Item model creation."""
    from app.models import Item
    
    item = Item(
        aoid=12345,
        name="Test Item",
        ql=200,
        item_class="Weapon",
        slot="Right Hand",
        description="Test description",
        is_nano=False
    )
    db_session.add(item)
    db_session.commit()
    
    assert item.id is not None
    assert item.aoid == 12345
    assert item.name == "Test Item"
    assert item.ql == 200
    assert item.is_nano is False


def test_item_stats_relationship(db_session):
    """Test Item-StatValue relationship."""
    from app.models import Item, StatValue, ItemStats
    
    # Create item and stat value
    item = Item(aoid=12345, name="Test Item", ql=200)
    stat_value = StatValue(stat=16, value=500)
    
    db_session.add(item)
    db_session.add(stat_value)
    db_session.commit()
    
    # Create relationship
    item_stat = ItemStats(item_id=item.id, stat_value_id=stat_value.id)
    db_session.add(item_stat)
    db_session.commit()
    
    # Test access through relationship
    db_session.refresh(item)
    assert len(item.stats) == 1
    assert item.stats[0].stat == 16
    assert item.stats[0].value == 500


def test_symbiant_pocket_boss_relationship(db_session):
    """Test Symbiant-PocketBoss many-to-many relationship."""
    from app.models import Symbiant, PocketBoss, PocketBossSymbiantDrops
    
    # Create symbiant and pocket boss
    symbiant = Symbiant(
        aoid=54321,
        name="Test Symbiant",
        ql=200,
        family="Artillery"
    )
    boss = PocketBoss(
        name="Test Boss",
        level=200,
        location="Test Location"
    )
    
    db_session.add(symbiant)
    db_session.add(boss)
    db_session.commit()
    
    # Create relationship
    drop = PocketBossSymbiantDrops(
        pocket_boss_id=boss.id,
        symbiant_id=symbiant.id
    )
    db_session.add(drop)
    db_session.commit()
    
    # Test access through relationship
    db_session.refresh(symbiant)
    db_session.refresh(boss)
    
    assert len(symbiant.dropped_by) == 1
    assert symbiant.dropped_by[0].name == "Test Boss"
    
    assert len(boss.drops) == 1
    assert boss.drops[0].name == "Test Symbiant"


def test_spell_criteria_relationship(db_session):
    """Test Spell-Criterion relationship."""
    from app.models import Spell, Criterion, SpellCriterion
    
    # Create spell and criterion
    spell = Spell(
        spell_id=1001,
        target=1,
        spell_format="Test format"
    )
    criterion = Criterion(
        value1=100,
        value2=200,
        operator=1
    )
    
    db_session.add(spell)
    db_session.add(criterion)
    db_session.commit()
    
    # Create relationship
    spell_criterion = SpellCriterion(
        spell_id=spell.id,
        criterion_id=criterion.id
    )
    db_session.add(spell_criterion)
    db_session.commit()
    
    # Test access through relationship
    db_session.refresh(spell)
    assert len(spell.criteria) == 1
    assert spell.criteria[0].value1 == 100
    assert spell.criteria[0].value2 == 200