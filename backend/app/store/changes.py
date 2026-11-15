"""
Changes between builds: the change log, comparisons, field-level diffs.

Two sources of "what differs between two builds" share one row shape and one
set of filters:

``logged_changes(build)``
    the change log of a build (``item_change``): what the import of the build
    found against the build before it, with the relevance and the build note
    the importer derived.

``compared_changes(base, build)``
    the net difference between any two builds, from presence: the revision of
    every item in ``base`` against its revision in ``build``. Nothing is
    replayed, so an item that changed and changed back is not in it. Parts
    and relevance are computed in the query from the part ids and the
    per-revision digests of ``revision_relevance``
    (database/cas/003_change_analysis.sql), by the rule the importer uses for
    the log.

``fetch_changes`` filters, counts and pages either source in one statement:
the source is the expensive part of a comparison and is evaluated once.
``item_timeline`` and ``compare_item`` answer for one item. Field-level diffs
come from ``app.core.item_diff`` through ``diff_revisions``; they are computed
for the rows of a page, never for a whole list.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import (
    Integer,
    Select,
    String,
    and_,
    case,
    cast,
    exists,
    func,
    literal,
    null,
    or_,
    select,
    true,
)
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import ColumnElement, FromClause

from app.core import item_diff
from app.core.change_rules import (
    CLASSES,
    RELEVANCE_BITS,
    TEXT,
    RelevanceRules,
    default_rules,
    relevance_mask,
    relevance_names,
)
from app.store import tables as t
from app.store.context import Build, read_builds, resolve_build
from app.store.items import criteria_response, load_effect_formats, spell_params
from app.store.presence import any_of, page_offset, present

STAT_ICON = 79

PART_BITS = {
    "text": 1,
    "stats": 2,
    "effects": 4,
    "actions": 8,
    "atkdef": 16,
    "misc": 32,
}
_PART_COLUMNS = {
    "text": "text_id",
    "stats": "stats_id",
    "effects": "effects_id",
    "actions": "actions_id",
    "atkdef": "atkdef_id",
    "misc": "misc_id",
}
KIND_NAMES = {"A": "added", "R": "removed", "C": "changed"}
KIND_CODES = {name: code for code, name in KIND_NAMES.items()}

SORT_KEYS = ("name", "aoid", "ql")


def part_names(mask: int) -> List[str]:
    return [name for name, bit in PART_BITS.items() if mask & bit]


# ---------------------------------------------------------------------------
# Builds
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BuildRow:
    """A build as the diff responses name it (``BuildRef``)."""

    build_id: int
    slug: str
    branch: str
    ordinal: int
    display_name: str
    client_build: Optional[str]
    released_on: Any
    parent_build_id: Optional[int]

    def ref(self) -> Dict[str, Any]:
        return {
            "slug": self.slug,
            "display_name": self.display_name,
            "family": self.branch,
            "client_build": self.client_build,
            "snapshot_date": self.released_on,
        }


class BuildIndex:
    """Every build of the store and what each one's change log is relative to."""

    def __init__(self, rows: Sequence[BuildRow]):
        self._by_id = {row.build_id: row for row in rows}
        self._by_position = {(row.branch, row.ordinal): row for row in rows}
        self._branches: Dict[str, List[BuildRow]] = {}
        for row in sorted(rows, key=lambda r: r.ordinal):
            self._branches.setdefault(row.branch, []).append(row)

    def at(self, branch: str, ordinal: int) -> BuildRow:
        return self._by_position[(branch, ordinal)]

    def base_of(self, branch: str, ordinal: int) -> Optional[BuildRow]:
        """The build the change log of a build is relative to: the one before
        it in its branch, or the parent build of a branch's first build."""
        members = self._branches[branch]
        before = [row for row in members if row.ordinal < ordinal]
        if before:
            return before[-1]
        parent = members[0].parent_build_id
        return self._by_id.get(parent) if parent is not None else None

    def lineage(self, branch: str) -> List[Tuple[str, Optional[int]]]:
        """``[(branch, last ordinal or None for all)]``: the branch, then the
        branch it forked from up to the fork, and so on."""
        segments: List[Tuple[str, Optional[int]]] = [(branch, None)]
        seen = {branch}
        parent = self._by_id.get(self._branches[branch][0].parent_build_id)
        while parent is not None and parent.branch not in seen:
            seen.add(parent.branch)
            segments.append((parent.branch, parent.ordinal))
            parent = self._by_id.get(self._branches[parent.branch][0].parent_build_id)
        return segments


