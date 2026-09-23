# Buff Management Integration Tests

## Overview

Comprehensive integration tests for buff management functionality covering NCU tracking, NanoStrain conflict resolution, and buff stacking behaviors.

## Test Coverage

### Test Scenarios Implemented

1. **Casting Buffs**

   - ✅ Single buff casting and NCU tracking
   - ✅ Multiple buff accumulation
   - ✅ NCU overflow prevention
   - ✅ `canCastBuff` validation

2. **NanoStrain Conflicts**

   - ✅ Higher priority buff replacement
   - ✅ Lower priority buff rejection
   - ✅ Multiple buffs with different strains
   - ✅ Conflict detection

3. **Buff Removal**

   - ✅ Single buff removal
   - ✅ Remove all buffs
   - ✅ Graceful handling of non-existent buffs
   - ✅ Empty buff list handling

4. **Profile Switching**

   - ✅ Buff isolation between profiles
   - ✅ No buff leakage
   - ✅ Per-profile NCU calculations

5. **Edge Cases**
   - ✅ Missing NCU stat handling
   - ✅ Missing strain stat handling
   - ✅ Equal stacking priority
   - ✅ LocalStorage persistence

## MaxNCU in Tests

MaxNCU (skill ID 181) has no base value in Anarchy Online: the IP integrator
computes it purely from equipment, perk and buff bonuses. Each test character
therefore wears an NCU memory (a `Weapons.NCU1` item whose Wear effect is
spell 53045, "Modify MaxNCU") that sets its capacity exactly, e.g. 2400 for the
default character. Tests that need a smaller capacity swap the memory for a
smaller one (`equipNcuMemory(1200)`).

## Running the Tests

```bash
# Run all buff management tests
npm test -- buff-management.integration.test.ts

# Run specific test
npm test -- buff-management.integration.test.ts -t "should cast a buff"

# Run with verbose output
npm test -- buff-management.integration.test.ts --reporter=verbose
```

## Test Data

### Buff Fixtures

Tests use the following buff items:

- `buffLowNCU` - 25 NCU cost, strain 1000, priority 100
- `buffMediumNCU` - 30 NCU cost, strain 2000, priority 120
- `buffHighNCU` - 1100 NCU cost (won't fit in most profiles)
- `buffSameStrainHighPriority` - Same strain as buffLowNCU, higher priority
- `buffSameStrainLowPriority` - Same strain as buffLowNCU, lower priority

### Profile Setup

Test profiles are created with:

- Level 200 Adventurer (Solitus)
- A 2400 NCU memory in the NCU1 slot (its only MaxNCU source)
- Empty buff list initially
- No other equipment or perks

## Architecture Notes

### Real Integration Testing

These tests use:

- ✅ Real Pinia store (`useTinkerProfilesStore`)
- ✅ Real TinkerProfilesManager
- ✅ Real IP calculation (updateProfileWithIPTracking)
- ✅ Real localStorage (mocked implementation)
- ❌ Mocked API calls (not needed for buff management)
- ❌ Mocked PrimeVue Toast (for notifications)

### Store Methods Tested

- `castBuff(item)` - Cast a buff nano
- `removeBuff(itemId)` - Remove specific buff
- `removeAllBuffs()` - Clear all buffs
- `canCastBuff(item)` - Check if buff can be cast
- `getBuffConflicts(item)` - Find conflicting buffs
- `currentNCU` (computed) - Total NCU used by active buffs
- `maxNCU` (computed) - Maximum NCU capacity
- `availableNCU` (computed) - NCU available for new buffs

## Future Improvements

1. Add tests for buff effects on skills/stats
2. Test buff duration/expiration (if implemented)
3. Test buff icons and tooltips
4. Test buff sorting/filtering in UI
5. Add component-level tests for BuffTable.vue

## Related Files

- `/frontend/src/stores/tinkerProfiles.ts` - Buff management implementation
- `/frontend/src/components/profiles/buffs/BuffTable.vue` - Buff UI component
- `/frontend/src/views/TinkerProfileDetail.vue` - Profile detail view with buffs
- `/frontend/src/__tests__/helpers/integration-test-utils.ts` - Test utilities
