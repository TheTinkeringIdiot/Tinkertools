# Action Criteria Target Modifiers

## Overview
Implemented support for modifier operator 18 in the action-criteria service, which marks subsequent criteria as applying to the target rather than the caster. This enables accurate display of nano programs and item requirements that have different conditions for the caster and target (e.g., healing nanos that check target's health, offensive nanos that check target's level).

## User Perspective
When viewing nano programs and items with target-specific requirements, users now see clear distinctions between:
- Requirements the character must meet to use/cast (e.g., "Level ≥ 150")
- Requirements the target must meet (e.g., "Target: Level ≥ 200")

Previously, all criteria appeared as character requirements, creating confusion about whether a nano could be cast on a specific target. This is especially important for healing nanos, buff nanos, and debuff nanos where target conditions matter.

**Example:**
- Before: "Level ≥ 150" (unclear if this is caster or target)
- After: "Level ≥ 150" for caster requirement, "Target: Level ≥ 200" for target requirement

## Data Flow

### Criteria Processing Flow
1. **Parse Criteria**: Raw criteria from database transformed into DisplayCriterion objects
2. **Detect Modifiers**: Operator 18 identified as modifier operator (not stat requirement or logical operator)
3. **Apply Modifiers**: Next criterion marked with `isTargetRequirement: true` and description prefixed with "Target:"
4. **Clear Modifier**: Modifier flag cleared after applying to one criterion
5. **Build Tree**: Processed criteria used in tree building (modifiers already removed from output)
6. **Display**: UI components show target requirements with special formatting

### Processing Pipeline
```typescript
// Input: Raw criteria from database
[
  { id: 1, value1: 54, value2: 149, operator: 2 },  // Level > 149 (≥ 150)
  { id: 2, value1: 0, value2: 0, operator: 18 },    // MODIFIER: Apply to target
  { id: 3, value1: 54, value2: 199, operator: 2 }   // Level > 199 (≥ 200)
]

// Step 1: Transform to DisplayCriterion
[
  { stat: 54, description: "Level ≥ 150", isStatRequirement: true },
  { stat: 0, description: "Apply to target", isModifier: true, modifierType: 'target' },
  { stat: 54, description: "Level ≥ 200", isStatRequirement: true }
]

// Step 2: Process modifiers
[
  { stat: 54, description: "Level ≥ 150", isStatRequirement: true },
  // Modifier removed from output
  { stat: 54, description: "Target: Level ≥ 200", isStatRequirement: true, isTargetRequirement: true }
]

// Step 3: Build tree and display
Requirements:
- Level ≥ 150 (caster)
- Target: Level ≥ 200
```

## Implementation

### Key Files

#### Core Logic - `frontend/src/services/action-criteria.ts`

**Interface Changes** (Lines 47-50):
```typescript
export interface DisplayCriterion {
  // ... existing fields
  // Modifier fields - NEW
  isModifier?: boolean;           // True if this is operator 18
  modifierType?: 'target';        // Type of modifier (currently only 'target')
  isTargetRequirement?: boolean;  // True if this requirement applies to target
}
```

**New Constants** (Lines 118-120):
```typescript
const MODIFIER_OPERATORS = {
  18: 'target', // Next criterion applies to target, not caster
} as const;
```

**Modified Functions:**

1. **`transformCriterionForDisplay()`** - Lines 154-171
   - Added modifier operator detection (checked BEFORE logical operators)
   - Creates DisplayCriterion with `isModifier: true` for operator 18
   - Returns modifier metadata: `modifierType: 'target'`, `description: "Apply to target"`
   - Modifiers are NOT stat requirements or logical operators

2. **`processCriteriaWithModifiers()`** - Lines 689-716 (NEW FUNCTION)
   - Processes criteria array to apply modifier effects
   - Maintains `activeModifier` state variable
   - When modifier encountered: Set flag and skip adding to output
   - When stat requirement encountered with active modifier:
     - Mark as `isTargetRequirement: true`
     - Prefix description with "Target: "
     - Clear modifier flag (applies to one criterion only)
   - Returns processed array with modifiers removed

3. **`buildCriteriaTree()`** - Lines 638-640
   - Calls `processCriteriaWithModifiers()` BEFORE filtering and tree building
   - Ensures all tree operations work with modifier-applied criteria
   - Modifiers invisible to tree logic (already processed out)

4. **`buildTreeFromRPN()`** - Lines 727-729
   - Also calls `processCriteriaWithModifiers()` for complex tree building
   - Ensures consistency between simple and complex tree paths

**Code Example:**
```typescript
// BEFORE: Operator 18 treated as state operator
const STATE_OPERATORS = {
  18: 'State check',  // Generic, unclear purpose
  // ... other state operators
}

// AFTER: Operator 18 as modifier operator (separate constant)
const MODIFIER_OPERATORS = {
  18: 'target',  // Clearly defined: next criterion applies to target
} as const;

const STATE_OPERATORS = {
  // Operator 18 removed
  44: 'Must be NPC',
  // ... other state operators
} as const;
```

