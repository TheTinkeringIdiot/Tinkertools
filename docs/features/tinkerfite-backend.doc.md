# TinkerFite Backend - Weapon Analysis API

## Overview

The TinkerFite backend provides weapon filtering and analysis capabilities for the TinkerFite weapon comparison tool. It implements server-side filtering of weapons based on character statistics, requirements, and weapon skills to return a curated list of equipable weapons with full metadata for frontend analysis.

**Status**: Implemented
**Version**: 1.0.0
**Feature Type**: Backend API Endpoint
**Performance Target**: < 500ms response time (REQ-PERF-001)

## User-Facing Functionality

### What It Does

From a user perspective, the TinkerFite backend enables:

1. **Character-Specific Weapon Filtering**: Returns only weapons that a character can equip based on level, breed, profession, faction, and weapon skills
2. **Weapon Skill Matching**: Filters weapons by the character's top 1-3 weapon skills (where any skill contributes >= 50% to attack rating)
3. **Quality Level Range**: Returns all QL variants for proper interpolation (no QL filtering applied at backend)
4. **NPC Exclusion**: Automatically excludes NPC-only weapons that players cannot obtain
5. **Full Weapon Metadata**: Returns complete item details including stats, attack stats, actions, criteria, and sources

### User Scenarios

#### Scenario 1: Level 220 Soldier Finding Weapons
- User has level 220 Soldier with high Assault Rifle (2500), Shotgun (2400), and SMG (2300) skills
- Frontend sends character stats to `/api/v1/weapons/analyze`
- Backend returns 200-1000 weapons matching:
  - All QL variants of weapons (for interpolation)
  - Weapons using Assault Rifle, Shotgun, or SMG as primary/secondary skills
  - Omni-aligned or neutral weapons (respects faction)
  - Soldier-compatible or profession-agnostic weapons
  - Player-obtainable weapons only (excludes NPC items)
- User sees complete weapon list with damage, requirements, and sources for comparison

#### Scenario 2: Low-Level Character Weapon Search
- User has level 50 Enforcer (Solitus, Clan-aligned)
- Top skills: 1H Blunt (500), 2H Blunt (450)
- Backend filters to:
  - Weapons using 1H or 2H Blunt skills
  - Clan or neutral faction items only
  - Breed-compatible weapons (Solitus)
  - All QL variants for each weapon type
- Returns smaller result set (50-200 weapons) appropriate for level range

## Data Flow

### Weapon Analysis Request Flow
```
Frontend: User character stats input
  ↓
POST /api/v1/weapons/analyze
  Request: {
    level: 220,
    breed_id: 1,        // Solitus
    profession_id: 11,  // Soldier
    side: 2,            // Omni
    top_weapon_skills: [
      {skill_id: 116, value: 2500},  // Assault Rifle
      {skill_id: 113, value: 2400},  // Shotgun
      {skill_id: 133, value: 2300}   // SMG
    ]
  }
  ↓
WeaponFilterService.filter_weapons(request)
  ↓
1. Base Query: items WHERE atkdef_id IS NOT NULL AND item_class = 1 (weapons)
2. Skill Filter: Include weapons WHERE any top_skill contributes >= 50% to attack
3. Requirement Filter: Include weapons with at least one requirement (excludes unequippable)
4. NPC Exclusion: Exclude weapons with NPCFamily requirement (stat 455)
5. Faction Filter: Exclude weapons with non-matching faction (stat 33)
6. Breed Filter: Exclude weapons with non-matching breed requirement (stat 4)
7. Profession Filter: Exclude weapons with non-matching profession (stats 60 or 368)
  ↓
Database query with eager loading:
  - item_stats (stat bonuses)
  - item_spell_data → spell_data → spells → criteria (effects/requirements)
  - actions → action_criteria → criterion (equip requirements)
  - item_sources → source → source_type (where to obtain)
  ↓
Build ItemDetail responses with full metadata
  ↓
Return List[ItemDetail] (200-1000 weapons typical for level 220)
  ↓
Frontend: Display in weapon comparison table with damage calculations
```

