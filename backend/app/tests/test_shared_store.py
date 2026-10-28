"""
Tests for the shared revision store (app/core/shared_store.py, design.md §12).

Every test builds its own tiny versions inside the test transaction: classic
per-version schemas made from database/migrations, a few hand-made items, and a
private store schema (``gdtest``), so the real ``gd`` and version schemas are
never touched. PostgreSQL DDL is transactional, so the rollback at the end of
each test removes the schemas, registry rows and the store again.
"""

import json
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core import shared_store
from app.core.migration_runner import migration_version, strip_psql_directives
from app.core.versions import schema_name_for

STORE = "gdtest"
MIGRATIONS = Path(__file__).resolve().parents[3] / "database" / "migrations"


@pytest.fixture
def conn(db_session):
    """The test transaction's connection, search_path back on public."""
    connection = db_session.connection()
    connection.execute(text("SET LOCAL search_path TO public"))
    return connection


def make_classic_schema(conn, schema):
    """A per-version schema built by the migration files, as staging gets."""
    conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    conn.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
    for path in sorted(MIGRATIONS.glob("*.sql")):
        version = migration_version(path.name)
        if version is None:
            continue
        conn.execute(text(strip_psql_directives(path.read_text(encoding="utf-8"))))
        conn.execute(
            text(
                "INSERT INTO schema_migrations (version, name) VALUES (:v, :n) "
                "ON CONFLICT (version) DO NOTHING"
            ),
            {"v": version, "n": path.stem},
        )
    conn.execute(text("SET LOCAL search_path TO public"))
    return schema


def _stat_value(conn, s, stat, value):
    return conn.execute(
        text(
            f'INSERT INTO "{s}".stat_values (stat, value) VALUES (:s, :v) '
            "ON CONFLICT (stat, value) DO UPDATE SET stat = EXCLUDED.stat RETURNING id"
        ),
        {"s": stat, "v": value},
    ).scalar()


def _criterion(conn, s, v1, v2, op):
    return conn.execute(
        text(
            f'INSERT INTO "{s}".criteria (value1, value2, operator) VALUES (:a, :b, :o) '
            "ON CONFLICT (value1, value2, operator) DO UPDATE SET value1 = EXCLUDED.value1 "
            "RETURNING id"
        ),
        {"a": v1, "b": v2, "o": op},
    ).scalar()


