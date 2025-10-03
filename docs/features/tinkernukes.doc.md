# TinkerNukes Offensive Nano Analysis Feature

## Overview

TinkerNukes is a specialized tool for Nanotechnician characters to analyze and compare offensive nanoprograms (damage-dealing nanos). The feature provides comprehensive damage calculations, efficiency metrics, and usability filtering based on character skills. It integrates with TinkerProfiles for automatic stat population and implements database-level filtering for optimal performance.

**Status**: Implemented
**Version**: 4.0.0+
**Feature Type**: Analysis Tool
**Profession**: Nanotechnician Only

## User-Facing Functionality

### What It Does

1. **Offensive Nano Database**: Displays all Nanotechnician offensive nanoprograms with database-level filtering for valid strains and damage types
2. **Skill-Based Filtering**: Automatically filters nanos based on character skill requirements (6 nano schools + Computer Literacy + Nano Pool)
3. **Profile Integration**: Auto-populates 27 input fields from active TinkerProfile, with manual override capability
4. **Damage Calculations**: 4-tier damage pipeline with type-specific modifiers, Direct Nano Damage Efficiency (DNDE), and AC reduction
5. **Efficiency Metrics**: Calculates DPS, damage per nano, sustain time, and sustainability indicators
6. **Buff Integration**: Lookup tables for 6 buff presets (Crunchcom, Humidity, Notum Siphon, Channeling, Enhance Nano Damage, Ancient Matrix)
7. **School Filtering**: Filter by nano school (Matter Creation, Matter Meta, Bio Meta, Psych Modi, Sensory Imp, Time & Space)
8. **QL Range Filtering**: Filter nanoprograms by quality level range
9. **Real-time Updates**: All calculations update in real-time as input fields change

### User Scenarios

#### Scenario 1: Analyzing Offensive Nanos with Active Profile
- User has active Nanotechnician profile in TinkerProfiles
- Navigates to TinkerNukes view
- Input form auto-populates with character stats, skills, and modifiers from profile
- Table displays all castable offensive nanos with calculated damage and efficiency
- User can adjust modifiers (add buffs, change target AC) to see updated calculations
- User can filter by school (e.g., only Matter Creation nukes) or QL range

#### Scenario 2: Theory-Crafting Without Profile
- User navigates to TinkerNukes without active profile
- Input form shows default values (breed=Solitus, all skills=1)
- User manually inputs character stats: Psychic=600, Nano Init=1200, Max Nano=5000, etc.
- User manually inputs nano school skills: Matter Creation=850, Bio Meta=600, etc.
- User selects buff levels: Crunchcom=5, Humidity=7, Enhance Nano Damage=4
- Table calculates and displays damage/efficiency for all usable nanos
- User compares DPS, damage per nano, and sustain time across different schools

#### Scenario 3: Profile Switching Behavior
- User has active Nanotechnician profile (Profile A)
- Switches to different Nanotechnician profile (Profile B) in TinkerProfiles
- TinkerNukes detects profile switch
- Table clears temporarily
- Input form auto-updates with Profile B's stats
- Table re-filters and re-calculates with new skill values
- User sees nanos usable by Profile B

#### Scenario 4: Profession Change Reset
- User has active Nanotechnician profile
- Switches to non-Nanotechnician profile (e.g., Doctor)
- TinkerNukes detects non-NT profession
- Table clears
- Input form resets to default values (all fields reset to safe defaults)
- User can manually input skills for theory-crafting

## Data Flow

### Initial Load Flow
```
User navigates to /tinkernukes
  ↓
TinkerNukes.vue onMounted()
  ↓
fetchOffensiveNanos(11) → GET /api/nanos/offensive/11
  ↓
Backend filters nanos:
  - profession requirement = Nanotechnician
  - target=3, spell_id=53002 (offensive spells)
  - health damage (spell_params.Stat=27)
  - valid strain (stat 75 > 0 AND stat 75 != 99999)
  - NOT test items (name NOT LIKE 'TESTLIVEITEM%')
  ↓
Backend returns ~200 offensive nanos with full spell data
  ↓
Frontend: buildOffensiveNano() transforms ItemDetail[] → OffensiveNano[]
  ↓
offensiveNanos.value populated
  ↓
Check activeProfile from TinkerProfiles store
  ↓
IF activeProfile is Nanotechnician:
  NukeInputForm auto-populates from profile
ELSE:
  NukeInputForm shows defaults (breed=1, all skills=1)
  ↓
filteredNanos computed → filterBySkillRequirements(offensiveNanos, currentSkills)
  ↓
NukeTable displays filtered nanos with calculated metrics
```

