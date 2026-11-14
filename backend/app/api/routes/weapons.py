"""
Weapons API endpoints for TinkerFite weapon analysis.
"""

import logging
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.decorators import cached_response
from app.api.schemas import ItemDetail
from app.api.schemas.weapon_analysis import WeaponAnalyzeRequest
from app.api.services.weapon_filter_service import filter_weapons
from app.store.context import Build, get_build, get_store

router = APIRouter(prefix="/weapons", tags=["weapons"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=List[ItemDetail])
@cached_response("weapons_analyze", ttl=3600)
def analyze_weapons(
    request: WeaponAnalyzeRequest,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Analyze weapons for a character and return equipable weapons.

    Filters weapons based on:
    - Top weapon skills (includes weapons where any skill contributes >= 50%)
    - Breed requirements
    - Profession requirements
    - Faction/side requirements
    - Expansion requirements (stat 389 with bitflag matching)
    - Excludes NPC-only items

    Every QL variant of a matching weapon is returned, whatever the character's
    level, with full details (stats, attack_stats, actions, etc.), ordered by
    AOID.

    Expected result set size: 200-1000 weapons for typical level 220 character.

    Performance target: < 500ms response time (REQ-PERF-001)
    """
    start_time = time.time()

    try:
        weapons = filter_weapons(db, build, request)
        # Rendered once: the cache then holds the finished response, and a
        # list of this size is not validated against the response model again.
        response = JSONResponse(weapons)

        elapsed_time = time.time() - start_time
        logger.info(
            f"Weapon analysis complete: returned {len(weapons)} weapons in {elapsed_time:.3f}s"
        )
        if elapsed_time > 0.5:
            logger.warning(
                f"Weapon analysis exceeded 500ms target: {elapsed_time:.3f}s"
            )

        return response

    except Exception as e:
        logger.error(f"Weapon analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to analyze weapons: {str(e)}"
        )
