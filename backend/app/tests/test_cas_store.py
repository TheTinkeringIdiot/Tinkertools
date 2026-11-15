"""
Tests for the content-addressed store's importer (app/core/cas_store.py,
cas_curated.py, cas_extract.py).

Each test imports a few hand-made builds into a throwaway schema created
inside the test's transaction and asks the store the questions the read path
will ask: what is this item as of that build, what changed in that build, what
is this nano served with. The rollback at the end removes the schema again;
no other schema is touched.
"""

import importlib.util
import json
import os
import subprocess
import sys
import uuid
from datetime import date
from pathlib import Path

import psycopg
import pytest

from app.core import cas_store
from app.core.cas_curated import CuratedFiles, sync_curated
from app.core.cas_extract import ExtractReader, plan_builds, read_manifest
from app.core.cas_store import (
    BuildSpec,
    StoreError,
    effective_strain,
    import_build,
    split_records,
)

DATABASE_URL = os.getenv("DATABASE_URL", "")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL.startswith("postgres"), reason="needs PostgreSQL"
)


@pytest.fixture
def conn():
    schema = f"cas_test_{uuid.uuid4().hex[:12]}"
    connection = psycopg.connect(cas_store.libpq_url(DATABASE_URL))
    try:
        cas_store.use_schema(connection, schema, local=True)
        cas_store.create_store(connection, schema)
        yield connection
    finally:
        connection.rollback()
        connection.close()


# ---------------------------------------------------------------------------
# Hand-made builds
# ---------------------------------------------------------------------------


def criterion(value1, value2, operator):
    return {"Value1": value1, "Value2": value2, "Operator": operator}


def modify(stat, amount):
    return {
        "SpellID": 53045,
        "Target": 2,
        "TickCount": 1,
        "TickInterval": 0,
        "Stat": stat,
        "Amount": amount,
        "Criteria": [],
        "SpellFormat": "Modify {Stat} {Amount}",
        "SpellDescription": f"Modify {stat} {amount}",
    }


def item(aoid, name="Thing", ql=100, **extra):
    record = {
        "AOID": aoid,
        "Name": name,
        "Description": "",
        "StatValues": [
            {"Stat": 54, "RawValue": ql},
            {"Stat": 76, "RawValue": 2},
        ],
    }
    record["StatValues"] += [
        {"Stat": stat, "RawValue": value} for stat, value in extra.pop("stats", [])
    ]
    record.update(extra)
    return record


def nano(aoid, strain=None, substrain=None, use=None, school=1):
    stats = [(405, school)]
    if strain is not None:
        stats.append((75, strain))
    if substrain is not None:
        stats.append((1003, substrain))
    record = item(aoid, name=f"Nano {aoid}", ql=1, stats=stats)
    if use is not None:
        record["ActionData"] = {"Actions": [{"Action": 3, "Criteria": use}]}
    return record


def spec(slug, ordinal, branch="ao", **fields):
    fields.setdefault("extract_slug", slug)
    fields.setdefault("display_name", slug)
    return BuildSpec(slug=slug, branch=branch, ordinal=ordinal, **fields)


def load(conn, build, items=(), nanos=()):
    content = split_records(
        [(record, False) for record in items] + [(record, True) for record in nanos]
    )
    return import_build(conn, build, content)


def as_of(conn, branch, ordinal):
    """``{aoid: rev_id}`` of a build: the read path's "items of build N"."""
    return dict(
        conn.execute(
            "SELECT aoid, rev_id FROM item_presence "
            "WHERE branch = %s AND from_ordinal <= %s AND to_ordinal >= %s",
            (branch, ordinal, ordinal),
        ).fetchall()
    )


def runs(conn, aoid, branch="ao"):
    return conn.execute(
        "SELECT from_ordinal, to_ordinal FROM item_presence "
        "WHERE branch = %s AND aoid = %s ORDER BY from_ordinal",
        (branch, aoid),
    ).fetchall()


def changes(conn, ordinal, branch="ao"):
    """``{aoid: (kind, parts_changed)}`` of one build."""
    return {
        aoid: (kind, parts)
        for aoid, kind, parts in conn.execute(
            "SELECT aoid, kind, parts_changed FROM item_change "
            "WHERE branch = %s AND ordinal = %s",
            (branch, ordinal),
        )
    }


def name_as_of(conn, aoid, ordinal, branch="ao"):
    row = conn.execute(
        "SELECT t.name FROM item_presence p "
        "JOIN item_revision r ON r.rev_id = p.rev_id "
        "JOIN part_text t ON t.text_id = r.text_id "
        "WHERE p.branch = %s AND p.aoid = %s "
        "AND p.from_ordinal <= %s AND p.to_ordinal >= %s",
        (branch, aoid, ordinal, ordinal),
    ).fetchone()
    return row[0] if row else None


def table_counts(conn):
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = current_schema()"
        )
    ]
    return {
        table: conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
        for table in tables
    }


# ---------------------------------------------------------------------------
# Presence
# ---------------------------------------------------------------------------


def test_each_build_serves_its_own_content(conn):
    load(conn, spec("b1", 1), [item(1, "Sword"), item(2, "Shield")])
    load(
        conn,
        spec("b2", 2),
        [item(1, "Sharp Sword"), item(2, "Shield"), item(3, "Helmet")],
    )

    assert name_as_of(conn, 1, 1) == "Sword"
    assert name_as_of(conn, 1, 2) == "Sharp Sword"
    assert name_as_of(conn, 3, 1) is None
    assert name_as_of(conn, 3, 2) == "Helmet"
    assert as_of(conn, "ao", 1)[2] == as_of(conn, "ao", 2)[2]


def test_a_newer_build_writes_rows_only_for_what_changed(conn):
    load(conn, spec("b1", 1), [item(1, "Sword"), item(2, "Shield")])
    result = load(conn, spec("b2", 2), [item(1, "Sharp Sword"), item(2, "Shield")])

    assert (result.new_revisions, result.runs_closed, result.runs_opened) == (1, 1, 1)
    assert runs(conn, 1) == [(1, 1), (2, cas_store.OPEN_RUN)]
    assert runs(conn, 2) == [(1, cas_store.OPEN_RUN)]
    assert set(changes(conn, 2)) == {1}


def test_an_item_that_disappears_and_returns_keeps_its_revision(conn):
    load(conn, spec("b1", 1), [item(1), item(2)])
    load(conn, spec("b2", 2), [item(2)])
    load(conn, spec("b3", 3), [item(1), item(2)])

    assert 1 not in as_of(conn, "ao", 2)
    assert as_of(conn, "ao", 3)[1] == as_of(conn, "ao", 1)[1]
    assert runs(conn, 1) == [(1, 1), (3, cas_store.OPEN_RUN)]
    assert changes(conn, 2) == {1: ("R", 0)}
    assert changes(conn, 3) == {1: ("A", 0)}
    assert (
        conn.execute("SELECT count(*) FROM item_revision WHERE aoid = 1").fetchone()[0]
        == 1
    )


