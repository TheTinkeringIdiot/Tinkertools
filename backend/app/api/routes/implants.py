"""
Implant API endpoints for TinkerTools.

Provides endpoints for implant-specific operations like cluster-based lookup.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.core.database import get_db
from app.store.context import Build, get_build, get_store
from app.services.implant_service import ImplantService
from app.services.interpolation import InterpolationService
from app.api.schemas.implant import ImplantLookupRequest, ImplantLookupResponse
from app.core.decorators import performance_monitor

router = APIRouter(prefix="/implants", tags=["implants"])
logger = logging.getLogger(__name__)


@router.post("/lookup", response_model=ImplantLookupResponse)
@performance_monitor
def implant_lookup(
    request: ImplantLookupRequest,
    db: Session = Depends(get_db),
    store: Session = Depends(get_store),
    build: Build = Depends(get_build),
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
        logger.info(
            f"Implant lookup request: slot={request.slot}, ql={request.ql}, clusters={request.clusters}"
        )

        # Create service instance
        implant_service = ImplantService(db, InterpolationService(store, build))

        # Perform lookup
        result = implant_service.lookup_implant(
            slot=request.slot, target_ql=request.ql, clusters=request.clusters
        )

        if not result:
            # No matching implant found
            return ImplantLookupResponse(
                success=False,
                message=f"No implant found for slot {request.slot} with clusters {request.clusters} at QL {request.ql}",
                interpolated=False,
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
            "stats": (
                [{"stat": stat.stat, "value": stat.value} for stat in item_detail.stats]
                if item_detail.stats
                else []
            ),
            "spell_data": (
                [
                    {"event": spell.event, "spells": spell.spells}
                    for spell in item_detail.spell_data
                ]
                if item_detail.spell_data
                else []
            ),
            "attack_stats": (
                [
                    {"stat": stat.stat, "value": stat.value}
                    for stat in item_detail.attack_stats
                ]
                if item_detail.attack_stats
                else []
            ),
            "defense_stats": (
                [
                    {"stat": stat.stat, "value": stat.value}
                    for stat in item_detail.defense_stats
                ]
                if item_detail.defense_stats
                else []
            ),
            "actions": (
                [
                    {
                        "action": action.action,
                        "criteria": action.criteria,
                    }
                    for action in item_detail.actions
                ]
                if item_detail.actions
                else []
            ),
            "sources": item_detail.sources or [],
        }

        success_message = "Implant found successfully"
        if was_interpolated:
            success_message += f" (interpolated from QL {base_ql} to QL {request.ql})"

        logger.info(
            f"Implant lookup successful: AOID={item_detail.aoid}, interpolated={was_interpolated}"
        )

        return ImplantLookupResponse(
            success=True,
            item=item_dict,
            message=success_message,
            interpolated=was_interpolated,
            base_ql=base_ql,
        )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error during implant lookup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during implant lookup",
        )
