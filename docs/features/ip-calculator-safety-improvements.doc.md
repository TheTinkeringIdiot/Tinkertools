# IP Calculator Safety Improvements

## Overview

This feature introduces comprehensive defensive error handling and validation to the TinkerProfiles IP (Improvement Points) calculation system. The improvements prevent runtime crashes, NaN propagation, and silent failures that can occur when processing corrupted profile data or invalid breed/profession IDs.

## Key Safety Enhancements

### 1. Defensive Validation in IP Calculations
- **Cost Factor Validation**: Added undefined/NaN checks before using breed/profession cost factors
- **Rate Data Validation**: Validates COST_TO_RATE table lookups to prevent array access errors
- **Early Returns**: Safe fallback values for invalid data instead of crashes
- **Console Warnings**: Diagnostic logging for invalid breed/profession/skill combinations

### 2. Breed/Profession Normalization
- **Fuzzy Matching**: Handles both string names and numeric IDs for breed/profession values
- **Case Insensitive**: Matches "Martial Artist", "martialartist", "martial-artist"
- **Default Fallbacks**: Safe defaults (Adventurer, Solitus) for unrecognized values
- **Migration Support**: Automatic normalization during profile import and loading

### 3. Profile Import Validation
- **Pre-Import Checks**: Validates breed/profession IDs before processing
- **Post-Import Validation**: Verifies imported profiles have valid data structures
- **Warning Collection**: Non-fatal issues logged as warnings for user review
- **Error Prevention**: Catches invalid data early to prevent cascading failures

### 4. Enhanced Type Safety
- **Explicit Type Checks**: `typeof` checks before numeric operations
- **NaN Prevention**: Validates numeric values before mathematical operations
- **Safe Defaults**: Conservative fallback values prevent undefined behavior
- **Range Validation**: Ensures cost indices are within valid array bounds

## Data Flow

### IP Calculation Safety Pipeline
1. **Input Validation**: Check breed/profession/skill IDs are valid numbers
2. **Cost Factor Lookup**: Validate cost factor exists and is numeric (not undefined/NaN)
3. **Index Calculation**: Compute cost index and validate range bounds
4. **Rate Data Access**: Verify COST_TO_RATE entry exists before access
5. **Safe Calculation**: Return calculated value or safe fallback
6. **Error Logging**: Log warnings for debugging without breaking execution

### Profile Import Safety Flow
1. **Pre-Processing**: Normalize breed/profession strings to numeric IDs
2. **Structure Validation**: Verify profile has required Character properties
3. **ID Validation**: Check breed/profession IDs are in valid ranges
4. **Skill Validation**: Verify trainable skills have valid cost factors
5. **Post-Processing**: Run full validation to catch any remaining issues
6. **Error Collection**: Gather all errors/warnings for user display

### Error Recovery Pattern
```typescript
// Before: Crashes on invalid data
const costFactor = skillCostFactors[profession];
const costIndex = Math.floor(costFactor * 10) - 10;
const rateData = COST_TO_RATE[costIndex]; // Array out of bounds!
const cap = rateData[2]; // Crash if undefined

// After: Safe fallback with logging
const costFactor = skillCostFactors[profession];
if (costFactor === undefined || isNaN(costFactor)) {
  console.warn(`Invalid profession ${profession} for skill ${skillId}`);
  return 0; // Safe fallback
}

const costIndex = Math.floor(costFactor * 10) - 10;
if (costIndex < 0 || costIndex >= COST_TO_RATE.length) {
  return 0; // Bounds check
}

const rateData = COST_TO_RATE[costIndex];
if (!rateData) {
  console.warn(`Invalid rateData at costIndex ${costIndex}`);
  return 0; // Null check
}

const cap = rateData[2]; // Safe access
```

## Implementation

### Key Files Modified

