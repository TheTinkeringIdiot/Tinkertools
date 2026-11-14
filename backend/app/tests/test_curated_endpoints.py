"""
Symbiants, mobs and perks as each build serves them (app/store/curated.py).

Symbiants are derived from a build's items and need no feature flag. Mobs,
their drops and perks are curated: a build serves them only with its flag on
and for items it carries. Each test fills a throwaway store (the ``store``
fixture) and asks the API.
"""

import os

import pytest
from sqlalchemy import update

from app.store import tables as t
from app.tests.fixtures.store_fixtures import criterion, item, modify

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

NO_CURATED = {"items": True, "nanos": True, "sources": True}
PERK_AOID = 500  # the perk of the fixture's perks.json: Accumulator 1


def symbiant(aoid, family="Artillery", ql=100, part="Ocular", slot=2, **extra):
    return item(
        aoid,
        name=f"Active {part} Symbiant, {family} Unit Aban",
        ql=ql,
        stats=[(298, slot)],
        **extra,
    )


def listed(client, path):
    response = client.get(f"/api/v1{path}")
    assert response.status_code == 200
    body = response.json()
    return body["items"] if isinstance(body, dict) else body


def aoids(client, path):
    return [row["aoid"] for row in listed(client, path)]


def mob_names(client, path="/mobs"):
    return [row["name"] for row in listed(client, path)]


# ---------------------------------------------------------------------------
# Symbiants
# ---------------------------------------------------------------------------


def test_symbiants_are_listed_without_any_feature_flag(store):
    store.add_build("old", 1, items=[symbiant(1), item(2)], features=NO_CURATED)

    with store.client("old") as client:
        body = client.get("/api/v1/symbiants").json()

    assert body["total"] == 1
    assert body["items"][0] == {
        "id": 1,
        "aoid": 1,
        "name": "Active Ocular Symbiant, Artillery Unit Aban",
        "ql": 100,
        "slot_id": 2,
        "family": "Artillery",
        "spell_data": [],
        "actions": [],
    }


def test_a_build_lists_the_symbiants_it_carries_in_its_own_revision(store):
    store.add_build("old", 1, items=[symbiant(1, ql=100), symbiant(2)])
    store.add_build("new", 2, items=[symbiant(1, ql=120), symbiant(3)])

    with store.client("old") as client:
        old = {row["aoid"]: row["ql"] for row in listed(client, "/symbiants")}
        gone_later = client.get("/api/v1/symbiants/2").status_code
        not_yet = client.get("/api/v1/symbiants/3").status_code
    with store.client("new") as client:
        new = {row["aoid"]: row["ql"] for row in listed(client, "/symbiants")}
        gone = client.get("/api/v1/symbiants/2").status_code
        detail = client.get("/api/v1/symbiants/1").json()

    assert old == {1: 100, 2: 100}
    assert new == {1: 120, 3: 100}
    assert (gone_later, not_yet, gone) == (200, 404, 404)
    assert detail["ql"] == 120


def test_symbiants_are_sorted_by_family_ql_name_and_aoid(store):
    store.add_build(
        "b1",
        1,
        items=[
            symbiant(1, family="Support", ql=10),
            symbiant(2, family="Artillery", ql=50),
            symbiant(3, family="Artillery", ql=10, part="Thigh"),
            symbiant(4, family="Artillery", ql=10, part="Brain"),
            symbiant(6, family="Artillery", ql=10, part="Thigh"),
            symbiant(5, family="Artillery", ql=10, part="Thigh"),
        ],
    )

    with store.client("b1") as client:
        everything = aoids(client, "/symbiants")
        pages = [
            client.get(f"/api/v1/symbiants?page={page}&page_size=4").json()
            for page in (1, 2, 3)
        ]

    assert everything == [4, 3, 5, 6, 2, 1]
    assert [[row["aoid"] for row in page["items"]] for page in pages] == [
        [4, 3, 5, 6],
        [2, 1],
        [],
    ]
    assert [(p["total"], p["pages"], p["has_next"], p["has_prev"]) for p in pages] == [
        (6, 2, True, False),
        (6, 2, False, True),
        (6, 2, False, True),
    ]


