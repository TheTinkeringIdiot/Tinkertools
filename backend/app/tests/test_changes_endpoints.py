"""
Tests for the cross-version diff routes:

    GET /changes
    GET /changes/transitions
    GET /compare/{base}
    GET /items/{aoid}/timeline
    GET /items/{aoid}/compare/{base}

Each test fills a throwaway store (the ``store`` fixture) with a few builds of
hand-made items and asks the API what changed. The last section checks the
comparison of two builds on the real game data.
"""

import json
import logging
import os
from dataclasses import replace

import pytest

from app.core.change_rules import (
    RELEVANCE_FILE,
    default_rules,
    parse_notes,
    parse_relevance,
)
from app.store import comparison
from app.store.changes import (
    ChangeFilters,
    compare_item as item_comparison,
    fetch_changes,
    find_build,
    load_build_index,
    logged_changes,
    stale_rules,
    warn_of_stale_rules,
)
from app.store.comparison import compare_page
from app.store.context import read_builds
from app.tests.fixtures.store_fixtures import criterion, item, modify, nano

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

STAT_VALUE = 74  # economy
STAT_ICON = 79  # cosmetic
STAT_CAN = 30  # gameplay, flags
STAT_SLOT = 298
PROFESSION = 60
USE, WEAR = 3, 6


def wear(*effects, event=14):
    return [{"Event": event, "Items": list(effects)}]


def requires(action, *criteria):
    return {"Actions": [{"Action": action, "Criteria": list(criteria)}]}


