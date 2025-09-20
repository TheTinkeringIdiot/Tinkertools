"""
Pydantic schemas for Perk models.

Perks are specialized items with spell_data that provide stat modifications.
They follow three distinct type systems: SL (Shadowlands), AI (Alien Invasion),
and LE (Lost Eden) with different point systems and requirements.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .spell import SpellDataResponse


class PerkBase(BaseModel):
    """Base Perk schema."""
    aoid: int = Field(description="Anarchy Online perk ID")
    name: str = Field(description="Perk name")
    counter: int = Field(description="Perk level (1-10)", ge=1, le=10)
    type: str = Field(description="Perk type (SL/AI/LE)")
    professions: List[str] = Field(default_factory=list, description="Required professions")
    breeds: List[str] = Field(default_factory=list, description="Required breeds")
    level: int = Field(description="Required character level", ge=1)
    ai_title: Optional[int] = Field(None, description="Required AI title level")


class PerkCreate(PerkBase):
    """Schema for creating a Perk."""
    pass


class PerkResponse(PerkBase):
    """Schema for Perk responses."""
    id: int = Field(description="Database ID")
    description: Optional[str] = Field(None, description="Perk description")
    ql: Optional[int] = Field(None, description="Quality level")
    perk_series: Optional[str] = Field(None, description="Perk series name for grouping")
    formatted_name: Optional[str] = Field(None, description="Formatted name with counter")

    class Config:
        from_attributes = True


class PerkRequirement(BaseModel):
    """Represents a requirement for a perk."""
    type: str = Field(..., description="Type of requirement (profession, breed, level, ai_title)")
    requirement: str = Field(..., description="Name or identifier of the requirement")
    value: Optional[int] = Field(None, description="Required value (for level/ai_title)")


class PerkEffect(BaseModel):
    """Represents an effect that a perk provides."""
    stat_id: str = Field(..., description="Stat affected by this perk")
    value: int = Field(..., description="Numeric value of the effect")
    modifier: str = Field(..., description="How the effect is applied (add, multiply, set)")
    conditions: List[str] = Field(default_factory=list, description="Conditions for the effect")


class PerkPointCost(BaseModel):
    """Represents the point cost for purchasing a perk level."""
    level: int = Field(..., description="Perk level", ge=1, le=10)
    cost: int = Field(..., description="Point cost for this level")
    cumulative_cost: int = Field(..., description="Total points needed from level 1 to this level")


class PerkDetail(PerkResponse):
    """Detailed Perk response with spell data and effects."""
    requirements: List[PerkRequirement] = Field(default_factory=list, description="All requirements for this perk")
    effects: List[PerkEffect] = Field(default_factory=list, description="Stat effects provided by this perk")
    spell_data: List[SpellDataResponse] = Field(default_factory=list, description="Spell data containing the actual effects")
    point_cost: Optional[PerkPointCost] = Field(None, description="Point cost information for this level")

    class Config:
        from_attributes = True


class PerkSeries(BaseModel):
    """Complete perk series with all levels."""
    name: str = Field(..., description="Perk name")
    type: str = Field(..., description="Perk type (SL/AI/LE)")
    professions: List[str] = Field(default_factory=list, description="Required professions")
    breeds: List[str] = Field(default_factory=list, description="Required breeds")
    levels: List[PerkDetail] = Field(..., description="All levels of this perk (1-10)")
    max_level: int = Field(..., description="Maximum available level", ge=1, le=10)
    total_point_cost: int = Field(..., description="Total points needed for max level")


class PerkSearchRequest(BaseModel):
    """Request model for perk search."""
    query: Optional[str] = Field(None, description="Search query for perk name")
    types: Optional[List[str]] = Field(None, description="Filter by perk types (SL, AI, LE)")
    professions: Optional[List[str]] = Field(None, description="Filter by required professions")
    breeds: Optional[List[str]] = Field(None, description="Filter by required breeds")
    level_range: Optional[List[int]] = Field(None, description="Character level range [min, max]")
    ai_title_range: Optional[List[int]] = Field(None, description="AI title level range [min, max]")
    counter_range: Optional[List[int]] = Field(None, description="Perk level range [min, max]")

    # Character compatibility filtering
    character_level: Optional[int] = Field(None, description="Character level for compatibility check")
    character_professions: Optional[List[str]] = Field(None, description="Character professions for filtering")
    character_breed: Optional[str] = Field(None, description="Character breed for filtering")
    ai_title_level: Optional[int] = Field(None, description="Character AI title level")

    # Point availability filtering
    available_sl_points: Optional[int] = Field(None, description="Available SL points")
    available_ai_points: Optional[int] = Field(None, description="Available AI points")

    # Current perk state for progressive requirements
    owned_perks: Optional[Dict[str, int]] = Field(None, description="Currently owned perks {name: level}")

    # Sorting
    sort_by: str = Field("name", description="Sort field (name, level, type, cost)")
    sort_descending: bool = Field(False, description="Sort in descending order")


class PerkStatsResponse(BaseModel):
    """Statistics about perks in the database."""
    total_perks: int = Field(..., description="Total number of individual perk items")
    total_series: int = Field(..., description="Total number of unique perk series")
    types: List[str] = Field(..., description="Available perk types")
    professions: List[str] = Field(..., description="Available professions")
    breeds: List[str] = Field(..., description="Available breeds")
    level_range: List[int] = Field(..., description="Min and max character levels [min, max]")
    ai_title_range: List[int] = Field(..., description="Min and max AI title levels [min, max]")


class PerkCalculationRequest(BaseModel):
    """Request for calculating perk effects and costs."""
    character_level: int = Field(..., description="Character level", ge=1)
    ai_title_level: Optional[int] = Field(None, description="AI title level")
    owned_perks: Dict[str, int] = Field(..., description="Currently owned perks {name: level}")
    target_perks: Dict[str, int] = Field(..., description="Target perk state {name: level}")


class PerkCalculationResponse(BaseModel):
    """Response for perk calculations."""
    total_sl_cost: int = Field(..., description="Total SL points needed")
    total_ai_cost: int = Field(..., description="Total AI points needed")
    available_sl_points: int = Field(..., description="Available SL points at character level")
    available_ai_points: int = Field(..., description="Available AI points at AI title level")
    sl_points_remaining: int = Field(..., description="SL points remaining after purchase")
    ai_points_remaining: int = Field(..., description="AI points remaining after purchase")
    affordable: bool = Field(..., description="Whether the target state is affordable")
    requirements_met: bool = Field(..., description="Whether all requirements are met")
    blocking_requirements: List[str] = Field(default_factory=list, description="Requirements that are not met")
    perk_effects: Dict[str, int] = Field(default_factory=dict, description="Aggregated stat effects")


class PerkValidationResponse(BaseModel):
    """Response for perk requirement validation."""
    valid: bool = Field(..., description="Whether the perk can be purchased")
    errors: List[str] = Field(default_factory=list, description="Validation error messages")
    warnings: List[str] = Field(default_factory=list, description="Validation warnings")
    required_level: Optional[int] = Field(None, description="Required character level")
    required_ai_title: Optional[int] = Field(None, description="Required AI title level")
    required_professions: List[str] = Field(default_factory=list, description="Required professions")
    required_breeds: List[str] = Field(default_factory=list, description="Required breeds")
    prerequisite_perks: List[str] = Field(default_factory=list, description="Required lower-level perks")


class PerkSeriesPerk(BaseModel):
    """Individual perk in a series."""
    counter: int = Field(..., description="Perk level (1-10)", ge=1, le=10)
    aoid: int = Field(..., description="Anarchy Online perk ID")
    level_required: int = Field(..., description="Required character level", ge=1)
    ai_level_required: Optional[int] = Field(None, description="Required AI title level")


class PerkSeriesResponse(BaseModel):
    """Response for perk series grouping."""
    series_name: str = Field(..., description="Perk series name")
    type: str = Field(..., description="Perk type (SL/AI/LE)")
    professions: List[str] = Field(default_factory=list, description="Required professions")
    breeds: List[str] = Field(default_factory=list, description="Required breeds")
    perks: List[PerkSeriesPerk] = Field(..., description="All counters (1-10) for this series")