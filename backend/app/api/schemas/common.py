"""
Common Pydantic schemas used across the API.
"""

from typing import TypeVar, Generic, Optional, List, Any
from pydantic import BaseModel, Field

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""
    items: List[T]
    total: int = Field(description="Total number of items")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Number of items per page")
    pages: int = Field(description="Total number of pages")
    has_next: bool = Field(description="Whether there is a next page")
    has_prev: bool = Field(description="Whether there is a previous page")


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(description="Error message")
    code: Optional[str] = Field(None, description="Error code")
    details: Optional[Any] = Field(None, description="Additional error details")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(description="Health status")
    database: Optional[str] = Field(None, description="Database connection status")
    table_count: Optional[int] = Field(None, description="Number of database tables")
    version: Optional[str] = Field(None, description="API version")