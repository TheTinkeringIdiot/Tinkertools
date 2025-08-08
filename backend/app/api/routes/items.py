"""
Items API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
import math
import time
import logging

from app.core.database import get_db
from app.models import Item, ItemStats, StatValue, AttackDefense, AttackDefenseAttack, AttackDefenseDefense
from app.api.schemas import (
    ItemResponse, 
    ItemDetail, 
    ItemSearch,
    PaginatedResponse
)
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/items", tags=["items"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[ItemResponse])
def get_items(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    item_class: Optional[int] = Query(None, description="Filter by item class"),
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
    use_fulltext: bool = Query(True, description="Use PostgreSQL full-text search"),
    weapons: bool = Query(False, description="Filter to weapons only (items with both attack and defense data)"),
    db: Session = Depends(get_db)
):
    """
    Search items by name or description using PostgreSQL full-text search or ILIKE fallback.
    """
    start_time = time.time()
    
    if use_fulltext:
        # Use PostgreSQL full-text search for better performance and ranking
        search_query = q.replace(' ', ' & ')  # Convert spaces to AND operators
        
        # Full-text search with ranking
        query = db.query(Item).filter(
            func.to_tsvector('english', Item.name + ' ' + func.coalesce(Item.description, '')).op('@@')(
                func.to_tsquery('english', search_query)
            )
        )
        
        # Apply weapons filter to fulltext search if requested
        if weapons:
            query = query.filter(Item.atkdef_id.isnot(None))\
                        .join(AttackDefense, Item.atkdef_id == AttackDefense.id)\
                        .join(AttackDefenseAttack, AttackDefense.id == AttackDefenseAttack.attack_defense_id)\
                        .join(AttackDefenseDefense, AttackDefense.id == AttackDefenseDefense.attack_defense_id)\
                        .distinct()\
                        .order_by(Item.name)  # Simple ordering when using DISTINCT
        else:
            # Only use ts_rank ordering when not filtering for weapons
            query = query.order_by(
                func.ts_rank(
                    func.to_tsvector('english', Item.name + ' ' + func.coalesce(Item.description, '')),
                    func.to_tsquery('english', search_query)
                ).desc()
            )
    else:
        # Fallback to ILIKE for compatibility
        search_term = f"%{q}%"
        query = db.query(Item).filter(
            or_(
                Item.name.ilike(search_term),
                Item.description.ilike(search_term)
            )
        ).order_by(Item.name)
        
        # Apply weapons filter to ILIKE search if requested
        if weapons:
            query = query.filter(Item.atkdef_id.isnot(None))\
                        .join(AttackDefense, Item.atkdef_id == AttackDefense.id)\
                        .join(AttackDefenseAttack, AttackDefense.id == AttackDefenseAttack.attack_defense_id)\
                        .join(AttackDefenseDefense, AttackDefense.id == AttackDefenseDefense.attack_defense_id)\
                        .distinct()
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Item search query='{q}' results={total} time={query_time:.3f}s method={'fulltext' if use_fulltext else 'ilike'}")
    
    return PaginatedResponse[ItemResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )



@router.get("/filter", response_model=PaginatedResponse[ItemResponse])
@cached_response("items_list")
@performance_monitor
def filter_items_advanced(
    # Basic filters
    item_class: Optional[int] = Query(None, description="Filter by item class"),
    min_ql: Optional[int] = Query(None, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, description="Maximum quality level"),
    is_nano: Optional[bool] = Query(None, description="Filter nano programs"),
    slot: Optional[str] = Query(None, description="Filter by equipment slot"),
    
    # Advanced filters
    has_attack_defense: Optional[bool] = Query(None, description="Items with attack/defense stats"),
    has_stats: Optional[bool] = Query(None, description="Items with any stats"),
    
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    
    # Sorting
    sort_by: str = Query("name", description="Sort by: name, ql, item_class"),
    sort_order: str = Query("asc", description="Sort order: asc, desc"),
    
    db: Session = Depends(get_db)
):
    """
    Advanced filtering for items with multiple criteria and sorting options.
    """
    start_time = time.time()
    
    query = db.query(Item)
    
    # Apply basic filters
    if item_class:
        query = query.filter(Item.item_class == item_class)
    if min_ql is not None:
        query = query.filter(Item.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Item.ql <= max_ql)
    if is_nano is not None:
        query = query.filter(Item.is_nano == is_nano)
    if slot:
        query = query.filter(Item.slot == slot)
    
    # Apply advanced filters
    if has_attack_defense is not None:
        if has_attack_defense:
            query = query.filter(Item.attack_defense_id.isnot(None))
        else:
            query = query.filter(Item.attack_defense_id.is_(None))
    
    if has_stats is not None:
        if has_stats:
            query = query.join(ItemStats)
        else:
            query = query.outerjoin(ItemStats).filter(ItemStats.item_id.is_(None))
    
    # Apply sorting
    if sort_by == "name":
        sort_column = Item.name
    elif sort_by == "ql":
        sort_column = Item.ql
    elif sort_by == "item_class":
        sort_column = Item.item_class
    else:
        sort_column = Item.name
    
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Item filter results={total} time={query_time:.3f}s filters=class:{item_class},ql:{min_ql}-{max_ql},nano:{is_nano}")
    
    return PaginatedResponse[ItemResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/with-stats", response_model=PaginatedResponse[ItemResponse])
@cached_response("items_list")
@performance_monitor
def get_items_with_stats(
    # Stat filters - support multiple stats with AND/OR logic
    stat_requirements: str = Query(..., description="Stat requirements (e.g., '16:>=500' or '16:>=500,17:>=400')"),
    logic: str = Query("and", description="Logic operator: 'and' or 'or'"),
    
    # Additional filters
    item_class: Optional[int] = Query(None, description="Filter by item class"),
    min_ql: Optional[int] = Query(None, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, description="Maximum quality level"),
    
    # Pagination
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    
    db: Session = Depends(get_db)
):
    """
    Get items that meet complex stat requirements.
    
    Examples:
    - stat_requirements='16:>=500' (Strength >= 500)
    - stat_requirements='16:>=500,17:>=400' with logic='and' (Strength >= 500 AND Intelligence >= 400)
    - stat_requirements='16:>=500,17:>=400' with logic='or' (Strength >= 500 OR Intelligence >= 400)
    """
    start_time = time.time()
    
    # Parse stat requirements
    try:
        requirements = []
        for req in stat_requirements.split(','):
            stat_str, condition = req.split(':')
            stat_id = int(stat_str)
            
            # Parse condition (>=500, >500, =500, <500, <=500)
            if condition.startswith('>='):
                op = '>='
                value = int(condition[2:])
            elif condition.startswith('<='):
                op = '<='
                value = int(condition[2:])
            elif condition.startswith('>'):
                op = '>'
                value = int(condition[1:])
            elif condition.startswith('<'):
                op = '<'
                value = int(condition[1:])
            elif condition.startswith('='):
                op = '='
                value = int(condition[1:])
            else:
                raise ValueError("Invalid condition format")
            
            requirements.append((stat_id, op, value))
    except (ValueError, IndexError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid stat_requirements format: {e}")
    
    # Build base query
    query = db.query(Item).distinct()
    
    # Apply stat filters
    for i, (stat_id, op, value) in enumerate(requirements):
        # Create alias for each stat join to avoid conflicts
        stat_alias = f"sv_{i}"
        item_stats_alias = f"ist_{i}"
        
        if logic == "and" or len(requirements) == 1:
            # JOIN for AND logic - item must have ALL specified stats
            query = query.join(
                ItemStats, 
                Item.id == ItemStats.item_id
            ).join(
                StatValue,
                ItemStats.stat_value_id == StatValue.id
            ).filter(
                StatValue.stat == stat_id
            )
            
            # Apply condition
            if op == '>=':
                query = query.filter(StatValue.value >= value)
            elif op == '<=':
                query = query.filter(StatValue.value <= value)
            elif op == '>':
                query = query.filter(StatValue.value > value)
            elif op == '<':
                query = query.filter(StatValue.value < value)
            elif op == '=':
                query = query.filter(StatValue.value == value)
        else:
            # OR logic is more complex - need subqueries
            if i == 0:
                # First condition starts the OR chain
                subquery = db.query(Item.id).join(ItemStats).join(StatValue).filter(
                    StatValue.stat == stat_id
                )
                if op == '>=':
                    subquery = subquery.filter(StatValue.value >= value)
                elif op == '<=':
                    subquery = subquery.filter(StatValue.value <= value)
                elif op == '>':
                    subquery = subquery.filter(StatValue.value > value)
                elif op == '<':
                    subquery = subquery.filter(StatValue.value < value)
                elif op == '=':
                    subquery = subquery.filter(StatValue.value == value)
                
                item_ids = [row[0] for row in subquery.all()]
            else:
                # Additional conditions add to the OR chain
                subquery = db.query(Item.id).join(ItemStats).join(StatValue).filter(
                    StatValue.stat == stat_id
                )
                if op == '>=':
                    subquery = subquery.filter(StatValue.value >= value)
                elif op == '<=':
                    subquery = subquery.filter(StatValue.value <= value)
                elif op == '>':
                    subquery = subquery.filter(StatValue.value > value)
                elif op == '<':
                    subquery = subquery.filter(StatValue.value < value)
                elif op == '=':
                    subquery = subquery.filter(StatValue.value == value)
                
                additional_ids = [row[0] for row in subquery.all()]
                item_ids.extend(additional_ids)
    
    if logic == "or" and len(requirements) > 1:
        # Filter items by collected IDs for OR logic
        query = db.query(Item).filter(Item.id.in_(set(item_ids)))
    
    # Apply additional filters
    if item_class:
        query = query.filter(Item.item_class == item_class)
    if min_ql is not None:
        query = query.filter(Item.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Item.ql <= max_ql)
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Complex stat query requirements='{stat_requirements}' logic='{logic}' results={total} time={query_time:.3f}s")
    
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
@cached_response("item_detail")
@performance_monitor
def get_item(item_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific item including stats, spells, and attack/defense data.
    """
    # Load item with all related data
    item = db.query(Item).options(
        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
        joinedload(Item.item_spell_data)
    ).filter(Item.id == item_id).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Build detailed response
    item_detail = ItemDetail(
        id=item.id,
        aoid=item.aoid,
        name=item.name,
        ql=item.ql,
        item_class=item.item_class,
        description=item.description,
        is_nano=item.is_nano,
        stats=[stat.stat_value for stat in item.item_stats] if item.item_stats else [],
        attack_stats=[],
        defense_stats=[],
        spells=[]
    )
    
    # Add attack/defense stats if available
    if hasattr(item, 'attack_defense_id') and item.attack_defense_id:
        # Get attack stats
        attack_stats = db.query(StatValue).join(
            AttackDefenseAttack, StatValue.id == AttackDefenseAttack.stat_value_id
        ).filter(AttackDefenseAttack.attack_defense_id == item.attack_defense_id).all()
        item_detail.attack_stats = attack_stats
        
        # Get defense stats  
        defense_stats = db.query(StatValue).join(
            AttackDefenseDefense, StatValue.id == AttackDefenseDefense.stat_value_id
        ).filter(AttackDefenseDefense.attack_defense_id == item.attack_defense_id).all()
        item_detail.defense_stats = defense_stats
    
    return item_detail