def test_a_symbiant_is_served_with_its_requirements_and_effects(store):
    store.add_build(
        "b1",
        1,
        items=[
            symbiant(
                1,
                ActionData={
                    "Actions": [
                        {
                            "Action": 6,
                            "Criteria": [
                                criterion(60, 7, 0),
                                criterion(54, 80, 2),
                                criterion(0, 0, 4),
                            ],
                        }
                    ]
                },
                SpellData=[{"Event": 14, "Items": [modify(124, 5)]}],
            ),
            item(2),
        ],
    )

    with store.client("b1") as client:
        detail = client.get("/api/v1/symbiants/1").json()
        not_a_symbiant = client.get("/api/v1/symbiants/2")
        (row,) = listed(client, "/symbiants")

    assert detail == row
    assert detail["actions"] == [
        {
            "action": 6,
            "criteria": [
                {"value1": 60, "value2": 7, "operator": 0},
                {"value1": 54, "value2": 80, "operator": 2},
                {"value1": 0, "value2": 0, "operator": 4},
            ],
        }
    ]
    (spell,) = detail["spell_data"][0]["spells"]
    assert detail["spell_data"][0]["event"] == 14
    assert spell["spell_format"] == "Modify {Stat} {Amount}"
    assert spell["spell_params"] == {
        "Stat": 124,
        "Amount": 5,
        "SpellDescription": "Modify 124 5",
    }
    assert not_a_symbiant.status_code == 404
    assert not_a_symbiant.json()["error"] == "Symbiant not found"


def test_a_page_of_symbiants_costs_as_many_queries_as_one(store):
    store.add_build("b1", 1, items=[symbiant(n) for n in range(1, 31)])

    with store.client("b1") as client:
        with store.counting_queries() as one:
            client.get("/api/v1/symbiants?page_size=1")
        with store.counting_queries() as page:
            rows = listed(client, "/symbiants?page_size=30")

    assert len(rows) == 30
    assert 0 < len(page) == len(one) <= 4


# ---------------------------------------------------------------------------
# Mobs: the "symbiants" flag, retired mobs, ids
# ---------------------------------------------------------------------------


def test_a_build_without_the_symbiants_flag_has_no_mobs_and_no_drops(store):
    store.add_build("old", 1, items=[symbiant(1)], features=NO_CURATED)
    store.add_build("live", 2, items=[symbiant(1)])
    store.curate(mobs=[("Ahpta", "Inferno", 1)])

    with store.client("old") as client:
        mobs = client.get("/api/v1/mobs?page=2").json()
        mob = client.get("/api/v1/mobs/1")
        drops = client.get("/api/v1/mobs/1/drops")
        dropped_by = client.get("/api/v1/symbiants/1/dropped-by")
        symbiants = aoids(client, "/symbiants")
    with store.client("live") as client:
        live_mobs = mob_names(client)
        live_drops = aoids(client, "/mobs/1/drops")
        live_dropped_by = client.get("/api/v1/symbiants/1/dropped-by").json()

    assert mobs == {
        "items": [],
        "total": 0,
        "page": 2,
        "page_size": 50,
        "pages": 1,
        "has_next": False,
        "has_prev": True,
    }
    assert (mob.status_code, mob.json()["error"]) == (404, "Mob not found")
    assert (drops.status_code, drops.json()["error"]) == (404, "Mob not found")
    assert (dropped_by.status_code, dropped_by.json()) == (200, [])
    assert symbiants == [1]
    assert live_mobs == ["Ahpta"]
    assert live_drops == [1]
    assert [m["name"] for m in live_dropped_by] == ["Ahpta"]


def test_a_mob_is_served_under_its_mob_id_with_its_curated_fields(store):
    store.add_build("b1", 1, items=[symbiant(1), symbiant(2)])
    store.curate(
        mobs=[
            ("Ahpta", "Inferno", 1, 220),
            ("Beit", "Scheol", 1),
            ("Ahpta", "Inferno", 2),
        ]
    )

    with store.client("b1") as client:
        mob = client.get("/api/v1/mobs/1").json()
        other = client.get("/api/v1/mobs/2").json()

    assert mob == {
        "id": 1,
        "name": "Ahpta",
        "level": 220,
        "playfield": "Inferno",
        "location": "Somewhere",
        "mob_names": ["Minion", "Other"],
        "is_pocket_boss": True,
        "symbiant_count": 2,
    }
    assert (other["id"], other["name"], other["symbiant_count"]) == (2, "Beit", 1)


