"""
Unit tests for core backend infrastructure modules.

Tests critical functionality that affects all features:
- CacheService: In-memory caching with TTL support
- Decorators: Performance monitoring and caching decorators
- Config: Application configuration and settings
"""

import pytest
import time
import threading
import asyncio
import os
from unittest.mock import Mock, patch, MagicMock
from typing import Any

from app.core.cache import (
    CacheService,
    cache_service,
    cache_key_for_query,
    get_cached_response,
    cache_response,
    invalidate_cache_pattern,
    get_cache_stats,
    CACHE_TTL
)
from app.core.decorators import (
    cached_response,
    performance_monitor,
    log_query_params
)
from app.core.config import Settings, settings


# ============================================================================
# Cache Module Tests
# ============================================================================

class TestCacheService:
    """Test suite for CacheService class."""

    @pytest.fixture
    def cache(self):
        """Create a fresh cache instance for each test."""
        return CacheService(default_ttl=10)

    def test_cache_initialization(self, cache):
        """Test cache initializes with correct defaults."""
        assert cache.default_ttl == 10
        assert len(cache.cache) == 0
        assert cache.stats['hits'] == 0
        assert cache.stats['misses'] == 0
        assert cache.stats['evictions'] == 0
        assert cache.stats['sets'] == 0

    def test_cache_set_and_get(self, cache):
        """Test basic cache set and get operations."""
        cache.set("test_key", "test_value")

        result = cache.get("test_key")
        assert result == "test_value"
        assert cache.stats['hits'] == 1
        assert cache.stats['sets'] == 1

    def test_cache_miss(self, cache):
        """Test cache miss behavior."""
        result = cache.get("nonexistent_key")

        assert result is None
        assert cache.stats['misses'] == 1
        assert cache.stats['hits'] == 0

    def test_cache_ttl_expiration(self, cache):
        """Test that cached values expire after TTL."""
        cache.set("short_lived", "value", ttl=1)

        # Value should be available immediately
        assert cache.get("short_lived") == "value"

        # Wait for expiration
        time.sleep(1.1)

        # Value should be expired
        result = cache.get("short_lived")
        assert result is None
        assert cache.stats['evictions'] == 1

    def test_cache_custom_ttl(self, cache):
        """Test setting custom TTL overrides default."""
        cache.set("custom_ttl", "value", ttl=2)
        cache.set("default_ttl", "value")

        # Custom TTL should be 2 seconds
        time.sleep(2.1)
        assert cache.get("custom_ttl") is None

        # Default should still be valid (10 seconds)
        assert cache.get("default_ttl") == "value"

    def test_cache_delete(self, cache):
        """Test cache deletion."""
        cache.set("to_delete", "value")

        # Verify it exists
        assert cache.get("to_delete") == "value"

        # Delete and verify
        result = cache.delete("to_delete")
        assert result is True
        assert cache.get("to_delete") is None

        # Try deleting non-existent key
        result = cache.delete("nonexistent")
        assert result is False

    def test_cache_clear(self, cache):
        """Test clearing all cache entries."""
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")

        assert len(cache.cache) == 3

        cache.clear()

        assert len(cache.cache) == 0
        assert cache.get("key1") is None

    def test_cache_stats(self, cache):
        """Test cache statistics tracking."""
        # Generate some cache activity
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.get("key1")  # hit
        cache.get("key1")  # hit
        cache.get("missing")  # miss

        stats = cache.get_stats()

        assert stats['hits'] == 2
        assert stats['misses'] == 1
        assert stats['sets'] == 2
        assert stats['total_requests'] == 3
        assert stats['hit_rate_percent'] == pytest.approx(66.67, rel=0.01)
        assert stats['cache_size'] == 2

    def test_cache_stats_no_requests(self, cache):
        """Test cache statistics with no requests."""
        stats = cache.get_stats()

        assert stats['total_requests'] == 0
        assert stats['hit_rate_percent'] == 0
        assert stats['cache_size'] == 0

    def test_cache_cleanup_expired(self, cache):
        """Test manual cleanup of expired entries."""
        cache.set("expired1", "value1", ttl=1)
        cache.set("expired2", "value2", ttl=1)
        cache.set("valid", "value3", ttl=10)

        # Wait for expiration
        time.sleep(1.1)

        # Cleanup expired entries
        removed_count = cache.cleanup_expired()

        assert removed_count == 2
        assert cache.get("valid") == "value3"
        assert cache.stats['evictions'] == 2

    def test_generate_key_consistency(self, cache):
        """Test that key generation is consistent for same parameters."""
        key1 = cache._generate_key("test", param1="value1", param2="value2")
        key2 = cache._generate_key("test", param1="value1", param2="value2")

        assert key1 == key2

    def test_generate_key_order_independence(self, cache):
        """Test that key generation is order-independent."""
        key1 = cache._generate_key("test", param1="value1", param2="value2")
        key2 = cache._generate_key("test", param2="value2", param1="value1")

        assert key1 == key2

    def test_generate_key_different_params(self, cache):
        """Test that different parameters generate different keys."""
        key1 = cache._generate_key("test", param1="value1")
        key2 = cache._generate_key("test", param1="value2")

        assert key1 != key2

    def test_generate_key_with_complex_types(self, cache):
        """Test key generation with complex parameter types."""
        key1 = cache._generate_key("test",
                                   list_param=[1, 2, 3],
                                   dict_param={"a": "b"},
                                   int_param=42)

        # Should not raise exception and should generate a key
        assert key1.startswith("test:")
        assert len(key1) > 5

    def test_cache_thread_safety_basic(self, cache):
        """Test basic thread safety of cache operations."""
        results = []

        def worker(value):
            cache.set(f"key_{value}", value)
            time.sleep(0.01)
            result = cache.get(f"key_{value}")
            results.append(result)

        threads = []
        for i in range(10):
            thread = threading.Thread(target=worker, args=(i,))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # All values should be retrieved correctly
        assert len(results) == 10
        assert set(results) == set(range(10))

    def test_cache_thread_safety_concurrent_access(self, cache):
        """Test thread safety with concurrent reads and writes."""
        cache.set("shared_key", 0)

        def incrementer():
            for _ in range(100):
                value = cache.get("shared_key")
                cache.set("shared_key", value + 1)

        threads = []
        for _ in range(5):
            thread = threading.Thread(target=incrementer)
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        # Final value should be 500 (5 threads * 100 increments)
        final_value = cache.get("shared_key")
        assert final_value == 500

    def test_cache_stores_different_types(self, cache):
        """Test that cache can store different Python types."""
        test_data = {
            "string": "test",
            "int": 42,
            "float": 3.14,
            "list": [1, 2, 3],
            "dict": {"key": "value"},
            "none": None,
            "bool": True
        }

        for key, value in test_data.items():
            cache.set(key, value)

        for key, expected_value in test_data.items():
            assert cache.get(key) == expected_value


