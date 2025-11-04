# Test Helpers Quick Reference

Quick copy-paste examples for common test patterns.

## Import Statement

```typescript
import {
  createTestProfile,
  BREED,
  PROFESSION,
  SKILL_ID,
  createTestItem,
  createPerkItem,
  mountWithContext,
  standardCleanup,
} from '@/__tests__/helpers';
```

## Common Skill IDs

```typescript
// Abilities
SKILL_ID.STRENGTH; // 16
SKILL_ID.AGILITY; // 17
SKILL_ID.STAMINA; // 18
SKILL_ID.INTELLIGENCE; // 19
SKILL_ID.SENSE; // 20
SKILL_ID.PSYCHIC; // 21

// Weapons
SKILL_ID.ASSAULT_RIF; // 116
SKILL_ID.PISTOL; // 112
SKILL_ID.RIFLE; // 113

// Defense
SKILL_ID.DODGE_RNG; // 154
SKILL_ID.BODY_DEV; // 152
SKILL_ID.NANO_POOL; // 132

// Trade
SKILL_ID.COMPUTER_LITERACY; // 161
SKILL_ID.NANO_PROGRAMMING; // 160

// Misc
SKILL_ID.MAX_NCU; // 181
SKILL_ID.ADD_PROJ_DAM; // 278
```

## Profile Creation

```typescript
// Basic profile
const profile = createTestProfile();

// Custom profile
const profile = createTestProfile({
  breed: BREED.SOLITUS,
  profession: PROFESSION.ADVENTURER,
  level: 220,
});

// With skills
const profile = createTestProfile({
  skills: {
    [SKILL_ID.ASSAULT_RIF]: {
      pointsFromIp: 250,
      equipmentBonus: 50,
    },
  },
});

// Pre-configured
const soldier = createSoldierProfile();
const nanotech = createNanoTechProfile();
const endgame = createEndgameProfile();
```

## Skill Bonuses

```typescript
// Create bonuses
const bonuses = createSkillBonuses([
  [SKILL_ID.ASSAULT_RIF, 10],
  [SKILL_ID.DODGE_RNG, 5],
]);

// Assert bonuses (CORRECT)
expect(result).toEqual({
  [SKILL_ID.ASSAULT_RIF]: 10,
  [SKILL_ID.DODGE_RNG]: 5,
});

// NOT this (WRONG)
expect(result).toEqual({
  'Assault Rifle': 10, // ❌ Don't use strings
  'Dodge-Rng': 5,
});
```

## Item Creation

```typescript
// Basic item
const item = createTestItem({ name: 'Test Item', ql: 200 });

// Weapon
const weapon = createWeaponItem({ name: 'Rifle', ql: 180 });

// Perk
const perk = createPerkItem('Combat Perk', 999001, [
  [SKILL_ID.ASSAULT_RIF, 50],
  [SKILL_ID.RANGED_INIT, 25],
]);

// Stat value
const stat = createStatValue(SKILL_ID.ASSAULT_RIF, 10);
```

## Component Testing

```typescript
describe('MyComponent', () => {
  it('should render', () => {
    const wrapper = mountWithContext(MyComponent, {
      props: { item: mockItem },
    });

    expect(wrapper.exists()).toBe(true);
  });

  afterEach(() => {
    standardCleanup();
  });
});
```

## Finding Elements

```typescript
const button = findByTestId(wrapper, 'submit-button');
const text = getTextByTestId(wrapper, 'item-name');
const exists = existsByTestId(wrapper, 'optional-element');
```

## Test Cleanup

```typescript
afterEach(() => {
  standardCleanup(); // Clears localStorage, resets stores, clears mocks
});
```

## Common Patterns

### Pattern: Calculate and Assert Bonuses

```typescript
it('should calculate bonuses correctly', () => {
  const items = [
    createPerkItem('Perk 1', 999001, [[SKILL_ID.ASSAULT_RIF, 10]]),
    createPerkItem('Perk 2', 999002, [[SKILL_ID.DODGE_RNG, 5]]),
  ];

  const result = calculateBonuses(items);

  expect(result).toEqual({
    [SKILL_ID.ASSAULT_RIF]: 10,
    [SKILL_ID.DODGE_RNG]: 5,
  });
});
```

### Pattern: Profile Validation

```typescript
it('should validate profile structure', () => {
  const profile = createTestProfile();

  expect(profile.version).toBe('4.0.0');
  expect(typeof profile.Character.Breed).toBe('number');
  expect(typeof profile.Character.Profession).toBe('number');
  expect(isValidV4Profile(profile)).toBe(true);
});
```

### Pattern: Component with Props

```typescript
it('should display item details', () => {
  const item = createTestItem({ name: 'Test Item', ql: 200 });

  const wrapper = mountWithContext(ItemCard, {
    props: { item },
  });

  expect(wrapper.text()).toContain('Test Item');
  expect(wrapper.text()).toContain('200');
});
```

### Pattern: Perk Bonus Calculation

```typescript
it('should sum perk bonuses', () => {
  const perks = [
    createPerkItem('Perk A', 999001, [[SKILL_ID.ASSAULT_RIF, 30]]),
    createPerkItem('Perk B', 999002, [[SKILL_ID.ASSAULT_RIF, 20]]),
  ];

  const total = calculateTotalBonus(perks, SKILL_ID.ASSAULT_RIF);

  expect(total).toBe(50);
});
```

## Migration Checklist

When fixing a test:

- [ ] Import helpers from `@/__tests__/helpers`
- [ ] Replace string skill names with `SKILL_ID` constants
- [ ] Replace string breed/profession with `BREED`/`PROFESSION` constants
- [ ] Use `createTestProfile()` instead of manual profile objects
- [ ] Use `mountWithContext()` instead of raw `mount()`
- [ ] Remove `getSkillName()` mocks (no longer needed)
- [ ] Add `standardCleanup()` to `afterEach()`
- [ ] Verify numeric IDs in assertions

## Common Mistakes

### ❌ Don't Do This

```typescript
// String keys
expect(result).toHaveProperty('Assault Rifle');

// String breed/profession
profile.Character.Breed = "Solitus";

// Raw mount without context
mount(Component, { props: {...} });

// Missing cleanup
// (no afterEach cleanup)
```

### ✅ Do This Instead

```typescript
// Numeric IDs
expect(result).toHaveProperty(SKILL_ID.ASSAULT_RIF);

// Numeric breed/profession
profile = createTestProfile({ breed: BREED.SOLITUS });

// Mount with context
mountWithContext(Component, { props: {...} });

// Proper cleanup
afterEach(() => standardCleanup());
```

## Need Help?

- Full docs: `/frontend/src/__tests__/helpers/README.md`
- Working example: `/frontend/src/__tests__/lib/tinkerprofiles/ip-calculator.test.ts`
- Skill mappings: `/frontend/src/lib/tinkerprofiles/skill-mappings.ts`
- Fix patterns: `/.docs/plans/test-refactoring/fix-patterns-and-examples.docs.md`
