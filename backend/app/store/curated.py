"""
Symbiants, mobs and perks of a build.

Symbiants are derived from items: ``symbiant_items`` has one row per symbiant
revision and a build serves the rows of the revisions it carries, whatever its
feature flags. Mobs, their drops and perks are curated
(002_curated_and_derived.sql): they are served when the build's flag is on
(``symbiants`` for mobs and drops, ``perks`` for perks) and the items they name
are present in the build. A retired mob is never served.

``mob.mob_id`` is the ``id`` the API serves for a mob.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import ColumnElement, ScalarSelect, Select, and_, func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import FromClause

from app.api.schemas import MobDropInfo, MobResponse, SymbiantResponse
from app.store import tables as t
from app.store.context import Build
from app.store.items import (
    SOURCE_TYPE_MOB,
    ItemRecord,
    actions_response,
    load_effect_formats,
    load_records,
    spell_data_response,
    spell_params,
    stats_response,
)
from app.store.presence import any_of, present

PROFESSION_NAMES = {
    1: "Soldier",
    2: "MartialArtist",
    3: "Engineer",
    4: "Fixer",
    5: "Agent",
    6: "Adventurer",
    7: "Trader",
    8: "Bureaucrat",
    9: "Enforcer",
    10: "Doctor",
    11: "NanoTechnician",
    12: "MetaPhysicist",
    13: "Monster",
    14: "Keeper",
    15: "Shade",
}

BREED_NAMES = {1: "Solitus", 2: "Opifex", 3: "Nanomage", 4: "Atrox", 7: "HumanMonster"}

_SYMBIANT_COLUMNS = (
    t.symbiant_items.c.rev_id,
    t.symbiant_items.c.aoid,
    t.symbiant_items.c.name,
    t.symbiant_items.c.ql,
    t.symbiant_items.c.slot_id,
    t.symbiant_items.c.family,
)


# --------------------------------------------------------------------- symbiants


def _carried(build: Build) -> ColumnElement:
    """The row of ``symbiant_items`` is a revision ``build`` carries, so a
    query filtered by it has one row per symbiant of the build.

    A lookup per row through ``item_presence_rev``, which finds at most one
    run of the build. Joined instead, the planner reads the whole presence of
    the branch to find a few thousand symbiants; looked up by AOID, it may
    pick the exclusion constraint's index, which is twenty times slower.
    """
    return t.symbiant_items.c.aoid == (
        select(t.item_presence.c.aoid)
        .where(present(build), t.item_presence.c.rev_id == t.symbiant_items.c.rev_id)
        .scalar_subquery()
    )


def _symbiant_responses(
    db: Session, build: Build, rows: Sequence[Any]
) -> List[SymbiantResponse]:
    """Rows of ``symbiant_items`` with their requirements and effects, in the
    order given. Two queries whatever the number of rows."""
    if not rows:
        return []
    records = {
        record.rev_id: record
        for record in load_records(db, build, rev_ids=[row.rev_id for row in rows])
    }
    formats = load_effect_formats(db)
    return [
        SymbiantResponse.model_validate(
            {
                "id": row.aoid,
                "aoid": row.aoid,
                "name": row.name,
                "ql": row.ql,
                "slot_id": row.slot_id,
                "family": row.family,
                "spell_data": spell_data_response(records[row.rev_id], formats),
                "actions": actions_response(records[row.rev_id]),
            }
        )
        for row in rows
    ]


def list_symbiants(
    db: Session, build: Build, page: int, page_size: int
) -> Tuple[List[SymbiantResponse], int]:
    """One page of the build's symbiants by family, QL, name and AOID, and
    their total."""
    total = db.execute(
        select(func.count()).select_from(t.symbiant_items).where(_carried(build))
    ).scalar_one()
    rows = db.execute(
        select(*_SYMBIANT_COLUMNS)
        .where(_carried(build))
        .order_by(
            t.symbiant_items.c.family,
            t.symbiant_items.c.ql,
            t.symbiant_items.c.name,
            t.symbiant_items.c.aoid,
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return _symbiant_responses(db, build, rows), total


def get_symbiant(db: Session, build: Build, aoid: int) -> Optional[SymbiantResponse]:
    """The build's symbiant with this AOID, None when it has none."""
    rows = db.execute(
        select(*_SYMBIANT_COLUMNS).where(
            any_of(t.symbiant_items.c.aoid, [aoid]), _carried(build)
        )
    ).all()
    responses = _symbiant_responses(db, build, rows)
    return responses[0] if responses else None


