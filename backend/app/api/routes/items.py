"""
Items API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, Integer, text
import math
import time
import logging

from app.core.database import get_db
from app.models import (
    Item, ItemStats, StatValue, AttackDefense, AttackDefenseAttack, AttackDefenseDefense, 
    ItemSpellData, SpellData, Action, ActionCriteria, Criterion, Spell, SpellCriterion,
    SpellDataSpells, Source, SourceType, ItemSource
)
from app.models.interpolated_item import InterpolatedItem, InterpolationRequest, InterpolationResponse
from app.services.interpolation import InterpolationService
from app.api.schemas import (
    ItemResponse, 
    ItemDetail, 
    ItemSearch,
    SpellDataResponse,
    SpellWithCriteria,
    ActionResponse,
    CriterionResponse,
    StatValueResponse,
    SourceResponse,
    SourceTypeResponse,
    ItemSourceResponse,
    PaginatedResponse
)
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/items", tags=["items"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


def apply_stat_filters(query, stat_filters: str, db: Session):
    """
    Apply stat filters to the query.
    Format: 'function:stat:operator:value' separated by commas
    Example: 'requires:16:>=:500,modifies:124:>=:20'
    """
    if not stat_filters:
        return query
    
    try:
        filters = []
        for filter_str in stat_filters.split(','):
            parts = filter_str.strip().split(':')
            if len(parts) != 4:
                logger.warning(f"Invalid stat filter format: {filter_str}")
                continue
            
            function, stat_str, operator, value_str = parts
            
            # Validate function
            if function not in ['requires', 'modifies']:
                logger.warning(f"Invalid stat filter function: {function}")
                continue
            
            # Validate operator
            if operator not in ['==', '<=', '>=', '!=']:
                logger.warning(f"Invalid stat filter operator: {operator}")
                continue
            
            try:
                stat_id = int(stat_str)
                value = int(value_str)
            except ValueError:
                logger.warning(f"Invalid stat ID or value in filter: {filter_str}")
                continue
            
            filters.append((function, stat_id, operator, value))
        
        if not filters:
            return query
        
        # Apply each filter
        for function, stat_id, operator, value in filters:
            if function == 'requires':
                # Look for requirement criteria in actions
                subquery = db.query(Item.id.distinct())\
                    .join(Action, Item.id == Action.item_id)\
                    .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                    .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                    .filter(Criterion.value1 == stat_id)
                
                # Apply operator to the requirement value
                if operator == '>=':
                    subquery = subquery.filter(Criterion.value2 >= value)
                elif operator == '<=':
                    subquery = subquery.filter(Criterion.value2 <= value)
                elif operator == '==':
                    subquery = subquery.filter(Criterion.value2 == value)
                elif operator == '!=':
                    subquery = subquery.filter(Criterion.value2 != value)
                
                query = query.filter(Item.id.in_(subquery))
                
            elif function == 'modifies':
                # Look for stat modification spells
                # Most stat modifications use spell_id 53045 (Modify Stat)
                subquery = db.query(Item.id.distinct())\
                    .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                    .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
                    .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
                    .join(Spell, SpellDataSpells.spell_id == Spell.id)\
                    .filter(Spell.spell_id == 53045)\
                    .filter(func.cast(Spell.spell_params.op('->>')(text("'Stat'")), Integer) == stat_id)
                
                # Apply operator to the modification value
                if operator == '>=':
                    subquery = subquery.filter(func.cast(Spell.spell_params.op('->>')(text("'Amount'")), Integer) >= value)
                elif operator == '<=':
                    subquery = subquery.filter(func.cast(Spell.spell_params.op('->>')(text("'Amount'")), Integer) <= value)
                elif operator == '==':
                    subquery = subquery.filter(func.cast(Spell.spell_params.op('->>')(text("'Amount'")), Integer) == value)
                elif operator == '!=':
                    subquery = subquery.filter(func.cast(Spell.spell_params.op('->>')(text("'Amount'")), Integer) != value)
                
                query = query.filter(Item.id.in_(subquery))
        
        # Use distinct to avoid duplicates from joins
        query = query.distinct()
        
    except Exception as e:
        logger.error(f"Error applying stat filters: {e}")
        # Return original query if there's an error parsing filters
        return query
    
    return query


def build_item_detail(item: Item, db: Session) -> ItemDetail:
    """
    Build a complete ItemDetail response with all related data.
    """
    # Get basic stats
    stats = [stat.stat_value for stat in item.item_stats] if item.item_stats else []
    
    # Get spell data with nested spells and criteria
    spell_data_list = []
    for isd in item.item_spell_data:
        spell_data = isd.spell_data
        
        # Get spells for this spell_data
        spells_with_criteria = []
        for sds in spell_data.spell_data_spells:
            spell = sds.spell
            
            # Get criteria for this spell
            criteria = [
                CriterionResponse(
                    id=sc.criterion.id,
                    value1=sc.criterion.value1,
                    value2=sc.criterion.value2,
                    operator=sc.criterion.operator
                )
                for sc in spell.spell_criteria
            ]
            
            spells_with_criteria.append(SpellWithCriteria(
                id=spell.id,
                target=spell.target,
                tick_count=spell.tick_count,
                tick_interval=spell.tick_interval,
                spell_id=spell.spell_id,
                spell_format=spell.spell_format,
                spell_params=spell.spell_params or {},
                criteria=criteria
            ))
        
        spell_data_list.append(SpellDataResponse(
            id=spell_data.id,
            event=spell_data.event,
            spells=spells_with_criteria
        ))
    
    # Get attack/defense stats
    attack_stats = []
    defense_stats = []
    if hasattr(item, 'atkdef_id') and item.atkdef_id:
        # Get attack stats
        attack_stats = db.query(StatValue).join(
            AttackDefenseAttack, StatValue.id == AttackDefenseAttack.stat_value_id
        ).filter(AttackDefenseAttack.attack_defense_id == item.atkdef_id).all()
        
        # Get defense stats  
        defense_stats = db.query(StatValue).join(
            AttackDefenseDefense, StatValue.id == AttackDefenseDefense.stat_value_id
        ).filter(AttackDefenseDefense.attack_defense_id == item.atkdef_id).all()
    
    # Get actions with criteria
    actions = []
    for action in item.actions:
        criteria = [
            CriterionResponse(
                id=ac.criterion.id,
                value1=ac.criterion.value1,
                value2=ac.criterion.value2,
                operator=ac.criterion.operator
            )
            for ac in action.action_criteria
        ]
        
        actions.append(ActionResponse(
            id=action.id,
            action=action.action,
            item_id=action.item_id,
            criteria=criteria
        ))
    
    # Get sources
    sources = []
    for item_source in item.item_sources:
        source = item_source.source
        source_response = SourceResponse(
            id=source.id,
            source_type_id=source.source_type_id,
            source_id=source.source_id,
            name=source.name,
            extra_data=source.extra_data,
            source_type=SourceTypeResponse(
                id=source.source_type.id,
                name=source.source_type.name,
                description=source.source_type.description
            ) if source.source_type else None
        )
        
        sources.append(ItemSourceResponse(
            source=source_response,
            drop_rate=float(item_source.drop_rate) if item_source.drop_rate else None,
            min_ql=item_source.min_ql,
            max_ql=item_source.max_ql,
            conditions=item_source.conditions,
            extra_data=item_source.extra_data
        ))
    
    # Convert stats to StatValueResponse objects
    stats_response = [
        StatValueResponse(id=stat.id, stat=stat.stat, value=stat.value)
        for stat in stats
    ]
    attack_stats_response = [
        StatValueResponse(id=stat.id, stat=stat.stat, value=stat.value)
        for stat in attack_stats
    ]
    defense_stats_response = [
        StatValueResponse(id=stat.id, stat=stat.stat, value=stat.value)
        for stat in defense_stats
    ]
    
    return ItemDetail(
        id=item.id,
        aoid=item.aoid,
        name=item.name,
        ql=item.ql,
        item_class=item.item_class,
        description=item.description,
        is_nano=item.is_nano,
        stats=stats_response,
        spell_data=spell_data_list,
        attack_stats=attack_stats_response,
        defense_stats=defense_stats_response,
        actions=actions,
        sources=sources
    )


@router.get("", response_model=PaginatedResponse[ItemDetail])
def get_items(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    item_class: Optional[int] = Query(None, description="Filter by item class"),
    min_ql: Optional[int] = Query(None, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, description="Maximum quality level"),
    is_nano: Optional[bool] = Query(None, description="Filter nano programs"),
    # Add new advanced filter parameters
    slot: Optional[int] = Query(None, description="Filter by equipment slot (stat 298)"),
    profession: Optional[int] = Query(None, description="Filter by profession requirement"),
    breed: Optional[int] = Query(None, description="Filter by breed requirement"),
    gender: Optional[int] = Query(None, description="Filter by gender requirement"),
    faction: Optional[int] = Query(None, description="Filter by faction requirement"),
    froob_friendly: Optional[bool] = Query(None, description="Filter items without expansion requirements"),
    nodrop: Optional[bool] = Query(None, description="Filter items with NODROP flag"),
    stat_bonuses: Optional[str] = Query(None, description="Comma-separated list of stat IDs to check for bonuses"),
    stat_filters: Optional[str] = Query(None, description="Stat filters in format 'function:stat:operator:value' separated by commas"),
    strain: Optional[int] = Query(None, description="Filter by nano strain (stat 75)"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of items with optional filters and complete item details.
    """
    # Standard data loading for all items
    query = db.query(Item).options(
        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
        joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
        joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
    )
    
    # Apply filters
    # NOTE: item_class is NOT used for nano filtering - use is_nano=true instead
    if item_class:
        query = query.filter(Item.item_class == item_class)
    if min_ql is not None:
        query = query.filter(Item.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Item.ql <= max_ql)
    if is_nano is not None:
        query = query.filter(Item.is_nano == is_nano)
    
    # Apply advanced search filters
    # Equipment slot filter (stat 298 - EquippedIn)
    if slot is not None and slot > 0:
        # Join with stats to check EquippedIn (stat 298) bit flags
        query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                    .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                    .filter(StatValue.stat == 298, StatValue.value.op('&')(1 << slot) > 0)
    
    # Requirement filters - join with criteria via spell data
    requirement_filters = []
    if breed is not None and breed > 0:
        requirement_filters.append((4, breed))       # Stat 4 = Breed
    if gender is not None and gender > 0:
        requirement_filters.append((59, gender))     # Stat 59 = Gender
    if faction is not None and faction > 0:
        requirement_filters.append((33, faction))    # Stat 33 = Faction
    
    # Apply non-profession requirement filters first
    for stat_id, required_value in requirement_filters:
        query = query.join(Action, Item.id == Action.item_id)\
                    .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                    .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                    .filter(Criterion.value1 == stat_id, Criterion.value2 == required_value)
    
    # Handle profession filtering: Both Profession (stat 60) and VisualProfession (stat 368) are valid
    if profession is not None and profession > 0:
        query = query.join(Action, Item.id == Action.item_id)\
                     .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                     .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                     .filter(Action.action == 3)\
                     .filter(or_(
                         and_(Criterion.value1 == 60, Criterion.value2 == profession),
                         and_(Criterion.value1 == 368, Criterion.value2 == profession)
                     ))
    
    # Froob friendly filter (exclude items with expansion requirements)
    if froob_friendly is True:
        # Exclude items that have stat 389 (Expansion) requirements in stats
        stats_subquery = db.query(Item.id).join(ItemStats, Item.id == ItemStats.item_id)\
                         .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                         .filter(StatValue.stat == 389).subquery()
        
        # Exclude items that have stat 389 (Expansion) requirements in action criteria
        criteria_subquery = db.query(Item.id)\
                           .join(Action, Item.id == Action.item_id)\
                           .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                           .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                           .filter(Criterion.value1 == 389).subquery()
        
        query = query.filter(~Item.id.in_(stats_subquery), ~Item.id.in_(criteria_subquery))
    
    # NoDrop filter (stat 0 - ITEM_NONE_FLAG)
    if nodrop is not None:
        if nodrop:
            # Items WITH NODROP flag (bit 14 = 16384)
            query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                        .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                        .filter(StatValue.stat == 0, StatValue.value.op('&')(16384) > 0)
        else:
            # Items WITHOUT NODROP flag
            subquery = db.query(Item.id).join(ItemStats, Item.id == ItemStats.item_id)\
                         .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                         .filter(StatValue.stat == 0, StatValue.value.op('&')(16384) > 0).subquery()
            query = query.filter(~Item.id.in_(subquery))
    
    # Stat bonus filters - look for stat modification spells (spell_id 53045)
    if stat_bonuses:
        try:
            bonus_stat_ids = [int(stat_id.strip()) for stat_id in stat_bonuses.split(',') if stat_id.strip()]
            if bonus_stat_ids:
                # Find items that have "Modify Stat" spells (spell_id 53045) which modify any of the requested stats
                # The stat ID is stored in the spell_params JSON as the "Stat" field
                stat_bonus_subquery = db.query(Item.id.distinct())\
                    .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                    .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
                    .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
                    .join(Spell, SpellDataSpells.spell_id == Spell.id)\
                    .filter(Spell.spell_id == 53045)\
                    .filter(func.cast(Spell.spell_params.op('->>')(text("'Stat'")), Integer).in_(bonus_stat_ids))
                
                query = query.filter(Item.id.in_(stat_bonus_subquery))
        except ValueError:
            logger.warning(f"Invalid stat_bonuses parameter: {stat_bonuses}")
    
    # Apply stat filters
    query = apply_stat_filters(query, stat_filters, db)
    
    # Strain filter (stat 75 - NanoStrain)
    if strain is not None and strain > 0:
        query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                    .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                    .filter(StatValue.stat == 75, StatValue.value == strain)
    
    # If we have any joins that might cause duplicates, make sure to use distinct
    if any([slot, requirement_filters, nodrop is not None, stat_filters, strain is not None]):
        query = query.distinct()
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size)
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    # Build detailed response items
    detailed_items = [build_item_detail(item, db) for item in items]
    
    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/search", response_model=PaginatedResponse[ItemDetail])
