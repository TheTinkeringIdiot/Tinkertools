"""
Tests for InterpolationService: an item at a quality level between the QL
variants a build holds of it.

The service reads the content-addressed store. Each test builds the variants
it needs in a throwaway store (the ``store`` fixture).
"""

import os

import pytest

from app.models.interpolated_item import InterpolatedItem, blend
from app.services.interpolation import InterpolationService
from app.tests.fixtures.store_fixtures import criterion, item, modify, nano

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

STRENGTH = 16
STAMINA = 17  # interpolated
ICON = 79  # not interpolated
SLOT = 298
PISTOL = 112  # interpolated when required
PROFESSION = 60  # never interpolated
RUN_SPEED = 156


def armor(aoid, ql, bonus, requirement, name="Combat Armor", extra_stats=()):
    """One QL variant of an armor: a stamina stat and an on-wear modifier that
    scale with QL, and a wear requirement that scales with it too."""
    return item(
        aoid,
        name=name,
        ql=ql,
        stats=[(STAMINA, 9 + ql), (ICON, 1000 + ql), (SLOT, 4), *extra_stats],
        SpellData=[
            {
                "Event": 14,
                "Items": [
                    modify(RUN_SPEED, bonus),
                    {**modify(STRENGTH, bonus), "SpellID": 53019},
                ],
            }
        ],
        ActionData={
            "Actions": [
                {
                    "Action": 6,
                    "Criteria": [
                        criterion(PISTOL, requirement, 2),
                        criterion(PROFESSION, 4, 0),
                    ],
                }
            ]
        },
    )


THREE_VARIANTS = [
    armor(201, ql=1, bonus=5, requirement=50, extra_stats=[(212, 7)]),
    armor(202, ql=100, bonus=104, requirement=248),
    armor(203, ql=200, bonus=204, requirement=448),
]


@pytest.fixture
def service(store):
    build = store.add_build("b1", 1, items=THREE_VARIANTS)
    return InterpolationService(store.db, build)


def stats_of(interpolated):
    return {entry["stat"]: entry["value"] for entry in interpolated.stats}


def spell(interpolated, spell_id):
    (event,) = interpolated.spell_data
    return next(s for s in event.spells if s.spell_id == spell_id)


# ---------------------------------------------------------------------------
# Between two variants
# ---------------------------------------------------------------------------


def test_an_item_between_two_variants_is_interpolated_from_the_lower(service):
    interpolated = service.interpolate_item(201, 50)

    assert interpolated.aoid == 201
    assert (interpolated.ql, interpolated.target_ql) == (50, 50)
    assert (interpolated.low_ql, interpolated.high_ql) == (1, 100)
    assert (interpolated.ql_delta, interpolated.ql_delta_full) == (49, 99)
    assert interpolated.interpolating is True


def test_interpolated_stats_scale_and_other_stats_keep_the_low_value(service):
    stats = stats_of(service.interpolate_item(201, 50))

    assert stats[54] == 50
    assert stats[STAMINA] == 59
    assert stats[ICON] == 1001
    assert stats[SLOT] == 4


def test_a_stat_the_higher_variant_lacks_is_dropped(service):
    assert 212 in stats_of(service.interpolate_item(201, 1))
    assert 212 not in stats_of(service.interpolate_item(201, 50))


def test_a_stat_an_item_holds_twice_is_interpolated_on_its_highest_values(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            armor(201, 1, 5, 50, extra_stats=[(2, 15), (2, 100)]),
            armor(202, 101, 104, 248, extra_stats=[(2, 900), (2, 15)]),
        ],
    )
    service = InterpolationService(store.db, build)

    at_variant = service.interpolate_item(201, 1)
    between = service.interpolate_item(201, 51)

    assert sorted(s["value"] for s in at_variant.stats if s["stat"] == 2) == [15, 100]
    assert [s["value"] for s in between.stats if s["stat"] == 2] == [500]


def test_modifier_amounts_scale_for_interpolatable_effect_types_only(service):
    interpolated = service.interpolate_item(201, 50)

    scaled, fixed = spell(interpolated, 53045), spell(interpolated, 53019)
    assert (scaled.spell_params["Stat"], scaled.spell_params["Amount"]) == (
        RUN_SPEED,
        54,
    )
    assert fixed.spell_params["Amount"] == 5
    assert scaled.spell_format == "Modify {Stat} {Amount}"


