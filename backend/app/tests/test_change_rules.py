"""
Tests for the maintained rules about changes (app/core/change_rules.py): the
relevance classes of ``change_relevance.toml`` and the build notes of
``build_notes.toml``.
"""

import pytest

from app.core.change_rules import (
    RulesError,
    parse_notes,
    parse_relevance,
    read_rules,
    relevance_mask,
    relevance_names,
)
from app.core.item_diff import Transition

RELEVANCE = """
default = "gameplay"

[changes]
added = "gameplay"
removed = "gameplay"
actions = "gameplay"
attack_defense = "gameplay"
event = "cosmetic"
static_instance = "cosmetic"
animation_mesh = "cosmetic"
shop = "economy"

[stats.gameplay]
30 = "Can"

[stats.economy]
74 = "Value"

[stats.cosmetic]
79 = "Icon"

[stats.unclassified]
6 = "Team"

[effects.gameplay]
53045 = "Modify {Stat} {Amount}"

[effects.cosmetic]
53057 = "Float text"

[effects.unclassified]
53028 = "(no format template)"
"""


def test_relevance_file_gives_each_listed_id_its_class():
    rules = parse_relevance(RELEVANCE)

    assert rules.stat_class(74) == "economy"
    assert rules.stat_class(79) == "cosmetic"
    assert rules.effect_class(53057) == "cosmetic"
    assert rules.bit("event") == 4 and rules.bit("shop") == 2


def test_unlisted_and_unclassified_ids_take_the_default():
    rules = parse_relevance(RELEVANCE)

    assert rules.stat_class(6) == rules.stat_class(9999) == "gameplay"
    assert rules.effect_class(53028) == "gameplay"
    assert rules.knows_stat(6) and not rules.knows_stat(9999)
    assert rules.knows_effect(53028) and not rules.knows_effect(1)


def test_relevance_digest_follows_the_file():
    assert parse_relevance(RELEVANCE).digest == parse_relevance(RELEVANCE).digest
    assert (
        parse_relevance(RELEVANCE).digest
        != parse_relevance(RELEVANCE.replace('79 = "Icon"', '80 = "Icon"')).digest
    )


@pytest.mark.parametrize(
    "broken, message",
    [
        (RELEVANCE.replace('default = "gameplay"', 'default = "fun"'), "default"),
        (RELEVANCE.replace("[stats.economy]", "[stats.money]"), "stats.money"),
        (RELEVANCE.replace('79 = "Icon"', '30 = "Icon"'), "30 is listed twice"),
        (RELEVANCE.replace('79 = "Icon"', 'icon = "Icon"'), "not a numeric id"),
        (RELEVANCE.replace('shop = "economy"', ""), "shop"),
        (RELEVANCE.replace('shop = "economy"', 'shop = "text"'), "shop"),
        (RELEVANCE.replace("[changes]", "[changes]\nmesh = 'cosmetic'"), "mesh"),
        ("default = ", "change relevance file"),
    ],
)
def test_a_relevance_file_that_cannot_be_used_is_refused(broken, message):
    with pytest.raises(RulesError, match=message):
        parse_relevance(broken)


def test_relevance_masks_and_names():
    assert relevance_names(1 | 8) == ["gameplay", "text"]
    assert relevance_names(None) == []
    assert relevance_mask(["economy", "cosmetic"]) == 6


# ---------------------------------------------------------------------------
# Build notes
# ---------------------------------------------------------------------------

NOTES = """
[[note]]
build = "ao-14-5-0"
title = "Wear event renumbered"
body = "Event 14 became event 0."
explains = [{ path = "event", old = 14, new = 0 }]
alongside = [
    { path = "stat:79" },
    { path = "stat:88", old = "absent", new = 0 },
    { path = "description", new = ".*NanoCluster.*" },
]

[[note]]
build = "ao-14-5-0"
title = "Requirement lowered"
explains = [
    { part = "actions", path = "action:*:criterion", old = [124, 1060, 2], new = [124, 1000, 2] },
]
"""

