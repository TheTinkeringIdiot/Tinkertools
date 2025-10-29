# TinkerFite Implementation Plan

## Overview
Rebuild TinkerFite as a modern weapon analysis tool that helps players find optimal weapons for their character. Users input stats from TinkerProfiles, backend filters to equipable weapons, frontend calculates DPS with all special attacks.

## Agent Orchestration Strategy

**IMPORTANT**: The agent implementing this plan should act as an **orchestrator**, delegating concrete implementation tasks to specialized subagents to preserve context windows and maximize efficiency.

### When to Use Subagents

1. **Backend API Development** - Delegate entire phases to backend-focused subagents or implementors
2. **Frontend Component Development** - Delegate UI component creation to frontend subagents or implementors
3. **Utility Module Creation** - Delegate calculation logic porting to specialized agents
4. **Testing** - Delegate test writing to test-focused subagents

### Orchestrator Responsibilities

- Maintain high-level progress tracking
- Ensure phase dependencies are met before proceeding
- Review subagent outputs for integration issues
- Handle cross-cutting concerns (routing, type definitions, service layer)
- Coordinate between frontend and backend work

### Subagent Delegation Pattern

For each phase, create focused subagent tasks:
```
Task: Implement Phase X - [Description]
Context:
- Reference legacy code at /home/quigley/projects/Tinkerplants/tinkerfite/views.py
- Follow patterns from TinkerNukes (src/views/TinkerNukes.vue)
- Use existing types/utilities where possible
Deliverables:
- List specific files to create
- Expected outputs
- Integration points
```

---

## Architecture Decisions

### Data Flow Strategy
**Problem**: Tens of thousands of weapons in database (cannot fetch all to frontend)

**Solution**: Smart server-side filtering
- Frontend sends character stats to `POST /api/v1/weapons/analyze`
- Backend filters to ~200-1000 weapons using:
  - Top 3 weapon skills (highest or >=50% attack stat contribution)
  - QL range: character level ± 50
  - Breed, profession, faction (stat 33) requirements
- Frontend performs final filtering, QL interpolation, and all DPS calculations

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

**Response**: `List[ItemDetail]` (existing schema with stats, attack_stats, actions, etc.)

**Weapon Matching Logic**:
- Include weapons where any of the top 3 skills is the highest attack stat contributor
- Also include weapons with 50/50 splits (skill contributes >=50% to attack rating)
- Check `attack_defense_attack` table for skill contribution percentages

---

## Implementation Phases

### Phase 1: Backend - Weapon Filtering API
**Delegation Target**: Backend specialist subagent

**Files to create**:
- `backend/app/api/routes/weapons.py` - New router with `/analyze` endpoint
- `backend/app/api/schemas/weapon_analysis.py` - Request/response schemas
- `backend/app/api/services/weapon_filter_service.py` - Filtering logic

**Tasks**:
1. Create Pydantic schemas for request/response
2. Implement weapon skill matching logic:
   - Query `attack_defense_attack` table
   - Find weapons where any top 3 skills are highest contributor
   - Include weapons with 50/50 splits (>=50% contribution)
3. Implement filtering logic:
   - QL range: `level - 50 <= ql <= level + 50`
   - Breed filter (from actions/criteria)
   - Profession filter (from actions/criteria)
   - Side/faction filter (stat 33)
4. Add endpoint to router and register in main app
5. Write backend tests for filtering logic

**Acceptance Criteria**:
- Returns 200-1000 weapons for typical level 220 character
- Respects all requirement filters
- Response time < 500ms
- Includes all weapon stats needed for frontend calculations

**Integration Points**:
- Uses existing `Item`, `AttackDefense`, `AttackDefenseAttack` models
- Returns standard `ItemDetail` schema
- Registered in `backend/app/main.py`

---

### Phase 2: Frontend - Core Infrastructure
**Delegation Target**: Frontend infrastructure subagent

**Files to create**:
- `frontend/src/types/weapon-analysis.ts` - TypeScript interfaces
- `frontend/src/services/weapon-service.ts` - API client wrapper
- `frontend/src/views/TinkerFite.vue` - Main view component skeleton
- `frontend/src/router/index.ts` - Add `/tinkerfite` route

**Types to define**:
```typescript
interface FiteInputState {
  characterStats: {
    breed: number
    level: number
    profession: number
    side: number
    crit: number
    targetAC: number
    aggdef: number  // -100 to +100 slider
  }
  weaponSkills: Record<number, number>  // 17 weapon skills (100-116, 133-134)
  specialAttacks: Record<number, number>  // 8 special skills (146-151, 167, 142, 144)
  initiative: {
    meleeInit: number    // 118
    physicalInit: number // 120
    rangedInit: number   // 119
  }
  combatBonuses: {
    aao: number       // 276
    addDamage: number // computed from damage mods 278-282, 311, 315-317
    wrangle: number   // weapon skill bonus
  }
}

interface WeaponCandidate extends ItemDetail {
  // Computed fields for display
  equipable: boolean
  interpolatedQL?: number
  dps?: number
  minDamage?: number
  avgDamage?: number
  maxDamage?: number
  attackTime?: number
  rechargeTime?: number
}
```

