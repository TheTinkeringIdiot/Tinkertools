# TinkerProfiles Equipment Tracking

## Overview
The TinkerProfiles equipment tracking system allows users to equip items from the item database directly to their character profiles and automatically calculates stat bonuses from equipped gear. This provides real-time character stat calculation and equipment management functionality.

## User Perspective
When viewing an item detail page, users can click an "Equip" button that appears when they have an active TinkerProfile. This opens a slot selection dialog showing all valid equipment slots for that item type. Users can see which slots are currently occupied and choose where to equip the item. The system automatically updates the character's stats when items are equipped or unequipped, providing instant feedback on how gear changes affect their character.

## Data Flow
1. User clicks "Equip" button on item detail page
2. System determines valid equipment slots based on item class (weapon, armor, implant)
3. EquipSlotSelector component displays available slots with current occupancy status
4. User selects a slot and confirms equipping
5. TinkerProfiles store executes equipItem() method
6. Profile data is updated with new equipment in specified slot
7. Stat calculation system recalculates all character bonuses
8. Profile is automatically saved to localStorage
9. UI updates with success toast notification and new stat values

## Implementation

### Key Files
- `frontend/src/views/ItemDetail.vue` - Adds "Equip" button and integrates with equipment system
- `frontend/src/components/items/EquipSlotSelector.vue` - Modal dialog for selecting equipment slots
- `frontend/src/stores/tinkerProfiles.ts` - Equipment management methods (equipItem, unequipItem)
- `frontend/src/App.vue` - Added Toast component for equipment notifications
- `frontend/src/main.ts` - Added ToastService configuration

### Database
- No backend database changes required - all equipment data stored in localStorage as part of profile structure
- Equipment categories: Weapons, Clothing, Implants with predefined slot mappings

## Configuration
- Toast notifications: 3000ms lifetime for equipment success/error messages
- Equipment slot validation: Based on item_class values (1=Weapon, 2=Armor, 3=Implant)
- Auto-selection: Empty slots preferred, single slot auto-selected in dialog

## Usage Example
```typescript
// Equipping an item from the store
await profilesStore.equipItem(item, 'RightHand');

// Unequipping from a slot
await profilesStore.unequipItem('Weapons', 'RightHand');

// Equipment categories and slots
const weaponSlots = ['HUD1', 'HUD2', 'HUD3', 'RightHand', 'LeftHand', 'Deck1-6'];
const clothingSlots = ['Head', 'Body', 'Arms', 'Legs', 'Feet', 'Neck', 'Belt'];
const implantSlots = ['Head', 'Eye', 'Ear', 'Chest', 'Arms', 'Waist', 'Legs', 'Feet'];
```

## Testing
- Manual test: Navigate to any equippable item (weapon/armor/implant), ensure "Equip" button appears with active profile
- Select equipment slot from dialog, verify item appears in profile and stats update correctly
- Expected behavior: Toast notification confirms successful equipping, profile shows equipped item, character stats reflect equipment bonuses

## Related Documentation
- Architecture: `docs/architecture/profiles.md`
- Profile Storage: `.docs/features/individual-profile-storage.doc.md`
- Equipment Bonuses: `.docs/features/equipment-bonuses.doc.md`