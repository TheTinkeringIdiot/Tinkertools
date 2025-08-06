"""
Pydantic schemas for PocketBoss models.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


class PocketBossBase(BaseModel):
    """Base PocketBoss schema."""
    name: str = Field(description="Boss name")
    level: int = Field(description="Boss level")
    playfield: Optional[str] = Field(None, description="Playfield/zone")
    location: Optional[str] = Field(None, description="Boss location")
    mobs: Optional[str] = Field(None, description="Mob composition")


class PocketBossCreate(PocketBossBase):
    """Schema for creating a PocketBoss."""
    pass


class PocketBossResponse(PocketBossBase):
    """Schema for PocketBoss responses."""
    id: int = Field(description="Database ID")
    
    class Config:
        from_attributes = True


class SymbiantDrop(BaseModel):
    """Symbiant drop information."""
    id: int
    aoid: int
    family: Optional[str]
    
    class Config:
        from_attributes = True


class PocketBossDetail(PocketBossResponse):
    """Detailed PocketBoss response with drops."""
    drops: List[SymbiantDrop] = Field(default_factory=list, description="Symbiants dropped by this boss")
    
    class Config:
        from_attributes = True