**Tasks**:
1. Create base TypeScript types
2. Implement `weapon-service.ts`:
   - `analyzeWeapons(characterData)` - POST to `/api/v1/weapons/analyze`
   - `extractWeaponStats(item)` - Parse stat arrays for weapon-specific data
3. Create `TinkerFite.vue` skeleton:
   - Profile store integration
   - State management for input form
   - Loading states
4. Add route to router with meta title

**Acceptance Criteria**:
- Types compile without errors
- API service successfully calls backend endpoint
- View renders with profile integration
- Route accessible at `/tinkerfite`

**Integration Points**:
- Imports `useTinkerProfilesStore()` from existing store
- Uses existing `apiClient` for HTTP calls
- Follows TinkerNukes view patterns

---

### Phase 3: Weapon Filtering & Interpolation
**Delegation Target**: Algorithm specialist subagent

**Files to create**:
- `frontend/src/utils/weapon-filtering.ts`
- `frontend/src/utils/weapon-interpolation.ts`
- `frontend/src/utils/weapon-requirements.ts`

**Legacy Code Reference**: `/home/quigley/projects/Tinkerplants/tinkerfite/views.py` lines 455-638

**Tasks**:

1. **Port `get_equipable_weapons()`** (legacy line 455):
   - Filter weapons by character requirements
   - Group weapons by name
   - Handle special cases (Martial Arts Item by profession)
   - Apply interpolation logic

2. **Port `interpolate()`** (legacy line 488):
   - Find highest equipable QL between weapon tiers
   - Linear interpolation for:
     - Damage (min, max, crit)
     - Attack rating cap
     - Requirements
   - Walk from high QL to low until requirements met
   - Return interpolated weapon object

3. **Port `check_requirements()`** (legacy line 551):
   - Breed requirements (stat array check)
   - Profession requirements (with "Any" profession = 0)
   - Expansion sets (froob/sloob/paid: 0/1/2)
   - Level requirements
   - Title level (special level breakpoints)
   - Faction requirements (skip for now)
   - NPC type (exclude if present)
   - Weapon skill requirements (with wrangle bonus)
   - General stat requirements

4. **Implement candidate selection**:
   - Identify highest weapon skill from profile
   - Get candidate weapons from backend response
   - Apply client-side requirement filtering
   - Group by weapon name and interpolate

**Acceptance Criteria**:
- Filtering matches legacy behavior exactly
- Interpolation produces same QLs as legacy
- Requirements checking handles all edge cases
- Performance: < 100ms for 1000 weapons

**Key Formulas**:
```typescript
// QL interpolation deltas
min_dmg_delta = (hi_weapon.dmg_min - lo_weapon.dmg_min) / ql_delta
max_dmg_delta = (hi_weapon.dmg_max - lo_weapon.dmg_max) / ql_delta
crit_dmg_delta = (hi_weapon.dmg_crit - lo_weapon.dmg_crit) / ql_delta
ar_cap_delta = (hi_ar_cap - lo_ar_cap) / ql_delta

// For each QL from hi to lo:
weapon.dmg_min = lo_weapon.dmg_min + (i * min_dmg_delta)
weapon.reqs[skill] = lo_req + (i * ((hi_req - lo_req) / ql_delta))
```

---

### Phase 4: Base DPS Calculations
**Delegation Target**: Calculation specialist subagent

**Files to create**:
- `frontend/src/utils/weapon-damage-calculations.ts`
- `frontend/src/utils/weapon-speed-calculations.ts`

**Legacy Code Reference**: `/home/quigley/projects/Tinkerplants/tinkerfite/views.py` lines 232-453

**Tasks**:

1. **Port `calculate_ar_bonus()`** (legacy line 407):
   ```typescript
   // Sum attack skills weighted by weapon's attack_stats percentages
   atk_skill = sum(stats[skill] * (percentage / 100))

   // Add AAO bonus
   atk_skill += stats.aao

   // Apply AR cap if weapon has one (e.g., MBS weapons)
   if (weapon.ar_cap && atk_skill > weapon.ar_cap) {
     atk_skill = weapon.ar_cap
   }

   // Tiered AR bonus formula
   ar_bonus = 1 + (min(atk_skill, 1000) / 400)
   if (atk_skill > 1000) {
     ar_bonus += (atk_skill - 1000) / 1200
   }
   ```

2. **Port `calculate_speeds()`** (legacy line 428):
   ```typescript
   // Start with base weapon times
   atk_time = weapon.atk_time  // centiseconds
   rech_time = weapon.rech_time

   // Apply aggdef modifier (slider -100 to +100, default 75)
   atk_time = atk_time - (aggdef - 75)
   if (atk_time < 100) atk_time = 100  // 1 second minimum

   rech_time = rech_time - (aggdef - 75)
   if (rech_time < 100) rech_time = 100

   // Apply initiative bonus based on weapon type
   init_type = weapon.other['Initiative skill']  // 'melee', 'physical', or 'ranged'
   init_value = stats[INIT_MAP[init_type]]

   atk_time = round(atk_time - (init_value / 6))
   if (atk_time < 100) atk_time = 100

   rech_time = round(rech_time - (init_value / 3))
   if (rech_time < 100) rech_time = 100

   // Apply weapon-specific speed caps
   if (weapon.atk_cap && atk_time < weapon.atk_cap) {
     atk_time = weapon.atk_cap
   }
   if (weapon.rech_cap && rech_time < weapon.rech_cap) {
     rech_time = weapon.rech_cap
   }
   ```

