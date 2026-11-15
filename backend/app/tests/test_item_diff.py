"""
Tests for the field-level diff of two item revisions (app/core/item_diff.py).

Every test diffs small hand-written part documents, shaped as
app/core/parts.py stores them.
"""

import pytest

from app.core.item_diff import (
    Transition,
    diff_actions,
    diff_atkdef,
    diff_criteria,
    diff_effects,
    diff_misc,
    diff_parts,
    diff_stats,
    diff_text,
    is_empty,
    transitions,
)


def parts_diff(**changed):
    """A diff with these parts changed and every other part unchanged."""
    return {**diff_parts({}, {}), **changed}


def effect(spell_id=53045, target=2, criteria=(), ticks=(1, 0), **params):
    return {
        "spell_id": spell_id,
        "target": target,
        "tick_count": ticks[0],
        "tick_interval": ticks[1],
        "params": params,
        "criteria": [list(c) for c in criteria],
        "description": f"effect {spell_id} {sorted(params.items())}",
    }


def modify(stat, amount, **extra):
    return effect(Stat=stat, Amount=amount, **extra)


def event(number, *effects):
    return {"event": number, "effects": list(effects)}


def ops(changes):
    """A criteria diff as ``[(op, old, new), ...]``."""
    return [(c["op"], c["old"], c["new"]) for c in changes]


# ---------------------------------------------------------------------------
# Text and misc
# ---------------------------------------------------------------------------


def test_text_reports_the_fields_that_differ_with_old_and_new():
    old = {"name": "Wrench", "description": "A tool."}
    new = {"name": "Spanner", "description": "A tool."}

    assert diff_text(old, new) == [{"field": "name", "old": "Wrench", "new": "Spanner"}]
    assert diff_text(old, old) == []


def test_misc_reports_each_field_and_a_part_that_appears():
    old = {"static_instance": [5], "shop": {"a": 1}}
    new = {
        "static_instance": [6],
        "shop": {"a": 1},
        "animation_mesh": {"mesh": [12, 7]},
    }

    assert diff_misc(old, new) == [
        {"field": "static_instance", "old": [5], "new": [6]},
        {"field": "animation_mesh", "old": None, "new": {"mesh": [12, 7]}},
    ]
    assert diff_misc(None, {"static_instance": [1]}) == [
        {"field": "static_instance", "old": None, "new": [1]}
    ]


# ---------------------------------------------------------------------------
# Stats and attack/defense
# ---------------------------------------------------------------------------


def test_stats_are_added_removed_and_changed_in_stat_order():
    old = [[2, 10], [54, 100], [74, 500]]
    new = [[12, 7], [54, 120], [74, 500]]

    assert diff_stats(old, new) == [
        {"stat": 2, "change": "removed", "old": 10, "new": None},
        {"stat": 12, "change": "added", "old": None, "new": 7},
        {"stat": 54, "change": "changed", "old": 100, "new": 120},
    ]


def test_reordered_stats_are_no_change():
    assert diff_stats([[2, 10], [54, 100]], [[54, 100], [2, 10]]) == []


def test_a_flag_stat_reports_the_bits_set_and_cleared():
    # stat 30 (Can): bit 1 stays, bit 2 is cleared, bit 8 is set
    (change,) = diff_stats([[30, 0b0011]], [[30, 0b1001]])

    assert change == {
        "stat": 30,
        "change": "changed",
        "old": 3,
        "new": 9,
        "bits_set": [8],
        "bits_cleared": [2],
    }


@pytest.mark.parametrize("stat", [0, 30, 182, 298, 355, 389])
def test_every_flag_stat_reports_bits_and_counts_them_as_transitions(stat):
    (change,) = diff_stats([[stat, 0b0101]], [[stat, 0b0110]])

    assert (change["bits_set"], change["bits_cleared"]) == ([2], [1])
    assert transitions(parts_diff(stats=[change])) == [
        Transition("stats", f"stat:{stat}:bit:2", 0, 1),
        Transition("stats", f"stat:{stat}:bit:1", 1, 0),
    ]


