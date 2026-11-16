"""
ASGI middleware that resolves the game version for a request.

URL form:  /api/v1/<version-slug>/items/123
Rewritten: /api/v1/items/123  with request.state.game_version = "<version-slug>"

A version is a build of the store (``app.store.context``). The segment may be
a build's slug or a family alias (``ao``), which names the family's newest
build; the request is served under the build's own slug either way, and the
response says which in ``X-Game-Version``. A request without a version segment
is served from the default build. Cross-version endpoints (e.g.
/api/v1/versions) are unaffected because their first segment is an API route,
never a version slug.

A first segment that is neither a build nor an API route is answered with 404
"Unknown game version", so a stale or mistyped slug fails loudly instead of
silently serving another version's data. When the store's builds cannot be
read at all, the answer is 503.

Requests outside the API prefix are passed through untouched.
"""

from __future__ import annotations

import json
import re
from contextvars import ContextVar
from typing import Optional, Set

from starlette.concurrency import run_in_threadpool
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings
from app.store import context

VERSION_HEADER = "X-Game-Version"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{0,39}$")

# Version slug of the current request (None outside a request); part of the
# response cache's key.
current_version: ContextVar[Optional[str]] = ContextVar(
    "current_game_version", default=None
)


def _build_slug(segment: str) -> Optional[str]:
    """The slug of the build a URL segment names, None when it names none."""
    build = context.builds.resolve(segment)
    return build.slug if build else None


def _default_slug() -> str:
    """The slug served to a request that names no version: the default build,
    else the newest build of the configured family. With neither (an empty
    store) it is the configured name itself, which no route will find."""
    build = context.builds.resolve(None) or context.builds.resolve(
        settings.DEFAULT_GAME_VERSION
    )
    return build.slug if build else settings.DEFAULT_GAME_VERSION


class GameVersionMiddleware:
    def __init__(self, app: ASGIApp, api_prefix: str = "/api/v1"):
        self.app = app
        self.prefix = api_prefix.rstrip("/")
        self._route_segments: Optional[Set[str]] = None

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
        path: str = scope["path"] if scope["type"] == "http" else ""
        if not path.startswith(self.prefix + "/"):
            await self.app(scope, receive, send)
            return

        rest = path[len(self.prefix) + 1 :]
        segment, _, tail = rest.partition("/")
        try:
            slug = await run_in_threadpool(_build_slug, segment) if segment else None
            if slug is not None:
                new_path = f"{self.prefix}/{tail}" if tail else self.prefix
                scope["path"] = new_path
                scope["raw_path"] = new_path.encode("utf-8")
            elif (
                segment
                and SLUG_RE.match(segment)
                and segment not in self._api_route_segments(scope)
            ):
                await self._answer(send, 404, f"Unknown game version '{segment}'")
                return
            else:
                slug = await run_in_threadpool(_default_slug)
        except context.BuildsUnavailable:
            await self._answer(send, 503, context.BUILDS_UNAVAILABLE)
            return

        state = scope.setdefault("state", {})
        state["game_version"] = slug

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)[VERSION_HEADER] = slug
            await send(message)

        token = current_version.set(slug)
        try:
            await self.app(scope, receive, send_with_header)
        finally:
            current_version.reset(token)

    @staticmethod
    async def _answer(send: Send, status: int, detail: str) -> None:
        body = json.dumps({"detail": detail}).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
