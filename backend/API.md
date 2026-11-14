# TinkerTools API Documentation

## Overview

The TinkerTools API provides access to Anarchy Online game data including items, nano programs, weapons, implants, perks, symbiants, and mobs (including pocket bosses). The API follows RESTful conventions and returns JSON responses.

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

`id` is deprecated and equals `aoid`. The item's content (stats, effects, actions and their criteria) carries no ids. A source does: `sources[].source.id` is the id of the source, `source.source_type_id` and `source.source_type.id` that of its type, and `source.source_id` the AOID of the item or the id of the mob it stands for:

```json
{
  "source": {
    "id": 4370,
    "source_type_id": 1,
    "source_id": 29358,
    "name": "Nano Crystal (Pistol Mastery)",
    "extra_data": {"type": "nanocrystal"},
    "source_type": {
      "id": 1,
      "name": "item",
      "description": "Items that create/upload other items (e.g., nanocrystals)"
    }
  },
  "drop_rate": null,
  "min_ql": 24,
  "max_ql": 24,
  "conditions": null,
  "extra_data": {
    "nano_name": "Pistol Mastery",
    "crystal_aoid": 29358,
    "crystal_name": "Nano Crystal (Pistol Mastery)"
  }
}
```

**Field Descriptions:**
- `stats`: Basic item statistics
- `spell_data`: Spell effects with nested spells and their criteria  
- `attack_stats`: Attack-related statistics for weapons
- `defense_stats`: Defense-related statistics for weapons
- `actions`: Item actions with criteria (equipping, using, etc.), criteria in evaluation order
- `sources`: Where the item comes from (crystals for nanos, mobs for symbiants)

### Interpolation

An item that exists at several quality levels is stored at a few of them; these routes compute it at a QL in between.

#### GET /api/v1/items/{aoid}/interpolate
Interpolate an item to a quality level.

**Query Parameters:**
- `target_ql` (int, required): Target quality level, 1 to 500

**Response:**
```json
{
  "success": true,
  "item": {
    "id": 111751,
    "aoid": 111751,
    "name": "Right-Hand Implant: Martial Arts, Shiny",
    "ql": 150,
    "description": "...",
    "item_class": 3,
    "is_nano": false,
    "interpolating": true,
    "low_ql": 1,
    "high_ql": 200,
    "target_ql": 150,
    "ql_delta": 149,
    "ql_delta_full": 199,
    "stats": [{"stat": 0, "value": 515}],
    "spell_data": [...],
    "actions": [...]
  },
  "error": null,
  "interpolation_range": {"min_ql": 1, "max_ql": 200}
}
```

`item` has the `stats`, `spell_data` and `actions` of an item detail, computed for `target_ql`, and no attack, defense or source lists. Its `aoid` is that of the stored variant the values are computed from, and `id` equals it. `interpolating` is false when the item has a single variant, which is then returned as it is with `ql` set to `target_ql`.

An AOID the build does not have answers 200 with `"success": false` and the reason in `error`.

#### POST /api/v1/items/batch/interpolate
Interpolate up to 100 items in one request.

**Request Body:**
```json
{"items": [{"aoid": 111752, "target_ql": 150}, {"aoid": 1, "target_ql": 5}]}
```

`target_ql` is 1 to 500 and defaults to 1.

**Response:**
```json
{
  "success": false,
  "results": [
    {"aoid": 111752, "target_ql": 150, "success": true, "item": {...}, "error": null},
    {"aoid": 1, "target_ql": 5, "success": false, "item": null, "error": "Item with AOID 1 not found"}
  ],
  "errors": ["Item with AOID 1 not found"]
}
```

`results` has one entry per requested item, in request order; `item` is as in the single route. The top-level `success` is true only when every item succeeded.

#### GET /api/v1/items/{aoid}/interpolation-info
The quality level ranges an item can be interpolated over.

