"""
Spells API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
import math
import time
import logging

from app.core.database import get_db
from app.models import Spell, SpellCriterion, Criterion
from app.api.schemas import (
    SpellResponse,
    SpellWithCriteria,
    PaginatedResponse
)
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/spells", tags=["spells"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[SpellResponse])
@cached_response("spells_list")
@performance_monitor
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




@router.get("/with-criteria", response_model=PaginatedResponse[SpellWithCriteria])
@cached_response("spells_list")
@performance_monitor
def get_spells_with_criteria(
    # Criteria filters - support multiple criteria with AND/OR logic
    criteria_requirements: Optional[str] = Query(None, description="Criteria requirements (e.g., '100:200:1' or '100:200:1,150:300:2')"),
    logic: str = Query("and", description="Logic operator: 'and' or 'or'"),
    
    # Individual criteria filters (alternative to requirements string)
    value1: Optional[int] = Query(None, description="Criterion value1"),
    value2: Optional[int] = Query(None, description="Criterion value2"),
    operator: Optional[int] = Query(None, description="Criterion operator"),
    
    # Additional filters
    target: Optional[int] = Query(None, description="Filter by target type"),
    spell_id: Optional[int] = Query(None, description="Filter by spell ID"),
    
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    
    db: Session = Depends(get_db)
):
    """
    Get spells that match specific criteria requirements.
    
    Examples:
    - criteria_requirements='100:200:1' (single criterion: value1=100, value2=200, operator=1)
    - criteria_requirements='100:200:1,150:300:2' with logic='and' (must have BOTH criteria)
    - criteria_requirements='100:200:1,150:300:2' with logic='or' (must have EITHER criterion)
    """
    start_time = time.time()
    
    query = db.query(Spell).distinct()
    
    if criteria_requirements:
        # Parse complex criteria requirements
        try:
            requirements = []
            for req in criteria_requirements.split(','):
                parts = req.split(':')
                if len(parts) != 3:
                    raise ValueError("Each criterion must have format 'value1:value2:operator'")
                
                val1, val2, op = int(parts[0]), int(parts[1]), int(parts[2])
                requirements.append((val1, val2, op))
        except (ValueError, IndexError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid criteria_requirements format: {e}")
        
        if logic == "and":
            # AND logic: spell must have ALL specified criteria
            for val1, val2, op in requirements:
                query = query.join(SpellCriterion).join(Criterion).filter(
                    Criterion.value1 == val1,
                    Criterion.value2 == val2,
                    Criterion.operator == op
                )
        else:
            # OR logic: spell must have ANY of the specified criteria
            criterion_ids = []
            for val1, val2, op in requirements:
                subquery = db.query(Criterion.id).filter(
                    Criterion.value1 == val1,
                    Criterion.value2 == val2,
                    Criterion.operator == op
                ).all()
                criterion_ids.extend([row[0] for row in subquery])
            
            if criterion_ids:
                query = query.join(SpellCriterion).filter(
                    SpellCriterion.criterion_id.in_(set(criterion_ids))
                )
    else:
        # Use individual filters as fallback
        if any([value1 is not None, value2 is not None, operator is not None]):
            query = query.join(SpellCriterion).join(Criterion)
            
            if value1 is not None:
                query = query.filter(Criterion.value1 == value1)
            if value2 is not None:
                query = query.filter(Criterion.value2 == value2)
            if operator is not None:
                query = query.filter(Criterion.operator == operator)
    
    # Apply additional filters
    if target is not None:
        query = query.filter(Spell.target == target)
    if spell_id is not None:
        query = query.filter(Spell.spell_id == spell_id)
    
    # Always load criteria for response
    query = query.options(
        joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    )
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get spells for current page
    spells = query.offset(offset).limit(page_size).all()
    
    # Build response objects
    spell_responses = [
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
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Spell criteria query requirements='{criteria_requirements}' logic='{logic}' results={total} time={query_time:.3f}s")
    
    return PaginatedResponse[SpellWithCriteria](
        items=spell_responses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/search", response_model=PaginatedResponse[SpellResponse])
@cached_response("search_results")
@performance_monitor
def search_spells(
    q: str = Query(..., min_length=1, description="Search query for spell format or params"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Search spells by spell format or parameters.
    """
    start_time = time.time()
    
    search_term = f"%{q}%"
    query = db.query(Spell).filter(
        Spell.spell_format.ilike(search_term)
        # Note: Could add JSONB search for spell_params if needed
        # or_(
        #     Spell.spell_format.ilike(search_term),
        #     Spell.spell_params.astext.ilike(search_term)
        # )
    ).order_by(Spell.spell_id)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get spells for current page
    spells = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Spell search query='{q}' results={total} time={query_time:.3f}s")
    
    return PaginatedResponse[SpellResponse](
        items=spells,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{spell_id}", response_model=SpellResponse)
@cached_response("spells_list")
@performance_monitor
def get_spell(spell_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific spell.
    """
    spell = db.query(Spell).filter(Spell.id == spell_id).first()
    
    if not spell:
        raise HTTPException(status_code=404, detail="Spell not found")
    
    return spell