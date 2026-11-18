"""
Implant API endpoints for TinkerTools.

Provides endpoints for implant-specific operations like cluster-based lookup.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.store.context import Build, get_build, get_store
from app.services.implant_service import ImplantService
from app.api.schemas.implant import ImplantLookupRequest, ImplantLookupResponse
from app.core.decorators import performance_monitor

router = APIRouter(prefix="/implants", tags=["implants"])
logger = logging.getLogger(__name__)


@router.post("/lookup", response_model=ImplantLookupResponse)
@performance_monitor
def implant_lookup(
    request: ImplantLookupRequest,
    db: Session = Depends(get_store),
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
        implant_service = ImplantService(db, build)

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

        success_message = "Implant found successfully"
        if was_interpolated:
            success_message += f" (interpolated from QL {base_ql} to QL {request.ql})"

        logger.info(
            f"Implant lookup successful: AOID={item_detail.aoid}, interpolated={was_interpolated}"
        )

        return ImplantLookupResponse(
            success=True,
            item=item_detail.model_dump(),
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