3. **Port `calculate_dps()`** (legacy line 232):
   ```typescript
   const SAMPLE_LENGTH = 60  // seconds

   // Calculate cycle time
   const { atk_time, rech_time } = calculateSpeeds(weapon, stats)
   const cycle_time = (atk_time / 100) + (rech_time / 100)  // convert to seconds

   // Basic attacks in sample
   let num_basic_attacks = Math.floor(SAMPLE_LENGTH / cycle_time)

   // Calculate base damage with AR bonus
   const ar_bonus = calculateARBonus(weapon, stats)
   let min_dmg = Math.round((weapon.dmg_min * ar_bonus) + stats.add_dmg)
   let max_dmg = Math.round((weapon.dmg_max * ar_bonus) + stats.add_dmg - (stats.target_ac / 10))
   if (max_dmg < min_dmg) max_dmg = min_dmg

   const avg_dmg = Math.round(min_dmg + (max_dmg - min_dmg) / 2)

   // Handle crits
   const crit_rate = stats.crit / 100
   let num_crits, num_regular

   if (crit_rate >= 1.0) {
     num_crits = num_basic_attacks
     num_regular = 0
   } else {
     num_crits = Math.floor(num_basic_attacks * crit_rate)
     num_regular = num_basic_attacks - num_crits
   }

   // Crit damage
   const crit_dmg = Math.round(((weapon.dmg_max + weapon.dmg_crit) * ar_bonus)
                                + stats.add_dmg - (stats.target_ac / 10))

   // Total DPS (before special attacks)
   const basic_dps = Math.round(
     ((avg_dmg * num_regular) + (crit_dmg * num_crits)) / SAMPLE_LENGTH
   )
   ```

**Acceptance Criteria**:
- DPS calculations match legacy tool within 1%
- Handles 100% crit rate correctly
- Respects all weapon speed caps
- AR bonus formula matches exactly

**Test Cases**:
- Level 220 NT with high AAO
- Level 1 character (low AR)
- 100% crit rate
- Weapons with AR caps (MBS)
- Different initiative types

---

### Phase 5: Special Attack Calculations
**Delegation Target**: Algorithm specialist subagent

**Files to create**:
- `frontend/src/utils/weapon-special-attacks.ts`

**Legacy Code Reference**: `/home/quigley/projects/Tinkerplants/tinkerfite/views.py` lines 260-405

**Tasks**: Port all 8 special attack formulas

1. **Fling Shot** (legacy line 261):
   ```typescript
   const cycle_cap = Math.floor(6 + (weapon.atk_time / 100))
   let cycle_time = Math.floor(16 * (weapon.atk_time / 100) - stats.fling_shot / 100)
   if (cycle_time < cycle_cap) cycle_time = cycle_cap

   const num_attacks = Math.floor(SAMPLE_LENGTH / cycle_time)
   special_dmg += (avg_dmg * num_attacks)
   ```

2. **Burst** (legacy line 271):
   ```typescript
   const cycle_cap = Math.floor(8 + (weapon.atk_time / 100))
   const burst_cycle = weapon.other['Burst cycle'] || 0

   let cycle_time = Math.floor(
     (weapon.rech_time / 100) * 20 + (burst_cycle / 100) - (stats.burst / 25)
   )
   if (cycle_time < cycle_cap) cycle_time = cycle_cap

   const num_attacks = Math.floor(SAMPLE_LENGTH / cycle_time)
   special_dmg += (avg_dmg * 3 * num_attacks)  // 3x damage per burst
   ```

3. **Full Auto** (legacy line 285):
   ```typescript
   const cycle_cap = Math.floor(10 + (weapon.atk_time / 100))
   const fa_cycle = weapon.other['Fullauto cycle'] || 1000

   let cycle_time = Math.floor(
     ((weapon.rech_time / 100) * 40) + (fa_cycle / 100)
     - (stats.full_auto / 25) + (weapon.atk_time / 100)
   )
   if (cycle_time < cycle_cap) cycle_time = cycle_cap

   const num_rounds = weapon.clipsize
   const fa_dmg = calculateFADamage(avg_dmg, num_rounds)

   const num_attacks = Math.floor(SAMPLE_LENGTH / cycle_time)
   special_dmg += Math.round(fa_dmg * num_attacks)
   ```

4. **Full Auto Damage Caps** (legacy line 376):
   ```typescript
   function calculateFADamage(dmg: number, num_rounds: number): number {
     let fa_dmg = dmg * num_rounds

     if (fa_dmg > 10000) {
       let remain = Math.round((fa_dmg - 10000) / 2)
       fa_dmg = 10000

       if (remain > 1500) {
         remain = Math.round((remain - 1500) / 2)
         fa_dmg = 11500

         if (remain > 1500) {
           remain = Math.round((remain - 1500) / 2)
           fa_dmg = 13000

           if (remain > 1500) {
             remain = Math.round((remain - 1500) / 2)
             fa_dmg = 14500

             if (remain > 500) {
               fa_dmg = 15000
             } else {
               fa_dmg += remain
             }
           } else {
             fa_dmg += remain
           }
         } else {
           fa_dmg += remain
         }
       } else {
         fa_dmg += remain
       }
     }

     return fa_dmg
   }
   ```

