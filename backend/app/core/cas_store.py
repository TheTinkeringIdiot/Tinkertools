"""
Importer for the content-addressed game data store.

Design: docs/plans/content-addressed-store/design.md section 3. Tables:
backend/database/cas/001_store.sql and 002_curated_and_derived.sql. Canonical
part documents and hashes: app/core/parts.py.

A build is imported in one transaction by :func:`import_build`:

1. Every record of the build is split into parts and hashed (:func:`split_records`,
   or a worker process of app/core/cas_extract.py), and one row per item
   (AOID, scalar columns, hashes) is staged in a temporary table.
2. Items whose ``(aoid, revision hash)`` the store does not hold are new
   revisions. Only their parts can be new, so only those part documents are
   fetched, stored and projected into the search tables.
3. The staged items are compared with the branch's open presence runs: a run
   whose item is gone or has another revision is closed at the previous build,
   and a run is opened for every item that has none with its revision. The
   same comparison writes the change log.
4. Derived rows are added for what the build brought: symbiant rows for new
   revisions, nano properties for the build's nanos under its strain policy.

Rules:

- Builds of a branch are imported oldest first. A build older than the newest
  one already in its branch is refused, because presence runs are extended at
  their open end only.
- A build already in the store is left alone, so an import can be re-run.
- A build whose data is the same extract as the branch's newest build is
  recorded without touching presence: open runs already cover it.
- The first build of a branch that has a parent build is compared with the
  parent's content for the change log; its presence runs all start at it.
- Nothing commits here. The caller owns the transaction.
"""

from __future__ import annotations

import logging
import re
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from app.core import nano_properties
from app.core.parts import PART_NAMES, effect_formats, split_item

logger = logging.getLogger(__name__)

OPEN_RUN = 2147483647
PART_BITS = {name: 1 << index for index, name in enumerate(PART_NAMES)}
PART_TABLES = {
    "text": ("part_text", "text_id"),
    "stats": ("part_stats", "stats_id"),
    "effects": ("part_effects", "effects_id"),
    "actions": ("part_actions", "actions_id"),
    "atkdef": ("part_atkdef", "atkdef_id"),
    "misc": ("part_misc", "misc_id"),
}

STAT_NANO_STRAIN = 75
STAT_NANO_SUBSTRAIN = 1003
STAT_SLOT = 298
# Own strain values that say "no strain".
UNUSABLE_STRAINS = (None, 0, 99999)

SQL_DIR = Path(__file__).resolve().parents[2] / "database" / "cas"
_SCHEMA_NAME = re.compile(r"^[a-z][a-z0-9_]{0,62}$")

Timings = Dict[str, float]


class StoreError(Exception):
    """An import that the store's rules do not allow."""


# ---------------------------------------------------------------------------
# Connection and schema
# ---------------------------------------------------------------------------


def validate_store_schema(schema: str) -> str:
    """``schema`` if a store may live there; the current store's schemas may not."""
    if not _SCHEMA_NAME.match(schema):
        raise StoreError(f"Invalid schema name: {schema!r}")
    if schema in ("public", "gd", "information_schema") or schema.startswith(
        ("gv_", "pg_")
    ):
        raise StoreError(f"Schema {schema!r} belongs to the current store")
    return schema


def libpq_url(database_url: str) -> str:
    """A SQLAlchemy-style URL (``postgresql+driver://``) as libpq takes it."""
    return re.sub(r"^postgresql\+\w+://", "postgresql://", database_url)


def connect(database_url: str, schema: str) -> psycopg.Connection:
    """A connection whose unqualified names resolve in ``schema`` only."""
    validate_store_schema(schema)
    conn = psycopg.connect(libpq_url(database_url))
    use_schema(conn, schema)
    conn.commit()
    return conn


def use_schema(conn: psycopg.Connection, schema: str, local: bool = False) -> None:
    conn.execute(
        sql.SQL("SET {} search_path TO {}").format(
            sql.SQL("LOCAL" if local else ""),
            sql.Identifier(validate_store_schema(schema)),
        )
    )


def store_exists(conn: psycopg.Connection, schema: str) -> bool:
    return (
        conn.execute(
            "SELECT 1 FROM pg_tables WHERE schemaname = %s AND tablename = 'build'",
            (schema,),
        ).fetchone()
        is not None
    )


