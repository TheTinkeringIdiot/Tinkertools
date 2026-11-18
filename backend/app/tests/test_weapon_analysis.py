"""
Tests for POST /weapons/analyze: which weapons a character is offered.

Each test fills a throwaway store (the ``store`` fixture) with a few hand-made
weapons and asks the API which of them a character gets.
"""

import os

import pytest

from app.tests.fixtures.store_fixtures import criterion

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL", "").startswith("postgres"), reason="needs PostgreSQL"
)

PISTOL, RIFLE, SHOTGUN, MARTIAL_ARTS = 112, 113, 115, 100
USE, WIELD = 3, 8
NANO_TECHNICIAN, SOLDIER, DOCTOR = 11, 1, 10
SOLITUS, OPIFEX = 1, 2
CLAN, OMNI = 1, 2
EQUALS, GREATER_THAN, BIT_SET, BIT_NOT_SET = 0, 2, 22, 107
# A requirement every real weapon has; it rules nobody out.
PISTOL_SKILL = criterion(PISTOL, 100, GREATER_THAN)


def pairs(entries):
    return [{"Stat": stat, "RawValue": value} for stat, value in entries]


def weapon(
    aoid,
    attack=((PISTOL, 100),),
    defense=(),
    wield=(PISTOL_SKILL,),
    use=(),
    stats=(),
    ql=100,
    item_class=1,
    name=None,
):
    record = {
        "AOID": aoid,
        "Name": name or f"Weapon {aoid}",
        "Description": "",
        "StatValues": pairs([(54, ql), (76, item_class), *stats]),
        "AttackDefenseData": {"Attack": pairs(attack), "Defense": pairs(defense)},
    }
    actions = [
        {"Action": action, "Criteria": list(criteria)}
        for action, criteria in ((USE, use), (WIELD, wield))
        if criteria
    ]
    if actions:
        record["ActionData"] = {"Actions": actions}
    return record


def character(**changes):
    request = {
        "level": 100,
        "breed_id": SOLITUS,
        "profession_id": NANO_TECHNICIAN,
        "side": CLAN,
        "expansion_bitflag": 127,
        "top_weapon_skills": [{"skill_id": PISTOL, "value": 500}],
    }
    request.update(changes)
    return request


def offered(store, weapons, slug="live", **changes):
    """AOIDs of the weapons the character is offered, in response order."""
    if slug not in {build.slug for build in store.builds()}:
        store.add_build(slug, 1, items=weapons)
    with store.client(slug) as client:
        response = client.post("/api/v1/weapons/analyze", json=character(**changes))
    assert response.status_code == 200, response.text
    return [row["aoid"] for row in response.json()]


# ---------------------------------------------------------------------------
# What is a weapon of the character's skills
# ---------------------------------------------------------------------------


def test_a_weapon_needs_half_of_its_attack_rating_from_a_top_skill(store):
    weapons = [
        weapon(1, attack=[(PISTOL, 100)]),
        weapon(2, attack=[(PISTOL, 50), (RIFLE, 50)]),
        weapon(3, attack=[(PISTOL, 49), (RIFLE, 51)]),
        weapon(4, attack=[(RIFLE, 100)]),
    ]

    assert offered(store, weapons) == [1, 2]


def test_any_of_the_top_skills_qualifies_a_weapon(store):
    weapons = [
        weapon(1, attack=[(PISTOL, 100)]),
        weapon(2, attack=[(RIFLE, 60), (PISTOL, 40)]),
        weapon(3, attack=[(SHOTGUN, 100)]),
    ]
    skills = [{"skill_id": RIFLE, "value": 900}, {"skill_id": SHOTGUN, "value": 800}]

    assert offered(store, weapons, top_weapon_skills=skills) == [2, 3]


def test_a_defense_skill_does_not_make_a_weapon_of_that_skill(store):
    weapons = [weapon(1, attack=[(RIFLE, 100)], defense=[(PISTOL, 100)])]

    assert offered(store, weapons) == []


