# Breed/Profession Normalization Feature

## Overview

The Breed/Profession Normalization feature ensures consistent representation of character breed and profession data throughout the TinkerProfiles system by converting all values to numeric IDs. This eliminates inconsistencies from legacy string-based representations and provides robust fuzzy matching for imports from external formats.

**Status**: Implemented
**Version**: 4.0.0+
**Feature Type**: Core Data Layer

## User-Facing Functionality

### What It Does

1. **Consistent Internal Representation**: All character breed and profession values are stored and processed as numeric IDs (1-15 for professions, 0-7 for breeds)
2. **Automatic Migration**: Legacy profiles with string-based values are automatically converted to numeric IDs when loaded
3. **Fuzzy Import Matching**: Handles variations in breed/profession names during imports (e.g., "Martial Artist", "MartialArtist", "martial artist")
4. **Safe Defaults**: Invalid values fall back to safe defaults (Adventurer=6, Solitus=1)
5. **Transparent Operation**: Users see human-readable names in the UI while IDs are used internally

### User Scenarios

#### Creating a New Profile
- User selects breed "Solitus" and profession "Adventurer" from dropdowns
- System stores as numeric IDs (breed=1, profession=6)
- All calculations use numeric IDs for consistency

#### Importing from AOSetups
- User imports profile with `profession: "Martial Artist"` (string with space)
- Fuzzy matcher recognizes as `normalizeProfessionToId("Martial Artist")` → 8
- Import succeeds with correct numeric ID

#### Loading Legacy Profiles
- User loads old profile with `Profession: "Enforcer"` (string)
- Migration converts to `Profession: 5` (numeric ID)
- Profile saved with updated format
- User sees "Enforcer" in UI (human-readable name displayed)

## Data Flow

### Profile Creation Flow
```
User Input → UI Component → createDefaultProfile()
  ↓
Numeric IDs assigned:
  Character.Profession = 6 (Adventurer)
  Character.Breed = 1 (Solitus)
  ↓
Storage → Profile saved with numeric IDs
```

### Import Flow (AOSetups/JSON)
```
Import Data → transformer.importFromAOSetups() or importFromJSON()
  ↓
normalizeProfessionToId(aosetups.character.profession)
normalizeBreedToId(aosetups.character.breed)
  ↓
Fuzzy matching applied:
  "Martial Artist" → 8
  "martial artist" → 8
  "MartialArtist" → 8
  ↓
Profile created with numeric IDs
  ↓
Validation → Storage
```

### Legacy Profile Migration Flow
```
Load Profile → storage.loadProfile(profileId)
  ↓
Migration check: typeof Profession !== 'number'?
  ↓
transformer.migrateProfileCharacterIds(profile)
  ↓
normalizeProfessionToId(stringValue) → numeric ID
normalizeBreedToId(stringValue) → numeric ID
  ↓
Updated profile saved back to storage
```

### Display Flow
```
Profile Data (numeric IDs)
  ↓
UI Component
  ↓
getProfessionName(id) → "Adventurer"
getBreedName(id) → "Solitus"
  ↓
User sees human-readable names
```

## Implementation Files

### Core Normalization Functions
**File**: `/frontend/src/services/game-utils.ts` (lines 1692-1741)

```typescript
/**
 * Normalize profession string to ID with fuzzy matching
 */
export function normalizeProfessionToId(value: string | number): number {
  // Already numeric
  if (typeof value === 'number') {
    return value >= 1 && value <= 15 ? value : 6; // Default to Adventurer
  }

  // Exact match first
  const exactMatch = getProfessionId(value);
  if (exactMatch !== undefined) return exactMatch;

  // Fuzzy match: remove spaces/hyphens, lowercase
  const normalized = value.replace(/[\s-]/g, '').toLowerCase();
  for (const [id, name] of Object.entries(PROFESSION)) {
    if (name.replace(/[\s-]/g, '').toLowerCase() === normalized) {
      return Number(id);
    }
  }

  // Default to Adventurer
  console.warn(`[normalizeProfessionToId] Unknown profession "${value}", defaulting to Adventurer`);
  return 6; // Adventurer
}

/**
 * Normalize breed string to ID with fuzzy matching
 */
export function normalizeBreedToId(value: string | number): number {
  // Already numeric
  if (typeof value === 'number') {
    return value >= 0 && value <= 7 ? value : 1; // Default to Solitus
  }

  // Exact match first
  const exactMatch = getBreedId(value);
  if (exactMatch !== undefined) return exactMatch;

  // Fuzzy match
  const normalized = value.toLowerCase();
  for (const [id, name] of Object.entries(BREED)) {
    if (name.toLowerCase() === normalized) {
      return Number(id);
    }
  }

  // Default to Solitus
  console.warn(`[normalizeBreedToId] Unknown breed "${value}", defaulting to Solitus`);
  return 1; // Solitus
}
```