def create_store(conn: psycopg.Connection, schema: str) -> bool:
    """Create the schema and the store's tables in it unless they exist.

    The connection's search_path must already name ``schema``. Returns whether
    the tables were created.
    """
    validate_store_schema(schema)
    conn.execute(
        sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema))
    )
    if store_exists(conn, schema):
        return False
    for path in sorted(SQL_DIR.glob("*.sql")):
        conn.execute(path.read_text(encoding="utf-8"))
    return True


def drop_store(conn: psycopg.Connection, schema: str) -> None:
    """Drop every table of ``schema``, keeping the schema itself.

    The schema is kept because the btree_gist extension lives in the first
    schema a store was created in, and dropping that schema would take the
    extension and every other store's presence constraint with it.
    """
    validate_store_schema(schema)
    tables = conn.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname = %s", (schema,)
    ).fetchall()
    for (table,) in tables:
        conn.execute(
            sql.SQL("DROP TABLE IF EXISTS {}.{} CASCADE").format(
                sql.Identifier(schema), sql.Identifier(table)
            )
        )


def analyze(conn: psycopg.Connection, schema: str) -> None:
    """Refresh planner statistics of the store's tables, and of nothing else."""
    validate_store_schema(schema)
    tables = conn.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname = %s", (schema,)
    ).fetchall()
    for (table,) in tables:
        conn.execute(
            sql.SQL("ANALYZE {}.{}").format(sql.Identifier(schema), sql.Identifier(table))
        )


@contextmanager
def phase(timings: Optional[Timings], name: str) -> Iterator[None]:
    """Add the wall-clock time of the block to ``timings[name]``."""
    started = time.perf_counter()
    try:
        yield
    finally:
        if timings is not None:
            timings[name] = timings.get(name, 0.0) + time.perf_counter() - started


# ---------------------------------------------------------------------------
# Build content
# ---------------------------------------------------------------------------

# aoid, is_nano, ql, item_class, revision hash, then one hash per part in
# PART_NAMES order (None for a part the item does not have).
ItemRow = Tuple[Any, ...]
ITEM_COLUMNS = ("aoid", "is_nano", "ql", "item_class", "hash") + tuple(
    f"{name}_hash" for name in PART_NAMES
)


class BuildContent:
    """The items of one build, split and hashed.

    ``rows`` has one :data:`ItemRow` per item, ``formats`` maps each effect
    type to its format template, and :meth:`documents` returns the part
    documents for the hashes asked for.
    """

    def __init__(
        self,
        rows: List[ItemRow],
        formats: Dict[int, str],
        documents: Dict[str, Dict[str, Any]],
    ):
        self.rows = rows
        self.formats = formats
        self._documents = documents

    def documents(self, wanted: Dict[str, List[str]]) -> Dict[str, List[Any]]:
        """``{part name: [document, ...]}`` in the order of ``wanted``'s hashes."""
        return {
            name: [self._documents[name][digest] for digest in hashes]
            for name, hashes in wanted.items()
        }

    def close(self) -> None:
        self._documents = {}


def split_records(records: Iterable[Tuple[Dict[str, Any], bool]]) -> BuildContent:
    """Split ``(record, is_nano)`` pairs into a :class:`BuildContent`.

    An AOID may appear once in a build; a second record with it is an error.
    """
    rows: List[ItemRow] = []
    formats: Dict[int, str] = {}
    documents: Dict[str, Dict[str, Any]] = {name: {} for name in PART_NAMES}
    seen = set()
    for record, is_nano in records:
        parts = split_item(record, is_nano)
        if parts.aoid in seen:
            raise StoreError(f"AOID {parts.aoid} appears twice in one build")
        seen.add(parts.aoid)
        formats.update(effect_formats(record))
        for name in PART_NAMES:
            digest = parts.hashes[name]
            if digest is not None and digest not in documents[name]:
                documents[name][digest] = parts.documents[name]
        rows.append(
            (parts.aoid, parts.is_nano, parts.ql, parts.item_class, parts.revision_hash)
            + tuple(parts.hashes[name] for name in PART_NAMES)
        )
    return BuildContent(rows, formats, documents)


# ---------------------------------------------------------------------------
# Search projections
# ---------------------------------------------------------------------------


