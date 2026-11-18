"""
Cache management API endpoints.
"""

from fastapi import APIRouter
from app.core.cache import cache_service

router = APIRouter(prefix="/cache", tags=["cache"])


@router.post("/clear")
def clear_cache():
    """
    Clear all cached data.
    """
    cache_service.clear()
    return {"message": "Cache cleared successfully"}