#### IP Calculator Core (32+ line changes)
- `frontend/src/lib/tinkerprofiles/ip-calculator.ts` - Added defensive checks to:
  - `calcIPAdjustableRange()` - Skill IP range calculation with cost factor validation
  - `calcAbilityIPAdjustableRange()` - Ability IP range calculation with breed validation
  - Added undefined/NaN checks before all COST_TO_RATE lookups
  - Added console warnings for invalid profession/breed/cost data

#### Game Utilities Enhancement (77+ line changes)
- `frontend/src/services/game-utils.ts` - Added normalization functions:
  - `normalizeProfessionToId()` - Fuzzy matching for profession names → IDs
  - `normalizeBreedToId()` - Fuzzy matching for breed names → IDs
  - Updated `getProfessionName()` and `getBreedName()` to return safe defaults
  - Handles both legacy string values and modern numeric IDs

#### Profile Import Hardening (133+ line changes)
- `frontend/src/lib/tinkerprofiles/transformer.ts` - Import safety improvements:
  - Normalize breed/profession during JSON imports
  - Normalize breed/profession during AOSetups imports
  - Skip non-trainable skills to preserve default values
  - Validate imported profiles before accepting them
  - Collect and report validation errors/warnings

#### Profile Loading Safety (30+ line changes)
- `frontend/src/lib/tinkerprofiles/storage.ts` - Added validation on load:
  - Validate profiles after loading from localStorage
  - Auto-normalize legacy string breed/profession values
  - Log validation warnings without blocking profile access
  - Graceful degradation for corrupted profiles

#### Profile Management (20+ line changes)
- `frontend/src/lib/tinkerprofiles/manager.ts` - Enhanced profile creation:
  - Validate new profiles before saving
  - Normalize breed/profession during profile updates
  - Prevent saving profiles with invalid core data

#### New Validation Module
- `frontend/src/lib/tinkerprofiles/validation.ts` - **NEW** Centralized validation:
  - `validateProfile()` - Comprehensive profile structure validation
  - Checks breed/profession ID ranges
  - Validates required Character properties
  - Returns errors and warnings separately

## User-Facing Changes

### Improved Reliability
- **No More Crashes**: Invalid breed/profession IDs no longer cause runtime errors
- **NaN Prevention**: Mathematical operations protected from NaN propagation
- **Better Error Messages**: Console warnings help diagnose data corruption issues
- **Graceful Degradation**: Invalid profiles load with safe defaults instead of failing

### Enhanced Import Experience
- **Fuzzy Matching**: Accepts "Martial Artist", "martialartist", "martial-artist" formats
- **Legacy Support**: Old profiles with string breed/profession values auto-upgrade
- **Validation Feedback**: Import errors/warnings clearly communicated to users
- **Data Preservation**: Non-trainable skills keep default values during import

### Transparent Migration
- **Automatic Normalization**: Legacy profiles automatically converted to numeric IDs
- **Backward Compatible**: No manual intervention required for existing profiles
- **Safe Defaults**: Unknown values fallback to Adventurer/Solitus
- **Logging**: Console warnings for debugging without breaking user experience

## Testing Considerations

### Critical Test Cases
1. **Invalid Profession ID**: Verify safe fallback when profession > 15
2. **Invalid Breed ID**: Verify safe fallback when breed > 7
3. **NaN Cost Factor**: Test behavior when cost factor is undefined/NaN
4. **Array Bounds**: Verify COST_TO_RATE access doesn't exceed array length
5. **String Migration**: Test automatic normalization of legacy string values
6. **Corrupted Profiles**: Verify graceful handling of malformed profile data

### Error Recovery Validation
- **Console Warnings**: Verify warnings are logged for invalid data
- **Fallback Values**: Confirm safe defaults are used (not undefined/NaN)
- **Calculation Continuity**: Other skills/abilities calculate correctly even if one fails
- **Profile Loading**: Profiles with partial corruption still load with safe defaults

### Import Edge Cases
- **Mixed Formats**: Import files with both string and numeric IDs
- **Unknown Values**: Import with unrecognized profession/breed names
- **Non-Trainable Skills**: Verify ACs and bonus-only stats keep defaults
- **Validation Errors**: Test that invalid imports are rejected with clear messages

