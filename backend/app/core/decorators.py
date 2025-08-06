"""
Decorators for API endpoints including caching and performance monitoring.
"""

import time
import functools
import logging
from typing import Callable, Any
from fastapi import Request
from app.core.cache import cache_key_for_query, get_cached_response, cache_response, CACHE_TTL

logger = logging.getLogger(__name__)


def cached_response(cache_type: str, ttl: int = None):
    """
    Decorator to cache API responses based on query parameters.
    
    Args:
        cache_type: Type of cache (must be in CACHE_TTL)
        ttl: Time to live in seconds (overrides default from CACHE_TTL)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function parameters
            # Remove 'db' session from cache key as it's not relevant
            cache_params = {k: v for k, v in kwargs.items() if k != 'db'}
            cache_key = cache_key_for_query(f"{func.__module__}.{func.__name__}", **cache_params)
            
            # Try to get cached response
            cached = get_cached_response(cache_key)
            if cached is not None:
                logger.debug(f"Cache hit for {func.__name__}: {cache_key}")
                return cached
            
            # Execute function and cache result
            start_time = time.time()
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Cache the result
            cache_ttl = ttl or CACHE_TTL.get(cache_type, 300)
            cache_response(cache_key, result, cache_ttl)
            
            logger.debug(f"Cache miss for {func.__name__}: {cache_key} (executed in {execution_time:.3f}s)")
            return result
        
        return wrapper
    return decorator


def performance_monitor(func: Callable) -> Callable:
    """
    Decorator to monitor endpoint performance and log slow queries.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Log slow queries (>500ms per REQ-PERF-001)
            if execution_time > 0.5:
                logger.warning(f"Slow query in {func.__name__}: {execution_time:.3f}s - {kwargs}")
            elif execution_time > 0.2:
                logger.info(f"Moderate query in {func.__name__}: {execution_time:.3f}s")
            
            return result
        
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error in {func.__name__} after {execution_time:.3f}s: {e}")
            raise
    
    return wrapper


def log_query_params(func: Callable) -> Callable:
    """
    Decorator to log query parameters for debugging.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Log non-sensitive parameters
        log_params = {k: v for k, v in kwargs.items() if k not in ['db', 'request']}
        logger.debug(f"Query {func.__name__}: {log_params}")
        return func(*args, **kwargs)
    
    return wrapper