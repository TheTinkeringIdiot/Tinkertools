# Backend API

## Purpose
FastAPI routes, schemas, and services for TinkerTools backend API endpoints.

## Key Patterns
- **Eager Loading**: Use SQLAlchemy `joinedload()` to preload relationships and avoid N+1 queries
- **JOIN over Subqueries**: Convert subqueries to JOINs for better query performance
- **Response Caching**: Use `@cached_response` decorator for expensive endpoints with static data
- **Pagination**: Return `PaginatedResponse[T]` for large datasets (prevents gateway timeouts, enables chunked loading)
- **Dependency Injection**: Use FastAPI `Depends()` for database sessions and services
- **Synchronous DB Operations**: Use synchronous SQLAlchemy (not async) - FastAPI handles concurrency via thread pool
- **Modern JSON Querying**: Use `column['key'].astext.cast(Type)` instead of `.op('->>')` for JSONB columns

## Critical Guidelines
- Use `joinedload()` for preloading relationships when building complex response objects
- Avoid N+1 query patterns - if you're querying in a loop, refactor to use eager loading
- Add `@cached_response` decorator to endpoints returning static game data (items, weapons, nanos)
- Convert multiple subqueries to single JOINs with OR conditions when possible
- Use composite database indexes for frequently joined columns

## File Structure
- `routes/` - API endpoint handlers (items, weapons, nanos, etc.)
- `schemas/` - Pydantic request/response models
- `services/` - Business logic and complex queries
- Database session management: `backend/app/core/database.py` (centralized)

## Documentation
- Features:
  - `.docs/features/tinkerfite-performance-optimization.doc.md`
  - `.docs/features/symbiant-pagination-chunked-loading.doc.md`
- Database: `DATABASE.md`

## Notes
Cache TTL configured in `backend/app/core/cache.py` - use 1 hour for static game data.
