"""
Equipment Bonuses API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.services.equipment_bonus_service import EquipmentBonusService
from app.api.schemas import (
    EquipmentBonusRequest,
    EquipmentBonusResponse,
    ItemBonusDetailResponse,
    ErrorResponse
)
from app.core.decorators import performance_monitor

router = APIRouter(prefix="/equipment-bonuses", tags=["equipment-bonuses"])

# Set up logging
logger = logging.getLogger(__name__)


@router.post(
    "/calculate",
    response_model=EquipmentBonusResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request data"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Calculate equipment stat bonuses",
    description="""
    Calculate aggregated stat bonuses from a list of equipped items.

    This endpoint:
    - Accepts array of item IDs for equipped items
    - Queries spell_data relationships with spell_id=53045, 53012, 53014, 53175
    - Uses PostgreSQL JSONB operators to extract Stat/Amount parameters
    - Returns aggregated bonuses by STAT ID
    - Handles implant clusters separately from base items

    The response includes total bonuses aggregated by numeric STAT ID,
    along with counts for processed items and bonus stats.
    """
)
@performance_monitor
async def calculate_equipment_bonuses(
    request: EquipmentBonusRequest,
    db: Session = Depends(get_db)
) -> EquipmentBonusResponse:
    """Calculate equipment stat bonuses for equipped items."""

    try:
        if not request.item_ids:
            raise HTTPException(
                status_code=400,
                detail="At least one item ID must be provided"
            )

        logger.info(f"Calculating bonuses for {len(request.item_ids)} items")

        service = EquipmentBonusService(db)

        # Calculate bonuses from regular equipped items
        equipment_bonuses = service.calculate_equipment_bonuses(request.item_ids)

        # Handle implant clusters if provided
        if request.implant_clusters:
            cluster_bonuses = service.calculate_implant_cluster_bonuses(request.implant_clusters)

            # Merge cluster bonuses with equipment bonuses
            for stat_id, amount in cluster_bonuses.items():
                if stat_id in equipment_bonuses:
                    equipment_bonuses[stat_id] += amount
                else:
                    equipment_bonuses[stat_id] = amount

        return EquipmentBonusResponse(
            total_bonuses=equipment_bonuses,
            item_count=len(request.item_ids),
            bonus_count=len(equipment_bonuses)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating equipment bonuses: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while calculating equipment bonuses"
        )


@router.get(
    "/item/{item_id}",
    response_model=ItemBonusDetailResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Item not found"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Get detailed bonus breakdown for a single item",
    description="""
    Get detailed stat bonus breakdown for a single equipped item.

    This endpoint returns all stat bonuses provided by the specified item,
    useful for debugging equipment bonus calculations or displaying
    individual item contributions in the UI.
    """
)
@performance_monitor
async def get_item_bonus_detail(
    item_id: int,
    db: Session = Depends(get_db)
) -> ItemBonusDetailResponse:
    """Get detailed stat bonus breakdown for a single item."""

    try:
        logger.info(f"Getting bonus detail for item {item_id}")

        service = EquipmentBonusService(db)
        item_bonuses = service.get_item_bonus_breakdown(item_id)

        return ItemBonusDetailResponse(
            item_id=item_id,
            bonuses=item_bonuses
        )

    except Exception as e:
        logger.error(f"Error getting item bonus detail: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting item bonus detail"
        )


@router.post(
    "/batch-items",
    response_model=List[ItemBonusDetailResponse],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request data"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    summary="Get bonus breakdown for multiple items",
    description="""
    Get detailed stat bonus breakdown for multiple items.

    Returns a list of bonus breakdowns, one for each item in the request.
    Items with no bonuses will still be included in the response with
    an empty bonuses dictionary.
    """
)
@performance_monitor
async def get_batch_item_bonus_details(
    item_ids: List[int],
    db: Session = Depends(get_db)
) -> List[ItemBonusDetailResponse]:
    """Get detailed stat bonus breakdown for multiple items."""

    try:
        if not item_ids:
            raise HTTPException(
                status_code=400,
                detail="At least one item ID must be provided"
            )

        logger.info(f"Getting bonus details for {len(item_ids)} items")

        service = EquipmentBonusService(db)
        results = []

        for item_id in item_ids:
            item_bonuses = service.get_item_bonus_breakdown(item_id)
            results.append(ItemBonusDetailResponse(
                item_id=item_id,
                bonuses=item_bonuses
            ))

        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch item bonus details: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while getting batch item bonus details"
        )