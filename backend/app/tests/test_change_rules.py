"""
Tests for the maintained rules about changes (app/core/change_rules.py): the
relevance classes of ``change_relevance.toml`` and the build notes of
``build_notes.toml``.
"""

import pytest

from app.core.change_rules import (
    RulesError,
    diff_relevance,
    parse_notes,
    parse_relevance,
    read_rules,
    relevance_mask,
    relevance_names,
    with_relevance,
)
from app.core.item_diff import Transition, diff_parts

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


HOUSEKEEPING = RELEVANCE + """
[housekeeping]
74 = 0
6 = 15
"""


def test_a_housekeeping_value_is_cosmetic_and_any_other_value_is_the_stats_class():
    rules = parse_relevance(HOUSEKEEPING)

    assert rules.value_class(74, 0) == "cosmetic"
    assert rules.value_class(74, 1) == "economy"
    assert rules.value_class(6, 15) == "cosmetic"
    assert rules.value_class(6, 0) == rules.value_class(30, 0) == "gameplay"
    # added or removed with the value; a change from or to it is the stat's
    assert rules.stat_change_class(74, None, 0) == "cosmetic"
    assert rules.stat_change_class(74, 0, None) == "cosmetic"
    assert rules.stat_change_class(74, None, 5) == "economy"
    assert rules.stat_change_class(74, 0, 5) == "economy"
    assert rules.stat_change_class(74, 56, 1) == "economy"
    assert rules.stat_change_class(30, None, 0) == "gameplay"


def test_a_file_without_housekeeping_values_has_none():
    rules = parse_relevance(RELEVANCE)

    assert rules.housekeeping == {}
    assert rules.stat_change_class(74, None, 0) == "economy"


@pytest.mark.parametrize(
    "entry, message",
    [
        ('74 = "Value"', "not the one value"),
        ("74 = [0, 1]", "not the one value"),
        ("74 = true", "not the one value"),
        ("value = 0", "not a numeric id"),
    ],
)
def test_a_housekeeping_entry_is_one_stat_and_one_value(entry, message):
    with pytest.raises(RulesError, match=message):
        parse_relevance(RELEVANCE + "\n[housekeeping]\n" + entry)


def test_a_line_has_the_class_of_its_field_and_values():
    rules = parse_relevance(HOUSEKEEPING)

    def line(part, path, old=None, new=None):
        return rules.transition_class(part, path, old, new)

    assert line("text", "name", "a", "b") == "text"
    assert line("stats", "stat:74", 5, 9) == "economy"
    assert line("stats", "stat:74", None, 0) == "cosmetic"
    assert line("stats", "stat:74", 0, 3) == "economy"
    assert line("stats", "stat:30:bit:8", 0, 1) == "gameplay"
    assert line("atkdef", "attack:100", 1, 2) == "gameplay"
    assert line("actions", "action:3", None, "added") == "gameplay"
    assert line("effects", "effect:53057", None, "none") == "cosmetic"
    assert line("effects", "effect:53045:target", 2, 3) == "gameplay"
    assert line("effects", "event", 14, 0) == "cosmetic"
    # an event without effects that came or went, as a renumbering
    assert line("effects", "event:14", None, "added") == "cosmetic"
    assert line("effects", "event:14", "removed", None) == "cosmetic"
    assert line("misc", "shop") == "economy"


def test_diff_entries_say_when_a_housekeeping_value_comes_or_goes():
    rules = parse_relevance(HOUSEKEEPING)
    diff = diff_parts(
        {"stats": [[74, 0], [79, 1], [30, 1]]},
        {"stats": [[74, 7], [6, 15], [79, 2], [30, 3]]},
    )

    tagged = with_relevance(diff, rules, None, None)

    assert {
        c["stat"]: (c["relevance"], c["housekeeping"]) for c in tagged["stats"]
    } == {
        6: ("cosmetic", True),  # written out with the constant
        30: ("gameplay", False),
        74: ("economy", True),  # the constant went and a value came
        79: ("cosmetic", False),
    }


@pytest.mark.parametrize(
    "old, new, expected",
    [
        ([], [[6, 15]], ["cosmetic"]),
        ([[74, 0]], [], ["cosmetic"]),
        ([[74, 0]], [[74, 7]], ["economy", "cosmetic"]),
        ([[74, 5]], [[74, 7]], ["economy"]),
        ([], [[74, 7]], ["economy"]),
    ],
)
def test_the_relevance_of_a_diff_counts_a_housekeeping_value_as_cosmetic(
    old, new, expected
):
    rules = parse_relevance(HOUSEKEEPING)
    tagged = with_relevance(
        diff_parts({"stats": old}, {"stats": new}), rules, None, None
    )

    assert relevance_names(diff_relevance(tagged)) == expected


def effect(spell_id, stat):
    return {
        "spell_id": spell_id,
        "target": 2,
        "tick_count": 1,
        "tick_interval": 0,
        "params": {"Stat": stat},
        "criteria": [],
        "description": f"{spell_id} on {stat}",
    }


def event(number, *effects):
    return {"event": number, "effects": list(effects)}


def effects_relevance(old, new):
    """The tagged effects entries of the diff of two effects parts, and the
    relevance of the change."""
    rules = parse_relevance(RELEVANCE)
    tagged = with_relevance(
        diff_parts({"effects": old}, {"effects": new}), rules, old, new
    )
    return tagged["effects"], relevance_names(diff_relevance(tagged))


USE, WEAR = 0, 14
HEALTH, SENSE, TEXT_EFFECT = effect(53045, 1), effect(53045, 20), effect(53057, 0)


