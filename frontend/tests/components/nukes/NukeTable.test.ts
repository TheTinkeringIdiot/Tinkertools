/**
 * NukeTable Component Integration Tests
 *
 * Mounts the real table (PrimeVue DataTable, real calculation utilities) and
 * reads what the user sees in the rendered cells. Validates:
 * - Default QL-descending order, header sorting and pagination
 * - Computed columns (cast time, cost, damage, DPS, sustain metrics)
 * - Infinity symbol (∞) display for sustainable nanos
 * - Row click selection and links to the nano detail page
 * - Empty state and reactivity to input changes
 *
 * Search filtering is not tested here: TinkerNukes filters the nano list
 * before handing it to the table.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import NukeTable from '@/components/nukes/NukeTable.vue';
import type { OffensiveNano, NukeInputState } from '@/types/offensive-nano';
import type { Item } from '@/types/api';
import { createTestRouter } from '@/__tests__/helpers';

// ============================================================================
// Test Fixtures
// ============================================================================

const createDefaultInputState = (): NukeInputState => ({
  characterStats: {
    breed: 1,
    level: 220,
    psychic: 100,
    nanoInit: 1200,
    maxNano: 5000,
    nanoDelta: 500,
    matterCreation: 2500,
    matterMeta: 2500,
    bioMeta: 2500,
    psychModi: 2500,
    sensoryImp: 2500,
    timeSpace: 2500,
    spec: 0,
  },
  damageModifiers: {
    projectile: 100,
    melee: 0,
    energy: 150,
    chemical: 0,
    radiation: 0,
    cold: 0,
    nano: 200,
    fire: 0,
    poison: 0,
    directNanoDamageEfficiency: 50,
    targetAC: 0,
  },
  buffPresets: {
    crunchcom: 3,
    humidity: 5,
    notumSiphon: 7,
    channeling: 2,
    enhanceNanoDamage: 4,
    ancientMatrix: 6,
  },
});

/** Makes a sustained-casting scenario impossible: tiny pool, no regen buffs. */
const createStarvedInputState = (): NukeInputState => {
  const state = createDefaultInputState();
  state.characterStats.psychic = 6;
  state.characterStats.nanoDelta = 1;
  state.characterStats.maxNano = 2000;
  state.buffPresets.humidity = 0;
  state.buffPresets.notumSiphon = 0;
  state.buffPresets.channeling = 0;
  return state;
};

const nanoItem = (aoid: number, name: string): Item => ({
  id: aoid,
  aoid,
  name,
  is_nano: true,
  stats: [],
  spell_data: [],
  actions: [],
  attack_stats: [],
  defense_stats: [],
});

const createNano = (overrides: Partial<OffensiveNano> & Pick<OffensiveNano, 'id' | 'name'>) => {
  const aoid = overrides.aoid ?? overrides.id;
  const nano: OffensiveNano = {
    aoid,
    school: 'Biological Metamorphosis',
    strain: '1',
    level: 200,
    qualityLevel: 250,
    castingRequirements: [],
    item: nanoItem(aoid, overrides.name),
    minDamage: 800,
    maxDamage: 1200,
    midDamage: 1000,
    damageType: 'poison',
    tickCount: 1,
    tickInterval: 0,
    castTime: 300,
    rechargeTime: 2000,
    nanoPointCost: 500,
    attackDelayCap: 100,
    rechargeDelayCap: 100,
    ...overrides,
  };
  return nano;
};

const createMockNanos = (): OffensiveNano[] => [
  createNano({ id: 1001, name: 'Viral Bomb', qualityLevel: 250 }),
  createNano({
    id: 1002,
    name: 'Corrosive Cloud',
    level: 210,
    qualityLevel: 260,
    minDamage: 200,
    maxDamage: 300,
    midDamage: 250,
    damageType: 'chemical',
    tickCount: 5,
    tickInterval: 100,
    castTime: 400,
    rechargeTime: 1500,
    nanoPointCost: 450,
  }),
  createNano({
    id: 1003,
    name: 'Energy Blast',
    school: 'Matter Creation',
    level: 220,
    qualityLevel: 300,
    minDamage: 1500,
    maxDamage: 2000,
    midDamage: 1750,
    damageType: 'energy',
    castTime: 500,
    rechargeTime: 3000,
    nanoPointCost: 800,
  }),
];

// ============================================================================
// Test Suite
// ============================================================================

type Row = Record<string, string>;

