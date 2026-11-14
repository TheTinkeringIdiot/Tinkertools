"""
Tests for cross-version item change history:

    GET  /items/{aoid}/revisions
    POST /items/revisions/batch

Each test fills a throwaway store (the ``store`` fixture) with a few builds of
hand-made items and asks the API for an item's history.
"""

import os

import pytest
from sqlalchemy import update

from app.store import tables as t
from app.tests.fixtures.store_fixtures import criterion, item, modify

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

WRENCH = 100


def wrench(name="Wrench", stat=10, amounts=(5,), requires=50, instance=1, **extra):
    """Item 100 with one knob per part of its definition."""
    return item(
        WRENCH,
        name=name,
        stats=[(17, stat), (23, instance)],
        SpellData=[{"Event": 14, "Items": [modify(124, n) for n in amounts]}],
        ActionData={
            "Actions": [{"Action": 6, "Criteria": [criterion(112, requires, 2)]}]
        },
        **extra,
    )


def history(store, aoid=WRENCH, slug=None):
    slug = slug or store.builds()[0].slug
    with store.client(slug) as client:
        response = client.get(f"/api/v1/items/{aoid}/revisions")
    assert response.status_code == 200, response.text
    return response.json()


def points(store, aoid=WRENCH, slug=None):
    """``{slug: changed labels, or "first seen"}`` in the order returned."""
    return {
        point["version_slug"]: "first seen" if point["first_seen"] else point["changed"]
        for point in history(store, aoid, slug)["revisions"]
    }


def summary(store, aoids, slug):
    with store.client(slug) as client:
        response = client.post("/api/v1/items/revisions/batch", json={"aoids": aoids})
    assert response.status_code == 200, response.text
    return response.json()["items"]


# ---------------------------------------------------------------------------
# Change points
# ---------------------------------------------------------------------------


def test_an_item_that_never_changed_has_one_point_where_it_first_appears(store):
    store.add_build("ao-1", 1, items=[])
    store.add_build("ao-2", 2, items=[wrench()])
    store.add_build("ao-3", 3, items=[wrench()])

    data = history(store)

    assert data["aoid"] == WRENCH
    assert points(store) == {"ao-2": "first seen"}
    assert data["first_seen_in"] == "ao-2"
    assert data["present_in"] == ["ao-3", "ao-2"]
    assert data["missing_in"] == ["ao-1"]


def test_each_changed_part_is_reported_under_its_label(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench(stat=11)])
    store.add_build("ao-3", 3, items=[wrench(stat=11, amounts=(6,))])
    store.add_build("ao-4", 4, items=[wrench(stat=11, amounts=(6,), requires=60)])
    store.add_build(
        "ao-5", 5, items=[wrench("Spanner", stat=11, amounts=(6,), requires=60)]
    )
    store.add_build("ao-6", 6, items=[wrench("Spanner")])

    assert points(store) == {
        "ao-6": ["stats", "spells", "actions"],
        "ao-5": ["text"],
        "ao-4": ["actions"],
        "ao-3": ["spells"],
        "ao-2": ["stats"],
        "ao-1": "first seen",
    }


def test_attack_skills_and_the_mesh_count_as_stats(store):
    attack = {"Attack": [{"Stat": 112, "RawValue": 100}], "Defense": []}
    mesh = {"Animation": {"Stat": 12, "RawValue": 7}}
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench(AttackDefenseData=attack)])
    store.add_build(
        "ao-3",
        3,
        items=[wrench(AttackDefenseData=attack, AnimationMesh=mesh)],
    )

    assert points(store) == {
        "ao-3": ["stats"],
        "ao-2": ["stats"],
        "ao-1": "first seen",
    }


def test_a_build_that_only_reorders_or_renumbers_internals_is_no_change(store):
    store.add_build("ao-1", 1, items=[wrench(amounts=(5, 6), instance=1)])
    store.add_build("ao-2", 2, items=[wrench(amounts=(6, 5), instance=2)])

    assert points(store) == {"ao-1": "first seen"}


def test_a_point_describes_its_build(store):
    store.add_build("ao-1", 1, items=[wrench()], client_build="1.0")

    assert history(store)["revisions"] == [
        {
            "version_slug": "ao-1",
            "display_name": "ao-1",
            "family": "ao",
            "snapshot_date": None,
            "client_build": "1.0",
            "changed": [],
            "first_seen": True,
        }
    ]


# ---------------------------------------------------------------------------
# Items that leave and come back
# ---------------------------------------------------------------------------


def test_an_item_that_returns_unchanged_has_not_changed(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[])
    store.add_build("ao-3", 3, items=[])
    store.add_build("ao-4", 4, items=[wrench()])

    data = history(store)

    assert points(store) == {"ao-1": "first seen"}
    assert data["present_in"] == ["ao-4", "ao-1"]
    assert data["missing_in"] == ["ao-3", "ao-2"]


def test_an_item_that_returns_changed_is_compared_with_what_it_was(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[])
    store.add_build("ao-3", 3, items=[wrench(stat=11)])

    assert points(store) == {"ao-3": ["stats"], "ao-1": "first seen"}


def test_an_item_no_build_has_gets_an_empty_history(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench()])

    for aoid in (999, 0, -5, 2**40):
        assert history(store, aoid) == {
            "aoid": aoid,
            "present_in": [],
            "first_seen_in": None,
            "revisions": [],
            "missing_in": ["ao-2", "ao-1"],
        }


