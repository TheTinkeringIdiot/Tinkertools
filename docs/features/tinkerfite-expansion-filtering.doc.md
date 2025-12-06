# TinkerFite Expansion Filtering

## Overview
Account type-based expansion filtering for TinkerFite weapon analysis that ensures Froob, Sloob, and Paid accounts only see weapons appropriate for their expansion access, using stat 389 (expansion) with bitflag matching operators 22 and 107.

## User Perspective
When users analyze weapons in TinkerFite, the results automatically filter based on their character's account type. Froob accounts see only NotumWars weapons, Sloob accounts see weapons up to Shadowlands, and Paid accounts see all expansion weapons. This prevents users from seeing weapons they cannot actually equip in-game, making the weapon comparison tool more accurate and useful.

## Data Flow
1. User loads a character profile with AccountType (Froob/Sloob/Paid) in TinkerFite
2. Frontend converts AccountType to expansion bitflag using `accountTypeToExpansionBitflag()` (Froob=1, Sloob=7, Paid=127)
3. Frontend includes `expansion_bitflag` in WeaponAnalyzeRequest payload
4. Backend receives request with expansion bitflag (defaults to 127 if missing)
5. Backend applies two expansion filters to weapon query:
   - Operator 22 (StatBitSet): Excludes weapons requiring expansions the character doesn't have
   - Operator 107 (StatBitNotSet): Excludes weapons forbidden for the character's expansions
6. Backend uses bitwise AND operations to compare character's expansion flags against weapon requirements
7. Backend returns filtered weapon list with only expansion-appropriate weapons
8. Frontend caches results with expansion as part of the cache key to prevent cross-contamination

## Implementation

### Key Files
- `frontend/src/views/TinkerFite.vue` - Builds expansion bitflag from character's AccountType and includes in API request
- `frontend/src/types/weapon-analysis.ts` - Added `expansion_bitflag` field to WeaponAnalyzeRequest interface
- `frontend/src/services/indexed-db-weapon-cache.ts` - Updated cache key generation to include expansion to prevent cache pollution
- `frontend/src/utils/expansion-utils.ts` - Existing utility providing `accountTypeToExpansionBitflag()` conversion
- `backend/app/api/schemas/weapon_analysis.py` - Added `expansion_bitflag` field to request schema with default of 127 (Paid)
- `backend/app/api/services/weapon_filter_service.py` - Core filtering logic with two bitwise exclusion subqueries
- `backend/app/api/routes/weapons.py` - Updated API docstring to document expansion filtering

### Database
- Stat: `389` (expansion) - Expansion requirement/restriction bitflag
- Operators:
  - `22` (StatBitSet) - Weapon requires specific expansion bits to be set (e.g., Shadowlands weapon requires bit 4)
  - `107` (StatBitNotSet) - Weapon is forbidden for specific expansion bits (e.g., Froob-only weapon forbidden if bit 4 set)
- Action: `8` (Can) - Action type for equipment requirements stored in actions table
- Tables: `items`, `actions`, `action_criteria`, `criterion` - Standard requirement lookup pattern

### Expansion Bitflag Values
```typescript
// From expansion-utils.ts
Froob: 1   // NotumWars only (1 << 0)
Sloob: 7   // NotumWars + Shadowlands + ShadowlandsPreorder (1|2|4)
Paid: 127  // All expansion flags (1|2|4|8|16|32|64)
```

### Backend Filtering Logic
```python
# Operator 22: Exclude items requiring expansions character doesn't have
# Example: Shadowlands weapon (requires bit 4), Froob character (has bit 1)
# Character has: 1 (binary: 0000001)
# Weapon needs: 4 (binary: 0000100)
# Bitwise AND: 1 & 4 = 0 (not equal to 4, so EXCLUDE)

expansion_required_not_met = select(Item.id).where(
    Criterion.value1 == 389,  # expansion stat
    Criterion.operator == 22,  # StatBitSet
    func.cast(
        func.cast(request.expansion_bitflag, BigInteger).op('&')(
            func.cast(Criterion.value2, BigInteger)
        ),
        Integer
    ) != Criterion.value2  # Character doesn't have required bits
)

query = query.filter(Item.id.not_in(expansion_required_not_met))

# Operator 107: Exclude items forbidden for character's expansions
# Example: Froob-only weapon (forbidden if bit 4 set), Paid character (has bit 4)
# Character has: 127 (all bits)
# Weapon forbids: 4 (Shadowlands bit)
# Bitwise AND: 127 & 4 = 4 (not zero, so EXCLUDE)

expansion_forbidden = select(Item.id).where(
    Criterion.value1 == 389,
    Criterion.operator == 107,  # StatBitNotSet
    func.cast(
        func.cast(request.expansion_bitflag, BigInteger).op('&')(
            func.cast(Criterion.value2, BigInteger)
        ),
        Integer
    ) != 0  # Character has forbidden bits
)

query = query.filter(Item.id.not_in(expansion_forbidden))
```

