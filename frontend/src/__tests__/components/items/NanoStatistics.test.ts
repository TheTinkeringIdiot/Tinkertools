import { describe, it, expect } from 'vitest';
import {
  mountWithContext,
  standardCleanup,
  createTestProfile,
  SKILL_ID,
  PROFESSION,
} from '@/__tests__/helpers';
import NanoStatistics from '@/components/items/NanoStatistics.vue';
import type { Item } from '@/types/api';

// Mock PrimeVue Card component
const CardMock = {
  template: '<div><slot name="content"></slot></div>',
};

// Mock Vue Router components
const RouterLinkMock = {
  template: '<a :href="to.name"><slot></slot></a>',
  props: ['to'],
};

describe('NanoStatistics', () => {
  describe('tick display functionality', () => {
    it('should display ticks when spell has tick_count > 1 and tick_interval > 0', () => {
      const mockNanoWithTicks: Item = {
        id: 1,
        name: 'Test Healing Nano',
        is_nano: true,
        stats: [
          { id: 1, stat: 407, value: 100 }, // NanoPoints
          { id: 2, stat: 287, value: 20 }, // AttackRange
          { id: 3, stat: 8, value: 1000 }, // Duration
        ],
        spell_data: [
          {
            id: 1,
            spells: [
              {
                id: 1,
                tick_count: 5,
                tick_interval: 300, // 3 seconds in centiseconds
                spell_id: 53002,
                spell_params: {},
                criteria: [],
              },
            ],
          },
        ],
        attack_stats: [],
        defense_stats: [],
      };

      const wrapper = mountWithContext(NanoStatistics, {
        props: {
          item: mockNanoWithTicks,
        },
        global: {
          components: {
            Card: CardMock,
            RouterLink: RouterLinkMock,
          },
        },
      });

      // Check if ticks are displayed
      const ticksRow = wrapper.find('[data-testid="ticks-row"]');
      expect(ticksRow.exists()).toBe(true);

      // Check if the format is correct: "5 @ 3.00s"
      const ticksValue = wrapper.find('.val-ticks');
      expect(ticksValue.text()).toBe('5 @ 3.00s');
    });

    it('should not display ticks when tick_count <= 1', () => {
      const mockNanoWithoutTicks: Item = {
        id: 2,
        name: 'Test Instant Nano',
        is_nano: true,
        stats: [{ id: 1, stat: 407, value: 100 }],
        spell_data: [
          {
            id: 1,
            spells: [
              {
                id: 1,
                tick_count: 1,
                tick_interval: 100,
                spell_id: 53002,
                spell_params: {},
                criteria: [],
              },
            ],
          },
        ],
        attack_stats: [],
        defense_stats: [],
      };

      const wrapper = mountWithContext(NanoStatistics, {
        props: {
          item: mockNanoWithoutTicks,
        },
        global: {
          components: {
            Card: CardMock,
            RouterLink: RouterLinkMock,
          },
        },
      });

      // Check that ticks are not displayed
      const ticksRow = wrapper.find('[data-testid="ticks-row"]');
      expect(ticksRow.exists()).toBe(false);
    });

    it('should not display ticks when tick_interval <= 0', () => {
      const mockNanoWithZeroInterval: Item = {
        id: 3,
        name: 'Test Nano with Zero Interval',
        is_nano: true,
        stats: [{ id: 1, stat: 407, value: 100 }],
        spell_data: [
          {
            id: 1,
            spells: [
              {
                id: 1,
                tick_count: 5,
                tick_interval: 0,
                spell_id: 53002,
                spell_params: {},
                criteria: [],
              },
            ],
          },
        ],
        attack_stats: [],
        defense_stats: [],
      };

      const wrapper = mountWithContext(NanoStatistics, {
        props: {
          item: mockNanoWithZeroInterval,
        },
        global: {
          components: {
            Card: CardMock,
            RouterLink: RouterLinkMock,
          },
        },
      });

      // Check that ticks are not displayed
      const ticksRow = wrapper.find('[data-testid="ticks-row"]');
      expect(ticksRow.exists()).toBe(false);
    });

    it('should correctly convert centiseconds to seconds in tick display', () => {
      const mockNanoWithDecimalTicks: Item = {
        id: 4,
        name: 'Test Nano with Decimal Ticks',
        is_nano: true,
        stats: [{ id: 1, stat: 407, value: 100 }],
        spell_data: [
          {
            id: 1,
            spells: [
              {
                id: 1,
                tick_count: 3,
                tick_interval: 250, // 2.5 seconds
                spell_id: 53002,
                spell_params: {},
                criteria: [],
              },
            ],
          },
        ],
        attack_stats: [],
        defense_stats: [],
      };

      const wrapper = mountWithContext(NanoStatistics, {
        props: {
          item: mockNanoWithDecimalTicks,
        },
        global: {
          components: {
            Card: CardMock,
            RouterLink: RouterLinkMock,
          },
        },
      });

      const ticksValue = wrapper.find('.val-ticks');
      expect(ticksValue.text()).toBe('3 @ 2.50s');
    });
  });

  describe('strain link functionality', () => {
    it('should display strain as a clickable RouterLink when strain is present', () => {
      const mockNanoWithStrain: Item = {
        id: 5,
        name: 'Test Nano with Strain',
        is_nano: true,
        stats: [
          { id: 1, stat: 75, value: 123 }, // NanoStrain stat
        ],
        spell_data: [],
        attack_stats: [],
        defense_stats: [],
        actions: [],
      };

      const wrapper = mountWithContext(NanoStatistics, {
        props: {
          item: mockNanoWithStrain,
        },
        global: {
          components: {
            Card: CardMock,
            RouterLink: RouterLinkMock,
          },
        },
      });

      // Check if strain is displayed as a RouterLink
      const strainLink = wrapper.find('a[href="TinkerItems"]');
      expect(strainLink.exists()).toBe(true);

      // Check if the strain text is displayed correctly (strain 123 = "General Poison AC Debuff")
      expect(strainLink.text()).toBe('General Poison AC Debuff');
    });

    it('should not display strain row when strain is not present', () => {
      const mockNanoWithoutStrain: Item = {
        id: 6,
        name: 'Test Nano without Strain',
        is_nano: true,
        stats: [{ id: 1, stat: 407, value: 100 }],
        spell_data: [],
        attack_stats: [],
        defense_stats: [],
        actions: [],
      };

      const wrapper = mountWithContext(NanoStatistics, {
        props: {
          item: mockNanoWithoutStrain,
        },
        global: {
          components: {
            Card: CardMock,
            RouterLink: RouterLinkMock,
          },
        },
      });

      // Check that strain row is not displayed by looking for the strain stat-name
      const strainRows = wrapper.findAll('.stat-pair');
      const hasStrainRow = strainRows.some(
        (row) => row.find('.stat-name').exists() && row.find('.stat-name').text() === 'Strain'
      );
      expect(hasStrainRow).toBe(false);
    });
  });
});
