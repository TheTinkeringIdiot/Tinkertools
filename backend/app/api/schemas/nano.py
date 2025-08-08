"""
Nano program response schemas with rich spell data.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.api.schemas.spell import SpellResponse


class CastingRequirement(BaseModel):
    """Represents a casting requirement for a nano program."""
    type: str = Field(..., description="Type of requirement (skill, stat, level)")
    requirement: str = Field(..., description="Name of the skill, stat, or 'level'")
    value: int = Field(..., description="Required value")
    critical: bool = Field(default=True, description="Whether this is a critical requirement")


class NanoEffect(BaseModel):
    """Represents an effect that a nano program produces."""
    type: str = Field(..., description="Type of effect (heal, damage, protection, etc.)")
    value: int = Field(..., description="Numeric value of the effect")
    modifier: str = Field(..., description="How the effect is applied (add, multiply, set)")
    stackable: bool = Field(default=False, description="Whether this effect can stack")
    conditions: List[str] = Field(default_factory=list, description="Conditions for the effect")
    stat_id: Optional[str] = Field(None, description="Stat affected by this effect")


class NanoDuration(BaseModel):
    """Represents the duration of a nano program."""
    type: str = Field(..., description="Duration type (instant, duration, permanent)")
    value: Optional[int] = Field(None, description="Duration in seconds if applicable")


class NanoTargeting(BaseModel):
    """Represents the targeting information for a nano program."""
    type: str = Field(..., description="Target type (self, team, hostile, area)")
    range: Optional[int] = Field(None, description="Range in meters if applicable")


class NanoProgram(BaseModel):
    """Complete nano program with item and spell data."""
    # Basic item info
    id: int = Field(..., description="Unique identifier")
    aoid: int = Field(..., description="Anarchy Online item ID")
    name: str = Field(..., description="Nano program name")
    ql: int = Field(..., description="Quality level")
    description: Optional[str] = Field(None, description="Nano description")
    
    # Nano-specific properties (derived from spell data)
    school: Optional[str] = Field(None, description="Nano school (Matter Creation, etc.)")
    strain: Optional[str] = Field(None, description="Nano strain for conflict detection")
    profession: Optional[str] = Field(None, description="Required profession")
    level: Optional[int] = Field(None, description="Required level")
    
    # Casting information
    casting_requirements: List[CastingRequirement] = Field(
        default_factory=list, 
        description="Requirements to cast this nano"
    )
    casting_time: Optional[int] = Field(None, description="Time to cast in seconds")
    recharge_time: Optional[int] = Field(None, description="Recharge time in seconds")
    memory_usage: Optional[int] = Field(None, description="Memory usage in MB")
    nano_point_cost: Optional[int] = Field(None, description="Nano point cost")
    
    # Effects and targeting
    effects: List[NanoEffect] = Field(default_factory=list, description="Nano effects")
    duration: Optional[NanoDuration] = Field(None, description="Duration information")
    targeting: Optional[NanoTargeting] = Field(None, description="Targeting information")
    
    # Acquisition info (derived from item data)
    source_location: Optional[str] = Field(None, description="Where to obtain this nano")
    acquisition_method: Optional[str] = Field(None, description="How to acquire (shop, mission, etc.)")
    
    class Config:
        from_attributes = True


class NanoProgramWithSpells(NanoProgram):
    """Nano program with detailed spell information."""
    spells: List[SpellResponse] = Field(default_factory=list, description="Associated spells")
    raw_criteria: List[Dict[str, Any]] = Field(default_factory=list, description="Raw spell criteria data")


class NanoSearchRequest(BaseModel):
    """Request model for nano search."""
    query: Optional[str] = Field(None, description="Search query")
    schools: Optional[List[str]] = Field(None, description="Filter by nano schools")
    strains: Optional[List[str]] = Field(None, description="Filter by strains")
    professions: Optional[List[str]] = Field(None, description="Filter by professions")
    quality_levels: Optional[List[int]] = Field(None, description="Filter by quality levels")
    level_range: Optional[List[int]] = Field(None, description="Level range [min, max]")
    
    # Compatibility filtering (requires profile data)
    skill_compatible: Optional[bool] = Field(False, description="Filter by skill compatibility")
    castable: Optional[bool] = Field(False, description="Filter by castable with current stats")
    
    # Sorting
    sort_by: str = Field("name", description="Sort field (name, level, school, ql)")
    sort_descending: bool = Field(False, description="Sort in descending order")


class NanoStatsResponse(BaseModel):
    """Statistics about nano programs in the database."""
    total_nanos: int = Field(..., description="Total number of nano programs")
    schools: List[str] = Field(..., description="Available nano schools")
    strains: List[str] = Field(..., description="Available strains")
    professions: List[str] = Field(..., description="Available professions")
    level_range: List[int] = Field(..., description="Min and max levels [min, max]")
    quality_level_range: List[int] = Field(..., description="Min and max QLs [min, max]")