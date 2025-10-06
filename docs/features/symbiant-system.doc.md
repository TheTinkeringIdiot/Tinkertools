# Symbiant System Architecture

## Overview
The symbiant system provides item lookup and drop source tracking for symbiant items in Anarchy Online. It uses a materialized view for efficient queries and integrates with the polymorphic sources system to track which pocket boss mobs drop each symbiant.

## User Perspective
Users can query symbiants by family type (Artillery, Control, Extermination, Infantry, Support), equipment slot, and quality level. For each symbiant, users can see which pocket bosses drop it, including boss location and level information. The system supports profession-based filtering where the frontend maps professions to their allowed symbiant families.

## Data Flow

### Querying Symbiants
1. Frontend requests symbiants via `/api/symbiants` with optional filters (family, slot_id, QL range)
2. Backend queries `symbiant_items` materialized view directly
3. View provides pre-computed family classification based on item name regex patterns
4. Results returned as paginated `SymbiantResponse` objects

### Finding Drop Sources
1. Frontend requests drop sources for a symbiant via `/api/symbiants/{id}/dropped-by`
2. Backend traverses: SymbiantItem → ItemSource → Source → Mob
3. Filters for `is_pocket_boss = TRUE` and `source_type = 'mob'`
4. Returns list of `MobDropInfo` objects with boss metadata

### Profession-Based Filtering
1. Frontend maintains static profession → families mapping
2. User selects profession (e.g., "Adventurer")
3. Frontend sends `families=['Artillery', 'Infantry', 'Support']` parameter
4. Backend filters symbiant_items WHERE family IN (families)

## Implementation

### Key Files

#### Backend Models
- `backend/app/models/symbiant_item.py` - Read-only model for symbiant_items materialized view
- `backend/app/models/mob.py` - Mob model supporting pocket bosses and future regular mobs
- `backend/app/models/source.py` - Polymorphic source system (shared with other item sources)

#### Backend Routes
- `backend/app/api/routes/symbiants.py` - Symbiant endpoints with family/slot/QL filtering
- `backend/app/api/routes/mobs.py` - Mob endpoints for drop queries (replaces pocket_bosses.py)

#### Backend Schemas
- `backend/app/api/schemas/symbiant.py` - SymbiantResponse, SymbiantWithDropsResponse, MobDropInfo
- `backend/app/api/schemas/mob.py` - MobResponse, MobDetail, SymbiantDropInfo

#### Backend Import
- `backend/app/core/importer.py` - `import_mobs_and_sources()` method for CSV parsing
- `backend/import_cli.py` - CLI integration for symbiant data import

#### Database
- `database/migrations/005_refactor_symbiant_system.sql` - Migration creating mobs table and symbiant_items view
- `database/symbiants.csv` - Source data (no header row, semicolon-delimited)

#### Frontend Types
- `frontend/src/types/api.ts` - SymbiantItem, Mob, MobWithDrops interfaces
- `frontend/src/services/api-client.ts` - API client methods for symbiant/mob queries

### Database Architecture

#### Materialized View: symbiant_items
Pre-computed view extracting symbiants from items table:
```sql
CREATE MATERIALIZED VIEW symbiant_items AS
SELECT
    id, aoid, name, ql,
    (SELECT value FROM item_stats WHERE stat=54) as slot_id,
    CASE
        WHEN name ~ ',\s*Artillery\s+Unit\s+Aban$' THEN 'Artillery'
        WHEN name ~ ',\s*Control\s+Unit\s+Aban$' THEN 'Control'
        WHEN name ~ ',\s*Extermination\s+Unit\s+Aban$' THEN 'Extermination'
        WHEN name ~ ',\s*Infantry\s+Unit\s+Aban$' THEN 'Infantry'
        WHEN name ~ ',\s*Support\s+Unit\s+Aban$' THEN 'Support'
    END as family
FROM items
WHERE name ~ 'Symbiant.*Unit\s+Aban$';
```

