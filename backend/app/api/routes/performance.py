"""
Performance monitoring and optimization API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.indexes import create_performance_indexes, check_index_usage, analyze_slow_queries
from app.core.cache import get_cache_stats
import logging

router = APIRouter(prefix="/performance", tags=["performance"])
logger = logging.getLogger(__name__)


@router.post("/indexes/create")
def create_indexes(db: Session = Depends(get_db)):
    """
    Create performance indexes for optimizing API queries.
    This endpoint should be run after initial database setup or when performance issues are detected.
    """
    try:
        created_indexes = create_performance_indexes(db)
        return {
            "message": f"Successfully created {len(created_indexes)} performance indexes",
            "created_indexes": created_indexes
        }
    except Exception as e:
        logger.error(f"Failed to create performance indexes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create indexes: {str(e)}")


@router.get("/indexes/usage")
def get_index_usage(db: Session = Depends(get_db)):
    """
    Get index usage statistics to monitor which indexes are being used effectively.
    """
    try:
        usage_stats = check_index_usage(db)
        return usage_stats
    except Exception as e:
        logger.error(f"Failed to get index usage: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get index usage: {str(e)}")


@router.get("/queries/slow")
def get_slow_queries(
    min_duration_ms: int = 500,
    db: Session = Depends(get_db)
):
    """
    Analyze slow queries using PostgreSQL's pg_stat_statements extension.
    
    Args:
        min_duration_ms: Minimum query duration in milliseconds to include (default: 500ms)
    """
    try:
        slow_queries = analyze_slow_queries(db, min_duration_ms)
        return slow_queries
    except Exception as e:
        logger.error(f"Failed to analyze slow queries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze slow queries: {str(e)}")


@router.get("/overview")
def get_performance_overview(db: Session = Depends(get_db)):
    """
    Get comprehensive performance overview including cache stats, index usage, and slow queries.
    """
    try:
        overview = {
            "cache_stats": get_cache_stats(),
            "index_usage": check_index_usage(db),
            "slow_queries": analyze_slow_queries(db, 500)
        }
        
        return overview
    except Exception as e:
        logger.error(f"Failed to get performance overview: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get performance overview: {str(e)}")


@router.get("/health")
def performance_health_check():
    """
    Basic performance health check endpoint.
    """
    return {
        "status": "healthy",
        "performance_monitoring": "active",
        "cache": "enabled",
        "monitoring_endpoints": [
            "/performance/overview",
            "/performance/indexes/usage", 
            "/performance/queries/slow",
            "/cache/stats"
        ]
    }