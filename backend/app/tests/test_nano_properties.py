"""
Tests for the Use-criteria evaluator behind nano professions and levels.

The criteria are real Use actions from the game data (value1, value2, operator
in order_index order), so each case pins how one shape of expression reads.
"""

from app.core.nano_properties import (
    castable_professions,
    derive,
    evaluate,
    minimum_level,
    profession_id,
    profession_names,
    school_id,
    school_name,
)

AND = (0, 0, 4)
OR = (0, 0, 3)
NOT = (0, 0, 42)
ON_TARGET = (0, 0, 18)
ON_USER = (0, 0, 26)

# Izgimmer's Ultimatum: Nano-Technician, Level > 219, MC skill, states
IZGIMMERS_ULTIMATUM = [
    (60, 11, 0),
    (54, 219, 2),
    AND,
    (130, 2045, 2),
    AND,
    (389, 2, 22),
    AND,
    (182, 8, 22),
    AND,
    (355, 8, 22),
    AND,
]

# Composite Attribute Boost: skills only
COMPOSITE_ATTRIBUTE_BOOST = [(129, 29, 2), (122, 29, 2), AND]

# False Profession: Doctor, an Agent nano: VisualProfession is Agent or Doctor,
# and Profession is Agent
FALSE_PROFESSION_DOCTOR = [
    (368, 5, 0),
    (368, 10, 0),
    OR,
    (60, 5, 0),
    AND,
    (129, 154, 2),
    AND,
]

# Fervor of the Zealot: Shade, Keeper, Martial Artist or Enforcer
FERVOR_OF_THE_ZEALOT = [
    (60, 15, 0),
    (60, 14, 0),
    OR,
    (60, 2, 0),
    OR,
    (60, 9, 0),
    OR,
    (129, 949, 2),
    AND,
]

# Leet Friend: an Adventurer of level 25+ casting on a target below level 2.
# The OnTarget modifier covers every criterion after it.
LEET_FRIEND = [
    (60, 6, 0),
    (128, 162, 2),
    AND,
    (54, 24, 2),
    AND,
    (359, 17655, 0),
    AND,
    ON_TARGET,
    (359, 17655, 0),
    AND,
    (54, 2, 1),
    AND,
    (21, 300, 1),
    AND,
]

# Spirit Siphon: target criteria first, then OnUser switches back to the caster
SPIRIT_SIPHON = [
    ON_TARGET,
    (525, 21, 1),
    (0, 134217728, 107),
    AND,
    ON_USER,
    (389, 2, 22),
    AND,
    (60, 15, 0),
    AND,
]

# Fists of Fire: a Martial Artist casting on a Martial Artist
FISTS_OF_FIRE = [
    (122, 320, 2),
    (128, 320, 2),
    AND,
    (368, 2, 0),
    AND,
    ON_TARGET,
    (368, 2, 0),
    AND,
]

# Gravity Shift - Block: NOT (Engineer or Trader or NT or a function check)
GRAVITY_SHIFT_BLOCK = [
    (60, 3, 0),
    (60, 7, 0),
    OR,
    (60, 11, 0),
    OR,
    (0, 285181, 91),
    OR,
    NOT,
    (589, 7015, 0),
    AND,
]


def test_single_profession_and_level():
    assert castable_professions(IZGIMMERS_ULTIMATUM) == [11]
    assert minimum_level(IZGIMMERS_ULTIMATUM) == 220


def test_no_profession_or_level_criteria_is_unrestricted():
    assert castable_professions(COMPOSITE_ATTRIBUTE_BOOST) == []
    assert minimum_level(COMPOSITE_ATTRIBUTE_BOOST) == 1


def test_or_of_professions_lists_each():
    assert castable_professions(FERVOR_OF_THE_ZEALOT) == [2, 9, 14, 15]


def test_visual_profession_or_does_not_widen_profession_and():
    # The Doctor alternative is for VisualProfession; Profession must be Agent
    assert castable_professions(FALSE_PROFESSION_DOCTOR) == [5]


def test_negated_professions_are_excluded():
    assert castable_professions(GRAVITY_SHIFT_BLOCK) == [
        1,
        2,
        4,
        5,
        6,
        8,
        9,
        10,
        12,
        14,
        15,
    ]


def test_on_target_criteria_do_not_restrict_the_caster():
    assert castable_professions(FISTS_OF_FIRE) == [2]
    assert castable_professions(LEET_FRIEND) == [6]
    # Level < 2 is the target's; the caster needs Level > 24
    assert minimum_level(LEET_FRIEND) == 25


def test_disguise_criteria_leave_visual_profession_unknown():
    # True Profession (PRK): an Agent whose VisualProfession isn't Agent
    assert castable_professions([(60, 5, 0), (368, 5, 24), AND]) == [5]


def test_on_user_returns_to_the_caster():
    assert castable_professions(SPIRIT_SIPHON) == [15]


def test_level_less_than_still_starts_at_one():
    assert minimum_level([(54, 15, 1)]) == 1


def test_contradictory_level_has_no_minimum():
    assert minimum_level([(54, 100, 2), (54, 50, 1), AND]) is None


def test_malformed_expression_is_unknown():
    assert evaluate([AND], {}) == (None, False)
    # Unknown rules nothing out
    assert castable_professions([AND]) == []
    assert minimum_level([AND]) == 1


def test_derive_without_use_action():
    assert derive(2, None) == (2, [], None)
    assert derive(0, None) == (None, [], None)
    assert derive(999, []) == (None, [], 1)


def test_name_lookups():
    assert school_name(1) == "Combat"
    assert school_name(None) is None
    assert school_id("medical") == 2
    assert school_id("5") == 5
    assert school_id("Matter Creation") is None
    assert profession_id("Nano-Technician") == 11
    assert profession_id("doctor") == 10
    assert profession_id("15") == 15
    assert profession_id("13") is None  # Monster
    assert profession_names([10, 13, 11]) == ["Doctor", "Nano-Technician"]