```typescript
// NEW: Modifier processing function
function processCriteriaWithModifiers(criteria: DisplayCriterion[]): DisplayCriterion[] {
  const processed: DisplayCriterion[] = [];
  let activeModifier: 'target' | null = null;

  for (const criterion of criteria) {
    // Handle modifier operators
    if (criterion.isModifier) {
      activeModifier = criterion.modifierType || null;
      continue; // Skip adding modifier to output
    }

    // Apply active modifier to this criterion
    if (activeModifier && (criterion.isStatRequirement || criterion.isFunctionOperator)) {
      processed.push({
        ...criterion,
        isTargetRequirement: activeModifier === 'target',
        description: activeModifier === 'target'
          ? `Target: ${criterion.description}`
          : criterion.description,
      });
      activeModifier = null; // Clear after applying
    } else {
      processed.push(criterion);
    }
  }

  return processed;
}
```

### Processing Order
The modifier check in `transformCriterionForDisplay()` occurs BEFORE logical operator check to ensure operator 18 is not misidentified:

```typescript
export function transformCriterionForDisplay(criterion: Criterion): DisplayCriterion {
  const { id, value1: stat, value2: value, operator } = criterion;
  const statName = getStatName(stat) || `Stat ${stat}`;

  // 1. Handle modifier operators FIRST (before logical operator check)
  if (operator in MODIFIER_OPERATORS) {
    // ... return modifier DisplayCriterion
  }

  // 2. Check for logical operators (separators and logical ops)
  if (stat === 0 && value === 0) {
    // ... return logical DisplayCriterion
  }

  // 3. Handle state operators
  // 4. Handle function operators
  // 5. Handle standard stat requirements
}
```

## Configuration
- **Modifier Types**: Currently only `'target'` is supported (operator 18)
- **Modifier Scope**: Applies to exactly one criterion (cleared after application)
- **Modifier Targets**: Can apply to stat requirements or function operators

## Usage Example

### Nano with Target Level Requirement
```typescript
// Database criteria for healing nano
const criteria: Criterion[] = [
  { id: 1, value1: 54, value2: 149, operator: 2 },   // Caster Level > 149 (≥150)
  { id: 2, value1: 0, value2: 0, operator: 18 },     // MODIFIER: target
  { id: 3, value1: 54, value2: 199, operator: 2 }    // Target Level > 199 (≥200)
];

// After processing
const displayCriteria = criteria.map(transformCriterionForDisplay);
const processed = processCriteriaWithModifiers(displayCriteria);

// Result:
[
  {
    description: "Level ≥ 150",
    isStatRequirement: true,
    isTargetRequirement: false  // Applies to caster
  },
  {
    description: "Target: Level ≥ 200",
    isStatRequirement: true,
    isTargetRequirement: true   // Applies to target
  }
]
```

### Nano with Multiple Target Requirements
```typescript
// Database criteria for complex buff
const criteria: Criterion[] = [
  { id: 1, value1: 54, value2: 149, operator: 2 },   // Caster Level ≥ 150
  { id: 2, value1: 0, value2: 0, operator: 18 },     // MODIFIER: target
  { id: 3, value1: 54, value2: 100, operator: 2 },   // Target Level ≥ 101
  { id: 4, value1: 0, value2: 0, operator: 4 },      // AND
  { id: 5, value1: 0, value2: 0, operator: 18 },     // MODIFIER: target (again)
  { id: 6, value1: 60, value2: 5, operator: 0 }      // Target Profession = Agent
];

// Result after processing:
Requirements (3 total):
- Level ≥ 150               (caster requirement)
- Target: Level ≥ 101       (target requirement)
- Target: Profession = Agent (target requirement)
```

## Design Pattern

### Modifier Operator Pattern
The modifier operator pattern is distinct from other operator types:

1. **Not a Requirement**: Doesn't represent a stat check or constraint
2. **Not a Logical Operator**: Doesn't combine other criteria (AND/OR/NOT)
3. **Not a State Operator**: Doesn't check character state
4. **Metadata Operator**: Modifies interpretation of following criterion

### Single-Use Semantics
Modifiers apply to exactly ONE criterion:
- **Apply**: Modifier flag set when encountered
- **Attach**: Next stat requirement gets modifier metadata
- **Clear**: Modifier flag cleared after application

This prevents accidental "sticky" modifiers affecting multiple criteria.

### Processing Before Tree Building
Modifiers are processed BEFORE tree building to ensure:
- Tree operations don't need modifier-aware logic
- Modifiers don't appear as nodes in tree
- Target requirements are already marked when tree is evaluated

## Testing

### Unit Tests
Tests should be added to `frontend/src/services/__tests__/action-criteria.test.ts`:

