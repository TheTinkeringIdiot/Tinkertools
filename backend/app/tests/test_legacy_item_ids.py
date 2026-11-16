"""
The internal item ids of the old store: the map clients migrate with
(POST /legacy-item-ids/resolve), the file it is loaded from
(app/core/cas_legacy.py) and the export that writes the file
(tools/export_legacy_item_ids.py).
"""

import argparse
import importlib.util
import json
import os
import uuid
from pathlib import Path

import psycopg
import pytest
from sqlalchemy import select

from app.core import cas_store
from app.core.cas_curated import sync_curated
from app.core.cas_legacy import read_legacy_ids
from app.core.cas_store import StoreError
from app.store import tables as t
from app.tests.fixtures.store_fixtures import curated_files, item
from app.tests.test_cas_store import (  # noqa: F401 - conn, verify_cas: fixtures
    conn,
    index_entry,
    verify_cas,
    write_extract,
)
import import_cli

URL = "/api/v1/legacy-item-ids/resolve"
BACKEND = Path(__file__).resolve().parents[2]


def resolve(client, ids, version=None):
    prefix = f"/api/v1/{version}" if version else "/api/v1"
    response = client.post(f"{prefix}/legacy-item-ids/resolve", json={"item_ids": ids})
    assert response.status_code == 200
    return response.json()


# ---------------------------------------------------------------------------
# The route
# ---------------------------------------------------------------------------


@pytest.fixture
def migrated(store):
    """Two AO builds and a PRK build with the ids their old databases issued.
    Item 300 left AO after its first build; id 9 names an item no build has."""
    store.add_build("ao-1", 1, items=[item(100), item(200), item(300)])
    store.add_build("ao-2", 2, items=[item(100, name="Renamed"), item(200)])
    store.add_build("prk-1", 1, branch="prk", items=[item(100), item(555)])
    store.legacy_ids(
        [
            ("ao", 1, 100),
            ("ao", 2, 200),
            ("ao", 3, 300),
            ("ao", 4, 100),
            ("ao", 9, 999),
            ("prk", 1, 555),
            ("prk", 2, 100),
        ]
    )
    return store


def test_internal_ids_resolve_to_the_aoids_they_named(migrated):
    with migrated.client() as client:
        answer = resolve(client, [1, 2], "ao-2")

    assert answer == {"aoids": {"1": 100, "2": 200}, "available": True}


def test_ids_that_name_no_item_of_the_version_are_absent(migrated):
    with migrated.client() as client:
        in_old = resolve(client, [3, 9, 777], "ao-1")
        in_new = resolve(client, [3, 9, 777], "ao-2")

    assert in_old["aoids"] == {"3": 300}
    assert in_new["aoids"] == {}
    assert in_new["available"] is True


def test_an_id_names_the_same_item_in_every_build_of_its_family(migrated):
    """The map is older than the builds that follow it: an id issued for one
    revision of an item still names the item after the item changed."""
    with migrated.client() as client:
        answers = [resolve(client, [1, 4], slug)["aoids"] for slug in ("ao-1", "ao-2")]

    assert answers == [{"1": 100, "4": 100}] * 2


def test_an_id_is_resolved_for_the_family_of_the_version_in_the_url(migrated):
    with migrated.client() as client:
        in_ao = resolve(client, [1, 2], "ao")
        in_prk = resolve(client, [1, 2], "prk")
        by_default = resolve(client, [1, 2])

    assert in_ao["aoids"] == {"1": 100, "2": 200}
    assert in_prk["aoids"] == {"1": 555, "2": 100}
    assert by_default == in_ao


def test_ids_listed_twice_resolve_once(migrated):
    with migrated.client() as client:
        assert resolve(client, [1, 1, 1], "ao-2")["aoids"] == {"1": 100}


def test_an_id_no_column_can_hold_is_simply_unknown(migrated):
    with migrated.client() as client:
        answer = resolve(client, [2**31, -(2**40), 0, -1, 2], "ao-2")

    assert answer["aoids"] == {"2": 200}


