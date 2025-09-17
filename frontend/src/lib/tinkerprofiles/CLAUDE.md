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
  PROFILE_INDEX: 'tinkertools_profile_index',    // Array of profile IDs
  PROFILE_PREFIX: 'tinkertools_profile_',        // Prefix for individual profiles
  PROFILES: 'tinkertools_profiles',              // LEGACY - migration only
  ACTIVE_PROFILE: 'tinkertools_active_profile',
  PROFILE_METADATA: 'tinkertools_profile_metadata',
  PROFILE_PREFERENCES: 'tinkertools_profile_preferences',
  VERSION: 'tinkertools_version'
}
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
await this.updateProfileIndex(profileId, 'add');    // When saving new
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
const profileKeys = Object.keys(localStorage)
  .filter(key => key.startsWith(STORAGE_KEYS.PROFILE_PREFIX));
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
JSON.parse(localStorage.getItem('tinkertools_profile_index'))

// View specific profile
JSON.parse(localStorage.getItem('tinkertools_profile_12345-abcd-6789-efgh'))

// Count all profile-related keys
Object.keys(localStorage)
  .filter(key => key.startsWith('tinkertools_profile_'))
  .length
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