### Damage Calculation Flow (4-Tier Pipeline)
```
User inputs → NukeInputState (27 fields)
  ↓
For each OffensiveNano in filteredNanos:
  ↓
  Extract spell damage (MinValue, MaxValue from spell_params)
  ↓
  Identify damage type from spell modifier_stat (90-97)
    90: Projectile → stat 278
    91: Melee → stat 279
    92: Energy → stat 280
    93: Chemical → stat 281
    94: Radiation → stat 282
    95: Cold → stat 311
    96: Poison → stat 317
    97: Fire → stat 316
  ↓
  TIER 1: Base Damage + Type Modifier + Nano Modifier
    damage = spellDamage + typeModifier + nanoModifier
  ↓
  TIER 2: Apply Direct Nano Damage Efficiency (stat 536)
    damage = damage * (1 + stat536/100)
    stat536 = enhanceNanoDamage + ancientMatrix (from buff lookup tables)
  ↓
  TIER 3: Apply Target AC Reduction
    acReduction = floor(targetAC / 10)
    damage = damage - acReduction
  ↓
  TIER 4: Floor to MinValue
    damage = max(damage, spell.minValue)
  ↓
  IF DoT (tick_count > 1):
    totalDamage = damage * tick_count
  ↓
  Calculate min, mid, max damage
  midDamage = (minDamage + maxDamage) / 2
  ↓
  Calculate casting stats:
    castTime = baseCastTime * nanoInitReduction
    rechargeTime = baseRechargeTime * nanoInitReduction
    nanoCost = baseCost * (1 - crunchcomReduction%) with breed cap
  ↓
  Calculate efficiency metrics:
    dps = midDamage / (castTime + rechargeTime + dotDuration)
    damagePerNano = midDamage / nanoCost
    nanoPerSecond = nanoCost / (castTime + rechargeTime)
    regenPerSecond = baseDelta + humidity + notumSiphon + channeling
    sustainTime = maxNano / (nanoPerSecond - regenPerSecond)
    isSustainable = regenPerSecond >= nanoPerSecond
  ↓
Display in NukeTable (13 columns)
```

### Profile Integration Flow
```
User switches active profile in TinkerProfiles
  ↓
TinkerNukes watcher detects change
  ↓
clearTable() → reset search query, school filter, QL range
  ↓
Check new profile profession
  ↓
IF profession === Nanotechnician (ID 11):
  NukeInputForm.extractStatsFromProfile(profile)
    ↓
    Extract character stats:
      breed → profile.Character.Breed
      psychic → profile.skills[21]
      nanoInit → profile.skills[149]
      maxNano → profile.skills[221]
      nanoDelta → profile.skills[220]
      matterCreation → profile.skills[130]
      matterMeta → profile.skills[127]
      bioMeta → profile.skills[128]
      psychModi → profile.skills[129]
      sensoryImp → profile.skills[126]
      timeSpace → profile.skills[131]
    ↓
    Extract damage modifiers from profile.skills:
      projectile → profile.skills[278]
      melee → profile.skills[279]
      energy → profile.skills[280]
      chemical → profile.skills[281]
      radiation → profile.skills[282]
      cold → profile.skills[311]
      nano → profile.skills[315]
      fire → profile.skills[316]
      poison → profile.skills[317]
      directNanoDamageEfficiency → profile.skills[536]
    ↓
    Buff presets remain at 0 (user must manually select buffs)
    targetAC remains at 0 (user must manually set)
    ↓
    inputState.value updated with profile data
ELSE:
  resetToDefaults() → all fields reset to safe defaults
  ↓
filteredNanos re-computed with new skill values
  ↓
NukeTable re-renders with updated calculations
```

### Filtering Flow
```
offensiveNanos (all ~200 nanos from backend)
  ↓
Step 1: Filter by skill requirements
  filterBySkillRequirements(nanos, currentSkills)
    ↓
    For each nano:
      Check all castingRequirements
      IF requirement.type === 'skill':
        skillId = requirement.requirement (numeric ID)
        currentValue = skills[skillId]
        IF currentValue < requirement.value:
          EXCLUDE nano
    ↓
    Returns usable nanos only
  ↓
Step 2: Apply additional filters
  applyNanoFilters(nanos, { schoolId, minQL, maxQL, searchQuery })
    ↓
    IF schoolId selected:
      Filter nanos with castingRequirement matching schoolId
    ↓
    IF minQL and maxQL set:
      Filter nanos where ql >= minQL AND ql <= maxQL
    ↓
    IF searchQuery not empty:
      Filter nanos where name.toLowerCase().includes(query)
    ↓
    Returns filtered nanos
  ↓
filteredNanos computed property updated
  ↓
NukeTable re-renders with filtered results
```