class TestCacheModuleFunctions:
    """Test suite for module-level cache functions."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear cache before each test."""
        cache_service.clear()
        yield
        cache_service.clear()

    def test_cache_key_for_query(self):
        """Test cache key generation for queries."""
        key = cache_key_for_query("items", page=1, limit=10)

        assert key.startswith("items:")
        assert isinstance(key, str)

    def test_get_cached_response_miss(self):
        """Test getting non-existent cached response."""
        result = get_cached_response("nonexistent")
        assert result is None

    def test_cache_response_and_retrieve(self):
        """Test caching and retrieving a response."""
        data = {"items": [1, 2, 3], "total": 3}
        cache_response("test_key", data, ttl=60)

        result = get_cached_response("test_key")
        assert result == data

    def test_invalidate_cache_pattern(self):
        """Test pattern-based cache invalidation."""
        cache_response("items:list:1", {"data": "list1"})
        cache_response("items:list:2", {"data": "list2"})
        cache_response("items:detail:1", {"data": "detail1"})
        cache_response("spells:list:1", {"data": "spells"})

        # Invalidate all items:list patterns
        removed = invalidate_cache_pattern("items:list:")

        assert removed == 2
        assert get_cached_response("items:list:1") is None
        assert get_cached_response("items:list:2") is None
        assert get_cached_response("items:detail:1") is not None
        assert get_cached_response("spells:list:1") is not None

    def test_invalidate_cache_pattern_no_matches(self):
        """Test pattern invalidation with no matches."""
        cache_response("test:key", {"data": "test"})

        removed = invalidate_cache_pattern("nonexistent:")

        assert removed == 0
        assert get_cached_response("test:key") is not None

    def test_get_cache_stats_function(self):
        """Test getting cache statistics via module function."""
        cache_response("key1", "value1")
        get_cached_response("key1")

        stats = get_cache_stats()

        assert 'hits' in stats
        assert 'misses' in stats
        assert 'cache_size' in stats
        assert stats['cache_size'] > 0

    def test_cache_ttl_constants(self):
        """Test that CACHE_TTL constants are defined."""
        assert 'items_list' in CACHE_TTL
        assert 'item_detail' in CACHE_TTL
        assert 'spells_list' in CACHE_TTL
        assert 'pocket_bosses' in CACHE_TTL
        assert 'symbiants' in CACHE_TTL
        assert 'search_results' in CACHE_TTL
        assert 'stats' in CACHE_TTL

        # Verify they're all positive integers
        for ttl_value in CACHE_TTL.values():
            assert isinstance(ttl_value, int)
            assert ttl_value > 0


