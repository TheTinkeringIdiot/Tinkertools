"""
Tests for the cross-version change summary of list rows:

    POST /items/revisions/batch

Each test fills a throwaway store (the ``store`` fixture) with a few builds of
hand-made items and asks the API in how many builds an item changed.
"""

import os

import pytest

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


def summary(store, aoids, slug=None):
    slug = slug or store.builds()[0].slug
    with store.client(slug) as client:
        response = client.post("/api/v1/items/revisions/batch", json={"aoids": aoids})
    assert response.status_code == 200, response.text
    return response.json()["items"]


def changed_in(store, aoid=WRENCH, slug=None):
    """``(change points, build the requested build's definition is from)``."""
    entry = summary(store, [aoid], slug)[str(aoid)]
    return entry["revision_count"], entry["latest_change_slug"]


# ---------------------------------------------------------------------------
# Change points
# ---------------------------------------------------------------------------


def test_an_item_that_never_changed_has_one_point_where_it_first_appears(store):
    store.add_build("ao-1", 1, items=[])
    store.add_build("ao-2", 2, items=[wrench()])
    store.add_build("ao-3", 3, items=[wrench()])

    assert changed_in(store, slug="ao-3") == (1, "ao-2")
    assert summary(store, [WRENCH], "ao-3")["100"]["present_in_current"] is True
    assert summary(store, [WRENCH], "ao-1")["100"] == {
        "aoid": WRENCH,
        "revision_count": 1,
        "latest_change_slug": None,
        "present_in_current": False,
    }


@pytest.mark.parametrize(
    "change",
    [
        {"stat": 11},
        {"amounts": (6,)},
        {"requires": 60},
        {"name": "Spanner"},
        {
            "AttackDefenseData": {
                "Attack": [{"Stat": 112, "RawValue": 100}],
                "Defense": [],
            }
        },
        {"AnimationMesh": {"Animation": {"Stat": 12, "RawValue": 7}}},
    ],
    ids=["stats", "effects", "actions", "text", "attack", "mesh"],
)
def test_a_change_of_each_part_is_a_change_point(store, change):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench(**change)])
    store.add_build("ao-3", 3, items=[wrench(**change)])

    assert changed_in(store, slug="ao-3") == (2, "ao-2")


def test_every_build_that_changes_the_item_is_counted(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench(stat=11)])
    store.add_build("ao-3", 3, items=[wrench(stat=11, amounts=(6,))])
    store.add_build("ao-4", 4, items=[wrench("Spanner")])

    assert [changed_in(store, slug=f"ao-{n}") for n in (1, 2, 3, 4)] == [
        (4, "ao-1"),
        (4, "ao-2"),
        (4, "ao-3"),
        (4, "ao-4"),
    ]


def test_a_build_that_only_reorders_or_renumbers_internals_is_no_change(store):
    store.add_build("ao-1", 1, items=[wrench(amounts=(5, 6), instance=1)])
    store.add_build("ao-2", 2, items=[wrench(amounts=(6, 5), instance=2)])

    assert changed_in(store, slug="ao-2") == (1, "ao-1")


# ---------------------------------------------------------------------------
# Items that leave and come back
# ---------------------------------------------------------------------------


def test_an_item_that_returns_unchanged_has_not_changed(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[])
    store.add_build("ao-3", 3, items=[])
    store.add_build("ao-4", 4, items=[wrench()])

    assert changed_in(store, slug="ao-4") == (1, "ao-1")
    assert summary(store, [WRENCH], "ao-3")["100"]["present_in_current"] is False
    assert summary(store, [WRENCH], "ao-4")["100"]["present_in_current"] is True


def test_an_item_that_returns_changed_is_compared_with_what_it_was(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[])
    store.add_build("ao-3", 3, items=[wrench(stat=11)])

    assert changed_in(store, slug="ao-3") == (2, "ao-3")


def test_an_item_no_build_has_never_changed(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench()])

    for aoid in (999, 0, -5, 2**40):
        assert summary(store, [aoid], "ao-2")[str(aoid)] == {
            "aoid": aoid,
            "revision_count": 0,
            "latest_change_slug": None,
            "present_in_current": False,
        }


def test_a_disabled_build_is_not_part_of_the_history(store):
    store.add_build("ao-1", 1, items=[wrench()])
    store.add_build("ao-2", 2, items=[wrench(stat=11)], enabled=False)
    store.add_build("ao-3", 3, items=[wrench(stat=11)])

    assert changed_in(store, slug="ao-3") == (2, "ao-3")


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
    # first seen in ao-1, changed in ao-3 and, against ao-2, in prk-1
    assert changed_in(forked, slug="prk-1") == (3, "prk-1")
    # the same in the fork as in the build it forks from
    assert changed_in(forked, 200, "prk-1") == (1, "ao-1")


def test_a_fork_does_not_inherit_from_builds_after_the_fork(forked):
    # new to the fork although ao-3, after the fork, has it too
    assert changed_in(forked, 300, "prk-1") == (2, "prk-1")
    assert changed_in(forked, 300, "ao-3") == (2, "ao-3")
    assert changed_in(forked, 400, "prk-1") == (1, "prk-1")


def test_a_fork_looks_past_the_builds_that_lack_the_item(forked):
    assert changed_in(forked, 500, "prk-1") == (2, "prk-1")


def test_the_requested_build_does_not_change_the_number_of_change_points(forked):
    counts = {
        slug: [changed_in(forked, aoid, slug)[0] for aoid in (WRENCH, 200, 300, 400)]
        for slug in ("ao-1", "ao-3", "prk-1")
    }

    assert counts["ao-1"] == counts["ao-3"] == counts["prk-1"] == [3, 1, 2, 1]


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