def load_build_index(db: Session) -> BuildIndex:
    rows = db.execute(
        select(
            t.build.c.build_id,
            t.build.c.slug,
            t.build.c.branch,
            t.build.c.ordinal,
            t.build.c.display_name,
            t.build.c.client_build,
            t.build.c.released_on,
            t.build.c.parent_build_id,
        )
    )
    return BuildIndex([BuildRow(**row._mapping) for row in rows])


def find_build(db: Session, slug: str) -> Optional[Build]:
    """The enabled build a slug or family alias names, read from the store
    the session reads."""
    return resolve_build(read_builds(db), slug)


# ---------------------------------------------------------------------------
# Sources of changes
# ---------------------------------------------------------------------------


def logged_changes(build: Build) -> Select:
    """The change log of ``build``."""
    c = t.item_change
    return select(
        c.c.aoid,
        c.c.kind,
        c.c.old_rev_id,
        c.c.new_rev_id,
        c.c.parts_changed,
        c.c.relevance,
        c.c.note_id,
    ).where(c.c.branch == build.branch, c.c.ordinal == build.ordinal)


def _parts_changed(old: FromClause, new: FromClause) -> ColumnElement:
    """Bitmask of the parts in which two revisions differ."""
    return sum(
        (
            case((old.c[column].is_distinct_from(new.c[column]), bit), else_=0)
            for column, bit in (
                (_PART_COLUMNS[name], PART_BITS[name]) for name in PART_BITS
            )
        ),
        literal(0),
    )


def _relevance(
    rules: RelevanceRules,
    old: FromClause,
    new: FromClause,
    old_digests: FromClause,
    new_digests: FromClause,
) -> ColumnElement:
    """Relevance of the change between two revisions of an item that has
    both, by the rule of ``app.core.change_analysis.relevance_sql``."""
    bits = [
        case(
            (old_digests.c[name] != new_digests.c[name], RELEVANCE_BITS[name]),
            else_=0,
        )
        for name in CLASSES
    ]
    bits.append(case((old.c.text_id != new.c.text_id, TEXT), else_=0))
    bits.append(
        case(
            (
                and_(
                    old.c.effects_id.is_distinct_from(new.c.effects_id),
                    old_digests.c.effects == new_digests.c.effects,
                ),
                rules.bit("event"),
            ),
            else_=0,
        )
    )
    combined = bits[0]
    for bit in bits[1:]:
        combined = combined.op("|")(bit)
    return combined


def compared_changes(
    base: Build, build: Build, rules: Optional[RelevanceRules] = None
) -> Select:
    """The items whose revision in ``build`` is not their revision in
    ``base``, shaped as ``logged_changes``. No build notes: a note belongs to
    one step of the log."""
    rules = rules or default_rules().relevance
    before, after = t.item_presence.alias("before"), t.item_presence.alias("after")
    old = (
        select(before.c.aoid, before.c.rev_id).where(present(base, before))
    ).subquery("old_presence")
    new = (select(after.c.aoid, after.c.rev_id).where(present(build, after))).subquery(
        "new_presence"
    )
    old_revision = t.item_revision.alias("old_revision")
    new_revision = t.item_revision.alias("new_revision")
    old_digests = t.revision_relevance.alias("old_digests")
    new_digests = t.revision_relevance.alias("new_digests")
    kind = case((old.c.rev_id.is_(None), "A"), (new.c.rev_id.is_(None), "R"), else_="C")
    return (
        select(
            func.coalesce(new.c.aoid, old.c.aoid).label("aoid"),
            kind.label("kind"),
            old.c.rev_id.label("old_rev_id"),
            new.c.rev_id.label("new_rev_id"),
            case(
                (kind == "C", _parts_changed(old_revision, new_revision)), else_=0
            ).label("parts_changed"),
            case(
                (old.c.rev_id.is_(None), rules.bit("added")),
                (new.c.rev_id.is_(None), rules.bit("removed")),
                else_=_relevance(
                    rules, old_revision, new_revision, old_digests, new_digests
                ),
            ).label("relevance"),
            cast(null(), Integer).label("note_id"),
        )
        .select_from(
            old.join(new, old.c.aoid == new.c.aoid, full=True)
            .outerjoin(old_revision, old_revision.c.rev_id == old.c.rev_id)
            .outerjoin(new_revision, new_revision.c.rev_id == new.c.rev_id)
            .outerjoin(old_digests, old_digests.c.rev_id == old.c.rev_id)
            .outerjoin(new_digests, new_digests.c.rev_id == new.c.rev_id)
        )
        .where(old.c.rev_id.is_distinct_from(new.c.rev_id))
    )


