"""
Pydantic schemas for StatValue models.
"""

from pydantic import BaseModel, Field


class StatValueBase(BaseModel):
    """Base StatValue schema."""

    stat: int = Field(description="Stat identifier")
    value: int = Field(description="Stat value")


class StatValueCreate(StatValueBase):
    """Schema for creating a StatValue."""

    pass


class ItemStatResponse(StatValueBase):
    """A stat as embedded in an item: its content only, no row id."""

    model_config = {"from_attributes": True}