5. **Aimed Shot** (legacy line 308):
   ```typescript
   // PvE: 1x per fight only
   let as_dmg = Math.round((weapon.dmg_max * ar_bonus) + stats.add_dmg)
   const as_bonus = stats.aimed_shot / 95
   as_dmg = as_dmg * as_bonus
   if (as_dmg > 13000) as_dmg = 13000  // damage cap

   special_dmg += as_dmg
   ```

6. **Fast Attack** (legacy line 323):
   ```typescript
   const cycle_cap = Math.floor(6 + (weapon.atk_time / 100))
   let cycle_time = Math.floor((weapon.atk_time / 100) * 15 - stats.fast_attack / 100)
   if (cycle_time < cycle_cap) cycle_time = cycle_cap

   const num_attacks = Math.floor(SAMPLE_LENGTH / cycle_time)
   special_dmg += Math.round(avg_dmg * num_attacks)
   ```

7. **Brawl** (legacy line 333):
   ```typescript
   // Fetch "Brawl Item" weapons from API/cache
   const brawl_weapons = await fetchBrawlItems()

   // Interpolate to find equipable QL
   let brawl_weapon = null
   for (let i = brawl_weapons.length - 1; i > 0; i--) {
     brawl_weapon = interpolate(brawl_weapons[i-1], brawl_weapons[i], stats)
     if (brawl_weapon) break
   }

   // Calculate brawl damage with AR bonus
   const min_brawl = Math.round((brawl_weapon.dmg_min * ar_bonus) + stats.add_dmg)
   let max_brawl = Math.round((brawl_weapon.dmg_max * ar_bonus) + stats.add_dmg
                               - (stats.target_ac / 10))
   if (max_brawl < min_brawl) max_brawl = min_brawl

   const avg_brawl = Math.round(min_brawl + (max_brawl - min_brawl) / 2)

   const cycle_time = 15  // fixed
   const num_attacks = Math.floor(SAMPLE_LENGTH / cycle_time)
   special_dmg += Math.round(avg_brawl * num_attacks)
   ```

8. **Sneak Attack** (legacy line 356):
   ```typescript
   // 1x per fight
   const sneak_bonus = Math.round(stats.sneak_attack / 95)
   let sneak_dmg = Math.round(avg_dmg * sneak_bonus)
   if (sneak_dmg > 13000) sneak_dmg = 13000  // damage cap

   special_dmg += sneak_dmg
   ```

9. **Dimach** (legacy line 353):
   ```typescript
   // Not implemented (pass)
   ```

**Acceptance Criteria**:
- All special attack DPS matches legacy tool exactly
- Cycle time formulas correct
- Damage caps enforced (13k for AS/Sneak, tiered for FA)
- Brawl Item lookup and interpolation works

**Notes**:
- Aimed Shot and Sneak Attack only fire once per fight (PvE rules)
- Full Auto has complex tiered damage caps
- Brawl requires fetching separate "Brawl Item" weapons

---

### Phase 6: UI Components
**Delegation Target**: Frontend UI specialist subagent

**Component Hierarchy**:
```
TinkerFite.vue (orchestrator)
├── FiteInputForm.vue (Accordion orchestrator)
│   ├── CharacterStatsSection.vue
│   ├── WeaponSkillsSection.vue
│   ├── SpecialAttackSection.vue
│   ├── InitiativeSection.vue
│   └── CombatBonusesSection.vue
├── FiltersSection.vue
└── FiteTable.vue
```

**Files to create**:
- `frontend/src/components/fite/FiteInputForm.vue`
- `frontend/src/components/fite/CharacterStatsSection.vue`
- `frontend/src/components/fite/WeaponSkillsSection.vue`
- `frontend/src/components/fite/SpecialAttackSection.vue`
- `frontend/src/components/fite/InitiativeSection.vue`
- `frontend/src/components/fite/CombatBonusesSection.vue`
- `frontend/src/components/fite/FiltersSection.vue`
- `frontend/src/components/fite/FiteTable.vue`

**Reference Pattern**: `frontend/src/views/TinkerNukes.vue` and components

#### Component Specifications

**1. CharacterStatsSection.vue**
```typescript
// Inputs:
- Breed (Dropdown: Solitus=1, Opifex=2, Nanomage=3, Atrox=4)
- Level (InputNumber: 1-220)
- Profession (Dropdown: 0-15, use PROFESSION_MAP)
- Side (Dropdown: Neutral=0, Clan=1, Omni=2)
- Critical Increase (InputNumber: 0+)
- Target AC (InputNumber: 0+)
- Aggdef Slider (Slider: -100 to +100, default 75)

// Profile Auto-Population:
- Extract from activeProfile.Character
- Watch for profile changes
- Track manual modifications
```