def _integer(value: Any) -> Optional[int]:
    return value if type(value) is int else None


def stat_rows(doc: List[List[int]]) -> List[Tuple[int, int]]:
    return [(stat, value) for stat, value in doc]


def requirement_rows(doc: List[Dict[str, Any]]) -> List[Tuple[int, ...]]:
    """``(action, position, value1, value2, operator)`` per criterion.

    ``position`` counts from 0 in evaluation order. Should an item carry the
    same action twice, the second one's criteria continue the count.
    """
    rows, position = [], {}
    for action in doc:
        number = action["action"]
        for value1, value2, operator in action["criteria"]:
            index = position.get(number, 0)
            position[number] = index + 1
            rows.append((number, index, value1, value2, operator))
    return rows


def effect_rows(doc: List[Dict[str, Any]]) -> List[Tuple[Any, ...]]:
    """``(event, spell_id, target, subject, amount)`` per effect."""
    rows = []
    for event in doc:
        for effect in event["effects"]:
            params = effect["params"]
            subject = next(
                (
                    params[key]
                    for key in ("Stat", "Skill", "NanoID")
                    if _integer(params.get(key)) is not None
                ),
                None,
            )
            rows.append(
                (
                    event["event"],
                    effect["spell_id"],
                    effect["target"],
                    subject,
                    _integer(params.get("Amount")),
                )
            )
    return rows


def atkdef_rows(doc: Dict[str, List[List[int]]]) -> List[Tuple[bool, int, int]]:
    return [(True, stat, value) for stat, value in doc["attack"]] + [
        (False, stat, value) for stat, value in doc["defense"]
    ]


# part name -> (projection table, its columns after the part id, row function)
PROJECTIONS = {
    "stats": ("stat_entry", ("stat", "value"), stat_rows),
    "actions": (
        "requirement",
        ("action", "position", "value1", "value2", "operator"),
        requirement_rows,
    ),
    "effects": (
        "effect_entry",
        ("event", "spell_id", "target", "subject", "amount"),
        effect_rows,
    ),
    "atkdef": ("atkdef_entry", ("is_attack", "stat", "value"), atkdef_rows),
}


# ---------------------------------------------------------------------------
# Builds
# ---------------------------------------------------------------------------


@dataclass
class BuildSpec:
    """One row of ``build``. ``parent_slug`` names the build a branch forks from."""

    slug: str
    branch: str
    ordinal: int
    display_name: str
    sort_order: int = 0
    client_build: Optional[str] = None
    parent_slug: Optional[str] = None
    enabled: bool = True
    is_default: bool = False
    features: Dict[str, Any] = field(default_factory=dict)
    extract_slug: Optional[str] = None
    rdb_dat_sha256: Optional[str] = None
    tinkerparse_commit: Optional[str] = None
    notes: Optional[str] = None
    overlay_strain_first: bool = False


# Columns of ``build`` that describe how a build is presented and served, as
# opposed to what it contains. They follow the registry on every import run.
PRESENTATION_COLUMNS = (
    "display_name",
    "sort_order",
    "enabled",
    "is_default",
    "features",
    "overlay_strain_first",
)


@dataclass
class BuildResult:
    slug: str
    imported: bool
    items: int = 0
    same_as_previous: bool = False
    new_revisions: int = 0
    new_parts: Dict[str, int] = field(default_factory=dict)
    added: int = 0
    removed: int = 0
    changed: int = 0
    runs_opened: int = 0
    runs_closed: int = 0


def _copy_rows(
    conn: psycopg.Connection, table: str, columns: Sequence[str], rows: Iterable[Sequence]
) -> None:
    statement = sql.SQL("COPY {} ({}) FROM STDIN").format(
        sql.Identifier(table), sql.SQL(", ").join(map(sql.Identifier, columns))
    )
    with conn.cursor().copy(statement) as copy:
        for row in rows:
            copy.write_row(row)


