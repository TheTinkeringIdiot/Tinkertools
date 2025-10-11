"""
Mobs API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, func
import math
import time
import logging

from app.core.database import get_db
from app.models import (
    Mob, SymbiantItem, Source, SourceType, ItemSource, Item, Action, ActionCriteria,
    ItemSpellData, SpellData, SpellDataSpells, Spell, SpellCriterion, Criterion
)
from app.api.schemas.mob import MobResponse, MobDetail, SymbiantDropInfo
from app.api.schemas.symbiant import SymbiantResponse
from app.api.schemas.action import ActionResponse
from app.api.schemas.criterion import CriterionResponse
from app.api.schemas.spell import SpellDataResponse, SpellWithCriteria
from app.api.schemas import PaginatedResponse
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/mobs", tags=["mobs"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[MobResponse])
@cached_response("mobs")
@performance_monitor
def list_mobs(
    is_pocket_boss: Optional[bool] = Query(None, description="Filter pocket bosses"),
    playfield: Optional[str] = Query(None, description="Filter by playfield"),
    min_level: Optional[int] = Query(None, description="Minimum mob level"),
    max_level: Optional[int] = Query(None, description="Maximum mob level"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    List all mobs with optional filtering.

    Filters:
    - is_pocket_boss: Filter by pocket boss status
    - playfield: Filter by playfield name (partial match)
    - min_level/max_level: Filter by level range
    """
    start_time = time.time()

    query = db.query(Mob)

    # Apply filters
    if is_pocket_boss is not None:
        query = query.filter(Mob.is_pocket_boss == is_pocket_boss)
    if playfield:
        query = query.filter(Mob.playfield.ilike(f"%{playfield}%"))
    if min_level is not None:
        query = query.filter(Mob.level >= min_level)
    if max_level is not None:
        query = query.filter(Mob.level <= max_level)

    # Order by level then name for consistent sorting
    query = query.order_by(Mob.level.asc(), Mob.name.asc())

    # Get total count
    total = query.count()

    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Get mobs for current page
    mobs = query.offset(offset).limit(page_size).all()

    # Get source_type_id for 'mob' to count symbiant drops
    source_type = db.query(SourceType).filter(SourceType.name == 'mob').first()

    # Build drop counts for all mobs on current page
    symbiant_counts = {}
    if source_type and mobs:
        mob_ids = [mob.id for mob in mobs]

        # Query to count symbiant drops per mob
        drop_count_query = (
            db.query(
                Mob.id,
                func.count(ItemSource.item_id).label('symbiant_count')
            )
            .outerjoin(Source, and_(
                Source.source_id == Mob.id,
                Source.source_type_id == source_type.id
            ))
            .outerjoin(ItemSource, ItemSource.source_id == Source.id)
            .filter(Mob.id.in_(mob_ids))
            .group_by(Mob.id)
        )

        # Build lookup dictionary
        for mob_id, count in drop_count_query.all():
            symbiant_counts[mob_id] = count

    # Build response with symbiant_count
    mob_responses = [
        MobResponse(
            id=mob.id,
            name=mob.name,
            level=mob.level,
            playfield=mob.playfield,
            location=mob.location,
            mob_names=mob.mob_names,
            is_pocket_boss=mob.is_pocket_boss,
            symbiant_count=symbiant_counts.get(mob.id, 0)
        )
        for mob in mobs
    ]

    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Mob list query is_pocket_boss={is_pocket_boss} playfield='{playfield}' level:{min_level}-{max_level} results={total} time={query_time:.3f}s")

    return PaginatedResponse[MobResponse](
        items=mob_responses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{mob_id}/drops", response_model=List[SymbiantResponse])
@cached_response("mob_drops")
@performance_monitor
def get_mob_drops(
    mob_id: int,
    family: Optional[str] = Query(None, description="Filter by symbiant family"),
    db: Session = Depends(get_db)
):
    """
    Get all symbiants dropped by this mob with actions for level extraction.

    Uses the sources system to query symbiants via:
    SymbiantItem -> ItemSource -> Source -> Mob

    Args:
        mob_id: Database ID of the mob
        family: Optional filter by symbiant family (Artillery, Control, etc.)
    """
    start_time = time.time()

    # Verify mob exists
    mob = db.query(Mob).filter(Mob.id == mob_id).first()
    if not mob:
        raise HTTPException(status_code=404, detail="Mob not found")

    # Get source_type_id for 'mob'
    source_type = db.query(SourceType).filter(SourceType.name == 'mob').first()
    if not source_type:
        raise HTTPException(status_code=500, detail="Source type 'mob' not found in database")

    # Query symbiants via sources
    query = (
        db.query(SymbiantItem)
        .join(ItemSource, SymbiantItem.id == ItemSource.item_id)
        .join(Source, ItemSource.source_id == Source.id)
        .filter(
            and_(
                Source.source_id == mob_id,
                Source.source_type_id == source_type.id
            )
        )
    )

    # Apply family filter if provided
    if family:
        query = query.filter(SymbiantItem.family == family)

    # Order by QL and name
    query = query.order_by(SymbiantItem.ql.asc(), SymbiantItem.name.asc())

    symbiants = query.all()

    # Get actions/criteria and spell_data for each symbiant by joining with Item table
    symbiant_ids = [s.id for s in symbiants]
    items_query = (
        db.query(Item)
        .filter(Item.id.in_(symbiant_ids))
        .options(
            joinedload(Item.actions)
            .joinedload(Action.action_criteria)
            .joinedload(ActionCriteria.criterion),
            joinedload(Item.item_spell_data)
            .joinedload(ItemSpellData.spell_data)
            .joinedload(SpellData.spell_data_spells)
            .joinedload(SpellDataSpells.spell)
            .joinedload(Spell.spell_criteria)
            .joinedload(SpellCriterion.criterion)
        )
    )
    items = {item.id: item for item in items_query.all()}

    # Build response with actions and spell_data
    symbiant_responses = []
    for symbiant in symbiants:
        item = items.get(symbiant.id)
        actions = []
        spell_data_list = []

        if item:
            # Build actions
            if item.actions:
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

            # Build spell_data
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

        symbiant_responses.append(SymbiantResponse(
            id=symbiant.id,
            aoid=symbiant.aoid,
            name=symbiant.name,
            ql=symbiant.ql,
            slot_id=symbiant.slot_id,
            family=symbiant.family,
            spell_data=spell_data_list,
            actions=actions
        ))

    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Mob drops query mob_id={mob_id} family='{family}' results={len(symbiants)} time={query_time:.3f}s")

    return symbiant_responses


@router.get("/{mob_id}", response_model=MobResponse)
@cached_response("mobs")
@performance_monitor
def get_mob(mob_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific mob.
    """
    mob = db.query(Mob).filter(Mob.id == mob_id).first()

    if not mob:
        raise HTTPException(status_code=404, detail="Mob not found")

    # Get source_type_id for 'mob' to count symbiant drops
    source_type = db.query(SourceType).filter(SourceType.name == 'mob').first()

    # Count symbiant drops for this mob
    symbiant_count = 0
    if source_type:
        symbiant_count = (
            db.query(func.count(ItemSource.item_id))
            .select_from(Source)
            .outerjoin(ItemSource, ItemSource.source_id == Source.id)
            .filter(
                and_(
                    Source.source_id == mob_id,
                    Source.source_type_id == source_type.id
                )
            )
            .scalar()
        ) or 0

    return MobResponse(
        id=mob.id,
        name=mob.name,
        level=mob.level,
        playfield=mob.playfield,
        location=mob.location,
        mob_names=mob.mob_names,
        is_pocket_boss=mob.is_pocket_boss,
        symbiant_count=symbiant_count
    )
