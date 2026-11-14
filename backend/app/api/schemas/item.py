"""
Pydantic schemas for Item models.
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field
from .stat_value import ItemStatResponse
from .spell import SpellDataResponse
from .action import ActionResponse


class ItemBase(BaseModel):
    """Base Item schema."""

    aoid: Optional[int] = Field(None, description="Anarchy Online item ID")
    name: str = Field(description="Item name")
    ql: Optional[int] = Field(None, description="Quality level")
    item_class: Optional[int] = Field(None, description="Item class/category")
    description: Optional[str] = Field(None, description="Item description")
    is_nano: bool = Field(False, description="Is this a nano program")


class ItemResponse(ItemBase):
    """Schema for Item responses."""

    # Deprecated: the AOID on routes that read the content-addressed store, an
    # internal row id that differs between game versions on the others. Use
    # ``aoid``; this field is removed once every route reads the new store.
    id: int = Field(description="Deprecated internal row ID; do not rely on it")

    class Config:
        from_attributes = True


class ItemDetail(ItemResponse):
    """Detailed Item response with related data."""

    stats: List[ItemStatResponse] = Field(
        default_factory=list, description="Item stats"
    )
    spell_data: List[SpellDataResponse] = Field(
        default_factory=list, description="Item spell data"
    )
    attack_stats: List[ItemStatResponse] = Field(
        default_factory=list, description="Attack stats"
    )
    defense_stats: List[ItemStatResponse] = Field(
        default_factory=list, description="Defense stats"
    )
    actions: List[ActionResponse] = Field(
        default_factory=list, description="Item actions"
    )
    sources: List[Any] = Field(default_factory=list, description="Item sources")

    class Config:
        from_attributes = True
