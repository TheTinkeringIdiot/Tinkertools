import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mountWithContext,
  standardCleanup,
  createTestProfile,
  SKILL_ID,
  PROFESSION,
} from '@/__tests__/helpers';
import { nextTick } from 'vue';
import NanoList from '@/components/nanos/NanoList.vue';
import type { NanoProgram, TinkerProfile } from '@/types/nano';

// Mock NanoCard component
vi.mock('@/components/nanos/NanoCard.vue', () => ({
  default: {
    name: 'NanoCard',
    template:
      '<div class="nano-card" @click="$emit(\'select\', nano)" data-testid="nano-card"><span>{{ nano.name }}</span></div>',
    props: ['nano', 'compact', 'showCompatibility', 'activeProfile', 'compatibilityInfo'],
    emits: ['select', 'favorite'],
  },
}));

// Mock PrimeVue components
vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="badge">{{ value }}</span>',
    props: ['value', 'severity'],
  },
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template:
      '<select v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option" :value="option">{{ option }}</option></select>',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue', 'change'],
  },
}));

vi.mock('primevue/paginator', () => ({
  default: {
    name: 'Paginator',
    template:
      '<div class="paginator"><button @click="$emit(\'page\', { first: 0 })">First</button><button @click="$emit(\'page\', { first: first + rows })">Next</button></div>',
    props: [
      'first',
      'rows',
      'totalRecords',
      'rowsPerPageOptions',
      'template',
      'currentPageReportTemplate',
    ],
    emits: ['page', 'update:first'],
  },
}));

vi.mock('primevue/progressspinner', () => ({
  default: {
    name: 'ProgressSpinner',
    template: '<div class="spinner">Loading...</div>',
  },
}));

vi.mock('primevue/togglebutton', () => ({
  default: {
    name: 'ToggleButton',
    template:
      '<button @click="$emit(\'update:modelValue\', !modelValue)" :class="{ active: modelValue }">{{ modelValue ? onLabel : offLabel }}</button>',
    props: ['modelValue', 'onLabel', 'offLabel', 'onIcon', 'offIcon', 'size'],
    emits: ['update:modelValue'],
  },
}));

