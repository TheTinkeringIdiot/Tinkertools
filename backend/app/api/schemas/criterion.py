"""
Pydantic schemas for Criterion models.
"""

from pydantic import BaseModel, Field


class CriterionBase(BaseModel):
    """Base Criterion schema."""

    value1: int = Field(description="First value")
    value2: int = Field(description="Second value")
    operator: int = Field(description="Operator for comparison")


class CriterionCreate(CriterionBase):
    """Schema for creating a Criterion."""

    pass


class ItemCriterionResponse(CriterionBase):
    """A criterion as embedded in an item's actions and spells: no row id."""

    class Config:
        from_attributes = True


class CriterionResponse(CriterionBase):
    """Schema for Criterion responses."""

    id: int = Field(description="Criterion ID")

    class Config:
        from_attributes = True