def test_only_items_of_the_weapon_class_are_weapons(store):
    weapons = [weapon(1), weapon(2, item_class=2), weapon(3, item_class=3)]

    assert offered(store, weapons) == [1]


def test_an_item_with_an_empty_attack_block_is_not_a_weapon(store):
    weapons = [weapon(1), weapon(2, attack=[]), weapon(3, attack=[], defense=[])]

    assert offered(store, weapons) == [1]


def test_the_skill_values_and_the_level_do_not_filter(store):
    weapons = [weapon(1, ql=1), weapon(2, ql=300)]

    low = offered(
        store, weapons, level=1, top_weapon_skills=[{"skill_id": PISTOL, "value": 0}]
    )

    assert low == [1, 2]
    assert offered(store, weapons, level=220) == [1, 2]


def test_characters_that_differ_in_nothing_the_query_reads_share_a_cached_analysis(
    store,
):
    store.add_build(
        "live", 1, items=[weapon(1), weapon(2, attack=[(RIFLE, 100)]), weapon(3)]
    )
    both = [{"skill_id": PISTOL, "value": 500}, {"skill_id": RIFLE, "value": 400}]
    same_character_later = character(
        level=220,
        top_weapon_skills=[
            {"skill_id": RIFLE, "value": 2500},
            {"skill_id": PISTOL, "value": 2400},
        ],
    )

    with store.client("live") as client:
        first = client.post(
            "/api/v1/weapons/analyze", json=character(top_weapon_skills=both)
        )
        with store.counting_queries() as statements:
            second = client.post("/api/v1/weapons/analyze", json=same_character_later)

    assert first.status_code == second.status_code == 200
    assert [row["aoid"] for row in first.json()] == [1, 2, 3]
    assert second.content == first.content
    assert statements == []


@pytest.mark.parametrize(
    "change, aoids",
    [
        ({"top_weapon_skills": [{"skill_id": RIFLE, "value": 500}]}, [2]),
        ({"breed_id": OPIFEX}, [1, 2]),
        ({"profession_id": DOCTOR}, [1, 2, 3, 4]),
        ({"side": OMNI}, [1, 2, 3, 5]),
        ({"expansion_bitflag": 1}, [1]),
    ],
)
def test_characters_that_differ_in_what_the_query_reads_do_not_share_an_analysis(
    store, change, aoids
):
    weapons = [
        weapon(1),
        weapon(2, attack=[(RIFLE, 100)], wield=(criterion(389, 2, BIT_SET),)),
        weapon(3, wield=(criterion(4, SOLITUS, EQUALS), criterion(389, 2, BIT_SET))),
        weapon(4, wield=(criterion(60, DOCTOR, EQUALS), criterion(389, 2, BIT_SET))),
        weapon(5, stats=[(33, OMNI)], wield=(criterion(389, 2, BIT_SET),)),
    ]
    store.add_build("live", 1, items=weapons)
    both = [{"skill_id": PISTOL, "value": 500}, {"skill_id": RIFLE, "value": 400}]
    request = character(top_weapon_skills=both)

    with store.client("live") as client:
        first = client.post("/api/v1/weapons/analyze", json=request)
        with store.counting_queries() as statements:
            other = client.post("/api/v1/weapons/analyze", json={**request, **change})

    assert [row["aoid"] for row in first.json()] == [1, 2, 3]
    assert [row["aoid"] for row in other.json()] == aoids
    assert statements != []


# ---------------------------------------------------------------------------
# Player weapons
# ---------------------------------------------------------------------------


def test_an_item_without_any_requirement_is_not_a_player_weapon(store):
    weapons = [
        weapon(1),
        weapon(2, wield=()),
        weapon(3, wield=(), use=[criterion(54, 10, GREATER_THAN)]),
    ]

    assert offered(store, weapons) == [1, 3]


def test_the_martial_arts_items_need_no_requirement(store):
    weapons = [
        weapon(211352, attack=[(MARTIAL_ARTS, 100)], wield=()),
        weapon(43712, attack=[(MARTIAL_ARTS, 100)], wield=()),
        weapon(5, attack=[(MARTIAL_ARTS, 100)], wield=()),
    ]
    skills = [{"skill_id": MARTIAL_ARTS, "value": 1000}]

    assert offered(store, weapons, top_weapon_skills=skills) == [43712, 211352]