def test_a_closed_run_ends_at_the_previous_build_when_ordinals_have_gaps(conn):
    load(conn, spec("b1", 4), [item(1, "Old")])
    load(conn, spec("b2", 9), [item(1, "New")])

    assert runs(conn, 1) == [(4, 4), (9, cas_store.OPEN_RUN)]


def test_two_items_with_the_same_content_share_their_parts(conn):
    load(conn, spec("b1", 1), [item(1, "Twin"), item(2, "Twin")])

    assert conn.execute("SELECT count(*) FROM part_text").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM part_stats").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM item_revision").fetchone()[0] == 2


def test_an_aoid_twice_in_one_build_is_refused():
    with pytest.raises(StoreError, match="twice"):
        split_records([(item(1), False), (item(1), True)])


# ---------------------------------------------------------------------------
# Duplicate builds, re-import, order
# ---------------------------------------------------------------------------


def test_a_duplicate_build_extends_runs_without_writing_them(conn):
    load(conn, spec("b1", 1), [item(1), item(2)])
    before = table_counts(conn)
    result = import_build(conn, spec("b2", 2, extract_slug="b1"), None)

    after = table_counts(conn)
    assert result.imported and result.same_as_previous and result.items == 2
    assert after.pop("build") == before.pop("build") + 1
    assert after == before
    assert as_of(conn, "ao", 2) == as_of(conn, "ao", 1)
    assert changes(conn, 2) == {}


def test_a_build_after_a_duplicate_closes_runs_at_the_duplicate(conn):
    load(conn, spec("b1", 1), [item(1, "Old")])
    import_build(conn, spec("b2", 2, extract_slug="b1"), None)
    load(conn, spec("b3", 3), [item(1, "New")])

    assert name_as_of(conn, 1, 2) == "Old"
    assert name_as_of(conn, 1, 3) == "New"
    assert runs(conn, 1) == [(1, 2), (3, cas_store.OPEN_RUN)]


def test_a_build_without_content_must_duplicate_the_newest_build(conn):
    load(conn, spec("b1", 1), [item(1, "Old")])
    load(conn, spec("b2", 2), [item(1, "New")])

    with pytest.raises(StoreError, match="not a duplicate"):
        import_build(conn, spec("b3", 3, extract_slug="b1"), None)


def test_importing_a_build_again_changes_nothing(conn):
    load(conn, spec("b1", 1), [item(1), item(2)], [nano(10, strain=5)])
    load(conn, spec("b2", 2), [item(1, "Renamed")], [nano(10, strain=5)])
    before = table_counts(conn)
    presence = conn.execute("SELECT * FROM item_presence ORDER BY 1, 2, 3").fetchall()

    first = load(conn, spec("b1", 1), [item(1), item(2)], [nano(10, strain=5)])
    second = load(conn, spec("b2", 2), [item(1, "Renamed")], [nano(10, strain=5)])

    assert not first.imported and not second.imported
    assert table_counts(conn) == before
    assert (
        conn.execute("SELECT * FROM item_presence ORDER BY 1, 2, 3").fetchall()
        == presence
    )


def test_a_build_older_than_the_newest_of_its_branch_is_refused(conn):
    load(conn, spec("b5", 5), [item(1)])

    with pytest.raises(StoreError, match="not newer"):
        load(conn, spec("b3", 3), [item(1)])


def test_a_second_build_at_the_ordinal_of_the_newest_is_refused(conn):
    load(conn, spec("b5", 5), [item(1)])

    with pytest.raises(StoreError, match="not newer"):
        load(conn, spec("b5-again", 5), [item(1, "Other")])
    assert as_of(conn, "ao", 5).keys() == {1}
    assert name_as_of(conn, 1, 5) == "Thing"


# ---------------------------------------------------------------------------
# Change log
# ---------------------------------------------------------------------------


def weapon(**overrides):
    record = item(
        1,
        "Gun",
        stats=[(23, 500), (30, 5)],
        AttackDefenseData={"Attack": [{"Stat": 112, "RawValue": 100}], "Defense": []},
        ActionData={"Actions": [{"Action": 6, "Criteria": [criterion(112, 50, 2)]}]},
        SpellData=[{"Event": 14, "Items": [modify(17, 3), modify(18, 4)]}],
    )
    record.update(overrides)
    return record


@pytest.mark.parametrize(
    "changed, bits",
    [
        ({"Name": "Big Gun"}, 1),
        ({"Description": "Loud."}, 1),
        (
            {"StatValues": weapon()["StatValues"] + [{"Stat": 31, "RawValue": 1}]},
            2,
        ),
        ({"SpellData": [{"Event": 14, "Items": [modify(17, 9), modify(18, 4)]}]}, 4),
        (
            {
                "ActionData": {
                    "Actions": [{"Action": 6, "Criteria": [criterion(112, 60, 2)]}]
                }
            },
            8,
        ),
        (
            {
                "AttackDefenseData": {
                    "Attack": [{"Stat": 112, "RawValue": 90}],
                    "Defense": [],
                }
            },
            16,
        ),
        (
            {
                "StatValues": [
                    {"Stat": 23, "RawValue": 501} if s["Stat"] == 23 else s
                    for s in weapon()["StatValues"]
                ]
            },
            32,
        ),
        ({"Name": "Big Gun", "AttackDefenseData": {}}, 1 + 16),
    ],
)
def test_a_change_names_exactly_the_parts_that_differ(conn, changed, bits):
    load(conn, spec("b1", 1), [weapon()])
    load(conn, spec("b2", 2), [weapon(**changed)])

    assert changes(conn, 2) == {1: ("C", bits)}


def test_a_build_that_only_reorders_an_item_changes_nothing(conn):
    load(conn, spec("b1", 1), [weapon()])
    reordered = weapon(
        SpellData=[{"Event": 14, "Items": [modify(18, 4), modify(17, 3)]}],
        StatValues=list(reversed(weapon()["StatValues"])),
    )
    result = load(conn, spec("b2", 2), [reordered])

    assert result.new_revisions == 0
    assert changes(conn, 2) == {}
    assert runs(conn, 1) == [(1, cas_store.OPEN_RUN)]


def test_added_removed_and_changed_items_are_told_apart(conn):
    load(conn, spec("b1", 1), [item(1), item(2, "Old")])
    result = load(conn, spec("b2", 2), [item(2, "New"), item(3)])

    assert changes(conn, 2) == {1: ("R", 0), 2: ("C", 1), 3: ("A", 0)}
    assert (result.added, result.removed, result.changed) == (1, 1, 1)
    old_rev, new_rev = conn.execute(
        "SELECT old_rev_id, new_rev_id FROM item_change WHERE ordinal = 2 AND aoid = 2"
    ).fetchone()
    assert old_rev == as_of(conn, "ao", 1)[2] and new_rev == as_of(conn, "ao", 2)[2]


