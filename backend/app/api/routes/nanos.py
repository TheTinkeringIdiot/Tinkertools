"""
Nano programs API endpoints with rich spell data.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload, aliased
from sqlalchemy import and_, or_, desc, asc, false, func, Integer
import math
import logging

from app.core.database import get_db
from app.models import (
    Item,
    ItemStats,
    StatValue,
    ItemSpellData,
    SpellData,
    SpellDataSpells,
    Spell,
    SpellCriterion,
    Criterion,
    Action,
    ActionCriteria,
    NanoProperties,
)
from app.api.schemas import PaginatedResponse, ItemDetail
from app.api.schemas.nano import (
    NanoItemDetail,
    NanoProgram,
    NanoProgramWithSpells,
    NanoStatsResponse,
)
from app.core import nano_properties
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/nanos", tags=["nanos"])
logger = logging.getLogger(__name__)


def derived_nano_fields(item: Item) -> dict:
    """school, professions and level of a nano, from its nano_properties row
    (see app/core/nano_properties.py for what each one means)."""
    props = item.nano_properties
    if props is None:
        return {"school": None, "professions": [], "level": None}
    return {
        "school": nano_properties.school_name(props.school),
        "professions": nano_properties.profession_names(props.professions),
        "level": props.min_level,
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
        # What it takes to cast the nano is the criteria of its actions (the
        # Use action), not its spells' criteria, which gate individual effects.
        "actions": list(item.actions),
        "effects": [],
        "strain": None,
        **derived_nano_fields(item),
        "casting_time": None,
        "recharge_time": None,
        "memory_usage": None,
        "nano_point_cost": None,
        "duration": None,
        "targeting": None,
        "source_location": None,
        "acquisition_method": None,
    }

    # Extract data from associated spells
    for spell_data in item.spell_data:
        for spell in spell_data.spells:
            # Extract basic spell properties
            if spell.tick_count and not nano_data["casting_time"]:
                nano_data["casting_time"] = spell.tick_count
            if spell.tick_interval and not nano_data["recharge_time"]:
                nano_data["recharge_time"] = spell.tick_interval

    # Extract strain from name patterns (many AO nanos have strain in name)
    if " - " in item.name:
        parts = item.name.split(" - ")
        if len(parts) > 1:
            nano_data["strain"] = parts[-1].strip()

    return NanoProgram(**nano_data)


SCHOOL_QUERY = Query(
    None,
    description="Filter by school; repeat for several (school=Medical&school=Psi). "
    "One of Combat, Medical, Protection, Psi, Space, or its NanoSchool value 1-5",
)
PROFESSION_QUERY = Query(
    None,
    description="Filter by profession name (e.g. Doctor) or id; repeat for several. "
    "Matches nanos castable by any of them: those whose Use action allows one of "
    "them, plus those whose Use action allows every profession",
)
STRAIN_QUERY = Query(None, description="Filter by strain")
LEVEL_MIN_QUERY = Query(
    None, description="Minimum of the lowest level that can cast it"
)
LEVEL_MAX_QUERY = Query(
    None, description="Maximum of the lowest level that can cast it"
)
QL_MIN_QUERY = Query(None, description="Minimum quality level")
QL_MAX_QUERY = Query(None, description="Maximum quality level")


def _known_ids(values: Optional[List[str]], lookup) -> Optional[List[int]]:
    """Ids of the names in ``values`` that ``lookup`` knows; None if no filter."""
    if not values:
        return None
    return sorted({i for i in (lookup(v) for v in values) if i is not None})


def filter_nanos(
    query,
    school: Optional[List[str]] = None,
    profession: Optional[List[str]] = None,
    strain: Optional[str] = None,
    level_min: Optional[int] = None,
    level_max: Optional[int] = None,
    ql_min: Optional[int] = None,
    ql_max: Optional[int] = None,
    join_properties: bool = False,
):
    """Apply the /nanos filters to a query over nano Items, in SQL.

    Filtering before paginating keeps total, pages and page contents in
    agreement. school, profession and level come from nano_properties, the
    row derived_nano_fields() reports; strain mirrors
    parse_nano_from_item_and_spells(). Names that aren't a school or profession
    are ignored, and a filter of only unknown names matches nothing, like an
    unknown strain. ``join_properties`` joins nano_properties (outer) even when
    no filter needs it, for sorting on it.
    """
    if ql_min is not None:
        query = query.filter(Item.ql >= ql_min)
    if ql_max is not None:
        query = query.filter(Item.ql <= ql_max)
    if strain:
        query = query.filter(
            Item.name.like("% - %"),
            func.btrim(func.regexp_replace(Item.name, "^.* - ", ""), " \t\r\n")
            == strain,
        )

    schools = _known_ids(school, nano_properties.school_id)
    professions = _known_ids(profession, nano_properties.profession_id)
    if (
        schools is not None
        or professions is not None
        or level_min is not None
        or level_max is not None
    ):
        query = query.join(NanoProperties, NanoProperties.item_id == Item.id)
    elif join_properties:
        query = query.outerjoin(NanoProperties, NanoProperties.item_id == Item.id)

    if schools is not None:
        query = query.filter(NanoProperties.school.in_(schools) if schools else false())
    if professions is not None:
        # An empty list is "no restriction" only for nanos with a Use action;
        # the rest (level NULL) are procs and effects nobody casts
        unrestricted = and_(
            NanoProperties.professions == [], NanoProperties.min_level.isnot(None)
        )
        query = query.filter(
            or_(NanoProperties.professions.overlap(professions), unrestricted)
            if professions
            else false()
        )
    if level_min is not None:
        query = query.filter(NanoProperties.min_level >= level_min)
    if level_max is not None:
        query = query.filter(NanoProperties.min_level <= level_max)
    return query


@router.get("", response_model=PaginatedResponse[NanoProgram])
@cached_response("nanos_list")
@performance_monitor
def get_nanos(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    school: Optional[List[str]] = SCHOOL_QUERY,
    strain: Optional[str] = STRAIN_QUERY,
    profession: Optional[List[str]] = PROFESSION_QUERY,
    level_min: Optional[int] = LEVEL_MIN_QUERY,
    level_max: Optional[int] = LEVEL_MAX_QUERY,
    ql_min: Optional[int] = QL_MIN_QUERY,
    ql_max: Optional[int] = QL_MAX_QUERY,
    sort_by: str = Query("name", description="Sort by: name, ql, level"),
    sort_desc: bool = Query(False, description="Sort descending"),
    db: Session = Depends(get_db),
):
    """
    Get paginated list of nano programs with rich spell data.
    """
    # Build base query WITHOUT relationship loading (for filtering + counting)
    query = db.query(Item).filter(Item.is_nano.is_(True))

    query = filter_nanos(
        query,
        school=school,
        profession=profession,
        strain=strain,
        level_min=level_min,
        level_max=level_max,
        ql_min=ql_min,
        ql_max=ql_max,
        join_properties=sort_by == "level",
    )

    # Get total count on lightweight query (no relationship loading)
    total = query.count()

    # Apply sorting (id breaks ties so OFFSET pages never overlap)
    if sort_by == "name":
        query = query.order_by(desc(Item.name) if sort_desc else asc(Item.name))
    elif sort_by == "ql":
        query = query.order_by(desc(Item.ql) if sort_desc else asc(Item.ql))
    elif sort_by == "level":
        # Nanos without a level (no Use action) sort last either way
        level = NanoProperties.min_level
        query = query.order_by(
            level.desc().nulls_last() if sort_desc else level.asc().nulls_last()
        )
    else:
        query = query.order_by(desc(Item.name) if sort_desc else asc(Item.name))
    query = query.order_by(Item.id)

    # Apply pagination and load relationships only for result set
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    items = (
        query.options(
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_spell_data)
            .selectinload(ItemSpellData.spell_data)
            .selectinload(SpellData.spell_data_spells)
            .selectinload(SpellDataSpells.spell)
            .selectinload(Spell.spell_criteria)
            .selectinload(SpellCriterion.criterion),
            selectinload(Item.actions)
            .selectinload(Action.action_criteria)
            .selectinload(ActionCriteria.criterion),
            selectinload(Item.nano_properties),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Convert to NanoProgram objects
    nanos = []
    for item in items:
        try:
            nanos.append(parse_nano_from_item_and_spells(item))
        except Exception as e:
            logger.warning(f"Failed to parse nano {item.id}: {e}")
            continue

    return PaginatedResponse[NanoProgram](
        items=nanos,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )


@router.get("/search", response_model=PaginatedResponse[NanoProgram])
@cached_response("nanos_search")
@performance_monitor
def search_nanos(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    school: Optional[List[str]] = SCHOOL_QUERY,
    strain: Optional[str] = STRAIN_QUERY,
    profession: Optional[List[str]] = PROFESSION_QUERY,
    level_min: Optional[int] = LEVEL_MIN_QUERY,
    level_max: Optional[int] = LEVEL_MAX_QUERY,
    ql_min: Optional[int] = QL_MIN_QUERY,
    ql_max: Optional[int] = QL_MAX_QUERY,
    db: Session = Depends(get_db),
):
    """
    Search nano programs by name or description, with the same filters as
    GET /nanos.
    """
    search_term = f"%{q}%"
    # Build base query WITHOUT relationship loading
    query = db.query(Item).filter(
        and_(
            Item.is_nano.is_(True),
            or_(Item.name.ilike(search_term), Item.description.ilike(search_term)),
        )
    )
    query = filter_nanos(
        query,
        school=school,
        profession=profession,
        strain=strain,
        level_min=level_min,
        level_max=level_max,
        ql_min=ql_min,
        ql_max=ql_max,
    )

    # Get total count on lightweight query
    total = query.count()
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Load relationships only for result set (unique ORDER BY keeps OFFSET
    # pages stable)
    items = (
        query.order_by(Item.id)
        .options(
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_spell_data)
            .selectinload(ItemSpellData.spell_data)
            .selectinload(SpellData.spell_data_spells)
            .selectinload(SpellDataSpells.spell)
            .selectinload(Spell.spell_criteria)
            .selectinload(SpellCriterion.criterion),
            selectinload(Item.actions)
            .selectinload(Action.action_criteria)
            .selectinload(ActionCriteria.criterion),
            selectinload(Item.nano_properties),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )

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
        has_prev=page > 1,
    )


@router.get("/stats", response_model=NanoStatsResponse)
@cached_response("nanos_stats")
@performance_monitor
def get_nano_stats(db: Session = Depends(get_db)):
    """
    Get statistics about available nano programs.
    """
    # Get all nano items with selectinload to avoid Cartesian product explosion
    items = (
        db.query(Item)
        .filter(Item.is_nano.is_(True))
        .options(
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_spell_data)
            .selectinload(ItemSpellData.spell_data)
            .selectinload(SpellData.spell_data_spells)
            .selectinload(SpellDataSpells.spell)
            .selectinload(Spell.spell_criteria)
            .selectinload(SpellCriterion.criterion),
            selectinload(Item.actions)
            .selectinload(Action.action_criteria)
            .selectinload(ActionCriteria.criterion),
            selectinload(Item.nano_properties),
        )
        .all()
    )

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
            professions.update(nano.professions)
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
        quality_level_range=(
            [min(quality_levels), max(quality_levels)] if quality_levels else [1, 300]
        ),
    )


@router.get("/{nano_id}", response_model=NanoProgramWithSpells)
@cached_response("nano_detail")
@performance_monitor
def get_nano(nano_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific nano program.
    """
    item = (
        db.query(Item)
        .filter(and_(Item.id == nano_id, Item.is_nano.is_(True)))
        .options(
            joinedload(Item.item_stats).joinedload(ItemStats.stat_value),
            joinedload(Item.item_spell_data)
            .joinedload(ItemSpellData.spell_data)
            .joinedload(SpellData.spell_data_spells)
            .joinedload(SpellDataSpells.spell)
            .joinedload(Spell.spell_criteria)
            .joinedload(SpellCriterion.criterion),
            joinedload(Item.actions)
            .joinedload(Action.action_criteria)
            .joinedload(ActionCriteria.criterion),
            joinedload(Item.nano_properties),
        )
        .first()
    )

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
                    raw_criteria.append(
                        {
                            "value1": criterion.value1,
                            "value2": criterion.value2,
                            "operator": criterion.operator,
                        }
                    )

        return NanoProgramWithSpells(
            **nano.dict(), spells=spells, raw_criteria=raw_criteria
        )
    except Exception as e:
        logger.error(f"Failed to parse nano {nano_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to process nano data")