def _stage(conn: psycopg.Connection, rows: List[ItemRow]) -> None:
    conn.execute("DROP TABLE IF EXISTS incoming, new_rev, incoming_rev")
    conn.execute(
        """
        CREATE TEMP TABLE incoming (
            aoid integer PRIMARY KEY,
            is_nano boolean NOT NULL,
            ql integer NOT NULL,
            item_class integer NOT NULL,
            hash char(40) NOT NULL,
            text_hash char(40) NOT NULL,
            stats_hash char(40) NOT NULL,
            effects_hash char(40),
            actions_hash char(40),
            atkdef_hash char(40),
            misc_hash char(40)
        ) ON COMMIT DROP
        """
    )
    _copy_rows(conn, "incoming", ITEM_COLUMNS, rows)
    conn.execute("ANALYZE incoming")
    conn.execute(
        """
        CREATE TEMP TABLE new_rev ON COMMIT DROP AS
        SELECT i.* FROM incoming i
        LEFT JOIN item_revision r ON r.aoid = i.aoid AND r.hash = i.hash
        WHERE r.rev_id IS NULL
        """
    )
    conn.execute("ANALYZE new_rev")


def _store_parts(conn: psycopg.Connection, content: BuildContent) -> Dict[str, int]:
    """Store the parts of the new revisions that the store lacks, with their
    projections. Returns the number of new parts per name."""
    wanted: Dict[str, List[str]] = {}
    for name, (table, _) in PART_TABLES.items():
        column = sql.Identifier(f"{name}_hash")
        wanted[name] = [
            row[0]
            for row in conn.execute(
                sql.SQL(
                    "SELECT DISTINCT n.{column} FROM new_rev n "
                    "LEFT JOIN {table} p ON p.hash = n.{column} "
                    "WHERE n.{column} IS NOT NULL AND p.hash IS NULL"
                ).format(column=column, table=sql.Identifier(table))
            )
        ]
    documents = content.documents(wanted)

    for name, (table, id_column) in PART_TABLES.items():
        hashes, docs = wanted[name], documents[name]
        if not hashes:
            continue
        if name == "text":
            _copy_rows(
                conn,
                table,
                ("hash", "name", "description"),
                ((h, d["name"], d["description"]) for h, d in zip(hashes, docs)),
            )
            continue
        _copy_rows(
            conn, table, ("hash", "doc"), ((h, Jsonb(d)) for h, d in zip(hashes, docs))
        )
        if name not in PROJECTIONS:
            continue
        ids = dict(
            conn.execute(
                sql.SQL("SELECT hash, {} FROM {} WHERE hash = ANY(%s)").format(
                    sql.Identifier(id_column), sql.Identifier(table)
                ),
                (hashes,),
            ).fetchall()
        )
        projection, columns, rows_of = PROJECTIONS[name]
        _copy_rows(
            conn,
            projection,
            (id_column,) + columns,
            ((ids[h],) + tuple(row) for h, d in zip(hashes, docs) for row in rows_of(d)),
        )
    return {name: len(hashes) for name, hashes in wanted.items()}


def _store_effect_types(conn: psycopg.Connection, formats: Dict[int, str]) -> None:
    if not formats:
        return
    conn.cursor().executemany(
        "INSERT INTO effect_type (spell_id, format) VALUES (%s, %s) "
        "ON CONFLICT (spell_id) DO UPDATE SET format = EXCLUDED.format "
        "WHERE effect_type.format IS DISTINCT FROM EXCLUDED.format",
        sorted(formats.items()),
    )


_SYMBIANT_NAME = r"Symbiant.*Unit\s+(Aban|Alpha|Beta)$"
_SYMBIANT_FAMILIES = ("Artillery", "Control", "Extermination", "Infantry", "Support")


