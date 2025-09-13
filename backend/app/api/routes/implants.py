"""
Implant API endpoints for TinkerTools.

Provides endpoints for implant-specific operations like cluster-based lookup.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.services.implant_service import ImplantService
from app.api.schemas.implant import ImplantLookupRequest, ImplantLookupResponse
from app.api.schemas.item import ItemDetail, ItemResponse
from app.core.decorators import performance_monitor

router = APIRouter(prefix="/implants", tags=["implants"])
logger = logging.getLogger(__name__)


@router.post("/lookup", response_model=ImplantLookupResponse)
@performance_monitor
async def implant_lookup(
    request: ImplantLookupRequest,
    db: Session = Depends(get_db)
):
    """
    Look up an implant by slot, QL, and exact cluster combination.
    
    This endpoint finds an implant that matches the specified slot and cluster
    configuration exactly. If the target QL differs from available database
    entries, the item will be interpolated to the requested quality level.
    
    **Cluster Matching Rules:**
    - Must have ALL specified clusters with the exact STAT IDs
    - Must NOT have any additional clusters beyond those specified
    - Empty cluster positions are ignored (allows partial cluster configs)
    
    **Quality Level Optimization:**
    - For QL 1-200: Uses QL 1 base items for interpolation
    - For QL 201-300: Uses QL 201 base items for interpolation
    - Returns interpolated stats, spells, and requirements
    """
    try:
        logger.info(f"Implant lookup request: slot={request.slot}, ql={request.ql}, clusters={request.clusters}")
        
        # Create service instance
        implant_service = ImplantService(db)
        
        # Validate cluster combination
        if not implant_service.validate_cluster_combination(request.clusters):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid cluster combination: {request.clusters}"
            )
        
        # Perform lookup
        result = implant_service.lookup_implant(
            slot=request.slot,
            target_ql=request.ql,
            clusters=request.clusters
        )
        
        if not result:
            # No matching implant found
            return ImplantLookupResponse(
                success=False,
                message=f"No implant found for slot {request.slot} with clusters {request.clusters} at QL {request.ql}",
                interpolated=False
            )
        
        item_detail, was_interpolated, base_ql = result
        
        # Convert ItemDetail to dict for response
        item_dict = {
            "id": item_detail.id,
            "aoid": item_detail.aoid,
            "name": item_detail.name,
            "ql": item_detail.ql,
            "item_class": item_detail.item_class,
            "description": item_detail.description,
            "is_nano": item_detail.is_nano,
            "stats": [
                {"id": stat.id, "stat": stat.stat, "value": stat.value}
                for stat in item_detail.stats
            ] if item_detail.stats else [],
            "spell_data": [
                {
                    "id": spell.id,
                    "event": spell.event,
                    "spells": spell.spells
                }
                for spell in item_detail.spell_data
            ] if item_detail.spell_data else [],
            "attack_stats": [
                {"id": stat.id, "stat": stat.stat, "value": stat.value}
                for stat in item_detail.attack_stats
            ] if item_detail.attack_stats else [],
            "defense_stats": [
                {"id": stat.id, "stat": stat.stat, "value": stat.value}
                for stat in item_detail.defense_stats
            ] if item_detail.defense_stats else [],
            "actions": [
                {
                    "id": action.id,
                    "action": action.action,
                    "criteria": action.criteria
                }
                for action in item_detail.actions
            ] if item_detail.actions else [],
            "sources": item_detail.sources or []
        }
        
        success_message = f"Implant found successfully"
        if was_interpolated:
            success_message += f" (interpolated from QL {base_ql} to QL {request.ql})"
        
        logger.info(f"Implant lookup successful: AOID={item_detail.aoid}, interpolated={was_interpolated}")
        
        return ImplantLookupResponse(
            success=True,
            item=item_dict,
            message=success_message,
            interpolated=was_interpolated,
            base_ql=base_ql
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error during implant lookup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during implant lookup"
        )


@router.get("/slots/{slot}/available", response_model=List[ItemResponse])
@performance_monitor
async def get_available_implants(
    slot: int,
    ql: int = 1,
    db: Session = Depends(get_db)
):
    """
    Get all available implants for a specific slot.
    
    Returns a list of implant items available for the specified slot
    at the given quality level. Useful for discovering available
    cluster combinations.
    
    Args:
        slot: Implant slot position (1-13) or bitflag value (2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192)
        ql: Quality level to query (default: 1)
    """
    try:
        # Convert slot position (1-13) to bitflag if needed
        slot_position_to_bitflag = {
            1: 2,     # Eyes - 2^1
            2: 4,     # Head - 2^2  
            3: 8,     # Ears - 2^3
            4: 16,    # RightArm - 2^4
            5: 32,    # Chest - 2^5
            6: 64,    # LeftArm - 2^6
            7: 128,   # RightWrist - 2^7
            8: 256,   # Waist - 2^8
            9: 512,   # LeftWrist - 2^9
            10: 1024, # RightHand - 2^10
            11: 2048, # Legs - 2^11
            12: 4096, # LeftHand - 2^12
            13: 8192  # Feet - 2^13
        }
        
        valid_bitflags = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]
        
        # Check if slot is a position number (1-13) and convert to bitflag
        if slot in slot_position_to_bitflag:
            slot_bitflag = slot_position_to_bitflag[slot]
        # Check if slot is already a valid bitflag
        elif slot in valid_bitflags:
            slot_bitflag = slot
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid slot: {slot}. Must be position 1-13 or bitflag value from {valid_bitflags}"
            )
        
        implant_service = ImplantService(db)
        implants = implant_service.get_available_implants_for_slot(slot_bitflag, ql)
        
        # Convert to response format
        return [
            ItemResponse(
                id=item.id,
                aoid=item.aoid,
                name=item.name,
                ql=item.ql,
                item_class=item.item_class,
                description=item.description,
                is_nano=item.is_nano
            )
            for item in implants
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available implants for slot {slot}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error retrieving available implants"
        )


@router.post("/validate-clusters")
async def validate_cluster_combination(
    clusters: dict,
    db: Session = Depends(get_db)
):
    """
    Validate if a cluster combination is theoretically possible.
    
    Checks if the provided cluster configuration follows valid rules
    and could potentially exist as an implant.
    """
    try:
        implant_service = ImplantService(db)
        is_valid = implant_service.validate_cluster_combination(clusters)
        
        return {
            "valid": is_valid,
            "message": "Cluster combination is valid" if is_valid else "Invalid cluster combination"
        }
        
    except Exception as e:
        logger.error(f"Error validating clusters {clusters}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during cluster validation"
        )