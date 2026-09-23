"""
Tests for cross-version item change history.

``compute_revision_points`` is a pure function over registry rows and revision
rows, so most of the coverage here is plain unit tests with lightweight stubs.
The two endpoints get one round trip each against inserted rows.
"""

from datetime import date
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from app.api.routes.item_revisions import compute_revision_points
from app.models import GameVersion, ItemRevision

# Slugs the endpoint fixtures insert. The deployment database has its own
# registry rows, so assertions filter the API's version lists down to these.
FIXTURE_SLUGS = ["ao-18.7", "ao-18.8", "prk"]


def only_fixture_slugs(slugs):
    """Keep just the fixture's own slugs, in the order the API returned."""
    return [slug for slug in slugs if slug in FIXTURE_SLUGS]


def make_version(slug, parent_slug=None, sort_order=0, enabled=True):
    """Minimal stand-in for a GameVersion row."""
    return SimpleNamespace(
        slug=slug,
        parent_slug=parent_slug,
        sort_order=sort_order,
        enabled=enabled,
        display_name=slug.upper(),
        family="ao",
        snapshot_date=None,
        client_build=None,
    )


def make_row(slug, stats="s", spells="p", actions="a", text="t"):
    """Minimal stand-in for an ItemRevision row."""
    return SimpleNamespace(
        aoid=1,
        version_slug=slug,
        content_hash=f"{stats}{spells}{actions}{text}",
        stats_hash=stats,
        spells_hash=spells,
        actions_hash=actions,
        text_hash=text,
    )


# ao-18.7 -> ao-18.8 -> prk, displayed newest lineage first.
LINEAGE = [
    make_version("ao-18.7", parent_slug=None, sort_order=30),
    make_version("ao-18.8", parent_slug="ao-18.7", sort_order=20),
    make_version("prk", parent_slug="ao-18.8", sort_order=10),
]


class TestComputeRevisionPoints:
    """Unit tests for the lineage walk."""

    def test_no_rows_yields_no_points(self):
        assert compute_revision_points(LINEAGE, []) == []

    def test_single_version_is_first_seen(self):
        points = compute_revision_points(LINEAGE, [make_row("ao-18.7")])

        assert len(points) == 1
        assert points[0].version_slug == "ao-18.7"
        assert points[0].first_seen is True
        assert points[0].changed == []

    def test_stat_change_between_snapshots(self):
        rows = [
            make_row("ao-18.7", stats="s1"),
            make_row("ao-18.8", stats="s2"),
        ]
        points = compute_revision_points(LINEAGE, rows)

        # Display order puts ao-18.8 (sort_order 20) before ao-18.7 (30).
        assert [p.version_slug for p in points] == ["ao-18.8", "ao-18.7"]
        change = points[0]
        assert change.first_seen is False
        assert change.changed == ["stats"]
        assert points[1].first_seen is True

    def test_unchanged_child_emits_no_point(self):
        rows = [
            make_row("ao-18.7"),
            make_row("ao-18.8"),
            make_row("prk"),
        ]
        points = compute_revision_points(LINEAGE, rows)

        # prk inherits ao-18.8's definition unchanged, so it is not a patch point.
        assert [p.version_slug for p in points] == ["ao-18.7"]
        assert points[0].first_seen is True

    def test_prk_text_change_emits_point(self):
        rows = [
            make_row("ao-18.7"),
            make_row("ao-18.8"),
            make_row("prk", text="t2"),
        ]
        points = compute_revision_points(LINEAGE, rows)

        assert [p.version_slug for p in points] == ["prk", "ao-18.7"]
        assert points[0].changed == ["text"]
        assert points[0].first_seen is False

    def test_reports_every_changed_sub_hash_in_order(self):
        rows = [
            make_row("ao-18.7"),
            make_row("ao-18.8", stats="s2", spells="p2", actions="a2", text="t2"),
        ]
        points = compute_revision_points(LINEAGE, rows)

        assert points[0].changed == ["stats", "spells", "actions", "text"]

    def test_missing_middle_snapshot_compares_against_nearest_ancestor(self):
        # The item is absent from ao-18.8, so prk compares against ao-18.7.
        rows = [
            make_row("ao-18.7", stats="s1"),
            make_row("prk", stats="s2"),
        ]
        points = compute_revision_points(LINEAGE, rows)

        assert [p.version_slug for p in points] == ["prk", "ao-18.7"]
        assert points[0].changed == ["stats"]
        assert points[0].first_seen is False

    def test_missing_middle_snapshot_with_no_change_emits_nothing(self):
        rows = [make_row("ao-18.7"), make_row("prk")]
        points = compute_revision_points(LINEAGE, rows)

        assert [p.version_slug for p in points] == ["ao-18.7"]

    def test_separate_lineage_is_first_seen_on_its_own(self):
        versions = [
            make_version("ao-18.7", parent_slug=None, sort_order=30),
            make_version("prk", parent_slug=None, sort_order=10),
        ]
        rows = [make_row("ao-18.7"), make_row("prk")]
        points = compute_revision_points(versions, rows)

        assert [(p.version_slug, p.first_seen) for p in points] == [
            ("prk", True),
            ("ao-18.7", True),
        ]

    def test_rows_for_unknown_versions_are_ignored(self):
        rows = [make_row("ao-18.7"), make_row("ao-15.0", stats="s9")]
        points = compute_revision_points(LINEAGE, rows)

        assert [p.version_slug for p in points] == ["ao-18.7"]

    def test_parent_cycle_does_not_hang(self):
        versions = [
            make_version("a", parent_slug="b", sort_order=1),
            make_version("b", parent_slug="a", sort_order=2),
        ]
        rows = [make_row("a", stats="s1"), make_row("b", stats="s2")]

        points = compute_revision_points(versions, rows)

        # Both resolve a predecessor via the cycle; neither walk loops forever.
        assert [p.version_slug for p in points] == ["a", "b"]
        assert all(p.changed == ["stats"] for p in points)

    def test_self_parent_does_not_hang(self):
        versions = [make_version("a", parent_slug="a", sort_order=1)]
        points = compute_revision_points(versions, [make_row("a")])

        assert [(p.version_slug, p.first_seen) for p in points] == [("a", True)]


