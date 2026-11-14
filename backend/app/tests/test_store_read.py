"""
Tests for the read path of the content-addressed store (app/store) and for
item detail, the first route served from it.

Each test fills a throwaway store with a few hand-made builds (the ``store``
fixture) and asks the API, or the read layer, what a build serves.
"""

import os

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.store import tables as t
from app.store.context import Build, get_build, resolve_build
from app.store.items import load_item_details, load_records
from app.store.presence import (
    fetch_page,
    has_atkdef,
    has_effect,
    has_requirement,
    has_stat,
    nano_policy,
    page_fields,
    revisions,
)
from app.tests.fixtures.store_fixtures import criterion, item, modify, nano

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)


def pairs(*entries):
    return [{"Stat": stat, "RawValue": value} for stat, value in entries]


def sword(aoid=100, name="Sword", ql=50, skill=120):
    """A weapon with a wield requirement, an on-wield modifier and an
    attack/defense block."""
    return item(
        aoid,
        name=name,
        ql=ql,
        stats=[(23, 9000 + aoid), (298, 64)],
        SpellData=[
            {
                "Event": 14,
                "Items": [
                    {
                        **modify(124, 5),
                        "Criteria": [criterion(60, 4, 0), criterion(54, 10, 2)],
                    }
                ],
            }
        ],
        ActionData={
            "Actions": [
                {
                    "Action": 6,
                    "Criteria": [
                        criterion(102, skill, 2),
                        criterion(112, 80, 2),
                        criterion(0, 0, 4),
                    ],
                }
            ]
        },
        AttackDefenseData={
            "Attack": pairs((102, 60), (17, 40)),
            "Defense": pairs((152, 100)),
        },
    )


def sorted_stats(entries):
    return sorted((entry["stat"], entry["value"]) for entry in entries)


# ---------------------------------------------------------------------------
# Build context
# ---------------------------------------------------------------------------


def a_build(slug, branch, ordinal, is_default=False):
    return Build(
        build_id=ordinal,
        slug=slug,
        branch=branch,
        ordinal=ordinal,
        features={},
        overlay_strain_first=False,
        is_default=is_default,
    )


def test_a_slug_names_its_build_and_a_branch_names_its_newest():
    newest = a_build("ao-2", "ao", 2, is_default=True)
    older = a_build("ao-1", "ao", 1)
    fork = a_build("prk-1", "prk", 1)
    display_order = [fork, newest, older]

    assert resolve_build(display_order, "ao-1") is older
    assert resolve_build(display_order, "ao") is newest
    assert resolve_build(display_order, "prk") is fork
    assert resolve_build(display_order, None) is newest
    assert resolve_build(display_order, "ao-3") is None


def test_a_request_for_a_version_the_store_lacks_is_not_found():
    request = Request({"type": "http", "state": {"game_version": "no-such-build"}})

    with pytest.raises(HTTPException) as raised:
        get_build(request)

    assert raised.value.status_code == 404


def test_a_build_is_read_with_its_position_flags_and_strain_policy(store):
    store.add_build("old", 1, features={"sources": True, "perks": False})
    store.add_build("live", 2)

    old, live = store.build("old"), store.build("live")

    assert (old.branch, old.ordinal, live.ordinal) == ("ao", 1, 2)
    assert old.has("sources") and not old.has("perks") and not old.has("symbiants")
    assert live.has("perks") and live.has("symbiants")
    assert (old.overlay_strain_first, live.overlay_strain_first) == (False, True)
    assert store.build("ao") == live


# ---------------------------------------------------------------------------
# Item detail
# ---------------------------------------------------------------------------


def test_an_item_is_served_as_of_the_requested_build(store):
    store.add_build("b1", 1, items=[item(1, name="Wrench"), item(2, name="Pliers")])
    store.add_build("b2", 2, items=[item(1, name="Spanner"), item(3, name="Saw")])

    with store.client("b1") as client:
        assert client.get("/api/v1/items/1").json()["name"] == "Wrench"
        assert client.get("/api/v1/items/2").json()["name"] == "Pliers"
        assert client.get("/api/v1/items/3").status_code == 404
    with store.client("b2") as client:
        assert client.get("/api/v1/items/1").json()["name"] == "Spanner"
        assert client.get("/api/v1/items/2").status_code == 404
        assert client.get("/api/v1/items/3").json()["name"] == "Saw"


