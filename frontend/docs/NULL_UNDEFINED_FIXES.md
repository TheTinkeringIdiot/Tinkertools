# Null/Undefined Standardization Fixes

This document tracks the fixes applied to standardize null/undefined handling across the codebase.

## Summary

Applied the following standard (see NULL_UNDEFINED_STANDARD.md for full details):

- **Use `null`** for "intentionally no value" (user not selected, error cleared)
- **Use `undefined`** for "value not yet determined" (not in cache, doesn't exist)
- **Use `[]`** for empty arrays (NEVER null/undefined)

## Files Modified

### 1. Documentation

**File**: `/home/quigley/projects/Tinkertools/frontend/docs/NULL_UNDEFINED_STANDARD.md`

- **Status**: Created
- **Purpose**: Comprehensive standard for null/undefined handling across the codebase
- **Key Sections**:
  - Core conventions
  - Property access safety patterns
  - Test expectation patterns
  - Migration checklist

### 2. Component Fixes

#### CharacterInfoPanel.vue

**File**: `/home/quigley/projects/Tinkertools/frontend/src/components/profiles/CharacterInfoPanel.vue`

- **Lines Modified**: 185, 196
- **Changes**:
  - Fixed redundant null checks: `if (!health || health === undefined)` → `if (health === null || health === undefined)`
  - Applied to both `formattedHealth` and `formattedNano` computed properties
- **Reason**: The `!health` check was redundant and confusing (0 is falsy but valid). Explicit null/undefined checks are clearer.

#### SkillSlider.vue

**File**: `/home/quigley/projects/Tinkertools/frontend/src/components/profiles/skills/SkillSlider.vue`

- **Status**: Already correct
- **Existing Patterns**:
  - Proper null checks: `if (factor === null) return null;` (line 493)
  - Proper undefined checks: `if (newValue === null || newValue === undefined) return;` (line 542)
  - Proper initial load detection: `const isInitialLoad = oldValue === undefined;` (line 612)
- **No changes needed**: Component already follows the standard

### 3. Test Fixes

#### profilesStore.test.ts

**File**: `/home/quigley/projects/Tinkertools/frontend/src/__tests__/stores/profilesStore.test.ts`

- **Line Modified**: 29-30
- **Change**:

  ```typescript
  // BEFORE
  expect(store.profiles).toEqual([]);

  // AFTER
  // profiles is a readonly Map, check profileMetadata instead (which is an array)
  expect(store.profileMetadata).toEqual([]);
  ```

- **Reason**: The store exposes `profiles` as a `readonly(Map<string, TinkerProfile>)`, not an array. Tests should check `profileMetadata` which is the array-based public interface.

#### Other Test Files

**Status**: Consistent with standard

- Tests already use `toBe(null)` for null checks
- Tests already use `toEqual([])` for empty array checks
- No changes needed for:
  - `src/__tests__/stores/items.test.ts`
  - `src/__tests__/stores/profile.test.ts`
  - `src/__tests__/stores/nanosStore.test.ts`

### 4. Store Patterns Verified

All stores follow the standard correctly:

#### tinkerProfiles.ts

```typescript
const profiles = ref<Map<string, TinkerProfile>>(new Map()); // Map, not null
const profileMetadata = ref<ProfileMetadata[]>([]); // Empty array
const activeProfileId = ref<string | null>(null); // null for no selection
const activeProfile = ref<TinkerProfile | null>(null); // null for no selection
const error = ref<string | null>(null); // null when cleared
```

#### items.ts

```typescript
const items = ref(new Map<number, Item>()); // Map, not null
const searchResults = ref<ItemsState['searchResults']>(null); // null when not searched
const error = ref<UserFriendlyError | null>(null); // null when cleared
```

#### fiteStore.ts

```typescript
const weapons = ref<Weapon[]>([]); // Empty array
const error = ref<string | null>(null); // null when cleared
const selectedWeapon = ref<Weapon | null>(null); // null when none selected
const comparisonWeapons = ref<Weapon[]>([]); // Empty array
```

## Patterns Applied

### 1. Property Access with Optional Chaining

```typescript
// GOOD: Safe access
const value = profile?.skills?.[16]?.total ?? 0;
const count = items?.length ?? 0;
const name = profile?.Character?.Name ?? 'Unknown';
```

### 2. Explicit Null/Undefined Checks

```typescript
// GOOD: Explicit checks
if (value === null || value === undefined) return '0';
if (factor === null) return null;

// AVOID: Truthy checks that could hide bugs
if (!value) return '0'; // Bad: 0 is falsy but might be valid
```

### 3. Array Initialization

```typescript
// GOOD: Always initialize arrays
const items = ref<Item[]>([]);
const favorites = ref<number[]>([]);

// BAD: Never use null/undefined for arrays
const items = ref<Item[]>(); // undefined
const items = ref<Item[] | null>(null); // null
```

### 4. Function Returns

```typescript
// Domain logic: return null for "not found"
async function getItem(id: number): Promise<Item | null> {
  const item = await api.fetch(id);
  return item || null;
}

// Internal operations: return undefined for "doesn't exist"
function getFromCache(id: number): Item | undefined {
  return cache.get(id); // Map.get returns undefined
}
```

## Test Expectations Pattern

### For null values:

```typescript
expect(store.activeProfile).toBe(null);
expect(store.activeProfile).toBeNull();
expect(store.error).toBe(null);
```

### For undefined values:

```typescript
expect(value).toBe(undefined);
expect(value).toBeUndefined();
```

### For empty arrays:

```typescript
expect(store.items).toEqual([]);
expect(store.profileMetadata).toEqual([]);
// NOT: expect(store.items).toBe(null)
```

### For Maps:

```typescript
// Check size, not equality
expect(store.profiles.size).toBe(0);
// For readonly Map, check the public array interface
expect(store.profileMetadata).toEqual([]);
```

## Migration Checklist

When adding new code or fixing existing code:

- [ ] Check type declarations - use `| null`, `| undefined`, or `[]` appropriately
- [ ] Initialize refs correctly - `null` for selections, `[]` for arrays
- [ ] Add optional chaining `?.` for all property access
- [ ] Add template guards `v-if` for null checks
- [ ] Use explicit null checks instead of truthy checks
- [ ] Update tests to match the convention
- [ ] Verify function returns match the pattern

## Benefits

1. **Clarity**: Explicit intent about "no value" vs "not set yet"
2. **Type Safety**: TypeScript can catch more errors
3. **Consistency**: Same patterns across all files
4. **Fewer Bugs**: No confusion about falsy vs null/undefined
5. **Better Tests**: Tests match actual behavior

## References

- Full Standard: `docs/NULL_UNDEFINED_STANDARD.md`
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Vue 3 Optional Chaining: https://vuejs.org/guide/essentials/template-syntax.html#javascript-expressions
