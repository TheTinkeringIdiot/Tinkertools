"""
Canonical item parts for the content-addressed store.

An item record from items.json / nanos.json is split into parts. Each part is a
small JSON document stored once and addressed by the hash of its canonical
form, so two items (or two builds of one item) that share a part share its
storage, and "what changed" is a comparison of hashes.
See docs/plans/content-addressed-store/design.md section 3.1.

Parts and their documents:

- ``text``     ``{"name", "description"}``
- ``stats``    ``[[stat, value], ...]`` sorted. A stat may appear more than once
               in the client data, so this is a list of pairs, not a map.
- ``effects``  ``[{"event", "effects": [effect, ...]}, ...]`` sorted by event.
               ``effect = {"spell_id", "target", "tick_count", "tick_interval",
               "params", "criteria", "description"}``.
- ``actions``  ``[{"action", "criteria"}, ...]`` sorted by action.
- ``atkdef``   ``{"attack": [[stat, value], ...], "defense": [...]}`` sorted.
- ``misc``     ``{"static_instance", "animation_mesh", "shop"}``: data that is
               stored but is not gameplay content.

Rules:

- Order never matters for stats, attack/defense, events, actions, or the
  effects within an event. Builds re-sort these without changing the item
  (14.5.0 re-sorted the modifiers of 11,211 items), so they are sorted here.
- Order always matters for criteria: they are evaluated as a sequence.
- Text rendered from other fields is kept in the document for display but is
  not hashed: an effect's ``description`` is a function of its type and
  parameters, and its format template is a function of ``spell_id`` alone
  (returned separately by :func:`effect_formats`).
- StaticInstance (stat 23) is the client's row id for the item. It lives in
  ``misc`` rather than ``stats`` so that it cannot make two otherwise equal
  stat sets differ.
- A part the record does not have is ``None`` and has no hash. An attack/defense
  block with no entries counts as absent.
- A stat/value pair repeated verbatim is stored once: the repetition carries
  nothing. The same stat with two different values keeps both, and an effect
  repeated within an event is kept as often as it appears.
- NUL characters, which the client data contains (shop hashes) and PostgreSQL
  text and jsonb cannot hold, are written as the six characters ``\\u0000``.
- ``revision_hash`` identifies the whole content of one item revision: it
  covers every part hash and whether the record is a nano. Two builds carry
  the same revision of an AOID exactly when it is equal.
- ``Sounds``, ``UNK1``, ``Version`` and ``DBType`` are not stored: no feature
  reads them and the extracts remain the source of truth.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from app.core.content_hash import hash_object

PART_NAMES = ("text", "stats", "effects", "actions", "atkdef", "misc")

STAT_STATIC_INSTANCE = 23
STAT_QL = 54
STAT_ITEM_CLASS = 76

# Keys of a raw spell entry that are not parameters of the effect.
_EFFECT_FIXED_KEYS = frozenset(
    {
        "SpellID",
        "Target",
        "TickCount",
        "TickInterval",
        "Criteria",
        "SpellFormat",
        "SpellDescription",
    }
)
# Effect keys that are rendered from the others and therefore not hashed.
_EFFECT_DERIVED_KEYS = ("description",)
# Parameters that say what an effect acts on; used to order effects readably.
_EFFECT_SUBJECT_PARAMS = ("Stat", "Skill", "NanoID")

Pair = List[int]


@dataclass(frozen=True)
class ItemParts:
    """One item record split into its scalar columns and canonical parts."""

    aoid: int
    is_nano: bool
    ql: int
    item_class: int
    documents: Dict[str, Any]
    hashes: Dict[str, Optional[str]]
    revision_hash: str


def _pairs(entries: Any, skip: frozenset = frozenset()) -> List[Pair]:
    pairs = {
        (entry["Stat"], entry["RawValue"])
        for entry in entries or []
        if entry.get("Stat") not in skip
    }
    return [list(pair) for pair in sorted(pairs)]


def _storable(value: Any) -> Any:
    """``value`` with NUL characters, which PostgreSQL cannot store, made visible."""
    if isinstance(value, str):
        return value.replace("\x00", "\\u0000") if "\x00" in value else value
    if isinstance(value, dict):
        return {key: _storable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_storable(item) for item in value]
    return value


def _criteria(entries: Any) -> List[List[int]]:
    return [[c["Value1"], c["Value2"], c["Operator"]] for c in entries or []]


def _hashed_effect(effect: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in effect.items() if k not in _EFFECT_DERIVED_KEYS}


def _effect_sort_key(effect: Dict[str, Any]) -> Tuple:
    params = effect["params"]
    subject = tuple(
        params[k] if isinstance(params.get(k), int) else -1
        for k in _EFFECT_SUBJECT_PARAMS
    )
    return (
        effect["spell_id"],
        effect["target"] if effect["target"] is not None else -1,
        subject,
        hash_object(_hashed_effect(effect)),
    )


def _effect(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "spell_id": raw["SpellID"],
        "target": raw.get("Target"),
        "tick_count": raw.get("TickCount"),
        "tick_interval": raw.get("TickInterval"),
        "params": {
            k: _storable(v) for k, v in raw.items() if k not in _EFFECT_FIXED_KEYS
        },
        "criteria": _criteria(raw.get("Criteria")),
        "description": _storable(raw.get("SpellDescription")),
    }


def text_part(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": _storable(record.get("Name") or ""),
        "description": _storable(record.get("Description") or ""),
    }


def stats_part(record: Dict[str, Any]) -> List[Pair]:
    return _pairs(record.get("StatValues"), skip=frozenset({STAT_STATIC_INSTANCE}))


def effects_part(record: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    events = [
        {
            "event": event["Event"],
            "effects": sorted(
                (_effect(raw) for raw in event.get("Items") or []),
                key=_effect_sort_key,
            ),
        }
        for event in record.get("SpellData") or []
    ]
    events.sort(key=lambda e: (e["event"], hash_object(_hashed_events([e]))))
    return events or None


def actions_part(record: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    actions = [
        {"action": action["Action"], "criteria": _criteria(action.get("Criteria"))}
        for action in (record.get("ActionData") or {}).get("Actions") or []
    ]
    actions.sort(key=lambda a: (a["action"], a["criteria"]))
    return actions or None


def atkdef_part(record: Dict[str, Any]) -> Optional[Dict[str, List[Pair]]]:
    raw = record.get("AttackDefenseData") or {}
    attack, defense = _pairs(raw.get("Attack")), _pairs(raw.get("Defense"))
    if not attack and not defense:
        return None
    return {"attack": attack, "defense": defense}


def misc_part(record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    misc: Dict[str, Any] = {}
    instances = [
        entry["RawValue"]
        for entry in record.get("StatValues") or []
        if entry.get("Stat") == STAT_STATIC_INSTANCE
    ]
    if instances:
        misc["static_instance"] = sorted(set(instances))
    mesh = record.get("AnimationMesh")
    if mesh:
        misc["animation_mesh"] = {
            key.lower(): [mesh[key]["Stat"], mesh[key]["RawValue"]]
            for key in ("Animation", "Mesh")
            if mesh.get(key)
        }
    if record.get("ShopHashData"):
        misc["shop"] = _storable(record["ShopHashData"])
    return misc or None


def _hashed_events(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {"event": e["event"], "effects": [_hashed_effect(x) for x in e["effects"]]}
        for e in events
    ]


def part_hash(name: str, document: Any) -> Optional[str]:
    """Hash of one part document, or ``None`` when the item has no such part."""
    if document is None:
        return None
    if name == "effects":
        document = _hashed_events(document)
    return hash_object(document)


def effect_formats(record: Dict[str, Any]) -> Dict[int, str]:
    """``{spell_id: format template}`` for the effect types this record uses."""
    return {
        raw["SpellID"]: raw["SpellFormat"]
        for event in record.get("SpellData") or []
        for raw in event.get("Items") or []
        if raw.get("SpellFormat") is not None
    }


def _first_stat(record: Dict[str, Any], stat: int) -> Optional[int]:
    for entry in record.get("StatValues") or []:
        if entry.get("Stat") == stat:
            return entry.get("RawValue")
    return None


def split_item(record: Dict[str, Any], is_nano: bool) -> ItemParts:
    """Split a raw item record into scalar columns and canonical, hashed parts.

    ``ql`` follows the importer it replaces: a nano's client QL is always 1 and
    its real QL comes from curated data, so only items read stat 54.
    """
    documents = {
        "text": text_part(record),
        "stats": stats_part(record),
        "effects": effects_part(record),
        "actions": actions_part(record),
        "atkdef": atkdef_part(record),
        "misc": misc_part(record),
    }
    ql = None if is_nano else _first_stat(record, STAT_QL)
    item_class = _first_stat(record, STAT_ITEM_CLASS)
    hashes = {name: part_hash(name, doc) for name, doc in documents.items()}
    return ItemParts(
        aoid=record["AOID"],
        is_nano=is_nano,
        ql=ql if ql is not None else 1,
        item_class=item_class if item_class is not None else 0,
        documents=documents,
        hashes=hashes,
        revision_hash=hash_object([is_nano] + [hashes[name] for name in PART_NAMES]),
    )