**2. WeaponSkillsSection.vue**
```typescript
// Inputs (17 weapon skills + wrangle):
- 1h Blunt (102), 1h Edged (103)
- 2h Blunt (107), 2h Edged (105)
- Martial Arts (100), Melee Energy (104)
- Piercing (106), Multi Melee (101)
- Assault Rifle (116), Bow (111)
- Grenade (109), Heavy Weapons (110)
- MG/SMG (114), Pistol (112)
- Ranged Energy (133), Rifle (113)
- Shotgun (115)
- Wrangle (Additional skill bonus to requirements)

// Profile Auto-Population:
- Extract from activeProfile.skills[id].total
- Display in grid layout (2-3 columns)
```

**3. SpecialAttackSection.vue**
```typescript
// Inputs (8 special attack skills):
- Aimed Shot (151)
- Brawl (142)
- Burst (148)
- Dimach (144)
- Fast Attack (147)
- Fling Shot (150)
- Full Auto (167)
- Sneak Attack (146)

// Profile Auto-Population:
- Extract from activeProfile.skills[id].total
```

**4. InitiativeSection.vue**
```typescript
// Inputs (3 initiative types):
- Melee Init (118)
- Physical Init (120)
- Ranged Init (119)

// Profile Auto-Population:
- Extract from activeProfile.skills[id].total
```

**5. CombatBonusesSection.vue**
```typescript
// Inputs:
- Add All Offense / AAO (276)
- Add Damage (computed from damage modifiers, read-only display)

// Profile Auto-Population:
- AAO from skills[276].total
- Add Damage computed from:
  - Projectile (278), Melee (279), Energy (280)
  - Chemical (281), Radiation (282), Cold (311)
  - Fire (316), Poison (317), Nano (315)
  - Use highest damage type matching weapon
```

**6. FiteInputForm.vue**
```typescript
// Orchestrator component
// PrimeVue Accordion with 5 panels
// Emits consolidated inputState updates (debounced 50ms)
// Handles profile auto-population coordination
// Prevents update loops with isProgrammaticUpdate flag
```

**7. FiltersSection.vue**
```typescript
// Inputs:
- Search query (text input with icon)
- Weapon type dropdown (17 types + "All")
- QL range (dual slider: min/max)

// Emits filter updates
```

**8. FiteTable.vue**
```typescript
// PrimeVue DataTable with columns:
- Name (clickable → /items/{id})
- QL
- Clip Size
- Damage Type (chip/badge with color)
- Special Attacks (comma-separated)
- Atk/Rch (formatted as "X.XX/Y.YY" seconds)
- Min Damage
- Avg Damage
- Max Damage
- Crit Damage
- Min DPS
- Avg DPS
- Max DPS

// Features:
- Sortable columns
- Paginated (25/50/100 rows)
- Row click navigation
- Mono font for numeric columns
- Color coding for damage types
```

**Tasks**:

1. **Profile Auto-Population**:
   - Watch `profileStore.activeProfile`
   - Extract all 17 weapon skills by ID
   - Extract 8 special attack skills
   - Extract 3 initiative types
   - Extract combat bonuses (AAO, damage mods)
   - Handle profession checks (some skills profession-specific)

2. **Debounced Input Emission**:
   - 50ms debounce timer
   - Emit consolidated `FiteInputState` object
   - Prevent loops with `isProgrammaticUpdate` flag

3. **FiteTable Real-Time Calculations**:
   ```typescript
   const tableData = computed(() => {
     return filteredWeapons.value.map(weapon => ({
       ...weapon,
       // Calculate all DPS metrics on-the-fly
       attackTime: calculateAttackTime(weapon, inputState.value),
       rechargeTime: calculateRechargeTime(weapon, inputState.value),
       minDamage: calculateMinDamage(weapon, inputState.value),
       avgDamage: calculateAvgDamage(weapon, inputState.value),
       maxDamage: calculateMaxDamage(weapon, inputState.value),
       critDamage: calculateCritDamage(weapon, inputState.value),
       minDPS: calculateMinDPS(weapon, inputState.value),
       avgDPS: calculateAvgDPS(weapon, inputState.value),
       maxDPS: calculateMaxDPS(weapon, inputState.value)
     }))
   })
   ```

4. **Filtering Pipeline**:
   ```typescript
   const filteredWeapons = computed(() => {
     let result = equipableWeapons.value

     // Apply search query
     if (searchQuery.value) {
       result = result.filter(w =>
         w.name.toLowerCase().includes(searchQuery.value.toLowerCase())
       )
     }

     // Apply weapon type filter
     if (selectedWeaponType.value) {
       result = result.filter(w =>
         hasWeaponType(w, selectedWeaponType.value)
       )
     }

     // Apply QL range
     if (minQL.value !== undefined) {
       result = result.filter(w => w.ql >= minQL.value)
     }
     if (maxQL.value !== undefined) {
       result = result.filter(w => w.ql <= maxQL.value)
     }

     return result
   })
   ```

**Acceptance Criteria**:
- Profile auto-population works seamlessly
- No update loops or excessive re-renders
- Table updates in real-time as inputs change
- Filters apply correctly
- Sortable columns work
- Row click navigation works
- Performance: < 200ms for input changes with 1000 weapons

