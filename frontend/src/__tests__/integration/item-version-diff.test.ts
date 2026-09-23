/**
 * Snapshot comparison table.
 *
 * Rows are the differences a reader can act on: renamed or reworded text,
 * stats added, removed or changed, and requirement criteria that moved.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ItemVersionDiff from '@/components/versions/ItemVersionDiff.vue';
import type { Item } from '@/types/api';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    aoid: 21793,
    name: 'Augmented Nano Armor Sleeves',
    ql: 200,
    description: 'Lightweight armor.',
    is_nano: false,
    stats: [],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
    ...overrides,
  };
}

function stat(id: number, value: number) {
  return { id, stat: id, value };
}

function mountDiff(fromItem: Item | null, toItem: Item | null) {
  return mount(ItemVersionDiff, {
    props: {
      fromItem,
      toItem,
      fromLabel: 'Anarchy Online (Feb 2024)',
      toLabel: 'Project Rubi-Ka (Jan 2026)',
    },
    global: { plugins: [PrimeVue] },
  });
}

describe('ItemVersionDiff', () => {
  it('reports stats added, removed and changed', () => {
    const wrapper = mountDiff(
      makeItem({ stats: [stat(16, 100), stat(17, 50)] }),
      makeItem({ stats: [stat(16, 120), stat(18, 10)] })
    );

    const rows = wrapper.findAll('[data-testid="item-version-diff-row"]');
    const text = rows.map((row) => row.text());

    expect(
      text.some((row) => row.includes('changed') && row.includes('100') && row.includes('120'))
    ).toBe(true);
    expect(text.some((row) => row.includes('removed') && row.includes('50'))).toBe(true);
    expect(text.some((row) => row.includes('added') && row.includes('10'))).toBe(true);
  });

  it('reports a changed requirement value', () => {
    const action = (value: number) => [
      {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [{ id: 1, value1: 16, value2: value, operator: 2 }],
      },
    ];

    const wrapper = mountDiff(
      makeItem({ actions: action(400) }),
      makeItem({ actions: action(500) })
    );

    const row = wrapper.find('[data-testid="item-version-diff-row"]');
    expect(row.text()).toContain('requires');
    expect(row.text()).toContain('400');
    expect(row.text()).toContain('500');
  });

  it('shows the region where long text differs, with the full value on hover', () => {
    const shared = 'The armor is plugged directly into the user';
    const tail = ' nervous system, and uses it for information-gathering and processing.';
    const fromText = `${shared}'s${tail}`;
    const toText = `${shared}?s${tail}`;

    const wrapper = mountDiff(
      makeItem({ description: fromText }),
      makeItem({ description: toText })
    );

    const cells = wrapper.find('[data-testid="item-version-diff-row"]').findAll('td');
    expect(cells[1].text()).toBe('Description');
    // The excerpt is windowed on the first difference, not the identical head.
    expect(cells[2].text()).toContain("user's");
    expect(cells[3].text()).toContain('user?s');
    expect(cells[2].attributes('title')).toBe(fromText);
    expect(cells[3].attributes('title')).toBe(toText);
  });

  it('reports a rename', () => {
    const wrapper = mountDiff(makeItem(), makeItem({ name: 'Nano Armor Sleeves' }));

    const row = wrapper.find('[data-testid="item-version-diff-row"]');
    expect(row.text()).toContain('Name');
    expect(row.text()).toContain('Nano Armor Sleeves');
  });

  it('ignores StaticInstance, which differs per database rather than per item', () => {
    const wrapper = mountDiff(
      makeItem({ stats: [stat(23, 15135), stat(16, 100)] }),
      makeItem({ stats: [stat(23, 14126), stat(16, 100)] })
    );

    expect(wrapper.findAll('[data-testid="item-version-diff-row"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="item-version-diff-empty"]').exists()).toBe(true);
  });

  it('ignores StaticInstance when it is present on only one side', () => {
    const wrapper = mountDiff(
      makeItem({ stats: [stat(23, 15135), stat(16, 100)] }),
      makeItem({ stats: [stat(16, 100)] })
    );

    expect(wrapper.findAll('[data-testid="item-version-diff-row"]')).toHaveLength(0);
  });

  it('says so when the two snapshots agree', () => {
    const wrapper = mountDiff(
      makeItem({ stats: [stat(16, 100)] }),
      makeItem({ stats: [stat(16, 100)] })
    );

    expect(wrapper.find('[data-testid="item-version-diff-empty"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="item-version-diff-row"]')).toHaveLength(0);
  });
});