def test_requirements_scale_for_interpolated_stats_only(service):
    (action,) = service.interpolate_item(201, 50).actions

    assert action.action == 6
    assert action.criteria == [
        {"value1": PISTOL, "value2": 148, "operator": 2},
        {"value1": PROFESSION, "value2": 4, "operator": 0},
    ]


def test_any_variant_names_the_whole_family(service):
    from_low = service.interpolate_item(201, 150)
    from_high = service.interpolate_item(203, 150)

    assert from_low == from_high
    assert (from_low.aoid, from_low.low_ql, from_low.high_ql) == (202, 100, 200)
    assert stats_of(from_low)[STAMINA] == 159


def test_at_a_variants_own_ql_the_item_has_that_variants_values(service):
    interpolated = service.interpolate_item(201, 100)

    assert (interpolated.aoid, interpolated.interpolating) == (202, True)
    assert (interpolated.ql_delta, stats_of(interpolated)[STAMINA]) == (0, 109)
    assert spell(interpolated, 53045).spell_params["Amount"] == 104


# ---------------------------------------------------------------------------
# No interpolation
# ---------------------------------------------------------------------------


def test_above_the_highest_variant_the_item_is_that_variant_at_the_target_ql(service):
    interpolated = service.interpolate_item(201, 300)

    assert (interpolated.aoid, interpolated.ql, interpolated.target_ql) == (
        203,
        300,
        300,
    )
    assert interpolated.interpolating is False
    assert (interpolated.low_ql, interpolated.high_ql) == (200, 200)
    assert stats_of(interpolated)[STAMINA] == 209
    assert stats_of(interpolated)[54] == 200


def test_at_the_lowest_variant_the_item_is_not_interpolated(service):
    interpolated = service.interpolate_item(203, 1)

    assert (interpolated.aoid, interpolated.interpolating) == (201, False)
    assert stats_of(interpolated)[212] == 7


def test_an_item_with_one_variant_is_returned_at_the_target_ql(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            armor(201, ql=1, bonus=5, requirement=50),
            armor(301, ql=100, bonus=9, requirement=90, name="Other Armor"),
        ],
    )

    interpolated = InterpolationService(store.db, build).interpolate_item(201, 80)

    assert (interpolated.aoid, interpolated.ql, interpolated.interpolating) == (
        201,
        80,
        False,
    )
    assert (interpolated.low_ql, interpolated.high_ql) == (1, 1)
    assert stats_of(interpolated)[STAMINA] == 10


def test_items_with_the_same_name_but_another_description_are_not_variants(store):
    other = armor(202, ql=100, bonus=104, requirement=248)
    other["Description"] = "A different thing with the same name."
    build = store.add_build(
        "b1", 1, items=[armor(201, ql=1, bonus=5, requirement=50), other]
    )

    interpolated = InterpolationService(store.db, build).interpolate_item(201, 50)

    assert interpolated.interpolating is False


def test_nanos_are_never_interpolated(store):
    first, second = nano(10), nano(11)
    second["Name"] = first["Name"]
    build = store.add_build("b1", 1, nanos=[first, second])

    interpolated = InterpolationService(store.db, build).interpolate_item(10, 150)

    assert (interpolated.aoid, interpolated.is_nano) == (10, True)
    assert (interpolated.interpolating, interpolated.ql) == (False, 150)


def test_control_points_are_never_interpolated(store):
    name = "Control Point Tower"
    build = store.add_build(
        "b1",
        1,
        items=[
            armor(201, ql=1, bonus=5, requirement=50, name=name),
            armor(202, ql=100, bonus=104, requirement=248, name=name),
        ],
    )

    interpolated = InterpolationService(store.db, build).interpolate_item(202, 50)

    assert (interpolated.aoid, interpolated.interpolating) == (202, False)
    assert stats_of(interpolated)[STAMINA] == 109