def has_symbiant(db: Session, build: Build, aoid: int) -> bool:
    return (
        db.execute(
            select(t.symbiant_items.c.rev_id).where(
                any_of(t.symbiant_items.c.aoid, [aoid]), _carried(build)
            )
        ).first()
        is not None
    )


# -------------------------------------------------------------------------- mobs


def _mob_sources() -> FromClause:
    """Sources that are mobs; ``source.entity_id`` is the mob id."""
    return t.source.join(
        t.source_type,
        and_(
            t.source_type.c.source_type_id == t.source.c.source_type_id,
            t.source_type.c.name == SOURCE_TYPE_MOB,
        ),
    )


def _drop_count(build: Build) -> ScalarSelect:
    """How many items of ``build`` the mob of the enclosing query drops."""
    return (
        select(func.count())
        .select_from(
            _mob_sources()
            .join(t.item_source, t.item_source.c.source_id == t.source.c.source_id)
            .join(
                t.item_presence,
                and_(t.item_presence.c.aoid == t.item_source.c.aoid, present(build)),
            )
        )
        .where(t.source.c.entity_id == t.mob.c.mob_id)
        .correlate(t.mob)
        .scalar_subquery()
    )


def _mobs(build: Build, *conditions: ColumnElement) -> Select:
    """The mobs served, as the columns of a ``MobResponse``."""
    return select(
        t.mob.c.mob_id.label("id"),
        t.mob.c.name,
        t.mob.c.level,
        t.mob.c.playfield,
        t.mob.c.location,
        t.mob.c.mob_names,
        t.mob.c.is_pocket_boss,
        _drop_count(build).label("symbiant_count"),
    ).where(~t.mob.c.retired, *conditions)


