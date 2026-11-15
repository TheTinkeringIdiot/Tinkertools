"""
"The revisions present in this build": the base of every list and search.

``revisions(build)`` selects from ``item_presence`` joined to
``item_revision``, restricted to the build. It yields exactly one row per item
of the build, so nothing built on it needs DISTINCT. Filters are added with
``.where()``:

* scalar columns of ``item_revision`` (``ql``, ``item_class``, ``is_nano``,
  ``aoid``) directly;
* name and description by joining ``part_text`` on ``text_id``, a substring
  whatever the case with ``text_contains``;
* stats, requirements, effects and attack/defense skills with the EXISTS
  helpers below, which test the revision's part in a search projection;
* nano school, professions, level and strain by joining ``nano_properties``
  with ``nano_policy(build)``.

``fetch_page`` counts the matches and returns one page of revision ids in the
requested order, always ending the sort on the AOID so pages are stable.
``fetch_search_page`` does the same for a query that matches text.
``app.store.items`` turns the ids into response items.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import (
    ColumnElement,
    Integer,
    Select,
    and_,
    asc,
    desc,
    exists,
    func,
    nulls_first,
    nulls_last,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session
from sqlalchemy.sql import operators
from sqlalchemy.sql.elements import UnaryExpression
from sqlalchemy.sql.expression import FromClause, bindparam

from app.store import tables as t
from app.store.context import Build


def present(build: Build, presence: FromClause = t.item_presence) -> ColumnElement:
    """Rows of ``item_presence`` (or an alias of it) that hold in ``build``."""
    return and_(
        presence.c.branch == build.branch,
        presence.c.from_ordinal <= build.ordinal,
        presence.c.to_ordinal >= build.ordinal,
    )


def revisions(build: Build, *columns: Any) -> Select:
    """SELECT over the item revisions of ``build``; ``rev_id`` unless columns
    are given."""
    return (
        select(*(columns or (t.item_revision.c.rev_id,)))
        .select_from(
            t.item_presence.join(
                t.item_revision, t.item_revision.c.rev_id == t.item_presence.c.rev_id
            )
        )
        .where(present(build))
    )


_INTEGER_COLUMN = range(-(2**31), 2**31)


def _storable(values: Sequence[int]) -> ColumnElement:
    """``values`` as one array parameter, without those no integer column can
    hold."""
    storable = [value for value in values if value in _INTEGER_COLUMN]
    return bindparam(None, storable, type_=ARRAY(Integer))


def any_of(column: ColumnElement, values: Sequence[int]) -> ColumnElement:
    """``column = ANY(values)`` for an integer column: one array parameter
    however many values. A value no integer column can hold matches nothing
    and is left out, so an absurd id in a request is simply not found."""
    return column == func.any(_storable(values))


def none_of(column: ColumnElement, values: Sequence[int]) -> ColumnElement:
    """``column <> ALL(values)``, the complement of ``any_of``."""
    return column != func.all(_storable(values))


def has_stat(*conditions: ColumnElement) -> ColumnElement:
    """The revision has a stat entry meeting ``conditions`` on ``stat_entry``.

    ``stat_entry`` holds the build's own values: a nano's strain is in
    ``nano_properties``, never here.
    """
    return exists().where(
        t.stat_entry.c.stats_id == t.item_revision.c.stats_id, *conditions
    )


def has_requirement(*conditions: ColumnElement) -> ColumnElement:
    """An action of the revision has a criterion meeting ``conditions`` on
    ``requirement``."""
    return exists().where(
        t.requirement.c.actions_id == t.item_revision.c.actions_id, *conditions
    )


def has_effect(*conditions: ColumnElement) -> ColumnElement:
    """The revision has an effect meeting ``conditions`` on ``effect_entry``."""
    return exists().where(
        t.effect_entry.c.effects_id == t.item_revision.c.effects_id, *conditions
    )


def has_atkdef(*conditions: ColumnElement) -> ColumnElement:
    """The revision's attack/defense block has an entry meeting ``conditions``
    on ``atkdef_entry``."""
    return exists().where(
        t.atkdef_entry.c.atkdef_id == t.item_revision.c.atkdef_id, *conditions
    )


def text_contains(
    texts: FromClause, field: str, pattern: str, escape: Optional[str] = None
) -> ColumnElement:
    """``field`` (``name`` or ``description``) of ``texts``, which is
    ``part_text`` or an alias of it, matches the LIKE ``pattern`` whatever the
    case.

    These are the rows of ``field ILIKE pattern``, found another way. ILIKE
    lowers the text and the pattern under the column's collation and matches
    the results, for every row it reads on every search; ``part_text`` keeps
    its texts lowered that way (``name_lower``, ``description_lower``), so
    only the pattern is lowered here, by the same function, and the match is
    a comparison of bytes. The trigram indexes are on the lowered columns:
    keep the condition as this function writes it, since a function around
    it, or two columns concatenated, leaves them unused.
    """
    return texts.c[f"{field}_lower"].like(func.lower(pattern), escape=escape)


def nano_policy(build: Build) -> ColumnElement:
    """ON clause joining ``nano_properties`` to the revision as ``build``
    serves it."""
    return and_(
        t.nano_properties.c.rev_id == t.item_revision.c.rev_id,
        t.nano_properties.c.overlay_strain_first == build.overlay_strain_first,
    )


@dataclass(frozen=True)
class Page:
    """One page of a list: its revision ids in order and the total matches."""

    rev_ids: List[int]
    total: int


# The largest OFFSET the database takes. No list has that many rows.
_LAST_OFFSET = 2**63 - 1


def page_offset(page: int, page_size: int) -> int:
    """How many rows come before ``page``. A page number too large to count
    that far is a page past the end, like any other the list does not have."""
    return min((page - 1) * page_size, _LAST_OFFSET)


def fetch_page(
    db: Session,
    query: Select,
    order_by: Sequence[ColumnElement],
    page: int,
    page_size: int,
) -> Page:
    """Count ``query`` and fetch one page of it.

    ``query`` is built on ``revisions(build)`` and selects ``rev_id``. The sort
    is ``order_by`` followed by the AOID.
    """
    total = db.execute(
        select(func.count()).select_from(query.order_by(None).subquery())
    ).scalar_one()
    rev_ids = db.execute(
        query.order_by(*order_by, t.item_revision.c.aoid)
        .offset(page_offset(page, page_size))
        .limit(page_size)
    ).scalars()
    return Page(rev_ids=list(rev_ids), total=total)


_SORT_MODIFIERS = {
    operators.asc_op: asc,
    operators.desc_op: desc,
    operators.nulls_first_op: nulls_first,
    operators.nulls_last_op: nulls_last,
}


def _sort_on(key: ColumnElement, column: ColumnElement) -> ColumnElement:
    """``column`` in the direction and null placement of sort key ``key``."""
    if isinstance(key, UnaryExpression) and key.modifier in _SORT_MODIFIERS:
        return _SORT_MODIFIERS[key.modifier](_sort_on(key.element, column))
    return column


def _sorted_value(key: ColumnElement) -> ColumnElement:
    """What sort key ``key`` sorts on, without direction or null placement."""
    while isinstance(key, UnaryExpression) and key.modifier in _SORT_MODIFIERS:
        key = key.element
    return key


def fetch_search_page(
    db: Session,
    query: Select,
    order_by: Sequence[ColumnElement],
    page: int,
    page_size: int,
) -> Page:
    """``fetch_page`` for a query that matches text, in one statement.

    Finding the matches is the whole cost of a text search, so they are found
    once and set aside (a materialized CTE), then counted and sorted for the
    page. ``fetch_page`` would match twice, and worse: planned together with
    ORDER BY and LIMIT, a text match the planner cannot estimate tempts it to
    walk the name index of ``part_text`` in the hope of an early end, which a
    rare word turns into reading every text. The total comes back with the
    page whether or not the page has rows.

    A term most texts contain matches most of a build (77,000 revisions of
    the live build for "nano"). With the default ``work_mem`` the joins that
    find them and the set aside matches spill to disk, so the transaction is
    given enough for both, as ``fetch_changes`` does.
    """
    values = [_sorted_value(key) for key in order_by]
    matches = (
        query.order_by(None)
        .add_columns(
            t.item_revision.c.aoid,
            *(value.label(f"sort_{n}") for n, value in enumerate(values)),
        )
        .cte("matches")
        .prefix_with("MATERIALIZED")
    )
    page_ids = (
        select(matches.c.rev_id)
        .order_by(
            *(_sort_on(key, matches.c[f"sort_{n}"]) for n, key in enumerate(order_by)),
            matches.c.aoid,
        )
        .offset(page_offset(page, page_size))
        .limit(page_size)
        .scalar_subquery()
    )
    total = select(func.count()).select_from(matches).scalar_subquery()
    db.execute(text("SET LOCAL work_mem = '64MB'"))
    row = db.execute(
        select(total.label("total"), func.array(page_ids).label("rev_ids"))
    ).one()
    return Page(rev_ids=list(row.rev_ids), total=row.total)


def page_fields(total: int, page: int, page_size: int) -> Dict[str, Any]:
    """The paging fields of a ``PaginatedResponse`` around ``items``."""
    pages = math.ceil(total / page_size) if total > 0 else 1
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "has_next": page < pages,
        "has_prev": page > 1,
    }
