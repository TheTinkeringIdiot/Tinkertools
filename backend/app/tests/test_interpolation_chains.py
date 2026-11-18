"""
Tests for item chains on the real game data: the NCU belts and NCU memory
chips of backend/database/item_chains.toml, served by the interpolation
endpoints, and the rounding of exact halves on real items.

What a chain does with the rungs a build holds is covered on throwaway stores
in test_interpolation_service.py; the file's format in test_item_chains.py.
"""

import os
from fractions import Fraction

import pytest

from app.core.item_chains import default_chains
from app.store import load_records

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

ICON = 79
MODIFY = 53045
BELT_SLOTS, NCU = 45, 181

# AOID by QL
BELTS = {1: 36783, 20: 36782, 40: 36777, 80: 36785, 120: 36784, 200: 36787}
CHIPS = {1: 36779, 20: 36778, 40: 36786, 50: 36780, 120: 36781, 200: 95520}
# The belts and chips of a newer set, which are in no chain.
NEWER_BELT_4IX, NEWER_BELT_TI_200X, NEWER_CHIP = 303994, 304503, 303987

OLD_BUILDS = ["ao-14-2-2", "ao-15-0-1", "ao-17-10-5", "prk-0-7-1"]


def interpolate(client, aoid, ql, version=""):
    response = client.get(f"/api/v1{version}/items/{aoid}/interpolate?target_ql={ql}")
    assert response.status_code == 200
    data = response.json()
    assert data["success"], data["error"]
    return data


def stats_of(item_json):
    return {entry["stat"]: entry["value"] for entry in item_json["stats"]}


def amount(item_json, stat):
    (value,) = [
        spell["spell_params"]["Amount"]
        for event in item_json["spell_data"]
        for spell in event["spells"]
        if spell["spell_id"] == MODIFY and spell["spell_params"]["Stat"] == stat
    ]
    return value


def record(store_db, build, aoid):
    (found,) = load_records(store_db, build, aoids=[aoid])
    return found


def assert_shown_as(item_json, rung):
    """The item has the name, description and icon of ``rung``."""
    assert item_json["name"] == rung.name
    assert item_json["description"] == rung.description
    assert stats_of(item_json)[ICON] == dict(rung.stats)[ICON]


# ---------------------------------------------------------------------------
# The chains
# ---------------------------------------------------------------------------


def test_the_chains_are_the_rungs_the_file_names(store_db, build):
    chains = default_chains()
    for stat, rungs, values in (
        (BELT_SLOTS, BELTS, [1, 2, 3, 4, 5, 6]),
        (NCU, CHIPS, [2, 4, 8, 16, 32, 64]),
    ):
        (chain,) = {chains[aoid].name: chains[aoid] for aoid in rungs.values()}.values()
        assert (chain.effect, chain.stat) == (MODIFY, stat)
        assert chain.rungs == frozenset(rungs.values())
        records = [record(store_db, build, aoid) for aoid in rungs.values()]
        assert [found.ql for found in records] == list(rungs)
        assert len({found.name for found in records}) == len(rungs)
        assert [
            effect["params"]["Amount"]
            for found in records
            for event in found.effects
            for effect in event["effects"]
            if effect["spell_id"] == MODIFY and effect["params"]["Stat"] == stat
        ] == values


def test_between_ti_200x_and_300x_the_belt_changes_name_at_ql_30(
    client, store_db, build
):
    """Confirmed in game: QL 29 is a Ti-200X with 2 slots, QL 30 a 300X with 3
    (2 + 10 / 20 = 2.5, rounded up)."""
    at_29 = interpolate(client, BELTS[20], 29)["item"]
    at_30 = interpolate(client, BELTS[20], 30)["item"]

    assert at_29["name"] == "Belt Component Platform Ti-200X"
    assert amount(at_29, BELT_SLOTS) == 2
    assert_shown_as(at_29, record(store_db, build, BELTS[20]))
    assert at_30["name"] == "Belt Component Platform 300X"
    assert amount(at_30, BELT_SLOTS) == 3
    assert_shown_as(at_30, record(store_db, build, BELTS[40]))
    for interpolated, ql in ((at_29, 29), (at_30, 30)):
        assert (interpolated["aoid"], interpolated["id"]) == (BELTS[20], BELTS[20])
        assert (interpolated["ql"], interpolated["target_ql"]) == (ql, ql)
        assert (interpolated["low_ql"], interpolated["high_ql"]) == (20, 40)
        assert interpolated["interpolating"] is True


