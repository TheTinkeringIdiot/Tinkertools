"""
Filters and text search of the item list and item search routes, on the store.

The filter and match functions return conditions for a query built on
``app.store.presence.revisions``.

Stat ids the filters read:
- 0   flags (bit 16384 = NODROP)
- 4   Breed
- 33  Faction
- 59  Gender
- 60  Profession / 368 VisualProfession
- 75  NanoStrain
- 298 EquippedIn (bitmask of equipment slots)
- 389 Expansion (its absence is what "froob friendly" means)
"""

from __future__ import annotations

import logging
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import BigInteger, ColumnElement, cast, false, func, or_, select
from sqlalchemy.sql.expression import literal_column

from app.store import tables as t
from app.store.context import Build
from app.store.presence import has_effect, has_requirement, has_stat

logger = logging.getLogger(__name__)

STAT_FLAGS = 0
STAT_BREED = 4
STAT_FACTION = 33
STAT_GENDER = 59
STAT_PROFESSION = 60
STAT_VISUAL_PROFESSION = 368
STAT_NANO_STRAIN = 75
STAT_EQUIPPED_IN = 298
STAT_EXPANSION = 389

NODROP_FLAG = 16384
ACTION_USE = 3

# Effects that change a stat: Modify Stat (53045, 53012), Modify Stat for
# Duration (53014) and Set Skill (53026). ``effect_entry.subject`` is the stat
# or skill they act on and ``amount`` the change.
STAT_MODIFY_SPELLS = (53045, 53012, 53014, 53026)

# A stat value is a 32-bit integer; the slot mask is tested on it widened to
# 64 bits, so a mask bit above 62 cannot be asked of the database.
_HIGHEST_MASK_BIT = 62

SEARCHABLE_FIELDS = ("name", "description")
_VALID_SEARCH_FIELDS = frozenset({"name", "description", "effects", "stats"})

_TEXT_CONFIG = literal_column("'english'")
_SPACE = literal_column("' '")

StatFilter = Tuple[str, int, str, int]


def _compare(column: ColumnElement, operator: str, value: int) -> ColumnElement:
    """``column <operator> value`` for the operators the stat filters accept."""
    if operator == ">=":
        return column >= value
    if operator == "<=":
        return column <= value
    if operator == "==":
        return column == value
    if operator == "!=":
        return column != value
    raise ValueError(f"Unsupported operator: {operator}")


def modifies_stat(
    stat_ids: Sequence[int],
    operator: Optional[str] = None,
    value: Optional[int] = None,
) -> ColumnElement:
    """The revision has an effect that changes one of ``stat_ids``, by an
    amount meeting ``operator value`` when both are given."""
    conditions = [
        t.effect_entry.c.spell_id.in_(STAT_MODIFY_SPELLS),
        t.effect_entry.c.subject.in_(stat_ids),
    ]
    if operator and value is not None:
        conditions.append(_compare(t.effect_entry.c.amount, operator, value))
    return has_effect(*conditions)


def has_strain(build: Build, strain: int) -> ColumnElement:
    """The revision's strain in ``build`` is ``strain``.

    A nano's strain is the effective one of the build's strain policy
    (``nano_properties``); any other item only has the stat of its own. Both
    sets are small and found by index, so the revision is tested against
    their union rather than each revision against two subqueries.
    """
    other = t.item_revision.alias("strain_item")
    nanos = select(t.nano_properties.c.rev_id).where(
        t.nano_properties.c.overlay_strain_first == build.overlay_strain_first,
        t.nano_properties.c.strain == strain,
    )
    others = (
        select(other.c.rev_id)
        .select_from(
            t.stat_entry.join(other, other.c.stats_id == t.stat_entry.c.stats_id)
        )
        .where(
            t.stat_entry.c.stat == STAT_NANO_STRAIN,
            t.stat_entry.c.value == strain,
            ~other.c.is_nano,
        )
    )
    return t.item_revision.c.rev_id.in_(nanos.union_all(others))


def parse_stat_bonuses(stat_bonuses: Optional[str]) -> List[int]:
    """The stat ids of a ``stat_bonuses`` parameter (``"16,17,124"``). A list
    with anything that is not a number in it is ignored as a whole."""
    if not stat_bonuses:
        return []
    try:
        return [
            int(stat_id.strip())
            for stat_id in stat_bonuses.split(",")
            if stat_id.strip()
        ]
    except ValueError:
        logger.warning(f"Invalid stat_bonuses parameter: {stat_bonuses}")
        return []


def parse_stat_filters(stat_filters: Optional[str]) -> List[StatFilter]:
    """The well-formed filters of a ``stat_filters`` parameter:
    ``function:stat:operator:value`` separated by commas, such as
    ``requires:16:>=:500,modifies:124:>=:20``. Malformed ones are skipped."""
    filters: List[StatFilter] = []
    if not stat_filters:
        return filters
    for filter_str in stat_filters.split(","):
        parts = filter_str.strip().split(":")
        if len(parts) != 4:
            logger.warning(f"Invalid stat filter format: {filter_str}")
            continue
        function, stat_str, operator, value_str = parts
        if function not in ("requires", "modifies"):
            logger.warning(f"Invalid stat filter function: {function}")
            continue
        if operator not in ("==", "<=", ">=", "!="):
            logger.warning(f"Invalid stat filter operator: {operator}")
            continue
        try:
            stat_id = int(stat_str)
            value = int(value_str)
        except ValueError:
            logger.warning(f"Invalid stat ID or value in filter: {filter_str}")
            continue
        filters.append((function, stat_id, operator, value))
    return filters