**Response:**
```json
{
  "aoid": 111752,
  "interpolatable": true,
  "ranges": [
    {"min_ql": 1, "max_ql": 200, "interpolatable": true, "base_aoid": 111751},
    {"min_ql": 200, "max_ql": 200, "interpolatable": false, "base_aoid": 111752}
  ],
  "min_ql": 1,
  "max_ql": 200,
  "ql_range": 200
}
```

An AOID the build does not have is a 404.

### Nanos

#### GET /api/v1/nanos
Get a paginated list of nano programs.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 50, max: 200)
- `school` (string, repeatable): `Combat`, `Medical`, `Protection`, `Psi` or `Space`, or its NanoSchool value 1-5
- `profession` (string, repeatable): Profession name or id; matches nanos castable by any of them, including those any profession can cast
- `strain` (string, repeatable): NanoStrain id or name; matches any of them
- `level_min`, `level_max` (int): Bounds on the lowest level that can cast the nano
- `ql_min`, `ql_max` (int): Bounds on the quality level
- `sort_by` (string): `name` (default), `ql` or `level`
- `sort_desc` (bool): Sort descending (default: false)

A value of `school`, `profession` or `strain` that names nothing is ignored; a filter with only such values matches nothing. Ties in the sort are ordered by AOID.

**Response:** the paginated envelope of `GET /api/v1/items`, with items like:
```json
{
  "id": 26465,
  "aoid": 26465,
  "name": "Minor Healing",
  "ql": 1,
  "description": "Heals the target of 5 to 10 points of damage.",
  "school": "Medical",
  "strain_id": null,
  "strain": null,
  "professions": [],
  "level": 1,
  "actions": [
    {
      "action": 3,
      "criteria": [
        {"value1": 128, "value2": 16, "operator": 2},
        {"value1": 127, "value2": 18, "operator": 2},
        {"value1": 0, "value2": 0, "operator": 4}
      ]
    }
  ],
  "casting_time": 151,
  "recharge_time": 100,
  "memory_usage": null,
  "nano_point_cost": null,
  "effects": [],
  "duration": null,
  "targeting": null,
  "source_location": null,
  "acquisition_method": null
}
```

- `id` is deprecated and equals `aoid`
- `professions`: Professions that can cast the nano; empty when its Use action does not restrict the profession
- `level`: Lowest character level that can cast it; null when it has no Use action
- `strain_id`, `strain`: The NanoStrain (stat 75) the build serves for the nano and its name; null when it has none
- `actions`: The Use action's criteria are the requirements to cast the nano
- `casting_time`, `recharge_time`: In centiseconds (stats 294 and 210); null when the nano does not have the stat

#### GET /api/v1/nanos/search
Search nano programs by name or description (substring, any case).

**Query Parameters:**
- `q` (string, required): Search text
- Every parameter of `GET /api/v1/nanos`

The response is that of `GET /api/v1/nanos`.

#### GET /api/v1/nanos/strains
The strains of the nanos matching a set of filters, with the number of nanos of each.

**Query Parameters:** `q`, `school`, `profession`, `level_min`, `level_max`, `ql_min`, `ql_max`, as in the list and the search. There is no `strain` filter: the list offers every strain the other filters leave.

**Response** (for `?school=Space&level_max=20`):
```json
{
  "strains": [
    {"id": 1015, "name": "Attack Pets", "count": 186},
    {"id": 293, "name": "Beacon Warp", "count": 2}
  ]
}
```

Sorted by name, then id; strains without a name come last. Nanos without a strain are not counted.

#### GET /api/v1/nanos/profession/{profession_id}
The nano programs whose Use action names a profession, as full items. `profession_id` 0 lists them for every profession. Nanos without a real strain and test items are left out.

**Query Parameters:**
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 1000, max: 1000)
- `sort` (string): `ql` (default) or `name`
- `sort_order` (string): `desc` (default) or `asc`

**Response:** the paginated envelope; each item is an item detail (see `GET /api/v1/items/{aoid}`) with empty `attack_stats`, `defense_stats` and `sources`, plus the `school`, `professions`, `level`, `strain_id` and `strain` of the nano list.