def test_no_ids_resolve_to_nothing(migrated):
    with migrated.client() as client:
        assert resolve(client, [], "ao-2") == {"aoids": {}, "available": True}


def test_a_request_is_bounded(migrated):
    with migrated.client() as client:
        at_limit = client.post(URL, json={"item_ids": list(range(1, 1001))})
        over = client.post(URL, json={"item_ids": list(range(1001))})

    assert (at_limit.status_code, over.status_code) == (200, 422)


def test_a_store_without_the_map_says_so_instead_of_failing(store):
    """A store loaded without the legacy id file: nothing is resolved, and
    the answer tells the client that this is not a verdict on its ids."""
    store.add_build("ao-1", 1, items=[item(100)])

    with store.client() as client:
        assert resolve(client, [1, 2], "ao-1") == {"aoids": {}, "available": False}
        assert resolve(client, [], "ao-1") == {"aoids": {}, "available": False}


def test_a_family_the_map_does_not_cover_is_not_available(migrated):
    migrated.add_build("test-1", 1, branch="test", items=[item(100)])

    with migrated.client() as client:
        answer = resolve(client, [1], "test-1")

    assert answer == {"aoids": {}, "available": False}


# ---------------------------------------------------------------------------
# Loading the file
# ---------------------------------------------------------------------------


def stored_ids(store):
    legacy = t.legacy_item_id
    return [
        tuple(row)
        for row in store.db.execute(
            select(legacy).order_by(legacy.c.branch, legacy.c.item_id)
        )
    ]


def test_the_map_is_made_equal_to_the_file(store, tmp_path):
    first = tmp_path / "first.csv"
    first.write_text("branch,item_id,aoid\nao,1,100\nao,2,200\nprk,1,555\n")
    second = tmp_path / "second.csv"
    second.write_text("branch,item_id,aoid\nao,1,100\nao,2,201\nao,3,300\n")

    assert store.legacy_ids(read_legacy_ids(first)) == 3
    assert stored_ids(store) == [("ao", 1, 100), ("ao", 2, 200), ("prk", 1, 555)]

    # one row removed, one changed, one added; the unchanged row is not written
    assert store.legacy_ids(read_legacy_ids(second)) == 3
    assert stored_ids(store) == [("ao", 1, 100), ("ao", 2, 201), ("ao", 3, 300)]
    assert store.legacy_ids(read_legacy_ids(second)) == 0


@pytest.mark.parametrize(
    "content, complaint",
    [
        ("item_id,aoid\n1,100\n", "the first line must be branch,item_id,aoid"),
        ("", "the first line must be branch,item_id,aoid"),
        ("branch,item_id,aoid\nao,1\n", "line 2: expected branch,item_id,aoid"),
        ("branch,item_id,aoid\nao,one,100\n", "line 2: expected branch,item_id,aoid"),
        ("branch,item_id,aoid\nao,1,100,7\n", "line 2: expected branch,item_id,aoid"),
        ("branch,item_id,aoid\n,1,100\n", "line 2: expected branch,item_id,aoid"),
        ("branch,item_id,aoid\nao,1,100\nao,1,200\n", "line 3: id 1 of ao is listed"),
        ("branch,item_id,aoid\nao,4294967296,100\n", "line 2: id out of range"),
    ],
)
def test_a_legacy_id_file_that_cannot_be_right_is_refused(tmp_path, content, complaint):
    path = tmp_path / "legacy.csv"
    path.write_text(content)

    with pytest.raises(StoreError, match=complaint):
        read_legacy_ids(path)


class Unpublished(psycopg.Connection):
    """A connection that commits nothing: it notes what each commit would have
    shown other sessions, as ``(builds stored, ids in the map)``."""

    def commit(self):
        self.published.append(
            self.execute(
                "SELECT (SELECT count(*) FROM build), "
                "(SELECT count(*) FROM legacy_item_id)"
            ).fetchone()
        )

    def close(self):
        pass


