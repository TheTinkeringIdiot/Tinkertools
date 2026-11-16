"""
Tests for what the importer derives about the change log
(app/core/change_analysis.py): the relevance of every change, the build notes
and the changes they explain, and the field transitions a build's changed
items share.

Each test imports a few hand-made builds into a throwaway schema, as
``test_cas_store`` does, and reads the change log back.
"""

import os

import pytest

from app.core import cas_store, change_analysis
from app.core.change_rules import (
    RELEVANCE_FILE,
    ChangeRules,
    parse_notes,
    parse_relevance,
)
from app.tests.test_cas_store import (  # noqa: F401 - conn is a fixture
    conn,
    criterion,
    item,
    load,
    modify,
    spec,
    verify_cas,
)

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

GAMEPLAY, ECONOMY, COSMETIC, TEXT = 1, 2, 4, 8
NO_NOTES = parse_notes("")


def relevance_rules(edit=lambda text: text):
    """The repository's relevance rules, optionally with an edit to the file."""
    return parse_relevance(edit(RELEVANCE_FILE.read_text(encoding="utf-8")))


def rules(notes="", edit=lambda text: text):
    return ChangeRules(relevance=relevance_rules(edit), notes=parse_notes(notes))


def relevance(conn, ordinal, branch="ao"):
    """``{aoid: relevance}`` of one build's changes."""
    return dict(
        conn.execute(
            "SELECT aoid, relevance FROM item_change WHERE branch = %s AND ordinal = %s",
            (branch, ordinal),
        ).fetchall()
    )


def noted(conn, ordinal):
    """``{aoid: note title}`` of the changes of a build that have a note."""
    return dict(
        conn.execute(
            "SELECT c.aoid, n.title FROM item_change c "
            "JOIN build_note n ON n.note_id = c.note_id WHERE c.ordinal = %s",
            (ordinal,),
        ).fetchall()
    )


def shared(conn, ordinal):
    """``{(part, path, old, new): (items, occurrences)}`` of one build."""
    return {
        (part, path, old, new): (items, occurrences)
        for part, path, old, new, items, occurrences in conn.execute(
            "SELECT part, path, old, new, items, occurrences FROM build_transition "
            "WHERE ordinal = %s",
            (ordinal,),
        )
    }


def wear(*effects, event=14):
    return [{"Event": event, "Items": list(effects)}]


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


# ---------------------------------------------------------------------------
# Relevance
# ---------------------------------------------------------------------------


def two_builds(conn, old, new):
    """Item 1 as ``old`` in build 1 and as ``new`` in build 2; returns the
    relevance of its change."""
    load(conn, spec("one", 1), items=[item(1, **old)])
    load(conn, spec("two", 2), items=[item(1, **new)])
    return relevance(conn, 2)[1]


@pytest.mark.parametrize(
    "old, new, expected",
    [
        ({"name": "Wrench"}, {"name": "Spanner"}, TEXT),
        ({"stats": [(30, 1)]}, {"stats": [(30, 3)]}, GAMEPLAY),
        ({"stats": [(74, 10)]}, {"stats": [(74, 20)]}, ECONOMY),
        ({"stats": [(79, 10)]}, {"stats": [(79, 20)]}, COSMETIC),
        ({"stats": [(23, 10)]}, {"stats": [(23, 20)]}, COSMETIC),
        ({}, {"stats": [(74, 20), (79, 5)]}, ECONOMY | COSMETIC),
        ({"stats": [(9999, 1)]}, {"stats": [(9999, 2)]}, GAMEPLAY),
        (
            {"SpellData": wear(modify(16, 5))},
            {"SpellData": wear(modify(16, 9))},
            GAMEPLAY,
        ),
        (
            {"SpellData": wear(modify(16, 5), float_text("Ow"))},
            {"SpellData": wear(modify(16, 5), float_text("Ouch"))},
            COSMETIC,
        ),
        (
            {"SpellData": wear(modify(16, 5))},
            {"SpellData": wear(modify(16, 5), event=0)},
            COSMETIC,
        ),
        (
            {"SpellData": wear(modify(16, 5))},
            {"SpellData": wear(modify(16, 6), event=0)},
            GAMEPLAY,
        ),
        (
            {},
            {
                "ActionData": {
                    "Actions": [{"Action": 6, "Criteria": [criterion(1, 2, 0)]}]
                }
            },
            GAMEPLAY,
        ),
        (
            {"AttackDefenseData": {"Attack": [{"Stat": 100, "RawValue": 50}]}},
            {"AttackDefenseData": {"Attack": [{"Stat": 100, "RawValue": 60}]}},
            GAMEPLAY,
        ),
        ({}, {"ShopHashData": {"hash": "abc"}}, ECONOMY),
        (
            {"name": "Wrench", "stats": [(74, 10)]},
            {"name": "Spanner", "stats": [(74, 20), (30, 1)]},
            GAMEPLAY | ECONOMY | TEXT,
        ),
    ],
)
def test_a_change_is_classified_by_what_differs(conn, old, new, expected):
    assert two_builds(conn, old, new) == expected


