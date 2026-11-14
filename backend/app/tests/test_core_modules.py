"""
Unit tests for core backend infrastructure modules.

Tests critical functionality that affects all features:
- CacheService: In-memory caching with TTL support
- Decorators: Performance monitoring and caching decorators
- Config: Application configuration and settings
"""

import pytest
import json
import random
import time
import threading
import asyncio
import os
from typing import List
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.cache import (
    CACHE_TTL,
    ENTRY_OVERHEAD,
    LARGEST_ENTRY_FRACTION,
    CacheService,
    cache_key_for_query,
    cache_response,
    cache_service,
    get_cached_response,
)
from app.core.decorators import cached_response, performance_monitor, log_query_params
from app.core.config import Settings, settings
from app.main import app

# ============================================================================
# Cache Module Tests
# ============================================================================


class Clock:
    """A clock a test moves by hand."""

    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def room_for(entries, of_size):
    """The byte budget that holds exactly ``entries`` values of ``of_size``."""
    return entries * (of_size + ENTRY_OVERHEAD)


def held(cache, keys):
    """Which of ``keys`` the cache still holds, read without using them."""
    return [key for key in keys if key in cache.cache]


class TestCacheService:
    """Test suite for CacheService class."""

    @pytest.fixture
    def clock(self):
        return Clock()

    @pytest.fixture
    def cache(self, clock):
        """Create a fresh cache instance for each test."""
        return CacheService(default_ttl=10, max_bytes=1024 * 1024, clock=clock)

    def test_a_value_is_read_back_until_it_is_deleted(self, cache):
        cache.set("key", "value")

        assert cache.get("key") == "value"
        assert cache.delete("key") is True
        assert cache.get("key") is None
        assert cache.delete("key") is False
        assert (cache.stats["hits"], cache.stats["misses"]) == (1, 1)

    def test_a_key_never_written_is_a_miss(self, cache):
        assert cache.get("nonexistent_key") is None
        assert (cache.stats["hits"], cache.stats["misses"]) == (0, 1)

    def test_an_entry_expires_after_its_ttl(self, cache, clock):
        cache.set("short", "value", ttl=1)
        cache.set("default", "value")

        clock.now += 0.9
        assert cache.get("short") == "value"
        clock.now += 0.2
        assert cache.get("short") is None
        assert cache.get("default") == "value"
        clock.now += 10
        assert cache.get("default") is None
        assert cache.total_bytes == 0

    def test_a_write_drops_every_entry_that_has_expired(self, cache, clock):
        cache.set("short", b"x" * 100, ttl=5)
        cache.set("long", b"x" * 100, ttl=50)
        cache.set("short too", b"x" * 100, ttl=5)
        clock.now += 6

        cache.set("new", b"x" * 100, ttl=5)

        assert held(cache, ["short", "long", "short too", "new"]) == ["long", "new"]
        assert cache.total_bytes == room_for(2, 100)
        assert cache.stats["expirations"] == 2

    def test_a_rewritten_entry_expires_by_its_last_write(self, cache, clock):
        cache.set("key", "old", ttl=5)
        clock.now += 4
        cache.set("key", "new", ttl=5)
        clock.now += 4
        cache.set("other", "value")

        assert cache.get("key") == "new"

    def test_the_least_recently_used_entry_goes_first(self, clock):
        cache = CacheService(max_bytes=room_for(16, 100), clock=clock)
        keys = [f"key {n}" for n in range(16)]
        for key in keys:
            cache.set(key, b"x" * 100)

        assert cache.get("key 0") is not None
        cache.set("new", b"x" * 100)
        assert held(cache, keys) == ["key 0", *keys[2:]]

        cache.set("key 2", b"y" * 100)
        cache.set("newer", b"x" * 100)
        assert held(cache, keys) == ["key 0", "key 2", *keys[4:]]
        assert held(cache, ["new", "newer"]) == ["new", "newer"]
        assert cache.stats["evictions"] == 2

    def test_a_larger_entry_evicts_as_many_as_it_needs(self, clock):
        cache = CacheService(max_bytes=room_for(64, 100), clock=clock)
        keys = [f"key {n}" for n in range(64)]
        for key in keys:
            cache.set(key, b"x" * 100)

        cache.set("large", b"x" * (3 * 100 + 2 * ENTRY_OVERHEAD))

        assert held(cache, keys) == keys[3:]
        assert cache.get("large") is not None
        assert cache.total_bytes == cache.max_bytes

    def test_the_size_stays_within_its_bound_under_many_distinct_keys(self, clock):
        cache = CacheService(max_bytes=200_000, clock=clock)
        sizes = random.Random(7)

        for n in range(5000):
            cache.set(f"key {n}", b"x" * sizes.randrange(0, 20_000), ttl=60)
            clock.now += 0.01
            assert cache.total_bytes <= cache.max_bytes
            assert cache.total_bytes == sum(e.size for e in cache.cache.values())

        assert 0 < len(cache.cache) < 400
        assert cache.get("key 4999") is not None or cache.stats["rejections"] > 0

    def test_an_entry_too_large_for_the_cache_is_not_kept(self, clock):
        cache = CacheService(max_bytes=160_000, clock=clock)
        limit = 160_000 // LARGEST_ENTRY_FRACTION
        cache.set("small", b"x" * 100)
        cache.set("replaced", b"x" * 100)

        assert cache.set("fits", b"x" * (limit - ENTRY_OVERHEAD)) is True
        assert cache.set("too large", b"x" * (limit - ENTRY_OVERHEAD + 1)) is False
        assert cache.set("replaced", b"x" * limit) is False

        assert held(cache, ["small", "fits", "too large", "replaced"]) == [
            "small",
            "fits",
        ]
        assert cache.stats["rejections"] == 2

    def test_a_cache_without_room_keeps_nothing(self, clock):
        cache = CacheService(max_bytes=0, clock=clock)

        assert cache.set("key", b"") is False
        assert cache.get("key") is None

    def test_an_entry_is_as_large_as_its_bytes_or_as_the_caller_says(self, cache):
        cache.set("bytes", b"x" * 300)
        cache.set("text", "x" * 200)
        cache.set("response", JSONResponse({"a": 1}))
        cache.set("sized", {"any": "object"}, size=1000)

        sizes = {key: entry.size - ENTRY_OVERHEAD for key, entry in cache.cache.items()}
        assert sizes == {
            "bytes": 300,
            "text": 200,
            "response": len(b'{"a":1}'),
            "sized": 1000,
        }

    def test_clear_empties_the_cache(self, cache):
        for key in ("key1", "key2", "key3"):
            cache.set(key, b"value")

        cache.clear()

        assert cache.get("key1") is None
        assert (len(cache.cache), cache.total_bytes) == (0, 0)
        cache.set("key1", b"value")
        assert cache.get("key1") == b"value"

    def test_a_key_depends_on_its_parameters_and_not_on_their_order(self, cache):
        key = cache._generate_key("test", param1="value1", param2="value2")

        assert key == cache._generate_key("test", param2="value2", param1="value1")
        assert key != cache._generate_key("test", param1="value1", param2="value3")
        assert key != cache._generate_key("other", param1="value1", param2="value2")
        assert key.startswith("test:")

    def test_a_key_takes_parameters_of_any_type(self, cache):
        key = cache._generate_key(
            "test", list_param=[1, 2, 3], dict_param={"a": "b"}, int_param=42
        )

        assert key != cache._generate_key(
            "test", list_param=[1, 2, 4], dict_param={"a": "b"}, int_param=42
        )

    def test_requests_that_differ_in_one_parameter_never_share_a_key(self, cache):
        # enough requests that a 32-bit key would give several of them the
        # key of another
        requests = 300_000

        keys = {cache._generate_key("items", page=page) for page in range(requests)}

        assert len(keys) == requests

    def test_concurrent_writers_and_readers_see_their_own_values(self, cache):
        results = []

        def worker(value):
            cache.set(f"key_{value}", value)
            time.sleep(0.01)
            results.append(cache.get(f"key_{value}"))

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert sorted(results) == list(range(10))

    def test_concurrent_eviction_keeps_the_size_consistent(self, clock):
        cache = CacheService(max_bytes=room_for(50, 100), clock=clock)

        def writer(worker):
            for n in range(500):
                cache.set(f"{worker}-{n}", b"x" * 100)
                cache.get(f"{worker}-{n - 1}")

        threads = [threading.Thread(target=writer, args=(i,)) for i in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert len(cache.cache) == 50
        assert cache.total_bytes == cache.max_bytes


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
        assert key != cache_key_for_query("items", page=2, limit=10)

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

    def test_the_shared_cache_is_bounded_by_the_setting(self):
        assert cache_service.max_bytes == settings.RESPONSE_CACHE_MAX_BYTES
        assert Settings().RESPONSE_CACHE_MAX_BYTES == 256 * 1024 * 1024

    def test_every_cache_type_has_a_positive_ttl(self):
        for ttl_value in CACHE_TTL.values():
            assert isinstance(ttl_value, int)
            assert ttl_value > 0

    def test_clearing_over_the_api_empties_the_shared_cache(self):
        cache_response("test_key", b"value", ttl=60)

        with TestClient(app) as client:
            response = client.post("/api/v1/cache/clear")

        assert response.status_code == 200
        assert get_cached_response("test_key") is None
        assert cache_service.total_bytes == 0


# ============================================================================
# Decorators Module Tests
# ============================================================================


class Row(BaseModel):
    id: int
    name: str = Field(serialization_alias="label")
    note: str | None = None


class Listing(BaseModel):
    items: List[Row]
    page: int


def body(response):
    """The JSON a cached endpoint's response carries."""
    return json.loads(response.body)


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

        @cached_response("item_detail")
        async def get_items(page: int = 1):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)
            return {"items": [], "page": page}

        first = await get_items(page=1)
        second = await get_items(page=1)

        assert call_count == 1
        assert body(first) == body(second) == {"items": [], "page": 1}

    def test_sync_function_caching(self):
        """Test that sync functions are cached correctly."""
        call_count = 0

        @cached_response("item_detail")
        def get_items(page: int = 1):
            nonlocal call_count
            call_count += 1
            return {"items": [], "page": page}

        first = get_items(page=1)
        second = get_items(page=1)

        assert call_count == 1
        assert body(first) == body(second) == {"items": [], "page": 1}

    def test_requests_that_differ_in_one_parameter_get_their_own_response(self):
        calls = []

        @cached_response("item_detail")
        def get_items(page: int = 1, page_size: int = 50, q: str = ""):
            calls.append((page, page_size, q))
            return {"page": page, "page_size": page_size, "q": q}

        requests = [
            {"page": 1, "page_size": 50, "q": "a"},
            {"page": 2, "page_size": 50, "q": "a"},
            {"page": 1, "page_size": 51, "q": "a"},
            {"page": 1, "page_size": 50, "q": "b"},
        ]
        first = [body(get_items(**request)) for request in requests]
        again = [body(get_items(**request)) for request in requests]

        assert first == again == requests
        assert len(calls) == len(requests)

    def test_an_entry_is_cached_for_the_ttl_of_its_type_or_its_own(self, monkeypatch):
        clock = Clock()
        monkeypatch.setattr(cache_service, "_clock", clock)
        calls = []

        @cached_response("item_detail")
        def by_type():
            calls.append("type")
            return {}

        @cached_response("item_detail", ttl=1)
        def by_ttl():
            calls.append("ttl")
            return {}

        by_type(), by_ttl()
        clock.now += 2
        by_type(), by_ttl()
        clock.now += CACHE_TTL["item_detail"]
        by_type()

        assert calls == ["type", "ttl", "ttl", "type"]

    def test_a_cache_type_without_a_ttl_is_refused(self):
        with pytest.raises(ValueError, match="no_such_type"):
            cached_response("no_such_type")

    @pytest.mark.asyncio
    async def test_db_param_excluded_from_cache_key(self):
        """Test that 'db' parameter is excluded from cache key."""
        call_count = 0

        @cached_response("item_detail")
        async def get_items(page: int = 1, db=None):
            nonlocal call_count
            call_count += 1
            return {"items": [], "page": page}

        await get_items(page=1, db="session1")
        await get_items(page=1, db="session2")

        assert call_count == 1

    def test_the_cache_holds_the_serialised_body_at_its_size(self):
        @cached_response("item_detail")
        def get_items():
            return Listing(items=[Row(id=1, name="Wrench")], page=1)

        response = get_items()

        (entry,) = cache_service.cache.values()
        assert entry.value.body == response.body
        assert entry.size == len(response.body) + ENTRY_OVERHEAD
        assert cache_service.total_bytes == entry.size

    def test_an_endpoint_answers_the_same_with_and_without_the_cache(self):
        api = FastAPI()
        calls = []

        def listing(page: int = 1):
            calls.append(page)
            return Listing(items=[Row(id=1, name="Wrénch"), Row(id=2, name="")], page=1)

        api.get("/plain", response_model=Listing)(listing)
        api.get("/cached", response_model=Listing)(
            cached_response("item_detail")(listing)
        )
        api.get("/cached-rows", response_model=List[Row])(
            cached_response("item_detail")(lambda: listing().items)
        )

        with TestClient(api) as client:
            plain = client.get("/plain")
            miss = client.get("/cached")
            hit = client.get("/cached")
            rows = client.get("/cached-rows")

        assert calls == [1, 1, 1]
        assert plain.json()["items"][0] == {"id": 1, "label": "Wrénch", "note": None}
        assert miss.content == hit.content == plain.content
        assert miss.headers["content-type"] == plain.headers["content-type"]
        assert hit.headers["content-type"] == plain.headers["content-type"]
        assert rows.json() == plain.json()["items"]

    def test_a_response_the_endpoint_built_is_cached_by_its_body(self):
        calls = []

        @cached_response("weapons_analyze")
        def analyze(skill: int = 1):
            calls.append(skill)
            return JSONResponse([{"aoid": skill}])

        first, second = analyze(skill=5), analyze(skill=5)

        assert calls == [5]
        assert body(first) == body(second) == [{"aoid": 5}]
        assert second.media_type == "application/json"

    def test_an_error_is_not_cached(self):
        calls = []

        @cached_response("item_detail")
        def get_item(aoid: int):
            calls.append(aoid)
            if len(calls) == 1:
                raise HTTPException(status_code=404, detail="Item not found")
            return {"aoid": aoid}

        @cached_response("item_detail")
        def unavailable():
            calls.append("unavailable")
            return JSONResponse({"detail": "later"}, status_code=503)

        with pytest.raises(HTTPException):
            get_item(aoid=1)
        assert body(get_item(aoid=1)) == {"aoid": 1}
        assert unavailable().status_code == unavailable().status_code == 503
        assert calls == [1, 1, "unavailable", "unavailable"]

    def test_a_body_too_large_for_the_cache_is_served_and_not_kept(self, monkeypatch):
        monkeypatch.setattr(cache_service, "max_bytes", 64 * 1024)
        calls = []

        @cached_response("item_detail")
        def get_items(size: int):
            calls.append(size)
            return {"text": "x" * size}

        large = [get_items(size=8 * 1024), get_items(size=8 * 1024)]
        small = [get_items(size=100), get_items(size=100)]

        assert [len(body(response)["text"]) for response in large] == [8192, 8192]
        assert [len(body(response)["text"]) for response in small] == [100, 100]
        assert calls == [8192, 8192, 100]
        assert cache_service.total_bytes <= 64 * 1024

    def test_many_distinct_requests_stay_within_the_bound(self, monkeypatch):
        monkeypatch.setattr(cache_service, "max_bytes", 256 * 1024)

        @cached_response("item_detail")
        def get_items(page: int):
            return {"page": page, "text": "x" * 4000}

        for page in range(2000):
            get_items(page=page)
            assert cache_service.total_bytes <= 256 * 1024

        assert 0 < len(cache_service.cache) < 64
        assert body(get_items(page=1999))["page"] == 1999


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
        assert any(
            "Error in error_function" in record.message for record in caplog.records
        )

    def test_sync_function_error_handling(self, caplog):
        """Test that errors are logged with execution time for sync functions."""

        @performance_monitor
        def error_function():
            time.sleep(0.01)
            raise ValueError("Test error")

        with caplog.at_level("ERROR"):
            with pytest.raises(ValueError, match="Test error"):
                error_function()

        assert any(
            "Error in error_function" in record.message for record in caplog.records
        )


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
        @cached_response("item_detail")
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
        with patch.dict(
            os.environ,
            {
                "DATABASE_URL": "postgresql://test:test@localhost/testdb",
                "APP_ENV": "production",
                "LOG_LEVEL": "DEBUG",
            },
        ):
            test_settings = Settings()

            assert (
                test_settings.DATABASE_URL == "postgresql://test:test@localhost/testdb"
            )
            assert test_settings.APP_ENV == "production"
            assert test_settings.LOG_LEVEL == "DEBUG"

    def test_database_url_can_be_set(self):
        """Test that DATABASE_URL can be set from environment."""
        test_db_url = "postgresql://testuser:testpass@testhost:5432/testdb"
        with patch.dict(os.environ, {"DATABASE_URL": test_db_url}):
            test_settings = Settings()
            assert test_settings.DATABASE_URL == test_db_url

    def test_cors_origins_custom(self):
        """Test setting custom CORS origins."""
        with patch.dict(
            os.environ, {"CORS_ORIGINS": "http://example.com,http://localhost:3000"}
        ):
            test_settings = Settings()
            assert (
                test_settings.CORS_ORIGINS == "http://example.com,http://localhost:3000"
            )

    def test_settings_validation_types(self):
        """Test that Settings validates types correctly."""
        with patch.dict(
            os.environ,
            {
                "DATABASE_URL": "postgresql://localhost/db",
                "CORS_ORIGINS": "http://localhost:5173",
                "APP_ENV": "development",
                "LOG_LEVEL": "INFO",
                "REDIS_URL": "redis://localhost:6379",
            },
        ):
            test_settings = Settings()

            assert isinstance(test_settings.DATABASE_URL, str)
            assert isinstance(test_settings.CORS_ORIGINS, str)
            assert isinstance(test_settings.APP_ENV, str)
            assert isinstance(test_settings.LOG_LEVEL, str)
            assert isinstance(test_settings.REDIS_URL, str)

    def test_settings_model_config(self):
        """Test that Settings has correct model configuration."""
        assert Settings.model_config["env_file"] == ".env"
        assert Settings.model_config["env_file_encoding"] == "utf-8"


