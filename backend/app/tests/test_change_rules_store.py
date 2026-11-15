"""
The diff engine and the rules files against the real game data.

These tests read the development store (``settings.CAS_SCHEMA``) and diff its
change log with app/core/item_diff.py. They are the objective gate of the
diff stage: the engine reproduces the figures of the hand-verified prototype
(docs/plans/content-addressed-store/design.md section 2.4), and
``change_relevance.toml`` knows every stat and effect type that occurs in a
change.

A build the store does not hold skips its test.
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
    build = conn.execute(
        "SELECT branch, ordinal FROM build WHERE slug = %s", (slug,)
    ).fetchone()
    if build is None:
        pytest.skip(f"the store does not hold {slug}")
    rows = only_parts(change_analysis.changed_rows(conn, tuple(build)), EFFECTS)
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


def test_the_stored_relevance_of_every_change_is_the_union_of_its_diff_entries(conn):
    """The importer classifies a change from per-revision digests, in SQL;
    the API tags each entry of a field-level diff. The two must agree on
    every changed item of the store."""
    rules = default_rules().relevance
    stored = {
        tuple(key): relevance
        for *key, relevance in conn.execute(
            "SELECT branch, ordinal, aoid, relevance FROM item_change WHERE kind = 'C'"
        )
    }
    if stored and all(value is None for value in stored.values()):
        pytest.skip("the store's change log is not classified yet")
    rows = change_analysis.changed_rows(conn)
    differing = [
        (key, stored[key], found)
        for key, found in (
            (key, diff_relevance(with_relevance(diff, rules)))
            for key, diff in change_analysis.ChangeDiffs(conn, rows)
        )
        if stored[key] != found
    ]

    assert len(rows) == len(stored)
    assert not differing, f"{len(differing)} differ, e.g. {differing[:5]}"
