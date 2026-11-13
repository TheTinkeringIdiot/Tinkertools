"""
Tests for app/core/parts.py.

Part hashes decide what the store shares and what the UI reports as changed
between builds. What matters: a build that only re-sorts an item's data does
not change any hash, a real change moves exactly the part it belongs to, and
nothing that the application shows is lost from the stored documents.
"""

import copy

from app.core.parts import PART_NAMES, effect_formats, split_item


def modify(stat, amount, criteria=()):
    return {
        "Stat": stat,
        "Amount": amount,
        "Version": 0,
        "Patch": None,
        "Unknown2": 9,
        "Criteria": [
            {"Value1": a, "Value2": b, "Operator": op} for a, b, op in criteria
        ],
        "Target": 2,
        "TickCount": 1,
        "TickInterval": 0,
        "SpellID": 53045,
        "SpellFormat": "Modify {Stat} {Amount}",
        "SpellDescription": f"Modify {stat} {amount}",
    }


def make_record():
    """An item shaped like items.json, with every kind of data an item can carry."""
    return {
        "AOID": 246660,
        "DBType": 1000020,
        "Version": 1000000,
        "UNK1": 51018,
        "Name": "Ofab Wolf Mk 5",
        "Description": "A weapon.",
        "StatValues": [
            {"Stat": 76, "RawValue": 1},
            {"Stat": 54, "RawValue": 200},
            {"Stat": 23, "RawValue": 987654},
            {"Stat": 30, "RawValue": 5},
            {"Stat": 30, "RawValue": 9},
        ],
        "AttackDefenseData": {
            "Attack": [{"Stat": 112, "RawValue": 100}, {"Stat": 102, "RawValue": 50}],
            "Defense": [{"Stat": 155, "RawValue": 60}],
        },
        "AnimationMesh": {
            "Animation": {"Stat": 13, "RawValue": 7},
            "Mesh": {"Stat": 12, "RawValue": 8},
        },
        "ActionData": {
            "Actions": [
                {
                    "Action": 8,
                    "Criteria": [
                        {"Value1": 112, "Value2": 900, "Operator": 2},
                        {"Value1": 54, "Value2": 150, "Operator": 2},
                        {"Value1": 0, "Value2": 0, "Operator": 4},
                    ],
                },
                {"Action": 3, "Criteria": []},
            ]
        },
        "SpellData": [
            {
                "Event": 14,
                "Items": [modify(156, 105), modify(151, 63), modify(150, 42)],
            },
            {"Event": 0, "Items": [modify(17, 5, criteria=[(60, 11, 0)])]},
        ],
        "Sounds": {"UNKValue1": 5, "UNKValues2": []},
        "ShopHashData": None,
    }


def hashes(record, is_nano=False):
    return split_item(record, is_nano).hashes


def changed_parts(before, after):
    a, b = hashes(before), hashes(after)
    return {name for name in PART_NAMES if a[name] != b[name]}


def test_the_same_record_always_produces_the_same_hashes():
    assert hashes(make_record()) == hashes(copy.deepcopy(make_record()))


def test_a_build_that_only_reorders_an_item_changes_nothing():
    reordered = make_record()
    reordered["StatValues"].reverse()
    reordered["AttackDefenseData"]["Attack"].reverse()
    reordered["ActionData"]["Actions"].reverse()
    reordered["SpellData"].reverse()
    for event in reordered["SpellData"]:
        event["Items"].reverse()

    assert changed_parts(make_record(), reordered) == set()
    assert (
        split_item(reordered, False).documents
        == split_item(make_record(), False).documents
    )


def test_reordering_criteria_is_a_real_change():
    reordered = make_record()
    reordered["ActionData"]["Actions"][0]["Criteria"].reverse()

    assert changed_parts(make_record(), reordered) == {"actions"}


def test_each_kind_of_change_moves_only_its_own_part():
    renamed = make_record()
    renamed["Name"] = "Ofab Wolf Mk 6"
    restatted = make_record()
    restatted["StatValues"][0]["RawValue"] = 2
    rebalanced = make_record()
    rebalanced["SpellData"][0]["Items"][0]["Amount"] = 110
    gated = make_record()
    gated["SpellData"][1]["Items"][0]["Criteria"][0]["Value2"] = 12
    retimed = make_record()
    retimed["SpellData"][0]["Items"][0]["TickCount"] = 3
    requirement = make_record()
    requirement["ActionData"]["Actions"][0]["Criteria"][0]["Value2"] = 950
    attack = make_record()
    attack["AttackDefenseData"]["Attack"][0]["RawValue"] = 90

    base = make_record()
    assert changed_parts(base, renamed) == {"text"}
    assert changed_parts(base, restatted) == {"stats"}
    assert changed_parts(base, rebalanced) == {"effects"}
    assert changed_parts(base, gated) == {"effects"}
    assert changed_parts(base, retimed) == {"effects"}
    assert changed_parts(base, requirement) == {"actions"}
    assert changed_parts(base, attack) == {"atkdef"}


