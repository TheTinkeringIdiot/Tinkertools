# TinkerNanos Profile-Based Nano Compatibility

## Overview

TinkerNanos profile integration enables automatic filtering and visual indication of nano programs based on character skill requirements. The feature integrates with TinkerProfiles to check whether a character can use (cast) each nano program, providing a hybrid visibility approach that balances discoverability with focused views.

**Status**: Implemented
**Version**: 4.0.0+
**Feature Type**: Profile Integration
**Component**: ProfessionNanoDisplay.vue

## User Perspective

### What Users See

1. **Compatibility Toggle**: "Show Unusable" toggle button next to the Sort dropdown in the header
   - ON (default): All nanos visible, unusable ones visually dimmed
   - OFF: Only usable nanos displayed in the list

2. **Visual Indication**: When toggle is ON and a nano cannot be used:
   - 60% opacity applied to entire row
   - Subtle background tint (semi-transparent surface color)
   - Nano remains clickable and navigable

3. **Clickable Nano Names**: Nano names are RouterLink components linking to ItemDetail pages

4. **Reactive Updates**: Display automatically updates when:
   - Active profile changes in TinkerProfiles
   - Toggle preference changes
   - Profession selection changes

### User Scenarios

#### Scenario 1: No Active Profile
- User views TinkerNanos without an active profile
- All nanos appear normal (no dimming or filtering)
- Toggle has no effect (all nanos shown)
- Graceful degradation ensures functionality without profiles

#### Scenario 2: Active Profile with Toggle ON (Default)
- User has active Nanotechnician profile loaded
- All nanos visible in the list
- Nanos the character cannot use appear dimmed with background tint
- User can discover high-level nanos they're working towards
- Clicking dimmed nano navigates to detail page for requirements research

#### Scenario 3: Active Profile with Toggle OFF
- User toggles "Show Unusable" to OFF
- Only nanos the character can currently use are displayed
- Clean, focused view for practical casting decisions
- Toggle preference persists across sessions (localStorage)

#### Scenario 4: Profile Switching
- User switches from Profile A to Profile B in TinkerProfiles
- TinkerNanos detects the profile change via store watcher
- Compatibility recalculates immediately
- Display updates without page refresh
- Previously dimmed nanos may become usable (or vice versa)

## Data Flow

### Initial Load Flow
```
User navigates to TinkerNanos
  ↓
ProfessionNanoDisplay mounts
  ↓
Watch on selectedProfession triggers (immediate: true)
  ↓
loadNanos() → Fetch nanos from API
  ↓
loadActiveProfile() → Load from ProfileStorage
  ↓
IF activeProfile exists:
  mapProfileToStats(profile) → characterStats
  console.log('Active profile loaded for nano compatibility')
ELSE:
  characterStats = null
  console.log('No active profile found')
  ↓
loadShowUnusablePreference() → Read from localStorage
  ↓
showUnusableNanos set from 'tinkertools_nano_show_unusable'
  ↓
nanosByStrain computed property recalculates
  ↓
FOR EACH nano in filtered list:
  canUseNano(nano) checks USE action requirements
  IF showUnusableNanos is ON:
    Apply CSS classes based on canUseNano result
  ELSE:
    Filter out unusable nanos completely
  ↓
Display updated list
```

### Profile Change Flow
```
User switches active profile in TinkerProfiles
  ↓
profileStore.activeProfile changes
  ↓
Watcher on profileStore.activeProfile triggers
  ↓
activeProfile.value = newProfile
  ↓
IF newProfile exists:
  characterStats = mapProfileToStats(newProfile)
  console.log('Active profile changed, updating nano compatibility')
ELSE:
  characterStats = null
  console.log('Active profile cleared')
  ↓
nanosByStrain computed property re-evaluates
  ↓
canUseNano() checks run with new characterStats
  ↓
Display updates reactively
```

### Requirement Checking Flow
```
canUseNano(nano) called
  ↓
IF no characterStats OR no nano.actions:
  return true (show as usable)
  ↓
Find USE action (action type 3) in nano.actions
  ↓
IF no USE action OR no criteria:
  return true (no requirements = usable)
  ↓
parseAction(useAction) → Parse action structure
  ↓
checkActionRequirements(parsedAction, characterStats)
  ↓
Returns { canPerform: boolean, ... }
  ↓
canPerform determines if nano is usable
```

### Toggle Preference Persistence Flow
```
User toggles "Show Unusable" button
  ↓
showUnusableNanos.value changes
  ↓
Watcher on showUnusableNanos triggers
  ↓
saveShowUnusablePreference() called
  ↓
localStorage.setItem('tinkertools_nano_show_unusable', JSON.stringify(value))
  ↓
nanosByStrain computed property filters nanos
  ↓
IF showUnusableNanos is true:
  Include all nanos, apply CSS classes conditionally
ELSE:
  Filter to only usable nanos
  ↓
Display updates
```

## Implementation

### Key Files

- `/frontend/src/components/nanos/ProfessionNanoDisplay.vue` - Main component implementing profile compatibility
  - Lines 27-36: Compatibility toggle UI
  - Lines 152-158: Conditional CSS classes for visual dimming
  - Lines 174-182: RouterLink for clickable nano names
  - Lines 259-263: Profile-related imports
  - Lines 292-303: State management for profile and toggle
  - Lines 387-398: Filtering logic in nanosByStrain computed
  - Lines 489-525: Profile loading and requirement checking functions
  - Lines 527-544: LocalStorage preference persistence
  - Lines 546-576: Watchers for reactive updates

