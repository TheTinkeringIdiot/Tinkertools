"""Export the map of internal item ids to AOIDs from a database of the old store.

Before item identity moved to the AOID, clients persisted the old store's
internal item row ids: nano favorites, symbiant farm lists and symbiant
comparison links. All three are ids of ``items`` rows (a nano and a symbiant
are items; the symbiant view took its ``id`` from the item). The new store is
loaded from the extracts and never issues those ids, so the only way to
translate what clients still hold is a copy of ``id -> aoid`` taken from the
database that issued them. This tool writes that copy; ``import_cli.py
import-cas --legacy-ids-file`` loads it; ``POST /legacy-item-ids/resolve``
answers from it.

Run it against the production database before that database is replaced:

    DATABASE_URL=postgresql://... python tools/export_legacy_item_ids.py legacy_item_ids.csv

The database is only read, in a read-only transaction. Two layouts are known:

* ``public.items`` is a table: a database from before several game versions
  were served. Every id belongs to one family, ``--family`` (default ``ao``).
  Run the tool once per database and concatenate the files (without the
  second header) if another family was served from a database of its own.
* ``gd.items`` with ``public.game_versions``: the shared revision store. A
  revision id is exported for each family that has a version holding it.

The file is CSV with the header ``branch,item_id,aoid``: within a family an
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
Row = Tuple[str, int, int]


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
        except UnknownLayout as error:
            print(f"Not an old store: {error}", file=sys.stderr)
            return 2
    for family, count in counts:
        print(f"{family}: {count} ids")
    print(
        f"{sum(count for _, count in counts)} rows, "
        f"{args.output.stat().st_size} bytes: {args.output}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