## Implementation Files

### Backend API Endpoint
**File**: `/backend/app/api/routes/nanos.py` (lines 511-659)

```python
@router.get("/offensive/{profession_id}", response_model=PaginatedResponse[ItemDetail])
@cached_response("nanos_offensive", ttl=3600)  # Cache for 1 hour
@performance_monitor
def get_offensive_nanos_by_profession(
    profession_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(1000, ge=1, le=1000),
    sort: str = Query("ql"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db)
):
    """
    OPTIMIZED endpoint for TinkerNukes offensive nano filtering.

    Database-level filtering for:
    - Profession requirement (profession_id)
    - Offensive spells (target=3, spell_id=53002)
    - Health damage (spell_params.Stat=27)
    - Valid strain (stat 75 > 0 AND stat 75 != 99999)
    - Not test items (name NOT LIKE 'TESTLIVEITEM%')
    """
```

**Key Optimizations**:
- Database-level filtering moves strain validation and offensive spell detection to SQL
- `selectinload` instead of `joinedload` to avoid cartesian products
- `DISTINCT` clause prevents duplicates from multi-table joins
- Single query with proper pagination
- 1-hour cache TTL for static game data

### Frontend Main View
**File**: `/frontend/src/views/TinkerNukes.vue`

**Key Sections**:
1. **Header** (lines 10-27): Profile info, nano count badge, NT-only warning
2. **Input Form** (lines 30-36): NukeInputForm component with profile integration
3. **Filters** (lines 39-67): Search, school dropdown, QL range inputs, results count
4. **Table** (lines 70-77): NukeTable component with filtered nanos

**State Management**:
- `offensiveNanos`: Raw data from backend (~200 nanos)
- `inputState`: 27-field manual input state (CharacterStats + DamageModifiers + BuffPresets)
- `filteredNanos`: Computed property applying skill + filter logic
- `searchQuery`, `selectedSchoolId`, `minQL`, `maxQL`: Filter criteria

**Watchers**:
- Watches `activeProfile` for profile switches
- Calls `clearTable()` on switch
- Logs profession changes and warnings for non-NT profiles

### Type Definitions
**File**: `/frontend/src/types/offensive-nano.ts`

**Core Types**:
- `OffensiveNano`: Extends `NanoProgram` with minDamage, maxDamage, midDamage, damageType, tickCount, tickInterval
- `DamageType`: Union type ('projectile' | 'melee' | 'energy' | 'chemical' | 'radiation' | 'cold' | 'poison' | 'fire')
- `CharacterStats`: 11 fields (breed, psychic, nanoInit, maxNano, nanoDelta, 6 nano schools)
- `DamageModifiers`: 11 fields (9 damage types + DNDE + targetAC)
- `BuffPresets`: 6 fields (crunchcom, humidity, notumSiphon, channeling, enhanceNanoDamage, ancientMatrix)
- `NukeInputState`: Consolidates all 27 manual input fields
- `EfficiencyMetrics`: dps, damagePerNano, sustainTime, castsToEmpty, nanoPerSecond, regenPerSecond, isSustainable

### Service Layer
**File**: `/frontend/src/services/offensive-nano-service.ts`

**Functions**:
- `fetchOffensiveNanos(professionId)`: API client for GET /api/nanos/offensive/{professionId}
- `buildOffensiveNano(item)`: Transforms ItemDetail → OffensiveNano
- `parseSpellDamage(spell)`: Extracts MinValue, MaxValue from spell_params (returns absolute values)
- `parseDamageType(spell)`: Maps modifier_stat (90-97) → DamageType
- `extractCastingRequirements(spells)`: Builds CastingRequirement[] from spell_criteria
- `extractNanoSchool(requirements)`: Maps skill ID (126-131) → NanoSchool name
- `extractStrain(item)`: Reads stat 75 from item_stats
- `extractLevel(requirements)`: Finds level requirement from criteria

### Filtering Utilities
**File**: `/frontend/src/utils/nuke-filtering.ts`

