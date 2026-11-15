"""
Curated data of the content-addressed store: nano metadata, perks, mobs,
sources and item-source links.

The inputs are hand-maintained files (backend/all_nanos_compacted.csv,
backend/database/perks.json, backend/database/symbiants.csv). They are stored
once, keyed by AOID, for every build; which facts a build is served with is
decided at read time (002_curated_and_derived.sql states the rules).

:func:`sync_curated` makes the tables equal to the files and writes only the
rows that differ, so it runs at the start of every import.

Rules:

- A ``mob_id`` belongs to one mob name for ever. A mob keeps its id whatever
  the file order; a mob new to the store gets the next id after the highest
  one ever given. On an empty store that is the order of first appearance in
  the file.
- A mob that leaves the file is not deleted: its row is marked ``retired`` and
  it loses its source and its drops. Should its name return to the file, it is
  the same mob again, with the same id.
- A source of type 'item' is a nanocrystal named by the nano CSV. Its name is
  not stored: it is the crystal item's name in the build being served.
- When the nano CSV lists a crystal twice for one nano, the first counts.
"""

from __future__ import annotations

import csv
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from app.core import perk_validator
from app.core.cas_store import StoreError

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_NANOS_CSV = BACKEND_DIR / "all_nanos_compacted.csv"
DEFAULT_PERKS_JSON = BACKEND_DIR / "database" / "perks.json"
DEFAULT_SYMBIANTS_CSV = BACKEND_DIR / "database" / "symbiants.csv"

SOURCE_TYPE_ITEM = 1
SOURCE_TYPE_MOB = 3
SOURCE_TYPES = {
    1: ("item", "Items that create/upload other items (e.g., nanocrystals)"),
    2: ("npc", "NPCs and mobs that drop items"),
    3: ("mob", "Items dropped by mobs"),
    4: ("mission", "Missions that reward items"),
    5: ("vendor", "Vendors and shops that sell items"),
}

Key = Tuple[Any, ...]
Rows = Dict[Key, Tuple[Any, ...]]


@dataclass
class CuratedFiles:
    nanos_csv: Path = DEFAULT_NANOS_CSV
    perks_json: Path = DEFAULT_PERKS_JSON
    symbiants_csv: Path = DEFAULT_SYMBIANTS_CSV


# ---------------------------------------------------------------------------
# Reading the files
# ---------------------------------------------------------------------------


def _number(text: Optional[str]) -> int:
    return int(text) if text and text.isdigit() else 0