def test_a_stat_that_is_no_flag_reports_values_only():
    (change,) = diff_stats([[354, 5]], [[354, 6]])

    assert "bits_set" not in change and "bits_cleared" not in change


def test_a_flag_stat_with_the_sign_bit_reads_as_unsigned():
    (change,) = diff_stats([[0, 1]], [[0, 1 - 2**31]])

    assert change["bits_set"] == [2**31]
    assert change["bits_cleared"] == []


def test_a_flag_stat_that_is_added_sets_all_its_bits():
    (change,) = diff_stats([], [[298, 6]])

    assert (change["change"], change["bits_set"], change["bits_cleared"]) == (
        "added",
        [2, 4],
        [],
    )


def test_a_stat_held_twice_is_compared_as_a_multiset():
    # 2 keeps the value 5; its other value goes from 7 to 9; a third appears
    changes = diff_stats([[2, 5], [2, 7]], [[2, 5], [2, 9], [2, 11]])

    assert changes == [
        {"stat": 2, "change": "changed", "old": 7, "new": 9},
        {"stat": 2, "change": "added", "old": None, "new": 11},
    ]


def test_attack_and_defense_skills_change_per_skill_without_flag_bits():
    old = {"attack": [[100, 50], [112, 50]], "defense": [[152, 100]]}
    new = {"attack": [[112, 100]], "defense": [[152, 100], [30, 3]]}

    assert diff_atkdef(old, new) == {
        "attack": [
            {"stat": 100, "change": "removed", "old": 50, "new": None},
            {"stat": 112, "change": "changed", "old": 50, "new": 100},
        ],
        "defense": [{"stat": 30, "change": "added", "old": None, "new": 3}],
    }
    assert diff_atkdef(None, None) == {"attack": [], "defense": []}


# ---------------------------------------------------------------------------
# Criteria and actions
# ---------------------------------------------------------------------------


def test_one_criterion_inserted_in_the_middle_is_one_addition():
    old = [[112, 50, 2], [54, 10, 2], [0, 0, 4]]
    new = [[112, 50, 2], [60, 4, 0], [54, 10, 2], [0, 0, 4]]

    assert ops(diff_criteria(old, new)) == [
        ("same", [112, 50, 2], [112, 50, 2]),
        ("added", None, [60, 4, 0]),
        ("same", [54, 10, 2], [54, 10, 2]),
        ("same", [0, 0, 4], [0, 0, 4]),
    ]


def test_a_requirement_whose_value_moved_is_changed_in_place():
    old = [[112, 50, 2], [54, 10, 2]]
    new = [[112, 75, 2], [54, 10, 2]]

    assert ops(diff_criteria(old, new)) == [
        ("changed", [112, 50, 2], [112, 75, 2]),
        ("same", [54, 10, 2], [54, 10, 2]),
    ]


def test_a_requirement_on_another_stat_is_a_removal_and_an_addition():
    assert ops(diff_criteria([[112, 50, 2]], [[113, 50, 2]])) == [
        ("removed", [112, 50, 2], None),
        ("added", None, [113, 50, 2]),
    ]


def test_a_logical_operator_never_becomes_a_requirement():
    # 14.8.0, item 164512: a list of requirements joined by AND replaced by
    # one condition on stat 0
    old = [[274, 4, 24], [112, 851, 2], [0, 0, 4], [158, 851, 2], [0, 0, 4]]
    new = [[0, 2, 88]]

    assert ops(diff_criteria(old, new)) == [
        ("removed", [274, 4, 24], None),
        ("removed", [112, 851, 2], None),
        ("removed", [0, 0, 4], None),
        ("removed", [158, 851, 2], None),
        ("removed", [0, 0, 4], None),
        ("added", None, [0, 2, 88]),
    ]


def test_a_requirement_on_stat_0_never_becomes_a_logical_operator():
    assert ops(diff_criteria([[0, 64, 22]], [[0, 0, 4]])) == [
        ("removed", [0, 64, 22], None),
        ("added", None, [0, 0, 4]),
    ]


