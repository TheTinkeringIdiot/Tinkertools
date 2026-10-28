"""
StatValues API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (
    StatValue,
    Item,
    ItemStats,
    AttackDefenseAttack,
    AttackDefenseDefense,
    AnimationMesh,
)
from app.api.schemas import StatValueResponse
from app.core.decorators import cached_response, performance_monitor

router = APIRouter(prefix="/stat-values", tags=["stat-values"])


def stat_value_in_current_version():
    """
    Clause: the outer stat value is used by an item of the current version.

    Items reference stat values through item_stats, their attack/defense stats
    and their animation/mesh. When content tables are shared across versions,
    ``stat_values`` holds every version's values, so the listing joins back to
    the version's ``items``.
    """
    used_as_stat = (
        select(1)
        .select_from(ItemStats)
        .join(Item, Item.id == ItemStats.item_id)
        .where(ItemStats.stat_value_id == StatValue.id)
    )
    used_in_attack = (
        select(1)
        .select_from(AttackDefenseAttack)
        .join(Item, Item.atkdef_id == AttackDefenseAttack.attack_defense_id)
        .where(AttackDefenseAttack.stat_value_id == StatValue.id)
    )
    used_in_defense = (
        select(1)
        .select_from(AttackDefenseDefense)
        .join(Item, Item.atkdef_id == AttackDefenseDefense.attack_defense_id)
        .where(AttackDefenseDefense.stat_value_id == StatValue.id)
    )
    # One clause per animation_mesh column: an OR inside a single EXISTS
    # cannot use either column's index and scans every item.
    used_as_animation = (
        select(1)
        .select_from(AnimationMesh)
        .join(Item, Item.animation_mesh_id == AnimationMesh.id)
        .where(AnimationMesh.animation_id == StatValue.id)
    )
    used_as_mesh = (
        select(1)
        .select_from(AnimationMesh)
        .join(Item, Item.animation_mesh_id == AnimationMesh.id)
        .where(AnimationMesh.mesh_id == StatValue.id)
    )
    return or_(
        *(
            q.correlate(StatValue).exists()
            for q in (
                used_as_stat,
                used_in_attack,
                used_in_defense,
                used_as_animation,
                used_as_mesh,
            )
        )
    )


@router.get("", response_model=List[StatValueResponse])
@cached_response("stats")
@performance_monitor
def get_stat_values(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get list of stat values used by the current version's items.
    """
    stat_values = (
        db.query(StatValue)
        .filter(stat_value_in_current_version())
        .order_by(StatValue.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return stat_values


@router.get("/{stat_value_id}", response_model=StatValueResponse)
@cached_response("stats")
@performance_monitor
def get_stat_value(stat_value_id: int, db: Session = Depends(get_db)):
    """
    Get a specific stat value by ID.
    """
    stat_value = db.query(StatValue).filter(StatValue.id == stat_value_id).first()

    if not stat_value:
        raise HTTPException(status_code=404, detail="Stat value not found")

    return stat_value