def common_item_filters(
    build: Build,
    *,
    slot: Optional[int] = None,
    breed: Optional[int] = None,
    gender: Optional[int] = None,
    faction: Optional[int] = None,
    profession: Optional[int] = None,
    froob_friendly: Optional[bool] = None,
    nodrop: Optional[bool] = None,
    stat_bonuses: Optional[str] = None,
    stat_filters: Optional[str] = None,
    strain: Optional[int] = None,
) -> List[ColumnElement]:
    """Conditions of the advanced filters the item list and search share.

    Filters on the QL, the item class, nanos and text stay in the routes: they
    differ between the two.
    """
    conditions: List[ColumnElement] = []

    if slot is not None and slot > 0:
        if slot > _HIGHEST_MASK_BIT:
            conditions.append(false())
        else:
            conditions.append(
                has_stat(
                    t.stat_entry.c.stat == STAT_EQUIPPED_IN,
                    cast(t.stat_entry.c.value, BigInteger).op("&")(
                        cast(1 << slot, BigInteger)
                    )
                    > 0,
                )
            )

    for stat, wanted in (
        (STAT_BREED, breed),
        (STAT_GENDER, gender),
        (STAT_FACTION, faction),
    ):
        if wanted is not None and wanted > 0:
            conditions.append(
                has_requirement(
                    t.requirement.c.value1 == stat, t.requirement.c.value2 == wanted
                )
            )

    if profession is not None and profession > 0:
        conditions.append(
            has_requirement(
                t.requirement.c.action == ACTION_USE,
                t.requirement.c.value1.in_((STAT_PROFESSION, STAT_VISUAL_PROFESSION)),
                t.requirement.c.value2 == profession,
            )
        )

    if froob_friendly is True:
        conditions.append(~has_stat(t.stat_entry.c.stat == STAT_EXPANSION))
        conditions.append(~has_requirement(t.requirement.c.value1 == STAT_EXPANSION))

    if nodrop is not None:
        is_nodrop = has_stat(
            t.stat_entry.c.stat == STAT_FLAGS,
            t.stat_entry.c.value.op("&")(NODROP_FLAG) > 0,
        )
        conditions.append(is_nodrop if nodrop else ~is_nodrop)

    bonus_stat_ids = parse_stat_bonuses(stat_bonuses)
    if bonus_stat_ids:
        conditions.append(modifies_stat(bonus_stat_ids))

    for function, stat_id, operator, value in parse_stat_filters(stat_filters):
        if function == "requires":
            conditions.append(
                has_requirement(
                    t.requirement.c.value1 == stat_id,
                    _compare(t.requirement.c.value2, operator, value),
                )
            )
        else:
            conditions.append(modifies_stat([stat_id], operator, value))

    if strain is not None and strain > 0:
        conditions.append(has_strain(build, strain))

    return conditions


def parse_search_fields(search_fields: Optional[str]) -> List[str]:
    """The known fields a ``search_fields`` parameter names: ``name`` and
    ``description`` by default and when it names no known field. The fields
    ``effects`` and ``stats`` are accepted and search nothing."""
    if search_fields:
        requested = [field.strip().lower() for field in search_fields.split(",")]
        fields = [field for field in requested if field in _VALID_SEARCH_FIELDS]
        if fields:
            return fields
    return list(SEARCHABLE_FIELDS)


def _text_columns(fields: Sequence[str]) -> List[ColumnElement]:
    return [t.part_text.c[field] for field in SEARCHABLE_FIELDS if field in fields]


def substring_match(fields: Sequence[str], q: str) -> ColumnElement:
    """``q`` occurs in one of ``fields`` of ``part_text``, whatever the case.
    Only the name is read when ``fields`` names neither text column."""
    pattern = f"%{q}%"
    columns = _text_columns(fields) or [t.part_text.c.name]
    return or_(*(column.ilike(pattern) for column in columns))


def full_text_match(
    fields: Sequence[str], q: str
) -> Tuple[ColumnElement, ColumnElement]:
    """``(condition, rank)`` of a stemmed full-text search of ``q`` in
    ``fields`` of ``part_text``.

    ``q`` is read by ``websearch_to_tsquery``, which accepts any input: bare
    words are ANDed, and it knows quoted phrases, OR and -exclusion. The
    document is the name, the description, or the name, a space and the
    description: the three expressions indexed in 001_store.sql. Both columns
    are read when ``fields`` names neither.
    """
    columns = _text_columns(fields) or _text_columns(SEARCHABLE_FIELDS)
    document = columns[0]
    for column in columns[1:]:
        document = document.op("||")(_SPACE).op("||")(column)
    vector = func.to_tsvector(_TEXT_CONFIG, document)
    ts_query = func.websearch_to_tsquery(_TEXT_CONFIG, q)
    return vector.op("@@")(ts_query), func.ts_rank(vector, ts_query)
