"""
Mobs API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import time
import logging

from app.api.schemas.mob import MobResponse
from app.api.schemas.symbiant import SymbiantResponse
from app.api.schemas import PaginatedResponse
from app.core.decorators import cached_response, performance_monitor
from app.store import curated
from app.store.context import Build, get_build, get_store
from app.store.presence import page_fields

router = APIRouter(prefix="/mobs", tags=["mobs"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[MobResponse])
@cached_response("mobs")
@performance_monitor
def list_mobs(
    is_pocket_boss: Optional[bool] = Query(None, description="Filter pocket bosses"),
    playfield: Optional[str] = Query(None, description="Filter by playfield"),
    min_level: Optional[int] = Query(None, description="Minimum mob level"),
    max_level: Optional[int] = Query(None, description="Maximum mob level"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    List all mobs with optional filtering, ordered by level, name and id.

    Filters:
    - is_pocket_boss: Filter by pocket boss status
    - playfield: Filter by playfield name (partial match)
    - min_level/max_level: Filter by level range
    """
    start_time = time.time()

    mobs, total = curated.list_mobs(
        db,
        build,
        page,
        page_size,
        is_pocket_boss=is_pocket_boss,
        playfield=playfield,
        min_level=min_level,
        max_level=max_level,
    )

    query_time = time.time() - start_time
    logger.info(
        f"Mob list query is_pocket_boss={is_pocket_boss} playfield='{playfield}' level:{min_level}-{max_level} results={total} time={query_time:.3f}s"
    )

    return PaginatedResponse[MobResponse](
        items=mobs, **page_fields(total, page, page_size)
    )


@router.get("/{mob_id}/drops", response_model=List[SymbiantResponse])
@cached_response("mob_drops")
@performance_monitor
def get_mob_drops(
    mob_id: int,
    family: Optional[str] = Query(None, description="Filter by symbiant family"),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Get all symbiants dropped by this mob with actions for level extraction.

    Args:
        mob_id: ID of the mob
        family: Optional filter by symbiant family (Artillery, Control, etc.)
    """
    start_time = time.time()

    if not curated.has_mob(db, build, mob_id):
        raise HTTPException(status_code=404, detail="Mob not found")

    symbiants = curated.mob_drops(db, build, mob_id, family)

    query_time = time.time() - start_time
    logger.info(
        f"Mob drops query mob_id={mob_id} family='{family}' results={len(symbiants)} time={query_time:.3f}s"
    )

    return symbiants


@router.get("/{mob_id}", response_model=MobResponse)
@cached_response("mobs")
@performance_monitor
def get_mob(
    mob_id: int, db: Session = Depends(get_store), build: Build = Depends(get_build)
):
    """
    Get detailed information about a specific mob.
    """
    mob = curated.get_mob(db, build, mob_id)

    if not mob:
        raise HTTPException(status_code=404, detail="Mob not found")

    return mob
