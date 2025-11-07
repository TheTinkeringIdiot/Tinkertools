"""
Simple in-memory caching service for frequently accessed data.
Can be extended to use Redis or other caching backends.
"""

import json
import time
import hashlib
from typing import Any, Optional, Dict, Tuple
from datetime import datetime, timedelta
import threading


class CacheService:
    """
    Thread-safe in-memory cache with TTL support.
    """
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self.default_ttl = default_ttl
        self.cache: Dict[str, Tuple[Any, float]] = {}  # key: (value, expiry_time)
        self.lock = threading.RLock()
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'sets': 0
        }
    
    def _generate_key(self, prefix: str, **kwargs) -> str:
        """Generate a cache key from parameters."""
        # Create a consistent key from the parameters
        params = json.dumps(kwargs, sort_keys=True, default=str)
        key_hash = hashlib.md5(params.encode()).hexdigest()[:8]
        return f"{prefix}:{key_hash}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        with self.lock:
            if key not in self.cache:
                self.stats['misses'] += 1
                return None
            
            value, expiry_time = self.cache[key]
            
            # Check if expired
            if time.time() > expiry_time:
                del self.cache[key]
                self.stats['evictions'] += 1
                self.stats['misses'] += 1
                return None
            
            self.stats['hits'] += 1
            return value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in cache with TTL."""
        with self.lock:
            ttl = ttl or self.default_ttl
            expiry_time = time.time() + ttl
            self.cache[key] = (value, expiry_time)
            self.stats['sets'] += 1
    
    def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        with self.lock:
            if key in self.cache:
                del self.cache[key]
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cache entries."""
        with self.lock:
            self.cache.clear()
    
    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self.lock:
            total_requests = self.stats['hits'] + self.stats['misses']
            hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
            
            return {
                **self.stats,
                'total_requests': total_requests,
                'hit_rate_percent': round(hit_rate, 2),
                'cache_size': len(self.cache)
            }
    
    def cleanup_expired(self) -> int:
        """Remove expired entries and return count removed."""
        with self.lock:
            current_time = time.time()
            expired_keys = []
            
            for key, (value, expiry_time) in self.cache.items():
                if current_time > expiry_time:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self.cache[key]
                self.stats['evictions'] += 1
            
            return len(expired_keys)


# Global cache instance
cache_service = CacheService()


def cache_key_for_query(endpoint: str, **params) -> str:
    """Generate a cache key for API endpoint with parameters."""
    return cache_service._generate_key(endpoint, **params)


def get_cached_response(key: str) -> Optional[Any]:
    """Get cached response."""
    return cache_service.get(key)


def cache_response(key: str, response: Any, ttl: int = 300) -> None:
    """Cache a response."""
    cache_service.set(key, response, ttl)


def invalidate_cache_pattern(pattern: str) -> int:
    """Invalidate cache keys matching a pattern (simple startswith)."""
    with cache_service.lock:
        keys_to_delete = []
        for key in cache_service.cache.keys():
            if key.startswith(pattern):
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            cache_service.delete(key)
        
        return len(keys_to_delete)


def get_cache_stats() -> dict:
    """Get cache statistics."""
    return cache_service.get_stats()


# Cache TTL settings for different types of data
CACHE_TTL = {
    'items_list': 300,      # 5 minutes - item lists change infrequently
    'item_detail': 600,     # 10 minutes - individual items rarely change
    'spells_list': 600,     # 10 minutes - spells are static
    'pocket_bosses': 1800,  # 30 minutes - boss info is very static
    'symbiants': 1800,      # 30 minutes - symbiant info is very static
    'search_results': 180,  # 3 minutes - search results can be cached briefly
    'stats': 60,            # 1 minute - stats change more frequently
    'weapons_analyze': 3600 # 1 hour - weapon analysis is static game data
}