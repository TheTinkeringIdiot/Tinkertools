"""
StatValues API endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import StatValue
from app.api.schemas import StatValueResponse

router = APIRouter(prefix="/stat-values", tags=["stat-values"])


@router.get("", response_model=List[StatValueResponse])
def get_stat_values(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get list of stat values.
    """
    stat_values = db.query(StatValue).offset(skip).limit(limit).all()
    return stat_values


@router.get("/{stat_value_id}", response_model=StatValueResponse)
def get_stat_value(stat_value_id: int, db: Session = Depends(get_db)):
    """
    Get a specific stat value by ID.
    """
    stat_value = db.query(StatValue).filter(StatValue.id == stat_value_id).first()
    
    if not stat_value:
        raise HTTPException(status_code=404, detail="Stat value not found")
    
    return stat_value