**UI/UX Patterns** (from TinkerNukes):
- PrimeVue Accordion for collapsible sections
- InputNumber with min/max constraints
- Dropdown with option-label/option-value
- Slider for aggdef
- DataTable with :value, paginator, sortable
- Mono font for numbers: `class="font-mono"`
- Row hover/click styling
- Loading spinners during API calls

---

### Phase 7: Testing & Validation
**Delegation Target**: Testing specialist subagent

**Test files to create**:
- `backend/tests/test_weapon_filtering.py`
- `frontend/src/__tests__/integration/fite-weapon-filtering.test.ts`
- `frontend/src/__tests__/integration/fite-dps-calculations.test.ts`
- `frontend/src/__tests__/integration/fite-special-attacks.test.ts`
- `frontend/src/__tests__/integration/fite-profile-integration.test.ts`

#### Backend Tests

**test_weapon_filtering.py**:
```python
def test_analyze_weapons_basic():
    """Test basic weapon filtering"""
    response = client.post("/api/v1/weapons/analyze", json={
        "level": 220,
        "breed_id": 1,
        "profession_id": 11,
        "side": 2,
        "top_weapon_skills": [
            {"skill_id": 116, "value": 2500}
        ]
    })
    assert response.status_code == 200
    assert 200 <= len(response.json()) <= 1000

def test_ql_range_filtering():
    """Test QL range is level ± 50"""
    response = client.post("/api/v1/weapons/analyze", json={
        "level": 100,
        "top_weapon_skills": [{"skill_id": 113, "value": 1000}]
    })
    weapons = response.json()
    assert all(50 <= w["ql"] <= 150 for w in weapons)

def test_weapon_skill_matching():
    """Test weapons match top skills correctly"""
    # Test with rifle skill - should return rifles
    # Verify attack_stats contain skill 113

def test_50_50_split_included():
    """Test weapons with 50/50 skill splits are included"""
    # Find weapon with even split, verify it's included

def test_performance():
    """Test response time < 500ms"""
    start = time.time()
    response = client.post("/api/v1/weapons/analyze", ...)
    elapsed = time.time() - start
    assert elapsed < 0.5
```

#### Frontend Integration Tests

**fite-weapon-filtering.test.ts**:
```typescript
describe('TinkerFite Weapon Filtering', () => {
  it('filters weapons by requirements', () => {
    // Setup character with specific level/skills
    // Verify only equipable weapons shown
  })

  it('interpolates QLs correctly', () => {
    // Test with weapon at QL 200 and 300
    // Character can equip QL 250
    // Verify interpolated stats match legacy formula
  })

  it('handles martial arts by profession', () => {
    // Test MA weap filtering for different professions
  })
})
```

**fite-dps-calculations.test.ts**:
```typescript
describe('TinkerFite DPS Calculations', () => {
  it('calculates AR bonus correctly', () => {
    // Test tiered formula
    // Test with AR cap weapons (MBS)
  })

  it('calculates speeds with initiative', () => {
    // Test attack/recharge time reduction
    // Test speed caps
  })

  it('handles 100% crit rate', () => {
    // All attacks should be crits
  })

  it('applies target AC correctly', () => {
    // Max damage reduced by AC/10
  })

  it('matches legacy DPS calculations', async () => {
    // Test cases from legacy tool
    // Compare outputs within 1% tolerance
  })
})
```

**fite-special-attacks.test.ts**:
```typescript
describe('TinkerFite Special Attacks', () => {
  it('calculates Fling Shot DPS', () => {
    // Test cycle time formula
    // Verify damage matches legacy
  })

  it('calculates Burst DPS with 3x multiplier', () => {
    // Test burst cycle time
    // Verify 3x damage applied
  })

  it('calculates Full Auto with damage caps', () => {
    // Test tiered cap system
    // Verify 10k → 11.5k → 13k → 14.5k → 15k
  })

  it('calculates Aimed Shot with 13k cap', () => {
    // 1x per fight
    // Test damage cap
  })

  it('calculates Brawl with item lookup', () => {
    // Mock "Brawl Item" weapons
    // Test interpolation
    // Verify fixed 15s cycle
  })

  it('calculates Sneak Attack with 13k cap', () => {
    // 1x per fight
    // Test damage cap
  })
})
```

**fite-profile-integration.test.ts**:
```typescript
describe('TinkerFite Profile Integration', () => {
  it('auto-populates from active profile', () => {
    // Load profile with all skills
    // Verify form populated correctly
  })

  it('updates when profile switches', () => {
    // Switch to different profile
    // Verify form updates
    // Verify weapon list refreshes
  })

  it('tracks manual modifications', () => {
    // Auto-populate
    // User modifies field
    // Switch profile
    // Modified field should not update
  })
})
```

#### Manual Validation Tasks

1. **Legacy Tool Comparison**:
   - Test with level 220 NT (rifle/AR/ranged energy)
   - Test with level 1 character
   - Test with level 100 melee character
   - Compare weapon lists, DPS values, special attack calculations

2. **Edge Cases**:
   - 100% crit rate
   - Very high AAO (3000+)
   - Very low level (< 50)
   - Weapons with AR caps
   - Weapons with speed caps
   - Martial Arts items with profession restrictions