@pytest.mark.parametrize(
    "old, new, expected",
    [
        # written out, or dropped, with the constant that says nothing
        ({}, {"stats": [(74, 0)]}, COSMETIC),
        ({}, {"stats": [(134, 0)]}, COSMETIC),
        ({}, {"stats": [(298, 0)]}, COSMETIC),
        ({"stats": [(6, 15)]}, {}, COSMETIC),
        ({"stats": [(5, 15)]}, {"stats": [(6, 15)]}, COSMETIC),
        # the same stats with a value that says something
        ({}, {"stats": [(74, 5)]}, ECONOMY),
        ({}, {"stats": [(134, 2)]}, GAMEPLAY),
        ({"stats": [(6, 14)]}, {}, GAMEPLAY),
        ({"stats": [(134, 2)]}, {"stats": [(134, 4)]}, GAMEPLAY),
        ({"stats": [(74, 56)]}, {"stats": [(74, 1)]}, ECONOMY),
        # the constant of another stat is a value like any other
        ({}, {"stats": [(134, 15)]}, GAMEPLAY),
        ({}, {"stats": [(6, 0)]}, GAMEPLAY),
        # from the constant to a value: the stat's class, and the constant went
        ({"stats": [(74, 0)]}, {"stats": [(74, 1)]}, ECONOMY | COSMETIC),
        ({"stats": [(134, 2)]}, {"stats": [(134, 0)]}, GAMEPLAY | COSMETIC),
    ],
)
def test_a_housekeeping_value_that_comes_or_goes_is_cosmetic(conn, old, new, expected):
    assert two_builds(conn, old, new) == expected


def test_a_housekeeping_value_is_one_only_while_the_rules_file_lists_it(conn):
    load(conn, spec("one", 1), items=[item(1)])
    load(conn, spec("two", 2), items=[item(1, stats=[(134, 0)])])
    assert relevance(conn, 2) == {1: COSMETIC}

    change_analysis.sync(conn, rules(edit=lambda t: t.replace("134 = 0 ", "134 = 1 ")))

    assert relevance(conn, 2) == {1: GAMEPLAY}


def test_an_effect_rendered_in_other_words_is_not_a_change_of_what_it_does(conn):
    reworded = dict(modify(16, 5), SpellDescription="Raise 16 by 5")

    found = two_builds(
        conn,
        {"SpellData": wear(modify(16, 5))},
        {"SpellData": wear(reworded, event=0)},
    )

    # the effect moved to another event and is the effect it was
    assert found == COSMETIC


def test_added_and_removed_items_are_classified_as_the_rules_say(conn):
    load(conn, spec("one", 1), items=[item(1), item(2)])
    load(conn, spec("two", 2), items=[item(2), item(3)])

    assert relevance(conn, 1) == {1: GAMEPLAY, 2: GAMEPLAY}
    assert relevance(conn, 2) == {1: GAMEPLAY, 3: GAMEPLAY}