def test_an_item_absent_from_the_build_is_not_found(store):
    store.add_build("b1", 1, items=[item(1)])

    with store.client("b1") as client:
        response = client.get("/api/v1/items/999")

    assert response.status_code == 404
    assert response.json() == {"error": "Item not found", "code": "HTTP_404"}


@pytest.mark.parametrize("aoid", [-5, 2**31, 99999999999, 10**30])
def test_an_aoid_no_item_can_have_is_not_found(store, aoid):
    store.add_build("b1", 1, items=[item(1)])

    with store.client("b1") as client:
        assert client.get(f"/api/v1/items/{aoid}").status_code == 404
        info = client.get(f"/api/v1/items/{aoid}/interpolation-info")
        batch = client.post(
            "/api/v1/items/batch/interpolate",
            json={"items": [{"aoid": aoid, "target_ql": 5}, {"aoid": 1}]},
        )

    assert info.status_code == 404
    assert [result["success"] for result in batch.json()["results"]] == [False, True]


def test_item_detail_carries_every_part_of_the_item(store):
    store.add_build("b1", 1, items=[sword()])

    with store.client("b1") as client:
        data = client.get("/api/v1/items/100").json()

    assert (data["aoid"], data["name"], data["ql"]) == (100, "Sword", 50)
    assert (data["item_class"], data["is_nano"]) == (2, False)
    assert data["description"] == ""
    assert sorted_stats(data["stats"]) == [(23, 9100), (54, 50), (76, 2), (298, 64)]
    assert sorted_stats(data["attack_stats"]) == [(17, 40), (102, 60)]
    assert sorted_stats(data["defense_stats"]) == [(152, 100)]
    assert data["actions"] == [
        {
            "action": 6,
            "criteria": [
                {"value1": 102, "value2": 120, "operator": 2},
                {"value1": 112, "value2": 80, "operator": 2},
                {"value1": 0, "value2": 0, "operator": 4},
            ],
        }
    ]
    assert data["spell_data"] == [
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
                        "Stat": 124,
                        "Amount": 5,
                        "SpellDescription": "Modify 124 5",
                    },
                    "criteria": [
                        {"value1": 60, "value2": 4, "operator": 0},
                        {"value1": 54, "value2": 10, "operator": 2},
                    ],
                }
            ],
        }
    ]
    assert data["sources"] == []


def test_an_item_without_optional_parts_has_empty_lists(store):
    store.add_build("b1", 1, items=[item(1)])

    with store.client("b1") as client:
        data = client.get("/api/v1/items/1").json()

    assert data["spell_data"] == data["actions"] == []
    assert data["attack_stats"] == data["defense_stats"] == data["sources"] == []


def test_the_deprecated_id_of_an_item_is_its_aoid(store):
    store.add_build("b1", 1, items=[item(4711)])

    with store.client("b1") as client:
        assert client.get("/api/v1/items/4711").json()["id"] == 4711


# ---------------------------------------------------------------------------
# Nanos: curated QL and effective strain
# ---------------------------------------------------------------------------


def test_a_nano_is_served_with_its_curated_ql(store):
    store.add_build("live", 1, nanos=[nano(10), nano(11)])
    store.curate(nanos="10,125,,Heal,0,0\n")

    with store.client("live") as client:
        assert client.get("/api/v1/items/10").json()["ql"] == 125
        assert client.get("/api/v1/items/11").json()["ql"] == 1


def test_a_nanos_strain_follows_the_strain_policy_of_the_build(store):
    nanos = [nano(10, strain=7, substrain=2), nano(11), nano(12, strain=3)]
    store.add_build("old", 1, nanos=nanos)
    store.add_build("live", 2, nanos=nanos)
    store.curate(nanos="10,125,,Heal,9,4\n11,60,,Cure,0,0\n")

    def strains(client, aoid):
        stats = client.get(f"/api/v1/items/{aoid}").json()["stats"]
        return sorted_stats(s for s in stats if s["stat"] in (75, 1003))

    with store.client("old") as client:
        assert strains(client, 10) == [(75, 7), (1003, 2)]
        assert strains(client, 11) == []
        assert strains(client, 12) == [(75, 3)]
    with store.client("live") as client:
        assert strains(client, 10) == [(75, 9), (1003, 4)]
        assert strains(client, 11) == []
        assert strains(client, 12) == [(75, 3)]


# ---------------------------------------------------------------------------
# Sources and feature flags
# ---------------------------------------------------------------------------


def crystal_sources(client, aoid):
    return [
        (source["source"]["source_id"], source["source"]["name"])
        for source in client.get(f"/api/v1/items/{aoid}").json()["sources"]
    ]


