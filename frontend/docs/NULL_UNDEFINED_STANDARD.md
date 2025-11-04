# Null and Undefined Handling Standard

This document defines the TinkerTools standard for handling `null` and `undefined` values across the codebase.

## Core Convention

Based on analysis of the existing codebase, we follow these rules:

### 1. Use `null` for "intentionally no value"

- **User/Profile not selected**: `activeProfile = null`
- **Error state cleared**: `error = null`
- **Optional selection reset**: `selectedNano = null`
- **Empty equipment slot**: `Implants['Head'] = null`

```typescript
// CORRECT: null for intentional absence
const activeProfile = ref<TinkerProfile | null>(null);
const error = ref<UserFriendlyError | null>(null);
const selectedNano = ref<NanoProgram | null>(null);
```

### 2. Use `undefined` for "value not yet determined"

- **Function return when not found**: `return undefined`
- **Optional function parameters**: `function search(query?: string)`
- **Object properties that may not exist**: `item.clusters?.Shiny`
- **Type-level optionality**: `interface { name?: string }`

```typescript
// CORRECT: undefined for "not set yet" or "doesn't exist"
function getItemFromCache(id: number): Item | undefined {
  return items.get(id); // Map.get returns undefined if not found
}
```

### 3. ALWAYS Initialize Arrays to `[]`

- **Never** use `null` or `undefined` for arrays
- **Always** initialize with empty array

```typescript
// CORRECT: empty array initialization
const nanos = ref<NanoProgram[]>([]);
const favorites = ref<number[]>([]);
const weapons = ref<Weapon[]>([]);

// WRONG: uninitialized or null arrays
const nanos = ref<NanoProgram[]>(); // BAD: undefined
const favorites = ref<number[] | null>(null); // BAD: null
```

### 4. Special Case: Arrays with Nullable Items

When array items themselves can be null (e.g., comparison slots):

```typescript
// CORRECT: array of nullable items, initialized with nulls
const selectedForComparison = ref<(Symbiant | null)[]>([null, null, null]);

// Access with null check
if (selectedForComparison.value[0] !== null) {
  // safe to use
}
```

## Property Access Safety

### Always Use Optional Chaining

```typescript
// CORRECT: safe property access
const value = profile?.skills?.[16]?.total ?? 0;
const count = items?.length ?? 0;
const name = profile?.Character?.Name ?? 'Unknown';

// WRONG: unsafe access
const value = profile.skills[16].total; // Will crash if profile/skills/16 is null/undefined
```

### Guard Checks in Templates

```vue
<template>
  <!-- CORRECT: null guard -->
  <div v-if="profile !== null">
    {{ profile.name }}
  </div>

  <!-- CORRECT: truthy check for objects -->
  <div v-if="profile">
    {{ profile.name }}
  </div>

  <!-- WRONG: no guard -->
  <div>
    {{ profile.name }}
    <!-- Crashes if profile is null -->
  </div>
</template>
```

## Function Returns

### Return `null` for "Not Found" in Domain Logic

```typescript
// CORRECT: null for explicit "not found"
async function getItem(id: number): Promise<Item | null> {
  const item = await api.fetch(id);
  return item || null; // Explicit null when not found
}
```

### Return `undefined` for Cache Miss or Internal Operations

```typescript
// CORRECT: undefined for "doesn't exist in cache"
function getFromCache(id: number): Item | undefined {
  return cache.get(id); // undefined when not in cache
}
```

## Test Expectations

### Match the Convention

```typescript
// Store uses null for activeProfile
const activeProfile = ref<TinkerProfile | null>(null);

// Test expects null
expect(store.activeProfile).toBe(null); // CORRECT
expect(store.activeProfile).toBeNull(); // CORRECT
expect(store.activeProfile).toBeUndefined(); // WRONG

// Arrays are always initialized
const items = ref<Item[]>([]);

// Test expects empty array
expect(store.items).toEqual([]); // CORRECT
expect(store.items).toBe(null); // WRONG
```

### Use Appropriate Matchers

```typescript
// For null checks
expect(value).toBe(null);
expect(value).toBeNull();

// For undefined checks
expect(value).toBe(undefined);
expect(value).toBeUndefined();

// For truthy/falsy
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// For existence (not null AND not undefined)
expect(value).toBeDefined(); // passes for null, fails for undefined
```

## Common Patterns

### Clearing State

```typescript
// CORRECT: reset to null
function clearActiveProfile() {
  activeProfile.value = null;
  error.value = null;
}

// CORRECT: reset arrays to empty
function clearCache() {
  items.value = [];
  searchResults.value = [];
}
```

### Initialization in Components

```typescript
// CORRECT: setup
const profile = ref<Profile | null>(null);
const items = ref<Item[]>([]);
const error = ref<string | null>(null);

// Load data
onMounted(async () => {
  try {
    items.value = await loadItems(); // Never null, always array
    profile.value = await loadProfile(); // null if not found
  } catch (err) {
    error.value = err.message; // null when cleared
  }
});
```

### Conditional Rendering

```typescript
// CORRECT: explicit null check
const hasProfile = computed(() => activeProfile.value !== null)

// CORRECT: truthy check (works for null and undefined)
const hasItems = computed(() => items.value.length > 0)

// Template
<div v-if="hasProfile">
  <!-- Profile is guaranteed non-null here -->
</div>
```

## Type Definitions

### Interface Optional Properties

```typescript
// CORRECT: use ? for optional properties
interface ItemSearchQuery {
  name?: string; // undefined when not provided
  minQL?: number; // undefined when not provided
  isNano?: boolean; // undefined when not provided
}

// Usage
function search(query: ItemSearchQuery) {
  if (query.name !== undefined) {
    // name was provided
  }
}
```

### Function Optional Parameters

```typescript
// CORRECT: optional parameters default to undefined
function getItem(id: number, forceRefresh = false): Promise<Item | null> {
  // forceRefresh is boolean, never null/undefined
  // return is null when not found
}
```

## Migration Checklist

When fixing null/undefined issues:

1. ✅ Check type declaration - does it use `| null` or `| undefined`?
2. ✅ Check initialization - is it set to `null`, `undefined`, or `[]`?
3. ✅ Check all property access - use optional chaining `?.`
4. ✅ Check template guards - add `v-if` for null checks
5. ✅ Update tests - match the convention used in the code
6. ✅ Check function returns - consistent with convention

## Summary

| Type                | Use `null`                | Use `undefined`              | Use `[]`        |
| ------------------- | ------------------------- | ---------------------------- | --------------- |
| **No selection**    | ✅ `activeProfile = null` | ❌                           | ❌              |
| **Error cleared**   | ✅ `error = null`         | ❌                           | ❌              |
| **Empty list**      | ❌                        | ❌                           | ✅ `items = []` |
| **Not in cache**    | ❌                        | ✅ `cache.get() → undefined` | ❌              |
| **Optional param**  | ❌                        | ✅ `function(arg?: string)`  | ❌              |
| **Not found (API)** | ✅ `return null`          | ❌                           | ❌              |

**Golden Rule**: If it's a "thing that could be selected/set", use `null`. If it's a collection, use `[]`. If it's a "value that might not exist", use `undefined`.
