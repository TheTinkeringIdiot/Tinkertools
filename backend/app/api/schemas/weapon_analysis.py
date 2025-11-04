"""
Pydantic schemas for weapon analysis requests.
"""

from typing import List
from pydantic import BaseModel, Field


class WeaponSkill(BaseModel):
    """A weapon skill with its value."""
    skill_id: int = Field(..., description="Skill ID (e.g., 116 for Assault Rifle)")
    value: int = Field(..., ge=0, description="Skill value")


class WeaponAnalyzeRequest(BaseModel):
    """Request schema for weapon analysis endpoint."""
    level: int = Field(..., ge=1, le=220, description="Character level")
    breed_id: int = Field(..., ge=1, le=4, description="Breed ID (1-4)")
    profession_id: int = Field(..., ge=0, le=15, description="Profession ID (0=Any, 1-15=specific)")
    side: int = Field(..., ge=0, le=2, description="Side/Faction (0=Neutral, 1=Clan, 2=Omni)")
    top_weapon_skills: List[WeaponSkill] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="Top 1-3 weapon skills (highest or >=50% contributors)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "level": 220,
                "breed_id": 1,
                "profession_id": 11,
                "side": 2,
                "top_weapon_skills": [
                    {"skill_id": 116, "value": 2500},
                    {"skill_id": 113, "value": 2400},
                    {"skill_id": 133, "value": 2300}
                ]
            }
        }