# The QL at which each rung's name takes over, and the QL before it:
# (QL, QL of the rung shown, key value).
BELT_BOUNDARIES = [
    (1, 1, 1),
    (10, 1, 1),  # 1 + 9 / 19 = 1.47
    (11, 20, 2),  # 1 + 10 / 19 = 1.53
    (20, 20, 2),
    (29, 20, 2),  # 2 + 9 / 20 = 2.45
    (30, 40, 3),  # 2 + 10 / 20 = 2.5
    (40, 40, 3),
    (59, 40, 3),  # 3 + 19 / 40 = 3.475
    (60, 80, 4),  # 3 + 20 / 40 = 3.5
    (80, 80, 4),
    (99, 80, 4),  # 4 + 19 / 40 = 4.475
    (100, 120, 5),  # 4 + 20 / 40 = 4.5
    (120, 120, 5),
    (159, 120, 5),  # 5 + 39 / 80 = 5.49
    (160, 200, 6),  # 5 + 40 / 80 = 5.5
    (200, 200, 6),
]
CHIP_BOUNDARIES = [
    (1, 1, 2),
    (15, 1, 3),  # 2 + 2 * 14 / 19 = 3.47
    (16, 20, 4),  # 2 + 2 * 15 / 19 = 3.58
    (20, 20, 4),
    (37, 20, 7),  # 4 + 4 * 17 / 20 = 7.4
    (38, 40, 8),  # 4 + 4 * 18 / 20 = 7.6
    (40, 40, 8),
    (49, 40, 15),  # 8 + 8 * 9 / 10 = 15.2
    (50, 50, 16),
    (117, 50, 31),  # 16 + 16 * 67 / 70 = 31.31
    (118, 120, 32),  # 16 + 16 * 68 / 70 = 31.54
    (120, 120, 32),
    (198, 120, 63),  # 32 + 32 * 78 / 80 = 63.2
    (199, 200, 64),  # 32 + 32 * 79 / 80 = 63.6
    (200, 200, 64),
]


@pytest.mark.parametrize(
    "rungs,stat,ql,shown_ql,value",
    [(BELTS, BELT_SLOTS, *boundary) for boundary in BELT_BOUNDARIES]
    + [(CHIPS, NCU, *boundary) for boundary in CHIP_BOUNDARIES],
)
def test_each_rung_takes_over_where_its_key_value_is_reached(
    client, store_db, build, rungs, stat, ql, shown_ql, value
):
    data = interpolate(client, rungs[40], ql)
    interpolated = data["item"]

    assert data["interpolation_range"] == {"min_ql": 1, "max_ql": 200}
    assert amount(interpolated, stat) == value
    assert_shown_as(interpolated, record(store_db, build, rungs[shown_ql]))
    assert interpolated["ql"] == ql
    assert interpolated["aoid"] == rungs[max(low for low in rungs if low <= ql)]


@pytest.mark.parametrize("rungs,stat", [(BELTS, BELT_SLOTS), (CHIPS, NCU)])
def test_any_rung_names_the_whole_chain(client, rungs, stat):
    answers = [interpolate(client, aoid, 100) for aoid in rungs.values()]

    assert all(answer == answers[0] for answer in answers)
    assert answers[0]["item"]["aoid"] == rungs[80 if rungs is BELTS else 50]


@pytest.mark.parametrize("rungs,stat", [(BELTS, BELT_SLOTS), (CHIPS, NCU)])
def test_above_the_last_rung_the_item_is_the_last_rung(
    client, store_db, build, rungs, stat
):
    interpolated = interpolate(client, rungs[1], 250)["item"]

    assert_shown_as(interpolated, record(store_db, build, rungs[200]))
    assert (interpolated["aoid"], interpolated["ql"]) == (rungs[200], 250)
    assert interpolated["interpolating"] is False
    assert amount(interpolated, stat) == (6 if rungs is BELTS else 64)


@pytest.mark.parametrize("rungs", [BELTS, CHIPS])
def test_interpolation_info_lists_the_ranges_between_rungs(client, rungs):
    qls = list(rungs)

    for aoid in (rungs[1], rungs[40], rungs[200]):
        data = client.get(f"/api/v1/items/{aoid}/interpolation-info").json()

        assert (data["aoid"], data["interpolatable"]) == (aoid, True)
        assert (data["min_ql"], data["max_ql"]) == (1, 200)
        assert data["ranges"] == [
            {
                "min_ql": low,
                "max_ql": high,
                "interpolatable": True,
                "base_aoid": rungs[low],
            }
            for low, high in zip(qls, qls[1:])
        ] + [
            {
                "min_ql": 200,
                "max_ql": 200,
                "interpolatable": False,
                "base_aoid": rungs[200],
            }
        ]


def test_a_batch_interpolates_chains_as_the_single_endpoint_does(client):
    wanted = [(BELTS[1], 30), (CHIPS[200], 118), (BELTS[120], 29), (NEWER_CHIP, 100)]

    response = client.post(
        "/api/v1/items/batch/interpolate",
        json={"items": [{"aoid": aoid, "target_ql": ql} for aoid, ql in wanted]},
    )

    results = response.json()["results"]
    assert [(result["aoid"], result["target_ql"]) for result in results] == wanted
    assert [result["item"] for result in results] == [
        interpolate(client, aoid, ql)["item"] for aoid, ql in wanted
    ]
    assert [result["item"]["name"] for result in results[:3]] == [
        "Belt Component Platform 300X",
        "32 - 63 NCU Memory",
        "Belt Component Platform Ti-200X",
    ]


