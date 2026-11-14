"""
Cross-version item change history ("changed in" dropdown).

The store keeps, per branch, the runs of consecutive builds in which an item
has one content (``item_presence``). Walking the builds along their lineage
and comparing each build's content of the item with the nearest earlier build
that has the item yields the builds at which its definition changed.

The lineage of a build is the builds of its branch before it, in ordinal
order, continued at the branch's parent build (PRK forks from AO 17.10.5).

Both endpoints answer for every enabled build at once: the version segment in
the URL does not change the builds considered, only which one counts as
"current" for ``first_seen_in``, ``latest_change_slug`` and
``present_in_current``.

What counts as a change is what the four labels of ``changed`` cover:

* ``stats``    the stats part, the attack/defense part and the animation mesh
* ``spells``   the effects part
* ``actions``  the actions part
* ``text``     the text part

A build in which only something else differs (the shop data or the static
instance id of the misc part) is not a change point.
"""

from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas.versions import (
    ItemRevisionBatchEntry,
    ItemRevisionPoint,
    ItemRevisionsBatchRequest,
    ItemRevisionsBatchResponse,
    ItemRevisionsResponse,
)
from app.store import tables as t
from app.store.context import Build, get_build, get_store
from app.store.presence import any_of

router = APIRouter(prefix="/items", tags=["item-revisions"])

# Labels reported in ``changed``, in report order.
CHANGE_LABELS = ("stats", "spells", "actions", "text")

# What an item is in one build, as far as ``changed`` tells apart: one value
# per label of CHANGE_LABELS.
Content = Tuple[Any, Any, Any, Any]


@dataclass(frozen=True)
class HistoryBuild:
    """A build as the history reports it."""

    build_id: int
    slug: str
    branch: str
    ordinal: int
    sort_order: int
    display_name: str
    client_build: Optional[str]
    released_on: Optional[date]
    parent_build_id: Optional[int]


@dataclass(frozen=True)
class Run:
    """One row of ``item_presence``: a content and the builds that carry it."""

    from_ordinal: int
    to_ordinal: int
    content: Content


# {branch: runs in ordinal order} of one item.
Runs = Dict[str, List[Run]]


class Lineage:
    """The enabled builds of the store and how they follow each other."""

    def __init__(self, builds: Iterable[HistoryBuild]):
        self.display_order = sorted(builds, key=lambda b: (b.sort_order, b.slug))
        self.by_slug = {build.slug: build for build in self.display_order}
        by_id = {build.build_id: build for build in self.display_order}

        self.predecessor: Dict[str, Optional[HistoryBuild]] = {}
        branches: Dict[str, List[HistoryBuild]] = {}
        for build in self.display_order:
            branches.setdefault(build.branch, []).append(build)
        for members in branches.values():
            members.sort(key=lambda b: b.ordinal)
            first = members[0]
            self.predecessor[first.slug] = (
                by_id.get(first.parent_build_id)
                if first.parent_build_id is not None
                else None
            )
            for earlier, later in zip(members, members[1:]):
                self.predecessor[later.slug] = earlier

        # Every build after the builds it descends from. A parent link that
        # loops back is cut where it closes, so a malformed registry cannot
        # hang a request.
        self.oldest_first: List[HistoryBuild] = []
        self._ancestry: Dict[str, List[str]] = {}
        placed = set()
        for build in self.display_order:
            pending = []
            cursor: Optional[HistoryBuild] = build
            while cursor is not None and cursor.slug not in placed:
                placed.add(cursor.slug)
                pending.append(cursor)
                cursor = self.predecessor[cursor.slug]
            for member in reversed(pending):
                before = self.predecessor[member.slug]
                inherited = self._ancestry.get(before.slug, []) if before else []
                self._ancestry[member.slug] = [member.slug, *inherited]
                self.oldest_first.append(member)

    def ancestry(self, slug: Optional[str]) -> List[str]:
        """Slugs from ``slug`` back to the root of its lineage, nearest first."""
        return self._ancestry.get(slug, []) if slug else []


