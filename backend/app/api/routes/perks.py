"""
Perk API endpoints for TinkerTools.

Looks up perks by AOID for profile imports. Perks are items with spell_data
that provide stat modifications following three distinct type systems:
SL (Shadowlands), AI (Alien Invasion), and LE (Lost Eden).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import logging
import time

from app.core.database import get_db
from app.services.perk_service import PerkService
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/perks", tags=["perks"])
logger = logging.getLogger(__name__)


# Batch lookup schemas
class BatchPerkLookupRequest(BaseModel):
    aoids: List[int] = Field(
        ..., max_length=100, description="List of perk AOIDs to lookup"
    )


class BatchPerkResult(BaseModel):
    aoid: int
    success: bool
    perk: Optional[dict] = None
    error: Optional[str] = None


class BatchPerkLookupResponse(BaseModel):
    success: bool
    results: List[BatchPerkResult]
    errors: List[str] = []


def get_perk_service(db: Session = Depends(get_db)) -> PerkService:
    """Dependency to get PerkService instance."""
    return PerkService(db)


@router.get("/lookup/{aoid}")
@cached_response("perk_lookup")
@performance_monitor
def lookup_perk_by_aoid(
    aoid: int, perk_service: PerkService = Depends(get_perk_service)
):
    """
    Look up a perk by its AOID (Anarchy Online ID).

    Used primarily for importing perks from external sources like AOSetups
    where only the AOID is provided. Returns basic perk information
    including name, type, level.
    """
    logger.info(f"Looking up perk by AOID: {aoid}")

    perk_info = perk_service.get_perk_info_by_aoid(aoid)

    if not perk_info:
        # Return a 404 with null body for easier handling in frontend
        return None

    logger.info(
        f"Found perk: {perk_info['name']} (type: {perk_info.get('type', 'SL')}, level: {perk_info.get('counter', 1)})"
    )
    return perk_info


@router.post("/batch/lookup", response_model=BatchPerkLookupResponse)
@performance_monitor
def batch_lookup_perks(
    request: BatchPerkLookupRequest,
    perk_service: PerkService = Depends(get_perk_service),
):
    """
    Look up multiple perks by their AOIDs in a single request.
    Optimized for profile imports to reduce connection pool usage.
    Max 100 perks per request.
    """
    start_time = time.time()
    results = []
    errors = []

    # Single batch query instead of N individual queries
    try:
        perk_info_map = perk_service.batch_get_perk_info_by_aoids(request.aoids)
    except Exception as e:
        logger.error(f"Batch perk lookup query failed: {e}")
        perk_info_map = {}

    for aoid in request.aoids:
        perk_info = perk_info_map.get(aoid)
        if perk_info:
            results.append(BatchPerkResult(aoid=aoid, success=True, perk=perk_info))
        else:
            results.append(
                BatchPerkResult(
                    aoid=aoid, success=False, error=f"Perk with AOID {aoid} not found"
                )
            )
            errors.append(f"Perk {aoid} not found")

    query_time = time.time() - start_time
    logger.info(
        f"Batch perk lookup: {len(request.aoids)} perks, {len(errors)} errors, time={query_time:.3f}s"
    )

    return BatchPerkLookupResponse(
        success=len(errors) == 0, results=results, errors=errors
    )
