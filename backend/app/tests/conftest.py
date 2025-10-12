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

# Import all fixtures from fixture modules
from app.tests.fixtures.perk_fixtures import *
from app.tests.fixtures.import_fixtures import *

# Use PostgreSQL database from environment variable
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set for testing")

engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing with transaction rollback."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def db_session():
    """Create a new database session for a test with transaction rollback."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    """Create a test client with overridden database using the same db_session.

    This ensures that data created in db_session is visible to the API endpoints
    called via the client, since they share the same database connection/transaction.
    """
    def override_get_db_with_session():
        """Override that yields the same db_session fixture."""
        yield db_session

    app.dependency_overrides[get_db] = override_get_db_with_session
    with TestClient(app) as test_client:
        yield test_client

    # Clean up properly - clear identity map to prevent state pollution
    app.dependency_overrides.clear()
    db_session.expunge_all()  # Clear all objects from session identity map


@pytest.fixture
def sample_stat_value(db_session):
    """Query a real stat value from the database for testing.

    Uses STAT_ID_COMMON_1 (Stat 1, Value: 5000) from the real database.
    """
    from app.models import StatValue
    from app.tests.db_test_constants import STAT_ID_COMMON_1

    # Query real stat value instead of creating mock
    stat_value = db_session.query(StatValue).filter(
        StatValue.id == STAT_ID_COMMON_1
    ).one()

    return stat_value


@pytest.fixture
def sample_item(db_session):
    """Query a real item from the database for testing.

    Uses Cell Scanner (AOID: 24562, QL: 1, 6 stats) - a simple item
    perfect for basic testing.
    """
    from app.models import Item, ItemStats
    from sqlalchemy.orm import selectinload
    from app.tests.db_test_constants import ITEM_CELL_SCANNER

    # Query real item with stats loaded instead of creating mock
    item = db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value)
    ).filter(Item.aoid == ITEM_CELL_SCANNER).one()

    return item


@pytest.fixture
def sample_symbiant(db_session):
    """Query a real symbiant item from the database for testing.

    Uses "Breathing Ocular Symbiant" (AOID: 219132, QL: 100-150) - a real
    symbiant with slot and level requirement data.

    Note: Symbiants are stored as regular items with specific name patterns.
    The symbiant_items materialized view filters items by name pattern and
    extracts slot_id from stat 298.
    """
    from app.models import Item, ItemStats, Action
    from sqlalchemy.orm import selectinload
    from app.tests.db_test_constants import ITEM_MID_LOW_QL

    # Query real symbiant item with all relationships loaded
    item = db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
        selectinload(Item.actions).selectinload(Action.action_criteria)
    ).filter(Item.aoid == ITEM_MID_LOW_QL).one()

    return item


@pytest.fixture
def sample_pocket_boss(db_session):
    """Query a real pocket boss from the database for testing.

    Uses "Adobe Suzerain" (ID: 1171, Level: 125, Playfield: "Scheol Upper") -
    a real pocket boss mob from the database.

    Note: Pocket bosses are stored in the 'mobs' table with is_pocket_boss=True,
    not in a separate 'pocket_bosses' table.
    """
    from app.models import Mob
    from app.tests.db_test_constants import MOB_ID_ADOBE_SUZERAIN

    # Query real pocket boss instead of creating mock
    boss = db_session.query(Mob).filter(
        Mob.id == MOB_ID_ADOBE_SUZERAIN
    ).one()

    return boss


@pytest.fixture
def sample_item_with_all_fields(db_session):
    """Query a comprehensive real item with all related data for testing.

    Uses "Pistol Mastery" (AOID: 29246, QL: 24, 26 stats, 29 sources) -
    a complex real item perfect for testing comprehensive relationships.
    """
    from app.models import (
        Item, ItemStats, ItemSource, Source, Action
    )
    from sqlalchemy.orm import selectinload
    from app.tests.db_test_constants import ITEM_PISTOL_MASTERY

    # Query real item with all relationships loaded
    item = db_session.query(Item).options(
        selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
        selectinload(Item.item_sources).selectinload(ItemSource.source).selectinload(Source.source_type),
        selectinload(Item.actions).selectinload(Action.action_criteria)
    ).filter(Item.aoid == ITEM_PISTOL_MASTERY).one()

    return item