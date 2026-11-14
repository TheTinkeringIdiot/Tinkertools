"""
Symbiants API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import time
import logging

from app.api.schemas.symbiant import (
    SymbiantResponse,
    MobDropInfo,
)
from app.api.schemas import PaginatedResponse
from app.core.decorators import cached_response, performance_monitor
from app.store import curated
from app.store.context import Build, get_build, get_store
from app.store.presence import page_fields

router = APIRouter(prefix="/symbiants", tags=["symbiants"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[SymbiantResponse])
@cached_response("symbiants")
@performance_monitor
def list_symbiants(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
) -> PaginatedResponse[SymbiantResponse]:
    """
    List symbiants with pagination.

    Pagination parameters:
    - page: Page number (1-indexed)
    - page_size: Number of items per page (default: 50, max: 200)

    Returns the symbiants ordered by family, QL, name and AOID.
    """
    start_time = time.time()

    symbiants, total = curated.list_symbiants(db, build, page, page_size)

    query_time = time.time() - start_time
    logger.info(
        f"Symbiant list query page={page} page_size={page_size} results={len(symbiants)}/{total} time={query_time:.3f}s"
    )

    return PaginatedResponse[SymbiantResponse](
        items=symbiants, **page_fields(total, page, page_size)
    )


@router.get("/{aoid}/dropped-by", response_model=List[MobDropInfo])
@cached_response("symbiant_sources")
@performance_monitor
def get_symbiant_sources(
    aoid: int, db: Session = Depends(get_store), build: Build = Depends(get_build)
):
    """
    Get all pocket bosses that drop this symbiant.

    Only returns mobs where is_pocket_boss = TRUE.

    Args:
        aoid: Anarchy Online item ID of the symbiant
    """
    start_time = time.time()

    if not curated.has_symbiant(db, build, aoid):
        raise HTTPException(status_code=404, detail="Symbiant not found")

    mobs = curated.symbiant_dropped_by(db, build, aoid)

    query_time = time.time() - start_time
    logger.info(
        f"Symbiant sources query aoid={aoid} results={len(mobs)} time={query_time:.3f}s"
    )

    return mobs


@router.get("/{aoid}", response_model=SymbiantResponse)
@cached_response("symbiants")
@performance_monitor
def get_symbiant(
    aoid: int, db: Session = Depends(get_store), build: Build = Depends(get_build)
):
    """
    Get detailed information about a specific symbiant, by its AOID.
    """
    symbiant = curated.get_symbiant(db, build, aoid)

    if not symbiant:
        raise HTTPException(status_code=404, detail="Symbiant not found")

    return symbiant
