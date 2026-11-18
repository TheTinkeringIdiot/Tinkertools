"""
In-memory response cache, bounded in bytes.

``CacheService`` keeps entries until they expire, until they are the least
recently used when room is needed, or until ``clear``. Its total size never
exceeds ``max_bytes``:

* every entry has a size: the length of a bytes or str value, or what the
  caller passes as ``size``;
* writing an entry first drops every entry that has expired, then the least
  recently used ones until the new entry fits;
* an entry larger than ``max_bytes / LARGEST_ENTRY_FRACTION`` is not kept, so
  one response cannot push out everything else.

A read counts as a use. An expired entry is dropped by the read that finds it
as well as by the next write.

``get_or_compute`` is for a value that is costly to make and asked for by
several requests at once: the first to miss computes it and the others wait
for that result.

``cached_response`` (app/core/decorators.py) stores the serialised body of a
response, so an entry's size is the memory it holds, give or take the
``ENTRY_OVERHEAD`` charged for its key and bookkeeping.

What the bound bounds
=====================

``max_bytes`` bounds what the cache holds, and it does: with the cache full
of 200-row diff pages (1,724 entries, measured in the running server) it
accounted 256.0 MB for 242.5 MB of bodies, 12 comparisons at their real size
and 0.9 MB of overhead; the keys take 0.23 MB, less than the overhead charged.

It does not bound the process. Building responses takes memory of its own,
which the C library keeps after it is freed: 4,200 distinct 200-row diff
pages of twelve comparisons (563 MB of bodies, so the cache evicts 2,500 of
them), from a server that is at 130 MB when ready:

==========================================  ========  =================
server and load                             resident  after malloc_trim
==========================================  ========  =================
256 MB cache, 4 requests at a time          460 MB    424 MB
256 MB cache, 16 at a time                  535 MB    454 MB
the same with ``MALLOC_ARENA_MAX=2``        477 MB    438 MB
the same with a 64 KB mmap threshold        459 MB    438 MB
64 MB cache, 16 at a time                   335 MB    267 MB
==========================================  ========  =================

So a busy server settles at its ready size, plus the cache bound, plus 70 to
150 MB whatever the bound is: about 75 MB that requests leave in use (warmed
statement and serialiser caches, fragments of the heaps of the worker
threads), and up to as much again that is free but kept by the allocator,
more of it the more requests run at once. Plan for 550 MB with the default
bound. ``MALLOC_ARENA_MAX=2`` in the server's environment takes 60 MB off
that at no measured cost.
"""

import hashlib
import json
import threading
import time
from collections import OrderedDict
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterator, List, Optional

from app.core.config import settings

# An entry may take at most this fraction (1/n) of the cache.
LARGEST_ENTRY_FRACTION = 16
# Charged to every entry on top of its value: key, entry and index slots.
ENTRY_OVERHEAD = 512


@dataclass(frozen=True)
class _Entry:
    value: Any
    expires_at: float
    ttl: int
    size: int


def _size_of(value: Any) -> int:
    """Bytes ``value`` holds, when that is cheap to know: its length for bytes
    and text, the body's for a response. Anything else has no known size and
    counts as nothing but the overhead: give ``size`` to ``set`` for it."""
    if isinstance(value, (bytes, bytearray, memoryview, str)):
        return len(value)
    body = getattr(value, "body", None)
    if isinstance(body, (bytes, bytearray, memoryview)):
        return len(body)
    return 0


