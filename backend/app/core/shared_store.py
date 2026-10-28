"""
Shared revision store (design.md §12).

Game content lives once in the ``gd`` schema: one row per distinct item
revision, with ``gd.items.vids`` listing the versions (``game_versions.vid``)
that contain it. Each version schema ``gv_<slug>`` holds views over ``gd``
(``items`` filtered by its vid, every other content table passed through), the
per-version ``symbiant_items`` materialized view, and its curated real tables
(perks, mobs, sources, ...), whose ``item_id`` columns point at revision ids.

Everything here runs on a caller-supplied connection inside the caller's
transaction and never commits, so an install, a conversion or a removal is
all-or-nothing. Merges serialize on a transaction-level advisory lock.

The unit of work is a *source schema* in the classic per-version layout (real
tables, as built by ``database/migrations``): either a staging schema loaded by
the importer, or a version schema from before the shared store. Installing it:

1. computes ``storage_fp`` for each item from the stored rows (so curated
   overlays such as ``update_nanos.py`` are part of the revision key),
2. creates the store by adopting the source's tables if there is no store yet,
   otherwise merges: matching ``(aoid, storage_fp)`` reuses a revision, a miss
   copies the item's whole tree with fresh ids,
3. points curated foreign keys at ``gd.items``, drops the source's content
   tables, and creates the views and ``symbiant_items`` in the source schema,
4. renames the source schema to ``gv_<slug>`` (replacing any previous one) and
   garbage-collects revisions no version holds any more.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core.migration_runner import upsert_game_version
from app.core.versions import schema_name_for

logger = logging.getLogger(__name__)

STORE_SCHEMA = "gd"

# Revision content and the interned dictionaries: shared in the store.
CONTENT_TABLES: Sequence[str] = (
    "items",
    "item_stats",
    "stat_values",
    "criteria",
    "attack_defense",
    "attack_defense_attack",
    "attack_defense_defense",
    "animation_mesh",
    "actions",
    "action_criteria",
    "item_spell_data",
    "spell_data",
    "spell_data_spells",
    "spells",
    "spell_criteria",
    "item_shop_hash",
    "shop_hash",
    "nano_properties",
)

# Curated, version-scoped tables: stay real tables in gv_<slug>.
CURATED_TABLES: Sequence[str] = (
    "schema_migrations",
    "source_types",
    "sources",
    "item_sources",
    "application_cache",
    "perks",
    "mobs",
)

MATVIEW = "symbiant_items"

# Columns the merge SQL below copies. A migration that changes a content table
# must update this map and the merge, or installs fail here instead of silently
# dropping the new column.
CONTENT_COLUMNS: Dict[str, Tuple[str, ...]] = {
    "items": (
        "id",
        "aoid",
        "name",
        "ql",
        "description",
        "item_class",
        "is_nano",
        "atkdef_id",
        "animation_mesh_id",
        "content_hash",
        "stats_hash",
        "spells_hash",
        "actions_hash",
        "text_hash",
    ),
    "item_stats": ("item_id", "stat_value_id"),
    "stat_values": ("id", "stat", "value"),
    "criteria": ("id", "value1", "value2", "operator"),
    "attack_defense": ("id",),
    "attack_defense_attack": ("attack_defense_id", "stat_value_id"),
    "attack_defense_defense": ("attack_defense_id", "stat_value_id"),
    "animation_mesh": ("id", "animation_id", "mesh_id"),
    "actions": ("id", "action", "item_id"),
    "action_criteria": ("id", "action_id", "criterion_id", "order_index"),
    "item_spell_data": ("item_id", "spell_data_id"),
    "spell_data": ("id", "event"),
    "spell_data_spells": ("spell_data_id", "spell_id"),
    "spells": (
        "id",
        "target",
        "tick_count",
        "tick_interval",
        "spell_id",
        "spell_format",
        "spell_params",
    ),
    "spell_criteria": ("spell_id", "criterion_id"),
    "item_shop_hash": ("item_id", "shop_hash_id"),
    "shop_hash": (
        "id",
        "hash",
        "min_level",
        "max_level",
        "base_amount",
        "regen_amount",
        "regen_interval",
        "spawn_chance",
    ),
    "nano_properties": ("item_id", "school", "professions", "min_level", "strain"),
}

STORE_ONLY_ITEM_COLUMNS: Tuple[str, ...] = ("storage_fp", "vids")

_LOCK_KEY = "tinkertools.shared_store"
_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
_FK_TO_ITEMS_RE = re.compile(
    r"^FOREIGN KEY \((\w+)\) REFERENCES (?:[\w\"]+\.)?items\(id\)(.*)$"
)


class SharedStoreError(RuntimeError):
    """An install, conversion or removal cannot proceed; nothing was changed."""


def _ident(name: str) -> str:
    if not _IDENT_RE.match(name or ""):
        raise SharedStoreError(f"Invalid schema identifier {name!r}")
    return f'"{name}"'


def lock(conn: Connection) -> None:
    """Serialize store writers until the end of the transaction."""
    conn.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": _LOCK_KEY}
    )


# ---------------------------------------------------------------------------
# Introspection
# ---------------------------------------------------------------------------


def schema_exists(conn: Connection, schema: str) -> bool:
    return bool(
        conn.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = :s)"),
            {"s": schema},
        ).scalar()
    )


def store_exists(conn: Connection, store: str = STORE_SCHEMA) -> bool:
    return relkind(conn, store, "items") == "r"


def relkind(conn: Connection, schema: str, name: str) -> Optional[str]:
    return conn.execute(
        text(
            "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = :s AND c.relname = :n"
        ),
        {"s": schema, "n": name},
    ).scalar()


def schema_layout(conn: Connection, schema: str) -> Optional[str]:
    """``"tables"`` (classic per-version layout), ``"shared"`` (views over the
    store), or None when the schema has no ``items`` relation."""
    return {"r": "tables", "v": "shared"}.get(relkind(conn, schema, "items") or "")


def _columns(conn: Connection, schema: str, table: str) -> Tuple[str, ...]:
    rows = conn.execute(
        text(
            "SELECT a.attname FROM pg_attribute a "
            "JOIN pg_class c ON c.oid = a.attrelid "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = :s AND c.relname = :t AND a.attnum > 0 "
            "AND NOT a.attisdropped ORDER BY a.attnum"
        ),
        {"s": schema, "t": table},
    ).scalars()
    return tuple(rows)


def _applied_migrations(conn: Connection, schema: str) -> set:
    if relkind(conn, schema, "schema_migrations") != "r":
        return set()
    return set(
        conn.execute(
            text(f"SELECT version FROM {_ident(schema)}.schema_migrations")
        ).scalars()
    )


def check_source_compatible(
    conn: Connection, source: str, store: Optional[str]
) -> None:
    """Fail fast if the source's content tables are not what the merge expects,
    or if source and store sit at different migration levels."""
    for table, expected in CONTENT_COLUMNS.items():
        actual = _columns(conn, source, table)
        if actual != expected:
            raise SharedStoreError(
                f"{source}.{table} has columns {actual}, the shared store merge "
                f"expects {expected}. Update CONTENT_COLUMNS and the merge SQL in "
                f"app/core/shared_store.py together with the migration."
            )
    if store is None:
        return
    for table, expected in CONTENT_COLUMNS.items():
        if table == "items":
            expected = expected + STORE_ONLY_ITEM_COLUMNS
        actual = _columns(conn, store, table)
        if actual != expected:
            raise SharedStoreError(
                f"{store}.{table} has columns {actual}, expected {expected}."
            )
    src_m, store_m = _applied_migrations(conn, source), _applied_migrations(conn, store)
    if src_m != store_m:
        raise SharedStoreError(
            f"Migration levels differ: {source} has {sorted(src_m)}, {store} has "
            f"{sorted(store_m)}. Apply the missing content migrations to the store "
            f"before installing."
        )


def check_unique_aoids(conn: Connection, source: str) -> None:
    dupes = (
        conn.execute(
            text(
                f"SELECT aoid FROM {_ident(source)}.items GROUP BY aoid "
                "HAVING count(*) > 1 ORDER BY aoid LIMIT 5"
            )
        )
        .scalars()
        .all()
    )
    if dupes:
        raise SharedStoreError(
            f"{source}.items holds the same AOID more than once (e.g. {dupes}); "
            "a version must have one item per AOID."
        )


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def version_row(conn: Connection, slug: str) -> Optional[Dict]:
    row = (
        conn.execute(
            text("SELECT * FROM public.game_versions WHERE slug = :slug"),
            {"slug": slug},
        )
        .mappings()
        .first()
    )
    return dict(row) if row else None


def allocate_vid(conn: Connection, slug: str) -> int:
    """The version's vid, assigning the next free one if it has none."""
    vid = conn.execute(
        text("SELECT vid FROM public.game_versions WHERE slug = :slug"), {"slug": slug}
    ).scalar()
    if vid is not None:
        return int(vid)
    vid = conn.execute(
        text("SELECT COALESCE(max(vid), 0) + 1 FROM public.game_versions")
    ).scalar()
    conn.execute(
        text("UPDATE public.game_versions SET vid = :vid WHERE slug = :slug"),
        {"vid": vid, "slug": slug},
    )
    return int(vid)