describe('NukeTable', () => {
  let wrapper: VueWrapper;
  let router: ReturnType<typeof createTestRouter>;

  beforeEach(async () => {
    // Nano names link to the named ItemDetail route, which inherits `version`.
    router = createTestRouter();
    await router.isReady();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  function mountTable(
    nanos: OffensiveNano[] = createMockNanos(),
    inputState: NukeInputState = createDefaultInputState(),
    loading = false
  ): VueWrapper {
    wrapper = mount(NukeTable, {
      props: { nanos, inputState, loading },
      global: { plugins: [router, PrimeVue] },
    });
    return wrapper;
  }

  function headers(): string[] {
    return wrapper.findAll('thead th').map((th) => th.text());
  }

  /** Every rendered body row, keyed by column header. */
  function rows(): Row[] {
    const names = headers();
    return wrapper
      .findAll('tbody tr')
      .filter((tr) => !tr.classes().includes('p-datatable-emptymessage'))
      .map((tr) =>
        Object.fromEntries(tr.findAll('td').map((td, i) => [names[i], td.text().trim()]))
      );
  }

  function row(name: string): Row {
    const found = rows().find((r) => r.Nano === name);
    if (!found) throw new Error(`No row for ${name}`);
    return found;
  }

  // ==========================================================================
  // Component Mounting & Structure Tests
  // ==========================================================================

  describe('Component Structure', () => {
    it('should render one row per nano with every column', () => {
      mountTable();

      expect(headers()).toEqual([
        'Nano',
        'QL',
        'Cast Time (s)',
        'Recharge Time (s)',
        'Min Damage',
        'Mid Damage',
        'Max Damage',
        'Nano Cost',
        'Damage/Nano',
        'Damage/Cast',
        'DPS',
        'Sustain Time',
        'Casts to Empty',
      ]);
      expect(rows()).toHaveLength(3);
    });

    it('should link each nano name to its detail page', () => {
      mountTable();

      const link = wrapper.findAll('tbody a').find((a) => a.text() === 'Viral Bomb');
      expect(link?.attributes('href')).toMatch(/\/items\/1001$/);
    });

    it('should describe the table and its size for screen readers', () => {
      mountTable();

      const label = wrapper.find('[role="table"]').attributes('aria-label');
      expect(label).toContain('3 offensive nano programs');
    });

    it('should show a loading indicator while loading', () => {
      mountTable([], createDefaultInputState(), true);

      expect(wrapper.find('.p-datatable-loading-overlay').exists()).toBe(true);
    });
  });

  // ==========================================================================
  // Sorting & Pagination
  // ==========================================================================

  describe('Column Sorting', () => {
    it('should list nanos by QL, highest first', () => {
      mountTable();

      expect(rows().map((r) => r.QL)).toEqual(['300', '260', '250']);
    });

    it('should re-sort when a column header is clicked', async () => {
      mountTable();
      const costHeader = wrapper.findAll('thead th').find((th) => th.text() === 'Nano Cost');

      await costHeader!.trigger('click');
      const ascending = rows().map((r) => Number(r['Nano Cost']));
      expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

      await costHeader!.trigger('click');
      const descending = rows().map((r) => Number(r['Nano Cost']));
      expect(descending).toEqual([...descending].sort((a, b) => b - a));
    });
  });

  describe('Pagination', () => {
    const manyNanos = () =>
      Array.from({ length: 30 }, (_, i) =>
        createNano({ id: 2000 + i, name: `Nano ${i + 1}`, qualityLevel: 100 + i })
      );

    it('should show 25 rows per page', () => {
      mountTable(manyNanos());

      expect(rows()).toHaveLength(25);
      expect(rows()[0].Nano).toBe('Nano 30');
    });

    it('should show the remaining rows on the next page', async () => {
      mountTable(manyNanos());

      await wrapper.find('.p-paginator-next').trigger('click');

      expect(rows().map((r) => r.Nano)).toEqual(['Nano 5', 'Nano 4', 'Nano 3', 'Nano 2', 'Nano 1']);
    });
  });

  // ==========================================================================
  // Infinity Symbol Display Tests
  // ==========================================================================

  describe('Infinity Symbol Display', () => {
    it('should display ∞ sustain time and casts when regen outpaces cost', () => {
      const cheapNanos = createMockNanos().map((nano) => ({ ...nano, nanoPointCost: 1 }));
      mountTable(cheapNanos);

      for (const r of rows()) {
        expect(r['Sustain Time']).toBe('∞');
        expect(r['Casts to Empty']).toBe('∞');
      }
    });

    it('should display a finite sustain time and cast count when the pool drains', () => {
      mountTable(createMockNanos(), createStarvedInputState());

      for (const r of rows()) {
        expect(r['Sustain Time']).toMatch(/^(\d+m )?\d+s$/);
        expect(r['Casts to Empty']).toMatch(/^\d+$/);
      }
    });
  });

  // ==========================================================================
  // Computed Column Calculations Tests
  // ==========================================================================

  describe('Computed Column Calculations', () => {
    it('should reduce cast time with Nano Init', async () => {
      const lowInit = createDefaultInputState();
      lowInit.characterStats.nanoInit = 1;
      mountTable(createMockNanos(), lowInit);
      const slow = Number(row('Viral Bomb')['Cast Time (s)']);

      await wrapper.setProps({ inputState: createDefaultInputState() }); // Nano Init 1200
      const fast = Number(row('Viral Bomb')['Cast Time (s)']);

      expect(slow).toBe(3); // 300cs base
      expect(fast).toBeLessThan(slow);
    });

    it('should show recharge time in seconds, unaffected by Nano Init', () => {
      mountTable();

      expect(row('Viral Bomb')['Recharge Time (s)']).toBe('20.00'); // 2000cs
    });

    it('should reduce nano cost with Crunchcom', async () => {
      const noCrunchcom = createDefaultInputState();
      noCrunchcom.buffPresets.crunchcom = 0;
      mountTable(createMockNanos(), noCrunchcom);
      expect(Number(row('Viral Bomb')['Nano Cost'])).toBe(500);

      await wrapper.setProps({ inputState: createDefaultInputState() }); // Crunchcom 3
      expect(Number(row('Viral Bomb')['Nano Cost'])).toBeLessThan(500);
    });

    it('should apply damage modifiers to min, mid and max damage', () => {
      const inputState = createDefaultInputState();
      inputState.damageModifiers.poison = 100;
      mountTable(createMockNanos(), inputState);

      const viral = row('Viral Bomb');
      expect(Number(viral['Min Damage'])).toBeGreaterThan(800);
      expect(Number(viral['Mid Damage'])).toBeGreaterThan(1000);
      expect(Number(viral['Max Damage'])).toBeGreaterThan(1200);
      expect(viral['Damage/Cast']).toBe(viral['Mid Damage']);
    });

    it('should show positive DPS and damage per nano for instant and DoT nanos', () => {
      mountTable();

      for (const name of ['Viral Bomb', 'Corrosive Cloud']) {
        expect(Number(row(name).DPS)).toBeGreaterThan(0);
        expect(Number(row(name)['Damage/Nano'])).toBeGreaterThan(0);
      }
    });

    it('should format times and ratios with two decimals and damage as integers', () => {
      mountTable();

      for (const r of rows()) {
        expect(r['Cast Time (s)']).toMatch(/^\d+\.\d{2}$/);
        expect(r['Recharge Time (s)']).toMatch(/^\d+\.\d{2}$/);
        expect(r.DPS).toMatch(/^\d+\.\d{2}$/);
        expect(r['Damage/Nano']).toMatch(/^\d+\.\d{2}$/);
        expect(r['Min Damage']).toMatch(/^\d+$/);
        expect(r['Mid Damage']).toMatch(/^\d+$/);
        expect(r['Max Damage']).toMatch(/^\d+$/);
      }
    });
  });

  // ==========================================================================
  // Row Selection
  // ==========================================================================

  describe('Row Selection', () => {
    it("should emit the clicked nano's AOID", async () => {
      mountTable();

      // Rows are QL-descending: Energy Blast, Corrosive Cloud, Viral Bomb
      const trs = wrapper.findAll('tbody tr');
      await trs[0].trigger('click');
      await trs[2].trigger('click');

      expect(wrapper.emitted('nano-selected')).toEqual([[1003], [1001]]);
    });

    it('should not also select the row when the nano link is clicked', async () => {
      mountTable();

      await wrapper.find('tbody a').trigger('click');

      expect(wrapper.emitted('nano-selected')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Reactive Updates Tests
  // ==========================================================================

  describe('Reactive Updates', () => {
    it('should recalculate when input state changes', async () => {
      const inputState = createDefaultInputState();
      mountTable(createMockNanos(), inputState);
      const initialDps = Number(row('Viral Bomb').DPS);

      await wrapper.setProps({
        inputState: {
          ...inputState,
          damageModifiers: { ...inputState.damageModifiers, directNanoDamageEfficiency: 100 },
        },
      });

      expect(Number(row('Viral Bomb').DPS)).toBeGreaterThan(initialDps);
    });

    it('should show new nanos when the list changes', async () => {
      mountTable(createMockNanos().slice(0, 1));
      expect(rows()).toHaveLength(1);

      await wrapper.setProps({ nanos: createMockNanos() });

      expect(rows()).toHaveLength(3);
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe('Empty State', () => {
    it('should show a helpful message when there are no nanos', () => {
      mountTable([]);

      expect(rows()).toHaveLength(0);
      expect(wrapper.text()).toContain('No offensive nanos found');
      expect(wrapper.text()).toContain('Adjust your search criteria or input values');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very large damage values', () => {
      mountTable([createNano({ id: 8888, name: 'Huge', minDamage: 999999, maxDamage: 9999999 })]);

      expect(Number(row('Huge')['Mid Damage'])).toBeGreaterThan(1000000);
    });

    it('should not show NaN for zero cast time, recharge and cost', () => {
      mountTable([
        createNano({
          id: 7777,
          name: 'Zeroes',
          minDamage: 0,
          maxDamage: 0,
          castTime: 0,
          rechargeTime: 0,
          nanoPointCost: 0,
        }),
      ]);

      expect(Object.values(row('Zeroes')).join(' ')).not.toContain('NaN');
    });
  });
});