- `/frontend/src/lib/tinkerprofiles/storage.ts` - ProfileStorage class for loading active profile
  - `loadActiveProfile()` method used to retrieve current profile

- `/frontend/src/utils/profile-stats-mapper.ts` - Maps TinkerProfile to stat dictionary
  - `mapProfileToStats(profile)` function converts profile to Record<number, number>

- `/frontend/src/services/action-criteria.ts` - Action requirement checking
  - `parseAction(action)` - Parses action structure
  - `checkActionRequirements(action, stats)` - Validates if character meets requirements

- `/frontend/src/stores/tinkerProfiles.ts` - Pinia store for profile state
  - `activeProfile` reactive property watched for changes

### Database

No database changes required. Uses existing:
- **items.actions** - Contains USE action (action type 3) with criteria
- **Profile data** - Stored client-side in IndexedDB via TinkerProfiles

## Configuration

- **LocalStorage Key**: `tinkertools_nano_show_unusable`
  - Type: boolean (stored as JSON)
  - Default: true (show all nanos with dimming)
  - Persists across sessions

## Usage Example

```typescript
// Check if character can use a nano
function canUseNano(nano: Item): boolean {
  if (!characterStats.value || !nano.actions || nano.actions.length === 0) {
    return true // No profile or no requirements = show as usable
  }

  // Find USE action (action type 3)
  const useAction = nano.actions.find(action => action.action === 3)
  if (!useAction || !useAction.criteria || useAction.criteria.length === 0) {
    return true // No USE action or no criteria = usable
  }

  // Check requirements
  const parsedAction = parseAction(useAction)
  const { canPerform } = checkActionRequirements(parsedAction, characterStats.value)
  return canPerform
}

// Apply conditional classes in template
<tr
  :class="{
    'opacity-60': !canUseNano(nano) && showUnusableNanos,
    'bg-surface-100/30 dark:bg-surface-800/30': !canUseNano(nano) && showUnusableNanos
  }"
>
```

## Testing

### Manual Test Scenarios

1. **No Profile Test**
   - Clear active profile in TinkerProfiles
   - Navigate to TinkerNanos
   - Expected: All nanos visible with normal opacity, no dimming

2. **Profile Integration Test**
   - Create low-level Nanotechnician profile (level 50)
   - Set as active profile
   - Navigate to TinkerNanos
   - Expected: High-QL nanos appear dimmed (opacity-60)

3. **Toggle Functionality Test**
   - With active profile, toggle "Show Unusable" to OFF
   - Expected: Only usable nanos displayed, dimmed nanos removed
   - Toggle back to ON
   - Expected: All nanos reappear with dimming applied

4. **Preference Persistence Test**
   - Set toggle to OFF
   - Refresh page
   - Expected: Toggle remains OFF (localStorage persisted)

5. **Profile Switching Test**
   - Load Profile A (low skills)
   - Note which nanos are dimmed
   - Switch to Profile B (high skills)
   - Expected: Previously dimmed nanos become normal, compatibility recalculated

6. **Clickable Names Test**
   - Click on dimmed nano name
   - Expected: Navigate to ItemDetail page showing requirements

### Expected Behavior

- **Performance**: Compatibility checks complete in < 100ms for 200+ nanos
- **Reactivity**: Profile changes trigger updates within 1 render cycle
- **Persistence**: Toggle preference survives browser refresh
- **Accessibility**: Toggle button keyboard-navigable, ARIA labels appropriate

## Related Documentation

- Feature: `/docs/features/tinkernukes.doc.md` - Similar profile integration pattern
- Feature: `/docs/features/tinkerprofiles-v4-architecture.doc.md` - Profile storage system
- Feature: `/docs/features/character-derived-stats.doc.md` - Stat calculation for requirements
- Feature: `/docs/features/wornitem-requirements.doc.md` - Action-criteria checking system
- Architecture: `/docs/architecture/` - TinkerProfiles integration patterns

## Future Enhancements

### Potential Improvements

1. **Skill Gap Indicators**: Show how far character is from meeting requirements (e.g., "Need 50 more Bio Meta")
2. **Requirement Tooltips**: Hover over dimmed nano to see specific skill deficiencies
3. **Multi-Criteria Toggle**: Separate toggles for different requirement types (skills, level, faction)
4. **Color-Coded Proximity**: Green (usable), yellow (close), red (far from requirements)
5. **Batch Requirements View**: Summary showing which skill improvements would unlock most nanos
6. **Profile Comparison**: Side-by-side comparison of nano availability between two profiles
7. **Mobile Optimization**: Responsive toggle placement for smaller screens
8. **Accessibility Enhancements**: Screen reader announcements for compatibility changes

## References

### Action Type Constants
```typescript
// Action types in item.actions
3: USE action (casting/equipping requirements)
```

### CSS Classes Applied
```typescript
// When nano is unusable and showUnusableNanos is true:
'opacity-60': Reduces opacity to 60%
'bg-surface-100/30': Light mode background tint (30% opacity)
'dark:bg-surface-800/30': Dark mode background tint (30% opacity)
```

### Key Skill IDs (Nano Schools)
```typescript
126: Sensory Improvement
127: Matter Metamorphosis
128: Biological Metamorphosis
129: Psychological Modifications
130: Matter Creation
131: Time and Space
152: Computer Literacy
221: Max Nano Pool
```

### Related Components
- `TinkerNukes.vue` - Uses same profile integration pattern for offensive nanos
- `WornItemDisplay.vue` - Uses same action-criteria checking system for equipment
- `ProfileSelector.vue` - Source of active profile changes