def test_a_branch_starts_from_its_parent_build(conn):
    load(conn, spec("ao-1", 1), [item(1, "Old")])
    load(conn, spec("ao-2", 2), [item(1), item(2), item(3)])
    load(conn, spec("ao-3", 3), [item(1), item(2), item(3, "Later")])
    load(
        conn,
        spec("prk-1", 1, branch="prk", parent_slug="ao-2"),
        [item(1), item(2, "Reworked"), item(4)],
    )

    assert changes(conn, 1, "prk") == {2: ("C", 1), 3: ("R", 0), 4: ("A", 0)}
    assert set(as_of(conn, "prk", 1)) == {1, 2, 4}
    assert as_of(conn, "prk", 1)[1] == as_of(conn, "ao", 2)[1]
    assert runs(conn, 1, "prk") == [(1, cas_store.OPEN_RUN)]
    assert name_as_of(conn, 3, 3) == "Later"


def test_a_branch_is_compared_with_its_fork_point_not_the_parents_newest_build(
    conn,
):
    load(conn, spec("ao-1", 1), [item(1), item(2), item(3, "At the fork")])
    load(conn, spec("ao-2", 2), [item(1, "Renamed later"), item(3, "Later")])
    at_fork = as_of(conn, "ao", 1)
    load(
        conn,
        spec("prk-1", 1, branch="prk", parent_slug="ao-1"),
        [item(1), item(2, "Reworked")],
    )

    assert changes(conn, 1, "prk") == {2: ("C", 1), 3: ("R", 0)}
    assert dict(
        conn.execute(
            "SELECT aoid, old_rev_id FROM item_change WHERE branch = 'prk'"
        ).fetchall()
    ) == {2: at_fork[2], 3: at_fork[3]}


def test_a_branch_cannot_fork_from_a_build_the_store_lacks(conn):
    with pytest.raises(StoreError, match="import it first"):
        load(conn, spec("prk-1", 1, branch="prk", parent_slug="ao-9"), [item(1)])


# ---------------------------------------------------------------------------
# Search projections
# ---------------------------------------------------------------------------


def test_parts_can_be_searched_by_what_they_contain(conn):
    load(conn, spec("b1", 1), [weapon()])

    def revisions(sql):
        return conn.execute(sql).fetchall()

    assert revisions(
        "SELECT r.aoid FROM item_revision r JOIN stat_entry s USING (stats_id) "
        "WHERE s.stat = 30 AND s.value = 5"
    ) == [(1,)]
    assert revisions(
        "SELECT action, position, value1, value2, operator FROM requirement"
    ) == [(6, 0, 112, 50, 2)]
    assert revisions(
        "SELECT event, spell_id, target, subject, amount FROM effect_entry ORDER BY subject"
    ) == [(14, 53045, 2, 17, 3), (14, 53045, 2, 18, 4)]
    assert revisions("SELECT is_attack, stat, value FROM atkdef_entry") == [
        (True, 112, 100)
    ]
    assert revisions("SELECT stat FROM stat_entry WHERE stat = 23") == []
    assert revisions("SELECT format FROM effect_type WHERE spell_id = 53045") == [
        ("Modify {Stat} {Amount}",)
    ]


def effect(spell_id, **params):
    return {"SpellID": spell_id, "Target": 2, "Criteria": [], **params}


def test_an_effects_subject_is_its_stat_else_its_skill_else_its_nano(conn):
    effects = [
        effect(101, Stat=5, Skill=6, NanoID=7),
        effect(102, Skill=6, NanoID=7),
        effect(103, NanoID=7),
        effect(104, Stat="none", Skill=6),
        effect(105, Amount=3),
    ]
    load(conn, spec("b1", 1), [item(1, SpellData=[{"Event": 14, "Items": effects}])])

    assert dict(
        conn.execute("SELECT spell_id, subject FROM effect_entry").fetchall()
    ) == {101: 5, 102: 6, 103: 7, 104: 6, 105: None}


def test_an_effect_types_format_follows_the_latest_import(conn):
    reworded = dict(modify(17, 3), SpellFormat="Change {Stat} by {Amount}")
    load(
        conn,
        spec("b1", 1),
        [item(1, SpellData=[{"Event": 14, "Items": [modify(17, 3)]}])],
    )
    load(conn, spec("b2", 2), [item(1, SpellData=[{"Event": 14, "Items": [reworded]}])])

    assert conn.execute("SELECT spell_id, format FROM effect_type").fetchall() == [
        (53045, "Change {Stat} by {Amount}")
    ]


def test_symbiants_are_recognised_by_name(conn):
    load(
        conn,
        spec("b1", 1),
        [
            item(
                1,
                "Active Ocular Symbiant, Artillery Unit Aban",
                ql=170,
                stats=[(298, 2), (298, 4)],
            ),
            item(2, "Symbiant Storage Unit"),
        ],
    )

    assert conn.execute(
        "SELECT aoid, name, ql, slot_id, family FROM symbiant_items"
    ).fetchall() == [
        (1, "Active Ocular Symbiant, Artillery Unit Aban", 170, 4, "Artillery")
    ]


@pytest.mark.parametrize(
    "tier, family",
    [("Aban", "Control"), ("Alpha", "Infantry"), ("Beta", "Support")],
)
def test_symbiants_of_every_tier_are_recognised(conn, tier, family):
    name = f"Vital Brain Symbiant, {family} Unit {tier}"
    load(conn, spec("b1", 1), [item(1, name, ql=300, stats=[(298, 1)])])

    assert conn.execute(
        "SELECT aoid, name, ql, slot_id, family FROM symbiant_items"
    ).fetchall() == [(1, name, 300, 1, family)]


# ---------------------------------------------------------------------------
# Nano overlay
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "own, overlay, overlay_first, expected",
    [
        # no overlay row: own values, whatever they are
        ((7, 2), None, False, (7, 2)),
        ((0, None), None, True, (0, None)),
        # an older build keeps a usable strain that disagrees, substrain with it
        ((7, 2), (9, 4), False, (7, 2)),
        ((7, None), (9, 4), False, (7, None)),
        # ... and takes the overlay when it has none of its own
        ((None, None), (9, 4), False, (9, 4)),
        ((0, 1), (9, 4), False, (9, 4)),
        ((99999, None), (9, 0), False, (9, None)),
        # ... or when both agree, which lets the substrain be filled in
        ((9, None), (9, 4), False, (9, 4)),
        # the newest build takes the overlay
        ((7, 2), (9, 4), True, (9, 4)),
        # an overlay without a strain or substrain leaves the own value
        ((7, 2), (0, 0), True, (7, 2)),
        ((7, 2), (9, 0), True, (9, 2)),
        ((7, 2), (0, 4), True, (7, 4)),
        ((99999, None), (0, 0), True, (99999, None)),
        # an older build with a usable strain is untouched by a strainless overlay
        ((7, 2), (0, 4), False, (7, 2)),
    ],
)
def test_effective_strain(own, overlay, overlay_first, expected):
    assert effective_strain(own[0], own[1], overlay, overlay_first) == expected


