"""
Pydantic schemas for Action models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from .criterion import CriterionResponse


class ActionBase(BaseModel):
    """Base Action schema."""
    action: Optional[int] = Field(None, description="Action type ID")


class ActionCreate(ActionBase):
    """Schema for creating an Action."""
    item_id: int = Field(description="Item ID this action belongs to")


class ActionResponse(ActionBase):
    """Schema for Action responses."""
    id: int = Field(description="Action ID")
    item_id: int = Field(description="Item ID")
    criteria: List[CriterionResponse] = Field(default_factory=list, description="Action criteria")
    
    class Config:
        from_attributes = True