def set_provenance(
    conn: Connection,
    slug: str,
    extract_slug: Optional[str] = None,
    tinkerparse_commit: Optional[str] = None,
    rdb_dat_sha256: Optional[str] = None,
) -> None:
    conn.execute(
        text(
            "UPDATE public.game_versions SET extract_slug = :e, tinkerparse_commit = :c, "
            "rdb_dat_sha256 = :h, updated_at = CURRENT_TIMESTAMP WHERE slug = :slug"
        ),
        {"e": extract_slug, "c": tinkerparse_commit, "h": rdb_dat_sha256, "slug": slug},
    )


def register(conn: Connection, fields: Dict) -> int:
    """Upsert the registry row (``fields`` as for ``upsert_game_version`` plus
    the optional provenance keys) and return its vid."""
    provenance = {
        k: fields.get(k)
        for k in ("extract_slug", "tinkerparse_commit", "rdb_dat_sha256")
    }
    upsert_game_version(
        conn, **{k: v for k, v in fields.items() if k not in provenance}
    )
    set_provenance(conn, fields["slug"], **provenance)
    return allocate_vid(conn, fields["slug"])


# ---------------------------------------------------------------------------
# Fingerprints
# ---------------------------------------------------------------------------


def compute_fingerprints(conn: Connection, source: str) -> int:
    """Fill temp table ``_ss_fp(item_id, aoid, fp)`` from the source's stored rows.

    md5 over the item's columns and every child row (stats, attack/defense,
    animation/mesh, actions with ordered criteria, spell data with spells and
    criteria). Identical to the prototype's ``fp.sql``.
    """
    s = _ident(source)
    for t in ("_ss_fp_stats", "_ss_fp_ad", "_ss_fp_act", "_ss_fp_spl", "_ss_fp"):
        conn.execute(text(f"DROP TABLE IF EXISTS {t}"))

    conn.execute(text(f"""
        CREATE TEMP TABLE _ss_fp_stats ON COMMIT DROP AS
        SELECT ist.item_id,
               string_agg(sv.stat || ':' || sv.value, ',' ORDER BY sv.stat, sv.value) s
        FROM {s}.item_stats ist JOIN {s}.stat_values sv ON sv.id = ist.stat_value_id
        GROUP BY ist.item_id
    """))
    conn.execute(text(f"""
        CREATE TEMP TABLE _ss_fp_ad ON COMMIT DROP AS
        SELECT i.id item_id,
          coalesce((SELECT string_agg(sv.stat || ':' || sv.value, ',' ORDER BY sv.stat, sv.value)
                    FROM {s}.attack_defense_attack a JOIN {s}.stat_values sv ON sv.id = a.stat_value_id
                    WHERE a.attack_defense_id = i.atkdef_id), '') || '/' ||
          coalesce((SELECT string_agg(sv.stat || ':' || sv.value, ',' ORDER BY sv.stat, sv.value)
                    FROM {s}.attack_defense_defense d JOIN {s}.stat_values sv ON sv.id = d.stat_value_id
                    WHERE d.attack_defense_id = i.atkdef_id), '') || '/' ||
          coalesce((SELECT coalesce(a1.stat || ':' || a1.value, '-') || ',' ||
                           coalesce(m1.stat || ':' || m1.value, '-')
                    FROM {s}.animation_mesh am
                    LEFT JOIN {s}.stat_values a1 ON a1.id = am.animation_id
                    LEFT JOIN {s}.stat_values m1 ON m1.id = am.mesh_id
                    WHERE am.id = i.animation_mesh_id), '') s
        FROM {s}.items i
    """))
    conn.execute(text(f"""
        CREATE TEMP TABLE _ss_fp_act ON COMMIT DROP AS
        SELECT a.item_id, string_agg(a.action || '[' || coalesce(c.s, '') || ']', ';' ORDER BY a.id) s
        FROM {s}.actions a
        LEFT JOIN (SELECT ac.action_id,
                          string_agg(cr.value1 || ',' || cr.value2 || ',' || cr.operator, ' '
                                     ORDER BY ac.order_index) s
                   FROM {s}.action_criteria ac JOIN {s}.criteria cr ON cr.id = ac.criterion_id
                   GROUP BY ac.action_id) c ON c.action_id = a.id
        GROUP BY a.item_id
    """))
    conn.execute(text(f"""
        CREATE TEMP TABLE _ss_fp_spl ON COMMIT DROP AS
        WITH sc AS (
          SELECT sc.spell_id, string_agg(cr.value1 || ',' || cr.value2 || ',' || cr.operator, ' '
                                         ORDER BY cr.value1, cr.value2, cr.operator) s
          FROM {s}.spell_criteria sc JOIN {s}.criteria cr ON cr.id = sc.criterion_id
          GROUP BY sc.spell_id
        ), sd AS (
          SELECT sds.spell_data_id,
                 string_agg(concat_ws('~', sp.target, sp.tick_count, sp.tick_interval, sp.spell_id,
                                      sp.spell_format, sp.spell_params::text, sc.s), '^' ORDER BY sp.id) s
          FROM {s}.spell_data_spells sds JOIN {s}.spells sp ON sp.id = sds.spell_id
          LEFT JOIN sc ON sc.spell_id = sp.id
          GROUP BY sds.spell_data_id
        )
        SELECT isd.item_id, string_agg(d.event || '{{' || coalesce(sd.s, '') || '}}', ';' ORDER BY d.id) s
        FROM {s}.item_spell_data isd JOIN {s}.spell_data d ON d.id = isd.spell_data_id
        LEFT JOIN sd ON sd.spell_data_id = d.id
        GROUP BY isd.item_id
    """))
    conn.execute(text(f"""
        CREATE TEMP TABLE _ss_fp ON COMMIT DROP AS
        SELECT i.id item_id, i.aoid,
               md5(concat_ws('|', i.aoid, i.name, i.ql, i.description, i.item_class, i.is_nano,
                             i.content_hash, st.s, ad.s, act.s, spl.s))::char(32) fp
        FROM {s}.items i
        LEFT JOIN _ss_fp_stats st ON st.item_id = i.id
        LEFT JOIN _ss_fp_ad ad ON ad.item_id = i.id
        LEFT JOIN _ss_fp_act act ON act.item_id = i.id
        LEFT JOIN _ss_fp_spl spl ON spl.item_id = i.id
    """))
    conn.execute(text("CREATE UNIQUE INDEX ON _ss_fp (item_id)"))
    conn.execute(text("ANALYZE _ss_fp"))
    return conn.execute(text("SELECT count(*) FROM _ss_fp")).scalar()