**Functions**:
- `filterBySkillRequirements(nanos, skills)`: O(1) ID-based skill lookup, filters to usable nanos
- `filterBySchool(nanos, schoolId)`: Filters by nano school skill ID (126-131)
- `filterByQLRange(nanos, minQL, maxQL)`: Filters by quality level range
- `searchNanosByName(nanos, query)`: Case-insensitive name search
- `calculateUsabilityStatus(nano, skills)`: Returns 'usable' | 'close' | 'far' based on skill gaps
- `applyNanoFilters(nanos, options)`: Convenience function chaining all filters

### Damage Calculation Utilities
**File**: `/frontend/src/utils/nuke-damage-calculations.ts`

**Core Functions**:
- `calculateDamage(spellDamage, typeModifier, nanoModifier, stat536, targetAC, minValue)`: 4-tier pipeline
  - Tier 1: Base + type modifier + nano modifier
  - Tier 2: Apply DNDE (stat 536 as percentage)
  - Tier 3: Apply AC reduction (AC / 10)
  - Tier 4: Floor to MinValue
- `calculateDoTDamage(perTickDamage, tickCount)`: Multiplies per-tick damage by tick count
- `calculateModifiedDamage(spell, modifiers, targetAC)`: Returns { min, mid, max } damage
- `calculateNanoDamage(spells, modifiers, targetAC)`: Handles multi-spell nanos with DoT detection

**Mappings**:
- `DAMAGE_TYPE_MAP`: ModifierStat (90-97) → Stat ID (278-282, 311, 315-317)
- `DAMAGE_TYPE_NAMES`: ModifierStat → Human-readable names

### Casting Calculation Utilities
**File**: `/frontend/src/utils/nuke-casting-calculations.ts`

**Functions**:
- `calculateCastTime(baseCastTime, nanoInit)`: Two-tier Nano Init scaling
- `calculateRechargeTime(baseRechargeTime, nanoInit)`: Two-tier Nano Init scaling
- `calculateNanoCost(baseCost, costReductionPct, breed)`: Crunchcom reduction with breed-specific caps

### Efficiency Calculation Utilities
**File**: `/frontend/src/utils/nuke-efficiency-calculations.ts`

**Functions**:
- `calculateDPS(midDamage, castTime, rechargeTime, tickCount, tickInterval)`: Includes DoT duration
- `calculateDamagePerNano(midDamage, nanoCost)`: Damage efficiency metric
- `calculateSustainTime(maxNano, nanoPerSecond, regenPerSecond)`: Time until nano pool empty (seconds or Infinity)
- `calculateCastsToEmpty(maxNano, nanoCost, regenPerSecond, castTime, rechargeTime)`: Number of casts (integer or Infinity)
- `calculateEfficiencyMetrics(input)`: Consolidated function returning EfficiencyMetrics object

### Nano Regen Calculation Utilities
**File**: `/frontend/src/utils/nuke-regen-calculations.ts`

**Functions**:
- `calculateBaseNanoRegen(psychic, nanoDelta, breed)`: Base tick regen with breed multipliers
- `calculateNanoRegenPerSecond(psychic, nanoDelta, breed, buffs)`: Adds buff lookup values
- `getTickSpeed(psychic)`: Psychic-based tick interval (centiseconds)
- Buff lookup tables: `CRUNCHCOM_COST_REDUCTION`, `HUMIDITY_REGEN`, `NOTUM_SIPHON_REGEN`, `CHANNELING_REGEN`, `ENHANCE_NANO_DAMAGE_DNDE`, `ANCIENT_MATRIX_DNDE`

### UI Components

**File**: `/frontend/src/components/nukes/NukeInputForm.vue`
- Orchestrates 3 section components
- Handles auto-population from active profile
- Emits `update:input-state` on field changes
- Implements reset functionality

**File**: `/frontend/src/components/nukes/CharacterStatsSection.vue`
- 11 character stat inputs (breed dropdown + 10 numeric inputs)
- Auto-populated from profile.skills (ID-based access)
- Manual override capability

**File**: `/frontend/src/components/nukes/DamageModifiersSection.vue`
- 11 damage modifier inputs (9 damage types + DNDE + targetAC)
- Auto-populated from profile.skills
- DNDE auto-calculated from buff presets (can be overridden)

**File**: `/frontend/src/components/nukes/BuffPresetsSection.vue`
- 6 buff preset dropdowns (0-10 levels depending on buff)
- Lookup tables map level → effect value
- Auto-updates DNDE field when Enhance Nano Damage or Ancient Matrix changed