3. **Performance Testing**:
   - 1000 weapons in table
   - Real-time calculation updates
   - Filter responsiveness
   - Sort performance
   - Memory usage over time

4. **UI/UX Testing**:
   - Profile auto-population smooth
   - No update loops
   - Debouncing works correctly
   - Table navigation works
   - Filters apply correctly
   - Accordion sections collapse/expand

**Acceptance Criteria**:
- Backend tests: 90%+ coverage
- Frontend integration tests: 85%+ passing
- DPS calculations within 1% of legacy tool
- No performance regressions
- All edge cases handled correctly

---

## Key Reference Data

### Skill IDs (Complete List)

**Weapon Skills** (17 total):
- 100: Martial Arts
- 101: Multi Melee
- 102: 1h Blunt
- 103: 1h Edged
- 104: Melee Energy
- 105: 2h Edged
- 106: Piercing
- 107: 2h Blunt
- 108: Sharp Objects (Thrown)
- 109: Grenade
- 110: Heavy Weapons
- 111: Bow
- 112: Pistol
- 113: Rifle
- 114: MG/SMG
- 115: Shotgun
- 116: Assault Rifle
- 133: Ranged Energy
- 134: Multi Ranged

**Special Attack Skills** (9 total):
- 121: Bow Special Attack
- 142: Brawl
- 144: Dimach
- 146: Sneak Attack
- 147: Fast Attack
- 148: Burst
- 150: Fling Shot
- 151: Aimed Shot
- 167: Full Auto

**Initiative Skills** (3 types):
- 118: Melee Init
- 119: Ranged Init
- 120: Physical Init

**Combat Bonuses**:
- 276: Add All Offense (AAO)
- 277: Add All Defense (AAD)
- 379: Critical Increase

**Damage Modifiers**:
- 278: Projectile Damage
- 279: Melee Damage
- 280: Energy Damage
- 281: Chemical Damage
- 282: Radiation Damage
- 311: Cold Damage
- 315: Nano Damage
- 316: Fire Damage
- 317: Poison Damage

**Requirements**:
- 33: Side/Faction
- 54: Level

### Weapon Stat IDs

- 286: Min Damage
- 285: Max Damage
- 284: Critical Bonus
- 287: Attack Range
- 294: Attack Delay (centiseconds)
- 210: Recharge Delay (centiseconds)
- 436: Damage Type
- 212: Clip Size / Max Energy
- 420: Ammo Type
- 374: Burst Recharge
- 375: Full Auto Recharge
- 440: Initiative Type
- 538: Max Beneficial Skill (AR cap)

### Damage Types

- 0: None
- 1: Melee
- 2: Energy
- 3: Chemical
- 4: Radiation
- 5: Cold
- 6: Poison
- 7: Fire
- 8: Projectile

### Constants

```typescript
const SAMPLE_LENGTH = 60  // DPS sample in seconds
const MIN_ATTACK_TIME = 100  // 1 second minimum (centiseconds)
const MIN_RECHARGE_TIME = 100
const DEFAULT_AGGDEF = 75
const AIMED_SHOT_CAP = 13000
const SNEAK_ATTACK_CAP = 13000
const FA_TIER_1 = 10000
const FA_TIER_2 = 11500
const FA_TIER_3 = 13000
const FA_TIER_4 = 14500
const FA_MAX = 15000
```

---

## Implementation Order & Dependencies

### Critical Path

1. **Phase 1 (Backend)** - MUST complete first
   - Blocks all frontend weapon fetching
   - Estimated: 4-6 hours

2. **Phase 2 (Infrastructure)** - After Phase 1
   - Establishes types and services
   - Estimated: 2-3 hours

3. **Phase 3 (Filtering)** - After Phase 2
   - Core weapon selection logic
   - Estimated: 4-6 hours

4. **Phase 4 (Base DPS)** - After Phase 3
   - Foundation for Phase 5
   - Estimated: 3-4 hours

5. **Phase 5 (Special Attacks)** - After Phase 4
   - Most complex calculations
   - Estimated: 6-8 hours

6. **Phase 6 (UI)** - After Phase 4 (can start)
   - Can proceed with basic DPS while Phase 5 ongoing
   - Estimated: 8-10 hours

7. **Phase 7 (Testing)** - Ongoing
   - Write tests as each phase completes
   - Final validation at end
   - Estimated: 6-8 hours

### Parallel Work Opportunities

- **Backend (Phase 1)** and **Frontend Infrastructure (Phase 2)** can be done by different subagents
- **UI Components (Phase 6)** can start after Phase 4 completes
- **Tests (Phase 7)** can be written in parallel with implementation

### Total Estimated Effort

- Sequential: ~40-50 hours
- With parallelization: ~25-35 hours

---

## Success Criteria

### Functional Requirements

✅ Display 200-1000 equipable weapons based on character level/skills
✅ Accurate DPS calculations matching legacy tool within 1%
✅ All 8 special attacks functional with correct formulas
✅ QL interpolation working correctly (finds highest equipable QL)
✅ Auto-populate from TinkerProfiles seamlessly
✅ Real-time calculation updates as inputs change
✅ Filtering by name, weapon type, QL range
✅ Sortable table with all DPS metrics
✅ Navigation to item detail pages

