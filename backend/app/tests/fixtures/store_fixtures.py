"""
A throwaway content-addressed store for read-path tests.

The ``store`` fixture creates an empty store in a schema of its own, inside a
transaction that is rolled back when the test ends, exactly as the importer's
tests do. A test fills it with hand-made builds through the real importer and
then calls the API, or the read layer, against it::

    def test_an_item_is_served_as_of_the_requested_build(store):
        store.add_build("old", 1, items=[item(100, name="Wrench", ql=10)])
        store.add_build("new", 2, items=[item(100, name="Spanner", ql=10)])

        with store.client("old") as client:
            assert client.get("/api/v1/items/100").json()["name"] == "Wrench"

``item``, ``nano``, ``modify`` and ``criterion`` build raw records as the
extracts hold them; they are the helpers of ``test_cas_store``.

Use this when a test needs data it controls: several builds of one item,
feature flags, curated data, an exact page of results. A test that only checks
a route against the real game data needs none of it: the ``client`` fixture
reads the development store.
"""

from __future__ import annotations

import os
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import ClauseElement, Executable, Select

from app.core import cas_store, change_analysis
from app.core.cache import cache_service
from app.core.cas_curated import sync_curated
from app.core.change_rules import ChangeRules, default_rules, parse_notes
from app.main import app
from app.store.context import (
    Build,
    get_build,
    get_store,
    read_builds,
    resolve_build,
    store_session,
)
from app.tests.test_cas_store import (  # noqa: F401 - re-exported for tests
    criterion,
    curated_files,
    item,
    load,
    modify,
    nano,
    spec,
)

ALL_FEATURES = {
    "items": True,
    "nanos": True,
    "perks": True,
    "sources": True,
    "symbiants": True,
}


class _Explain(Executable, ClauseElement):
    inherit_cache = False

    def __init__(self, statement: Select):
        self.statement = statement


@compiles(_Explain)
def _compile_explain(element, compiler, **kw):
    return "EXPLAIN (COSTS OFF) " + compiler.process(element.statement, **kw)


class ThrowawayStore:
    """An empty store in its own schema, filled by the test that owns it."""

    def __init__(self, connection: Connection, schema: str, tmp_path: Path):
        self._connection = connection
        self._raw = connection.connection.driver_connection
        self._tmp_path = tmp_path
        self.schema = schema
        self.db: Session = store_session(connection, schema)

    def add_build(
        self,
        slug: str,
        ordinal: int,
        items: Sequence[Dict[str, Any]] = (),
        nanos: Sequence[Dict[str, Any]] = (),
        branch: str = "ao",
        **fields: Any,
    ) -> Optional[Build]:
        """Import a build made of raw item and nano records; every feature is
        on unless ``features`` says otherwise.

        ``fields`` are fields of the importer's ``BuildSpec``: ``display_name``
        (the slug by default), ``enabled``, ``client_build``, ``released_on``,
        ``parent_slug``, ``is_default``. Returns the build as requests read
        it, or None for a build stored with ``enabled=False``, which no
        request can name.
        """
        fields.setdefault("features", dict(ALL_FEATURES))
        fields.setdefault("sort_order", 1000 - ordinal)
        load(
            self._raw,
            spec(slug, ordinal, branch=branch, **fields),
            items=items,
            nanos=nanos,
        )
        return self.build(slug) if fields.get("enabled", True) else None

    def curate(self, mobs: Iterable[tuple] = (), nanos: str = "") -> None:
        """Load curated data: ``mobs`` as ``(boss, playfield, item aoid)``
        rows of symbiants.csv, ``nanos`` as rows of the nano CSV
        (``nano_id,ql,crystal_ids,nano_name,strain_id,sub_strain_id``)."""
        sync_curated(self._raw, curated_files(self._tmp_path, list(mobs), nanos))
        cas_store.apply_nano_overlay(self._raw)

    def note_changes(self, notes: str) -> None:
        """Apply build notes, written as ``build_notes.toml`` is, to the
        change log of the builds loaded so far. Builds are imported with the
        notes of the repository's file, which name real builds only."""
        change_analysis.analyze(
            self._raw,
            ChangeRules(relevance=default_rules().relevance, notes=parse_notes(notes)),
        )

    def sync_changes(self, rules: Optional[ChangeRules] = None) -> None:
        """Bring the change log in line with ``rules`` (the repository's by
        default) and record what it was analysed with, as every import run
        does."""
        change_analysis.sync(self._raw, rules or default_rules())

    def builds(self) -> List[Build]:
        return read_builds(self.db)

    def build(self, slug: str) -> Build:
        found = resolve_build(self.builds(), slug)
        if found is None:
            raise KeyError(slug)
        return found

    @contextmanager
    def client(self, slug: Optional[str] = None) -> Iterator[TestClient]:
        """A test client whose requests read build ``slug`` of this store.

        Without ``slug`` each request reads the build its URL names, as in
        production. The version segment of a URL is resolved by the version
        registry before the store is asked, so such a test gives its builds
        slugs the registry knows (``registry.all()``, ``registry.aliases()``).
        """
        fixed = self.build(slug) if slug is not None else None
        known = self.builds()

        def build_of(request: Request) -> Build:
            found = fixed or resolve_build(known, request.state.game_version)
            if found is None:
                raise KeyError(request.state.game_version)
            return found

        app.dependency_overrides[get_store] = lambda: self.db
        app.dependency_overrides[get_build] = build_of
        cache_service.clear()
        try:
            with TestClient(app) as client:
                yield client
        finally:
            app.dependency_overrides.pop(get_store, None)
            app.dependency_overrides.pop(get_build, None)
            cache_service.clear()

    @contextmanager
    def bitmap_scans_only(self) -> Iterator[None]:
        """Has the planner read each table on its own through index
        conditions while the block runs, as it reads a full-size table for a
        selective condition. A handful of rows is otherwise read whole, or
        looked up by key from the row it is joined to, whatever indexes the
        table has."""
        settings = (
            "enable_seqscan",
            "enable_indexscan",
            "enable_indexonlyscan",
            "enable_nestloop",
        )
        for setting in settings:
            self._raw.execute(f"SET LOCAL {setting} = off")
        try:
            yield
        finally:
            for setting in settings:
                self._raw.execute(f"SET LOCAL {setting} = on")

    def plan(self, statement: Select) -> str:
        """The plan PostgreSQL makes for ``statement`` on this store."""
        return "\n".join(self.db.execute(_Explain(statement)).scalars())

    @contextmanager
    def counting_queries(self) -> Iterator[List[str]]:
        """Collects the statements that read the store while the block runs:
        everything sent to it but the settings of a transaction (``SET
        LOCAL``, ``RESET``)."""
        statements: List[str] = []

        def record(conn, cursor, statement, parameters, context, executemany):
            if not statement.startswith(("SET LOCAL", "RESET")):
                statements.append(statement)

        event.listen(self._connection, "before_cursor_execute", record)
        try:
            yield statements
        finally:
            event.remove(self._connection, "before_cursor_execute", record)


@pytest.fixture
def store(tmp_path) -> Iterator[ThrowawayStore]:
    url = cas_store.libpq_url(os.environ["DATABASE_URL"]).replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
    engine = create_engine(url)
    connection = engine.connect()
    transaction = connection.begin()
    schema = f"cas_test_{uuid.uuid4().hex[:12]}"
    try:
        raw = connection.connection.driver_connection
        cas_store.use_schema(raw, schema, local=True)
        cas_store.create_store(raw, schema)
        yield ThrowawayStore(connection, schema, tmp_path)
    finally:
        transaction.rollback()
        connection.close()
        engine.dispose()