#### GET /api/v1/nanos/offensive/{profession_id}
The nanos of `GET /api/v1/nanos/profession/{profession_id}` that lower a hostile target's health. Same parameters; each item is an item detail with empty `attack_stats`, `defense_stats` and `sources`.

### Weapons

#### POST /api/v1/weapons/analyze
The weapons a character can use.

**Request Body:**
```json
{
  "level": 220,
  "breed_id": 1,
  "profession_id": 11,
  "side": 2,
  "expansion_bitflag": 127,
  "top_weapon_skills": [{"skill_id": 116, "value": 2500}]
}
```

- `level` (int, required): Character level, 1 to 220
- `breed_id` (int, required): 1 to 4
- `profession_id` (int, required): 0 (any) to 15
- `side` (int, required): 0 neutral, 1 clan, 2 omni
- `expansion_bitflag` (int): Expansions the account has, 0 to 511 (default: 127)
- `top_weapon_skills` (required): 1 to 3 weapon skills, each a `skill_id` and a `value` of 0 or more

**Response:** a JSON array, not paginated, of item details (see `GET /api/v1/items/{aoid}`): every QL variant of each matching weapon, ordered by AOID.

### Implants

#### POST /api/v1/implants/lookup
Find the implant of a slot with an exact set of clusters, at a quality level.

**Request Body:**
```json
{"slot": 1024, "ql": 200, "clusters": {"Shiny": 100, "Bright": 102, "Faded": 150}}
```

- `slot` (int, required): Implant slot bitflag, 1 to 16383
- `ql` (int, required): Quality level, 1 to 300
- `clusters` (required): Stat ids by cluster position; the positions are `Shiny`, `Bright` and `Faded`, and a position may be left out

The implant has exactly the clusters given and no other.

**Response:**
```json
{
  "success": true,
  "item": {"aoid": 111752, "name": "Right-Hand Implant: Martial Arts, Shiny", "ql": 200, "...": "..."},
  "message": "Implant found successfully (interpolated from QL 1 to QL 200)",
  "interpolated": true,
  "base_ql": 1
}
```

`item` is an item detail, interpolated to `ql` when the stored implant is of another QL. When no implant matches, the answer is 200 with `"success": false`, a null `item` and the reason in `message`.

### Perks

#### POST /api/v1/perks/batch/lookup
Look up perks by AOID, up to 100 per request.

**Request Body:**
```json
{"aoids": [210830, 1]}
```

**Response:**
```json
{
  "success": false,
  "results": [
    {
      "aoid": 210830,
      "success": true,
      "perk": {
        "id": 210830,
        "aoid": 210830,
        "name": "Accumulator",
        "ql": 1,
        "item_class": 2,
        "description": "...",
        "is_nano": false,
        "stats": [{"stat": 0, "value": 9, "stat_name": null}],
        "spell_data": [...],
        "attack_stats": [],
        "defense_stats": [],
        "actions": [
          {"action": 6, "criteria": [{"value1": 60, "value2": 7, "operator": 0, "order_index": 0}]}
        ],
        "perk_name": "Accumulator",
        "perk_counter": 1,
        "perk_type": "SL",
        "perk_series": "Accumulator",
        "perk_professions": ["Trader"],
        "perk_breeds": [],
        "perk_level_required": 10,
        "perk_ai_level_required": null,
        "counter": 1,
        "type": "SL",
        "level": 10,
        "ai_title": null,
        "formatted_name": "Accumulator 1"
      },
      "error": null
    },
    {"aoid": 1, "success": false, "perk": null, "error": "Perk with AOID 1 not found"}
  ],
  "errors": ["Perk 1 not found"]
}
```

`results` has one entry per requested AOID, in request order. A perk is its item with the perk's own fields; unlike an item detail its stats carry a null `stat_name`, its action criteria an `order_index`, its effects no `criteria`, and it has no `sources`. The top-level `success` is true only when every AOID is a perk. A build that does not serve perks finds none.

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