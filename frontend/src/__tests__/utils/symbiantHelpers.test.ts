import { describe, it, expect } from 'vitest';
import {
  getSymbiantDisplayName,
  getSymbiantSlot,
  getSymbiantQL,
  getSymbiantFamily,
  enrichSymbiant,
} from '@/utils/symbiantHelpers';
import type { Symbiant } from '@/types/api';

describe('symbiantHelpers', () => {
  describe('getSymbiantDisplayName', () => {
    it('returns name if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: 'Test Symbiant' };
      expect(getSymbiantDisplayName(symbiant)).toBe('Test Symbiant');
    });

    it('returns family-based name if name not available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, family: 'Artillery' };
      expect(getSymbiantDisplayName(symbiant)).toBe('Artillery Symbiant');
    });

    it('returns AOID-based name if neither name nor family available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 12345 };
      expect(getSymbiantDisplayName(symbiant)).toBe('Symbiant 12345');
    });

    it('returns ID-based name if AOID not available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 0 };
      expect(getSymbiantDisplayName(symbiant)).toBe('Symbiant 1');
    });
  });

  describe('getSymbiantSlot', () => {
    it('returns slot if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, slot: 'Head' };
      expect(getSymbiantSlot(symbiant)).toBe('Head');
    });

    it('generates consistent slot based on ID', () => {
      const symbiant1: Symbiant = { id: 1, aoid: 100 };
      const symbiant2: Symbiant = { id: 1, aoid: 200 };
      expect(getSymbiantSlot(symbiant1)).toBe(getSymbiantSlot(symbiant2));
    });

    it('generates different slots for different IDs', () => {
      const symbiant1: Symbiant = { id: 1, aoid: 100 };
      const symbiant2: Symbiant = { id: 2, aoid: 100 };
      expect(getSymbiantSlot(symbiant1)).not.toBe(getSymbiantSlot(symbiant2));
    });

    it('generates valid slot types', () => {
      const validSlots = [
        'Head',
        'Eye',
        'Ear',
        'Chest',
        'Arm',
        'Wrist',
        'Hand',
        'Waist',
        'Leg',
        'Feet',
      ];
      const symbiant: Symbiant = { id: 5, aoid: 100 };
      const slot = getSymbiantSlot(symbiant);
      expect(validSlots).toContain(slot);
    });
  });

  describe('getSymbiantQL', () => {
    it('returns QL if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, ql: 200 };
      expect(getSymbiantQL(symbiant)).toBe(200);
    });

    it('generates QL between 50-300', () => {
      const symbiant: Symbiant = { id: 10, aoid: 100 };
      const ql = getSymbiantQL(symbiant);
      expect(ql).toBeGreaterThanOrEqual(50);
      expect(ql).toBeLessThanOrEqual(300);
    });

    it('generates consistent QL based on ID', () => {
      const symbiant1: Symbiant = { id: 10, aoid: 100 };
      const symbiant2: Symbiant = { id: 10, aoid: 200 };
      expect(getSymbiantQL(symbiant1)).toBe(getSymbiantQL(symbiant2));
    });
  });

  describe('getSymbiantFamily', () => {
    it('returns family if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, family: 'Control' };
      expect(getSymbiantFamily(symbiant)).toBe('Control');
    });

    it('generates valid family types', () => {
      const validFamilies = ['Artillery', 'Control', 'Exterminator', 'Infantry', 'Support'];
      const symbiant: Symbiant = { id: 3, aoid: 100 };
      const family = getSymbiantFamily(symbiant);
      expect(validFamilies).toContain(family);
    });

    it('generates consistent family based on ID', () => {
      const symbiant1: Symbiant = { id: 7, aoid: 100 };
      const symbiant2: Symbiant = { id: 7, aoid: 200 };
      expect(getSymbiantFamily(symbiant1)).toBe(getSymbiantFamily(symbiant2));
    });
  });

  describe('enrichSymbiant', () => {
    it('preserves existing values', () => {
      const symbiant: Symbiant = {
        id: 1,
        aoid: 100,
        name: 'Existing Name',
        slot: 'Existing Slot',
        ql: 150,
        family: 'Existing Family',
      };

      const enriched = enrichSymbiant(symbiant);
      expect(enriched.name).toBe('Existing Name');
      expect(enriched.slot).toBe('Existing Slot');
      expect(enriched.ql).toBe(150);
      expect(enriched.family).toBe('Existing Family');
    });

    it('fills in missing values', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100 };
      const enriched = enrichSymbiant(symbiant);

      expect(enriched.name).toBeDefined();
      expect(enriched.slot).toBeDefined();
      expect(enriched.ql).toBeDefined();
      expect(enriched.family).toBeDefined();
      expect(enriched.id).toBe(1);
      expect(enriched.aoid).toBe(100);
    });

    it('creates consistent enriched data', () => {
      const symbiant: Symbiant = { id: 5, aoid: 200 };
      const enriched1 = enrichSymbiant(symbiant);
      const enriched2 = enrichSymbiant(symbiant);

      expect(enriched1).toEqual(enriched2);
    });

    it('handles edge cases gracefully', () => {
      const symbiant: Symbiant = { id: 0, aoid: 0 };
      const enriched = enrichSymbiant(symbiant);

      expect(enriched.name).toBeDefined();
      expect(enriched.slot).toBeDefined();
      expect(enriched.ql).toBeDefined();
      expect(enriched.family).toBeDefined();
    });
  });
});
