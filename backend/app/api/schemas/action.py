"""
Pydantic schemas for Action models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from .criterion import ItemCriterionResponse


class ActionBase(BaseModel):
    """Base Action schema."""

    action: Optional[int] = Field(None, description="Action type ID")


class ActionCreate(ActionBase):
    """Schema for creating an Action."""

    item_id: int = Field(description="Item ID this action belongs to")


class ActionResponse(ActionBase):
    """An action as embedded in an item: its content only, no row ids."""

    criteria: List[ItemCriterionResponse] = Field(
        default_factory=list, description="Action criteria"
    )

    class Config:
        from_attributes = True
