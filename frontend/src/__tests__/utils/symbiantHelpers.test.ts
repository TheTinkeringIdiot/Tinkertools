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
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test Symbiant',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantDisplayName(symbiant)).toBe('Test Symbiant');
    });

    it('returns family-based name if name not available', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: '',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantDisplayName(symbiant)).toBe('Artillery Symbiant');
    });

    it('returns AOID-based name if neither name nor family available', () => {
      const symbiant: Symbiant = {
        aoid: 12345,
        name: '',
        ql: 100,
        slot_id: 1,
        family: null, // the API sends null for symbiants without a family
        actions: [],
      };
      expect(getSymbiantDisplayName(symbiant)).toBe('Symbiant 12345');
    });
  });

  describe('getSymbiantSlotId', () => {
    it('returns slot_id if available', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        slot_id: 5,
        ql: 100,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantSlotId(symbiant)).toBe(5);
    });

    it('generates consistent slot_id based on ID', () => {
      const symbiant1: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 0,
        family: 'Artillery',
        actions: [],
      };
      const symbiant2: Symbiant = {
        aoid: 200,
        name: 'Test',
        ql: 100,
        slot_id: 0,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantSlotId(symbiant1)).toBe(getSymbiantSlotId(symbiant2));
    });

    it('keeps a slot_id of 0 rather than generating one', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 0,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantSlotId(symbiant)).toBe(0);
    });

    it('generates valid slot_id values (0-9)', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 0,
        family: 'Artillery',
        actions: [],
      };
      const slotId = getSymbiantSlotId(symbiant);
      expect(slotId).toBeGreaterThanOrEqual(0);
      expect(slotId).toBeLessThan(10);
    });
  });

  describe('getSymbiantQL', () => {
    it('returns QL if available', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 200,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantQL(symbiant)).toBe(200);
    });

    it('generates QL between 50-300', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 0,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      const ql = getSymbiantQL(symbiant);
      expect(ql).toBeGreaterThanOrEqual(50);
      expect(ql).toBeLessThanOrEqual(300);
    });

    it('generates consistent QL based on AOID', () => {
      const symbiant1: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 0,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      const symbiant2: Symbiant = {
        aoid: 100,
        name: 'Other',
        ql: 0,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantQL(symbiant1)).toBe(getSymbiantQL(symbiant2));
    });
  });

  describe('getSymbiantFamily', () => {
    it('returns family if available', () => {
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 1,
        family: 'Control',
        actions: [],
      };
      expect(getSymbiantFamily(symbiant)).toBe('Control');
    });

    it('generates valid family types', () => {
      const validFamilies = ['Artillery', 'Control', 'Extermination', 'Infantry', 'Support'];
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      const family = getSymbiantFamily(symbiant);
      expect(validFamilies).toContain(family);
    });

    it('generates consistent family based on ID', () => {
      const symbiant1: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      const symbiant2: Symbiant = {
        aoid: 200,
        name: 'Test',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      expect(getSymbiantFamily(symbiant1)).toBe(getSymbiantFamily(symbiant2));
    });
  });

  describe('enrichSymbiant', () => {
    it('preserves existing values', () => {
      const symbiant: Symbiant = {
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
      const symbiant: Symbiant = {
        aoid: 100,
        name: 'Test',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      const enriched = enrichSymbiant(symbiant);

      expect(enriched.name).toBeDefined();
      expect(enriched.slot_id).toBeDefined();
      expect(enriched.ql).toBeDefined();
      expect(enriched.family).toBeDefined();
      expect(enriched.aoid).toBe(100);
    });

    it('creates consistent enriched data', () => {
      const symbiant: Symbiant = {
        aoid: 200,
        name: 'Test',
        ql: 100,
        slot_id: 1,
        family: 'Artillery',
        actions: [],
      };
      const enriched1 = enrichSymbiant(symbiant);
      const enriched2 = enrichSymbiant(symbiant);

      expect(enriched1).toEqual(enriched2);
    });

    it('handles edge cases gracefully', () => {
      const symbiant: Symbiant = {
        aoid: 0,
        name: 'Test',
        ql: 100,
        slot_id: 0,
        family: 'Artillery',
        actions: [],
      };
      const enriched = enrichSymbiant(symbiant);

      expect(enriched.name).toBeDefined();
      expect(enriched.slot_id).toBeDefined();
      expect(enriched.ql).toBeDefined();
      expect(enriched.family).toBeDefined();
    });
  });
});