def nano_served(conn, slug, aoid):
    """(ql, strain, substrain, school, professions, min_level) a build serves."""
    return conn.execute(
        """
        SELECT r.ql, np.strain, np.substrain, np.school, np.professions, np.min_level
        FROM build b
        JOIN item_presence p ON p.branch = b.branch
            AND p.from_ordinal <= b.ordinal AND p.to_ordinal >= b.ordinal
        JOIN item_revision r ON r.rev_id = p.rev_id
        JOIN nano_properties np ON np.rev_id = r.rev_id
            AND np.overlay_strain_first = b.overlay_strain_first
        WHERE b.slug = %s AND p.aoid = %s
        """,
        (slug, aoid),
    ).fetchone()


def test_one_nano_revision_is_served_under_each_builds_strain_policy(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4), (11, 60, 0, 0)")
    doctor_100 = [criterion(60, 10, 0), criterion(54, 99, 2), criterion(0, 0, 4)]
    nanos = [
        nano(10, strain=7, substrain=2, use=doctor_100),
        nano(11),
        nano(12, strain=3),
    ]
    load(conn, spec("old", 1), nanos=nanos)
    load(conn, spec("live", 2), nanos=nanos)

    assert nano_served(conn, "old", 10) == (125, 7, 2, 1, [10], 100)
    assert nano_served(conn, "live", 10) == (125, 9, 4, 1, [10], 100)
    assert nano_served(conn, "old", 11) == (60, None, None, 1, [], None)
    assert nano_served(conn, "live", 12) == (1, 3, None, 1, [], None)
    assert conn.execute("SELECT count(*) FROM item_revision").fetchone()[0] == 3


def test_a_changed_overlay_reaches_the_revisions_already_stored(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("live", 1), nanos=[nano(10, strain=7)])

    conn.execute("UPDATE nano_overlay SET ql = 130, strain = 12 WHERE aoid = 10")
    cas_store.apply_nano_overlay(conn)

    assert nano_served(conn, "live", 10)[:3] == (130, 12, 4)


def strain_policies(conn):
    """``{slug: overlay_strain_first}`` of every stored build."""
    return dict(conn.execute("SELECT slug, overlay_strain_first FROM build").fetchall())


def nano_property_rows(conn):
    return set(conn.execute("SELECT rev_id, overlay_strain_first FROM nano_properties"))


def nano_rows_served(conn):
    """(revision, strain policy) of every nano of every build: the rows the
    read path looks up in ``nano_properties``."""
    return set(conn.execute("""
            SELECT r.rev_id, b.overlay_strain_first FROM build b
            JOIN item_presence p ON p.branch = b.branch
                AND p.from_ordinal <= b.ordinal AND p.to_ordinal >= b.ordinal
            JOIN item_revision r ON r.rev_id = p.rev_id AND r.is_nano
            """))


def test_the_newest_stored_build_of_each_branch_takes_the_overlay(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("ao-1", 1), nanos=[nano(10, strain=7)])
    assert strain_policies(conn) == {"ao-1": True}
    assert nano_served(conn, "ao-1", 10)[:3] == (125, 9, 4)

    load(conn, spec("ao-2", 2), nanos=[nano(10, strain=7)])
    load(conn, spec("prk-1", 1, branch="prk", parent_slug="ao-1"), nanos=[nano(10)])
    import_build(conn, spec("ao-3", 3, extract_slug="ao-2"), None)

    assert strain_policies(conn) == {
        "ao-1": False,
        "ao-2": False,
        "ao-3": True,
        "prk-1": True,
    }
    assert nano_served(conn, "ao-1", 10)[:3] == (125, 7, None)
    assert nano_served(conn, "ao-2", 10)[:3] == (125, 7, None)
    assert nano_served(conn, "ao-3", 10)[:3] == (125, 9, 4)
    assert nano_served(conn, "prk-1", 10)[:3] == (125, 9, 4)


def test_a_build_that_stops_being_the_newest_gets_its_own_strains_back(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("b1", 1), nanos=[nano(10, strain=7), nano(11, strain=3)])
    assert nano_served(conn, "b1", 10)[:3] == (125, 9, 4)

    load(conn, spec("b2", 2), nanos=[nano(10, strain=8)])

    assert nano_served(conn, "b1", 10)[:3] == (125, 7, None)
    assert nano_served(conn, "b2", 10)[:3] == (125, 9, 4)


def test_nano_properties_hold_only_the_rows_builds_are_served_with(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("b1", 1), nanos=[nano(10, strain=7), nano(11, strain=3)])
    assert nano_property_rows(conn) == nano_rows_served(conn)

    load(conn, spec("b2", 2), nanos=[nano(10, strain=8), nano(11, strain=3)])
    assert nano_property_rows(conn) == nano_rows_served(conn)

    load(conn, spec("b3", 3), nanos=[nano(10, strain=8)])
    assert nano_property_rows(conn) == nano_rows_served(conn)
    assert len(nano_property_rows(conn)) == 4


def test_nano_properties_follow_every_handover_of_the_policy(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4), (12, 60, 5, 0)")
    steps = [
        (spec("ao-1", 1), [nano(10, strain=7), nano(11), nano(12, strain=3)]),
        (
            spec("prk-1", 1, branch="prk", parent_slug="ao-1"),
            [nano(10, strain=7), nano(12, strain=3)],
        ),
        (spec("ao-2", 2), [nano(10, strain=7), nano(11)]),
        (spec("ao-3", 3, extract_slug="ao-2"), None),
        (spec("ao-4", 4), [nano(11), nano(12, strain=3), nano(13)]),
        (spec("ao-5", 5), [nano(13)]),
        (spec("prk-2", 2, branch="prk"), [nano(10, strain=8)]),
    ]
    for build, nanos in steps:
        if nanos is None:
            import_build(conn, build, None)
        else:
            load(conn, build, nanos=nanos)

        assert nano_property_rows(conn) == nano_rows_served(conn), build.slug

    assert nano_served(conn, "ao-1", 12)[:3] == (60, 3, None)
    assert nano_served(conn, "ao-4", 12)[:3] == (60, 3, None)
    assert nano_served(conn, "prk-1", 12)[:3] == (60, 3, None)
    assert nano_served(conn, "prk-1", 10)[:3] == (125, 7, None)
    assert nano_served(conn, "prk-2", 10)[:3] == (125, 9, 4)