@pytest.fixture
def revision_data(db_session):
    """Three versions in one lineage plus revision rows for two items.

    aoid 4242 changes stats in ao-18.8 and text in prk.
    aoid 7 exists only in ao-18.7.
    """
    # Only one row in the whole table may be is_default; clear any existing one
    # inside the test transaction, which is rolled back afterwards.
    db_session.execute(
        text("UPDATE public.game_versions SET is_default = FALSE WHERE is_default")
    )

    rows = [
        dict(
            slug="ao-18.7",
            schema_name="gv_ao_18_7",
            display_name="AO 18.7",
            family="ao",
            parent_slug=None,
            sort_order=30,
            snapshot_date=date(2019, 11, 1),
        ),
        dict(
            slug="ao-18.8",
            schema_name="gv_ao_18_8",
            display_name="AO 18.8",
            family="ao",
            parent_slug="ao-18.7",
            sort_order=20,
            is_default=True,
            snapshot_date=date(2025, 6, 1),
        ),
        dict(
            slug="prk",
            schema_name="gv_prk",
            display_name="PRK",
            family="prk",
            parent_slug="ao-18.8",
            sort_order=10,
            snapshot_date=date(2026, 1, 15),
        ),
    ]
    for row in rows:
        db_session.add(GameVersion(**row))
        db_session.flush()

    revisions = [
        ("ao-18.7", 4242, "s1", "p1", "a1", "t1"),
        ("ao-18.8", 4242, "s2", "p1", "a1", "t1"),
        ("prk", 4242, "s2", "p1", "a1", "t2"),
        ("ao-18.7", 7, "x1", "x1", "x1", "x1"),
    ]
    for slug, aoid, stats, spells, actions, text_value in revisions:
        db_session.add(
            ItemRevision(
                aoid=aoid,
                version_slug=slug,
                content_hash=stats + spells + actions + text_value,
                stats_hash=stats,
                spells_hash=spells,
                actions_hash=actions,
                text_hash=text_value,
            )
        )
    db_session.flush()