def test_every_change_is_classified_at_import(conn):
    load(conn, spec("one", 1), items=[item(1), item(2, name="A")])
    load(conn, spec("two", 2), items=[item(2, name="B"), item(3)])
    load(
        conn,
        spec("fork", 1, branch="prk", parent_slug="one"),
        items=[item(1, stats=[(79, 4)])],
    )

    assert conn.execute(
        "SELECT count(*), count(relevance) FROM item_change"
    ).fetchone() == (7, 7)
    assert relevance(conn, 1, branch="prk") == {1: COSMETIC, 2: GAMEPLAY}


def test_sync_reclassifies_the_log_when_the_relevance_file_changes(conn):
    load(conn, spec("one", 1), items=[item(1, stats=[(74, 10)]), item(2)])
    load(conn, spec("two", 2), items=[item(1, stats=[(74, 20)]), item(2, name="B")])
    change_analysis.sync(conn, rules())
    assert relevance(conn, 2) == {1: ECONOMY, 2: TEXT}

    def value_is_cosmetic(text):
        return text.replace('74 = "Value"\n', "").replace(
            "[stats.cosmetic]\n", '[stats.cosmetic]\n74 = "Value"\n'
        )

    done = change_analysis.sync(conn, rules(edit=value_is_cosmetic))

    assert relevance(conn, 2) == {1: COSMETIC, 2: TEXT}
    assert done["reclassified"] == 1
    assert done["digests"] == 4  # every revision, from the new file


def test_sync_writes_nothing_when_nothing_changed(conn):
    load(conn, spec("one", 1), items=[item(1, stats=[(74, 10)])])
    load(conn, spec("two", 2), items=[item(1, stats=[(74, 20)])])
    change_analysis.sync(conn, rules())

    assert set(change_analysis.sync(conn, rules()).values()) == {0}


def test_sync_classifies_a_log_that_was_never_classified(conn):
    load(conn, spec("one", 1), items=[item(1, name="A")])
    load(conn, spec("two", 2), items=[item(1, name="B")])
    conn.execute("UPDATE item_change SET relevance = NULL")
    conn.execute("TRUNCATE revision_relevance, store_state, build_transition CASCADE")

    done = change_analysis.sync(conn, rules())

    assert done["reclassified"] == 2 and done["digests"] == 2
    assert relevance(conn, 2) == {1: TEXT}


def test_an_event_class_follows_the_rules_file(conn):
    load(conn, spec("one", 1), items=[item(1, SpellData=wear(modify(16, 5)))])
    load(conn, spec("two", 2), items=[item(1, SpellData=wear(modify(16, 5), event=0))])

    change_analysis.sync(
        conn,
        rules(edit=lambda t: t.replace('event = "cosmetic"', 'event = "gameplay"')),
    )

    assert relevance(conn, 2) == {1: GAMEPLAY}


# ---------------------------------------------------------------------------
# Build notes
# ---------------------------------------------------------------------------

RENUMBER = """
[[note]]
build = "two"
title = "Event renumbered"
body = "14 became 0."
explains = [{ path = "event", old = 14, new = 0 }]
alongside = [{ path = "stat:79" }]
"""
RENAME = """
[[note]]
build = "two"
title = "Renamed"
explains = [{ path = "name", old = "Old .*", new = "New .*" }]
"""


@pytest.fixture
def renumbered(conn):
    """Build two moves the Wear effects of items 1 to 3 from event 14 to
    event 0; item 2 also takes a new icon, and item 3 a new effect amount,
    which makes its event another event, not a renumbered one; item 4 is
    renamed."""
    load(
        conn,
        spec("one", 1),
        items=[
            item(1, SpellData=wear(modify(16, 5))),
            item(2, SpellData=wear(modify(17, 5)), stats=[(79, 1)]),
            item(3, SpellData=wear(modify(18, 5), modify(19, 1))),
            item(4, name="Old saw"),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            item(1, SpellData=wear(modify(16, 5), event=0)),
            item(2, SpellData=wear(modify(17, 5), event=0), stats=[(79, 2)]),
            item(3, SpellData=wear(modify(18, 5), modify(19, 2), event=0)),
            item(4, name="New saw"),
        ],
    )
    return conn


