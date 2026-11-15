"""
Tests for the item list (``GET /items``) and item search
(``GET /items/search``) on the content-addressed store.

Each test fills a throwaway store (the ``store`` fixture) with a few hand-made
items and asks the API which of them a request finds, and in what order.
"""

import os
import re

import pytest
from sqlalchemy import select

from app.api.services.item_search import SEARCHABLE_FIELDS, substring_match
from app.store import tables as t
from app.store.presence import revisions
from app.tests.fixtures.store_fixtures import criterion, item, modify, nano

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

NODROP = 16384
USE, WIELD = 3, 6


def actions(*entries):
    """``actions((USE, criterion(...), ...), ...)`` as an item's ActionData."""
    return {
        "Actions": [
            {"Action": action, "Criteria": list(criteria)}
            for action, *criteria in entries
        ]
    }


def effects(*entries):
    return [{"Event": 14, "Items": list(entries)}]


def set_skill(skill, amount):
    return {
        "SpellID": 53026,
        "Target": 2,
        "Skill": skill,
        "Amount": amount,
        "Criteria": [],
    }


def pairs(*entries):
    return [{"Stat": stat, "RawValue": value} for stat, value in entries]


def weapon(aoid, name="Gun", **extra):
    return item(
        aoid,
        name=name,
        AttackDefenseData={"Attack": pairs((112, 100)), "Defense": []},
        **extra,
    )


def of_class(item_class, record):
    """``record`` with its item class (stat 76) changed."""
    for entry in record["StatValues"]:
        if entry["Stat"] == 76:
            entry["RawValue"] = item_class
    return record


def described(aoid, name, description, **extra):
    return item(aoid, name=name, Description=description, **extra)


def found(client, path, **params):
    """The AOIDs a request returns, in the order returned."""
    response = client.get(f"/api/v1{path}", params=params)
    assert response.status_code == 200, response.text
    return [row["aoid"] for row in response.json()["items"]]


def listed(client, **params):
    return found(client, "/items", **params)


def searched(client, q, **params):
    return found(client, "/items/search", q=q, **params)


# ---------------------------------------------------------------------------
# The list
# ---------------------------------------------------------------------------


def test_the_list_is_the_items_of_the_build_in_aoid_order(store):
    store.add_build("old", 1, items=[item(30), item(10)])
    store.add_build("new", 2, items=[item(30), item(20), item(10)], nanos=[nano(5)])

    with store.client("old") as client:
        assert listed(client) == [10, 30]
    with store.client("new") as client:
        assert listed(client) == [5, 10, 20, 30]


def test_pages_of_the_list_partition_it(store):
    store.add_build("b1", 1, items=[item(aoid) for aoid in range(1, 8)])

    with store.client("b1") as client:
        first = client.get("/api/v1/items?page_size=3").json()
        last = client.get("/api/v1/items?page_size=3&page=3").json()

    assert [row["aoid"] for row in first["items"]] == [1, 2, 3]
    assert (first["total"], first["pages"], first["has_next"]) == (7, 3, True)
    assert [row["aoid"] for row in last["items"]] == [7]
    assert (last["has_next"], last["has_prev"]) == (False, True)


def test_an_item_is_listed_whole(store):
    store.add_build(
        "b1",
        1,
        items=[
            weapon(
                1,
                name="Gun",
                ql=40,
                stats=[(298, 64)],
                SpellData=effects(modify(124, 5)),
                ActionData=actions((WIELD, criterion(112, 80, 2))),
            )
        ],
    )

    with store.client("b1") as client:
        (row,) = client.get("/api/v1/items").json()["items"]

    assert (row["id"], row["aoid"], row["name"], row["ql"]) == (1, 1, "Gun", 40)
    assert {"stat": 298, "value": 64} in row["stats"]
    assert row["attack_stats"] == [{"stat": 112, "value": 100}]
    assert row["actions"][0]["criteria"] == [
        {"value1": 112, "value2": 80, "operator": 2}
    ]
    assert row["spell_data"][0]["spells"][0]["spell_params"]["Stat"] == 124


def test_the_list_filters_on_class_quality_and_nanos(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, ql=10),
            item(2, ql=20),
            of_class(1, item(3, ql=30)),
        ],
        nanos=[nano(4)],
    )
    store.curate(nanos="4,20,,Heal,0,0\n")

    with store.client("b1") as client:
        assert listed(client, min_ql=20) == [2, 3, 4]
        assert listed(client, max_ql=20) == [1, 2, 4]
        assert listed(client, min_ql=15, max_ql=25) == [2, 4]
        assert listed(client, is_nano="true") == [4]
        assert listed(client, is_nano="false", min_ql=20) == [2, 3]
        assert listed(client, item_class=2, min_ql=20) == [2, 4]
        # class 0 is no filter
        assert listed(client, item_class=0) == [1, 2, 3, 4]