def test_a_disabled_build_is_not_part_of_the_history(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench(stat=11)])
    store.add_build("ao-3", 3, items=[wrench(stat=11)])
    store.db.execute(
        update(t.build).where(t.build.c.slug == "ao-2").values(enabled=False)
    )

    data = history(store)

    assert points(store) == {"ao-3": ["stats"], "ao-1": "first seen"}
    assert data["present_in"] == ["ao-3", "ao-1"]
    assert data["missing_in"] == []


# ---------------------------------------------------------------------------
# A branch that forks
# ---------------------------------------------------------------------------


@pytest.fixture
def forked(store):
    """AO builds 1 to 3 and a PRK branch forked from AO 2.

    ======  ====  ====  ====  =====
    item    ao-1  ao-2  ao-3  prk-1
    ======  ====  ====  ====  =====
    100     v1    v1    v2    v3
    200     v1    v1    v1    v1
    300     .     .     v1    v1
    400     .     .     .     v1
    500     v1    .     .     v2
    ======  ====  ====  ====  =====
    """
    store.add_build(
        "ao-1", 1, items=[wrench(), item(200, name="Same"), item(500, name="Back")]
    )
    store.add_build("ao-2", 2, items=[wrench(), item(200, name="Same")])
    store.add_build(
        "ao-3",
        3,
        items=[wrench(stat=11), item(200, name="Same"), item(300, name="Late")],
    )
    store.add_build(
        "prk-1",
        1,
        branch="prk",
        parent_slug="ao-2",
        sort_order=1,
        items=[
            wrench("PRK Wrench"),
            item(200, name="Same"),
            item(300, name="Late"),
            item(400, name="Own"),
            item(500, name="Back again"),
        ],
    )
    return store


def test_a_fork_is_compared_with_the_build_it_forks_from(forked):
    assert points(forked) == {
        "prk-1": ["text"],
        "ao-3": ["stats"],
        "ao-1": "first seen",
    }
    assert points(forked, 200) == {"ao-1": "first seen"}
    assert history(forked, 200)["present_in"] == ["prk-1", "ao-3", "ao-2", "ao-1"]


def test_a_fork_does_not_inherit_from_builds_after_the_fork(forked):
    assert points(forked, 300) == {"prk-1": "first seen", "ao-3": "first seen"}
    assert points(forked, 400) == {"prk-1": "first seen"}


def test_a_fork_looks_past_the_builds_that_lack_the_item(forked):
    assert points(forked, 500) == {"prk-1": ["text"], "ao-1": "first seen"}


def test_first_seen_is_the_first_appearance_in_the_viewers_lineage(forked):
    assert history(forked, 300, "prk-1")["first_seen_in"] == "prk-1"
    assert history(forked, 300, "ao-3")["first_seen_in"] == "ao-3"
    assert history(forked, WRENCH, "prk-1")["first_seen_in"] == "ao-1"
    # The viewer's lineage never had the item: the appearance nearest a root.
    assert history(forked, 400, "ao-3")["first_seen_in"] == "prk-1"
    # Two as near: the first by slug.
    assert history(forked, 300, "ao-1")["first_seen_in"] == "ao-3"


def test_the_requested_build_does_not_change_the_history_itself(forked):
    as_ao, as_prk = history(forked, WRENCH, "ao-1"), history(forked, WRENCH, "prk-1")

    assert as_ao == as_prk


# ---------------------------------------------------------------------------
# POST /items/revisions/batch
# ---------------------------------------------------------------------------


def test_the_batch_summarises_each_item_for_the_requested_build(forked):
    assert summary(forked, [WRENCH, 200, 400, 999, WRENCH], "ao-3") == {
        "100": {
            "aoid": 100,
            "revision_count": 3,
            "latest_change_slug": "ao-3",
            "present_in_current": True,
        },
        "200": {
            "aoid": 200,
            "revision_count": 1,
            "latest_change_slug": "ao-1",
            "present_in_current": True,
        },
        "400": {
            "aoid": 400,
            "revision_count": 1,
            "latest_change_slug": None,
            "present_in_current": False,
        },
        "999": {
            "aoid": 999,
            "revision_count": 0,
            "latest_change_slug": None,
            "present_in_current": False,
        },
    }


def test_the_latest_change_is_the_one_the_requested_build_reflects(forked):
    def latest(slug, aoid=WRENCH):
        return summary(forked, [aoid], slug)[str(aoid)]["latest_change_slug"]

    assert [latest(slug) for slug in ("ao-1", "ao-2", "ao-3", "prk-1")] == [
        "ao-1",
        "ao-1",
        "ao-3",
        "prk-1",
    ]
    assert latest("prk-1", 200) == "ao-1"
    assert latest("ao-2", 500) == "ao-1"
    assert summary(forked, [500], "ao-2")["500"]["present_in_current"] is False


def test_the_batch_costs_the_same_queries_for_one_item_or_many(forked):
    counts = []
    for aoids in ([WRENCH], [WRENCH, 200, 300, 400, 500, 999]):
        with forked.client("ao-3") as client, forked.counting_queries() as statements:
            client.post("/api/v1/items/revisions/batch", json={"aoids": aoids})
            counts.append(len(statements))

    assert counts[0] == counts[1]


def test_the_batch_takes_between_one_and_500_items(forked):
    with forked.client("ao-3") as client:
        empty = client.post("/api/v1/items/revisions/batch", json={"aoids": []})
        full = client.post(
            "/api/v1/items/revisions/batch", json={"aoids": list(range(500))}
        )
        too_many = client.post(
            "/api/v1/items/revisions/batch", json={"aoids": list(range(501))}
        )

    assert (empty.status_code, full.status_code, too_many.status_code) == (
        422,
        200,
        422,
    )
