import { describe, it, expect } from 'vitest';
import {
  getSymbiantDisplayName,
  getSymbiantSlotId,
  getSymbiantQL,
  getSymbiantFamily,
  enrichSymbiant,
} from '@/utils/symbiantHelpers';
import type { Symbiant } from '@/types/api';

describe('symbiantHelpers', () => {
  describe('getSymbiantDisplayName', () => {
    it('returns name if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: 'Test Symbiant', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantDisplayName(symbiant)).toBe('Test Symbiant');
    });

    it('returns family-based name if name not available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: '', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantDisplayName(symbiant)).toBe('Artillery Symbiant');
    });

    it('returns AOID-based name if neither name nor family available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 12345, name: '', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantDisplayName(symbiant)).toBe('Symbiant 12345');
    });

    it('returns ID-based name if AOID not available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 0, name: '', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantDisplayName(symbiant)).toBe('Symbiant 1');
    });
  });

  describe('getSymbiantSlotId', () => {
    it('returns slot_id if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: 'Test', slot_id: 5, ql: 100, family: 'Artillery', actions: [] };
      expect(getSymbiantSlotId(symbiant)).toBe(5);
    });

    it('generates consistent slot_id based on ID', () => {
      const symbiant1: Symbiant = { id: 1, aoid: 100, name: 'Test', ql: 100, slot_id: 0, family: 'Artillery', actions: [] };
      const symbiant2: Symbiant = { id: 1, aoid: 200, name: 'Test', ql: 100, slot_id: 0, family: 'Artillery', actions: [] };
      expect(getSymbiantSlotId(symbiant1)).toBe(getSymbiantSlotId(symbiant2));
    });

    it('generates different slot_ids for different IDs', () => {
      const symbiant1: Symbiant = { id: 1, aoid: 100, name: 'Test', ql: 100, slot_id: 0, family: 'Artillery', actions: [] };
      const symbiant2: Symbiant = { id: 2, aoid: 100, name: 'Test', ql: 100, slot_id: 0, family: 'Artillery', actions: [] };
      expect(getSymbiantSlotId(symbiant1)).not.toBe(getSymbiantSlotId(symbiant2));
    });

    it('generates valid slot_id values (0-9)', () => {
      const symbiant: Symbiant = { id: 5, aoid: 100, name: 'Test', ql: 100, slot_id: 0, family: 'Artillery', actions: [] };
      const slotId = getSymbiantSlotId(symbiant);
      expect(slotId).toBeGreaterThanOrEqual(0);
      expect(slotId).toBeLessThan(10);
    });
  });

  describe('getSymbiantQL', () => {
    it('returns QL if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: 'Test', ql: 200, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantQL(symbiant)).toBe(200);
    });

    it('generates QL between 50-300', () => {
      const symbiant: Symbiant = { id: 10, aoid: 100, name: 'Test', ql: 0, slot_id: 1, family: 'Artillery', actions: [] };
      const ql = getSymbiantQL(symbiant);
      expect(ql).toBeGreaterThanOrEqual(50);
      expect(ql).toBeLessThanOrEqual(300);
    });

    it('generates consistent QL based on ID', () => {
      const symbiant1: Symbiant = { id: 10, aoid: 100, name: 'Test', ql: 0, slot_id: 1, family: 'Artillery', actions: [] };
      const symbiant2: Symbiant = { id: 10, aoid: 200, name: 'Test', ql: 0, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantQL(symbiant1)).toBe(getSymbiantQL(symbiant2));
    });
  });

  describe('getSymbiantFamily', () => {
    it('returns family if available', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: 'Test', ql: 100, slot_id: 1, family: 'Control', actions: [] };
      expect(getSymbiantFamily(symbiant)).toBe('Control');
    });

    it('generates valid family types', () => {
      const validFamilies = ['Artillery', 'Control', 'Extermination', 'Infantry', 'Support'];
      const symbiant: Symbiant = { id: 3, aoid: 100, name: 'Test', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      const family = getSymbiantFamily(symbiant);
      expect(validFamilies).toContain(family);
    });

    it('generates consistent family based on ID', () => {
      const symbiant1: Symbiant = { id: 7, aoid: 100, name: 'Test', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      const symbiant2: Symbiant = { id: 7, aoid: 200, name: 'Test', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      expect(getSymbiantFamily(symbiant1)).toBe(getSymbiantFamily(symbiant2));
    });
  });

  describe('enrichSymbiant', () => {
    it('preserves existing values', () => {
      const symbiant: Symbiant = {
        id: 1,
        aoid: 100,
        name: 'Existing Name',
        slot_id: 5,
        ql: 150,
        family: 'Control',
        actions: [],
      };

      const enriched = enrichSymbiant(symbiant);
      expect(enriched.name).toBe('Existing Name');
      expect(enriched.slot_id).toBe(5);
      expect(enriched.ql).toBe(150);
      expect(enriched.family).toBe('Control');
    });

    it('fills in missing values', () => {
      const symbiant: Symbiant = { id: 1, aoid: 100, name: 'Test', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      const enriched = enrichSymbiant(symbiant);

      expect(enriched.name).toBeDefined();
      expect(enriched.slot_id).toBeDefined();
      expect(enriched.ql).toBeDefined();
      expect(enriched.family).toBeDefined();
      expect(enriched.id).toBe(1);
      expect(enriched.aoid).toBe(100);
    });

    it('creates consistent enriched data', () => {
      const symbiant: Symbiant = { id: 5, aoid: 200, name: 'Test', ql: 100, slot_id: 1, family: 'Artillery', actions: [] };
      const enriched1 = enrichSymbiant(symbiant);
      const enriched2 = enrichSymbiant(symbiant);

      expect(enriched1).toEqual(enriched2);
    });

    it('handles edge cases gracefully', () => {
      const symbiant: Symbiant = { id: 0, aoid: 0, name: 'Test', ql: 100, slot_id: 0, family: 'Artillery', actions: [] };
      const enriched = enrichSymbiant(symbiant);

      expect(enriched.name).toBeDefined();
      expect(enriched.slot_id).toBeDefined();
      expect(enriched.ql).toBeDefined();
      expect(enriched.family).toBeDefined();
    });
  });
});