def test_a_retired_mob_is_not_served_and_its_id_is_not_reused(store):
    store.add_build("b1", 1, items=[symbiant(1), symbiant(2), symbiant(9)])
    store.curate(mobs=[("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)])
    store.curate(mobs=[("Ahpta", "Inferno", 1), ("Cama", "Adonis", 9)])

    with store.client("b1") as client:
        mobs = {row["id"]: row["name"] for row in listed(client, "/mobs")}
        total = client.get("/api/v1/mobs").json()["total"]
        retired = client.get("/api/v1/mobs/2").status_code
        retired_drops = client.get("/api/v1/mobs/2/drops").status_code
        dropped_by = client.get("/api/v1/symbiants/2/dropped-by").json()

    assert mobs == {1: "Ahpta", 3: "Cama"}
    assert total == 2
    assert (retired, retired_drops) == (404, 404)
    assert dropped_by == []


def test_mobs_are_sorted_by_level_and_name_and_filtered(store):
    store.add_build("b1", 1, items=[symbiant(1)])
    store.curate(
        mobs=[
            ("Zed", "Inferno Frontier", 1, 200),
            ("Mid", "Scheol Upper", 1, 150),
            ("Abe", "Inferno Depths", 1, 200),
            ("Low", "Scheol Lower", 1, 50),
        ]
    )

    with store.client("b1") as client:
        everything = mob_names(client)
        second_page = client.get("/api/v1/mobs?page=2&page_size=3").json()
        inferno = mob_names(client, "/mobs?playfield=inFERno")
        no_filter = mob_names(client, "/mobs?playfield=")
        from_150 = mob_names(client, "/mobs?min_level=150")
        to_150 = mob_names(client, "/mobs?max_level=150")
        exact = mob_names(client, "/mobs?min_level=150&max_level=150")
        bosses = mob_names(client, "/mobs?is_pocket_boss=true")
        others = client.get("/api/v1/mobs?is_pocket_boss=false").json()

    assert everything == ["Low", "Mid", "Abe", "Zed"]
    assert [row["name"] for row in second_page["items"]] == ["Zed"]
    assert (second_page["total"], second_page["pages"]) == (4, 2)
    assert (second_page["has_next"], second_page["has_prev"]) == (False, True)
    assert inferno == ["Abe", "Zed"]
    assert no_filter == everything
    assert from_150 == ["Mid", "Abe", "Zed"]
    assert to_150 == ["Low", "Mid"]
    assert exact == ["Mid"]
    assert bosses == everything
    assert (others["items"], others["total"], others["pages"]) == ([], 0, 1)


def test_a_mobs_drops_are_the_symbiants_the_build_carries(store):
    store.add_build(
        "old",
        1,
        items=[symbiant(1, ql=100), symbiant(2), item(4)],
        features={**NO_CURATED, "symbiants": True},
    )
    store.add_build("new", 2, items=[symbiant(1, ql=120), symbiant(3), item(4)])
    store.curate(mobs=[("Ahpta", "Inferno", aoid) for aoid in (1, 2, 3, 4, 77)])

    with store.client("old") as client:
        old = [(row["aoid"], row["ql"]) for row in listed(client, "/mobs/1/drops")]
        old_count = client.get("/api/v1/mobs/1").json()["symbiant_count"]
        old_list_count = listed(client, "/mobs")[0]["symbiant_count"]
    with store.client("new") as client:
        new = [(row["aoid"], row["ql"]) for row in listed(client, "/mobs/1/drops")]
        new_count = client.get("/api/v1/mobs/1").json()["symbiant_count"]

    assert old == [(1, 100), (2, 100)]
    assert new == [(3, 100), (1, 120)]
    # the count is of the dropped items the build has, symbiants or not
    assert (old_count, old_list_count, new_count) == (3, 3, 3)


def test_drops_are_sorted_by_ql_name_and_aoid_and_filtered_by_family(store):
    drops = [
        symbiant(1, ql=50),
        symbiant(2, ql=10, part="Thigh"),
        symbiant(3, ql=10, part="Brain"),
        symbiant(5, ql=10, part="Thigh"),
        symbiant(4, ql=10, part="Thigh", family="Control"),
        symbiant(6, ql=10, part="Thigh"),
    ]
    store.add_build("b1", 1, items=drops + [symbiant(7)])
    store.curate(
        mobs=[("Ahpta", "Inferno", n) for n in (6, 5, 4, 3, 2, 1)]
        + [("Beit", "Scheol", 7)]
    )

    with store.client("b1") as client:
        everything = aoids(client, "/mobs/1/drops")
        control = aoids(client, "/mobs/1/drops?family=Control")
        exact_family_only = aoids(client, "/mobs/1/drops?family=control")
        no_filter = aoids(client, "/mobs/1/drops?family=")

    assert everything == [3, 2, 5, 6, 4, 1]
    assert control == [4]
    assert exact_family_only == []
    assert no_filter == everything


def test_dropped_by_lists_the_bosses_by_level_and_name(store):
    store.add_build("b1", 1, items=[symbiant(1), item(2)])
    store.curate(
        mobs=[
            ("Zed", "Inferno", 1, 200),
            ("Mid", "Scheol", 1, 250),
            ("Abe", "Inferno", 1, 200),
            ("Other", "Adonis", 2, 10),
        ]
    )

    with store.client("b1") as client:
        bosses = client.get("/api/v1/symbiants/1/dropped-by").json()
        not_a_symbiant = client.get("/api/v1/symbiants/2/dropped-by")
        unknown = client.get("/api/v1/symbiants/99/dropped-by")

    assert bosses == [
        {
            "id": 3,
            "name": "Abe",
            "level": 200,
            "location": "Somewhere",
            "playfield": "Inferno",
            "is_pocket_boss": True,
        },
        {
            "id": 1,
            "name": "Zed",
            "level": 200,
            "location": "Somewhere",
            "playfield": "Inferno",
            "is_pocket_boss": True,
        },
        {
            "id": 2,
            "name": "Mid",
            "level": 250,
            "location": "Somewhere",
            "playfield": "Scheol",
            "is_pocket_boss": True,
        },
    ]
    assert not_a_symbiant.status_code == 404
    assert unknown.status_code == 404


def test_dropped_by_leaves_out_a_mob_that_is_not_a_pocket_boss(store):
    store.add_build("b1", 1, items=[symbiant(1)])
    store.curate(mobs=[("Boss", "Inferno", 1, 200), ("Minion", "Inferno", 1, 100)])
    store.db.execute(
        update(t.mob).where(t.mob.c.name == "Minion").values(is_pocket_boss=False)
    )

    with store.client("b1") as client:
        dropped_by = client.get("/api/v1/symbiants/1/dropped-by").json()
        bosses = mob_names(client, "/mobs?is_pocket_boss=true")
        others = mob_names(client, "/mobs?is_pocket_boss=false")
        minion_drops = aoids(client, "/mobs/2/drops")

    assert [mob["name"] for mob in dropped_by] == ["Boss"]
    assert (bosses, others) == (["Boss"], ["Minion"])
    assert minion_drops == [1]


def test_an_id_no_integer_column_can_hold_is_not_found(store):
    store.add_build("b1", 1, items=[symbiant(1)])
    store.curate(mobs=[("Ahpta", "Inferno", 1)])
    huge = 2**63

    with store.client("b1") as client:
        statuses = [
            client.get(f"/api/v1{path}").status_code
            for path in (
                f"/mobs/{huge}",
                f"/mobs/{huge}/drops",
                f"/symbiants/{huge}",
                f"/symbiants/{huge}/dropped-by",
            )
        ]
        lookup = client.post("/api/v1/perks/batch/lookup", json={"aoids": [huge]})

    assert statuses == [404, 404, 404, 404]
    assert lookup.json()["results"][0]["success"] is False


# ---------------------------------------------------------------------------
# Perks: the "perks" flag and presence
# ---------------------------------------------------------------------------


def perk_item(aoid=PERK_AOID, amount=12):
    return item(
        aoid,
        name="Accumulator",
        ql=1,
        stats=[(23, 7063)],
        ActionData={
            "Actions": [
                {"Action": 6, "Criteria": [criterion(60, 7, 0), criterion(54, 9, 2)]}
            ]
        },
        SpellData=[
            {
                "Event": 14,
                "Items": [{**modify(113, amount), "Criteria": [criterion(60, 7, 0)]}],
            }
        ],
    )


def lookup(client, *wanted):
    response = client.post("/api/v1/perks/batch/lookup", json={"aoids": list(wanted)})
    assert response.status_code == 200
    return response.json()


def test_a_perk_is_its_item_in_the_build_with_the_curated_fields(store):
    store.add_build("old", 1, items=[perk_item(amount=10)])
    store.add_build("new", 2, items=[perk_item(amount=12)])
    store.curate()

    with store.client("old") as client:
        old = lookup(client, PERK_AOID)["results"][0]["perk"]
    with store.client("new") as client:
        body = lookup(client, PERK_AOID)

    assert body["success"] is True and body["errors"] == []
    (result,) = body["results"]
    assert (result["aoid"], result["success"], result["error"]) == (500, True, None)
    perk = result["perk"]
    assert sorted(perk.pop("stats"), key=lambda stat: stat["stat"]) == [
        {"stat": 23, "value": 7063, "stat_name": None},
        {"stat": 54, "value": 1, "stat_name": None},
        {"stat": 76, "value": 2, "stat_name": None},
    ]
    assert perk == {
        "id": 500,
        "aoid": 500,
        "name": "Accumulator",
        "ql": 1,
        "item_class": 2,
        "description": "",
        "is_nano": False,
        "spell_data": [
            {
                "event": 14,
                "spells": [
                    {
                        "target": 2,
                        "tick_count": 1,
                        "tick_interval": 0,
                        "spell_id": 53045,
                        "spell_format": "Modify {Stat} {Amount}",
                        "spell_params": {
                            "Stat": 113,
                            "Amount": 12,
                            "SpellDescription": "Modify 113 12",
                        },
                    }
                ],
            }
        ],
        "attack_stats": [],
        "defense_stats": [],
        "actions": [
            {
                "action": 6,
                "criteria": [
                    {"value1": 60, "value2": 7, "operator": 0, "order_index": 0},
                    {"value1": 54, "value2": 9, "operator": 2, "order_index": 1},
                ],
            }
        ],
        "perk_name": "Accumulator",
        "perk_counter": 1,
        "perk_type": "SL",
        "perk_series": "Accumulator",
        "perk_professions": ["Trader"],
        "perk_breeds": [],
        "perk_level_required": 10,
        "perk_ai_level_required": None,
        "counter": 1,
        "type": "SL",
        "level": 10,
        "ai_title": None,
        "formatted_name": "Accumulator 1",
    }
    assert old["spell_data"][0]["spells"][0]["spell_params"]["Amount"] == 10


def test_a_build_without_the_perks_flag_finds_no_perk(store):
    store.add_build("old", 1, items=[perk_item()], features=NO_CURATED)
    store.add_build("live", 2, items=[perk_item()])
    store.curate()

    with store.client("old") as client:
        old = lookup(client, PERK_AOID)
        still_an_item = client.get(f"/api/v1/items/{PERK_AOID}").status_code
    with store.client("live") as client:
        live = lookup(client, PERK_AOID)

    assert old == {
        "success": False,
        "results": [
            {
                "aoid": 500,
                "success": False,
                "perk": None,
                "error": "Perk with AOID 500 not found",
            }
        ],
        "errors": ["Perk 500 not found"],
    }
    assert still_an_item == 200
    assert live["success"] is True


def test_a_perk_whose_item_the_build_lacks_is_not_found(store):
    store.add_build("before", 1, items=[item(1)])
    store.add_build("after", 2, items=[item(1), perk_item()])
    store.curate()

    with store.client("before") as client:
        before = lookup(client, PERK_AOID)
    with store.client("after") as client:
        after = lookup(client, PERK_AOID)

    assert (before["success"], after["success"]) == (False, True)


def test_a_lookup_answers_per_aoid_in_request_order(store):
    store.add_build("b1", 1, items=[perk_item(), item(1)])
    store.curate()

    with store.client("b1") as client:
        body = lookup(client, 1, PERK_AOID, 99, PERK_AOID)
        with store.counting_queries() as one:
            lookup(client, PERK_AOID)
        with store.counting_queries() as many:
            lookup(client, *([PERK_AOID, 1, 2, 3] * 25))
        too_many = client.post(
            "/api/v1/perks/batch/lookup", json={"aoids": list(range(101))}
        )

    assert [(r["aoid"], r["success"]) for r in body["results"]] == [
        (1, False),
        (500, True),
        (99, False),
        (500, True),
    ]
    assert body["success"] is False
    assert body["errors"] == ["Perk 1 not found", "Perk 99 not found"]
    assert 0 < len(many) == len(one) <= 3
    assert too_many.status_code == 422
