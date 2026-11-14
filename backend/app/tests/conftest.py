"""
Pytest configuration and fixtures for TinkerTools backend tests.
"""

import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db
from app.core.versions import registry, schema_name_for
from app.core.config import settings
from app.models import *  # noqa: F403 - registers every mapper before tests run
from app.store.context import StoreSession, builds
from app.tests.fixtures.store_fixtures import store  # noqa: F401

# Use PostgreSQL database from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set for testing")

engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Tests run against one game version's schema: TEST_GAME_VERSION if set, else the
# registry's default version, else the configured fallback. A schema that does
# not exist is ignored by PostgreSQL, so this also works against a bare database.
def _resolve_test_game_version() -> str:
    explicit = os.getenv("TEST_GAME_VERSION")
    if explicit:
        return explicit
    try:
        with engine.connect() as conn:
            default_slug = conn.execute(
                text(
                    "SELECT slug FROM public.game_versions WHERE is_default AND enabled LIMIT 1"
                )
            ).scalar()
        if default_slug:
            return default_slug
    except Exception:
        pass
    return settings.DEFAULT_GAME_VERSION


TEST_GAME_VERSION = _resolve_test_game_version()
TEST_SCHEMA = schema_name_for(TEST_GAME_VERSION)


def _begin_test_transaction(connection):
    transaction = connection.begin()
    connection.execute(text(f'SET LOCAL search_path TO "{TEST_SCHEMA}", public'))
    return transaction


def override_get_db():
    """Override database dependency for testing with transaction rollback."""
    connection = engine.connect()
    transaction = _begin_test_transaction(connection)
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
    transaction = _begin_test_transaction(connection)
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
def store_db():
    """A session on the development store, the one requests of ``client``
    read: for the values a test on the real game data expects."""
    session = StoreSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def build():
    """The build a request of ``client`` without a version segment reads."""
    return builds.resolve(registry.default_slug())
