"""
Tests for POST /implants/lookup: the implant with a slot and an exact set of
clusters, at any QL.

Each test fills a throwaway store (the ``store`` fixture) with a few hand-made
implants and looks one up through the API.
"""

import os

import pytest

from app.tests.fixtures.store_fixtures import modify

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

EYE, HEAD, CHEST = 2, 4, 32
STRENGTH, AGILITY, STAMINA, PISTOL = 16, 17, 18, 112
ON_WEAR, ON_USE = 14, 0


def implant(aoid, clusters=(), slot=EYE, ql=1, name=None, event=ON_WEAR, **extra):
    """An implant whose clusters raise each stat by twice the QL."""
    record = {
        "AOID": aoid,
        "Name": name or "Implant " + "+".join(map(str, clusters)),
        "Description": "",
        "StatValues": [
            {"Stat": 54, "RawValue": ql},
            {"Stat": 76, "RawValue": 3},
            {"Stat": 298, "RawValue": slot},
        ],
    }
    if clusters:
        record["SpellData"] = [
            {"Event": event, "Items": [modify(stat, ql * 2) for stat in clusters]}
        ]
    record.update(extra)
    return record


def lookup(store, slot, ql, clusters, slug="live"):
    with store.client(slug) as client:
        response = client.post(
            "/api/v1/implants/lookup",
            json={"slot": slot, "ql": ql, "clusters": clusters},
        )
    assert response.status_code == 200, response.text
    return response.json()


def found(store, slot, ql, clusters, slug="live"):
    """AOID of the implant looked up, None when there is none."""
    data = lookup(store, slot, ql, clusters, slug)
    assert data["success"] == (data["item"] is not None)
    return data["item"]["aoid"] if data["success"] else None


# ---------------------------------------------------------------------------
# Which implant
# ---------------------------------------------------------------------------


def test_the_implant_has_exactly_the_clusters_asked_for(store):
    store.add_build(
        "live",
        1,
        items=[
            implant(1, [STRENGTH]),
            implant(2, [STRENGTH, AGILITY]),
            implant(3, [STRENGTH, AGILITY, STAMINA]),
            implant(4, [AGILITY, STAMINA]),
        ],
    )

    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 1
    assert found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": AGILITY}) == 2
    assert found(store, EYE, 1, {"Bright": AGILITY, "Shiny": STRENGTH}) == 2
    assert (
        found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": AGILITY, "Faded": STAMINA})
        == 3
    )
    assert found(store, EYE, 1, {"Shiny": AGILITY}) is None
    assert found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": STAMINA}) is None
    assert found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": PISTOL}) is None


def test_without_clusters_the_basic_implant_is_found(store):
    store.add_build(
        "live", 1, items=[implant(1, [STRENGTH]), implant(2, name="Basic Implant")]
    )

    assert found(store, EYE, 1, {}) == 2


def test_no_basic_implant_means_nothing_is_found_without_clusters(store):
    store.add_build("live", 1, items=[implant(1, [STRENGTH])])

    data = lookup(store, EYE, 1, {})

    assert (data["success"], data["item"], data["interpolated"]) == (False, None, False)
    assert data["message"] == "No implant found for slot 2 with clusters {} at QL 1"
    assert data["base_ql"] is None


def test_the_implant_fits_the_slot_asked_for(store):
    store.add_build(
        "live",
        1,
        items=[
            implant(1, [STRENGTH], slot=HEAD),
            implant(2, [STRENGTH], slot=EYE | CHEST),
        ],
    )

    assert found(store, HEAD, 1, {"Shiny": STRENGTH}) == 1
    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 2
    assert found(store, CHEST, 1, {"Shiny": STRENGTH}) == 2
    assert found(store, 8, 1, {"Shiny": STRENGTH}) is None


def test_a_slot_that_is_not_one_implant_slot_finds_nothing(store):
    store.add_build("live", 1, items=[implant(1, [STRENGTH], slot=EYE | HEAD)])

    assert found(store, EYE | HEAD, 1, {"Shiny": STRENGTH}) is None
    assert found(store, 1, 1, {"Shiny": STRENGTH}) is None
    assert found(store, 16383, 1, {"Shiny": STRENGTH}) is None


def test_only_implants_are_looked_up(store):
    armor = implant(1, [STRENGTH])
    armor["StatValues"][1]["RawValue"] = 2
    store.add_build("live", 1, items=[armor, implant(2, [STRENGTH])])

    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 2


def test_only_modify_effects_are_clusters(store):
    other_effect = {**modify(AGILITY, 5), "SpellID": 53012}
    with_other = implant(1, [STRENGTH])
    with_other["SpellData"][0]["Items"].append(other_effect)
    only_other = implant(2, name="Other")
    only_other["SpellData"] = [{"Event": ON_WEAR, "Items": [other_effect]}]
    store.add_build("live", 1, items=[with_other, only_other])

    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 1
    assert found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": AGILITY}) is None
    assert found(store, EYE, 1, {}) == 2


def test_clusters_count_whatever_event_carries_them(store):
    store.add_build(
        "live",
        1,
        items=[implant(1, [STRENGTH], event=ON_USE), implant(2, name="Basic")],
    )

    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 1
    assert found(store, EYE, 1, {}) == 2


def test_a_cluster_asked_for_twice_matches_two_such_effects(store):
    store.add_build(
        "live", 1, items=[implant(1, [STRENGTH]), implant(2, [STRENGTH, STRENGTH])]
    )

    assert found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": STRENGTH}) == 2
    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 1