def _store_revisions(conn: psycopg.Connection) -> int:
    """Insert the staged new revisions and their symbiant rows."""
    joins = sql.SQL(" ").join(
        sql.SQL("{join} {table} {alias} ON {alias}.hash = n.{column}").format(
            join=sql.SQL("JOIN" if name in ("text", "stats") else "LEFT JOIN"),
            table=sql.Identifier(table),
            alias=sql.Identifier(f"p_{name}"),
            column=sql.Identifier(f"{name}_hash"),
        )
        for name, (table, _) in PART_TABLES.items()
    )
    ids = sql.SQL(", ").join(
        sql.SQL("{}.{}").format(sql.Identifier(f"p_{name}"), sql.Identifier(id_column))
        for name, (_, id_column) in PART_TABLES.items()
    )
    id_columns = sql.SQL(", ").join(
        sql.Identifier(id_column) for _, id_column in PART_TABLES.values()
    )
    inserted = conn.execute(
        sql.SQL(
            """
            INSERT INTO item_revision
                (aoid, hash, is_nano, ql, item_class, {id_columns})
            SELECT n.aoid, n.hash, n.is_nano,
                   CASE WHEN n.is_nano THEN COALESCE(o.ql, 1) ELSE n.ql END,
                   n.item_class, {ids}
            FROM new_rev n
            LEFT JOIN nano_overlay o ON o.aoid = n.aoid
            {joins}
            """
        ).format(id_columns=id_columns, ids=ids, joins=joins)
    ).rowcount
    expected = conn.execute("SELECT count(*) FROM new_rev").fetchone()[0]
    if inserted != expected:
        raise StoreError(
            f"{expected - inserted} new revisions reference a part that was not stored"
        )

    family = sql.SQL(" ").join(
        sql.SQL("WHEN t.name ~ {} THEN {}").format(
            sql.Literal(rf",\s*{name}\s+Unit\s+(Aban|Alpha|Beta)$"), sql.Literal(name)
        )
        for name in _SYMBIANT_FAMILIES
    )
    conn.execute(
        sql.SQL(
            """
            INSERT INTO symbiant_items (rev_id, aoid, name, ql, slot_id, family)
            SELECT r.rev_id, r.aoid, t.name, r.ql,
                   (SELECT max(s.value) FROM stat_entry s
                     WHERE s.stats_id = r.stats_id AND s.stat = {slot}),
                   CASE {family} END
            FROM new_rev n
            JOIN item_revision r ON r.aoid = n.aoid AND r.hash = n.hash
            JOIN part_text t ON t.text_id = r.text_id
            WHERE t.name ~ {pattern}
            """
        ).format(
            slot=sql.Literal(STAT_SLOT),
            family=family,
            pattern=sql.Literal(_SYMBIANT_NAME),
        )
    )
    return inserted


def _parts_changed_sql() -> sql.Composable:
    return sql.SQL(" + ").join(
        sql.SQL("CASE WHEN nr.{col} IS DISTINCT FROM orv.{col} THEN {bit} ELSE 0 END").format(
            col=sql.Identifier(id_column), bit=sql.Literal(PART_BITS[name])
        )
        for name, (_, id_column) in PART_TABLES.items()
    )