def load_lineage(db: Session) -> Lineage:
    rows = db.execute(
        select(
            t.build.c.build_id,
            t.build.c.slug,
            t.build.c.branch,
            t.build.c.ordinal,
            t.build.c.sort_order,
            t.build.c.display_name,
            t.build.c.client_build,
            t.build.c.released_on,
            t.build.c.parent_build_id,
        ).where(t.build.c.enabled)
    )
    return Lineage(HistoryBuild(**row._mapping) for row in rows)


def load_runs(db: Session, aoids: Sequence[int]) -> Dict[int, Runs]:
    """``{aoid: runs per branch}`` of the items that exist in any build."""
    revision = t.item_revision
    mesh = (
        select(t.part_misc.c.doc["animation_mesh"])
        .where(t.part_misc.c.misc_id == revision.c.misc_id)
        .scalar_subquery()
    )
    rows = db.execute(
        select(
            t.item_presence.c.aoid,
            t.item_presence.c.branch,
            t.item_presence.c.from_ordinal,
            t.item_presence.c.to_ordinal,
            revision.c.stats_id,
            revision.c.atkdef_id,
            mesh.label("mesh"),
            revision.c.effects_id,
            revision.c.actions_id,
            revision.c.text_id,
        )
        .select_from(
            t.item_presence.join(
                revision, revision.c.rev_id == t.item_presence.c.rev_id
            )
        )
        .where(any_of(t.item_presence.c.aoid, aoids))
        .order_by(
            t.item_presence.c.aoid,
            t.item_presence.c.branch,
            t.item_presence.c.from_ordinal,
        )
    )
    runs: Dict[int, Runs] = {}
    for row in rows:
        content: Content = (
            (row.stats_id, row.atkdef_id, _canonical(row.mesh)),
            row.effects_id,
            row.actions_id,
            row.text_id,
        )
        runs.setdefault(row.aoid, {}).setdefault(row.branch, []).append(
            Run(row.from_ordinal, row.to_ordinal, content)
        )
    return runs


def _canonical(document: Any) -> Any:
    """A JSON document as a value that compares and hashes by content."""
    if isinstance(document, dict):
        return tuple(
            sorted((key, _canonical(value)) for key, value in document.items())
        )
    if isinstance(document, list):
        return tuple(_canonical(value) for value in document)
    return document


def content_in(runs: Runs, build: HistoryBuild) -> Optional[Content]:
    """The item's content in ``build``; None when the build lacks the item."""
    branch_runs = runs.get(build.branch)
    if not branch_runs:
        return None
    at = bisect_right(branch_runs, build.ordinal, key=lambda run: run.from_ordinal)
    if at == 0 or branch_runs[at - 1].to_ordinal < build.ordinal:
        return None
    return branch_runs[at - 1].content


@dataclass(frozen=True)
class History:
    """One item across the enabled builds."""

    present: frozenset  # slugs of the builds that have the item
    points: List[ItemRevisionPoint]  # change points, display order


def compute_history(lineage: Lineage, runs: Runs) -> History:
    """Where one item is present and where its definition changed.

    Each build that has the item is compared with the nearest build before it
    in its lineage that has the item too, however many builds lie between: an
    item that leaves and comes back unchanged has not changed. With no such
    build the item is new to the lineage and the point is ``first_seen``.
    Otherwise the build is a change point when one of the four labelled
    contents differs.
    """
    present = set()
    # The content the item has as of each build: its own, or the one it had
    # in the nearest earlier build of the lineage that has the item.
    inherited: Dict[str, Optional[Content]] = {}
    changes: Dict[str, Tuple[bool, List[str]]] = {}

    for build in lineage.oldest_first:
        before = lineage.predecessor[build.slug]
        previous = inherited.get(before.slug) if before else None
        content = content_in(runs, build)
        inherited[build.slug] = content if content is not None else previous
        if content is None:
            continue
        present.add(build.slug)
        if previous is None:
            changes[build.slug] = (True, [])
        elif content != previous:
            changes[build.slug] = (
                False,
                [
                    label
                    for label, new, old in zip(CHANGE_LABELS, content, previous)
                    if new != old
                ],
            )

    points = [
        ItemRevisionPoint(
            version_slug=build.slug,
            display_name=build.display_name,
            family=build.branch,
            snapshot_date=build.released_on,
            client_build=build.client_build,
            changed=changes[build.slug][1],
            first_seen=changes[build.slug][0],
        )
        for build in lineage.display_order
        if build.slug in changes
    ]
    return History(present=frozenset(present), points=points)


