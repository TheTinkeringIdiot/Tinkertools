# Test Helpers Documentation

Comprehensive test utilities and fixtures for the TinkerTools frontend test suite.

## Overview

This directory contains reusable test fixtures and utilities to support the v4.0.0 ID-based skill architecture migration. All helpers follow the pattern of using **numeric IDs** for skills, breeds, and professions.

## Files

### `profile-fixtures.ts`

Factory functions for creating test profiles with proper v4.0.0 structure.

**Key Exports:**

- `createTestProfile(options)` - Create a customizable test profile
- `createFreshProfile()` - Level 1 character with minimal skills
- `createEndgameProfile()` - Level 220 character with high skills
- `createSoldierProfile()` - Solitus Soldier tank build
- `createNanoTechProfile()` - Nanomage Nano-Technician
- `createEnforcerProfile()` - Atrox Enforcer tank
- `createFixerProfile()` - Opifex Fixer
- `BREED` - Breed ID constants (1-4)
- `PROFESSION` - Profession ID constants (1-15)

**Example:**

```typescript
import { createTestProfile, BREED, PROFESSION } from '@/__tests__/helpers';

const profile = createTestProfile({
  breed: BREED.SOLITUS,
  profession: PROFESSION.ADVENTURER,
  level: 220,
  skills: {
    [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 250, equipmentBonus: 50 }
  }
});
```

### `skill-fixtures.ts`

Skill ID constants and skill data utilities.

**Key Exports:**

- `SKILL_ID` - Complete mapping of all skill IDs
- `ABILITY_ID` - Ability IDs (16-21)
- `BODY_DEFENSE_SKILL_ID` - Body & Defense skills
- `RANGED_WEAPON_SKILL_ID` - Ranged weapon skills
- `MELEE_WEAPON_SKILL_ID` - Melee weapon skills
- `AC_STAT_ID` - Armor class stats
- `MISC_SKILL_ID` - Misc skills (damage modifiers, etc.)
- `createSkillBonuses(entries)` - Create bonus object from ID/value pairs
- `createTestSkillData(overrides)` - Create a SkillData object
- `SKILL_COMBOS` - Pre-configured skill bonus sets

**Example:**

```typescript
import { SKILL_ID, createSkillBonuses } from '@/__tests__/helpers';

const bonuses = createSkillBonuses([
  [SKILL_ID.ASSAULT_RIF, 10],
  [SKILL_ID.DODGE_RNG, 5]
]);
// Result: { 116: 10, 154: 5 }

expect(result).toEqual({
  [SKILL_ID.ASSAULT_RIF]: 10,
  [SKILL_ID.DODGE_RNG]: 5
});
```

### `item-fixtures.ts`

Factory functions for creating test items with proper structure.

**Key Exports:**

- `createTestItem(options)` - Generic item creation
- `createWeaponItem()` - Weapon with attack bonuses
- `createArmorItem()` - Armor with defense bonuses
- `createImplantItem()` - Implant with stat bonuses
- `createNanoItem()` - Nano program
- `createBuffItem()` - Buff item (perk/nano)
- `createPerkItem(name, aoid, bonuses)` - Perk with multiple effects
- `createStatValue(stat, value)` - Create a StatValue object
- `createSpellData(options)` - Create SpellData with spells

**Example:**

```typescript
import { createPerkItem, SKILL_ID } from '@/__tests__/helpers';

const perk = createPerkItem('Combat Perk', 999001, [
  [SKILL_ID.ASSAULT_RIF, 50],
  [SKILL_ID.RANGED_INIT, 25]
]);
```

### `vue-test-utils.ts`

Vue component mounting utilities with proper test context.

**Key Exports:**

- `mountWithContext(component, options)` - Mount with Pinia, Router, PrimeVue
- `mockPrimeVueComponents` - Mock PrimeVue components for tests
- `createTestPinia()` - Create fresh Pinia instance
- `createTestRouter()` - Create test router
- `setupLocalStorageMock()` - Mock localStorage
- `findByTestId(wrapper, testId)` - Find by data-testid
- `standardCleanup()` - Standard afterEach cleanup

**Example:**

```typescript
import { mountWithContext, findByTestId } from '@/__tests__/helpers';

const wrapper = mountWithContext(MyComponent, {
  props: { item: mockItem },
  global: {
    stubs: { 'router-link': true }
  }
});

const button = findByTestId(wrapper, 'submit-button');
expect(button.exists()).toBe(true);
```

## Usage Patterns

### Pattern 1: Profile Creation with Custom Skills

```typescript
import { createTestProfile, SKILL_ID } from '@/__tests__/helpers';

it('should calculate bonuses correctly', () => {
  const profile = createTestProfile({
    level: 100,
    skills: {
      [SKILL_ID.ASSAULT_RIF]: {
        base: 5,
        trickle: 50,
        pointsFromIp: 200,
        equipmentBonus: 30,
        total: 285
      }
    }
  });

  const skill = profile.skills[SKILL_ID.ASSAULT_RIF];
  expect(skill.total).toBe(285);
});
```

### Pattern 2: Skill Bonus Assertions

```typescript
import { SKILL_ID, createSkillBonuses } from '@/__tests__/helpers';

it('should return correct bonuses', () => {
  const result = calculateBonuses(items);

  expect(result).toEqual({
    [SKILL_ID.ASSAULT_RIF]: 10,  // Numeric ID
    [SKILL_ID.DODGE_RNG]: 5
  });
});
```

