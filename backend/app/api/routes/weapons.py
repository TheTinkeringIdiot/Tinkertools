"""
Weapons API endpoints for TinkerFite weapon analysis.
"""

import logging
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.decorators import cached_response
from app.api.schemas import ItemDetail
from app.api.schemas.weapon_analysis import WeaponAnalyzeRequest
from app.api.services.weapon_filter_service import WeaponFilterService

router = APIRouter(prefix="/weapons", tags=["weapons"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=List[ItemDetail])
@cached_response("weapons_analyze", ttl=3600)
def analyze_weapons(
    request: WeaponAnalyzeRequest,
    db: Session = Depends(get_db)
):
    """
    Analyze weapons for a character and return equipable weapons.

    Filters weapons based on:
    - Character level (QL range: level ± 50)
    - Top weapon skills (includes weapons where any skill contributes >= 50%)
    - Breed requirements
    - Profession requirements
    - Faction/side requirements
    - Excludes NPC-only items

    Returns a list of weapons with full details including stats, attack_stats, actions, etc.

    Expected result set size: 200-1000 weapons for typical level 220 character.

    Performance target: < 500ms response time (REQ-PERF-001)
    """
    start_time = time.time()

    try:
        # Create weapon filter service
        weapon_service = WeaponFilterService(db)

        # Filter weapons based on character requirements
        weapons = weapon_service.filter_weapons(request)

        # Log performance metrics
        elapsed_time = time.time() - start_time
        logger.info(
            f"Weapon analysis complete: returned {len(weapons)} weapons in {elapsed_time:.3f}s"
        )

        # Check performance requirement
        if elapsed_time > 0.5:
            logger.warning(
                f"Weapon analysis exceeded 500ms target: {elapsed_time:.3f}s"
            )

        return weapons

    except Exception as e:
        logger.error(f"Weapon analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze weapons: {str(e)}"
        )
