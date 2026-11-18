"""
Items API endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import ColumnElement
import time
import logging

from app.store import tables as t
from app.store.context import Build, get_build, get_store
from app.store.items import load_item_details
from app.store.presence import (
    fetch_page,
    fetch_search_page,
    page_fields,
    revisions,
)
from app.models.interpolated_item import (
    InterpolationResponse,
    BatchInterpolationRequest,
    BatchInterpolationResponse,
    BatchItemResult,
)
from app.services.interpolation import InterpolationService
from app.api.schemas import ItemDetail, PaginatedResponse
from app.core.decorators import cached_response, performance_monitor
from app.api.services.item_search import (
    common_item_filters,
    full_text_match,
    parse_search_fields,
    substring_match,
)

router = APIRouter(prefix="/items", tags=["items"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


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
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Get paginated list of items with optional filters and complete item details.
    """
    revision = t.item_revision
    query = revisions(build)

    # NOTE: item_class is NOT used for nano filtering - use is_nano=true instead
    if item_class:
        query = query.where(revision.c.item_class == item_class)
    if min_ql is not None:
        query = query.where(revision.c.ql >= min_ql)
    if max_ql is not None:
        query = query.where(revision.c.ql <= max_ql)
    if is_nano is not None:
        query = query.where(revision.c.is_nano == is_nano)

    query = query.where(
        *common_item_filters(
            build,
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
    )

    found = fetch_page(db, query, [], page, page_size)

    return PaginatedResponse[ItemDetail](
        items=load_item_details(db, build, rev_ids=found.rev_ids),
        **page_fields(found.total, page, page_size),
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
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Search items by name or description using exact matching (default) or fuzzy/stemmed search.
    Returns complete item details including stats, spells, and attack/defense data.

    Exact matches are sorted by name. Stemmed matches are sorted by rank, or by
    name when only weapons are asked for. Ties end on the AOID.
    """
    start_time = time.time()
    fields_to_search = parse_search_fields(search_fields)
    revision = t.item_revision
    text = t.part_text

    query = revisions(build).join(text, text.c.text_id == revision.c.text_id)
    sort_key: ColumnElement = text.c.name
    by_rank = not exact_match and not weapons
    if exact_match:
        query = query.where(substring_match(fields_to_search, q))
    else:
        matches, rank = full_text_match(fields_to_search, q)
        query = query.where(matches)
        if by_rank:
            sort_key = rank

    if weapons:
        query = query.where(revision.c.atkdef_id.isnot(None))
    if min_ql is not None:
        query = query.where(revision.c.ql >= min_ql)
    if max_ql is not None:
        query = query.where(revision.c.ql <= max_ql)
    if item_class is not None and item_class > 0:
        query = query.where(revision.c.item_class == item_class)

    query = query.where(
        *common_item_filters(
            build,
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
    )

    found = fetch_search_page(
        db, query, [sort_key.desc() if by_rank else sort_key], page, page_size
    )
    items = load_item_details(db, build, rev_ids=found.rev_ids)

    query_time = time.time() - start_time
    search_method = "exact_ilike" if exact_match else "fuzzy_fulltext"
    logger.info(
        f"Item search query='{q}' fields={fields_to_search} results={found.total} "
        f"time={query_time:.3f}s method={search_method}"
    )

    return PaginatedResponse[ItemDetail](
        items=items, **page_fields(found.total, page, page_size)
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