def _record_presence(
    conn: psycopg.Connection,
    branch: str,
    ordinal: int,
    previous: Optional[int],
    parent: Optional[Tuple[str, int]],
    result: BuildResult,
) -> None:
    """Write the change log and move the branch's presence runs to this build.

    ``previous`` is the ordinal of the branch's newest build before this one;
    ``parent`` is the (branch, ordinal) a first build is compared with.
    """
    conn.execute(
        """
        CREATE TEMP TABLE incoming_rev ON COMMIT DROP AS
        SELECT i.aoid, r.rev_id FROM incoming i
        JOIN item_revision r ON r.aoid = i.aoid AND r.hash = i.hash
        """
    )
    conn.execute("ANALYZE incoming_rev")

    if previous is not None:
        baseline = sql.SQL(
            "SELECT aoid, rev_id FROM item_presence "
            "WHERE branch = {} AND to_ordinal = {}"
        ).format(sql.Literal(branch), sql.Literal(OPEN_RUN))
    elif parent is not None:
        baseline = sql.SQL(
            "SELECT aoid, rev_id FROM item_presence "
            "WHERE branch = {} AND from_ordinal <= {ordinal} AND to_ordinal >= {ordinal}"
        ).format(sql.Literal(parent[0]), ordinal=sql.Literal(parent[1]))
    else:
        baseline = sql.SQL("SELECT NULL::integer AS aoid, NULL::integer AS rev_id WHERE false")

    kinds = dict(
        conn.execute(
            sql.SQL(
                """
                WITH written AS (
                    INSERT INTO item_change
                        (branch, ordinal, aoid, kind, old_rev_id, new_rev_id, parts_changed)
                    SELECT {branch}, {ordinal}, COALESCE(n.aoid, o.aoid),
                           CASE WHEN o.aoid IS NULL THEN 'A'
                                WHEN n.aoid IS NULL THEN 'R' ELSE 'C' END,
                           o.rev_id, n.rev_id,
                           CASE WHEN o.aoid IS NULL OR n.aoid IS NULL THEN 0
                                ELSE {parts_changed} END
                    FROM incoming_rev n
                    FULL JOIN ({baseline}) o ON o.aoid = n.aoid
                    LEFT JOIN item_revision nr ON nr.rev_id = n.rev_id
                    LEFT JOIN item_revision orv ON orv.rev_id = o.rev_id
                    WHERE n.rev_id IS DISTINCT FROM o.rev_id
                    RETURNING kind
                )
                SELECT kind, count(*) FROM written GROUP BY kind
                """
            ).format(
                branch=sql.Literal(branch),
                ordinal=sql.Literal(ordinal),
                parts_changed=_parts_changed_sql(),
                baseline=baseline,
            )
        ).fetchall()
    )
    result.added = kinds.get("A", 0)
    result.removed = kinds.get("R", 0)
    result.changed = kinds.get("C", 0)

    if previous is not None:
        result.runs_closed = conn.execute(
            """
            UPDATE item_presence p SET to_ordinal = %(previous)s
            WHERE p.branch = %(branch)s AND p.to_ordinal = %(open)s
              AND NOT EXISTS (SELECT 1 FROM incoming_rev n
                               WHERE n.aoid = p.aoid AND n.rev_id = p.rev_id)
            """,
            {"previous": previous, "branch": branch, "open": OPEN_RUN},
        ).rowcount
    result.runs_opened = conn.execute(
        """
        INSERT INTO item_presence (branch, aoid, from_ordinal, rev_id)
        SELECT %(branch)s::varchar, n.aoid, %(ordinal)s, n.rev_id
        FROM incoming_rev n
        WHERE NOT EXISTS (SELECT 1 FROM item_presence p
                           WHERE p.branch = %(branch)s::varchar AND p.aoid = n.aoid
                             AND p.to_ordinal = %(open)s)
        """,
        {"branch": branch, "ordinal": ordinal, "open": OPEN_RUN},
    ).rowcount


def _insert_build(
    conn: psycopg.Connection, spec: BuildSpec, item_count: int
) -> int:
    parent_id = None
    if spec.parent_slug:
        row = conn.execute(
            "SELECT build_id FROM build WHERE slug = %s", (spec.parent_slug,)
        ).fetchone()
        if row is None:
            raise StoreError(
                f"'{spec.slug}' forks from '{spec.parent_slug}', which is not in the "
                "store; import it first"
            )
        parent_id = row[0]
    if spec.is_default:
        conn.execute("UPDATE build SET is_default = false WHERE is_default")
    return conn.execute(
        """
        INSERT INTO build
            (slug, branch, ordinal, sort_order, display_name, client_build,
             parent_build_id, enabled, is_default, features, extract_slug,
             rdb_dat_sha256, tinkerparse_commit, item_count, notes,
             overlay_strain_first)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING build_id
        """,
        (
            spec.slug,
            spec.branch,
            spec.ordinal,
            spec.sort_order,
            spec.display_name,
            spec.client_build,
            parent_id,
            spec.enabled,
            spec.is_default,
            Jsonb(spec.features),
            spec.extract_slug,
            spec.rdb_dat_sha256,
            spec.tinkerparse_commit,
            item_count,
            spec.notes,
            spec.overlay_strain_first,
        ),
    ).fetchone()[0]


def newest_build(conn: psycopg.Connection, branch: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        "SELECT build_id, slug, ordinal, extract_slug, item_count FROM build "
        "WHERE branch = %s ORDER BY ordinal DESC LIMIT 1",
        (branch,),
    ).fetchone()
    if row is None:
        return None
    return dict(zip(("build_id", "slug", "ordinal", "extract_slug", "item_count"), row))


def same_as_newest(conn: psycopg.Connection, spec: BuildSpec) -> bool:
    """Whether ``spec`` carries the very extract of its branch's newest build."""
    newest = newest_build(conn, spec.branch)
    return bool(
        newest
        and spec.extract_slug
        and spec.extract_slug != spec.slug
        and newest["extract_slug"] == spec.extract_slug
    )


