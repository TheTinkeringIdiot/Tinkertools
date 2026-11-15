"""
Cross-version diffs.

    GET /changes                      what changed in the request's build
    GET /changes/transitions          its most shared field transitions
    GET /compare/{base}               net difference from build ``base``
    GET /items/{aoid}/timeline        every change of one item
    GET /items/{aoid}/compare/{base}  one item in ``base`` and in the build

The version segment of the URL names the newer side of every comparison (the
default version without one); ``base`` is a version slug or family alias. The
two sides of ``/compare`` may be any two builds: of one branch, across a fork,
in either order.

The change list reads the change log the importer wrote, with the relevance
and build notes it derived. A comparison is computed from presence, so an item
that changed and changed back between the two builds is not in it; it has the
same rows, filters and counts, and no build notes. See ``app/store/changes.py``.

Responses depend only on the builds named and are immutable until the next
import, hence the response cache.
"""

from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.schemas.changes import (
    BuildTransitionsResponse,
    ChangeKind,
    ChangeListResponse,
    ItemCompareResponse,
    ItemTimelineResponse,
    PartName,
    RelevanceName,
)
from app.api.services.item_search import common_item_filters
from app.core.change_rules import relevance_names
from app.core.decorators import cached_response, performance_monitor
from app.store import page_fields
from app.store.changes import (
    KIND_NAMES,
    BuildIndex,
    ChangeFilters,
    ChangePage,
    change_response,
    changed_pairs,
    compare_item,
    compared_changes,
    diff_revisions,
    fetch_changes,
    find_build,
    item_timeline,
    load_build_index,
    load_notes,
    load_snapshots,
    load_transitions,
    logged_changes,
    part_names,
)
from app.store.context import Build, get_build, get_store

router = APIRouter(tags=["changes"])

SortKey = Literal["name", "aoid", "ql"]


class ChangeQuery:
    """Query parameters of a change list."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(50, ge=1, le=200, description="Changes per page"),
        sort: SortKey = Query(
            "name", description="Sort by name, AOID or QL; ties by AOID"
        ),
        kind: List[ChangeKind] = Query(
            [], description="Only these kinds of change (repeat for several)"
        ),
        part: List[PartName] = Query(
            [], description="Only changes that touch one of these parts"
        ),
        relevance: List[RelevanceName] = Query(
            [], description="Only changes relevant to one of these"
        ),
        is_nano: Optional[bool] = Query(None, description="Only nanos, or only items"),
        item_class: Optional[int] = Query(None, description="Filter by item class"),
        min_ql: Optional[int] = Query(None, description="Minimum quality level"),
        max_ql: Optional[int] = Query(None, description="Maximum quality level"),
        profession: Optional[int] = Query(
            None,
            description="Only items and nanos whose Use requires this profession",
        ),
        slot: Optional[int] = Query(
            None,
            description="Only items worn in this slot (bit position of stat 298)",
        ),
        search: Optional[str] = Query(
            None, min_length=1, description="Text the old or the new name contains"
        ),
        notes: Literal["collapse", "expand"] = Query(
            "collapse",
            description="collapse: leave out changes a build note explains; "
            "expand: list them with the rest",
        ),
        note_id: Optional[int] = Query(
            None, description="List only the changes this build note explains"
        ),
        include_diff: bool = Query(
            False,
            description="Give each changed item of the page its field-level diff",
        ),
    ):
        self.page = page
        self.page_size = page_size
        self.sort = sort
        self.kind = kind
        self.part = part
        self.relevance = relevance
        self.is_nano = is_nano
        self.item_class = item_class
        self.min_ql = min_ql
        self.max_ql = max_ql
        self.profession = profession
        self.slot = slot
        self.search = search
        self.notes = notes
        self.note_id = note_id
        self.include_diff = include_diff

    def __repr__(self) -> str:
        """Every parameter: the response cache keys on it."""
        return repr(sorted(vars(self).items()))

    def filters(self, build: Build) -> ChangeFilters:
        return ChangeFilters(
            kinds=self.kind,
            parts=self.part,
            relevance=self.relevance,
            is_nano=self.is_nano,
            item_class=self.item_class,
            min_ql=self.min_ql,
            max_ql=self.max_ql,
            search=self.search,
            item_conditions=common_item_filters(
                build, profession=self.profession, slot=self.slot
            ),
            expand_notes=self.notes == "expand",
            note_id=self.note_id,
        )


def _other_build(db: Session, slug: str) -> Build:
    found = find_build(db, slug)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Unknown game version '{slug}'")
    return found


def _change_list(
    db: Session,
    query: ChangeQuery,
    found: ChangePage,
    build: Build,
    index: BuildIndex,
    base: Optional[Dict[str, Any]],
) -> ChangeListResponse:
    snapshots = load_snapshots(
        db,
        [
            rev_id
            for row in found.rows
            for rev_id in (row.old_rev_id, row.new_rev_id)
            if rev_id is not None
        ],
    )
    diffs = diff_revisions(db, changed_pairs(found.rows)) if query.include_diff else {}
    notes = [
        {
            **note,
            "count": found.notes[note["note_id"]][0],
            "matching": found.notes[note["note_id"]][1],
        }
        for note in load_notes(db, build)
        if note["note_id"] in found.notes
    ]
    notes.sort(key=lambda note: (-note["count"], note["note_id"]))
    return ChangeListResponse(
        items=[
            change_response(row, snapshots, diffs.get((row.old_rev_id, row.new_rev_id)))
            for row in found.rows
        ],
        build=index.at(build.branch, build.ordinal).ref(),
        base=base,
        summary=found.summary,
        notes=notes,
        **page_fields(found.total, query.page, query.page_size),
    )


@router.get("/changes", response_model=ChangeListResponse)
@cached_response("changes_list")
@performance_monitor
def get_build_changes(
    query: ChangeQuery = Depends(),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    What changed in the request's build, relative to the build before it (for
    a branch's first build, relative to its parent build).

    ``summary`` counts every change of the build whatever the filters.
    Changes that a build note explains are collapsed by default: they are
    counted in ``notes`` and left out of ``items`` and ``total``; ask for
    ``notes=expand`` to list everything or ``note_id`` to list one note's.
    """
    index = load_build_index(db)
    found = fetch_changes(
        db,
        logged_changes(build),
        query.filters(build),
        query.sort,
        query.page,
        query.page_size,
    )
    base = index.base_of(build.branch, build.ordinal)
    return _change_list(db, query, found, build, index, base.ref() if base else None)


