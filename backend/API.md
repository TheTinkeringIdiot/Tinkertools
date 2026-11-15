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
Search items by name or description. The response has the shape of `GET /api/v1/items`.

**Query Parameters:**
- `q` (string, required): Search query, at least one character
- `page` (int): Page number (default: 1)
- `page_size` (int): Items per page (default: 50, max: 1000)
- `exact_match` (bool): `true` (default) finds `q` as a substring, whatever the case; `%` and `_` in `q` are wildcards. `false` is a stemmed full-text search in which bare words are ANDed and `"a phrase"`, `OR` and `-word` are understood
- `search_fields` (string): Comma-separated fields to search, of `name` and `description` (default: both). `effects` and `stats` are accepted and hold no text: named alone they search the name. Unknown names are ignored
- `weapons` (bool): Only items with attack/defense data (default: false)
- `min_ql`, `max_ql` (int, 1-999): Quality level range
- `item_class` (int): Filter by item class
- `slot`, `profession`, `breed`, `gender`, `faction`, `froob_friendly`, `nodrop`, `stat_bonuses`, `stat_filters`, `strain`: the advanced filters of `GET /api/v1/items`, described at `/docs`

Substring matches are ordered by name. Full-text matches are ordered by rank, best first, or by name when `weapons` is true. Ties end on the AOID.

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

### Changes between builds

What changed on an item, in a build, or between any two builds. The version segment of the URL names the newer side of every comparison; `{base}` is a build slug or family alias. Stats, skills, actions, events and effect types are numeric ids; `kind`, `parts` and `relevance` are words:

- `kind`: `added`, `removed`, `changed`
- `parts` (what differs): `text`, `stats`, `effects`, `actions`, `atkdef`, `misc`
- `relevance` (what the change matters for): `gameplay`, `economy`, `cosmetic`, `text`. It follows from `backend/database/change_relevance.toml`; an added or removed item is `gameplay`.

A build is named in responses as `{"slug", "display_name", "family", "client_build", "snapshot_date"}`.

Responses depend only on the builds named and change only with an import. They are cached by the server for an hour; a client or proxy may cache a response for a pair of explicit build slugs just as long (`Cache-Control: public, max-age=3600` is safe), but not one asked through a family alias (`ao`, `prk`) or without a version, which follows the newest build.

#### GET /api/v1/changes
The change list of the request's build: every item added, removed or changed relative to the build before it (for a branch's first build, relative to its parent build: PRK 0.7.1 against AO 17.10.5).

**Query Parameters:**
- `page` (int, default 1), `page_size` (int, default 50, max 200)
- `sort` (`name` | `aoid` | `ql`, default `name`): ties by AOID
- `kind`, `part`, `relevance` (repeatable): only changes of one of these kinds, touching one of these parts, relevant to one of these
- `is_nano` (bool), `item_class` (int), `min_ql`, `max_ql` (int)
- `profession` (int): only items and nanos whose Use requires this profession
- `slot` (int): only items worn in this slot (bit position of stat 298, as in `GET /items`)
- `search` (string): text the new or the old name contains
- `notes` (`collapse` | `expand`, default `collapse`), `note_id` (int): see below
- `transition`, `transition_old`, `transition_new`: only the items of one line of `GET /changes/transitions`. `transition` is the line's `path`; the other two are its `old` and `new` as JSON (`60`, `"added"`, `[124,1060,2]`, `null`) and may be left out to take every line of the path
- `include_diff` (bool, default false): give each changed item of the page its field-level diff. A very large diff is left out: the row has `"diff": null, "diff_omitted": true`, and `GET /items/{aoid}/compare/{base}` returns it

