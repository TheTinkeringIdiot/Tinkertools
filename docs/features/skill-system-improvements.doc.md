# TinkerProfiles Skill System - ID-Based Architecture (v4.0.0)

## Overview

This feature represents a major architectural refactoring of the TinkerProfiles skill system, migrating from name-based nested structures to a unified ID-based architecture. The refactoring introduces new service patterns, type safety improvements, and unified skill data structures while maintaining backward compatibility for calculations and IP integration.

## Key Architectural Changes

### 1. ID-Based Skill Architecture
- **Migration**: From `profile.Skills.Category.SkillName` to `profile.skills[skillId]`
- **Benefits**: Type safety, consistent identification, better performance
- **Impact**: Eliminates skill name matching issues and string-based lookups

### 2. Unified SkillData Structure
- **Replaces**: Separate `SkillWithIP` and `MiscSkill` types
- **Structure**: `{ base, trickle, ipSpent, pointsFromIp, equipmentBonus, perkBonus, buffBonus, total }`
- **Impact**: Consistent data structure for all skill types (regular, Misc, ACs)

### 3. New Service Layer
- **SkillService**: Singleton service for ID↔name resolution and metadata operations
- **useSkills Composable**: Reactive composition API for skill operations in Vue components
- **Pattern Matching**: Enhanced regex-based skill name resolution via `skill-patterns.ts`

### 4. Enhanced Type Safety
- **Branded Types**: `SkillId` type prevents accidental usage of regular numbers
- **Error Classes**: `SkillNotFoundError`, `InvalidSkillIdError`, `InvalidCategoryError`
- **Type Guards**: `isSkillId()` and `toSkillId()` for safe conversions

### 5. Component Refactoring
- **SkillCategory.vue**: Now operates on ID-based skill objects instead of name-based
- **SkillSlider.vue**: Enhanced to use `skillId` props instead of `skillName`
- **SkillsManager.vue**: Integrates with `useSkills` composable for reactive skill access

### 6. Improved IP Integration
- **Unified Updates**: All skill types updated through single `updateProfileSkillInfo()` path
- **Better Bonus Handling**: Equipment, perk, and buff bonuses applied consistently across skill types
- **AC Calculations**: On-demand calculation prevents accumulation bugs

## Data Flow

### v4.0.0 Architecture
1. **Skill Resolution**: `SkillService` resolves names to IDs using three-tier matching (exact → case-insensitive → pattern)
2. **Profile Storage**: Skills stored as `profile.skills[skillId]` with unified `SkillData` structure
3. **Bonus Calculation**: Equipment, perk, and buff bonuses calculated by ID and applied uniformly
4. **UI Access**: Components use `useSkills` composable for reactive skill data and operations
5. **Type Safety**: Branded `SkillId` type prevents ID/string confusion throughout the system

### Migration Pattern
```typescript
// Old v3.x approach
const skill = profile.Skills['Melee Weapons']['1h Blunt'];
const value = skill.value;

// New v4.0.0 approach
const skillId = skillService.resolveId('1h Blunt'); // Returns 102
const skill = profile.skills[skillId];
const value = skill.total;
```

## Implementation

### Key Files Refactored

#### New Service Layer Architecture
- `frontend/src/services/skill-service.ts` - **NEW** Singleton service for skill ID operations
- `frontend/src/composables/useSkills.ts` - **NEW** Reactive composition API for Vue components
- `frontend/src/types/skills.ts` - **NEW** Type definitions for branded types and interfaces

#### Core Logic Refactored (558+ line changes)
- `frontend/src/lib/tinkerprofiles/ip-integrator.ts` - Major refactoring to ID-based skill operations
- `frontend/src/lib/tinkerprofiles/types.ts` - Unified `SkillData` type replacing multiple skill interfaces
- `frontend/src/utils/skill-patterns.ts` - Enhanced pattern matching with corrected skill ID mappings

#### UI Components Refactored (178+ line changes)
- `frontend/src/components/profiles/skills/SkillCategory.vue` - ID-based skill iteration and display
- `frontend/src/components/profiles/skills/SkillSlider.vue` - `skillId` props instead of `skillName`
- `frontend/src/components/profiles/skills/SkillsManager.vue` - Integration with `useSkills` composable
- `frontend/src/components/profiles/skills/SkillsGrid.vue` - Grid display using ID-based access
- `frontend/src/components/profiles/skills/StatBreakdownTooltip.vue` - Enhanced tooltips with service integration

#### Supporting Infrastructure
- All bonus calculators enhanced to work with skill ID resolution
- Store integration updated for ID-based skill access patterns
- Profile loading/saving maintains compatibility with new skill structure