def test_moving_an_effect_to_another_event_is_a_real_change():
    moved = make_record()
    effect = moved["SpellData"][0]["Items"].pop()
    moved["SpellData"][1]["Items"].append(effect)

    assert changed_parts(make_record(), moved) == {"effects"}


def test_reworded_effect_text_is_not_a_change_but_is_kept_for_display():
    reworded = make_record()
    for event in reworded["SpellData"]:
        for effect in event["Items"]:
            effect["SpellDescription"] = "Modifies " + effect["SpellDescription"]
            effect["SpellFormat"] = "Modifies {Stat} {Amount}"

    assert changed_parts(make_record(), reworded) == set()
    shown = split_item(reworded, False).documents["effects"][1]["effects"]
    assert [e["description"] for e in shown] == [
        "Modifies Modify 150 42",
        "Modifies Modify 151 63",
        "Modifies Modify 156 105",
    ]
    assert effect_formats(reworded) == {53045: "Modifies {Stat} {Amount}"}


def test_the_client_row_id_does_not_make_two_stat_sets_differ():
    reinstanced = make_record()
    reinstanced["StatValues"][2]["RawValue"] = 111

    assert changed_parts(make_record(), reinstanced) == {"misc"}
    parts = split_item(reinstanced, False)
    assert [23, 111] not in parts.documents["stats"]
    assert parts.documents["misc"]["static_instance"] == [111]


def test_a_stat_listed_twice_keeps_both_values():
    assert split_item(make_record(), False).documents["stats"] == [
        [30, 5],
        [30, 9],
        [54, 200],
        [76, 1],
    ]


def test_dump_metadata_and_sounds_are_not_part_of_the_item():
    redumped = make_record()
    redumped["Version"] = 2
    redumped["DBType"] = 3
    redumped["UNK1"] = 1
    redumped["Sounds"] = None

    assert changed_parts(make_record(), redumped) == set()


def test_documents_carry_everything_the_application_shows():
    documents = split_item(make_record(), False).documents

    assert documents["text"] == {"name": "Ofab Wolf Mk 5", "description": "A weapon."}
    assert documents["atkdef"] == {
        "attack": [[102, 50], [112, 100]],
        "defense": [[155, 60]],
    }
    assert documents["actions"] == [
        {"action": 3, "criteria": []},
        {"action": 8, "criteria": [[112, 900, 2], [54, 150, 2], [0, 0, 4]]},
    ]
    assert [event["event"] for event in documents["effects"]] == [0, 14]
    assert documents["effects"][0]["effects"] == [
        {
            "spell_id": 53045,
            "target": 2,
            "tick_count": 1,
            "tick_interval": 0,
            "params": {
                "Stat": 17,
                "Amount": 5,
                "Version": 0,
                "Patch": None,
                "Unknown2": 9,
            },
            "criteria": [[60, 11, 0]],
            "description": "Modify 17 5",
        }
    ]
    assert documents["misc"]["animation_mesh"] == {
        "animation": [13, 7],
        "mesh": [12, 8],
    }


def test_an_item_without_a_part_has_no_hash_for_it():
    bare = {"AOID": 1, "Name": "Rock", "Description": "", "StatValues": []}

    parts = split_item(bare, False)

    assert parts.hashes["text"] is not None and parts.hashes["stats"] is not None
    assert [
        parts.hashes[name] for name in ("effects", "actions", "atkdef", "misc")
    ] == [
        None,
        None,
        None,
        None,
    ]


def test_scalar_columns_come_from_the_stats():
    item = split_item(make_record(), False)
    nano = split_item(make_record(), True)
    bare = split_item({"AOID": 1, "StatValues": []}, False)

    assert (item.aoid, item.ql, item.item_class, item.is_nano) == (
        246660,
        200,
        1,
        False,
    )
    assert (nano.ql, nano.is_nano) == (1, True)
    assert (bare.ql, bare.item_class) == (1, 0)


def test_the_revision_hash_changes_when_any_part_does():
    base = split_item(make_record(), False)
    renamed = make_record()
    renamed["Name"] = "Ofab Wolf Mk 6"
    reordered = make_record()
    reordered["SpellData"].reverse()

    assert split_item(renamed, False).revision_hash != base.revision_hash
    assert split_item(reordered, False).revision_hash == base.revision_hash
    assert split_item(make_record(), True).revision_hash != base.revision_hash