def import_build(
    conn: psycopg.Connection,
    spec: BuildSpec,
    content: Optional[BuildContent],
    timings: Optional[Timings] = None,
) -> BuildResult:
    """Import one build. ``content`` is None for a build whose data is the
    extract of the branch's newest build (see :func:`same_as_newest`).

    Returns a result with ``imported`` false, and writes nothing, when the
    build is already in the store.
    """
    conn.execute("LOCK TABLE build IN SHARE ROW EXCLUSIVE MODE")
    if conn.execute("SELECT 1 FROM build WHERE slug = %s", (spec.slug,)).fetchone():
        return BuildResult(slug=spec.slug, imported=False)

    newest = newest_build(conn, spec.branch)
    if newest is not None and spec.ordinal <= newest["ordinal"]:
        raise StoreError(
            f"'{spec.slug}' (ordinal {spec.ordinal}) is not newer than "
            f"'{newest['slug']}' (ordinal {newest['ordinal']}), the newest build of "
            f"branch '{spec.branch}' in the store. Builds are imported oldest first; "
            "rebuild the store to insert an older one."
        )

    result = BuildResult(slug=spec.slug, imported=True)
    if content is None:
        if not same_as_newest(conn, spec):
            raise StoreError(
                f"'{spec.slug}' has no content and is not a duplicate of its "
                "branch's newest build"
            )
        result.same_as_previous = True
        result.items = newest["item_count"]
        _insert_build(conn, spec, newest["item_count"])
        return result

    result.items = len(content.rows)
    parent = None
    if newest is None and spec.parent_slug:
        parent = conn.execute(
            "SELECT branch, ordinal FROM build WHERE slug = %s", (spec.parent_slug,)
        ).fetchone()
    build_id = _insert_build(conn, spec, result.items)
    with phase(timings, "stage"):
        _stage(conn, content.rows)
    with phase(timings, "parts"):
        result.new_parts = _store_parts(conn, content)
        _store_effect_types(conn, content.formats)
    with phase(timings, "revisions"):
        result.new_revisions = _store_revisions(conn)
    with phase(timings, "presence"):
        _record_presence(
            conn,
            spec.branch,
            spec.ordinal,
            newest["ordinal"] if newest else None,
            parent,
            result,
        )
    with phase(timings, "nano properties"):
        ensure_nano_properties(conn, build_id)
    return result


def update_presentation(conn: psycopg.Connection, spec: BuildSpec) -> bool:
    """Bring the presentation columns of a stored build in line with ``spec``.

    Returns whether its strain policy changed, which calls for
    :func:`ensure_nano_properties`.
    """
    row = conn.execute(
        sql.SQL("SELECT {} FROM build WHERE slug = %s").format(
            sql.SQL(", ").join(map(sql.Identifier, PRESENTATION_COLUMNS))
        ),
        (spec.slug,),
    ).fetchone()
    if row is None:
        return False
    stored = dict(zip(PRESENTATION_COLUMNS, row))
    wanted = {name: getattr(spec, name) for name in PRESENTATION_COLUMNS}
    if stored == wanted:
        return False
    if wanted["is_default"] and not stored["is_default"]:
        conn.execute("UPDATE build SET is_default = false WHERE is_default")
    conn.execute(
        sql.SQL("UPDATE build SET {} WHERE slug = %s").format(
            sql.SQL(", ").join(
                sql.SQL("{} = %s").format(sql.Identifier(name))
                for name in PRESENTATION_COLUMNS
            )
        ),
        [
            Jsonb(wanted[name]) if name == "features" else wanted[name]
            for name in PRESENTATION_COLUMNS
        ]
        + [spec.slug],
    )
    return stored["overlay_strain_first"] != wanted["overlay_strain_first"]


# ---------------------------------------------------------------------------
# Derived: nano QL and nano properties
# ---------------------------------------------------------------------------


def effective_strain(
    own_strain: Optional[int],
    own_substrain: Optional[int],
    overlay: Optional[Tuple[Optional[int], Optional[int]]],
    overlay_strain_first: bool,
) -> Tuple[Optional[int], Optional[int]]:
    """Strain and substrain a nano revision is served with.

    ``overlay`` is the curated (strain, substrain) of the nano, or None when it
    has no overlay row. The rule is stated in 002_curated_and_derived.sql.
    """
    if overlay is None:
        return own_strain, own_substrain
    overlay_strain, overlay_substrain = overlay[0] or 0, overlay[1] or 0
    if (
        not overlay_strain_first
        and own_strain not in UNUSABLE_STRAINS
        and own_strain != overlay_strain
    ):
        return own_strain, own_substrain
    return (
        overlay_strain if overlay_strain > 0 else own_strain,
        overlay_substrain if overlay_substrain > 0 else own_substrain,
    )


