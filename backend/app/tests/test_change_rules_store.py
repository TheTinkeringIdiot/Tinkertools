"""
The diff engine and the rules files against the real game data.

These tests read the development store (``settings.CAS_SCHEMA``) and diff its
change log with app/core/item_diff.py. They are the objective gate of the
diff stage: the engine reproduces the figures of the hand-verified prototype
(docs/plans/content-addressed-store/design.md section 2.4), and
``change_relevance.toml`` knows every stat and effect type that occurs in a
change.

A test is skipped, with the reason, when the store does not hold its build,
and those that read what the importer derived (``analysed``) when the store
was not analysed with the rules of this checkout: its relevance, notes and
lines then answer to other rules and say nothing about these.
"""

import os
from collections import Counter

import pytest

from app.core import cas_store, change_analysis, item_diff
from app.core.config import settings
from app.core.change_rules import default_rules, diff_relevance, with_relevance
from app.core.item_diff import Transition

DATABASE_URL = os.getenv("DATABASE_URL", "")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL.startswith("postgres"), reason="needs PostgreSQL"
)


@pytest.fixture(scope="module")
def conn():
    connection = cas_store.connect(DATABASE_URL, settings.CAS_SCHEMA)
    connection.read_only = True
    try:
        yield connection
    finally:
        connection.close()


@pytest.fixture(scope="module")
def analysed(conn):
    """The store, analysed by the importer with the rules files and the
    engine of this checkout."""
    rules = default_rules()
    state = dict(conn.execute("SELECT name, value FROM store_state").fetchall())
    if not (
        change_analysis.relevance_is_current(state, rules.relevance)
        and state.get(change_analysis.STATE_ANALYSIS)
        == change_analysis.analysis_digest(rules)
    ):
        pytest.skip(
            f"store '{settings.CAS_SCHEMA}' was not analysed with the rules files "
            f"and diff engine of this checkout, so what it derived cannot be "
            f"checked against them: run import_cli.py import-cas "
            f"--schema {settings.CAS_SCHEMA}"
        )
    return conn


def build_of(conn, slug):
    """``(branch, ordinal)`` of a build; skips the test when the store does
    not hold it."""
    build = conn.execute(
        "SELECT branch, ordinal FROM build WHERE slug = %s", (slug,)
    ).fetchone()
    if build is None:
        pytest.skip(f"store '{settings.CAS_SCHEMA}' does not hold {slug}")
    return tuple(build)


# positions of the stats and effects parts among a row's part ids
STATS, EFFECTS = 1, 2


def only_parts(rows, *positions):
    """The rows that differ in the parts at ``positions``, with every other
    part made equal, so that only those parts are diffed."""

    def kept(ids):
        return tuple(ids[n] if n in positions else None for n in range(len(ids)))

    return [
        (key, kept(old), kept(new)) for key, old, new in rows if kept(old) != kept(new)
    ]


def effect_changes(conn, slug):
    """``[transitions of the effects part]`` per item of build ``slug`` whose
    effects part differs from the build before."""
    rows = only_parts(change_analysis.changed_rows(conn, build_of(conn, slug)), EFFECTS)
    return [
        item_diff.transitions(diff)
        for _, diff in change_analysis.ChangeDiffs(conn, rows)
    ]


def occurrences(changes, transition):
    return sum(found.count(transition) for found in changes)


def test_14_5_0_changes_527_items_462_of_them_only_by_renumbering_event_14(conn):
    changes = effect_changes(conn, "ao-14-5-0")
    renumbered = Transition("effects", "event", 14, 0)

    assert len(changes) == 527
    assert all(changes), "an effects part that differs must give a field-level diff"
    assert sum(found == [renumbered] for found in changes) == 462


def test_14_6_0_changes_3070_items_and_raises_760_proc_chances_to_100(conn):
    changes = effect_changes(conn, "ao-14-6-0")
    chance = "effect:53089:spell_params.Chance"

    assert len(changes) == 3070
    assert all(changes)
    assert occurrences(changes, Transition("effects", chance, 60, 100)) == 760
    assert occurrences(changes, Transition("effects", chance, 95, 100)) == 760


def test_live_changes_about_4940_items_with_the_prototypes_transitions(conn):
    """The prototype counted 206 and 814; it paired leftover effects of
    different subjects, which this engine reports as removals and additions."""
    changes = effect_changes(conn, "ao-18-8-62-ep1")
    resistance = Transition("effects", "effect:53162:spell_params.Resistance", 50, 10)
    retargeted = Transition("effects", "effect:53045:target", 2, 3)

    assert len(changes) == 4936
    assert all(changes)
    assert occurrences(changes, resistance) == 204
    assert occurrences(changes, retargeted) == 798