def test_a_logical_operator_replaced_by_another_is_changed_in_place():
    old = [[112, 50, 2], [54, 10, 2], [0, 0, 4]]
    new = [[112, 50, 2], [54, 10, 2], [0, 0, 3]]

    assert ops(diff_criteria(old, new))[2:] == [("changed", [0, 0, 4], [0, 0, 3])]


def test_a_condition_replaced_by_another_is_changed_in_place():
    # the same condition with another value; on target (18) to on fighting
    # target (110), as 189 nanos of 15.0.x
    assert ops(diff_criteria([[0, 2, 88]], [[0, 3, 88]])) == [
        ("changed", [0, 2, 88], [0, 3, 88])
    ]
    assert ops(diff_criteria([[0, 0, 18]], [[0, 0, 110]])) == [
        ("changed", [0, 0, 18], [0, 0, 110])
    ]


def test_a_condition_never_becomes_a_requirement_or_a_logical_operator():
    # all three leave value1 at 0
    assert ops(diff_criteria([[0, 0, 45]], [[0, 64, 22]])) == [
        ("removed", [0, 0, 45], None),
        ("added", None, [0, 64, 22]),
    ]
    assert ops(diff_criteria([[0, 0, 45]], [[0, 0, 42]])) == [
        ("removed", [0, 0, 45], None),
        ("added", None, [0, 0, 42]),
    ]


def test_a_requirement_whose_operator_changed_is_changed_in_place():
    assert ops(diff_criteria([[112, 50, 2]], [[112, 50, 1]])) == [
        ("changed", [112, 50, 2], [112, 50, 1])
    ]


def test_reordered_criteria_show_what_moved_and_keep_the_rest():
    old = [[112, 50, 2], [54, 10, 2], [60, 4, 0]]
    new = [[54, 10, 2], [60, 4, 0], [112, 50, 2]]

    assert ops(diff_criteria(old, new)) == [
        ("removed", [112, 50, 2], None),
        ("same", [54, 10, 2], [54, 10, 2]),
        ("same", [60, 4, 0], [60, 4, 0]),
        ("added", None, [112, 50, 2]),
    ]


def test_actions_report_added_removed_and_changed_actions_only():
    old = [
        {"action": 3, "criteria": [[54, 10, 2]]},
        {"action": 6, "criteria": [[112, 50, 2]]},
        {"action": 8, "criteria": []},
    ]
    new = [
        {"action": 6, "criteria": [[112, 60, 2]]},
        {"action": 8, "criteria": []},
        {"action": 9, "criteria": [[60, 4, 0]]},
    ]

    changes = diff_actions(old, new)

    assert [(c["action"], c["change"]) for c in changes] == [
        (3, "removed"),
        (6, "changed"),
        (9, "added"),
    ]
    assert ops(changes[0]["criteria"]) == [("removed", [54, 10, 2], None)]
    assert ops(changes[1]["criteria"]) == [("changed", [112, 50, 2], [112, 60, 2])]
    assert ops(changes[2]["criteria"]) == [("added", None, [60, 4, 0])]


def test_reordered_actions_are_no_change():
    actions = [
        {"action": 3, "criteria": [[54, 10, 2]]},
        {"action": 6, "criteria": [[112, 50, 2]]},
    ]

    assert diff_actions(actions, actions[::-1]) == []


# ---------------------------------------------------------------------------
# Effects
# ---------------------------------------------------------------------------


def test_reordered_effects_are_no_change():
    effects = [modify(16, 5), modify(17, 5), effect(53019, NanoID=900)]

    assert diff_effects([event(14, *effects)], [event(14, *effects[::-1])]) == []


def test_a_new_description_alone_is_no_change():
    old = modify(16, 5)
    new = {**old, "description": "Modify Strength 5"}

    assert diff_effects([event(14, old)], [event(14, new)]) == []


