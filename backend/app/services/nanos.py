"""
Nano programs of a build, read from the content-addressed store.

The queries behind the ``/nanos`` routes and the response shapes they serve.
Everything starts from ``revisions(build)`` restricted to nanos:

* the list, the search and the strain counts filter on the revision's curated
  QL, its text, and its ``nano_properties`` row under the build's strain
  policy (school, casting professions, minimum level, effective strain);
* the profession lists keep the nanos with a real strain whose Use action
  names the profession, and the offensive list those among them that damage
  a hostile target's health.

A nano's strain is always the effective one of ``nano_properties``: in filters,
in counts, in ``strain_id`` and in the stats of a response.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import (
    ColumnElement,
    Select,
    and_,
    exists,
    false,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.api.schemas import ItemDetail
from app.api.schemas.nano import NanoItemDetail, NanoProgram, NanoStrainCount
from app.core import nano_properties
from app.store import tables as t
from app.store.context import Build
from app.store.items import (
    ItemRecord,
    actions_response,
    item_document,
    load_effect_formats,
    load_records,
)
from app.store.presence import (
    Page,
    any_of,
    fetch_page,
    fetch_search_page,
    has_effect,
    nano_policy,
    revisions,
    text_contains,
)

TEST_ITEM_PREFIX = "TESTLIVEITEM"
# A strain of 0 or 99999 is the client's "no strain".
NO_STRAIN = 99999

TARGET_HOSTILE = 3
SPELL_MODIFY_STAT = 53002
STAT_HEALTH = 27
OPERATOR_ON_TARGET = 18
# Time to cast a nano and to recharge after it, in centiseconds.
STAT_ATTACK_DELAY = 294
STAT_RECHARGE_DELAY = 210

_revision = t.item_revision
_text = t.part_text
_properties = t.nano_properties


@dataclass(frozen=True)
class NanoFilters:
    """The filters of ``/nanos``, as the request gives them.

    ``school``, ``profession`` and ``strain`` hold names or ids; a value that
    names nothing is ignored, and a filter of only such values matches nothing.
    """

    school: Optional[Sequence[str]] = None
    profession: Optional[Sequence[str]] = None
    strain: Optional[Sequence[str]] = None
    level_min: Optional[int] = None
    level_max: Optional[int] = None
    ql_min: Optional[int] = None
    ql_max: Optional[int] = None
    q: Optional[str] = None


@dataclass(frozen=True)
class DerivedFields:
    """A nano's ``nano_properties`` row under the build's strain policy."""

    school: Optional[int]
    professions: Sequence[int]
    min_level: Optional[int]
    strain: Optional[int]

    def response(self) -> Dict[str, Any]:
        return {
            "school": nano_properties.school_name(self.school),
            "professions": nano_properties.profession_names(self.professions),
            "level": self.min_level,
            "strain_id": self.strain,
            "strain": nano_properties.strain_name(self.strain),
        }


_NO_PROPERTIES = DerivedFields(school=None, professions=(), min_level=None, strain=None)


def _known_ids(
    values: Optional[Sequence[str]], lookup: Callable[[str], Optional[int]]
) -> Optional[List[int]]:
    """Ids of the names in ``values`` that ``lookup`` knows; None if no filter."""
    if not values:
        return None
    return sorted({i for i in (lookup(v) for v in values) if i is not None})


def _nanos(build: Build) -> Select:
    """The nano revisions of ``build`` with their text."""
    return (
        revisions(build)
        .join(_text, _text.c.text_id == _revision.c.text_id)
        .where(_revision.c.is_nano)
    )


def _text_matches(q: str) -> ColumnElement:
    """The nano's name or description contains ``q``.

    The condition is left bare, so that a rare term and a term nothing
    matches are answered from the trigram indexes of ``part_text`` (1 to
    20 ms). A common term ("nano", "the") or one too short for a trigram is
    run over the text of every item of every build before the join, which
    costs 35 to 65 ms since the texts are matched in lower case; tying the
    pattern to the build's nanos instead costs as much for those and 30 to
    50 ms for every other term.
    """
    term = f"%{q}%"
    return or_(
        text_contains(_text, "name", term), text_contains(_text, "description", term)
    )


def filtered_nanos(
    build: Build, filters: NanoFilters, with_properties: bool = False
) -> Select:
    """The nanos of ``build`` that pass ``filters``.

    ``nano_properties`` is joined when a filter reads it; ``with_properties``
    joins it (outer) anyway, for a caller that sorts or groups on it.
    """
    query = _nanos(build)
    if filters.q:
        query = query.where(_text_matches(filters.q))
    if filters.ql_min is not None:
        query = query.where(_revision.c.ql >= filters.ql_min)
    if filters.ql_max is not None:
        query = query.where(_revision.c.ql <= filters.ql_max)

    schools = _known_ids(filters.school, nano_properties.school_id)
    professions = _known_ids(filters.profession, nano_properties.profession_id)
    strains = (
        sorted(
            {i for value in filters.strain for i in nano_properties.strain_ids(value)}
        )
        if filters.strain
        else None
    )
    if (
        schools is not None
        or professions is not None
        or strains is not None
        or filters.level_min is not None
        or filters.level_max is not None
    ):
        query = query.join(_properties, nano_policy(build))
    elif with_properties:
        query = query.outerjoin(_properties, nano_policy(build))

    if schools is not None:
        query = query.where(
            any_of(_properties.c.school, schools) if schools else false()
        )
    if professions is not None:
        # An empty list is "no restriction" only for nanos with a Use action;
        # the rest (level NULL) are procs and effects nobody casts
        unrestricted = and_(
            func.cardinality(_properties.c.professions) == 0,
            _properties.c.min_level.isnot(None),
        )
        query = query.where(
            or_(_properties.c.professions.overlap(professions), unrestricted)
            if professions
            else false()
        )
    if strains is not None:
        query = query.where(
            any_of(_properties.c.strain, strains) if strains else false()
        )
    if filters.level_min is not None:
        query = query.where(_properties.c.min_level >= filters.level_min)
    if filters.level_max is not None:
        query = query.where(_properties.c.min_level <= filters.level_max)
    return query


def _sort_keys(
    field: str, descending: bool, fallback: ColumnElement
) -> List[ColumnElement]:
    """Sort keys of a nano list; the AOID tie-break is added by ``fetch_page``."""
    if field == "level":
        # Nanos without a level (no Use action) sort last either way
        level = _properties.c.min_level
        return [level.desc().nulls_last() if descending else level.asc().nulls_last()]
    column = {"name": _text.c.name, "ql": _revision.c.ql}.get(field, fallback)
    return [column.desc() if descending else column.asc()]


def nano_page(
    db: Session,
    build: Build,
    filters: NanoFilters,
    sort_by: str,
    sort_desc: bool,
    page: int,
    page_size: int,
) -> Tuple[List[NanoProgram], int]:
    """One page of the nanos passing ``filters`` and how many pass in all.

    ``sort_by`` is ``name``, ``ql`` or ``level``; anything else sorts by name.
    """
    query = filtered_nanos(build, filters, with_properties=sort_by == "level")
    keys = _sort_keys(sort_by, sort_desc, _text.c.name)
    fetch = fetch_search_page if filters.q else fetch_page
    found = fetch(db, query, keys, page, page_size)
    records = load_records(db, build, rev_ids=found.rev_ids)
    derived = load_derived_fields(db, build, found.rev_ids)
    return [nano_program(record, derived) for record in records], found.total


def strain_counts(
    db: Session, build: Build, filters: NanoFilters
) -> List[NanoStrainCount]:
    """The strains of the nanos passing ``filters`` (its strain filter left
    out) with the number of nanos of each: by name, then id, unnamed last."""
    query = filtered_nanos(build, filters, with_properties=True)
    rows = db.execute(
        query.with_only_columns(_properties.c.strain, func.count())
        .where(_properties.c.strain.isnot(None))
        .group_by(_properties.c.strain)
    )
    strains = [
        NanoStrainCount(
            id=strain, name=nano_properties.strain_name(strain), count=count
        )
        for strain, count in rows
    ]
    strains.sort(key=lambda s: (s.name is None, (s.name or "").casefold(), s.id))
    return strains


def _names_profession(profession_id: int) -> ColumnElement:
    """The revision's Use action has a Profession or VisualProfession
    criterion for ``profession_id`` that describes the caster: one that
    directly follows an OnTarget modifier describes the target instead."""
    criterion = t.requirement.alias("criterion")
    previous = t.requirement.alias("previous")
    follows_on_target = exists().where(
        previous.c.actions_id == criterion.c.actions_id,
        previous.c.action == criterion.c.action,
        previous.c.position == criterion.c.position - 1,
        previous.c.operator == OPERATOR_ON_TARGET,
    )
    return exists().where(
        criterion.c.actions_id == _revision.c.actions_id,
        criterion.c.action == nano_properties.USE_ACTION,
        criterion.c.value1.in_(
            (nano_properties.STAT_PROFESSION, nano_properties.STAT_VISUAL_PROFESSION)
        ),
        criterion.c.value2 == profession_id,
        ~follows_on_target,
    )


def castable_nanos(build: Build, profession_id: int) -> Select:
    """The nanos of ``build`` a profession list shows: a real strain, not a
    test item, and for a ``profession_id`` above 0 a Use action that names it.
    """
    query = (
        _nanos(build)
        .join(_properties, nano_policy(build))
        .where(
            ~_text.c.name.startswith(TEST_ITEM_PREFIX),
            _properties.c.strain > 0,
            _properties.c.strain != NO_STRAIN,
        )
    )
    if profession_id > 0:
        query = query.where(_names_profession(profession_id))
    return query


def offensive_nanos(build: Build, profession_id: int) -> Select:
    """``castable_nanos`` that lower a hostile target's health."""
    return castable_nanos(build, profession_id).where(
        has_effect(
            t.effect_entry.c.target == TARGET_HOSTILE,
            t.effect_entry.c.spell_id == SPELL_MODIFY_STAT,
            t.effect_entry.c.subject == STAT_HEALTH,
        )
    )