**Response:** a `PaginatedResponse` of change rows, plus `build`, `base`, `summary` and `notes`:
```json
{
  "items": [
    {
      "aoid": 88805, "kind": "changed",
      "name": "Boosted-Graft: Assault Rifle Expertise", "old_name": null,
      "ql": 12, "old_ql": null, "item_class": 2, "is_nano": false, "icon": 11647,
      "parts": ["text", "stats", "effects"],
      "relevance": ["gameplay", "cosmetic", "text"],
      "note_id": null,
      "diff": null,
      "diff_omitted": false
    }
  ],
  "total": 92, "page": 1, "page_size": 50, "pages": 2, "has_next": true, "has_prev": false,
  "build": {"slug": "ao-14-6-0", "display_name": "AO 14.6.0", "family": "ao", "client_build": "14.6.0", "snapshot_date": null},
  "base": {"slug": "ao-14-5-1", "display_name": "AO 14.5.1", "family": "ao", "client_build": "14.5.1", "snapshot_date": null},
  "summary": {
    "total": 8650,
    "by_kind": {"added": 968, "removed": 0, "changed": 7682},
    "by_part": {"text": 5211, "stats": 6220, "effects": 3070, "actions": 2525, "atkdef": 78, "misc": 3540},
    "by_relevance": {"gameplay": 7237, "economy": 1046, "cosmetic": 5844, "text": 5211},
    "noted": 869
  },
  "notes": [
    {"note_id": 4, "title": "Weapons given an explicit attack range",
     "body": "Stat 287 (AttackRange) was written out on weapons that had none.",
     "count": 869, "matching": 0}
  ]
}
```
- A row is listed by its newer revision (the older one for a removed item); `old_name` and `old_ql` are set only when they differ. `icon` is stat 79.
- `summary` counts every change of the build, whatever the filters. `base` is null for a build with nothing before it.
- `diff_omitted` is true only when the diff was asked for (`include_diff=true`) and is too much for a row of a page: the effects of the two revisions, with their criteria, number more than 1,000, or the diff is more than 64 KB of JSON. In the change log of all 147 builds that is 11 of 127,374 changed items (five vehicle nanos of 17.7.0 at 186 KB each, six shop inventories). The row is otherwise complete; ask for the diff with `GET /items/{aoid}/compare/{base}`, using the `slug` of the response's `base`. Rows without a diff to give (`include_diff=false`, added and removed items) have `diff_omitted: false`.
- **Build notes** are build-wide events that explain many changes at once (`backend/database/build_notes.toml`). A change carries a `note_id` only when the note explains all of it. By default such changes are collapsed: left out of `items` and `total`, and counted per note in `notes` (`count`: changes the note explains; `matching`: those that match the request's filters). `notes=expand` lists them with the rest; `note_id=N` lists only that note's.

#### GET /api/v1/compare/{base}
The net difference between build `base` and the request's build, computed from what each build holds, not by replaying the builds between them: an item that changed and changed back is not listed. Any two builds, in either order, across families (`/api/v1/prk-0-7-1/compare/ao-17-10-5`). Parameters (except `transition*`) and response are those of `GET /changes`, `diff_omitted` included; a comparison has no build notes, so `notes` is empty and every `note_id` null. The first request for a pair of builds classifies the whole comparison and keeps its `summary`; later pages and filters of the pair classify only their page, unless they filter on `part` or `relevance`. For the farthest pair (14.2.2 against live, 123,224 items) that is 0.5 to 0.9 s once, then under 300 ms per page.

#### GET /api/v1/changes/transitions
The field transitions that most changed items of the request's build share, most items first. They read as patch notes.

**Query Parameters:**
- `part` (repeatable): only transitions of these parts
- `relevance` (repeatable: `gameplay` | `economy` | `cosmetic` | `text`; default `gameplay`, `economy` and `text`): only transitions of fields that matter for one of these. The class is that of the field itself (the stat, the effect type, the part), whatever else the items changed: an icon or `static_instance` line is `cosmetic` even on items that changed in gameplay too. Unlike on `GET /changes`, leaving the parameter out does filter: name all four classes to list cosmetic lines as well.
- `notes` (`collapse` | `expand`, default `collapse`): with `collapse` the patch notes leave out what a build note already says. `items` and `occurrences` count only the changes no build note explains, and a transition is left out when the build's notes account for it: when fewer than `min_items` of those changes have it outside the event of a note. A note accounts for the transitions its rule names, in the items its event happened to (`backend/database/build_notes.toml`), so the implants of 14.8.0 that were renamed and rebalanced are listed with their rebalancing and not with the rename. With `expand` every transition is listed and counted over every change.
- `min_items` (int, default 2), `limit` (int, default 50, max 500)

**Response:**
```json
{
  "build": {"slug": "ao-14-6-0", "...": "..."},
  "base": {"slug": "ao-14-5-1", "...": "..."},
  "transitions": [
    {"part": "effects", "path": "effect:53089:spell_params.Chance", "old": 60, "new": 100,
     "relevance": "gameplay", "items": 760, "occurrences": 760,
     "stat": null, "bit": null, "spell_id": 53089, "action": null, "field": "spell_params.Chance"}
  ]
}
```
Only transitions shared by at least two items are kept. `relevance` is the class of the line's field. A listed line's `items` is the `total` of `GET /changes` narrowed to it (`transition`, `transition_old`, `transition_new`) with the same `notes` value. `stat`, `bit`, `spell_id`, `action` and `field` repeat the ids in `path`. Paths, with what `old` and `new` hold (null: absent, or particular to each item):

| part | path | old, new |
|---|---|---|
| text | `name`, `description` | the words only the old and only the new text have |
| stats | `stat:<id>` | the values |
| stats | `stat:<id>:bit:<value>` (flag stats) | 0 and 1 |
| atkdef | `attack:<id>`, `defense:<id>` | the values |
| actions | `action:<id>` | `"removed"` as old or `"added"` as new |
| actions | `action:<id>:criterion` | `[value1, value2, operator]` |
| effects | `event` | the event ids of a renumbering |
| effects | `event:<id>` | `"removed"` / `"added"` |
| effects | `effect:<spell_id>` | the subject (stat, skill, nano id; `"none"`) of a removed (old) or added (new) effect |
| effects | `effect:<spell_id>:<field>` | the values of `target`, `tick_count`, `tick_interval` or `spell_params.<name>` |
| effects | `effect:<spell_id>:criterion` | `[value1, value2, operator]` |
| misc | `static_instance`, `animation_mesh`, `shop` | null |

#### GET /api/v1/items/{aoid}/timeline
Every build in which the item was added, changed or removed, newest first, along the lineage of the request's version: every build of its family, and for a fork (PRK) the parent family's builds up to the fork. The answer is the same from any build of a family. An item the lineage never had gets `"entries": []`.

**Query Parameters:** `include_diff` (bool, default true)

**Response:**
```json
{
  "aoid": 88393,
  "family": "ao",
  "entries": [
    {
      "build": {"slug": "ao-14-6-0", "...": "..."},
      "base": {"slug": "ao-14-5-1", "...": "..."},
      "kind": "changed",
      "name": "Hacked Charged Nano Critter - 1H Blunt Weapon Incompetence", "ql": 13,
      "parts": ["stats", "effects", "actions", "misc"],
      "relevance": ["gameplay", "cosmetic"],
      "note": null,
      "diff": {"text": [], "stats": ["..."], "effects": ["..."], "actions": ["..."], "attack": [], "defense": [], "misc": ["..."]}
    }
  ]
}
```
`note` is `{"note_id", "title", "body"}` when a build note explains the entry. The "changed in" badge of list rows is fed by `POST /items/revisions/batch`, which counts the builds that changed an item's definition; the timeline has more: removals, items that return, relevance and diffs.

#### GET /api/v1/items/{aoid}/compare/{base}
One item in build `base` and in the request's build.

**Response:** `{"aoid", "build", "base", "kind", "old", "new", "parts", "relevance", "diff"}`. `kind` is `added`, `removed`, `changed` or `unchanged`; `old` and `new` are `{"name", "ql", "item_class", "is_nano", "icon"}` or null where the build lacks the item; `diff` is given when both have it, whatever its size. 404 when neither build has the item or `base` is unknown.

#### The field-level diff
`diff` has one list per part, empty when the part is the same: `text`, `stats`, `effects`, `actions`, `attack`, `defense`, `misc`. Every entry has a `relevance`, and the `relevance` of the change is the union of its entries' values.

- `text`, `misc`: `{"field", "old", "new", "relevance"}`; fields `name`, `description`, `static_instance`, `animation_mesh`, `shop`.
- `stats`, `attack`, `defense`: `{"stat", "change", "old", "new", "bits_set", "bits_cleared", "relevance"}`. For the flag stats (0, 30, 182, 298, 355, 389) `bits_set` and `bits_cleared` list the flag values (1, 2, 4, ...) that were set and cleared; they are null for other stats.
- `actions`: `{"action", "change", "criteria", "relevance"}`. `criteria` is the whole requirement list as a sequence diff: `{"op": "same" | "added" | "removed" | "changed", "old", "new"}` with criteria as `{"value1", "value2", "operator"}`.
- `effects`: one entry per event that differs: `{"event", "change", "old_event", "relevance", "added", "removed", "changed"}`.
  - `change` is `added`, `removed`, `changed` or `renumbered` (the same effects under another event id, `old_event`).
  - `added` and `removed` hold effects shaped as the `spells` of an item's `spell_data`, each with a `relevance`.
  - `changed` pairs an old with a new effect: `{"old", "new", "fields", "criteria", "relevance"}`, `fields` listing what differs as `{"field", "old", "new"}` (`target`, `tick_count`, `tick_interval`, `spell_params.<name>`) and `criteria` the sequence diff of their criteria, or null.
  - Two effects are only paired when they have the same effect type and act on the same subject (the `Stat`, `Skill`, `NanoID`, `NanoStrain`, `Item` and `PerkID` parameters); a modifier replaced by a modifier of another stat is one removal and one addition.
  - An effect that only moved to another event, and an event that was only renumbered, are `cosmetic` when nothing else about the item's effects differs, and have a null `relevance` when something does.

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