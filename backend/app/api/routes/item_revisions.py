"""
Cross-version item change history ("changed in" dropdown).

The importer writes one ``public.item_revisions`` row per (item, version) with
a content hash plus four sub-hashes (stats, spells, actions, text). Walking
those rows along the version lineage (``game_versions.parent_slug``) yields the
snapshots at which an item's definition changed.

Both endpoints read only ``public`` tables, so they are version-independent:
the version segment in the URL does not change the rows considered, only which
version counts as "current" for ``is_current``-style fields.
"""

import logging
from typing import Dict, Iterable, List, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import GameVersion, ItemRevision
from app.api.schemas.versions import (
    ItemRevisionBatchEntry,
    ItemRevisionPoint,
    ItemRevisionsBatchRequest,
    ItemRevisionsBatchResponse,
    ItemRevisionsResponse,
)

router = APIRouter(prefix="/items", tags=["item-revisions"])

logger = logging.getLogger(__name__)

# Sub-hash column -> label reported in ``changed``. Order is the report order.
HASH_FIELDS = (
    ("stats_hash", "stats"),
    ("spells_hash", "spells"),
    ("actions_hash", "actions"),
    ("text_hash", "text"),
)


def _display_order(versions: Iterable[GameVersion]) -> List[GameVersion]:
    """Versions in selector order: ``(sort_order, slug)``."""
    return sorted(versions, key=lambda v: (v.sort_order or 0, v.slug))


def ancestry(
    versions_by_slug: Dict[str, GameVersion], slug: Optional[str]
) -> List[str]:
    """Slugs from ``slug`` upward through ``parent_slug``, nearest first.

    Stops at an unknown slug (a disabled or deleted parent breaks the chain)
    and at a repeat, so a malformed cycle in the registry cannot hang a request.
    """
    chain: List[str] = []
    seen = set()
    cursor = slug
    while cursor and cursor in versions_by_slug and cursor not in seen:
        seen.add(cursor)
        chain.append(cursor)
        cursor = versions_by_slug[cursor].parent_slug
    return chain


def compute_revision_points(
    versions: Sequence[GameVersion],
    rows: Sequence[ItemRevision],
) -> List[ItemRevisionPoint]:
    """Snapshots at which one item's definition changed.

    ``versions`` are the enabled registry rows; ``rows`` are the
    ``item_revisions`` rows for a single AOID. For each version that has a row,
    in display order, the predecessor is the nearest ancestor along
    ``parent_slug`` that also has a row for this item. With no such ancestor the
    item is new to that lineage, so the point is reported as ``first_seen``.
    Otherwise the four sub-hashes are compared and the differing ones are
    reported in ``changed``.

    A version is emitted only if it is a real change point: either
    ``first_seen`` or with at least one differing sub-hash. Unchanged snapshots
    carry no information for the history dropdown and are dropped.
    """
    versions_by_slug = {v.slug: v for v in versions}
    rows_by_slug = {
        r.version_slug: r for r in rows if r.version_slug in versions_by_slug
    }

    points: List[ItemRevisionPoint] = []

    for version in _display_order(versions):
        row = rows_by_slug.get(version.slug)
        if row is None:
            continue

        # Nearest ancestor holding this item. A version that is its own parent,
        # or that reaches itself through a cycle, is not its own predecessor.
        predecessor = None
        for ancestor_slug in ancestry(versions_by_slug, version.parent_slug):
            if ancestor_slug == version.slug:
                continue
            if ancestor_slug in rows_by_slug:
                predecessor = rows_by_slug[ancestor_slug]
                break

        if predecessor is None:
            first_seen = True
            changed: List[str] = []
        else:
            first_seen = False
            changed = [
                label
                for attr, label in HASH_FIELDS
                if getattr(row, attr) != getattr(predecessor, attr)
            ]
            if not changed:
                continue

        points.append(
            ItemRevisionPoint(
                version_slug=version.slug,
                display_name=version.display_name,
                family=version.family,
                snapshot_date=version.snapshot_date,
                client_build=version.client_build,
                changed=changed,
                first_seen=first_seen,
            )
        )

    return points


