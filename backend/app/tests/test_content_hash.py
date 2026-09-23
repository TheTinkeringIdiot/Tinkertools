"""
Tests for app/core/content_hash.py.

The hashes decide where the UI shows "this item changed in patch X", so the
properties that matter are: the same record always hashes the same, harmless
differences between two extractions of the same client do not change it, and a
real change moves exactly the sub-hashes it should.
"""

import copy

import pytest

from app.core.content_hash import HASH_FIELDS, compute_item_hashes, normalize_record


def make_record():
    """An item record shaped like items.json."""
    return {
        "AOID": 246660,
        "Name": "Ofab Wolf Mk 5",
        "Description": "A weapon.",
        "Version": 1000000,
        "DBType": 3,
        "StatValues": [
            {"Stat": 76, "RawValue": 3},
            {"Stat": 54, "RawValue": 200},
            {"Stat": 1, "RawValue": 1234},
        ],
        "AttackDefenseData": {
            "Attack": [
                {"Stat": 112, "RawValue": 100},
                {"Stat": 102, "RawValue": 50},
            ],
            "Defense": [
                {"Stat": 155, "RawValue": 60},
            ],
        },
        "AnimationMesh": {
            "Animation": {"Stat": 1, "RawValue": 2},
            "Mesh": {"Stat": 3, "RawValue": 4},
        },
        "ActionData": {
            "Actions": [
                {
                    "Action": 6,
                    "Criteria": [
                        {"Value1": 112, "Value2": 1000, "Operator": 2},
                        {"Value1": 102, "Value2": 500, "Operator": 2},
                        {"Value1": 0, "Value2": 0, "Operator": 4},
                    ],
                }
            ]
        },
        "SpellData": [
            {
                "Event": 14,
                "Items": [{"SpellID": 53045, "SpellFormat": "{Stat} by {Amount}"}],
            }
        ],
    }


class TestDeterminism:
    def test_same_record_same_hashes(self):
        assert compute_item_hashes(make_record()) == compute_item_hashes(make_record())

    def test_all_fields_present_and_sha1_shaped(self):
        hashes = compute_item_hashes(make_record())
        assert set(hashes) == set(HASH_FIELDS)
        for field, digest in hashes.items():
            assert len(digest) == 40, field
            assert all(c in "0123456789abcdef" for c in digest), field

    def test_key_order_does_not_matter(self):
        record = make_record()
        reordered = {k: record[k] for k in reversed(list(record))}
        assert compute_item_hashes(reordered) == compute_item_hashes(record)

    def test_input_record_is_not_mutated(self):
        record = make_record()
        before = copy.deepcopy(record)
        compute_item_hashes(record)
        assert record == before

    def test_empty_record_hashes(self):
        hashes = compute_item_hashes({})
        assert set(hashes) == set(HASH_FIELDS)
        # Missing keys hash as absent, not as defaults, so every sub-hash is
        # the hash of the empty object.
        assert hashes["stats_hash"] == hashes["spells_hash"] == hashes["text_hash"]


class TestStatOrdering:
    def test_stat_values_order_is_ignored(self):
        record = make_record()
        shuffled = make_record()
        shuffled["StatValues"] = list(reversed(shuffled["StatValues"]))
        assert compute_item_hashes(shuffled) == compute_item_hashes(record)

    def test_attack_and_defense_order_is_ignored(self):
        record = make_record()
        shuffled = make_record()
        shuffled["AttackDefenseData"]["Attack"] = list(
            reversed(shuffled["AttackDefenseData"]["Attack"])
        )
        assert compute_item_hashes(shuffled) == compute_item_hashes(record)

    def test_normalize_sorts_on_stat_then_value(self):
        normalized = normalize_record(make_record())
        stats = [(sv["Stat"], sv["RawValue"]) for sv in normalized["StatValues"]]
        assert stats == sorted(stats)


class TestDumpMetadataIgnored:
    @pytest.mark.parametrize(
        "field,value",
        [
            ("Version", 18087201),
            ("DBType", 99),
            ("__is_nano__", True),
        ],
    )
    def test_field_does_not_affect_hashes(self, field, value):
        record = make_record()
        changed = make_record()
        changed[field] = value
        assert compute_item_hashes(changed) == compute_item_hashes(record)

    def test_absent_metadata_hashes_like_present_metadata(self):
        record = make_record()
        stripped = make_record()
        del stripped["Version"]
        del stripped["DBType"]
        assert compute_item_hashes(stripped) == compute_item_hashes(record)