# ---------------------------------------------------------------------------
# Filtering and paging
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ChangeFilters:
    """Filters of a change list. Empty sequences and None do not filter."""

    kinds: Sequence[str] = ()
    parts: Sequence[str] = ()
    relevance: Sequence[str] = ()
    is_nano: Optional[bool] = None
    item_class: Optional[int] = None
    min_ql: Optional[int] = None
    max_ql: Optional[int] = None
    search: Optional[str] = None
    # conditions on t.item_revision, the revision a row is listed by
    item_conditions: Sequence[ColumnElement] = ()
    expand_notes: bool = False
    note_id: Optional[int] = None


@dataclass(frozen=True)
class ChangeRow:
    aoid: int
    kind: str
    old_rev_id: Optional[int]
    new_rev_id: Optional[int]
    parts_changed: int
    relevance: int
    note_id: Optional[int]


@dataclass(frozen=True)
class ChangePage:
    rows: List[ChangeRow]
    total: int
    summary: Dict[str, Any]
    # {note_id: (changes of the build, of which match the filters)}
    notes: Dict[int, Tuple[int, int]]


def _contains(column: ColumnElement, text: str) -> ColumnElement:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return column.ilike(f"%{escaped}%", escape="\\")


def _summary(changes: FromClause) -> ColumnElement:
    def count(condition: ColumnElement) -> ColumnElement:
        return func.count().filter(condition)

    return (
        select(
            func.jsonb_build_object(
                "total",
                func.count(),
                "by_kind",
                func.jsonb_build_object(
                    *(
                        value
                        for code, name in KIND_NAMES.items()
                        for value in (name, count(changes.c.kind == code))
                    )
                ),
                "by_part",
                func.jsonb_build_object(
                    *(
                        value
                        for name, bit in PART_BITS.items()
                        for value in (
                            name,
                            count(changes.c.parts_changed.op("&")(bit) != 0),
                        )
                    )
                ),
                "by_relevance",
                func.jsonb_build_object(
                    *(
                        value
                        for name, bit in RELEVANCE_BITS.items()
                        for value in (
                            name,
                            count(changes.c.relevance.op("&")(bit) != 0),
                        )
                    )
                ),
                "noted",
                count(changes.c.note_id.isnot(None)),
            )
        )
        .select_from(changes)
        .scalar_subquery()
    )


def _ordered_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    """The summary with its counts in the order the names are declared in
    (jsonb keeps keys in an order of its own)."""
    return {
        "total": summary["total"],
        "by_kind": {name: summary["by_kind"][name] for name in KIND_CODES},
        "by_part": {name: summary["by_part"][name] for name in PART_BITS},
        "by_relevance": {
            name: summary["by_relevance"][name] for name in RELEVANCE_BITS
        },
        "noted": summary["noted"],
    }


def _note_counts(rows: FromClause) -> ColumnElement:
    counted = (
        select(rows.c.note_id, func.count().label("n"))
        .where(rows.c.note_id.isnot(None))
        .group_by(rows.c.note_id)
        .subquery()
    )
    return (
        select(func.jsonb_object_agg(cast(counted.c.note_id, String), counted.c.n))
        .select_from(counted)
        .scalar_subquery()
    )


