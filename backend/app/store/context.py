"""
The build a request reads and the session it reads the store with.

A route takes both as dependencies::

    def my_route(db: Session = Depends(get_store), build: Build = Depends(get_build)):

``Build`` is the row of ``build`` the URL's version slug (or family alias such
as ``ao``) names: every query is scoped by its branch and ordinal, and its
``features`` and ``overlay_strain_first`` decide which curated data is served.

The session has no version state: the build is a value passed to queries, not
a ``search_path``. The store's tables are declared in a logical schema that
the session maps to ``settings.CAS_SCHEMA``, or to a throwaway schema in a
test (``store_session``).
"""

from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Iterator, List, Mapping, Optional, TypeVar

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.database import engine
from app.store import tables as t

_SCHEMA_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


@dataclass(frozen=True)
class Build:
    """One client build, as far as reading it is concerned."""

    build_id: int
    slug: str
    branch: str
    ordinal: int
    features: Mapping[str, bool] = field(hash=False)
    overlay_strain_first: bool
    is_default: bool = False

    def has(self, feature: str) -> bool:
        """Whether curated data under this feature flag is served for the build
        (``perks``, ``symbiants``, ``sources``; see 002_curated_and_derived.sql)."""
        return bool(self.features.get(feature))


Bind = TypeVar("Bind", Engine, Connection)


def _in_schema(bind: Bind, schema: str) -> Bind:
    if not _SCHEMA_NAME.match(schema):
        raise ValueError(f"Invalid store schema name: {schema!r}")
    return bind.execution_options(schema_translate_map={t.LOGICAL_SCHEMA: schema})


StoreSession = sessionmaker(
    autocommit=False, autoflush=False, bind=_in_schema(engine, settings.CAS_SCHEMA)
)


def get_store() -> Iterator[Session]:
    """FastAPI dependency: a session that reads the store."""
    session = StoreSession()
    try:
        yield session
    finally:
        session.close()


def store_session(connection: Connection, schema: str) -> Session:
    """A session on ``connection`` that reads the store in ``schema``.

    For tests that build a throwaway store inside the connection's transaction.
    """
    return Session(bind=_in_schema(connection, schema), autoflush=False)


def store_schema(db: Session) -> str:
    """The schema of the store ``db`` reads: what tells one store from
    another for anything kept between requests."""
    options = db.get_bind().get_execution_options()
    return options["schema_translate_map"][t.LOGICAL_SCHEMA]


def read_builds(db: Session) -> List[Build]:
    """The enabled builds, newest first within the version list's order."""
    rows = db.execute(
        select(
            t.build.c.build_id,
            t.build.c.slug,
            t.build.c.branch,
            t.build.c.ordinal,
            t.build.c.features,
            t.build.c.overlay_strain_first,
            t.build.c.is_default,
        )
        .where(t.build.c.enabled)
        .order_by(t.build.c.sort_order, t.build.c.slug)
    )
    return [
        Build(
            build_id=row.build_id,
            slug=row.slug,
            branch=row.branch,
            ordinal=row.ordinal,
            features=dict(row.features or {}),
            overlay_strain_first=row.overlay_strain_first,
            is_default=row.is_default,
        )
        for row in rows
    ]


def resolve_build(builds: List[Build], slug: Optional[str]) -> Optional[Build]:
    """The build a slug names, among ``builds`` in display order.

    A branch name is an alias of the branch's first build in display order
    (its newest), unless a build has that very slug. No slug means the default
    build.
    """
    if slug is None:
        return next((b for b in builds if b.is_default), None)
    for candidate in builds:
        if candidate.slug == slug:
            return candidate
    return next((b for b in builds if b.branch == slug), None)


def _read_served_builds() -> List[Build]:
    with StoreSession() as db:
        return read_builds(db)


class BuildRegistry:
    """In-process copy of a store's builds, re-read after a short time.

    ``read`` returns the builds; by default those of the store the
    application serves.
    """

    def __init__(
        self,
        ttl_seconds: Optional[int] = None,
        read: Callable[[], List[Build]] = _read_served_builds,
    ):
        self.ttl = (
            ttl_seconds
            if ttl_seconds is not None
            else settings.GAME_VERSION_REGISTRY_TTL
        )
        self._read = read
        self._lock = threading.Lock()
        self._builds: List[Build] = []
        self._loaded_at: Optional[float] = None

    def _stale(self) -> bool:
        return self._loaded_at is None or time.monotonic() - self._loaded_at > self.ttl

    def all(self) -> List[Build]:
        if self._stale():
            with self._lock:
                if self._stale():
                    self._builds = self._read()
                    self._loaded_at = time.monotonic()
        return self._builds

    def resolve(self, slug: Optional[str]) -> Optional[Build]:
        return resolve_build(self.all(), slug)


# The builds requests are resolved against: by the version middleware, which
# turns the URL's version segment into a build's slug, and by ``get_build``.
builds = BuildRegistry()


def get_build(request: Request) -> Build:
    """FastAPI dependency: the build the request's version slug names.

    ``GameVersionMiddleware`` leaves the slug in ``request.state.game_version``.
    """
    slug = getattr(request.state, "game_version", None)
    build = builds.resolve(slug)
    if build is None:
        raise HTTPException(status_code=404, detail=f"Unknown game version '{slug}'")
    return build