**File**: `/frontend/src/components/nukes/NukeTable.vue`
- PrimeVue DataTable with 13 columns
- Sortable, paginated, keyboard-navigable
- Columns: Name, School, QL, Cast Time, Recharge, Min/Mid/Max Damage, Nano Cost, Damage/Nano, DPS, Sustain Time, Casts to Empty
- Click row → navigate to /items/:id detail page

### Router Integration
**File**: `/frontend/src/router/index.ts` (lines 60-66)

```typescript
{
  path: '/tinkernukes',
  name: 'tinkernukes',
  component: TinkerNukes,
  meta: {
    title: 'TinkerNukes - Offensive Nano Analysis'
  }
}
```

### Navigation Menu
**File**: `/frontend/src/App.vue`
- TinkerNukes menu item repositioned in navigation
- Icon: pi-sparkles
- Route: /tinkernukes

## Performance Optimizations

### Backend Database-Level Filtering
1. **Strain Validation in SQL**: Moved from Python to SQL subquery (stat 75 > 0 AND stat 75 != 99999)
2. **Offensive Spell Detection in SQL**: Filter for target=3, spell_id=53002, Stat=27 at database level
3. **Test Item Exclusion**: `WHERE name NOT LIKE 'TESTLIVEITEM%'` in SQL
4. **selectinload Strategy**: Avoids cartesian products from joinedload
5. **DISTINCT Clause**: Prevents duplicate rows from multi-table joins
6. **Single Query**: All filtering in one database round-trip
7. **Caching**: 1-hour TTL for static game data

### Frontend Performance
1. **ID-Based Skill Lookups**: O(1) access instead of string-based O(n) searches
2. **Computed Properties**: Vue reactivity system efficiently tracks dependencies
3. **Filtering Pipeline**: Multi-stage filtering applied in optimal order (most restrictive first)
4. **Lazy Evaluation**: Calculations only run for visible filtered nanos
5. **Component Separation**: Input form, table, and sections isolated for granular updates

## Validation and Edge Cases

### Profile Integration
- **No Active Profile**: Shows default values (breed=1, all skills=1)
- **Non-NT Profile**: Resets to defaults with console warning
- **Profile Switch**: Clears table, auto-populates, re-filters, re-calculates
- **Missing Skills**: Falls back to 0 if skill not found in profile

### Skill Requirements
- **No Requirements**: Nano always usable (rare edge case)
- **Skill ID Not Found**: Warning logged, requirement treated as 0
- **Negative Skill Values**: Treated as 0

### Damage Calculations
- **Division by Zero**: Prevented in DPS calculation (cast time + recharge time must be > 0)
- **Negative Damage**: Floored to spell MinValue (Tier 4)
- **AC Reduction**: Floors to MinValue, never goes below minimum damage
- **DoT Detection**: tick_count > 1 triggers DoT multiplication
- **Missing Spell Data**: Nano excluded from results (buildOffensiveNano returns null)

### Buff Presets
- **Invalid Buff Level**: Falls back to 0 effect (lookup table out of range)
- **DNDE Auto-Calculation**: Sum of Enhance Nano Damage + Ancient Matrix lookup values
- **Manual DNDE Override**: User can manually edit DNDE field (bypasses auto-calculation)

### Filtering
- **Empty Search**: Shows all filtered nanos
- **No School Selected**: Shows all schools
- **QL Range Not Set**: Shows all QLs
- **No Matching Nanos**: Table shows empty state with message

## Testing Considerations

### Unit Tests
1. **Damage Calculations**: Verify 4-tier pipeline with known inputs/outputs
2. **Filtering Functions**: Test skill requirements, school filtering, QL range, search
3. **Buff Lookup Tables**: Verify correct values at each level
4. **Casting Calculations**: Test Nano Init scaling, Crunchcom cost reduction with breed caps
5. **Regen Calculations**: Verify base regen, tick speed, buff additions

### Integration Tests
1. **API Endpoint**: Verify offensive nano endpoint returns correct filtered nanos
2. **Profile Auto-Population**: Test extraction of stats from TinkerProfile
3. **Profile Switching**: Verify clear → populate → re-filter workflow
4. **Input State Updates**: Test reactivity of calculations to field changes

### E2E Tests
1. **Load TinkerNukes**: Navigate to /tinkernukes, verify initial load
2. **Profile Integration**: Switch profile in TinkerProfiles, verify TinkerNukes updates
3. **Manual Input**: Enter skills manually, verify table filters correctly
4. **Buff Selection**: Select buffs, verify DNDE updates and damage recalculates
5. **Filtering**: Apply school filter, QL range, search query, verify results
6. **Nano Selection**: Click nano row, verify navigation to /items/:id