# ---------------------------------------------------------------------------
# Store creation and merge
# ---------------------------------------------------------------------------


def ensure_item_revisions_view(conn: Connection, store: str = STORE_SCHEMA) -> None:
    """Replace the ``public.item_revisions`` table with a view over the store.

    One row per (AOID, version), as the table had; the change-history endpoints
    read it unchanged.
    """
    g = _ident(store)
    if relkind(conn, "public", "item_revisions") == "r":
        conn.execute(text("DROP TABLE public.item_revisions"))
    conn.execute(text(f"""
        CREATE OR REPLACE VIEW public.item_revisions AS
        SELECT i.aoid,
               g.slug AS version_slug,
               i.content_hash,
               i.stats_hash,
               i.spells_hash,
               i.actions_hash,
               i.text_hash,
               COALESCE(i.is_nano, FALSE) AS is_nano
        FROM {g}.items i
        CROSS JOIN LATERAL unnest(i.vids) AS m(vid)
        JOIN public.game_versions g ON g.vid = m.vid
        WHERE i.content_hash IS NOT NULL
    """))


def _adopt_as_store(conn: Connection, source: str, store: str, vid: int) -> int:
    """Create the store from the source's own tables (no copy; ids and
    sequences move with them)."""
    s, g = _ident(source), _ident(store)
    conn.execute(text(f"CREATE SCHEMA {g}"))
    for table in CONTENT_TABLES:
        conn.execute(text(f"ALTER TABLE {s}.{table} SET SCHEMA {g}"))
    conn.execute(text(f"ALTER TABLE {g}.items ADD COLUMN storage_fp CHAR(32)"))
    conn.execute(
        text(
            f"UPDATE {g}.items i SET storage_fp = f.fp FROM _ss_fp f WHERE f.item_id = i.id"
        )
    )
    conn.execute(text(f"ALTER TABLE {g}.items ALTER COLUMN storage_fp SET NOT NULL"))
    conn.execute(
        text(
            f"ALTER TABLE {g}.items ADD COLUMN vids SMALLINT[] NOT NULL DEFAULT '{{}}'"
        )
    )
    count = conn.execute(
        text(f"UPDATE {g}.items SET vids = ARRAY[:vid]::smallint[]"), {"vid": vid}
    ).rowcount
    conn.execute(
        text(
            f"CREATE UNIQUE INDEX IF NOT EXISTS uq_items_aoid_fp ON {g}.items (aoid, storage_fp)"
        )
    )
    conn.execute(
        text(f"CREATE INDEX IF NOT EXISTS idx_items_vids ON {g}.items USING gin (vids)")
    )
    # The store records which content migrations its tables carry.
    conn.execute(
        text(
            f"CREATE TABLE {g}.schema_migrations (LIKE {s}.schema_migrations INCLUDING ALL)"
        )
    )
    conn.execute(
        text(f"INSERT INTO {g}.schema_migrations SELECT * FROM {s}.schema_migrations")
    )
    ensure_item_revisions_view(conn, store)
    logger.info("Created store %s from %s (%d revisions)", store, source, count)
    return count


def _id_map(conn: Connection, name: str, old_ids_sql: str, sequence: str) -> int:
    """Temp table ``name(old_id, new_id)`` assigning sequence values in old-id order."""
    conn.execute(text(f"DROP TABLE IF EXISTS {name}"))
    conn.execute(
        text(f"""
        CREATE TEMP TABLE {name} ON COMMIT DROP AS
        SELECT old_id, nextval(:seq) AS new_id
        FROM (SELECT DISTINCT old_id FROM ({old_ids_sql}) q WHERE old_id IS NOT NULL
              ORDER BY old_id) o
    """),
        {"seq": sequence},
    )
    conn.execute(text(f"CREATE UNIQUE INDEX ON {name} (old_id)"))
    conn.execute(text(f"ANALYZE {name}"))
    return conn.execute(text(f"SELECT count(*) FROM {name}")).scalar()