@router.get(
    "/profession/{profession_id}", response_model=PaginatedResponse[NanoItemDetail]
)
@cached_response("nanos_profession", ttl=3600)  # Cache for 1 hour
@performance_monitor
def get_nanos_by_profession(
    profession_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(1000, ge=1, le=1000, description="Items per page"),
    sort: str = Query("ql", description="Sort field: name, ql"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db),
):
    """
    Get nano programs filtered by profession requirement.
    OPTIMIZED endpoint specifically for TinkerNanos profession-based filtering.

    Major performance improvements:
    - Database-level filtering instead of Python filtering
    - selectinload instead of joinedload to avoid cartesian products
    - Single query with proper pagination
    - Moved test item and strain filtering to SQL
    """
    # Build optimized base query with database-level filtering
    base_query = db.query(Item).filter(
        and_(
            Item.is_nano.is_(True),
            ~Item.name.startswith("TESTLIVEITEM"),  # Filter test items at DB level
            # Filter by valid strain at DB level
            Item.id.in_(
                db.query(ItemStats.item_id)
                .join(StatValue, ItemStats.stat_value_id == StatValue.id)
                .filter(
                    and_(
                        StatValue.stat == 75,  # Strain stat
                        StatValue.value > 0,
                        StatValue.value != 99999,
                    )
                )
            ),
        )
    )

    # Filter by profession requirement using optimized subquery
    # Excludes profession criteria preceded by operator 18 (target modifier)
    if profession_id > 0:
        # Alias for the current and previous criteria
        ac_current = aliased(ActionCriteria)
        c_current = aliased(Criterion)
        ac_prev = aliased(ActionCriteria)
        c_prev = aliased(Criterion)

        profession_subquery = (
            db.query(Action.item_id)
            .join(ac_current, Action.id == ac_current.action_id)
            .join(c_current, ac_current.criterion_id == c_current.id)
            .outerjoin(
                ac_prev,
                and_(
                    ac_prev.action_id == Action.id,
                    ac_prev.order_index == ac_current.order_index - 1,
                ),
            )
            .outerjoin(c_prev, ac_prev.criterion_id == c_prev.id)
            .filter(
                and_(
                    Action.action == 3,  # USE action
                    or_(
                        and_(c_current.value1 == 60, c_current.value2 == profession_id),
                        and_(
                            c_current.value1 == 368, c_current.value2 == profession_id
                        ),
                    ),
                    # Exclude if preceded by operator 18 (target modifier)
                    or_(
                        c_prev.id.is_(None),  # No previous criterion
                        c_prev.operator != 18,  # Previous is not operator 18
                    ),
                )
            )
        )
        base_query = base_query.filter(Item.id.in_(profession_subquery))

    # Apply sorting with DISTINCT to prevent duplicates
    if sort == "name":
        base_query = base_query.order_by(
            desc(Item.name) if sort_order == "desc" else asc(Item.name)
        )
    elif sort == "ql":
        base_query = base_query.order_by(
            desc(Item.ql) if sort_order == "desc" else asc(Item.ql)
        )
    else:
        base_query = base_query.order_by(
            desc(Item.ql) if sort_order == "desc" else asc(Item.ql)
        )
    # id breaks ties so OFFSET pages never overlap
    base_query = base_query.order_by(Item.id)

    # Add DISTINCT to prevent duplicates from joins
    base_query = base_query.distinct()

    # Get total count efficiently
    total = base_query.count()

    # Apply pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Execute main query with selectinload for better performance
    items = (
        base_query.offset(offset)
        .limit(page_size)
        .options(
            # Use selectinload instead of joinedload to avoid cartesian products
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_spell_data)
            .selectinload(ItemSpellData.spell_data)
            .selectinload(SpellData.spell_data_spells)
            .selectinload(SpellDataSpells.spell)
            .selectinload(Spell.spell_criteria)
            .selectinload(SpellCriterion.criterion),
            selectinload(Item.actions)
            .selectinload(Action.action_criteria)
            .selectinload(ActionCriteria.criterion),
            selectinload(Item.nano_properties),
            # Skip source loading if not critical for performance
            # selectinload(Item.item_sources).selectinload(ItemSource.source)
            #     .selectinload(Source.source_type)
        )
        .all()
    )

    # Convert to ItemDetail objects - now all filtering is done at DB level
    detailed_items = []
    for item in items:
        # All filtering now done at database level, no need for Python filtering

        # Build stats response
        stats_response = (
            [stat.stat_value for stat in item.item_stats] if item.item_stats else []
        )

        # Build spell data response
        spell_data_list = (
            [isd.spell_data for isd in item.item_spell_data]
            if item.item_spell_data
            else []
        )

        # Build actions response
        actions = [action for action in item.actions] if item.actions else []

        # Build minimal sources response (load separately if needed)
        sources = []  # Disabled for performance - can be loaded separately if needed

        detailed_items.append(
            NanoItemDetail(
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
                defense_stats=[],  # Nanos don't have defense stats
                actions=actions,
                sources=sources,
                **derived_nano_fields(item),
            )
        )

    return PaginatedResponse[NanoItemDetail](
        items=detailed_items,
        total=total,  # Now accurate count from DB filtering
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )


@router.get("/offensive/{profession_id}", response_model=PaginatedResponse[ItemDetail])
@cached_response("nanos_offensive", ttl=3600)  # Cache for 1 hour
@performance_monitor
def get_offensive_nanos_by_profession(
    profession_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(1000, ge=1, le=1000, description="Items per page"),
    sort: str = Query("ql", description="Sort field: name, ql"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db),
):
    """
    Get offensive nano programs filtered by profession requirement.
    OPTIMIZED endpoint specifically for TinkerNukes offensive nano filtering.

    Filters for nanoprograms that:
    - Belong to the specified profession (profession_id)
    - Contain offensive spells (target=3, spell_id=53002)
    - Deal health damage (spell_params.Stat=27)
    - Have valid strain values (stat 75 > 0 AND stat 75 != 99999)
    - Are not test items (name NOT LIKE 'TESTLIVEITEM%')

    Performance optimizations:
    - Database-level filtering for offensive spells
    - selectinload instead of joinedload to avoid cartesian products
    - Single query with proper pagination
    - Moved test item and strain filtering to SQL
    """
    # Build optimized base query with database-level filtering
    base_query = db.query(Item).filter(
        and_(
            Item.is_nano.is_(True),
            ~Item.name.startswith("TESTLIVEITEM"),  # Filter test items at DB level
            # Filter by valid strain at DB level
            Item.id.in_(
                db.query(ItemStats.item_id)
                .join(StatValue, ItemStats.stat_value_id == StatValue.id)
                .filter(
                    and_(
                        StatValue.stat == 75,  # Strain stat
                        StatValue.value > 0,
                        StatValue.value != 99999,
                    )
                )
            ),
            # Filter for offensive spells at DB level
            Item.id.in_(
                db.query(ItemSpellData.item_id)
                .join(SpellData, ItemSpellData.spell_data_id == SpellData.id)
                .join(SpellDataSpells, SpellData.id == SpellDataSpells.spell_data_id)
                .join(Spell, SpellDataSpells.spell_id == Spell.id)
                .filter(
                    and_(
                        Spell.target == 3,  # Offensive target
                        Spell.spell_id == 53002,  # Modify stat spell
                        Spell.spell_params.op("->>")("Stat").cast(Integer)
                        == 27,  # Health damage
                    )
                )
            ),
        )
    )

    # Filter by profession requirement using optimized subquery
    # Excludes profession criteria preceded by operator 18 (target modifier)
    if profession_id > 0:
        # Alias for the current and previous criteria
        ac_current = aliased(ActionCriteria)
        c_current = aliased(Criterion)
        ac_prev = aliased(ActionCriteria)
        c_prev = aliased(Criterion)

        profession_subquery = (
            db.query(Action.item_id)
            .join(ac_current, Action.id == ac_current.action_id)
            .join(c_current, ac_current.criterion_id == c_current.id)
            .outerjoin(
                ac_prev,
                and_(
                    ac_prev.action_id == Action.id,
                    ac_prev.order_index == ac_current.order_index - 1,
                ),
            )
            .outerjoin(c_prev, ac_prev.criterion_id == c_prev.id)
            .filter(
                and_(
                    Action.action == 3,  # USE action
                    or_(
                        and_(c_current.value1 == 60, c_current.value2 == profession_id),
                        and_(
                            c_current.value1 == 368, c_current.value2 == profession_id
                        ),
                    ),
                    # Exclude if preceded by operator 18 (target modifier)
                    or_(
                        c_prev.id.is_(None),  # No previous criterion
                        c_prev.operator != 18,  # Previous is not operator 18
                    ),
                )
            )
        )
        base_query = base_query.filter(Item.id.in_(profession_subquery))

    # Apply sorting with DISTINCT to prevent duplicates
    if sort == "name":
        base_query = base_query.order_by(
            desc(Item.name) if sort_order == "desc" else asc(Item.name)
        )
    elif sort == "ql":
        base_query = base_query.order_by(
            desc(Item.ql) if sort_order == "desc" else asc(Item.ql)
        )
    else:
        base_query = base_query.order_by(
            desc(Item.ql) if sort_order == "desc" else asc(Item.ql)
        )
    # id breaks ties so OFFSET pages never overlap
    base_query = base_query.order_by(Item.id)

    # Add DISTINCT to prevent duplicates from joins
    base_query = base_query.distinct()

    # Get total count efficiently
    total = base_query.count()

    # Apply pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Execute main query with selectinload for better performance
    items = (
        base_query.offset(offset)
        .limit(page_size)
        .options(
            # Use selectinload instead of joinedload to avoid cartesian products
            selectinload(Item.item_stats).selectinload(ItemStats.stat_value),
            selectinload(Item.item_spell_data)
            .selectinload(ItemSpellData.spell_data)
            .selectinload(SpellData.spell_data_spells)
            .selectinload(SpellDataSpells.spell)
            .selectinload(Spell.spell_criteria)
            .selectinload(SpellCriterion.criterion),
            selectinload(Item.actions)
            .selectinload(Action.action_criteria)
            .selectinload(ActionCriteria.criterion),
        )
        .all()
    )

    # Convert to ItemDetail objects - now all filtering is done at DB level
    detailed_items = []
    for item in items:
        # All filtering now done at database level, no need for Python filtering

        # Build stats response
        stats_response = (
            [stat.stat_value for stat in item.item_stats] if item.item_stats else []
        )

        # Build spell data response
        spell_data_list = (
            [isd.spell_data for isd in item.item_spell_data]
            if item.item_spell_data
            else []
        )

        # Build actions response
        actions = [action for action in item.actions] if item.actions else []

        # Build minimal sources response (load separately if needed)
        sources = []  # Disabled for performance - can be loaded separately if needed

        detailed_items.append(
            ItemDetail(
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
                defense_stats=[],  # Nanos don't have defense stats
                actions=actions,
                sources=sources,
            )
        )

    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,  # Now accurate count from DB filtering
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )


@router.get(
    "/profession/{profession_id}/fast", response_model=PaginatedResponse[ItemDetail]
)
@cached_response("nanos_profession_fast", ttl=7200)  # Cache for 2 hours
@performance_monitor
def get_nanos_by_profession_fast(
    profession_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(1000, ge=1, le=1000, description="Items per page"),
    sort: str = Query("ql", description="Sort field: name, ql"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_db),
):
    """
    Ultra-fast nano programs by profession using minimal joins.

    This endpoint prioritizes speed over complete data by:
    - Minimal relationship loading
    - Raw SQL for complex filters
    - Simplified response objects
    - Extended caching
    """
    from sqlalchemy import text

    # Build optimized SQL query with minimal joins
    sort_field = "i.ql" if sort == "ql" else "i.name"
    sort_direction = "DESC" if sort_order == "desc" else "ASC"

    # Use raw SQL for maximum performance
    sql_query = text(f"""
        SELECT DISTINCT
            i.id, i.aoid, i.name, i.ql, i.item_class, i.description, i.is_nano
        FROM items i
        WHERE i.is_nano = true
        AND NOT i.name LIKE 'TESTLIVEITEM%'
        AND EXISTS (
            SELECT 1 FROM item_stats ist 
            JOIN stat_values sv ON ist.stat_value_id = sv.id 
            WHERE ist.item_id = i.id AND sv.stat = 75 
            AND sv.value > 0 AND sv.value != 99999
        )
        {'AND i.id IN (\
            SELECT a.item_id FROM actions a\
            JOIN action_criteria ac ON a.id = ac.action_id\
            JOIN criteria c ON ac.criterion_id = c.id\
            WHERE a.action = 3\
            AND ((c.value1 = 60 AND c.value2 = :prof_id)\
                 OR (c.value1 = 368 AND c.value2 = :prof_id))\
        )' if profession_id > 0 else ''}
        ORDER BY {sort_field} {sort_direction}
        LIMIT :limit OFFSET :offset
    """)

    count_query = text(
        """
        SELECT COUNT(DISTINCT i.id)
        FROM items i
        WHERE i.is_nano = true
        AND NOT i.name LIKE 'TESTLIVEITEM%'
        AND EXISTS (
            SELECT 1 FROM item_stats ist 
            JOIN stat_values sv ON ist.stat_value_id = sv.id 
            WHERE ist.item_id = i.id AND sv.stat = 75 
            AND sv.value > 0 AND sv.value != 99999
        )
    """
        + (
            """ 
        AND i.id IN (
            SELECT a.item_id FROM actions a
            JOIN action_criteria ac ON a.id = ac.action_id
            JOIN criteria c ON ac.criterion_id = c.id
            WHERE a.action = 3
            AND ((c.value1 = 60 AND c.value2 = :prof_id)
                 OR (c.value1 = 368 AND c.value2 = :prof_id))
        )
    """
            if profession_id > 0
            else ""
        )
    )

    # Execute queries
    offset = (page - 1) * page_size
    params = {
        "limit": page_size,
        "offset": offset,
        "prof_id": profession_id if profession_id > 0 else None,
    }

    # Get total count
    count_result = db.execute(count_query, params).scalar()
    total = count_result or 0

    # Get items
    result = db.execute(sql_query, params).fetchall()

    # Build minimal ItemDetail objects
    detailed_items = []
    for row in result:
        detailed_items.append(
            ItemDetail(
                id=row[0],
                aoid=row[1],
                name=row[2],
                ql=row[3],
                item_class=row[4],
                description=row[5] or "",
                is_nano=row[6],
                stats=[],  # Skip for performance - load separately if needed
                spell_data=[],  # Skip for performance - load separately if needed
                attack_stats=[],
                defense_stats=[],
                actions=[],  # Skip for performance - load separately if needed
                sources=[],  # Skip for performance - load separately if needed
            )
        )

    pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )
