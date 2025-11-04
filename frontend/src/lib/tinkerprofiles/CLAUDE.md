# TinkerProfiles Storage Layer - Claude Code Guidelines

This document provides specific guidance for Claude Code when working with the TinkerProfiles storage layer, which underwent a major architectural change in September 2025.

## Architecture Overview

### Individual Profile Storage Pattern

**Current Implementation**: Each profile is stored in its own localStorage key with a centralized index.

```typescript
// Storage structure
tinkertools_profile_index: ["profile1", "profile2", "profile3"]
tinkertools_profile_profile1: { TinkerProfile object }
tinkertools_profile_profile2: { TinkerProfile object }
tinkertools_profile_profile3: { TinkerProfile object }
```

### Key Classes and Files

- **`storage.ts`**: Core storage implementation (`ProfileStorage` class)
- **`constants.ts`**: Storage key definitions and configuration
- **`types.ts`**: TypeScript interfaces for storage operations
- **`manager.ts`**: Higher-level profile management logic

## Performance Characteristics

### O(1) Operations (Optimized)

- `saveProfile(profile)`: Save individual profile
- `loadProfile(profileId)`: Load specific profile
- `deleteProfile(profileId)`: Remove specific profile

### O(n) Operations (When Necessary)

- `loadAllProfiles()`: Load all profiles (iterates through index)
- `getProfileMetadata()`: Generate metadata for all profiles
- `clearAllData()`: Remove all profiles and index

## Storage Key Patterns

### Current Keys (v1.2.0+)

```typescript
STORAGE_KEYS = {
  PROFILE_INDEX: 'tinkertools_profile_index', // Array of profile IDs
  PROFILE_PREFIX: 'tinkertools_profile_', // Prefix for individual profiles
  PROFILES: 'tinkertools_profiles', // LEGACY - migration only
  ACTIVE_PROFILE: 'tinkertools_active_profile',
  PROFILE_METADATA: 'tinkertools_profile_metadata',
  PROFILE_PREFERENCES: 'tinkertools_profile_preferences',
  VERSION: 'tinkertools_version',
};
```

### Profile Key Construction

```typescript
const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profileId}`;
// Results in: "tinkertools_profile_12345-abcd-6789-efgh"
```

## Critical Implementation Details

### Index Management

The profile index is the source of truth for which profiles exist:

```typescript
// Always update index when modifying profiles
await this.updateProfileIndex(profileId, 'add'); // When saving new
await this.updateProfileIndex(profileId, 'remove'); // When deleting
```

### Migration System

- **Automatic**: Runs on ProfileStorage initialization
- **One-time**: Only migrates if legacy data exists
- **Safe**: Preserves legacy data until migration succeeds
- **Transparent**: No user intervention required

```typescript
// Migration is triggered in constructor
constructor(options: ProfileStorageOptions = {}) {
  // ... other setup
  this.migrateFromLegacyStorage(); // Handles legacy → individual migration
}
```

## Working with Storage

### Adding New Storage Features

1. **For Individual Profile Data**: Store in the profile object itself
2. **For Profile-Independent Data**: Add new storage key to `STORAGE_KEYS`
3. **For Cross-Profile Features**: Use the index to iterate efficiently

### Common Patterns

#### Loading Profile for Display

```typescript
const profile = await storage.loadProfile(profileId);
if (profile) {
  // Use profile data
}
```

#### Bulk Operations (Avoid When Possible)

```typescript
// Efficient: Use index and load selectively
const index = await storage.getProfileIndex();
const metadata = [];
for (const profileId of index) {
  const profile = await storage.loadProfile(profileId);
  if (profile) {
    metadata.push(generateMetadata(profile));
  }
}

// Inefficient: Loading all profiles unnecessarily
const allProfiles = await storage.loadAllProfiles(); // Only use when all are needed
```

#### Safe Profile Updates

```typescript
// Load → Modify → Save pattern
const profile = await storage.loadProfile(profileId);
if (profile) {
  profile.Character.Level = newLevel;
  profile.updated = Date.now();
  await storage.saveProfile(profile); // O(1) operation
}
```

## Error Handling Patterns

### Storage Operation Failures

```typescript
try {
  await storage.saveProfile(profile);
} catch (error) {
  // Profile save failed - handle gracefully
  console.error('Failed to save profile:', error);
  // Show user error message
  // Don't update UI state until save confirms
}
```

### Migration Failures

```typescript
// Migration failures are logged but don't throw
// App continues with empty profile state
// Check logs for "[ProfileStorage] Migration failed:"
```

### Index Corruption Recovery

```typescript
// If index is corrupted, storage operations fail gracefully
// Manual recovery: scan localStorage for profile keys
const profileKeys = Object.keys(localStorage).filter((key) =>
  key.startsWith(STORAGE_KEYS.PROFILE_PREFIX)
);
```

## Performance Optimization Guidelines

### Do's ✅

- Load only the profiles you need
- Use `loadProfile(id)` for single profile access
- Update profiles individually with `saveProfile()`
- Leverage the index for efficient enumeration

### Don'ts ❌

- Don't use `loadAllProfiles()` unless you actually need all profiles
- Don't modify profiles without saving them back
- Don't bypass the index when managing profiles
- Don't store large data outside the profile structure

## Debugging and Troubleshooting

### Chrome DevTools Inspection

```javascript
// View profile index
JSON.parse(localStorage.getItem('tinkertools_profile_index'));

// View specific profile
JSON.parse(localStorage.getItem('tinkertools_profile_12345-abcd-6789-efgh'));

// Count all profile-related keys
Object.keys(localStorage).filter((key) => key.startsWith('tinkertools_profile_')).length;
```

### Common Issues

#### "Profile not found" after migration

- Check if migration completed successfully
- Look for `[ProfileStorage] Migration failed:` in console
- Verify legacy data exists in `tinkertools_profiles` key

#### Performance degradation

- Ensure using individual profile operations, not bulk operations
- Check if accidentally calling `loadAllProfiles()` frequently
- Monitor localStorage operation timing in DevTools

#### Index out of sync

- Profile exists but not in index: Add to index manually
- Profile in index but doesn't exist: Remove from index
- Use `clearAllData()` for complete reset in development

## Future Development Considerations

### Planned Improvements

- **Lazy loading**: Defer profile parsing until needed
- **Compression per profile**: Individual compression strategies
- **Partial updates**: Update only changed profile sections
- **Background sync**: Non-blocking save operations

### Breaking Changes in v2.0

- Remove deprecated `saveAllProfiles()` method
- Clean up legacy storage keys
- Optimize index structure for large profile counts

### Extension Points

- Custom serialization strategies per profile type
- Plugin system for profile data transformations
- Configurable storage backends (IndexedDB, etc.)

## Testing Considerations

### Performance Tests

```typescript
// Measure save time (should be <50ms)
const start = performance.now();
await storage.saveProfile(profile);
const saveTime = performance.now() - start;

// Verify O(1) characteristics
// Save time should be independent of total profile count
```

### Data Integrity Tests

```typescript
// Verify index consistency
const index = await storage.getProfileIndex();
for (const profileId of index) {
  const profile = await storage.loadProfile(profileId);
  assert(profile !== null, `Profile ${profileId} missing but in index`);
}
```

### Migration Tests

```typescript
// Test migration from various legacy states
localStorage.setItem('tinkertools_profiles', legacyData);
const storage = new ProfileStorage();
// Verify all profiles migrated correctly
```

## Security and Privacy Notes

- All profile data remains client-side only
- No profile data transmitted to servers
- localStorage is domain-scoped (privacy preserved)
- Consider data export/import for user backup needs

## Summary for Claude Code

When working with TinkerProfiles storage:

1. **Use individual operations** for best performance
2. **Respect the index** as the source of truth
3. **Handle errors gracefully** - storage can fail
4. **Test migration scenarios** when modifying storage logic
5. **Monitor performance** - maintain O(1) characteristics
6. **Leverage existing patterns** - follow established conventions

The storage layer is now optimized for scale and performance. When in doubt, prefer individual profile operations over bulk operations.

## Skill System Integration Patterns (September 2025)

### Critical Skill Calculation Patterns

#### AC Values - Pure Calculated Pattern

```typescript
// ACs are NEVER stored - always calculated fresh
// This prevents accumulation bugs from repeated bonus applications
const acValue = calculateSingleACValue(profile, 'Chemical AC');
// Result: equipmentBonus + perkBonus + buffBonus (no base value)
```

#### Misc Skills - Bonus Integration Pattern

```typescript
// Misc skills get bonuses applied via ip-integrator updateProfileSkillInfo()
const miscSkill = profile.Skills.Misc['Max NCU'];
// Structure: { baseValue: X, equipmentBonus: Y, perkBonus: Z, buffBonus: W, value: total }
```

#### Regular Skills - Composite Value Pattern

```typescript
// Regular skills: base + trickle-down + IP + bonuses
const skill = profile.Skills['Body & Defense']['Body Dev.'];
// Components: 5 (base) + trickleDown + pointFromIp + equipmentBonus + perkBonus + buffBonus
```

### Skill Bonus Application Rules

1. **Never Accumulate Bonuses**: Always recalculate from source data
2. **Separate Bonus Storage**: Store equipmentBonus, perkBonus, buffBonus separately
3. **Value Consistency**: Final `value` field is always sum of all components
4. **AC Special Case**: ACs calculated on-demand, never stored in profile
5. **Misc Skills**: Apply bonuses using ip-integrator, not direct manipulation

### Pattern Matching for Skills

```typescript
// Use skill-patterns.ts for flexible skill name matching
const skillValue = findSkillByPattern(skillCategory, statId);
// Handles variations: "1h Blunt" vs "1h Blunt" vs "1hBlunt"
```

### Critical Files for Skill System

- **`ip-integrator.ts`**: Central hub for all skill calculations and bonus applications
- **`ac-calculator.ts`**: Pure calculation utility for AC values (no storage)
- **`skill-patterns.ts`**: Flexible skill name matching via regex patterns
- **`profile-stats-mapper.ts`**: Profile → stat ID mapping for requirements

## Import Validation Boundary (September 2025)

### Critical: Validate Before Import

```typescript
// ALWAYS validate imported profiles before saving
const { validateProfile } = await import('./validation');
const validation = validateProfile(importedProfile);
if (!validation.valid) {
  throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
}
```

**Validation ensures:**

- Profession/Breed IDs are numeric and in valid ranges (1-15, 0-7)
- Skills structure is correct
- Level is 1-220
- Version is "4.0.0"

**Location**: All imports run through validation in `transformer.ts` (JSON/AOSetups imports)
**See**: `docs/features/profile-import-validation.doc.md` for full details

## Breed/Profession Normalization Pattern (September 2025)

### Overview

All Character.Breed and Character.Profession values are stored and used as **numeric IDs** throughout the TinkerProfiles system. This ensures consistency, enables efficient calculations, and provides robust fuzzy matching for imports.

### Critical Rules

1. **Storage**: Always store breed and profession as numeric IDs
2. **Display**: Convert to human-readable names only in UI layer
3. **Import**: Always normalize string values to IDs at import boundaries
4. **Migration**: Legacy string-based profiles auto-migrate to IDs on load
5. **Validation**: Verify numeric type and valid ID range

### Normalization Functions

**Location**: `/frontend/src/services/game-utils.ts`

```typescript
// Convert any breed value to numeric ID (1-7)
normalizeBreedToId(value: string | number): number
// Examples:
normalizeBreedToId("Solitus") → 1
normalizeBreedToId("solitus") → 1
normalizeBreedToId(1) → 1
normalizeBreedToId("invalid") → 1 (safe default)

// Convert any profession value to numeric ID (1-15)
normalizeProfessionToId(value: string | number): number
// Examples:
normalizeProfessionToId("Martial Artist") → 8
normalizeProfessionToId("MartialArtist") → 8
normalizeProfessionToId("martial artist") → 8
normalizeProfessionToId(8) → 8
normalizeProfessionToId("invalid") → 6 (Adventurer default)
```

### Key Features

- **Idempotent**: Safe to call multiple times on same value
- **Fuzzy Matching**: Handles spaces, hyphens, case variations
- **Safe Defaults**: Invalid values → Adventurer (6) / Solitus (1)
- **Type Flexible**: Accepts both strings and numbers

### Usage Patterns

#### Profile Creation

```typescript
// ALWAYS use numeric IDs when creating profiles
const profile = createDefaultProfile('Character Name', 'Solitus');
// Result: profile.Character.Breed = 1 (numeric ID)
// Result: profile.Character.Profession = 6 (numeric ID)
```

#### Import from External Format

```typescript
// ALWAYS normalize at import boundary
const importedProfession = normalizeProfessionToId(aosetups.character.profession || 'Adventurer');
const importedBreed = normalizeBreedToId(aosetups.character.breed || 'Solitus');