def test_an_item_the_build_lacks_is_not_found(service):
    assert service.interpolate_item(999, 50) is None
    assert service.get_interpolation_ranges(999) is None
    assert service.get_interpolation_range(999) is None


def test_variants_are_those_of_the_build_asked(store):
    low = armor(201, ql=1, bonus=5, requirement=50)
    old = store.add_build("old", 1, items=[low])
    new = store.add_build(
        "new", 2, items=[low, armor(202, ql=100, bonus=104, requirement=248)]
    )

    assert (
        InterpolationService(store.db, old).interpolate_item(201, 50).interpolating
        is False
    )
    assert (
        InterpolationService(store.db, new).interpolate_item(201, 50).interpolating
        is True
    )


# ---------------------------------------------------------------------------
# Ranges
# ---------------------------------------------------------------------------


def test_ranges_run_between_consecutive_variants(service):
    assert service.get_interpolation_ranges(202) == [
        {"min_ql": 1, "max_ql": 100, "interpolatable": True, "base_aoid": 201},
        {"min_ql": 100, "max_ql": 200, "interpolatable": True, "base_aoid": 202},
        {"min_ql": 200, "max_ql": 200, "interpolatable": False, "base_aoid": 203},
    ]
    assert service.get_interpolation_range(202) == (1, 200)


def test_a_single_variant_has_one_range_that_cannot_be_interpolated(store):
    build = store.add_build("b1", 1, items=[armor(201, ql=60, bonus=5, requirement=50)])

    ranges = InterpolationService(store.db, build).get_interpolation_ranges(201)

    assert ranges == [
        {"min_ql": 60, "max_ql": 60, "interpolatable": False, "base_aoid": 201}
    ]


def test_two_variants_of_the_same_ql_leave_no_closing_range(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            armor(201, ql=1, bonus=5, requirement=50),
            armor(202, ql=100, bonus=104, requirement=248),
            armor(203, ql=100, bonus=104, requirement=250),
        ],
    )

    ranges = InterpolationService(store.db, build).get_interpolation_ranges(201)

    assert [(r["min_ql"], r["max_ql"], r["base_aoid"]) for r in ranges] == [
        (1, 100, 201),
        (100, 100, 202),
    ]


# ---------------------------------------------------------------------------
# Chains (backend/database/item_chains.toml)
# ---------------------------------------------------------------------------

BELT_SLOTS = 45
TI_100X, TI_200X, B_300X, B_4IX = 36783, 36782, 36777, 36785


def belt(aoid, ql, name, slots, icon, effect=None):
    """A rung of the belt chain: a name, description and icon of its own."""
    return item(
        aoid,
        name=name,
        ql=ql,
        Description=f"About {name}",
        stats=[(ICON, icon), (STAMINA, ql)],
        SpellData=[{"Event": 14, "Items": [effect or modify(BELT_SLOTS, slots)]}],
    )


def shown(interpolated):
    (event,) = interpolated.spell_data
    (slots,) = [s.spell_params["Amount"] for s in event.spells]
    return (
        interpolated.name,
        interpolated.description,
        stats_of(interpolated)[ICON],
        slots,
    )


def test_a_build_with_some_rungs_serves_the_chain_they_make(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            belt(TI_200X, 20, "Ti-200X", 2, 502),
            belt(B_4IX, 80, "4IX", 4, 504),
            belt(900, 50, "Ti-200X", 9, 599),
        ],
    )
    service = InterpolationService(store.db, build)

    assert service.get_interpolation_ranges(B_4IX) == [
        {"min_ql": 20, "max_ql": 80, "interpolatable": True, "base_aoid": TI_200X},
        {"min_ql": 80, "max_ql": 80, "interpolatable": False, "base_aoid": B_4IX},
    ]
    # 2 + 2 * 14 / 60 = 2.47, 2 + 2 * 15 / 60 = 2.5, 2 + 2 * 45 / 60 = 3.5
    assert shown(service.interpolate_item(B_4IX, 34)) == (
        "Ti-200X",
        "About Ti-200X",
        502,
        2,
    )
    # 3 slots, and no rung of this build has 3: still the Ti-200X
    assert shown(service.interpolate_item(B_4IX, 35)) == (
        "Ti-200X",
        "About Ti-200X",
        502,
        3,
    )
    assert shown(service.interpolate_item(TI_200X, 65)) == ("4IX", "About 4IX", 504, 4)
    at_65 = service.interpolate_item(TI_200X, 65)
    assert (at_65.aoid, at_65.interpolating) == (TI_200X, True)
    assert (at_65.low_ql, at_65.high_ql, at_65.ql) == (20, 80, 65)
    assert stats_of(at_65)[STAMINA] == 65


