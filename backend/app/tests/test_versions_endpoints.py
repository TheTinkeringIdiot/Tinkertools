"""
The versions the API serves (GET /versions) and how a request's version is
resolved (GameVersionMiddleware), on a store whose builds the test makes.
"""

from datetime import date

import pytest

from app.core.config import settings
from app.tests.fixtures.store_fixtures import item


@pytest.fixture
def versions(store):
    """Two AO builds, the newer one the default, and a PRK build forked from
    the older: ao-18.7 -> ao-18.8, ao-18.7 -> prk."""
    store.add_build(
        "ao-18.7",
        1,
        items=[item(100)],
        display_name="Anarchy Online 18.7",
        client_build="18.7.53",
        released_on=date(2019, 11, 1),
        sort_order=30,
        features={"items": True, "perks": False},
    )
    store.add_build(
        "ao-18.8",
        2,
        items=[item(100)],
        display_name="Anarchy Online 18.8 (Live)",
        client_build="18.8.72",
        released_on=date(2025, 6, 1),
        sort_order=20,
        is_default=True,
        notes="Captured from the live client",
    )
    store.add_build(
        "prk",
        1,
        branch="prk",
        items=[item(100)],
        display_name="Project Rubi-Ka",
        client_build="prk-1",
        released_on=date(2026, 1, 15),
        sort_order=10,
        parent_slug="ao-18.7",
    )
    return store


def listed(client, url="/api/v1/versions"):
    response = client.get(url)
    assert response.status_code == 200
    return response.json()


def current_versions(data):
    """Slugs the list marks as the version the request was served from."""
    return [v["slug"] for v in data["versions"] if v["is_current"]]


class TestListVersions:
    """GET /api/v1/versions"""

    def test_lists_enabled_versions_in_display_order(self, versions):
        with versions.client() as client:
            data = listed(client)

        slugs = [v["slug"] for v in data["versions"]]
        # the 'latest' alias of a family first, then the builds
        assert slugs == ["ao", "prk", "ao-18.8", "ao-18.7"]
        assert data["total"] == 4

    def test_excludes_disabled_versions(self, versions):
        versions.add_build("ao-18.9", 3, items=[item(100)], enabled=False, sort_order=5)

        with versions.client() as client:
            data = listed(client)

        assert "ao-18.9" not in [v["slug"] for v in data["versions"]]
        assert [v["alias_of"] for v in data["versions"] if v["slug"] == "ao"] == [
            "ao-18.8"
        ]

    def test_describes_a_version_with_what_the_importer_stored(self, versions):
        with versions.client() as client:
            by_slug = {v["slug"]: v for v in listed(client)["versions"]}

        assert by_slug["ao-18.8"] == {
            "slug": "ao-18.8",
            "display_name": "Anarchy Online 18.8 (Live)",
            "family": "ao",
            "parent_slug": "ao-18.7",
            "client_build": "18.8.72",
            "snapshot_date": "2025-06-01",
            "sort_order": 20,
            "enabled": True,
            "is_default": True,
            "features": {
                "items": True,
                "nanos": True,
                "perks": True,
                "sources": True,
                "symbiants": True,
            },
            "notes": "Captured from the live client",
            "alias_of": None,
            "is_current": True,
        }
        assert by_slug["ao-18.7"]["features"] == {"items": True, "perks": False}
        assert by_slug["ao-18.7"]["snapshot_date"] == "2019-11-01"

    def test_a_version_follows_the_build_before_it_or_the_one_it_forked_from(
        self, versions
    ):
        with versions.client() as client:
            parents = {v["slug"]: v["parent_slug"] for v in listed(client)["versions"]}

        assert parents["ao-18.7"] is None
        assert parents["ao-18.8"] == "ao-18.7"
        assert parents["prk"] == "ao-18.7"

    def test_a_disabled_build_is_still_the_parent_of_the_one_after_it(self, store):
        store.add_build("ao-1", 1, items=[item(100)], enabled=False)
        store.add_build("ao-2", 2, items=[item(100)])

        with store.client() as client:
            parents = {v["slug"]: v["parent_slug"] for v in listed(client)["versions"]}

        assert parents == {"ao": "ao-1", "ao-2": "ao-1"}

    def test_a_store_without_builds_lists_nothing(self, store):
        with store.client() as client:
            data = listed(client)

        assert (data["versions"], data["total"]) == ([], 0)
        assert data["current"] == settings.DEFAULT_GAME_VERSION


