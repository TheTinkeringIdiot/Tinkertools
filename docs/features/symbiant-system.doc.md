# Symbiant System Architecture

## Overview
The symbiant system provides item lookup and drop source tracking for symbiant items in Anarchy Online. Symbiants are derived from the items of each build at import; the mobs that drop them are curated data, linked to items through the source system.

## User Perspective
Users can query symbiants by family type (Artillery, Control, Extermination, Infantry, Support), equipment slot, and quality level. For each symbiant, users can see which pocket bosses drop it, including boss location and level information. The system supports profession-based filtering where the frontend maps professions to their allowed symbiant families.

## Data Flow

### Querying Symbiants
1. Frontend requests symbiants via `/api/v1/{version}/symbiants` with optional filters (family, slot_id, QL range)
2. Backend reads `symbiant_items` for the revisions present in the requested build
3. The table holds the family read from the item's name at import
4. Results returned as paginated `SymbiantResponse` objects

### Finding Drop Sources
1. Frontend requests drop sources for a symbiant via `/symbiants/{aoid}/dropped-by`
2. Backend follows `item_source` → `source` (type `mob`) → `mob`, for mobs that are not retired
3. Returns list of `MobDropInfo` objects with boss metadata
4. A build without the `symbiants` feature has no mobs and no drop sources; its symbiant items are still listed

### Profession-Based Filtering
1. Frontend maintains static profession → families mapping
2. User selects profession (e.g., "Adventurer")
3. Frontend sends `families=['Artillery', 'Infantry', 'Support']` parameter
4. Backend filters `symbiant_items` on the family

## Implementation

### Key Files

#### Backend
- `backend/app/store/curated.py` - symbiant, mob and drop queries on the store
- `backend/app/api/routes/symbiants.py` - Symbiant endpoints with family/slot/QL filtering
- `backend/app/api/routes/mobs.py` - Mob endpoints for drop queries
- `backend/app/api/schemas/symbiant.py` - SymbiantResponse, SymbiantWithDropsResponse, MobDropInfo
- `backend/app/api/schemas/mob.py` - MobResponse, MobDetail, SymbiantDropInfo

#### Import
- `backend/app/core/cas_store.py` - derives `symbiant_items` rows for new item revisions
- `backend/app/core/cas_curated.py` - `read_symbiants` and `sync_curated`: mobs, their sources and drops from the CSV
- `backend/database/symbiants.csv` - Source data (no header row)
- `backend/database/mob_ids.csv` - The id of every boss (`mob_id,name`); lines are added, never changed or removed

#### Database
- `backend/database/cas/002_curated_and_derived.sql` - `symbiant_items`, `mob`, `source_type`, `source`, `item_source`, with the rules for serving them

#### Frontend Types
- `frontend/src/types/api.ts` - SymbiantItem, Mob, MobWithDrops interfaces
- `frontend/src/services/api-client.ts` - API client methods for symbiant/mob queries

### Storage

- **`symbiant_items`** (derived): one row per item revision whose name matches `Symbiant.*Unit (Aban|Alpha|Beta)$`, with `aoid`, `name`, `ql`, `slot_id` (the highest value of stat 298) and `family`. Rows are served by presence of the revision in the requested build.
- **`mob`** (curated): one row per boss of `symbiants.csv`, identified by its name. A mob's id is part of the API and of stored farm progress, so it never changes: the ids are written down in `mob_ids.csv` and the importer takes them from there, and a mob that leaves `symbiants.csv` is kept as a retired row and is not served.
- **`source` / `item_source`** (curated): a mob is a source of type `mob`; `item_source` links an item's AOID to its sources. A link applies in a build when the item is present in it and the build has the `symbiants` feature (`backend/database/builds.toml`).

The same mob can appear on several lines of the CSV (one per dropped symbiant); it is stored once, and each line becomes a drop.

## Configuration
The importer reads `backend/database/symbiants.csv` by default (`--symbiants-file` overrides it) and applies it on every run: `python import_cli.py import-cas --extracts-dir <extracts>`. See `backend/IMPORT_README.md`.

## API Endpoints

Documented in `backend/API.md`:

- `GET /symbiants` - list with `family`, `families[]`, `slot_id`, `min_ql`, `max_ql`, `page`, `page_size`
- `GET /symbiants/{aoid}` - one symbiant
- `GET /symbiants/{aoid}/dropped-by` - the pocket bosses that drop it
- `GET /mobs`, `GET /mobs/{id}`, `GET /mobs/{id}/drops` - mobs and what they drop

## Usage Example

### Frontend Query (TypeScript)
```typescript
// Get symbiants for Adventurer profession
const families = ['Artillery', 'Infantry', 'Support']
const symbiants = await apiClient.get('/symbiants', {
  params: { families }
})

// Get drop sources for a symbiant
const bosses = await apiClient.get(`/symbiants/${aoid}/dropped-by`)
```

## Testing
- `backend/app/tests/test_curated_endpoints.py`, `test_mob_endpoints.py`, `test_aoid_identity.py` - routes on controlled and real data
- `backend/app/tests/test_cas_store.py` - derivation of symbiant rows and the curated sync (stable mob ids, retired mobs)