def _dictionary_map(
    conn: Connection,
    source: str,
    store: str,
    table: str,
    cols: Sequence[str],
    name: str,
) -> None:
    s, g = _ident(source), _ident(store)
    collist = ", ".join(cols)
    conn.execute(
        text(
            f"INSERT INTO {g}.{table} ({collist}) SELECT {collist} FROM {s}.{table} "
            f"ORDER BY id ON CONFLICT ({collist}) DO NOTHING"
        )
    )
    conn.execute(text(f"DROP TABLE IF EXISTS {name}"))
    conn.execute(
        text(
            f"CREATE TEMP TABLE {name} ON COMMIT DROP AS SELECT p.id AS old_id, x.id AS new_id "
            f"FROM {s}.{table} p JOIN {g}.{table} x USING ({collist})"
        )
    )
    conn.execute(text(f"CREATE UNIQUE INDEX ON {name} (old_id)"))
    conn.execute(text(f"ANALYZE {name}"))
    mapped = conn.execute(text(f"SELECT count(*) FROM {name}")).scalar()
    total = conn.execute(text(f"SELECT count(*) FROM {s}.{table}")).scalar()
    if mapped != total:
        raise SharedStoreError(
            f"{source}.{table}: only {mapped} of {total} rows map onto {store}.{table} "
            "(NULL values in the dictionary key?)"
        )


def _seq(conn: Connection, store: str, table: str) -> str:
    seq = conn.execute(
        text("SELECT pg_get_serial_sequence(:t, 'id')"), {"t": f"{store}.{table}"}
    ).scalar()
    if not seq:
        raise SharedStoreError(f"{store}.{table}.id has no sequence")
    return seq


@dataclass
class MergeStats:
    items: int = 0
    reused: int = 0
    new: int = 0


def _merge_into_store(conn: Connection, source: str, store: str) -> MergeStats:
    """Copy the source's revisions that the store lacks; build ``_ss_it`` mapping
    every source item id to its revision id."""
    s, g = _ident(source), _ident(store)

    _dictionary_map(conn, source, store, "stat_values", ("stat", "value"), "_ss_sv")
    _dictionary_map(
        conn, source, store, "criteria", ("value1", "value2", "operator"), "_ss_cr"
    )

    conn.execute(text("DROP TABLE IF EXISTS _ss_it"))
    conn.execute(text(f"""
        CREATE TEMP TABLE _ss_it ON COMMIT DROP AS
        SELECT f.item_id AS old_id, x.id AS new_id, (x.id IS NULL) AS is_new
        FROM _ss_fp f LEFT JOIN {g}.items x ON x.aoid = f.aoid AND x.storage_fp = f.fp
    """))
    _id_map(
        conn,
        "_ss_newid",
        "SELECT old_id FROM _ss_it WHERE is_new",
        _seq(conn, store, "items"),
    )
    conn.execute(
        text(
            "UPDATE _ss_it t SET new_id = n.new_id FROM _ss_newid n WHERE n.old_id = t.old_id"
        )
    )
    conn.execute(text("CREATE UNIQUE INDEX ON _ss_it (old_id)"))
    conn.execute(text("ANALYZE _ss_it"))

    new_items = (
        f"SELECT i.* FROM {s}.items i JOIN _ss_it m ON m.old_id = i.id AND m.is_new"
    )
    _id_map(
        conn,
        "_ss_ad",
        f"SELECT atkdef_id AS old_id FROM ({new_items}) n",
        _seq(conn, store, "attack_defense"),
    )
    _id_map(
        conn,
        "_ss_am",
        f"SELECT animation_mesh_id AS old_id FROM ({new_items}) n",
        _seq(conn, store, "animation_mesh"),
    )
    _id_map(
        conn,
        "_ss_act",
        f"SELECT a.id AS old_id FROM {s}.actions a "
        "JOIN _ss_it m ON m.old_id = a.item_id AND m.is_new",
        _seq(conn, store, "actions"),
    )
    _id_map(
        conn,
        "_ss_sd",
        f"SELECT x.spell_data_id AS old_id FROM {s}.item_spell_data x "
        "JOIN _ss_it m ON m.old_id = x.item_id AND m.is_new",
        _seq(conn, store, "spell_data"),
    )
    _id_map(
        conn,
        "_ss_sp",
        f"SELECT x.spell_id AS old_id FROM {s}.spell_data_spells x "
        "JOIN _ss_sd sd ON sd.old_id = x.spell_data_id",
        _seq(conn, store, "spells"),
    )
    _id_map(
        conn,
        "_ss_sh",
        f"SELECT x.shop_hash_id AS old_id FROM {s}.item_shop_hash x "
        "JOIN _ss_it m ON m.old_id = x.item_id AND m.is_new",
        _seq(conn, store, "shop_hash"),
    )

    statements = [
        f"INSERT INTO {g}.attack_defense (id) SELECT new_id FROM _ss_ad ORDER BY new_id",
        f"""INSERT INTO {g}.attack_defense_attack (attack_defense_id, stat_value_id)
            SELECT m.new_id, sv.new_id FROM {s}.attack_defense_attack a
            JOIN _ss_ad m ON m.old_id = a.attack_defense_id
            JOIN _ss_sv sv ON sv.old_id = a.stat_value_id""",
        f"""INSERT INTO {g}.attack_defense_defense (attack_defense_id, stat_value_id)
            SELECT m.new_id, sv.new_id FROM {s}.attack_defense_defense a
            JOIN _ss_ad m ON m.old_id = a.attack_defense_id
            JOIN _ss_sv sv ON sv.old_id = a.stat_value_id""",
        f"""INSERT INTO {g}.animation_mesh (id, animation_id, mesh_id)
            SELECT m.new_id, sa.new_id, sm.new_id FROM {s}.animation_mesh am
            JOIN _ss_am m ON m.old_id = am.id
            LEFT JOIN _ss_sv sa ON sa.old_id = am.animation_id
            LEFT JOIN _ss_sv sm ON sm.old_id = am.mesh_id
            ORDER BY m.new_id""",
        f"""INSERT INTO {g}.shop_hash (id, hash, min_level, max_level, base_amount,
                                       regen_amount, regen_interval, spawn_chance)
            SELECT m.new_id, h.hash, h.min_level, h.max_level, h.base_amount,
                   h.regen_amount, h.regen_interval, h.spawn_chance
            FROM {s}.shop_hash h JOIN _ss_sh m ON m.old_id = h.id ORDER BY m.new_id""",
        f"""INSERT INTO {g}.items (id, aoid, name, ql, description, item_class, is_nano,
                                   atkdef_id, animation_mesh_id, content_hash, stats_hash,
                                   spells_hash, actions_hash, text_hash, storage_fp, vids)
            SELECT m.new_id, i.aoid, i.name, i.ql, i.description, i.item_class, i.is_nano,
                   ad.new_id, am.new_id, i.content_hash, i.stats_hash, i.spells_hash,
                   i.actions_hash, i.text_hash, f.fp, '{{}}'
            FROM {s}.items i
            JOIN _ss_it m ON m.old_id = i.id AND m.is_new
            JOIN _ss_fp f ON f.item_id = i.id
            LEFT JOIN _ss_ad ad ON ad.old_id = i.atkdef_id
            LEFT JOIN _ss_am am ON am.old_id = i.animation_mesh_id
            ORDER BY m.new_id""",
        f"""INSERT INTO {g}.item_stats (item_id, stat_value_id)
            SELECT m.new_id, sv.new_id FROM {s}.item_stats x
            JOIN _ss_it m ON m.old_id = x.item_id AND m.is_new
            JOIN _ss_sv sv ON sv.old_id = x.stat_value_id""",
        f"""INSERT INTO {g}.actions (id, action, item_id)
            SELECT am.new_id, a.action, m.new_id FROM {s}.actions a
            JOIN _ss_act am ON am.old_id = a.id
            JOIN _ss_it m ON m.old_id = a.item_id
            ORDER BY am.new_id""",
        f"""INSERT INTO {g}.action_criteria (action_id, criterion_id, order_index)
            SELECT am.new_id, c.new_id, ac.order_index FROM {s}.action_criteria ac
            JOIN _ss_act am ON am.old_id = ac.action_id
            JOIN _ss_cr c ON c.old_id = ac.criterion_id
            ORDER BY ac.id""",
        f"""INSERT INTO {g}.spell_data (id, event)
            SELECT sd.new_id, d.event FROM {s}.spell_data d
            JOIN _ss_sd sd ON sd.old_id = d.id ORDER BY sd.new_id""",
        f"""INSERT INTO {g}.item_spell_data (item_id, spell_data_id)
            SELECT m.new_id, sd.new_id FROM {s}.item_spell_data x
            JOIN _ss_it m ON m.old_id = x.item_id AND m.is_new
            JOIN _ss_sd sd ON sd.old_id = x.spell_data_id""",
        f"""INSERT INTO {g}.spells (id, target, tick_count, tick_interval, spell_id,
                                    spell_format, spell_params)
            SELECT sp.new_id, x.target, x.tick_count, x.tick_interval, x.spell_id,
                   x.spell_format, x.spell_params
            FROM {s}.spells x JOIN _ss_sp sp ON sp.old_id = x.id ORDER BY sp.new_id""",
        f"""INSERT INTO {g}.spell_data_spells (spell_data_id, spell_id)
            SELECT sd.new_id, sp.new_id FROM {s}.spell_data_spells x
            JOIN _ss_sd sd ON sd.old_id = x.spell_data_id
            JOIN _ss_sp sp ON sp.old_id = x.spell_id""",
        f"""INSERT INTO {g}.spell_criteria (spell_id, criterion_id)
            SELECT sp.new_id, c.new_id FROM {s}.spell_criteria x
            JOIN _ss_sp sp ON sp.old_id = x.spell_id
            JOIN _ss_cr c ON c.old_id = x.criterion_id""",
        f"""INSERT INTO {g}.item_shop_hash (item_id, shop_hash_id)
            SELECT m.new_id, sh.new_id FROM {s}.item_shop_hash x
            JOIN _ss_it m ON m.old_id = x.item_id AND m.is_new
            JOIN _ss_sh sh ON sh.old_id = x.shop_hash_id""",
        f"""INSERT INTO {g}.nano_properties (item_id, school, professions, min_level, strain)
            SELECT m.new_id, p.school, p.professions, p.min_level, p.strain
            FROM {s}.nano_properties p
            JOIN _ss_it m ON m.old_id = p.item_id AND m.is_new""",
    ]
    for sql in statements:
        conn.execute(text(sql))

    stats = MergeStats()
    stats.items, stats.new = conn.execute(
        text("SELECT count(*), count(*) FILTER (WHERE is_new) FROM _ss_it")
    ).one()
    stats.reused = stats.items - stats.new
    return stats