def list_mobs(
    db: Session,
    build: Build,
    page: int,
    page_size: int,
    *,
    is_pocket_boss: Optional[bool] = None,
    playfield: Optional[str] = None,
    min_level: Optional[int] = None,
    max_level: Optional[int] = None,
) -> Tuple[List[MobResponse], int]:
    """One page of the build's mobs by level, name and mob id, and their
    total. A build without the ``symbiants`` feature has no mobs."""
    if not build.has("symbiants"):
        return [], 0
    conditions: List[ColumnElement] = []
    if is_pocket_boss is not None:
        conditions.append(t.mob.c.is_pocket_boss == is_pocket_boss)
    if playfield:
        conditions.append(t.mob.c.playfield.ilike(f"%{playfield}%"))
    if min_level is not None:
        conditions.append(t.mob.c.level >= min_level)
    if max_level is not None:
        conditions.append(t.mob.c.level <= max_level)
    total = db.execute(
        select(func.count()).select_from(t.mob).where(~t.mob.c.retired, *conditions)
    ).scalar_one()
    rows = db.execute(
        _mobs(build, *conditions)
        .order_by(t.mob.c.level, t.mob.c.name, t.mob.c.mob_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [MobResponse.model_validate(dict(row._mapping)) for row in rows], total


def get_mob(db: Session, build: Build, mob_id: int) -> Optional[MobResponse]:
    """The mob with this id as ``build`` serves it, None when it does not."""
    if not build.has("symbiants"):
        return None
    row = db.execute(_mobs(build, any_of(t.mob.c.mob_id, [mob_id]))).first()
    return MobResponse.model_validate(dict(row._mapping)) if row else None


def has_mob(db: Session, build: Build, mob_id: int) -> bool:
    if not build.has("symbiants"):
        return False
    return (
        db.execute(
            select(t.mob.c.mob_id).where(
                ~t.mob.c.retired, any_of(t.mob.c.mob_id, [mob_id])
            )
        ).first()
        is not None
    )


def mob_drops(
    db: Session, build: Build, mob_id: int, family: Optional[str] = None
) -> List[SymbiantResponse]:
    """The build's symbiants a mob drops, by QL, name and AOID."""
    if not build.has("symbiants"):
        return []
    query = (
        select(*_SYMBIANT_COLUMNS)
        .select_from(
            _mob_sources()
            .join(t.item_source, t.item_source.c.source_id == t.source.c.source_id)
            .join(t.symbiant_items, t.symbiant_items.c.aoid == t.item_source.c.aoid)
        )
        .where(any_of(t.source.c.entity_id, [mob_id]), _carried(build))
    )
    if family:
        query = query.where(t.symbiant_items.c.family == family)
    rows = db.execute(
        query.order_by(
            t.symbiant_items.c.ql, t.symbiant_items.c.name, t.symbiant_items.c.aoid
        )
    ).all()
    return _symbiant_responses(db, build, rows)


def symbiant_dropped_by(db: Session, build: Build, aoid: int) -> List[MobDropInfo]:
    """The pocket bosses that drop an item, by level, name and mob id."""
    if not build.has("symbiants"):
        return []
    rows = db.execute(
        select(
            t.mob.c.mob_id.label("id"),
            t.mob.c.name,
            t.mob.c.level,
            t.mob.c.location,
            t.mob.c.playfield,
            t.mob.c.is_pocket_boss,
        )
        .select_from(
            t.item_source.join(
                _mob_sources(), t.source.c.source_id == t.item_source.c.source_id
            ).join(t.mob, t.mob.c.mob_id == t.source.c.entity_id)
        )
        .where(
            any_of(t.item_source.c.aoid, [aoid]),
            ~t.mob.c.retired,
            t.mob.c.is_pocket_boss,
        )
        .order_by(t.mob.c.level, t.mob.c.name, t.mob.c.mob_id)
    )
    return [MobDropInfo.model_validate(dict(row._mapping)) for row in rows]


# ------------------------------------------------------------------------- perks


def _perk_info(
    perk: Any, record: ItemRecord, formats: Dict[int, str]
) -> Dict[str, Any]:
    """A perk as the lookup serves it: its item, then the curated fields."""
    ai_level = perk.ai_level_required
    if ai_level is not None and ai_level <= 0:
        ai_level = None
    return {
        "id": record.aoid,
        "aoid": record.aoid,
        "name": record.name,
        "ql": record.ql,
        "item_class": record.item_class,
        "description": record.description,
        "is_nano": record.is_nano,
        "stats": [{**stat, "stat_name": None} for stat in stats_response(record.stats)],
        "spell_data": [
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
                    }
                    for effect in event["effects"]
                ],
            }
            for event in record.effects
        ],
        "attack_stats": [],
        "defense_stats": [],
        "actions": [
            {
                "action": action["action"],
                "criteria": [
                    {**criterion, "order_index": position}
                    for position, criterion in enumerate(action["criteria"])
                ],
            }
            for action in actions_response(record)
        ],
        "perk_name": perk.name,
        "perk_counter": perk.counter,
        "perk_type": perk.type,
        "perk_series": perk.perk_series,
        "perk_professions": [
            PROFESSION_NAMES[profession]
            for profession in perk.professions
            if profession in PROFESSION_NAMES
        ],
        "perk_breeds": [
            BREED_NAMES[breed] for breed in perk.breeds if breed in BREED_NAMES
        ],
        "perk_level_required": perk.level_required,
        "perk_ai_level_required": ai_level,
        "counter": perk.counter,
        "type": perk.type,
        "level": perk.level_required,
        "ai_title": ai_level,
        "formatted_name": f"{perk.name} {perk.counter}",
    }


def lookup_perks(
    db: Session, build: Build, aoids: Sequence[int]
) -> Dict[int, Dict[str, Any]]:
    """``{aoid: perk}`` for the AOIDs that are perks ``build`` serves. Three
    queries whatever the number of AOIDs."""
    if not aoids or not build.has("perks"):
        return {}
    perks = db.execute(
        select(t.perk, t.item_presence.c.rev_id)
        .select_from(
            t.perk.join(
                t.item_presence,
                and_(t.item_presence.c.aoid == t.perk.c.aoid, present(build)),
            )
        )
        .where(any_of(t.perk.c.aoid, aoids))
    ).all()
    if not perks:
        return {}
    records = {
        record.rev_id: record
        for record in load_records(db, build, rev_ids=[perk.rev_id for perk in perks])
    }
    formats = load_effect_formats(db)
    return {
        perk.aoid: _perk_info(perk, records[perk.rev_id], formats) for perk in perks
    }