def _first_seen_in(
    versions_by_slug: Dict[str, GameVersion],
    points: Sequence[ItemRevisionPoint],
    current_slug: Optional[str],
) -> Optional[str]:
    """Where the item first appears, preferring the current version's lineage.

    Several lineages can each have a ``first_seen`` point (AO and PRK both
    introduce an item independently). The one that matters to the viewer is the
    root-most first appearance along their own ancestry. Failing that (the
    current version has no row, or is not registered at all) fall back to the
    first appearance closest to a lineage root, then to the first point.
    """
    if not points:
        return None

    first_seen_slugs = {p.version_slug for p in points if p.first_seen}

    # ancestry() runs nearest-first, so the last match is the root-most ancestor.
    for slug in reversed(ancestry(versions_by_slug, current_slug)):
        if slug in first_seen_slugs:
            return slug

    if first_seen_slugs:
        return min(
            (p for p in points if p.first_seen),
            key=lambda p: (
                len(ancestry(versions_by_slug, p.version_slug)),
                p.version_slug,
            ),
        ).version_slug

    return points[0].version_slug


def _latest_change_slug(
    versions_by_slug: Dict[str, GameVersion],
    points: Sequence[ItemRevisionPoint],
    current_slug: Optional[str],
) -> Optional[str]:
    """The snapshot in which the current version's definition was introduced.

    That is the change point on the current version's ancestry closest to it,
    which is the most recent patch the viewer's data reflects.
    """
    point_slugs = {p.version_slug for p in points}
    for slug in ancestry(versions_by_slug, current_slug):
        if slug in point_slugs:
            return slug
    return None


def _enabled_versions(db: Session) -> List[GameVersion]:
    return (
        db.query(GameVersion)
        .filter(GameVersion.enabled.is_(True))
        .order_by(GameVersion.sort_order.asc(), GameVersion.slug.asc())
        .all()
    )


@router.post("/revisions/batch", response_model=ItemRevisionsBatchResponse)
def get_item_revisions_batch(
    payload: ItemRevisionsBatchRequest, request: Request, db: Session = Depends(get_db)
):
    """
    Revision summaries for a page of items.

    Intended for list views: one request per page of rows, giving each row its
    "changed in N patches" badge without a per-row round trip.
    """
    current_slug = getattr(request.state, "game_version", None)

    aoids = list(dict.fromkeys(payload.aoids))
    versions = _enabled_versions(db)
    versions_by_slug = {v.slug: v for v in versions}

    rows = db.query(ItemRevision).filter(ItemRevision.aoid.in_(aoids)).all()

    rows_by_aoid: Dict[int, List[ItemRevision]] = {aoid: [] for aoid in aoids}
    for row in rows:
        rows_by_aoid.setdefault(row.aoid, []).append(row)

    items: Dict[int, ItemRevisionBatchEntry] = {}
    for aoid in aoids:
        aoid_rows = rows_by_aoid.get(aoid, [])
        points = compute_revision_points(versions, aoid_rows)
        items[aoid] = ItemRevisionBatchEntry(
            aoid=aoid,
            revision_count=len(points),
            latest_change_slug=_latest_change_slug(
                versions_by_slug, points, current_slug
            ),
            present_in_current=any(r.version_slug == current_slug for r in aoid_rows),
        )

    return ItemRevisionsBatchResponse(items=items)


@router.get("/{aoid}/revisions", response_model=ItemRevisionsResponse)
def get_item_revisions(aoid: int, request: Request, db: Session = Depends(get_db)):
    """
    Change history for one item across every enabled game version.

    404 only if the registry itself is empty; an item with no revision rows
    returns an empty history and lists every version under ``missing_in``, so
    the UI can say "not present in this version" rather than erroring.
    """
    current_slug = getattr(request.state, "game_version", None)

    versions = _enabled_versions(db)
    if not versions:
        raise HTTPException(status_code=404, detail="No game versions are registered")

    versions_by_slug = {v.slug: v for v in versions}

    rows = db.query(ItemRevision).filter(ItemRevision.aoid == aoid).all()
    present = {r.version_slug for r in rows if r.version_slug in versions_by_slug}

    points = compute_revision_points(versions, rows)

    ordered_slugs = [v.slug for v in _display_order(versions)]
    return ItemRevisionsResponse(
        aoid=aoid,
        present_in=[slug for slug in ordered_slugs if slug in present],
        first_seen_in=_first_seen_in(versions_by_slug, points, current_slug),
        revisions=points,
        missing_in=[slug for slug in ordered_slugs if slug not in present],
    )