## Prevented Error Scenarios

### Before Safety Improvements
```javascript
// CRASH: Undefined cost factor
const adjustableRange = calcIPAdjustableRange(220, 999, 102); // Invalid profession
// → costFactor is undefined
// → Math.floor(undefined * 10) = NaN
// → COST_TO_RATE[NaN] = undefined
// → undefined[2] = CRASH

// CRASH: NaN propagation
profile.Character.Profession = "InvalidString"; // Legacy import
const skillCap = calcSkillCap(level, "InvalidString", skillId, abilities);
// → calcSkillCost uses NaN
// → Returns NaN
// → Propagates through entire IP calculation
// → UI shows "NaN IP available"
```

### After Safety Improvements
```javascript
// SAFE: Returns 0 with warning
const adjustableRange = calcIPAdjustableRange(220, 999, 102);
// → Detects invalid profession
// → Logs: "[calcIPAdjustableRange] Invalid profession 999..."
// → Returns 0
// → Calculation continues safely

// SAFE: Auto-normalizes with fallback
profile.Character.Profession = "InvalidString";
// → normalizeProfessionToId("InvalidString") = 6 (Adventurer)
// → Logs: "[normalizeProfessionToId] Unknown profession..."
// → Uses safe default
// → Calculation succeeds with fallback values
```

## Performance Impact

### Minimal Overhead
- **Validation Cost**: Type checks and bounds checks are O(1) operations
- **Early Returns**: Invalid data detected early, avoiding expensive calculations
- **No Caching Impact**: Validation doesn't affect calculation caching strategies
- **Logging Overhead**: Console.warn only called for exceptional cases

### Improved Stability
- **Fewer Crashes**: Reduces need for page reloads due to unhandled errors
- **Better UX**: Users don't lose work when encountering corrupted data
- **Debugging Speed**: Console warnings help identify data issues quickly

## Dependencies

### Internal Dependencies
- `frontend/src/services/game-data.ts` - BREED_ABILITY_DATA, SKILL_COST_FACTORS
- `frontend/src/services/game-utils.ts` - Normalization functions
- `frontend/src/lib/tinkerprofiles/validation.ts` - Profile validation logic

### External Dependencies
- No new external dependencies required
- Uses standard JavaScript type checking (typeof, isNaN)
- Console API for diagnostic logging

## Migration Notes

### Automatic Migration
- **Profile Loading**: Legacy string values auto-normalized to IDs on load
- **Profile Import**: All import formats automatically normalized
- **No User Action**: Migration happens transparently during normal usage
- **Idempotent**: Safe to run multiple times, already-numeric IDs unchanged

### Backward Compatibility
- **Profile Format**: Existing v4.0.0 profiles continue to work
- **Storage Structure**: No changes to localStorage schema
- **API Compatibility**: All existing IP calculation functions maintain same signatures
- **Component Integration**: No changes required to consuming components

## Summary

The IP Calculator Safety Improvements introduce comprehensive defensive programming to prevent runtime crashes, NaN propagation, and silent failures in the TinkerProfiles IP calculation system. The enhancements focus on validation at critical points: cost factor lookups, array access, and profile imports.

Key benefits include:
- **Crash Prevention**: Undefined/NaN checks prevent JavaScript errors from invalid data
- **Data Normalization**: Fuzzy matching handles legacy string values and typos
- **Graceful Degradation**: Safe defaults allow partial functionality instead of complete failure
- **Better Debugging**: Console warnings help identify data corruption issues
- **Transparent Migration**: Legacy profiles automatically upgraded without user intervention

The improvements maintain full backward compatibility while significantly improving system robustness. Users with corrupted profiles or importing data from external sources will experience fewer errors and clearer feedback when issues occur. The defensive checks add minimal overhead while preventing catastrophic failures in production use.