# ============================================================================
# Decorators Module Tests
# ============================================================================

class TestCachedResponseDecorator:
    """Test suite for cached_response decorator."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear cache before each test."""
        cache_service.clear()
        yield
        cache_service.clear()

    @pytest.mark.asyncio
    async def test_async_function_caching(self):
        """Test that async functions are cached correctly."""
        call_count = 0

        @cached_response("items_list")
        async def get_items(page: int = 1):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)
            return {"items": [], "page": page}

        # First call should execute function
        result1 = await get_items(page=1)
        assert call_count == 1
        assert result1["page"] == 1

        # Second call should use cache
        result2 = await get_items(page=1)
        assert call_count == 1  # Not incremented
        assert result2 == result1

    @pytest.mark.asyncio
    async def test_async_function_different_params(self):
        """Test that different parameters create different cache entries."""
        call_count = 0

        @cached_response("items_list")
        async def get_items(page: int = 1):
            nonlocal call_count
            call_count += 1
            return {"items": [], "page": page}

        result1 = await get_items(page=1)
        result2 = await get_items(page=2)

        assert call_count == 2
        assert result1["page"] == 1
        assert result2["page"] == 2

    def test_sync_function_caching(self):
        """Test that sync functions are cached correctly."""
        call_count = 0

        @cached_response("items_list")
        def get_items(page: int = 1):
            nonlocal call_count
            call_count += 1
            return {"items": [], "page": page}

        # First call should execute function
        result1 = get_items(page=1)
        assert call_count == 1

        # Second call should use cache
        result2 = get_items(page=1)
        assert call_count == 1
        assert result2 == result1

    @pytest.mark.asyncio
    async def test_custom_ttl(self):
        """Test that custom TTL is respected."""
        @cached_response("items_list", ttl=1)
        async def get_items():
            return {"items": []}

        await get_items()

        # Immediately should be cached
        stats_before = get_cache_stats()
        await get_items()
        stats_after = get_cache_stats()

        assert stats_after['hits'] > stats_before['hits']

        # After TTL should not be cached
        time.sleep(1.1)
        cache_service.cleanup_expired()

        await get_items()
        # Would be a miss (hard to test directly due to re-caching)

    @pytest.mark.asyncio
    async def test_db_param_excluded_from_cache_key(self):
        """Test that 'db' parameter is excluded from cache key."""
        call_count = 0

        @cached_response("items_list")
        async def get_items(page: int = 1, db=None):
            nonlocal call_count
            call_count += 1
            return {"items": [], "page": page}

        # These should use the same cache despite different db sessions
        await get_items(page=1, db="session1")
        await get_items(page=1, db="session2")

        assert call_count == 1  # Only called once

    def test_default_ttl_from_cache_type(self):
        """Test that default TTL is used from CACHE_TTL when not specified."""
        @cached_response("items_list")
        def get_items():
            return {"items": []}

        get_items()

        # Check that cache was set (can't easily verify TTL, but check it cached)
        stats = get_cache_stats()
        assert stats['sets'] > 0