def test_the_list_costs_the_same_queries_whatever_it_returns(store):
    store.add_build("b1", 1, items=[weapon(aoid) for aoid in range(1, 31)])

    with store.client("b1") as client:
        with store.counting_queries() as one:
            assert len(listed(client, page_size=1)) == 1
        with store.counting_queries() as many:
            assert len(listed(client, page_size=30)) == 30

    assert 0 < len(many) == len(one) <= 5


# ---------------------------------------------------------------------------
# Filters shared by the list and the search
# ---------------------------------------------------------------------------


def test_slot_tests_a_bit_of_the_equipment_mask(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, stats=[(298, 1 << 6)]),
            item(2, stats=[(298, (1 << 6) | (1 << 2))]),
            item(3, stats=[(298, 1 << 2)]),
            item(4),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, slot=6) == [1, 2]
        assert listed(client, slot=2) == [2, 3]
        assert listed(client, slot=7) == []
        # slot 0 is no filter; a bit no mask has matches nothing
        assert listed(client, slot=0) == [1, 2, 3, 4]
        assert listed(client, slot=63) == []
        assert listed(client, slot=200) == []


def test_breed_gender_and_faction_are_requirements_of_any_action(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, ActionData=actions((WIELD, criterion(4, 1, 0)))),
            item(2, ActionData=actions((USE, criterion(4, 2, 0)))),
            item(3, ActionData=actions((WIELD, criterion(59, 2, 0)))),
            item(4, ActionData=actions((USE, criterion(33, 1, 0)))),
            item(5),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, breed=1) == [1]
        assert listed(client, breed=2) == [2]
        assert listed(client, gender=2) == [3]
        assert listed(client, faction=1) == [4]
        assert listed(client, faction=2) == []
        assert listed(client, breed=0, gender=0, faction=0) == [1, 2, 3, 4, 5]


def test_profession_is_a_requirement_to_use_under_either_profession_stat(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, ActionData=actions((USE, criterion(60, 11, 0)))),
            item(2, ActionData=actions((USE, criterion(368, 11, 0)))),
            item(3, ActionData=actions((WIELD, criterion(60, 11, 0)))),
            item(4, ActionData=actions((USE, criterion(60, 6, 0)))),
            # the requirement and its value on different criteria
            item(
                5, ActionData=actions((USE, criterion(60, 6, 0), criterion(4, 11, 0)))
            ),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, profession=11) == [1, 2]
        assert listed(client, profession=6) == [4, 5]


def test_froob_friendly_items_neither_have_nor_require_an_expansion(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1),
            item(2, stats=[(389, 2)]),
            item(3, ActionData=actions((WIELD, criterion(389, 1, 22)))),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, froob_friendly="true") == [1]
        assert listed(client, froob_friendly="false") == [1, 2, 3]


def test_nodrop_is_a_flag_of_the_item_either_way(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, stats=[(0, NODROP | 1)]),
            item(2, stats=[(0, 1)]),
            item(3),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, nodrop="true") == [1]
        assert listed(client, nodrop="false") == [2, 3]


def test_stat_bonuses_finds_items_that_modify_or_set_one_of_the_stats(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, SpellData=effects(modify(124, 5))),
            item(2, SpellData=effects(set_skill(17, 1))),
            item(3, SpellData=effects(modify(19, 5))),
            # a requirement on the stat is not a bonus to it
            item(4, ActionData=actions((WIELD, criterion(124, 50, 2)))),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, stat_bonuses="124") == [1]
        assert listed(client, stat_bonuses="124,17") == [1, 2]
        assert listed(client, stat_bonuses=" 19 ,, 17") == [2, 3]
        # a list with a non-number in it is ignored as a whole
        assert listed(client, stat_bonuses="124,abc") == [1, 2, 3, 4]