def test_notes_tag_the_changes_they_explain_entirely(renumbered):
    done = change_analysis.sync(renumbered, rules(RENUMBER + RENAME))

    assert noted(renumbered, 2) == {
        1: "Event renumbered",
        2: "Event renumbered",
        4: "Renamed",
    }
    assert done["noted"] == 3
    assert renumbered.execute(
        "SELECT b.slug, n.title, n.body FROM build_note n "
        "JOIN build b USING (build_id) ORDER BY n.note_id"
    ).fetchall() == [
        ("two", "Event renumbered", "14 became 0."),
        ("two", "Renamed", None),
    ]


def test_the_first_note_that_explains_a_change_tags_it(renumbered):
    catch_all = """
[[note]]
build = "two"
title = "Anything about effects"
explains = [{ part = "effects", path = "*" }]
alongside = [{ path = "stat:79" }]
"""
    change_analysis.sync(renumbered, rules(catch_all + RENUMBER))

    assert noted(renumbered, 2) == {
        1: "Anything about effects",
        2: "Anything about effects",
        3: "Anything about effects",
    }


def test_notes_are_tried_in_file_order_and_a_change_has_one_note(renumbered):
    catch_all = """
[[note]]
build = "two"
title = "Anything about effects"
explains = [{ part = "effects", path = "*" }]
alongside = [{ path = "stat:79" }]
"""
    # items 1 and 2 are explained by both notes, item 3 by the catch-all only
    done = change_analysis.sync(renumbered, rules(RENUMBER + catch_all))

    assert noted(renumbered, 2) == {
        1: "Event renumbered",
        2: "Event renumbered",
        3: "Anything about effects",
    }
    assert done["noted"] == 3

    change_analysis.sync(renumbered, rules(catch_all + RENUMBER))

    assert set(noted(renumbered, 2).values()) == {"Anything about effects"}


def test_a_note_removed_from_the_file_leaves_the_store(renumbered):
    change_analysis.sync(renumbered, rules(RENUMBER + RENAME))

    change_analysis.sync(renumbered, rules(RENAME))

    assert noted(renumbered, 2) == {4: "Renamed"}
    assert renumbered.execute("SELECT title FROM build_note").fetchall() == [
        ("Renamed",)
    ]


def test_a_note_keeps_its_id_when_only_its_text_or_rule_changes(renumbered):
    change_analysis.sync(renumbered, rules(RENUMBER))
    (before,) = renumbered.execute("SELECT note_id FROM build_note").fetchone()

    edited = RENUMBER.replace("14 became 0.", "The Wear event moved.").replace(
        'alongside = [{ path = "stat:79" }]', ""
    )
    change_analysis.sync(renumbered, rules(edited))

    assert renumbered.execute("SELECT note_id, body FROM build_note").fetchall() == [
        (before, "The Wear event moved.")
    ]
    assert noted(renumbered, 2) == {1: "Event renumbered"}


def test_a_note_for_a_build_the_store_lacks_is_ignored(renumbered):
    elsewhere = RENUMBER.replace('build = "two"', 'build = "ao-99-9-9"')

    change_analysis.sync(renumbered, rules(elsewhere))

    assert noted(renumbered, 2) == {}
    assert renumbered.execute("SELECT count(*) FROM build_note").fetchone() == (0,)


def test_notes_apply_to_a_build_as_it_is_imported(conn):
    notes = parse_notes(RENAME)
    relevance_ = relevance_rules()
    for slug, ordinal, name in (("one", 1, "Old saw"), ("two", 2, "New saw")):
        cas_store.import_build(
            conn,
            spec(slug, ordinal),
            cas_store.split_records([(item(4, name=name), False)]),
            rules=ChangeRules(relevance=relevance_, notes=notes),
        )

    assert noted(conn, 2) == {4: "Renamed"}
    assert relevance(conn, 2) == {4: TEXT}


# ---------------------------------------------------------------------------
# Shared transitions
# ---------------------------------------------------------------------------


def test_transitions_shared_by_several_items_are_counted_per_build(renumbered):
    assert shared(renumbered, 2) == {("effects", "event", 14, 0): (2, 2)}
    assert shared(renumbered, 1) == {}