profile.Character.Profession = importedProfession; // numeric ID
profile.Character.Breed = importedBreed; // numeric ID
```

#### Display in UI

```typescript
// ONLY convert to names in display layer
import { getProfessionName, getBreedName } from '@/services/game-utils';

const displayName = getProfessionName(profile.Character.Profession);
// Result: "Adventurer" (human-readable string)

const displayBreed = getBreedName(profile.Character.Breed);
// Result: "Solitus" (human-readable string)
```

#### IP Calculations

```typescript
// Use numeric IDs directly in calculations
const abilityBase = getBreedInitValue(
  profile.Character.Breed, // numeric ID (1-7)
  abilityId // numeric ID (16-21)
);

const skillCap = calcAbilityMaxValue(
  level,
  profile.Character.Breed, // numeric ID
  profile.Character.Profession, // numeric ID
  abilityId
);
```

### Migration Support

**Location**: `/frontend/src/lib/tinkerprofiles/transformer.ts`

```typescript
// Automatically migrates legacy string-based profiles
migrateProfileCharacterIds(profile: TinkerProfile): TinkerProfile {
  // Converts string values to numeric IDs
  // Logs conversion for debugging
  // Updates profile.updated timestamp
  // Idempotent - safe to call multiple times
}
```

**Automatic Migration Triggers**:

- Profile load from storage
- Profile import from JSON
- Profile import from AOSetups

### Validation

**Location**: `/frontend/src/lib/tinkerprofiles/validation.ts`

```typescript
// Validate numeric type and range
if (
  typeof profile.Character.Profession !== 'number' ||
  profile.Character.Profession < 1 ||
  profile.Character.Profession > 15
) {
  errors.push('Invalid profession ID');
}

if (
  typeof profile.Character.Breed !== 'number' ||
  profile.Character.Breed < 0 ||
  profile.Character.Breed > 7
) {
  errors.push('Invalid breed ID');
}
```

### ID Mappings Reference

```typescript
// Profession IDs (1-15)
1: Soldier, 2: MartialArtist, 3: Engineer, 4: Fixer
5: Agent, 6: Adventurer, 7: Trader, 8: Bureaucrat
9: Enforcer, 10: Doctor, 11: NanoTechnician, 12: MetaPhysicist
13: Keeper, 14: Shade, 15: Monster (NPC)

// Breed IDs (0-7)
0: Unknown, 1: Solitus, 2: Opifex, 3: Nanomage, 4: Atrox
5-7: Reserved/NPC breeds
```

### Critical Do's and Don'ts

#### Do's ✅

- Store breed/profession as numeric IDs in all profile data
- Use normalization functions at import boundaries
- Convert to names only in UI display layer
- Validate numeric type and range in validation layer
- Use numeric IDs directly in IP calculations

#### Don'ts ❌

- Don't store breed/profession as strings in profile structure
- Don't skip normalization when importing external data
- Don't use string values in IP calculation functions
- Don't bypass migration when loading legacy profiles
- Don't assume values are valid without type checking

### Debugging Breed/Profession Issues

```typescript
// Check profile values in console
console.log('Profession:', profile.Character.Profession, typeof profile.Character.Profession);
console.log('Breed:', profile.Character.Breed, typeof profile.Character.Breed);

// Should always show:
// Profession: 6 'number'
// Breed: 1 'number'

// If you see strings, migration didn't run:
// Profession: "Adventurer" 'string'  ← PROBLEM!
```

### Related Documentation

See `/docs/features/breed-profession-normalization.doc.md` for complete feature documentation including:

- Data flow diagrams
- Import/export integration details
- Migration scenarios
- Edge case handling
- Performance characteristics