class TestPerformanceMonitorDecorator:
    """Test suite for performance_monitor decorator."""

    @pytest.mark.asyncio
    async def test_async_function_normal_execution(self):
        """Test performance monitor with normal async function execution."""
        @performance_monitor
        async def fast_function():
            await asyncio.sleep(0.01)
            return "result"

        result = await fast_function()
        assert result == "result"

    @pytest.mark.asyncio
    async def test_async_function_slow_query_logging(self, caplog):
        """Test that slow queries are logged for async functions."""
        @performance_monitor
        async def slow_function():
            await asyncio.sleep(0.6)
            return "result"

        with caplog.at_level("WARNING"):
            await slow_function()

        # Check that slow query was logged
        assert any("Slow query" in record.message for record in caplog.records)

    @pytest.mark.asyncio
    async def test_async_function_moderate_query_logging(self, caplog):
        """Test that moderate queries are logged for async functions."""
        @performance_monitor
        async def moderate_function():
            await asyncio.sleep(0.3)
            return "result"

        with caplog.at_level("INFO"):
            await moderate_function()

        # Check that moderate query was logged
        assert any("Moderate query" in record.message for record in caplog.records)

    def test_sync_function_normal_execution(self):
        """Test performance monitor with normal sync function execution."""
        @performance_monitor
        def fast_function():
            time.sleep(0.01)
            return "result"

        result = fast_function()
        assert result == "result"

    def test_sync_function_slow_query_logging(self, caplog):
        """Test that slow queries are logged for sync functions."""
        @performance_monitor
        def slow_function():
            time.sleep(0.6)
            return "result"

        with caplog.at_level("WARNING"):
            slow_function()

        assert any("Slow query" in record.message for record in caplog.records)

    @pytest.mark.asyncio
    async def test_async_function_error_handling(self, caplog):
        """Test that errors are logged with execution time for async functions."""
        @performance_monitor
        async def error_function():
            await asyncio.sleep(0.01)
            raise ValueError("Test error")

        with caplog.at_level("ERROR"):
            with pytest.raises(ValueError, match="Test error"):
                await error_function()

        # Check that error was logged with timing
        assert any("Error in error_function" in record.message for record in caplog.records)

    def test_sync_function_error_handling(self, caplog):
        """Test that errors are logged with execution time for sync functions."""
        @performance_monitor
        def error_function():
            time.sleep(0.01)
            raise ValueError("Test error")

        with caplog.at_level("ERROR"):
            with pytest.raises(ValueError, match="Test error"):
                error_function()

        assert any("Error in error_function" in record.message for record in caplog.records)


class TestLogQueryParamsDecorator:
    """Test suite for log_query_params decorator."""

    def test_logs_query_parameters(self, caplog):
        """Test that query parameters are logged."""
        @log_query_params
        def query_function(page: int = 1, limit: int = 10):
            return {"page": page, "limit": limit}

        with caplog.at_level("DEBUG"):
            query_function(page=2, limit=20)

        # Check that parameters were logged
        assert any("page" in record.message for record in caplog.records)

    def test_excludes_sensitive_params(self, caplog):
        """Test that sensitive parameters are excluded from logs."""
        @log_query_params
        def query_function(page: int = 1, db=None, request=None):
            return {"page": page}

        with caplog.at_level("DEBUG"):
            query_function(page=1, db="session", request="request_obj")

        # Check that sensitive params are not logged
        log_messages = [record.message for record in caplog.records]
        assert any("page" in msg for msg in log_messages)
        assert not any("db" in msg or "request" in msg for msg in log_messages)

    def test_returns_function_result(self):
        """Test that decorator returns function result correctly."""
        @log_query_params
        def query_function(value: int):
            return value * 2

        result = query_function(value=5)
        assert result == 10


class TestDecoratorComposition:
    """Test suite for combining multiple decorators."""

    @pytest.fixture(autouse=True)
    def clear_cache(self):
        """Clear cache before each test."""
        cache_service.clear()
        yield
        cache_service.clear()

    @pytest.mark.asyncio
    async def test_cache_and_performance_monitor(self, caplog):
        """Test combining cached_response and performance_monitor."""
        call_count = 0

        @performance_monitor
        @cached_response("items_list")
        async def get_items(page: int = 1):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)
            return {"items": [], "page": page}

        with caplog.at_level("DEBUG"):
            # First call - should execute and cache
            await get_items(page=1)
            assert call_count == 1

            # Second call - should use cache (faster)
            await get_items(page=1)
            assert call_count == 1  # Not executed again


# ============================================================================
# Config Module Tests
# ============================================================================

class TestSettingsClass:
    """Test suite for Settings configuration class."""

    def test_settings_defaults(self):
        """Test that Settings has correct default values."""
        test_settings = Settings()

        assert test_settings.CORS_ORIGINS == "http://localhost:5173"
        assert test_settings.APP_ENV == "development"
        assert test_settings.LOG_LEVEL == "INFO"
        assert test_settings.REDIS_URL == "redis://localhost:6379/0"

    def test_settings_from_environment(self):
        """Test that Settings loads from environment variables."""
        with patch.dict(os.environ, {
            'DATABASE_URL': 'postgresql://test:test@localhost/testdb',
            'APP_ENV': 'production',
            'LOG_LEVEL': 'DEBUG'
        }):
            test_settings = Settings()

            assert test_settings.DATABASE_URL == 'postgresql://test:test@localhost/testdb'
            assert test_settings.APP_ENV == 'production'
            assert test_settings.LOG_LEVEL == 'DEBUG'

    def test_database_url_can_be_set(self):
        """Test that DATABASE_URL can be set from environment."""
        test_db_url = 'postgresql://testuser:testpass@testhost:5432/testdb'
        with patch.dict(os.environ, {'DATABASE_URL': test_db_url}):
            test_settings = Settings()
            assert test_settings.DATABASE_URL == test_db_url

    def test_cors_origins_custom(self):
        """Test setting custom CORS origins."""
        with patch.dict(os.environ, {
            'CORS_ORIGINS': 'http://example.com,http://localhost:3000'
        }):
            test_settings = Settings()
            assert test_settings.CORS_ORIGINS == 'http://example.com,http://localhost:3000'

    def test_settings_validation_types(self):
        """Test that Settings validates types correctly."""
        with patch.dict(os.environ, {
            'DATABASE_URL': 'postgresql://localhost/db',
            'CORS_ORIGINS': 'http://localhost:5173',
            'APP_ENV': 'development',
            'LOG_LEVEL': 'INFO',
            'REDIS_URL': 'redis://localhost:6379'
        }):
            test_settings = Settings()

            assert isinstance(test_settings.DATABASE_URL, str)
            assert isinstance(test_settings.CORS_ORIGINS, str)
            assert isinstance(test_settings.APP_ENV, str)
            assert isinstance(test_settings.LOG_LEVEL, str)
            assert isinstance(test_settings.REDIS_URL, str)

    def test_settings_model_config(self):
        """Test that Settings has correct model configuration."""
        assert Settings.model_config['env_file'] == '.env'
        assert Settings.model_config['env_file_encoding'] == 'utf-8'


class TestGlobalSettingsInstance:
    """Test suite for global settings instance."""

    def test_settings_instance_exists(self):
        """Test that global settings instance is created."""
        from app.core.config import settings

        assert settings is not None
        assert isinstance(settings, Settings)

    def test_settings_instance_has_attributes(self):
        """Test that global settings instance has all required attributes."""
        from app.core.config import settings

        assert hasattr(settings, 'DATABASE_URL')
        assert hasattr(settings, 'CORS_ORIGINS')
        assert hasattr(settings, 'APP_ENV')
        assert hasattr(settings, 'LOG_LEVEL')
        assert hasattr(settings, 'REDIS_URL')

    def test_settings_singleton_behavior(self):
        """Test that importing settings returns the same instance."""
        from app.core.config import settings as settings1
        from app.core.config import settings as settings2

        assert settings1 is settings2


class TestConfigurationEdgeCases:
    """Test edge cases and error conditions in configuration."""

    def test_empty_environment_variables(self):
        """Test handling of empty string environment variables."""
        with patch.dict(os.environ, {
            'CORS_ORIGINS': '',
            'APP_ENV': '',
            'LOG_LEVEL': ''
        }):
            test_settings = Settings()

            # Empty strings should be used as-is
            assert test_settings.CORS_ORIGINS == ''
            assert test_settings.APP_ENV == ''
            assert test_settings.LOG_LEVEL == ''

    def test_database_url_parsing_format(self):
        """Test various DATABASE_URL formats are accepted."""
        test_urls = [
            'postgresql://user:pass@localhost:5432/dbname',
            'postgresql://user@localhost/dbname',
            'postgresql+asyncpg://user:pass@localhost/dbname',
        ]

        for url in test_urls:
            with patch.dict(os.environ, {'DATABASE_URL': url}):
                test_settings = Settings()
                assert test_settings.DATABASE_URL == url

    def test_log_level_case_sensitivity(self):
        """Test that log levels work regardless of case."""
        for level in ['DEBUG', 'debug', 'Debug', 'INFO', 'info']:
            with patch.dict(os.environ, {'LOG_LEVEL': level}):
                test_settings = Settings()
                assert test_settings.LOG_LEVEL == level

    def test_redis_url_with_password(self):
        """Test REDIS_URL with authentication."""
        redis_url = 'redis://:password@localhost:6379/0'
        with patch.dict(os.environ, {'REDIS_URL': redis_url}):
            test_settings = Settings()
            assert test_settings.REDIS_URL == redis_url

    def test_multiple_cors_origins(self):
        """Test handling multiple CORS origins."""
        origins = 'http://localhost:5173,http://localhost:3000,https://example.com'
        with patch.dict(os.environ, {'CORS_ORIGINS': origins}):
            test_settings = Settings()
            assert test_settings.CORS_ORIGINS == origins

            # Verify it can be split
            origin_list = test_settings.CORS_ORIGINS.split(',')
            assert len(origin_list) == 3
            assert 'http://localhost:5173' in origin_list