class TestChangeIsolation:
    def test_stat_change_moves_only_stats_and_content(self):
        base = compute_item_hashes(make_record())
        changed_record = make_record()
        changed_record["StatValues"][2]["RawValue"] = 9999
        changed = compute_item_hashes(changed_record)

        assert changed["stats_hash"] != base["stats_hash"]
        assert changed["content_hash"] != base["content_hash"]
        assert changed["spells_hash"] == base["spells_hash"]
        assert changed["actions_hash"] == base["actions_hash"]
        assert changed["text_hash"] == base["text_hash"]

    def test_name_change_moves_only_text_and_content(self):
        base = compute_item_hashes(make_record())
        changed_record = make_record()
        changed_record["Name"] = "Ofab Wolf Mk 6"
        changed = compute_item_hashes(changed_record)

        assert changed["text_hash"] != base["text_hash"]
        assert changed["content_hash"] != base["content_hash"]
        assert changed["stats_hash"] == base["stats_hash"]
        assert changed["spells_hash"] == base["spells_hash"]
        assert changed["actions_hash"] == base["actions_hash"]

    def test_spell_change_moves_only_spells_and_content(self):
        base = compute_item_hashes(make_record())
        changed_record = make_record()
        changed_record["SpellData"][0]["Items"][0]["SpellID"] = 53046
        changed = compute_item_hashes(changed_record)

        assert changed["spells_hash"] != base["spells_hash"]
        assert changed["content_hash"] != base["content_hash"]
        assert changed["stats_hash"] == base["stats_hash"]
        assert changed["actions_hash"] == base["actions_hash"]
        assert changed["text_hash"] == base["text_hash"]

    def test_criteria_value_change_moves_only_actions_and_content(self):
        base = compute_item_hashes(make_record())
        changed_record = make_record()
        changed_record["ActionData"]["Actions"][0]["Criteria"][0]["Value2"] = 1100
        changed = compute_item_hashes(changed_record)

        assert changed["actions_hash"] != base["actions_hash"]
        assert changed["content_hash"] != base["content_hash"]
        assert changed["stats_hash"] == base["stats_hash"]
        assert changed["spells_hash"] == base["spells_hash"]
        assert changed["text_hash"] == base["text_hash"]

    def test_criteria_order_change_is_a_real_change(self):
        # Criteria are evaluated in sequence, so reordering them changes the
        # requirement expression. This must NOT be normalized away.
        base = compute_item_hashes(make_record())
        reordered_record = make_record()
        criteria = reordered_record["ActionData"]["Actions"][0]["Criteria"]
        criteria[0], criteria[1] = criteria[1], criteria[0]
        reordered = compute_item_hashes(reordered_record)

        assert reordered["actions_hash"] != base["actions_hash"]
        assert reordered["content_hash"] != base["content_hash"]

    def test_spell_data_order_change_is_a_real_change(self):
        record = make_record()
        record["SpellData"].append({"Event": 2, "Items": []})
        base = compute_item_hashes(record)

        reordered = copy.deepcopy(record)
        reordered["SpellData"] = list(reversed(reordered["SpellData"]))

        assert compute_item_hashes(reordered)["spells_hash"] != base["spells_hash"]


class TestIgnoredStats:
    """StaticInstance (stat 23) identifies the row, not the item."""

    def test_static_instance_value_does_not_affect_hashes(self):
        a = make_record()
        a["StatValues"].append({"Stat": 23, "RawValue": 15135})
        b = make_record()
        b["StatValues"].append({"Stat": 23, "RawValue": 14126})
        assert compute_item_hashes(a) == compute_item_hashes(b)

    def test_static_instance_presence_does_not_affect_hashes(self):
        with_it = make_record()
        with_it["StatValues"].append({"Stat": 23, "RawValue": 15135})
        assert compute_item_hashes(with_it) == compute_item_hashes(make_record())

    def test_static_instance_is_dropped_by_normalize(self):
        record = make_record()
        record["StatValues"].append({"Stat": 23, "RawValue": 1})
        stats = [s["Stat"] for s in normalize_record(record)["StatValues"]]
        assert 23 not in stats
        assert sorted(stats) == [1, 54, 76]
