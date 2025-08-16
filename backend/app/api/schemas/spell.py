"""
Pydantic schemas for Spell models.
"""

from typing import Optional, List, Any, Union, Dict
from pydantic import BaseModel, Field
from .criterion import CriterionResponse


class SpellBase(BaseModel):
    """Base Spell schema."""
    target: Optional[int] = Field(None, description="Target type")
    tick_count: Optional[int] = Field(None, description="Number of ticks")
    tick_interval: Optional[int] = Field(None, description="Interval between ticks")
    spell_id: Optional[int] = Field(None, description="Spell ID")
    spell_format: Optional[str] = Field(None, description="Spell format string")
    spell_params: Optional[Union[List[Any], Dict[str, Any]]] = Field(default_factory=dict, description="Spell parameters")


class SpellCreate(SpellBase):
    """Schema for creating a Spell."""
    pass


class SpellResponse(SpellBase):
    """Schema for Spell responses."""
    id: int = Field(description="Spell ID")
    
    class Config:
        from_attributes = True


class SpellWithCriteria(SpellResponse):
    """Spell response with criteria included."""
    criteria: List[CriterionResponse] = Field(default_factory=list, description="Spell criteria")
    
    class Config:
        from_attributes = True


class SpellDataResponse(BaseModel):
    """Schema for SpellData responses."""
    id: int = Field(description="Spell Data ID")
    event: Optional[int] = Field(None, description="Event trigger")
    spells: List[SpellWithCriteria] = Field(default_factory=list, description="Spells in this spell data")
    
    class Config:
        from_attributes = True