def search_items(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    exact_match: bool = Query(True, description="Use exact matching (default) vs fuzzy/stemmed search"),
    weapons: bool = Query(False, description="Filter to weapons only (items with both attack and defense data)"),
    search_fields: Optional[str] = Query(None, description="Comma-separated list of fields to search: name,description,effects,stats"),
    # New advanced search parameters
    min_ql: Optional[int] = Query(None, ge=1, le=999, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, ge=1, le=999, description="Maximum quality level"),
    item_class: Optional[int] = Query(None, description="Filter by item class (stat 76)"),
    slot: Optional[int] = Query(None, description="Filter by equipment slot (stat 298)"),
    profession: Optional[int] = Query(None, description="Filter by profession requirement"),
    breed: Optional[int] = Query(None, description="Filter by breed requirement"),
    gender: Optional[int] = Query(None, description="Filter by gender requirement"),
    faction: Optional[int] = Query(None, description="Filter by faction requirement"),
    froob_friendly: Optional[bool] = Query(None, description="Filter items without expansion requirements"),
    nodrop: Optional[bool] = Query(None, description="Filter items with NODROP flag"),
    stat_bonuses: Optional[str] = Query(None, description="Comma-separated list of stat IDs to check for bonuses"),
    stat_filters: Optional[str] = Query(None, description="Stat filters in format 'function:stat:operator:value' separated by commas"),
    strain: Optional[int] = Query(None, description="Filter by nano strain (stat 75)"),
    db: Session = Depends(get_db)
):
    """
    Search items by name or description using exact matching (default) or fuzzy/stemmed search.
    Returns complete item details including stats, spells, and attack/defense data.
    """
    start_time = time.time()
    
    # Parse search fields
    fields_to_search = ['name', 'description']  # Default fields
    if search_fields:
        requested_fields = [f.strip().lower() for f in search_fields.split(',')]
        valid_fields = {'name', 'description', 'effects', 'stats'}
        fields_to_search = [f for f in requested_fields if f in valid_fields]
        if not fields_to_search:  # Fallback if no valid fields provided
            fields_to_search = ['name', 'description']
    
    # Log search parameters for debugging
    logger.info(f"Search query='{q}' search_fields='{search_fields}' parsed_fields={fields_to_search} exact_match={exact_match}")
    
    if exact_match:
        # Use ILIKE for exact word matching (default behavior)
        search_term = f"%{q}%"
        
        # Build search conditions based on requested fields
        search_conditions = []
        
        # Explicitly check each field and log what we're searching
        if 'name' in fields_to_search:
            name_condition = Item.name.ilike(search_term)
            search_conditions.append(name_condition)
            logger.info(f"Added name search condition: name ILIKE '{search_term}'")
            
        if 'description' in fields_to_search:
            desc_condition = Item.description.ilike(search_term)
            search_conditions.append(desc_condition)
            logger.info(f"Added description search condition: description ILIKE '{search_term}'")
            
        # Note: 'effects' and 'stats' would require more complex joins and are not implemented yet
        
        # Validate we have search conditions - this should never be empty with current logic
        if not search_conditions:
            logger.error(f"No search conditions built for fields {fields_to_search}! This should not happen.")
            # Fallback to searching name only
            search_conditions.append(Item.name.ilike(search_term))
        
        logger.info(f"Final query: searching {len(search_conditions)} field(s) for term '{q}' in fields {fields_to_search}")
        
        # Build the query with explicit OR conditions - load all relationships needed
        query = db.query(Item).options(
            joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
            joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
            joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
            joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
        )
        
        # Apply the search filter
        if len(search_conditions) == 1:
            # Single condition - no need for OR
            query = query.filter(search_conditions[0])
        else:
            # Multiple conditions - use OR
            query = query.filter(or_(*search_conditions))
            
        query = query.order_by(Item.name)
        
        # Apply weapons filter to exact search if requested
        if weapons:
            query = query.filter(Item.atkdef_id.isnot(None))\
                        .join(AttackDefense, Item.atkdef_id == AttackDefense.id)\
                        .join(AttackDefenseAttack, AttackDefense.id == AttackDefenseAttack.attack_defense_id)\
                        .join(AttackDefenseDefense, AttackDefense.id == AttackDefenseDefense.attack_defense_id)\
                        .distinct()
    else:
        # Use PostgreSQL full-text search for fuzzy/stemmed matching
        search_query = q.replace(' ', ' & ')  # Convert spaces to AND operators
        
        # Build full-text search expression based on requested fields
        search_expression_parts = []
        if 'name' in fields_to_search:
            search_expression_parts.append(Item.name)
        if 'description' in fields_to_search:
            search_expression_parts.append(func.coalesce(Item.description, ''))
        
        # If no valid parts, default to name + description
        if not search_expression_parts:
            search_expression = Item.name + ' ' + func.coalesce(Item.description, '')
        elif len(search_expression_parts) == 1:
            search_expression = search_expression_parts[0]
        else:
            # Concatenate multiple fields with spaces
            search_expression = search_expression_parts[0]
            for part in search_expression_parts[1:]:
                search_expression = search_expression + ' ' + part
        
        # Full-text search with ranking - load all relationships needed
        query = db.query(Item).options(
            joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
            joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
            joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
            joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
        ).filter(
            func.to_tsvector('english', search_expression).op('@@')(
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
                    func.to_tsvector('english', search_expression),
                    func.to_tsquery('english', search_query)
                ).desc()
            )
    
    # Apply advanced search filters
    # Quality level filters
    if min_ql is not None:
        query = query.filter(Item.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Item.ql <= max_ql)
    
    # Item class filter
    if item_class is not None and item_class > 0:
        # Filter by stat 76 (ItemClass)
        query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                    .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                    .filter(StatValue.stat == 76, StatValue.value == item_class)
    
    # Equipment slot filter (stat 298 - EquippedIn)
    if slot is not None and slot > 0:
        # Join with stats to check EquippedIn (stat 298) bit flags
        query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                    .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                    .filter(StatValue.stat == 298, StatValue.value.op('&')(1 << slot) > 0)
    
    # Requirement filters - join with criteria via spell data
    requirement_filters = []
    if breed is not None and breed > 0:
        requirement_filters.append((4, breed))       # Stat 4 = Breed
    if gender is not None and gender > 0:
        requirement_filters.append((59, gender))     # Stat 59 = Gender
    if faction is not None and faction > 0:
        requirement_filters.append((33, faction))    # Stat 33 = Faction
    
    # Apply non-profession requirement filters first
    for stat_id, required_value in requirement_filters:
        query = query.join(Action, Item.id == Action.item_id)\
                    .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                    .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                    .filter(Criterion.value1 == stat_id, Criterion.value2 == required_value)
    
    # Handle profession filtering: Both Profession (stat 60) and VisualProfession (stat 368) are valid
    if profession is not None and profession > 0:
        query = query.join(Action, Item.id == Action.item_id)\
                     .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                     .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                     .filter(Action.action == 3)\
                     .filter(or_(
                         and_(Criterion.value1 == 60, Criterion.value2 == profession),
                         and_(Criterion.value1 == 368, Criterion.value2 == profession)
                     ))
    
    # Froob friendly filter (exclude items with expansion requirements)
    if froob_friendly is True:
        # Exclude items that have stat 389 (Expansion) requirements in stats
        stats_subquery = db.query(Item.id).join(ItemStats, Item.id == ItemStats.item_id)\
                         .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                         .filter(StatValue.stat == 389).subquery()
        
        # Exclude items that have stat 389 (Expansion) requirements in action criteria
        criteria_subquery = db.query(Item.id)\
                           .join(Action, Item.id == Action.item_id)\
                           .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                           .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                           .filter(Criterion.value1 == 389).subquery()
        
        query = query.filter(~Item.id.in_(stats_subquery), ~Item.id.in_(criteria_subquery))
    
    # NoDrop filter (stat 0 - ITEM_NONE_FLAG)
    if nodrop is not None:
        if nodrop:
            # Items WITH NODROP flag (bit 14 = 16384)
            query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                        .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                        .filter(StatValue.stat == 0, StatValue.value.op('&')(16384) > 0)
        else:
            # Items WITHOUT NODROP flag
            subquery = db.query(Item.id).join(ItemStats, Item.id == ItemStats.item_id)\
                         .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                         .filter(StatValue.stat == 0, StatValue.value.op('&')(16384) > 0).subquery()
            query = query.filter(~Item.id.in_(subquery))
    
    # Stat bonus filters - look for stat modification spells (spell_id 53045)
    if stat_bonuses:
        try:
            bonus_stat_ids = [int(stat_id.strip()) for stat_id in stat_bonuses.split(',') if stat_id.strip()]
            if bonus_stat_ids:
                # Find items that have "Modify Stat" spells (spell_id 53045) which modify any of the requested stats
                # The stat ID is stored in the spell_params JSON as the "Stat" field
                stat_bonus_subquery = db.query(Item.id.distinct())\
                    .join(ItemSpellData, Item.id == ItemSpellData.item_id)\
                    .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)\
                    .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)\
                    .join(Spell, SpellDataSpells.spell_id == Spell.id)\
                    .filter(Spell.spell_id == 53045)\
                    .filter(func.cast(Spell.spell_params.op('->>')(text("'Stat'")), Integer).in_(bonus_stat_ids))
                
                query = query.filter(Item.id.in_(stat_bonus_subquery))
        except ValueError:
            logger.warning(f"Invalid stat_bonuses parameter: {stat_bonuses}")
    
    # Apply stat filters
    query = apply_stat_filters(query, stat_filters, db)
    
    # Strain filter (stat 75 - NanoStrain)
    if strain is not None and strain > 0:
        query = query.join(ItemStats, Item.id == ItemStats.item_id)\
                    .join(StatValue, ItemStats.stat_value_id == StatValue.id)\
                    .filter(StatValue.stat == 75, StatValue.value == strain)
    
    # If we have any joins that might cause duplicates, make sure to use distinct
    if any([item_class, slot, requirement_filters, nodrop is not None, stat_filters, strain is not None]):
        query = query.distinct()
    
    # Get total count
    total = query.count()
    
    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    
    # Get items for current page
    items = query.offset(offset).limit(page_size).all()
    
    # Build detailed response items using the same function as get_items
    detailed_items = [build_item_detail(item, db) for item in items]
    
    # Log performance metrics
    query_time = time.time() - start_time
    search_method = 'exact_ilike' if exact_match else 'fuzzy_fulltext'
    logger.info(f"Item search query='{q}' results={total} time={query_time:.3f}s method={search_method}")
    
    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )



