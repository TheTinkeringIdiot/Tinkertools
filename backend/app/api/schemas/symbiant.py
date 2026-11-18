"""
Pydantic schemas for Symbiant models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from .action import ActionResponse
from .spell import SpellDataResponse


class SymbiantResponse(BaseModel):
    """Schema for Symbiant responses from materialized view."""

    # Deprecated: an internal row id that differs between game versions. Use
    # ``aoid``; this field is removed with the content-addressed store.
    id: int = Field(description="Deprecated internal row ID; do not rely on it")
    aoid: int = Field(description="Anarchy Online item ID")
    name: str = Field(description="Symbiant name")
    ql: int = Field(description="Quality level")
    slot_id: int = Field(description="Equipment slot ID")
    family: Optional[str] = Field(
        None, description="Symbiant family (Artillery, Control, etc.)"
    )
    spell_data: List[SpellDataResponse] = Field(
        default_factory=list, description="Item spell data (stat bonuses)"
    )
    actions: List[ActionResponse] = Field(
        default_factory=list,
        description="Actions with criteria for requirements checking",
    )

    class Config:
        from_attributes = True


class MobDropInfo(BaseModel):
    """Mob information for symbiant drops."""

    id: int
    name: str
    level: Optional[int]
    location: Optional[str]
    playfield: Optional[str]
    is_pocket_boss: bool

    class Config:
        from_attributes = True