def fetch_changes(
    db: Session,
    source: Select,
    filters: ChangeFilters,
    sort: str,
    page: int,
    page_size: int,
) -> ChangePage:
    """Filter ``source`` (``logged_changes`` or ``compared_changes``), count
    it and fetch one page, in one statement.

    A row is listed, filtered and sorted by its newer revision (the older for
    a removed item); a name search also matches the older name. The summary
    counts every change of the source whatever the filters. Changes explained
    by a build note are left out of the page and of ``total`` unless
    ``filters.expand_notes`` or ``filters.note_id`` says otherwise.
    """
    changes = source.cte("changes").prefix_with("MATERIALIZED")
    revision, text = t.item_revision, t.part_text
    conditions: List[ColumnElement] = list(filters.item_conditions)
    if filters.kinds:
        conditions.append(
            changes.c.kind.in_([KIND_CODES[name] for name in filters.kinds])
        )
    if filters.parts:
        mask = sum(PART_BITS[name] for name in set(filters.parts))
        conditions.append(changes.c.parts_changed.op("&")(mask) != 0)
    if filters.relevance:
        mask = relevance_mask(sorted(set(filters.relevance)))
        conditions.append(changes.c.relevance.op("&")(mask) != 0)
    if filters.is_nano is not None:
        conditions.append(revision.c.is_nano == filters.is_nano)
    if filters.item_class is not None:
        conditions.append(revision.c.item_class == filters.item_class)
    if filters.min_ql is not None:
        conditions.append(revision.c.ql >= filters.min_ql)
    if filters.max_ql is not None:
        conditions.append(revision.c.ql <= filters.max_ql)
    if filters.search:
        old_revision = t.item_revision.alias("searched_revision")
        old_text = t.part_text.alias("searched_text")
        conditions.append(
            or_(
                _contains(text.c.name, filters.search),
                exists().where(
                    old_revision.c.rev_id == changes.c.old_rev_id,
                    changes.c.new_rev_id.isnot(None),
                    old_text.c.text_id == old_revision.c.text_id,
                    _contains(old_text.c.name, filters.search),
                ),
            )
        )

    matched = (
        select(
            changes.c.aoid,
            changes.c.kind,
            changes.c.old_rev_id,
            changes.c.new_rev_id,
            changes.c.parts_changed,
            changes.c.relevance,
            changes.c.note_id,
            revision.c.ql,
            text.c.name,
        )
        .select_from(
            changes.join(
                revision,
                revision.c.rev_id
                == func.coalesce(changes.c.new_rev_id, changes.c.old_rev_id),
            ).join(text, text.c.text_id == revision.c.text_id)
        )
        .where(*conditions)
        .cte("matched")
        .prefix_with("MATERIALIZED")
    )
    if filters.note_id is not None:
        listed = matched.c.note_id == filters.note_id
    elif filters.expand_notes:
        listed = literal(True)
    else:
        listed = matched.c.note_id.is_(None)

    order = {"name": [matched.c.name], "ql": [matched.c.ql], "aoid": []}[sort]
    page_rows = (
        select(
            func.jsonb_build_array(
                matched.c.aoid,
                matched.c.kind,
                matched.c.old_rev_id,
                matched.c.new_rev_id,
                matched.c.parts_changed,
                matched.c.relevance,
                matched.c.note_id,
            )
        )
        .where(listed)
        .order_by(*order, matched.c.aoid)
        .offset(page_offset(page, page_size))
        .limit(page_size)
        .scalar_subquery()
    )
    row = db.execute(
        select(
            _summary(changes).label("summary"),
            _note_counts(changes).label("notes"),
            _note_counts(matched).label("matching"),
            select(func.count())
            .select_from(matched)
            .where(listed)
            .scalar_subquery()
            .label("total"),
            func.array(page_rows).label("rows"),
        )
    ).one()
    matching = row.matching or {}
    return ChangePage(
        rows=[ChangeRow(*values) for values in row.rows],
        total=row.total,
        summary=_ordered_summary(row.summary),
        notes={
            int(note_id): (count, matching.get(note_id, 0))
            for note_id, count in (row.notes or {}).items()
        },
    )