def test_a_build_that_fails_to_import_leaves_the_overlay_with_the_stored_one(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("b1", 1), nanos=[nano(10, strain=7)])
    content = split_records([(nano(10, strain=8), True)])

    def unreadable(wanted):
        raise StoreError("unreadable")

    content.documents = unreadable
    with pytest.raises(StoreError, match="unreadable"):
        with conn.transaction():
            import_build(conn, spec("b2", 2), content)

    assert strain_policies(conn) == {"b1": True}
    assert nano_served(conn, "b1", 10)[:3] == (125, 9, 4)
    assert nano_property_rows(conn) == nano_rows_served(conn)


def test_a_store_brought_in_under_another_policy_is_put_right(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("b1", 1), nanos=[nano(10, strain=7)])
    load(conn, spec("b2", 2), nanos=[nano(10, strain=7)])
    conn.execute("UPDATE build SET overlay_strain_first = (slug = 'b1')")

    assert cas_store.assign_strain_policy(conn) == 2
    cas_store.sync_nano_properties(conn)

    assert strain_policies(conn) == {"b1": False, "b2": True}
    assert nano_served(conn, "b2", 10)[:3] == (125, 9, 4)
    assert nano_property_rows(conn) == nano_rows_served(conn)


def test_a_duplicate_build_serves_nanos_under_its_own_strain_policy(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("old", 1), nanos=[nano(10, strain=7)])
    import_build(conn, spec("live", 2, extract_slug="old"), None)

    assert nano_served(conn, "old", 10)[:3] == (125, 7, None)
    assert nano_served(conn, "live", 10)[:3] == (125, 9, 4)


def test_presentation_follows_the_registry_without_touching_content(conn):
    build = spec("b1", 1, features={"perks": False})
    load(conn, build, [item(1)])
    before = table_counts(conn)

    build.display_name, build.features, build.is_default = (
        "Build One",
        {"perks": True},
        True,
    )
    cas_store.update_presentation(conn, build)

    assert conn.execute(
        "SELECT display_name, features, is_default FROM build WHERE slug = 'b1'"
    ).fetchone() == ("Build One", {"perks": True}, True)
    assert table_counts(conn) == before


def released_on(conn, slug):
    return conn.execute(
        "SELECT released_on FROM build WHERE slug = %s", (slug,)
    ).fetchone()[0]


def test_a_build_is_stored_with_its_release_date(conn):
    load(conn, spec("b1", 1, released_on=date(2024, 2, 24)), [item(1)])
    load(conn, spec("b2", 2), [item(1)])

    assert released_on(conn, "b1") == date(2024, 2, 24)
    assert released_on(conn, "b2") is None


def test_the_release_date_follows_the_registry(conn):
    build = spec("b1", 1)
    load(conn, build, [item(1)])
    before = table_counts(conn)

    build.released_on = date(2024, 2, 24)
    cas_store.update_presentation(conn, build)
    assert released_on(conn, "b1") == date(2024, 2, 24)

    build.released_on = None
    cas_store.update_presentation(conn, build)
    assert released_on(conn, "b1") is None
    assert table_counts(conn) == before


# ---------------------------------------------------------------------------
# Curated data
# ---------------------------------------------------------------------------

NANO_HEADER = "nano_id,ql,crystal_ids,nano_name,strain_id,sub_strain_id\n"


def curated_files(tmp_path, mobs, nanos=""):
    """Curated input files; ``mobs`` is a list of (boss, playfield, item aoid)
    or (boss, playfield, item aoid, level)."""
    symbiants = tmp_path / "symbiants.csv"
    symbiants.write_text(
        "".join(
            f'170,Eye,Artillery,{boss},{playfield},Somewhere,"Minion, Other",'
            f"{level[0] if level else 125},,,"
            f"<a href=http://x/showitem.asp?AOID={aoid}>QL 170 Thing</A>,\n"
            for boss, playfield, aoid, *level in mobs
        )
    )
    nanos_csv = tmp_path / "nanos.csv"
    nanos_csv.write_text(NANO_HEADER + nanos)
    perks = tmp_path / "perks.json"
    perks.write_text(
        json.dumps(
            {
                "columns": [
                    "aoid",
                    "name",
                    "counter",
                    "type",
                    "professions",
                    "breeds",
                    "level",
                    "aiTitle",
                ],
                "values": [
                    [500, "Accumulator", 1, "SL", ["Trader", "Wizard"], [], 10, None]
                ],
            }
        )
    )
    return CuratedFiles(nanos_csv=nanos_csv, perks_json=perks, symbiants_csv=symbiants)


def mob_ids(conn):
    """``{name: mob_id}`` of the mobs that are served."""
    return dict(
        conn.execute("SELECT name, mob_id FROM mob WHERE NOT retired").fetchall()
    )


def mob_drops(conn):
    """``{(item aoid, mob_id)}`` as the read path finds the drops of mobs."""
    return set(
        conn.execute(
            "SELECT l.aoid, s.entity_id FROM item_source l "
            "JOIN source s USING (source_id) JOIN source_type t USING (source_type_id) "
            "WHERE t.name = 'mob'"
        )
    )


def test_mobs_are_numbered_in_order_of_first_appearance(conn, tmp_path):
    files = curated_files(
        tmp_path,
        [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2), ("Ahpta", "Inferno", 3)],
    )
    sync_curated(conn, files)

    assert mob_ids(conn) == {"Ahpta": 1, "Beit": 2}
    assert conn.execute(
        "SELECT level, playfield, location, mob_names FROM mob WHERE mob_id = 1"
    ).fetchone() == (125, "Inferno", "Somewhere", ["Minion", "Other"])


def test_mob_text_is_stored_as_written(conn, tmp_path):
    files = curated_files(tmp_path, [("Ahpta", "Inferno", 1)])
    text = files.symbiants_csv.read_text()
    files.symbiants_csv.write_text(
        text.replace("Somewhere", "Razor's Lair").replace(
            '"Minion, Other"', "Aniitap's Shadow/Aniitap(250)"
        )
    )
    sync_curated(conn, files)

    assert conn.execute("SELECT location, mob_names FROM mob").fetchone() == (
        "Razor's Lair",
        ["Aniitap's Shadow/Aniitap(250)"],
    )


def test_a_mob_keeps_its_id_when_the_file_changes(conn, tmp_path):
    sync_curated(
        conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)])
    )
    sync_curated(
        conn,
        curated_files(
            tmp_path,
            [("Cama", "Adonis", 9), ("Beit", "Scheol", 2), ("Ahpta", "Inferno", 1)],
        ),
    )

    assert mob_ids(conn) == {"Ahpta": 1, "Beit": 2, "Cama": 3}


