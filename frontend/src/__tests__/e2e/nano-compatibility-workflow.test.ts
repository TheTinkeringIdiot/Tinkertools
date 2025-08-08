import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TinkerNanos from '@/views/TinkerNanos.vue';
import { useNanosStore } from '@/stores/nanosStore';
import { useProfilesStore } from '@/stores/profilesStore';
import type { TinkerProfile } from '@/types/nano';

// Mock router
const mockRouter = {
  currentRoute: { value: { path: '/nanos' } },
  push: vi.fn(),
  replace: vi.fn()
};

const mockRoute = {
  path: '/nanos',
  params: {},
  query: {}
};

// Mock PrimeVue components
vi.mock('primevue/badge', () => ({
  default: { name: 'Badge', template: '<span>{{ value }}</span>', props: ['value', 'severity'] }
}));

vi.mock('primevue/button', () => ({
  default: { name: 'Button', template: '<button @click="$emit(\'click\')">{{ label }}</button>', props: ['label'], emits: ['click'] }
}));

vi.mock('primevue/dialog', () => ({
  default: { 
    name: 'Dialog', 
    template: '<div v-if="visible"><slot name="header" /><slot /><slot name="footer" /></div>', 
    props: ['visible', 'modal', 'header', 'style'],
    emits: ['update:visible']
  }
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template: '<select v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder'],
    emits: ['update:modelValue', 'change']
  }
}));

vi.mock('primevue/inputswitch', () => ({
  default: {
    name: 'InputSwitch',
    template: '<input type="checkbox" v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'inputId', 'disabled'],
    emits: ['update:modelValue']
  }
}));

vi.mock('primevue/progressspinner', () => ({
  default: { name: 'ProgressSpinner', template: '<div>Loading...</div>' }
}));

vi.mock('primevue/togglebutton', () => ({
  default: {
    name: 'ToggleButton',
    template: '<button @click="$emit(\'update:modelValue\', !modelValue)">{{ modelValue ? onLabel : offLabel }}</button>',
    props: ['modelValue', 'onLabel', 'offLabel', 'onIcon', 'offIcon'],
    emits: ['update:modelValue']
  }
}));

// Mock child components
vi.mock('@/components/nanos/NanoSearch.vue', () => ({
  default: {
    name: 'NanoSearch',
    template: '<div class="nano-search"><input type="text" @input="$emit(\'search\', $event.target.value, [], [])" /></div>',
    props: ['modelValue', 'totalResults'],
    emits: ['search', 'update:modelValue']
  }
}));

vi.mock('@/components/nanos/NanoFilters.vue', () => ({
  default: {
    name: 'NanoFilters',
    template: '<div class="nano-filters"><button @click="$emit(\'filter-change\', { skillCompatible: true })">Enable Compatibility</button></div>',
    props: ['modelValue', 'showCompatibility', 'activeProfile', 'availableStrains'],
    emits: ['update:modelValue', 'filter-change']
  }
}));

vi.mock('@/components/nanos/NanoList.vue', () => ({
  default: {
    name: 'NanoList',
    template: '<div class="nano-list"><div v-for="nano in nanos" :key="nano.id" @click="$emit(\'nano-select\', nano)">{{ nano.name }}</div></div>',
    props: ['nanos', 'loading', 'showCompatibility', 'activeProfile'],
    emits: ['nano-select', 'page-change', 'favorite']
  }
}));

vi.mock('@/components/nanos/NanoSchoolView.vue', () => ({
  default: {
    name: 'NanoSchoolView',
    template: '<div class="nano-school-view"><div v-for="nano in nanos" :key="nano.id" @click="$emit(\'nano-select\', nano)">{{ nano.name }}</div></div>',
    props: ['nanos', 'showCompatibility', 'activeProfile'],
    emits: ['nano-select', 'strain-conflict', 'favorite']
  }
}));

