"""
Pocket Bosses API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
import math
import time
import logging

from app.core.database import get_db
from app.models import PocketBoss, PocketBossSymbiantDrops
from app.api.schemas import (
    PocketBossResponse,
    PocketBossDetail,
    PaginatedResponse
)
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/pocket-bosses", tags=["pocket-bosses"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[PocketBossResponse])
@cached_response("pocket_bosses")
@performance_monitor
def get_pocket_bosses(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    min_level: Optional[int] = Query(None, description="Minimum boss level"),
    max_level: Optional[int] = Query(None, description="Maximum boss level"),
    playfield: Optional[str] = Query(None, description="Filter by playfield"),
    location: Optional[str] = Query(None, description="Filter by location (partial match)"),
    has_drops: Optional[bool] = Query(None, description="Filter bosses with/without symbiant drops"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of pocket bosses with enhanced filtering options.
    """
    start_time = time.time()
    
    query = db.query(PocketBoss)
    
    # Apply filters
    if min_level is not None:
        query = query.filter(PocketBoss.level >= min_level)
    if max_level is not None:
        query = query.filter(PocketBoss.level <= max_level)
    if playfield:
        query = query.filter(PocketBoss.playfield.ilike(f"%{playfield}%"))
    if location:
        query = query.filter(PocketBoss.location.ilike(f"%{location}%"))
    
    # Filter by drop availability
    if has_drops is not None:
        if has_drops:
            query = query.join(PocketBossSymbiantDrops)
        else:
            query = query.outerjoin(PocketBossSymbiantDrops).filter(
                PocketBossSymbiantDrops.pocket_boss_id.is_(None)
            )
    
    # Order by level then name for consistent sorting
    query = query.order_by(PocketBoss.level.asc(), PocketBoss.name.asc())
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get bosses for current page
    bosses = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Pocket boss query level:{min_level}-{max_level} playfield:'{playfield}' results={total} time={query_time:.3f}s")
    
    return PaginatedResponse[PocketBossResponse](
        items=bosses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )




@router.get("/search", response_model=PaginatedResponse[PocketBossResponse])
@cached_response("search_results")
@performance_monitor
def search_pocket_bosses(
    q: str = Query(..., min_length=1, description="Search query for boss name, location, or encounter info"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Search pocket bosses by name, location, or encounter information.
    """
    start_time = time.time()
    
    search_term = f"%{q}%"
    query = db.query(PocketBoss).filter(
        or_(
            PocketBoss.name.ilike(search_term),
            PocketBoss.location.ilike(search_term),
            PocketBoss.playfield.ilike(search_term),
            PocketBoss.mobs.ilike(search_term)
        )
    ).order_by(PocketBoss.level.asc(), PocketBoss.name.asc())
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get bosses for current page
    bosses = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Pocket boss search query='{q}' results={total} time={query_time:.3f}s")
    
    return PaginatedResponse[PocketBossResponse](
        items=bosses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/by-symbiant-family", response_model=PaginatedResponse[PocketBossResponse])
@cached_response("pocket_bosses")
@performance_monitor
def get_bosses_by_symbiant_family(
    family: str = Query(..., description="Symbiant family (e.g., Artillery, Control, etc.)"),
    min_symbiant_ql: Optional[int] = Query(None, description="Minimum symbiant quality level"),
    max_symbiant_ql: Optional[int] = Query(None, description="Maximum symbiant quality level"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Find pocket bosses that drop symbiants of a specific family.
    """
    start_time = time.time()
    
    # Import Symbiant model here to avoid circular imports
    from app.models import Symbiant
    
    query = db.query(PocketBoss).distinct().join(
        PocketBossSymbiantDrops
    ).join(
        Symbiant
    ).filter(
        Symbiant.family.ilike(f"%{family}%")
    )
    
    # Apply symbiant QL filters
    if min_symbiant_ql is not None:
        query = query.filter(Symbiant.ql >= min_symbiant_ql)
    if max_symbiant_ql is not None:
        query = query.filter(Symbiant.ql <= max_symbiant_ql)
    
    # Order by level
    query = query.order_by(PocketBoss.level.asc())
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get bosses for current page
    bosses = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Pocket boss symbiant family query='{family}' ql:{min_symbiant_ql}-{max_symbiant_ql} results={total} time={query_time:.3f}s")
    
    return PaginatedResponse[PocketBossResponse](
        items=bosses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{boss_id}", response_model=PocketBossResponse)
@cached_response("pocket_bosses")
@performance_monitor
def get_pocket_boss(boss_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific pocket boss.
    """
    boss = db.query(PocketBoss).filter(PocketBoss.id == boss_id).first()
    
    if not boss:
        raise HTTPException(status_code=404, detail="Pocket boss not found")
    
    return boss


@router.get("/{boss_id}/drops", response_model=List[dict])
@cached_response("pocket_bosses")
@performance_monitor
def get_pocket_boss_drops(boss_id: int, db: Session = Depends(get_db)):
    """
    Get list of symbiants dropped by a specific pocket boss.
    """
    boss = db.query(PocketBoss).filter(PocketBoss.id == boss_id).first()
    
    if not boss:
        raise HTTPException(status_code=404, detail="Pocket boss not found")
    
    # Get symbiants dropped by this boss
    drops = db.query(PocketBossSymbiantDrops).options(
        joinedload(PocketBossSymbiantDrops.symbiant)
    ).filter(PocketBossSymbiantDrops.pocket_boss_id == boss_id).all()
    
    return [
        {
            "id": drop.symbiant.id,
            "aoid": drop.symbiant.aoid,
            "family": drop.symbiant.family
        }
        for drop in drops
    ]