def test_an_import_shows_the_map_only_once_every_build_is_stored(tmp_path, monkeypatch):
    extracts = tmp_path / "extracts"
    extracts.mkdir()
    write_extract(extracts, "ao-1", [item(100), item(300)])
    write_extract(extracts, "ao-2", [item(100), item(200)])
    write_extract(extracts, "prk-1", [item(555)])
    slugs = ["ao-1", "ao-2", "prk-1"]
    (extracts / "index.json").write_text(json.dumps([index_entry(s) for s in slugs]))
    legacy = tmp_path / "legacy.csv"
    legacy.write_text("branch,item_id,aoid\nao,1,100\nao,2,200\nprk,1,555\n")
    files = curated_files(tmp_path, [])
    schema = f"cas_test_{uuid.uuid4().hex[:12]}"
    connection = Unpublished.connect(cas_store.libpq_url(os.environ["DATABASE_URL"]))
    connection.published = []
    cas_store.use_schema(connection, schema)
    monkeypatch.setattr(cas_store, "connect", lambda url, schema: connection)
    try:
        imported = import_cli.import_cas(
            argparse.Namespace(
                extracts_dir=str(extracts),
                slug=None,
                schema=schema,
                workers=0,
                reset=False,
                yes=False,
                builds_file=None,
                legacy_ids_file=str(legacy),
                nanos_csv=str(files.nanos_csv),
                perks_file=str(files.perks_json),
                symbiants_file=str(files.symbiants_csv),
                database_url=None,
            )
        )
        stored = connection.execute("SELECT count(*) FROM legacy_item_id").fetchone()
    finally:
        connection.rollback()
        psycopg.Connection.close(connection)

    assert imported and stored == (3,)
    # other sessions saw the store fill up, and no id before the last build
    assert {builds for builds, ids in connection.published} == {0, 1, 2, 3}
    assert {builds for builds, ids in connection.published if ids} == {3}


# ---------------------------------------------------------------------------
# The export from an old store
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def export():
    location = BACKEND / "tools" / "export_legacy_item_ids.py"
    module_spec = importlib.util.spec_from_file_location("export_legacy", location)
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module


@pytest.fixture
def old_database():
    """A connection with an empty schema to stand in for an old store's; the
    transaction is rolled back."""
    connection = psycopg.connect(cas_store.libpq_url(os.environ["DATABASE_URL"]))
    schema = f"old_test_{uuid.uuid4().hex[:12]}"
    try:
        connection.execute(f"CREATE SCHEMA {schema}")
        yield connection, schema
    finally:
        connection.rollback()
        connection.close()


def test_a_single_version_database_exports_every_item_under_its_family(
    export, old_database, tmp_path
):
    conn, schema = old_database
    conn.execute(f"CREATE TABLE {schema}.items (id integer, aoid integer, name text)")
    conn.execute(
        f"INSERT INTO {schema}.items VALUES (2, 200, 'b'), (1, 100, 'a'), (3, NULL, 'c')"
    )

    rows = export.read_single_version(conn, "prk", schema)
    counts = export.write_map(rows, tmp_path / "map.csv")

    assert counts == [("prk", 2)]
    assert read_legacy_ids(tmp_path / "map.csv") == [("prk", 1, 100), ("prk", 2, 200)]


def test_a_shared_store_exports_a_revision_for_each_family_that_holds_it(
    export, old_database, tmp_path
):
    conn, schema = old_database
    conn.execute(
        f"CREATE TABLE {schema}.items (id integer, aoid integer, vids smallint[])"
    )
    conn.execute(
        f"CREATE TABLE {schema}.game_versions (slug text, family text, vid smallint)"
    )
    conn.execute(
        f"INSERT INTO {schema}.game_versions VALUES "
        "('ao-1', 'ao', 1), ('ao-2', 'ao', 2), ('prk-1', 'prk', 3), ('new', 'ao', NULL)"
    )
    conn.execute(
        f"INSERT INTO {schema}.items VALUES "
        "(10, 100, '{1,2}'), (11, 100, '{3}'), (12, 200, '{2,3}'), (13, 300, '{}')"
    )

    rows = export.read_shared_store(conn, store=schema, registry=schema)
    counts = export.write_map(rows, tmp_path / "map.csv")

    assert counts == [("ao", 2), ("prk", 2)]
    assert read_legacy_ids(tmp_path / "map.csv") == [
        ("ao", 10, 100),
        ("ao", 12, 200),
        ("prk", 11, 100),
        ("prk", 12, 200),
    ]


