"""
Items API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
import math
import time
import logging

from app.core.database import get_db
from app.store.context import Build, get_build, get_store
from app.store.items import load_item_details
from app.models import Item, StatValue
from app.models.interpolated_item import (
    InterpolationResponse,
    BatchInterpolationRequest,
    BatchInterpolationResponse,
    BatchItemResult,
)
from app.services.interpolation import InterpolationService
from app.api.schemas import (
    ItemDetail,
    SpellDataResponse,
    ItemSpellResponse,
    ActionResponse,
    ItemCriterionResponse,
    ItemStatResponse,
    SourceResponse,
    SourceTypeResponse,
    ItemSourceResponse,
    PaginatedResponse,
)
from app.core.decorators import cached_response, performance_monitor
from app.api.services.item_filter_service import (
    apply_common_item_filters,
    item_has_stat,
    item_detail_load_options,
)

router = APIRouter(prefix="/items", tags=["items"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


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
                ItemCriterionResponse(
                    value1=sc.criterion.value1,
                    value2=sc.criterion.value2,
                    operator=sc.criterion.operator,
                )
                for sc in spell.spell_criteria
            ]

            spells_with_criteria.append(
                ItemSpellResponse(
                    target=spell.target,
                    tick_count=spell.tick_count,
                    tick_interval=spell.tick_interval,
                    spell_id=spell.spell_id,
                    spell_format=spell.spell_format,
                    spell_params=spell.spell_params or {},
                    criteria=criteria,
                )
            )

        spell_data_list.append(
            SpellDataResponse(event=spell_data.event, spells=spells_with_criteria)
        )

    # Get attack/defense stats from preloaded data
    attack_stats = []
    defense_stats = []
    if item.attack_defense:
        # Use preloaded attack/defense relationships
        attack_stats = [ada.stat_value for ada in item.attack_defense.attack_stats]
        defense_stats = [add.stat_value for add in item.attack_defense.defense_stats]

    # Get actions with criteria
    actions = []
    for action in item.actions:
        criteria = [
            ItemCriterionResponse(
                value1=ac.criterion.value1,
                value2=ac.criterion.value2,
                operator=ac.criterion.operator,
            )
            for ac in action.action_criteria
        ]

        actions.append(
            ActionResponse(
                action=action.action,
                criteria=criteria,
            )
        )

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
            source_type=(
                SourceTypeResponse(
                    id=source.source_type.id,
                    name=source.source_type.name,
                    description=source.source_type.description,
                )
                if source.source_type
                else None
            ),
        )

        sources.append(
            ItemSourceResponse(
                source=source_response,
                drop_rate=(
                    float(item_source.drop_rate) if item_source.drop_rate else None
                ),
                min_ql=item_source.min_ql,
                max_ql=item_source.max_ql,
                conditions=item_source.conditions,
                extra_data=item_source.extra_data,
            )
        )

    # Convert stats to ItemStatResponse objects
    stats_response = [
        ItemStatResponse(stat=stat.stat, value=stat.value) for stat in stats
    ]
    attack_stats_response = [
        ItemStatResponse(stat=stat.stat, value=stat.value) for stat in attack_stats
    ]
    defense_stats_response = [
        ItemStatResponse(stat=stat.stat, value=stat.value) for stat in defense_stats
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
        sources=sources,
    )


def build_item_details_bulk(items: List[Item], db: Session) -> List[ItemDetail]:
    """
    Build ItemDetail responses for multiple items with optimized caching.

    Caches ItemStatResponse objects to avoid creating duplicate response objects
    for stat_values that appear across multiple items (e.g., common attack stats).

    Args:
        items: List of Item objects with preloaded relationships
        db: Database session (kept for signature compatibility)

    Returns:
        List of ItemDetail objects
    """
    if not items:
        return []

    # Cache stat responses to reuse across items
    stat_value_cache = {}

    def get_stat_response(stat_value):
        """Get cached ItemStatResponse or create and cache new one."""
        if stat_value.id not in stat_value_cache:
            stat_value_cache[stat_value.id] = ItemStatResponse(
                stat=stat_value.stat, value=stat_value.value
            )
        return stat_value_cache[stat_value.id]

    # Process all items with caching
    result = []
    for item in items:
        # Get basic stats with caching
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
                    ItemCriterionResponse(
                        value1=sc.criterion.value1,
                        value2=sc.criterion.value2,
                        operator=sc.criterion.operator,
                    )
                    for sc in spell.spell_criteria
                ]

                spells_with_criteria.append(
                    ItemSpellResponse(
                        target=spell.target,
                        tick_count=spell.tick_count,
                        tick_interval=spell.tick_interval,
                        spell_id=spell.spell_id,
                        spell_format=spell.spell_format,
                        spell_params=spell.spell_params or {},
                        criteria=criteria,
                    )
                )

            spell_data_list.append(
                SpellDataResponse(
                    event=spell_data.event,
                    spells=spells_with_criteria,
                )
            )

        # Get attack/defense stats from preloaded data with caching
        attack_stats = []
        defense_stats = []
        if item.attack_defense:
            # Use preloaded attack/defense relationships
            attack_stats = [ada.stat_value for ada in item.attack_defense.attack_stats]
            defense_stats = [
                add.stat_value for add in item.attack_defense.defense_stats
            ]

        # Get actions with criteria
        actions = []
        for action in item.actions:
            criteria = [
                ItemCriterionResponse(
                    value1=ac.criterion.value1,
                    value2=ac.criterion.value2,
                    operator=ac.criterion.operator,
                )
                for ac in action.action_criteria
            ]

            actions.append(
                ActionResponse(
                    action=action.action,
                    criteria=criteria,
                )
            )

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
                source_type=(
                    SourceTypeResponse(
                        id=source.source_type.id,
                        name=source.source_type.name,
                        description=source.source_type.description,
                    )
                    if source.source_type
                    else None
                ),
            )

            sources.append(
                ItemSourceResponse(
                    source=source_response,
                    drop_rate=(
                        float(item_source.drop_rate) if item_source.drop_rate else None
                    ),
                    min_ql=item_source.min_ql,
                    max_ql=item_source.max_ql,
                    conditions=item_source.conditions,
                    extra_data=item_source.extra_data,
                )
            )

        # Convert stats to ItemStatResponse objects using cache
        stats_response = [get_stat_response(stat) for stat in stats]
        attack_stats_response = [get_stat_response(stat) for stat in attack_stats]
        defense_stats_response = [get_stat_response(stat) for stat in defense_stats]

        result.append(
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
                attack_stats=attack_stats_response,
                defense_stats=defense_stats_response,
                actions=actions,
                sources=sources,
            )
        )

    return result


@router.get("", response_model=PaginatedResponse[ItemDetail])
def get_items(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    item_class: Optional[int] = Query(None, description="Filter by item class"),
    min_ql: Optional[int] = Query(None, description="Minimum quality level"),
    max_ql: Optional[int] = Query(None, description="Maximum quality level"),
    is_nano: Optional[bool] = Query(None, description="Filter nano programs"),
    # Add new advanced filter parameters
    slot: Optional[int] = Query(
        None, description="Filter by equipment slot (stat 298)"
    ),
    profession: Optional[int] = Query(
        None, description="Filter by profession requirement"
    ),
    breed: Optional[int] = Query(None, description="Filter by breed requirement"),
    gender: Optional[int] = Query(None, description="Filter by gender requirement"),
    faction: Optional[int] = Query(None, description="Filter by faction requirement"),
    froob_friendly: Optional[bool] = Query(
        None, description="Filter items without expansion requirements"
    ),
    nodrop: Optional[bool] = Query(None, description="Filter items with NODROP flag"),
    stat_bonuses: Optional[str] = Query(
        None, description="Comma-separated list of stat IDs to check for bonuses"
    ),
    stat_filters: Optional[str] = Query(
        None,
        description="Stat filters in format 'function:stat:operator:value' separated by commas",
    ),
    strain: Optional[int] = Query(None, description="Filter by nano strain (stat 75)"),
    db: Session = Depends(get_db),
):
    """
    Get paginated list of items with optional filters and complete item details.
    """
    # Build base query WITHOUT relationship loading (for filtering + counting)
    query = db.query(Item)

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

    # Apply the advanced filters shared across item endpoints
    query = apply_common_item_filters(
        query,
        db,
        slot=slot,
        breed=breed,
        gender=gender,
        faction=faction,
        profession=profession,
        froob_friendly=froob_friendly,
        nodrop=nodrop,
        stat_bonuses=stat_bonuses,
        stat_filters=stat_filters,
        strain=strain,
    )

    # Get total count on lightweight query (no relationship loading)
    total = query.count()

    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Load relationships only for the paginated result set. A unique ORDER BY
    # keeps OFFSET pages from repeating or skipping rows; AOID is the item's
    # identity in every build, so the order does not depend on storage.
    items = (
        query.order_by(Item.aoid)
        .options(*item_detail_load_options())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Build detailed response items in bulk
    detailed_items = build_item_details_bulk(items, db)

    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )


@router.get("/search", response_model=PaginatedResponse[ItemDetail])
def search_items(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    exact_match: bool = Query(
        True, description="Use exact matching (default) vs fuzzy/stemmed search"
    ),
    weapons: bool = Query(
        False,
        description="Filter to weapons only (items with both attack and defense data)",
    ),
    search_fields: Optional[str] = Query(
        None,
        description="Comma-separated list of fields to search: name,description,effects,stats",
    ),
    # New advanced search parameters
    min_ql: Optional[int] = Query(
        None, ge=1, le=999, description="Minimum quality level"
    ),
    max_ql: Optional[int] = Query(
        None, ge=1, le=999, description="Maximum quality level"
    ),
    item_class: Optional[int] = Query(
        None, description="Filter by item class (stat 76)"
    ),
    slot: Optional[int] = Query(
        None, description="Filter by equipment slot (stat 298)"
    ),
    profession: Optional[int] = Query(
        None, description="Filter by profession requirement"
    ),
    breed: Optional[int] = Query(None, description="Filter by breed requirement"),
    gender: Optional[int] = Query(None, description="Filter by gender requirement"),
    faction: Optional[int] = Query(None, description="Filter by faction requirement"),
    froob_friendly: Optional[bool] = Query(
        None, description="Filter items without expansion requirements"
    ),
    nodrop: Optional[bool] = Query(None, description="Filter items with NODROP flag"),
    stat_bonuses: Optional[str] = Query(
        None, description="Comma-separated list of stat IDs to check for bonuses"
    ),
    stat_filters: Optional[str] = Query(
        None,
        description="Stat filters in format 'function:stat:operator:value' separated by commas",
    ),
    strain: Optional[int] = Query(None, description="Filter by nano strain (stat 75)"),
    db: Session = Depends(get_db),
):
    """
    Search items by name or description using exact matching (default) or fuzzy/stemmed search.
    Returns complete item details including stats, spells, and attack/defense data.
    """
    start_time = time.time()

    # Parse search fields
    fields_to_search = ["name", "description"]  # Default fields
    if search_fields:
        requested_fields = [f.strip().lower() for f in search_fields.split(",")]
        valid_fields = {"name", "description", "effects", "stats"}
        fields_to_search = [f for f in requested_fields if f in valid_fields]
        if not fields_to_search:  # Fallback if no valid fields provided
            fields_to_search = ["name", "description"]

    # Log search parameters for debugging
    logger.info(
        f"Search query='{q}' search_fields='{search_fields}' parsed_fields={fields_to_search} exact_match={exact_match}"
    )

    if exact_match:
        # Use ILIKE for exact word matching (default behavior)
        search_term = f"%{q}%"

        # Build search conditions based on requested fields
        search_conditions = []

        if "name" in fields_to_search:
            search_conditions.append(Item.name.ilike(search_term))
        if "description" in fields_to_search:
            search_conditions.append(Item.description.ilike(search_term))

        if not search_conditions:
            search_conditions.append(Item.name.ilike(search_term))

        logger.info(
            f"Final query: searching {len(search_conditions)} field(s) for term '{q}' in fields {fields_to_search}"
        )

        # Build base query WITHOUT relationship loading
        query = db.query(Item)

        # Apply the search filter
        if len(search_conditions) == 1:
            query = query.filter(search_conditions[0])
        else:
            query = query.filter(or_(*search_conditions))

        # The AOID breaks name ties so OFFSET pages never overlap
        query = query.order_by(Item.name, Item.aoid)

        # Apply weapons filter
        if weapons:
            query = query.filter(Item.atkdef_id.isnot(None)).distinct()
    else:
        # Use PostgreSQL full-text search for fuzzy/stemmed matching.
        # websearch_to_tsquery safely parses raw user input: it never raises
        # tsquery syntax errors (unlike to_tsquery, which 500s on inputs
        # containing quotes, parentheses, ':', '!', etc.), ANDs bare terms,
        # and supports "quoted phrases", OR, and -exclusion for free.
        ts_query = func.websearch_to_tsquery("english", q)

        # Build full-text search expression based on requested fields
        search_expression_parts = []
        if "name" in fields_to_search:
            search_expression_parts.append(Item.name)
        if "description" in fields_to_search:
            search_expression_parts.append(func.coalesce(Item.description, ""))

        if not search_expression_parts:
            search_expression = Item.name + " " + func.coalesce(Item.description, "")
        elif len(search_expression_parts) == 1:
            search_expression = search_expression_parts[0]
        else:
            search_expression = search_expression_parts[0]
            for part in search_expression_parts[1:]:
                search_expression = search_expression + " " + part

        # Build base query WITHOUT relationship loading
        query = db.query(Item).filter(
            func.to_tsvector("english", search_expression).op("@@")(ts_query)
        )

        # Apply weapons filter
        if weapons:
            query = (
                query.filter(Item.atkdef_id.isnot(None))
                .distinct()
                .order_by(Item.name, Item.aoid)
            )
        else:
            query = query.order_by(
                func.ts_rank(
                    func.to_tsvector("english", search_expression), ts_query
                ).desc(),
                Item.aoid,
            )

    # Quality level range (endpoint-specific: validated 1-999 here)
    if min_ql is not None:
        query = query.filter(Item.ql >= min_ql)
    if max_ql is not None:
        query = query.filter(Item.ql <= max_ql)

    # Item class filter (stat 76) - search uses the stat subquery rather
    # than the Item.item_class column used by get_items
    if item_class is not None and item_class > 0:
        query = query.filter(
            item_has_stat(StatValue.stat == 76, StatValue.value == item_class)
        )

    # Apply the advanced filters shared across item endpoints
    query = apply_common_item_filters(
        query,
        db,
        slot=slot,
        breed=breed,
        gender=gender,
        faction=faction,
        profession=profession,
        froob_friendly=froob_friendly,
        nodrop=nodrop,
        stat_bonuses=stat_bonuses,
        stat_filters=stat_filters,
        strain=strain,
    )

    # Get total count on lightweight query (no relationship loading)
    total = query.count()

    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Load relationships only for the paginated result set
    items = (
        query.options(*item_detail_load_options()).offset(offset).limit(page_size).all()
    )

    # Build detailed response items in bulk
    detailed_items = build_item_details_bulk(items, db)

    # Log performance metrics
    query_time = time.time() - start_time
    search_method = "exact_ilike" if exact_match else "fuzzy_fulltext"
    logger.info(
        f"Item search query='{q}' results={total} time={query_time:.3f}s method={search_method}"
    )

    return PaginatedResponse[ItemDetail](
        items=detailed_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1,
    )


@router.get("/{aoid}", response_model=ItemDetail)
@cached_response("item_detail")
@performance_monitor
def get_item(
    aoid: int, db: Session = Depends(get_store), build: Build = Depends(get_build)
):
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
    items = load_item_details(db, build, aoids=[aoid])
    if not items:
        raise HTTPException(status_code=404, detail="Item not found")

    return items[0]


@router.get("/{aoid}/interpolate", response_model=InterpolationResponse)
@performance_monitor
def interpolate_item(
    aoid: int,
    target_ql: int = Query(
        ..., ge=1, le=500, description="Target quality level for interpolation"
    ),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Interpolate an item to a specific quality level.

    Returns an interpolated item with stats, spells, and criteria calculated
    for the target QL based on the item's variants at different quality levels.
    """
    start_time = time.time()

    try:
        # Create interpolation service
        interpolation_service = InterpolationService(db, build)

        # Perform interpolation
        interpolated_item = interpolation_service.interpolate_item(aoid, target_ql)

        if not interpolated_item:
            raise HTTPException(
                status_code=404, detail=f"Item with AOID {aoid} not found"
            )

        # Get interpolation range for metadata
        interpolation_range = interpolation_service.get_interpolation_range(aoid)
        range_dict = None
        if interpolation_range:
            range_dict = {
                "min_ql": interpolation_range[0],
                "max_ql": interpolation_range[1],
            }

        # Log performance metrics
        query_time = time.time() - start_time
        logger.info(
            f"Item interpolation aoid={aoid} target_ql={target_ql} interpolating={interpolated_item.interpolating} time={query_time:.3f}s"
        )

        return InterpolationResponse(
            success=True, item=interpolated_item, interpolation_range=range_dict
        )

    except Exception as e:
        logger.error(
            f"Interpolation failed for aoid={aoid} target_ql={target_ql}: {str(e)}"
        )
        return InterpolationResponse(
            success=False, error=f"Failed to interpolate item: {str(e)}"
        )