def test_outside_the_span_of_a_chain_the_item_is_its_first_or_last_rung(store):
    build = store.add_build(
        "b1",
        1,
        items=[belt(TI_200X, 20, "Ti-200X", 2, 502), belt(B_300X, 40, "300X", 3, 503)],
    )
    service = InterpolationService(store.db, build)

    below = service.interpolate_item(B_300X, 5)
    above = service.interpolate_item(TI_200X, 90)

    assert shown(below) == ("Ti-200X", "About Ti-200X", 502, 2)
    assert (below.aoid, below.ql, below.interpolating) == (TI_200X, 5, False)
    assert shown(above) == ("300X", "About 300X", 503, 3)
    assert (above.aoid, above.ql, above.interpolating) == (B_300X, 90, False)


def test_a_single_rung_is_an_ordinary_item(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            belt(TI_200X, 20, "Ti-200X", 2, 502),
            belt(901, 60, "Ti-200X", 4, 599),
            belt(902, 40, "300X", 3, 503),
        ],
    )
    service = InterpolationService(store.db, build)

    at_40 = service.interpolate_item(TI_200X, 40)

    assert service.get_interpolation_range(TI_200X) == (20, 60)
    assert shown(at_40) == ("Ti-200X", "About Ti-200X", 502, 3)
    assert (at_40.low_ql, at_40.high_ql) == (20, 60)


def test_a_rung_without_the_key_effect_is_not_part_of_the_chain(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            belt(TI_100X, 1, "Ti-100X", 1, 501),
            belt(TI_200X, 20, "Ti-200X", 0, 502, effect=modify(STAMINA, 7)),
            belt(B_300X, 41, "300X", 3, 503),
        ],
    )
    service = InterpolationService(store.db, build)

    assert service.get_interpolation_range(TI_100X) == (1, 41)
    # 1 + 2 * 29 / 40 = 2.45, 1 + 2 * 30 / 40 = 2.5
    assert shown(service.interpolate_item(TI_100X, 30))[::3] == ("Ti-100X", 2)
    assert shown(service.interpolate_item(TI_100X, 31))[::3] == ("300X", 3)
    assert service.get_interpolation_ranges(TI_200X) == [
        {"min_ql": 20, "max_ql": 20, "interpolatable": False, "base_aoid": TI_200X}
    ]


def test_an_item_that_shares_the_text_of_a_rung_keeps_its_variants(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            belt(B_300X, 40, "300X", 3, 503),
            belt(B_4IX, 80, "4IX", 4, 504),
            belt(903, 60, "4IX", 4, 599),
        ],
    )
    service = InterpolationService(store.db, build)
    service.preload([B_4IX, 903])

    assert service.get_interpolation_ranges(903) == [
        {"min_ql": 60, "max_ql": 80, "interpolatable": True, "base_aoid": 903},
        {"min_ql": 80, "max_ql": 80, "interpolatable": False, "base_aoid": B_4IX},
    ]
    assert shown(service.interpolate_item(903, 70)) == ("4IX", "About 4IX", 599, 4)
    assert service.get_interpolation_range(B_4IX) == (40, 80)
    assert service.interpolate_item(B_4IX, 70).low_ql == 40


