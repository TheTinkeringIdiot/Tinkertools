/**
 * Interpolation Range Transition Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests multi-range item interpolation and navigation between
 * different base items using real backend data
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect } from 'vitest';
import { isBackendAvailable, getBackendUrl } from '../helpers/backend-check';
import { TEST_VERSION } from '../helpers/version-fixtures';
import type {
  Item,
  InterpolationInfo,
  InterpolationResponse,
  InterpolatedItem,
  PaginatedResponse,
  StatValue,
} from '@/types/api';

// Real backend URL for integration testing: item data is served per game version
const BACKEND_URL = `${getBackendUrl()}/api/v1/${TEST_VERSION}`;

// Top-level await: describe.skipIf reads this while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

/**
 * Otek Slicer: one base item per patch point. The backend interpolates between
 * consecutive bases, so interpolation-info lists one range starting at each.
 */
const OTEK_SLICER = {
  aoid: 262759, // the QL 100 base, used as the entry point
  bases: [
    { aoid: 262757, ql: 1 },
    { aoid: 262758, ql: 99 },
    { aoid: 262759, ql: 100 },
    { aoid: 262760, ql: 199 },
    { aoid: 262761, ql: 200 },
    { aoid: 262762, ql: 299 },
    { aoid: 262763, ql: 300 },
  ],
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`);
  expect(response.ok).toBe(true);
  const body: T = await response.json();
  return body;
}

async function interpolate(aoid: number, ql: number): Promise<InterpolatedItem> {
  const data = await getJson<InterpolationResponse>(`/items/${aoid}/interpolate?target_ql=${ql}`);
  expect(data.success).toBe(true);
  expect(data.item).toBeDefined();
  return data.item!;
}

async function sortedRanges(aoid: number) {
  const info = await getJson<InterpolationInfo>(`/items/${aoid}/interpolation-info`);
  return info.ranges.slice().sort((a, b) => a.min_ql - b.min_ql);
}

function statMap(stats: StatValue[]): Map<number, number> {
  return new Map(stats.map((s) => [s.stat, s.value]));
}

describe.skipIf(!BACKEND_AVAILABLE)('Interpolation Range Transitions', () => {
  describe('Multi-Range Item Detection', () => {
    it('should detect contiguous ranges for Otek Slicer', async () => {
      const info = await getJson<InterpolationInfo>(
        `/items/${OTEK_SLICER.aoid}/interpolation-info`
      );

      expect(info.interpolatable).toBe(true);
      expect(info.min_ql).toBe(1);
      expect(info.max_ql).toBe(300);

      const ranges = info.ranges.slice().sort((a, b) => a.min_ql - b.min_ql);
      expect(ranges).toHaveLength(OTEK_SLICER.bases.length);

      ranges.forEach((range, index) => {
        const base = OTEK_SLICER.bases[index];
        const next = OTEK_SLICER.bases[index + 1] ?? base;

        // Each range starts at its base item and runs to the next one
        expect(range.base_aoid).toBe(base.aoid);
        expect(range.min_ql).toBe(base.ql);
        expect(range.max_ql).toBe(next.ql);
      });

      // The top QL is a single fixed item, nothing to interpolate towards
      expect(ranges[ranges.length - 1].interpolatable).toBe(false);
    }, 10000);

    it('should have correct base_aoid for each range', async () => {
      for (const base of OTEK_SLICER.bases) {
        const item = await getJson<Item>(`/items/${base.aoid}`);

        expect(item.aoid).toBe(base.aoid);
        expect(item.ql).toBe(base.ql);
      }
    }, 15000);
  });

  describe('Range Boundary Testing', () => {
    it('should interpolate correctly at range boundaries', async () => {
      for (const base of OTEK_SLICER.bases) {
        const item = await interpolate(OTEK_SLICER.aoid, base.ql);

        // A patch point QL resolves to the base item defined at that QL
        expect(item.ql).toBe(base.ql);
        expect(item.aoid).toBe(base.aoid);
      }
    }, 20000);

    it('should reject a QL below 1', async () => {
      const response = await fetch(
        `${BACKEND_URL}/items/${OTEK_SLICER.aoid}/interpolate?target_ql=0`
      );

      expect(response.status).toBe(422);
    }, 10000);

    it('should hold stats at the top variant above the highest QL', async () => {
      const top = OTEK_SLICER.bases[OTEK_SLICER.bases.length - 1];
      const topItem = await getJson<Item>(`/items/${top.aoid}`);

      const item = await interpolate(OTEK_SLICER.aoid, top.ql + 1);

      expect(item.aoid).toBe(top.aoid);
      expect(item.interpolating).toBe(false);
      expect(statMap(item.stats)).toEqual(statMap(topItem.stats));
    }, 15000);
  });

  describe('Cross-Range Item Properties', () => {
    it('should maintain item identity across ranges', async () => {
      const items: Item[] = [];
      for (const base of OTEK_SLICER.bases) {
        items.push(await getJson<Item>(`/items/${base.aoid}`));
      }

      // Same item at different QLs: identical name and classification
      items.forEach((item) => {
        expect(item.name).toBe(items[0].name);
        expect(item.item_class).toBe(items[0].item_class);
        expect(item.is_nano).toBe(items[0].is_nano);
      });
    }, 15000);

    it('should have different stat values across ranges', async () => {
      const [low, high] = await Promise.all([
        getJson<Item>('/items/262759'), // QL 100
        getJson<Item>('/items/262761'), // QL 200
      ]);

      const lowStats = statMap(low.stats);
      const changed = high.stats.filter(
        (stat) => lowStats.has(stat.stat) && lowStats.get(stat.stat) !== stat.value
      );

      expect(changed.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Interpolation Within Ranges', () => {
    it('should interpolate stats correctly within a range', async () => {
      const [low, high] = await Promise.all([
        getJson<Item>('/items/262759'), // QL 100
        getJson<Item>('/items/262760'), // QL 199
      ]);

      const item = await interpolate(OTEK_SLICER.aoid, 150);

      expect(item.interpolating).toBe(true);
      expect(item.low_ql).toBe(100);
      expect(item.high_ql).toBe(199);

      const lowStats = statMap(low.stats);
      const highStats = statMap(high.stats);
      let strictlyBetween = 0;

      for (const { stat, value } of item.stats) {
        const lo = lowStats.get(stat);
        const hi = highStats.get(stat);
        if (lo === undefined || hi === undefined) continue;

        // Every interpolated value stays within its two base values
        expect(value).toBeGreaterThanOrEqual(Math.min(lo, hi));
        expect(value).toBeLessThanOrEqual(Math.max(lo, hi));
        if (value > Math.min(lo, hi) && value < Math.max(lo, hi)) strictlyBetween++;
      }

      // ...and the stats that scale with QL really moved off the base
      expect(strictlyBetween).toBeGreaterThan(0);
    }, 10000);

    it('should interpolate requirements correctly within a range', async () => {
      const item = await interpolate(OTEK_SLICER.aoid, 175);

      const actionsWithRequirements = item.actions.filter((a) => a.criteria.length > 0);
      expect(actionsWithRequirements.length).toBeGreaterThan(0);

      actionsWithRequirements.forEach((action) => {
        action.criteria.forEach((criterion) => {
          expect(typeof criterion.value2).toBe('number');
          expect(criterion.value2).toBeGreaterThan(0);
        });
      });
    }, 10000);
  });

  describe('Range Navigation Logic', () => {
    it('should identify correct target range for any QL', async () => {
      const ranges = await sortedRanges(OTEK_SLICER.aoid);

      // A QL strictly inside a range belongs to that range alone
      const testCases = [
        { ql: 50, baseAoid: 262757 },
        { ql: 150, baseAoid: 262759 },
        { ql: 250, baseAoid: 262761 },
      ];

      testCases.forEach(({ ql, baseAoid }) => {
        const matching = ranges.filter((r) => ql >= r.min_ql && ql <= r.max_ql);
        expect(matching).toHaveLength(1);
        expect(matching[0].base_aoid).toBe(baseAoid);
      });
    }, 10000);

    it('should validate that each range has unique AOID', async () => {
      const ranges = await sortedRanges(OTEK_SLICER.aoid);

      const aoids = ranges.map((r) => r.base_aoid);
      expect(new Set(aoids).size).toBe(aoids.length);
    }, 10000);
  });

  describe('Cross-Range Consistency', () => {
    it('should maintain spell effects across ranges', async () => {
      const items: Item[] = [];
      for (const base of OTEK_SLICER.bases) {
        items.push(await getJson<Item>(`/items/${base.aoid}`));
      }

      const baseEvents = items[0].spell_data.map((spellData) => spellData.event);

      items.forEach((item) => {
        // Same spell events at every QL, with possibly different values
        expect(item.spell_data.map((spellData) => spellData.event)).toEqual(baseEvents);
        item.spell_data.forEach((spellData) => {
          expect(Array.isArray(spellData.spells)).toBe(true);
        });
      });
    }, 15000);

    it('should maintain action types across ranges', async () => {
      const items: Item[] = [];
      for (const base of OTEK_SLICER.bases) {
        items.push(await getJson<Item>(`/items/${base.aoid}`));
      }

      const actionTypes = items[0].actions.map((a) => a.action).sort();
      expect(actionTypes.length).toBeGreaterThan(0);

      items.forEach((item) => {
        expect(item.actions.map((a) => a.action).sort()).toEqual(actionTypes);
      });
    }, 15000);
  });

  describe('Performance Testing', () => {
    it('should retrieve interpolation info quickly', async () => {
      const startTime = performance.now();

      const response = await fetch(`${BACKEND_URL}/items/${OTEK_SLICER.aoid}/interpolation-info`);

      const duration = performance.now() - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(1000); // Should be under 1 second
    }, 10000);

    it('should interpolate items efficiently', async () => {
      const startTime = performance.now();

      const response = await fetch(
        `${BACKEND_URL}/items/${OTEK_SLICER.aoid}/interpolate?target_ql=150`
      );

      const duration = performance.now() - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(2000); // Should be under 2 seconds
    }, 10000);
  });

  describe('Edge Case Testing', () => {
    it('should handle interpolation at exact base QLs', async () => {
      const testCases = [
        { aoid: 262759, ql: 100 }, // Exact base QL
        { aoid: 262761, ql: 200 }, // Exact base QL of the next range
      ];

      for (const { aoid, ql } of testCases) {
        const item = await interpolate(aoid, ql);

        expect(item.ql).toBe(ql);
        // Still interpolating: the next base item sits above it
        expect(item.interpolating).toBe(true);
      }
    }, 15000);

    it('should handle non-interpolatable items gracefully', async () => {
      // Nanos have a single fixed QL and never interpolate
      const nanos = await getJson<PaginatedResponse<{ aoid: number }>>('/nanos?page_size=1');
      expect(nanos.items.length).toBeGreaterThan(0);
      const nanoAoid = nanos.items[0].aoid;

      const item = await interpolate(nanoAoid, 200);

      expect(item.aoid).toBe(nanoAoid);
      expect(item.is_nano).toBe(true);
      expect(item.interpolating).toBe(false);
    }, 10000);
  });
});
