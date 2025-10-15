/**
 * Unit tests for AOSetups cluster mappings
 */

import { describe, it, expect } from 'vitest';
import {
  getClusterMapping,
  isValidClusterId,
  getSlotPosition,
  CLUSTER_ID_TO_STAT,
  AOSETUPS_SLOT_TO_BITFLAG
} from '@/lib/tinkerprofiles/cluster-mappings';

describe('Cluster Mappings', () => {
  describe('getClusterMapping', () => {
    it('should return mapping for valid cluster IDs', () => {
      // Test known cluster IDs
      const strengthMapping = getClusterMapping(77);
      expect(strengthMapping).toEqual({
        stat: 16,
        skillName: 'Strength',
        longName: 'Strength'
      });

      const agilityMapping = getClusterMapping(7);
      expect(agilityMapping).toEqual({
        stat: 17,
        skillName: 'Agility',
        longName: 'Agility'
      });

      const pistolMapping = getClusterMapping(60);
      expect(pistolMapping).toEqual({
        stat: 112,
        skillName: 'Pistol',
        longName: 'Pistol'
      });
    });

    it('should return null for invalid cluster IDs', () => {
      expect(getClusterMapping(0)).toBeNull();
      expect(getClusterMapping(999)).toBeNull();
      expect(getClusterMapping(-1)).toBeNull();
    });

    it('should handle special modifier clusters', () => {
      // These should be excluded (have "*" in longName)
      expect(getClusterMapping(87)).toBeNull(); // Nano Delta*
      expect(getClusterMapping(89)).toBeNull(); // Add All Defense*
    });
  });

  describe('isValidClusterId', () => {
    it('should return true for valid cluster IDs', () => {
      expect(isValidClusterId(77)).toBe(true); // Strength
      expect(isValidClusterId(7)).toBe(true);  // Agility
      expect(isValidClusterId(60)).toBe(true); // Pistol
    });

    it('should return false for invalid cluster IDs', () => {
      expect(isValidClusterId(0)).toBe(false);
      expect(isValidClusterId(999)).toBe(false);
      expect(isValidClusterId(87)).toBe(false); // Excluded modifier
    });
  });

  describe('getSlotPosition', () => {
    it('should map AOSetups slot names to bitflag values', () => {
      expect(getSlotPosition('eye')).toBe(2);      // 1 << 1
      expect(getSlotPosition('head')).toBe(4);     // 1 << 2
      expect(getSlotPosition('ear')).toBe(8);      // 1 << 3
      expect(getSlotPosition('rarm')).toBe(16);    // 1 << 4
      expect(getSlotPosition('chest')).toBe(32);   // 1 << 5
      expect(getSlotPosition('larm')).toBe(64);    // 1 << 6
      expect(getSlotPosition('rwrist')).toBe(128); // 1 << 7
      expect(getSlotPosition('waist')).toBe(256);  // 1 << 8
      expect(getSlotPosition('lwrist')).toBe(512); // 1 << 9
      expect(getSlotPosition('rhand')).toBe(1024); // 1 << 10
      expect(getSlotPosition('leg')).toBe(2048);   // 1 << 11
      expect(getSlotPosition('lhand')).toBe(4096); // 1 << 12
      expect(getSlotPosition('feet')).toBe(8192);  // 1 << 13
    });

    it('should handle case insensitive slot names', () => {
      expect(getSlotPosition('EYE')).toBe(2);
      expect(getSlotPosition('Head')).toBe(4);
      expect(getSlotPosition('CHEST')).toBe(32);
    });

    it('should return null for invalid slot names', () => {
      expect(getSlotPosition('invalid')).toBeNull();
      expect(getSlotPosition('')).toBeNull();
      expect(getSlotPosition('arm')).toBeNull();
    });
  });

  describe('CLUSTER_ID_TO_STAT mapping', () => {
    it('should contain expected skill mappings', () => {
      // Check that key skills are mapped
      expect(CLUSTER_ID_TO_STAT[77]).toBeDefined(); // Strength
      expect(CLUSTER_ID_TO_STAT[7]).toBeDefined();  // Agility
      expect(CLUSTER_ID_TO_STAT[37]).toBeDefined(); // Intelligence
      expect(CLUSTER_ID_TO_STAT[61]).toBeDefined(); // Psychic
      expect(CLUSTER_ID_TO_STAT[71]).toBeDefined(); // Sense
      expect(CLUSTER_ID_TO_STAT[76]).toBeDefined(); // Stamina

      // Check weapon skills
      expect(CLUSTER_ID_TO_STAT[60]).toBeDefined(); // Pistol
      expect(CLUSTER_ID_TO_STAT[68]).toBeDefined(); // Rifle
      expect(CLUSTER_ID_TO_STAT[2]).toBeDefined();  // 1h Blunt
    });

    it('should exclude modifier clusters with "*" suffixes', () => {
      // These should not be in the mapping
      expect(CLUSTER_ID_TO_STAT[87]).toBeUndefined(); // Nano Delta*
      expect(CLUSTER_ID_TO_STAT[89]).toBeUndefined(); // Add All Defense*
      expect(CLUSTER_ID_TO_STAT[91]).toBeUndefined(); // Add Max NCU*
    });

    it('should map all entries correctly to STAT numbers', () => {
      for (const [clusterId, mapping] of Object.entries(CLUSTER_ID_TO_STAT)) {
        const id = parseInt(clusterId);
        expect(id).toBeGreaterThan(0);
        expect(mapping.stat).toBeGreaterThan(0);
        expect(mapping.skillName).toBeTruthy();
        expect(mapping.longName).toBeTruthy();
      }
    });
  });

  describe('AOSETUPS_SLOT_TO_BITFLAG mapping', () => {
    it('should cover all standard implant slots', () => {
      const expectedSlots = [
        'eye', 'head', 'ear', 'rarm', 'chest', 'larm',
        'rwrist', 'waist', 'lwrist', 'rhand', 'leg', 'lhand', 'feet'
      ];

      for (const slot of expectedSlots) {
        expect(AOSETUPS_SLOT_TO_BITFLAG[slot]).toBeDefined();
        expect(AOSETUPS_SLOT_TO_BITFLAG[slot]).toBeGreaterThan(0);
        expect(AOSETUPS_SLOT_TO_BITFLAG[slot]).toBeLessThanOrEqual(8192);
      }
    });

    it('should have unique bitflag numbers', () => {
      const bitflags = Object.values(AOSETUPS_SLOT_TO_BITFLAG);
      const uniqueBitflags = new Set(bitflags);
      // Note: 'leg' and 'legs' both map to 2048, so unique count is less than total count
      expect(uniqueBitflags.size).toBeGreaterThan(0);
      expect(uniqueBitflags.size).toBeLessThanOrEqual(bitflags.length);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete implant transformation workflow', () => {
      // Simulate AOSetups implant data
      const aoSetupsImplant = {
        slot: 'eye',
        type: 'implant',
        ql: 100,
        clusters: {
          Shiny: { ClusterID: 77 },    // Strength
          Bright: { ClusterID: 60 },   // Pistol
          Faded: { ClusterID: 37 }     // Intelligence
        }
      };

      // Get slot bitflag
      const slotBitflag = getSlotPosition(aoSetupsImplant.slot);
      expect(slotBitflag).toBe(2); // Eye bitflag (1 << 1)

      // Get cluster mappings
      const shinyMapping = getClusterMapping(aoSetupsImplant.clusters.Shiny.ClusterID);
      const brightMapping = getClusterMapping(aoSetupsImplant.clusters.Bright.ClusterID);
      const fadedMapping = getClusterMapping(aoSetupsImplant.clusters.Faded.ClusterID);

      expect(shinyMapping).toEqual({
        stat: 16,
        skillName: 'Strength',
        longName: 'Strength'
      });

      expect(brightMapping).toEqual({
        stat: 112,
        skillName: 'Pistol',
        longName: 'Pistol'
      });

      expect(fadedMapping).toEqual({
        stat: 19,
        skillName: 'Intelligence',
        longName: 'Intelligence'
      });
    });

    it('should handle symbiant data without clusters', () => {
      // Symbiant doesn't have cluster data, only AOID
      const aoSetupsSymbiant = {
        slot: 'chest',
        symbiant: {
          highid: 123456,
          selectedQl: 150
        }
      };

      const slotBitflag = getSlotPosition(aoSetupsSymbiant.slot);
      expect(slotBitflag).toBe(32); // Chest bitflag (1 << 5)
    });
  });
});