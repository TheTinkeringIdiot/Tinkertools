"""
Pytest configuration and fixtures for TinkerTools backend tests.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.store.context import StoreSession, builds
from app.tests.fixtures.store_fixtures import store  # noqa: F401


@pytest.fixture
def client():
    """A test client on the application as it is served: its requests read
    the development store."""
    with TestClient(app) as test_client:
        yield test_client


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
    return builds.resolve(None) or builds.resolve(settings.DEFAULT_GAME_VERSION)