class CacheService:
    """
    Thread-safe in-memory cache with TTL, least-recently-used eviction and a
    bound on its total size in bytes.
    """

    def __init__(
        self,
        default_ttl: int = 300,
        max_bytes: Optional[int] = None,
        clock: Callable[[], float] = time.time,
    ):
        self.default_ttl = default_ttl
        self._clock = clock
        self.max_bytes = (
            settings.RESPONSE_CACHE_MAX_BYTES if max_bytes is None else max_bytes
        )
        # Least recently used first.
        self.cache: "OrderedDict[str, _Entry]" = OrderedDict()
        # Keys by TTL, oldest write first: entries of one TTL expire in the
        # order they were written, so the expired ones are at the front.
        self._by_ttl: Dict[int, "OrderedDict[str, None]"] = {}
        self.total_bytes = 0
        self.lock = threading.RLock()
        # Keys being computed by ``get_or_compute``: the lock that whoever
        # computes holds, and how many callers hold or wait for it.
        self._computing: Dict[str, List[Any]] = {}
        self.stats = {
            "hits": 0,
            "misses": 0,
            "sets": 0,
            "evictions": 0,
            "expirations": 0,
            "rejections": 0,
        }

    @property
    def max_entry_bytes(self) -> int:
        """The largest entry the cache keeps."""
        return self.max_bytes // LARGEST_ENTRY_FRACTION

    def _generate_key(self, prefix: str, **kwargs) -> str:
        """Generate a cache key from parameters: the prefix and the full
        SHA-256 of the parameters, so two requests share a key only if their
        parameters are the same."""
        params = json.dumps(kwargs, sort_keys=True, default=str)
        return f"{prefix}:{hashlib.sha256(params.encode()).hexdigest()}"

    def _remove(self, key: str) -> None:
        entry = self.cache.pop(key)
        self.total_bytes -= entry.size
        same_ttl = self._by_ttl[entry.ttl]
        del same_ttl[key]
        if not same_ttl:
            del self._by_ttl[entry.ttl]

    def _drop_expired(self, now: float) -> None:
        for same_ttl in list(self._by_ttl.values()):
            while same_ttl:
                key = next(iter(same_ttl))
                if self.cache[key].expires_at > now:
                    break
                self._remove(key)
                self.stats["expirations"] += 1

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        with self.lock:
            entry = self.cache.get(key)
            if entry is None:
                self.stats["misses"] += 1
                return None

            if self._clock() >= entry.expires_at:
                self._remove(key)
                self.stats["expirations"] += 1
                self.stats["misses"] += 1
                return None

            self.cache.move_to_end(key)
            self.stats["hits"] += 1
            return entry.value

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        size: Optional[int] = None,
    ) -> bool:
        """Set a value in cache with TTL. Returns whether it was kept: an
        entry too large for the cache is not, and an older value under the
        same key goes either way."""
        ttl = ttl or self.default_ttl
        entry_size = (_size_of(value) if size is None else size) + ENTRY_OVERHEAD
        with self.lock:
            now = self._clock()
            if key in self.cache:
                self._remove(key)
            self._drop_expired(now)
            if entry_size > self.max_entry_bytes:
                self.stats["rejections"] += 1
                return False
            while self.total_bytes + entry_size > self.max_bytes:
                self._remove(next(iter(self.cache)))
                self.stats["evictions"] += 1
            self.cache[key] = _Entry(value, now + ttl, ttl, entry_size)
            self._by_ttl.setdefault(ttl, OrderedDict())[key] = None
            self.total_bytes += entry_size
            self.stats["sets"] += 1
            return True

    @contextmanager
    def _alone(self, key: str) -> Iterator[None]:
        """Holds the block for one caller per key at a time."""
        with self.lock:
            turn = self._computing.setdefault(key, [threading.Lock(), 0])
            turn[1] += 1
        try:
            with turn[0]:
                yield
        finally:
            with self.lock:
                turn[1] -= 1
                if not turn[1]:
                    del self._computing[key]

    def get_or_compute(
        self,
        key: str,
        compute: Callable[[], Any],
        ttl: Optional[int] = None,
        size_of: Optional[Callable[[Any], int]] = None,
    ) -> Any:
        """The value under ``key``, computed and kept when it is not there.

        Callers that miss the same key at the same time compute once: the
        first calls ``compute``, the others wait and take its result. If it
        raises, the next in line tries. ``size_of`` gives the bytes of a
        value whose size ``set`` cannot know. A value the cache does not
        keep (too large, or the cache is off) is still returned, and is then
        computed again by the next caller.
        """
        found = self.get(key)
        if found is not None:
            return found
        with self._alone(key):
            with self.lock:
                entry = self.cache.get(key)
                if entry is not None and self._clock() < entry.expires_at:
                    self.cache.move_to_end(key)
                    return entry.value
            value = compute()
            self.set(key, value, ttl, None if size_of is None else size_of(value))
            return value

    def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        with self.lock:
            if key in self.cache:
                self._remove(key)
                return True
            return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self.lock:
            self.cache.clear()
            self._by_ttl.clear()
            self.total_bytes = 0


# Global cache instance
cache_service = CacheService()


def cache_key_for_query(endpoint: str, **params) -> str:
    """Generate a cache key for API endpoint with parameters."""
    return cache_service._generate_key(endpoint, **params)


def get_cached_response(key: str) -> Optional[Any]:
    """Get cached response."""
    return cache_service.get(key)


def cache_response(
    key: str, response: Any, ttl: int = 300, size: Optional[int] = None
) -> bool:
    """Cache a response. Returns whether the cache kept it."""
    return cache_service.set(key, response, ttl, size)


# Seconds a response of each cache type is kept. Every type given to
# ``cached_response`` is listed here.
CACHE_TTL = {
    "item_detail": 600,  # 10 minutes - individual items rarely change
    "symbiants": 1800,  # 30 minutes - symbiant info is very static
    "symbiant_sources": 300,
    "mobs": 300,
    "mob_drops": 300,
    "nanos_list": 300,
    "nanos_search": 300,
    "nanos_strains": 300,
    "nanos_profession": 3600,  # 1 hour - whole profession lists, costly to build
    "nanos_offensive": 3600,
    "weapons_analyze": 3600,  # 1 hour - weapon analysis is static game data
    # Diffs of two builds: immutable until the next import
    "changes_list": 3600,
    "changes_compare": 3600,
    "changes_transitions": 3600,
    "item_timeline": 3600,
    "item_compare": 3600,
}