## User-Facing Changes

### Improved Reliability
- **Consistent Skill Access**: Skills identified by stable IDs rather than string names
- **Enhanced Pattern Matching**: Better recognition of skill name variations (e.g., "1h Blunt", "1hBlunt", "One-Handed Blunt")
- **Type Safety**: Reduced runtime errors from invalid skill name references
- **Better Performance**: O(1) skill lookups instead of string-based searches

### Enhanced Developer Experience
- **Composable API**: `useSkills()` provides reactive skill operations in Vue components
- **Service Layer**: `SkillService` offers comprehensive skill metadata and resolution
- **Type Safety**: Branded `SkillId` type prevents accidental integer/skill ID confusion
- **Error Handling**: Descriptive error messages with suggestions for invalid skill names/IDs

### Maintained Functionality
- **Backward Compatibility**: Existing skill calculations and IP integration unchanged
- **UI Consistency**: Same skill display and interaction patterns for users
- **Profile Compatibility**: Existing profiles continue to work with new architecture

## Testing Considerations

### Critical Test Cases
1. **Skill Resolution**: Verify `skillService.resolveId()` handles all skill name variations correctly
2. **Component Integration**: Ensure all skill components work with ID-based props instead of names
3. **Profile Migration**: Test backward compatibility with existing profile structures
4. **Type Safety**: Verify branded `SkillId` types prevent runtime errors
5. **Service Patterns**: Test `useSkills` composable provides correct reactive data

### Performance Impact
- **Improved**: O(1) skill lookups replace string-based searches
- **Optimized**: Single service instance eliminates repeated pattern matching
- **Efficient**: Composable API reduces duplicate reactive computations

## Usage Example

### Basic Skill Operations
```typescript
import { skillService } from '@/services/skill-service';
import { useSkills } from '@/composables/useSkills';

// Resolve skill names to IDs
const oneHandBluntId = skillService.resolveId('1h Blunt'); // 102
const maxNcuId = skillService.resolveId('Max NCU'); // 181

// Get skill metadata
const metadata = skillService.getMetadata(oneHandBluntId);
// { id: 102, name: '1h Blunt', shortName: '1hB', category: 'Melee Weapons', sortOrder: 45 }

// Use in Vue components
const { getSkillsByCategory, getSkillValue } = useSkills();
const meleeSkills = getSkillsByCategory('Melee Weapons');
const oneHandBluntValue = getSkillValue(102);
```

### Component Integration
```vue
<!-- Before (v3.x) -->
<SkillSlider
  skill-name="1h Blunt"
  :skill-data="profile.Skills['Melee Weapons']['1h Blunt']"
/>

<!-- After (v4.0.0) -->
<SkillSlider
  :skill-id="102"
  :skill-data="profile.skills[102]"
/>
```

## Breaking Changes

### Architecture Migration
- **Profile Structure**: Skills moved from nested categories to flat `skills[id]` object
- **Component Props**: Skill components now expect `skillId` instead of `skillName`
- **Type Definitions**: New branded `SkillId` type replaces generic numbers

### Backward Compatibility
- **Profile Loading**: Automatic migration handles old profile structures
- **API Compatibility**: Existing bonus calculators work with ID-based resolution
- **User Interface**: No visible changes to skill display or interaction patterns

## Dependencies

### New Internal Dependencies
- `frontend/src/services/skill-service.ts` - Core skill resolution and metadata service
- `frontend/src/composables/useSkills.ts` - Vue composition API for reactive skill operations
- `frontend/src/types/skills.ts` - Type definitions for skill system

### Existing System Integration
- Maintains compatibility with IP calculation system (`ip-integrator.ts`)
- Works with existing bonus calculators (equipment, perk, nano)
- Integrates with TinkerProfiles store and profile management

### External Dependencies
- Vue 3 Composition API for reactive patterns
- TypeScript for branded types and enhanced type safety
- PrimeVue components for UI consistency

## Summary

This v4.0.0 architectural refactoring modernizes the TinkerProfiles skill system with ID-based architecture, enhanced type safety, and service patterns. The migration from name-based nested structures to unified skill data provides better performance, reliability, and developer experience while maintaining full backward compatibility.

Key benefits include:
- **Type Safety**: Branded `SkillId` types prevent common runtime errors
- **Performance**: O(1) skill lookups replace string-based searches
- **Maintainability**: Service layer centralizes skill operations
- **Reliability**: Enhanced pattern matching handles skill name variations
- **Developer Experience**: Composable API integrates cleanly with Vue components

The refactoring maintains all existing functionality while providing a foundation for future skill system enhancements and optimizations.