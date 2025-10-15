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

## Known Issues

### MaxNCU Calculation in Tests

The tests currently have an issue with MaxNCU calculation. The IP integrator recalculates skill values (including MaxNCU, skill ID 181) based on the profile's level, abilities, and other factors.

**Current Behavior:**
- Test profiles are created with a specified MaxNCU value
- The IP integrator runs during `setActiveProfile()` and recalculates MaxNCU to 0
- This causes tests that depend on a specific MaxNCU value to fail

**Workaround Options:**
1. Set up complete ability/skill structures that result in desired MaxNCU after IP calculation
2. Mock the IP integrator during tests (not recommended for integration tests)
3. Test with dynamically calculated MaxNCU values (current approach)
4. Add a test-only bypass for IP recalculation

**Current Implementation:**
Tests use `const actualMaxNCU = store.maxNCU` to get the calculated value and test relative to that, rather than assuming a specific value.

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
- MaxNCU calculated by IP integrator
- Empty buff list initially
- No equipment or perks

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
5. Resolve MaxNCU calculation issue for more precise testing
6. Add component-level tests for BuffTable.vue

## Related Files

- `/frontend/src/stores/tinkerProfiles.ts` - Buff management implementation
- `/frontend/src/components/profiles/buffs/BuffTable.vue` - Buff UI component
- `/frontend/src/views/TinkerProfileDetail.vue` - Profile detail view with buffs
- `/frontend/src/__tests__/helpers/integration-test-utils.ts` - Test utilities