def test_transitions_count_items_and_occurrences_apart(conn):
    load(
        conn,
        spec("one", 1),
        items=[
            item(1, SpellData=wear(modify(16, 5), modify(17, 5))),
            item(2, SpellData=wear(modify(16, 5))),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            item(1, SpellData=wear(modify(16, 9), modify(17, 9))),
            item(2, SpellData=wear(modify(16, 9))),
        ],
    )

    assert shared(conn, 2) == {
        ("effects", "effect:53045:spell_params.Amount", 5, 9): (2, 3)
    }


def test_sync_recounts_transitions_only_when_the_rules_or_engine_change(
    renumbered, monkeypatch
):
    change_analysis.sync(renumbered, rules())
    renumbered.execute("DELETE FROM build_transition")

    assert change_analysis.sync(renumbered, rules())["transitions"] == 0
    assert change_analysis.sync(renumbered, rules(RENAME))["transitions"] == 1
    assert shared(renumbered, 2) == {("effects", "event", 14, 0): (2, 2)}

    assert change_analysis.sync(renumbered, rules(RENAME))["transitions"] == 0
    reclassed = rules(
        RENAME, lambda t: t.replace('event = "cosmetic"', 'event = "gameplay"')
    )
    assert change_analysis.sync(renumbered, reclassed)["transitions"] == 1

    assert change_analysis.sync(renumbered, reclassed)["transitions"] == 0
    monkeypatch.setattr(change_analysis, "ANALYSIS_VERSION", "next")
    assert change_analysis.sync(renumbered, reclassed)["transitions"] == 1


def classed(conn, ordinal):
    """``{path: (relevance, unnoted items, unnoted occurrences, unexplained
    items)}`` of the shared transitions of one build."""
    return {
        path: tuple(rest)
        for path, *rest in conn.execute(
            "SELECT path, relevance, unnoted_items, unnoted_occurrences, "
            "unexplained_items FROM build_transition WHERE ordinal = %s",
            (ordinal,),
        )
    }


def test_a_transition_has_the_class_of_its_field(conn):
    def pair(first, **fields):
        return [item(first, **fields), item(first + 1, **fields)]

    def use(level):
        actions = [{"Action": 3, "Criteria": [criterion(54, level, 2)]}]
        return {"ActionData": {"Actions": actions}}

    load(
        conn,
        spec("one", 1),
        items=[
            *pair(1, name="Old saw"),
            *pair(3, stats=[(79, 1)]),
            *pair(5, stats=[(74, 5)]),
            *pair(7, SpellData=wear(modify(16, 5))),
            *pair(9, SpellData=wear(float_text("a"))),
            *pair(11, SpellData=wear(modify(17, 5))),
            *pair(13, **use(10)),
            *pair(
                15,
                AttackDefenseData={
                    "Attack": [{"Stat": 100, "RawValue": 50}],
                    "Defense": [],
                },
            ),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            *pair(1, name="New saw"),
            *pair(3, stats=[(79, 2)]),
            *pair(5, stats=[(74, 9)]),
            *pair(7, SpellData=wear(modify(16, 9))),
            *pair(9, SpellData=wear(float_text("b"))),
            *pair(11, SpellData=wear(modify(17, 5), event=0)),
            *pair(13, **use(20)),
            *pair(
                15,
                AttackDefenseData={
                    "Attack": [{"Stat": 100, "RawValue": 60}],
                    "Defense": [],
                },
            ),
        ],
    )

    assert {path: row[0] for path, row in classed(conn, 2).items()} == {
        "name": TEXT,
        "stat:79": COSMETIC,
        "stat:74": ECONOMY,
        "effect:53045:spell_params.Amount": GAMEPLAY,
        "effect:53057:spell_params.Text": COSMETIC,
        "event": COSMETIC,
        "action:3:criterion": GAMEPLAY,
        "attack:100": GAMEPLAY,
    }


def line_classes(conn, ordinal):
    """``{(path, old, new): relevance}`` of the shared transitions of a build."""
    return {
        (path, old, new): found
        for path, old, new, found in conn.execute(
            "SELECT path, old, new, relevance FROM build_transition WHERE ordinal = %s",
            (ordinal,),
        )
    }


