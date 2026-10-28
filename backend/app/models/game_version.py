"""
Game version registry models (``public`` schema).

These are cross-version: they live in ``public`` rather than in a per-version
``gv_<slug>`` schema, so queries against them are unaffected by the request's
``search_path``. See ``database/global_migrations/`` for the registry DDL. With
the shared revision store (design.md §12) ``item_revisions`` is a read-only view
over ``gd.items`` created by ``app/core/shared_store.py``.
"""

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class GameVersion(Base):
    """One game data snapshot (live AO, PRK, a historical client build)."""

    __tablename__ = "game_versions"
    __table_args__ = {"schema": "public"}

    slug = Column(String(40), primary_key=True)
    schema_name = Column(String(64), nullable=False, unique=True)
    display_name = Column(String(120), nullable=False)
    family = Column(String(20), nullable=False)
    parent_slug = Column(
        String(40),
        ForeignKey("public.game_versions.slug", ondelete="SET NULL"),
        nullable=True,
    )
    client_build = Column(String(40))
    snapshot_date = Column(Date)
    sort_order = Column(Integer, nullable=False, default=0)
    enabled = Column(Boolean, nullable=False, default=True)
    is_default = Column(Boolean, nullable=False, default=False)
    features = Column(JSONB, nullable=False, default=dict)
    notes = Column(Text)
    # Shared store membership id (gd.items.vids) and extract provenance.
    vid = Column(SmallInteger, unique=True)
    extract_slug = Column(String(40))
    tinkerparse_commit = Column(String(64))
    rdb_dat_sha256 = Column(String(64))
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, server_default=func.current_timestamp())

    # Lineage: the snapshot this one follows.
    parent = relationship("GameVersion", remote_side=[slug], backref="children")
    item_revisions = relationship(
        "ItemRevision", back_populates="game_version", viewonly=True
    )

    def __repr__(self):
        return f"<GameVersion(slug='{self.slug}', schema='{self.schema_name}')>"


class ItemRevision(Base):
    """Content hashes for one item in one version.

    A view over the shared store: one row per (AOID, version holding that
    revision). Comparing the sub-hashes across a lineage yields the snapshots at
    which an item's definition changed.
    """

    __tablename__ = "item_revisions"
    __table_args__ = {"schema": "public"}

    aoid = Column(Integer, primary_key=True)
    version_slug = Column(
        String(40),
        ForeignKey("public.game_versions.slug", ondelete="CASCADE"),
        primary_key=True,
    )
    content_hash = Column(String(40), nullable=False)
    stats_hash = Column(String(40), nullable=False)
    spells_hash = Column(String(40), nullable=False)
    actions_hash = Column(String(40), nullable=False)
    text_hash = Column(String(40), nullable=False)
    is_nano = Column(Boolean, nullable=False, default=False)

    game_version = relationship(
        "GameVersion", back_populates="item_revisions", viewonly=True
    )

    def __repr__(self):
        return f"<ItemRevision(aoid={self.aoid}, version_slug='{self.version_slug}')>"