@router.get("/filter", response_model=PaginatedResponse[ItemDetail])
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
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    
    # Sorting
    sort_by: str = Query("name", description="Sort by: name, ql, item_class"),
    sort_order: str = Query("asc", description="Sort order: asc, desc"),
    
    db: Session = Depends(get_db)
):
    """
    Advanced filtering for items with multiple criteria and sorting options.
    """
    start_time = time.time()
    
    query = db.query(Item).options(
        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
        joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
        joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
    )
    
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
    
    # Build detailed response items using the same function as get_items
    detailed_items = [build_item_detail(item, db) for item in items]
    
    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Item filter results={total} time={query_time:.3f}s filters=class:{item_class},ql:{min_ql}-{max_ql},nano:{is_nano}")
    
    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/with-stats", response_model=PaginatedResponse[ItemDetail])
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
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    
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


@router.get("/{aoid}", response_model=ItemDetail)
@cached_response("item_detail")
@performance_monitor
def get_item(aoid: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific item including stats, spells, attack/defense data, and sources.
    
    Returns:
        ItemDetail: Complete item information including:
        - Basic item data (name, QL, description, etc.)
        - Item stats and modifiers
        - Spell data and criteria
        - Attack/defense statistics
        - Sources (crystals for nanos, NPCs/missions for other items)
    """
    # Load item with all related data
    item = db.query(Item).options(
        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data).joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell).joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
        joinedload(Item.actions).joinedload(Action.action_criteria).joinedload(ActionCriteria.criterion),
        joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
    ).filter(Item.aoid == aoid).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return build_item_detail(item, db)


@router.get("/{aoid}/sources", response_model=List[ItemSourceResponse])
@cached_response("item_sources")
@performance_monitor
def get_item_sources(aoid: int, db: Session = Depends(get_db)):
    """
    Get all sources for a specific item.
    
    Args:
        aoid: Anarchy Online item ID
        
    Returns:
        List[ItemSourceResponse]: All sources for the item including:
        - Source information (name, type, metadata)
        - Drop rates and QL ranges
        - Special conditions or requirements
        
    Example:
        For nano programs: Returns nanocrystals that upload the nano
        For weapons: Returns NPCs/bosses that drop the weapon (future)
        For mission rewards: Returns missions that award the item (future)
    """
    item = db.query(Item).options(
        joinedload(Item.item_sources).joinedload(ItemSource.source).joinedload(Source.source_type)
    ).filter(Item.aoid == aoid).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    sources = []
    for item_source in item.item_sources:
        source = item_source.source
        source_response = SourceResponse(
            id=source.id,
            source_type_id=source.source_type_id,
            source_id=source.source_id,
            name=source.name,
            extra_data=source.extra_data,
            source_type=SourceTypeResponse(
                id=source.source_type.id,
                name=source.source_type.name,
                description=source.source_type.description
            ) if source.source_type else None
        )
        
        sources.append(ItemSourceResponse(
            source=source_response,
            drop_rate=float(item_source.drop_rate) if item_source.drop_rate else None,
            min_ql=item_source.min_ql,
            max_ql=item_source.max_ql,
            conditions=item_source.conditions,
            extra_data=item_source.extra_data
        ))
    
    return sources


@router.get("/{aoid}/interpolate", response_model=InterpolationResponse)
@performance_monitor
def interpolate_item(
    aoid: int,
    target_ql: int = Query(..., ge=1, le=500, description="Target quality level for interpolation"),
    db: Session = Depends(get_db)
):
    """
    Interpolate an item to a specific quality level.
    
    Returns an interpolated item with stats, spells, and criteria calculated
    for the target QL based on the item's variants at different quality levels.
    """
    start_time = time.time()
    
    try:
        # Create interpolation service
        interpolation_service = InterpolationService(db)
        
        # Perform interpolation
        interpolated_item = interpolation_service.interpolate_item(aoid, target_ql)
        
        if not interpolated_item:
            raise HTTPException(status_code=404, detail=f"Item with AOID {aoid} not found")
        
        # Get interpolation range for metadata
        interpolation_range = interpolation_service.get_interpolation_range(aoid)
        range_dict = None
        if interpolation_range:
            range_dict = {"min_ql": interpolation_range[0], "max_ql": interpolation_range[1]}
        
        # Log performance metrics
        query_time = time.time() - start_time
        logger.info(f"Item interpolation aoid={aoid} target_ql={target_ql} interpolating={interpolated_item.interpolating} time={query_time:.3f}s")
        
        return InterpolationResponse(
            success=True,
            item=interpolated_item,
            interpolation_range=range_dict
        )
        
    except Exception as e:
        logger.error(f"Interpolation failed for aoid={aoid} target_ql={target_ql}: {str(e)}")
        return InterpolationResponse(
            success=False,
            error=f"Failed to interpolate item: {str(e)}"
        )


@router.get("/{aoid}/interpolation-info")
@performance_monitor
def get_interpolation_info(aoid: int, db: Session = Depends(get_db)):
    """
    Get interpolation information for an item.
    
    Returns whether the item can be interpolated and its quality level ranges.
    """
    try:
        interpolation_service = InterpolationService(db)
        
        # Get interpolation ranges
        interpolation_ranges = interpolation_service.get_interpolation_ranges(aoid)
        
        if interpolation_ranges is None:
            raise HTTPException(status_code=404, detail=f"Item with AOID {aoid} not found")
        
        # Check if any range is interpolatable
        is_interpolatable = any(r["interpolatable"] for r in interpolation_ranges)
        
        # Calculate overall min/max for backward compatibility
        overall_min = interpolation_ranges[0]["min_ql"]
        overall_max = interpolation_ranges[-1]["max_ql"]
        
        return {
            "aoid": aoid,
            "interpolatable": is_interpolatable,
            "ranges": interpolation_ranges,
            "min_ql": overall_min,
            "max_ql": overall_max,
            "ql_range": overall_max - overall_min + 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get interpolation info for aoid={aoid}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get interpolation info: {str(e)}")


@router.post("/interpolate", response_model=InterpolationResponse)
@performance_monitor
def interpolate_item_by_request(
    request: InterpolationRequest,
    db: Session = Depends(get_db)
):
    """
    Interpolate an item using a request body.
    
    Alternative endpoint that accepts JSON request body instead of query parameters.
    Useful for more complex interpolation requests in the future.
    """
    start_time = time.time()
    
    try:
        interpolation_service = InterpolationService(db)
        interpolated_item = interpolation_service.interpolate_item(request.aoid, request.target_ql)
        
        if not interpolated_item:
            raise HTTPException(status_code=404, detail=f"Item with AOID {request.aoid} not found")
        
        interpolation_range = interpolation_service.get_interpolation_range(request.aoid)
        range_dict = None
        if interpolation_range:
            range_dict = {"min_ql": interpolation_range[0], "max_ql": interpolation_range[1]}
        
        query_time = time.time() - start_time
        logger.info(f"Item interpolation (POST) aoid={request.aoid} target_ql={request.target_ql} time={query_time:.3f}s")
        
        return InterpolationResponse(
            success=True,
            item=interpolated_item,
            interpolation_range=range_dict
        )
        
    except Exception as e:
        logger.error(f"Interpolation (POST) failed for aoid={request.aoid} target_ql={request.target_ql}: {str(e)}")
        return InterpolationResponse(
            success=False,
            error=f"Failed to interpolate item: {str(e)}"
        )