def add_item(
    conn,
    s,
    aoid,
    name,
    ql=1,
    stats=None,
    use=None,
    spell=None,
    attack=None,
    is_nano=False,
    content="v1",
):
    """One item with stats, a Use action with criteria, an attack stat and a
    spell with a criterion. ``content`` feeds the content hashes."""
    atkdef = None
    if attack:
        atkdef = conn.execute(
            text(f'INSERT INTO "{s}".attack_defense DEFAULT VALUES RETURNING id')
        ).scalar()
        for stat, value in attack.items():
            conn.execute(
                text(f'INSERT INTO "{s}".attack_defense_attack VALUES (:a, :v)'),
                {"a": atkdef, "v": _stat_value(conn, s, stat, value)},
            )
    digest = f"{aoid:08d}{content:0>32}"[:40]
    item_id = conn.execute(
        text(
            f'INSERT INTO "{s}".items (aoid, name, ql, description, item_class, is_nano, '
            "atkdef_id, content_hash, stats_hash, spells_hash, actions_hash, text_hash) "
            "VALUES (:aoid, :name, :ql, :d, 1, :nano, :ad, :h, :h, :h, :h, :h) RETURNING id"
        ),
        {
            "aoid": aoid,
            "name": name,
            "ql": ql,
            "d": f"{name} description",
            "nano": is_nano,
            "ad": atkdef,
            "h": digest,
        },
    ).scalar()
    for stat, value in (stats or {}).items():
        conn.execute(
            text(f'INSERT INTO "{s}".item_stats VALUES (:i, :v)'),
            {"i": item_id, "v": _stat_value(conn, s, stat, value)},
        )
    if use:
        action = conn.execute(
            text(
                f'INSERT INTO "{s}".actions (action, item_id) VALUES (3, :i) RETURNING id'
            ),
            {"i": item_id},
        ).scalar()
        for order, crit in enumerate(use):
            conn.execute(
                text(
                    f'INSERT INTO "{s}".action_criteria (action_id, criterion_id, order_index) '
                    "VALUES (:a, :c, :o)"
                ),
                {"a": action, "c": _criterion(conn, s, *crit), "o": order},
            )
    if spell:
        spell_data = conn.execute(
            text(f'INSERT INTO "{s}".spell_data (event) VALUES (14) RETURNING id')
        ).scalar()
        spell_row = conn.execute(
            text(
                f'INSERT INTO "{s}".spells (target, tick_count, tick_interval, spell_id, '
                "spell_format, spell_params) VALUES (1, 1, 0, :sid, 'Modify {Stat} by {Amount}', "
                "CAST(:p AS JSONB)) RETURNING id"
            ),
            {"sid": spell[0], "p": json.dumps(spell[1])},
        ).scalar()
        conn.execute(
            text(f'INSERT INTO "{s}".spell_data_spells VALUES (:d, :p)'),
            {"d": spell_data, "p": spell_row},
        )
        conn.execute(
            text(f'INSERT INTO "{s}".item_spell_data VALUES (:i, :d)'),
            {"i": item_id, "d": spell_data},
        )
        conn.execute(
            text(f'INSERT INTO "{s}".spell_criteria VALUES (:p, :c)'),
            {"p": spell_row, "c": _criterion(conn, s, 60, 1, 2)},
        )
    if is_nano:
        conn.execute(
            text(
                f'INSERT INTO "{s}".nano_properties (item_id, school, professions, min_level) '
                "VALUES (:i, 1, '{11}', 10)"
            ),
            {"i": item_id},
        )
    return item_id


def add_curated(conn, s, item_id, perk_name):
    """A perk on the item and a mob source dropping it."""
    conn.execute(
        text(
            f'INSERT INTO "{s}".perks (item_id, name, perk_series, counter, type, level_required) '
            "VALUES (:i, :n, :n, 1, 'SL', 10)"
        ),
        {"i": item_id, "n": perk_name},
    )
    type_id = conn.execute(
        text(
            f"INSERT INTO \"{s}\".source_types (name) VALUES ('mob') "
            "ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id"
        )
    ).scalar()
    source = conn.execute(
        text(
            f'INSERT INTO "{s}".sources (source_type_id, source_id, name) '
            "VALUES (:t, 1, 'Boss') RETURNING id"
        ),
        {"t": type_id},
    ).scalar()
    conn.execute(
        text(
            f'INSERT INTO "{s}".item_sources (item_id, source_id, min_ql, max_ql) '
            "VALUES (:i, :s, 1, 1)"
        ),
        {"i": item_id, "s": source},
    )


def build_a(conn, schema):
    """Version A: 1001 Alpha (weapon-ish), 1002 Beta (nano), 1003 a symbiant."""
    make_classic_schema(conn, schema)
    alpha = add_item(
        conn,
        schema,
        1001,
        "Alpha",
        stats={1: 5, 74: 100},
        use=[(112, 50, 2)],
        attack={116: 100},
    )
    add_item(
        conn,
        schema,
        1002,
        "Beta",
        stats={75: 7},
        use=[(60, 11, 0), (54, 10, 2)],
        spell=(53045, {"Stat": 17, "Amount": 5}),
        is_nano=True,
    )
    add_item(
        conn, schema, 1003, "Infantry Symbiant, Infantry Unit Alpha", stats={298: 2}
    )
    add_curated(conn, schema, alpha, "Perk A")
    conn.execute(text(f'REFRESH MATERIALIZED VIEW "{schema}".symbiant_items'))
    return schema


