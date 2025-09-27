/**
 * TinkerProfiles Transformer Tests
 *
 * Tests for profile import/export with item fetching functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileTransformer } from '@/lib/tinkerprofiles/transformer';
import { skillService } from '@/services/skill-service';
import { createDefaultProfile } from '@/lib/tinkerprofiles/constants';
import type { Item, InterpolationResponse } from '@/types/api';

// Mock API client
vi.mock('@/services/api-client', () => ({
  default: {
    interpolateItem: vi.fn(),
    getItem: vi.fn()
  }
}));

import { default as mockApiClient } from '@/services/api-client';

describe('ProfileTransformer', () => {
  let transformer: ProfileTransformer;

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

  const mockInterpolationResponse: InterpolationResponse = {
    success: true,
    item: mockItem
  };

  beforeEach(() => {
    vi.clearAllMocks();
    transformer = new ProfileTransformer();
  });

  describe('AOSetups Import', () => {
    const mockAOSetupsData = {
      name: 'Test Character',
      level: 60,
      profession: 'Adventurer',
      breed: 'Solitus',
      faction: 'Neutral',
      clothes: [
        {
          slot: 'BODY',
          highid: 246660,
          selectedQl: 300
        },
        {
          slot: 'HEAD',
          highid: 246661,
          selectedQl: 280
        }
      ],
      weapons: [
        {
          highid: 123456,
          selectedQl: 200
        }
      ],
      implants: [
        {
          slot: 'head',
          symbiant: {
            highid: 789123,
            selectedQl: 150
          }
        }
      ]
    };

    it('should import AOSetups data and fetch items from API', async () => {
      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: { ...mockItem, id: 1 } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 2, name: 'Head Item' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 3, name: 'Weapon Item' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 4, name: 'Implant Item' } });

      const result = await transformer.importProfile(JSON.stringify(mockAOSetupsData));

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      
      if (result.profile) {
        // Check that BODY slot is mapped to Chest in the profile
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Chest']?.name).toContain('Combined Commando\'s Jacket');
        
        // Check that HEAD slot is mapped correctly
        expect(result.profile.Clothing['Head']).toBeDefined();
        expect(result.profile.Clothing['Head']?.name).toContain('Head Item');
        
        // Check weapons
        expect(result.profile.Weapons['HUD1']).toBeDefined();
        expect(result.profile.Weapons['HUD1']?.name).toContain('Weapon Item');
        
        // Check implants (head slot should map to bitflag 4)
        expect(result.profile.Implants['4']).toBeDefined();
        expect(result.profile.Implants['4']?.name).toContain('Implant Item');
      }

      // Verify API calls were made
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(4);
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(246660, 300);
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(246661, 280);
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(123456, 200);
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(789123, 150);
    });

    it('should map BODY slot to Chest in profile (not Body)', async () => {
      const aoSetupsWithBody = {
        ...mockAOSetupsData,
        clothes: [
          {
            slot: 'BODY',
            highid: 246660,
            selectedQl: 300
          }
        ]
      };

      mockApiClient.interpolateItem.mockResolvedValueOnce({ data: mockItem });

      const result = await transformer.importProfile(JSON.stringify(aoSetupsWithBody));

      expect(result.success).toBe(true);
      if (result.profile) {
        // Should be stored as 'Chest', not 'Body'
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Body']).toBeUndefined();
      }
    });

    it('should handle API fetch failures gracefully', async () => {
      mockApiClient.interpolateItem
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({ data: mockItem });

      const result = await transformer.importProfile(JSON.stringify(mockAOSetupsData));

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Failed to fetch clothing item AOID 246660');
      
      if (result.profile) {
        // Should have fallback data for failed item
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Chest']?.name).toContain('fetch failed');
        
        // Should have successful item
        expect(result.profile.Clothing['Head']).toBeDefined();
        expect(result.profile.Clothing['Head']?.name).toContain('Combined Commando\'s Jacket');
      }
    });

    it('should handle partial API responses', async () => {
      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: null }) // No data returned
        .mockResolvedValueOnce({ data: mockItem });

      const result = await transformer.importProfile(JSON.stringify(mockAOSetupsData));

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Failed to fetch clothing item AOID 246660');
      
      if (result.profile) {
        // Should have fallback for null response
        expect(result.profile.Clothing['Chest']?.name).toContain('fetch failed');
        
        // Should have successful item
        expect(result.profile.Clothing['Head']?.name).toContain('Combined Commando\'s Jacket');
      }
    });
  });

  describe('Batch Item Fetching', () => {
    it('should make efficient batch requests', async () => {
      const aoSetupsWithMultipleItems = {
        name: 'Test Character',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        clothes: [
          { slot: 'BODY', highid: 1, selectedQl: 100 },
          { slot: 'HEAD', highid: 2, selectedQl: 200 },
          { slot: 'LEGS', highid: 3, selectedQl: 300 }
        ]
      };

      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: { ...mockItem, id: 1 } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 2 } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 3 } });

      const result = await transformer.importProfile(JSON.stringify(aoSetupsWithMultipleItems));

      expect(result.success).toBe(true);
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success/failure in batch', async () => {
      const aoSetupsWithMultipleItems = {
        name: 'Test Character',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        clothes: [
          { slot: 'BODY', highid: 1, selectedQl: 100 },
          { slot: 'HEAD', highid: 2, selectedQl: 200 },
          { slot: 'LEGS', highid: 3, selectedQl: 300 }
        ]
      };

      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: mockItem })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ data: mockItem });

      const result = await transformer.importProfile(JSON.stringify(aoSetupsWithMultipleItems));

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Failed to fetch clothing item AOID 2');
    });
  });

  describe('Slot Mapping Compatibility', () => {
    it('should map all AOSetups clothing slots correctly', async () => {
      const aoSetupsWithAllSlots = {
        name: 'Test Character',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        clothes: [
          { slot: 'HEAD', highid: 1, selectedQl: 100 },
          { slot: 'BODY', highid: 2, selectedQl: 100 },
          { slot: 'LEGS', highid: 3, selectedQl: 100 },
          { slot: 'FEET', highid: 4, selectedQl: 100 },
          { slot: 'HANDS', highid: 5, selectedQl: 100 },
          { slot: 'ARM_R', highid: 6, selectedQl: 100 },
          { slot: 'ARM_L', highid: 7, selectedQl: 100 },
          { slot: 'WRIST_R', highid: 8, selectedQl: 100 },
          { slot: 'WRIST_L', highid: 9, selectedQl: 100 },
          { slot: 'NECK', highid: 10, selectedQl: 100 }
        ]
      };

      mockApiClient.interpolateItem.mockImplementation(async () => ({ data: mockItem }));

      const result = await transformer.importProfile(JSON.stringify(aoSetupsWithAllSlots));

      expect(result.success).toBe(true);
      
      if (result.profile) {
        const clothing = result.profile.Clothing;
        
        expect(clothing['Head']).toBeDefined(); // HEAD -> Head
        expect(clothing['Chest']).toBeDefined(); // BODY -> Chest (not Body!)
        expect(clothing['Legs']).toBeDefined(); // LEGS -> Legs
        expect(clothing['Feet']).toBeDefined(); // FEET -> Feet
        expect(clothing['Hands']).toBeDefined(); // HANDS -> Hands
        expect(clothing['RightArm']).toBeDefined(); // ARM_R -> RightArm
        expect(clothing['LeftArm']).toBeDefined(); // ARM_L -> LeftArm
        expect(clothing['RightWrist']).toBeDefined(); // WRIST_R -> RightWrist
        expect(clothing['LeftWrist']).toBeDefined(); // WRIST_L -> LeftWrist
        expect(clothing['Neck']).toBeDefined(); // NECK -> Neck
        
        // Body should not exist (should be mapped to Chest)
        expect(clothing['Body']).toBeUndefined();
      }
    });

    it('should map implant slots correctly', async () => {
      const aoSetupsWithImplants = {
        name: 'Test Character',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        implants: [
          { slot: 'head', symbiant: { highid: 1, selectedQl: 100 } },
          { slot: 'chest', symbiant: { highid: 2, selectedQl: 100 } },
          { slot: 'leg', symbiant: { highid: 3, selectedQl: 100 } }
        ]
      };

      mockApiClient.interpolateItem.mockImplementation(async () => ({ data: mockItem }));

      const result = await transformer.importProfile(JSON.stringify(aoSetupsWithImplants));

      expect(result.success).toBe(true);
      
      if (result.profile) {
        expect(result.profile.Implants['Head']).toBeDefined();
        expect(result.profile.Implants['Chest']).toBeDefined();
        expect(result.profile.Implants['Leg']).toBeDefined();
      }
    });
  });

  describe('Profile Version Support', () => {
    it('should reject v3.0.0 profiles', async () => {
      const v3ProfileData = JSON.stringify({
        version: '3.0.0',
        Character: {
          Name: 'Legacy Character',
          Level: 50,
          Profession: 'Soldier',
          Breed: 'Atrox',
          Faction: 'Clan'
        },
        Skills: {
          Attributes: {
            Strength: { value: 10, pointFromIp: 4 }
          }
        },
        Clothing: {},
        Weapons: {},
        Implants: {}
      });

      const result = await transformer.importProfile(v3ProfileData);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not supported');
    });

    it('should accept v4.0.0 profiles', async () => {
      const v4Profile = createDefaultProfile('Test Character');
      v4Profile.version = '4.0.0';
      const v4ProfileData = JSON.stringify(v4Profile);

      const result = await transformer.importProfile(v4ProfileData);

      expect(result.success).toBe(true);
      expect(result.profile?.version).toBe('4.0.0');
      expect(result.profile?.skills).toBeDefined();
      expect((result.profile as any).Skills).toBeUndefined();
    });

    it('should import AOSetups profiles to v4.0.0 format', async () => {
      const aoSetupsData = {
        name: 'AOSetups Character',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        clothes: [],
        weapons: [],
        implants: []
      };

      const result = await transformer.importProfile(JSON.stringify(aoSetupsData));

      expect(result.success).toBe(true);
      expect(result.profile?.version).toBe('4.0.0');
      expect(result.profile?.skills).toBeDefined();
      expect((result.profile as any).Skills).toBeUndefined();
    });

    it('should ensure no Skills property exists in v4.0.0 profiles', async () => {
      const v4Profile = createDefaultProfile('Test Character');
      const exported = transformer.exportProfile(v4Profile, 'json');
      const result = await transformer.importProfile(exported);

      expect(result.success).toBe(true);
      expect(result.profile?.version).toBe('4.0.0');
      expect((result.profile as any).Skills).toBeUndefined();
      expect(result.profile?.skills).toBeDefined();
      expect(Object.keys(result.profile?.skills || {}).length).toBeGreaterThan(160);
    });
  });

  describe('Profile Creation v4.0.0', () => {
    it('should create profile with all skills initialized', () => {
      const profile = createDefaultProfile('Test');

      expect(profile.version).toBe('4.0.0');
      expect(profile.skills).toBeDefined();
      expect(Object.keys(profile.skills).length).toBeGreaterThan(160);
    });

    it('should initialize abilities with breed-specific bases', () => {
      const profile = createDefaultProfile('Atrox Test', 'Atrox');

      const strengthId = skillService.resolveId('Strength');
      const strength = profile.skills[strengthId];
      expect(strength.base).toBeGreaterThan(5); // Atrox should have higher base Strength
    });

    it('should initialize regular skills with base 5', () => {
      const profile = createDefaultProfile('Test');
      const oneHandBluntId = skillService.resolveId('1h Blunt');
      const oneHandBlunt = profile.skills[oneHandBluntId];

      expect(oneHandBlunt.base).toBe(5);
      expect(oneHandBlunt.total).toBe(5);
    });

    it('should initialize Misc/AC skills with base 0', () => {
      const profile = createDefaultProfile('Test');
      const maxHealthId = skillService.resolveId('Max Health');
      const chemicalACId = skillService.resolveId('Chemical AC');

      expect(profile.skills[maxHealthId].base).toBe(0);
      expect(profile.skills[chemicalACId].base).toBe(0);
    });

    it('should have no legacy Skills property', () => {
      const profile = createDefaultProfile('Test');
      expect((profile as any).Skills).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const result = await transformer.importProfile('invalid json');
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unable to detect or unsupported format');
    });

    it('should handle missing required fields', async () => {
      const incompleteData = JSON.stringify({
        name: 'Test'
        // Missing other required fields
      });

      const result = await transformer.importProfile(incompleteData);
      
      // Should attempt to handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle API client not available', async () => {
      // Mock API client to be unavailable
      vi.mocked(mockApiClient.interpolateItem).mockRejectedValue(new Error('Network error'));

      const result = await transformer.importProfile(JSON.stringify({
        name: 'Test',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        clothes: [{ slot: 'BODY', highid: 1, selectedQl: 100 }]
      }));

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      
      if (result.profile) {
        // Should have fallback data
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Chest']?.name).toContain('fetch failed');
      }
    });
  });

  describe('Bitflag-based Implant Mapping', () => {
    it('should store implants with bitflag keys instead of slot names', async () => {
      const aoSetupsWithImplants = {
        name: 'Test Character',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        implants: [
          {
            slot: 'eye',      // Should map to bitflag 2
            symbiant: {
              highid: 111111,
              selectedQl: 100
            }
          },
          {
            slot: 'head',     // Should map to bitflag 4
            symbiant: {
              highid: 222222,
              selectedQl: 150
            }
          },
          {
            slot: 'legs',     // Should map to bitflag 2048 (plural form)
            symbiant: {
              highid: 333333,
              selectedQl: 200
            }
          }
        ]
      };

      // Mock API responses for each implant
      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: { ...mockItem, id: 1, name: 'Eye Implant' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 2, name: 'Head Implant' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 3, name: 'Leg Implant' } });

      const result = await transformer.importProfile(JSON.stringify(aoSetupsWithImplants));

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      
      if (result.profile) {
        // Check that implants are stored with bitflag keys, not string names
        expect(result.profile.Implants['2']).toBeDefined();    // Eye implant
        expect(result.profile.Implants['4']).toBeDefined();    // Head implant
        expect(result.profile.Implants['2048']).toBeDefined(); // Legs implant
        
        // Verify content
        expect(result.profile.Implants['2']?.name).toBe('Eye Implant');
        expect(result.profile.Implants['4']?.name).toBe('Head Implant');
        expect(result.profile.Implants['2048']?.name).toBe('Leg Implant');
        
        // Ensure old string keys are NOT used
        expect(result.profile.Implants['Eyes']).toBeUndefined();
        expect(result.profile.Implants['Head']).toBeUndefined();
        expect(result.profile.Implants['Legs']).toBeUndefined();
      }
    });

    it('should handle all valid AOSetups implant slots with correct bitflags', async () => {
      const allImplantSlots = {
        name: 'Full Implant Test',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        implants: [
          { slot: 'eye', symbiant: { highid: 111, selectedQl: 100 } },       // → '2'
          { slot: 'head', symbiant: { highid: 222, selectedQl: 100 } },      // → '4'
          { slot: 'ear', symbiant: { highid: 333, selectedQl: 100 } },       // → '8'
          { slot: 'rarm', symbiant: { highid: 444, selectedQl: 100 } },      // → '16'
          { slot: 'chest', symbiant: { highid: 555, selectedQl: 100 } },     // → '32'
          { slot: 'larm', symbiant: { highid: 666, selectedQl: 100 } },      // → '64'
          { slot: 'rwrist', symbiant: { highid: 777, selectedQl: 100 } },    // → '128'
          { slot: 'waist', symbiant: { highid: 888, selectedQl: 100 } },     // → '256'
          { slot: 'lwrist', symbiant: { highid: 999, selectedQl: 100 } },    // → '512'
          { slot: 'rhand', symbiant: { highid: 1111, selectedQl: 100 } },    // → '1024'
          { slot: 'legs', symbiant: { highid: 2222, selectedQl: 100 } },     // → '2048'
          { slot: 'lhand', symbiant: { highid: 3333, selectedQl: 100 } },    // → '4096'
          { slot: 'feet', symbiant: { highid: 4444, selectedQl: 100 } }      // → '8192'
        ]
      };

      // Mock all API responses
      const expectedCalls = 13;
      for (let i = 0; i < expectedCalls; i++) {
        mockApiClient.interpolateItem.mockResolvedValueOnce({ 
          data: { ...mockItem, id: i + 1, name: `Implant ${i + 1}` } 
        });
      }

      const result = await transformer.importProfile(JSON.stringify(allImplantSlots));

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      
      if (result.profile) {
        // Check all expected bitflag keys are present
        const expectedBitflags = ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096', '8192'];
        
        expectedBitflags.forEach(bitflag => {
          expect(result.profile!.Implants[bitflag]).toBeDefined();
          expect(result.profile!.Implants[bitflag]?.name).toMatch(/Implant \d+/);
        });

        // Ensure exactly 13 implants are stored
        expect(Object.keys(result.profile.Implants).filter(key => result.profile!.Implants[key] !== null)).toHaveLength(13);
      }

      // Verify all API calls were made
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(13);
    });

    it('should handle duplicate leg slot names (leg vs legs)', async () => {
      const duplicateLegTest = {
        name: 'Duplicate Leg Test',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        implants: [
          {
            slot: 'leg',      // Should map to bitflag 2048
            symbiant: {
              highid: 111111,
              selectedQl: 100
            }
          },
          {
            slot: 'legs',     // Should also map to bitflag 2048 (overwrite the first one)
            symbiant: {
              highid: 222222,
              selectedQl: 150
            }
          }
        ]
      };

      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: { ...mockItem, id: 1, name: 'First Leg Implant' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 2, name: 'Second Leg Implant' } });

      const result = await transformer.importProfile(JSON.stringify(duplicateLegTest));

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      
      if (result.profile) {
        // Should have one leg implant (the last one wins)
        expect(result.profile.Implants['2048']).toBeDefined();
        expect(result.profile.Implants['2048']?.name).toBe('Second Leg Implant');
        
        // Should not have duplicates
        const legImplants = Object.keys(result.profile.Implants).filter(key => 
          key === '2048' && result.profile!.Implants[key] !== null
        );
        expect(legImplants).toHaveLength(1);
      }
    });

    it('should handle invalid implant slots gracefully', async () => {
      const invalidSlotTest = {
        name: 'Invalid Slot Test',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        implants: [
          {
            slot: 'invalidslot',  // Invalid slot name
            symbiant: {
              highid: 111111,
              selectedQl: 100
            }
          },
          {
            slot: 'chest',        // Valid slot
            symbiant: {
              highid: 222222,
              selectedQl: 150
            }
          }
        ]
      };

      mockApiClient.interpolateItem
        .mockResolvedValueOnce({ data: { ...mockItem, id: 1, name: 'Invalid Implant' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 2, name: 'Valid Chest Implant' } });

      const result = await transformer.importProfile(JSON.stringify(invalidSlotTest));

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      
      if (result.profile) {
        // Valid implant should be stored
        expect(result.profile.Implants['32']).toBeDefined();  // Chest implant
        expect(result.profile.Implants['32']?.name).toBe('Valid Chest Implant');
        
        // Invalid slot should not create a bitflag entry
        const allBitflags = ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096', '8192'];
        const invalidBitflags = Object.keys(result.profile.Implants).filter(key => 
          !allBitflags.includes(key) && result.profile!.Implants[key] !== null
        );
        expect(invalidBitflags).toHaveLength(0);
      }
    });

    it('should maintain cluster data in bitflag-based implants', async () => {
      const implantWithClusters = {
        name: 'Cluster Test',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        faction: 'Neutral',
        implants: [
          {
            slot: 'chest',
            symbiant: {
              highid: 111111,
              selectedQl: 100
            },
            clusters: {
              'Shiny': { ClusterID: 16 },     // Strength
              'Bright': { ClusterID: 112 },   // Pistol
              'Faded': { ClusterID: 19 }      // Intelligence
            }
          }
        ]
      };

      mockApiClient.interpolateItem.mockResolvedValueOnce({ 
        data: { ...mockItem, id: 1, name: 'Chest Implant with Clusters' } 
      });

      const result = await transformer.importProfile(JSON.stringify(implantWithClusters));

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      
      if (result.profile) {
        const chestImplant = result.profile.Implants['32'];  // Chest bitflag
        expect(chestImplant).toBeDefined();
        
        // Check that cluster data is preserved
        if ('clusters' in chestImplant!) {
          expect(chestImplant.clusters).toBeDefined();
          expect(chestImplant.clusters['Shiny']).toEqual({ stat: 16, skillName: 'Strength' });
          expect(chestImplant.clusters['Bright']).toEqual({ stat: 112, skillName: 'Pistol' });
          expect(chestImplant.clusters['Faded']).toEqual({ stat: 19, skillName: 'Intelligence' });
        }
      }
    });
  });
});