def _first_stat(stats: List[List[int]], stat: int) -> Optional[int]:
    return next((value for number, value in stats if number == stat), None)


def _use_criteria(actions: Optional[List[Dict[str, Any]]]) -> Optional[List[Tuple]]:
    """Criteria of the Use action, or None when the nano has none."""
    use = [a for a in actions or [] if a["action"] == nano_properties.USE_ACTION]
    if not use:
        return None
    return [tuple(criterion) for action in use for criterion in action["criteria"]]


def ensure_nano_properties(
    conn: psycopg.Connection, build_id: Optional[int] = None
) -> int:
    """Add the ``nano_properties`` rows that are missing for the nanos of one
    build, or of every build, under each build's strain policy. Returns the
    number of rows added."""
    missing = conn.execute(
        sql.SQL(
            """
            WITH wanted AS (
                SELECT DISTINCT r.rev_id, b.overlay_strain_first AS policy
                FROM build b
                JOIN item_presence p ON p.branch = b.branch
                    AND p.from_ordinal <= b.ordinal AND p.to_ordinal >= b.ordinal
                JOIN item_revision r ON r.rev_id = p.rev_id AND r.is_nano
                WHERE {build} AND NOT EXISTS (
                    SELECT 1 FROM nano_properties np
                    WHERE np.rev_id = r.rev_id
                      AND np.overlay_strain_first = b.overlay_strain_first)
            )
            SELECT w.rev_id, w.policy, s.doc, a.doc,
                   o.aoid IS NOT NULL, o.strain, o.substrain
            FROM wanted w
            JOIN item_revision r ON r.rev_id = w.rev_id
            JOIN part_stats s ON s.stats_id = r.stats_id
            LEFT JOIN part_actions a ON a.actions_id = r.actions_id
            LEFT JOIN nano_overlay o ON o.aoid = r.aoid
            """
        ).format(
            build=sql.SQL("b.build_id = {}").format(sql.Literal(build_id))
            if build_id is not None
            else sql.SQL("true")
        )
    ).fetchall()

    derived: Dict[Tuple, Tuple] = {}
    rows = []
    for rev_id, policy, stats, actions, has_overlay, o_strain, o_substrain in missing:
        criteria = _use_criteria(actions)
        school_stat = _first_stat(stats, nano_properties.STAT_NANO_SCHOOL)
        key = (school_stat, None if criteria is None else tuple(criteria))
        if key not in derived:
            derived[key] = nano_properties.derive(school_stat, criteria)
        school, professions, min_level = derived[key]
        strain, substrain = effective_strain(
            _first_stat(stats, STAT_NANO_STRAIN),
            _first_stat(stats, STAT_NANO_SUBSTRAIN),
            (o_strain, o_substrain) if has_overlay else None,
            policy,
        )
        rows.append(
            (rev_id, policy, school, professions, min_level, strain, substrain)
        )
    _copy_rows(
        conn,
        "nano_properties",
        (
            "rev_id",
            "overlay_strain_first",
            "school",
            "professions",
            "min_level",
            "strain",
            "substrain",
        ),
        rows,
    )
    return len(rows)


def apply_nano_overlay(conn: psycopg.Connection) -> None:
    """Re-derive everything that depends on ``nano_overlay`` after it changed:
    the QL of nano revisions and the strains in ``nano_properties``."""
    conn.execute(
        """
        UPDATE item_revision r SET ql = v.ql
        FROM (SELECT r2.rev_id, COALESCE(o.ql, 1) AS ql
              FROM item_revision r2
              LEFT JOIN nano_overlay o ON o.aoid = r2.aoid
              WHERE r2.is_nano) v
        WHERE v.rev_id = r.rev_id AND r.ql IS DISTINCT FROM v.ql
        """
    )
    conn.execute("DELETE FROM nano_properties")
    ensure_nano_properties(conn)