def test_an_event_that_comes_or_goes_is_told_by_its_effects_and_classed_by_them(conn):
    def pair(first, **fields):
        return [item(first, **fields), item(first + 1, **fields)]

    worn, used = wear(modify(16, 5)), wear(modify(17, 5), event=5)
    load(
        conn,
        spec("one", 1),
        items=[
            *pair(1, SpellData=worn),
            *pair(3, SpellData=worn + used),
            *pair(5, SpellData=worn),
            *pair(7, SpellData=worn),
            *pair(9, SpellData=worn + wear(event=6)),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            *pair(1, SpellData=worn + used),
            *pair(3, SpellData=worn),
            *pair(5, SpellData=wear(modify(16, 5), event=0)),
            *pair(7, SpellData=worn + wear(event=6)),
            *pair(9, SpellData=worn),
        ],
    )

    # event 5 came and went with an effect, and only the effect's lines say
    # so; event 6 came and went empty, which only a line of its own can say
    assert line_classes(conn, 2) == {
        ("effect:53045", None, 17): GAMEPLAY,
        ("effect:53045", 17, None): GAMEPLAY,
        ("event", 14, 0): COSMETIC,
        ("event:6", None, "added"): COSMETIC,
        ("event:6", "removed", None): COSMETIC,
    }
    # each line has the class of the changes it leads to
    assert relevance(conn, 2) == {
        **dict.fromkeys((1, 2, 3, 4), GAMEPLAY),
        **dict.fromkeys((5, 6, 7, 8, 9, 10), COSMETIC),
    }


def test_an_effect_moved_between_events_is_a_change_of_its_class(conn):
    # 15.7.0, item 251755: a modifier leaves Use (0) and joins Wear (14);
    # stat 5 = 15 goes and 4 = 15 comes with it, which is housekeeping
    load(
        conn,
        spec("one", 1),
        items=[
            item(
                1,
                stats=[(5, 15)],
                SpellData=wear(modify(1, 130), event=0) + wear(modify(16, 5)),
            ),
            item(2, SpellData=wear(modify(16, 5), float_text("Ow"))),
            item(3, SpellData=wear(modify(16, 5)) + wear(modify(17, 5), event=0)),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            item(1, stats=[(4, 15)], SpellData=wear(modify(1, 130), modify(16, 5))),
            item(2, SpellData=wear(modify(16, 5)) + wear(float_text("Ow"), event=0)),
            item(3, SpellData=wear(modify(17, 5)) + wear(modify(16, 5), event=0)),
        ],
    )

    assert relevance(conn, 2) == {
        1: GAMEPLAY | COSMETIC,
        # a cosmetic effect moved; two events traded numbers
        2: COSMETIC,
        3: COSMETIC,
    }


def test_a_text_too_long_to_quote_has_no_line(conn):
    def described(first, text):
        return [item(first, Description=text), item(first + 1, Description=text)]

    load(conn, spec("one", 1), items=described(1, "A tool.") + described(3, "A tool."))
    load(
        conn,
        spec("two", 2),
        items=described(1, "A " + "x" * 81) + described(3, "A saw."),
    )

    assert shared(conn, 2) == {("text", "description", "tool.", "saw."): (2, 2)}


def test_a_stat_line_is_cosmetic_only_for_the_housekeeping_value(conn):
    def pair(first, *stats):
        return [item(first, stats=list(stats)), item(first + 1, stats=list(stats))]

    load(
        conn,
        spec("one", 1),
        items=[*pair(1), *pair(3, (74, 56)), *pair(5, (5, 15)), *pair(7, (74, 0))],
    )
    load(
        conn,
        spec("two", 2),
        items=[*pair(1, (74, 0)), *pair(3, (74, 1)), *pair(5), *pair(7, (74, 3))],
    )

    assert line_classes(conn, 2) == {
        ("stat:74", None, 0): COSMETIC,
        ("stat:74", 56, 1): ECONOMY,
        ("stat:5", 15, None): COSMETIC,
        ("stat:74", 0, 3): ECONOMY,
    }


