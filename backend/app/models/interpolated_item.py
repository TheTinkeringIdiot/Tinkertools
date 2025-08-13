"""
Interpolated item models for TinkerTools.

These models represent items that have been interpolated to specific quality levels,
following the legacy InterpItem.py logic for calculating stats, spells, and criteria
at intermediate quality levels between discrete database entries.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class InterpolatedSpell(BaseModel):
    """
    Represents a spell with interpolated parameters.
    """
    target: Optional[int] = None
    tick_count: Optional[int] = None
    tick_interval: Optional[int] = None
    spell_id: Optional[int] = None
    spell_format: Optional[str] = None
    spell_params: Dict[str, Any] = Field(default_factory=dict)
    criteria: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class InterpolatedSpellData(BaseModel):
    """
    Represents spell data with interpolated spells.
    """
    event: Optional[int] = None
    spells: List[InterpolatedSpell] = Field(default_factory=list)

    class Config:
        from_attributes = True


class InterpolatedAction(BaseModel):
    """
    Represents an action with interpolated criteria.
    """
    action: Optional[int] = None
    criteria: List[Dict[str, Any]] = Field(default_factory=list)

    class Config:
        from_attributes = True


class InterpolatedItem(BaseModel):
    """
    Represents an item interpolated to a specific quality level.
    
    This is the main class that contains all interpolated data for an item,
    including stats, spells, actions, and metadata about the interpolation process.
    """
    # Original item data
    id: int
    aoid: Optional[int] = None
    name: str
    ql: Optional[int] = None
    description: Optional[str] = None
    item_class: Optional[int] = None
    is_nano: bool = False
    
    # Interpolation metadata
    interpolating: bool = False
    low_ql: Optional[int] = None
    high_ql: Optional[int] = None
    target_ql: Optional[int] = None
    ql_delta: Optional[int] = None
    ql_delta_full: Optional[int] = None
    
    # Interpolated data
    stats: List[Dict[str, Any]] = Field(default_factory=list)
    spell_data: List[InterpolatedSpellData] = Field(default_factory=list)
    actions: List[InterpolatedAction] = Field(default_factory=list)
    
    # Optional related data (copied from original item)
    attack_defense_id: Optional[int] = None
    animation_mesh_id: Optional[int] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_item(cls, item: Any, interpolating: bool = False) -> "InterpolatedItem":
        """
        Create an InterpolatedItem from a regular Item.
        Used for non-interpolated items or as a base for interpolation.
        """
        return cls(
            id=item.id,
            aoid=item.aoid,
            name=item.name,
            ql=item.ql,
            description=item.description,
            item_class=item.item_class,
            is_nano=item.is_nano,
            interpolating=interpolating,
            low_ql=item.ql,
            high_ql=item.ql,
            target_ql=item.ql,
            ql_delta=0,
            ql_delta_full=0,
            stats=[],  # Will be populated separately
            spell_data=[],  # Will be populated separately
            actions=[],  # Will be populated separately
            attack_defense_id=item.atkdef_id,
            animation_mesh_id=item.animation_mesh_id
        )

    def interpolate_value(self, lo_val: int, hi_val: int) -> int:
        """
        Interpolate a single value between low and high based on QL delta.
        This is the core interpolation function from the legacy system.
        """
        if not self.interpolating or self.ql_delta_full == 0:
            return lo_val
        
        val_per_ql = (hi_val - lo_val) / self.ql_delta_full
        newval = round(lo_val + (val_per_ql * self.ql_delta))
        return newval

    def set_interpolation_metadata(self, lo_item: Any, hi_item: Optional[Any], target_ql: int):
        """
        Set the interpolation metadata based on low/high items and target QL.
        """
        if hi_item is None:
            # No interpolation needed
            self.interpolating = False
            self.low_ql = lo_item.ql
            self.high_ql = lo_item.ql
            self.target_ql = lo_item.ql
            self.ql_delta = 0
            self.ql_delta_full = 0
        else:
            # Interpolation between two items
            self.interpolating = True
            self.low_ql = lo_item.ql
            self.high_ql = hi_item.ql - 1  # Following legacy logic
            self.target_ql = target_ql
            self.ql_delta_full = hi_item.ql - lo_item.ql
            self.ql_delta = target_ql - lo_item.ql


class InterpolationRequest(BaseModel):
    """
    Request model for item interpolation.
    """
    aoid: int = Field(..., description="Anarchy Online ID of the item")
    target_ql: int = Field(..., ge=1, le=500, description="Target quality level")


class InterpolationResponse(BaseModel):
    """
    Response model for item interpolation.
    """
    success: bool
    item: Optional[InterpolatedItem] = None
    error: Optional[str] = None
    interpolation_range: Optional[Dict[str, int]] = None

    class Config:
        from_attributes = True