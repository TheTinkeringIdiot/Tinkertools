import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NanoCard from '@/components/nanos/NanoCard.vue';
import type { NanoProgram, TinkerProfile, NanoCompatibilityInfo } from '@/types/nano';

// Mock PrimeVue components
vi.mock('primevue/avatar', () => ({
  default: {
    name: 'Avatar',
    template: '<div class="avatar" :class="$attrs.class"><span>{{ label }}</span></div>',
    props: ['label', 'size', 'shape']
  }
}));

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="badge" :class="severity">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')" :class="[severity, { text }]"><i :class="icon"></i>{{ label }}</button>',
    props: ['icon', 'label', 'severity', 'text', 'rounded', 'size'],
    emits: ['click']
  }
}));

vi.mock('primevue/card', () => ({
  default: {
    name: 'Card',
    template: '<div class="card" :class="$attrs.class" @click="$emit(\'click\')"><div class="header"><slot name="header" /></div><div class="content"><slot name="content" /></div></div>',
    emits: ['click']
  }
}));

vi.mock('primevue/chip', () => ({
  default: {
    name: 'Chip',
    template: '<span class="chip" :class="severity">{{ label }}</span>',
    props: ['label', 'severity']
  }
}));

describe('NanoCard', () => {
  let wrapper: any;
  let mockNano: NanoProgram;
  let mockProfile: TinkerProfile;
  let mockCompatibilityInfo: NanoCompatibilityInfo;

  beforeEach(() => {
    mockNano = {
      id: 1,
      name: 'Superior Heal',
      school: 'Biological Metamorphosis',
      strain: 'Heal Delta',
      description: 'Heals target for a large amount of health over time.',
      level: 125,
      qualityLevel: 175,
      profession: 'Doctor',
      nanoPointCost: 450,
      castingTime: 3,
      rechargeTime: 5,
      memoryUsage: 85,
      sourceLocation: 'Omni-Tek Shop',
      acquisitionMethod: 'Purchase',
      castingRequirements: [
        { type: 'skill', requirement: 'Biological Metamorphosis', value: 750, critical: true },
        { type: 'skill', requirement: 'Nano Programming', value: 600, critical: true },
        { type: 'level', requirement: 'level', value: 125, critical: true }
      ],
      effects: [
        {
          type: 'heal',
          value: 1250,
          modifier: 'add',
          stackable: false,
          conditions: []
        }
      ],
      duration: { type: 'instant' },
      targeting: { type: 'team', range: 30 }
    };

    mockProfile = {
      id: 'test-profile',
      name: 'Test Character',
      profession: 'Doctor',
      level: 100,
      skills: {
        'Biological Metamorphosis': 500,
        'Matter Creation': 300,
        'Nano Programming': 400
      },
      stats: {
        'Intelligence': 400,
        'Psychic': 300
      },
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };

    mockCompatibilityInfo = {
      canCast: false,
      compatibilityScore: 67,
      averageSkillGap: 200,
      skillDeficits: [
        { skill: 'Biological Metamorphosis', current: 500, required: 750, deficit: 250 },
        { skill: 'Nano Programming', current: 400, required: 600, deficit: 200 }
      ],
      statDeficits: [],
      levelDeficit: 25,
      memoryUsage: 85,
      nanoPointCost: 450
    };

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => '[]'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    global.localStorage = localStorageMock as any;

    wrapper = mount(NanoCard, {
      props: {
        nano: mockNano,
        compact: false,
        showCompatibility: false,
        activeProfile: null,
        compatibilityInfo: null
      }
    });
  });

  it('renders nano name correctly', () => {
    expect(wrapper.text()).toContain('Superior Heal');
  });

  it('displays school avatar with correct short name', () => {
    const avatar = wrapper.find('.avatar');
    expect(avatar.exists()).toBe(true);
    expect(avatar.text()).toContain('BM'); // Biological Metamorphosis -> BM
  });

  it('shows nano badges (school, quality level, level)', () => {
    const badges = wrapper.findAll('.badge');
    expect(badges.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('BM'); // School short name
    expect(wrapper.text()).toContain('QL 175'); // Quality level
    expect(wrapper.text()).toContain('Lvl 125'); // Level
  });

  it('displays favorite button', () => {
    const favoriteButton = wrapper.find('button');
    expect(favoriteButton.exists()).toBe(true);
    expect(favoriteButton.find('i').classes()).toContain('pi-heart');
  });

  it('shows nano description in detailed view', () => {
    expect(wrapper.text()).toContain('Heals target for a large amount');
  });

  it('displays nano properties in detailed view', () => {
    expect(wrapper.text()).toContain('Heal Delta'); // Strain
    expect(wrapper.text()).toContain('Doctor'); // Profession
    expect(wrapper.text()).toContain('450'); // NP Cost
    expect(wrapper.text()).toContain('85mb'); // Memory
    expect(wrapper.text()).toContain('3s'); // Cast time
    expect(wrapper.text()).toContain('5s'); // Recharge time
  });

  it('shows effects preview', () => {
    expect(wrapper.text()).toContain('Effects');
    expect(wrapper.text()).toContain('Heal'); // Effect type
  });

  it('displays casting requirements', () => {
    expect(wrapper.text()).toContain('Requirements');
    expect(wrapper.text()).toContain('Biological Metamorphosis');
    expect(wrapper.text()).toContain('750');
    expect(wrapper.text()).toContain('Nano Programming');
    expect(wrapper.text()).toContain('600');
    expect(wrapper.text()).toContain('Level');
    expect(wrapper.text()).toContain('125');
  });

  it('renders in compact mode when compact prop is true', async () => {
    await wrapper.setProps({ compact: true });
    
    // In compact mode, should still show basic info but in condensed format
    expect(wrapper.text()).toContain('Superior Heal');
    expect(wrapper.text()).toContain('BM');
    expect(wrapper.text()).toContain('QL 175');
  });

  it('emits select event when card is clicked', async () => {
    await wrapper.find('.card').trigger('click');
    
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')[0][0]).toEqual(mockNano);
  });

  it('toggles favorite when favorite button is clicked', async () => {
    const favoriteButton = wrapper.find('button');
    await favoriteButton.trigger('click');
    
    expect(wrapper.emitted('favorite')).toBeTruthy();
    expect(wrapper.emitted('favorite')?.[0]).toEqual([1, true]);
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('prevents card click event when favorite button is clicked', async () => {
    const favoriteButton = wrapper.find('button');
    
    await favoriteButton.trigger('click');
    
    // Should emit favorite but not select (since we're clicking the button, not the card)
    expect(wrapper.emitted('favorite')).toBeTruthy();
    // Card click should not be triggered when button is clicked
    expect(wrapper.emitted('select')).toBeFalsy();
  });

  it('shows compatibility info when provided', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: mockCompatibilityInfo
    });
    
    expect(wrapper.text()).toContain('67%'); // Compatibility score
    expect(wrapper.find('i').classes()).toContain('pi-times-circle'); // Cannot cast icon
  });

  it('displays skill deficits when compatibility info shows them', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: mockCompatibilityInfo
    });
    
    expect(wrapper.text()).toContain('Cannot Cast');
    expect(wrapper.text()).toContain('Biological Metamorphosis');
    expect(wrapper.text()).toContain('need 250 more'); // Skill deficit
    expect(wrapper.text()).toContain('Nano Programming');
    expect(wrapper.text()).toContain('need 200 more'); // Skill deficit
  });

  it('shows level deficit when character level is too low', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: mockCompatibilityInfo
    });
    
    expect(wrapper.text()).toContain('25 more levels'); // Level deficit
  });

  it('shows resource costs in compatibility panel', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: mockCompatibilityInfo
    });
    
    expect(wrapper.text()).toContain('85mb'); // Memory usage
    expect(wrapper.text()).toContain('450'); // Nano point cost
  });

  it('displays correct border color based on compatibility', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: mockCompatibilityInfo
    });
    
    const card = wrapper.find('.card');
    expect(card.classes()).toContain('border-l-red-500'); // Cannot cast - red border
  });

  it('shows green border for castable nanos', async () => {
    const castableCompatibility = {
      ...mockCompatibilityInfo,
      canCast: true,
      compatibilityScore: 100,
      skillDeficits: [],
      levelDeficit: 0
    };
    
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: castableCompatibility
    });
    
    const card = wrapper.find('.card');
    expect(card.classes()).toContain('border-l-green-500'); // Can cast - green border
  });

  it('shows yellow border for partially compatible nanos', async () => {
    const partialCompatibility = {
      ...mockCompatibilityInfo,
      canCast: false,
      compatibilityScore: 80,
      skillDeficits: [{ skill: 'Test', current: 400, required: 500, deficit: 100 }],
      levelDeficit: 0
    };
    
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile,
      compatibilityInfo: partialCompatibility
    });
    
    const card = wrapper.find('.card');
    expect(card.classes()).toContain('border-l-yellow-500'); // Partially compatible - yellow border
  });

  it('formats time values correctly', () => {
    // Should show "3s" for casting time and "5s" for recharge time
    expect(wrapper.text()).toContain('3s');
    expect(wrapper.text()).toContain('5s');
  });

  it('handles nanos without optional properties', async () => {
    const minimalNano: NanoProgram = {
      id: 2,
      name: 'Basic Nano',
      school: 'Matter Creation',
      strain: 'Test',
      level: 1,
      qualityLevel: 1
    };
    
    await wrapper.setProps({ nano: minimalNano });
    
    expect(wrapper.text()).toContain('Basic Nano');
    expect(wrapper.text()).toContain('MC'); // Matter Creation -> MC
  });

  it('shows requirement status when profile is active', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile
    });
    
    // Should show current/required values for requirements
    const reqElements = wrapper.findAll('.text-red-600, .text-green-600');
    expect(reqElements.length).toBeGreaterThan(0);
  });

  it('loads favorite status from localStorage', () => {
    expect(localStorage.getItem).toHaveBeenCalledWith('tinkertools_nano_favorites');
  });

  it('shows strain badge when strain is present', () => {
    expect(wrapper.text()).toContain('Heal Delta');
  });

  it('truncates effects list when more than 3 effects', async () => {
    const nanoWithManyEffects = {
      ...mockNano,
      effects: [
        { type: 'heal', value: 100, modifier: 'add', stackable: false, conditions: [] },
        { type: 'damage', value: 200, modifier: 'add', stackable: false, conditions: [] },
        { type: 'protection', value: 300, modifier: 'add', stackable: false, conditions: [] },
        { type: 'utility', value: 400, modifier: 'add', stackable: false, conditions: [] },
        { type: 'summon', value: 500, modifier: 'add', stackable: false, conditions: [] }
      ]
    };
    
    await wrapper.setProps({ nano: nanoWithManyEffects });
    
    expect(wrapper.text()).toContain('+2 more'); // Shows truncation indicator
  });
});