def _repoint_curated_foreign_keys(
    conn: Connection, source: str, store: str, remap: bool
) -> List[str]:
    """Point curated tables' foreign keys at ``store.items``.

    With ``remap`` the referencing column is rewritten from source item ids to
    revision ids through ``_ss_it`` first. Any other foreign key from a curated
    table into a content table is an error: the merge would not know how to
    carry it.
    """
    s, g = _ident(source), _ident(store)
    fks = (
        conn.execute(
            text("""
        SELECT cl.relname AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def,
               rcl.relname AS ref, rn.nspname AS ref_schema
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace
        JOIN pg_class rcl ON rcl.oid = c.confrelid
        JOIN pg_namespace rn ON rn.oid = rcl.relnamespace
        WHERE c.contype = 'f' AND n.nspname = :src
          AND cl.relname = ANY(:curated) AND rcl.relname = ANY(:content)
        ORDER BY 1, 2
    """),
            {
                "src": source,
                "curated": list(CURATED_TABLES),
                "content": list(CONTENT_TABLES),
            },
        )
        .mappings()
        .all()
    )

    done = []
    for fk in fks:
        if fk["ref_schema"] == store:
            continue  # already points at the store (adopted tables)
        match = _FK_TO_ITEMS_RE.match(fk["def"])
        if fk["ref"] != "items" or not match:
            raise SharedStoreError(
                f"{source}.{fk['tbl']} constraint {fk['conname']} ({fk['def']}) refers to "
                "a content table in a way the shared store cannot carry"
            )
        column, tail = match.group(1), match.group(2)
        tbl = f"{s}.{_ident(fk['tbl'])}"
        conn.execute(text(f'ALTER TABLE {tbl} DROP CONSTRAINT "{fk["conname"]}"'))
        if remap:
            # Negate first: the column may be a primary key, and old and new
            # ids overlap.
            conn.execute(text(f"UPDATE {tbl} SET {column} = -{column}"))
            conn.execute(
                text(
                    f"UPDATE {tbl} t SET {column} = m.new_id FROM _ss_it m "
                    f"WHERE m.old_id = -t.{column}"
                )
            )
            left = conn.execute(
                text(f"SELECT count(*) FROM {tbl} WHERE {column} < 0")
            ).scalar()
            if left:
                raise SharedStoreError(
                    f"{source}.{fk['tbl']}: {left} rows reference items that are not "
                    f"in {source}.items"
                )
        conn.execute(
            text(
                f'ALTER TABLE {tbl} ADD CONSTRAINT "{fk["conname"]}" '
                f"FOREIGN KEY ({column}) REFERENCES {g}.items(id){tail}"
            )
        )
        done.append(f"{fk['tbl']}.{column}")
    return done