def test_a_mob_removed_from_the_file_does_not_renumber_the_others(conn, tmp_path):
    sync_curated(
        conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)])
    )
    sync_curated(conn, curated_files(tmp_path, [("Beit", "Scheol", 2)]))

    assert mob_ids(conn) == {"Beit": 2}
    assert conn.execute("SELECT count(*) FROM item_source").fetchone()[0] == 1


def mob_sources(conn):
    """``{mob_id: name}`` of the mobs the store lists as sources of items."""
    return dict(
        conn.execute(
            "SELECT s.entity_id, s.name FROM source s "
            "JOIN source_type t USING (source_type_id) WHERE t.name = 'mob'"
        ).fetchall()
    )


def test_a_mob_removed_from_the_file_is_no_longer_a_source(conn, tmp_path):
    sync_curated(
        conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)])
    )
    assert mob_sources(conn) == {1: "Ahpta", 2: "Beit"}

    sync_curated(conn, curated_files(tmp_path, [("Beit", "Scheol", 2)]))

    assert mob_sources(conn) == {2: "Beit"}
    assert mob_drops(conn) == {(2, 2)}


def test_the_drops_that_go_with_a_removed_mob_are_counted_as_written(conn, tmp_path):
    sync_curated(
        conn,
        curated_files(
            tmp_path,
            [("Ahpta", "Inferno", 1), ("Ahpta", "Inferno", 3), ("Beit", "Scheol", 2)],
        ),
    )

    written = sync_curated(conn, curated_files(tmp_path, [("Beit", "Scheol", 2)]))

    assert (written["mob"], written["source"], written["item_source"]) == (1, 1, 2)


def test_a_store_made_before_mobs_could_be_retired_is_brought_up_to_date(
    conn, tmp_path
):
    schema = conn.execute("SELECT current_schema()").fetchone()[0]
    both = [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)]
    conn.execute(
        "INSERT INTO mob (mob_id, name, level, playfield, location, mob_names) "
        "VALUES (1, 'Ahpta', 125, 'Inferno', 'Somewhere', '{}'), "
        "(2, 'Beit', 125, 'Scheol', 'Somewhere', '{}')"
    )
    conn.execute("ALTER TABLE mob DROP COLUMN retired")

    cas_store.upgrade_store(conn, schema)
    sync_curated(conn, curated_files(tmp_path, both))
    sync_curated(conn, curated_files(tmp_path, both[:1]))

    assert conn.execute(
        "SELECT mob_id, name, retired FROM mob ORDER BY mob_id"
    ).fetchall() == [(1, "Ahpta", False), (2, "Beit", True)]
    before = table_counts(conn)
    cas_store.upgrade_store(conn, schema)
    assert table_counts(conn) == before
    assert not any(sync_curated(conn, curated_files(tmp_path, both[:1])).values())


def trigram_indexes(conn, schema):
    """``{index name: its definition}`` of the trigram indexes of part_text."""
    return dict(
        conn.execute(
            "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = %s "
            "AND tablename = 'part_text' AND indexdef LIKE '%%gin_trgm_ops%%'",
            (schema,),
        ).fetchall()
    )


def test_a_new_store_has_a_trigram_index_on_the_name_and_on_the_description(conn):
    schema = conn.execute("SELECT current_schema()").fetchone()[0]
    operators = cas_store.extension_schema(conn, "pg_trgm")

    assert trigram_indexes(conn, schema) == {
        f"part_text_{short}_trgm": f"CREATE INDEX part_text_{short}_trgm "
        f"ON {schema}.part_text USING gin ({column} {operators}.gin_trgm_ops)"
        for short, column in (("name", "name"), ("desc", "description"))
    }
    assert operators == cas_store.extension_schema(conn, "btree_gist")


def test_a_store_made_before_substring_search_was_indexed_gets_the_indexes(conn):
    schema = conn.execute("SELECT current_schema()").fetchone()[0]
    load(conn, spec("b1", 1), items=[item(1, name="Sword"), item(2, name="Axe")])
    as_created = trigram_indexes(conn, schema)
    for name in as_created:
        conn.execute(f"DROP INDEX {schema}.{name}")
    before = table_counts(conn)

    cas_store.upgrade_store(conn, schema)

    assert trigram_indexes(conn, schema) == as_created
    assert table_counts(conn) == before
    assert cas_store.ensure_trigram_indexes(conn, schema) == []
    cas_store.upgrade_store(conn, schema)
    assert trigram_indexes(conn, schema) == as_created


def test_an_upgrade_adds_only_the_trigram_index_that_is_missing(conn):
    schema = conn.execute("SELECT current_schema()").fetchone()[0]
    conn.execute(f"DROP INDEX {schema}.part_text_desc_trgm")

    assert cas_store.ensure_trigram_indexes(conn, schema) == ["part_text_desc_trgm"]
    assert set(trigram_indexes(conn, schema)) == set(cas_store.TRIGRAM_INDEXES)


def test_the_id_of_a_removed_mob_is_never_given_to_another(conn, tmp_path):
    sync_curated(
        conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)])
    )
    sync_curated(conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1)]))
    sync_curated(
        conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1), ("Cama", "Adonis", 9)])
    )

    assert mob_ids(conn) == {"Ahpta": 1, "Cama": 3}
    assert mob_drops(conn) == {(1, 1), (9, 3)}
    assert conn.execute(
        "SELECT name, retired FROM mob WHERE mob_id = 2"
    ).fetchall() == [("Beit", True)]


def test_a_removed_mob_that_returns_has_its_id_and_drops_again(conn, tmp_path):
    both = [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)]
    sync_curated(conn, curated_files(tmp_path, both))
    sync_curated(conn, curated_files(tmp_path, both[:1]))
    assert mob_drops(conn) == {(1, 1)}

    sync_curated(conn, curated_files(tmp_path, both))

    assert mob_ids(conn) == {"Ahpta": 1, "Beit": 2}
    assert mob_drops(conn) == {(1, 1), (2, 2)}
    assert not any(sync_curated(conn, curated_files(tmp_path, both)).values())


def test_a_mob_is_described_by_the_first_row_that_names_it(conn, tmp_path):
    sync_curated(
        conn,
        curated_files(
            tmp_path, [("Ahpta", "Inferno", 1, 150), ("Ahpta", "Inferno", 2, 220)]
        ),
    )

    assert conn.execute("SELECT name, level FROM mob").fetchall() == [("Ahpta", 150)]
    assert mob_drops(conn) == {(1, 1), (2, 1)}


def test_a_nano_listed_twice_takes_the_first_rows_values(conn, tmp_path):
    files = curated_files(
        tmp_path, [], "10,125,300,Heal,9,4\n10,200,300;301,Heal Again,8,3\n"
    )
    sync_curated(conn, files)

    assert conn.execute("SELECT * FROM nano_overlay").fetchall() == [(10, 125, 9, 4)]
    assert conn.execute(
        "SELECT s.entity_id, l.min_ql, l.max_ql, l.metadata->>'nano_name' "
        "FROM item_source l JOIN source s USING (source_id) ORDER BY s.entity_id"
    ).fetchall() == [(300, 125, 125, "Heal"), (301, 200, 200, "Heal Again")]


