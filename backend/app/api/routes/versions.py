"""
Game version registry endpoints.

These are cross-version: they read ``public.game_versions`` directly, so they
return the same answer whichever version segment the request carried. The
registry is read from the database rather than from the in-process
``app.core.versions.registry`` cache so that the response always reflects
committed state.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import GameVersion
from app.api.schemas.versions import GameVersionListResponse, GameVersionResponse

router = APIRouter(prefix="/versions", tags=["versions"])

logger = logging.getLogger(__name__)


def _current_slug(request: Request) -> Optional[str]:
    """Slug resolved for this request by GameVersionMiddleware."""
    return getattr(request.state, "game_version", None)


def _to_response(
    version: GameVersion, current_slug: Optional[str]
) -> GameVersionResponse:
    response = GameVersionResponse.model_validate(version)
    response.is_current = version.slug == current_slug
    return response


FAMILY_LABELS = {"ao": "AO", "prk": "PRK"}


def _aliases(versions: List[GameVersion]) -> List[GameVersionResponse]:
    """One 'latest' entry per family, following its newest version (the first
    in display order). Its slug is the family name; see VersionRegistry.aliases."""
    slugs = {v.slug for v in versions}
    aliases: dict = {}
    for version in versions:
        if version.family in aliases or version.family in slugs:
            continue
        alias = GameVersionResponse.model_validate(version)
        alias.slug = version.family
        alias.alias_of = version.slug
        label = FAMILY_LABELS.get(version.family, version.family.upper())
        alias.display_name = f"{label} - Latest"
        aliases[version.family] = alias
    return list(aliases.values())


@router.get("", response_model=GameVersionListResponse)
def list_versions(request: Request, db: Session = Depends(get_db)):
    """
    List every enabled game version in display order.

    Display order is ``(sort_order, slug)``, which the version selector uses
    directly. Disabled versions are never returned.
    """
    current_slug = _current_slug(request)

    versions: List[GameVersion] = (
        db.query(GameVersion)
        .filter(GameVersion.enabled.is_(True))
        .order_by(GameVersion.sort_order.asc(), GameVersion.slug.asc())
        .all()
    )

    items = _aliases(versions) + [_to_response(v, current_slug) for v in versions]
    return GameVersionListResponse(
        versions=items, current=current_slug, total=len(items)
    )


# Declared before /versions/{slug} so "current" is not captured as a slug.
@router.get("/current", response_model=GameVersionResponse)
def get_current_version(request: Request, db: Session = Depends(get_db)):
    """
    The game version resolved for this request.

    404 if the resolved slug has no row in the registry, which means the
    configured default version has not been registered yet.
    """
    current_slug = _current_slug(request)

    version = db.query(GameVersion).filter(GameVersion.slug == current_slug).first()
    if version is None:
        logger.warning("Resolved game version %r is not in the registry", current_slug)
        raise HTTPException(
            status_code=404, detail=f"Game version '{current_slug}' not found"
        )

    return _to_response(version, current_slug)


@router.get("/{slug}", response_model=GameVersionResponse)
def get_version(slug: str, request: Request, db: Session = Depends(get_db)):
    """
    Details for one game version or family alias. Unknown or disabled slugs 404.
    """
    version = (
        db.query(GameVersion)
        .filter(GameVersion.slug == slug, GameVersion.enabled.is_(True))
        .first()
    )
    if version is None:
        family = (
            db.query(GameVersion)
            .filter(GameVersion.family == slug, GameVersion.enabled.is_(True))
            .order_by(GameVersion.sort_order.asc(), GameVersion.slug.asc())
            .all()
        )
        alias = next((a for a in _aliases(family) if a.slug == slug), None)
        if alias is None:
            raise HTTPException(
                status_code=404, detail=f"Game version '{slug}' not found"
            )
        alias.is_current = alias.alias_of == _current_slug(request)
        return alias

    return _to_response(version, _current_slug(request))
