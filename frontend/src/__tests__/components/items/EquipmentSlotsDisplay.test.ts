/**
 * EquipmentSlotsDisplay Component Tests
 * 
 * Tests for the EquipmentSlotsDisplay component functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountWithContext, standardCleanup } from '@/__tests__/helpers';
import EquipmentSlotsDisplay from '@/components/items/EquipmentSlotsDisplay.vue';
import type { Item } from '@/types/api';

// Mock router
const mockRouter = {
  push: vi.fn()
};

// Mock toast
const mockToast = {
  add: vi.fn()
};

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter
}));

// Mock PrimeVue useToast
vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast
}));

// Mock the game-utils functions
import * as gameUtils from '@/services/game-utils';

vi.mock('@/services/game-utils', () => ({
  getWeaponSlotPosition: vi.fn((slotName: string) => {
    const positions: Record<string, { row: number; col: number }> = {
      'Right-Hand': { row: 3, col: 3 },
      'Left-Hand': { row: 3, col: 1 },
      'Chest': { row: 2, col: 2 }
    };
    return positions[slotName] || { row: 1, col: 1 };
  }),
  getArmorSlotPosition: vi.fn((slotName: string) => {
    const positions: Record<string, { row: number; col: number }> = {
      'Head': { row: 1, col: 2 },
      'Neck': { row: 1, col: 1 },
      'Chest': { row: 2, col: 2 },
      'Body': { row: 2, col: 2 }, // Legacy compatibility
      'LeftArm': { row: 3, col: 1 },
      'RightArm': { row: 3, col: 3 },
      'Hands': { row: 3, col: 2 },
      'Legs': { row: 4, col: 2 },
      'Feet': { row: 5, col: 2 }
    };
    return positions[slotName] || { row: 1, col: 1 };
  }),
  getImplantSlotPosition: vi.fn((slotName: string) => {
    const positions: Record<string, { row: number; col: number }> = {
      'Head': { row: 1, col: 2 },
      'Eyes': { row: 1, col: 1 },
      'Ears': { row: 1, col: 3 },
      'Chest': { row: 2, col: 2 },
      'RightArm': { row: 2, col: 1 },
      'LeftArm': { row: 2, col: 3 },
      'Waist': { row: 3, col: 2 },
      'RightWrist': { row: 3, col: 1 },
      'LeftWrist': { row: 3, col: 3 },
      'RightHand': { row: 4, col: 1 },
      'Legs': { row: 4, col: 2 },
      'LeftHand': { row: 4, col: 3 },
      'Feet': { row: 5, col: 2 }
    };
    return positions[slotName] || { row: 1, col: 1 };
  }),
  getImplantSlotPositionFromBitflag: vi.fn((bitflag: number) => {
    const positions: Record<number, { row: number; col: number }> = {
      2: { row: 1, col: 1 },      // Eyes
      4: { row: 1, col: 2 },      // Head
      8: { row: 1, col: 3 },      // Ears
      16: { row: 2, col: 1 },     // RightArm
      32: { row: 2, col: 2 },     // Chest
      64: { row: 2, col: 3 },     // LeftArm
      128: { row: 3, col: 1 },    // RightWrist
      256: { row: 3, col: 2 },    // Waist
      512: { row: 3, col: 3 },    // LeftWrist
      1024: { row: 4, col: 1 },   // RightHand
      2048: { row: 4, col: 2 },   // Legs
      4096: { row: 4, col: 3 },   // LeftHand
      8192: { row: 5, col: 2 }    // Feet
    };
    return positions[bitflag] || { row: 1, col: 1 };
  }),
  getItemIconUrl: vi.fn((stats) => {
    const iconStat = stats?.find((stat: any) => stat.stat === 79);
    return iconStat ? `https://cdn.tinkeringidiot.com/aoicons/${iconStat.value}.png` : null;
  })
}));

describe('EquipmentSlotsDisplay', () => {
  const mockItem: Item = {
    id: 1,
    aoid: 246660,
    name: 'Combined Commando\'s Jacket',
    ql: 300,
    description: 'A tactical jacket',
    item_class: 2,
    is_nano: false,
    stats: [
      { id: 1, stat: 79, value: 123456 }, // Icon stat
      { id: 2, stat: 12, value: 100 }
    ],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.push.mockClear();
    mockToast.add.mockClear();
  });

  afterEach(() => {
    standardCleanup();
  });

  describe('Component Rendering', () => {
    it('should render with correct grid structure for armor', () => {
      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: {},
          slotType: 'armor'
        }
      });

      expect(wrapper.find('.equipment-slots-display.armor').exists()).toBe(true);
      expect(wrapper.findAll('.equipment-slot-cell')).toHaveLength(15); // 5x3 grid
    });

    it('should render with correct grid structure for weapons', () => {
      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: {},
          slotType: 'weapon'
        }
      });

      expect(wrapper.find('.equipment-slots-display.weapon').exists()).toBe(true);
      expect(wrapper.findAll('.equipment-slot-cell')).toHaveLength(15); // 5x3 grid
    });

    it('should render with correct grid structure for implants', () => {
      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: {},
          slotType: 'implant'
        }
      });

      expect(wrapper.find('.equipment-slots-display.implant').exists()).toBe(true);
      expect(wrapper.findAll('.equipment-slot-cell')).toHaveLength(15); // 5x3 grid
    });

    it('should show background images for different slot types', () => {
      const armorWrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: { equipment: {}, slotType: 'armor' }
      });
      expect(armorWrapper.find('.equipment-slots-display').classes()).toContain('armor');

      const weaponWrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: { equipment: {}, slotType: 'weapon' }
      });
      expect(weaponWrapper.find('.equipment-slots-display').classes()).toContain('weapon');

      const implantWrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: { equipment: {}, slotType: 'implant' }
      });
      expect(implantWrapper.find('.equipment-slots-display').classes()).toContain('implant');
    });
  });

  describe('Equipment Display', () => {
    it('should display items in correct positions', () => {
      const equipment = {
        'Head': mockItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(1);
      
      const img = itemImages[0];
      expect(img.attributes('src')).toBe('https://cdn.tinkeringidiot.com/aoicons/123456.png');
      expect(img.attributes('alt')).toContain('Combined Commando\'s Jacket');
      expect(img.attributes('alt')).toContain('equipped in Head');
    });

    it('should handle Body and Chest slots mapping to same position', () => {
      const equipmentWithBody = {
        'Body': mockItem
      };

      const equipmentWithChest = {
        'Chest': { ...mockItem, name: 'Chest Item' }
      };

      const bodyWrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: equipmentWithBody,
          slotType: 'armor'
        }
      });

      const chestWrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: equipmentWithChest,
          slotType: 'armor'
        }
      });

      // Both should render in the same grid position (since Body maps to Chest position)
      const bodyImages = bodyWrapper.findAll('.item-icon');
      const chestImages = chestWrapper.findAll('.item-icon');
      
      expect(bodyImages).toHaveLength(1);
      expect(chestImages).toHaveLength(1);
    });

    it('should display multiple items correctly', () => {
      const equipment = {
        'Head': mockItem,
        'Chest': { ...mockItem, id: 2, name: 'Chest Armor' },
        'Legs': { ...mockItem, id: 3, name: 'Leg Armor' }
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(3);

      // Check that all items have their icons displayed
      const altTexts = itemImages.map(img => img.attributes('alt'));
      expect(altTexts.some(alt => alt?.includes('Combined Commando\'s Jacket'))).toBe(true);
      expect(altTexts.some(alt => alt?.includes('Chest Armor'))).toBe(true);
      expect(altTexts.some(alt => alt?.includes('Leg Armor'))).toBe(true);
    });

    it('should show fallback icon when item has no icon URL', () => {
      const itemWithoutIcon = {
        ...mockItem,
        stats: [{ id: 1, stat: 12, value: 100 }] // No stat 79
      };

      const equipment = {
        'Head': itemWithoutIcon
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor'
        }
      });

      expect(wrapper.find('.item-icon').exists()).toBe(false);
      expect(wrapper.find('.item-fallback-icon').exists()).toBe(true);
      expect(wrapper.find('.item-fallback-icon').classes()).toContain('pi-box');
    });

    it('should apply correct CSS classes for different cell states', () => {
      const equipment = {
        'Head': mockItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor'
        }
      });

      const cells = wrapper.findAll('.equipment-slot-cell');
      
      // Should have cells with different states
      const hasItemCells = cells.filter(cell => cell.classes().includes('has-item'));
      const emptySlotCells = cells.filter(cell => cell.classes().includes('empty-slot'));
      const noSlotCells = cells.filter(cell => cell.classes().includes('no-slot'));

      expect(hasItemCells.length).toBeGreaterThan(0);
      expect(emptySlotCells.length + noSlotCells.length).toBeGreaterThan(0);
    });
  });

  describe('Props Handling', () => {
    it('should handle empty equipment object', () => {
      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: {},
          slotType: 'armor'
        }
      });

      expect(wrapper.findAll('.item-icon')).toHaveLength(0);
      expect(wrapper.findAll('.equipment-slot-cell')).toHaveLength(15); // Still renders grid
    });

    it('should handle null items in equipment slots', () => {
      const equipment = {
        'Head': mockItem,
        'Chest': null,
        'Legs': mockItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(2); // Only non-null items should render
    });

    it('should show/hide labels based on showLabels prop', () => {
      const equipment = {
        'Head': mockItem
      };

      const wrapperWithLabels = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor',
          showLabels: true
        }
      });

      const wrapperWithoutLabels = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor',
          showLabels: false
        }
      });

      // Implementation detail: Labels show when showLabels is true
      // This tests the conditional rendering logic
      expect(wrapperWithLabels.html()).toContain('slot-label');
      expect(wrapperWithoutLabels.html()).not.toContain('slot-label');
    });
  });

  describe('Error Handling', () => {
    it('should handle icon load errors gracefully', async () => {
      const equipment = {
        'Head': mockItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment,
          slotType: 'armor'
        }
      });

      const img = wrapper.find('.item-icon');
      expect(img.exists()).toBe(true);

      // Trigger error event
      await img.trigger('error');

      // Component should still be functional after error
      expect(wrapper.findAll('.equipment-slot-cell')).toHaveLength(15);
    });

    it('should return empty array for invalid slot type', () => {
      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: {},
          slotType: 'invalid' as any
        }
      });

      // Should render empty grid or handle gracefully
      expect(wrapper.find('.equipment-slots-display').exists()).toBe(false);
    });
  });

  describe('Bitflag-based Implant Support', () => {
    it('should handle implant equipment with bitflag keys', () => {
      const implantEquipment = {
        '2': mockItem,    // Eyes implant (bitflag 2)
        '32': { ...mockItem, id: 2, name: 'Chest Implant' },  // Chest implant (bitflag 32)
        '2048': { ...mockItem, id: 3, name: 'Leg Implant' }   // Legs implant (bitflag 2048)
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: implantEquipment,
          slotType: 'implant'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(3);

      // Verify that getImplantSlotPositionFromBitflag was called for each bitflag
      const mockFn = vi.mocked(gameUtils.getImplantSlotPositionFromBitflag);
      expect(mockFn).toHaveBeenCalledWith(2);
      expect(mockFn).toHaveBeenCalledWith(32);
      expect(mockFn).toHaveBeenCalledWith(2048);
    });

    it('should handle complete implant set with all bitflag slots', () => {
      const fullImplantSet = {
        '2': { ...mockItem, name: 'Eyes Implant' },         // Eyes
        '4': { ...mockItem, name: 'Head Implant' },         // Head
        '8': { ...mockItem, name: 'Ears Implant' },         // Ears
        '16': { ...mockItem, name: 'Right Arm Implant' },   // RightArm
        '32': { ...mockItem, name: 'Chest Implant' },       // Chest
        '64': { ...mockItem, name: 'Left Arm Implant' },    // LeftArm
        '128': { ...mockItem, name: 'Right Wrist Implant' }, // RightWrist
        '256': { ...mockItem, name: 'Waist Implant' },      // Waist
        '512': { ...mockItem, name: 'Left Wrist Implant' }, // LeftWrist
        '1024': { ...mockItem, name: 'Right Hand Implant' }, // RightHand
        '2048': { ...mockItem, name: 'Legs Implant' },      // Legs
        '4096': { ...mockItem, name: 'Left Hand Implant' }, // LeftHand
        '8192': { ...mockItem, name: 'Feet Implant' }       // Feet
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: fullImplantSet,
          slotType: 'implant'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(13); // All 13 implant slots

      // Verify all bitflags were processed
      const mockFn = vi.mocked(gameUtils.getImplantSlotPositionFromBitflag);
      const validBitflags = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
      
      validBitflags.forEach(bitflag => {
        expect(mockFn).toHaveBeenCalledWith(bitflag);
      });
    });

    it('should correctly position implants using bitflag positions', () => {
      const implantEquipment = {
        '2': { ...mockItem, name: 'Eyes Implant' },      // Should be at row 1, col 1
        '8192': { ...mockItem, name: 'Feet Implant' }    // Should be at row 5, col 2
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: implantEquipment,
          slotType: 'implant'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(2);

      // Check that the positioning function was called with correct bitflags
      const mockFn = vi.mocked(gameUtils.getImplantSlotPositionFromBitflag);
      expect(mockFn).toHaveBeenCalledWith(2);    // Eyes
      expect(mockFn).toHaveBeenCalledWith(8192); // Feet
    });

    it('should handle invalid bitflag keys gracefully', () => {
      const implantEquipment = {
        '999': mockItem,      // Invalid bitflag
        '32': { ...mockItem, id: 2, name: 'Valid Chest Implant' }  // Valid bitflag
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: implantEquipment,
          slotType: 'implant'
        }
      });

      // Should still render the valid implant and handle invalid one gracefully
      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages.length).toBeGreaterThanOrEqual(1);

      const mockFn = vi.mocked(gameUtils.getImplantSlotPositionFromBitflag);
      expect(mockFn).toHaveBeenCalledWith(999); // Called but returns default position
      expect(mockFn).toHaveBeenCalledWith(32);  // Valid call
    });

    it('should not use getImplantSlotPositionFromBitflag for non-implant slot types', () => {
      const armorEquipment = {
        'Head': mockItem,
        'Chest': { ...mockItem, id: 2, name: 'Chest Armor' }
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: armorEquipment,
          slotType: 'armor'
        }
      });

      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(2);

      // getImplantSlotPositionFromBitflag should NOT be called for armor
      const implantBitflagMock = vi.mocked(gameUtils.getImplantSlotPositionFromBitflag);
      expect(implantBitflagMock).not.toHaveBeenCalled();

      // getArmorSlotPosition should be called instead
      const armorPositionMock = vi.mocked(gameUtils.getArmorSlotPosition);
      expect(armorPositionMock).toHaveBeenCalledWith('Head');
      expect(armorPositionMock).toHaveBeenCalledWith('Chest');
    });

    it('should handle mixed string and numeric keys for implants (backward compatibility)', () => {
      // This test ensures robustness if there's ever mixed data
      const mixedImplantEquipment = {
        '32': { ...mockItem, name: 'Bitflag Chest Implant' },  // Bitflag key
        'invalidString': null  // Invalid string key with null value (should be ignored)
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: mixedImplantEquipment,
          slotType: 'implant'
        }
      });

      // Should handle gracefully and render the valid implant
      const itemImages = wrapper.findAll('.item-icon');
      expect(itemImages).toHaveLength(1);

      const mockFn = vi.mocked(gameUtils.getImplantSlotPositionFromBitflag);
      expect(mockFn).toHaveBeenCalledWith(32);  // Valid bitflag

      // The null value means no item to render, so the positioning function 
      // won't be called for 'invalidString' at all
      const uniqueCalls = mockFn.mock.calls.length;
      expect(uniqueCalls).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Item Navigation', () => {
    beforeEach(() => {
      mockRouter.push.mockClear();
    });

    it('should navigate to ItemDetail with correct AOID and QL when item is clicked', async () => {
      const testItem: Item = {
        id: 123,
        aoid: 456789,
        name: 'Test Head Armor',
        ql: 150,
        item_class: 2,
        description: 'Test armor description',
        is_nano: false,
        stats: [{
          id: 1,
          stat: 79,
          value: 999
        }],
        spell_data: [],
        actions: [],
        attack_stats: [],
        defense_stats: []
      };

      const armorEquipment = {
        'Head': testItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: armorEquipment,
          slotType: 'armor'
        },
      });

      // Find and click the item icon
      const itemIcon = wrapper.find('.item-icon');
      expect(itemIcon.exists()).toBe(true);
      
      await itemIcon.trigger('click');

      // Verify navigation was called with correct parameters
      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'ItemDetail',
        params: {
          aoid: '456789'  // Should use AOID, not database ID
        },
        query: {
          ql: '150'  // Should include the equipped QL
        }
      });
    });

    it('should navigate with correct parameters for fallback icon clicks', async () => {
      const testItem: Item = {
        id: 999,
        aoid: 111222,
        name: 'Test Item Without Icon',
        ql: 250,
        item_class: 3,
        description: 'Test item',
        is_nano: false,
        stats: [], // No icon stat
        spell_data: [],
        actions: [],
        attack_stats: [],
        defense_stats: []
      };

      const implantEquipment = {
        '32': testItem // Chest implant bitflag
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: implantEquipment,
          slotType: 'implant'
        },
      });

      // Find and click the fallback icon
      const fallbackIcon = wrapper.find('.item-fallback-icon');
      expect(fallbackIcon.exists()).toBe(true);
      
      await fallbackIcon.trigger('click');

      // Verify navigation was called with correct parameters
      expect(mockRouter.push).toHaveBeenCalledWith({
        name: 'ItemDetail',
        params: {
          aoid: '111222'
        },
        query: {
          ql: '250'
        }
      });
    });

    it('should show correct tooltip with QL and name on hover', () => {
      const testItem: Item = {
        id: 555,
        aoid: 777888,
        name: 'Epic Weapon',
        ql: 300,
        item_class: 1,
        description: 'Epic weapon description',
        is_nano: false,
        stats: [{
          id: 2,
          stat: 79,
          value: 888
        }],
        spell_data: [],
        actions: [],
        attack_stats: [],
        defense_stats: []
      };

      const weaponEquipment = {
        'Right-Hand': testItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: weaponEquipment,
          slotType: 'weapon'
        }
      });

      const itemIcon = wrapper.find('.item-icon');
      expect(itemIcon.exists()).toBe(true);
      
      // Check tooltip title attribute
      expect(itemIcon.attributes('title')).toBe('QL 300 Epic Weapon');
    });

    it('should show tooltip on fallback icon as well', () => {
      const testItem: Item = {
        id: 666,
        aoid: 999000,
        name: 'Mysterious Item',
        ql: 50,
        item_class: 2,
        description: 'No icon available',
        is_nano: false,
        stats: [], // No icon
        spell_data: [],
        actions: [],
        attack_stats: [],
        defense_stats: []
      };

      const armorEquipment = {
        'Chest': testItem
      };

      const wrapper = mountWithContext(EquipmentSlotsDisplay, {
        props: {
          equipment: armorEquipment,
          slotType: 'armor'
        }
      });

      const fallbackIcon = wrapper.find('.item-fallback-icon');
      expect(fallbackIcon.exists()).toBe(true);
      
      // Check tooltip title attribute
      expect(fallbackIcon.attributes('title')).toBe('QL 50 Mysterious Item');
    });
  });
});