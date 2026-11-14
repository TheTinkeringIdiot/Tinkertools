"""
Game version registry endpoints.

These are cross-version: they read ``public.game_versions`` directly, so they
return the same answer whichever version segment the request carried. The
registry is read from the database rather than from the in-process
``app.core.versions.registry`` cache so that the response always reflects
committed state.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import GameVersion
from app.api.schemas.versions import GameVersionListResponse, GameVersionResponse

router = APIRouter(prefix="/versions", tags=["versions"])


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
