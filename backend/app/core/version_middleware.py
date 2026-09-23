"""
ASGI middleware that resolves the game version for a request.

URL form:  /api/v1/<version-slug>/items/123
Rewritten: /api/v1/items/123  with request.state.game_version = "<version-slug>"

A request without a version segment (the legacy form) is served from the
default version. Cross-version endpoints (e.g. /api/v1/versions) are unaffected
because their first segment is an API route, never a version slug.

A first segment that is neither a registered version nor an API route:

- registry available: 404 "Unknown game version", so a stale or mistyped slug
  fails loudly instead of silently serving another version's data.
- registry unavailable (public.game_versions missing, empty or unreadable): the
  segment is stripped and the request is served from the default version. The
  frontend always prefixes a slug, so without this fallback a missing registry
  would take down every API call rather than degrade to the default data.
  The requested slug is echoed in X-Game-Version-Fallback.
"""

from __future__ import annotations

import json
import logging
from typing import Optional, Set

from starlette.concurrency import run_in_threadpool
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.versions import SLUG_RE, current_version, registry

logger = logging.getLogger(__name__)

VERSION_HEADER = "X-Game-Version"
FALLBACK_HEADER = "X-Game-Version-Fallback"


class GameVersionMiddleware:
    def __init__(self, app: ASGIApp, api_prefix: str = "/api/v1"):
        self.app = app
        self.prefix = api_prefix.rstrip("/")
        self._route_segments: Optional[Set[str]] = None
        self._warned_fallback = False

    def _api_route_segments(self, scope: Scope) -> Set[str]:
        """First path segments of every route under the API prefix (items, versions, ...)."""
        if self._route_segments is None:
            segments: Set[str] = set()
            app = scope.get("app")
            for route in getattr(app, "routes", []) or []:
                path = getattr(route, "path", "")
                if path.startswith(self.prefix + "/"):
                    segment = path[len(self.prefix) + 1 :].split("/", 1)[0]
                    if segment and not segment.startswith("{"):
                        segments.add(segment)
            self._route_segments = segments
        return self._route_segments

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope["path"]
        slug = None
        fallback_from = None

        if path.startswith(self.prefix + "/"):
            rest = path[len(self.prefix) + 1 :]
            segment, _, tail = rest.partition("/")
            strip = False
            if segment and await run_in_threadpool(registry.is_version, segment):
                slug = segment
                strip = True
            elif (
                segment
                and SLUG_RE.match(segment)
                and segment not in self._api_route_segments(scope)
            ):
                if await run_in_threadpool(registry.is_available):
                    await self._unknown_version(send, segment)
                    return
                fallback_from = segment
                strip = True
                if not self._warned_fallback:
                    logger.warning(
                        "Game version registry unavailable; serving %r from the default version",
                        segment,
                    )
                    self._warned_fallback = True

            if strip:
                new_path = f"{self.prefix}/{tail}" if tail else self.prefix
                scope["path"] = new_path
                scope["raw_path"] = new_path.encode("utf-8")

        if slug is None:
            slug = await run_in_threadpool(registry.default_slug)

        state = scope.setdefault("state", {})
        state["game_version"] = slug

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers[VERSION_HEADER] = slug
                if fallback_from is not None:
                    headers[FALLBACK_HEADER] = fallback_from
            await send(message)

        token = current_version.set(slug)
        try:
            await self.app(scope, receive, send_with_header)
        finally:
            current_version.reset(token)

    @staticmethod
    async def _unknown_version(send: Send, segment: str) -> None:
        body = json.dumps({"detail": f"Unknown game version '{segment}'"}).encode(
            "utf-8"
        )
        await send(
            {
                "type": "http.response.start",
                "status": 404,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
