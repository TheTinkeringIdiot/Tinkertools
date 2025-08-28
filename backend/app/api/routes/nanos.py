"""
Nano programs API endpoints with rich spell data.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, desc, asc
import math
import logging

from app.core.database import get_db
from app.models import (
    Item, ItemStats, StatValue, ItemSpellData, SpellData, SpellDataSpells, Spell, SpellCriterion, Criterion,
    Action, ActionCriteria, Source, SourceType, ItemSource
)
from app.api.schemas import PaginatedResponse, ItemDetail
from app.api.schemas.nano import (
    NanoProgram,
    NanoProgramWithSpells, 
    NanoSearchRequest,
    NanoStatsResponse,
    CastingRequirement,
    NanoEffect,
    NanoDuration,
    NanoTargeting
)
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/nanos", tags=["nanos"])
logger = logging.getLogger(__name__)

# Mapping from criterion values to readable skill names
# NOTE: These are Anarchy Online skill IDs, not nano school IDs
SKILL_MAPPING = {
    17: "Matter Metamorphosis",
    118: "Biological Metamorphosis", 
    122: "Psychological Modifications",
    130: "Matter Creation",
    144: "Time and Space",
    151: "Sensory Improvement",
    157: "Nano Programming",
    # TODO: Add complete skill mapping when available
}

STAT_MAPPING = {
    16: "Strength",
    17: "Stamina", 
    18: "Agility",
    19: "Sense",
    20: "Intelligence",
    21: "Psychic",
    # Add more stat mappings as needed
}

# Profession mapping (if available in data)
PROFESSION_MAPPING = {
    # These would need to be determined from actual data
    1: "Soldier",
    2: "Martial Artist", 
    3: "Engineer",
    4: "Fixers",
    5: "Agent",
    6: "Adventurer",
    7: "Trader",
    8: "Bureaucrat",
    9: "Enforcer",
    10: "Doctor",
    11: "Nano-Technician",
    12: "Meta-Physicist",
    # Add more as needed
}


def parse_nano_from_item_and_spells(item: Item) -> NanoProgram:
    """
    Convert an Item with spell data into a rich NanoProgram object.
    """
    nano_data = {
        "id": item.id,
        "aoid": item.aoid,
        "name": item.name,
        "ql": item.ql,
        "description": item.description,
        "casting_requirements": [],
        "effects": [],
        "school": None,
        "strain": None,
        "profession": None,
        "level": None,
        "casting_time": None,
        "recharge_time": None,
        "memory_usage": None,
        "nano_point_cost": None,
        "duration": None,
        "targeting": None,
        "source_location": None,
        "acquisition_method": None
    }
    
    # Extract data from associated spells
    for spell_data in item.spell_data:
        for spell in spell_data.spells:
            # Extract casting requirements from criteria
            for criterion in spell.criteria:
                req_type = "unknown"
                req_name = "Unknown"
                
                # Determine if this is a skill, stat, or level requirement
                if criterion.value1 in SKILL_MAPPING:
                    req_type = "skill"
                    req_name = SKILL_MAPPING[criterion.value1]
                elif criterion.value1 in STAT_MAPPING:
                    req_type = "stat" 
                    req_name = STAT_MAPPING[criterion.value1]
                elif criterion.value1 == 54:  # Common level requirement ID
                    req_type = "level"
                    req_name = "level"
                
                if req_type != "unknown":
                    nano_data["casting_requirements"].append(
                        CastingRequirement(
                            type=req_type,
                            requirement=req_name,
                            value=criterion.value2,
                            critical=True
                        )
                    )
            
            # Extract basic spell properties
            if spell.tick_count and not nano_data["casting_time"]:
                nano_data["casting_time"] = spell.tick_count
            if spell.tick_interval and not nano_data["recharge_time"]:
                nano_data["recharge_time"] = spell.tick_interval
    
    # TODO: Extract actual nano school from spell data
    # Nano schools are integers that need proper mapping
    # For now, leave school as None until we get the proper school integer->name mapping
    nano_data["school"] = None
    
    # Extract strain from name patterns (many AO nanos have strain in name)
    if " - " in item.name:
        parts = item.name.split(" - ")
        if len(parts) > 1:
            nano_data["strain"] = parts[-1].strip()
    
    return NanoProgram(**nano_data)


@router.get("", response_model=PaginatedResponse[NanoProgram])
@cached_response("nanos_list")
@performance_monitor
def get_nanos(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    school: Optional[str] = Query(None, description="Filter by school"),
    strain: Optional[str] = Query(None, description="Filter by strain"),
    profession: Optional[str] = Query(None, description="Filter by profession"),
    level_min: Optional[int] = Query(None, description="Minimum level"),
    level_max: Optional[int] = Query(None, description="Maximum level"),
    ql_min: Optional[int] = Query(None, description="Minimum quality level"),
    ql_max: Optional[int] = Query(None, description="Maximum quality level"),
    sort_by: str = Query("name", description="Sort by: name, ql, level"),
    sort_desc: bool = Query(False, description="Sort descending"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of nano programs with rich spell data.
    """
    # Query nano items with their spell data
    query = db.query(Item).filter(Item.is_nano == True).options(
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
        .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
        .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    )
    
    # Apply basic filters
    if ql_min is not None:
        query = query.filter(Item.ql >= ql_min)
    if ql_max is not None:
        query = query.filter(Item.ql <= ql_max)
    
    # Get total count before complex processing
    total = query.count()
    
    # Apply sorting
    if sort_by == "name":
        query = query.order_by(desc(Item.name) if sort_desc else asc(Item.name))
    elif sort_by == "ql":
        query = query.order_by(desc(Item.ql) if sort_desc else asc(Item.ql))
    else:
        query = query.order_by(desc(Item.name) if sort_desc else asc(Item.name))
    
    # Apply pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    # Convert to NanoProgram objects
    nanos = []
    for item in items:
        try:
            nano = parse_nano_from_item_and_spells(item)
            
            # Apply advanced filters after parsing
            if school and nano.school != school:
                continue
            if strain and nano.strain != strain:
                continue
            if profession and nano.profession != profession:
                continue
            if level_min and (nano.level is None or nano.level < level_min):
                continue
            if level_max and (nano.level is None or nano.level > level_max):
                continue
                
            nanos.append(nano)
        except Exception as e:
            logger.warning(f"Failed to parse nano {item.id}: {e}")
            continue
    
    return PaginatedResponse[NanoProgram](
        items=nanos,
        total=len(nanos),  # Note: This is approximate due to filtering after query
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/search", response_model=PaginatedResponse[NanoProgram])
@cached_response("nanos_search")
@performance_monitor
def search_nanos(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Search nano programs by name or description.
    """
    search_term = f"%{q}%"
    query = db.query(Item).filter(
        and_(
            Item.is_nano == True,
            or_(
                Item.name.ilike(search_term),
                Item.description.ilike(search_term)
            )
        )
    ).options(
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
        .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
        .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    )
    
    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    nanos = []
    for item in items:
        try:
            nano = parse_nano_from_item_and_spells(item)
            nanos.append(nano)
        except Exception as e:
            logger.warning(f"Failed to parse nano {item.id} during search: {e}")
            continue
    
    return PaginatedResponse[NanoProgram](
        items=nanos,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/stats", response_model=NanoStatsResponse)
@cached_response("nanos_stats")
@performance_monitor
def get_nano_stats(db: Session = Depends(get_db)):
    """
    Get statistics about available nano programs.
    """
    # Get all nano items
    items = db.query(Item).filter(Item.is_nano == True).options(
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
        .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
        .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    ).all()
    
    schools = set()
    strains = set()
    professions = set()
    levels = []
    quality_levels = []
    
    for item in items:
        try:
            nano = parse_nano_from_item_and_spells(item)
            if nano.school:
                schools.add(nano.school)
            if nano.strain:
                strains.add(nano.strain)
            if nano.profession:
                professions.add(nano.profession)
            if nano.level:
                levels.append(nano.level)
            quality_levels.append(nano.ql)
        except Exception as e:
            logger.warning(f"Failed to parse nano {item.id} for stats: {e}")
            continue
    
    return NanoStatsResponse(
        total_nanos=len(items),
        schools=sorted(list(schools)),
        strains=sorted(list(strains)),
        professions=sorted(list(professions)),
        level_range=[min(levels), max(levels)] if levels else [1, 220],
        quality_level_range=[min(quality_levels), max(quality_levels)] if quality_levels else [1, 300]
    )


@router.get("/{nano_id}", response_model=NanoProgramWithSpells)
@cached_response("nano_detail")
@performance_monitor
def get_nano(nano_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific nano program.
    """
    item = db.query(Item).filter(
        and_(Item.id == nano_id, Item.is_nano == True)
    ).options(
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
        .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
        .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion)
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Nano program not found")
    
    try:
        nano = parse_nano_from_item_and_spells(item)
        
        # Get associated spells and criteria for detailed view
        spells = []
        raw_criteria = []
        
        for spell_data in item.spell_data:
            for spell in spell_data.spells:
                spells.append(spell)
                for criterion in spell.criteria:
                    raw_criteria.append({
                        "value1": criterion.value1,
                        "value2": criterion.value2,
                        "operator": criterion.operator
                    })
        
        return NanoProgramWithSpells(
            **nano.dict(),
            spells=spells,
            raw_criteria=raw_criteria
        )
    except Exception as e:
        logger.error(f"Failed to parse nano {nano_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process nano data")


@router.get("/profession/{profession_id}", response_model=PaginatedResponse[ItemDetail])
@cached_response("nanos_profession")
@performance_monitor
def get_nanos_by_profession(
    profession_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(1000, ge=1, le=1000, description="Items per page"),
    sort: str = Query("ql", description="Sort field: name, ql"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db)
):
    """
    Get nano programs filtered by profession requirement.
    Optimized endpoint specifically for TinkerNanos profession-based filtering.
    """
    # Build base query with all required joins for nano display
    query = db.query(Item).filter(Item.is_nano == True).options(
        joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
            .joinedload(SpellData.spell_data_spells).joinedload(SpellDataSpells.spell)
            .joinedload(Spell.spell_criteria).joinedload(SpellCriterion.criterion),
        joinedload(Item.actions).joinedload(Action.action_criteria)
            .joinedload(ActionCriteria.criterion),
        joinedload(Item.item_sources).joinedload(ItemSource.source)
            .joinedload(Source.source_type)
    )
    
    # Filter by profession requirement (USE action only)
    if profession_id > 0:
        query = query.join(Action, Item.id == Action.item_id)\
                     .join(ActionCriteria, Action.id == ActionCriteria.action_id)\
                     .join(Criterion, ActionCriteria.criterion_id == Criterion.id)\
                     .filter(Action.action == 3)\
                     .filter(or_(
                         and_(Criterion.value1 == 60, Criterion.value2 == profession_id),
                         and_(Criterion.value1 == 368, Criterion.value2 == profession_id)
                     ))
    
    # Apply sorting
    if sort == "name":
        query = query.order_by(desc(Item.name) if sort_order == "desc" else asc(Item.name))
    elif sort == "ql":
        query = query.order_by(desc(Item.ql) if sort_order == "desc" else asc(Item.ql))
    else:
        query = query.order_by(desc(Item.ql) if sort_order == "desc" else asc(Item.ql))
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    # Convert to ItemDetail objects with all necessary data
    detailed_items = []
    for item in items:
        # Skip test items and unwanted strains
        if item.name.startswith('TESTLIVEITEM'):
            continue
            
        strain_stat = next((stat for stat in item.item_stats if stat.stat_value and stat.stat_value.stat == 75), None)
        strain = strain_stat.stat_value.value if strain_stat else 0
        if strain == 0 or strain == 99999:
            continue
        
        # Build stats response
        stats_response = [stat.stat_value for stat in item.item_stats] if item.item_stats else []
        
        # Build spell data response
        spell_data_list = [isd.spell_data for isd in item.item_spell_data] if item.item_spell_data else []
        
        # Build actions response
        actions = [action for action in item.actions] if item.actions else []
        
        # Build sources response
        sources = []
        if item.item_sources:
            for item_source in item.item_sources:
                if item_source.source and item_source.source.source_type:
                    sources.append({
                        'source_type': item_source.source.source_type.name,
                        'source_name': item_source.source.name,
                        'extra_data': item_source.source.extra_data or {}
                    })
        
        detailed_items.append(ItemDetail(
            id=item.id,
            aoid=item.aoid,
            name=item.name,
            ql=item.ql,
            item_class=item.item_class,
            description=item.description,
            is_nano=item.is_nano,
            stats=stats_response,
            spell_data=spell_data_list,
            attack_stats=[],  # Nanos don't have attack stats
            defense_stats=[], # Nanos don't have defense stats
            actions=actions,
            sources=sources
        ))
    
    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=len(detailed_items),  # Note: Filtered count after exclusions
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )