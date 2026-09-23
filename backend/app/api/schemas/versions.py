"""
Pydantic schemas for the game version registry and the cross-version item
revision index.
"""

from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class GameVersionResponse(BaseModel):
    """A game data snapshot as exposed to clients.

    ``schema_name`` and the registry timestamps are internal and deliberately
    omitted.
    """
    slug: str = Field(description="Version slug, used in URLs (e.g. 'ao-18.8')")
    display_name: str = Field(description="Human readable version name")
    family: str = Field(description="Version family, groups versions in the selector")
    parent_slug: Optional[str] = Field(None, description="Slug of the snapshot this one follows")
    client_build: Optional[str] = Field(None, description="Game client build string")
    snapshot_date: Optional[date] = Field(None, description="Date the data was captured")
    sort_order: int = Field(description="Display order")
    enabled: bool = Field(description="Whether the version is served")
    is_default: bool = Field(description="Whether this is the fallback version")
    features: Dict[str, Any] = Field(default_factory=dict, description="Feature flags driving UI gating")
    notes: Optional[str] = Field(None, description="Provenance notes")
    is_current: bool = Field(False, description="Whether this is the version resolved for this request")

    class Config:
        from_attributes = True


class GameVersionListResponse(BaseModel):
    """List of enabled game versions in display order."""
    versions: List[GameVersionResponse] = Field(description="Enabled versions, ordered for display")
    current: Optional[str] = Field(None, description="Slug resolved for this request")
    total: int = Field(description="Number of versions returned")


class ItemRevisionPoint(BaseModel):
    """One snapshot at which an item's definition changed."""
    version_slug: str = Field(description="Version in which the change is first observed")
    display_name: str = Field(description="Human readable version name")
    family: str = Field(description="Version family")
    snapshot_date: Optional[date] = Field(None, description="Date the data was captured")
    client_build: Optional[str] = Field(None, description="Game client build string")
    changed: List[str] = Field(
        default_factory=list,
        description="Which parts changed: any of 'stats', 'spells', 'actions', 'text'"
    )
    first_seen: bool = Field(False, description="Whether the item first appears in this version")


class ItemRevisionsResponse(BaseModel):
    """Change history for one AOID across every enabled version."""
    aoid: int = Field(description="Item AOID")
    present_in: List[str] = Field(description="Versions containing this item, display order")
    first_seen_in: Optional[str] = Field(None, description="Version in which the item first appears")
    revisions: List[ItemRevisionPoint] = Field(description="Change points only, display order")
    missing_in: List[str] = Field(description="Enabled versions without this item")


class ItemRevisionsBatchRequest(BaseModel):
    """Request a revision summary for a page of items."""
    aoids: List[int] = Field(min_length=1, max_length=500, description="AOIDs to summarise")


class ItemRevisionBatchEntry(BaseModel):
    """Compact revision summary for a list view row."""
    aoid: int = Field(description="Item AOID")
    revision_count: int = Field(description="Number of change points across all versions")
    latest_change_slug: Optional[str] = Field(
        None,
        description="Snapshot in which the current version's definition was introduced"
    )
    present_in_current: bool = Field(description="Whether the item exists in the request's version")


class ItemRevisionsBatchResponse(BaseModel):
    """Map of AOID to its revision summary."""
    items: Dict[int, ItemRevisionBatchEntry] = Field(description="Summary keyed by AOID")