@router.get("/changes/transitions", response_model=BuildTransitionsResponse)
@cached_response("changes_transitions")
def get_build_transitions(
    part: List[PartName] = Query([], description="Only transitions of these parts"),
    min_items: int = Query(2, ge=2, description="Shared by at least this many items"),
    limit: int = Query(50, ge=1, le=500, description="Number of transitions"),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    The field transitions most changed items of the request's build share,
    which read as patch notes: "effect 53089 Chance 60 -> 100 on 760 items".
    Only transitions that at least two items share are kept.
    """
    index = load_build_index(db)
    base = index.base_of(build.branch, build.ordinal)
    return BuildTransitionsResponse(
        build=index.at(build.branch, build.ordinal).ref(),
        base=base.ref() if base else None,
        transitions=load_transitions(db, build, part, min_items, limit),
    )


@router.get("/compare/{base}", response_model=ChangeListResponse)
@cached_response("changes_compare")
@performance_monitor
def compare_builds(
    base: str,
    query: ChangeQuery = Depends(),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    The net difference between build ``base`` and the request's build: every
    item whose content in one is not its content in the other. Same rows,
    filters and summary as ``/changes``; no build notes.
    """
    other = _other_build(db, base)
    index = load_build_index(db)
    found = fetch_changes(
        db,
        compared_changes(other, build),
        query.filters(build),
        query.sort,
        query.page,
        query.page_size,
    )
    return _change_list(
        db, query, found, build, index, index.at(other.branch, other.ordinal).ref()
    )


@router.get("/items/{aoid}/timeline", response_model=ItemTimelineResponse)
@cached_response("item_timeline")
def get_item_timeline(
    aoid: int,
    include_diff: bool = Query(
        True, description="Give each 'changed' entry its field-level diff"
    ),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Every build in which the item was added, changed or removed, newest
    first, along the lineage of the request's version: all builds of its
    family, and for a fork (PRK) the builds of the parent family up to the
    fork. An item no build of the lineage has gets an empty list.
    """
    index = load_build_index(db)
    timeline = item_timeline(db, index, build.branch, aoid)
    rows = [row for row, _, _ in timeline]
    snapshots = load_snapshots(
        db,
        [
            rev_id
            for row in rows
            for rev_id in (row.old_rev_id, row.new_rev_id)
            if rev_id is not None
        ],
    )
    diffs = diff_revisions(db, changed_pairs(rows)) if include_diff else {}
    entries = []
    for row, at, note in timeline:
        shown = snapshots[
            row.new_rev_id if row.new_rev_id is not None else row.old_rev_id
        ]
        base = index.base_of(at.branch, at.ordinal)
        entries.append(
            {
                "build": at.ref(),
                "base": base.ref() if base else None,
                "kind": KIND_NAMES[row.kind],
                "name": shown.name,
                "ql": shown.ql,
                "parts": part_names(row.parts_changed),
                "relevance": relevance_names(row.relevance),
                "note": note,
                "diff": diffs.get((row.old_rev_id, row.new_rev_id)),
            }
        )
    return ItemTimelineResponse(aoid=aoid, family=build.branch, entries=entries)


@router.get("/items/{aoid}/compare/{base}", response_model=ItemCompareResponse)
@cached_response("item_compare")
def compare_item_builds(
    aoid: int,
    base: str,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    One item in build ``base`` and in the request's build, with the
    field-level diff when both have it. 404 when neither does.
    """
    other = _other_build(db, base)
    row = compare_item(db, other, build, aoid)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Item {aoid} is in neither '{other.slug}' nor '{build.slug}'",
        )
    index = load_build_index(db)
    snapshots = load_snapshots(
        db, [r for r in (row.old_rev_id, row.new_rev_id) if r is not None]
    )
    old = snapshots.get(row.old_rev_id)
    new = snapshots.get(row.new_rev_id)
    diff = None
    if old is not None and new is not None:
        pair = (row.old_rev_id, row.new_rev_id)
        diff = diff_revisions(db, [pair])[pair]
    return ItemCompareResponse(
        aoid=aoid,
        build=index.at(build.branch, build.ordinal).ref(),
        base=index.at(other.branch, other.ordinal).ref(),
        kind={**KIND_NAMES, "U": "unchanged"}[row.kind],
        old=old.response() if old else None,
        new=new.response() if new else None,
        parts=part_names(row.parts_changed),
        relevance=relevance_names(row.relevance),
        diff=diff,
    )
