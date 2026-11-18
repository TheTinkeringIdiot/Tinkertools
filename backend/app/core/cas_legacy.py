"""
Internal item ids of the old store, kept so clients can leave them behind.

``legacy_item_id`` (database/cas/004_legacy_item_ids.sql) is loaded from a
file written by ``tools/export_legacy_item_ids.py`` against the database that
issued the ids: CSV with the header ``branch,item_id,aoid``.

:func:`sync_legacy_ids` makes the table equal to the file and writes only the
rows that differ. It runs when an import is given the file; an import without
it leaves the table as it is.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import List, Tuple

import psycopg

from app.core.cas_store import StoreError

HEADER = ["branch", "item_id", "aoid"]
INTEGER_COLUMN = range(-(2**31), 2**31)

LegacyId = Tuple[str, int, int]


def read_legacy_ids(path: Path) -> List[LegacyId]:
    """The rows of a legacy id file, checked: one AOID per branch and id."""
    rows: List[LegacyId] = []
    seen = set()
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        if next(reader, None) != HEADER:
            raise StoreError(f"{path}: the first line must be {','.join(HEADER)}")
        for number, line in enumerate(reader, start=2):
            try:
                branch, item_id, aoid = line[0], int(line[1]), int(line[2])
            except (IndexError, ValueError):
                raise StoreError(
                    f"{path}, line {number}: expected branch,item_id,aoid"
                ) from None
            if len(line) != 3 or not branch or len(branch) > 20:
                raise StoreError(f"{path}, line {number}: expected branch,item_id,aoid")
            if item_id not in INTEGER_COLUMN or aoid not in INTEGER_COLUMN:
                raise StoreError(f"{path}, line {number}: id out of range")
            if (branch, item_id) in seen:
                raise StoreError(
                    f"{path}, line {number}: id {item_id} of {branch} is listed twice"
                )
            seen.add((branch, item_id))
            rows.append((branch, item_id, aoid))
    return rows


def sync_legacy_ids(conn: psycopg.Connection, rows: List[LegacyId]) -> int:
    """Make ``legacy_item_id`` hold exactly ``rows``; returns rows written or
    removed."""
    conn.execute(
        "CREATE TEMP TABLE legacy_item_id_file "
        "(branch text, item_id integer, aoid integer) ON COMMIT DROP"
    )
    with conn.cursor().copy(
        "COPY legacy_item_id_file (branch, item_id, aoid) FROM STDIN"
    ) as copy:
        for row in rows:
            copy.write_row(row)
    removed = conn.execute(
        "DELETE FROM legacy_item_id l WHERE NOT EXISTS (SELECT 1 "
        "FROM legacy_item_id_file f "
        "WHERE (f.branch, f.item_id) = (l.branch, l.item_id))"
    ).rowcount
    written = conn.execute(
        "INSERT INTO legacy_item_id (branch, item_id, aoid) "
        "SELECT branch, item_id, aoid FROM legacy_item_id_file "
        "ON CONFLICT (branch, item_id) DO UPDATE SET aoid = EXCLUDED.aoid "
        "WHERE legacy_item_id.aoid <> EXCLUDED.aoid"
    ).rowcount
    conn.execute("DROP TABLE legacy_item_id_file")
    return removed + written
