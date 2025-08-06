"""
Pocket Bosses API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
import math

from app.core.database import get_db
from app.models import PocketBoss, PocketBossSymbiantDrops
from app.api.schemas import (
    PocketBossResponse,
    PocketBossDetail,
    PaginatedResponse
)

router = APIRouter(prefix="/pocket-bosses", tags=["pocket-bosses"])


@router.get("", response_model=PaginatedResponse[PocketBossResponse])
def get_pocket_bosses(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    min_level: Optional[int] = Query(None, description="Minimum boss level"),
    max_level: Optional[int] = Query(None, description="Maximum boss level"),
    playfield: Optional[str] = Query(None, description="Filter by playfield"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of pocket bosses with optional filters.
    """
    query = db.query(PocketBoss)
    
    # Apply filters
    if min_level is not None:
        query = query.filter(PocketBoss.level >= min_level)
    if max_level is not None:
        query = query.filter(PocketBoss.level <= max_level)
    if playfield:
        query = query.filter(PocketBoss.playfield == playfield)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get bosses for current page
    bosses = query.offset(offset).limit(page_size).all()
    
    return PaginatedResponse[PocketBossResponse](
        items=bosses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{boss_id}", response_model=PocketBossDetail)
def get_pocket_boss(boss_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific pocket boss including drops.
    """
    boss = db.query(PocketBoss).options(
        joinedload(PocketBoss.symbiant_drops).joinedload(PocketBossSymbiantDrops.symbiant)
    ).filter(PocketBoss.id == boss_id).first()
    
    if not boss:
        raise HTTPException(status_code=404, detail="Pocket boss not found")
    
    return PocketBossDetail(
        id=boss.id,
        name=boss.name,
        level=boss.level,
        location=boss.location,
        playfield=boss.playfield,
        encounter_info=boss.encounter_info,
        mob_composition=boss.mob_composition,
        drops=boss.drops
    )


@router.get("/{boss_id}/drops", response_model=List[dict])
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
            "name": drop.symbiant.name,
            "ql": drop.symbiant.ql,
            "family": drop.symbiant.family,
            "symbiant_class": drop.symbiant.symbiant_class,
            "slot": drop.symbiant.slot
        }
        for drop in drops
    ]