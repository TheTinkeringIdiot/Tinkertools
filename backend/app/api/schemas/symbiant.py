"""
Pydantic schemas for Symbiant models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class SymbiantBase(BaseModel):
    """Base Symbiant schema."""
    aoid: int = Field(description="Anarchy Online symbiant ID")
    family: Optional[str] = Field(None, description="Symbiant family")


class SymbiantCreate(SymbiantBase):
    """Schema for creating a Symbiant."""
    pass


class SymbiantResponse(SymbiantBase):
    """Schema for Symbiant responses."""
    id: int = Field(description="Database ID")
    
    class Config:
        from_attributes = True


class PocketBossInfo(BaseModel):
    """Pocket boss information for symbiant drops."""
    id: int
    name: str
    level: Optional[int]
    location: Optional[str]
    playfield: Optional[str]
    
    class Config:
        from_attributes = True


class SymbiantDetail(SymbiantResponse):
    """Detailed Symbiant response with drop sources."""
    dropped_by: List[PocketBossInfo] = Field(default_factory=list, description="Pocket bosses that drop this symbiant")
    
    class Config:
        from_attributes = True