**Benefits**:
- No redundant data storage (symbiants already exist in items table)
- Family computed once via regex instead of per-query
- Indexed on family, slot_id, aoid for fast filtering
- Contains 1,109 symbiant items across 5 families

#### Table: mobs
Replaces old pocket_bosses table and supports future expansion:
```sql
CREATE TABLE mobs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    level INTEGER,
    playfield VARCHAR(100),
    location VARCHAR(255),
    mob_names TEXT[],          -- Array of mob names in pocket
    is_pocket_boss BOOLEAN DEFAULT TRUE,
    metadata JSONB,            -- For future extensibility
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Design Decisions**:
- `is_pocket_boss` flag enables future regular mob drops
- `mob_names` array stores comma-separated mobs from CSV
- `metadata` JSONB field for future expansion (respawn times, difficulty, etc.)
- Indexed on name, playfield, is_pocket_boss for query performance

#### Polymorphic Source System
Links mobs to items via source_types:
```
mobs (id, name, level, ...)
  ↓
sources (source_type_id='mob', source_id=mob.id)
  ↓
item_sources (item_id, source_id, drop_rate, min_ql, max_ql)
  ↓
items / symbiant_items
```

**Query Pattern**:
```sql
-- Get symbiants from a specific boss
SELECT si.*
FROM symbiant_items si
JOIN item_sources isp ON si.id = isp.item_id
JOIN sources s ON isp.source_id = s.id
JOIN mobs m ON s.source_id = m.id
WHERE m.name = 'Hollow Island'
  AND s.source_type_id = (SELECT id FROM source_types WHERE name = 'mob')
  AND m.is_pocket_boss = TRUE;
```

### Key Technical Decisions

#### Materialized View vs Table
**Decision**: Use materialized view instead of dedicated symbiants table

**Rationale**:
- Symbiants already exist in items table (no new data)
- Family classification is deterministic (regex on name)
- View is 99.2% smaller than storing redundant data
- Refresh only needed when items are reimported (rare)

**Tradeoff**: Must manually refresh view after item imports via `REFRESH MATERIALIZED VIEW symbiant_items`

#### Mobs Table Replaces Pocket Bosses
**Decision**: Rename pocket_bosses to mobs with is_pocket_boss flag

**Rationale**:
- Enables future expansion for regular mob drops
- More accurate terminology (bosses are a type of mob)
- Aligns with source_type rename from 'boss' to 'mob'
- Single table reduces JOIN complexity

**Migration Path**: Drop pocket_bosses, pocket_boss_symbiant_drops, symbiants tables (all broken/redundant)

#### CSV Parsing Bug Fix
**Problem**: Original importer used `csv.DictReader` on a CSV with no header row
```python
# BROKEN - symbiants.csv has no header!
reader = csv.DictReader(f)
for row in reader:
    aoid = row.get('aoid')  # KeyError: 'aoid' doesn't exist
```

**Solution**: Use `csv.reader` with manual column indexing
```python
reader = csv.reader(f, delimiter=';')
for row in reader:
    # Columns: QL;Slot;Family;BossName;Playfield;Location;Mobs;Level;...;ItemLink
    ql, slot, family, boss_name, playfield, location, mobs, level, *_, item_link = row
    aoid = _extract_aoid_from_link(item_link)
```

#### Deduplication Strategy
**Problem**: CSV has 1,109 rows (one per symbiant drop) but only ~50 unique bosses

**Solution**: Two-phase import process
1. Parse CSV into `mobs_data` dict with boss_key = (name, playfield) for deduplication
2. Create Mob records for unique bosses only
3. Create Source record per mob
4. Create ItemSource links for all 1,109 symbiant drops

**Result**:
- ~50 mob records (unique bosses)
- ~50 source records (one per mob)
- 1,109 item_source records (all drop relationships)

#### Family-Based Filtering
**Decision**: Frontend handles profession → families mapping

**Rationale**:
- Profession compatibility is game logic, not database concern
- Mapping is static and rarely changes
- Reduces API complexity (no profession parameter needed)
- Frontend can cache and reuse mappings

**API Design**:
```typescript
// Single family filter
GET /api/symbiants?family=Artillery