def test_an_effect_moved_to_another_event_has_the_class_of_its_type():
    # 15.7.0, item 251755: Modify MaxHealth leaves Use and joins Wear
    entries, relevance = effects_relevance(
        [event(USE, HEALTH), event(WEAR, SENSE)], [event(WEAR, HEALTH, SENSE)]
    )

    assert relevance == ["gameplay"]
    assert [(e["event"], e["change"], e["relevance"]) for e in entries] == [
        (USE, "removed", None),
        (WEAR, "changed", None),
    ]
    assert [e["relevance"] for e in entries[0]["removed"]] == ["gameplay"]
    assert [e["relevance"] for e in entries[1]["added"]] == ["gameplay"]


def test_an_effect_moved_out_of_an_event_that_stays_has_the_class_of_its_type():
    _, relevance = effects_relevance(
        [event(USE, HEALTH, SENSE)], [event(USE, SENSE), event(WEAR, HEALTH)]
    )

    assert relevance == ["gameplay"]


def test_a_moved_effect_counts_under_its_own_class_only():
    entries, relevance = effects_relevance(
        [event(USE, HEALTH, TEXT_EFFECT), event(WEAR, SENSE)],
        [event(USE, HEALTH), event(WEAR, SENSE, TEXT_EFFECT)],
    )

    assert relevance == ["cosmetic"]
    assert [e["relevance"] for e in entries[0]["removed"]] == ["cosmetic"]


def test_an_event_under_a_new_number_is_the_class_of_event():
    entries, relevance = effects_relevance(
        [event(WEAR, HEALTH, SENSE)], [event(USE, HEALTH, SENSE)]
    )

    assert relevance == ["cosmetic"]
    assert [(e["change"], e["relevance"]) for e in entries] == [
        ("renumbered", "cosmetic")
    ]


def test_events_that_trade_their_effects_are_renumbered_events():
    entries, relevance = effects_relevance(
        [event(USE, HEALTH), event(WEAR, SENSE)],
        [event(USE, SENSE), event(WEAR, HEALTH)],
    )

    assert relevance == ["cosmetic"]
    assert {e["relevance"] for e in entries} == {"cosmetic"}
    assert {
        effect["relevance"] for e in entries for effect in e["added"] + e["removed"]
    } == {"cosmetic"}


def test_a_renumbered_event_adds_nothing_where_an_effect_also_changed():
    entries, relevance = effects_relevance(
        [event(WEAR, HEALTH), event(1, SENSE)],
        [event(USE, HEALTH), event(1, effect(53045, 21))],
    )

    assert relevance == ["gameplay"]
    assert [(e["change"], e["relevance"]) for e in entries] == [
        ("renumbered", None),
        ("changed", None),
    ]


def test_an_empty_event_that_comes_is_the_class_of_event():
    entries, relevance = effects_relevance(
        [event(USE, HEALTH)], [event(USE, HEALTH), event(WEAR)]
    )

    assert relevance == ["cosmetic"]
    assert [(e["change"], e["relevance"]) for e in entries] == [("added", "cosmetic")]


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


def test_a_note_accounts_for_its_part_of_a_change_that_also_differs_otherwise():
    renumbered, lowered = parse_notes(NOTES).notes

    # the event and what comes with it, not the requirement
    assert renumbered.accounts_for([RENUMBERED, ICON, LOWERED]) == [True, True, False]
    assert lowered.accounts_for([RENUMBERED, ICON, LOWERED]) == [False, False, True]


def test_a_note_that_is_not_partial_accounts_for_whole_changes_only():
    whole = parse_notes(NOTES.replace("]\nalongside", "]\npartial = false\nalongside"))
    renumbered = whole.notes[0]

    assert renumbered.accounts_for([RENUMBERED, ICON]) == [True, True]
    assert renumbered.explains_change([RENUMBERED, ICON])
    assert renumbered.accounts_for([RENUMBERED, ICON, LOWERED]) == [False] * 3
    with pytest.raises(RulesError, match="partial is true or false"):
        parse_notes(NOTES.replace("]\nalongside", "]\npartial = 0\nalongside"))


def test_a_note_accounts_for_nothing_where_its_event_did_not_happen():
    renumbered, _ = parse_notes(NOTES).notes

    # an icon comes alongside a renumbering, but nothing was renumbered here
    assert renumbered.accounts_for([ICON, LOWERED]) == [False, False]
    assert renumbered.accounts_for([]) == []


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


def test_a_text_pattern_must_match_the_whole_text():
    renamed = parse_notes("""
[[note]]
build = "b"
title = "Renamed"
explains = [{ path = "name", old = "Old .*", new = ".* tool" }]
""").notes[0]

    assert renamed.explains_change([Transition("text", "name", "Old saw", "A tool")])
    # the pattern occurs in the text, but is not all of it
    assert not renamed.explains_change(
        [Transition("text", "name", "Very Old saw", "A tool")]
    )
    assert not renamed.explains_change(
        [Transition("text", "name", "Old saw", "A tool, new")]
    )


def test_the_live_retargeting_note_is_the_one_uniform_event():
    (note,) = read_rules().notes.of_build("ao-18-8-62-ep1")
    event = Transition("effects", "effect:53045:target", 2, 3)

    assert note.explains_change([event, event])
    # any other retargeting is a change of its own
    for other in (
        Transition("effects", "effect:53045:target", 3, 2),
        Transition("effects", "effect:53045:target", 2, 1),
        Transition("effects", "effect:53002:target", 2, 3),
    ):
        assert not note.explains_change([other])
        assert not note.explains_change([event, other])
    assert not note.explains_change(
        [event, Transition("effects", "effect:53045:spell_params.Amount", 5, 6)]
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
