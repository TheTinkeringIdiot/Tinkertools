/**
 * ItemSearch Component Tests
 *
 * Tests for the ItemSearch component functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountWithContext,
  standardCleanup,
  createTestProfile,
  SKILL_ID,
  PROFESSION,
} from '@/__tests__/helpers';

import { nextTick } from 'vue';
import ItemSearch from '../../components/items/ItemSearch.vue';
import type { TinkerProfile } from '../../types/api';

// Mock PrimeVue components
vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'InputText',
    template:
      '<input v-bind="$attrs" @input="$emit(\'input\', $event)" @focus="$emit(\'focus\')" @blur="$emit(\'blur\')" />',
    emits: ['input', 'focus', 'blur'],
  },
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
}));

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge">{{ value }}</span>',
    props: ['value'],
  },
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template:
      '<select v-model="modelValue"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/multiselect', () => ({
  default: {
    name: 'MultiSelect',
    template: '<select multiple v-model="modelValue"></select>',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    template: '<input type="checkbox" v-model="modelValue" />',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
}));

const mockProfile: TinkerProfile = createTestProfile({
  profession: PROFESSION.ENGINEER,
  level: 200,
  skills: {
    [SKILL_ID.INTELLIGENCE]: { base: 6, pointsFromIp: 594, equipmentBonus: 0, total: 600 },
    [SKILL_ID.PSYCHIC]: { base: 6, pointsFromIp: 294, equipmentBonus: 0, total: 300 },
    [SKILL_ID.SENSE]: { base: 6, pointsFromIp: 394, equipmentBonus: 0, total: 400 },
    [SKILL_ID.STAMINA]: { base: 6, pointsFromIp: 344, equipmentBonus: 0, total: 350 },
    [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 494, equipmentBonus: 0, total: 500 },
    [SKILL_ID.AGILITY]: { base: 6, pointsFromIp: 394, equipmentBonus: 0, total: 400 },
  },
});

describe('ItemSearch', () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    standardCleanup();
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it('should display search input', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: 'test query',
          loading: false,
        },
      });

      const input = wrapper.find('input');
      expect(input.exists()).toBe(true);
    });

    it('should show loading state when loading prop is true', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: true,
        },
      });

      const loadingButton = wrapper.find('button[loading="true"]');
      expect(loadingButton.exists()).toBe(true);
    });
  });

  describe('Search Input', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });
    });

    it('should emit update:query when input changes', async () => {
      const input = wrapper.find('input');

      await input.setValue('new search term');

      expect(wrapper.emitted('update:query')).toBeTruthy();
      expect(wrapper.emitted('update:query')[0]).toEqual(['new search term']);
    });

    it('should emit search event on Enter key', async () => {
      const input = wrapper.find('input');

      await input.setValue('search term');
      await input.trigger('keydown.enter');

      expect(wrapper.emitted('search')).toBeTruthy();
    });

    it('should emit search event when search button is clicked', async () => {
      const searchButton = wrapper.find('button[v-tooltip="Search"]');

      await searchButton.trigger('click');

      expect(wrapper.emitted('search')).toBeTruthy();
    });

    it('should emit clear event when clear button is clicked', async () => {
      await wrapper.setProps({ query: 'some query' });

      const clearButton = wrapper.find('button[v-tooltip="Clear Search"]');
      await clearButton.trigger('click');

      expect(wrapper.emitted('clear')).toBeTruthy();
    });
  });

  describe('Advanced Search', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });
    });

    it('should toggle advanced search section', async () => {
      const buttons = wrapper.findAll('button');
      const advancedToggle = buttons.find((btn) => btn.text().includes('Advanced Search'));

      if (advancedToggle) {
        await advancedToggle.trigger('click');

        // Should show advanced section
        await nextTick();
        expect(wrapper.find('.advanced-search').exists()).toBe(true);
      }
    });

    it('should show profile context when profile is provided', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
          profile: mockProfile,
        },
      });

      const profileInfo = wrapper.find('.profile-info');
      expect(profileInfo.exists()).toBe(true);
      expect(profileInfo.text()).toContain('Test Character');
    });
  });

  describe('Search Suggestions', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: 'impl',
          loading: false,
        },
      });
    });

    it('should show suggestions dropdown on focus', async () => {
      const input = wrapper.find('input');

      await input.trigger('focus');

      // Should show suggestions dropdown
      await nextTick();
      const dropdown = wrapper.find('.suggestions-dropdown');
      expect(dropdown.exists()).toBe(true);
    });

    it('should hide suggestions on blur', async () => {
      const input = wrapper.find('input');

      await input.trigger('focus');
      await nextTick();

      await input.trigger('blur');
      await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for hide delay

      const dropdown = wrapper.find('.suggestions-dropdown');
      expect(dropdown.exists()).toBe(false);
    });
  });

  describe('Search History', () => {
    beforeEach(() => {
      // Mock localStorage with some search history
      const mockGetItem = vi.fn((key) => {
        if (key === 'tinkerItems.recentSearches') {
          return JSON.stringify(['implant', 'weapon', 'nano']);
        }
        return null;
      });

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
    });

    it('should load recent searches from localStorage', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });

      expect(localStorage.getItem).toHaveBeenCalledWith('tinkerItems.recentSearches');
    });

    it('should save search to history when performing search', async () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: 'new search',
          loading: false,
        },
      });

      const input = wrapper.find('input');
      await input.trigger('keydown.enter');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'tinkerItems.recentSearches',
        expect.stringContaining('new search')
      );
    });
  });

  describe('Quick Filters', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });
    });

    it('should show quick filter buttons', async () => {
      const input = wrapper.find('input');
      await input.trigger('focus');
      await nextTick();

      const quickFilters = wrapper.findAll('.quick-filter');
      expect(quickFilters.length).toBeGreaterThan(0);
    });

    it('should emit search with filter when quick filter is clicked', async () => {
      const input = wrapper.find('input');
      await input.trigger('focus');
      await nextTick();

      const buttons = wrapper.findAll('button');
      const weaponsFilter = buttons.find((btn) => btn.text().includes('Weapons'));
      if (weaponsFilter) {
        await weaponsFilter.trigger('click');
        expect(wrapper.emitted('search')).toBeTruthy();
      }
    });
  });

  describe('Character Integration', () => {
    it('should show compatible items only option when profile is provided', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
          profile: mockProfile,
        },
      });

      const compatibleOnlyCheckbox = wrapper.find('input[type="checkbox"]#compatible-only');
      expect(compatibleOnlyCheckbox.exists()).toBe(true);
    });

    it('should not show compatible items option when no profile', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
          profile: null,
        },
      });

      const compatibleOnlyCheckbox = wrapper.find('input[type="checkbox"]#compatible-only');
      expect(compatibleOnlyCheckbox.exists()).toBe(false);
    });
  });

  describe('Search Stats', () => {
    it('should display search statistics when search has been performed', async () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: 'test',
          loading: false,
        },
      });

      // Simulate search completion by setting component data
      await wrapper.setData({
        hasSearched: true,
        searchStats: { resultCount: 25, duration: 150 },
      });

      const stats = wrapper.find('.search-stats');
      expect(stats.exists()).toBe(true);
      expect(stats.text()).toContain('25 results');
      expect(stats.text()).toContain('150ms');
    });

    it('should show save search button when search can be saved', async () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: 'saveable query',
          loading: false,
        },
      });

      await wrapper.setData({
        hasSearched: true,
        canSaveSearch: true,
      });

      const buttons = wrapper.findAll('button');
      const saveButton = buttons.find((btn) => btn.text().includes('Save Search'));
      expect(saveButton).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });
    });

    it('should have proper labels for form elements', () => {
      const searchLabel = wrapper.find('label[for="search-input"]');
      expect(searchLabel.exists()).toBe(true);
    });

    it('should have proper ARIA attributes', () => {
      const input = wrapper.find('input');
      expect(input.attributes('aria-describedby')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should show error state when there is an error', () => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });

      // Simulate error state
      wrapper.vm.hasError = true;

      const input = wrapper.find('input');
      expect(input.classes()).toContain('border-red-500');
    });
  });

  describe('XSS Protection (highlightMatch)', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemSearch, {
        props: {
          query: '',
          loading: false,
        },
      });
    });

    it('should escape HTML entities to prevent XSS attacks', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      // Test XSS attack payloads with HTML tags
      const htmlPayloads = [
        '<img src=x onerror=alert("XSS")>',
        '<script>alert("XSS")</script>',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
      ];

      htmlPayloads.forEach((payload) => {
        const result = highlightMatch(payload, 'test');
        // Result should not contain unescaped < or >
        expect(result).not.toMatch(/<(?!mark>|\/mark>)/);
        // Should contain escaped entities
        expect(result).toContain('&lt;');
      });

      // Test payload without HTML tags still escapes quotes properly
      const scriptPayload = "';alert('XSS');//";
      const result = highlightMatch(scriptPayload, 'alert');
      expect(result).toContain('&#39;');
      expect(result).not.toContain('<script>');
    });

    it('should escape regex metacharacters to prevent regex injection', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      // Test regex metacharacters that could break the regex
      const regexPayloads = ['.*', '(test)', '[abc]', '{1,2}', '^test$', 'test|demo', 'test\\w+'];

      regexPayloads.forEach((payload) => {
        // Should not throw an error
        expect(() => {
          highlightMatch('some text with test in it', payload);
        }).not.toThrow();
      });
    });

    it('should properly highlight matches in safe text', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      const result = highlightMatch('Implant Research', 'Implant');
      expect(result).toBe('<mark>Implant</mark> Research');
    });

    it('should be case-insensitive when highlighting', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      const result = highlightMatch('Implant Research', 'implant');
      expect(result).toBe('<mark>Implant</mark> Research');
    });

    it('should handle empty query gracefully', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      const result = highlightMatch('Test Text', '');
      expect(result).toBe('Test Text');
    });

    it('should escape HTML in text while highlighting', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      const result = highlightMatch('Test <script>alert("XSS")</script> implant', 'implant');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('<mark>implant</mark>');
      expect(result).not.toMatch(/<script>/);
    });

    it('should escape special characters in both text and query', () => {
      const highlightMatch = wrapper.vm.highlightMatch;

      const result = highlightMatch('Test & Test', '&');
      expect(result).toBe('Test <mark>&amp;</mark> Test');
    });
  });
});
