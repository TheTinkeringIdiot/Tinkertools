import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';

// Import TinkerPlants component
import TinkerPlants from '@/views/TinkerPlants.vue';

// Mock the accessibility composable
const mockAccessibilityComposable = {
  announce: vi.fn(),
  setLoading: vi.fn(),
};

vi.mock('@/composables/useAccessibility', () => ({
  useAccessibility: () => mockAccessibilityComposable,
}));

describe('TinkerPlants - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = () => {
    const pinia = createPinia();
    return mount(TinkerPlants, {
      global: {
        plugins: [pinia, [PrimeVue, {}]],
      },
    });
  };

  describe('Component Initialization', () => {
    it('renders without crashing', () => {
      const wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('has correct component structure', () => {
      const wrapper = createWrapper();
      expect(wrapper.find('.tinker-plants').exists()).toBe(true);
    });

    it('displays the main title', () => {
      const wrapper = createWrapper();
      expect(wrapper.text()).toContain('TinkerPlants');
    });
  });

  describe('Data Properties', () => {
    it('initializes with correct default values', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Check default quality level
      expect(vm.qualityLevel).toBe(200);

      // Check loading state
      expect(vm.loading).toBe(false);

      // Check results visibility
      expect(vm.showResults).toBe(false);
    });

    it('has all implant slots defined', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      expect(vm.implantSlots.length).toBe(12);

      const expectedSlots = [
        'Head',
        'Ear',
        'Right Arm',
        'Chest',
        'Left Arm',
        'Right Wrist',
        'Waist',
        'Left Wrist',
        'Right Hand',
        'Leg',
        'Left Hand',
        'Feet',
      ];

      const slotNames = vm.implantSlots.map((slot: any) => slot.name);
      expectedSlots.forEach((expectedSlot) => {
        expect(slotNames).toContain(expectedSlot);
      });
    });

    it('has skill clusters defined', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      expect(vm.skillClusters.length).toBeGreaterThan(20);

      // Check for key skill clusters
      const clusterNames = vm.skillClusters.map((cluster: any) => cluster.name);
      expect(clusterNames).toContain('Elec. Engi');
      expect(clusterNames).toContain('Nano Progra');
      expect(clusterNames).toContain('Strength');
      expect(clusterNames).toContain('Agility');
    });

    it('initializes implant selections correctly', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Check that all slots are initialized
      expect(Object.keys(vm.implantSelections).length).toBe(12);

      // Check that each slot has shiny, bright, faded, and ql properties
      Object.values(vm.implantSelections).forEach((selection: any) => {
        expect(selection).toHaveProperty('shiny');
        expect(selection).toHaveProperty('bright');
        expect(selection).toHaveProperty('faded');
        expect(selection).toHaveProperty('ql');
        expect(selection.shiny).toBeNull();
        expect(selection.bright).toBeNull();
        expect(selection.faded).toBeNull();
        expect(selection.ql).toBe(200); // Default QL value
      });
    });
  });

  describe('Computed Properties', () => {
    it('hasAnyImplants returns false when no implants selected', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      expect(vm.hasAnyImplants).toBe(false);
    });

    it('hasAnyImplants returns true when implants are selected', async () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Select an implant
      vm.implantSelections.head.shiny = 'elec_engi';
      await wrapper.vm.$nextTick();

      expect(vm.hasAnyImplants).toBe(true);
    });

    it('calculates bonuses correctly', async () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Select some implants
      vm.implantSelections.head.shiny = 'elec_engi';
      vm.implantSelections.head.ql = 100;
      vm.implantSelections.chest.bright = 'strength';
      vm.implantSelections.chest.ql = 150;
      await wrapper.vm.$nextTick();

      const bonuses = vm.calculatedBonuses;
      expect(Object.keys(bonuses).length).toBeGreaterThan(0);
      expect(bonuses['Elec. Engi']).toBeDefined();
      expect(bonuses['Strength']).toBeDefined();
      // Check that bonuses are calculated based on individual QL values
      expect(bonuses['Elec. Engi']).toBe(Math.floor(100 / 10)); // 10
      expect(bonuses['Strength']).toBe(Math.floor(150 / 10)); // 15
    });

    it('generates construction requirements', async () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Select some implants
      vm.implantSelections.head.shiny = 'elec_engi';
      vm.implantSelections.chest.bright = 'strength';
      await wrapper.vm.$nextTick();

      const requirements = vm.constructionRequirements;
      expect(requirements.length).toBe(2);

      expect(requirements[0]).toMatchObject({
        slot: 'Head',
        type: 'Shiny',
        clusters: ['Elec. Engi'],
      });

      expect(requirements[1]).toMatchObject({
        slot: 'Chest',
        type: 'Bright',
        clusters: ['Strength'],
      });
    });
  });

  describe('Methods', () => {
    it('clearAllImplants resets all selections', async () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Set some selections first
      vm.implantSelections.head.shiny = 'elec_engi';
      vm.implantSelections.chest.bright = 'strength';
      vm.showResults = true;

      // Call clearAllImplants
      vm.clearAllImplants();

      // Check that selections are cleared
      Object.values(vm.implantSelections).forEach((selection: any) => {
        expect(selection.shiny).toBeNull();
        expect(selection.bright).toBeNull();
        expect(selection.faded).toBeNull();
        expect(selection.ql).toBe(200); // Reset to default QL value
      });

      expect(vm.showResults).toBe(false);
      expect(mockAccessibilityComposable.announce).toHaveBeenCalledWith('All implants cleared');
    });

    it('calculateBuild works with selected implants', async () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Select an implant
      vm.implantSelections.head.shiny = 'elec_engi';
      await wrapper.vm.$nextTick();

      // Call calculateBuild
      vm.calculateBuild();

      expect(mockAccessibilityComposable.setLoading).toHaveBeenCalledWith(
        true,
        'Calculating implant build...'
      );
    });

    it('calculateBuild does nothing with no implants', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Clear the mock before calling calculateBuild
      mockAccessibilityComposable.setLoading.mockClear();

      // Call calculateBuild with no implants
      vm.calculateBuild();

      // setLoading should not be called for calculation
      expect(mockAccessibilityComposable.setLoading).not.toHaveBeenCalledWith(
        true,
        'Calculating implant build...'
      );
    });

    it('onImplantChange announces changes', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Clear previous calls
      mockAccessibilityComposable.announce.mockClear();

      // Call onImplantChange
      vm.onImplantChange('head', 'shiny', 'elec_engi');

      expect(mockAccessibilityComposable.announce).toHaveBeenCalledWith(
        'shiny cluster selected for Head slot'
      );
    });

    it('onImplantChange announces clears', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Clear previous calls
      mockAccessibilityComposable.announce.mockClear();

      // Call onImplantChange with null value
      vm.onImplantChange('head', 'shiny', null);

      expect(mockAccessibilityComposable.announce).toHaveBeenCalledWith(
        'shiny cluster cleared for Head slot'
      );
    });

    it('onQLChange announces quality level changes', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Clear previous calls
      mockAccessibilityComposable.announce.mockClear();

      // Call onQLChange
      vm.onQLChange('head', 250);

      expect(mockAccessibilityComposable.announce).toHaveBeenCalledWith(
        'Quality Level set to 250 for Head slot'
      );
    });

    it('onQLChange does not announce null values', () => {
      const wrapper = createWrapper();
      const vm = wrapper.vm as any;

      // Clear previous calls
      mockAccessibilityComposable.announce.mockClear();

      // Call onQLChange with null
      vm.onQLChange('head', null);

      expect(mockAccessibilityComposable.announce).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('calls setLoading on mount', () => {
      createWrapper();

      expect(mockAccessibilityComposable.setLoading).toHaveBeenCalledWith(
        true,
        'Loading implant planner...'
      );
    });

    it('announces successful load after mount', async () => {
      const wrapper = createWrapper();

      // Wait for mount lifecycle
      await wrapper.vm.$nextTick();

      // Wait a bit for the timeout in the component
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(mockAccessibilityComposable.announce).toHaveBeenCalledWith(
        'Implant planner loaded successfully'
      );
    });
  });

  describe('Layout Structure', () => {
    it('contains grid layout classes', () => {
      const wrapper = createWrapper();
      expect(wrapper.html()).toContain('grid-cols-5');
    });

    it('has responsive design classes', () => {
      const wrapper = createWrapper();
      expect(wrapper.html()).toContain('flex-col');
      expect(wrapper.html()).toContain('lg:flex-row');
      expect(wrapper.html()).toContain('sm:flex-row');
    });

    it('includes proper ARIA attributes', () => {
      const wrapper = createWrapper();
      expect(wrapper.html()).toContain('aria-label');
      expect(wrapper.html()).toContain('aria-describedby');
    });
  });
});