class TestGlobalSettingsInstance:
    """Test suite for global settings instance."""

    def test_settings_instance_exists(self):
        """Test that global settings instance is created."""

        assert settings is not None
        assert isinstance(settings, Settings)

    def test_settings_instance_has_attributes(self):
        """Test that global settings instance has all required attributes."""

        assert hasattr(settings, "DATABASE_URL")
        assert hasattr(settings, "CORS_ORIGINS")
        assert hasattr(settings, "APP_ENV")
        assert hasattr(settings, "LOG_LEVEL")
        assert hasattr(settings, "REDIS_URL")

    def test_settings_singleton_behavior(self):
        """Test that importing settings returns the same instance."""
        from app.core.config import settings as settings1
        from app.core.config import settings as settings2

        assert settings1 is settings2


class TestConfigurationEdgeCases:
    """Test edge cases and error conditions in configuration."""

    def test_empty_environment_variables(self):
        """Test handling of empty string environment variables."""
        with patch.dict(
            os.environ, {"CORS_ORIGINS": "", "APP_ENV": "", "LOG_LEVEL": ""}
        ):
            test_settings = Settings()

            # Empty strings should be used as-is
            assert test_settings.CORS_ORIGINS == ""
            assert test_settings.APP_ENV == ""
            assert test_settings.LOG_LEVEL == ""

    def test_database_url_parsing_format(self):
        """Test various DATABASE_URL formats are accepted."""
        test_urls = [
            "postgresql://user:pass@localhost:5432/dbname",
            "postgresql://user@localhost/dbname",
            "postgresql+asyncpg://user:pass@localhost/dbname",
        ]

        for url in test_urls:
            with patch.dict(os.environ, {"DATABASE_URL": url}):
                test_settings = Settings()
                assert test_settings.DATABASE_URL == url

    def test_log_level_case_sensitivity(self):
        """Test that log levels work regardless of case."""
        for level in ["DEBUG", "debug", "Debug", "INFO", "info"]:
            with patch.dict(os.environ, {"LOG_LEVEL": level}):
                test_settings = Settings()
                assert test_settings.LOG_LEVEL == level

    def test_redis_url_with_password(self):
        """Test REDIS_URL with authentication."""
        redis_url = "redis://:password@localhost:6379/0"
        with patch.dict(os.environ, {"REDIS_URL": redis_url}):
            test_settings = Settings()
            assert test_settings.REDIS_URL == redis_url

    def test_multiple_cors_origins(self):
        """Test handling multiple CORS origins."""
        origins = "http://localhost:5173,http://localhost:3000,https://example.com"
        with patch.dict(os.environ, {"CORS_ORIGINS": origins}):
            test_settings = Settings()
            assert test_settings.CORS_ORIGINS == origins

            # Verify it can be split
            origin_list = test_settings.CORS_ORIGINS.split(",")
            assert len(origin_list) == 3
            assert "http://localhost:5173" in origin_list
