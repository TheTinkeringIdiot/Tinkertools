"""
Content hashing: the canonical serialisation of a JSON value and its SHA-1.

A part of an item (app/core/parts.py) is addressed by the hash of its
canonical document. Serialisation is compact JSON with sorted keys, so the
order of an object's keys never matters.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


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