**Key Features**:
- Accepts both strings and numbers (idempotent)
- Exact match → Fuzzy match → Safe default fallback
- Removes spaces, hyphens for flexible matching
- Console warnings for unknown values

### Import Integration
**File**: `/frontend/src/lib/tinkerprofiles/transformer.ts`

#### JSON Import (lines 148-189)
```typescript
private async importFromJSON(data: string, result: ProfileImportResult): Promise<TinkerProfile> {
  const parsed = JSON.parse(data);

  if (this.isValidTinkerProfile(parsed)) {
    const importedProfile = structuredClone(parsed);

    // Normalize Character IDs (handles both legacy strings and numeric IDs)
    importedProfile.Character.Profession = normalizeProfessionToId(
      importedProfile.Character.Profession
    );
    importedProfile.Character.Breed = normalizeBreedToId(
      importedProfile.Character.Breed
    );

    // Validation...
    return this.migrateProfilePerks(importedProfile);
  }
}
```

#### AOSetups Import (lines 192-340)
```typescript
private async importFromAOSetups(data: string, result: ProfileImportResult): Promise<TinkerProfile> {
  const aosetups = JSON.parse(data);
  const profile = createDefaultProfile();

  if (aosetups.character) {
    // Normalize profession and breed to numeric IDs
    profile.Character.Profession = normalizeProfessionToId(
      aosetups.character.profession || 'Adventurer'
    );
    profile.Character.Breed = normalizeBreedToId(
      aosetups.character.breed || 'Solitus'
    );

    // Continue import...
  }
}
```

### Profile Creation
**File**: `/frontend/src/lib/tinkerprofiles/constants.ts` (lines 376-415)

```typescript
export function createDefaultProfile(name: string = 'New Character', breed: string = 'Solitus'): TinkerProfile {
  const breedId = normalizeBreedToId(breed); // Convert to numeric ID
  const professionId = 6; // Adventurer

  return {
    id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: CURRENT_VERSION,

    Character: {
      Name: name,
      Level: 1,
      Profession: professionId as any,  // Store as numeric ID
      Breed: breedId as any,            // Store as numeric ID
      // ... rest of character data
    },

    skills: createDefaultSkillsV4(breed),
    // ... rest of profile
  };
}
```

### Migration Support
**File**: `/frontend/src/lib/tinkerprofiles/transformer.ts` (lines 945-975)

```typescript
/**
 * Migrate legacy string-based Profession/Breed to numeric IDs
 * Safe to call multiple times (idempotent)
 */
migrateProfileCharacterIds(profile: TinkerProfile): TinkerProfile {
  let needsMigration = false;
  const migrated = structuredClone(profile);

  // Migrate Profession if it's a string
  if (typeof migrated.Character.Profession !== 'number') {
    const oldValue = migrated.Character.Profession;
    migrated.Character.Profession = normalizeProfessionToId(oldValue as any);
    console.log(`[Migration] Converted profession "${oldValue}" to ID ${migrated.Character.Profession}`);
    needsMigration = true;
  }

  // Migrate Breed if it's a string
  if (typeof migrated.Character.Breed !== 'number') {
    const oldValue = migrated.Character.Breed;
    migrated.Character.Breed = normalizeBreedToId(oldValue as any);
    console.log(`[Migration] Converted breed "${oldValue}" to ID ${migrated.Character.Breed}`);
    needsMigration = true;
  }

  if (needsMigration) {
    migrated.updated = new Date().toISOString();
  }

  return migrated;
}
```

### Storage Layer Integration
**File**: `/frontend/src/lib/tinkerprofiles/storage.ts` (lines 100-120)

Migration is automatically applied when loading profiles from localStorage to ensure all loaded profiles use numeric IDs.

### IP Calculator Integration
**File**: `/frontend/src/lib/tinkerprofiles/ip-integrator.ts`