RENUMBERED = Transition("effects", "event", 14, 0)
ICON = Transition("stats", "stat:79", 12712, 12711)
SLOT_ADDED = Transition("stats", "stat:88", None, 0)
SLOT_CHANGED = Transition("stats", "stat:88", 4, 0)
RESPELLED = Transition("text", "description", "A Nano-Cluster", "A NanoCluster\nof it")
REWORDED = Transition("text", "description", "A Nano-Cluster", "A cluster")
LOWERED = Transition("actions", "action:6:criterion", (124, 1060, 2), (124, 1000, 2))


def test_notes_are_read_in_file_order_per_build():
    rules = parse_notes(NOTES)

    assert [note.title for note in rules.of_build("ao-14-5-0")] == [
        "Wear event renumbered",
        "Requirement lowered",
    ]
    assert rules.of_build("ao-14-6-0") == []
    assert rules.notes[0].body == "Event 14 became event 0."
    assert rules.notes[1].body is None


def test_a_note_explains_a_change_made_of_what_it_names():
    renumbered, lowered = parse_notes(NOTES).notes

    assert renumbered.explains_change([RENUMBERED])
    assert renumbered.explains_change([RENUMBERED, ICON, SLOT_ADDED, RESPELLED])
    assert lowered.explains_change([LOWERED])


def test_a_note_does_not_explain_a_change_with_anything_else_in_it():
    renumbered, lowered = parse_notes(NOTES).notes

    assert not renumbered.explains_change([RENUMBERED, LOWERED])
    assert not renumbered.explains_change([RENUMBERED, SLOT_CHANGED])
    assert not renumbered.explains_change([RENUMBERED, REWORDED])
    assert not lowered.explains_change([LOWERED, ICON])


def test_what_comes_alongside_is_not_the_event_itself():
    renumbered, _ = parse_notes(NOTES).notes

    assert not renumbered.explains_change([ICON, SLOT_ADDED])
    assert not renumbered.explains_change([])


def test_pattern_values_match_exactly_and_paths_by_wildcard():
    _, lowered = parse_notes(NOTES).notes

    assert lowered.explains_change(
        [Transition("actions", "action:3:criterion", (124, 1060, 2), (124, 1000, 2))]
    )
    assert not lowered.explains_change(
        [Transition("actions", "action:6:criterion", (124, 1060, 2), (124, 900, 2))]
    )
    assert not lowered.explains_change(
        [Transition("effects", "action:6:criterion", (124, 1060, 2), (124, 1000, 2))]
    )
    assert (
        not parse_notes(NOTES)
        .notes[0]
        .explains_change([Transition("effects", "event", 14, 2)])
    )


@pytest.mark.parametrize(
    "broken, message",
    [
        ('[[note]]\ntitle = "x"\nexplains = [{path = "event"}]', "build is required"),
        ('[[note]]\nbuild = "b"\nexplains = [{path = "event"}]', "title is required"),
        ('[[note]]\nbuild = "b"\ntitle = "x"', "at least one pattern"),
        (
            '[[note]]\nbuild = "b"\ntitle = "x"\nexplains = [{old = 1}]',
            "a pattern is a table with a path",
        ),
        (
            '[[note]]\nbuild = "b"\ntitle = "x"\nexplains = [{path = "p", was = 1}]',
            "unknown keys",
        ),
        (
            '[[note]]\nbuild = "b"\ntitle = "x"\nexplains = [{path = "name", old = "("}]',
            "bad regular expression",
        ),
        (
            '[[note]]\nbuild = "b"\ntitle = "x"\nexplains = [{path = "p", old = [1, 2]}]',
            "a criterion is",
        ),
        (NOTES + NOTES, "defined twice"),
    ],
)
def test_a_notes_file_that_cannot_be_used_is_refused(broken, message):
    with pytest.raises(RulesError, match=message):
        parse_notes(broken)


def test_the_files_in_the_repository_are_valid():
    rules = read_rules()

    assert rules.relevance.default == "gameplay"
    assert rules.relevance.stats and rules.relevance.effects
    assert {note.build for note in rules.notes.notes} >= {
        "ao-14-5-0",
        "ao-14-8-0",
        "ao-18-8-62-ep1",
    }
