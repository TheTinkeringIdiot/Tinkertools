"""
Item loader: revisions of a build as the items the API serves.

``load_records`` reads the parts of a set of items in one query and returns
``ItemRecord`` values: an item as served, before it is shaped into a response.
Use records when a route computes on items (interpolation, analysis).
``load_item_details`` returns the ``ItemDetail`` responses, in three queries
however many items are asked for: parts, effect formats, sources.
``load_item_documents`` returns the same items as plain JSON documents, for a
route that serves too many of them to validate each into a model.

Both take either AOIDs, which are looked up in the build, or revision ids that
a query on ``app.store.presence`` already found in the build. Results come
back in the order asked; an AOID the build does not have is left out.

How parts become a served item (app/core/parts.py, 002_curated_and_derived.sql):

* ``ql`` and ``item_class`` are the revision's columns; a nano's ``ql`` is
  already its curated QL.
* Stats are the stats part, plus stat 23 from ``misc.static_instance``. For a
  nano with a ``nano_properties`` row, stats 75 and 1003 are replaced by the
  effective strain and substrain of the build's strain policy.
* An effect's ``spell_params`` are its parameters plus ``SpellDescription``;
  its ``spell_format`` is the template of its effect type.
* Criteria keep the stored order, for actions and for effects.
* Sources follow the feature flags: a mob source needs ``symbiants``, an item
  source needs ``sources`` and the source item present in the build, whose
  name there is the source's name and ``crystal_name``.
* ``id`` is the AOID. The row id it used to hold does not exist in this store
  and the field goes away with the old one.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import ScalarSelect, Select, Table, and_, or_, select
from sqlalchemy.sql.expression import FromClause
from sqlalchemy.orm import Session

from app.api.schemas import (
    ItemDetail,
    ItemSourceResponse,
    SourceResponse,
    SourceTypeResponse,
)
from app.store import tables as t
from app.store.context import Build
from app.store.presence import any_of, nano_policy, present

STAT_STATIC_INSTANCE = 23
STAT_NANO_STRAIN = 75
STAT_NANO_SUBSTRAIN = 1003
_STRAIN_STATS = (STAT_NANO_STRAIN, STAT_NANO_SUBSTRAIN)

SOURCE_TYPE_ITEM = "item"
SOURCE_TYPE_MOB = "mob"

Pair = Tuple[int, int]


@dataclass(frozen=True)
class ItemRecord:
    """One item of a build as it is served.

    ``effects`` and ``actions`` are the part documents of app/core/parts.py
    (empty lists when the item has none); criteria are ``[value1, value2,
    operator]`` triples in evaluation order. Treat the documents as read-only.
    """

    rev_id: int
    aoid: int
    name: str
    description: str
    ql: int
    item_class: int
    is_nano: bool
    stats: List[Pair]
    effects: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]
    attack: List[Pair]
    defense: List[Pair]
    animation_mesh: Optional[Dict[str, List[int]]]


def _doc(part: Table, key: str) -> ScalarSelect:
    """The revision's document of one part, NULL when it has none."""
    return (
        select(part.c.doc)
        .where(part.c[key] == t.item_revision.c[key])
        .scalar_subquery()
    )


_RECORD_COLUMNS = (
    t.item_revision.c.rev_id,
    t.item_revision.c.aoid,
    t.item_revision.c.is_nano,
    t.item_revision.c.ql,
    t.item_revision.c.item_class,
    t.part_text.c.name,
    t.part_text.c.description,
    _doc(t.part_stats, "stats_id").label("stats"),
    _doc(t.part_effects, "effects_id").label("effects"),
    _doc(t.part_actions, "actions_id").label("actions"),
    _doc(t.part_atkdef, "atkdef_id").label("atkdef"),
    _doc(t.part_misc, "misc_id").label("misc"),
    t.nano_properties.c.rev_id.label("nano_rev_id"),
    t.nano_properties.c.strain,
    t.nano_properties.c.substrain,
)


def _record_query(
    build: Build, aoids: Optional[Sequence[int]], rev_ids: Optional[Sequence[int]]
) -> Select:
    """The parts of the revisions asked for.

    Part documents are fetched by scalar subqueries rather than joins: each is
    one lookup by primary key, and a join of all nine tables costs more to
    plan than the whole query takes to run.
    """
    if (aoids is None) == (rev_ids is None):
        raise ValueError("Give either aoids or rev_ids")
    revision = t.item_revision
    if rev_ids is not None:
        source: FromClause = revision
        wanted = [any_of(revision.c.rev_id, rev_ids)]
    else:
        source = t.item_presence.join(
            revision, revision.c.rev_id == t.item_presence.c.rev_id
        )
        wanted = [present(build), any_of(t.item_presence.c.aoid, aoids)]
    return (
        select(*_RECORD_COLUMNS)
        .select_from(
            source.join(
                t.part_text, t.part_text.c.text_id == revision.c.text_id
            ).outerjoin(t.nano_properties, nano_policy(build))
        )
        .where(*wanted)
    )


