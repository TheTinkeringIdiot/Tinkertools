# Bug: Profile Activation Causes Skill Modification Errors

## Status
**ACTIVE - Under Investigation**

## Summary
When clicking "Set Active" button in TinkerProfileDetail view for a fresh level 1 profile, spurious skill modification errors occur for specific skills (Nano Pool, Deflect, Body Dev, Duck-Exp, Dodge-Rng, Evade-ClsC, Nano Resist). The errors claim these skills are being raised to value 12, which exceeds their natural caps (10-11).

## Key Findings

### The Error Pattern
```
Failed to modify skill: Error: Cannot raise Nano Pool to 12, exceeds natural cap of 10
Failed to modify skill: Error: Cannot raise Deflect to 12, exceeds natural cap of 10
Failed to modify skill: Error: Cannot raise Body Dev. to 12, exceeds natural cap of 11
Failed to modify skill: Error: Cannot raise Duck-Exp to 12, exceeds natural cap of 10
Failed to modify skill: Error: Cannot raise Dodge-Rng to 12, exceeds natural cap of 10
Failed to modify skill: Error: Cannot raise Evade-ClsC to 12, exceeds natural cap of 10
Failed to modify skill: Error: Cannot raise Nano Resist to 12, exceeds natural cap of 10
```

### Critical Observations

1. **Only happens in TinkerProfileDetail view**: Activating from profile list view works fine
2. **Only specific skills affected**: Always the same 7 skills (6 core attributes + 7 defensive skills)
3. **Value is always 12**: Error says trying to set to 12, but stored values are correct (base=5, trickle=1, total=6)
4. **Occurs after multiple recalculations**: Console shows 8 profile saves before errors appear
5. **No SkillSlider watcher logs**: Despite extensive debugging, SkillSlider watchers aren't logging when errors occur
6. **When switching profiles**: SkillSlider watchers DO fire showing oldValue from previous active profile (e.g., oldValue=270 → newValue=6)

### Where Value 12 Comes From
The value 12 appears to be: base(5) + trickle(1) + total(6) = 12
This suggests something is SUMMING all the SkillData components instead of just using `total`.

### Console Output Pattern
```
[8x Profile saves with recalculateHealthAndNano]
[ProfileStorage] Saved profile...
[Then errors occur]
Failed to modify skill: Cannot raise Nano Pool to 12...
[More recalculations after errors]
```

## Code Locations

### Error Origin
- **Stack trace**: `handleSkillChange TinkerProfileDetail.vue:399` (now line ~407 with debug logs added)
- **Error logged at**: `TinkerProfileDetail.vue:407`
- **Store function**: `tinkerProfiles.ts:724` (modifySkill)
- **IP integrator validation**: `ip-integrator.ts:684` (line that checks `newValue > baseSkillCap`)

### Key Files Modified During Investigation
1. **SkillSlider.vue**:
   - Added `isProgrammaticUpdate` flag (lines 205)
   - Added profile watcher (lines 592-602) - NOT firing
   - Added watcher logging (line 613) - shows profile switches but not initial load errors
   - Modified `onInputChanged` to check flag (lines 542-544)
   - Modified `onSliderChanged` with logging (needs to be added)

2. **TinkerProfileDetail.vue**:
   - Modified `setActiveProfile` to update `profileData` (lines 357-361)
   - Added debug logging to `handleSkillChange` (lines 394-395) - **NOT appearing in console yet**

3. **tinkerProfiles.ts** (store):
   - No modifications, but `setActiveProfile` calls recalculations

## Debugging Strategy

### Current Theory
The emissions are coming from somewhere OTHER than the SkillSlider watchers we've been debugging, because:
1. No SkillSlider watcher logs appear before errors (when opening level 1 profile directly)
2. The `[TinkerProfileDetail] handleSkillChange called` logs we added aren't showing (code may not have reloaded)
3. Errors occur AFTER 8 profile saves, suggesting a delayed or cascading trigger

### Next Steps
1. **Hard refresh browser** (Ctrl+Shift+R) to ensure latest code loads
2. **Check console for**: `[TinkerProfileDetail] handleSkillChange called` logs with call stack
3. **If logs appear**: Examine call stack to find emission source
4. **If logs don't appear**: Issue is earlier in the emission chain

### Alternative Investigation Paths
1. Check if there's another component emitting skill-changed events
2. Look for automatic skill initialization when profile becomes active
3. Check equipment watchers in tinkerProfiles.ts (setupEquipmentWatchers at line 1050)
4. Investigate why profile is saved 8 times before errors

## Relevant Code Patterns

### SkillData Structure
```typescript
{
  base: 5,           // Base skill value
  trickle: 1,        // Trickle-down from abilities
  pointsFromIp: 0,   // IP improvements
  equipmentBonus: 0,
  perkBonus: 0,
  buffBonus: 0,
  ipSpent: 0,
  cap: 11,           // Natural cap
  total: 6           // Sum of base + trickle + pointsFromIp
}
```

### Profile Update Flow (TinkerProfileDetail)
```
User clicks "Set Active"
  → profilesStore.setActiveProfile(profileId)
    → profileManager.setActiveProfile()
    → loadProfile(profileId)
      → updateProfileWithIPTracking()
        → recalculateProfileIP()
          → [8x saves occur here]
    → setupEquipmentWatchers()
  → profileData.value = updatedProfile  [Line 360]
    → SkillsManager re-renders with new data
      → SkillSliders see prop changes
        → Watchers fire (but not logging?)
          → InputNumber v-model updates
            → @update:model-value fires?
              → onInputChanged called?
                → emit('skill-changed', ...)
                  → handleSkillChange(...)
                    → ERROR!
```

## Questions to Answer
1. Why are exactly those 7 skills affected?
2. Why does activation from list view work but detail view doesn't?
3. Where does the value 12 come from if stored values are correct?
4. Why 8 profile saves before errors?
5. Why no SkillSlider watcher logs when errors occur?
6. Is there a component between SkillsManager and SkillSlider that could be emitting?

## Testing Notes
- **Reproduces**: 100% when clicking "Set Active" on level 1 profile in detail view
- **Does NOT reproduce**: When activating from profile list checkbox
- **Profile state**: Fresh level 1, no IP spent, all default values
- **Browser**: Testing in Chrome with Vue DevTools

## Files to Review
- `frontend/src/views/TinkerProfileDetail.vue` (main view with Set Active button)
- `frontend/src/components/profiles/skills/SkillSlider.vue` (skill input component)
- `frontend/src/components/profiles/skills/SkillsManager.vue` (parent of SkillSlider)
- `frontend/src/stores/tinkerProfiles.ts` (profile store with setActiveProfile)
- `frontend/src/lib/tinkerprofiles/ip-integrator.ts` (validation logic)