describe('NanoList', () => {
  let wrapper: any;
  let mockNanos: NanoProgram[];
  let mockProfile: TinkerProfile;

  beforeEach(() => {
    mockNanos = [
      {
        id: 1,
        name: 'Superior Heal',
        school: 'Biological Metamorphosis',
        strain: 'Heal Delta',
        description: 'Heals target for a large amount.',
        level: 125,
        qualityLevel: 175,
        profession: PROFESSION.DOCTOR,
        nanoPointCost: 450,
        castingTime: 3,
        rechargeTime: 5,
        memoryUsage: 85,
        castingRequirements: [
          { type: 'skill', requirement: SKILL_ID.BIO_METAMOR, value: 750, critical: true },
        ],
        effects: [
          {
            type: 'heal',
            value: 1250,
            modifier: 'add',
            stackable: false,
            conditions: [],
          },
        ],
      },
      {
        id: 2,
        name: 'Matter Armor',
        school: 'Matter Creation',
        strain: 'Protection Alpha',
        description: 'Creates protective armor.',
        level: 100,
        qualityLevel: 150,
        nanoPointCost: 350,
        castingTime: 4,
        rechargeTime: 8,
        memoryUsage: 75,
        castingRequirements: [
          { type: 'skill', requirement: SKILL_ID.MATTER_CREATION, value: 650, critical: true },
        ],
        effects: [
          {
            type: 'protection',
            value: 200,
            modifier: 'add',
            stackable: false,
            conditions: [],
          },
        ],
      },
      {
        id: 3,
        name: 'Summon Pet',
        school: 'Matter Creation',
        strain: 'Summon Beta',
        description: 'Summons a pet.',
        level: 75,
        qualityLevel: 125,
        profession: PROFESSION.META_PHYSICIST,
        nanoPointCost: 500,
        castingTime: 6,
        rechargeTime: 2,
        memoryUsage: 120,
        castingRequirements: [
          { type: 'skill', requirement: SKILL_ID.MATTER_CREATION, value: 500, critical: true },
        ],
        effects: [
          {
            type: 'summon',
            value: 1,
            modifier: 'set',
            stackable: false,
            conditions: [],
          },
        ],
      },
    ];

    mockProfile = createTestProfile({
      profession: PROFESSION.DOCTOR,
      level: 100,
      skills: {
        [SKILL_ID.BIO_METAMOR]: { base: 5, pointsFromIp: 495, equipmentBonus: 0, total: 500 },
        [SKILL_ID.MATTER_CREATION]: { base: 5, pointsFromIp: 295, equipmentBonus: 0, total: 300 },
        [SKILL_ID.NANO_PROGRAMMING]: { base: 5, pointsFromIp: 395, equipmentBonus: 0, total: 400 },
        [SKILL_ID.INTELLIGENCE]: { base: 6, pointsFromIp: 394, equipmentBonus: 0, total: 400 },
        [SKILL_ID.PSYCHIC]: { base: 6, pointsFromIp: 294, equipmentBonus: 0, total: 300 },
      },
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => '{"compactView": false, "itemsPerPage": 25}'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock as any;

    wrapper = mountWithContext(NanoList, {
      props: {
        nanos: mockNanos,
        loading: false,
        showCompatibility: false,
        activeProfile: null,
      },
    });
  });

  it('renders list header with nano count', () => {
    expect(wrapper.text()).toContain('Nano Programs');
    expect(wrapper.text()).toContain('3'); // Total count badge
  });

  it('displays view density toggle', () => {
    const toggleButton = wrapper.find('button');
    expect(toggleButton.exists()).toBe(true);
    expect(wrapper.text()).toContain('Compact') || expect(wrapper.text()).toContain('Detailed');
  });

  it('shows items per page dropdown', () => {
    const dropdown = wrapper.find('select');
    expect(dropdown.exists()).toBe(true);
  });

  it('renders nano cards for each nano', () => {
    const nanoCards = wrapper.findAll('[data-testid="nano-card"]');
    expect(nanoCards.length).toBe(3);
  });

  it('displays nano names in cards', () => {
    expect(wrapper.text()).toContain('Superior Heal');
    expect(wrapper.text()).toContain('Matter Armor');
    expect(wrapper.text()).toContain('Summon Pet');
  });

  it('shows loading state when loading prop is true', async () => {
    await wrapper.setProps({ loading: true });
    expect(wrapper.find('.spinner').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading');
  });

  it('displays empty state when no nanos', async () => {
    await wrapper.setProps({ nanos: [] });
    expect(wrapper.text()).toContain('No nanos found');
    expect(wrapper.text()).toContain('adjusting your search');
  });

  it('emits nano-select event when nano card is clicked', async () => {
    const firstCard = wrapper.find('[data-testid="nano-card"]');
    await firstCard.trigger('click');

    expect(wrapper.emitted('nano-select')).toBeTruthy();
    expect(wrapper.emitted('nano-select')[0][0]).toEqual(mockNanos[0]);
  });

  it('toggles compact view when toggle button clicked', async () => {
    const toggleButton = wrapper.find('button');
    await toggleButton.trigger('click');

    // Should emit update and save preferences
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('changes items per page when dropdown changes', async () => {
    const dropdown = wrapper.find('select');
    await dropdown.setValue('50');
    await dropdown.trigger('change');

    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('calculates compatibility info when profile is active', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
    });

    // Should pass compatibility info to nano cards
    const nanoCards = wrapper.findAllComponents({ name: 'NanoCard' });
    expect(nanoCards.length).toBe(3);
  });

  it('shows paginator when there are multiple pages', async () => {
    // Create more nanos to trigger pagination
    const manyNanos = Array.from({ length: 50 }, (_, i) => ({
      ...mockNanos[0],
      id: i + 1,
      name: `Nano ${i + 1}`,
    }));

    await wrapper.setProps({ nanos: manyNanos });

    const paginator = wrapper.find('.paginator');
    expect(paginator.exists()).toBe(true);
  });

  it('handles page change events', async () => {
    const manyNanos = Array.from({ length: 50 }, (_, i) => ({
      ...mockNanos[0],
      id: i + 1,
      name: `Nano ${i + 1}`,
    }));

    await wrapper.setProps({ nanos: manyNanos });

    const paginator = wrapper.find('.paginator');
    const nextButton = paginator.find('button:last-child');
    await nextButton.trigger('click');

    expect(wrapper.emitted('page-change')).toBeTruthy();
  });

  it('loads preferences from localStorage on mount', () => {
    expect(localStorage.getItem).toHaveBeenCalledWith('tinkertools_nano_list_preferences');
  });

  it('saves preferences to localStorage when changed', async () => {
    const toggleButton = wrapper.find('button');
    await toggleButton.trigger('click');

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_nano_list_preferences',
      expect.stringContaining('compactView')
    );
  });

  it('filters nanos correctly based on compatibility', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
    });

    // Should calculate compatibility for each nano
    // Nano 1 (Superior Heal) requires BM 750, profile has 500 - should not be castable
    // Nano 2 (Matter Armor) requires MC 650, profile has 300 - should not be castable
    // Nano 3 (Summon Pet) requires MC 500, profile has 300 - should not be castable

    const nanoCards = wrapper.findAllComponents({ name: 'NanoCard' });
    expect(nanoCards.length).toBe(3);

    // Each card should receive compatibility info
    nanoCards.forEach((card) => {
      expect(card.props('showCompatibility')).toBe(true);
      expect(card.props('activeProfile')).toEqual(mockProfile);
    });
  });

  it('handles favorite events from nano cards', async () => {
    const firstCard = wrapper.findComponent({ name: 'NanoCard' });
    await firstCard.vm.$emit('favorite', 1, true);

    expect(wrapper.emitted('favorite')).toBeTruthy();
    expect(wrapper.emitted('favorite')[0]).toEqual([1, true]);
  });

  it('resets pagination when nanos change', async () => {
    // Set up with multiple pages
    const manyNanos = Array.from({ length: 50 }, (_, i) => ({
      ...mockNanos[0],
      id: i + 1,
      name: `Nano ${i + 1}`,
    }));

    await wrapper.setProps({ nanos: manyNanos });

    // Go to page 2
    const paginator = wrapper.find('.paginator');
    const nextButton = paginator.find('button:last-child');
    await nextButton.trigger('click');

    // Change nanos (simulating new search)
    await wrapper.setProps({ nanos: mockNanos });

    // Should reset to first page
    const nanoCards = wrapper.findAll('[data-testid="nano-card"]');
    expect(nanoCards.length).toBeLessThanOrEqual(25); // Default page size
  });

  it('scrolls to top when page changes', async () => {
    const scrollToSpy = vi.fn();
    const mockElement = { scrollTo: scrollToSpy };
    vi.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);

    const manyNanos = Array.from({ length: 50 }, (_, i) => ({
      ...mockNanos[0],
      id: i + 1,
      name: `Nano ${i + 1}`,
    }));

    await wrapper.setProps({ nanos: manyNanos });

    const paginator = wrapper.find('.paginator');
    const nextButton = paginator.find('button:last-child');
    await nextButton.trigger('click');

    await nextTick();

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