# ---------------------------------------------------------------------------
# What a row shows
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Snapshot:
    """A revision in brief: what a list line shows."""

    rev_id: int
    name: str
    ql: int
    item_class: int
    is_nano: bool
    icon: Optional[int]

    def response(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "ql": self.ql,
            "item_class": self.item_class,
            "is_nano": self.is_nano,
            "icon": self.icon,
        }


def load_snapshots(db: Session, rev_ids: Sequence[int]) -> Dict[int, Snapshot]:
    """``{rev_id: Snapshot}`` of these revisions, in one query."""
    if not rev_ids:
        return {}
    revision = t.item_revision
    icon = (
        select(func.min(t.stat_entry.c.value))
        .where(
            t.stat_entry.c.stats_id == revision.c.stats_id,
            t.stat_entry.c.stat == STAT_ICON,
        )
        .scalar_subquery()
    )
    rows = db.execute(
        select(
            revision.c.rev_id,
            t.part_text.c.name,
            revision.c.ql,
            revision.c.item_class,
            revision.c.is_nano,
            icon.label("icon"),
        )
        .select_from(
            revision.join(t.part_text, t.part_text.c.text_id == revision.c.text_id)
        )
        .where(any_of(revision.c.rev_id, rev_ids))
    )
    return {row.rev_id: Snapshot(**row._mapping) for row in rows}


def change_response(
    row: ChangeRow, snapshots: Dict[int, Snapshot], diff: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """One change as an ``ItemChange`` document."""
    old = snapshots.get(row.old_rev_id) if row.old_rev_id is not None else None
    new = snapshots.get(row.new_rev_id) if row.new_rev_id is not None else None
    shown = new or old
    both = old is not None and new is not None
    return {
        "aoid": row.aoid,
        "kind": KIND_NAMES[row.kind],
        "name": shown.name,
        "old_name": old.name if both and old.name != new.name else None,
        "ql": shown.ql,
        "old_ql": old.ql if both and old.ql != new.ql else None,
        "item_class": shown.item_class,
        "is_nano": shown.is_nano,
        "icon": shown.icon,
        "parts": part_names(row.parts_changed),
        "relevance": relevance_names(row.relevance),
        "note_id": row.note_id,
        "diff": diff,
    }


def load_notes(db: Session, build: Build) -> List[Dict[str, Any]]:
    """The notes of a build as ``{note_id, title, body}``."""
    rows = db.execute(
        select(t.build_note.c.note_id, t.build_note.c.title, t.build_note.c.body)
        .where(t.build_note.c.build_id == build.build_id)
        .order_by(t.build_note.c.note_id)
    )
    return [dict(row._mapping) for row in rows]


# ---------------------------------------------------------------------------
# Field-level diffs
# ---------------------------------------------------------------------------


def _part_doc(part: Any, key: str) -> ColumnElement:
    return (
        select(part.c.doc)
        .where(part.c[key] == t.item_revision.c[key])
        .scalar_subquery()
    )


def load_part_documents(
    db: Session, rev_ids: Sequence[int]
) -> Dict[int, Dict[str, Any]]:
    """``{rev_id: {part name: document}}`` of these revisions, in one query."""
    if not rev_ids:
        return {}
    revision = t.item_revision
    rows = db.execute(
        select(
            revision.c.rev_id,
            t.part_text.c.name,
            t.part_text.c.description,
            _part_doc(t.part_stats, "stats_id").label("stats"),
            _part_doc(t.part_effects, "effects_id").label("effects"),
            _part_doc(t.part_actions, "actions_id").label("actions"),
            _part_doc(t.part_atkdef, "atkdef_id").label("atkdef"),
            _part_doc(t.part_misc, "misc_id").label("misc"),
        )
        .select_from(
            revision.join(t.part_text, t.part_text.c.text_id == revision.c.text_id)
        )
        .where(any_of(revision.c.rev_id, rev_ids))
    )
    return {
        row.rev_id: {
            "text": {"name": row.name, "description": row.description},
            "stats": row.stats,
            "effects": row.effects,
            "actions": row.actions,
            "atkdef": row.atkdef,
            "misc": row.misc,
        }
        for row in rows
    }


def _criterion_response(criterion: Optional[Sequence[int]]) -> Optional[Dict[str, int]]:
    return None if criterion is None else criteria_response([criterion])[0]


def _criteria_changes(changes: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "op": change["op"],
            "old": _criterion_response(change["old"]),
            "new": _criterion_response(change["new"]),
        }
        for change in changes
    ]