def test_every_stat_and_effect_type_in_a_change_is_in_the_relevance_file(conn):
    """A stat or effect type that changes somewhere in the store and is in no
    section of change_relevance.toml, not even ``unclassified``, takes the
    default class unnoticed. List it, under a class or under unclassified."""
    rules = default_rules().relevance
    rows = only_parts(change_analysis.changed_rows(conn), STATS, EFFECTS)
    stats, effects = Counter(), Counter()
    for _, diff in change_analysis.ChangeDiffs(conn, rows):
        stats.update({change["stat"] for change in diff["stats"]})
        changed = set()
        for event in diff["effects"]:
            changed.update(e["spell_id"] for e in event["added"] + event["removed"])
            changed.update(pair["new"]["spell_id"] for pair in event["changed"])
        effects.update(changed)

    unknown_stats = {s: n for s, n in stats.items() if not rules.knows_stat(s)}
    unknown_effects = {s: n for s, n in effects.items() if not rules.knows_effect(s)}

    assert not unknown_stats, f"stats (id: changes) not listed: {unknown_stats}"
    assert not unknown_effects, f"effect types not listed: {unknown_effects}"


def test_the_stored_relevance_of_every_change_is_the_union_of_its_diff_entries(
    analysed,
):
    """The importer classifies a change from per-revision digests, in SQL;
    the API tags each entry of a field-level diff. The two must agree on
    every changed item of the store."""
    conn = analysed
    rules = default_rules().relevance
    stored = {
        tuple(key): relevance
        for *key, relevance in conn.execute(
            "SELECT branch, ordinal, aoid, relevance FROM item_change WHERE kind = 'C'"
        )
    }
    rows = change_analysis.changed_rows(conn)
    effects = change_analysis._documents(
        conn,
        "effects",
        (ids[EFFECTS] for _, old, new in rows for ids in (old, new)),
    )
    differing = [
        (key, stored[key], found)
        for key, found in (
            (
                key,
                diff_relevance(
                    with_relevance(
                        diff,
                        rules,
                        effects.get(old[EFFECTS]),
                        effects.get(new[EFFECTS]),
                    )
                ),
            )
            for (key, old, new), (_, diff) in zip(
                rows, change_analysis.ChangeDiffs(conn, rows), strict=True
            )
        )
        if stored[key] != found
    ]

    assert len(rows) == len(stored)
    assert not differing, f"{len(differing)} differ, e.g. {differing[:5]}"


def test_a_patch_note_line_has_a_class_that_each_of_its_items_has(analysed):
    """A line of the patch notes listed under one relevance must lead to its
    items under the same filter, and say of them what their own diffs say:
    every item of a shared transition has the class of the transition in its
    relevance. An effect that an item lost in one event and gained in
    another is "effect removed" and "effect added" in both places, and of
    the effect's class in both.
    """
    broken = analysed.execute("""
        SELECT s.slug, t.path, t.old, t.new, t.relevance, count(*)
        FROM build_transition t
        JOIN build s ON s.branch = t.branch AND s.ordinal = t.ordinal
        JOIN change_transition m ON m.transition_id = t.transition_id
        JOIN item_change c ON c.branch = t.branch AND c.ordinal = t.ordinal
                          AND c.aoid = m.aoid
        WHERE c.relevance & t.relevance = 0
        GROUP BY 1, 2, 3, 4, 5
        """).fetchall()

    assert not broken, f"{len(broken)} lines, e.g. {broken[:5]}"


# Items of the archive's live build with a Modify effect retargeted from 2 to
# 3, and those of them the note tags because nothing else changed, as counted
# when the note was written. They describe that build's data and nothing else.
LIVE_RETARGETED_ITEMS, LIVE_ONLY_RETARGETED_ITEMS = 128, 33


def test_the_live_retargeting_is_a_note_and_a_line_that_add_up(analysed):
    """The note of the live build tags the items that were only retargeted;
    the patch notes keep one line for the retargeting of every other item,
    so that the two account for all of it."""
    branch, ordinal = build_of(analysed, "ao-18-8-62-ep1")
    found = analysed.execute(
        """
        SELECT t.items, t.unnoted_items, t.unexplained_items,
               (SELECT count(*) FROM item_change c
                WHERE c.branch = t.branch AND c.ordinal = t.ordinal
                  AND c.note_id IS NOT NULL)
        FROM build_transition t
        WHERE t.branch = %s AND t.ordinal = %s AND t.path = 'effect:53045:target'
          AND t.old = '2' AND t.new = '3'
        """,
        (branch, ordinal),
    ).fetchone()

    assert found is not None, "the live build has no line for the retargeting"
    items, unnoted, unexplained, noted = found
    # what holds whatever the data: the line counts the items the note left
    assert noted > 0
    assert unnoted == unexplained == items - noted
    # the content of this store's live build
    assert (items, noted) == (LIVE_RETARGETED_ITEMS, LIVE_ONLY_RETARGETED_ITEMS)
