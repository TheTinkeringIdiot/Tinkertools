"""
Tests for the game version registry endpoints.

Rows are inserted inside the test transaction and rolled back afterwards, so
the in-process registry cache (which uses its own connection and therefore
only sees committed rows) is monkeypatched to match wherever the middleware
needs it.
"""

import time
from datetime import date

import pytest
from sqlalchemy import text

from app.core import versions as versions_module
from app.core.versions import GameVersion as GameVersionDC
from app.models import GameVersion


def clear_existing_defaults(db_session):
    """Drop the is_default flag from any already-registered version.

    A real deployment database carries its own registry rows, and
    ``uq_game_versions_single_default`` allows only one default across the whole
    table. The update runs inside the test transaction and is rolled back with
    it, so the deployment's own default survives the test.
    """
    db_session.execute(
        text("UPDATE public.game_versions SET is_default = FALSE WHERE is_default")
    )


VERSION_ROWS = [
    dict(
        slug="ao-18.7",
        schema_name="gv_ao_18_7",
        display_name="Anarchy Online 18.7",
        family="ao",
        parent_slug=None,
        client_build="18.7.53",
        snapshot_date=date(2019, 11, 1),
        sort_order=30,
        enabled=True,
        is_default=False,
    ),
    dict(
        slug="ao-18.8",
        schema_name="gv_ao_18_8",
        display_name="Anarchy Online 18.8 (Live)",
        family="ao",
        parent_slug="ao-18.7",
        client_build="18.8.72",
        snapshot_date=date(2025, 6, 1),
        sort_order=20,
        enabled=True,
        is_default=True,
    ),
    dict(
        slug="prk",
        schema_name="gv_prk",
        display_name="Project Rubi-Ka",
        family="prk",
        parent_slug="ao-18.8",
        client_build="prk-1",
        snapshot_date=date(2026, 1, 15),
        sort_order=10,
        enabled=True,
        is_default=False,
    ),
]


FIXTURE_SLUGS = [row["slug"] for row in VERSION_ROWS]


def only_fixture_slugs(slugs):
    """Keep just the slugs this test inserted, in the order the API returned.

    The registry is shared with whatever the deployment database already holds,
    so assertions cover the fixture's own rows rather than the whole table.
    """
    return [slug for slug in slugs if slug in FIXTURE_SLUGS]


@pytest.fixture
def game_versions(db_session):
    """Three registered versions forming one lineage: ao-18.7 -> ao-18.8 -> prk."""
    clear_existing_defaults(db_session)

    created = []
    # Inserted parent-first so the self-referential foreign key is satisfied.
    for row in VERSION_ROWS:
        version = GameVersion(**row)
        db_session.add(version)
        db_session.flush()
        created.append(version)
    return created


@pytest.fixture
def disabled_version(db_session, game_versions):
    """A registered but disabled version, which the API must hide."""
    version = GameVersion(
        slug="ao-15.0",
        schema_name="gv_ao_15_0",
        display_name="Anarchy Online 15.0",
        family="ao",
        parent_slug=None,
        sort_order=90,
        enabled=False,
        is_default=False,
    )
    db_session.add(version)
    db_session.flush()
    return version


@pytest.fixture
def patched_registry(monkeypatch):
    """Point the in-process registry at the same three versions.

    The middleware resolves version slugs through this cache on its own
    connection, which cannot see the test transaction's uncommitted rows.
    """
    registry = versions_module.registry
    cached = {
        row["slug"]: GameVersionDC(
            slug=row["slug"],
            schema_name=row["schema_name"],
            display_name=row["display_name"],
            family=row["family"],
            parent_slug=row["parent_slug"],
            client_build=row["client_build"],
            snapshot_date=row["snapshot_date"],
            sort_order=row["sort_order"],
            enabled=row["enabled"],
            is_default=row["is_default"],
        )
        for row in VERSION_ROWS
    }
    monkeypatch.setattr(registry, "_versions", cached, raising=False)
    monkeypatch.setattr(registry, "_loaded_at", time.monotonic(), raising=False)
    yield registry
    # monkeypatch restores the attributes; force a reload for later tests.
    registry.invalidate()