# ---------------------------------------------------------------------------
# Version schema: views and symbiant_items
# ---------------------------------------------------------------------------


@dataclass
class MatviewDefinition:
    query: str
    indexes: List[str] = field(default_factory=list)


def capture_matview(conn: Connection, schema: str) -> Optional[MatviewDefinition]:
    """``symbiant_items`` as SQL with names unqualified, so it can be recreated
    over the version's views."""
    if relkind(conn, schema, MATVIEW) != "m":
        return None
    previous = conn.execute(text("SELECT current_setting('search_path')")).scalar()
    conn.execute(
        text("SELECT set_config('search_path', :p, true)"), {"p": _ident(schema)}
    )
    try:
        query = conn.execute(
            text("SELECT pg_get_viewdef(CAST(:rel AS regclass), true)"),
            {"rel": f"{_ident(schema)}.{MATVIEW}"},
        ).scalar()
    finally:
        conn.execute(
            text("SELECT set_config('search_path', :p, true)"), {"p": previous}
        )
    indexes = (
        conn.execute(
            text(
                "SELECT indexdef FROM pg_indexes WHERE schemaname = :s AND tablename = :t "
                "ORDER BY indexname"
            ),
            {"s": schema, "t": MATVIEW},
        )
        .scalars()
        .all()
    )
    prefix = f"ON {schema}.{MATVIEW} "
    unqualified = []
    for idx in indexes:
        if prefix not in idx:
            raise SharedStoreError(
                f"Unexpected index definition on {schema}.{MATVIEW}: {idx}"
            )
        unqualified.append(idx.replace(prefix, f"ON {MATVIEW} "))
    return MatviewDefinition(query=query.rstrip().rstrip(";"), indexes=unqualified)


def create_version_views(
    conn: Connection, schema: str, vid: int, store: str = STORE_SCHEMA
) -> None:
    """Views over the store in one version schema (CREATE OR REPLACE: re-runnable)."""
    v, g = _ident(schema), _ident(store)
    item_cols = ", ".join(f"i.{c}" for c in CONTENT_COLUMNS["items"])
    conn.execute(
        text(
            f"CREATE OR REPLACE VIEW {v}.items AS SELECT {item_cols} FROM {g}.items i "
            f"WHERE i.vids @> ARRAY[{int(vid)}]::smallint[]"
        )
    )
    for table in CONTENT_TABLES:
        if table == "items":
            continue
        conn.execute(
            text(f"CREATE OR REPLACE VIEW {v}.{table} AS SELECT * FROM {g}.{table}")
        )


def create_matview(
    conn: Connection, schema: str, definition: MatviewDefinition
) -> None:
    v = _ident(schema)
    previous = conn.execute(text("SELECT current_setting('search_path')")).scalar()
    conn.execute(
        text("SELECT set_config('search_path', :p, true)"), {"p": f"{v}, public"}
    )
    try:
        conn.execute(text(f"DROP MATERIALIZED VIEW IF EXISTS {v}.{MATVIEW}"))
        conn.execute(
            text(f"CREATE MATERIALIZED VIEW {v}.{MATVIEW} AS {definition.query}")
        )
        for idx in definition.indexes:
            conn.execute(text(idx))
    finally:
        conn.execute(
            text("SELECT set_config('search_path', :p, true)"), {"p": previous}
        )


# ---------------------------------------------------------------------------
# Membership and garbage collection
# ---------------------------------------------------------------------------


def remove_membership(conn: Connection, vid: int, store: str = STORE_SCHEMA) -> int:
    g = _ident(store)
    return conn.execute(
        text(
            f"UPDATE {g}.items SET vids = array_remove(vids, CAST(:vid AS smallint)) "
            "WHERE vids @> ARRAY[CAST(:vid AS smallint)]"
        ),
        {"vid": vid},
    ).rowcount


def add_membership_from_map(
    conn: Connection, vid: int, store: str = STORE_SCHEMA
) -> int:
    g = _ident(store)
    return conn.execute(
        text(
            f"UPDATE {g}.items x SET vids = array_append(x.vids, CAST(:vid AS smallint)) "
            "FROM (SELECT DISTINCT new_id FROM _ss_it) m "
            "WHERE x.id = m.new_id AND NOT x.vids @> ARRAY[CAST(:vid AS smallint)]"
        ),
        {"vid": vid},
    ).rowcount


def copy_membership(
    conn: Connection, from_vid: int, to_vid: int, store: str = STORE_SCHEMA
) -> int:
    g = _ident(store)
    return conn.execute(
        text(
            f"UPDATE {g}.items SET vids = array_append(vids, CAST(:to AS smallint)) "
            "WHERE vids @> ARRAY[CAST(:src AS smallint)] "
            "AND NOT vids @> ARRAY[CAST(:to AS smallint)]"
        ),
        {"src": from_vid, "to": to_vid},
    ).rowcount


def check_version_unique(conn: Connection, vid: int, store: str = STORE_SCHEMA) -> None:
    g = _ident(store)
    dupes = (
        conn.execute(
            text(
                f"SELECT aoid FROM {g}.items WHERE vids @> ARRAY[CAST(:vid AS smallint)] "
                "GROUP BY aoid HAVING count(*) > 1 LIMIT 5"
            ),
            {"vid": vid},
        )
        .scalars()
        .all()
    )
    if dupes:
        raise SharedStoreError(
            f"vid {vid} would hold several revisions of AOIDs {dupes}"
        )