// Multiple families (for professions)
GET /api/symbiants?families=Artillery&families=Infantry&families=Support
```

### Data Transformation Flow

#### Import Process (CSV → Database)
1. **Parse CSV**: Read semicolon-delimited rows, extract AOID from item link
2. **Deduplicate Bosses**: Build unique set of (name, playfield) tuples
3. **Create Mobs**: Insert unique mob records, capture IDs
4. **Create Sources**: Link each mob to source_type='mob', capture source IDs
5. **Create ItemSources**: Link symbiants (by AOID) to sources, handling duplicates
6. **Refresh View**: Run `REFRESH MATERIALIZED VIEW symbiant_items`

#### Query Process (API → Frontend)
1. **List Symbiants**: Query symbiant_items view with filters
2. **Get Drop Sources**: JOIN symbiant_items → item_sources → sources → mobs
3. **Transform Response**: Map database models to Pydantic schemas
4. **Return JSON**: Frontend receives SymbiantResponse or MobDropInfo arrays

## Configuration
No environment variables required. Import process uses:
- CSV path: `database/symbiants.csv`
- Database connection from `backend/.env.local`

## API Endpoints

### GET /api/symbiants
List symbiants with filtering
- Query params: `family`, `families[]`, `slot_id`, `min_ql`, `max_ql`, `page`, `page_size`
- Response: `PaginatedResponse<SymbiantResponse>`

### GET /api/symbiants/{id}
Get single symbiant details
- Response: `SymbiantResponse`

### GET /api/symbiants/{id}/dropped-by
Get pocket bosses that drop this symbiant
- Response: `MobDropInfo[]`

### GET /api/mobs
List mobs (pocket bosses and future regular mobs)
- Query params: `is_pocket_boss`, `playfield`, `min_level`, `max_level`
- Response: `MobResponse[]` (currently deprecated, use symbiants endpoint)

## Usage Example

### Backend Query (Python)
```python
# Get Artillery symbiants between QL 100-200
query = db.query(SymbiantItem).filter(
    SymbiantItem.family == 'Artillery',
    SymbiantItem.ql >= 100,
    SymbiantItem.ql <= 200
)
symbiants = query.all()

# Find which bosses drop a specific symbiant
bosses = (
    db.query(Mob)
    .join(Source, Source.source_id == Mob.id)
    .join(ItemSource, ItemSource.source_id == Source.id)
    .filter(ItemSource.item_id == symbiant_id)
    .filter(Mob.is_pocket_boss == True)
    .all()
)
```

### Frontend Query (TypeScript)
```typescript
// Get symbiants for Adventurer profession
const families = ['Artillery', 'Infantry', 'Support']
const symbiants = await apiClient.get('/api/symbiants', {
  params: { families }
})

// Get drop sources for a symbiant
const bosses = await apiClient.get(`/api/symbiants/${symbiantId}/dropped-by`)
```

## Testing
- **Database**: Verify materialized view contains 1,109 symbiants with 5 families
- **Import**: Run `python -m backend.import_cli` and verify mob/source counts
- **API**: Test family filtering, QL ranges, and drop source queries
- **Performance**: Symbiant list queries should be < 100ms (materialized view)

## Migration Notes
Migration 005 performs destructive operations:
- **Drops**: pocket_bosses, symbiants, pocket_boss_symbiant_drops tables
- **Creates**: mobs table, symbiant_items materialized view
- **Updates**: source_types.name 'boss' → 'mob'

**Rollback**: Restore from backup or manually recreate old tables (not recommended)

**Data Recovery**: Re-run import process using symbiants.csv

## Related Documentation
- Refactor plan: `.docs/plans/tinkerpocket/SYMBIANT_REFACTOR_PLAN.md`
- Import analysis: `.docs/plans/symbiants-to-source-system/import-system-analysis.docs.md`
- Source system design: `database/migrations/004_source_system.sql`
- Profession mappings: `.docs/plans/symbiant-professions/`
