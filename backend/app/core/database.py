"""
Database configuration and connection management for TinkerTools backend.

One engine, one pool. Each game version lives in its own PostgreSQL schema
(gv_<slug>); a session is bound to a version by setting search_path on its
connection for the life of the session and resetting it on return to the pool.
"""

import os
import logging
from contextlib import contextmanager
from typing import Generator, Iterator, Optional

from fastapi import Request
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import sessionmaker, Session, declarative_base

from app.core.versions import registry, validate_schema_name, current_version

logger = logging.getLogger(__name__)

# Database configuration from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback for development/testing when no DATABASE_URL is set
    DATABASE_URL = "sqlite:///./test.db"

# Create SQLAlchemy engine with connection pooling
# Connection pool configuration
_default_pool_size = 10
_default_max_overflow = 20

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before use
    pool_size=_default_pool_size,  # Connection pool size
    max_overflow=_default_max_overflow,  # Additional connections beyond pool_size
    echo=os.getenv("SQL_DEBUG", "false").lower()
    == "true",  # Log SQL queries in debug mode
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base for ORM models
Base = declarative_base()

# Metadata for schema inspection
metadata = MetaData()

IS_POSTGRES = engine.dialect.name == "postgresql"


def apply_search_path(connection: Connection, schema_name: str) -> None:
    """Point a connection at a version schema (session-level, survives commits).

    A schema that does not exist yet is silently skipped by PostgreSQL, so
    during the transition to per-version schemas this falls through to public.
    """
    if not IS_POSTGRES:
        return
    validate_schema_name(schema_name)
    connection.execute(text(f'SET search_path TO "{schema_name}", public'))
    connection.commit()


def reset_search_path(connection: Connection) -> None:
    if not IS_POSTGRES:
        return
    try:
        connection.rollback()
        connection.execute(text("RESET search_path"))
        connection.commit()
    except Exception as exc:  # connection already broken; pool will discard it
        logger.debug("Could not reset search_path: %s", exc)


@contextmanager
def session_for_version(slug: Optional[str] = None) -> Iterator[Session]:
    """Session bound to one game version's schema.

    ``slug`` None means the current request's version, or the default version
    outside a request. Use this from CLI code instead of ``get_db``.
    """
    resolved = slug or current_version.get() or registry.default_slug()
    schema = registry.schema_for(resolved)
    connection = engine.connect()
    try:
        apply_search_path(connection, schema)
        session = SessionLocal(bind=connection)
        try:
            yield session
        finally:
            session.close()
    finally:
        reset_search_path(connection)
        connection.close()


def get_db(request: Request) -> Generator[Session, None, None]:
    """FastAPI dependency: a session bound to the request's game version.

    The version is set on ``request.state.game_version`` by
    ``GameVersionMiddleware``.
    """
    slug = getattr(request.state, "game_version", None)
    with session_for_version(slug) as db:
        yield db


def create_tables():
    """
    Create all tables defined in the Base metadata.
    This is used for testing - production uses migrations.
    """
    Base.metadata.create_all(bind=engine)


def drop_tables():
    """
    Drop all tables defined in the Base metadata.
    Used for testing cleanup.
    """
    Base.metadata.drop_all(bind=engine)


def test_connection() -> bool:
    """
    Test the database connection.

    Returns:
        bool: True if connection successful, False otherwise
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False


def get_table_count(slug: Optional[str] = None) -> int:
    """
    Number of tables in a game version's schema (default version if no slug).
    Falls back to the public schema while data has not yet been moved into a
    version schema.
    """
    if not IS_POSTGRES:
        try:
            with engine.connect() as connection:
                return connection.execute(
                    text("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")
                ).scalar()
        except Exception as e:
            print(f"Failed to get table count: {e}")
            return 0

    try:
        schema = registry.schema_for(slug)
        with engine.connect() as connection:
            query = text("""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = :schema AND table_type = 'BASE TABLE'
            """)
            count = connection.execute(query, {"schema": schema}).scalar()
            if not count:
                count = connection.execute(query, {"schema": "public"}).scalar()
            return count
    except Exception as e:
        print(f"Failed to get table count: {e}")
        return 0


def get_database_info() -> dict:
    """
    Get database connection information for debugging.

    Returns:
        dict: Database connection details (password masked)
    """
    masked_url = DATABASE_URL
    if "@" in masked_url:
        # Mask password in URL
        parts = masked_url.split("@")
        if ":" in parts[0]:
            user_pass = parts[0].split(":")
            user_pass[-1] = "***"
            parts[0] = ":".join(user_pass)
        masked_url = "@".join(parts)

    return {
        "database_url": masked_url,
        "pool_size": engine.pool.size(),
        "pool_checked_out": engine.pool.checkedout(),
        "pool_overflow": engine.pool.overflow(),
        "table_count": get_table_count(),
        "default_game_version": registry.default_slug(),
        "game_versions": [v.slug for v in registry.all()],
    }


# Database health check function
def health_check() -> dict:
    """
    Comprehensive database health check.

    Returns:
        dict: Health status and metrics
    """
    try:
        # Test basic connection
        connection_ok = test_connection()

        # Get table count
        table_count = get_table_count()

        # Check if we have the expected number of tables (20+ including migration table)
        schema_ok = table_count >= 20

        return {
            "status": "healthy" if connection_ok and schema_ok else "unhealthy",
            "connection": "ok" if connection_ok else "failed",
            "schema": "ok" if schema_ok else "incomplete",
            "table_count": table_count,
            "expected_tables": "20+",
            "default_game_version": registry.default_slug(),
            "game_versions": [v.slug for v in registry.all()],
            "pool_info": {
                "size": engine.pool.size(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow(),
            },
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "connection": "failed",
            "schema": "unknown",
        }