def test_a_transition_is_also_counted_without_the_changes_a_note_explains(conn):
    load(
        conn,
        spec("one", 1),
        items=[
            item(1, name="Old saw"),
            item(2, name="Old drill"),
            item(3, name="Old file", stats=[(74, 5), (74, 6)]),
            item(4, stats=[(74, 5)]),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            item(1, name="New saw"),
            item(2, name="New drill"),
            item(3, name="New file", stats=[(74, 9), (74, 9)]),
            item(4, stats=[(74, 9)]),
        ],
    )

    assert classed(conn, 2) == {
        "name": (TEXT, 3, 3, 3),
        "stat:74": (ECONOMY, 2, 2, 2),
    }
    assert shared(conn, 2)[("stats", "stat:74", 5, 9)] == (2, 2)

    change_analysis.sync(conn, rules(RENAME))

    # items 1 and 2 are explained; item 3 changed in value as well
    # and there the note accounts for the rename, not for the value
    assert classed(conn, 2) == {
        "name": (TEXT, 1, 1, 0),
        "stat:74": (ECONOMY, 2, 2, 2),
    }
    assert shared(conn, 2)[("text", "name", "Old", "New")] == (3, 3)


def test_a_note_that_is_not_partial_leaves_its_line_to_the_changes_it_does_not_tag(
    conn,
):
    # live: 33 items were only retargeted and are the note's; the retargeting
    # of the items that changed otherwise too stays a line of the patch notes
    load(
        conn,
        spec("one", 1),
        items=[
            item(1, name="Old saw"),
            item(2, name="Old drill"),
            item(3, name="Old file", stats=[(74, 5)]),
            item(4, name="Old rasp", stats=[(74, 5)]),
        ],
    )
    load(
        conn,
        spec("two", 2),
        items=[
            item(1, name="New saw"),
            item(2, name="New drill"),
            item(3, name="New file", stats=[(74, 9)]),
            item(4, name="New rasp", stats=[(74, 9)]),
        ],
    )

    change_analysis.sync(conn, rules(RENAME + "partial = false\n"))

    assert set(noted(conn, 2)) == {1, 2}
    assert classed(conn, 2) == {
        "name": (TEXT, 2, 2, 2),
        "stat:74": (ECONOMY, 2, 2, 2),
    }
    assert shared(conn, 2)[("text", "name", "Old", "New")] == (4, 4)


def test_a_note_accounts_for_what_comes_alongside_only_where_its_event_happened(
    renumbered,
):
    # items 1 to 3 are renumbered (item 3 changes an effect too); items 2, 5
    # and 6 take the same new icon, which the note lets a renumbering come with
    load(
        renumbered,
        spec("three", 3),
        items=[
            item(1, SpellData=wear(modify(16, 5))),
            item(2, SpellData=wear(modify(17, 5)), stats=[(79, 1)]),
            item(3, SpellData=wear(modify(18, 5), modify(19, 1))),
            item(5, stats=[(79, 1)]),
            item(6, stats=[(79, 1)]),
        ],
    )
    load(
        renumbered,
        spec("four", 4),
        items=[
            item(1, SpellData=wear(modify(16, 5), event=0)),
            item(2, SpellData=wear(modify(17, 5), event=0), stats=[(79, 2)]),
            item(3, SpellData=wear(modify(18, 5), modify(19, 1), event=0), name="X"),
            item(5, stats=[(79, 2)]),
            item(6, stats=[(79, 2)]),
        ],
    )

    change_analysis.sync(
        renumbered, rules(RENUMBER.replace('build = "two"', 'build = "four"'))
    )

    assert noted(renumbered, 4) == {1: "Event renumbered", 2: "Event renumbered"}
    assert classed(renumbered, 4) == {
        # item 3 is not explained (it was renamed too), but its renumbering is
        "event": (COSMETIC, 1, 1, 0),
        # the icon of item 2 came with its renumbering; items 5 and 6 only
        # took a new icon
        "stat:79": (COSMETIC, 2, 2, 2),
    }


# ---------------------------------------------------------------------------
# The verifier (tools/verify_cas.py --store)
# ---------------------------------------------------------------------------


def rule_differences(verify_cas, conn, with_rules):
    """Differences the verifier counts between the store and rules files."""
    report = verify_cas.Report(show=5)
    verify_cas.check_change_rules(report, conn, with_rules)
    return report.differences


