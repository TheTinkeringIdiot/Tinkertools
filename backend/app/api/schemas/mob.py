"""
Pydantic schemas for Mob models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class MobResponse(BaseModel):
    """Schema for Mob responses."""
    id: int = Field(description="Database ID")
    name: str = Field(description="Mob/boss name")
    level: Optional[int] = Field(None, description="Mob level")
    playfield: Optional[str] = Field(None, description="Playfield/zone")
    location: Optional[str] = Field(None, description="Location description")
    mob_names: Optional[List[str]] = Field(None, description="Array of mob names in the pocket")
    is_pocket_boss: bool = Field(description="Whether this is a pocket boss")
    symbiant_count: Optional[int] = Field(None, description="Number of symbiants dropped by this mob")

    class Config:
        from_attributes = True


class SymbiantDropInfo(BaseModel):
    """Symbiant drop information for mob detail."""
    id: int
    aoid: int
    name: str
    ql: int
    slot_id: int
    family: Optional[str]

    class Config:
        from_attributes = True


class MobDetail(MobResponse):
    """Detailed Mob response with dropped items."""
    dropped_items: List[SymbiantDropInfo] = Field(
        default_factory=list,
        description="Symbiants dropped by this mob"
    )

    class Config:
        from_attributes = True
