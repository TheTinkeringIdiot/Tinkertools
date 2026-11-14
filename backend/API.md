# TinkerTools API Documentation

## Overview

The TinkerTools API provides access to Anarchy Online game data including items, symbiants, and mobs (including pocket bosses). The API follows RESTful conventions and returns JSON responses.

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
Check that the API process is up.

**Response:**
```json
{
  "status": "ok"
}
```

### Game versions

Every route under `/api/v1` also exists under `/api/v1/<version>`, where `<version>` is a build slug from `GET /api/v1/versions` (`ao-18-8-62-ep1`) or a family alias (`ao`, `prk`). Without the segment the default build is served. An unknown slug is a 404.

### Items

#### GET /api/v1/items
Get a paginated list of items with optional filters.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 50, max: 1000)
- `item_class` (int): Filter by item class
- `min_ql` (int): Minimum quality level
- `max_ql` (int): Maximum quality level
- `is_nano` (bool): Filter nano programs
- `slot`, `profession`, `breed`, `gender`, `faction`, `froob_friendly`, `nodrop`, `stat_bonuses`, `stat_filters`, `strain`: advanced filters, described at `/docs`

Items are ordered by AOID.

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

#### GET /api/v1/items/{aoid}
Get detailed information about a specific item by its Anarchy Online ID (AOID).

**Path Parameters:**
- `aoid` (int): Anarchy Online item ID

**Response:**
```json
{
  "aoid": 12345,
  "name": "Enhanced Leather Vest",
  "ql": 25,
  "item_class": 4,
  "description": "A sturdy leather vest...",
  "is_nano": false,
  "id": 12345,
  "stats": [
    {"stat": 16, "value": 15}
  ],
  "spell_data": [
    {
      "event": 14,
      "spells": [
        {
          "target": 2,
          "tick_count": 1,
          "tick_interval": 0,
          "spell_id": 53045,
          "spell_format": "Modify {Stat} {Amount}",
          "spell_params": {"Stat": 96, "Amount": 10, "SpellDescription": "Modify 96 10"},
          "criteria": []
        }
      ]
    }
  ],
  "attack_stats": [],
  "defense_stats": [],
  "actions": [
    {
      "action": 6,
      "criteria": [
        {"value1": 16, "value2": 100, "operator": 2}
      ]
    }
  ],
  "sources": []
}
```

`id` is deprecated and equals `aoid`. Nested objects carry no ids.

**Field Descriptions:**
- `stats`: Basic item statistics
- `spell_data`: Spell effects with nested spells and their criteria  
- `attack_stats`: Attack-related statistics for weapons
- `defense_stats`: Defense-related statistics for weapons
- `actions`: Item actions with criteria (equipping, using, etc.), criteria in evaluation order
- `sources`: Where the item comes from (crystals for nanos, mobs for symbiants)

### Symbiants

#### GET /api/v1/symbiants
Get a paginated list of symbiants.

**Query Parameters:**
- `page` (int): Page number
- `page_size` (int): Items per page (default 50, max 200)

Ordered by family, QL, name and AOID. Filtering is done by the client.

#### GET /api/v1/symbiants/{aoid}
Get detailed information about a specific symbiant, addressed by its AOID.

#### GET /api/v1/symbiants/{aoid}/dropped-by
Get list of pocket bosses that drop a specific symbiant, addressed by its AOID.

### Mobs

#### GET /api/v1/mobs
Get a paginated list of mobs, including pocket bosses.

**Query Parameters:**
- `page` (int): Page number (default 1)
- `page_size` (int): Items per page (default 50, max 1000)
- `is_pocket_boss` (bool): Filter pocket bosses
- `min_level` (int): Minimum mob level
- `max_level` (int): Maximum mob level
- `playfield` (string): Filter by playfield (partial match)

#### GET /api/v1/mobs/{mob_id}
Get detailed information about a specific mob.

#### GET /api/v1/mobs/{mob_id}/drops
Get list of symbiants dropped by a specific mob.

**Query Parameters:**
- `family` (string): Filter by symbiant family

### Legacy Item IDs

#### POST /api/v1/legacy-item-ids/resolve
Resolve internal item row ids (as issued by a game version) to AOIDs. Up to 1000 ids per request.

**Request Body:**
- `item_ids` (int[]): Internal item row ids

**Response:** `{"aoids": {"<item_id>": <aoid>}}`. Ids the game version does not have are omitted.

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

### Version 1.2.0  
- **API Cleanup**: Removed redundant alias fields to simplify API structure
- **Fields Removed**:
  - `attack_data` (use `attack_stats` instead)
  - `defense_data` (use `defense_stats` instead)
  - `action_data` (use `actions` instead)
  - `requirements` (derive from action criteria on frontend if needed)
- **Simplified Response**: Cleaner API responses with single source of truth for each data type
- **Reduced Payload Size**: Smaller JSON responses due to eliminated redundancy

### Version 1.1.0
- **Enhanced Item Detail API**: Completely populated all missing fields in item detail endpoint
- **New Fields Added**:
  - `spell_data`: Complete spell effects with nested spells and criteria
  - `attack_stats`/`defense_stats`: Attack and defense statistics
  - `actions`: Item actions with full criteria information
- **Data Structure Improvements**: Fixed spell_params to support both list and dictionary formats
- **Backend Schema Updates**: Created SpellDataResponse and ActionResponse schemas
- **Frontend Integration**: Updated TypeScript interfaces to match API responses

### Version 1.0.0
- Initial release with basic CRUD endpoints
- Support for items, symbiants, and pocket bosses
- Pagination and search functionality
- Error handling and validation