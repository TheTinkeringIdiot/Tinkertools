"""Export the ids clients hold from a database of the old store.

Before item identity moved to the AOID, clients persisted the old store's
internal item row ids: nano favorites and symbiant comparison links. Both are
ids of ``items`` rows (a nano and a symbiant are items; the symbiant view took
its ``id`` from the item). Symbiant farm lists have held AOIDs since
production first had them; the frontend still translates one in an id-based
shape should a browser hold it. The new store is loaded from the extracts
and never issues those ids, so the only way to translate what clients still
hold is a copy of ``id -> aoid`` taken from the database that issued them.
This tool writes that copy; ``import_cli.py import-cas --legacy-ids-file``
loads it; ``POST /legacy-item-ids/resolve`` answers from it.

Clients also hold mob ids (farm progress, links to a boss), and those are not
translated: the new store numbers mobs in the order of symbiants.csv and is
expected to give every mob the id it had. ``--mobs-file`` writes the old
database's ``mob_id,name`` so that expectation can be checked against the new
store, wherever it is: ``python tools/verify_cas.py --legacy-mobs-file``.

Run it against the production database before that database is replaced:

    DATABASE_URL=postgresql://... python tools/export_legacy_item_ids.py \\
        legacy_item_ids.csv --mobs-file legacy_mobs.csv

The database is only read, in a read-only transaction. Two layouts are known:

* ``public.items`` is a table: a database from before several game versions
  were served. Every id belongs to one family, ``--family`` (default ``ao``).
  Run the tool once per database and concatenate the files (without the
  second header) if another family was served from a database of its own.
* ``gd.items`` with ``public.game_versions``: the shared revision store. A
  revision id is exported for each family that has a version holding it.
  Mobs are those of the default version.

The id file is CSV with the header ``branch,item_id,aoid``: within a family an
id names one item, whichever build of the family a client asks about.

Exit status is 2 when the database has neither layout.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

import psycopg
from psycopg import sql

HEADER = ("branch", "item_id", "aoid")
MOB_HEADER = ("mob_id", "name")
Row = Tuple[str, int, int]
MobRow = Tuple[int, str]


class UnknownLayout(Exception):
    """The database is not an old store this tool can read."""


def _relation_kind(conn: psycopg.Connection, schema: str, name: str) -> Optional[str]:
    row = conn.execute(
        "SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = %s AND c.relname = %s",
        (schema, name),
    ).fetchone()
    return row[0] if row else None


def read_shared_store(
    conn: psycopg.Connection, store: str = "gd", registry: str = "public"
) -> Iterator[Row]:
    """``(family, revision id, aoid)`` for every family with a version that
    holds the revision, from the shared revision store."""
    return conn.execute(
        sql.SQL(
            "SELECT f.family, i.id, i.aoid FROM {}.items i "
            "JOIN (SELECT family, array_agg(vid) AS vids FROM {}.game_versions "
            "      WHERE vid IS NOT NULL GROUP BY family) f ON i.vids && f.vids "
            "WHERE i.aoid IS NOT NULL ORDER BY f.family, i.id"
        ).format(sql.Identifier(store), sql.Identifier(registry))
    )


def read_single_version(
    conn: psycopg.Connection, family: str, schema: str = "public"
) -> Iterator[Row]:
    """``(family, item id, aoid)`` of a database that holds one game version."""
    return conn.execute(
        sql.SQL(
            "SELECT %s::text, id, aoid FROM {}.items "
            "WHERE aoid IS NOT NULL ORDER BY id"
        ).format(sql.Identifier(schema)),
        (family,),
    )


def read_map(conn: psycopg.Connection, family: str) -> Iterator[Row]:
    """The map of the database ``conn`` is connected to, whichever of the two
    known layouts it has."""
    if _relation_kind(conn, "gd", "items") == "r":
        if _relation_kind(conn, "public", "game_versions") != "r":
            raise UnknownLayout("gd.items exists but public.game_versions does not")
        return read_shared_store(conn)
    if _relation_kind(conn, "public", "items") == "r":
        return read_single_version(conn, family)
    raise UnknownLayout(
        "neither gd.items (shared revision store) nor a table public.items "
        "(single-version database) exists"
    )


def read_mobs(conn: psycopg.Connection, schema: str = "public") -> Iterator[MobRow]:
    """``(mob id, name)`` of the mobs table in ``schema``."""
    return conn.execute(
        sql.SQL("SELECT id, name FROM {}.mobs ORDER BY id").format(
            sql.Identifier(schema)
        )
    )


def mobs_schema(conn: psycopg.Connection, public: str = "public") -> str:
    """The schema whose mobs clients of the database were served: ``public``
    itself, or that of the default version of a shared store."""
    if _relation_kind(conn, public, "mobs") == "r":
        return public
    if _relation_kind(conn, public, "game_versions") == "r":
        row = conn.execute(
            sql.SQL("SELECT schema_name FROM {}.game_versions WHERE is_default").format(
                sql.Identifier(public)
            )
        ).fetchone()
        if row and _relation_kind(conn, row[0], "mobs") == "r":
            return row[0]
    raise UnknownLayout(
        f"no table {public}.mobs, and no default version with a mobs table"
    )


def write_mobs(rows: Iterator[MobRow], path: Path) -> int:
    """Write ``rows`` to ``path``; returns the number written."""
    count = 0
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(MOB_HEADER)
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def write_map(rows: Iterator[Row], path: Path) -> List[Tuple[str, int]]:
    """Write ``rows`` to ``path``; returns ``[(family, rows written)]``."""
    counts: dict = {}
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        for family, item_id, aoid in rows:
            writer.writerow((family, item_id, aoid))
            counts[family] = counts.get(family, 0) + 1
    return sorted(counts.items())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("output", type=Path, help="CSV file to write")
    parser.add_argument(
        "--mobs-file",
        type=Path,
        default=None,
        help="also write the old store's mob ids and names to this CSV file",
    )
    parser.add_argument(
        "--family",
        default="ao",
        help="family of a single-version database (default: ao); a shared "
        "store names its own families",
    )
    parser.add_argument(
        "--database-url", default=None, help="default: the DATABASE_URL variable"
    )
    args = parser.parse_args()
    url = args.database_url or os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 2
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,19}", args.family):
        print(f"Invalid family name: {args.family!r}", file=sys.stderr)
        return 2

    with psycopg.connect(re.sub(r"^postgresql\+\w+://", "postgresql://", url)) as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        try:
            counts = write_map(read_map(conn, args.family), args.output)
            mobs = (
                write_mobs(read_mobs(conn, mobs_schema(conn)), args.mobs_file)
                if args.mobs_file
                else None
            )
        except UnknownLayout as error:
            print(f"Not an old store: {error}", file=sys.stderr)
            return 2
    for family, count in counts:
        print(f"{family}: {count} ids")
    if mobs is not None:
        print(f"{mobs} mobs: {args.mobs_file}")
    print(
        f"{sum(count for _, count in counts)} rows, "
        f"{args.output.stat().st_size} bytes: {args.output}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