def test_the_verifier_accepts_a_store_analysed_with_the_rules_files(
    renumbered, verify_cas
):
    change_analysis.sync(renumbered, rules(RENUMBER))

    assert rule_differences(verify_cas, renumbered, rules(RENUMBER)) == 0


def test_the_verifier_notices_a_note_whose_rule_changed_since_the_import(
    renumbered, verify_cas, capsys
):
    change_analysis.sync(renumbered, rules(RENUMBER))
    # title and body as stored; only what the note explains differs
    edited = RENUMBER.replace('alongside = [{ path = "stat:79" }]', "")
    assert edited != RENUMBER

    assert rule_differences(verify_cas, renumbered, rules(edited)) == 1
    assert "no (run import_cli.py import-cas)" in capsys.readouterr().out


def test_the_verifier_notices_a_relevance_file_changed_since_the_import(
    renumbered, verify_cas
):
    change_analysis.sync(renumbered, rules(RENUMBER))
    reclassed = rules(
        RENUMBER, lambda t: t.replace('event = "cosmetic"', 'event = "gameplay"')
    )

    # the relevance of the log, and the class of every transition
    assert rule_differences(verify_cas, renumbered, reclassed) == 2
    assert verify_cas.misclassified_transitions(renumbered, reclassed) == [
        ("effects", "event", 14, 0, COSMETIC)
    ]
    assert verify_cas.misclassified_transitions(renumbered, rules(RENUMBER)) == []


def broken_analysis_rules(verify_cas, conn, with_rules):
    return {
        rule
        for rule, query in verify_cas.change_analysis_invariants(
            conn, with_rules
        ).items()
        if conn.execute(query).fetchall()
    }


def test_the_verifier_notices_transitions_counted_with_other_notes(
    renumbered, verify_cas
):
    change_analysis.sync(renumbered, rules(RENUMBER))
    assert broken_analysis_rules(verify_cas, renumbered, rules(RENUMBER)) == set()

    renumbered.execute("UPDATE item_change SET note_id = NULL WHERE aoid = 1")

    assert broken_analysis_rules(verify_cas, renumbered, rules(RENUMBER)) == {
        "shared transitions not counted over the changes without a note as the "
        "log has them"
    }


# ---------------------------------------------------------------------------
# Upgrading a store
# ---------------------------------------------------------------------------


def test_upgrade_gives_an_older_store_the_change_analysis_tables(conn):
    load(conn, spec("one", 1), items=[item(1, name="A")])
    load(conn, spec("two", 2), items=[item(1, name="B")])
    schema = conn.execute("SELECT current_schema()").fetchone()[0]
    conn.execute(
        "DROP TABLE revision_relevance, change_transition, build_transition, store_state"
    )
    conn.execute("DROP INDEX item_change_note")
    conn.execute("UPDATE item_change SET relevance = NULL")

    cas_store.upgrade_store(conn, schema)
    cas_store.upgrade_store(conn, schema)
    change_analysis.sync(conn, rules())

    assert relevance(conn, 2) == {1: TEXT}
    assert conn.execute("SELECT count(*) FROM revision_relevance").fetchone() == (2,)


@pytest.mark.parametrize(
    "missing",
    [
        ["relevance", "unnoted_items", "unnoted_occurrences", "unexplained_items"],
        ["unexplained_items"],
    ],
    ids=["all", "the newest"],
)
def test_upgrade_gives_an_older_store_the_columns_of_the_patch_notes(
    renumbered, missing
):
    schema = renumbered.execute("SELECT current_schema()").fetchone()[0]
    renumbered.execute(
        "ALTER TABLE build_transition "
        + ", ".join(f"DROP COLUMN {column}" for column in missing)
    )
    renumbered.execute(
        "UPDATE store_state SET value = 'an earlier engine' "
        "WHERE name = 'change_analysis'"
    )

    cas_store.upgrade_store(renumbered, schema)
    cas_store.upgrade_store(renumbered, schema)
    change_analysis.sync(renumbered, rules(RENUMBER))

    assert classed(renumbered, 2) == {"event": (COSMETIC, 0, 0, 0)}