def collect_garbage(conn: Connection, store: str = STORE_SCHEMA) -> Dict[str, int]:
    """Delete revisions no version holds, and the child rows only they used.

    Dictionary rows (stat_values, criteria) are kept: they are shared and tiny.
    """
    g = _ident(store)
    conn.execute(text("DROP TABLE IF EXISTS _ss_gc"))
    conn.execute(
        text(
            f"CREATE TEMP TABLE _ss_gc ON COMMIT DROP AS "
            f"SELECT id, atkdef_id, animation_mesh_id FROM {g}.items WHERE vids = '{{}}'"
        )
    )
    counts = {"items": conn.execute(text("SELECT count(*) FROM _ss_gc")).scalar()}
    if not counts["items"]:
        return counts

    conn.execute(text("DROP TABLE IF EXISTS _ss_gc_sd, _ss_gc_sp, _ss_gc_sh"))
    conn.execute(
        text(
            f"CREATE TEMP TABLE _ss_gc_sd ON COMMIT DROP AS SELECT DISTINCT x.spell_data_id AS id "
            f"FROM {g}.item_spell_data x JOIN _ss_gc d ON d.id = x.item_id"
        )
    )
    conn.execute(
        text(
            f"CREATE TEMP TABLE _ss_gc_sp ON COMMIT DROP AS SELECT DISTINCT x.spell_id AS id "
            f"FROM {g}.spell_data_spells x JOIN _ss_gc_sd d ON d.id = x.spell_data_id"
        )
    )
    conn.execute(
        text(
            f"CREATE TEMP TABLE _ss_gc_sh ON COMMIT DROP AS SELECT DISTINCT x.shop_hash_id AS id "
            f"FROM {g}.item_shop_hash x JOIN _ss_gc d ON d.id = x.item_id"
        )
    )
    # Children of items cascade: item_stats, item_spell_data, actions and their
    # criteria, item_shop_hash, nano_properties, item_sources. A perk still
    # pointing at the revision (no cascade) makes this fail, as it should.
    conn.execute(text(f"DELETE FROM {g}.items x USING _ss_gc d WHERE x.id = d.id"))
    counts["spell_data"] = conn.execute(
        text(
            f"DELETE FROM {g}.spell_data x USING _ss_gc_sd d WHERE x.id = d.id "
            f"AND NOT EXISTS (SELECT 1 FROM {g}.item_spell_data r WHERE r.spell_data_id = x.id)"
        )
    ).rowcount
    counts["spells"] = conn.execute(
        text(
            f"DELETE FROM {g}.spells x USING _ss_gc_sp d WHERE x.id = d.id "
            f"AND NOT EXISTS (SELECT 1 FROM {g}.spell_data_spells r WHERE r.spell_id = x.id)"
        )
    ).rowcount
    counts["attack_defense"] = conn.execute(
        text(
            f"DELETE FROM {g}.attack_defense x USING (SELECT DISTINCT atkdef_id AS id FROM _ss_gc) d "
            f"WHERE x.id = d.id AND NOT EXISTS (SELECT 1 FROM {g}.items r WHERE r.atkdef_id = x.id)"
        )
    ).rowcount
    counts["animation_mesh"] = conn.execute(
        text(
            f"DELETE FROM {g}.animation_mesh x "
            f"USING (SELECT DISTINCT animation_mesh_id AS id FROM _ss_gc) d WHERE x.id = d.id "
            f"AND NOT EXISTS (SELECT 1 FROM {g}.items r WHERE r.animation_mesh_id = x.id)"
        )
    ).rowcount
    counts["shop_hash"] = conn.execute(
        text(
            f"DELETE FROM {g}.shop_hash x USING _ss_gc_sh d WHERE x.id = d.id "
            f"AND NOT EXISTS (SELECT 1 FROM {g}.item_shop_hash r WHERE r.shop_hash_id = x.id)"
        )
    ).rowcount
    logger.info("Garbage-collected %s", counts)
    return counts


# ---------------------------------------------------------------------------
# High-level operations
# ---------------------------------------------------------------------------


@dataclass
class InstallResult:
    slug: str
    schema: str
    vid: int
    created_store: bool = False
    merge: MergeStats = field(default_factory=MergeStats)
    members: int = 0
    garbage: Dict[str, int] = field(default_factory=dict)


def _finish_version_schema(
    conn: Connection,
    source: str,
    target: str,
    vid: int,
    store: str,
    matview: MatviewDefinition,
) -> None:
    """Views + matview in ``source``, then make it ``target``."""
    create_version_views(conn, source, vid, store)
    create_matview(conn, source, matview)
    if source != target:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {_ident(target)} CASCADE"))
        conn.execute(text(f"ALTER SCHEMA {_ident(source)} RENAME TO {_ident(target)}"))


def _drop_content_tables(conn: Connection, source: str) -> None:
    s = _ident(source)
    tables = ", ".join(f"{s}.{t}" for t in CONTENT_TABLES)
    conn.execute(text(f"DROP TABLE {tables} CASCADE"))


def install_schema(
    conn: Connection, source: str, fields: Dict, store: str = STORE_SCHEMA
) -> InstallResult:
    """Install a classic-layout schema as version ``fields['slug']``.

    ``source`` is a staging schema (renamed to ``gv_<slug>`` at the end, replacing
    any previous schema of that version) or the version's own schema (converted
    in place). Re-installing a version replaces its membership: revisions it no
    longer holds are garbage-collected unless another version holds them.
    """
    slug = fields["slug"]
    target = schema_name_for(slug)
    _ident(source)
    lock(conn)

    if schema_layout(conn, source) != "tables":
        raise SharedStoreError(f"{source} is not in the per-version table layout")
    has_store = store_exists(conn, store)
    check_source_compatible(conn, source, store if has_store else None)
    check_unique_aoids(conn, source)

    matview = capture_matview(conn, source)
    if matview is None:
        raise SharedStoreError(
            f"{source}.{MATVIEW} is missing; run the migrations first"
        )
    conn.execute(text(f"DROP MATERIALIZED VIEW {_ident(source)}.{MATVIEW}"))

    vid = register(conn, fields)
    result = InstallResult(slug=slug, schema=target, vid=vid)
    total = compute_fingerprints(conn, source)

    if not has_store:
        result.created_store = True
        _adopt_as_store(conn, source, store, vid)
        result.merge = MergeStats(items=total, new=total)
    else:
        remove_membership(conn, vid, store)
        result.merge = _merge_into_store(conn, source, store)
        add_membership_from_map(conn, vid, store)
        _repoint_curated_foreign_keys(conn, source, store, remap=True)
        _drop_content_tables(conn, source)

    _finish_version_schema(conn, source, target, vid, store, matview)
    check_version_unique(conn, vid, store)
    result.members = conn.execute(
        text(f"SELECT count(*) FROM {_ident(target)}.items")
    ).scalar()
    if result.members != total:
        raise SharedStoreError(
            f"{target} shows {result.members} items after install, the source had {total}"
        )
    result.garbage = collect_garbage(conn, store)
    logger.info(
        "Installed %s as %s (vid %d): %d items, %d new revisions, %d reused",
        source,
        target,
        vid,
        total,
        result.merge.new,
        result.merge.reused,
    )
    return result