def build_b(conn, schema):
    """Version B: Alpha identical, Beta's spell changed, 1004 Gamma new."""
    make_classic_schema(conn, schema)
    alpha = add_item(
        conn,
        schema,
        1001,
        "Alpha",
        stats={1: 5, 74: 100},
        use=[(112, 50, 2)],
        attack={116: 100},
    )
    add_item(
        conn,
        schema,
        1002,
        "Beta",
        stats={75: 7},
        use=[(60, 11, 0), (54, 10, 2)],
        spell=(53045, {"Stat": 17, "Amount": 9}),
        is_nano=True,
        content="v2",
    )
    add_item(
        conn, schema, 1003, "Infantry Symbiant, Infantry Unit Alpha", stats={298: 2}
    )
    add_item(conn, schema, 1004, "Gamma", stats={2: 1})
    add_curated(conn, schema, alpha, "Perk B")
    conn.execute(text(f'REFRESH MATERIALIZED VIEW "{schema}".symbiant_items'))
    return schema


def fields(slug, **extra):
    row = dict(
        slug=slug,
        display_name=slug,
        family="ao",
        sort_order=0,
        features={"items": True},
    )
    row.update(extra)
    return row


def revisions(conn, aoid):
    return conn.execute(
        text(f"SELECT id, vids FROM {STORE}.items WHERE aoid = :a ORDER BY id"),
        {"a": aoid},
    ).all()


def version_items(conn, slug):
    schema = schema_name_for(slug)
    return dict(conn.execute(text(f'SELECT aoid, id FROM "{schema}".items')).all())


def install(conn, builder, slug):
    staging = builder(conn, schema_name_for(f"stage-{slug}"))
    return shared_store.install_schema(conn, staging, fields(slug), STORE)


