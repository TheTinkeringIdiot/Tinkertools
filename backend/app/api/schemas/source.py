"""
Pydantic schemas for Source models.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class SourceTypeResponse(BaseModel):
    """Schema for SourceType responses."""
    id: int = Field(description="Source type ID")
    name: str = Field(description="Source type name")
    description: Optional[str] = Field(None, description="Source type description")
    
    class Config:
        from_attributes = True


class SourceResponse(BaseModel):
    """Schema for Source responses."""
    id: int = Field(description="Source ID")
    source_type_id: int = Field(description="Source type ID")
    source_id: int = Field(description="Referenced entity ID")
    name: str = Field(description="Source name")
    extra_data: Dict[str, Any] = Field(default_factory=dict, description="Source metadata")
    source_type: Optional[SourceTypeResponse] = Field(None, description="Source type details")
    
    class Config:
        from_attributes = True


class ItemSourceResponse(BaseModel):
    """Schema for ItemSource relationship responses."""
    source: SourceResponse = Field(description="Source information")
    drop_rate: Optional[float] = Field(None, description="Drop rate percentage")
    min_ql: Optional[int] = Field(None, description="Minimum QL")
    max_ql: Optional[int] = Field(None, description="Maximum QL")
    conditions: Optional[str] = Field(None, description="Special conditions")
    extra_data: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        from_attributes = True