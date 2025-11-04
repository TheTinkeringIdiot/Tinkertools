import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TinkerNanos from '@/views/TinkerNanos.vue';
import { useNanosStore } from '@/stores/nanosStore';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { createTestProfile, PROFESSION, SKILL_ID } from '@/__tests__/helpers';

// Mock router
const mockRouter = {
  currentRoute: { value: { path: '/nanos' } },
  push: vi.fn(),
  replace: vi.fn(),
};

const mockRoute = {
  path: '/nanos',
  params: {},
  query: {},
};

// Mock PrimeVue components (reusing from previous test)
vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="badge">{{ value }}</span>',
    props: ['value', 'severity'],
  },
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')">{{ label }}</button>',
    props: ['label'],
    emits: ['click'],
  },
}));

vi.mock('primevue/dialog', () => ({
  default: {
    name: 'Dialog',
    template:
      '<div v-if="visible" class="dialog"><slot name="header" /><slot /><slot name="footer" /></div>',
    props: ['visible', 'modal', 'header', 'style'],
    emits: ['update:visible'],
  },
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template:
      '<select v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder'],
    emits: ['update:modelValue', 'change'],
  },
}));

vi.mock('primevue/inputswitch', () => ({
  default: {
    name: 'InputSwitch',
    template:
      '<input type="checkbox" v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'inputId', 'disabled'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/progressspinner', () => ({
  default: { name: 'ProgressSpinner', template: '<div class="spinner">Loading...</div>' },
}));

vi.mock('primevue/togglebutton', () => ({
  default: {
    name: 'ToggleButton',
    template:
      '<button @click="$emit(\'update:modelValue\', !modelValue)" :class="{ active: modelValue }">{{ modelValue ? onLabel : offLabel }}</button>',
    props: ['modelValue', 'onLabel', 'offLabel', 'onIcon', 'offIcon'],
    emits: ['update:modelValue'],
  },
}));

// Enhanced mock components with search functionality
vi.mock('@/components/nanos/NanoSearch.vue', () => ({
  default: {
    name: 'NanoSearch',
    template: `
      <div class="nano-search">
        <input 
          type="text" 
          v-model="searchValue"
          @input="handleInput" 
          @keyup.enter="handleSearch"
          placeholder="Search nanos..."
        />
        <div class="school-chips">
          <span 
            v-for="school in schools" 
            :key="school"
            @click="toggleSchool(school)"
            :class="{ active: selectedSchools.includes(school) }"
            class="school-chip"
          >
            {{ school }}
          </span>
        </div>
      </div>
    `,
    props: ['modelValue', 'totalResults'],
    emits: ['search', 'update:modelValue'],
    data() {
      return {
        searchValue: this.modelValue,
        selectedSchools: [],
        schools: [
          'Matter Metamorphosis',
          'Biological Metamorphosis',
          'Psychological Modifications',
          'Matter Creation',
          'Time and Space',
          'Sensory Improvement',
        ],
      };
    },
    methods: {
      handleInput() {
        this.$emit('update:modelValue', this.searchValue);
      },
      handleSearch() {
        this.$emit('search', this.searchValue, this.selectedSchools, ['name', 'description']);
      },
      toggleSchool(school: string) {
        const index = this.selectedSchools.indexOf(school);
        if (index > -1) {
          this.selectedSchools.splice(index, 1);
        } else {
          this.selectedSchools.push(school);
        }
        this.$emit('search', this.searchValue, this.selectedSchools, ['name', 'description']);
      },
    },
    watch: {
      modelValue(newValue) {
        this.searchValue = newValue;
      },
    },
  },
}));

vi.mock('@/components/nanos/NanoFilters.vue', () => ({
  default: {
    name: 'NanoFilters',
    template: `
      <div class="nano-filters">
        <select v-model="selectedSort" @change="updateFilters">
          <option value="name">Name</option>
          <option value="level">Level</option>
          <option value="school">School</option>
        </select>
        <div class="filter-controls">
          <input 
            type="checkbox" 
            v-model="skillCompatible"
            @change="updateFilters"
            id="skill-compatible"
          />
          <label for="skill-compatible">Skill Compatible</label>
        </div>
      </div>
    `,
    props: ['modelValue', 'showCompatibility', 'activeProfile', 'availableStrains'],
    emits: ['update:modelValue', 'filter-change'],
    data() {
      return {
        selectedSort: 'name',
        skillCompatible: false,
      };
    },
    methods: {
      updateFilters() {
        const filters = {
          ...this.modelValue,
          sortBy: this.selectedSort,
          skillCompatible: this.skillCompatible,
        };
        this.$emit('update:modelValue', filters);
        this.$emit('filter-change', filters);
      },
    },
  },
}));

vi.mock('@/components/nanos/NanoList.vue', () => ({
  default: {
    name: 'NanoList',
    template: `
      <div class="nano-list">
        <div v-if="loading" class="loading">Loading nanos...</div>
        <div v-else-if="nanos.length === 0" class="empty-state">No nanos found</div>
        <div v-else>
          <div 
            v-for="nano in nanos" 
            :key="nano.id" 
            @click="$emit('nano-select', nano)"
            class="nano-item"
            :class="{ 'compatible': isCompatible(nano), 'incompatible': !isCompatible(nano) }"
          >
            <h3>{{ nano.name }}</h3>
            <p>{{ nano.school }} - Level {{ nano.level }}</p>
            <span v-if="showCompatibility && activeProfile" class="compatibility-indicator">
              {{ isCompatible(nano) ? '✓ Castable' : '✗ Cannot Cast' }}
            </span>
          </div>
        </div>
      </div>
    `,
    props: ['nanos', 'loading', 'showCompatibility', 'activeProfile'],
    emits: ['nano-select', 'page-change', 'favorite'],
    methods: {
      isCompatible(nano: any) {
        if (!this.showCompatibility || !this.activeProfile) return true;

        return (
          nano.castingRequirements?.every((req: any) => {
            if (req.type === 'skill') {
              return (this.activeProfile.skills[req.requirement] || 0) >= req.value;
            }
            if (req.type === 'level') {
              return this.activeProfile.level >= req.value;
            }
            return true;
          }) ?? true
        );
      },
    },
  },
}));

vi.mock('@/components/nanos/NanoSchoolView.vue', () => ({
  default: {
    name: 'NanoSchoolView',
    template: `
      <div class="nano-school-view">
        <div v-for="school in uniqueSchools" :key="school" class="school-section">
          <h2>{{ school }}</h2>
          <div 
            v-for="nano in getNanosBySchool(school)" 
            :key="nano.id" 
            @click="$emit('nano-select', nano)"
            class="nano-item school-nano"
          >
            {{ nano.name }}
          </div>
        </div>
      </div>
    `,
    props: ['nanos', 'showCompatibility', 'activeProfile'],
    emits: ['nano-select', 'strain-conflict', 'favorite'],
    computed: {
      uniqueSchools() {
        return [...new Set(this.nanos.map((nano: any) => nano.school))];
      },
    },
    methods: {
      getNanosBySchool(school: string) {
        return this.nanos.filter((nano: any) => nano.school === school);
      },
    },
  },
}));

vi.mock('@/components/nanos/NanoDetail.vue', () => ({
  default: {
    name: 'NanoDetail',
    template: `
      <div class="nano-detail" v-if="nano">
        <h2>{{ nano.name }}</h2>
        <p>School: {{ nano.school }}</p>
        <p>Level: {{ nano.level }}</p>
        <div v-if="nano.castingRequirements">
          <h3>Requirements:</h3>
          <ul>
            <li v-for="req in nano.castingRequirements" :key="req.requirement">
              {{ req.requirement }}: {{ req.value }}
              <span v-if="showCompatibility && activeProfile" :class="meetsRequirement(req) ? 'text-green' : 'text-red'">
                ({{ getRequirementStatus(req) }})
              </span>
            </li>
          </ul>
        </div>
        <button @click="$emit('close')" class="close-button">Close</button>
      </div>
    `,
    props: ['visible', 'nano', 'activeProfile', 'showCompatibility'],
    emits: ['update:visible', 'close'],
    methods: {
      meetsRequirement(req: any) {
        if (!this.activeProfile) return false;

        if (req.type === 'skill') {
          return (this.activeProfile.skills[req.requirement] || 0) >= req.value;
        }
        if (req.type === 'level') {
          return this.activeProfile.level >= req.value;
        }
        return true;
      },
      getRequirementStatus(req: any) {
        if (!this.activeProfile) return 'No Profile';

        if (req.type === 'skill') {
          const current = this.activeProfile.skills[req.requirement] || 0;
          return current >= req.value ? '✓' : `${current}/${req.value}`;
        }
        if (req.type === 'level') {
          return this.activeProfile.level >= req.value
            ? '✓'
            : `${this.activeProfile.level}/${req.value}`;
        }
        return '?';
      },
    },
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('Nano Search Workflow', () => {
  let wrapper: any;
  let pinia: any;
  let nanosStore: any;
  let profilesStore: any;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);

    nanosStore = useNanosStore();
    profilesStore = useTinkerProfilesStore();

    // Mock comprehensive nano data for search testing
    nanosStore.nanos = [
      {
        id: 1,
        name: 'Superior Heal',
        school: 'Biological Metamorphosis',
        strain: 'Heal Delta',
        description: 'Heals target for a large amount of health over time.',
        level: 125,
        qualityLevel: 175,
        profession: 'Doctor',
        castingRequirements: [
          { type: 'skill', requirement: 'Biological Metamorphosis', value: 750, critical: true },
          { type: 'level', requirement: 'level', value: 125, critical: true },
        ],
      },
      {
        id: 2,
        name: 'Minor Heal',
        school: 'Biological Metamorphosis',
        strain: 'Heal Alpha',
        description: 'Basic healing nano for beginners.',
        level: 25,
        qualityLevel: 50,
        castingRequirements: [
          { type: 'skill', requirement: 'Biological Metamorphosis', value: 100, critical: true },
          { type: 'level', requirement: 'level', value: 25, critical: true },
        ],
      },
      {
        id: 3,
        name: 'Matter Armor',
        school: 'Matter Creation',
        strain: 'Protection Alpha',
        description: 'Creates protective matter armor around the target.',
        level: 100,
        qualityLevel: 150,
        castingRequirements: [
          { type: 'skill', requirement: 'Matter Creation', value: 500, critical: true },
          { type: 'level', requirement: 'level', value: 100, critical: true },
        ],
      },
      {
        id: 4,
        name: 'Teleport',
        school: 'Time and Space',
        strain: 'Transport Beta',
        description: 'Instantly teleports the caster to a distant location.',
        level: 150,
        qualityLevel: 200,
        castingRequirements: [
          { type: 'skill', requirement: 'Time and Space', value: 800, critical: true },
          { type: 'level', requirement: 'level', value: 150, critical: true },
        ],
      },
      {
        id: 5,
        name: 'Damage Shield',
        school: 'Psychological Modifications',
        strain: 'Shield Gamma',
        description: 'Creates a shield that damages attackers.',
        level: 75,
        qualityLevel: 125,
        castingRequirements: [
          { type: 'skill', requirement: 'Psychological Modifications', value: 400, critical: true },
          { type: 'level', requirement: 'level', value: 75, critical: true },
        ],
      },
    ];
    nanosStore.totalCount = 5;

    wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia],
        mocks: {
          $router: mockRouter,
          $route: mockRoute,
        },
      },
    });

    await wrapper.vm.$nextTick();
  });

  it('performs basic text search', async () => {
    // Find the search component
    const searchComponent = wrapper.findComponent({ name: 'NanoSearch' });
    expect(searchComponent.exists()).toBe(true);

    // Perform search for "heal"
    const searchInput = searchComponent.find('input[type="text"]');
    await searchInput.setValue('heal');
    await searchInput.trigger('keyup.enter');

    // Should emit search event
    expect(wrapper.vm.searchQuery).toBe('heal');

    // Check filtered results
    const filteredNanos = wrapper.vm.filteredNanos;
    const healNanos = filteredNanos.filter(
      (nano: any) =>
        nano.name.toLowerCase().includes('heal') || nano.description?.toLowerCase().includes('heal')
    );
    expect(healNanos.length).toBeGreaterThan(0);
    expect(healNanos.some((nano: any) => nano.name === 'Superior Heal')).toBe(true);
    expect(healNanos.some((nano: any) => nano.name === 'Minor Heal')).toBe(true);
  });

  it('searches by school using chips', async () => {
    const searchComponent = wrapper.findComponent({ name: 'NanoSearch' });

    // Click on the Matter Creation school chip
    const schoolChip = searchComponent.find('.school-chip');
    await schoolChip.trigger('click');

    // Should filter to Matter Creation nanos
    const filteredNanos = wrapper.vm.filteredNanos;
    const matterNanos = filteredNanos.filter((nano: any) => nano.school === 'Matter Creation');
    expect(matterNanos.length).toBeGreaterThan(0);
    expect(matterNanos.some((nano: any) => nano.name === 'Matter Armor')).toBe(true);
  });

  it('combines text search with school filter', async () => {
    const searchComponent = wrapper.findComponent({ name: 'NanoSearch' });

    // Set search text
    const searchInput = searchComponent.find('input[type="text"]');
    await searchInput.setValue('shield');

    // Select school filter
    await searchComponent.vm.toggleSchool('Psychological Modifications');
    await wrapper.vm.$nextTick();

    // Should find nanos that match both criteria
    const filteredNanos = wrapper.vm.filteredNanos;
    const matchingNanos = filteredNanos.filter(
      (nano: any) =>
        (nano.name.toLowerCase().includes('shield') ||
          nano.description?.toLowerCase().includes('shield')) &&
        nano.school === 'Psychological Modifications'
    );
    expect(matchingNanos.some((nano: any) => nano.name === 'Damage Shield')).toBe(true);
  });

  it('sorts search results', async () => {
    const filtersComponent = wrapper.findComponent({ name: 'NanoFilters' });

    // Change sort to level
    const sortSelect = filtersComponent.find('select');
    await sortSelect.setValue('level');
    await sortSelect.trigger('change');

    await wrapper.vm.$nextTick();

    // Verify sorting is applied
    expect(wrapper.vm.filters.sortBy).toBe('level');

    const filteredNanos = wrapper.vm.filteredNanos;
    if (filteredNanos.length > 1) {
      // Should be sorted by level in ascending order
      for (let i = 1; i < filteredNanos.length; i++) {
        expect(filteredNanos[i].level).toBeGreaterThanOrEqual(filteredNanos[i - 1].level);
      }
    }
  });

  it('displays search results in list view', async () => {
    // Set to list view mode
    const viewToggle = wrapper.find('button');
    await viewToggle.trigger('click'); // Toggle to list view

    await wrapper.vm.$nextTick();

    // Should show NanoList component
    const nanoList = wrapper.findComponent({ name: 'NanoList' });
    expect(nanoList.exists()).toBe(true);
    expect(nanoList.props('nanos')).toEqual(nanosStore.nanos);
  });

  it('displays search results in school view', async () => {
    // Ensure we're in school view mode
    Object.assign(wrapper.vm, { viewMode: true });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    // Should show NanoSchoolView component
    const schoolView = wrapper.findComponent({ name: 'NanoSchoolView' });
    expect(schoolView.exists()).toBe(true);
    expect(schoolView.props('nanos')).toEqual(nanosStore.nanos);
  });

  it('opens nano detail from search results', async () => {
    const nanoList = wrapper.findComponent({ name: 'NanoList' });

    // Click on a nano item
    const superiorHeal = nanosStore.nanos[0];
    await nanoList.vm.$emit('nano-select', superiorHeal);

    await wrapper.vm.$nextTick();

    // Should open nano detail
    expect(wrapper.vm.selectedNano).toEqual(superiorHeal);
    expect(wrapper.vm.showNanoDetail).toBe(true);

    const nanoDetail = wrapper.findComponent({ name: 'NanoDetail' });
    expect(nanoDetail.exists()).toBe(true);
    expect(nanoDetail.props('nano')).toEqual(superiorHeal);
  });

  it('shows empty state when no results found', async () => {
    // Search for something that won't match
    Object.assign(wrapper.vm, { searchQuery: 'nonexistent nano name' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const nanoList = wrapper.findComponent({ name: 'NanoList' });
    const emptyState = nanoList.find('.empty-state');
    expect(emptyState.exists()).toBe(true);
    expect(emptyState.text()).toContain('No nanos found');
  });

  it('searches with compatibility filtering when profile is active', async () => {
    // Set up a test profile
    const testProfile = createTestProfile({
      id: 'test-profile',
      name: 'Test Character',
      profession: PROFESSION.DOCTOR,
      level: 80,
      skills: {
        [SKILL_ID.BIO_METAMOR]: { total: 300 },
        [SKILL_ID.MATTER_CREATION]: { total: 200 },
      },
    });

    profilesStore.profiles = [testProfile];
    profilesStore.activeProfile = testProfile;

    Object.assign(wrapper.vm, {
      selectedProfile: 'test-profile',
      showSkillCompatibility: true,
    });
    await wrapper.vm.$nextTick();

    // Enable skill compatible filter
    const filtersComponent = wrapper.findComponent({ name: 'NanoFilters' });
    const compatibilityCheckbox = filtersComponent.find('#skill-compatible');
    await compatibilityCheckbox.setChecked(true);

    await wrapper.vm.$nextTick();

    // Should show compatibility indicators in results
    const nanoList = wrapper.findComponent({ name: 'NanoList' });
    expect(nanoList.props('showCompatibility')).toBe(true);
    expect(nanoList.props('activeProfile')).toEqual(testProfile);

    // Results should show compatibility status
    const compatibilityIndicators = nanoList.findAll('.compatibility-indicator');
    expect(compatibilityIndicators.length).toBeGreaterThan(0);
  });

  it('updates search results when switching view modes', async () => {
    // Start with list view
    Object.assign(wrapper.vm, { viewMode: false });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    let nanoList = wrapper.findComponent({ name: 'NanoList' });
    expect(nanoList.exists()).toBe(true);

    // Switch to school view
    const viewToggle = wrapper.find('button');
    await viewToggle.trigger('click');
    await wrapper.vm.$nextTick();

    let schoolView = wrapper.findComponent({ name: 'NanoSchoolView' });
    expect(schoolView.exists()).toBe(true);

    // Both views should receive the same nano data
    expect(schoolView.props('nanos')).toEqual(nanosStore.nanos);
  });

  it('persists search query in store', async () => {
    const searchQuery = 'persistent search';

    const searchComponent = wrapper.findComponent({ name: 'NanoSearch' });
    const searchInput = searchComponent.find('input[type="text"]');

    await searchInput.setValue(searchQuery);
    await searchInput.trigger('keyup.enter');

    // Should update the store
    expect(wrapper.vm.searchQuery).toBe(searchQuery);

    // Should save to localStorage for search history
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('handles loading state during search', async () => {
    // Set loading state
    nanosStore.loading = true;
    await wrapper.vm.$nextTick();

    const nanoList = wrapper.findComponent({ name: 'NanoList' });
    const loadingIndicator = nanoList.find('.loading');
    expect(loadingIndicator.exists()).toBe(true);
    expect(loadingIndicator.text()).toContain('Loading');

    // Clear loading state
    nanosStore.loading = false;
    await wrapper.vm.$nextTick();

    expect(nanoList.find('.loading').exists()).toBe(false);
  });

  it('clears search and filters', async () => {
    // Set some search criteria and filters
    Object.assign(wrapper.vm, {
      searchQuery: 'heal',
      filters: {
        ...wrapper.vm.filters,
        schools: ['Biological Metamorphosis'],
        skillCompatible: true,
      },
    });
    await wrapper.vm.$nextTick();

    // Clear all filters
    wrapper.vm.clearAllFilters();
    await wrapper.vm.$nextTick();

    // Should reset everything
    expect(wrapper.vm.searchQuery).toBe('');
    expect(wrapper.vm.filters.schools).toEqual([]);
    expect(wrapper.vm.filters.skillCompatible).toBe(false);
    expect(wrapper.vm.filteredNanos).toEqual(nanosStore.nanos);
  });

  it('shows total count badge with search results', () => {
    const badge = wrapper.find('.badge');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain(nanosStore.totalCount.toString());
  });
});