### Cache Key Pattern
```typescript
// From indexed-db-weapon-cache.ts
function generateCacheKey(request: WeaponAnalyzeRequest): string {
  // Cache key now includes expansion to prevent pollution
  return `${level}_${breed}_${profession}_${side}_${expansion}_${skills}`;
}

// Example:
// Froob: "220_1_5_1_1_104:2500,105:2000,106:1800"
// Paid:  "220_1_5_1_127_104:2500,105:2000,106:1800"
// ↑ Same character, different cache entries based on expansion
```

## Configuration
- Default expansion: 127 (Paid) if AccountType not set on character profile
- Cache keys: Include expansion bitflag to prevent cache pollution between account types
- Backend validation: Expansion bitflag must be 0-511 (ge=0, le=511 in Pydantic schema)

## Usage Example
```typescript
// Frontend automatically builds expansion from character profile
const request: WeaponAnalyzeRequest = {
  level: 220,
  breed_id: 1,
  profession_id: 5,
  side: 1,
  expansion_bitflag: accountTypeToExpansionBitflag(
    activeProfile.value.Character.AccountType || 'Paid'
  ), // Returns 1 for Froob, 7 for Sloob, 127 for Paid
  top_weapon_skills: [
    { skill_id: 104, value: 2500 },
    { skill_id: 105, value: 2000 }
  ]
};

const weapons = await analyzeWeapons(request);
// Froob: Only NotumWars weapons returned
// Sloob: NotumWars + Shadowlands weapons returned
// Paid: All expansion weapons returned
```

## Design Pattern
Follows the same bitwise filtering pattern used for:
- Breed filtering (stat 75, operators 22/107)
- Profession filtering (stat 60, operators 22/107)
- Faction/side filtering (stat 33, operators 22/107)

All use the same two-subquery exclusion pattern:
1. First subquery excludes items requiring bits the character doesn't have (operator 22)
2. Second subquery excludes items forbidden for bits the character has (operator 107)

## Testing

### Manual Test
1. Start backend: `cd backend && source venv/bin/activate && export $(cat .env.local | xargs) && uvicorn app.main:app --reload`
2. Open TinkerFite at http://localhost:5173/tinkerfite
3. Load or create three test profiles with different AccountType values:
   - Profile 1: AccountType = "Froob"
   - Profile 2: AccountType = "Sloob"
   - Profile 3: AccountType = "Paid"
4. For each profile, apply identical weapon filters (same skills, same QL range)
5. Observe different weapon results based on expansion access
6. Check browser DevTools → Network → analyze request payload includes `expansion_bitflag`
7. Verify cache keys differ in IndexedDB → tinkertools-weapon-cache

### Expected Behavior
- Froob profile sees only NotumWars expansion weapons (expansion bitflag 1)
- Sloob profile sees weapons up to Shadowlands (expansion bitflags 1, 2, 4)
- Paid profile sees all expansion weapons (expansion bitflags 1-127)
- Same character with different AccountType values produces different weapon lists
- Cache entries remain separate (no cross-contamination between account types)
- Default to Paid (127) if AccountType missing from profile

### Verification Queries
```sql
-- Find weapons with expansion requirements (operator 22)
SELECT i.name, c.value2 AS required_expansion
FROM items i
JOIN actions a ON i.id = a.item_id
JOIN action_criteria ac ON a.id = ac.action_id
JOIN criterion c ON ac.criterion_id = c.id
WHERE a.action = 8 AND c.value1 = 389 AND c.operator = 22
LIMIT 10;

-- Find weapons with expansion restrictions (operator 107)
SELECT i.name, c.value2 AS forbidden_expansion
FROM items i
JOIN actions a ON i.id = a.item_id
JOIN action_criteria ac ON a.id = ac.action_id
JOIN criterion c ON ac.criterion_id = c.id
WHERE a.action = 8 AND c.value1 = 389 AND c.operator = 107
LIMIT 10;
```

## Related Documentation
- Expansion utils: `frontend/src/utils/expansion-utils.ts`
- Breed/profession filtering: Similar pattern in `weapon_filter_service.py`
- Cache implementation: `.docs/features/tinkerfite-performance-optimization.doc.md`
- API schema: `backend/app/api/schemas/weapon_analysis.py`