class TestItemRevisionsEndpoint:
    """GET /api/v1/items/{aoid}/revisions"""

    def test_returns_change_points_and_presence(self, client, revision_data):
        response = client.get("/api/v1/items/4242/revisions")
        assert response.status_code == 200

        data = response.json()
        assert data["aoid"] == 4242
        assert data["present_in"] == ["prk", "ao-18.8", "ao-18.7"]
        assert only_fixture_slugs(data["missing_in"]) == []
        assert [
            (r["version_slug"], r["changed"], r["first_seen"])
            for r in data["revisions"]
        ] == [
            ("prk", ["text"], False),
            ("ao-18.8", ["stats"], False),
            ("ao-18.7", [], True),
        ]
        assert data["first_seen_in"] == "ao-18.7"

    def test_reports_versions_the_item_is_missing_from(self, client, revision_data):
        response = client.get("/api/v1/items/7/revisions")
        assert response.status_code == 200

        data = response.json()
        assert data["present_in"] == ["ao-18.7"]
        assert only_fixture_slugs(data["missing_in"]) == ["prk", "ao-18.8"]
        assert data["first_seen_in"] == "ao-18.7"

    def test_unknown_aoid_returns_empty_history(self, client, revision_data):
        response = client.get("/api/v1/items/999999/revisions")
        assert response.status_code == 200

        data = response.json()
        assert data["revisions"] == []
        assert data["present_in"] == []
        assert data["first_seen_in"] is None
        assert only_fixture_slugs(data["missing_in"]) == ["prk", "ao-18.8", "ao-18.7"]

    def test_version_segment_does_not_change_the_rows(
        self, client, revision_data, monkeypatch
    ):
        import time
        from app.core import versions as versions_module
        from app.core.versions import GameVersion as GameVersionDC

        registry = versions_module.registry
        monkeypatch.setattr(
            registry,
            "_versions",
            {
                "prk": GameVersionDC(
                    slug="prk",
                    schema_name="gv_prk",
                    display_name="PRK",
                    family="prk",
                    parent_slug="ao-18.8",
                    sort_order=10,
                )
            },
            raising=False,
        )
        monkeypatch.setattr(registry, "_loaded_at", time.monotonic(), raising=False)

        response = client.get("/api/v1/prk/items/4242/revisions")
        registry.invalidate()

        assert response.status_code == 200
        assert response.headers["X-Game-Version"] == "prk"
        assert len(response.json()["revisions"]) == 3


class TestItemRevisionsBatchEndpoint:
    """POST /api/v1/items/revisions/batch"""

    def test_summarises_each_requested_aoid(self, client, revision_data, monkeypatch):
        import time
        from app.core import versions as versions_module
        from app.core.versions import GameVersion as GameVersionDC

        registry = versions_module.registry
        monkeypatch.setattr(
            registry,
            "_versions",
            {
                "ao-18.8": GameVersionDC(
                    slug="ao-18.8",
                    schema_name="gv_ao_18_8",
                    display_name="AO 18.8",
                    family="ao",
                    parent_slug="ao-18.7",
                    sort_order=20,
                    is_default=True,
                )
            },
            raising=False,
        )
        monkeypatch.setattr(registry, "_loaded_at", time.monotonic(), raising=False)

        response = client.post(
            "/api/v1/items/revisions/batch",
            json={"aoids": [4242, 7, 999999]},
        )
        registry.invalidate()

        assert response.status_code == 200
        items = response.json()["items"]

        assert items["4242"]["revision_count"] == 3
        assert items["4242"]["present_in_current"] is True
        # The current version's definition was introduced in ao-18.8.
        assert items["4242"]["latest_change_slug"] == "ao-18.8"

        assert items["7"]["revision_count"] == 1
        assert items["7"]["present_in_current"] is False
        assert items["7"]["latest_change_slug"] == "ao-18.7"

        assert items["999999"]["revision_count"] == 0
        assert items["999999"]["present_in_current"] is False
        assert items["999999"]["latest_change_slug"] is None

    def test_rejects_an_empty_aoid_list(self, client, revision_data):
        response = client.post("/api/v1/items/revisions/batch", json={"aoids": []})
        assert response.status_code == 422

    def test_rejects_more_than_500_aoids(self, client, revision_data):
        response = client.post(
            "/api/v1/items/revisions/batch",
            json={"aoids": list(range(501))},
        )
        assert response.status_code == 422