@router.post("/batch/interpolate", response_model=BatchInterpolationResponse)
@performance_monitor
def batch_interpolate_items(
    request: BatchInterpolationRequest,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Batch interpolate multiple items to specific quality levels.

    Accepts up to 100 items in a single request. Returns partial success
    (some items can fail while others succeed).

    Performance: the variants of every requested item are loaded together, so
    the number of queries does not grow with the number of items.
    """
    start_time = time.time()

    # Create single interpolation service for all items
    interpolation_service = InterpolationService(db, build)
    interpolation_service.preload(item_req.aoid for item_req in request.items)

    results = []
    errors = []

    for item_req in request.items:
        try:
            # Perform interpolation
            interpolated_item = interpolation_service.interpolate_item(
                item_req.aoid, item_req.target_ql
            )

            if not interpolated_item:
                # Item not found
                error_msg = f"Item with AOID {item_req.aoid} not found"
                errors.append(error_msg)
                results.append(
                    BatchItemResult(
                        aoid=item_req.aoid,
                        target_ql=item_req.target_ql,
                        success=False,
                        error=error_msg,
                    )
                )
            else:
                # Success
                results.append(
                    BatchItemResult(
                        aoid=item_req.aoid,
                        target_ql=item_req.target_ql,
                        success=True,
                        item=interpolated_item,
                    )
                )

        except Exception as e:
            # Unexpected error for this item
            error_msg = f"Failed to interpolate item {item_req.aoid}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
            results.append(
                BatchItemResult(
                    aoid=item_req.aoid,
                    target_ql=item_req.target_ql,
                    success=False,
                    error=str(e),
                )
            )

    # Calculate success rate
    success_count = sum(1 for r in results if r.success)
    total_count = len(request.items)

    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(
        f"Batch interpolation: {total_count} items, {success_count} succeeded, "
        f"{len(errors)} errors, time={query_time:.3f}s"
    )

    return BatchInterpolationResponse(
        success=len(errors) == 0,  # Overall success if no errors
        results=results,
        errors=errors,
    )


@router.get("/{aoid}/interpolation-info")
@performance_monitor
def get_interpolation_info(
    aoid: int, db: Session = Depends(get_store), build: Build = Depends(get_build)
):
    """
    Get interpolation information for an item.

    Returns whether the item can be interpolated and its quality level ranges.
    """
    try:
        interpolation_service = InterpolationService(db, build)

        # Get interpolation ranges
        interpolation_ranges = interpolation_service.get_interpolation_ranges(aoid)

        if interpolation_ranges is None:
            raise HTTPException(
                status_code=404, detail=f"Item with AOID {aoid} not found"
            )

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
            "ql_range": overall_max - overall_min + 1,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get interpolation info for aoid={aoid}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get interpolation info: {str(e)}"
        )