def test_a_weapon_wielded_only_by_an_npc_family_is_left_out(store):
    weapons = [
        weapon(1),
        weapon(2, wield=[PISTOL_SKILL, criterion(455, 95, EQUALS)]),
        weapon(3, use=[criterion(455, 95, EQUALS)]),
    ]

    assert offered(store, weapons) == [1, 3]


# ---------------------------------------------------------------------------
# Faction
# ---------------------------------------------------------------------------

FACTION_WEAPONS = [
    weapon(1),
    weapon(2, stats=[(33, 0)]),
    weapon(3, stats=[(33, CLAN)]),
    weapon(4, stats=[(33, OMNI)]),
]


def test_a_weapon_of_the_other_faction_is_left_out(store):
    assert offered(store, FACTION_WEAPONS, side=CLAN) == [1, 2, 3]
    assert offered(store, FACTION_WEAPONS, side=OMNI) == [1, 2, 4]


def test_a_neutral_character_is_offered_the_weapons_of_every_faction(store):
    assert offered(store, FACTION_WEAPONS, side=0) == [1, 2, 3, 4]


# ---------------------------------------------------------------------------
# Breed
# ---------------------------------------------------------------------------


def test_a_weapon_for_another_breed_is_left_out(store):
    weapons = [
        weapon(1),
        weapon(2, wield=[criterion(4, SOLITUS, EQUALS)]),
        weapon(3, wield=[criterion(4, OPIFEX, EQUALS)]),
        weapon(4, wield=[criterion(4, 0, EQUALS)]),
        weapon(5, use=[criterion(4, OPIFEX, EQUALS)]),
    ]

    assert offered(store, weapons, breed_id=SOLITUS) == [1, 2, 4, 5]
    assert offered(store, weapons, breed_id=OPIFEX) == [1, 3, 4, 5]


# ---------------------------------------------------------------------------
# Profession
# ---------------------------------------------------------------------------

PROFESSION_WEAPONS = [
    weapon(1),
    weapon(2, wield=[criterion(60, NANO_TECHNICIAN, EQUALS)]),
    weapon(3, wield=[criterion(60, SOLDIER, EQUALS)]),
    # Either of two professions: one criterion each, joined by OR.
    weapon(
        4,
        wield=[
            criterion(60, SOLDIER, EQUALS),
            criterion(60, NANO_TECHNICIAN, EQUALS),
            criterion(0, 0, 3),
        ],
    ),
    weapon(5, wield=[criterion(368, NANO_TECHNICIAN, EQUALS)]),
    weapon(6, wield=[criterion(368, DOCTOR, EQUALS)]),
    weapon(7, wield=[criterion(60, 0, EQUALS)]),
    weapon(8, use=[criterion(60, SOLDIER, EQUALS)]),
]


def test_a_weapon_restricted_to_other_professions_is_left_out(store):
    as_nt = offered(store, PROFESSION_WEAPONS, profession_id=NANO_TECHNICIAN)
    as_soldier = offered(store, PROFESSION_WEAPONS, profession_id=SOLDIER)
    as_doctor = offered(store, PROFESSION_WEAPONS, profession_id=DOCTOR)

    assert as_nt == [1, 2, 4, 5, 7, 8]
    assert as_soldier == [1, 3, 4, 7, 8]
    assert as_doctor == [1, 6, 7, 8]


def test_profession_zero_is_offered_the_weapons_of_every_profession(store):
    assert offered(store, PROFESSION_WEAPONS, profession_id=0) == [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
    ]


# ---------------------------------------------------------------------------
# Expansions
# ---------------------------------------------------------------------------

SHADOWLANDS, ALIEN_INVASION = 2, 8

EXPANSION_WEAPONS = [
    weapon(1),
    weapon(2, wield=[criterion(389, SHADOWLANDS, BIT_SET)]),
    weapon(3, wield=[criterion(389, SHADOWLANDS | ALIEN_INVASION, BIT_SET)]),
    weapon(4, wield=[criterion(389, SHADOWLANDS, BIT_NOT_SET)]),
    weapon(5, use=[criterion(389, ALIEN_INVASION, BIT_SET)]),
]


def test_a_weapon_needs_every_expansion_it_requires(store):
    def owning(flags):
        return offered(store, EXPANSION_WEAPONS, expansion_bitflag=flags)

    assert owning(0) == [1, 4, 5]
    assert owning(SHADOWLANDS) == [1, 2, 5]
    assert owning(ALIEN_INVASION) == [1, 4, 5]
    assert owning(SHADOWLANDS | ALIEN_INVASION) == [1, 2, 3, 5]


def test_a_weapon_barred_to_an_expansion_is_left_out_for_its_owners(store):
    assert 4 in offered(store, EXPANSION_WEAPONS, expansion_bitflag=1)
    assert 4 not in offered(store, EXPANSION_WEAPONS, expansion_bitflag=127)


# ---------------------------------------------------------------------------
# The response
# ---------------------------------------------------------------------------


def test_every_ql_variant_is_returned_in_aoid_order(store):
    weapons = [
        weapon(30, ql=200, name="Pistol"),
        weapon(10, ql=1, name="Pistol"),
        weapon(20, ql=100, name="Pistol"),
    ]

    assert offered(store, weapons) == [10, 20, 30]


def test_a_weapon_row_is_the_items_detail(store):
    sword = weapon(
        1,
        attack=[(PISTOL, 60), (17, 40)],
        defense=[(152, 100)],
        stats=[(23, 9001), (286, 150)],
    )
    sword["SpellData"] = [
        {
            "Event": 14,
            "Items": [
                {
                    "SpellID": 53045,
                    "Target": 2,
                    "TickCount": 1,
                    "TickInterval": 0,
                    "Stat": 124,
                    "Amount": 5,
                    "Criteria": [criterion(60, 4, EQUALS)],
                    "SpellFormat": "Modify {Stat} {Amount}",
                    "SpellDescription": "Modify 124 5",
                }
            ],
        }
    ]
    store.add_build("live", 1, items=[sword])
    store.curate(mobs=[("Ahpta", "Inferno", 1)])

    with store.client("live") as client:
        rows = client.post("/api/v1/weapons/analyze", json=character())
        detail = client.get("/api/v1/items/1")

    assert rows.json() == [detail.json()]
    assert rows.text == f"[{detail.text}]"
    item = detail.json()
    assert item["attack_stats"] and item["defense_stats"] and item["actions"]
    assert item["spell_data"][0]["spells"][0]["criteria"]
    assert [source["source"]["name"] for source in item["sources"]] == ["Ahpta"]
    assert {"stat": 23, "value": 9001} in item["stats"]


def test_no_weapon_gives_an_empty_list(store):
    assert offered(store, [weapon(1, attack=[(RIFLE, 100)])]) == []


def test_weapons_are_served_as_of_the_requested_build(store):
    store.add_build("old", 1, items=[weapon(1), weapon(2)])
    store.add_build(
        "new", 2, items=[weapon(1, attack=[(RIFLE, 100)]), weapon(3, name="Newer")]
    )

    assert offered(store, [], slug="old") == [1, 2]
    assert offered(store, [], slug="new") == [3]


def test_the_number_of_queries_does_not_grow_with_the_weapons(store):
    store.add_build("few", 1, items=[weapon(1)])
    store.add_build("many", 2, items=[weapon(aoid) for aoid in range(1, 40)])

    counts = []
    for slug in ("few", "many"):
        with store.client(slug) as client, store.counting_queries() as statements:
            client.post("/api/v1/weapons/analyze", json=character())
            counts.append(len(statements))

    assert counts[0] == counts[1]


def test_a_skill_id_no_column_can_hold_matches_nothing(store):
    skills = [{"skill_id": 2**40, "value": 1}]

    assert offered(store, [weapon(1)], top_weapon_skills=skills) == []
