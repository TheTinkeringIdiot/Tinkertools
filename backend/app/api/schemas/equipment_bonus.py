"""
Equipment Bonus Pydantic schemas for API request/response models.
"""

from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class EquipmentBonusRequest(BaseModel):
    """Request model for equipment bonus calculation."""
    item_ids: List[int] = Field(description="List of item IDs for equipped items")
    implant_clusters: Optional[Dict[str, Dict[str, int]]] = Field(
        None,
        description="Optional implant cluster data mapping slot names to stat mappings"
    )


class StatBonus(BaseModel):
    """Individual stat bonus information."""
    stat_id: int = Field(description="Numeric STAT ID")
    amount: int = Field(description="Bonus amount (can be negative)")


class ItemBonusBreakdown(BaseModel):
    """Detailed breakdown of bonuses from a single item."""
    item_id: int = Field(description="Item ID")
    bonuses: List[StatBonus] = Field(description="List of stat bonuses from this item")


class EquipmentBonusResponse(BaseModel):
    """Response model for equipment bonus calculation."""
    total_bonuses: Dict[int, int] = Field(
        description="Total bonuses aggregated by STAT ID"
    )
    item_count: int = Field(description="Number of items processed")
    bonus_count: int = Field(description="Number of different stats with bonuses")

    class Config:
        json_schema_extra = {
            "example": {
                "total_bonuses": {
                    "19": 25,  # Intelligence +25
                    "20": 15,  # Psychic +15
                    "124": 50  # Max Health +50
                },
                "item_count": 5,
                "bonus_count": 3
            }
        }


class ItemBonusDetailResponse(BaseModel):
    """Response model for detailed item bonus breakdown."""
    item_id: int = Field(description="Item ID that was analyzed")
    bonuses: Dict[int, int] = Field(description="Stat bonuses from this item by STAT ID")

    class Config:
        json_schema_extra = {
            "example": {
                "item_id": 12345,
                "bonuses": {
                    "19": 10,  # Intelligence +10
                    "124": 25  # Max Health +25
                }
            }
        }