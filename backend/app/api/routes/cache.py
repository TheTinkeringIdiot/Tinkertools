"""
Cache management API endpoints.
"""

from fastapi import APIRouter, HTTPException
from app.core.cache import get_cache_stats, invalidate_cache_pattern, cache_service

router = APIRouter(prefix="/cache", tags=["cache"])


@router.get("/stats")
def get_cache_statistics():
    """
    Get cache performance statistics.
    """
    return get_cache_stats()


@router.post("/clear")
def clear_cache():
    """
    Clear all cached data.
    """
    cache_service.clear()
    return {"message": "Cache cleared successfully"}


@router.post("/invalidate/{pattern}")
def invalidate_cache(pattern: str):
    """
    Invalidate cache keys matching a pattern.
    """
    count = invalidate_cache_pattern(pattern)
    return {"message": f"Invalidated {count} cache entries", "pattern": pattern}


@router.post("/cleanup")
def cleanup_expired_cache():
    """
    Manually cleanup expired cache entries.
    """
    count = cache_service.cleanup_expired()
    return {"message": f"Removed {count} expired cache entries"}