class TestInstall:
    def test_first_install_creates_the_store_from_staging(self, conn):
        result = install(conn, build_a, "zz-a")

        assert result.created_store and result.members == 3
        assert shared_store.schema_layout(conn, "gv_zz_a") == "shared"
        assert shared_store.schema_exists(conn, "gv_stage_zz_a") is False
        assert [r.vids for r in revisions(conn, 1001)] == [[result.vid]]
        # Curated rows point at revision ids in the store.
        perk_aoid = conn.execute(
            text(
                "SELECT i.aoid FROM gv_zz_a.perks p JOIN gv_zz_a.items i ON i.id = p.item_id"
            )
        ).scalar()
        assert perk_aoid == 1001
        assert (
            conn.execute(text("SELECT count(*) FROM gv_zz_a.symbiant_items")).scalar()
            == 1
        )

    def test_merge_shares_identical_items_and_copies_changed_ones(self, conn):
        a = install(conn, build_a, "zz-a")
        b = install(conn, build_b, "zz-b")

        assert (b.merge.reused, b.merge.new) == (2, 2)
        assert [r.vids for r in revisions(conn, 1001)] == [[a.vid, b.vid]]
        assert [r.vids for r in revisions(conn, 1002)] == [[a.vid], [b.vid]]
        assert version_items(conn, "zz-b")[1001] == version_items(conn, "zz-a")[1001]

        # B's changed spell and its criterion came along with fresh ids.
        params = conn.execute(
            text(
                "SELECT s.spell_params->>'Amount', c.value1 FROM gv_zz_b.items i "
                "JOIN gv_zz_b.item_spell_data isd ON isd.item_id = i.id "
                "JOIN gv_zz_b.spell_data_spells sds ON sds.spell_data_id = isd.spell_data_id "
                "JOIN gv_zz_b.spells s ON s.id = sds.spell_id "
                "JOIN gv_zz_b.spell_criteria sc ON sc.spell_id = s.id "
                "JOIN gv_zz_b.criteria c ON c.id = sc.criterion_id WHERE i.aoid = 1002"
            )
        ).one()
        assert params == ("9", 60)
        crit = conn.execute(
            text(
                "SELECT array_agg(c.value1 ORDER BY ac.order_index) FROM gv_zz_b.items i "
                "JOIN gv_zz_b.actions a ON a.item_id = i.id "
                "JOIN gv_zz_b.action_criteria ac ON ac.action_id = a.id "
                "JOIN gv_zz_b.criteria c ON c.id = ac.criterion_id WHERE i.aoid = 1002"
            )
        ).scalar()
        assert crit == [60, 54]
        assert (
            conn.execute(
                text(
                    "SELECT count(*) FROM gv_zz_b.nano_properties p JOIN gv_zz_b.items i ON i.id = p.item_id"
                )
            ).scalar()
            == 1
        )

        # Each version keeps its own curated rows, on the shared revision.
        assert (
            conn.execute(
                text(
                    "SELECT p.name FROM gv_zz_b.perks p JOIN gv_zz_b.items i ON i.id = p.item_id "
                    "WHERE i.aoid = 1001"
                )
            ).scalar()
            == "Perk B"
        )

        history = conn.execute(
            text(
                "SELECT version_slug, stats_hash FROM public.item_revisions "
                "WHERE aoid = 1002 AND version_slug LIKE 'zz-%' ORDER BY 1"
            )
        ).all()
        assert [h[0] for h in history] == ["zz-a", "zz-b"]
        assert history[0][1] != history[1][1]

    def test_reinstalling_the_same_data_changes_nothing(self, conn):
        install(conn, build_a, "zz-a")
        install(conn, build_b, "zz-b")
        before = conn.execute(
            text(f"SELECT id, aoid, vids FROM {STORE}.items ORDER BY id")
        ).all()

        again = install(conn, build_b, "zz-b")

        assert again.merge.new == 0 and again.garbage == {"items": 0}
        after = conn.execute(
            text(f"SELECT id, aoid, vids FROM {STORE}.items ORDER BY id")
        ).all()
        assert after == before

    def test_reinstalling_changed_data_collects_the_old_revision(self, conn):
        install(conn, build_a, "zz-a")
        install(conn, build_b, "zz-b")
        old_gamma = revisions(conn, 1004)[0].id

        def build_b2(c, schema):
            build_b(c, schema)
            c.execute(text(f'UPDATE "{schema}".items SET ql = 2 WHERE aoid = 1004'))
            return schema

        result = install(conn, build_b2, "zz-b")

        assert result.garbage["items"] == 1
        assert [r.id for r in revisions(conn, 1004)] != [old_gamma]
        assert (
            conn.execute(
                text(f"SELECT count(*) FROM {STORE}.item_stats WHERE item_id = :i"),
                {"i": old_gamma},
            ).scalar()
            == 0
        )

    def test_duplicate_build_shares_its_source_revisions(self, conn):
        install(conn, build_a, "zz-a")
        b = install(conn, build_b, "zz-b")
        staging = make_classic_schema(conn, schema_name_for("stage-zz-c"))

        c = shared_store.install_duplicate(
            conn, staging, fields("zz-c", extract_slug="zz-b"), "zz-b", STORE
        )

        assert c.members == 4 and c.vid != b.vid
        assert version_items(conn, "zz-c") == version_items(conn, "zz-b")
        assert (
            conn.execute(
                text(
                    "SELECT p.name FROM gv_zz_c.perks p JOIN gv_zz_c.items i ON i.id = p.item_id"
                )
            ).scalar()
            == "Perk B"
        )
        assert (
            conn.execute(text("SELECT count(*) FROM gv_zz_c.item_sources")).scalar()
            == 1
        )
        assert (
            conn.execute(text("SELECT count(*) FROM gv_zz_c.symbiant_items")).scalar()
            == 1
        )
        assert shared_store.version_row(conn, "zz-c")["extract_slug"] == "zz-b"

    def test_removing_versions_collects_revisions_nobody_holds(self, conn):
        a = install(conn, build_a, "zz-a")
        install(conn, build_b, "zz-b")
        staging = make_classic_schema(conn, schema_name_for("stage-zz-c"))
        shared_store.install_duplicate(conn, staging, fields("zz-c"), "zz-b", STORE)
        b_only = [r.id for r in revisions(conn, 1004)] + [revisions(conn, 1002)[1].id]

        # zz-c still holds zz-b's revisions.
        removed = shared_store.remove_version(conn, "zz-b", STORE)
        assert removed["gc_items"] == 0
        assert shared_store.version_row(conn, "zz-b") is None
        assert shared_store.schema_exists(conn, "gv_zz_b") is False

        removed = shared_store.remove_version(conn, "zz-c", STORE)
        assert removed["gc_items"] == 2
        left = conn.execute(
            text(f"SELECT count(*) FROM {STORE}.items WHERE id = ANY(:ids)"),
            {"ids": b_only},
        ).scalar()
        assert left == 0
        assert [r.vids for r in revisions(conn, 1001)] == [[a.vid]]
        # The orphaned spell tree went with B's Beta revision; A's stays.
        assert conn.execute(text(f"SELECT count(*) FROM {STORE}.spells")).scalar() == 1
        assert (
            conn.execute(text(f"SELECT count(*) FROM {STORE}.spell_data")).scalar() == 1
        )

    def test_a_source_that_repeats_an_aoid_is_refused(self, conn):
        def build_dupes(c, schema):
            build_a(c, schema)
            add_item(c, schema, 1001, "Alpha again")
            return schema

        with pytest.raises(shared_store.SharedStoreError, match="same AOID"):
            install(conn, build_dupes, "zz-a")

    def test_a_content_column_the_merge_does_not_know_is_refused(self, conn):
        install(conn, build_a, "zz-a")

        def build_extra(c, schema):
            build_b(c, schema)
            c.execute(text(f'ALTER TABLE "{schema}".items ADD COLUMN extra INT'))
            return schema

        with pytest.raises(shared_store.SharedStoreError, match="CONTENT_COLUMNS"):
            install(conn, build_extra, "zz-b")


