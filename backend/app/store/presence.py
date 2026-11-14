"""
"The revisions present in this build": the base of every list and search.

``revisions(build)`` selects from ``item_presence`` joined to
``item_revision``, restricted to the build. It yields exactly one row per item
of the build, so nothing built on it needs DISTINCT. Filters are added with
``.where()``:

* scalar columns of ``item_revision`` (``ql``, ``item_class``, ``is_nano``,
  ``aoid``) directly;
* name and description by joining ``part_text`` on ``text_id``;
* stats, requirements, effects and attack/defense skills with the EXISTS
  helpers below, which test the revision's part in a search projection;
* nano school, professions, level and strain by joining ``nano_properties``
  with ``nano_policy(build)``.

``fetch_page`` counts the matches and returns one page of revision ids in the
requested order, always ending the sort on the AOID so pages are stable.
``app.store.items`` turns the ids into response items.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence

from sqlalchemy import ColumnElement, Integer, Select, and_, exists, func, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Session
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


def any_of(column: ColumnElement, values: Sequence[int]) -> ColumnElement:
    """``column = ANY(values)`` for an integer column: one array parameter
    however many values. A value no integer column can hold matches nothing
    and is left out, so an absurd id in a request is simply not found."""
    storable = [value for value in values if value in _INTEGER_COLUMN]
    return column == func.any(bindparam(None, storable, type_=ARRAY(Integer)))


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
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars()
    return Page(rev_ids=list(rev_ids), total=total)


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