### Non-Functional Requirements

✅ Backend filtering: < 500ms response time
✅ Frontend calculations: < 200ms for input changes
✅ Table rendering: Smooth with 1000 weapons
✅ No memory leaks or performance degradation
✅ Responsive UI (mobile-friendly)
✅ Accessible (keyboard navigation, screen readers)

### Quality Requirements

✅ Backend tests: 90%+ coverage
✅ Frontend integration tests: 85%+ passing
✅ Zero TypeScript errors
✅ Follows existing code patterns (TinkerNukes)
✅ Documentation updated
✅ No console errors or warnings

---

## Resources & References

### Legacy Code
- **Main File**: `/home/quigley/projects/Tinkerplants/tinkerfite/views.py`
- **Key Functions**: Lines 196-638
  - `get_weapon_list()`: 196-230
  - `calculate_dps()`: 232-374
  - `calculate_fa_dmg()`: 376-405
  - `calculate_ar_bonus()`: 407-426
  - `calculate_speeds()`: 428-453
  - `get_equipable_weapons()`: 455-486
  - `interpolate()`: 488-549
  - `check_requirements()`: 551-608
  - `get_candidate_weapons()`: 610-614
  - `get_weapon_skill()`: 616-638

### Modern Reference (TinkerNukes)
- **View**: `frontend/src/views/TinkerNukes.vue`
- **Components**: `frontend/src/components/nukes/`
- **Services**: `frontend/src/services/offensive-nano-service.ts`
- **Utilities**: `frontend/src/utils/nuke-*-calculations.ts`
- **Store**: `frontend/src/stores/tinker-profiles.ts`

### Database Schema
- **Items Table**: `database/schema.sql`
- **Attack/Defense**: `attack_defense`, `attack_defense_attack`, `attack_defense_defense`
- **Stats**: `stat_values`, `item_stats`
- **Requirements**: `actions`, `action_criteria`

### API Documentation
- Available at: `http://localhost:8000/docs` (when backend running)
- Existing endpoints: `/api/v1/items`
- New endpoint: `/api/v1/weapons/analyze`

---

## Notes & Considerations

### Special Cases to Handle

1. **Martial Arts Items**: Different items per profession
2. **Brawl Special**: Requires separate "Brawl Item" lookup
3. **AR Cap Weapons**: MBS and other weapons with attack rating caps
4. **Speed Cap Weapons**: Weapons with minimum attack/recharge times
5. **Expansion Requirements**: Froob (0), Sloob (1), Paid (2)
6. **Title Level**: Special level breakpoints (15, 50, 100, 150, 190, 205)
7. **Faction Weapons**: Clan/Omni-specific weapons

### Performance Optimizations

1. **Memoization**: Cache expensive calculations
2. **Debouncing**: 50ms debounce on input changes
3. **Virtual Scrolling**: If needed for very large weapon lists
4. **Lazy Loading**: Load special attack data on demand
5. **Web Workers**: Consider for heavy calculations (if needed)

### Future Enhancements (Post-Phase 7)

1. **Healing Weapons**: Matter Creation heal calculations
2. **Weapon Comparison**: Side-by-side comparison mode
3. **Progression Planning**: Weapon upgrade path visualization
4. **Export/Share**: Shareable URLs with character config
5. **Tinkerplants Integration**: Import equipment bonuses
6. **Advanced Filters**: By damage type, special attacks, source
7. **Favorites**: Save preferred weapons
8. **Recommendations**: AI-powered weapon suggestions

---

## Appendix: Formula Quick Reference

### AR Bonus
```
atk_skill = Σ(weapon_skills × percentages) + AAO
if ar_cap: atk_skill = min(atk_skill, ar_cap)
ar_bonus = 1 + min(atk_skill, 1000)/400
if atk_skill > 1000: ar_bonus += (atk_skill - 1000)/1200
```

### Speed Calculation
```
atk_time = weapon.atk_time - (aggdef - 75) - (init/6)
rech_time = weapon.rech_time - (aggdef - 75) - (init/3)
atk_time = max(100, min(atk_time, atk_cap))
rech_time = max(100, min(rech_time, rech_cap))
```

### Damage Calculation
```
min_dmg = round((weapon.dmg_min × ar_bonus) + add_dmg)
max_dmg = round((weapon.dmg_max × ar_bonus) + add_dmg - (target_ac/10))
avg_dmg = round(min_dmg + (max_dmg - min_dmg)/2)
crit_dmg = round(((weapon.dmg_max + weapon.dmg_crit) × ar_bonus) + add_dmg - (target_ac/10))
```

### DPS Calculation
```
cycle_time = (atk_time/100) + (rech_time/100)
num_basic = floor(60 / cycle_time)
num_crits = floor(num_basic × crit_rate)
num_regular = num_basic - num_crits
dps = ((avg_dmg × num_regular) + (crit_dmg × num_crits) + special_dmg) / 60
```

---

## Document Revision History

- **v1.0** (2025-01-XX): Initial implementation plan created
- Based on legacy code analysis and TinkerNukes architecture
- Scoped for 17 weapon types, 8 special attacks, QL interpolation
- Estimated 25-35 hours with parallel subagent delegation