def test_an_effect_that_hits_a_stat_is_not_a_bonus_to_it(store):
    hit_health = {**modify(27, 50), "SpellID": 53002}
    store.add_build(
        "b1",
        1,
        items=[
            item(1, SpellData=effects(modify(27, 50))),
            item(2, SpellData=effects(hit_health)),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, stat_bonuses="27") == [1]
        assert listed(client, stat_filters="modifies:27:>=:1") == [1]
        assert searched(client, "thing", stat_bonuses="27") == [1]


def test_stat_filters_compare_requirements_and_bonuses(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(
                1,
                SpellData=effects(modify(124, 5)),
                ActionData=actions((WIELD, criterion(112, 100, 2))),
            ),
            item(
                2,
                SpellData=effects(modify(124, 20)),
                ActionData=actions((USE, criterion(112, 300, 2))),
            ),
            item(3, SpellData=effects(modify(17, 20), set_skill(124, -3))),
        ],
    )

    with store.client("b1") as client:
        assert listed(client, stat_filters="requires:112:>=:100") == [1, 2]
        assert listed(client, stat_filters="requires:112:<=:100") == [1]
        assert listed(client, stat_filters="requires:112:==:300") == [2]
        assert listed(client, stat_filters="requires:112:!=:300") == [1]
        assert listed(client, stat_filters="modifies:124:>=:20") == [2]
        assert listed(client, stat_filters="modifies:124:<=:5") == [1, 3]
        assert listed(client, stat_filters="modifies:124:!=:5") == [2, 3]
        # every filter must hold
        assert listed(
            client, stat_filters="requires:112:>=:100,modifies:124:>=:20"
        ) == [2]
        # the stat and the amount are those of one effect
        assert listed(client, stat_filters="modifies:17:<=:0") == []


def test_malformed_stat_filters_are_skipped(store):
    store.add_build(
        "b1",
        1,
        items=[item(1, SpellData=effects(modify(124, 5))), item(2)],
    )

    with store.client("b1") as client:
        for malformed in ("requires:112", "grants:124:>=:1", "modifies:124:>:1", "x"):
            assert listed(client, stat_filters=malformed) == [1, 2]
        assert listed(client, stat_filters="modifies:abc:>=:1,modifies:124:>=:1") == [1]


def test_strain_is_the_strain_the_build_serves(store):
    nanos = [nano(10, strain=7), nano(11), nano(12, strain=9)]
    store.add_build("old", 1, nanos=nanos, items=[item(20, stats=[(75, 9)])])
    store.add_build("live", 2, nanos=nanos, items=[item(20, stats=[(75, 9)])])
    store.curate(nanos="10,125,,Heal,9,0\n11,60,,Cure,7,0\n")

    # an older build keeps a usable strain of its own; the newest takes the
    # curated one. An item that is not a nano only has its own stat.
    with store.client("old") as client:
        assert listed(client, strain=7) == [10, 11]
        assert listed(client, strain=9) == [12, 20]
    with store.client("live") as client:
        assert listed(client, strain=7) == [11]
        assert listed(client, strain=9) == [10, 12, 20]
        assert listed(client, strain=9, is_nano="true") == [10, 12]
        assert listed(client, strain=0) == [10, 11, 12, 20]


def test_filters_apply_to_the_search_as_to_the_list(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, name="Red Hat", stats=[(298, 4), (0, NODROP)]),
            item(2, name="Blue Hat", stats=[(298, 4)]),
            item(3, name="Red Shoe", stats=[(298, 32)]),
        ],
    )

    with store.client("b1") as client:
        assert searched(client, "hat", slot=2) == [2, 1]
        assert searched(client, "red", slot=2) == [1]
        assert searched(client, "hat", nodrop="false") == [2]
        assert searched(client, "hat", exact_match="false", nodrop="true") == [1]


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


def test_exact_search_finds_a_substring_of_name_or_description(store):
    store.add_build(
        "b1",
        1,
        items=[
            described(1, "Swordfish", "A fish."),
            described(2, "Knife", "Shorter than a SWORD."),
            described(3, "Axe", "Heavy."),
        ],
    )

    with store.client("b1") as client:
        assert searched(client, "sword") == [2, 1]
        assert searched(client, "sword", search_fields="name") == [1]
        assert searched(client, "sword", search_fields="description") == [2]
        assert searched(client, "sword", search_fields="description,name") == [2, 1]
        # fields that hold no text search the name; unknown ones are ignored
        assert searched(client, "sword", search_fields="effects") == [1]
        assert searched(client, "sword", search_fields="colour") == [2, 1]
        assert searched(client, "zzz") == []


def test_a_substring_match_can_be_answered_from_the_trigram_indexes(store):
    store.add_build("b1", 1, items=[described(1, "Swordfish", "A fish.")])

    def indexes_read(fields):
        texts = select(t.part_text.c.text_id).where(substring_match(fields, "sword"))
        with store.bitmap_scans_only():
            return set(re.findall(r"part_text_\w+", store.plan(texts)))

    assert indexes_read(["name"]) == {"part_text_name_trgm"}
    assert indexes_read(["description"]) == {"part_text_desc_trgm"}
    assert indexes_read(["name", "description"]) == {
        "part_text_name_trgm",
        "part_text_desc_trgm",
    }