def install_duplicate(
    conn: Connection,
    staging: str,
    fields: Dict,
    source_slug: str,
    store: str = STORE_SCHEMA,
) -> InstallResult:
    """Register a build whose data is identical to ``source_slug``'s.

    ``staging`` is an empty, migrated schema; it receives copies of the source
    version's curated rows and views over the source's revisions, then becomes
    ``gv_<slug>``. No item data is read or copied.
    """
    slug = fields["slug"]
    target = schema_name_for(slug)
    lock(conn)
    if not store_exists(conn, store):
        raise SharedStoreError("No shared store yet; install the source version first")
    src_row = version_row(conn, source_slug)
    src_schema = schema_name_for(source_slug)
    if (
        not src_row
        or src_row.get("vid") is None
        or schema_layout(conn, src_schema) != "shared"
    ):
        raise SharedStoreError(
            f"'{slug}' duplicates '{source_slug}', which is not installed in the shared store"
        )
    if schema_layout(conn, staging) != "tables":
        raise SharedStoreError(f"{staging} is not a migrated staging schema")
    if conn.execute(text(f"SELECT count(*) FROM {_ident(staging)}.items")).scalar():
        raise SharedStoreError(f"{staging} is not empty")
    check_source_compatible(conn, staging, store)

    matview = capture_matview(conn, staging)
    if matview is None:
        raise SharedStoreError(f"{staging}.{MATVIEW} is missing")
    conn.execute(text(f"DROP MATERIALIZED VIEW {_ident(staging)}.{MATVIEW}"))

    vid = register(conn, fields)
    result = InstallResult(slug=slug, schema=target, vid=vid)
    remove_membership(conn, vid, store)
    copy_membership(conn, int(src_row["vid"]), vid, store)

    _repoint_curated_foreign_keys(conn, staging, store, remap=False)
    _drop_content_tables(conn, staging)
    st, src = _ident(staging), _ident(src_schema)
    for table in CURATED_TABLES:
        if table == "schema_migrations":
            continue
        if _columns(conn, staging, table) != _columns(conn, src_schema, table):
            raise SharedStoreError(f"{staging}.{table} and {src_schema}.{table} differ")
        conn.execute(text(f"DELETE FROM {st}.{table}"))
    # Parents before children for the foreign keys.
    for table in (
        "source_types",
        "sources",
        "mobs",
        "perks",
        "item_sources",
        "application_cache",
    ):
        conn.execute(text(f"INSERT INTO {st}.{table} SELECT * FROM {src}.{table}"))
        seq = (
            conn.execute(
                text("SELECT pg_get_serial_sequence(:t, 'id')"),
                {"t": f"{staging}.{table}"},
            ).scalar()
            if "id" in _columns(conn, staging, table)
            else None
        )
        if seq:
            conn.execute(
                text(
                    f"SELECT setval(:seq, COALESCE((SELECT max(id) FROM {st}.{table}), 0) + 1, false)"
                ),
                {"seq": seq},
            )

    _finish_version_schema(conn, staging, target, vid, store, matview)
    result.members = conn.execute(
        text(f"SELECT count(*) FROM {_ident(target)}.items")
    ).scalar()
    result.garbage = collect_garbage(conn, store)
    logger.info(
        "Registered %s as a duplicate of %s (vid %d, %d items)",
        slug,
        source_slug,
        vid,
        result.members,
    )
    return result


def remove_version(
    conn: Connection, slug: str, store: str = STORE_SCHEMA
) -> Dict[str, int]:
    """Drop a version: its membership, its schema and its registry row, then GC."""
    lock(conn)
    schema = schema_name_for(slug)
    row = version_row(conn, slug)
    result: Dict[str, int] = {"memberships": 0}
    if row and row.get("vid") is not None and store_exists(conn, store):
        result["memberships"] = remove_membership(conn, int(row["vid"]), store)
    conn.execute(text(f"DROP SCHEMA IF EXISTS {_ident(schema)} CASCADE"))
    result["registry_rows"] = conn.execute(
        text("DELETE FROM public.game_versions WHERE slug = :slug"), {"slug": slug}
    ).rowcount
    if store_exists(conn, store):
        result.update({f"gc_{k}": v for k, v in collect_garbage(conn, store).items()})
    return result


def resync_duplicates(
    conn: Connection, slug: str, store: str = STORE_SCHEMA
) -> List[str]:
    """After re-installing ``slug``, point registered duplicates of it at its
    current revisions (they keep their own curated rows)."""
    row = version_row(conn, slug)
    if not row or row.get("vid") is None:
        return []
    dups = conn.execute(
        text(
            "SELECT slug, vid FROM public.game_versions "
            "WHERE extract_slug = :s AND slug <> :s AND vid IS NOT NULL"
        ),
        {"s": slug},
    ).all()
    for dup_slug, dup_vid in dups:
        remove_membership(conn, int(dup_vid), store)
        copy_membership(conn, int(row["vid"]), int(dup_vid), store)
    if dups:
        collect_garbage(conn, store)
    return [d[0] for d in dups]


def legacy_versions(conn: Connection) -> List[Dict]:
    """Registered versions still in the per-version table layout, default first."""
    rows = (
        conn.execute(
            text(
                "SELECT * FROM public.game_versions ORDER BY is_default DESC, sort_order, slug"
            )
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows if schema_layout(conn, r["schema_name"]) == "tables"]


def convert_existing(
    conn: Connection, store: str = STORE_SCHEMA
) -> List[InstallResult]:
    """Convert every registered classic-layout version into the shared layout,
    in place. The default version goes first, so it keeps every surrogate id;
    the others reuse its revisions where identical.

    Versions already converted have their views refreshed. Safe to re-run.
    """
    lock(conn)
    results = []
    for row in legacy_versions(conn):
        fields = {
            k: row[k]
            for k in (
                "slug",
                "display_name",
                "family",
                "parent_slug",
                "client_build",
                "snapshot_date",
                "sort_order",
                "enabled",
                "is_default",
                "features",
                "notes",
                "extract_slug",
                "tinkerparse_commit",
                "rdb_dat_sha256",
            )
        }
        results.append(install_schema(conn, row["schema_name"], fields, store))
    for row in conn.execute(
        text("SELECT schema_name, vid FROM public.game_versions WHERE vid IS NOT NULL")
    ).all():
        if schema_layout(conn, row[0]) == "shared":
            create_version_views(conn, row[0], int(row[1]), store)
    if store_exists(conn, store):
        ensure_item_revisions_view(conn, store)
    return results