def test_a_chain_costs_one_query_more_whatever_the_number_of_rungs_asked(store):
    build = store.add_build(
        "b1",
        1,
        items=[
            belt(TI_100X, 1, "Ti-100X", 1, 501),
            belt(TI_200X, 20, "Ti-200X", 2, 502),
            belt(B_300X, 40, "300X", 3, 503),
            armor(201, ql=1, bonus=5, requirement=50),
            armor(202, ql=100, bonus=104, requirement=248),
        ],
    )

    with store.counting_queries() as ordinary:
        service = InterpolationService(store.db, build)
        service.preload([201])
        service.interpolate_item(201, 50)
    with store.counting_queries() as mixed:
        service = InterpolationService(store.db, build)
        service.preload([201, TI_100X, B_300X])
        service.interpolate_item(201, 50)
        service.interpolate_item(TI_100X, 30)
        service.interpolate_item(B_300X, 10)
        service.interpolate_item(TI_200X, 10)

    assert len(mixed) == len(ordinary) + 1


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def test_preloaded_items_are_interpolated_without_further_queries(store):
    families = [
        armor(aoid, ql=ql, bonus=ql, requirement=ql, name=f"Armor {family}")
        for family in range(20)
        for aoid, ql in ((1000 + family, 1), (2000 + family, 200))
    ]
    build = store.add_build("b1", 1, items=families)
    aoids = [1000 + family for family in range(20)]

    with store.counting_queries() as one:
        single = InterpolationService(store.db, build)
        single.preload(aoids[:1])
        single.interpolate_item(aoids[0], 100)
    with store.counting_queries() as many:
        service = InterpolationService(store.db, build)
        service.preload(aoids)
        results = [service.interpolate_item(aoid, 100) for aoid in aoids]

    assert all(result.interpolating for result in results)
    assert 0 < len(many) == len(one) <= 3


# ---------------------------------------------------------------------------
# The arithmetic
# ---------------------------------------------------------------------------


def between(low_ql, high_ql, target_ql):
    return InterpolatedItem(
        id=1,
        aoid=1,
        name="Thing",
        interpolating=True,
        ql_delta=target_ql - low_ql,
        ql_delta_full=high_ql - low_ql,
    )


@pytest.mark.parametrize(
    "lo_val,hi_val,ql_delta,ql_delta_full,expected",
    [
        (100, 200, 0, 100, 100),
        (100, 200, 50, 100, 150),
        (100, 200, 100, 100, 200),
        (100, 200, 25, 100, 125),
        (200, 100, 50, 100, 150),
        (100, 100, 50, 100, 100),
        (0, 1000, 33, 100, 330),
        (10, 13, 1, 3, 11),
        (10, 13, 2, 3, 12),
        (-100, 100, 50, 100, 0),
    ],
)
def test_values_scale_linearly_with_ql(
    lo_val, hi_val, ql_delta, ql_delta_full, expected
):
    interpolated = between(0, ql_delta_full, ql_delta)

    assert interpolated.interpolate_value(lo_val, hi_val) == expected


def test_a_value_is_rounded_to_the_nearest_whole_number():
    assert between(0, 3, 1).interpolate_value(10, 11) == 10
    assert between(0, 3, 2).interpolate_value(10, 11) == 11


@pytest.mark.parametrize(
    "lo_val,hi_val,ql_delta,ql_delta_full,expected",
    [
        (2, 3, 10, 20, 3),  # 2.5
        (1, 2, 10, 20, 2),  # 1.5
        (3, 2, 10, 20, 3),  # 2.5, falling
        (674, 806, 7, 24, 713),  # 712.5
        (0, 1, 1, 2, 1),  # 0.5
        (-3, -2, 10, 20, -2),  # -2.5
        (-50, -25, 1, 50, -49),  # -49.5
        (-1, 0, 1, 2, 0),  # -0.5
        (2, 3, 9, 20, 2),  # 2.45
        (-3, -2, 11, 20, -2),  # -2.45
        (-3, -2, 9, 20, -3),  # -2.55
        (35, 130, 49, 98, 83),  # 82.5, where a float product falls short
    ],
)
def test_an_exact_half_is_rounded_up(lo_val, hi_val, ql_delta, ql_delta_full, expected):
    assert blend(lo_val, hi_val, ql_delta, ql_delta_full) == expected
    assert (
        between(0, ql_delta_full, ql_delta).interpolate_value(lo_val, hi_val)
        == expected
    )


def test_without_interpolation_a_value_is_the_low_value():
    not_interpolating = InterpolatedItem(id=1, aoid=1, name="Thing")

    assert not_interpolating.interpolate_value(100, 200) == 100
