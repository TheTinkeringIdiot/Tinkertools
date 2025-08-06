"""
Pytest configuration and fixtures for TinkerTools backend tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models import *

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


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
        item_class="Weapon",
        slot="Right Hand",
        description="A test weapon for unit tests"
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