# TinkerFite Weapon Analysis Frontend

## Overview
TinkerFite analyzes weapons based on character combat stats, calculating effective DPS (damage per second) with special attacks, filtering by equipability, and comparing weapons across quality levels using QL interpolation.

## User Perspective
Users enter their character stats (level, weapon skills, initiative, special attacks) either manually or by loading a TinkerProfile. The tool fetches 200-1000 equipable weapons from the backend based on top weapon skills, then displays them with calculated DPS metrics. Users can filter by weapon type, QL range, or name search, and sort by various DPS calculations to find optimal weapons for their character build.

## Data Flow
1. User loads character profile or manually enters 50+ input fields (character stats, weapon skills, special attacks, initiative, combat bonuses)
2. Frontend calculates top 3 weapon skills and sends request to `/api/weapons/analyze` endpoint
3. Backend filters weapons by level (±50 QL), breed, profession, faction, and weapon skill compatibility (≥50% attack rating contribution)
4. Frontend receives 200-1000 weapons and applies client-side filtering:
   - Requirement checking (breed, profession, level, title level, expansion, weapon skill with wrangle bonus)
   - QL interpolation to find highest equipable QL between weapon tiers
   - Search by name, weapon type, and QL range filters
5. DPS calculations performed in computed properties for reactive updates:
   - Attack/recharge speed with initiative and aggdef modifiers
   - AR bonus from weapon skills (tiered formula)
   - Min/avg/max/crit damage calculations
   - Special attack DPS contributions (Fling Shot, Burst, Full Auto, Aimed Shot, Fast Attack, Sneak Attack)
6. Results table displays weapons with real-time DPS updates as inputs change

## Implementation

### Key Files

#### Views
- `frontend/src/views/TinkerFite.vue` - Main view orchestrating state, profile integration, weapon fetching, and filtering pipeline

#### Components
- `frontend/src/components/fite/FiteInputForm.vue` - Master form with 5 collapsible sections and profile auto-population
- `frontend/src/components/fite/CharacterStatsSection.vue` - 7 fields: breed, level, profession, side, crit, target AC, aggdef
- `frontend/src/components/fite/WeaponSkillsSection.vue` - 18 fields: 17 weapon skills + wrangle bonus
- `frontend/src/components/fite/SpecialAttackSection.vue` - 8 special attack skill fields
- `frontend/src/components/fite/InitiativeSection.vue` - 3 initiative types (melee, physical, ranged)
- `frontend/src/components/fite/CombatBonusesSection.vue` - AAO and Add Damage (computed from damage modifiers)
- `frontend/src/components/fite/FiltersSection.vue` - Search, weapon type, and QL range filters
- `frontend/src/components/fite/FiteTable.vue` - PrimeVue DataTable with 13 columns including DPS calculations

#### Services
- `frontend/src/services/weapon-service.ts` - API communication and weapon stat extraction
- `frontend/src/services/weapon-cache.ts` - Client-side weapon caching layer (cache key: level + breed + profession + faction + top 3 skills)

#### Utilities
- `frontend/src/utils/weapon-requirements.ts` - Requirement checking with OR operator support and wrangle bonus
- `frontend/src/utils/weapon-interpolation.ts` - QL interpolation for weapons with multiple tiers
- `frontend/src/utils/weapon-filtering.ts` - Main filtering function with Martial Arts profession handling
- `frontend/src/utils/weapon-speed-calculations.ts` - Attack/recharge time with initiative and aggdef modifiers
- `frontend/src/utils/weapon-damage-calculations.ts` - AR bonus (tiered), damage, and DPS calculations
- `frontend/src/utils/weapon-special-attacks.ts` - All 8 special attack calculations (6 fully implemented, 2 stubs)

#### Types
- `frontend/src/types/weapon-analysis.ts` - TypeScript interfaces for FiteInputState, WeaponCandidate, and all weapon constants

#### Tests
- `frontend/src/__tests__/utils/weapon-calculations.test.ts` - 10 tests for speed and DPS calculations
- `frontend/src/__tests__/utils/weapon-special-attacks.test.ts` - 15 tests for special attack formulas

### Backend
- Endpoint: `POST /api/v1/weapons/analyze`
- Request: Character data + top 3 weapon skills
- Returns: Array of Item objects (200-1000 weapons) filtered by level range and weapon skill compatibility
- Performance: ~700ms response time (first request), cached on frontend

### Key Technical Decisions

#### Profile Auto-Population
All 50+ input fields automatically populate from active TinkerProfile:
- Character stats from `Character` object (breed, level, profession, faction)
- Weapon skills from `skills` map (IDs 100-116, 133-134)
- Special attacks from `skills` map (IDs 142, 144, 146-148, 150-151, 167)
- Initiative from `skills` map (IDs 118-120)
- AAO from `skills[276].total`
- Add Damage computed from highest of 9 damage modifiers (IDs 278-282, 311, 315-317)

