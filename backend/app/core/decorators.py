"""
Decorators for API endpoints including caching and performance monitoring.
"""

import time
import functools
import logging
from dataclasses import dataclass
from typing import Any, Callable, Optional
import asyncio

from pydantic_core import PydanticSerializationError, to_json
from starlette.responses import Response

from app.core.cache import (
    cache_key_for_query,
    get_cached_response,
    cache_response,
    CACHE_TTL,
)
from app.core.versions import resolve_current_slug

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _CachedBody:
    """A finished response as the cache holds it."""

    body: bytes
    media_type: Optional[str]

    def response(self) -> Response:
        return Response(content=self.body, media_type=self.media_type)


def _finished(result: Any) -> Optional[_CachedBody]:
    """The body ``result`` is sent as, None when it cannot be cached.

    A route's own plain 200 response is taken by its body and media type.
    Anything else is serialised as FastAPI serialises a response model: the
    JSON of its models, lists and dicts.
    """
    if isinstance(result, Response):
        body = getattr(result, "body", None)
        if (
            isinstance(body, bytes)
            and result.status_code == 200
            and result.background is None
        ):
            return _CachedBody(body, result.media_type)
        return None
    try:
        return _CachedBody(to_json(result), "application/json")
    except PydanticSerializationError:
        logger.warning(f"Response of type {type(result).__name__} is not cached")
        return None


def cached_response(cache_type: str, ttl: Optional[int] = None):
    """
    Decorator to cache an endpoint's response under its keyword arguments.

    The cache holds the serialised body, not the objects the endpoint
    returned: its size is then known exactly and a hit costs no validation or
    serialisation. The endpoint's caller therefore gets a ``Response``, on a
    miss as on a hit, which FastAPI sends as it is. An exception is not
    cached, nor is a body too large for the cache (see app/core/cache.py).

    The key is the endpoint, the game version and every keyword argument but
    ``db``.

    FastAPI does not validate or filter a ``Response`` against the route's
    ``response_model``, which is left to document the route: the endpoint
    must return exactly what the model describes (see "Caching" in
    app/store/__init__.py). The wrapped endpoint carries its cache type as
    ``cache_type``, by which the test of that rule finds the cached routes.

    Args:
        cache_type: A key of CACHE_TTL, which gives the time to live; any
            other name is refused when the endpoint is defined
        ttl: Time to live in seconds, instead of the one of the cache type
    """
    if cache_type not in CACHE_TTL:
        raise ValueError(f"Unknown cache type {cache_type!r}: add it to CACHE_TTL")
    cache_ttl = ttl or CACHE_TTL[cache_type]

    def decorator(func: Callable) -> Callable:
        def key_of(kwargs: dict) -> str:
            # Remove 'db' session from cache key as it's not relevant
            cache_params = {k: v for k, v in kwargs.items() if k != "db"}
            # Responses differ per game version; the version is not a route
            # kwarg, so it is folded into the key explicitly.
            cache_params["__game_version"] = resolve_current_slug()
            return cache_key_for_query(
                f"{func.__module__}.{func.__name__}", **cache_params
            )

        def cached(cache_key: str) -> Optional[Response]:
            found = get_cached_response(cache_key)
            if found is None:
                return None
            logger.debug(f"Cache hit for {func.__name__}: {cache_key}")
            return found.response()

        def keep(cache_key: str, result: Any, started: float) -> Any:
            finished = _finished(result)
            if finished is not None:
                cache_response(cache_key, finished, cache_ttl, len(finished.body))
            logger.debug(
                f"Cache miss for {func.__name__}: {cache_key} "
                f"(executed in {time.time() - started:.3f}s)"
            )
            if finished is None or isinstance(result, Response):
                return result
            return finished.response()

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache_key = key_of(kwargs)
            response = cached(cache_key)
            if response is not None:
                return response
            started = time.time()
            return keep(cache_key, await func(*args, **kwargs), started)

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache_key = key_of(kwargs)
            response = cached(cache_key)
            if response is not None:
                return response
            started = time.time()
            return keep(cache_key, func(*args, **kwargs), started)

        wrapper = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapper.cache_type = cache_type
        return wrapper

    return decorator


def performance_monitor(func: Callable) -> Callable:
    """
    Decorator to monitor endpoint performance and log slow queries.
    Handles both sync and async functions.
    """

    @functools.wraps(func)
    async def async_wrapper(*args, **kwargs):
        start_time = time.time()

        try:
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time

            # Log slow queries (>500ms per REQ-PERF-001)
            if execution_time > 0.5:
                logger.warning(
                    f"Slow query in {func.__name__}: {execution_time:.3f}s - {kwargs}"
                )
            elif execution_time > 0.2:
                logger.info(f"Moderate query in {func.__name__}: {execution_time:.3f}s")

            return result

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error in {func.__name__} after {execution_time:.3f}s: {e}")
            raise

    @functools.wraps(func)
    def sync_wrapper(*args, **kwargs):
        start_time = time.time()

        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time

            # Log slow queries (>500ms per REQ-PERF-001)
            if execution_time > 0.5:
                logger.warning(
                    f"Slow query in {func.__name__}: {execution_time:.3f}s - {kwargs}"
                )
            elif execution_time > 0.2:
                logger.info(f"Moderate query in {func.__name__}: {execution_time:.3f}s")

            return result

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Error in {func.__name__} after {execution_time:.3f}s: {e}")
            raise

    # Return the appropriate wrapper based on whether the function is async
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


def log_query_params(func: Callable) -> Callable:
    """
    Decorator to log query parameters for debugging.
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Log non-sensitive parameters
        log_params = {k: v for k, v in kwargs.items() if k not in ["db", "request"]}
        logger.debug(f"Query {func.__name__}: {log_params}")
        return func(*args, **kwargs)

    return wrapper