class TestVersionResolution:
    """How the middleware picks the version, seen through GET /api/v1/versions."""

    def test_unversioned_url_resolves_to_the_default_version(self, versions):
        with versions.client() as client:
            data = listed(client)

        assert data["current"] == "ao-18.8"
        assert current_versions(data) == ["ao-18.8"]
        assert [v["slug"] for v in data["versions"] if v["is_default"]] == [
            "ao",
            "ao-18.8",
        ]

    def test_versioned_url_resolves_to_that_version(self, versions):
        with versions.client() as client:
            data = listed(client, "/api/v1/ao-18.7/versions")

        assert data["current"] == "ao-18.7"
        assert current_versions(data) == ["ao-18.7"]

    def test_the_version_decides_which_data_a_route_reads(self, store):
        store.add_build("ao-1", 1, items=[item(100, name="Wrench")])
        store.add_build("ao-2", 2, items=[item(100, name="Spanner")], is_default=True)

        with store.client() as client:
            names = [
                client.get(f"/api/v1{prefix}/items/100").json()["name"]
                for prefix in ("/ao-1", "/ao-2", "/ao", "")
            ]

        assert names == ["Wrench", "Spanner", "Spanner", "Spanner"]

    def test_sets_the_game_version_response_header(self, versions):
        with versions.client() as client:
            named = client.get("/api/v1/prk/versions")
            unnamed = client.get("/api/v1/versions")

        assert named.headers["X-Game-Version"] == "prk"
        assert unnamed.headers["X-Game-Version"] == "ao-18.8"

    def test_unknown_version_segment_is_not_stripped(self, versions):
        # "not-a-version" is no build: fail loudly rather than serve the
        # default version's data under someone else's slug.
        with versions.client() as client:
            response = client.get("/api/v1/not-a-version/versions")

        assert response.status_code == 404
        assert response.json()["detail"] == "Unknown game version 'not-a-version'"

    def test_a_disabled_build_is_an_unknown_version(self, versions):
        versions.add_build("ao-18.9", 3, items=[item(100)], enabled=False)

        with versions.client() as client:
            response = client.get("/api/v1/ao-18.9/items/100")

        assert response.status_code == 404
        assert response.json()["detail"] == "Unknown game version 'ao-18.9'"

    def test_api_routes_are_never_taken_for_versions(self, store):
        store.add_build("ao-1", 1, items=[item(100)])

        with store.client() as client:
            response = client.get("/api/v1/versions")

        assert response.status_code == 200
        assert response.headers["X-Game-Version"] == "ao-1"

    def test_without_a_default_build_the_configured_family_is_served(self, store):
        store.add_build("ao-1", 1, items=[item(100)])
        store.add_build("ao-2", 2, items=[item(100)])
        store.add_build("prk-1", 1, branch="prk", items=[item(100)], sort_order=1)
        assert settings.DEFAULT_GAME_VERSION == "ao"

        with store.client() as client:
            data = listed(client)

        assert data["current"] == "ao-2"

    def test_an_empty_store_knows_no_version(self, store):
        with store.client() as client:
            named = client.get("/api/v1/ao-1/items/100")
            unnamed = client.get("/api/v1/items/100")

        assert named.status_code == 404
        assert named.json()["detail"] == "Unknown game version 'ao-1'"
        assert unnamed.status_code == 404

    def test_requests_outside_the_api_carry_no_version(self, versions):
        with versions.client() as client:
            response = client.get("/health")

        assert response.status_code == 200
        assert "X-Game-Version" not in response.headers


class TestFamilyAlias:
    """The family name is a slug that follows the family's newest version."""

    def test_the_list_offers_a_latest_entry_for_the_family(self, versions):
        with versions.client() as client:
            entries = listed(client)["versions"]
        alias = next(v for v in entries if v["slug"] == "ao")

        assert alias["alias_of"] == "ao-18.8"
        assert alias["display_name"] == "AO - Latest"
        assert alias["client_build"] == "18.8.72"
        assert alias["is_default"] is True
        assert alias["is_current"] is False
        assert [v["alias_of"] for v in entries if v["slug"] == "ao-18.8"] == [None]

    def test_a_real_version_named_like_its_family_is_not_shadowed(self, versions):
        with versions.client() as client:
            prk = [v for v in listed(client)["versions"] if v["slug"] == "prk"]

        assert len(prk) == 1
        assert prk[0]["alias_of"] is None

    def test_requests_under_the_alias_are_served_from_the_newest_version(
        self, versions
    ):
        with versions.client() as client:
            response = client.get("/api/v1/ao/versions")

        assert response.status_code == 200
        assert response.json()["current"] == "ao-18.8"
        assert current_versions(response.json()) == ["ao-18.8"]
        assert response.headers["X-Game-Version"] == "ao-18.8"

    def test_the_alias_moves_when_a_newer_version_is_stored(self, versions):
        versions.add_build(
            "ao-18.9", 3, items=[item(100)], display_name="AO 18.9", sort_order=15
        )

        with versions.client() as client:
            entries = listed(client)["versions"]

        alias = next(v for v in entries if v["slug"] == "ao")
        assert alias["alias_of"] == "ao-18.9"