def _served_stats(row: Any) -> List[Pair]:
    stats = [(stat, value) for stat, value in row.stats]
    if row.is_nano and row.nano_rev_id is not None:
        stats = [pair for pair in stats if pair[0] not in _STRAIN_STATS]
        if row.strain is not None:
            stats.append((STAT_NANO_STRAIN, row.strain))
        if row.substrain is not None:
            stats.append((STAT_NANO_SUBSTRAIN, row.substrain))
    misc = row.misc or {}
    stats.extend(
        (STAT_STATIC_INSTANCE, value) for value in misc.get("static_instance", ())
    )
    return stats


def _record(row: Any) -> ItemRecord:
    atkdef = row.atkdef or {}
    return ItemRecord(
        rev_id=row.rev_id,
        aoid=row.aoid,
        name=row.name,
        description=row.description,
        ql=row.ql,
        item_class=row.item_class,
        is_nano=row.is_nano,
        stats=_served_stats(row),
        effects=row.effects or [],
        actions=row.actions or [],
        attack=[(stat, value) for stat, value in atkdef.get("attack", ())],
        defense=[(stat, value) for stat, value in atkdef.get("defense", ())],
        animation_mesh=(row.misc or {}).get("animation_mesh"),
    )


def load_records(
    db: Session,
    build: Build,
    *,
    aoids: Optional[Sequence[int]] = None,
    rev_ids: Optional[Sequence[int]] = None,
) -> List[ItemRecord]:
    """The items of ``build`` with these AOIDs, or these revisions, in the
    order given, each once. One query.

    AOIDs are looked up in the build. Revision ids are taken as given: they
    must come from a query on the build's presence."""
    wanted = aoids if aoids is not None else rev_ids
    if not wanted:
        return []
    rows = db.execute(_record_query(build, aoids, rev_ids))
    if aoids is not None:
        found = {row.aoid: row for row in rows}
    else:
        found = {row.rev_id: row for row in rows}
    return [_record(found[key]) for key in dict.fromkeys(wanted) if key in found]


def load_effect_formats(db: Session) -> Dict[int, str]:
    """``{spell_id: format template}`` of every effect type."""
    return {
        row.spell_id: row.format
        for row in db.execute(select(t.effect_type.c.spell_id, t.effect_type.c.format))
    }


def load_sources(
    db: Session, build: Build, aoids: Sequence[int]
) -> Dict[int, List[ItemSourceResponse]]:
    """``{aoid: sources}`` as ``build`` serves them, for items of the build."""
    mobs, items = build.has("symbiants"), build.has("sources")
    if not aoids or not (mobs or items):
        return {}
    crystal = t.item_presence.alias("crystal")
    crystal_revision = t.item_revision.alias("crystal_revision")
    crystal_text = t.part_text.alias("crystal_text")
    is_item = t.source_type.c.name == SOURCE_TYPE_ITEM
    served = []
    if mobs:
        served.append(t.source_type.c.name == SOURCE_TYPE_MOB)
    if items:
        served.append(and_(is_item, crystal.c.aoid.isnot(None)))
    rows = db.execute(
        select(
            t.item_source.c.aoid,
            t.item_source.c.drop_rate,
            t.item_source.c.min_ql,
            t.item_source.c.max_ql,
            t.item_source.c.conditions,
            t.item_source.c.metadata.label("link_metadata"),
            t.source.c.source_id,
            t.source.c.source_type_id,
            t.source.c.entity_id,
            t.source.c.name,
            t.source.c.metadata,
            t.source_type.c.name.label("type_name"),
            t.source_type.c.description.label("type_description"),
            crystal_text.c.name.label("crystal_name"),
        )
        .select_from(
            t.item_source.join(
                t.source, t.source.c.source_id == t.item_source.c.source_id
            )
            .join(
                t.source_type,
                t.source_type.c.source_type_id == t.source.c.source_type_id,
            )
            .outerjoin(
                crystal,
                and_(
                    is_item,
                    crystal.c.aoid == t.source.c.entity_id,
                    present(build, crystal),
                ),
            )
            .outerjoin(crystal_revision, crystal_revision.c.rev_id == crystal.c.rev_id)
            .outerjoin(
                crystal_text, crystal_text.c.text_id == crystal_revision.c.text_id
            )
        )
        .where(any_of(t.item_source.c.aoid, aoids), or_(*served))
        .order_by(t.item_source.c.aoid, t.source.c.entity_id, t.source.c.source_id)
    )
    sources: Dict[int, List[ItemSourceResponse]] = {}
    for row in rows:
        extra = row.link_metadata
        if row.type_name == SOURCE_TYPE_ITEM:
            extra = {**extra, "crystal_name": row.crystal_name}
        sources.setdefault(row.aoid, []).append(
            ItemSourceResponse(
                source=SourceResponse(
                    id=row.source_id,
                    source_type_id=row.source_type_id,
                    source_id=row.entity_id,
                    name=row.name if row.name is not None else row.crystal_name,
                    extra_data=row.metadata,
                    source_type=SourceTypeResponse(
                        id=row.source_type_id,
                        name=row.type_name,
                        description=row.type_description,
                    ),
                ),
                drop_rate=float(row.drop_rate) if row.drop_rate else None,
                min_ql=row.min_ql,
                max_ql=row.max_ql,
                conditions=row.conditions,
                extra_data=extra,
            )
        )
    return sources