def test_a_crystal_source_is_named_as_the_crystal_is_in_the_build(store):
    store.add_build("b1", 1, items=[item(300, name="Crystal (Heal)")], nanos=[nano(10)])
    store.add_build(
        "b2", 2, items=[item(300, name="NanoCrystal (Heal)")], nanos=[nano(10)]
    )
    store.curate(nanos="10,125,300,Heal,0,0\n")

    with store.client("b1") as client:
        assert crystal_sources(client, 10) == [(300, "Crystal (Heal)")]
    with store.client("b2") as client:
        source = client.get("/api/v1/items/10").json()["sources"][0]

    assert source["source"]["name"] == "NanoCrystal (Heal)"
    assert source["source"]["source_type"]["name"] == "item"
    assert source["source"]["extra_data"] == {"type": "nanocrystal"}
    assert (source["min_ql"], source["max_ql"]) == (125, 125)
    assert source["drop_rate"] is None
    assert source["extra_data"] == {
        "nano_name": "Heal",
        "crystal_aoid": 300,
        "crystal_name": "NanoCrystal (Heal)",
    }


def test_a_crystal_absent_from_the_build_is_not_a_source(store):
    store.add_build("b1", 1, nanos=[nano(10)])
    store.add_build(
        "b2", 2, items=[item(300, name="Crystal"), item(301)], nanos=[nano(10)]
    )
    store.curate(nanos="10,125,300;301,Heal,0,0\n")

    with store.client("b1") as client:
        assert crystal_sources(client, 10) == []
    with store.client("b2") as client:
        assert crystal_sources(client, 10) == [(300, "Crystal"), (301, "Thing")]


def test_item_sources_need_the_sources_flag(store):
    store.add_build(
        "b1",
        1,
        items=[item(300)],
        nanos=[nano(10)],
        features={"sources": False, "symbiants": True},
    )
    store.curate(nanos="10,125,300,Heal,0,0\n")

    with store.client("b1") as client:
        assert crystal_sources(client, 10) == []


def test_mob_sources_need_the_symbiants_flag(store):
    drop = item(500, name="Symbiant")
    store.add_build("old", 1, items=[drop], features={"sources": True})
    store.add_build("live", 2, items=[drop])
    store.curate(mobs=[("Ahpta", "Inferno", 500)])

    with store.client("old") as client:
        assert client.get("/api/v1/items/500").json()["sources"] == []
    with store.client("live") as client:
        sources = client.get("/api/v1/items/500").json()["sources"]

    assert [
        (s["source"]["name"], s["source"]["source_type"]["name"]) for s in sources
    ] == [("Ahpta", "mob")]
    assert sources[0]["extra_data"] == {}


# ---------------------------------------------------------------------------
# Item loader
# ---------------------------------------------------------------------------


def test_the_loader_returns_items_in_the_order_asked_and_skips_absent_ones(store):
    build = store.add_build("b1", 1, items=[item(1), item(2), item(3)])

    details = load_item_details(store.db, build, aoids=[3, 99, 1, 3])

    assert [detail.aoid for detail in details] == [3, 1]


def test_the_loader_serves_revisions_found_by_a_presence_query(store):
    store.add_build("b1", 1, items=[item(1, ql=10), item(2, ql=20), item(3, ql=30)])
    build = store.add_build("b2", 2, items=[item(1, ql=11), item(3, ql=30)])

    page = fetch_page(store.db, revisions(build), [t.item_revision.c.ql.desc()], 1, 10)
    details = load_item_details(store.db, build, rev_ids=page.rev_ids)

    assert [(detail.aoid, detail.ql) for detail in details] == [(3, 30), (1, 11)]


def test_a_page_of_items_costs_as_many_queries_as_one_item(store):
    nanos = [nano(1000 + n) for n in range(40)]
    crystals = [item(2000 + n) for n in range(40)]
    build = store.add_build(
        "b1", 1, items=[sword(aoid=n) for n in range(1, 41)] + crystals, nanos=nanos
    )
    store.curate(
        nanos="".join(f"{1000 + n},50,{2000 + n},Nano,0,0\n" for n in range(40))
    )
    everything = list(range(1, 41)) + [1000 + n for n in range(40)]

    with store.counting_queries() as one:
        load_item_details(store.db, build, aoids=[1])
    with store.counting_queries() as page:
        details = load_item_details(store.db, build, aoids=everything)

    assert len(details) == 80
    assert all(detail.sources for detail in details[40:])
    assert 0 < len(page) == len(one) <= 3


