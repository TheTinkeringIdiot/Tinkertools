# Profile Import Validation System

## Overview

The Profile Import Validation system ensures data integrity at import boundaries by validating all imported TinkerProfile data before it enters the application state. This validation layer catches corrupt imports, invalid character IDs, malformed skill data, and version incompatibilities early in the import process, preventing invalid data from propagating throughout the application.

## Key Components

### Validation Module (`frontend/src/lib/tinkerprofiles/validation.ts`)

The validation module provides lightweight, focused validation functions that check critical profile fields without requiring heavy dependencies. This module is designed to be imported dynamically to avoid circular dependencies.

#### Core Validation Functions

**`validateProfile(profile: TinkerProfile): ValidationResult`**
- Main validation entry point that runs all critical checks
- Validates character data structure, IDs, level, skills, and version
- Returns structured result with `valid` flag, `errors` array, and `warnings` array
- Errors indicate critical issues that prevent import; warnings are informational

**`validateCharacterIds(profile: TinkerProfile): ValidationResult`**
- Validates profession and breed IDs are numeric and within valid ranges
- Profession ID: must be 1-15 (warns for ID 13 "Monster")
- Breed ID: must be 0-7 (warns for IDs outside 1-4 player breeds)
- Ensures type safety - rejects non-numeric values

**Helper Functions:**
- `isValidProfessionId(id: number): boolean` - Quick profession ID check
- `isValidBreedId(id: number): boolean` - Quick breed ID check
- `safeProfessionName(id: number): string` - Get profession name with fallback
- `safeBreedName(id: number): string` - Get breed name with fallback

#### Validation Rules

```typescript
// Profession validation
- Type: number (rejects strings)
- Range: 1-15
- Warning: ID 13 (Monster profession is unusual)

// Breed validation
- Type: number (rejects strings)
- Range: 0-7
- Warning: IDs 0, 5-7 (outside normal player breeds 1-4)

// Level validation
- Type: number
- Range: 1-220

// Skills validation
- Structure: must be object
- Presence: must exist

// Version validation
- Expected: "4.0.0"
- Warning: other versions may not be fully compatible
```

### Transformer Integration (`frontend/src/lib/tinkerprofiles/transformer.ts`)

The transformer module integrates validation at two critical import boundaries:

#### JSON Import Validation (Line 170-180)

```typescript
// After normalization but before returning
const { validateProfile: validateProfileIds } = await import('./validation');
const validation = validateProfileIds(importedProfile);
if (!validation.valid) {
  result.errors.push(...validation.errors);
  throw new Error(`JSON import validation failed: ${validation.errors.join(', ')}`);
}
if (validation.warnings.length > 0) {
  result.warnings.push(...validation.warnings);
}
```

**Import Flow:**
1. Parse JSON data
2. Normalize profession/breed to numeric IDs
3. **Validate profile** (new step)
4. Migrate perk system
5. Return imported profile

#### AOSetups Import Validation (Line 326-336)

```typescript
// After equipment mapping and before returning
const { validateProfile: validateProfileIds } = await import('./validation');
const validation = validateProfileIds(profile);
if (!validation.valid) {
  result.errors.push(...validation.errors);
  throw new Error(`AOSetups import validation failed: ${validation.errors.join(', ')}`);
}
if (validation.warnings.length > 0) {
  result.warnings.push(...validation.warnings);
}
```

**Import Flow:**
1. Parse AOSetups JSON
2. Map character data and normalize IDs
3. Normalize skill names to numeric IDs
4. Map equipment (implants, weapons, clothing)
5. Map perks with backend API lookup
6. **Validate profile** (new step)
7. Migrate perk system
8. Return imported profile

### Manager Integration (`frontend/src/lib/tinkerprofiles/manager.ts`)

The profile manager uses validation when creating new profiles:

#### Profile Creation Validation (Line 180-190)

```typescript
// After IP tracking update
const { validateProfile } = await import('./validation');
const validation = validateProfile(profile);
if (!validation.valid) {
  console.error('[ProfileManager] Profile validation failed:', validation.errors);
  throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
}
if (validation.warnings.length > 0) {
  console.warn('[ProfileManager] Profile validation warnings:', validation.warnings);
}
```

This ensures even programmatically created profiles pass validation before being saved to storage.

## Data Flow

### Import Validation Flow

```
User Action (Import File)
         ↓
ProfileTransformer.importProfile()
         ↓
Format Detection (JSON/AOSetups/Legacy)
         ↓
Format-Specific Import
  - importFromJSON() OR
  - importFromAOSetups()
         ↓
Data Normalization
  - Convert strings to numeric IDs
  - Map equipment/perks
  - Structure skill data
         ↓
🔒 VALIDATION CHECKPOINT 🔒
  - validateProfile()
    ✓ Character IDs valid?
    ✓ Skills structure correct?
    ✓ Level in range?
    ✓ Version compatible?
         ↓
  [FAIL] → Collect errors
         → Throw Error (import fails)
         → User sees error message
         ↓
  [PASS] → Collect warnings
         → Continue import
         ↓
Perk Migration
         ↓
Return ProfileImportResult
  - success: true/false
  - errors: string[]
  - warnings: string[]
  - profile?: TinkerProfile
         ↓
ProfileManager.saveProfile()
         ↓
User sees success/failure notification
```

### Validation Error Propagation

```typescript
// Errors prevent import
{
  success: false,
  errors: [
    "Invalid profession ID: 99. Must be between 1-15.",
    "Invalid breed ID: 20. Must be between 0-7.",
    "Invalid level: 500. Must be between 1-220."
  ],
  warnings: [],
  profile: undefined  // No profile returned on error
}

// Warnings allow import but inform user
{
  success: true,
  errors: [],
  warnings: [
    "Breed ID 5 is unusual (valid player breeds: 1-4)",
    "Profile imported from AOSetups format"
  ],
  profile: { /* validated profile */ }
}
```

## User-Facing Benefits

### Early Failure Detection
- Invalid profession/breed IDs caught before import completes
- Prevents corrupt data from entering application state
- User sees clear error messages explaining what went wrong

### Data Integrity Guarantees
- All profiles in storage have valid profession/breed IDs
- Skills data structure is consistent
- Level values are within game limits
- Version compatibility is enforced

### Troubleshooting Support
- Detailed error messages explain validation failures
- Warnings provide context for unusual but valid data
- Safe fallback names for display when IDs are invalid

### Format Compatibility
- AOSetups imports validated after skill name resolution
- JSON imports validated after ID normalization
- Legacy format detection rejects unsupported versions

## Technical Implementation Details

### Dynamic Import Pattern

Validation module uses dynamic imports to avoid circular dependencies:

```typescript
// Instead of static import at top of file
const { validateProfile } = await import('./validation');

// Why: Prevents circular dependency chains
// transformer.ts → validation.ts → types.ts → transformer.ts
```

### Validation Result Interface

```typescript
export interface ValidationResult {
  valid: boolean;      // true if no errors
  errors: string[];    // blocking issues
  warnings: string[];  // informational notices
}
```

### ID Normalization Before Validation

```typescript
// Transformer normalizes IDs before validation
importedProfile.Character.Profession = normalizeProfessionToId(
  importedProfile.Character.Profession
);
importedProfile.Character.Breed = normalizeBreedToId(
  importedProfile.Character.Breed
);

// Then validation ensures IDs are in valid ranges
const validation = validateProfile(importedProfile);
```

This two-step process handles both legacy string IDs and ensures numeric IDs are valid.

## Files Involved

### Primary Implementation
- `/frontend/src/lib/tinkerprofiles/validation.ts` - Core validation logic (128 lines)
- `/frontend/src/lib/tinkerprofiles/transformer.ts` - Integration at import boundaries (lines 170-180, 326-336)
- `/frontend/src/lib/tinkerprofiles/manager.ts` - Profile creation validation (lines 180-190)

### Supporting Files
- `/frontend/src/services/game-utils.ts` - ID normalization functions
- `/frontend/src/lib/tinkerprofiles/types.ts` - ValidationResult interface
- `/frontend/src/services/game-data.ts` - PROFESSION/BREED ID constants

## Testing Considerations

### Test Cases Covered

**Valid Data:**
- ✅ Profile with valid profession ID (1-15)
- ✅ Profile with valid breed ID (1-4)
- ✅ Profile with valid level (1-220)
- ✅ Profile with correct skills structure
- ✅ Profile with version "4.0.0"

**Invalid Data (should fail):**
- ❌ Profession ID out of range (0, 16+)
- ❌ Breed ID out of range (-1, 8+)
- ❌ Level out of range (0, 221+)
- ❌ Missing skills object
- ❌ Non-numeric profession/breed IDs

**Edge Cases (should warn):**
- ⚠️ Profession ID 13 (Monster)
- ⚠️ Breed ID 0, 5-7 (non-player breeds)
- ⚠️ Version other than "4.0.0"

### Import Format Testing
- JSON v4.0.0 format with valid IDs
- JSON v4.0.0 format with legacy string IDs
- AOSetups format with skill name resolution
- Legacy format rejection (v3.0.0 and earlier)

## Future Enhancements

### Planned Improvements
1. **Skill Value Range Validation**: Validate skill values are within reasonable ranges
2. **Equipment Reference Validation**: Ensure referenced items exist in database
3. **Perk Compatibility Validation**: Verify perks are valid for profession/breed
4. **IP Budget Validation**: Check total IP spent doesn't exceed available
5. **Cross-Field Validation**: Validate relationships between fields (e.g., alien level vs character level)

### Extension Points
- Add custom validation rules via config
- Support for validation plugins
- Batch validation for multiple profiles
- Validation report generation

## Related Documentation

- **TinkerProfiles v4.0.0 Architecture** (`docs/features/tinkerprofiles-v4-architecture.doc.md`)
- **Profile Migration System** (`docs/features/tinkerprofile-v4-migration.doc.md`)
- **Perk Validation and Import** (`docs/features/perk-validation-import-system.doc.md`)
- **Skill System Improvements** (`docs/features/skill-system-improvements.doc.md`)

## Summary

The Profile Import Validation system provides a critical safety layer at import boundaries, ensuring all profiles entering the TinkerTools application meet data integrity requirements. By validating character IDs, skill structure, levels, and version compatibility early in the import process, the system prevents corrupt data from propagating and provides clear error messages to users when imports fail. This validation integrates seamlessly into both JSON and AOSetups import flows, maintaining data quality without impacting the user experience for valid imports.