def _first_seen_in(
    lineage: Lineage, points: Sequence[ItemRevisionPoint], current_slug: str
) -> Optional[str]:
    """Where the item first appears, preferring the current version's lineage.

    Several lineages can each have a ``first_seen`` point (AO and PRK both
    introduce an item independently). The one that matters to the viewer is the
    root-most first appearance along their own ancestry. Failing that (the
    current version's lineage never had the item) fall back to the first
    appearance closest to a lineage root.
    """
    first_seen = [point for point in points if point.first_seen]
    if not first_seen:
        return None
    first_seen_slugs = {point.version_slug for point in first_seen}

    # ancestry() runs nearest-first, so the last match is the root-most ancestor.
    for slug in reversed(lineage.ancestry(current_slug)):
        if slug in first_seen_slugs:
            return slug

    return min(
        first_seen,
        key=lambda p: (len(lineage.ancestry(p.version_slug)), p.version_slug),
    ).version_slug


def _latest_change_slug(
    lineage: Lineage, points: Sequence[ItemRevisionPoint], current_slug: str
) -> Optional[str]:
    """The snapshot in which the current version's definition was introduced.

    That is the change point on the current version's ancestry closest to it,
    which is the most recent patch the viewer's data reflects.
    """
    point_slugs = {p.version_slug for p in points}
    for slug in lineage.ancestry(current_slug):
        if slug in point_slugs:
            return slug
    return None


@router.post("/revisions/batch", response_model=ItemRevisionsBatchResponse)
def get_item_revisions_batch(
    payload: ItemRevisionsBatchRequest,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Revision summaries for a page of items.

    Intended for list views: one request per page of rows, giving each row its
    "changed in N patches" badge without a per-row round trip.
    """
    aoids = list(dict.fromkeys(payload.aoids))
    lineage = load_lineage(db)
    runs = load_runs(db, aoids)

    items: Dict[int, ItemRevisionBatchEntry] = {}
    for aoid in aoids:
        history = compute_history(lineage, runs.get(aoid, {}))
        items[aoid] = ItemRevisionBatchEntry(
            aoid=aoid,
            revision_count=len(history.points),
            latest_change_slug=_latest_change_slug(lineage, history.points, build.slug),
            present_in_current=build.slug in history.present,
        )

    return ItemRevisionsBatchResponse(items=items)


@router.get("/{aoid}/revisions", response_model=ItemRevisionsResponse)
def get_item_revisions(
    aoid: int, db: Session = Depends(get_store), build: Build = Depends(get_build)
):
    """
    Change history for one item across every enabled game version.

    An item no build has returns an empty history and lists every version
    under ``missing_in``, so the UI can say "not present in this version"
    rather than erroring.
    """
    lineage = load_lineage(db)
    history = compute_history(lineage, load_runs(db, [aoid]).get(aoid, {}))

    ordered_slugs = [build_.slug for build_ in lineage.display_order]
    return ItemRevisionsResponse(
        aoid=aoid,
        present_in=[slug for slug in ordered_slugs if slug in history.present],
        first_seen_in=_first_seen_in(lineage, history.points, build.slug),
        revisions=history.points,
        missing_in=[slug for slug in ordered_slugs if slug not in history.present],
    )