### Pattern 3: Component Testing with Context

```typescript
import { mountWithContext, findByTestId } from '@/__tests__/helpers';

describe('ItemCard', () => {
  it('should display item name', () => {
    const wrapper = mountWithContext(ItemCard, {
      props: { item: mockItem }
    });

    const name = getTextByTestId(wrapper, 'item-name');
    expect(name).toBe('Test Item');
  });
});
```

### Pattern 4: Pre-configured Test Profiles

```typescript
import { createSoldierProfile, SKILL_ID } from '@/__tests__/helpers';

it('should handle soldier profiles', () => {
  const soldier = createSoldierProfile({ level: 200 });

  expect(soldier.Character.Profession).toBe(1); // Soldier
  expect(soldier.skills[SKILL_ID.ASSAULT_RIF]).toBeDefined();
});
```

### Pattern 5: Item with Requirements

```typescript
import { createItemWithRequirements, SKILL_ID } from '@/__tests__/helpers';

const item = createItemWithRequirements([
  [SKILL_ID.ASSAULT_RIF, 500],
  [SKILL_ID.RANGED_INIT, 400]
]);

// Item has criteria requiring Assault Rif >= 500, Ranged Init >= 400
```

## Migration Guide

### Old Pattern (String-based)

```typescript
// DON'T DO THIS
expect(result).toEqual({
  'Assault Rifle': 10,
  'Dodge-Rng': 5
});

const profile = {
  Character: {
    Breed: "Solitus",      // String
    Profession: "Soldier"  // String
  }
};
```

### New Pattern (ID-based)

```typescript
// DO THIS
import { SKILL_ID, BREED, PROFESSION } from '@/__tests__/helpers';

expect(result).toEqual({
  [SKILL_ID.ASSAULT_RIF]: 10,  // Numeric ID
  [SKILL_ID.DODGE_RNG]: 5
});

const profile = createTestProfile({
  breed: BREED.SOLITUS,       // Numeric ID
  profession: PROFESSION.SOLDIER
});
```

## Common Skill IDs Quick Reference

```typescript
// Abilities
SKILL_ID.STRENGTH        // 16
SKILL_ID.AGILITY         // 17
SKILL_ID.STAMINA         // 18
SKILL_ID.INTELLIGENCE    // 19
SKILL_ID.SENSE           // 20
SKILL_ID.PSYCHIC         // 21

// Common Skills
SKILL_ID.ASSAULT_RIF     // 116
SKILL_ID.PISTOL          // 112
SKILL_ID.RIFLE           // 113
SKILL_ID.DODGE_RNG       // 154
SKILL_ID.BODY_DEV        // 152
SKILL_ID.NANO_POOL       // 132
SKILL_ID.COMPUTER_LITERACY // 161
SKILL_ID.MAX_NCU         // 181

// Misc
SKILL_ID.MAX_HEALTH      // 1
SKILL_ID.MAX_NANO        // 221
SKILL_ID.ADD_PROJ_DAM    // 278
```

## Test Cleanup

Always use `standardCleanup()` in `afterEach()` to ensure clean test state:

```typescript
import { standardCleanup } from '@/__tests__/helpers';

afterEach(() => {
  standardCleanup(); // Clears localStorage, resets stores, clears mocks
});
```

## Type Safety

All helpers are fully typed with TypeScript. Import types as needed:

```typescript
import type { ProfileCreationOptions, SkillData, ItemCreationOptions } from '@/__tests__/helpers';
```

## Best Practices

1. **Use constants for IDs**: Always use `SKILL_ID`, `BREED`, `PROFESSION` constants
2. **Clone for mutation**: Use `cloneProfile()` or `cloneItem()` before modifying
3. **Mount with context**: Always use `mountWithContext()` for component tests
4. **Clean up after tests**: Use `standardCleanup()` in `afterEach()`
5. **Validate profiles**: Use `isValidV4Profile()` for migration tests
6. **Use test IDs**: Add `data-testid` attributes and use `findByTestId()`

## Related Documentation

- `/frontend/src/lib/tinkerprofiles/skill-mappings.ts` - Authoritative skill ID mappings
- `/frontend/src/lib/tinkerprofiles/types.ts` - Profile interface definitions
- `/.docs/plans/test-refactoring/fix-patterns-and-examples.docs.md` - Fix patterns
- `/frontend/src/__tests__/lib/tinkerprofiles/ip-calculator.test.ts` - Working example

## Troubleshooting

### TypeScript errors with skill IDs

**Problem**: `Type 'number' is not assignable to type 'string'`

**Solution**: Use numeric IDs, not strings:

```typescript
// Wrong
const bonuses = { 'Assault Rifle': 10 };

// Right
const bonuses = { [SKILL_ID.ASSAULT_RIF]: 10 };
```

### Profile structure errors

**Problem**: `Property 'Gender' does not exist on type 'Character'`

**Solution**: Use `createTestProfile()` which has correct v4.0.0 structure

### Component injection warnings

**Problem**: `inject() can only be used inside setup()`

**Solution**: Use `mountWithContext()` instead of raw `mount()`

## Support

For questions or issues with test helpers, see:

- Test refactoring plan: `/.docs/plans/test-refactoring/`
- Working test example: `/frontend/src/__tests__/lib/tinkerprofiles/ip-calculator.test.ts`
