"""
Spells API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
import math

from app.core.database import get_db
from app.models import Spell, SpellCriterion, Criterion
from app.api.schemas import (
    SpellResponse,
    SpellWithCriteria,
    PaginatedResponse
)

router = APIRouter(prefix="/spells", tags=["spells"])


@router.get("", response_model=PaginatedResponse[SpellResponse])
def get_spells(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    target: Optional[int] = Query(None, description="Filter by target type"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of spells.
    """
    query = db.query(Spell)
    
    # Apply filters
    if target is not None:
        query = query.filter(Spell.target == target)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get spells for current page
    spells = query.offset(offset).limit(page_size).all()
    
    return PaginatedResponse[SpellResponse](
        items=spells,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{spell_id}", response_model=SpellWithCriteria)
def get_spell(spell_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific spell including criteria.
    """
    spell = db.query(Spell).options(
        joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    ).filter(Spell.id == spell_id).first()
    
    if not spell:
        raise HTTPException(status_code=404, detail="Spell not found")
    
    return SpellWithCriteria(
        id=spell.id,
        target=spell.target,
        tick_count=spell.tick_count,
        tick_interval=spell.tick_interval,
        spell_id=spell.spell_id,
        spell_format=spell.spell_format,
        spell_params=spell.spell_params,
        criteria=spell.criteria
    )


@router.get("/with-criteria", response_model=List[SpellWithCriteria])
def get_spells_with_criteria(
    value1: Optional[int] = Query(None, description="Criterion value1"),
    value2: Optional[int] = Query(None, description="Criterion value2"),
    operator: Optional[int] = Query(None, description="Criterion operator"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    db: Session = Depends(get_db)
):
    """
    Get spells that match specific criteria.
    """
    query = db.query(Spell).join(SpellCriterion).join(Criterion)
    
    # Filter by criteria values
    if value1 is not None:
        query = query.filter(Criterion.value1 == value1)
    if value2 is not None:
        query = query.filter(Criterion.value2 == value2)
    if operator is not None:
        query = query.filter(Criterion.operator == operator)
    
    # Load with criteria
    spells = query.options(
        joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    ).limit(limit).all()
    
    return [
        SpellWithCriteria(
            id=spell.id,
            target=spell.target,
            tick_count=spell.tick_count,
            tick_interval=spell.tick_interval,
            spell_id=spell.spell_id,
            spell_format=spell.spell_format,
            spell_params=spell.spell_params,
            criteria=spell.criteria
        )
        for spell in spells
    ]