def _effect_response(effect: Dict[str, Any], formats: Dict[int, str]):
    return {
        "spell_id": effect["spell_id"],
        "target": effect["target"],
        "tick_count": effect["tick_count"],
        "tick_interval": effect["tick_interval"],
        "spell_format": formats.get(effect["spell_id"]),
        "spell_params": spell_params(effect),
        "criteria": criteria_response(effect["criteria"]),
    }


def diff_response(diff: Dict[str, Any], formats: Dict[int, str]) -> Dict[str, Any]:
    """A diff of ``item_diff.diff_parts`` as an ``ItemDiff`` document: effects
    and criteria shaped as the item responses shape them."""
    return {
        **diff,
        "actions": [
            {**change, "criteria": _criteria_changes(change["criteria"])}
            for change in diff["actions"]
        ],
        "effects": [
            {
                **event,
                "added": [_effect_response(e, formats) for e in event["added"]],
                "removed": [_effect_response(e, formats) for e in event["removed"]],
                "changed": [
                    {
                        "old": _effect_response(pair["old"], formats),
                        "new": _effect_response(pair["new"], formats),
                        "fields": pair["fields"],
                        "criteria": (
                            None
                            if pair["criteria"] is None
                            else _criteria_changes(pair["criteria"])
                        ),
                    }
                    for pair in event["changed"]
                ],
            }
            for event in diff["effects"]
        ],
    }


def diff_revisions(
    db: Session, pairs: Sequence[Tuple[int, int]]
) -> Dict[Tuple[int, int], Dict[str, Any]]:
    """``{(old rev_id, new rev_id): ItemDiff document}`` for these pairs of
    revisions, in two queries whatever their number."""
    if not pairs:
        return {}
    documents = load_part_documents(db, sorted({rev for pair in pairs for rev in pair}))
    formats = load_effect_formats(db)
    return {
        (old, new): diff_response(
            item_diff.diff_parts(documents[old], documents[new]), formats
        )
        for old, new in dict.fromkeys(pairs)
    }


def changed_pairs(rows: Sequence[ChangeRow]) -> List[Tuple[int, int]]:
    return [(row.old_rev_id, row.new_rev_id) for row in rows if row.kind == "C"]


# ---------------------------------------------------------------------------
# One item
# ---------------------------------------------------------------------------


def item_timeline(
    db: Session, index: BuildIndex, branch: str, aoid: int
) -> List[Tuple[ChangeRow, BuildRow, Optional[Dict[str, Any]]]]:
    """``(change, build, note)`` of every change of an item along the lineage
    of ``branch``, newest first."""
    c = t.item_change
    segments = index.lineage(branch)
    rows = db.execute(
        select(
            c.c.branch,
            c.c.ordinal,
            c.c.aoid,
            c.c.kind,
            c.c.old_rev_id,
            c.c.new_rev_id,
            c.c.parts_changed,
            c.c.relevance,
            c.c.note_id,
            t.build_note.c.title,
            t.build_note.c.body,
        )
        .select_from(c.outerjoin(t.build_note, t.build_note.c.note_id == c.c.note_id))
        .where(
            any_of(c.c.aoid, [aoid]),
            or_(
                *(
                    and_(
                        c.c.branch == name,
                        c.c.ordinal <= last if last is not None else true(),
                    )
                    for name, last in segments
                )
            ),
        )
    ).all()
    position = {name: index_ for index_, (name, _) in enumerate(segments)}
    rows.sort(key=lambda row: (position[row.branch], -row.ordinal))
    return [
        (
            ChangeRow(
                row.aoid,
                row.kind,
                row.old_rev_id,
                row.new_rev_id,
                row.parts_changed,
                row.relevance,
                row.note_id,
            ),
            index.at(row.branch, row.ordinal),
            (
                {"note_id": row.note_id, "title": row.title, "body": row.body}
                if row.note_id is not None
                else None
            ),
        )
        for row in rows
    ]