def test_a_changed_effect_lists_the_parameters_that_differ():
    old = [event(14, modify(16, 5), modify(17, 5))]
    new = [event(14, modify(16, 8), modify(17, 5))]

    (change,) = diff_effects(old, new)

    assert (change["event"], change["change"]) == (14, "changed")
    assert change["added"] == change["removed"] == []
    (pair,) = change["changed"]
    assert pair["old"]["params"] == {"Stat": 16, "Amount": 5}
    assert pair["new"]["params"] == {"Stat": 16, "Amount": 8}
    assert pair["fields"] == [{"field": "spell_params.Amount", "old": 5, "new": 8}]
    assert pair["criteria"] is None


def test_a_modifier_replaced_by_one_of_another_stat_is_removed_and_added():
    """The prototype's weakness: these two were paired as "Stat 16 -> 17"."""
    old = [event(14, modify(16, 5), modify(20, 3))]
    new = [event(14, modify(17, 5), modify(20, 3))]

    (change,) = diff_effects(old, new)

    assert change["changed"] == []
    assert [e["params"]["Stat"] for e in change["removed"]] == [16]
    assert [e["params"]["Stat"] for e in change["added"]] == [17]


def test_effects_of_another_type_or_another_nano_are_never_paired():
    old = [event(14, effect(53019, NanoID=900), effect(53033, Skill=122, Duration=5))]
    new = [event(14, effect(53051, NanoID=900), effect(53033, Skill=129, Duration=5))]

    (change,) = diff_effects(old, new)

    assert change["changed"] == []
    assert len(change["removed"]) == len(change["added"]) == 2


@pytest.mark.parametrize(
    "subject", ["Stat", "Skill", "NanoID", "NanoStrain", "Item", "PerkID"]
)
def test_effects_acting_on_another_subject_are_never_paired(subject):
    old = [event(14, effect(53100, Duration=5, **{subject: 1}))]
    new = [event(14, effect(53100, Duration=9, **{subject: 2}))]

    (change,) = diff_effects(old, new)

    assert change["changed"] == []
    assert [e["params"][subject] for e in change["removed"]] == [1]
    assert [e["params"][subject] for e in change["added"]] == [2]

    (same,) = diff_effects(old, [event(14, effect(53100, Duration=9, **{subject: 1}))])
    assert [pair["fields"] for pair in same["changed"]] == [
        [{"field": "spell_params.Duration", "old": 5, "new": 9}]
    ]


def test_a_retargeted_effect_is_paired_and_reports_its_target():
    old = [event(14, modify(16, 5, target=2))]
    new = [event(14, modify(16, 5, target=3))]

    (pair,) = diff_effects(old, new)[0]["changed"]

    assert pair["fields"] == [{"field": "target", "old": 2, "new": 3}]


def test_an_effect_keeps_its_target_when_one_of_two_candidates_does():
    # two modifiers of stat 16, on the user (2) and on the target (3); only
    # the one on the target changes its amount
    old = [event(14, modify(16, 5, target=2), modify(16, 5, target=3))]
    new = [event(14, modify(16, 5, target=2), modify(16, 9, target=3))]

    (pair,) = diff_effects(old, new)[0]["changed"]

    assert (pair["old"]["target"], pair["new"]["target"]) == (3, 3)
    assert pair["fields"] == [{"field": "spell_params.Amount", "old": 5, "new": 9}]


def test_among_several_candidates_the_closest_effects_pair_first():
    # two modifiers of stat 16 under different criteria; each changes its
    # amount, and must stay paired with the effect under its own criteria
    low, high = [[54, 100, 0]], [[54, 200, 2]]
    old = [event(14, modify(16, 5, criteria=low), modify(16, 10, criteria=high))]
    new = [event(14, modify(16, 12, criteria=high), modify(16, 6, criteria=low))]

    pairs = diff_effects(old, new)[0]["changed"]

    assert sorted(
        (p["old"]["params"]["Amount"], p["new"]["params"]["Amount"]) for p in pairs
    ) == [(5, 6), (10, 12)]
    assert all(p["criteria"] is None for p in pairs)


