/**
 * Equipment Slot Mapper Service
 *
 * Handles slot name inconsistencies between UI components and TinkerProfiles constants.
 * Maps UI display names to actual profile slot keys and provides validation.
 */

// UI slot names used in components vs actual profile keys
const WEAPON_SLOT_MAPPING = {
  // UI name -> Profile key
  'Right Hand': 'RHand',
  'Left Hand': 'LHand',
  'Belt': 'Waist',
  // Keep existing mappings for other weapon slots
  'HUD1': 'HUD1',
  'HUD2': 'HUD2',
  'HUD3': 'HUD3',
  'UTILS1': 'UTILS1',
  'UTILS2': 'UTILS2',
  'UTILS3': 'UTILS3',
  'NCU1': 'NCU1',
  'NCU2': 'NCU2',
  'NCU3': 'NCU3',
  'NCU4': 'NCU4',
  'NCU5': 'NCU5',
  'NCU6': 'NCU6'
} as const;

const CLOTHING_SLOT_MAPPING = {
  // UI name -> Profile key
  'Head': 'Head',
  'Shoulder': 'RightShoulder', // Default to RightShoulder for singular "Shoulder"
  'Back': 'Back',
  'Chest': 'Body', // UI uses "Chest", profile uses "Body"
  'Arms': 'RightArm', // Default to RightArm for singular "Arms"
  'Wrists': 'RightWrist', // Default to RightWrist for singular "Wrists"
  'Hands': 'Hands',
  'Waist': 'Belt', // UI uses "Waist", profile uses "Belt"
  'Legs': 'Legs',
  'Feet': 'Feet',
  'Ring': 'RightFinger', // Default to RightFinger for singular "Ring"
  'Deck': 'Neck', // UI uses "Deck", profile uses "Neck"

  // Also support exact profile slot names
  'RightShoulder': 'RightShoulder',
  'LeftShoulder': 'LeftShoulder',
  'Body': 'Body',
  'RightArm': 'RightArm',
  'LeftArm': 'LeftArm',
  'RightWrist': 'RightWrist',
  'LeftWrist': 'LeftWrist',
  'Belt': 'Belt',
  'RightFinger': 'RightFinger',
  'LeftFinger': 'LeftFinger',
  'Neck': 'Neck'
} as const;

const IMPLANT_SLOT_MAPPING = {
  // UI name -> Profile key
  'Head': 'Head',
  'Ocular': 'Eye', // UI uses "Ocular", profile uses "Eye"
  'Ear': 'Ear',
  'Right Arm': 'RightArm',
  'Left Arm': 'LeftArm',
  'Chest': 'Chest',
  'Right Wrist': 'RightWrist',
  'Left Wrist': 'LeftWrist',
  'Waist': 'Waist',
  'Right Hand': 'RightHand',
  'Left Hand': 'LeftHand',
  'Thigh': 'Leg', // UI uses "Thigh", profile uses "Leg"
  'Right Leg': 'Leg', // Multiple UI names map to single "Leg" slot
  'Left Leg': 'Leg',
  'Feet': 'Feet',

  // Also support exact profile slot names
  'Eye': 'Eye',
  'RightArm': 'RightArm',
  'LeftArm': 'LeftArm',
  'RightWrist': 'RightWrist',
  'LeftWrist': 'LeftWrist',
  'RightHand': 'RightHand',
  'LeftHand': 'LeftHand',
  'Leg': 'Leg'
} as const;

// Reverse mappings for getting UI names from profile keys
const WEAPON_DISPLAY_MAPPING = Object.fromEntries(
  Object.entries(WEAPON_SLOT_MAPPING).map(([ui, profile]) => [profile, ui])
) as Record<string, string>;

const CLOTHING_DISPLAY_MAPPING = {
  'Head': 'Head',
  'RightShoulder': 'Shoulder',
  'LeftShoulder': 'Left Shoulder',
  'Back': 'Back',
  'Body': 'Chest',
  'RightArm': 'Arms',
  'LeftArm': 'Left Arms',
  'RightWrist': 'Wrists',
  'LeftWrist': 'Left Wrists',
  'Hands': 'Hands',
  'Belt': 'Waist',
  'Legs': 'Legs',
  'Feet': 'Feet',
  'RightFinger': 'Ring',
  'LeftFinger': 'Left Ring',
  'Neck': 'Deck'
} as const;

const IMPLANT_DISPLAY_MAPPING = {
  'Head': 'Head',
  'Eye': 'Ocular',
  'Ear': 'Ear',
  'RightArm': 'Right Arm',
  'LeftArm': 'Left Arm',
  'Chest': 'Chest',
  'RightWrist': 'Right Wrist',
  'LeftWrist': 'Left Wrist',
  'Waist': 'Waist',
  'RightHand': 'Right Hand',
  'LeftHand': 'Left Hand',
  'Leg': 'Thigh',
  'Feet': 'Feet'
} as const;

export type EquipmentType = 'weapons' | 'clothing' | 'implants';
export type WeaponSlotName = keyof typeof WEAPON_SLOT_MAPPING;
export type ClothingSlotName = keyof typeof CLOTHING_SLOT_MAPPING;
export type ImplantSlotName = keyof typeof IMPLANT_SLOT_MAPPING;

/**
 * Equipment Slot Mapper Service
 * Provides standardized slot name mapping and validation
 */
export class EquipmentSlotMapper {
  /**
   * Maps UI slot name to profile slot key
   */
  static mapToProfileSlot(uiSlotName: string, equipmentType: EquipmentType): string | null {
    switch (equipmentType) {
      case 'weapons':
        return (WEAPON_SLOT_MAPPING as Record<string, string>)[uiSlotName] || null;
      case 'clothing':
        return (CLOTHING_SLOT_MAPPING as Record<string, string>)[uiSlotName] || null;
      case 'implants':
        return (IMPLANT_SLOT_MAPPING as Record<string, string>)[uiSlotName] || null;
      default:
        return null;
    }
  }