#### Debounced State Management
Prevents excessive re-renders and API calls:
- 50ms debounce on input field emissions
- 300ms debounce on search query
- Programmatic update flags prevent infinite update loops when profile switches

#### QL Interpolation System
Finds highest equipable quality level between weapon tiers:
```typescript
// Example: Weapon has QLs 100, 150, 200
// Character can equip up to QL 175
// Interpolation finds QL 175 stats by linear interpolation between QL 150 and QL 200
```

#### AR Bonus Tiered Formula
Attack rating bonus follows legacy formula:
```typescript
ar_bonus = 1 + min(attack_skill, 1000) / 400
if (attack_skill > 1000):
  ar_bonus += (attack_skill - 1000) / 1200
```

#### Special Attack Implementations
- **Fling Shot**: Cycle time with cap, fires every 6+ seconds
- **Burst**: 3x damage multiplier, 8+ second cycle
- **Full Auto**: Tiered damage caps (10k → 11.5k → 13k → 14.5k → 15k), 10+ second cycle
- **Aimed Shot**: Fires once per fight, 13k damage cap
- **Fast Attack**: 6+ second cycle
- **Sneak Attack**: Fires once per fight, 13k damage cap
- **Brawl**: Framework in place, returns 0 (TODO: requires Brawl Item lookup)
- **Dimach**: Not implemented (legacy pass)

#### Martial Arts Profession Filter
Martial Arts items (weapon skill 100) filter by profession:
- Backend returns all Martial Arts items
- Frontend filters by profession-specific requirements
- Ensures profession-restricted items don't show for incompatible characters

#### Client-Side Caching
Weapon data cached based on:
- Level, breed, profession, faction
- Top 3 weapon skills
- Cache hit: <100ms
- Cache miss: ~700ms (backend query)
- Performance metrics always recalculated (never cached)

### Data Transformation Flow
1. **Profile Load**: TinkerProfile → FiteInputState (50+ fields auto-populated)
2. **Top Skills Detection**: Find 3 highest weapon skills from inputState.weaponSkills
3. **Backend Request**: POST to `/weapons/analyze` with WeaponAnalyzeRequest
4. **Weapon Filtering**: Filter by requirements → search → type → QL range
5. **QL Interpolation**: For each weapon, find highest equipable QL
6. **DPS Calculations**: Reactive computed properties calculate all DPS metrics
7. **Table Display**: PrimeVue DataTable with sortable columns and pagination

## Configuration
- No environment variables required
- Uses TinkerProfile data structure when available
- Falls back to manual input mode when no profile loaded
- Backend URL: `${API_BASE_URL}/weapons/analyze`

## Usage Example
```typescript
// Auto-populate from profile
const inputState = populateFromProfile(activeProfile)

// Fetch weapons with caching
const request = {
  level: inputState.characterStats.level,
  breed_id: inputState.characterStats.breed,
  profession_id: inputState.characterStats.profession,
  side: inputState.characterStats.side,
  top_weapon_skills: getTop3WeaponSkills(inputState.weaponSkills)
}
const weapons = await analyzeWeaponsWithCache(request)

// Filter equipable weapons
const equipableWeapons = getEquipableWeapons(weapons, inputState)

// Calculate DPS for weapon
const dps = calculateBaseDPS(weapon, inputState, specialAttacksDPS)
```

## Testing

### Unit Tests (25 passing)
- **Weapon Calculations** (10 tests):
  - Speed calculations with aggdef and initiative
  - AR bonus tiered formula
  - Damage calculations with crit rate
  - Target AC reduction
  - AR cap enforcement for MBS weapons
- **Special Attacks** (15 tests):
  - Fling Shot cycle time and cap
  - Burst 3x multiplier
  - Full Auto tiered caps
  - Aimed Shot 13k cap
  - Fast Attack cycle
  - Sneak Attack 13k cap
  - Brawl/Dimach stubs

### Manual Testing
- Load TinkerProfile with level 220 character
- Expected behavior:
  - All 50+ fields auto-populate from profile
  - Backend returns 200-1000 weapons
  - DPS values update reactively as inputs change
  - Special attacks contribute to total DPS
  - Sorting by avg DPS shows highest damage weapons first
  - Filtering by weapon type (e.g., "Rifle") shows only rifles
  - QL interpolation finds correct equipable QL

## Related Documentation
- Implementation summary: `docs/TINKERFITE_IMPLEMENTATION_SUMMARY.md`
- Backend API: `backend/app/api/routes/weapons.py`
- Backend service: `backend/app/api/services/weapon_filter_service.py`
- Weapon schemas: `backend/app/api/schemas/weapon_analysis.py`
