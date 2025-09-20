"""
Database configuration and connection management for TinkerTools backend.
Handles PostgreSQL connection pooling and session management.
"""

import os
import logging
from typing import Generator
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import StaticPool

logger = logging.getLogger(__name__)

# Database configuration from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback for development/testing when no DATABASE_URL is set
    DATABASE_URL = "sqlite:///./test.db"

# Create SQLAlchemy engine with connection pooling
# Default pool size for normal operations
_default_pool_size = 10
_default_max_overflow = 20

# Enhanced pool size for bulk operations (as specified in import-optimizer requirements)
_bulk_pool_size = 40
_bulk_max_overflow = 60

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before use
    pool_size=_default_pool_size,        # Connection pool size
    max_overflow=_default_max_overflow,     # Additional connections beyond pool_size
    echo=os.getenv("SQL_DEBUG", "false").lower() == "true"  # Log SQL queries in debug mode
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base for ORM models
Base = declarative_base()

# Metadata for schema inspection
metadata = MetaData()

def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    Used with FastAPI's dependency injection system.
    
    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

def get_table_count() -> int:
    """
    Get the number of tables in the database.
    Used for setup verification.
    
    Returns:
        int: Number of tables in the database
    """
    try:
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            """))
            return result.scalar()
    except Exception as e:
        print(f"Failed to get table count: {e}")
        return 0

def configure_for_bulk_operations() -> bool:
    """
    Configure the database engine for bulk operations.
    Increases connection pool size for parallel processing.

    Returns:
        bool: True if successful
    """
    global engine
    try:
        # Create new engine with enhanced pool settings for bulk operations
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=_bulk_pool_size,
            max_overflow=_bulk_max_overflow,
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
        )
        logger.info(f"Database configured for bulk operations: pool_size={_bulk_pool_size}, max_overflow={_bulk_max_overflow}")
        return True
    except Exception as e:
        logger.error(f"Failed to configure database for bulk operations: {e}")
        return False


def configure_for_normal_operations() -> bool:
    """
    Configure the database engine for normal operations.
    Resets connection pool to default size.

    Returns:
        bool: True if successful
    """
    global engine
    try:
        # Create new engine with default pool settings
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=_default_pool_size,
            max_overflow=_default_max_overflow,
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
        )
        logger.info(f"Database configured for normal operations: pool_size={_default_pool_size}, max_overflow={_default_max_overflow}")
        return True
    except Exception as e:
        logger.error(f"Failed to configure database for normal operations: {e}")
        return False


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
        "table_count": get_table_count()
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
            "pool_info": {
                "size": engine.pool.size(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow()
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "connection": "failed",
            "schema": "unknown"
        }