### Weapon Skill Matching Logic
```
For each top_weapon_skill:
  Query AttackDefense → AttackDefenseAttack → StatValue
  WHERE stat = skill_id AND value >= 50
    (value represents % contribution to attack rating)

Weapons match if ANY top skill contributes >= 50%
  - Primary skill (100% contributor): Always included
  - Secondary skill (50/50 split): Included if in top 3
  - Tertiary skills (<50%): Excluded
```

## Implementation

### Key Files

#### Backend API
- **`backend/app/api/routes/weapons.py`** - Weapons router with `/analyze` endpoint
  - POST `/api/v1/weapons/analyze` endpoint
  - Request validation via WeaponAnalyzeRequest schema
  - Performance logging and monitoring (warns if > 500ms)
  - Error handling with HTTPException

- **`backend/app/api/schemas/weapon_analysis.py`** - Request/response schemas
  - `WeaponSkill`: Skill ID + value pair
  - `WeaponAnalyzeRequest`: Character stats validation (level 1-220, breed 1-4, profession 0-15, side 0-2)
  - Pydantic validation with examples

- **`backend/app/api/services/weapon_filter_service.py`** - Weapon filtering business logic
  - `WeaponFilterService` class with filter_weapons() method
  - Skill matching queries (>= 50% contribution logic)
  - Requirement filtering (breed, profession, faction, NPC exclusion)
  - Eager loading for optimal query performance

- **`backend/app/api/schemas/__init__.py`** - Schema exports
  - Added WeaponSkill and WeaponAnalyzeRequest exports

- **`backend/app/main.py`** - FastAPI application setup
  - Registered weapons router at `/api/v1` prefix

### Database Schema Dependencies

The weapon analysis endpoint relies on these database tables:

- **`items`** - Base weapon data (item_class=1, atkdef_id links to attack/defense)
- **`attack_defense`** - Weapon attack/defense configurations
- **`attack_defense_attacks`** - Attack skill contributions (stat_value with percentage)
- **`stat_values`** - Stat IDs and values (skill requirements, bonuses)
- **`actions`** - Item actions (action=3 is Use/Equip)
- **`action_criteria`** - Junction table linking actions to criteria
- **`criteria`** - Requirement criteria (breed, profession, faction, skills)
- **`item_stats`** - Junction table for item stat bonuses
- **`item_spell_data`** - Junction linking items to spell effects
- **`spell_data`** - Spell/effect containers
- **`spell_data_spells`** - Junction linking spell_data to spells
- **`spells`** - Individual spell effects
- **`spell_criteria`** - Spell casting requirements
- **`item_sources`** - Junction linking items to sources
- **`sources`** - Where items come from (vendor, quest, drop)
- **`source_types`** - Source categories (NPC, Crystal, Mission, etc.)

### Filtering Logic

#### NPC Exclusion (NPCFamily Stat = 455)
```python
# Exclude items with NPCFamily requirement (NPC-only weapons)
npc_family_subquery = db.query(Item.id).join(
    Action, Item.id == Action.item_id
).join(
    ActionCriteria, Action.id == ActionCriteria.action_id
).join(
    Criterion, ActionCriteria.criterion_id == Criterion.id
).filter(
    Criterion.value1 == 455  # NPCFamily stat
)
query = query.filter(~Item.id.in_(npc_family_subquery))
```

#### Faction Filtering (Faction Stat = 33)
```python
# Neutral (side=0) can use all items
# Clan (side=1) excludes Omni items
# Omni (side=2) excludes Clan items
if request.side > 0:
    faction_subquery = db.query(Item.id).join(
        ItemStats, Item.id == ItemStats.item_id
    ).join(
        StatValue, ItemStats.stat_value_id == StatValue.id
    ).filter(
        StatValue.stat == 33,              # Faction stat
        StatValue.value != request.side,   # Not matching
        StatValue.value != 0               # 0 = no faction requirement
    )
    query = query.filter(~Item.id.in_(faction_subquery))
```

