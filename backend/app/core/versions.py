"""
Game version registry.

TinkerTools serves several snapshots of the game database (live AO, PRK,
historical client builds). Each snapshot lives in its own PostgreSQL schema,
``gv_<slug>``, holding the full per-version table set. ``public.game_versions``
is the registry of known snapshots; this module caches it in-process and maps a
version slug to its schema.

``current_version`` is a context variable set by ``GameVersionMiddleware`` for
the duration of a request and read by ``get_db`` and the response cache.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import text

from app.core.config import settings

logger = logging.getLogger(__name__)

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{0,39}$")
SCHEMA_RE = re.compile(r"^gv_[a-z0-9_]{1,60}$")
SCHEMA_PREFIX = "gv_"

# Version slug for the current request (None outside a request).
current_version: ContextVar[Optional[str]] = ContextVar("current_game_version", default=None)


class InvalidVersionSlug(ValueError):
    pass


def validate_slug(slug: str) -> str:
    if not isinstance(slug, str) or not SLUG_RE.match(slug):
        raise InvalidVersionSlug(
            f"Invalid game version slug {slug!r}: must match {SLUG_RE.pattern}"
        )
    return slug


def schema_name_for(slug: str) -> str:
    """Derive the schema name for a slug: gv_ + slug with '.' and '-' as '_'."""
    validate_slug(slug)
    schema = SCHEMA_PREFIX + re.sub(r"[.-]", "_", slug)
    if not SCHEMA_RE.match(schema):
        raise InvalidVersionSlug(f"Slug {slug!r} maps to invalid schema name {schema!r}")
    return schema


def validate_schema_name(schema: str) -> str:
    if not SCHEMA_RE.match(schema):
        raise InvalidVersionSlug(f"Invalid schema name {schema!r}")
    return schema


@dataclass
class GameVersion:
    slug: str
    schema_name: str
    display_name: str
    family: str
    parent_slug: Optional[str] = None
    client_build: Optional[str] = None
    snapshot_date: Optional[date] = None
    sort_order: int = 0
    enabled: bool = True
    is_default: bool = False
    features: Dict = field(default_factory=dict)
    notes: Optional[str] = None


class VersionRegistry:
    """In-process cache of public.game_versions with a short TTL."""

    def __init__(self, ttl_seconds: Optional[int] = None):
        self.ttl = ttl_seconds if ttl_seconds is not None else settings.GAME_VERSION_REGISTRY_TTL
        self._lock = threading.Lock()
        self._versions: Dict[str, GameVersion] = {}
        self._loaded_at: float = 0.0
        self._warned_missing = False

    # -- loading -----------------------------------------------------------

    def _stale(self) -> bool:
        return (time.monotonic() - self._loaded_at) > self.ttl

    def _load(self) -> None:
        # Imported lazily: app.core.database imports this module.
        from app.core.database import engine

        if engine.dialect.name != "postgresql":
            self._versions = {}
            self._loaded_at = time.monotonic()
            return

        try:
            with engine.connect() as conn:
                rows = conn.execute(text(
                    """
                    SELECT slug, schema_name, display_name, family, parent_slug,
                           client_build, snapshot_date, sort_order, enabled,
                           is_default, features, notes
                    FROM public.game_versions
                    ORDER BY sort_order, slug
                    """
                )).mappings().all()
        except Exception as exc:  # table missing (pre-migration) or DB down
            if not self._warned_missing:
                logger.warning("Game version registry unavailable, serving default only: %s", exc)
                self._warned_missing = True
            self._versions = {}
            self._loaded_at = time.monotonic()
            return

        self._warned_missing = False
        self._versions = {
            r["slug"]: GameVersion(
                slug=r["slug"],
                schema_name=r["schema_name"],
                display_name=r["display_name"],
                family=r["family"],
                parent_slug=r["parent_slug"],
                client_build=r["client_build"],
                snapshot_date=r["snapshot_date"],
                sort_order=r["sort_order"],
                enabled=r["enabled"],
                is_default=r["is_default"],
                features=dict(r["features"] or {}),
                notes=r["notes"],
            )
            for r in rows
        }
        self._loaded_at = time.monotonic()

    def _ensure(self) -> None:
        if self._stale():
            with self._lock:
                if self._stale():
                    self._load()

    def invalidate(self) -> None:
        with self._lock:
            self._loaded_at = 0.0

    # -- queries -----------------------------------------------------------

    def all(self, enabled_only: bool = True) -> List[GameVersion]:
        self._ensure()
        versions = list(self._versions.values())
        if enabled_only:
            versions = [v for v in versions if v.enabled]
        return sorted(versions, key=lambda v: (v.sort_order, v.slug))

    def get(self, slug: str) -> Optional[GameVersion]:
        self._ensure()
        return self._versions.get(slug)

    def is_available(self) -> bool:
        """Whether the registry holds any versions. False when public.game_versions
        is missing, empty, or unreadable (pre-migration, pre-import, DB trouble)."""
        self._ensure()
        return bool(self._versions)

    def is_version(self, slug: str, enabled_only: bool = True) -> bool:
        v = self.get(slug)
        return v is not None and (v.enabled or not enabled_only)

    def default_slug(self) -> str:
        self._ensure()
        for v in self._versions.values():
            if v.is_default and v.enabled:
                return v.slug
        return settings.DEFAULT_GAME_VERSION

    def schema_for(self, slug: Optional[str]) -> str:
        """Schema for a slug. Unknown slugs fall back to the derived name so the
        app keeps working before the registry is populated."""
        slug = slug or self.default_slug()
        v = self.get(slug)
        if v is not None:
            return validate_schema_name(v.schema_name)
        return schema_name_for(slug)


registry = VersionRegistry()


def resolve_current_slug() -> str:
    """Slug for the current request, or the default outside a request."""
    return current_version.get() or registry.default_slug()
