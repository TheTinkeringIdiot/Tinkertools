# TinkerTools API Documentation

## Overview

The TinkerTools API provides access to Anarchy Online game data including items, spells, symbiants, and pocket bosses. The API follows RESTful conventions and returns JSON responses.

## Base URL

- Development: `http://localhost:8000`
- API Version: `/api/v1`

## Authentication

Currently, the API does not require authentication as it serves read-only game reference data.

## OpenAPI Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints

### Health Check

#### GET /health
Check the health status of the API and database connection.

**Response:**
```json
{
  "status": "ok",
  "database": "healthy",
  "table_count": 21
}
```

### Items

#### GET /api/v1/items
Get a paginated list of items with optional filters.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 50, max: 200)
- `item_class` (string): Filter by item class
- `min_ql` (int): Minimum quality level
- `max_ql` (int): Maximum quality level
- `is_nano` (bool): Filter nano programs

**Response:**
```json
{
  "items": [...],
  "total": 1000,
  "page": 1,
  "page_size": 50,
  "pages": 20,
  "has_next": true,
  "has_prev": false
}
```

#### GET /api/v1/items/search
Search items by name or description.

**Query Parameters:**
- `q` (string, required): Search query
- `page` (int): Page number
- `page_size` (int): Items per page

#### GET /api/v1/items/{item_id}
Get detailed information about a specific item.

**Response:**
```json
{
  "id": 1,
  "aoid": 12345,
  "name": "Item Name",
  "ql": 200,
  "item_class": "Weapon",
  "slot": "Right Hand",
  "stats": [...],
  "spells": [...],
  "attack_stats": [...],
  "defense_stats": [...]
}
```

#### GET /api/v1/items/with-stats
Get items that have specific stat requirements.

**Query Parameters:**
- `stat` (int, required): Stat ID to filter by
- `min_value` (int): Minimum stat value
- `max_value` (int): Maximum stat value
- `limit` (int): Maximum results (default: 100)

### Spells

#### GET /api/v1/spells
Get a paginated list of spells.

**Query Parameters:**
- `page` (int): Page number
- `page_size` (int): Items per page
- `target` (int): Filter by target type

#### GET /api/v1/spells/{spell_id}
Get detailed information about a specific spell including criteria.

#### GET /api/v1/spells/with-criteria
Get spells that match specific criteria.

**Query Parameters:**
- `value1` (int): Criterion value1
- `value2` (int): Criterion value2
- `operator` (int): Criterion operator
- `limit` (int): Maximum results

### Symbiants

#### GET /api/v1/symbiants
Get a paginated list of symbiants.

**Query Parameters:**
- `page` (int): Page number
- `page_size` (int): Items per page
- `family` (string): Filter by symbiant family
- `slot` (string): Filter by equipment slot
- `min_ql` (int): Minimum quality level
- `max_ql` (int): Maximum quality level

#### GET /api/v1/symbiants/{symbiant_id}
Get detailed information about a specific symbiant including drop sources.

#### GET /api/v1/symbiants/{symbiant_id}/dropped-by
Get list of pocket bosses that drop a specific symbiant.

### Pocket Bosses

#### GET /api/v1/pocket-bosses
Get a paginated list of pocket bosses.

**Query Parameters:**
- `page` (int): Page number
- `page_size` (int): Items per page
- `min_level` (int): Minimum boss level
- `max_level` (int): Maximum boss level
- `playfield` (string): Filter by playfield

#### GET /api/v1/pocket-bosses/{boss_id}
Get detailed information about a specific pocket boss including drops.

#### GET /api/v1/pocket-bosses/{boss_id}/drops
Get list of symbiants dropped by a specific pocket boss.

### Stat Values

#### GET /api/v1/stat-values
Get list of stat values.

**Query Parameters:**
- `skip` (int): Number of items to skip
- `limit` (int): Maximum results

#### GET /api/v1/stat-values/{stat_value_id}
Get a specific stat value by ID.

## Error Responses

The API uses standard HTTP status codes and returns error responses in the following format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Status Codes

- `200 OK`: Request successful
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

## Performance

The API is optimized to meet the following performance requirements:
- Complex stat-based queries: < 500ms
- Simple lookups: < 50ms
- Full-text search: < 200ms

## Rate Limiting

Currently, no rate limiting is implemented as the API serves cached game reference data.

## Changelog

### Version 1.0.0
- Initial release with basic CRUD endpoints
- Support for items, spells, symbiants, pocket bosses, and stat values
- Pagination and search functionality
- Error handling and validation