def read_nanos(path: Path) -> Tuple[Rows, List[Tuple[int, int, int, str]]]:
    """The nano CSV as ``nano_overlay`` rows and crystal links.

    Returns ``({(aoid,): (ql, strain, substrain)}, [(nano aoid, crystal aoid,
    ql, nano name), ...])``. A strain the file leaves out is 0.
    """
    overlay: Rows = {}
    links: List[Tuple[int, int, int, str]] = []
    linked = set()
    with open(path, "r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            nano, ql = int(row["nano_id"]), int(row["ql"])
            overlay.setdefault(
                (nano,),
                (ql, _number(row.get("strain_id")), _number(row.get("sub_strain_id"))),
            )
            for crystal in row["crystal_ids"].split(";"):
                if not crystal.strip():
                    continue
                pair = (nano, int(crystal))
                if pair not in linked:
                    linked.add(pair)
                    links.append(pair + (ql, row["nano_name"]))
    return overlay, links


def read_perks(path: Path) -> Rows:
    """perks.json as ``perk`` rows keyed by AOID.

    Profession and breed names the application does not know are left out.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    column = {name: index for index, name in enumerate(data["columns"])}

    def field(row: Sequence[Any], name: str) -> Any:
        return row[column[name]] if name in column else None

    def ids(names: Sequence[str], mapper) -> List[int]:
        mapped = []
        for name in names:
            try:
                mapped.append(mapper(name))
            except ValueError:
                logger.warning(f"perks.json: unknown name {name!r} ignored")
        return mapped

    rows: Rows = {}
    for row in data["values"]:
        name = row[column["name"]]
        rows[(row[column["aoid"]],)] = (
            name,
            name,
            perk_validator.validate_counter(row[column["counter"]]),
            perk_validator.validate_perk_type(row[column["type"]]),
            perk_validator.parse_level_requirement(field(row, "level")),
            perk_validator.parse_level_requirement(field(row, "aiTitle")),
            ids(field(row, "professions") or [], perk_validator.map_profession_to_id),
            ids(field(row, "breeds") or [], perk_validator.map_breed_to_id),
        )
    return rows


def _aoid_from_link(link: str) -> Optional[int]:
    match = re.search(r"AOID=(\d+)", link, re.IGNORECASE) or re.search(r"(\d+)", link)
    return int(match.group(1)) if match else None


def read_symbiants(path: Path) -> Tuple[List[Dict[str, Any]], List[Tuple[int, str]]]:
    """symbiants.csv as mobs in order of first appearance and their drops.

    Returns ``([mob, ...], [(item aoid, mob name), ...])``. A mob is described
    by the first row that names it. Text is stored as the file writes it.
    """
    mobs: Dict[str, Dict[str, Any]] = {}
    drops: Dict[Tuple[int, str], None] = {}
    with open(path, "r", encoding="utf-8", newline="") as handle:
        for number, row in enumerate(csv.reader(handle), 1):
            if len(row) < 12:
                logger.warning(f"{path.name}: skipping malformed row {number}")
                continue
            aoid = _aoid_from_link(row[10].strip())
            if not aoid:
                logger.warning(f"{path.name}: no AOID in row {number}")
                continue
            name, playfield, level = row[3].strip(), row[4].strip(), row[7].strip()
            known = mobs.get(name)
            if known is None:
                mobs[name] = {
                    "name": name,
                    "level": int(level) if level.isdigit() else None,
                    "playfield": playfield,
                    "location": row[5].strip(),
                    "mob_names": [m.strip() for m in row[6].split(",") if m.strip()],
                }
            elif known["playfield"] != playfield:
                raise StoreError(
                    f"{path.name} row {number}: mob '{name}' appears in "
                    f"'{known['playfield']}' and '{playfield}'; mob names must be unique"
                )
            drops.setdefault((aoid, name))
    return list(mobs.values()), list(drops)


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------


def _adapt(value: Any) -> Any:
    return Jsonb(value) if isinstance(value, dict) else value


def _sync(
    conn: psycopg.Connection,
    table: str,
    key: Sequence[str],
    columns: Sequence[str],
    wanted: Rows,
) -> int:
    """Make ``table`` hold exactly ``wanted`` (key tuple -> other columns).
    Returns the number of rows inserted, updated or deleted."""
    names = sql.SQL(", ").join(map(sql.Identifier, tuple(key) + tuple(columns)))
    where = sql.SQL(" AND ").join(
        sql.SQL("{} = %s").format(sql.Identifier(name)) for name in key
    )
    stored: Rows = {
        row[: len(key)]: row[len(key) :]
        for row in conn.execute(
            sql.SQL("SELECT {} FROM {}").format(names, sql.Identifier(table))
        )
    }
    cursor = conn.cursor()
    gone = [k for k in stored if k not in wanted]
    new = [k for k in wanted if k not in stored]
    different = [k for k in wanted if k in stored and stored[k] != wanted[k]]
    if gone:
        cursor.executemany(
            sql.SQL("DELETE FROM {} WHERE {}").format(sql.Identifier(table), where),
            gone,
        )
    if new:
        cursor.executemany(
            sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
                sql.Identifier(table),
                names,
                sql.SQL(", ").join(sql.Placeholder() * (len(key) + len(columns))),
            ),
            [k + tuple(map(_adapt, wanted[k])) for k in new],
        )
    if different and columns:
        cursor.executemany(
            sql.SQL("UPDATE {} SET {} WHERE {}").format(
                sql.Identifier(table),
                sql.SQL(", ").join(
                    sql.SQL("{} = %s").format(sql.Identifier(name)) for name in columns
                ),
                where,
            ),
            [tuple(map(_adapt, wanted[k])) + k for k in different],
        )
    return len(gone) + len(new) + len(different)


MOB_COLUMNS = (
    "name",
    "level",
    "playfield",
    "location",
    "mob_names",
    "is_pocket_boss",
    "metadata",
    "retired",
)


def _mob_rows(conn: psycopg.Connection, mobs: List[Dict[str, Any]]) -> Rows:
    """Every ``mob`` row the table must hold, by id, in :data:`MOB_COLUMNS`.

    The file's mobs keep the id stored for their name or take the next id
    after the highest stored one. Stored mobs the file no longer names stay as
    they are, retired, so their ids are never given out again.
    """
    stored = {
        row[1]: row
        for row in conn.execute(
            sql.SQL("SELECT mob_id, {} FROM mob").format(
                sql.SQL(", ").join(map(sql.Identifier, MOB_COLUMNS))
            )
        )
    }
    next_id = max((row[0] for row in stored.values()), default=0) + 1
    rows: Rows = {}
    for mob in mobs:
        known = stored.pop(mob["name"], None)
        if known is not None:
            mob_id = known[0]
        else:
            mob_id, next_id = next_id, next_id + 1
        rows[(mob_id,)] = (
            mob["name"],
            mob["level"],
            mob["playfield"],
            mob["location"],
            mob["mob_names"],
            True,
            {},
            False,
        )
    for mob_id, *columns in stored.values():
        rows[(mob_id,)] = tuple(columns[:-1]) + (True,)
    return rows


def sync_curated(conn: psycopg.Connection, files: CuratedFiles) -> Dict[str, int]:
    """Make the curated tables equal to the files. Returns the number of rows
    written per table (inserted, updated or deleted, counting the links that
    go with a deleted source); a non-zero ``nano_overlay`` count calls for
    :func:`app.core.cas_store.apply_nano_overlay`."""
    overlay, crystal_links = read_nanos(files.nanos_csv)
    mobs, drops = read_symbiants(files.symbiants_csv)
    written = {
        "nano_overlay": _sync(
            conn, "nano_overlay", ("aoid",), ("ql", "strain", "substrain"), overlay
        ),
        "perk": _sync(
            conn,
            "perk",
            ("aoid",),
            (
                "name",
                "perk_series",
                "counter",
                "type",
                "level_required",
                "ai_level_required",
                "professions",
                "breeds",
            ),
            read_perks(files.perks_json),
        ),
        "source_type": _sync(
            conn,
            "source_type",
            ("source_type_id",),
            ("name", "description"),
            {(type_id,): row for type_id, row in SOURCE_TYPES.items()},
        ),
    }

    mob_rows = _mob_rows(conn, mobs)
    served_mobs = {mob_id: row for (mob_id,), row in mob_rows.items() if not row[-1]}
    sources: Rows = {
        (SOURCE_TYPE_MOB, mob_id): (row[0], {}) for mob_id, row in served_mobs.items()
    }
    for _, crystal, _, _ in crystal_links:
        sources[(SOURCE_TYPE_ITEM, crystal)] = (None, {"type": "nanocrystal"})
    count_links = "SELECT count(*) FROM item_source"
    links_before = conn.execute(count_links).fetchone()[0]
    written["source"] = _sync(
        conn, "source", ("source_type_id", "entity_id"), ("name", "metadata"), sources
    )
    # Links of a deleted source go with it (ON DELETE CASCADE).
    links_cascaded = links_before - conn.execute(count_links).fetchone()[0]
    written["mob"] = _sync(conn, "mob", ("mob_id",), MOB_COLUMNS, mob_rows)

    source_ids = {
        (type_id, entity): source_id
        for source_id, type_id, entity in conn.execute(
            "SELECT source_id, source_type_id, entity_id FROM source"
        )
    }
    mob_ids = {row[0]: mob_id for mob_id, row in served_mobs.items()}
    links: Rows = {}
    for aoid, mob_name in drops:
        source_id = source_ids[(SOURCE_TYPE_MOB, mob_ids[mob_name])]
        links[(aoid, source_id)] = (None, None, None, None, {})
    for nano, crystal, ql, nano_name in crystal_links:
        links[(nano, source_ids[(SOURCE_TYPE_ITEM, crystal)])] = (
            None,
            ql,
            ql,
            None,
            {"nano_name": nano_name, "crystal_aoid": crystal},
        )
    written["item_source"] = links_cascaded + _sync(
        conn,
        "item_source",
        ("aoid", "source_id"),
        ("drop_rate", "min_ql", "max_ql", "conditions", "metadata"),
        links,
    )
    return written