def test_a_changed_effect_carries_the_sequence_diff_of_its_criteria():
    old = [event(14, modify(16, 5, criteria=[[54, 100, 2]]))]
    new = [event(14, modify(16, 5, criteria=[[54, 100, 2], [60, 4, 0]]))]

    (pair,) = diff_effects(old, new)[0]["changed"]

    assert pair["fields"] == []
    assert ops(pair["criteria"]) == [
        ("same", [54, 100, 2], [54, 100, 2]),
        ("added", None, [60, 4, 0]),
    ]


def test_an_effect_repeated_in_an_event_counts_as_often_as_it_appears():
    old = [event(14, modify(16, 5), modify(16, 5))]
    new = [event(14, modify(16, 5))]

    (change,) = diff_effects(old, new)

    assert change["changed"] == [] and change["added"] == []
    assert len(change["removed"]) == 1


def test_an_event_with_the_same_effects_under_a_new_number_is_renumbered():
    effects = [modify(16, 5), modify(17, 5)]
    old = [event(14, *effects), event(2, effect(53019, NanoID=900))]
    new = [event(0, *effects[::-1]), event(2, effect(53019, NanoID=900))]

    (change,) = diff_effects(old, new)

    assert change == {
        "event": 0,
        "change": "renumbered",
        "old_event": 14,
        "added": [],
        "removed": [],
        "changed": [],
    }


def test_events_added_and_removed_list_their_effects():
    old = [event(2, modify(16, 5))]
    new = [event(14, modify(17, 9))]

    removed, added = diff_effects(old, new)

    assert (removed["event"], removed["change"]) == (2, "removed")
    assert [e["params"] for e in removed["removed"]] == [{"Stat": 16, "Amount": 5}]
    assert (added["event"], added["change"]) == (14, "added")
    assert [e["params"] for e in added["added"]] == [{"Stat": 17, "Amount": 9}]


def test_effects_without_a_subject_pair_by_type():
    old = [event(2, effect(53016, Playfield=100, X=1, Y=2, Z=3))]
    new = [event(2, effect(53016, Playfield=100, X=1, Y=2, Z=9))]

    (pair,) = diff_effects(old, new)[0]["changed"]

    assert pair["fields"] == [{"field": "spell_params.Z", "old": 3, "new": 9}]


def test_output_order_does_not_depend_on_input_order():
    old = [event(14, modify(16, 5), modify(17, 5), modify(18, 5))]
    new = [event(14, modify(16, 6), modify(17, 6), modify(19, 5))]
    shuffled_old = [event(14, *old[0]["effects"][::-1])]
    shuffled_new = [event(14, *new[0]["effects"][::-1])]

    assert diff_effects(old, new) == diff_effects(shuffled_old, shuffled_new)


# ---------------------------------------------------------------------------
# Whole item and transitions
# ---------------------------------------------------------------------------


def parts(**documents):
    base = {
        "text": {"name": "Wrench", "description": ""},
        "stats": [[54, 100]],
        "effects": None,
        "actions": None,
        "atkdef": None,
        "misc": None,
    }
    return {**base, **documents}


def test_identical_revisions_have_an_empty_diff():
    document = parts(effects=[event(14, modify(16, 5))])

    assert is_empty(diff_parts(document, document))


def test_the_diff_of_an_item_has_every_part():
    old = parts(atkdef={"attack": [[100, 50]], "defense": []})
    new = parts(
        text={"name": "Spanner", "description": ""},
        atkdef={"attack": [[100, 60]], "defense": []},
        misc={"static_instance": [9]},
    )

    diff = diff_parts(old, new)

    assert set(diff) == {
        "text",
        "stats",
        "effects",
        "actions",
        "attack",
        "defense",
        "misc",
    }
    assert [c["field"] for c in diff["text"]] == ["name"]
    assert diff["attack"] == [{"stat": 100, "change": "changed", "old": 50, "new": 60}]
    assert diff["stats"] == diff["effects"] == diff["actions"] == diff["defense"] == []
    assert [c["field"] for c in diff["misc"]] == ["static_instance"]


