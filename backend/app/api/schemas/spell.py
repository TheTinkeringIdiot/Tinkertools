"""
Pydantic schemas for Spell models.
"""

from typing import Optional, List, Any, Union, Dict
from pydantic import BaseModel, Field
from .criterion import ItemCriterionResponse


class SpellBase(BaseModel):
    """Base Spell schema."""

    target: Optional[int] = Field(None, description="Target type")
    tick_count: Optional[int] = Field(None, description="Number of ticks")
    tick_interval: Optional[int] = Field(None, description="Interval between ticks")
    spell_id: Optional[int] = Field(None, description="Spell ID")
    spell_format: Optional[str] = Field(None, description="Spell format string")
    spell_params: Optional[Union[List[Any], Dict[str, Any]]] = Field(
        default_factory=dict, description="Spell parameters"
    )


class ItemSpellResponse(SpellBase):
    """A spell effect as embedded in an item: its content only, no row id.

    ``spell_id`` is the game's effect type, not a row id.
    """

    criteria: List[ItemCriterionResponse] = Field(
        default_factory=list, description="Spell criteria"
    )

    class Config:
        from_attributes = True


class SpellDataResponse(BaseModel):
    """Schema for SpellData responses (an item's effects for one event)."""

    event: Optional[int] = Field(None, description="Event trigger")
    spells: List[ItemSpellResponse] = Field(
        default_factory=list, description="Spells in this spell data"
    )

    class Config:
        from_attributes = True