def profession_page(
    db: Session, query: Select, sort: str, sort_order: str, page: int, page_size: int
) -> Page:
    """One page of a profession list: by ``name`` or, by default, ``ql``."""
    keys = _sort_keys(
        sort if sort in ("name", "ql") else "ql", sort_order == "desc", _revision.c.ql
    )
    return fetch_page(db, query, keys, page, page_size)


def load_derived_fields(
    db: Session, build: Build, rev_ids: Sequence[int]
) -> Dict[int, DerivedFields]:
    """``{rev_id: derived fields}`` of the nanos among ``rev_ids``. One query."""
    if not rev_ids:
        return {}
    rows = db.execute(
        select(
            _properties.c.rev_id,
            _properties.c.school,
            _properties.c.professions,
            _properties.c.min_level,
            _properties.c.strain,
        ).where(
            any_of(_properties.c.rev_id, rev_ids),
            _properties.c.overlay_strain_first == build.overlay_strain_first,
        )
    )
    return {
        row.rev_id: DerivedFields(
            school=row.school,
            professions=row.professions,
            min_level=row.min_level,
            strain=row.strain,
        )
        for row in rows
    }


def _stat(record: ItemRecord, stat: int) -> Optional[int]:
    """The record's value of ``stat``; None when it does not have it."""
    return next((value for key, value in record.stats if key == stat), None)


