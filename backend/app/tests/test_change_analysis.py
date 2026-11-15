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
    conn.execute("TRUNCATE revision_relevance, store_state, build_transition")

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


def test_sync_recounts_transitions_only_when_the_notes_or_engine_change(renumbered):
    change_analysis.sync(renumbered, rules())
    renumbered.execute("DELETE FROM build_transition")

    assert change_analysis.sync(renumbered, rules())["transitions"] == 0
    assert change_analysis.sync(renumbered, rules(RENAME))["transitions"] == 1
    assert shared(renumbered, 2) == {("effects", "event", 14, 0): (2, 2)}


# ---------------------------------------------------------------------------
# Upgrading a store
# ---------------------------------------------------------------------------


def test_upgrade_gives_an_older_store_the_change_analysis_tables(conn):
    load(conn, spec("one", 1), items=[item(1, name="A")])
    load(conn, spec("two", 2), items=[item(1, name="B")])
    schema = conn.execute("SELECT current_schema()").fetchone()[0]
    conn.execute("DROP TABLE revision_relevance, build_transition, store_state")
    conn.execute("DROP INDEX item_change_note")
    conn.execute("UPDATE item_change SET relevance = NULL")

    cas_store.upgrade_store(conn, schema)
    cas_store.upgrade_store(conn, schema)
    change_analysis.sync(conn, rules())

    assert relevance(conn, 2) == {1: TEXT}
    assert conn.execute("SELECT count(*) FROM revision_relevance").fetchone() == (2,)