def test_records_hold_the_item_as_served(store):
    build = store.add_build("b1", 1, items=[sword()])

    (record,) = load_records(store.db, build, aoids=[100])

    assert (record.aoid, record.name, record.ql, record.item_class) == (
        100,
        "Sword",
        50,
        2,
    )
    assert sorted(record.stats) == [(23, 9100), (54, 50), (76, 2), (298, 64)]
    assert record.attack == [(17, 40), (102, 60)]
    assert record.defense == [(152, 100)]
    assert record.actions[0]["criteria"] == [[102, 120, 2], [112, 80, 2], [0, 0, 4]]
    assert record.effects[0]["effects"][0]["params"] == {"Stat": 124, "Amount": 5}


# ---------------------------------------------------------------------------
# Presence: the base of lists and searches
# ---------------------------------------------------------------------------


def aoids_of(store, query):
    return sorted(store.db.execute(query).scalars())


def test_revisions_are_the_items_of_the_build_once_each(store):
    b1 = store.add_build("b1", 1, items=[item(1), item(2)])
    b2 = store.add_build("b2", 2, items=[item(1, name="Renamed"), item(3)])
    b3 = store.add_build("b3", 3, items=[item(1, name="Renamed"), item(2), item(3)])
    fork = store.add_build(
        "fork", 1, items=[item(1), item(7)], branch="prk", parent_slug="b1"
    )

    aoid = t.item_revision.c.aoid
    assert aoids_of(store, revisions(b1, aoid)) == [1, 2]
    assert aoids_of(store, revisions(b2, aoid)) == [1, 3]
    assert aoids_of(store, revisions(b3, aoid)) == [1, 2, 3]
    assert aoids_of(store, revisions(fork, aoid)) == [1, 7]


def test_filters_compose_on_the_revisions_of_a_build(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            sword(aoid=1, name="Short Sword", ql=10, skill=50),
            sword(aoid=2, name="Long Sword", ql=200, skill=900),
            item(3, name="Sword Polish", ql=200),
        ],
        nanos=[nano(10, strain=7), nano(11, strain=8)],
    )
    revision, aoid = t.item_revision, t.item_revision.c.aoid

    def found(*conditions):
        return aoids_of(store, revisions(build, aoid).where(*conditions))

    assert found(revision.c.ql >= 100, ~revision.c.is_nano) == [2, 3]
    assert found(has_stat(t.stat_entry.c.stat == 298)) == [1, 2]
    assert found(
        has_requirement(
            t.requirement.c.action == 6,
            t.requirement.c.value1 == 102,
            t.requirement.c.value2 > 100,
        )
    ) == [2]
    assert found(
        has_effect(t.effect_entry.c.spell_id == 53045, t.effect_entry.c.subject == 124)
    ) == [1, 2]
    assert found(
        has_atkdef(t.atkdef_entry.c.is_attack, t.atkdef_entry.c.stat == 102)
    ) == [1, 2]
    by_name = (
        revisions(build, aoid)
        .join(t.part_text, t.part_text.c.text_id == revision.c.text_id)
        .where(t.part_text.c.name.ilike("%sword%"), revision.c.ql == 200)
    )
    assert aoids_of(store, by_name) == [2, 3]
    by_strain = (
        revisions(build, aoid)
        .join(t.nano_properties, nano_policy(build))
        .where(t.nano_properties.c.strain == 8)
    )
    assert aoids_of(store, by_strain) == [11]


def test_pages_are_sorted_with_the_aoid_breaking_ties_and_counted_once(store):
    build = store.add_build(
        "b1", 1, items=[item(aoid, ql=10 * (aoid % 2)) for aoid in range(1, 8)]
    )
    query = revisions(build)
    by_ql = [t.item_revision.c.ql]

    def aoids(page):
        records = load_records(store.db, build, rev_ids=page.rev_ids)
        return [record.aoid for record in records]

    first = fetch_page(store.db, query, by_ql, 1, 3)
    second = fetch_page(store.db, query, by_ql, 2, 3)
    third = fetch_page(store.db, query, by_ql, 3, 3)

    assert (first.total, second.total, third.total) == (7, 7, 7)
    assert aoids(first) + aoids(second) + aoids(third) == [2, 4, 6, 1, 3, 5, 7]
    assert page_fields(first.total, 2, 3) == {
        "total": 7,
        "page": 2,
        "page_size": 3,
        "pages": 3,
        "has_next": True,
        "has_prev": True,
    }
    assert page_fields(0, 1, 50)["pages"] == 1