def test_a_search_finds_the_same_rows_in_the_same_order_through_the_indexes(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            described(1, "Swordfish", "A fish.", ql=10, stats=[(298, 4)]),
            described(2, "Knife", "Shorter than a SWORD.", ql=50),
            weapon(3, name="Great Sword", ql=90, stats=[(298, 4)]),
            described(4, "Axe", "Heavy. Of no use to a fish.", ql=90),
            described(5, "Old Sword", "", SpellData=effects(modify(124, 20))),
            described(6, "Tiny sword", "100% silk_"),
            described(7, "Io", "Made of swords."),
        ],
        nanos=[
            item(20, name="Nano Sword", stats=[(405, 1), (75, 5)]),
            described(21, "Calm", "Sheathes every sword.", stats=[(405, 1), (75, 6)]),
            item(22, name="Io", stats=[(405, 1), (75, 5)]),
        ],
    )
    items, nanos = "/items/search", "/nanos/search"
    requests = {
        "name or description": (items, dict(q="sword")),
        "every text": (items, dict(q="o")),
        "common": (items, dict(q="fish")),
        "rare": (items, dict(q="silk")),
        "two characters": (items, dict(q="io")),
        "two words": (items, dict(q="great sword")),
        "nothing": (items, dict(q="zzyzx")),
        "wildcards": (items, dict(q="100%_s")),
        "name": (items, dict(q="SWORD", search_fields="name")),
        "description": (items, dict(q="Sword", search_fields="description")),
        "second page": (items, dict(q="sword", page=2, page_size=3)),
        "slot": (items, dict(q="sword", slot=2)),
        "quality": (items, dict(q="sword", min_ql=50, max_ql=90)),
        "weapons": (items, dict(q="sword", weapons="true")),
        "stat filter": (items, dict(q="sword", stat_filters="modifies:124:>=:20")),
        "nanos": (nanos, dict(q="sword")),
        "nanos, two characters": (nanos, dict(q="io")),
        "nanos of a strain": (nanos, dict(q="sword", strain=5)),
        "nanos descending": (nanos, dict(q="sword", sort_desc="true")),
    }

    search = (
        revisions(build)
        .join(t.part_text, t.part_text.c.text_id == t.item_revision.c.text_id)
        .where(substring_match(SEARCHABLE_FIELDS, "sword"))
    )

    with store.client("b1") as client:

        def answers():
            answered = {
                name: found(client, path, **params)
                for name, (path, params) in requests.items()
            }
            strains = client.get("/api/v1/nanos/strains", params={"q": "sword"})
            return answered, strains.json()

        by_reading_every_text = answers()
        plan_reading_every_text = store.plan(search)
        with store.bitmap_scans_only():
            through_the_indexes = answers()
            plan_through_the_indexes = store.plan(search)

    assert "_trgm" not in plan_reading_every_text
    assert "part_text_name_trgm" in plan_through_the_indexes
    assert "part_text_desc_trgm" in plan_through_the_indexes
    assert through_the_indexes == by_reading_every_text
    assert by_reading_every_text[0] == {
        "name or description": [21, 3, 7, 2, 20, 5, 1, 6],
        "every text": [4, 21, 3, 7, 22, 2, 20, 5, 1, 6],
        "common": [4, 1],
        "rare": [6],
        "two characters": [7, 22],
        "two words": [3],
        "nothing": [],
        "wildcards": [6],
        "name": [3, 20, 5, 1, 6],
        "description": [21, 7, 2],
        "second page": [2, 20, 5],
        "slot": [3, 1],
        "quality": [3, 2],
        "weapons": [3],
        "stat filter": [5],
        "nanos": [21, 20],
        "nanos, two characters": [22],
        "nanos of a strain": [20],
        "nanos descending": [20, 21],
    }
    assert [row["id"] for row in by_reading_every_text[1]["strains"]] == [5, 6]


def test_exact_search_is_sorted_by_name_then_aoid(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(4, name="Ring B"),
            item(3, name="Ring A"),
            item(2, name="Ring B"),
            item(1, name="Ring C"),
        ],
    )

    with store.client("b1") as client:
        assert searched(client, "ring") == [3, 2, 4, 1]
        assert searched(client, "ring", page_size=2, page=2) == [4, 1]
        past_the_end = client.get(
            "/api/v1/items/search?q=ring&page_size=2&page=9"
        ).json()

    assert past_the_end["items"] == []
    assert (past_the_end["total"], past_the_end["pages"]) == (4, 2)
    assert (past_the_end["has_next"], past_the_end["has_prev"]) == (False, True)