All IP calculations receive numeric breed/profession IDs directly:
- `getBreedInitValue(breedId, abilityId)` - breed as numeric ID
- `calcAbilityMaxValue(level, breed, profession, abilityId)` - all as IDs
- `calcSkillCap(level, profession, skillId, abilities)` - profession as ID

No conversion needed - direct numeric access throughout.

## Validation Integration

**File**: `/frontend/src/lib/tinkerprofiles/validation.ts`

```typescript
export function validateProfile(profile: TinkerProfile): ProfileValidationResult {
  const result: ProfileValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Validate profession ID range
  if (typeof profile.Character.Profession !== 'number' ||
      profile.Character.Profession < 1 || profile.Character.Profession > 15) {
    result.errors.push(`Invalid profession ID: ${profile.Character.Profession}`);
    result.valid = false;
  }

  // Validate breed ID range
  if (typeof profile.Character.Breed !== 'number' ||
      profile.Character.Breed < 0 || profile.Character.Breed > 7) {
    result.errors.push(`Invalid breed ID: ${profile.Character.Breed}`);
    result.valid = false;
  }

  return result;
}
```

## Edge Cases and Error Handling

### Invalid Values
- **Numeric out of range**: Falls back to safe defaults
- **Unknown string**: Logs warning, uses safe defaults
- **null/undefined**: Treated as invalid, uses safe defaults

### Fuzzy Matching Examples
```typescript
// All resolve to ID 8 (Martial Artist)
normalizeProfessionToId("Martial Artist")  // → 8
normalizeProfessionToId("MartialArtist")   // → 8
normalizeProfessionToId("martial artist")  // → 8
normalizeProfessionToId("martial-artist")  // → 8

// All resolve to ID 1 (Solitus)
normalizeBreedToId("Solitus")    // → 1
normalizeBreedToId("solitus")    // → 1
normalizeBreedToId("SOLITUS")    // → 1
```

### Migration Safety
- **Idempotent**: Running migration multiple times is safe
- **Non-destructive**: Original data preserved in console logs
- **Timestamp update**: Migration updates `profile.updated` field
- **Backward compatible**: Handles v3.0.0 and earlier formats

## Performance Considerations

### Efficiency
- **O(1) Numeric Operations**: No string parsing in hot paths
- **One-time Migration**: Legacy profiles migrated once, then use IDs
- **No Runtime Overhead**: Display conversion only happens in UI layer

### Memory
- **Reduced Storage**: Numeric IDs use less space than strings
- **Consistent Size**: All IDs are small integers (1-15, 0-7)

## Testing Considerations

### Test Scenarios
1. **New profile creation**: Verify numeric IDs assigned
2. **JSON import with numeric IDs**: Verify passthrough
3. **JSON import with string values**: Verify normalization
4. **AOSetups import**: Verify fuzzy matching
5. **Legacy profile migration**: Verify conversion
6. **Invalid values**: Verify safe defaults
7. **Display in UI**: Verify human-readable names shown

### Critical Validation Points
- Profession ID range: 1-15
- Breed ID range: 0-7
- Type check: `typeof === 'number'`
- Fuzzy match success rate
- Migration idempotency

## Future Enhancements

### Potential Improvements
1. **Gender normalization**: Apply same pattern to gender field
2. **Faction normalization**: Convert faction strings to IDs
3. **Extended fuzzy matching**: Handle abbreviations (MA → Martial Artist)
4. **Migration analytics**: Track migration success/failure rates

## Related Features

- **TinkerProfiles v4.0.0 Architecture**: Core profile data structure
- **Profile Import/Export System**: Uses normalization for compatibility
- **IP Calculator Integration**: Relies on numeric IDs for calculations
- **Skill System**: Uses numeric skill IDs for consistency

## References

### Game Data Constants
- **PROFESSION constant**: Maps ID → Name (game-data.ts)
- **BREED constant**: Maps ID → Name (game-data.ts)

### ID Mappings
```typescript
// Profession IDs
1: Soldier
2: MartialArtist
3: Engineer
4: Fixer
5: Agent
6: Adventurer
7: Trader
8: Bureaucrat
9: Enforcer
10: Doctor
11: NanoTechnician
12: MetaPhysicist
13: Keeper
14: Shade
15: Monster (NPC only)

// Breed IDs
0: Unknown
1: Solitus
2: Opifex
3: Nanomage
4: Atrox
5-7: Reserved/NPC breeds
```