def compare_item(
    db: Session,
    base: Build,
    build: Build,
    aoid: int,
    rules: Optional[RelevanceRules] = None,
) -> Optional[ChangeRow]:
    """The item in ``base`` against the item in ``build``. ``kind`` is ``U``
    when both hold the same revision; None when neither has the item."""
    rules = rules or default_rules().relevance
    presence = t.item_presence
    revs = [
        db.execute(
            select(presence.c.rev_id).where(
                present(side), any_of(presence.c.aoid, [aoid])
            )
        ).scalar_one_or_none()
        for side in (base, build)
    ]
    old_rev, new_rev = revs
    if old_rev is None and new_rev is None:
        return None
    if old_rev is None:
        return ChangeRow(aoid, "A", None, new_rev, 0, rules.bit("added"), None)
    if new_rev is None:
        return ChangeRow(aoid, "R", old_rev, None, 0, rules.bit("removed"), None)
    if old_rev == new_rev:
        return ChangeRow(aoid, "U", old_rev, new_rev, 0, 0, None)
    old, new = t.item_revision.alias("old"), t.item_revision.alias("new")
    old_digests = t.revision_relevance.alias("old_digests")
    new_digests = t.revision_relevance.alias("new_digests")
    row = db.execute(
        select(
            _parts_changed(old, new).label("parts_changed"),
            _relevance(rules, old, new, old_digests, new_digests).label("relevance"),
        )
        .select_from(
            old.join(new, new.c.rev_id == new_rev)
            .join(old_digests, old_digests.c.rev_id == old.c.rev_id)
            .join(new_digests, new_digests.c.rev_id == new.c.rev_id)
        )
        .where(old.c.rev_id == old_rev)
    ).one()
    return ChangeRow(
        aoid, "C", old_rev, new_rev, row.parts_changed, row.relevance, None
    )


# ---------------------------------------------------------------------------
# Shared transitions
# ---------------------------------------------------------------------------


def _path_fields(path: str) -> Dict[str, Any]:
    """The ids a transition path carries, for a client that will not parse it."""
    head, _, rest = path.partition(":")
    fields: Dict[str, Any] = {}
    if head in ("stat", "attack", "defense"):
        number, _, bit = rest.partition(":bit:")
        fields["stat"] = int(number)
        if bit:
            fields["bit"] = int(bit)
    elif head == "effect":
        number, _, field = rest.partition(":")
        fields["spell_id"] = int(number)
        if field:
            fields["field"] = field
    elif head == "action":
        fields["action"] = int(rest.partition(":")[0])
    return fields


def load_transitions(
    db: Session,
    build: Build,
    parts: Sequence[str],
    min_items: int,
    limit: int,
) -> List[Dict[str, Any]]:
    """The most shared field transitions of a build's change log, as
    ``SharedTransition`` documents."""
    bt = t.build_transition
    query = select(
        bt.c.part, bt.c.path, bt.c.old, bt.c.new, bt.c["items"], bt.c.occurrences
    ).where(
        bt.c.branch == build.branch,
        bt.c.ordinal == build.ordinal,
        bt.c["items"] >= min_items,
    )
    if parts:
        query = query.where(bt.c.part.in_(sorted(set(parts))))
    rows = db.execute(
        query.order_by(
            bt.c["items"].desc(),
            bt.c.occurrences.desc(),
            bt.c.part,
            bt.c.path,
            cast(bt.c.old, String),
            cast(bt.c.new, String),
        ).limit(limit)
    )
    return [{**row._mapping, **_path_fields(row.path)} for row in rows]