```typescript
describe('Modifier Operators', () => {
  it('should detect operator 18 as target modifier', () => {
    const criterion: Criterion = {
      id: 1,
      value1: 0,
      value2: 0,
      operator: 18
    };

    const display = transformCriterionForDisplay(criterion);

    expect(display.isModifier).toBe(true);
    expect(display.modifierType).toBe('target');
    expect(display.description).toBe('Apply to target');
  });

  it('should apply target modifier to next criterion', () => {
    const criteria: Criterion[] = [
      { id: 1, value1: 54, value2: 149, operator: 2 },  // Level ≥ 150
      { id: 2, value1: 0, value2: 0, operator: 18 },    // Target modifier
      { id: 3, value1: 54, value2: 199, operator: 2 }   // Level ≥ 200
    ];

    const display = criteria.map(transformCriterionForDisplay);
    const processed = processCriteriaWithModifiers(display);

    expect(processed).toHaveLength(2);  // Modifier removed
    expect(processed[0].isTargetRequirement).toBe(false);
    expect(processed[1].isTargetRequirement).toBe(true);
    expect(processed[1].description).toMatch(/^Target:/);
  });

  it('should clear modifier after one application', () => {
    const criteria: Criterion[] = [
      { id: 1, value1: 0, value2: 0, operator: 18 },    // Target modifier
      { id: 2, value1: 54, value2: 149, operator: 2 },  // Level ≥ 150 (gets modifier)
      { id: 3, value1: 60, value2: 5, operator: 0 }     // Profession = Agent (no modifier)
    ];

    const display = criteria.map(transformCriterionForDisplay);
    const processed = processCriteriaWithModifiers(display);

    expect(processed).toHaveLength(2);
    expect(processed[0].isTargetRequirement).toBe(true);   // First criterion gets modifier
    expect(processed[1].isTargetRequirement).toBe(false);  // Second criterion does NOT
  });
});
```

### Manual Testing
1. Find a nano with target requirements (operator 18 in criteria)
2. View nano details in TinkerNanos
3. Verify requirements show:
   - Caster requirements without "Target:" prefix
   - Target requirements with "Target:" prefix
4. Check requirement tree display shows correct grouping
5. Test with profile to ensure target requirements don't affect castability

### Database Query to Find Test Cases
```sql
-- Find nanos/items with operator 18 (target modifier)
SELECT i.name, i.id, c.operator, c.value1, c.value2
FROM items i
JOIN actions a ON i.id = a.item_id
JOIN action_criteria ac ON a.id = ac.action_id
JOIN criterion c ON ac.criterion_id = c.id
WHERE c.operator = 18
ORDER BY a.id, ac.order
LIMIT 20;
```

## Migration Notes

### Breaking Changes
None. This is an additive change that enhances existing functionality.

### Behavioral Changes
1. **Operator 18 Classification**: Moved from STATE_OPERATORS to new MODIFIER_OPERATORS constant
2. **Criteria Display**: Criteria following operator 18 now show "Target:" prefix
3. **Tree Structure**: Modifiers removed from criteria tree (processed before tree building)

### Frontend Updates
No updates required for consuming components:
- `transformCriterionForDisplay()` maintains same interface (added optional fields)
- `buildCriteriaTree()` maintains same interface
- Existing code automatically benefits from improved display

### UI Components
UI components rendering criteria trees should check `isTargetRequirement` flag for special styling:

```typescript
// Example: CriteriaTreeNode.vue
<template>
  <div :class="{ 'target-requirement': criterion.isTargetRequirement }">
    {{ criterion.description }}
  </div>
</template>

<style scoped>
.target-requirement {
  font-style: italic;
  color: var(--color-target-requirement);
}
</style>
```

## Performance Considerations

### Performance Impact
Minimal performance impact:
- **Processing Overhead**: O(n) single-pass through criteria array
- **Memory**: One extra boolean flag per processed criterion
- **Typical Criteria Count**: 3-10 criteria per action
- **Total Overhead**: < 1ms for typical actions

### No Network Impact
All processing happens client-side after criteria are fetched.

## Related Documentation
- Action criteria service: `frontend/src/services/action-criteria.ts`
- OR operator fix: `docs/features/action-criteria-or-operator-fix.doc.md`
- Criteria tree display: `frontend/src/components/CriteriaTreeNode.vue`
- Game operators: `frontend/src/services/game-data.ts` (OPERATOR constant)

## Known Issues and Future Work

### Future Enhancements
1. **Additional Modifier Types**: Support for other modifier operators if discovered
2. **Modifier Chaining**: Handle multiple consecutive modifiers (currently single-use)
3. **Modifier Context**: Track modifier context for better error messages
4. **UI Indicators**: Visual badges/icons for target requirements in UI
5. **Target Validation**: Check if target meets target requirements (currently display-only)

### Potential Modifier Operators
Based on game data analysis, these operators might be modifiers:
- **Operator 18**: Target modifier (implemented)
- **Operator 19-21**: Unknown (may be modifiers, need investigation)
- **Future operators**: May be discovered in nano criteria

## Conclusion
The target modifier implementation correctly handles operator 18 as a metadata operator that affects how subsequent criteria are interpreted and displayed. This improves accuracy of nano program and item requirement displays, helping users understand when requirements apply to the caster versus the target. The implementation uses a clean single-pass processing pattern that integrates seamlessly with existing criteria tree building logic.
