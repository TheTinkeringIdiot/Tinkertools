"""
Transitional lookup from internal item row ids to AOIDs.

Clients used to persist internal row ids (nano favorites, early symbiant farm
lists). Those ids mean nothing outside the store that issued them, so the
client migrates what it has stored to AOIDs once, through this endpoint. It is
the only route that still accepts an internal item id, and it goes away with
the per-version store that issues them.
"""

from typing import Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Item

router = APIRouter(prefix="/legacy-item-ids", tags=["legacy"])

MAX_IDS_PER_REQUEST = 1000


class LegacyItemIdsRequest(BaseModel):
    item_ids: List[int] = Field(
        ...,
        max_length=MAX_IDS_PER_REQUEST,
        description="Internal item row ids, as issued by this game version",
    )


class LegacyItemIdsResponse(BaseModel):
    aoids: Dict[int, int] = Field(
        description="AOID per internal id; ids this version does not have are absent"
    )


@router.post("/resolve", response_model=LegacyItemIdsResponse)
def resolve_legacy_item_ids(
    request: LegacyItemIdsRequest, db: Session = Depends(get_db)
) -> LegacyItemIdsResponse:
    """Map internal item row ids of the requested game version to AOIDs."""
    ids = set(request.item_ids)
    if not ids:
        return LegacyItemIdsResponse(aoids={})

    rows = db.query(Item.id, Item.aoid).filter(Item.id.in_(ids)).all()
    return LegacyItemIdsResponse(
        aoids={item_id: aoid for item_id, aoid in rows if aoid is not None}
    )
