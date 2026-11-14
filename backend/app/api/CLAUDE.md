# Backend API

## Purpose
FastAPI routes, schemas, and services for TinkerTools backend API endpoints.

## Store Read Path
Every route that serves game data reads the content-addressed store (schema `cas`) through `app/store`. A route takes `get_store` and `get_build` (`app/store/context.py`), builds lists on `revisions(build)`, pages them with `fetch_page` (or `fetch_search_page` when the query matches text) and loads items with `load_item_details`. The module docstring of `app/store/__init__.py` is the guide to writing a route on the store ("Writing a route", "Testing", "Golden comparison", "Pitfalls"): read it before writing or changing a route.

Two routes do not read the store: `GET /versions` (registry `public.game_versions`) and `POST /legacy-item-ids/resolve` (old per-version store, until cutover). The ORM models in `app/models/` serve those two and the old importers only; do not use them in a store session.

## Key Patterns
- **One build per request**: the session has no version state; pass `build` to every query
- **Compose queries from `app/store/tables.py`**: raw `text()` SQL bypasses the schema mapping tests rely on
- **Constant query count**: load a page with `load_item_details` / `load_records` (one to three queries whatever the page size); never query per row
- **Stable order**: `fetch_page` and `fetch_search_page` end every sort on the AOID; never sort by an internal id
- **One item shape**: `item_document` in `app/store/items.py` is the only place the `ItemDetail` shape is written; derive other item responses from it
- **Response Caching**: Use `@cached_response("<type>")` for expensive endpoints with static data; keep the session parameter named `db` so it stays out of the cache key. The cache holds serialised bodies up to `RESPONSE_CACHE_MAX_BYTES` and the decorated endpoint returns a `Response`
- **Pagination**: Return `PaginatedResponse[T]` with `page_fields(...)` for large datasets
- **Synchronous DB Operations**: Use synchronous SQLAlchemy (not async) - FastAPI handles concurrency via thread pool

## File Structure
- `routes/` - API endpoint handlers (items, weapons, nanos, etc.)
- `schemas/` - Pydantic request/response models
- `services/item_search.py`, `services/weapon_filter_service.py` - filters and queries of the item and weapon routes
- `backend/app/services/` - nanos, implant lookup, interpolation
- `backend/app/store/` - the read layer (`context`, `tables`, `presence`, `items`, `curated`)

## Testing
Controlled data comes from the `store` fixture (`app/tests/fixtures/store_fixtures.py`); a test on the real game data takes its expected values from the store through the `store_db` and `build` fixtures. See "Testing" in the `app/store/__init__.py` docstring.

## Notes
Every cache type has its TTL in `CACHE_TTL` (`backend/app/core/cache.py`); a type that is not listed there is refused. Use 1 hour for static game data that is costly to build.