def test_changed_curated_rows_are_updated_in_place(conn, tmp_path):
    sync_curated(
        conn,
        curated_files(
            tmp_path, [("Ahpta", "Inferno", 1, 150)], "10,125,300,Heal,9,4\n"
        ),
    )
    files = curated_files(
        tmp_path, [("Ahpta", "Pandemonium", 1, 220)], "10,130,300,Greater Heal,12,4\n"
    )
    files.perks_json.write_text(
        files.perks_json.read_text().replace('"Wizard"], [], 10', '"Wizard"], [], 40')
    )
    written = sync_curated(conn, files)

    assert (written["mob"], written["nano_overlay"], written["perk"]) == (1, 1, 1)
    assert conn.execute("SELECT mob_id, playfield, level FROM mob").fetchall() == [
        (1, "Pandemonium", 220)
    ]
    assert conn.execute("SELECT * FROM nano_overlay").fetchall() == [(10, 130, 12, 4)]
    assert conn.execute("SELECT level_required FROM perk").fetchall() == [(40,)]
    assert conn.execute(
        "SELECT min_ql, metadata->>'nano_name' FROM item_source WHERE aoid = 10"
    ).fetchall() == [(130, "Greater Heal")]


def test_a_mob_drop_is_linked_through_the_mobs_source(conn, tmp_path):
    sync_curated(
        conn,
        curated_files(tmp_path, [("Ahpta", "Inferno", 77), ("Ahpta", "Inferno", 77)]),
    )

    assert conn.execute(
        "SELECT l.aoid, t.name, s.entity_id, s.name FROM item_source l "
        "JOIN source s USING (source_id) JOIN source_type t USING (source_type_id)"
    ).fetchall() == [(77, "mob", 1, "Ahpta")]


def test_the_nano_file_gives_overlay_rows_and_crystal_sources(conn, tmp_path):
    files = curated_files(tmp_path, [], "10,125,300;301;300,Heal,9,4\n11,60,,Empty,,\n")
    sync_curated(conn, files)

    assert conn.execute("SELECT * FROM nano_overlay ORDER BY aoid").fetchall() == [
        (10, 125, 9, 4),
        (11, 60, 0, 0),
    ]
    assert conn.execute(
        "SELECT l.aoid, s.entity_id, s.name, s.metadata, l.min_ql, l.max_ql, l.metadata "
        "FROM item_source l JOIN source s USING (source_id) ORDER BY s.entity_id"
    ).fetchall() == [
        (
            10,
            300,
            None,
            {"type": "nanocrystal"},
            125,
            125,
            {"nano_name": "Heal", "crystal_aoid": 300},
        ),
        (
            10,
            301,
            None,
            {"type": "nanocrystal"},
            125,
            125,
            {"nano_name": "Heal", "crystal_aoid": 301},
        ),
    ]


def test_perks_keep_the_professions_the_application_knows(conn, tmp_path):
    sync_curated(conn, curated_files(tmp_path, []))

    assert conn.execute(
        "SELECT aoid, name, perk_series, counter, type, level_required, "
        "ai_level_required, professions, breeds FROM perk"
    ).fetchall() == [(500, "Accumulator", "Accumulator", 1, "SL", 10, 0, [7], [])]


def test_syncing_unchanged_files_writes_nothing(conn, tmp_path):
    files = curated_files(tmp_path, [("Ahpta", "Inferno", 1)], "10,125,300,Heal,9,4\n")
    assert sync_curated(conn, files)["mob"] == 1

    assert not any(sync_curated(conn, files).values())


def test_a_nano_takes_its_ql_from_the_overlay_at_import(conn, tmp_path):
    sync_curated(conn, curated_files(tmp_path, [], "10,125,300,Heal,9,4\n"))
    load(conn, spec("b1", 1), [item(300, "Crystal", ql=1)], [nano(10), nano(11)])

    assert dict(conn.execute("SELECT aoid, ql FROM item_revision").fetchall()) == {
        300: 1,
        10: 125,
        11: 1,
    }


# ---------------------------------------------------------------------------
# Extracts
# ---------------------------------------------------------------------------


def write_extract(root, slug, items, nanos=(), client_build=None):
    folder = root / slug
    folder.mkdir()
    (folder / "items.json").write_text(json.dumps(list(items)))
    (folder / "nanos.json").write_text(json.dumps(list(nanos)))
    (folder / "manifest.json").write_text(
        json.dumps(
            {
                "slug": slug,
                "family": slug.split("-")[0],
                "client_build": client_build or slug,
                "rdb_dat_sha256": "0" * 64,
                "tinkerparse_commit": "abc",
            }
        )
    )
    return folder


def index_entry(slug, status="extracted", extract_slug=None):
    return {
        "slug": slug,
        "family": slug.split("-")[0],
        "build": slug.split("-", 1)[1],
        "status": status,
        "extract_slug": extract_slug or (slug if status == "extracted" else None),
    }


def test_builds_are_planned_from_the_index_and_the_registry(tmp_path):
    for slug in ("ao-1", "ao-3", "prk-1"):
        write_extract(tmp_path, slug, [])
    entries = [
        index_entry("ao-0", status="failed"),
        index_entry("ao-1"),
        index_entry("ao-2", status="duplicate", extract_slug="ao-1"),
        index_entry("ao-3"),
        index_entry("prk-1"),
    ]
    registry = {
        "ao-3": {
            "display_name": "Live",
            "parent_slug": "ao-2",
            "snapshot_date": date(2024, 2, 24),
            "sort_order": 7,
            "enabled": True,
            "is_default": True,
            "features": {"perks": True},
            "notes": None,
        },
        "prk-1": {
            "display_name": "PRK",
            "parent_slug": "ao-1",
            "snapshot_date": None,
            "sort_order": 1,
            "enabled": True,
            "is_default": False,
            "features": {},
            "notes": None,
        },
    }
    specs = {s.slug: s for s in plan_builds(tmp_path, entries, registry)}

    assert list(specs) == ["ao-1", "ao-2", "ao-3", "prk-1"]
    assert [specs[s].ordinal for s in specs] == [2, 3, 4, 1]
    assert specs["ao-2"].extract_slug == "ao-1"
    assert (specs["ao-3"].display_name, specs["ao-3"].is_default) == ("Live", True)
    assert specs["ao-3"].features == {"perks": True}
    assert specs["ao-1"].display_name == "AO 1"
    assert [specs[s].released_on for s in specs] == [
        None,
        None,
        date(2024, 2, 24),
        None,
    ]
    assert specs["ao-3"].parent_slug is None
    assert specs["prk-1"].parent_slug == "ao-1"