def nano_program(record: ItemRecord, derived: Dict[int, DerivedFields]) -> NanoProgram:
    """The ``NanoProgram`` response of one nano."""
    return NanoProgram.model_validate(
        {
            "id": record.aoid,
            "aoid": record.aoid,
            "name": record.name,
            "ql": record.ql,
            "description": record.description,
            # What it takes to cast the nano is the criteria of its actions
            # (the Use action), not its effects' criteria, which gate
            # individual effects.
            "actions": actions_response(record),
            "casting_time": _stat(record, STAT_ATTACK_DELAY),
            "recharge_time": _stat(record, STAT_RECHARGE_DELAY),
            **derived.get(record.rev_id, _NO_PROPERTIES).response(),
        }
    )


def _detail_fields(record: ItemRecord, formats: Dict[int, str]) -> Dict[str, Any]:
    """A nano as an item of a profession list: no attack or defense skills,
    and sources left to the item's own page."""
    return {**item_document(record, formats), "attack_stats": [], "defense_stats": []}


def nano_item_details(
    db: Session, build: Build, rev_ids: Sequence[int]
) -> List[NanoItemDetail]:
    """``NanoItemDetail`` responses of these nano revisions, in order."""
    records = load_records(db, build, rev_ids=rev_ids)
    if not records:
        return []
    formats = load_effect_formats(db)
    derived = load_derived_fields(db, build, rev_ids)
    return [
        NanoItemDetail.model_validate(
            {
                **_detail_fields(record, formats),
                **derived.get(record.rev_id, _NO_PROPERTIES).response(),
            }
        )
        for record in records
    ]


def item_details(db: Session, build: Build, rev_ids: Sequence[int]) -> List[ItemDetail]:
    """``ItemDetail`` responses of these nano revisions, in order."""
    records = load_records(db, build, rev_ids=rev_ids)
    if not records:
        return []
    formats = load_effect_formats(db)
    return [
        ItemDetail.model_validate(_detail_fields(record, formats)) for record in records
    ]