### Performance Tests
1. **Backend Query Time**: Verify offensive endpoint < 500ms for ~200 nanos
2. **Frontend Filtering**: Verify filtering completes < 100ms for 200 nanos
3. **Real-time Calculations**: Verify input changes trigger updates < 50ms
4. **Profile Switch**: Verify full clear → populate → filter cycle < 200ms

## Buff Preset Lookup Tables

### Crunchcom (Cost Reduction)
- Level 0: 0%
- Level 1-7: 4%, 8%, 12%, 16%, 20%, 24%, 28%

**Breed Caps**:
- Solitus: 25%
- Opifex: 25%
- Nanomage: 50%
- Atrox: 25%

### Humidity (Nano Regen/Second)
- Level 0: 0
- Level 1-7: 5, 10, 15, 20, 25, 30, 35

### Notum Siphon (Nano Regen/Second)
- Level 0: 0
- Level 1-10: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100

### Channeling of Notum (Nano Regen/Second)
- Level 0: 0
- Level 1-4: 25, 50, 75, 100

### Enhance Nano Damage (DNDE %)
- Level 0: 0%
- Level 1-6: 10%, 20%, 30%, 40%, 50%, 60%

### Ancient Matrix (DNDE %)
- Level 0: 0%
- Level 1-10: 5%, 10%, 15%, 20%, 25%, 30%, 35%, 40%, 45%, 50%

**Combined DNDE Example**:
- Enhance Nano Damage Level 4 = 40%
- Ancient Matrix Level 6 = 30%
- Total DNDE (stat 536) = 70%

## Related Features

- **TinkerProfiles v4.0.0**: Provides profile data and skill storage (ID-based)
- **Skill System**: Uses numeric skill IDs (126-131 for nano schools, 21, 149, 220, 221, etc.)
- **Breed/Profession Normalization**: Ensures breed/profession stored as numeric IDs
- **Item Database**: Backend item/spell/stats schema for nano data
- **Nano Buff System**: Integration with buff presets and calculations

## Future Enhancements

### Potential Improvements
1. **Advanced Filtering**: Usability status filter (usable/close/far)
2. **Damage Type Filter**: Filter by damage type (projectile, energy, fire, etc.)
3. **Comparison Mode**: Side-by-side nano comparison
4. **Favorites**: Save favorite nano builds
5. **Export Results**: Export table to CSV/JSON
6. **Rotation Builder**: Build nano casting rotation sequences
7. **Target Profiles**: Save multiple target AC configurations
8. **Mobile Responsiveness**: Optimize for mobile displays
9. **Accessibility**: Enhanced keyboard navigation and screen reader support
10. **Graph Visualizations**: DPS vs QL charts, efficiency scatter plots

## References

### Skill ID Mappings
```typescript
// Nano Schools (casting requirements)
126: Sensory Improvement
127: Matter Metamorphosis
128: Biological Metamorphosis
129: Psychological Modifications
130: Matter Creation
131: Time and Space

// Character Stats
21: Psychic
149: Nano Init
220: Nano Delta
221: Max Nano
152: Computer Literacy

// Damage Modifiers
278: Projectile Damage
279: Melee Damage
280: Energy Damage
281: Chemical Damage
282: Radiation Damage
311: Cold Damage
315: Nano Damage
316: Fire Damage
317: Poison Damage
536: Direct Nano Damage Efficiency (DNDE)

// Spell ModifierStat → Stat ID
90 → 278 (Projectile)
91 → 279 (Melee)
92 → 280 (Energy)
93 → 281 (Chemical)
94 → 282 (Radiation)
95 → 311 (Cold)
96 → 317 (Poison)
97 → 316 (Fire)
```

### Database Schema
- **items**: id, aoid, name, ql, item_class, description, is_nano
- **spell_data**: id, spell_data_id, item_id
- **spells**: id, spell_id, target, spell_params (JSONB: MinValue, MaxValue, ModifierStat, Stat)
- **spell_criteria**: spell_id, criterion_id
- **criteria**: id, value1 (skill ID), value2 (required value)
- **item_stats**: item_id, stat_value_id
- **stat_values**: id, stat, value

### API Endpoints
- `GET /api/v1/nanos/offensive/{profession_id}`: Fetch offensive nanos for profession
- Query params: page, page_size, sort, sort_order
- Response: PaginatedResponse<ItemDetail>
- Cache TTL: 3600 seconds (1 hour)