def test_search_reads_the_names_of_the_build(store):
    store.add_build("old", 1, items=[item(1, name="Wrench")])
    store.add_build("new", 2, items=[item(1, name="Spanner"), item(2, name="Wrench")])

    with store.client("old") as client:
        assert searched(client, "wrench") == [1]
        assert searched(client, "spanner") == []
        assert searched(client, "wrench", exact_match="false") == [1]
    with store.client("new") as client:
        assert searched(client, "wrench") == [2]
        assert searched(client, "spanner", exact_match="false") == [1]


def test_search_filters_on_quality_class_and_weapons(store):
    store.add_build(
        "b1",
        1,
        items=[
            of_class(1, weapon(1, name="Old Gun", ql=10)),
            item(2, name="Gun Oil", ql=50),
            weapon(3, name="New Gun", ql=90),
        ],
    )

    with store.client("b1") as client:
        assert searched(client, "gun", weapons="true") == [3, 1]
        assert searched(client, "gun", min_ql=50) == [2, 3]
        assert searched(client, "gun", max_ql=50) == [2, 1]
        assert searched(client, "gun", item_class=1) == [1]
        assert searched(client, "gun", item_class=0) == [2, 3, 1]


def test_stemmed_search_matches_word_forms_in_the_fields_asked(store):
    store.add_build(
        "b1",
        1,
        items=[
            described(1, "Running Shoes", "For the feet."),
            described(2, "Hat", "Keeps the sun off while one runs."),
            described(3, "Runner", "A carpet."),
        ],
    )

    def stemmed(client, q, **params):
        return sorted(searched(client, q, exact_match="false", **params))

    with store.client("b1") as client:
        assert stemmed(client, "run") == [1, 2]
        assert stemmed(client, "run", search_fields="name") == [1]
        assert stemmed(client, "run", search_fields="description") == [2]
        assert stemmed(client, "run", search_fields="stats") == [1, 2]
        # every word must be found, across name and description together
        assert stemmed(client, "hat sun") == [2]
        assert stemmed(client, "hat carpet") == []
        assert stemmed(client, "hat OR carpet") == [2, 3]
        assert stemmed(client, "run -shoes") == [2]


def test_stemmed_search_is_sorted_by_rank_then_aoid(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(5, name="Sword"),
            item(4, name="Sword of the sword sword"),
            item(3, name="Sword"),
            item(2, name="Sword and shield and helmet and boots and gloves"),
        ],
    )

    with store.client("b1") as client:
        rows = client.get(
            "/api/v1/items/search?q=sword&exact_match=false&search_fields=name"
        ).json()["items"]
        second_page = searched(
            client, "sword", exact_match="false", page_size=2, page=2
        )

    order = [row["aoid"] for row in rows]
    assert order[0] == 4
    assert order.index(3) + 1 == order.index(5)
    assert second_page == order[2:]


def test_stemmed_search_for_weapons_is_sorted_by_name(store):
    store.add_build(
        "b1",
        1,
        items=[
            weapon(1, name="Zap gun gun gun"),
            weapon(3, name="Air gun"),
            weapon(2, name="Air gun"),
            item(4, name="Gun rack"),
        ],
    )

    with store.client("b1") as client:
        assert searched(client, "gun", exact_match="false", weapons="true") == [2, 3, 1]


def test_stemmed_search_takes_any_text_and_stat_filters(store):
    store.add_build(
        "b1",
        1,
        items=[
            item(1, name="Lucky Ring", SpellData=effects(modify(124, 5))),
            item(2, name="Plain Ring"),
        ],
    )

    with store.client("b1") as client:
        assert searched(
            client, "ring", exact_match="false", stat_filters="modifies:124:>=:1"
        ) == [1]
        for odd in ("ring's", '"ring', "(ring", "ring:", "!", "ring & | !"):
            response = client.get(
                "/api/v1/items/search", params={"q": odd, "exact_match": "false"}
            )
            assert response.status_code == 200, odd


def test_search_refuses_requests_outside_its_bounds(store):
    store.add_build("b1", 1, items=[item(1)])

    with store.client("b1") as client:
        for query in (
            "",
            "?q=",
            "?q=a&min_ql=0",
            "?q=a&max_ql=1000",
            "?q=a&page=0",
            "?q=a&page_size=1001",
        ):
            assert client.get(f"/api/v1/items/search{query}").status_code == 422, query
        assert client.get("/api/v1/items?page_size=0").status_code == 422
