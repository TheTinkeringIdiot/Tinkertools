"""
Content hashing for item records.

Each imported record is hashed so the same item can be compared across game
version snapshots without loading both copies. The whole normalized record
produces ``content_hash``; four sub-hashes say *what* changed when it differs
(stats, spell effects, requirements, display text).

Normalization rules (design.md section 7, risk 7):

- ``Version``, ``DBType`` and the importer's ``__is_nano__`` marker are dropped:
  they describe the dump, not the item.
- ``StatValues`` and the ``Attack``/``Defense`` stat lists are sorted on
  ``(Stat, RawValue)``. Extractors emit them in arbitrary order, and an order
  change there is not a content change. Stats in ``IGNORED_STATS`` (StaticInstance)
  are dropped because they identify the row, not the item.
- ``ActionData``, ``SpellData`` and every criteria array keep their original
  order: criteria are evaluated in sequence, so reordering them is a real
  change.
- Serialization is compact JSON with sorted keys, so dict ordering in the dump
  never matters.

The hashes are written to ``items`` (migration 007) and copied into
``public.item_revisions`` after each version import.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, Iterable, List

logger = logging.getLogger(__name__)

# Top-level keys that describe the dump rather than the item.
IGNORED_KEYS = ("Version", "DBType", "__is_nano__")

# Stats that identify the database row rather than the item. StaticInstance (23)
# is the client's internal instance id and can differ between two dumps of the
# same item without any gameplay change.
IGNORED_STATS = frozenset({23})

# Keys feeding each sub-hash. A key absent from the record stays absent from
# the hashed object; no defaults are invented.
STATS_KEYS = ("StatValues", "AttackDefenseData", "AnimationMesh")
SPELLS_KEYS = ("SpellData",)
ACTIONS_KEYS = ("ActionData",)
TEXT_KEYS = ("Name", "Description")

HASH_FIELDS = (
    "content_hash",
    "stats_hash",
    "spells_hash",
    "actions_hash",
    "text_hash",
)


def _stat_sort_key(entry: Any):
    """Stable sort key for a StatValue-shaped dict."""
    if isinstance(entry, dict):
        stat = entry.get("Stat")
        value = entry.get("RawValue")
        return (stat if stat is not None else 0, value if value is not None else 0)
    return (0, 0)


def _sorted_stats(entries: Iterable[Any]) -> List[Any]:
    entries = [
        e for e in entries
        if not (isinstance(e, dict) and e.get("Stat") in IGNORED_STATS)
    ]
    try:
        return sorted(entries, key=_stat_sort_key)
    except TypeError:
        # Mixed value types in a malformed record: keep the input order rather
        # than failing the whole import.
        return list(entries)


def normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Shallow copy of ``record`` with dump metadata dropped and stat lists sorted.

    Only the containers that are rewritten are copied; the rest of the record
    is shared with the input, which matters at 130k records per import.
    """
    normalized = {k: v for k, v in record.items() if k not in IGNORED_KEYS}

    stat_values = normalized.get("StatValues")
    if isinstance(stat_values, list):
        normalized["StatValues"] = _sorted_stats(stat_values)

    atkdef = normalized.get("AttackDefenseData")
    if isinstance(atkdef, dict):
        rewritten = dict(atkdef)
        for key in ("Attack", "Defense"):
            entries = rewritten.get(key)
            if isinstance(entries, list):
                rewritten[key] = _sorted_stats(entries)
        normalized["AttackDefenseData"] = rewritten

    return normalized


def _serialize(obj: Any) -> str:
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    )


def hash_object(obj: Any) -> str:
    """SHA-1 hex digest (40 characters) of the canonical serialization of ``obj``."""
    return hashlib.sha1(_serialize(obj).encode("utf-8")).hexdigest()


def _subset(normalized: Dict[str, Any], keys: Iterable[str]) -> Dict[str, Any]:
    return {key: normalized[key] for key in keys if key in normalized}


def compute_item_hashes(record: Dict[str, Any]) -> Dict[str, str]:
    """Content hashes for one raw item record.

    Args:
        record: An item as it appears in items.json / nanos.json.

    Returns:
        ``{content_hash, stats_hash, spells_hash, actions_hash, text_hash}``,
        each a 40-character SHA-1 hex digest.
    """
    normalized = normalize_record(record)

    return {
        "content_hash": hash_object(normalized),
        "stats_hash": hash_object(_subset(normalized, STATS_KEYS)),
        "spells_hash": hash_object(_subset(normalized, SPELLS_KEYS)),
        "actions_hash": hash_object(_subset(normalized, ACTIONS_KEYS)),
        "text_hash": hash_object(_subset(normalized, TEXT_KEYS)),
    }