def test_transitions_name_the_field_and_drop_what_is_particular_to_the_item():
    old = parts(
        text={"name": "A Shining Wrench", "description": ""},
        stats=[[54, 100], [30, 1], [79, 12712]],
        effects=[event(14, effect(53089, NanoID=900, Chance=60), modify(16, 5))],
        actions=[{"action": 6, "criteria": [[112, 50, 2]]}],
        misc={"static_instance": [5]},
    )
    new = parts(
        text={"name": "A Shining Spanner", "description": ""},
        stats=[[54, 100], [30, 9], [79, 12711]],
        effects=[event(14, effect(53089, NanoID=900, Chance=100), modify(17, 5))],
        actions=[{"action": 6, "criteria": [[112, 60, 2]]}],
        misc={"static_instance": [6]},
    )

    found = transitions(diff_parts(old, new))

    assert sorted(found, key=repr) == sorted(
        [
            Transition("text", "name", "Wrench", "Spanner"),
            Transition("stats", "stat:30:bit:8", 0, 1),
            Transition("stats", "stat:79", 12712, 12711),
            Transition("effects", "effect:53089:spell_params.Chance", 60, 100),
            Transition("effects", "effect:53045", 16, None),
            Transition("effects", "effect:53045", None, 17),
            Transition("actions", "action:6:criterion", (112, 50, 2), (112, 60, 2)),
            Transition("misc", "static_instance", None, None),
        ],
        key=repr,
    )


def test_transitions_report_a_renumbered_event_and_whole_actions():
    old = parts(effects=[event(14, modify(16, 5))])
    new = parts(
        effects=[event(0, modify(16, 5))],
        actions=[{"action": 3, "criteria": [[54, 10, 2]]}],
    )

    assert transitions(diff_parts(old, new)) == [
        Transition("actions", "action:3", None, "added"),
        Transition("effects", "event", 14, 0),
    ]


def test_transitions_tell_a_removed_action_from_an_added_one():
    use = [{"action": 3, "criteria": [[54, 10, 2]]}]

    assert transitions(diff_parts(parts(actions=use), parts())) == [
        Transition("actions", "action:3", "removed", None)
    ]
    assert transitions(diff_parts(parts(), parts(actions=use))) == [
        Transition("actions", "action:3", None, "added")
    ]


def test_transitions_name_the_subject_of_an_effect_on_the_side_it_was_on():
    stun = effect(53122)  # acts on no stat, skill, nano or item
    old = parts(effects=[event(14, modify(16, 5), stun)])
    new = parts(effects=[event(14, effect(53121))])

    assert sorted(transitions(diff_parts(old, new)), key=repr) == sorted(
        [
            Transition("effects", "effect:53045", 16, None),
            Transition("effects", "effect:53122", "none", None),
            Transition("effects", "effect:53121", None, "none"),
        ],
        key=repr,
    )


def test_a_text_transition_keeps_up_to_80_letters_of_difference():
    def renamed(letters):
        old = parts(text={"name": "Saw", "description": "A tool."})
        new = parts(text={"name": "Saw", "description": "A " + "x" * letters})
        return transitions(diff_parts(old, new))

    assert renamed(80) == [Transition("text", "description", "tool.", "x" * 80)]
    assert renamed(81) == [Transition("text", "description", None, None)]


def test_events_with_the_same_effects_are_renumbered_lowest_numbers_first():
    old = [event(5, modify(16, 5)), event(6, modify(16, 5))]
    new = [event(1, modify(16, 5)), event(2, modify(16, 5))]

    assert [
        (e["old_event"], e["event"], e["change"]) for e in diff_effects(old, new)
    ] == [(5, 1, "renumbered"), (6, 2, "renumbered")]


def test_full_text_transitions_carry_the_whole_texts():
    old = parts(text={"name": "A Shining Wrench", "description": ""})
    new = parts(text={"name": "Wrench, Shiny", "description": ""})

    assert transitions(diff_parts(old, new), full_text=True) == [
        Transition("text", "name", "A Shining Wrench", "Wrench, Shiny")
    ]