API_CALLS = [
    "/api/v1/items/1001",
    "/api/v1/items/1002",
    "/api/v1/items/1001/sources",
    "/api/v1/items?page=1&page_size=50",
    "/api/v1/items/search?q=Alpha&page_size=50",
    "/api/v1/nanos?page=1&page_size=50",
    "/api/v1/perks?page=1&page_size=50",
    "/api/v1/symbiants?page=1&page_size=50",
    "/api/v1/spells?page=1&page_size=50",
]

ID_KEYS = {
    "id",
    "item_id",
    "action_id",
    "spell_data_id",
    "stat_value_id",
    "criterion_id",
    "attack_defense_id",
    "animation_mesh_id",
    "atkdef_id",
}


def _strip_ids(value):
    if isinstance(value, dict):
        return {k: _strip_ids(v) for k, v in value.items() if k not in ID_KEYS}
    if isinstance(value, list):
        return sorted(
            (_strip_ids(v) for v in value), key=lambda v: json.dumps(v, sort_keys=True)
        )
    return value


def _responses(client, conn, schema):
    conn.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
    out = {}
    for url in API_CALLS:
        client.post("/api/v1/cache/clear")
        response = client.get(url)
        out[url] = (response.status_code, response.json())
    conn.execute(text("SET LOCAL search_path TO public"))
    return out


class TestConversion:
    """Converting classic version schemas in place keeps every API response:
    exactly for the first version (it keeps its ids), up to surrogate ids for
    the next one."""

    def test_in_place_conversion_preserves_api_responses(
        self, client, db_session, conn
    ):
        for slug, builder in (("zz-a", build_a), ("zz-b", build_b)):
            builder(conn, schema_name_for(slug))
            shared_store.register(conn, fields(slug))
        before = {
            s: _responses(client, conn, schema_name_for(s)) for s in ("zz-a", "zz-b")
        }

        for slug in ("zz-a", "zz-b"):
            row = shared_store.version_row(conn, slug)
            shared_store.install_schema(conn, row["schema_name"], fields(slug), STORE)
        after = {
            s: _responses(client, conn, schema_name_for(s)) for s in ("zz-a", "zz-b")
        }

        assert all(status == 200 for status, _ in before["zz-a"].values())
        assert after["zz-a"] == before["zz-a"]
        for url in API_CALLS:
            assert after["zz-b"][url][0] == before["zz-b"][url][0], url
            assert _strip_ids(after["zz-b"][url][1]) == _strip_ids(
                before["zz-b"][url][1]
            ), url
        assert shared_store.schema_layout(conn, "gv_zz_b") == "shared"
        assert conn.execute(text(f"SELECT count(*) FROM {STORE}.items")).scalar() == 5
