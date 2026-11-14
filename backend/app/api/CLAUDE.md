# Backend API

## Purpose
FastAPI routes, schemas, and services for TinkerTools backend API endpoints.

## Store Read Path
Every route that serves game data reads the content-addressed store (schema `cas`) through `app/store`. A route takes `get_store` and `get_build` (`app/store/context.py`), builds lists on `revisions(build)` and loads items with `load_item_details`. The module docstring of `app/store/__init__.py` is the guide: read it before writing or changing a route.

Two routes do not read the store: `GET /versions` (registry `public.game_versions`) and `POST /legacy-item-ids/resolve` (old per-version store, until cutover). The ORM models in `app/models/` serve those two and the old importers only; do not use them in a store session.

## Key Patterns
- **One build per request**: the session has no version state; pass `build` to every query
- **Compose queries from `app/store/tables.py`**: raw `text()` SQL bypasses the schema mapping tests rely on
- **Constant query count**: load a page with `load_item_details` / `load_records` (one to three queries whatever the page size); never query per row
- **Stable order**: `fetch_page` ends every sort on the AOID; never sort by an internal id
- **One item shape**: `item_document` in `app/store/items.py` is the only place the `ItemDetail` shape is written; derive other item responses from it
- **Response Caching**: Use `@cached_response` for expensive endpoints with static data; keep the session parameter named `db` so it stays out of the cache key
- **Pagination**: Return `PaginatedResponse[T]` with `page_fields(...)` for large datasets
- **Synchronous DB Operations**: Use synchronous SQLAlchemy (not async) - FastAPI handles concurrency via thread pool

## File Structure
- `routes/` - API endpoint handlers (items, weapons, nanos, etc.)
- `schemas/` - Pydantic request/response models
- `services/item_search.py`, `services/weapon_filter_service.py` - filters and queries of the item and weapon routes
- `backend/app/services/` - nanos, implant lookup, interpolation
- `backend/app/store/` - the read layer (`context`, `tables`, `presence`, `items`, `curated`)

## Testing
Controlled data comes from the `store` fixture (`app/tests/fixtures/store_fixtures.py`); see "Testing" in the `app/store/__init__.py` docstring.

## Notes
Cache TTL configured in `backend/app/core/cache.py` - use 1 hour for static game data.
