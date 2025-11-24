"""
Pydantic schemas for Implant lookup operations.
"""

from typing import Dict, Optional
from pydantic import BaseModel, Field, validator


class ImplantLookupRequest(BaseModel):
    """Request schema for looking up an implant by slot, QL, and clusters."""
    
    slot: int = Field(
        description="IMPLANT_SLOT bitflag value (2=Eyes, 4=Head, 32=Chest, etc.)",
        ge=1,
        le=16383  # 2^14 - 1, covers all valid implant slot bitflags
    )
    ql: int = Field(
        description="Target quality level for interpolation",
        ge=1,
        le=300
    )
    clusters: Dict[str, int] = Field(
        description="Cluster configuration with position names mapped to STAT IDs",
        example={"Shiny": 16, "Bright": 112, "Faded": 19}
    )
    
    @validator('clusters')
    def validate_clusters(cls, v):
        """Validate cluster positions."""
        valid_positions = {"Shiny", "Bright", "Faded"}
        for position in v.keys():
            if position not in valid_positions:
                raise ValueError(f"Invalid cluster position: {position}. Must be one of {valid_positions}")
        
        for stat_id in v.values():
            if not isinstance(stat_id, int) or stat_id <= 0:
                raise ValueError(f"Invalid STAT ID: {stat_id}. Must be a positive integer")
        
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "slot": 32,  # Chest (1 << 5)
                "ql": 200,
                "clusters": {
                    "Shiny": 16,    # Strength
                    "Bright": 112,  # Pistol
                    "Faded": 19     # Intelligence
                }
            }
        }


class ImplantLookupResponse(BaseModel):
    """Response schema for implant lookup."""
    
    success: bool = Field(description="Whether the lookup was successful")
    item: Optional[Dict] = Field(None, description="The found implant item data")
    message: Optional[str] = Field(None, description="Success or error message")
    interpolated: bool = Field(False, description="Whether the item was interpolated to target QL")
    base_ql: Optional[int] = Field(None, description="Base QL of the database item used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "item": {
                    "id": 12345,
                    "aoid": 67890,
                    "name": "Sophisticated Implant",
                    "ql": 200,
                    "item_class": 3,
                    "stats": [
                        {"stat": 16, "value": 25},  # Strength
                        {"stat": 112, "value": 15}, # Pistol
                        {"stat": 19, "value": 20}   # Intelligence
                    ]
                },
                "message": "Implant found and interpolated successfully",
                "interpolated": True,
                "base_ql": 1
            }
        }