"""
Transitional lookup from internal item row ids to AOIDs.

Clients used to persist internal row ids of the store this one replaced (nano
favorites, symbiant farm lists, symbiant comparison links). Those ids mean
nothing to this store, so the client migrates what it has stored to AOIDs
once, through this endpoint. It answers from a copy of ``id -> aoid`` taken
from the database that issued the ids (``legacy_item_id``, see
``database/cas/004_legacy_item_ids.sql``), and is the only route that accepts
an internal item id.
"""

from typing import Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.store import Build, any_of, get_build, get_store, present
from app.store import tables as t

router = APIRouter(prefix="/legacy-item-ids", tags=["legacy"])

MAX_IDS_PER_REQUEST = 1000


class LegacyItemIdsRequest(BaseModel):
    item_ids: List[int] = Field(
        ...,
        max_length=MAX_IDS_PER_REQUEST,
        description="Internal item row ids, as issued for this game version's family",
    )


class LegacyItemIdsResponse(BaseModel):
    aoids: Dict[int, int] = Field(
        description="AOID per internal id; ids that name no item of this version "
        "are absent"
    )
    available: bool = Field(
        description="Whether the server holds the ids issued for this version's "
        "family. When false nothing can be resolved, which says nothing about "
        "the ids asked for: keep them and ask again later"
    )


@router.post("/resolve", response_model=LegacyItemIdsResponse)
def resolve_legacy_item_ids(
    request: LegacyItemIdsRequest,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
) -> LegacyItemIdsResponse:
    """Map internal item row ids to the AOIDs of the items they named, for the
    items present in the requested game version."""
    legacy = t.legacy_item_id
    in_family = legacy.c.branch == build.branch
    available = bool(db.scalar(select(exists().where(in_family))))
    if not available or not request.item_ids:
        return LegacyItemIdsResponse(aoids={}, available=available)

    rows = db.execute(
        select(legacy.c.item_id, legacy.c.aoid).where(
            in_family,
            any_of(legacy.c.item_id, request.item_ids),
            exists().where(
                t.item_presence.c.aoid == legacy.c.aoid,
                present(build),
            ),
        )
    )
    return LegacyItemIdsResponse(aoids=dict(rows.tuples().all()), available=True)
