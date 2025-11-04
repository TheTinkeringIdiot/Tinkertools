/**
 * Game Utils Tests
 *
 * Tests for equipment slot mapping and icon utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getWeaponSlotPosition,
  getArmorSlotPosition,
  getImplantSlotPosition,
  getImplantSlotPositionFromBitflag,
  getItemIconUrl,
} from '@/services/game-utils';
import type { StatValue } from '@/types/api';

describe('Equipment Slot Position Functions', () => {
  describe('getWeaponSlotPosition', () => {
    it('should return correct positions for valid weapon slots', () => {
      expect(getWeaponSlotPosition('RightHand')).toEqual({ row: 3, col: 3 });
      expect(getWeaponSlotPosition('LeftHand')).toEqual({ row: 3, col: 1 });
      expect(getWeaponSlotPosition('Hud1')).toEqual({ row: 1, col: 1 });
    });

    it('should return default position for invalid slots', () => {
      expect(getWeaponSlotPosition('InvalidSlot')).toEqual({ row: 1, col: 1 });
      expect(getWeaponSlotPosition('')).toEqual({ row: 1, col: 1 });
    });

    it('should handle case sensitivity', () => {
      expect(getWeaponSlotPosition('righthand')).toEqual({ row: 1, col: 1 }); // Case sensitive
      expect(getWeaponSlotPosition('RightHand')).toEqual({ row: 3, col: 3 });
    });
  });

  describe('getArmorSlotPosition', () => {
    it('should return correct positions for valid armor slots', () => {
      expect(getArmorSlotPosition('Head')).toEqual({ row: 1, col: 2 });
      expect(getArmorSlotPosition('Neck')).toEqual({ row: 1, col: 1 });
      expect(getArmorSlotPosition('Chest')).toEqual({ row: 2, col: 2 });
      expect(getArmorSlotPosition('Legs')).toEqual({ row: 4, col: 2 });
      expect(getArmorSlotPosition('Feet')).toEqual({ row: 5, col: 2 });
    });

    it('should map Body slot to same position as Chest (legacy compatibility)', () => {
      const chestPosition = getArmorSlotPosition('Chest');
      const bodyPosition = getArmorSlotPosition('Body');

      expect(bodyPosition).toEqual(chestPosition);
      expect(bodyPosition).toEqual({ row: 2, col: 2 });
    });

    it('should return correct positions for shoulder and arm slots', () => {
      expect(getArmorSlotPosition('LeftShoulder')).toEqual({ row: 2, col: 1 });
      expect(getArmorSlotPosition('RightShoulder')).toEqual({ row: 2, col: 3 });
      expect(getArmorSlotPosition('LeftArm')).toEqual({ row: 3, col: 1 });
      expect(getArmorSlotPosition('RightArm')).toEqual({ row: 3, col: 3 });
    });

    it('should return correct positions for hand and finger slots', () => {
      expect(getArmorSlotPosition('Hands')).toEqual({ row: 3, col: 2 });
      expect(getArmorSlotPosition('LeftWrist')).toEqual({ row: 4, col: 1 });
      expect(getArmorSlotPosition('RightWrist')).toEqual({ row: 4, col: 3 });
      expect(getArmorSlotPosition('LeftFinger')).toEqual({ row: 5, col: 1 });
      expect(getArmorSlotPosition('RightFinger')).toEqual({ row: 5, col: 3 });
    });

    it('should return default position for invalid slots', () => {
      expect(getArmorSlotPosition('InvalidSlot')).toEqual({ row: 1, col: 1 });
      expect(getArmorSlotPosition('')).toEqual({ row: 1, col: 1 });
      expect(getArmorSlotPosition('chest')).toEqual({ row: 1, col: 1 }); // Case sensitive
    });
  });

  describe('getImplantSlotPosition', () => {
    it('should return correct positions for valid implant slots', () => {
      expect(getImplantSlotPosition('Head')).toEqual({ row: 1, col: 2 });
      expect(getImplantSlotPosition('Eyes')).toEqual({ row: 1, col: 1 });
      expect(getImplantSlotPosition('Ears')).toEqual({ row: 1, col: 3 });
      expect(getImplantSlotPosition('Chest')).toEqual({ row: 2, col: 2 });
    });

    it('should return correct positions for arm and wrist slots', () => {
      expect(getImplantSlotPosition('RightArm')).toEqual({ row: 2, col: 1 });
      expect(getImplantSlotPosition('LeftArm')).toEqual({ row: 2, col: 3 });
      expect(getImplantSlotPosition('RightWrist')).toEqual({ row: 3, col: 1 });
      expect(getImplantSlotPosition('LeftWrist')).toEqual({ row: 3, col: 3 });
    });

    it('should return correct positions for hand and leg slots', () => {
      expect(getImplantSlotPosition('RightHand')).toEqual({ row: 4, col: 1 });
      expect(getImplantSlotPosition('LeftHand')).toEqual({ row: 4, col: 3 });
      expect(getImplantSlotPosition('Legs')).toEqual({ row: 4, col: 2 });
      expect(getImplantSlotPosition('Feet')).toEqual({ row: 5, col: 2 });
    });

    it('should return default position for invalid slots', () => {
      expect(getImplantSlotPosition('InvalidSlot')).toEqual({ row: 1, col: 1 });
      expect(getImplantSlotPosition('')).toEqual({ row: 1, col: 1 });
    });
  });

  describe('getImplantSlotPositionFromBitflag', () => {
    it('should return correct positions for valid bitflag values', () => {
      // Eyes - 1 << 1 = 2
      expect(getImplantSlotPositionFromBitflag(2)).toEqual({ row: 1, col: 1 });

      // Head - 1 << 2 = 4
      expect(getImplantSlotPositionFromBitflag(4)).toEqual({ row: 1, col: 2 });

      // Ears - 1 << 3 = 8
      expect(getImplantSlotPositionFromBitflag(8)).toEqual({ row: 1, col: 3 });

      // Chest - 1 << 5 = 32
      expect(getImplantSlotPositionFromBitflag(32)).toEqual({ row: 2, col: 2 });
    });

    it('should return correct positions for arm and wrist bitflags', () => {
      // RightArm - 1 << 4 = 16
      expect(getImplantSlotPositionFromBitflag(16)).toEqual({ row: 2, col: 1 });

      // LeftArm - 1 << 6 = 64
      expect(getImplantSlotPositionFromBitflag(64)).toEqual({ row: 2, col: 3 });

      // RightWrist - 1 << 7 = 128
      expect(getImplantSlotPositionFromBitflag(128)).toEqual({ row: 3, col: 1 });

      // LeftWrist - 1 << 9 = 512
      expect(getImplantSlotPositionFromBitflag(512)).toEqual({ row: 3, col: 3 });

      // Waist - 1 << 8 = 256
      expect(getImplantSlotPositionFromBitflag(256)).toEqual({ row: 3, col: 2 });
    });

    it('should return correct positions for hand and leg bitflags', () => {
      // RightHand - 1 << 10 = 1024
      expect(getImplantSlotPositionFromBitflag(1024)).toEqual({ row: 4, col: 1 });

      // LeftHand - 1 << 12 = 4096
      expect(getImplantSlotPositionFromBitflag(4096)).toEqual({ row: 4, col: 3 });

      // Legs - 1 << 11 = 2048
      expect(getImplantSlotPositionFromBitflag(2048)).toEqual({ row: 4, col: 2 });

      // Feet - 1 << 13 = 8192
      expect(getImplantSlotPositionFromBitflag(8192)).toEqual({ row: 5, col: 2 });
    });

    it('should return default position for invalid bitflag values', () => {
      expect(getImplantSlotPositionFromBitflag(0)).toEqual({ row: 1, col: 1 });
      expect(getImplantSlotPositionFromBitflag(1)).toEqual({ row: 1, col: 1 });
      expect(getImplantSlotPositionFromBitflag(999)).toEqual({ row: 1, col: 1 });
      expect(getImplantSlotPositionFromBitflag(-1)).toEqual({ row: 1, col: 1 });
    });

    it('should map all valid IMPLANT_SLOT bitflags correctly', () => {
      // Test all 13 valid implant slot bitflags
      const validBitflags = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];

      validBitflags.forEach((bitflag) => {
        const position = getImplantSlotPositionFromBitflag(bitflag);

        // All positions should be within the 3x5 grid
        expect(position.row).toBeGreaterThanOrEqual(1);
        expect(position.row).toBeLessThanOrEqual(5);
        expect(position.col).toBeGreaterThanOrEqual(1);
        expect(position.col).toBeLessThanOrEqual(3);
      });
    });

    it('should maintain consistency with string-based implant slot positions', () => {
      // These mappings should produce the same results
      const consistencyTests = [
        { bitflag: 2, slotName: 'Eyes' }, // Eyes - 1 << 1
        { bitflag: 4, slotName: 'Head' }, // Head - 1 << 2
        { bitflag: 8, slotName: 'Ears' }, // Ears - 1 << 3
        { bitflag: 16, slotName: 'RightArm' }, // RightArm - 1 << 4
        { bitflag: 32, slotName: 'Chest' }, // Chest - 1 << 5
        { bitflag: 64, slotName: 'LeftArm' }, // LeftArm - 1 << 6
        { bitflag: 128, slotName: 'RightWrist' }, // RightWrist - 1 << 7
        { bitflag: 256, slotName: 'Waist' }, // Waist - 1 << 8
        { bitflag: 512, slotName: 'LeftWrist' }, // LeftWrist - 1 << 9
        { bitflag: 1024, slotName: 'RightHand' }, // RightHand - 1 << 10
        { bitflag: 2048, slotName: 'Legs' }, // Legs - 1 << 11
        { bitflag: 4096, slotName: 'LeftHand' }, // LeftHand - 1 << 12
        { bitflag: 8192, slotName: 'Feet' }, // Feet - 1 << 13
      ];

      consistencyTests.forEach(({ bitflag, slotName }) => {
        const bitflagPosition = getImplantSlotPositionFromBitflag(bitflag);
        const stringPosition = getImplantSlotPosition(slotName);

        expect(bitflagPosition).toEqual(stringPosition);
      });
    });
  });
});

describe('getItemIconUrl', () => {
  it('should extract icon ID from stat 79 and return correct URL', () => {
    const stats: StatValue[] = [
      { id: 1, stat: 12, value: 100 },
      { id: 2, stat: 79, value: 123456 },
      { id: 3, stat: 85, value: 200 },
    ];

    const iconUrl = getItemIconUrl(stats);
    expect(iconUrl).toBe('https://cdn.tinkeringidiot.com/aoicons/123456.png');
  });

  it('should return null when stat 79 is not found', () => {
    const stats: StatValue[] = [
      { id: 1, stat: 12, value: 100 },
      { id: 2, stat: 85, value: 200 },
    ];

    const iconUrl = getItemIconUrl(stats);
    expect(iconUrl).toBeNull();
  });

  it('should return null for empty stats array', () => {
    const iconUrl = getItemIconUrl([]);
    expect(iconUrl).toBeNull();
  });

  it('should handle stat 79 with zero value', () => {
    const stats: StatValue[] = [{ id: 1, stat: 79, value: 0 }];

    // Zero is considered falsy, so should return null
    const iconUrl = getItemIconUrl(stats);
    expect(iconUrl).toBeNull();
  });

  it('should handle multiple stat 79 entries and use the first one', () => {
    const stats: StatValue[] = [
      { id: 1, stat: 79, value: 111 },
      { id: 2, stat: 79, value: 222 },
      { id: 3, stat: 12, value: 100 },
    ];

    const iconUrl = getItemIconUrl(stats);
    expect(iconUrl).toBe('https://cdn.tinkeringidiot.com/aoicons/111.png');
  });

  it('should handle negative icon values', () => {
    const stats: StatValue[] = [{ id: 1, stat: 79, value: -123 }];

    const iconUrl = getItemIconUrl(stats);
    expect(iconUrl).toBe('https://cdn.tinkeringidiot.com/aoicons/-123.png');
  });
});
