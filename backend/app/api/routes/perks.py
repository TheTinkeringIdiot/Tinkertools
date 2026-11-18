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

from app.core.decorators import performance_monitor
from app.store import curated
from app.store.context import Build, get_build, get_store

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


@router.post("/batch/lookup", response_model=BatchPerkLookupResponse)
@performance_monitor
def batch_lookup_perks(
    request: BatchPerkLookupRequest,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Look up multiple perks by their AOIDs in a single request.
    Optimized for profile imports to reduce connection pool usage.
    Max 100 perks per request.
    """
    start_time = time.time()
    results = []
    errors = []

    perks = curated.lookup_perks(db, build, request.aoids)

    for aoid in request.aoids:
        perk_info = perks.get(aoid)
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
