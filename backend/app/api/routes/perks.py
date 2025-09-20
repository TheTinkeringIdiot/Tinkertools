"""
Perk API endpoints for TinkerTools.

Handles perk queries, series details, and effect calculations.
Perks are items with spell_data that provide stat modifications following
three distinct type systems: SL (Shadowlands), AI (Alien Invasion), and LE (Lost Eden).
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc
import math
import logging

from app.core.database import get_db
from app.services.perk_service import PerkService
from app.api.schemas.perk import (
    PerkResponse, PerkDetail, PerkSeries, PerkSearchRequest,
    PerkStatsResponse, PerkCalculationRequest, PerkCalculationResponse,
    PerkValidationResponse, PerkSeriesResponse, PerkSeriesPerk
)
from app.api.schemas import PaginatedResponse
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/perks", tags=["perks"])
logger = logging.getLogger(__name__)


def get_perk_service(db: Session = Depends(get_db)) -> PerkService:
    """Dependency to get PerkService instance."""
    return PerkService(db)


async def _get_filtered_perks_from_service(
    perk_service: PerkService,
    type: Optional[str] = None,
    profession: Optional[str] = None,
    breed: Optional[str] = None,
    min_level: Optional[int] = None,
    max_level: Optional[int] = None,
    ai_level: Optional[int] = None,
    series: Optional[str] = None,
    search: Optional[str] = None,
    character_level: Optional[int] = None,
    character_profession: Optional[str] = None,
    character_breed: Optional[str] = None,
    ai_title_level: Optional[int] = None,
    available_sl_points: Optional[int] = None,
    available_ai_points: Optional[int] = None
) -> List[PerkResponse]:
    """
    Get filtered perks using efficient database queries.

    This function builds database queries to filter perks based on the new
    perks table structure, avoiding JSON-based filtering for better performance.
    """
    from app.models.perk import Perk
    from app.models.item import Item, ItemSpellData
    from sqlalchemy import and_, or_, func

    # Start with base query joining items with perks table
    query = perk_service.db.query(Item)\
        .join(Perk, Item.id == Perk.item_id)\
        .join(ItemSpellData, Item.id == ItemSpellData.item_id)

    # Apply basic filters using database queries
    if type:
        query = query.filter(Perk.type == type)

    if series:
        query = query.filter(Perk.perk_series == series)

    if search:
        query = query.filter(Perk.name.ilike(f'%{search}%'))

    # Apply level filtering
    if min_level is not None:
        query = query.filter(Perk.level_required >= min_level)
    if max_level is not None:
        query = query.filter(Perk.level_required <= max_level)

    # Apply AI level filtering
    if ai_level is not None:
        query = query.filter(Perk.ai_level_required <= ai_level)

    # Apply profession filtering (handle both name and ID)
    if profession:
        try:
            # Try as integer ID first
            profession_id = int(profession)
        except ValueError:
            # Convert name to ID
            profession_id = perk_service._profession_name_to_id(profession)

        if profession_id is not None:
            query = query.filter(
                or_(
                    func.array_length(Perk.professions, 1).is_(None),
                    func.array_length(Perk.professions, 1) == 0,
                    Perk.professions.contains([profession_id])
                )
            )

    # Apply breed filtering (handle both name and ID)
    if breed:
        try:
            # Try as integer ID first
            breed_id = int(breed)
        except ValueError:
            # Convert name to ID
            breed_id = perk_service._breed_name_to_id(breed)

        if breed_id is not None:
            query = query.filter(
                or_(
                    func.array_length(Perk.breeds, 1).is_(None),
                    func.array_length(Perk.breeds, 1) == 0,
                    Perk.breeds.contains([breed_id])
                )
            )

    # Execute query with proper loading of relationships
    from sqlalchemy.orm import joinedload
    results = query.options(
        joinedload(Item.perk),
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
    ).distinct().all()

    # Convert to response objects with character compatibility checks
    perk_responses = []
    for item in results:
        perk = item.perk
        if not perk:
            continue

        # Apply character compatibility filtering if provided
        if character_level is not None and perk.level_required > character_level:
            continue

        if character_profession and perk.professions and len(perk.professions) > 0:
            char_prof_id = perk_service._profession_name_to_id(character_profession)
            if char_prof_id and char_prof_id not in perk.professions:
                continue

        if character_breed and perk.breeds and len(perk.breeds) > 0:
            char_breed_id = perk_service._breed_name_to_id(character_breed)
            if char_breed_id and char_breed_id not in perk.breeds:
                continue

        if ai_title_level is not None and perk.ai_level_required > ai_title_level:
            continue

        # Check point affordability
        if not perk_service._is_affordable(
            perk.type, perk.counter, available_sl_points, available_ai_points, None, perk.name
        ):
            continue

        # Handle empty arrays as "all professions/breeds allowed"
        professions = perk_service._profession_ids_to_names(perk.professions or [])
        breeds = perk_service._breed_ids_to_names(perk.breeds or [])

        if not perk.professions or len(perk.professions) == 0:
            professions = []
        if not perk.breeds or len(perk.breeds) == 0:
            breeds = []

        perk_response = PerkResponse(
            id=item.id,
            aoid=item.aoid,
            name=perk.name,
            counter=perk.counter,
            type=perk.type,
            professions=professions,
            breeds=breeds,
            level=perk.level_required,
            ai_title=perk.ai_level_required if perk.ai_level_required > 0 else None,
            description=item.description,
            ql=item.ql,
            perk_series=perk.perk_series,
            formatted_name=f"{perk.name} {perk.counter}"
        )
        perk_responses.append(perk_response)

    return perk_responses


@router.get("", response_model=PaginatedResponse[PerkResponse])
@cached_response("perks_list")
@performance_monitor
async def get_perks(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    type: Optional[str] = Query(None, description="Filter by perk type (SL, AI, LE)"),
    profession: Optional[str] = Query(None, description="Filter by required profession name or ID"),
    breed: Optional[str] = Query(None, description="Filter by required breed name or ID"),
    min_level: Optional[int] = Query(None, description="Minimum character level requirement"),
    max_level: Optional[int] = Query(None, description="Maximum character level requirement"),
    ai_level: Optional[int] = Query(None, description="AI title level requirement"),
    series: Optional[str] = Query(None, description="Filter by perk series name"),
    search: Optional[str] = Query(None, description="Search by perk name"),
    character_level: Optional[int] = Query(None, description="Character level for compatibility filtering"),
    character_profession: Optional[str] = Query(None, description="Character profession for filtering"),
    character_breed: Optional[str] = Query(None, description="Character breed for filtering"),
    ai_title_level: Optional[int] = Query(None, description="Character AI title level"),
    available_sl_points: Optional[int] = Query(None, description="Available SL points"),
    available_ai_points: Optional[int] = Query(None, description="Available AI points"),
    sort_by: str = Query("name", description="Sort by: name, level, type, counter"),
    sort_desc: bool = Query(False, description="Sort descending"),
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Get paginated list of perks with filtering and character compatibility checks.

    This endpoint supports comprehensive filtering by perk attributes and character constraints.
    It can filter perks based on character level, profession, breed, series, and available points,
    ensuring only purchasable perks are returned when character data is provided.

    Examples:
        - Filter by series: ?series=Aimed Shot
        - Filter by profession: ?profession=Agent or ?profession=5
        - Filter by breed: ?breed=Solitus or ?breed=1
        - Filter by type: ?type=SL
        - Combined filters: ?series=Aimed Shot&profession=Agent&type=SL
    """
    logger.info(f"Getting perks: page={page}, series={series}, profession={profession}, type={type}")

    # Get filtered perks using database queries for better performance
    filtered_perks = await _get_filtered_perks_from_service(
        perk_service=perk_service,
        type=type,
        profession=profession,
        breed=breed,
        min_level=min_level,
        max_level=max_level,
        ai_level=ai_level,
        series=series,
        search=search,
        character_level=character_level,
        character_profession=character_profession,
        character_breed=character_breed,
        ai_title_level=ai_title_level,
        available_sl_points=available_sl_points,
        available_ai_points=available_ai_points
    )

    # Apply sorting
    reverse = sort_desc
    if sort_by == "name":
        filtered_perks.sort(key=lambda p: p.name, reverse=reverse)
    elif sort_by == "level":
        filtered_perks.sort(key=lambda p: p.level, reverse=reverse)
    elif sort_by == "type":
        filtered_perks.sort(key=lambda p: p.type, reverse=reverse)
    elif sort_by == "counter":
        filtered_perks.sort(key=lambda p: p.counter, reverse=reverse)
    else:
        filtered_perks.sort(key=lambda p: p.name, reverse=reverse)

    # Apply pagination
    total = len(filtered_perks)
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    paginated_perks = filtered_perks[offset:offset + page_size]

    logger.info(f"Returning {len(paginated_perks)} perks (total: {total})")

    return PaginatedResponse[PerkResponse](
        items=paginated_perks,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/search", response_model=PaginatedResponse[PerkResponse])
@cached_response("perks_search")
@performance_monitor
async def search_perks(
    request: PerkSearchRequest,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Advanced perk search with comprehensive filtering options.

    This endpoint accepts a detailed search request with all filtering options
    and returns perks that match the criteria, including character compatibility
    checks and owned perk considerations.
    """
    logger.info(f"Advanced perk search with query: {request.query}")

    # Get available perks from service
    perks = await perk_service.get_available_perks(
        character_level=request.character_level,
        character_profession=request.character_professions[0] if request.character_professions else None,
        character_breed=request.character_breed,
        ai_title_level=request.ai_title_level,
        perk_types=request.types,
        available_sl_points=request.available_sl_points,
        available_ai_points=request.available_ai_points,
        owned_perks=request.owned_perks
    )

    # Apply search filters
    filtered_perks = []
    for perk in perks:
        # Text search
        if request.query and request.query.lower() not in perk.name.lower():
            continue

        # Profession filter
        if request.professions and not any(prof in perk.professions for prof in request.professions):
            continue

        # Breed filter
        if request.breeds and not any(breed in perk.breeds for breed in request.breeds):
            continue

        # Level range filter
        if request.level_range and len(request.level_range) == 2:
            if perk.level < request.level_range[0] or perk.level > request.level_range[1]:
                continue

        # AI title range filter
        if request.ai_title_range and len(request.ai_title_range) == 2 and perk.ai_title:
            if perk.ai_title < request.ai_title_range[0] or perk.ai_title > request.ai_title_range[1]:
                continue

        # Counter range filter
        if request.counter_range and len(request.counter_range) == 2:
            if perk.counter < request.counter_range[0] or perk.counter > request.counter_range[1]:
                continue

        filtered_perks.append(perk)

    # Apply sorting
    reverse = request.sort_descending
    if request.sort_by == "name":
        filtered_perks.sort(key=lambda p: p.name, reverse=reverse)
    elif request.sort_by == "level":
        filtered_perks.sort(key=lambda p: p.level, reverse=reverse)
    elif request.sort_by == "type":
        filtered_perks.sort(key=lambda p: p.type, reverse=reverse)
    elif request.sort_by == "cost":
        # Sort by cumulative cost (counter for SL/AI, 0 for LE)
        filtered_perks.sort(key=lambda p: p.counter if p.type in ['SL', 'AI'] else 0, reverse=reverse)
    else:
        filtered_perks.sort(key=lambda p: p.name, reverse=reverse)

    # Apply pagination
    total = len(filtered_perks)
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size
    paginated_perks = filtered_perks[offset:offset + page_size]

    logger.info(f"Advanced search returning {len(paginated_perks)} perks (total: {total})")

    return PaginatedResponse[PerkResponse](
        items=paginated_perks,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/stats", response_model=PerkStatsResponse)
@cached_response("perks_stats", ttl=3600)
@performance_monitor
async def get_perk_stats(
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Get statistics about available perks in the database.

    Returns aggregate information about perk types, profession/breed requirements,
    and level ranges to help with UI filtering and validation.
    """
    logger.info("Getting perk statistics")

    # Get all perks for statistics
    all_perks = await perk_service.get_available_perks()

    # Collect statistics
    types = set()
    professions = set()
    breeds = set()
    levels = []
    ai_titles = []
    series_names = set()

    for perk in all_perks:
        types.add(perk.type)
        professions.update(perk.professions)
        breeds.update(perk.breeds)
        levels.append(perk.level)
        if perk.ai_title:
            ai_titles.append(perk.ai_title)

        # Extract base perk name for series counting
        base_name = perk.name
        if ' ' in perk.name and perk.name.split()[-1].isdigit():
            base_name = ' '.join(perk.name.split()[:-1])
        series_names.add(base_name)

    level_range = [min(levels), max(levels)] if levels else [1, 220]
    ai_title_range = [min(ai_titles), max(ai_titles)] if ai_titles else [1, 30]

    stats = PerkStatsResponse(
        total_perks=len(all_perks),
        total_series=len(series_names),
        types=sorted(list(types)),
        professions=sorted(list(professions)),
        breeds=sorted(list(breeds)),
        level_range=level_range,
        ai_title_range=ai_title_range
    )

    logger.info(f"Perk stats: {stats.total_perks} perks, {stats.total_series} series")
    return stats


@router.get("/series", response_model=List[PerkSeriesResponse])
@cached_response("perks_series")
@performance_monitor
async def get_perk_series_grouped(
    profession: Optional[str] = Query(None, description="Filter by required profession"),
    breed: Optional[str] = Query(None, description="Filter by required breed"),
    type: Optional[str] = Query(None, description="Filter by perk type (SL, AI, LE)"),
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Get perks grouped by series name.

    Returns all perk series with their counters (1-10), showing profession/breed requirements,
    type information, and level requirements for each series.
    """
    logger.info(f"Getting perk series grouped - profession: {profession}, breed: {breed}, type: {type}")

    # Import Perk model here to avoid circular imports
    from app.models.perk import Perk
    from app.models.item import Item

    # Get database session from perk_service
    db = perk_service.db

    # Build base query to get all perks with their series
    query = db.query(Perk.perk_series, Perk.type, Perk.professions, Perk.breeds)\
        .join(Item, Perk.item_id == Item.id)\
        .distinct(Perk.perk_series)

    # Apply filtering
    if profession:
        # Convert profession name to ID for filtering
        profession_id = perk_service._profession_name_to_id(profession)
        if profession_id is not None:
            query = query.filter(
                or_(
                    func.array_length(Perk.professions, 1).is_(None),
                    func.array_length(Perk.professions, 1) == 0,
                    Perk.professions.contains([profession_id])
                )
            )

    if breed:
        # Convert breed name to ID for filtering
        breed_id = perk_service._breed_name_to_id(breed)
        if breed_id is not None:
            query = query.filter(
                or_(
                    func.array_length(Perk.breeds, 1).is_(None),
                    func.array_length(Perk.breeds, 1) == 0,
                    Perk.breeds.contains([breed_id])
                )
            )

    if type:
        query = query.filter(Perk.type == type)

    # Execute query to get series metadata
    series_results = query.all()

    # For each series, get all perks in that series
    series_responses = []

    for series_name, series_type, professions, breeds in series_results:
        # Get all perks in this series
        perks_query = db.query(Perk, Item.aoid)\
            .join(Item, Perk.item_id == Item.id)\
            .filter(Perk.perk_series == series_name)\
            .order_by(Perk.counter)

        perk_items = perks_query.all()

        # Convert to PerkSeriesPerk objects
        series_perks = []
        for perk, aoid in perk_items:
            series_perk = PerkSeriesPerk(
                counter=perk.counter,
                aoid=aoid,
                level_required=perk.level_required,
                ai_level_required=perk.ai_level_required if perk.ai_level_required > 0 else None
            )
            series_perks.append(series_perk)

        # Convert profession and breed IDs to names
        profession_names = perk_service._profession_ids_to_names(professions or [])
        breed_names = perk_service._breed_ids_to_names(breeds or [])

        # Create series response
        series_response = PerkSeriesResponse(
            series_name=series_name,
            type=series_type,
            professions=profession_names,
            breeds=breed_names,
            perks=series_perks
        )
        series_responses.append(series_response)

    # Sort by series name
    series_responses.sort(key=lambda s: s.series_name)

    logger.info(f"Found {len(series_responses)} perk series")
    return series_responses


@router.get("/{perk_name}", response_model=PerkSeries)
@cached_response("perk_series")
@performance_monitor
async def get_perk_series(
    perk_name: str,
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Get complete perk series with all levels (1-10) for a specific perk.

    Returns detailed information about each level including requirements,
    effects, spell data, and point costs. Useful for displaying perk
    progression trees and calculating upgrade paths.
    """
    logger.info(f"Getting perk series for '{perk_name}'")

    perk_series = await perk_service.get_perk_series(perk_name)

    if not perk_series:
        raise HTTPException(status_code=404, detail=f"Perk series '{perk_name}' not found")

    logger.info(f"Found perk series '{perk_name}' with {len(perk_series.levels)} levels")
    return perk_series


@router.post("/calculate", response_model=PerkCalculationResponse)
@performance_monitor
async def calculate_perk_effects(
    request: PerkCalculationRequest,
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Calculate total perk effects and point costs for a character build.

    Takes current and target perk states and calculates:
    - Total point costs for SL and AI perks
    - Available points based on character/AI levels
    - Aggregate stat effects from all owned perks
    - Affordability and requirement validation
    """
    logger.info(f"Calculating perk effects for character level {request.character_level}")

    # Calculate available points
    # SL points: 2 per character level from 15+ (max 40 at level 35+)
    sl_points_available = 0
    if request.character_level >= 15:
        sl_points_available = min(40, (request.character_level - 14) * 2)

    # AI points: 1 per AI title level (max 30)
    ai_points_available = 0
    if request.ai_title_level:
        ai_points_available = min(30, request.ai_title_level)

    # Calculate point costs
    total_sl_cost = 0
    total_ai_cost = 0

    for perk_name, target_level in request.target_perks.items():
        current_level = request.owned_perks.get(perk_name, 0)
        levels_to_buy = target_level - current_level

        if levels_to_buy > 0:
            # Get perk series to determine type
            perk_series = await perk_service.get_perk_series(perk_name)
            if perk_series:
                if perk_series.type == 'SL':
                    total_sl_cost += levels_to_buy
                elif perk_series.type == 'AI':
                    total_ai_cost += levels_to_buy
                # LE perks are free

    # Calculate remaining points
    sl_points_remaining = sl_points_available - total_sl_cost
    ai_points_remaining = ai_points_available - total_ai_cost

    # Check affordability
    affordable = sl_points_remaining >= 0 and ai_points_remaining >= 0

    # Calculate aggregate effects
    perk_effects = await perk_service.calculate_perk_effects(request.target_perks)

    # Check requirements (simplified for now)
    requirements_met = True
    blocking_requirements = []

    response = PerkCalculationResponse(
        total_sl_cost=total_sl_cost,
        total_ai_cost=total_ai_cost,
        available_sl_points=sl_points_available,
        available_ai_points=ai_points_available,
        sl_points_remaining=sl_points_remaining,
        ai_points_remaining=ai_points_remaining,
        affordable=affordable,
        requirements_met=requirements_met,
        blocking_requirements=blocking_requirements,
        perk_effects=perk_effects
    )

    logger.info(f"Calculated perk effects: SL={total_sl_cost}/{sl_points_available}, AI={total_ai_cost}/{ai_points_available}")
    return response


@router.get("/lookup/{aoid}")
@cached_response("perk_lookup")
@performance_monitor
async def lookup_perk_by_aoid(
    aoid: int,
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Look up a perk by its AOID (Anarchy Online ID).

    Used primarily for importing perks from external sources like AOSetups
    where only the AOID is provided. Returns basic perk information
    including name, type, level.
    """
    logger.info(f"Looking up perk by AOID: {aoid}")

    perk_info = await perk_service.get_perk_info_by_aoid(aoid)

    if not perk_info:
        # Return a 404 with null body for easier handling in frontend
        return None

    logger.info(f"Found perk: {perk_info['name']} (type: {perk_info.get('type', 'SL')}, level: {perk_info.get('counter', 1)})")
    return perk_info


@router.get("/{perk_name}/validate")
@performance_monitor
async def validate_perk_requirements(
    perk_name: str,
    target_level: int = Query(..., description="Target perk level to validate"),
    character_level: int = Query(..., description="Character level"),
    character_profession: str = Query(..., description="Character profession"),
    character_breed: str = Query(..., description="Character breed"),
    ai_title_level: Optional[int] = Query(None, description="Character AI title level"),
    owned_perks: Optional[str] = Query(None, description="JSON string of owned perks {name: level}"),
    perk_service: PerkService = Depends(get_perk_service)
):
    """
    Validate if a character can purchase a specific perk level.

    Checks all requirements including character level, profession, breed,
    AI title level, and sequential purchase requirements. Returns detailed
    validation results with specific error messages.
    """
    logger.info(f"Validating perk '{perk_name}' level {target_level} for character")

    # Parse owned perks
    owned_perks_dict = {}
    if owned_perks:
        try:
            import json
            owned_perks_dict = json.loads(owned_perks)
        except (json.JSONDecodeError, ValueError):
            logger.warning(f"Invalid owned_perks JSON: {owned_perks}")

    validation = await perk_service.validate_perk_requirements(
        perk_name=perk_name,
        target_level=target_level,
        character_level=character_level,
        character_profession=character_profession,
        character_breed=character_breed,
        ai_title_level=ai_title_level,
        owned_perks=owned_perks_dict
    )

    logger.info(f"Validation result: valid={validation.valid}, errors={len(validation.errors)}")
    return validation