class TestListVersions:
    """GET /api/v1/versions"""

    def test_lists_enabled_versions_in_display_order(self, client, game_versions):
        response = client.get("/api/v1/versions")
        assert response.status_code == 200

        data = response.json()
        slugs = [v["slug"] for v in data["versions"]]
        assert data["total"] == len(slugs)
        assert only_fixture_slugs(slugs) == ["prk", "ao-18.8", "ao-18.7"]

    def test_excludes_disabled_versions(self, client, disabled_version):
        response = client.get("/api/v1/versions")
        assert response.status_code == 200

        slugs = [v["slug"] for v in response.json()["versions"]]
        assert "ao-15.0" not in slugs

    def test_exposes_registry_fields_but_not_schema_name(self, client, game_versions):
        response = client.get("/api/v1/versions")
        prk = next(v for v in response.json()["versions"] if v["slug"] == "prk")

        assert prk["display_name"] == "Project Rubi-Ka"
        assert prk["family"] == "prk"
        assert prk["parent_slug"] == "ao-18.8"
        assert prk["client_build"] == "prk-1"
        assert prk["snapshot_date"] == "2026-01-15"
        assert prk["features"] == {}
        assert "schema_name" not in prk

    def test_marks_the_request_version_as_current(
        self, client, game_versions, patched_registry
    ):
        response = client.get("/api/v1/prk/versions")
        assert response.status_code == 200

        current = [v["slug"] for v in response.json()["versions"] if v["is_current"]]
        assert current == ["prk"]


class TestGetVersion:
    """GET /api/v1/versions/{slug}"""

    def test_returns_known_version(self, client, game_versions):
        response = client.get("/api/v1/versions/ao-18.7")
        assert response.status_code == 200
        assert response.json()["display_name"] == "Anarchy Online 18.7"

    def test_unknown_slug_returns_404(self, client, game_versions):
        response = client.get("/api/v1/versions/nope")
        assert response.status_code == 404

    def test_disabled_slug_returns_404(self, client, disabled_version):
        response = client.get("/api/v1/versions/ao-15.0")
        assert response.status_code == 404


class TestCurrentVersion:
    """GET /api/v1/versions/current"""

    def test_unversioned_url_resolves_to_the_default_version(
        self, client, game_versions, patched_registry
    ):
        response = client.get("/api/v1/versions/current")
        assert response.status_code == 200

        data = response.json()
        assert data["slug"] == "ao-18.8"
        assert data["is_default"] is True
        assert data["is_current"] is True

    def test_versioned_url_resolves_to_that_version(
        self, client, game_versions, patched_registry
    ):
        response = client.get("/api/v1/prk/versions/current")
        assert response.status_code == 200

        data = response.json()
        assert data["slug"] == "prk"
        assert data["is_current"] is True

    def test_sets_the_game_version_response_header(
        self, client, game_versions, patched_registry
    ):
        response = client.get("/api/v1/prk/versions/current")
        assert response.headers["X-Game-Version"] == "prk"

        response = client.get("/api/v1/versions/current")
        assert response.headers["X-Game-Version"] == "ao-18.8"

    def test_unknown_version_segment_is_not_stripped(
        self, client, game_versions, patched_registry
    ):
        # "not-a-version" is not in the registry: fail loudly rather than serve
        # the default version's data under someone else's slug.
        response = client.get("/api/v1/not-a-version/versions/current")
        assert response.status_code == 404
        assert response.json()["detail"] == "Unknown game version 'not-a-version'"

    def test_api_routes_are_never_taken_for_versions(
        self, client, game_versions, patched_registry
    ):
        response = client.get("/api/v1/versions/current")
        assert response.status_code == 200
        assert "X-Game-Version-Fallback" not in response.headers

    def test_missing_registry_serves_any_slug_from_the_default(
        self, client, monkeypatch
    ):
        # public.game_versions missing or empty: the frontend still prefixes a
        # slug, and the API must degrade to the default version, not 404.
        registry = versions_module.registry
        monkeypatch.setattr(registry, "_versions", {}, raising=False)
        monkeypatch.setattr(registry, "_loaded_at", time.monotonic(), raising=False)

        response = client.get("/api/v1/ao-2024-02/stat-values", params={"page_size": 1})
        registry.invalidate()

        assert response.status_code != 404
        assert response.headers["X-Game-Version-Fallback"] == "ao-2024-02"

    def test_unregistered_default_returns_404(self, client, monkeypatch):
        # The configured default has no registry row yet (pre-import state).
        registry = versions_module.registry
        monkeypatch.setattr(registry, "_versions", {}, raising=False)
        monkeypatch.setattr(registry, "_loaded_at", time.monotonic(), raising=False)
        monkeypatch.setattr(
            versions_module.settings, "DEFAULT_GAME_VERSION", "zz-unregistered"
        )

        response = client.get("/api/v1/versions/current")
        registry.invalidate()

        assert response.status_code == 404