@pytest.fixture
def plain_workers(monkeypatch):
    """Worker processes without coverage measurement: a worker ends without
    running exit handlers and would leave an empty coverage data file behind."""
    for name in [name for name in os.environ if name.startswith("COV_CORE_")]:
        monkeypatch.delenv(name)


@pytest.mark.parametrize("workers", [0, 2])
def test_extracted_builds_are_read_in_order(conn, tmp_path, workers, plain_workers):
    folders = [
        write_extract(tmp_path, "ao-1", [item(1, "Old")], [nano(10)]),
        write_extract(tmp_path, "ao-2", [item(1, "New"), item(2)], [nano(10)]),
    ]
    reader = ExtractReader(folders, workers)
    try:
        for ordinal, folder in enumerate(folders, 1):
            content = reader.next()
            try:
                import_build(conn, spec(folder.name, ordinal), content)
            finally:
                content.close()
    finally:
        reader.close()

    assert name_as_of(conn, 1, 1) == "Old"
    assert name_as_of(conn, 1, 2) == "New"
    assert changes(conn, 2) == {1: ("C", 1), 2: ("A", 0)}
    assert conn.execute(
        "SELECT is_nano FROM item_revision WHERE aoid = 10"
    ).fetchall() == [(True,)]


@pytest.mark.parametrize("workers", [0, 1])
def test_a_build_that_cannot_be_read_is_reported(tmp_path, workers, plain_workers):
    folder = write_extract(tmp_path, "ao-1", [])
    (folder / "items.json").write_text("[{")
    reader = ExtractReader([folder], workers)
    try:
        with pytest.raises(StoreError, match="Reading .*ao-1 failed: JSONDecodeError"):
            reader.next()
    finally:
        reader.close()


def test_a_manifest_must_belong_to_a_complete_extract_of_its_slug(tmp_path):
    write_extract(tmp_path, "ao-1", [])
    assert read_manifest(tmp_path, "ao-1")["client_build"] == "ao-1"

    with pytest.raises(StoreError, match="No manifest"):
        read_manifest(tmp_path, "ao-2")

    (tmp_path / "ao-1").rename(tmp_path / "ao-2")
    with pytest.raises(StoreError, match="names slug 'ao-1', expected 'ao-2'"):
        read_manifest(tmp_path, "ao-2")

    write_extract(tmp_path, "ao-3", [])
    (tmp_path / "ao-3" / "nanos.json").unlink()
    with pytest.raises(StoreError, match="Missing .*nanos.json"):
        read_manifest(tmp_path, "ao-3")


# ---------------------------------------------------------------------------
# Command line and verifier
# ---------------------------------------------------------------------------

BACKEND = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("with_folder", [False, True])
def test_import_cas_refuses_an_extracts_folder_without_an_index(
    tmp_path, with_folder, plain_workers
):
    extracts = tmp_path / "extracts"
    if with_folder:
        extracts.mkdir()
    done = subprocess.run(
        [
            sys.executable,
            str(BACKEND / "import_cli.py"),
            "import-cas",
            "--extracts-dir",
            str(extracts),
            "--schema",
            f"cas_test_{uuid.uuid4().hex[:12]}",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
    )

    assert done.returncode == 1
    expected = "No index.json" if with_folder else "Extracts folder not found"
    assert expected in done.stderr and str(extracts) in done.stderr
    assert "to import" not in done.stderr and "Traceback" not in done.stderr


def test_the_registry_is_read_with_everything_a_build_takes_from_it(conn):
    module_spec = importlib.util.spec_from_file_location(
        "import_cli", BACKEND / "import_cli.py"
    )
    import_cli = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(import_cli)

    registry = import_cli.read_registry(conn)

    assert registry, "the development database has a registry"
    for slug, row in registry.items():
        assert set(row) >= {
            "display_name",
            "snapshot_date",
            "parent_slug",
            "sort_order",
            "enabled",
            "is_default",
            "features",
            "notes",
        }
        assert row["snapshot_date"] is None or isinstance(row["snapshot_date"], date)


@pytest.fixture(scope="module")
def verify_cas():
    location = BACKEND / "tools" / "verify_cas.py"
    module_spec = importlib.util.spec_from_file_location("verify_cas", location)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module


def broken_rules(conn, verify_cas):
    """Names of the verifier's store rules that the store breaks."""
    return {
        rule
        for rule, query in verify_cas.INVARIANTS.items()
        if conn.execute(query).fetchall()
    }


def small_store(conn):
    conn.execute("INSERT INTO nano_overlay VALUES (10, 125, 9, 4)")
    load(conn, spec("ao-1", 1), [weapon(), item(2)], [nano(10, strain=7), nano(11)])
    load(
        conn,
        spec("ao-2", 2),
        [weapon(Name="Big Gun", AttackDefenseData={}), item(3)],
        [nano(10, strain=8)],
    )
    load(
        conn,
        spec("prk-1", 1, branch="prk", parent_slug="ao-1"),
        [weapon(Description="Loud."), item(2)],
        [nano(10, strain=7)],
    )


def test_the_verifier_cannot_check_a_build_the_store_lacks(conn, verify_cas, capsys):
    small_store(conn)

    with pytest.raises(SystemExit) as stopped:
        verify_cas.load_build(conn, "ao-9")

    assert stopped.value.code == 2
    assert "ao-9" in capsys.readouterr().err


def test_the_verifiers_store_rules_hold_after_imports(conn, verify_cas):
    small_store(conn)

    assert broken_rules(conn, verify_cas) == set()


@pytest.mark.parametrize(
    "tamper, rule",
    [
        (
            "UPDATE item_change SET parts_changed = 63 WHERE kind = 'C' AND branch = 'ao'",
            "change log entries whose parts_changed is not what the revisions differ in",
        ),
        (
            "UPDATE item_change SET parts_changed = 1 WHERE kind = 'A'",
            "change log entries whose parts_changed is not what the revisions differ in",
        ),
        (
            "UPDATE build SET overlay_strain_first = (slug = 'ao-1') WHERE branch = 'ao'",
            "builds whose strain policy is not 'the newest of its branch takes the overlay'",
        ),
        (
            "INSERT INTO nano_properties (rev_id, overlay_strain_first) "
            "SELECT rev_id, NOT overlay_strain_first FROM nano_properties np "
            "WHERE NOT EXISTS (SELECT 1 FROM nano_properties o WHERE o.rev_id = np.rev_id "
            "AND o.overlay_strain_first <> np.overlay_strain_first)",
            "nano properties under a policy no build serves the revision with",
        ),
    ],
)
def test_the_verifier_notices_a_store_that_breaks_a_rule(
    conn, verify_cas, tamper, rule
):
    small_store(conn)
    assert conn.execute(tamper).rowcount > 0

    assert rule in broken_rules(conn, verify_cas)
