"""
Symbiants API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
import time
import logging
import math

from app.core.database import get_db
from app.models import (
    SymbiantItem, Mob, Source, SourceType, ItemSource, Item, Action, ActionCriteria,
    ItemSpellData, SpellData, SpellDataSpells, Spell, SpellCriterion, Criterion
)
from app.api.schemas.symbiant import SymbiantResponse, SymbiantWithDropsResponse, MobDropInfo
from app.api.schemas.action import ActionResponse
from app.api.schemas.criterion import CriterionResponse
from app.api.schemas.spell import SpellDataResponse, SpellWithCriteria
from app.api.schemas import PaginatedResponse
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/symbiants", tags=["symbiants"])

# Set up logging for performance monitoring
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedResponse[SymbiantResponse])
@cached_response("symbiants")
@performance_monitor
def list_symbiants(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
) -> PaginatedResponse[SymbiantResponse]:
    """
    List symbiants with pagination.

    Pagination parameters:
    - page: Page number (1-indexed)
    - page_size: Number of items per page (default: 50, max: 200)

    Returns paginated symbiants in the database with default ordering.
    """
    start_time = time.time()

    # Base query with ordering
    base_query = (
        db.query(SymbiantItem)
        .order_by(
            SymbiantItem.family.asc(),
            SymbiantItem.ql.asc(),
            SymbiantItem.name.asc()
        )
    )

    # Get total count
    total = base_query.count()

    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Get paginated results
    symbiants = base_query.limit(page_size).offset(offset).all()

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
    logger.info(f"Symbiant list query page={page} page_size={page_size} results={len(symbiant_responses)}/{total} time={query_time:.3f}s")

    return PaginatedResponse[SymbiantResponse](
        items=symbiant_responses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )


@router.get("/{symbiant_id}/dropped-by", response_model=List[MobDropInfo])
@cached_response("symbiant_sources")
@performance_monitor
def get_symbiant_sources(
    symbiant_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all pocket bosses that drop this symbiant.

    Uses the sources system to query mobs via:
    Mob -> Source -> ItemSource -> SymbiantItem

    Only returns mobs where is_pocket_boss = TRUE.

    Args:
        symbiant_id: Database ID of the symbiant (from symbiant_items view)
    """
    start_time = time.time()

    # Verify symbiant exists
    symbiant = db.query(SymbiantItem).filter(SymbiantItem.id == symbiant_id).first()
    if not symbiant:
        raise HTTPException(status_code=404, detail="Symbiant not found")

    # Get source_type_id for 'mob'
    source_type = db.query(SourceType).filter(SourceType.name == 'mob').first()
    if not source_type:
        raise HTTPException(status_code=500, detail="Source type 'mob' not found in database")

    # Query mobs via sources (only pocket bosses)
    query = (
        db.query(Mob)
        .join(Source, Source.source_id == Mob.id)
        .join(ItemSource, ItemSource.source_id == Source.id)
        .filter(
            and_(
                ItemSource.item_id == symbiant_id,
                Source.source_type_id == source_type.id,
                Mob.is_pocket_boss == True
            )
        )
    )

    # Order by level and name
    query = query.order_by(Mob.level.asc(), Mob.name.asc())

    mobs = query.all()

    # Log performance metrics
    query_time = time.time() - start_time
    logger.info(f"Symbiant sources query symbiant_id={symbiant_id} results={len(mobs)} time={query_time:.3f}s")

    return [
        MobDropInfo(
            id=m.id,
            name=m.name,
            level=m.level,
            location=m.location,
            playfield=m.playfield,
            is_pocket_boss=m.is_pocket_boss
        )
        for m in mobs
    ]


@router.get("/{symbiant_id}", response_model=SymbiantResponse)
@cached_response("symbiants")
@performance_monitor
def get_symbiant(symbiant_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific symbiant.
    """
    symbiant = db.query(SymbiantItem).filter(SymbiantItem.id == symbiant_id).first()

    if not symbiant:
        raise HTTPException(status_code=404, detail="Symbiant not found")

    # Get actions/criteria and spell_data from Item table
    item = (
        db.query(Item)
        .filter(Item.id == symbiant_id)
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
        .first()
    )

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

    return SymbiantResponse(
        id=symbiant.id,
        aoid=symbiant.aoid,
        name=symbiant.name,
        ql=symbiant.ql,
        slot_id=symbiant.slot_id,
        family=symbiant.family,
        spell_data=spell_data_list,
        actions=actions
    )
