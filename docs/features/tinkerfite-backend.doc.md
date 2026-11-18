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
5. **Expansion Filtering**: Excludes weapons that need an expansion the account does not have
6. **Full Weapon Metadata**: Returns complete item details including stats, attack stats, actions, criteria, and sources

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
filter_weapons(db, build, request)   (backend/app/api/services/weapon_filter_service.py)
  ↓
One query on the revisions of the requested build (weapon_query):
1. Weapon: item_class = 1 with an attack/defense block
2. Skill: an attack entry for one of the top skills with a share >= 50
3. Requirement: at least one requirement of any kind, or one of the Martial Arts Item templates
4. NPC exclusion: no Wield criterion on NPCFamily (stat 455)
5. Faction: no Faction stat (33) other than the character's side (side 0 takes every faction)
6. Breed: no Wield criterion on Breed (stat 4) for another breed
7. Profession: Wield criteria on Profession/VisualProfession (60, 368), if any, name the character's profession (profession 0 takes every weapon)
8. Expansion: Wield criteria on Expansion (stat 389) are met by expansion_bitflag
  ↓
load_item_documents: parts, effect formats and sources in three queries
  ↓
The plain ItemDetail documents are returned as a pre-rendered JSON response, ordered by AOID
(200-1000+ weapons; validating that many response models cost more than the queries)
  ↓
Frontend: Display in weapon comparison table with damage calculations
```

### Weapon Skill Matching Logic
```
has_atkdef(is_attack, stat = ANY(top skill ids), value >= 50)
    (value is the skill's % share of the attack rating)

Weapons match if ANY top skill contributes >= 50%
  - Primary skill (100% contributor): Always included
  - Secondary skill (50/50 split): Included if in top 3
  - Tertiary skills (<50%): Excluded
```

## Implementation

### Key Files

- **`backend/app/api/routes/weapons.py`** - `POST /api/v1/weapons/analyze`; cached for an hour per request body and game version; logs a warning above 500ms
- **`backend/app/api/schemas/weapon_analysis.py`** - `WeaponSkill`, `WeaponAnalyzeRequest` (level 1-220, breed 1-4, profession 0-15, side 0-2, expansion_bitflag, 1-3 top skills)
- **`backend/app/api/services/weapon_filter_service.py`** - `weapon_query(build, request)` and `filter_weapons(db, build, request)`; the module docstring states the rules
- **`backend/app/store/items.py`** - `item_document` / `load_item_documents`: the item shape shared with `GET /items/{aoid}`
- **`backend/app/tests/test_weapon_analysis.py`** - one test per rule, on a throwaway store

### Store Dependencies

The query reads the content-addressed store (`backend/database/cas/001_store.sql`): `item_presence` and `item_revision` for the weapons of the build, and the search projections `atkdef_entry` (attack skill shares), `requirement` (action criteria) and `stat_entry` (faction). Item content comes from the part documents; sources from `item_source`.

### API Contract

**Endpoint**: `POST /api/v1/weapons/analyze`

**Request Body**:
```json
{
  "level": 220,
  "breed_id": 1,
  "profession_id": 11,
  "side": 2,
  "expansion_bitflag": 127,
  "top_weapon_skills": [
    {"skill_id": 116, "value": 2500},
    {"skill_id": 113, "value": 2400},
    {"skill_id": 133, "value": 2300}
  ]
}
```

**Response**: `List[ItemDetail]`, ordered by AOID
- Each row is exactly what `GET /items/{aoid}` returns for the weapon: aoid, name, ql, item_class, description, is_nano, stats, spell_data, attack_stats, defense_stats, actions, sources
- `level` and the skill values do not filter: every QL variant is returned so the client can interpolate

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

## Known Limitations

1. **No QL Filtering**: Backend returns all QL variants, frontend must filter/interpolate
2. **Static Skill Threshold**: The 50% share is a constant (`MIN_SKILL_SHARE`)
3. **No Skill Requirement Validation**: Backend doesn't check if character meets weapon skill requirements (frontend responsibility)
4. **Large Response**: Several megabytes for a level 220 character