def get(store, slug, path, **params):
    with store.client(slug) as client:
        response = client.get(f"/api/v1{path}", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def changes(store, slug, **params):
    return get(store, slug, "/changes", **params)


def rows(body):
    """``{aoid: row}`` of a change list."""
    return {row["aoid"]: row for row in body["items"]}


def aoids(body):
    return [row["aoid"] for row in body["items"]]


# ---------------------------------------------------------------------------
# A small history
# ---------------------------------------------------------------------------

WRENCH, HAMMER, PLIERS, SAW, DRILL, CHISEL = 100, 200, 300, 400, 500, 600


@pytest.fixture
def history(store):
    """Four builds of branch ao and a fork from the second.

    one    Wrench, Hammer, Pliers, Saw
    two    Wrench renamed Spanner; Hammer hits harder (effect); Saw gone;
           Drill new; Pliers dearer (economy)
    three  Wrench (Spanner) gets a requirement; Hammer back to what it was;
           Saw returns; Pliers new icon
    four   Hammer gone
    fork   (prk, from two) Hammer stronger still; Chisel new; Drill gone
    """
    store.add_build(
        "one",
        1,
        items=[
            item(WRENCH, name="Wrench", ql=10, stats=[(STAT_CAN, 1)]),
            item(HAMMER, name="Hammer", ql=50, SpellData=wear(modify(16, 5))),
            item(PLIERS, name="Pliers", ql=20, stats=[(STAT_VALUE, 100)]),
            item(SAW, name="Saw", ql=30),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(WRENCH, name="Spanner", ql=10, stats=[(STAT_CAN, 1)]),
            item(HAMMER, name="Hammer", ql=50, SpellData=wear(modify(16, 9))),
            item(PLIERS, name="Pliers", ql=20, stats=[(STAT_VALUE, 250)]),
            item(DRILL, name="Drill", ql=200),
        ],
    )
    store.add_build(
        "three",
        3,
        items=[
            item(
                WRENCH,
                name="Spanner",
                ql=10,
                stats=[(STAT_CAN, 9)],
                ActionData=requires(WEAR, criterion(112, 50, 2)),
            ),
            item(HAMMER, name="Hammer", ql=50, SpellData=wear(modify(16, 5))),
            item(
                PLIERS, name="Pliers", ql=20, stats=[(STAT_VALUE, 250), (STAT_ICON, 7)]
            ),
            item(SAW, name="Saw", ql=30),
            item(DRILL, name="Drill", ql=200),
        ],
    )
    store.add_build(
        "four",
        4,
        items=[
            item(
                WRENCH,
                name="Spanner",
                ql=10,
                stats=[(STAT_CAN, 9)],
                ActionData=requires(WEAR, criterion(112, 50, 2)),
            ),
            item(
                PLIERS, name="Pliers", ql=20, stats=[(STAT_VALUE, 250), (STAT_ICON, 7)]
            ),
            item(SAW, name="Saw", ql=30),
            item(DRILL, name="Drill", ql=200),
        ],
    )
    store.add_build(
        "fork",
        1,
        branch="prk",
        parent_slug="two",
        items=[
            item(WRENCH, name="Spanner", ql=10, stats=[(STAT_CAN, 1)]),
            item(HAMMER, name="Hammer", ql=50, SpellData=wear(modify(16, 12))),
            item(PLIERS, name="Pliers", ql=20, stats=[(STAT_VALUE, 250)]),
            item(CHISEL, name="Chisel", ql=5),
        ],
    )
    return store


# ---------------------------------------------------------------------------
# Item timeline
# ---------------------------------------------------------------------------


def timeline(store, slug, aoid, **params):
    return get(store, slug, f"/items/{aoid}/timeline", **params)


def test_timeline_lists_every_change_of_an_item_newest_first(history):
    body = timeline(history, "four", WRENCH)

    assert body["aoid"] == WRENCH and body["family"] == "ao"
    assert [(e["build"]["slug"], e["kind"], e["parts"]) for e in body["entries"]] == [
        ("three", "changed", ["stats", "actions"]),
        ("two", "changed", ["text"]),
        ("one", "added", []),
    ]
    assert [e["name"] for e in body["entries"]] == ["Spanner", "Spanner", "Wrench"]
    assert [e["base"] and e["base"]["slug"] for e in body["entries"]] == [
        "two",
        "one",
        None,
    ]


def test_timeline_entries_carry_the_field_level_diff_of_each_step(history):
    newest, renamed, added = timeline(history, "four", WRENCH)["entries"]

    assert renamed["diff"]["text"] == [
        {"field": "name", "old": "Wrench", "new": "Spanner", "relevance": "text"}
    ]
    assert renamed["relevance"] == ["text"]
    assert newest["diff"]["stats"] == [
        {
            "stat": STAT_CAN,
            "change": "changed",
            "relevance": "gameplay",
            "old": 1,
            "new": 9,
            "housekeeping": False,
            "bits_set": [8],
            "bits_cleared": [],
        }
    ]
    (action,) = newest["diff"]["actions"]
    assert (action["action"], action["change"]) == (WEAR, "added")
    assert action["criteria"] == [
        {
            "op": "added",
            "old": None,
            "new": {"value1": 112, "value2": 50, "operator": 2},
        }
    ]
    assert newest["relevance"] == ["gameplay"]
    assert added["diff"] is None and added["relevance"] == ["gameplay"]


def test_timeline_without_diffs_when_not_asked_for(history):
    entries = timeline(history, "four", WRENCH, include_diff="false")["entries"]

    assert [e["diff"] for e in entries] == [None, None, None]


def test_timeline_shows_an_item_removed_and_returning(history):
    saw = timeline(history, "four", SAW)["entries"]
    hammer = timeline(history, "four", HAMMER)["entries"]

    assert [(e["build"]["slug"], e["kind"]) for e in saw] == [
        ("three", "added"),
        ("two", "removed"),
        ("one", "added"),
    ]
    assert [(e["build"]["slug"], e["kind"]) for e in hammer] == [
        ("four", "removed"),
        ("three", "changed"),
        ("two", "changed"),
        ("one", "added"),
    ]
    assert hammer[0]["name"] == "Hammer"


def test_timeline_is_the_same_from_any_build_of_the_branch(history):
    assert timeline(history, "one", HAMMER) == timeline(history, "four", HAMMER)


def test_timeline_of_a_fork_continues_into_its_parent_up_to_the_fork(history):
    entries = timeline(history, "fork", HAMMER)["entries"]

    assert [(e["build"]["slug"], e["build"]["family"], e["kind"]) for e in entries] == [
        ("fork", "prk", "changed"),
        ("two", "ao", "changed"),
        ("one", "ao", "added"),
    ]
    assert entries[0]["base"]["slug"] == "two"
    (pair,) = entries[0]["diff"]["effects"][0]["changed"]
    assert pair["fields"] == [{"field": "spell_params.Amount", "old": 9, "new": 12}]
    assert pair["new"]["spell_format"] == "Modify {Stat} {Amount}"
    assert pair["new"]["spell_params"]["Amount"] == 12


def test_timeline_of_an_item_the_fork_never_changed_is_its_parents(history):
    entries = timeline(history, "fork", WRENCH)["entries"]

    assert [(e["build"]["slug"], e["kind"]) for e in entries] == [
        ("two", "changed"),
        ("one", "added"),
    ]


def test_timeline_of_an_unknown_item_is_empty(history):
    assert timeline(history, "four", 999999)["entries"] == []


# ---------------------------------------------------------------------------
# Build change list
# ---------------------------------------------------------------------------


def test_change_list_is_relative_to_the_previous_build(history):
    body = changes(history, "two", sort="aoid")

    assert body["build"]["slug"] == "two" and body["base"]["slug"] == "one"
    assert [(r["aoid"], r["kind"], r["parts"]) for r in body["items"]] == [
        (WRENCH, "changed", ["text"]),
        (HAMMER, "changed", ["effects"]),
        (PLIERS, "changed", ["stats"]),
        (SAW, "removed", []),
        (DRILL, "added", []),
    ]
    assert body["total"] == 5 and body["pages"] == 1


def test_change_rows_carry_what_a_list_line_shows(history):
    found = rows(changes(history, "two"))

    assert found[WRENCH] == {
        "aoid": WRENCH,
        "kind": "changed",
        "name": "Spanner",
        "old_name": "Wrench",
        "ql": 10,
        "old_ql": None,
        "item_class": 2,
        "is_nano": False,
        "icon": None,
        "parts": ["text"],
        "relevance": ["text"],
        "note_id": None,
        "diff": None,
        "diff_omitted": False,
    }
    assert found[SAW]["name"] == "Saw" and found[SAW]["ql"] == 30
    assert rows(changes(history, "three"))[PLIERS]["icon"] == 7


def test_a_row_names_the_old_name_and_ql_only_where_they_differ(store):
    store.add_build(
        "one",
        1,
        items=[
            item(1, name="Saw", ql=10),
            item(2, name="Old drill", ql=10),
            item(3, name="File", ql=10, stats=[(STAT_VALUE, 1)]),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(1, name="Saw", ql=20),
            item(2, name="New drill", ql=10),
            item(3, name="File", ql=10, stats=[(STAT_VALUE, 2)]),
        ],
    )

    found = rows(changes(store, "two"))
    compared = rows(compare(store, "two", "one"))

    for listed in (found, compared):
        assert [
            (row["name"], row["old_name"], row["ql"], row["old_ql"])
            for row in (listed[1], listed[2], listed[3])
        ] == [
            ("Saw", None, 20, 10),
            ("New drill", "Old drill", 10, None),
            ("File", None, 10, None),
        ]


def test_change_list_classifies_each_change(history):
    two = rows(changes(history, "two"))
    three = rows(changes(history, "three"))

    assert two[WRENCH]["relevance"] == ["text"]
    assert two[HAMMER]["relevance"] == ["gameplay"]
    assert two[PLIERS]["relevance"] == ["economy"]
    assert two[SAW]["relevance"] == two[DRILL]["relevance"] == ["gameplay"]
    assert three[PLIERS]["relevance"] == ["cosmetic"]


def test_change_list_summary_counts_the_whole_build_whatever_the_filters(history):
    body = changes(history, "two", kind="added")

    assert aoids(body) == [DRILL] and body["total"] == 1
    assert body["summary"] == {
        "total": 5,
        "by_kind": {"added": 1, "removed": 1, "changed": 3},
        "by_part": {
            "text": 1,
            "stats": 1,
            "effects": 1,
            "actions": 0,
            "atkdef": 0,
            "misc": 0,
        },
        "by_relevance": {"gameplay": 3, "economy": 1, "cosmetic": 0, "text": 1},
        "noted": 0,
    }


def test_first_build_of_a_store_adds_everything_and_has_no_base(history):
    body = changes(history, "one")

    assert body["base"] is None
    assert {r["kind"] for r in body["items"]} == {"added"}
    assert body["total"] == 4


def test_first_build_of_a_fork_is_relative_to_its_parent(history):
    body = changes(history, "fork", sort="aoid")

    assert body["base"]["slug"] == "two" and body["base"]["family"] == "ao"
    assert [(r["aoid"], r["kind"]) for r in body["items"]] == [
        (HAMMER, "changed"),
        (DRILL, "removed"),
        (CHISEL, "added"),
    ]


@pytest.mark.parametrize(
    "params, expected",
    [
        ({"kind": ["added", "removed"]}, [SAW, DRILL]),
        ({"kind": "changed"}, [WRENCH, HAMMER, PLIERS]),
        ({"part": "effects"}, [HAMMER]),
        ({"part": ["text", "stats"]}, [WRENCH, PLIERS]),
        ({"relevance": "economy"}, [PLIERS]),
        ({"relevance": ["text", "economy"]}, [WRENCH, PLIERS]),
        ({"relevance": "gameplay"}, [HAMMER, SAW, DRILL]),
        ({"min_ql": 30}, [HAMMER, SAW, DRILL]),
        ({"max_ql": 20}, [WRENCH, PLIERS]),
        ({"min_ql": 20, "max_ql": 50}, [HAMMER, PLIERS, SAW]),
        ({"item_class": 2}, [WRENCH, HAMMER, PLIERS, SAW, DRILL]),
        ({"item_class": 1}, []),
        ({"is_nano": "true"}, []),
        ({"search": "span"}, [WRENCH]),
        ({"search": "wrench"}, [WRENCH]),
        ({"search": "a"}, [WRENCH, HAMMER, SAW]),
        ({"search": "100%"}, []),
    ],
)
def test_change_list_filters(history, params, expected):
    assert aoids(changes(history, "two", sort="aoid", **params)) == expected


def test_change_list_rejects_an_unknown_filter_value(history):
    with history.client("two") as client:
        assert client.get("/api/v1/changes?kind=renamed").status_code == 422
        assert client.get("/api/v1/changes?relevance=fun").status_code == 422
        assert client.get("/api/v1/changes?sort=rev_id").status_code == 422


def test_an_item_without_a_name_is_listed_after_every_name(store):
    store.add_build("one", 1, items=[item(3, name="Awl")])
    store.add_build(
        "two",
        2,
        items=[item(1, name=""), item(2, name=""), item(3, name="Bradawl"), item(4)],
    )

    for body in (changes(store, "two"), compare(store, "two", "one")):
        assert [(r["name"], r["aoid"]) for r in body["items"]] == [
            ("Bradawl", 3),
            ("Thing", 4),
            ("", 1),
            ("", 2),
        ]


def test_change_list_sorts_by_name_by_default_and_pages(history):
    by_name = changes(history, "two")
    by_ql = changes(history, "two", sort="ql")
    second = changes(history, "two", page=2, page_size=2)

    assert [r["name"] for r in by_name["items"]] == [
        "Drill",
        "Hammer",
        "Pliers",
        "Saw",
        "Spanner",
    ]
    assert [r["ql"] for r in by_ql["items"]] == [10, 20, 30, 50, 200]
    assert [r["name"] for r in second["items"]] == ["Pliers", "Saw"]
    assert (
        second["total"],
        second["pages"],
        second["has_next"],
        second["has_prev"],
    ) == (
        5,
        3,
        True,
        True,
    )


def test_change_list_page_past_the_end_is_empty_with_the_right_total(history):
    body = changes(history, "two", page=40)

    assert body["items"] == [] and body["total"] == 5


def test_change_list_gives_field_level_diffs_when_asked(history):
    found = rows(changes(history, "two", include_diff="true"))

    assert found[PLIERS]["diff"]["stats"] == [
        {
            "stat": STAT_VALUE,
            "change": "changed",
            "relevance": "economy",
            "old": 100,
            "new": 250,
            "housekeeping": False,
            "bits_set": None,
            "bits_cleared": None,
        }
    ]
    (event,) = found[HAMMER]["diff"]["effects"]
    assert (event["event"], event["change"]) == (14, "changed")
    assert event["changed"][0]["fields"] == [
        {"field": "spell_params.Amount", "old": 5, "new": 9}
    ]
    assert found[SAW]["diff"] is None and found[DRILL]["diff"] is None


def guarded(amount, criteria):
    """A modifier behind ``criteria`` requirements."""
    effect = modify(16, amount)
    effect["Criteria"] = [criterion(54, level, 2) for level in range(criteria)]
    return effect


@pytest.fixture
def heavy(store):
    """Build two changes four items: one a little, one in effects that count
    1,200 with their criteria, one in a description of 70,000 letters, and
    one that only renames an item with as many effects."""
    many = [guarded(5, 5) for _ in range(100)]
    store.add_build(
        "one",
        1,
        items=[
            item(1, SpellData=wear(modify(16, 5))),
            item(2, SpellData=wear(*many)),
            item(3),
            item(4, name="Engine", SpellData=wear(*many)),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(1, SpellData=wear(modify(16, 9))),
            item(2, SpellData=wear(*[guarded(9, 5) for _ in range(100)])),
            item(3, Description="x" * 70_000),
            item(4, name="Motor", SpellData=wear(*many)),
        ],
    )
    return store


def test_a_change_list_leaves_out_a_diff_too_large_for_a_row(heavy):
    body = rows(changes(heavy, "two", include_diff="true"))

    assert {aoid: row["diff_omitted"] for aoid, row in body.items()} == {
        1: False,
        2: True,  # too many effects to diff within a page
        3: True,  # too many bytes
        4: False,  # as many effects, but they did not change
    }
    assert body[2]["diff"] is None and body[3]["diff"] is None
    assert body[1]["diff"]["effects"] and body[4]["diff"]["text"]
    # the row itself is complete
    assert body[2]["parts"] == ["effects"] and body[2]["relevance"] == ["gameplay"]


def test_a_comparison_leaves_out_the_same_diffs(heavy):
    body = rows(compare(heavy, "two", "one", include_diff="true"))

    assert {aoid: row["diff_omitted"] for aoid, row in body.items()} == {
        1: False,
        2: True,
        3: True,
        4: False,
    }


def test_no_diff_is_omitted_that_was_not_asked_for(heavy):
    assert {row["diff_omitted"] for row in changes(heavy, "two")["items"]} == {False}


def test_added_and_removed_items_have_no_diff_to_omit(history):
    body = changes(history, "three", include_diff="true", notes="expand")

    kinds = {row["kind"] for row in body["items"]}
    assert "added" in kinds or "removed" in kinds
    assert {
        (row["diff"], row["diff_omitted"])
        for row in body["items"]
        if row["kind"] != "changed"
    } == {(None, False)}


def test_the_comparison_of_one_item_has_the_diff_a_list_leaves_out(heavy):
    effects = compare_item(heavy, "two", 2, "one")["diff"]["effects"]
    text = compare_item(heavy, "two", 3, "one")["diff"]["text"]
    timeline_entry = get(heavy, "two", "/items/2/timeline")["entries"][0]

    assert len(effects[0]["changed"]) == 100
    assert len(text[0]["new"]) == 70_000
    assert len(timeline_entry["diff"]["effects"][0]["changed"]) == 100


def test_a_diff_is_left_out_for_its_effects_above_1000_with_their_criteria(store):
    """Items 1 and 2 each change one effect among 83 that stay, which have
    five requirements each: 498 effects and criteria a revision. With the
    changed effect and its one requirement, the two revisions of item 1 count
    exactly 1,000; item 2 gains a second requirement, which makes 1,001. The
    diff itself is one changed effect either way."""

    def revision(aoid, amount, requirements):
        changed = modify(17, amount)
        changed["Criteria"] = [criterion(112, n, 2) for n in range(requirements)]
        same = [guarded(5, 5) for _ in range(83)]
        return item(aoid, SpellData=wear(*same, changed))

    store.add_build("one", 1, items=[revision(1, 5, 1), revision(2, 5, 1)])
    store.add_build("two", 2, items=[revision(1, 9, 1), revision(2, 9, 2)])

    for body in (
        rows(changes(store, "two", include_diff="true")),
        rows(compare(store, "two", "one", include_diff="true")),
    ):
        assert (body[1]["diff_omitted"], body[2]["diff_omitted"]) == (False, True)
        assert len(body[1]["diff"]["effects"][0]["changed"]) == 1
        assert body[2]["diff"] is None
    # asked for by itself, the diff is as small as the other
    (event,) = compare_item(store, "two", 2, "one")["diff"]["effects"]
    assert len(event["changed"]) == 1 and not event["added"] and not event["removed"]


def diff_bytes(diff):
    return len(json.dumps(diff, separators=(",", ":")))


def test_a_diff_is_left_out_above_65536_bytes_and_not_at_them(store):
    # what a description of n letters makes of a diff, measured on a first pair
    store.add_build("one", 1, items=[item(1), item(2), item(9)])
    store.add_build("two", 2, items=[item(1), item(2), item(9, Description="x" * 10)])
    probe = rows(changes(store, "two", include_diff="true"))[9]["diff"]
    letters = 64 * 1024 - (diff_bytes(probe) - 10)

    store.add_build(
        "three",
        3,
        items=[
            item(1, Description="x" * letters),
            item(2, Description="x" * (letters + 1)),
            item(9, Description="x" * 10),
        ],
    )

    body = rows(changes(store, "three", include_diff="true"))

    assert (body[1]["diff_omitted"], body[2]["diff_omitted"]) == (False, True)
    assert diff_bytes(body[1]["diff"]) == 65536
    assert body[2]["diff"] is None


def test_change_list_filters_nanos_professions_and_slots(store):
    doctor, trader = criterion(PROFESSION, 10, 0), criterion(PROFESSION, 7, 0)
    store.add_build("one", 1, items=[item(1, name="Old")])
    store.add_build(
        "two",
        2,
        items=[
            item(1, name="Old"),
            item(2, name="Doctor coat", ActionData=requires(USE, doctor)),
            item(3, name="Left arm", stats=[(STAT_SLOT, 1 << 5)]),
        ],
        nanos=[nano(10, use=[doctor]), nano(11, use=[trader])],
    )

    def found(**params):
        return aoids(changes(store, "two", sort="aoid", **params))

    assert found(is_nano="true") == [10, 11]
    assert found(is_nano="false") == [2, 3]
    assert found(profession=10) == [2, 10]
    assert found(profession=10, is_nano="true") == [10]
    assert found(slot=5) == [3]


def test_change_list_costs_the_same_queries_whatever_the_page(history):
    with history.client("two") as client:
        with history.counting_queries() as small:
            client.get("/api/v1/changes?page_size=2&include_diff=true")
        with history.counting_queries() as large:
            client.get("/api/v1/changes?page_size=200&include_diff=true")

    assert len(small) == len(large)


# ---------------------------------------------------------------------------
# Build notes
# ---------------------------------------------------------------------------

RENAME_NOTE = """
[[note]]
build = "two"
title = "Tools renamed"
body = "Every tool got a new name."
explains = [{ path = "name", old = "Old .*", new = "New .*" }]
alongside = [{ path = "stat:79" }]
"""


@pytest.fixture
def renamed(store):
    """Build two renames three tools; one of them also changes otherwise."""
    store.add_build(
        "one",
        1,
        items=[
            item(1, name="Old saw", stats=[(STAT_ICON, 1)]),
            item(2, name="Old drill"),
            item(3, name="Old file", stats=[(STAT_VALUE, 5)]),
            item(4, name="Anvil", stats=[(STAT_ICON, 1)]),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(1, name="New saw", stats=[(STAT_ICON, 2)]),
            item(2, name="New drill"),
            item(3, name="New file", stats=[(STAT_VALUE, 9)]),
            item(4, name="Anvil", stats=[(STAT_ICON, 2)]),
            item(5, name="New lathe"),
        ],
    )
    store.note_changes(RENAME_NOTE)
    return store


def test_a_note_tags_only_the_changes_it_explains_entirely(renamed):
    body = changes(renamed, "two", notes="expand", sort="aoid")
    (note,) = body["notes"]

    assert {r["aoid"]: r["note_id"] for r in body["items"]} == {
        1: note["note_id"],  # renamed, with the icon change the note allows
        2: note["note_id"],  # renamed
        3: None,  # renamed, but its value changed too
        4: None,  # only what may come alongside: not the event itself
        5: None,  # added
    }
    assert note["title"] == "Tools renamed"
    assert note["body"] == "Every tool got a new name."
    assert (note["count"], note["matching"]) == (2, 2)
    assert body["summary"]["noted"] == 2 and body["summary"]["total"] == 5


def test_noted_changes_are_collapsed_by_default(renamed):
    body = changes(renamed, "two", sort="aoid")

    assert aoids(body) == [3, 4, 5]
    assert body["total"] == 3
    assert body["notes"][0]["count"] == 2
    assert body["summary"]["total"] == 5


def test_a_note_expands_to_its_changes(renamed):
    collapsed = changes(renamed, "two")
    note_id = collapsed["notes"][0]["note_id"]

    body = changes(renamed, "two", note_id=note_id, sort="aoid")

    assert aoids(body) == [1, 2] and body["total"] == 2
    assert {r["note_id"] for r in body["items"]} == {note_id}


def test_note_counts_follow_the_filters(renamed):
    body = changes(renamed, "two", search="saw")

    assert body["items"] == []
    assert (body["notes"][0]["count"], body["notes"][0]["matching"]) == (2, 1)


def test_notes_are_listed_by_the_number_of_changes_they_explain(store):
    store.add_build(
        "one",
        1,
        items=[
            item(1, name="Old saw"),
            item(2, stats=[(STAT_ICON, 1)]),
            item(3, stats=[(STAT_ICON, 1)]),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(1, name="New saw"),
            item(2, stats=[(STAT_ICON, 2)]),
            item(3, stats=[(STAT_ICON, 2)]),
        ],
    )
    store.note_changes("""
[[note]]
build = "two"
title = "Tools renamed"
explains = [{ path = "name", old = "Old .*", new = "New .*" }]

[[note]]
build = "two"
title = "New icons"
explains = [{ path = "stat:79" }]
""")

    body = changes(store, "two")

    # the note that explains most comes first, not the first of the file
    assert [(note["title"], note["count"]) for note in body["notes"]] == [
        ("New icons", 2),
        ("Tools renamed", 1),
    ]
    assert body["notes"][0]["note_id"] > body["notes"][1]["note_id"]


def test_a_note_shows_in_the_item_timeline(renamed):
    newest = get(renamed, "two", "/items/1/timeline")["entries"][0]

    assert newest["note"]["title"] == "Tools renamed"
    assert newest["note"]["body"] == "Every tool got a new name."
    assert get(renamed, "two", "/items/3/timeline")["entries"][0]["note"] is None


def test_a_build_without_notes_lists_none(renamed):
    assert changes(renamed, "one")["notes"] == []


# ---------------------------------------------------------------------------
# Compare two builds
# ---------------------------------------------------------------------------


def compare(store, slug, base, **params):
    return get(store, slug, f"/compare/{base}", **params)


def test_compare_is_the_net_difference_and_skips_a_change_and_revert(history):
    body = compare(history, "three", "one", sort="aoid")

    assert body["build"]["slug"] == "three" and body["base"]["slug"] == "one"
    # the Hammer changed in two and changed back in three; the Saw left and
    # returned unchanged
    assert [(r["aoid"], r["kind"], r["parts"]) for r in body["items"]] == [
        (WRENCH, "changed", ["text", "stats", "actions"]),
        (PLIERS, "changed", ["stats"]),
        (DRILL, "added", []),
    ]
    assert body["summary"]["total"] == 3
    assert body["notes"] == []


def test_compare_classifies_the_net_change(history):
    found = rows(compare(history, "three", "one", include_diff="true"))

    assert found[WRENCH]["relevance"] == ["gameplay", "text"]
    assert found[WRENCH]["old_name"] == "Wrench"
    # value 100 -> 250 and a new icon, over two builds
    assert found[PLIERS]["relevance"] == ["economy", "cosmetic"]
    assert [c["stat"] for c in found[PLIERS]["diff"]["stats"]] == [
        STAT_VALUE,
        STAT_ICON,
    ]
    assert found[DRILL]["relevance"] == ["gameplay"]


def test_compare_of_adjacent_builds_is_the_change_list(history):
    listed = changes(history, "two", sort="aoid", include_diff="true")
    compared = compare(history, "two", "one", sort="aoid", include_diff="true")

    assert compared["items"] == listed["items"]
    assert compared["summary"] == listed["summary"]


FILTERS_AND_SORTS = [
    {},
    {"sort": "name"},
    {"sort": "ql"},
    {"page": 2, "page_size": 2},
    {"page": 9},
    {"kind": "changed"},
    {"kind": ["added", "removed"]},
    {"part": "effects"},
    {"part": ["text", "stats"]},
    {"relevance": "gameplay"},
    {"relevance": ["economy", "text"]},
    {"is_nano": "false"},
    {"is_nano": "true"},
    {"item_class": 2},
    {"item_class": 3},
    {"min_ql": 20},
    {"max_ql": 20},
    {"search": "spanner"},
    {"search": "WRENCH"},
    {"search": "100%_"},
    {"slot": 2},
    {"profession": 5},
    {"relevance": "gameplay", "search": "a", "sort": "ql"},
    {"notes": "expand"},
    {"note_id": 1},
]


@pytest.mark.parametrize("slug, base", [("two", "one"), ("three", "two")])
def test_compare_of_adjacent_builds_filters_and_sorts_as_the_change_list(
    history, slug, base
):
    with history.client(slug) as client:
        for params in FILTERS_AND_SORTS:
            params = {"sort": "aoid", **params}
            listed = client.get("/api/v1/changes", params=params).json()
            compared = client.get(f"/api/v1/compare/{base}", params=params).json()

            assert compared["items"] == listed["items"], params
            assert compared["total"] == listed["total"], params
            assert compared["pages"] == listed["pages"], params
            assert compared["summary"] == listed["summary"], params


@pytest.mark.parametrize(
    "slug, base",
    [
        ("three", "one"),
        ("one", "three"),
        ("four", "one"),
        ("fork", "four"),
        ("four", "fork"),
        ("fork", "one"),
    ],
)
def test_compare_classifies_each_item_as_the_comparison_of_that_item_does(
    history, slug, base
):
    body = compare(history, slug, base, sort="aoid")

    assert body["items"]
    for row in body["items"]:
        alone = compare_item(history, slug, row["aoid"], base)
        assert (row["kind"], row["parts"], row["relevance"]) == (
            alone["kind"],
            alone["parts"],
            alone["relevance"],
        )
    assert body["summary"]["by_kind"] == {
        kind: sum(row["kind"] == kind for row in body["items"])
        for kind in ("added", "removed", "changed")
    }
    for counted, field in (("by_part", "parts"), ("by_relevance", "relevance")):
        assert body["summary"][counted] == {
            name: sum(name in row[field] for row in body["items"])
            for name in body["summary"][counted]
        }


def test_a_comparison_is_worked_out_once_for_every_page_and_filter_of_a_pair(history):
    requests = [
        {},
        {"page": 2, "page_size": 1},
        {"relevance": "gameplay"},
        {"part": "stats", "sort": "ql"},
        {"kind": "added"},
    ]

    with history.client("three") as client, history.counting_queries() as statements:
        for params in requests:
            assert client.get("/api/v1/compare/one", params=params).status_code == 200
        reading_presence = [s for s in statements if "item_presence" in s]
        client.get("/api/v1/compare/two")

    assert len(reading_presence) == 1
    assert len([s for s in statements if "item_presence" in s]) == 2


def test_a_comparison_knows_a_build_imported_after_the_last_one(history):
    assert aoids(compare(history, "four", "three", sort="aoid")) == [HAMMER]

    history.add_build(
        "five",
        5,
        items=[
            item(WRENCH, name="Spanner", ql=10, stats=[(STAT_CAN, 9)]),
            item(900, name="Anvil", ql=300, stats=[(STAT_VALUE, 5)]),
        ],
    )
    body = compare(history, "five", "four", sort="aoid")

    assert [(r["aoid"], r["kind"], r["name"]) for r in body["items"]] == [
        (WRENCH, "changed", "Spanner"),
        (PLIERS, "removed", "Pliers"),
        (SAW, "removed", "Saw"),
        (DRILL, "removed", "Drill"),
        (900, "added", "Anvil"),
    ]
    assert rows(body)[WRENCH]["parts"] == ["actions"]
    assert aoids(compare(history, "five", "four", min_ql=300)) == [900]
    assert aoids(compare(history, "five", "four", search="anvil")) == [900]


def test_compare_runs_in_either_direction(history):
    body = compare(history, "one", "three", sort="aoid")

    assert [(r["aoid"], r["kind"]) for r in body["items"]] == [
        (WRENCH, "changed"),
        (PLIERS, "changed"),
        (DRILL, "removed"),
    ]
    assert rows(body)[WRENCH]["name"] == "Wrench"
    assert rows(body)[WRENCH]["old_name"] == "Spanner"


def test_compare_across_the_fork(history):
    body = compare(history, "fork", "four", sort="aoid")

    assert body["base"]["family"] == "ao" and body["build"]["family"] == "prk"
    assert [(r["aoid"], r["kind"]) for r in body["items"]] == [
        (WRENCH, "changed"),
        (HAMMER, "added"),
        (PLIERS, "changed"),
        (SAW, "removed"),
        (DRILL, "removed"),
        (CHISEL, "added"),
    ]


def test_compare_takes_the_filters_of_the_change_list(history):
    def found(**params):
        return aoids(compare(history, "three", "one", sort="aoid", **params))

    assert found(kind="added") == [DRILL]
    assert found(part="actions") == [WRENCH]
    assert found(relevance="economy") == [PLIERS]
    assert found(search="wrench") == [WRENCH]
    assert found(min_ql=100) == [DRILL]
    assert found(page=2, page_size=2) == [DRILL]


def test_compare_a_build_with_itself_is_empty(history):
    body = compare(history, "three", "three")

    assert body["items"] == [] and body["summary"]["total"] == 0


def test_compare_with_an_unknown_build_is_not_found(history):
    with history.client("three") as client:
        response = client.get("/api/v1/compare/nope")

    assert response.status_code == 404


@pytest.mark.parametrize(
    "parameter", ["transition", "transition_old", "transition_new"]
)
def test_compare_refuses_the_transition_filter_of_the_change_list(history, parameter):
    with history.client("three") as client:
        response = client.get(f"/api/v1/compare/one?{parameter}=stat:74")
        unfiltered = client.get("/api/v1/compare/one")

    assert response.status_code == 422
    assert parameter in response.json()["error"]
    assert "/changes only" in response.json()["error"]
    assert unfiltered.status_code == 200


def test_compare_accepts_a_family_alias_as_base(history):
    # "ao" is the newest build of the branch: four
    body = compare(history, "one", "ao")

    assert body["base"]["slug"] == "four"


# ---------------------------------------------------------------------------
# Compare one item
# ---------------------------------------------------------------------------


def compare_item(store, slug, aoid, base):
    return get(store, slug, f"/items/{aoid}/compare/{base}")


def test_item_compare_diffs_the_item_between_two_builds(history):
    body = compare_item(history, "four", WRENCH, "one")

    assert (body["aoid"], body["kind"]) == (WRENCH, "changed")
    assert body["base"]["slug"] == "one" and body["build"]["slug"] == "four"
    assert body["old"]["name"] == "Wrench" and body["new"]["name"] == "Spanner"
    assert body["parts"] == ["text", "stats", "actions"]
    assert body["relevance"] == ["gameplay", "text"]
    assert body["diff"]["text"] == [
        {"field": "name", "old": "Wrench", "new": "Spanner", "relevance": "text"}
    ]
    assert [c["stat"] for c in body["diff"]["stats"]] == [STAT_CAN]


def test_item_compare_of_an_item_changed_and_reverted_is_unchanged(history):
    body = compare_item(history, "three", HAMMER, "one")

    assert body["kind"] == "unchanged"
    assert body["parts"] == [] and body["relevance"] == []
    assert all(changes == [] for changes in body["diff"].values())
    assert body["old"] == body["new"]


def test_item_compare_of_an_item_only_one_build_has(history):
    added = compare_item(history, "four", DRILL, "one")
    removed = compare_item(history, "four", HAMMER, "one")

    assert (added["kind"], added["old"], added["diff"]) == ("added", None, None)
    assert added["new"]["name"] == "Drill" and added["new"]["ql"] == 200
    assert (removed["kind"], removed["new"], removed["diff"]) == ("removed", None, None)
    assert removed["old"]["name"] == "Hammer"
    assert added["relevance"] == removed["relevance"] == ["gameplay"]


def test_item_compare_of_an_item_whose_event_was_only_renumbered_is_cosmetic(store):
    store.add_build("one", 1, items=[item(1, SpellData=wear(modify(16, 5)))])
    store.add_build("two", 2, items=[item(1, SpellData=wear(modify(16, 5), event=0))])

    body = compare_item(store, "two", 1, "one")

    assert (body["kind"], body["parts"]) == ("changed", ["effects"])
    assert body["relevance"] == ["cosmetic"]
    assert rows(changes(store, "two"))[1]["relevance"] == ["cosmetic"]


def test_item_compare_across_the_fork(history):
    body = compare_item(history, "fork", HAMMER, "three")

    assert body["kind"] == "changed"
    (pair,) = body["diff"]["effects"][0]["changed"]
    assert pair["fields"] == [{"field": "spell_params.Amount", "old": 5, "new": 12}]


def test_item_compare_of_an_item_neither_build_has_is_not_found(history):
    with history.client("four") as client:
        assert client.get(f"/api/v1/items/{CHISEL}/compare/one").status_code == 404
        assert client.get(f"/api/v1/items/{WRENCH}/compare/nope").status_code == 404


# ---------------------------------------------------------------------------
# Shared transitions
# ---------------------------------------------------------------------------


@pytest.fixture
def procs(store):
    """Three procs go from a 60% to a 100% chance; one of them also gains a
    stat, as does one other item."""

    def proc(aoid, chance, **extra):
        effect = {
            "SpellID": 53089,
            "Target": 3,
            "TickCount": 1,
            "TickInterval": 0,
            "NanoID": 900 + aoid,
            "Chance": chance,
            "Criteria": [],
            "SpellFormat": "{Chance} chance to cast {NanoID}",
            "SpellDescription": f"{chance} chance",
        }
        return item(aoid, name=f"Proc {aoid}", SpellData=wear(effect), **extra)

    store.add_build(
        "one", 1, items=[proc(1, 60), proc(2, 60), proc(3, 60), item(4), item(5)]
    )
    store.add_build(
        "two",
        2,
        items=[
            proc(1, 100),
            proc(2, 100),
            proc(3, 100, stats=[(287, 20)]),
            item(4, stats=[(287, 20)]),
            item(5, name="Unique change"),
        ],
    )
    return store


def test_transitions_count_what_changed_items_share(procs):
    body = get(procs, "two", "/changes/transitions")

    assert body["build"]["slug"] == "two" and body["base"]["slug"] == "one"
    assert body["transitions"] == [
        {
            "part": "effects",
            "path": "effect:53089:spell_params.Chance",
            "old": 60,
            "new": 100,
            "relevance": "gameplay",
            "items": 3,
            "occurrences": 3,
            "stat": None,
            "bit": None,
            "spell_id": 53089,
            "action": None,
            "field": "spell_params.Chance",
        },
        {
            "part": "stats",
            "path": "stat:287",
            "old": None,
            "new": 20,
            "relevance": "gameplay",
            "items": 2,
            "occurrences": 2,
            "stat": 287,
            "bit": None,
            "spell_id": None,
            "action": None,
            "field": None,
        },
    ]


def test_transitions_filter_by_part_and_size(procs):
    def paths(**params):
        body = get(procs, "two", "/changes/transitions", **params)
        return [entry["path"] for entry in body["transitions"]]

    assert paths(part="stats") == ["stat:287"]
    assert paths(min_items=3) == ["effect:53089:spell_params.Chance"]
    assert paths(limit=1) == ["effect:53089:spell_params.Chance"]


def test_a_flag_line_names_its_stat_and_bit(store):
    store.add_build(
        "one", 1, items=[item(1, stats=[(STAT_CAN, 1)]), item(2, stats=[(STAT_CAN, 1)])]
    )
    store.add_build(
        "two", 2, items=[item(1, stats=[(STAT_CAN, 9)]), item(2, stats=[(STAT_CAN, 9)])]
    )

    (line,) = get(store, "two", "/changes/transitions")["transitions"]

    assert (line["path"], line["old"], line["new"]) == ("stat:30:bit:8", 0, 1)
    assert (line["stat"], line["bit"], line["items"]) == (STAT_CAN, 8, 2)


@pytest.fixture
def housekept(store):
    """Build two gives items 1 and 2 a Use event, writes Value 0 out on
    items 3 and 4, and takes items 5 and 6 from Value 0 to Value 3."""
    worn, used = wear(modify(16, 5)), wear(modify(17, 5), event=5)
    store.add_build(
        "one",
        1,
        items=[
            item(1, SpellData=worn),
            item(2, SpellData=worn),
            item(3),
            item(4),
            item(5, stats=[(STAT_VALUE, 0)]),
            item(6, stats=[(STAT_VALUE, 0)]),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(1, SpellData=worn + used),
            item(2, SpellData=worn + used),
            item(3, stats=[(STAT_VALUE, 0)]),
            item(4, stats=[(STAT_VALUE, 0)]),
            item(5, stats=[(STAT_VALUE, 3)]),
            item(6, stats=[(STAT_VALUE, 3)]),
        ],
    )
    return store


def test_an_added_event_is_a_gameplay_line_and_a_housekeeping_value_a_cosmetic_one(
    housekept,
):
    def found(**params):
        body = get(housekept, "two", "/changes/transitions", **params)
        return {
            (line["path"], line["old"], line["new"]): line["relevance"]
            for line in body["transitions"]
        }

    assert found() == {
        ("event:5", None, "added"): "gameplay",
        ("effect:53045", None, 17): "gameplay",
        ("stat:74", 0, 3): "economy",
    }
    assert found(relevance="cosmetic") == {("stat:74", None, 0): "cosmetic"}


@pytest.mark.parametrize("relevance", ["gameplay", "economy", "cosmetic", "text"])
def test_a_line_leads_to_its_items_under_the_relevance_filter_that_lists_it(
    housekept, relevance
):
    body = get(housekept, "two", "/changes/transitions", relevance=relevance)
    assert (
        len(body["transitions"])
        == {
            "gameplay": 2,
            "economy": 1,
            "cosmetic": 1,
            "text": 0,
        }[relevance]
    )

    for line in body["transitions"]:
        listed = changes(
            housekept,
            "two",
            relevance=relevance,
            transition=line["path"],
            transition_old=json.dumps(line["old"]),
            transition_new=json.dumps(line["new"]),
        )
        assert listed["total"] == line["items"] == 2, line


def test_a_housekeeping_value_is_a_cosmetic_entry_of_a_diff(housekept):
    found = rows(changes(housekept, "two", include_diff="true"))
    compared = rows(compare(housekept, "two", "one", include_diff="true"))

    assert found[3]["relevance"] == compared[3]["relevance"] == ["cosmetic"]
    assert found[3]["diff"]["stats"] == [
        {
            "stat": STAT_VALUE,
            "change": "added",
            "relevance": "cosmetic",
            "old": None,
            "new": 0,
            "housekeeping": True,
            "bits_set": None,
            "bits_cleared": None,
        }
    ]
    # the value that says nothing went, and one that says something came
    assert found[5]["relevance"] == compared[5]["relevance"] == ["economy", "cosmetic"]
    (entry,) = found[5]["diff"]["stats"]
    assert (entry["relevance"], entry["housekeeping"]) == ("economy", True)
    assert compare_item(housekept, "two", 5, "one")["relevance"] == [
        "economy",
        "cosmetic",
    ]


def test_a_build_with_no_shared_transition_lists_none(procs):
    assert get(procs, "one", "/changes/transitions")["transitions"] == []


@pytest.fixture
def patch(store):
    """Build two renames five tools, which a note explains; two of them also
    change in value, and two other items only take a new icon."""
    old = [item(n, name=f"Old tool {n}") for n in (1, 2, 3)]
    new = [item(n, name=f"New tool {n}") for n in (1, 2, 3)]
    for n in (4, 5):
        old.append(item(n, name=f"Old tool {n}", stats=[(STAT_VALUE, 5)]))
        new.append(item(n, name=f"New tool {n}", stats=[(STAT_VALUE, 9)]))
    for n in (6, 7):
        old.append(item(n, name=f"Crate {n}", stats=[(STAT_ICON, 1)]))
        new.append(item(n, name=f"Crate {n}", stats=[(STAT_ICON, 2)]))
    store.add_build("one", 1, items=old)
    store.add_build("two", 2, items=new)
    store.note_changes("""
[[note]]
build = "two"
title = "Tools renamed"
explains = [{ path = "name", old = "Old .*", new = "New .*" }]
""")
    return store


def lines(store, slug, **params):
    """``{path: (relevance, items, occurrences)}`` of a build's patch notes."""
    body = get(store, slug, "/changes/transitions", **params)
    return {
        line["path"]: (line["relevance"], line["items"], line["occurrences"])
        for line in body["transitions"]
    }


def test_patch_notes_leave_out_cosmetic_lines_and_what_a_note_explains(patch):
    # the note accounts for the rename, also on the two tools it does not
    # explain because their value changed; the icon line is cosmetic
    assert lines(patch, "two") == {f"stat:{STAT_VALUE}": ("economy", 2, 2)}


def test_patch_notes_count_every_change_when_notes_are_expanded(patch):
    assert lines(patch, "two", notes="expand") == {
        "name": ("text", 5, 5),
        f"stat:{STAT_VALUE}": ("economy", 2, 2),
    }


def test_patch_notes_filter_by_the_relevance_of_the_field(patch):
    every = ["gameplay", "economy", "cosmetic", "text"]

    assert lines(patch, "two", relevance="cosmetic") == {
        f"stat:{STAT_ICON}": ("cosmetic", 2, 2)
    }
    assert list(lines(patch, "two", relevance="economy")) == [f"stat:{STAT_VALUE}"]
    assert lines(patch, "two", relevance="gameplay") == {}
    assert lines(patch, "two", relevance="text", notes="expand") == {
        "name": ("text", 5, 5)
    }
    assert len(lines(patch, "two", relevance=every, notes="expand")) == 3


def test_a_patch_note_line_counts_every_unexplained_change_that_has_it(store):
    """Three tools are renamed and take a new icon, which the note lets a
    rename come with, and one of them changes in value too; two crates only
    take the icon."""
    old = [item(n, name=f"Old tool {n}", stats=[(STAT_ICON, 1)]) for n in (1, 2)]
    new = [item(n, name=f"New tool {n}", stats=[(STAT_ICON, 2)]) for n in (1, 2)]
    old.append(item(3, name="Old tool 3", stats=[(STAT_ICON, 1), (STAT_VALUE, 5)]))
    new.append(item(3, name="New tool 3", stats=[(STAT_ICON, 2), (STAT_VALUE, 9)]))
    for n in (6, 7):
        old.append(item(n, name=f"Crate {n}", stats=[(STAT_ICON, 1)]))
        new.append(item(n, name=f"Crate {n}", stats=[(STAT_ICON, 2)]))
    store.add_build("one", 1, items=old)
    store.add_build("two", 2, items=new)
    store.note_changes("""
[[note]]
build = "two"
title = "Tools renamed"
explains = [{ path = "name", old = "Old .*", new = "New .*" }]
alongside = [{ path = "stat:79" }]
""")

    found = lines(store, "two", relevance="cosmetic")
    listed = changes(store, "two", sort="aoid", transition=f"stat:{STAT_ICON}")

    # two crates share the icon change outside the rename, so it is a line;
    # it counts tool 3 as well, which the list shows for it
    assert found == {f"stat:{STAT_ICON}": ("cosmetic", 3, 3)}
    assert aoids(listed) == [3, 6, 7]


def test_a_patch_note_line_too_few_unexplained_changes_share_is_left_out(patch):
    # a third build renames two tools and nothing else: the note explains both
    patch.add_build(
        "three",
        3,
        items=[item(1, name="Old tool 1"), item(2, name="Old tool 2")],
    )
    patch.add_build(
        "four",
        4,
        items=[item(1, name="New tool 1"), item(2, name="New tool 2")],
    )
    patch.note_changes("""
[[note]]
build = "four"
title = "Tools renamed"
explains = [{ path = "name", old = "Old .*", new = "New .*" }]
""")

    assert lines(patch, "four") == {}
    assert lines(patch, "four", notes="expand") == {"name": ("text", 2, 2)}
    assert lines(patch, "four", notes="expand", min_items=3) == {}


@pytest.mark.parametrize("notes", ["collapse", "expand"])
def test_a_patch_note_line_counts_the_changes_the_list_shows_for_it(patch, notes):
    every = ["gameplay", "economy", "cosmetic", "text"]
    body = get(patch, "two", "/changes/transitions", notes=notes, relevance=every)
    assert len(body["transitions"]) == {"collapse": 2, "expand": 3}[notes]

    for line in body["transitions"]:
        listed = changes(
            patch,
            "two",
            notes=notes,
            transition=line["path"],
            transition_old=json.dumps(line["old"]),
            transition_new=json.dumps(line["new"]),
        )
        assert listed["total"] == line["items"], line


def test_patch_notes_reject_an_unknown_relevance_or_notes_value(patch):
    with patch.client("two") as client:
        relevance = client.get("/api/v1/changes/transitions?relevance=shiny")
        notes = client.get("/api/v1/changes/transitions?notes=hide")

    assert relevance.status_code == 422 and notes.status_code == 422


# ---------------------------------------------------------------------------
# The rules a store was analysed with
# ---------------------------------------------------------------------------

OTHER_NOTES = """
[[note]]
build = "two"
title = "Range written out"
explains = [{ path = "stat:287", old = "absent" }]
"""


def other_rules(notes=None, relevance=None):
    """The repository's rules with one of the two files edited."""
    rules = default_rules()
    if notes is not None:
        rules = replace(rules, notes=parse_notes(notes))
    if relevance is not None:
        edited = relevance(RELEVANCE_FILE.read_text(encoding="utf-8"))
        rules = replace(rules, relevance=parse_relevance(edited))
    return rules


def event_is_gameplay(text):
    return text.replace('event = "cosmetic"', 'event = "gameplay"')


def test_a_store_analysed_with_the_rules_of_the_process_is_not_stale(procs, caplog):
    procs.sync_changes()

    with caplog.at_level(logging.WARNING):
        assert warn_of_stale_rules(procs.db) is False
    assert stale_rules(procs.db) == []
    assert caplog.records == []


def test_a_store_analysed_with_other_notes_than_the_process_read_is_stale(procs):
    procs.sync_changes()

    (stale,) = stale_rules(procs.db, other_rules(notes=OTHER_NOTES))

    assert "build_notes.toml" in stale


def test_a_store_analysed_with_another_relevance_file_is_stale_twice(procs):
    procs.sync_changes()

    relevance, analysis = stale_rules(
        procs.db, other_rules(relevance=event_is_gameplay)
    )

    assert "change_relevance.toml" in relevance and "change log" in relevance
    assert "transitions" in analysis


def test_a_store_no_import_run_analysed_is_stale(procs):
    assert len(stale_rules(procs.db)) == 2


def test_a_stale_store_is_served_with_a_warning_at_start_up(procs, caplog, monkeypatch):
    procs.sync_changes(other_rules(notes=OTHER_NOTES))
    monkeypatch.setattr(comparison, "StoreSession", lambda: procs.db)

    with caplog.at_level(logging.WARNING):
        comparison.preload()

    (record,) = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert "build_notes.toml" in record.getMessage()
    assert "import_cli.py import-cas" in record.getMessage()
    assert procs.schema in record.getMessage()
    # the store is served all the same
    assert get(procs, "two", "/changes", notes="expand")["total"] == 5


def test_start_up_says_nothing_about_a_store_that_is_current(
    procs, caplog, monkeypatch
):
    procs.sync_changes()
    monkeypatch.setattr(comparison, "StoreSession", lambda: procs.db)

    with caplog.at_level(logging.WARNING):
        comparison.preload()

    assert [r for r in caplog.records if r.levelno >= logging.WARNING] == []


def test_the_facts_of_a_store_are_read_a_chunk_of_revisions_a_row(history, monkeypatch):
    """One row a revision is 264,000 rows of fifteen values for the real
    store, which took a server through 1.7 GB when it started."""
    read = []
    unpacked = comparison._unpacked

    def recording(packed, typecode="i"):
        values = unpacked(packed, typecode)
        read.append(len(values))
        return values

    monkeypatch.setattr(comparison, "_FACTS_CHUNK", 4)
    monkeypatch.setattr(comparison, "_unpacked", recording)

    columns = comparison._revisions_after(history.db, 0)

    revisions = len(columns[0])
    rows = len(read) // len(columns)
    assert revisions >= 8 and sorted(columns[0]) == sorted(set(columns[0]))
    assert max(read) == 4
    assert rows <= revisions // 4 + 1


# ---------------------------------------------------------------------------
# Relevance of each entry of a diff
# ---------------------------------------------------------------------------


def entry_relevance(diff):
    """The classes the entries of an ``ItemDiff`` carry, in declared order."""
    found = set()
    for part, entries in diff.items():
        for entry in entries:
            found.add(entry["relevance"])
            if part == "effects":
                for effects in (entry["added"], entry["removed"], entry["changed"]):
                    found.update(effect["relevance"] for effect in effects)
    return [n for n in ("gameplay", "economy", "cosmetic", "text") if n in found]


def float_text(text):
    return {
        "SpellID": 53057,
        "Target": 2,
        "TickCount": 1,
        "TickInterval": 0,
        "Text": text,
        "Criteria": [],
        "SpellFormat": "Float text: {Text}",
        "SpellDescription": f"Float text: {text}",
    }


def test_every_entry_of_a_diff_says_what_it_is_relevant_to(history):
    wrench = compare_item(history, "four", WRENCH, "one")["diff"]
    pliers = compare_item(history, "four", PLIERS, "one")["diff"]
    hammer = compare_item(history, "fork", HAMMER, "one")["diff"]

    assert [c["relevance"] for c in wrench["text"]] == ["text"]
    assert [c["relevance"] for c in wrench["stats"]] == ["gameplay"]
    assert [c["relevance"] for c in wrench["actions"]] == ["gameplay"]
    assert {c["stat"]: c["relevance"] for c in pliers["stats"]} == {
        STAT_VALUE: "economy",
        STAT_ICON: "cosmetic",
    }
    (event,) = hammer["effects"]
    (pair,) = event["changed"]
    assert pair["relevance"] == "gameplay" and event["relevance"] is None
    assert pair["old"]["relevance"] is None and pair["new"]["relevance"] is None


def test_the_relevance_of_a_change_is_the_union_of_its_entries(history):
    lists = [
        changes(history, slug, include_diff="true", notes="expand")
        for slug in ("two", "three", "four", "fork")
    ]
    lists.append(compare(history, "three", "one", include_diff="true"))
    lists.append(compare(history, "fork", "four", include_diff="true"))
    checked = 0
    for body in lists:
        for row in body["items"]:
            if row["kind"] == "changed":
                assert entry_relevance(row["diff"]) == row["relevance"], row
                checked += 1
    assert checked >= 10


def test_effects_that_only_move_between_events_are_cosmetic_entries(store):
    """Item 1 only has its event renumbered; item 2 is renumbered and gets a
    stronger effect; item 3 changes its float text and nothing else; item 4
    moves one effect to another event and keeps the other."""
    store.add_build(
        "one",
        1,
        items=[
            item(1, SpellData=wear(modify(16, 5))),
            item(2, SpellData=wear(modify(16, 5), modify(17, 5))),
            item(3, SpellData=wear(modify(16, 5), float_text("Ow"))),
            item(4, SpellData=wear(modify(16, 5), modify(17, 5))),
        ],
    )
    store.add_build(
        "two",
        2,
        items=[
            item(1, SpellData=wear(modify(16, 5), event=0)),
            item(2, SpellData=wear(modify(16, 5), modify(17, 9), event=0)),
            item(3, SpellData=wear(modify(16, 5), float_text("Ouch"))),
            item(
                4,
                SpellData=wear(modify(16, 5)) + wear(modify(17, 5), event=2),
            ),
        ],
    )

    found = rows(changes(store, "two", include_diff="true"))

    (renumbered,) = found[1]["diff"]["effects"]
    assert (renumbered["change"], renumbered["relevance"]) == ("renumbered", "cosmetic")
    assert found[1]["relevance"] == ["cosmetic"]

    assert found[2]["relevance"] == ["gameplay"]
    added, removed = found[2]["diff"]["effects"]
    assert removed["relevance"] is None and added["relevance"] is None
    assert {e["spell_params"]["Stat"]: e["relevance"] for e in added["added"]} == {
        16: None,  # the same effect, moved
        17: "gameplay",
    }

    assert found[3]["relevance"] == ["cosmetic"]
    assert found[3]["diff"]["effects"][0]["changed"][0]["relevance"] == "cosmetic"

    assert found[4]["relevance"] == ["cosmetic"]
    for row in found.values():
        assert entry_relevance(row["diff"]) == row["relevance"]


# ---------------------------------------------------------------------------
# A transition as a filter
# ---------------------------------------------------------------------------


def test_a_transition_line_leads_to_exactly_its_items(procs):
    lines = get(procs, "two", "/changes/transitions")["transitions"]
    assert lines

    for line in lines:
        body = changes(
            procs,
            "two",
            sort="aoid",
            notes="expand",
            transition=line["path"],
            transition_old=json.dumps(line["old"]),
            transition_new=json.dumps(line["new"]),
        )
        assert body["total"] == line["items"], line

    chance = changes(
        procs,
        "two",
        sort="aoid",
        transition="effect:53089:spell_params.Chance",
        transition_old="60",
        transition_new="100",
    )
    assert aoids(chance) == [1, 2, 3]


def test_a_transition_filter_without_values_takes_every_line_of_the_path(procs):
    def found(**params):
        return aoids(changes(procs, "two", sort="aoid", **params))

    assert found(transition="stat:287") == [3, 4]
    assert found(transition="stat:287", transition_old="null") == [3, 4]
    assert found(transition="stat:287", transition_new="15") == []
    assert found(transition="no:such:path") == []
    assert found(transition="name") == []  # one item only: not a shared line


def test_a_transition_filter_combines_with_the_other_filters_and_notes(procs):
    procs.note_changes("""
[[note]]
build = "two"
title = "Range written out"
explains = [{ path = "stat:287", old = "absent" }]
""")

    collapsed = changes(procs, "two", sort="aoid", transition="stat:287")
    expanded = changes(procs, "two", sort="aoid", transition="stat:287", notes="expand")
    with_effects = changes(
        procs, "two", sort="aoid", transition="stat:287", part="effects"
    )

    # item 4 only gained the stat: the note explains it; item 3 also changed
    assert aoids(collapsed) == [3]
    assert collapsed["notes"][0]["matching"] == 1
    assert aoids(expanded) == [3, 4]
    assert aoids(with_effects) == [3]


@pytest.fixture
def ranges(store):
    """Build two sets the range of four weapons to 20: two had 15, two had
    none. Build three does to two other weapons what build two did, and
    renames two that build two changed."""
    store.add_build(
        "one",
        1,
        items=[
            item(1, stats=[(287, 15)]),
            item(2, stats=[(287, 15)]),
            item(3),
            item(4),
            item(5, stats=[(287, 15)]),
            item(6, stats=[(287, 15)]),
        ],
    )
    raised = [item(n, stats=[(287, 20)]) for n in (1, 2, 3, 4)]
    store.add_build(
        "two",
        2,
        items=raised + [item(5, stats=[(287, 15)]), item(6, stats=[(287, 15)])],
    )
    store.add_build(
        "three",
        3,
        items=[
            item(1, name="Longer rifle", stats=[(287, 20)]),
            item(2, name="Longer pistol", stats=[(287, 20)]),
            *raised[2:],
            item(5, stats=[(287, 20)]),
            item(6, stats=[(287, 20)]),
        ],
    )
    return store


def test_a_transition_filter_tells_lines_of_one_path_apart_by_their_old_value(ranges):
    def found(**params):
        return aoids(
            changes(ranges, "two", sort="aoid", transition="stat:287", **params)
        )

    assert found(transition_new="20") == [1, 2, 3, 4]
    assert found(transition_old="15", transition_new="20") == [1, 2]
    assert found(transition_old="null", transition_new="20") == [3, 4]
    assert found(transition_old="15") == [1, 2]


def test_a_transition_filter_reads_the_lines_of_its_own_build_only(ranges):
    def found(slug):
        body = changes(
            ranges,
            slug,
            sort="aoid",
            transition="stat:287",
            transition_old="15",
            transition_new="20",
        )
        return aoids(body), body["total"]

    assert found("two") == ([1, 2], 2)
    # items 1 and 2 changed in build three as well, but not in range
    assert found("three") == ([5, 6], 2)


def test_a_transition_filter_reads_the_lines_of_its_own_branch_only(ranges):
    # a fork whose first build has the ordinal of build three and raises the
    # range of items 1 and 2, which build three changes too, but in name
    ranges.add_build(
        "fork",
        3,
        branch="prk",
        parent_slug="one",
        items=[
            item(1, stats=[(287, 20)]),
            item(2, stats=[(287, 20)]),
            item(3),
            item(4),
            item(5, stats=[(287, 15)]),
            item(6, stats=[(287, 15)]),
        ],
    )

    def found(slug):
        body = changes(
            ranges,
            slug,
            sort="aoid",
            transition="stat:287",
            transition_old="15",
            transition_new="20",
        )
        return aoids(body), body["total"]

    assert found("fork") == ([1, 2], 2)
    assert found("three") == ([5, 6], 2)


def test_a_transition_value_must_be_json_and_needs_a_path(procs):
    with procs.client("two") as client:
        bad = client.get("/api/v1/changes?transition=stat:287&transition_old=abc")
        alone = client.get("/api/v1/changes?transition_new=20")

    assert bad.status_code == 422 and alone.status_code == 422


def test_later_pages_of_a_comparison_are_classified_like_the_first(history):
    """The first request for a pair of builds classifies the whole comparison
    and keeps its summary; later ones classify only their page."""
    for base, slug in (("one", "three"), ("four", "fork"), ("three", "one")):
        fresh = compare(history, slug, base, sort="aoid", include_diff="true")
        with history.client(slug) as client:
            client.get(f"/api/v1/compare/{base}")
            later = client.get(
                f"/api/v1/compare/{base}?sort=aoid&include_diff=true"
            ).json()
            filtered = client.get(
                f"/api/v1/compare/{base}?sort=aoid&kind=changed&part=stats"
            ).json()

        assert later == fresh
        assert filtered["summary"] == fresh["summary"]
        assert aoids(filtered) == [
            row["aoid"] for row in fresh["items"] if "stats" in row["parts"]
        ]


# ---------------------------------------------------------------------------
# Comparisons of the real game data
# ---------------------------------------------------------------------------


def test_the_comparison_with_the_build_before_is_the_real_change_log(store_db, build):
    before = load_build_index(store_db).base_of(build.branch, build.ordinal)
    if before is None:
        pytest.skip("the default build has no build before it")
    everything = ChangeFilters(expand_notes=True)

    for sort in ("name", "ql", "aoid"):
        logged = fetch_changes(
            store_db, logged_changes(build), everything, sort, 1, 200
        )
        compared = compare_page(
            store_db, find_build(store_db, before.slug), build, everything, sort, 1, 200
        )
        assert compared.rows == [replace(row, note_id=None) for row in logged.rows]
        assert compared.total == logged.total
        assert compared.summary == {**logged.summary, "noted": 0}


def test_a_comparison_of_builds_far_apart_classifies_as_one_item_at_a_time(
    store_db, build
):
    oldest = min(
        (other for other in read_builds(store_db) if other.branch == build.branch),
        key=lambda other: other.ordinal,
    )
    if oldest == build:
        pytest.skip("the default build is the only one of its branch")
    changed = ChangeFilters(kinds=["changed"])
    total = compare_page(store_db, oldest, build, changed, "aoid", 1, 1).total
    sample = [
        row
        for page in (1, total // 40, total // 20)
        for row in compare_page(
            store_db, oldest, build, changed, "aoid", max(page, 1), 20
        ).rows
    ]

    assert sample
    for row in sample:
        assert row == item_comparison(store_db, oldest, build, row.aoid)