# ---------------------------------------------------------------------------
# Mob ids, which clients keep and nothing translates
# ---------------------------------------------------------------------------


def exported_mobs(export, old_database, tmp_path, mobs):
    """The mob file an old database holding ``mobs`` exports."""
    old, schema = old_database
    old.execute(f"CREATE TABLE {schema}.mobs (id integer, name text, level integer)")
    for mob_id, name in mobs:
        old.execute(f"INSERT INTO {schema}.mobs VALUES (%s, %s, 1)", (mob_id, name))
    path = tmp_path / "mobs.csv"
    assert export.write_mobs(
        export.read_mobs(old, export.mobs_schema(old, schema)), path
    ) == len(mobs)
    return path


def mob_differences(verify_cas, conn, path):
    report = verify_cas.Report(show=5)
    verify_cas.check_legacy_mobs(report, conn, verify_cas.read_legacy_mobs(path))
    return report.differences


def test_a_store_that_numbers_the_mobs_as_the_old_database_did_passes(
    export, old_database, conn, verify_cas, tmp_path
):
    path = exported_mobs(
        export, old_database, tmp_path, [(2, "Beit, the Second"), (1, "Ahpta")]
    )
    sync_curated(
        conn,
        curated_files(
            tmp_path,
            [("Ahpta", "Inferno", 1), ('"Beit, the Second"', "Scheol", 2)]
            + [("Cama", "Adonis", 3)],
        ),
    )

    assert mob_differences(verify_cas, conn, path) == 0


def test_mob_ids_that_would_name_another_mob_or_none_are_reported(
    export, old_database, conn, verify_cas, tmp_path, capsys
):
    path = exported_mobs(
        export, old_database, tmp_path, [(1, "Beit"), (2, "Ahpta"), (7, "Gone")]
    )
    sync_curated(
        conn, curated_files(tmp_path, [("Ahpta", "Inferno", 1), ("Beit", "Scheol", 2)])
    )

    assert mob_differences(verify_cas, conn, path) == 3
    printed = capsys.readouterr().out
    assert "1: was 'Beit', is 'Ahpta'" in printed
    assert "7: 'Gone'" in printed


def test_a_shared_store_exports_the_mobs_of_its_default_version(export, old_database):
    old, schema = old_database
    versions = {"old": f"{schema}_a", "live": f"{schema}_b"}
    old.execute(
        f"CREATE TABLE {schema}.game_versions (schema_name text, is_default boolean)"
    )
    for slug, version_schema in versions.items():
        old.execute(f"CREATE SCHEMA {version_schema}")
        old.execute(f"CREATE TABLE {version_schema}.mobs (id integer, name text)")
        old.execute(f"INSERT INTO {version_schema}.mobs VALUES (1, %s)", (slug,))
        old.execute(
            f"INSERT INTO {schema}.game_versions VALUES (%s, %s)",
            (version_schema, slug == "live"),
        )

    found = export.mobs_schema(old, schema)

    assert found == versions["live"]
    assert export.read_mobs(old, found).fetchall() == [(1, "live")]


def test_a_database_without_mobs_is_not_exported_as_if_it_had_none(
    export, old_database
):
    old, schema = old_database

    with pytest.raises(export.UnknownLayout, match="mobs"):
        export.mobs_schema(old, schema)


@pytest.mark.parametrize(
    "content",
    ["id,name\n1,Ahpta\n", "mob_id,name\none,Ahpta\n", "mob_id,name\n1,A\n1,B\n"],
)
def test_a_mob_file_that_cannot_be_right_is_refused(verify_cas, tmp_path, content):
    path = tmp_path / "mobs.csv"
    path.write_text(content)

    with pytest.raises(SystemExit) as stopped:
        verify_cas.read_legacy_mobs(path)

    assert stopped.value.code == 2
