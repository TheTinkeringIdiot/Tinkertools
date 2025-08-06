"""
Pydantic schemas for Spell models.
"""

from typing import Optional, List, Any
from pydantic import BaseModel, Field
from .criterion import CriterionResponse


class SpellBase(BaseModel):
    """Base Spell schema."""
    target: Optional[int] = Field(None, description="Target type")
    tick_count: Optional[int] = Field(None, description="Number of ticks")
    tick_interval: Optional[int] = Field(None, description="Interval between ticks")
    spell_id: Optional[int] = Field(None, description="Spell ID")
    spell_format: Optional[str] = Field(None, description="Spell format string")
    spell_params: Optional[List[Any]] = Field(default_factory=list, description="Spell parameters")


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