"""
Pydantic schemas for Item models.
"""

from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from .stat_value import StatValueResponse
from .spell import SpellWithCriteria, SpellDataResponse
from .action import ActionResponse


class ItemRequirement(BaseModel):
    """Schema for item requirements."""
    stat: int = Field(description="Stat ID")
    value: int = Field(description="Required value")
    operator: str = Field(description="Comparison operator")


class ItemBase(BaseModel):
    """Base Item schema."""
    aoid: Optional[int] = Field(None, description="Anarchy Online item ID")
    name: str = Field(description="Item name")
    ql: Optional[int] = Field(None, description="Quality level")
    item_class: Optional[int] = Field(None, description="Item class/category")
    description: Optional[str] = Field(None, description="Item description")
    is_nano: bool = Field(False, description="Is this a nano program")
    is_perk: bool = Field(False, description="Is this a perk item")


class ItemCreate(ItemBase):
    """Schema for creating an Item."""
    animation_mesh_id: Optional[int] = None
    atkdef_id: Optional[int] = None


class ItemResponse(ItemBase):
    """Schema for Item responses."""
    id: int = Field(description="Database ID")
    
    class Config:
        from_attributes = True


class ItemDetail(ItemResponse):
    """Detailed Item response with related data."""
    stats: List[StatValueResponse] = Field(default_factory=list, description="Item stats")
    spell_data: List[SpellDataResponse] = Field(default_factory=list, description="Item spell data")
    attack_stats: List[StatValueResponse] = Field(default_factory=list, description="Attack stats")
    defense_stats: List[StatValueResponse] = Field(default_factory=list, description="Defense stats")
    actions: List[ActionResponse] = Field(default_factory=list, description="Item actions")
    sources: List[Any] = Field(default_factory=list, description="Item sources")
    
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