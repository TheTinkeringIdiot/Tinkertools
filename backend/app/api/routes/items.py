"""
Items API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
import math

from app.core.database import get_db
from app.models import Item, ItemStats, StatValue
from app.api.schemas import (
    ItemResponse, 
    ItemDetail, 
    ItemSearch,
    PaginatedResponse
)

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=PaginatedResponse[ItemResponse])
def get_items(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    item_class: Optional[str] = Query(None, description="Filter by item class"),
    min_ql: Optional[int] = Query(None, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, description="Maximum quality level"),
    is_nano: Optional[bool] = Query(None, description="Filter nano programs"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of items with optional filters.
    """
    query = db.query(Item)
    
    # Apply filters
    if item_class:
        query = query.filter(Item.item_class == item_class)
    if min_ql is not None:
        query = query.filter(Item.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Item.ql <= max_ql)
    if is_nano is not None:
        query = query.filter(Item.is_nano == is_nano)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size)
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    return PaginatedResponse[ItemResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/search", response_model=PaginatedResponse[ItemResponse])
def search_items(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Search items by name or description.
    """
    search_term = f"%{q}%"
    query = db.query(Item).filter(
        or_(
            Item.name.ilike(search_term),
            Item.description.ilike(search_term)
        )
    )
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    return PaginatedResponse[ItemResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{item_id}", response_model=ItemDetail)
def get_item(item_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific item.
    """
    item = db.query(Item).options(
        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
        joinedload(Item.attack_defense),
        joinedload(Item.item_spell_data)
    ).filter(Item.id == item_id).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Build detailed response
    response = ItemDetail(
        id=item.id,
        aoid=item.aoid,
        name=item.name,
        ql=item.ql,
        item_class=item.item_class,
        slot=item.slot,
        default_pos=item.default_pos,
        max_mass=item.max_mass,
        duration=item.duration,
        icon=item.icon,
        apply_on_friendly=item.apply_on_friendly,
        apply_on_hostile=item.apply_on_hostile,
        apply_on_self=item.apply_on_self,
        dont_apply_on_self=item.dont_apply_on_self,
        can_pick_up=item.can_pick_up,
        flags=item.flags,
        description=item.description,
        is_nano=item.is_nano,
        stats=item.stats,
        spells=[],  # Would need to load spell data through relationships
        attack_stats=item.attack_defense.attack_values if item.attack_defense else [],
        defense_stats=item.attack_defense.defense_values if item.attack_defense else []
    )
    
    return response


@router.get("/with-stats", response_model=List[ItemResponse])
def get_items_with_stats(
    stat: int = Query(..., description="Stat ID to filter by"),
    min_value: Optional[int] = Query(None, description="Minimum stat value"),
    max_value: Optional[int] = Query(None, description="Maximum stat value"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    db: Session = Depends(get_db)
):
    """
    Get items that have specific stat requirements.
    """
    query = db.query(Item).join(ItemStats).join(StatValue)
    
    # Filter by stat
    query = query.filter(StatValue.stat == stat)
    
    # Filter by value range
    if min_value is not None:
        query = query.filter(StatValue.value >= min_value)
    if max_value is not None:
        query = query.filter(StatValue.value <= max_value)
    
    items = query.limit(limit).all()
    return items