@pytest.mark.parametrize("version", OLD_BUILDS)
def test_older_builds_hold_the_same_chains(client, version):
    at_29 = interpolate(client, BELTS[40], 29, f"/{version}")["item"]
    at_30 = interpolate(client, BELTS[40], 30, f"/{version}")["item"]
    chip = interpolate(client, CHIPS[1], 118, f"/{version}")

    assert (at_29["name"], amount(at_29, BELT_SLOTS)) == (
        "Belt Component Platform Ti-200X",
        2,
    )
    assert (at_30["name"], amount(at_30, BELT_SLOTS)) == (
        "Belt Component Platform 300X",
        3,
    )
    assert (chip["item"]["name"], amount(chip["item"], NCU)) == (
        "32 - 63 NCU Memory",
        32,
    )
    assert chip["interpolation_range"] == {"min_ql": 1, "max_ql": 200}


# ---------------------------------------------------------------------------
# The newer belts and chips, in no chain
# ---------------------------------------------------------------------------


def test_the_newer_belts_and_chips_are_ordinary_items(client, store_db, build):
    """They interpolate between the items of their own name and description.
    The newer 4IX shares its text with the 4IX of the chain, which stays its
    higher variant, while the chain's 4IX answers as a rung."""
    newer_4ix = record(store_db, build, NEWER_BELT_4IX)
    chain_4ix = record(store_db, build, BELTS[80])
    assert (newer_4ix.name, newer_4ix.description, newer_4ix.ql) == (
        chain_4ix.name,
        chain_4ix.description,
        60,
    )

    info = client.get(f"/api/v1/items/{NEWER_BELT_4IX}/interpolation-info").json()
    at_70 = interpolate(client, NEWER_BELT_4IX, 70)["item"]

    assert info["ranges"] == [
        {
            "min_ql": 60,
            "max_ql": 80,
            "interpolatable": True,
            "base_aoid": NEWER_BELT_4IX,
        },
        {"min_ql": 80, "max_ql": 80, "interpolatable": False, "base_aoid": BELTS[80]},
    ]
    assert (at_70["aoid"], at_70["low_ql"], at_70["high_ql"]) == (
        NEWER_BELT_4IX,
        60,
        80,
    )
    assert amount(at_70, BELT_SLOTS) == 4
    assert_shown_as(at_70, newer_4ix)

    for aoid in (NEWER_BELT_TI_200X, NEWER_CHIP):
        own = record(store_db, build, aoid)
        info = client.get(f"/api/v1/items/{aoid}/interpolation-info").json()
        elsewhere = interpolate(client, aoid, 30)["item"]

        assert info["interpolatable"] is False
        assert info["ranges"] == [
            {
                "min_ql": own.ql,
                "max_ql": own.ql,
                "interpolatable": False,
                "base_aoid": aoid,
            }
        ]
        assert (elsewhere["aoid"], elsewhere["interpolating"]) == (aoid, False)
        assert_shown_as(elsewhere, own)
        assert stats_of(elsewhere) == dict(own.stats)


# ---------------------------------------------------------------------------
# Exact halves on real items
# ---------------------------------------------------------------------------

COMPOSITE_SURVIVAL_AXE = 144079  # QL 175, its higher variant QL 199
GURGLING_RIVER_SPRITE = 216267  # QL 150, its higher variant QL 200


def exact(low, high, low_value, high_value, ql):
    return low_value + Fraction(
        (high_value - low_value) * (ql - low.ql), high.ql - low.ql
    )


def test_a_half_is_rounded_up_on_a_real_item(client, store_db, build):
    """Max damage (stat 101) of the Composite Survival Axe at QL 182:
    674 + (806 - 674) * 7 / 24 = 712.5."""
    low = record(store_db, build, COMPOSITE_SURVIVAL_AXE)
    high = record(store_db, build, COMPOSITE_SURVIVAL_AXE + 1)
    expected = exact(low, high, dict(low.stats)[101], dict(high.stats)[101], 182)
    assert expected == Fraction(1425, 2)

    interpolated = interpolate(client, COMPOSITE_SURVIVAL_AXE, 182)["item"]

    assert stats_of(interpolated)[101] == 713


def test_a_negative_half_is_rounded_up_on_a_real_item(client, store_db, build):
    """The Gurgling River Sprite's modifier of stat 149 at QL 151:
    -50 + 25 * 1 / 50 = -49.5, which rounds up to -49."""

    def modifier(found):
        (value,) = [
            effect["params"]["Amount"]
            for event in found.effects
            for effect in event["effects"]
            if effect["spell_id"] == MODIFY and effect["params"]["Stat"] == 149
        ]
        return value

    low = record(store_db, build, GURGLING_RIVER_SPRITE)
    high = record(store_db, build, GURGLING_RIVER_SPRITE + 1)
    assert exact(low, high, modifier(low), modifier(high), 151) == Fraction(-99, 2)

    interpolated = interpolate(client, GURGLING_RIVER_SPRITE, 151)["item"]

    assert amount(interpolated, 149) == -49
