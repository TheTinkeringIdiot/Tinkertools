"""
The database connection of the TinkerTools backend.

One engine, one pool. Game data is read through ``app.store``, whose sessions
are bound to this engine and to the schema of the content-addressed store.
"""

import os

from sqlalchemy import create_engine

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=os.getenv("SQL_DEBUG", "false").lower() == "true",
)