#### Profession Filtering (Stats 60 or 368)
```python
# Profession 0 = "Any" can use all items
# Profession 1-15 = Specific profession
if request.profession_id > 0:
    profession_subquery = db.query(Item.id).join(
        Action, Item.id == Action.item_id
    ).join(
        ActionCriteria, Action.id == ActionCriteria.action_id
    ).join(
        Criterion, ActionCriteria.criterion_id == Criterion.id
    ).filter(
        Action.action == 3,  # Use/Equip action
        or_(
            Criterion.value1 == 60,   # Profession
            Criterion.value1 == 368   # VisualProfession
        ),
        Criterion.value2 != request.profession_id,
        Criterion.value2 != 0  # 0 = any profession
    )
    query = query.filter(~Item.id.in_(profession_subquery))
```

### Performance Optimizations

1. **Eager Loading**: Uses SQLAlchemy joinedload() for all related tables in single query
2. **Subquery Filtering**: Uses EXISTS/NOT EXISTS pattern for efficient requirement checks
3. **Index Utilization**: Relies on database indexes on item_class, atkdef_id, stat IDs
4. **No QL Filtering**: Returns all QL variants to minimize query complexity (filtering happens client-side)
5. **Distinct Results**: Uses .distinct() to avoid duplicates from multiple joins
6. **Cache-Friendly**: Results are deterministic for given character stats (enables frontend caching)

### API Contract

**Endpoint**: `POST /api/v1/weapons/analyze`

**Request Body**:
```json
{
  "level": 220,
  "breed_id": 1,
  "profession_id": 11,
  "side": 2,
  "top_weapon_skills": [
    {"skill_id": 116, "value": 2500},
    {"skill_id": 113, "value": 2400},
    {"skill_id": 133, "value": 2300}
  ]
}
```

**Response**: `List[ItemDetail]` (200-1000 weapons)
- Each ItemDetail includes: id, aoid, name, ql, icon, item_type, flags, stats, attack_stats, actions (requirements), sources
- Full metadata for frontend damage calculations and comparison

**Error Responses**:
- 422: Validation error (invalid level, breed, profession, or side)
- 500: Internal server error (database query failure)

## Integration with Frontend

The backend serves the TinkerFite frontend:

1. **Character Input**: Frontend collects character stats via form (auto-populated from TinkerProfiles)
2. **Skill Analysis**: Frontend calculates top 1-3 weapon skills from profile or user input
3. **API Call**: Frontend sends WeaponAnalyzeRequest to `/api/v1/weapons/analyze`
4. **Weapon Display**: Frontend receives filtered weapon list for comparison table
5. **Damage Calculation**: Frontend uses attack_stats + character skills to calculate DPS
6. **Interpolation**: Frontend uses multiple QL variants to interpolate stats at target QL

## Testing Considerations

### Backend Testing (pytest)
- Weapon filtering logic validation
- Skill matching accuracy (>= 50% contribution)
- NPC exclusion verification
- Faction/breed/profession requirement handling
- Query performance benchmarks (< 500ms target)
- Edge cases: neutral faction, "Any" profession, low-level characters

### Integration Testing
- End-to-end weapon analysis workflow
- Frontend/backend contract validation
- Performance under typical load (level 220 character)
- Result set size validation (200-1000 weapons expected)

## Known Limitations

1. **No QL Filtering**: Backend returns all QL variants, frontend must filter/interpolate
2. **Static Skill Thresholds**: 50% contribution threshold is hardcoded (not configurable)
3. **No Skill Requirement Validation**: Backend doesn't check if character meets weapon skill requirements (frontend responsibility)
4. **Memory-Intensive**: Eager loading all weapon metadata increases response size (acceptable for < 1000 weapons)

## Future Enhancements

1. **Configurable Skill Threshold**: Allow frontend to specify minimum skill contribution % (e.g., 40%, 60%)
2. **QL Range Filtering**: Add optional min_ql/max_ql parameters for backend filtering
3. **Pagination Support**: Implement cursor-based pagination for large result sets
4. **Caching**: Add Redis caching for common character profiles (level 220 Soldier, etc.)
5. **Special Attack Filtering**: Filter weapons by special attack types (aimed shot, fling shot, etc.)
6. **Damage Calculation**: Move damage/DPS calculations to backend for consistency
