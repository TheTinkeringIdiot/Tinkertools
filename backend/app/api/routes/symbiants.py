"""
Symbiants API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
import math

from app.core.database import get_db
from app.models import Symbiant, PocketBossSymbiantDrops
from app.api.schemas import (
    SymbiantResponse,
    SymbiantDetail,
    PaginatedResponse
)

router = APIRouter(prefix="/symbiants", tags=["symbiants"])


@router.get("", response_model=PaginatedResponse[SymbiantResponse])
def get_symbiants(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    family: Optional[str] = Query(None, description="Filter by symbiant family"),
    slot: Optional[str] = Query(None, description="Filter by equipment slot"),
    min_ql: Optional[int] = Query(None, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, description="Maximum quality level"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of symbiants with optional filters.
    """
    query = db.query(Symbiant)
    
    # Apply filters
    if family:
        query = query.filter(Symbiant.family == family)
    if slot:
        query = query.filter(Symbiant.slot == slot)
    if min_ql is not None:
        query = query.filter(Symbiant.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Symbiant.ql <= max_ql)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get symbiants for current page
    symbiants = query.offset(offset).limit(page_size).all()
    
    return PaginatedResponse[SymbiantResponse](
        items=symbiants,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{symbiant_id}", response_model=SymbiantDetail)
def get_symbiant(symbiant_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific symbiant including drop sources.
    """
    symbiant = db.query(Symbiant).options(
        joinedload(Symbiant.pocket_boss_drops).joinedload(PocketBossSymbiantDrops.pocket_boss)
    ).filter(Symbiant.id == symbiant_id).first()
    
    if not symbiant:
        raise HTTPException(status_code=404, detail="Symbiant not found")
    
    return SymbiantDetail(
        id=symbiant.id,
        aoid=symbiant.aoid,
        name=symbiant.name,
        ql=symbiant.ql,
        family=symbiant.family,
        symbiant_class=symbiant.symbiant_class,
        slot=symbiant.slot,
        stats=symbiant.stats,
        description=symbiant.description,
        dropped_by=symbiant.dropped_by
    )


@router.get("/{symbiant_id}/dropped-by", response_model=List[dict])
def get_symbiant_drop_sources(symbiant_id: int, db: Session = Depends(get_db)):
    """
    Get list of pocket bosses that drop a specific symbiant.
    """
    symbiant = db.query(Symbiant).filter(Symbiant.id == symbiant_id).first()
    
    if not symbiant:
        raise HTTPException(status_code=404, detail="Symbiant not found")
    
    # Get pocket bosses that drop this symbiant
    bosses = db.query(PocketBossSymbiantDrops).options(
        joinedload(PocketBossSymbiantDrops.pocket_boss)
    ).filter(PocketBossSymbiantDrops.symbiant_id == symbiant_id).all()
    
    return [
        {
            "id": drop.pocket_boss.id,
            "name": drop.pocket_boss.name,
            "level": drop.pocket_boss.level,
            "location": drop.pocket_boss.location,
            "playfield": drop.pocket_boss.playfield
        }
        for drop in bosses
    ]