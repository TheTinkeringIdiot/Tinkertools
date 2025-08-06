"""
Pydantic schemas for Item models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from .stat_value import StatValueResponse
from .spell import SpellWithCriteria


class ItemBase(BaseModel):
    """Base Item schema."""
    aoid: int = Field(description="Anarchy Online item ID")
    name: str = Field(description="Item name")
    ql: int = Field(description="Quality level")
    item_class: Optional[str] = Field(None, description="Item class/category")
    slot: Optional[str] = Field(None, description="Equipment slot")
    default_pos: Optional[str] = Field(None, description="Default position")
    max_mass: Optional[int] = Field(None, description="Maximum mass")
    duration: Optional[int] = Field(None, description="Duration in seconds")
    icon: Optional[int] = Field(None, description="Icon ID")
    apply_on_friendly: bool = Field(False, description="Can apply on friendly targets")
    apply_on_hostile: bool = Field(False, description="Can apply on hostile targets")
    apply_on_self: bool = Field(False, description="Can apply on self")
    dont_apply_on_self: bool = Field(False, description="Cannot apply on self")
    can_pick_up: bool = Field(True, description="Can be picked up")
    flags: Optional[int] = Field(None, description="Item flags")
    description: Optional[str] = Field(None, description="Item description")
    is_nano: bool = Field(False, description="Is this a nano program")


class ItemCreate(ItemBase):
    """Schema for creating an Item."""
    animation_mesh_id: Optional[int] = None
    attack_defense_id: Optional[int] = None


class ItemResponse(ItemBase):
    """Schema for Item responses."""
    id: int = Field(description="Database ID")
    
    class Config:
        from_attributes = True


class ItemDetail(ItemResponse):
    """Detailed Item response with related data."""
    stats: List[StatValueResponse] = Field(default_factory=list, description="Item stats")
    spells: List[SpellWithCriteria] = Field(default_factory=list, description="Item spells")
    attack_stats: List[StatValueResponse] = Field(default_factory=list, description="Attack stats")
    defense_stats: List[StatValueResponse] = Field(default_factory=list, description="Defense stats")
    
    class Config:
        from_attributes = True


class ItemSearch(BaseModel):
    """Item search parameters."""
    q: Optional[str] = Field(None, description="Search query")
    item_class: Optional[str] = Field(None, description="Filter by item class")
    min_ql: Optional[int] = Field(None, description="Minimum quality level")
    max_ql: Optional[int] = Field(None, description="Maximum quality level")
    slot: Optional[str] = Field(None, description="Filter by equipment slot")
    is_nano: Optional[bool] = Field(None, description="Filter nano programs")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=200, description="Items per page")