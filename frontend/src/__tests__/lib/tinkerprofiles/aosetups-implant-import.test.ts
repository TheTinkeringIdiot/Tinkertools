/**
 * Integration tests for AOSetups implant import
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileTransformer } from '@/lib/tinkerprofiles/transformer';
import { skillService } from '@/services/skill-service';
import { PROFESSION, BREED } from '@/__tests__/helpers';

// Mock the API client
vi.mock('@/services/api-client', () => ({
  apiClient: {
    interpolateItem: vi.fn().mockResolvedValue({
      success: false,
      error: 'Mocked response for testing',
    }),
    getItem: vi.fn().mockResolvedValue({
      success: false,
      error: 'Mocked response for testing',
    }),
  },
}));

describe('AOSetups Implant Import Integration', () => {
  let transformer: ProfileTransformer;

  beforeEach(() => {
    transformer = new ProfileTransformer();
  });

  describe('Complete AOSetups Import with Implants', () => {
    it('should import AOSetups data with regular implants containing clusters', async () => {
      // Sample AOSetups export data with implant clusters
      const aoSetupsData = JSON.stringify({
        character: {
          name: 'TestCharacter',
          level: 200,
          profession: 'Agent',
          breed: 'Solitus',
        },
        implants: [
          {
            _id: '68c2ca20b3f11d03a38e4f99',
            slot: 'eye',
            type: 'implant',
            ql: 100,
            clusters: {
              Shiny: { ClusterID: 77 }, // Strength
              Bright: { ClusterID: 60 }, // Pistol
              Faded: { ClusterID: 37 }, // Intelligence
            },
          },
          {
            _id: '68c2ca20b3f11d03a38e4f9a',
            slot: 'head',
            type: 'implant',
            ql: 150,
            clusters: {
              Shiny: { ClusterID: 7 }, // Agility
              Bright: { ClusterID: 68 }, // Rifle
            },
          },
          {
            _id: 'symbiant123',
            slot: 'chest',
            symbiant: {
              highid: 123456,
              selectedQl: 200,
            },
          },
        ],
        weapons: [],
        clothes: [],
        perks: [],
      });

      const result = await transformer.importProfile(aoSetupsData);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      if (result.profile) {
        // Check character data
        expect(result.profile.Character.Name).toBe('TestCharacter');
        expect(result.profile.Character.Level).toBe(200);
        expect(result.profile.Character.Profession).toBe(PROFESSION.AGENT); // Numeric ID
        expect(result.profile.Character.Breed).toBe(BREED.SOLITUS); // Numeric ID

        // Check eye implant with clusters (stored with bitflag key '2')
        const eyeImplant = result.profile.Implants['2'];
        expect(eyeImplant).toBeDefined();
        expect(eyeImplant?.type).toBe('implant');
        expect(eyeImplant?.ql).toBe(100);

        // Check clusters
        expect(eyeImplant?.clusters).toBeDefined();
        expect(eyeImplant?.clusters?.Shiny).toEqual({
          stat: 16, // Strength STAT ID
          skillName: 'Strength',
        });
        expect(eyeImplant?.clusters?.Bright).toEqual({
          stat: 112, // Pistol STAT ID
          skillName: 'Pistol',
        });
        expect(eyeImplant?.clusters?.Faded).toEqual({
          stat: 19, // Intelligence STAT ID
          skillName: 'Intelligence',
        });

        // Check head implant with partial clusters (stored with bitflag key '4')
        const headImplant = result.profile.Implants['4'];
        expect(headImplant).toBeDefined();
        expect(headImplant?.type).toBe('implant');
        expect(headImplant?.ql).toBe(150);

        expect(headImplant?.clusters?.Shiny).toEqual({
          stat: 17, // Agility STAT ID
          skillName: 'Agility',
        });
        expect(headImplant?.clusters?.Bright).toEqual({
          stat: 113, // Rifle STAT ID
          skillName: 'Rifle',
        });
        expect(headImplant?.clusters?.Faded).toBeUndefined(); // Not provided

        // Check symbiant (no clusters but has item data) (stored with bitflag key '32')
        const chestImplant = result.profile.Implants['32'];
        expect(chestImplant).toBeDefined();
        expect(chestImplant?.type).toBe('symbiant');
        expect(chestImplant?.aoid).toBe(123456);
        expect(chestImplant?.clusters).toBeUndefined(); // Symbiants don't have cluster data
      }

      // Check warnings - should have import notifications
      expect(result.warnings).toContain('Profile imported from AOSetups format');
      expect(result.warnings.some((w) => w.includes('clusters to slot'))).toBe(true);
    });

    it('should handle invalid cluster IDs gracefully', async () => {
      const aoSetupsData = JSON.stringify({
        character: {
          name: 'TestCharacter',
          level: 100,
          profession: 'Adventurer',
          breed: 'Solitus',
        },
        implants: [
          {
            slot: 'eye',
            type: 'implant',
            ql: 50,
            clusters: {
              Shiny: { ClusterID: 999 }, // Invalid ID
              Bright: { ClusterID: 60 }, // Valid ID (Pistol)
              Faded: { ClusterID: 0 }, // Invalid ID (empty)
            },
          },
        ],
        weapons: [],
        clothes: [],
        perks: [],
      });

      const result = await transformer.importProfile(aoSetupsData);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      if (result.profile) {
        const eyeImplant = result.profile.Implants['2'];
        expect(eyeImplant).toBeDefined();

        // Should only have the valid cluster
        expect(eyeImplant?.clusters?.Bright).toEqual({
          stat: 112,
          skillName: 'Pistol',
        });
        expect(eyeImplant?.clusters?.Shiny).toBeUndefined();
        expect(eyeImplant?.clusters?.Faded).toBeUndefined();
      }

      // Check warnings for invalid cluster IDs
      expect(result.warnings.some((w) => w.includes('Unknown ClusterID: 999'))).toBe(true);
      // Note: ClusterID 0 is filtered out in the cluster processing, not in the mapping lookup
    });

    it('should handle invalid slot names gracefully', async () => {
      const aoSetupsData = JSON.stringify({
        character: {
          name: 'TestCharacter',
          level: 100,
          profession: 'Adventurer',
          breed: 'Solitus',
        },
        implants: [
          {
            slot: 'invalid_slot',
            type: 'implant',
            ql: 50,
            clusters: {
              Shiny: { ClusterID: 77 },
            },
          },
          {
            slot: 'eye', // Valid slot
            type: 'implant',
            ql: 75,
            clusters: {
              Bright: { ClusterID: 60 },
            },
          },
        ],
        weapons: [],
        clothes: [],
        perks: [],
      });

      const result = await transformer.importProfile(aoSetupsData);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      if (result.profile) {
        // Invalid slot should be skipped
        expect(Object.values(result.profile.Implants).filter(Boolean).length).toBe(1);

        // Valid slot should be processed (bitflag key '2' for eye)
        const eyeImplant = result.profile.Implants['2'];
        expect(eyeImplant).toBeDefined();
        expect(eyeImplant?.clusters?.Bright).toBeDefined();
      }

      // Check warning for invalid slot
      expect(result.warnings.some((w) => w.includes('Unknown implant slot: invalid_slot'))).toBe(
        true
      );
    });

    it('should preserve existing TinkerProfile structure for non-implant data', async () => {
      const aoSetupsData = JSON.stringify({
        character: {
          name: 'TestCharacter',
          level: 100,
          profession: 'Doctor',
          breed: 'Atrox',
          skills: [
            {
              name: 'First Aid',
              ipExpenditure: 50,
              pointsFromIp: 25,
            },
          ],
        },
        implants: [
          {
            slot: 'eye',
            type: 'implant',
            ql: 100,
            clusters: {
              Shiny: { ClusterID: 77 }, // Strength
            },
          },
        ],
        weapons: [],
        clothes: [],
        perks: [],
      });

      const result = await transformer.importProfile(aoSetupsData);

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      if (result.profile) {
        // Character data should be preserved
        expect(result.profile.Character.Name).toBe('TestCharacter');
        expect(result.profile.Character.Profession).toBe(PROFESSION.DOCTOR); // Numeric ID
        expect(result.profile.Character.Breed).toBe(BREED.ATROX); // Numeric ID

        // v4.0.0 skills structure should be used
        expect(result.profile.skills).toBeDefined();
        expect((result.profile as any).Skills).toBeUndefined();
        expect(result.profile.version).toBe('4.0.0');

        // Implant should be enhanced with cluster data (bitflag key '2' for eye)
        const eyeImplant = result.profile.Implants['2'];
        expect(eyeImplant).toBeDefined();
        expect(eyeImplant?.clusters?.Shiny).toBeDefined();

        // Other equipment slots should still exist (even if empty)
        expect(result.profile.Weapons).toBeDefined();
        expect(result.profile.Clothing).toBeDefined();
      }
    });
  });
});
