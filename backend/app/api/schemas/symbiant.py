"""
Pydantic schemas for Symbiant models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class SymbiantResponse(BaseModel):
    """Schema for Symbiant responses from materialized view."""
    id: int = Field(description="Database ID")
    aoid: int = Field(description="Anarchy Online item ID")
    name: str = Field(description="Symbiant name")
    ql: int = Field(description="Quality level")
    slot_id: int = Field(description="Equipment slot ID")
    family: Optional[str] = Field(None, description="Symbiant family (Artillery, Control, etc.)")

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


class SymbiantWithDropsResponse(SymbiantResponse):
    """Detailed Symbiant response with drop sources."""
    dropped_by: List[MobDropInfo] = Field(
        default_factory=list,
        description="Mobs (pocket bosses) that drop this symbiant"
    )

    class Config:
        from_attributes = True


# Deprecated schemas kept for backwards compatibility
class SymbiantBase(BaseModel):
    """Base Symbiant schema (deprecated)."""
    aoid: int = Field(description="Anarchy Online symbiant ID")
    family: Optional[str] = Field(None, description="Symbiant family")


class SymbiantCreate(SymbiantBase):
    """Schema for creating a Symbiant (deprecated)."""
    pass


class PocketBossInfo(BaseModel):
    """Pocket boss information for symbiant drops (deprecated)."""
    id: int
    name: str
    level: Optional[int]
    location: Optional[str]
    playfield: Optional[str]

    class Config:
        from_attributes = True


class SymbiantDetail(SymbiantResponse):
    """Detailed Symbiant response with drop sources (deprecated, use SymbiantWithDropsResponse)."""
    dropped_by: List[PocketBossInfo] = Field(
        default_factory=list,
        description="Pocket bosses that drop this symbiant"
    )

    class Config:
        from_attributes = True