vi.mock('@/components/nanos/NanoDetail.vue', () => ({
  default: {
    name: 'NanoDetail',
    template: '<div class="nano-detail"><h3>{{ nano?.name }}</h3><button @click="$emit(\'close\')">Close</button></div>',
    props: ['visible', 'nano', 'activeProfile', 'showCompatibility'],
    emits: ['update:visible', 'close']
  }
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = mockLocalStorage as any;

describe('Nano Compatibility Workflow', () => {
  let wrapper: any;
  let pinia: any;
  let nanosStore: any;
  let profilesStore: any;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    
    nanosStore = useNanosStore();
    profilesStore = useProfilesStore();
    
    // Mock the stores with sample data
    nanosStore.nanos = [
      {
        id: 1,
        name: 'Superior Heal',
        school: 'Biological Metamorphosis',
        strain: 'Heal Delta',
        description: 'Heals target for a large amount.',
        level: 125,
        qualityLevel: 175,
        profession: 'Doctor',
        castingRequirements: [
          { type: 'skill', requirement: 'Biological Metamorphosis', value: 750, critical: true },
          { type: 'skill', requirement: 'Nano Programming', value: 600, critical: true },
          { type: 'level', requirement: 'level', value: 125, critical: true }
        ]
      },
      {
        id: 2,
        name: 'Basic Heal',
        school: 'Biological Metamorphosis',
        strain: 'Heal Alpha',
        description: 'Basic healing nano.',
        level: 50,
        qualityLevel: 75,
        castingRequirements: [
          { type: 'skill', requirement: 'Biological Metamorphosis', value: 200, critical: true },
          { type: 'skill', requirement: 'Nano Programming', value: 150, critical: true },
          { type: 'level', requirement: 'level', value: 50, critical: true }
        ]
      }
    ];
    nanosStore.totalCount = 2;
    
    wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute
        }
      }
    });
    
    await wrapper.vm.$nextTick();
  });

  it('loads without active profile initially', () => {
    expect(wrapper.find('h1').text()).toContain('TinkerNanos');
    expect(wrapper.find('select').element.value).toBe('');
    expect(profilesStore.activeProfile).toBe(null);
  });

  it('enables compatibility checking when profile is selected', async () => {
    // Create a test profile
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Doctor',
      profession: 'Doctor',
      level: 100,
      skills: {
        'Biological Metamorphosis': 500,
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
    
    profilesStore.profiles = [testProfile];
    await wrapper.vm.$nextTick();
    
    // Select the profile
    const profileSelect = wrapper.find('select');
    await profileSelect.setValue('test-profile');
    await profileSelect.trigger('change');
    await wrapper.vm.$nextTick();
    
    // Verify profile is now active
    expect(profilesStore.activeProfile).toBeTruthy();
    
    // Enable compatibility checking
    const compatibilityToggle = wrapper.find('input[type="checkbox"]');
    await compatibilityToggle.setChecked(true);
    await wrapper.vm.$nextTick();
    
    // Verify compatibility is enabled
    expect(wrapper.vm.showSkillCompatibility).toBe(true);
  });

  it('calculates compatibility correctly for different nanos', async () => {
    // Set up profile with medium skill levels
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Doctor',
      profession: 'Doctor',
      level: 100,
      skills: {
        'Biological Metamorphosis': 300, // Lower than both nano requirements
        'Nano Programming': 400         // Between basic and superior requirements
      },
      stats: {
        'Intelligence': 400,
        'Psychic': 300
      },
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;
    
    // Update component data using the component instance
    Object.assign(wrapper.vm, { 
      selectedProfile: 'test-profile',
      showSkillCompatibility: true 
    });
    await wrapper.vm.$nextTick();
    
    // Test compatibility calculation for Superior Heal (should not be castable)
    const superiorHeal = nanosStore.nanos[0];
    const compatibility1 = wrapper.vm.checkSkillCompatibility(superiorHeal);
    expect(compatibility1).toBe(false); // BM 300 < 750 required
    
    // Test compatibility for Basic Heal (should not be castable due to NP)
    const basicHeal = nanosStore.nanos[1];
    const compatibility2 = wrapper.vm.checkSkillCompatibility(basicHeal);
    expect(compatibility2).toBe(false); // BM 300 > 200, but NP 400 > 150
  });

  it('shows compatibility indicators in nano list', async () => {
    // Set up profile and enable compatibility
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Doctor',
      profession: 'Doctor',
      level: 150,
      skills: {
        'Biological Metamorphosis': 800,
        'Nano Programming': 700
      },
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;
    Object.assign(wrapper.vm, { 
      selectedProfile: 'test-profile',
      showSkillCompatibility: true 
    });
    await wrapper.vm.$nextTick();
    
    // Find the nano list component
    const nanoList = wrapper.findComponent({ name: 'NanoList' });
    expect(nanoList.exists()).toBe(true);
    expect(nanoList.props('showCompatibility')).toBe(true);
    expect(nanoList.props('activeProfile')).toEqual(testProfile);
  });

  it('filters nanos based on compatibility when enabled', async () => {
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Doctor',
      profession: 'Doctor',
      level: 60,
      skills: {
        'Biological Metamorphosis': 250,
        'Nano Programming': 200
      },
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;
    Object.assign(wrapper.vm, { 
      selectedProfile: 'test-profile',
      showSkillCompatibility: true
    });
    await wrapper.vm.$nextTick();
    
    // Enable skill-compatible filter
    const filters = wrapper.vm.filters;
    filters.skillCompatible = true;
    await wrapper.vm.$nextTick();
    
    // Should filter to only nanos that meet skill requirements
    const filteredNanos = wrapper.vm.filteredNanos;
    
    // With BM 250 and NP 200, should be able to cast Basic Heal (BM 200, NP 150)
    // but not Superior Heal (BM 750, NP 600)
    const castableNanos = filteredNanos.filter((nano: any) => 
      wrapper.vm.checkSkillCompatibility(nano)
    );
    
    expect(castableNanos.length).toBeGreaterThan(0);
    expect(castableNanos.some((nano: any) => nano.name === 'Basic Heal')).toBe(true);
  });

  it('shows nano detail with compatibility information', async () => {
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Doctor',
      profession: 'Doctor',
      level: 100,
      skills: {
        'Biological Metamorphosis': 500,
        'Nano Programming': 400
      },
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;
    Object.assign(wrapper.vm, { 
      selectedProfile: 'test-profile',
      showSkillCompatibility: true
    });
    await wrapper.vm.$nextTick();
    
    // Select a nano
    const superiorHeal = nanosStore.nanos[0];
    await wrapper.vm.handleNanoSelect(superiorHeal);
    
    // Verify nano detail dialog is shown
    expect(wrapper.vm.selectedNano).toEqual(superiorHeal);
    expect(wrapper.vm.showNanoDetail).toBe(true);
    
    // Find the nano detail component
    const nanoDetail = wrapper.findComponent({ name: 'NanoDetail' });
    expect(nanoDetail.exists()).toBe(true);
    expect(nanoDetail.props('nano')).toEqual(superiorHeal);
    expect(nanoDetail.props('activeProfile')).toEqual(testProfile);
    expect(nanoDetail.props('showCompatibility')).toBe(true);
  });

  it('handles profile switching during workflow', async () => {
    // Create two different profiles
    const doctorProfile: TinkerProfile = {
      id: 'doctor-profile',
      name: 'Doctor Character',
      profession: 'Doctor',
      level: 150,
      skills: { 'Biological Metamorphosis': 800 },
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    const engineerProfile: TinkerProfile = {
      id: 'engineer-profile',
      name: 'Engineer Character',
      profession: 'Engineer',
      level: 100,
      skills: { 'Matter Creation': 600 },
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [doctorProfile, engineerProfile];
    await wrapper.vm.$nextTick();
    
    // Select doctor profile
    Object.assign(wrapper.vm, { selectedProfile: 'doctor-profile' });
    await wrapper.vm.$nextTick();
    wrapper.vm.onProfileChange();
    expect(profilesStore.activeProfile).toEqual(doctorProfile);
    
    // Switch to engineer profile
    Object.assign(wrapper.vm, { selectedProfile: 'engineer-profile' });
    await wrapper.vm.$nextTick();
    wrapper.vm.onProfileChange();
    expect(profilesStore.activeProfile).toEqual(engineerProfile);
    
    // Switch back to no profile
    Object.assign(wrapper.vm, { selectedProfile: null });
    await wrapper.vm.$nextTick();
    wrapper.vm.onProfileChange();
    expect(profilesStore.activeProfile).toBe(null);
  });

  it('persists compatibility preferences', async () => {
    // Enable compatibility checking
    Object.assign(wrapper.vm, { showSkillCompatibility: true });
    await wrapper.vm.$nextTick();
    
    // Should save to localStorage (mocked)
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles compatibility calculation errors gracefully', async () => {
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Profile',
      profession: 'Doctor',
      level: 100,
      skills: {}, // Empty skills
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;
    
    // Should not throw error when checking compatibility with missing skills
    const nano = nanosStore.nanos[0];
    expect(() => wrapper.vm.checkSkillCompatibility(nano)).not.toThrow();
    
    const canCast = wrapper.vm.checkSkillCompatibility(nano);
    expect(canCast).toBe(false); // Should default to false for missing skills
  });

  it('updates compatibility when profile skills change', async () => {
    const testProfile: TinkerProfile = {
      id: 'test-profile',
      name: 'Test Profile',
      profession: 'Doctor',
      level: 100,
      skills: {
        'Biological Metamorphosis': 100,
        'Nano Programming': 100
      },
      stats: {},
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };
    
    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;
    Object.assign(wrapper.vm, { 
      selectedProfile: 'test-profile',
      showSkillCompatibility: true 
    });
    await wrapper.vm.$nextTick();
    
    // Initially cannot cast Superior Heal
    const superiorHeal = nanosStore.nanos[0];
    let canCast = wrapper.vm.checkSkillCompatibility(superiorHeal);
    expect(canCast).toBe(false);
    
    // Update profile skills
    testProfile.skills['Biological Metamorphosis'] = 800;
    testProfile.skills['Nano Programming'] = 700;
    await wrapper.vm.$nextTick();
    
    // Now should be able to cast
    canCast = wrapper.vm.checkSkillCompatibility(superiorHeal);
    expect(canCast).toBe(true);
  });
});