def criteria_response(criteria: Sequence[Sequence[int]]) -> List[Dict[str, int]]:
    """Stored ``[value1, value2, operator]`` triples as response criteria."""
    return [
        {"value1": value1, "value2": value2, "operator": operator}
        for value1, value2, operator in criteria
    ]


def stats_response(pairs: Sequence[Pair]) -> List[Dict[str, int]]:
    return [{"stat": stat, "value": value} for stat, value in pairs]


def spell_params(effect: Dict[str, Any]) -> Dict[str, Any]:
    """An effect's parameters as served: with its rendered description."""
    return {**effect["params"], "SpellDescription": effect["description"]}


def spell_data_response(
    record: ItemRecord, formats: Dict[int, str]
) -> List[Dict[str, Any]]:
    return [
        {
            "event": event["event"],
            "spells": [
                {
                    "target": effect["target"],
                    "tick_count": effect["tick_count"],
                    "tick_interval": effect["tick_interval"],
                    "spell_id": effect["spell_id"],
                    "spell_format": formats.get(effect["spell_id"]),
                    "spell_params": spell_params(effect),
                    "criteria": criteria_response(effect["criteria"]),
                }
                for effect in event["effects"]
            ],
        }
        for event in record.effects
    ]


def actions_response(record: ItemRecord) -> List[Dict[str, Any]]:
    return [
        {
            "action": action["action"],
            "criteria": criteria_response(action["criteria"]),
        }
        for action in record.actions
    ]


def item_document(
    record: ItemRecord,
    formats: Dict[int, str],
    sources: Sequence[ItemSourceResponse] = (),
) -> Dict[str, Any]:
    """One record as the JSON document of its ``ItemDetail``.

    This is where the shape of a served item is written down.
    ``load_item_details`` validates it into the response model; a route that
    serves many items at once sends the documents as they are.
    """
    return {
        "aoid": record.aoid,
        "name": record.name,
        "ql": record.ql,
        "item_class": record.item_class,
        "description": record.description,
        "is_nano": record.is_nano,
        "id": record.aoid,
        "stats": stats_response(record.stats),
        "spell_data": spell_data_response(record, formats),
        "attack_stats": stats_response(record.attack),
        "defense_stats": stats_response(record.defense),
        "actions": actions_response(record),
        "sources": [source.model_dump(mode="json") for source in sources],
    }


def load_item_documents(
    db: Session,
    build: Build,
    *,
    aoids: Optional[Sequence[int]] = None,
    rev_ids: Optional[Sequence[int]] = None,
) -> List[Dict[str, Any]]:
    """``item_document`` of these AOIDs or revisions of ``build``, in the
    order given. Three queries whatever the number of items."""
    records = load_records(db, build, aoids=aoids, rev_ids=rev_ids)
    if not records:
        return []
    formats = load_effect_formats(db)
    sources = load_sources(db, build, [record.aoid for record in records])
    return [
        item_document(record, formats, sources.get(record.aoid, ()))
        for record in records
    ]


def load_item_details(
    db: Session,
    build: Build,
    *,
    aoids: Optional[Sequence[int]] = None,
    rev_ids: Optional[Sequence[int]] = None,
) -> List[ItemDetail]:
    """``ItemDetail`` responses for these AOIDs or revisions of ``build``, in
    the order given. Three queries whatever the number of items."""
    return [
        ItemDetail.model_validate(document)
        for document in load_item_documents(db, build, aoids=aoids, rev_ids=rev_ids)
    ]
