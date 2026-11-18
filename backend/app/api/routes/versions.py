"""
The game versions the API serves.

A version is a build of the store. The list is the same whichever version
segment the request carried; only ``current`` and ``is_current`` follow it.

Like the builds requests are resolved against (``app.store.context``), the
list outlives a database that cannot be reached: the one read last is served
until the store answers again.
"""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.schemas.versions import GameVersionListResponse, GameVersionResponse
from app.store import get_store
from app.store import tables as t
from app.store.changes import load_build_index
from app.store.context import BUILDS_UNAVAILABLE, store_schema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/versions", tags=["versions"])

FAMILY_LABELS = {"ao": "AO", "prk": "PRK"}

# The versions read last, by the schema of the store they were read from.
_read_last: Dict[str, List[GameVersionResponse]] = {}


def _enabled_versions(db: Session) -> List[GameVersionResponse]:
    """The enabled builds in display order. A build's parent is the build its
    change log is relative to: the one before it in its family, or the build
    its family forked from."""
    builds = load_build_index(db)
    rows = db.execute(
        select(
            t.build.c.slug,
            t.build.c.branch,
            t.build.c.ordinal,
            t.build.c.display_name,
            t.build.c.client_build,
            t.build.c.released_on,
            t.build.c.sort_order,
            t.build.c.enabled,
            t.build.c.is_default,
            t.build.c.features,
            t.build.c.notes,
        )
        .where(t.build.c.enabled)
        .order_by(t.build.c.sort_order, t.build.c.slug)
    )
    versions = []
    for row in rows:
        parent = builds.base_of(row.branch, row.ordinal)
        versions.append(
            GameVersionResponse(
                slug=row.slug,
                display_name=row.display_name,
                family=row.branch,
                parent_slug=parent.slug if parent else None,
                client_build=row.client_build,
                snapshot_date=row.released_on,
                sort_order=row.sort_order,
                enabled=row.enabled,
                is_default=row.is_default,
                features=row.features,
                notes=row.notes,
            )
        )
    return versions


def _versions(db: Session) -> Optional[List[GameVersionResponse]]:
    """The enabled versions, or those read last while the store cannot be
    read; None without either."""
    schema = store_schema(db)
    try:
        _read_last[schema] = _enabled_versions(db)
    except SQLAlchemyError as error:
        if schema not in _read_last:
            return None
        logger.warning(
            "The game versions could not be read; serving the list read " "earlier: %s",
            error,
        )
    return [version.model_copy() for version in _read_last[schema]]


def _aliases(versions: List[GameVersionResponse]) -> List[GameVersionResponse]:
    """One 'latest' entry per family, following its newest version (the first
    in display order). Its slug is the family name, which requests may use in
    place of a version (``app.store.context.resolve_build``)."""
    slugs = {v.slug for v in versions}
    aliases: dict = {}
    for version in versions:
        if version.family in aliases or version.family in slugs:
            continue
        label = FAMILY_LABELS.get(version.family, version.family.upper())
        aliases[version.family] = version.model_copy(
            update={
                "slug": version.family,
                "alias_of": version.slug,
                "display_name": f"{label} - Latest",
            }
        )
    return list(aliases.values())


@router.get("", response_model=GameVersionListResponse)
def list_versions(request: Request, db: Session = Depends(get_store)):
    """
    List every enabled game version in display order.

    Display order is ``(sort_order, slug)``, which the version selector uses
    directly. Disabled versions are never returned. While the database
    cannot be reached the list read last is returned, and 503 when there is
    none.
    """
    current_slug = getattr(request.state, "game_version", None)

    versions = _versions(db)
    if versions is None:
        # the answer of the version middleware when it has no builds either
        return JSONResponse(status_code=503, content={"detail": BUILDS_UNAVAILABLE})
    aliases = _aliases(versions)
    for version in versions:
        version.is_current = version.slug == current_slug

    items = aliases + versions
    return GameVersionListResponse(
        versions=items, current=current_slug, total=len(items)
    )