  /**
   * Maps profile slot key to UI display name
   */
  static mapToDisplayName(profileSlotKey: string, equipmentType: EquipmentType): string | null {
    switch (equipmentType) {
      case 'weapons':
        return WEAPON_DISPLAY_MAPPING[profileSlotKey] || profileSlotKey;
      case 'clothing':
        return (CLOTHING_DISPLAY_MAPPING as Record<string, string>)[profileSlotKey] || profileSlotKey;
      case 'implants':
        return (IMPLANT_DISPLAY_MAPPING as Record<string, string>)[profileSlotKey] || profileSlotKey;
      default:
        return profileSlotKey;
    }
  }

  /**
   * Gets all valid profile slot keys for an equipment type
   */
  static getValidProfileSlots(equipmentType: EquipmentType): string[] {
    switch (equipmentType) {
      case 'weapons':
        return Array.from(new Set(Object.values(WEAPON_SLOT_MAPPING)));
      case 'clothing':
        return Array.from(new Set(Object.values(CLOTHING_SLOT_MAPPING)));
      case 'implants':
        return Array.from(new Set(Object.values(IMPLANT_SLOT_MAPPING)));
      default:
        return [];
    }
  }

  /**
   * Gets all valid UI slot names for an equipment type
   */
  static getValidUISlots(equipmentType: EquipmentType): string[] {
    switch (equipmentType) {
      case 'weapons':
        return Object.keys(WEAPON_SLOT_MAPPING);
      case 'clothing':
        return Object.keys(CLOTHING_SLOT_MAPPING);
      case 'implants':
        return Object.keys(IMPLANT_SLOT_MAPPING);
      default:
        return [];
    }
  }

  /**
   * Validates if a slot name is compatible with the equipment type
   */
  static isValidSlot(slotName: string, equipmentType: EquipmentType): boolean {
    const validSlots = this.getValidUISlots(equipmentType);
    const validProfileSlots = this.getValidProfileSlots(equipmentType);
    return validSlots.includes(slotName) || validProfileSlots.includes(slotName);
  }

  /**
   * Normalizes equipment data by mapping UI slot names to profile keys
   * Supports legacy profiles with mixed slot naming
   */
  static normalizeEquipmentData(equipmentData: Record<string, any>, equipmentType: EquipmentType): Record<string, any> {
    const normalized: Record<string, any> = {};

    for (const [slotName, item] of Object.entries(equipmentData || {})) {
      const profileSlotKey = this.mapToProfileSlot(slotName, equipmentType) || slotName;
      normalized[profileSlotKey] = item;
    }

    return normalized;
  }

  /**
   * Creates a standardized equipment access interface
   * Returns an object that can be accessed using either UI names or profile keys
   */
  static createEquipmentProxy(equipmentData: Record<string, any>, equipmentType: EquipmentType): Record<string, any> {
    const normalized = this.normalizeEquipmentData(equipmentData, equipmentType);

    return new Proxy(normalized, {
      get(target, prop: string) {
        // Try direct access first
        if (target[prop] !== undefined) {
          return target[prop];
        }

        // Try mapping UI name to profile key
        const profileKey = EquipmentSlotMapper.mapToProfileSlot(prop, equipmentType);
        if (profileKey && target[profileKey] !== undefined) {
          return target[profileKey];
        }

        return undefined;
      },

      set(target, prop: string, value: any) {
        // Always normalize to profile key when setting
        const profileKey = EquipmentSlotMapper.mapToProfileSlot(prop, equipmentType) || prop;
        target[profileKey] = value;
        return true;
      }
    });
  }

  /**
   * Validates equipment slot compatibility for item requirements
   */
  static validateSlotCompatibility(item: any, slotName: string, equipmentType: EquipmentType): boolean {
    if (!item || !this.isValidSlot(slotName, equipmentType)) {
      return false;
    }

    // For now, basic validation - can be extended with item type checks
    return true;
  }

  /**
   * Legacy support: handle old profile formats with inconsistent slot names
   */
  static migrateSlotNames(equipmentData: Record<string, any>, equipmentType: EquipmentType): Record<string, any> {
    return this.normalizeEquipmentData(equipmentData, equipmentType);
  }
}

/**
 * Convenience functions for common operations
 */

/**
 * Quick access to weapon equipment with slot name normalization
 */
export function getWeaponSlot(weapons: Record<string, any>, slotName: string): any {
  const proxy = EquipmentSlotMapper.createEquipmentProxy(weapons || {}, 'weapons');
  return proxy[slotName];
}

/**
 * Quick access to clothing equipment with slot name normalization
 */
export function getClothingSlot(clothing: Record<string, any>, slotName: string): any {
  const proxy = EquipmentSlotMapper.createEquipmentProxy(clothing || {}, 'clothing');
  return proxy[slotName];
}

/**
 * Quick access to implant equipment with slot name normalization
 */
export function getImplantSlot(implants: Record<string, any>, slotName: string): any {
  const proxy = EquipmentSlotMapper.createEquipmentProxy(implants || {}, 'implants');
  return proxy[slotName];
}

/**
 * Set equipment in slot with automatic slot name normalization
 */
export function setEquipmentSlot(
  equipmentData: Record<string, any>,
  slotName: string,
  item: any,
  equipmentType: EquipmentType
): void {
  const profileSlotKey = EquipmentSlotMapper.mapToProfileSlot(slotName, equipmentType) || slotName;
  equipmentData[profileSlotKey] = item;
}