def test_of_several_implants_with_the_same_clusters_the_lowest_aoid_is_found(store):
    store.add_build(
        "live",
        1,
        items=[
            implant(30, [STRENGTH], name="Eye Implant: Strength, Shiny"),
            implant(10, [STRENGTH], name="Eye Implant: Strength, Shiny"),
            implant(20, [STRENGTH], name="Eye Implant: Strength, Shiny"),
            implant(31, name="Other basic"),
            implant(11, name="Basic"),
        ],
    )

    assert [found(store, EYE, 1, {"Shiny": STRENGTH}) for _ in range(3)] == [10] * 3
    assert found(store, EYE, 1, {}) == 11


def test_an_implant_of_the_standard_series_comes_before_its_namesakes(store):
    store.add_build(
        "live",
        1,
        items=[
            implant(10, [STRENGTH], name="A Shining Strength Eye Implant"),
            implant(20, [STRENGTH], name="Eye Implant: Strength, Shiny"),
            implant(30, [STRENGTH], name="TestItem: Criteria"),
            implant(11, [AGILITY], name="Eye Implant: Agility, Shiny"),
            implant(21, [AGILITY], name="Cyborg Eye Implant"),
        ],
    )

    assert found(store, EYE, 1, {"Shiny": STRENGTH}) == 20
    assert found(store, EYE, 1, {"Shiny": AGILITY}) == 11


def test_a_cluster_no_column_can_hold_finds_nothing(store):
    store.add_build("live", 1, items=[implant(1, [STRENGTH])])

    assert found(store, EYE, 1, {"Shiny": 2**40}) is None
    assert found(store, EYE, 1, {"Shiny": STRENGTH, "Bright": 2**40}) is None


def test_the_implant_is_looked_up_in_the_requested_build(store):
    store.add_build("old", 1, items=[implant(1, [STRENGTH]), implant(2, [AGILITY])])
    store.add_build("new", 2, items=[implant(1, [STAMINA]), implant(3, [AGILITY])])

    assert found(store, EYE, 1, {"Shiny": STRENGTH}, "old") == 1
    assert found(store, EYE, 1, {"Shiny": STRENGTH}, "new") is None
    assert found(store, EYE, 1, {"Shiny": STAMINA}, "new") == 1
    assert found(store, EYE, 1, {"Shiny": AGILITY}, "old") == 2
    assert found(store, EYE, 1, {"Shiny": AGILITY}, "new") == 3


# ---------------------------------------------------------------------------
# At which QL
# ---------------------------------------------------------------------------


@pytest.fixture
def ladder(store):
    """One implant at its four stored QLs, as the game data has it."""
    store.add_build(
        "live",
        1,
        items=[
            implant(1, [STRENGTH], ql=1, name="Implant"),
            implant(2, [STRENGTH], ql=200, name="Implant"),
            implant(3, [STRENGTH], ql=201, name="Refined Implant"),
            implant(4, [STRENGTH], ql=300, name="Refined Implant"),
        ],
    )
    return store


def strength_of(item_json):
    (event,) = item_json["spell_data"]
    (spell,) = event["spells"]
    assert spell["spell_params"]["Stat"] == STRENGTH
    return spell["spell_params"]["Amount"]


def test_at_a_stored_base_ql_the_implant_is_served_as_it_is(ladder):
    data = lookup(ladder, EYE, 1, {"Shiny": STRENGTH})

    assert (data["success"], data["interpolated"], data["base_ql"]) == (True, False, 1)
    assert data["message"] == "Implant found successfully"
    with ladder.client("live") as client:
        assert data["item"] == client.get("/api/v1/items/1").json()

    refined = lookup(ladder, EYE, 201, {"Shiny": STRENGTH})
    assert (refined["item"]["aoid"], refined["interpolated"]) == (3, False)
    assert refined["base_ql"] == 201


def test_up_to_ql_200_the_ql_1_implant_is_interpolated(ladder):
    data = lookup(ladder, EYE, 100, {"Shiny": STRENGTH})

    assert (data["success"], data["interpolated"], data["base_ql"]) == (True, True, 1)
    assert data["message"] == (
        "Implant found successfully (interpolated from QL 1 to QL 100)"
    )
    item = data["item"]
    assert (item["aoid"], item["id"], item["name"]) == (1, 1, "Implant")
    assert (item["ql"], item["item_class"], item["is_nano"]) == (100, 3, False)
    assert strength_of(item) == 200
    assert {"stat": 298, "value": EYE} in item["stats"]
    assert (item["attack_stats"], item["defense_stats"], item["sources"]) == (
        [],
        [],
        [],
    )

    top = lookup(ladder, EYE, 200, {"Shiny": STRENGTH})
    assert (top["item"]["aoid"], top["item"]["ql"], top["interpolated"]) == (
        2,
        200,
        True,
    )
    assert strength_of(top["item"]) == 400


def test_above_ql_200_the_refined_implant_is_interpolated(ladder):
    data = lookup(ladder, EYE, 250, {"Shiny": STRENGTH})

    assert (data["interpolated"], data["base_ql"]) == (True, 201)
    assert (data["item"]["aoid"], data["item"]["name"]) == (3, "Refined Implant")
    assert (data["item"]["ql"], strength_of(data["item"])) == (250, 500)


def test_an_implant_is_found_by_its_base_ql_variant_only(store):
    store.add_build("live", 1, items=[implant(2, [STRENGTH], ql=200)])

    assert found(store, EYE, 200, {"Shiny": STRENGTH}) is None


def test_a_ql_outside_the_implant_range_is_rejected(store):
    store.add_build("live", 1, items=[implant(1, [STRENGTH])])

    with store.client("live") as client:
        for ql in (0, 301):
            response = client.post(
                "/api/v1/implants/lookup", json={"slot": EYE, "ql": ql, "clusters": {}}
            )
            assert response.status_code == 422
