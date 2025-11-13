/**
 * Misc Skills Integration Tests
 *
 * Tests UI components with the new MiscSkill structure, focusing on:
 * - SkillSlider display behavior with MiscSkill objects
 * - Tooltip breakdowns showing equipment, perk, and buff bonuses
 * - Zero-value toggle functionality for Misc category
 * - Reactive updates when bonuses change
 * - No console errors or type mismatches
 */

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import SkillSlider from '@/components/profiles/skills/SkillSlider.vue';
import StatBreakdownTooltip from '@/components/profiles/skills/StatBreakdownTooltip.vue';
import SkillsManager from '@/components/profiles/skills/SkillsManager.vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { SkillId } from '@/types/skills';
import { SKILL_ID, MISC_SKILL_ID, createTestProfile, PROFESSION, BREED, createTestSkillData } from '@/__tests__/helpers';

// Mock PrimeVue components
vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template:
      '<input type="range" :value="modelValue" @input="$emit(\'update:model-value\', Number($event.target.value))" :min="min" :max="max" :step="step" />',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:model-value'],
  },
}));

vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    template:
      '<input type="number" :value="modelValue" @input="$emit(\'update:model-value\', Number($event.target.value))" :min="min" :max="max" :step="step" />',
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:model-value'],
  },
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')" :disabled="disabled">{{ label }}</button>',
    props: ['label', 'severity', 'outlined', 'size', 'disabled'],
    emits: ['click'],
  },
}));

// Mock tooltip directive
const tooltipDirective = {
  beforeMount() {},
  updated() {},
};

// Mock the console to check for errors
const consoleErrors: string[] = [];
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  consoleErrors.push(args.join(' '));
  originalConsoleError(...args);
};

// Helper to cast numeric skill IDs to branded SkillId type
const toSkillId = (id: number): SkillId => id as SkillId;

let pinia: Pinia;

describe('Misc Skills Integration Tests', () => {
  // Helper to expand Misc category
  const expandMiscCategory = async (wrapper: VueWrapper) => {
    const miscCategoryHeaders = wrapper.findAll('.category-header');
    for (const header of miscCategoryHeaders) {
      if (header.text().includes('Misc')) {
        await header.trigger('click');
        await nextTick();
        return;
      }
    }
  };

  // Test profile factory with Misc skills
  const createMiscSkillsProfile = (): TinkerProfile => {
    return createTestProfile({
      profession: PROFESSION.ADVENTURER,
      breed: BREED.SOLITUS,
      level: 100,
      skills: {
        // Abilities (using full SkillData structure)
        [SKILL_ID.INTELLIGENCE]: createTestSkillData({ base: 100, total: 100 }),
        [SKILL_ID.PSYCHIC]: createTestSkillData({ base: 100, total: 100 }),
        [SKILL_ID.SENSE]: createTestSkillData({ base: 100, total: 100 }),
        [SKILL_ID.STAMINA]: createTestSkillData({ base: 100, total: 100 }),
        [SKILL_ID.STRENGTH]: createTestSkillData({ base: 100, total: 100 }),
        [SKILL_ID.AGILITY]: createTestSkillData({ base: 100, total: 100 }),

        // Actual Misc category skills (bonus-only stats)
        // These are from the Misc category in skill-mappings.ts
        [MISC_SKILL_ID.HEAL_DELTA]: createTestSkillData({
          base: 0,
          equipmentBonus: 50,
          perkBonus: 25,
          buffBonus: 10,
          total: 85,
        }),
        [MISC_SKILL_ID.NANO_DELTA]: createTestSkillData({
          base: 0,
          equipmentBonus: 30,
          perkBonus: 0,
          buffBonus: 0,
          total: 30,
        }),
        [MISC_SKILL_ID.CRITICAL_INCREASE]: createTestSkillData({
          base: 0,
          equipmentBonus: 0,
          perkBonus: 15,
          buffBonus: 5,
          total: 20,
        }),
        [MISC_SKILL_ID.ADD_ALL_OFF]: createTestSkillData({
          base: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0,
          total: 0,
        }),
        [MISC_SKILL_ID.ADD_ALL_DEF]: createTestSkillData({
          base: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0,
          total: 0,
        }),
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrors.length = 0;
    localStorage.clear();

    // Create app with PrimeVue + ToastService
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    // Create and activate Pinia
    pinia = createPinia();
    app.use(pinia);
    setActivePinia(pinia);
  });

  describe('SkillSlider Display with MiscSkill Objects', () => {
    it('should correctly display MiscSkill objects', () => {
      const skillData = createTestSkillData({
        base: 0,
        equipmentBonus: 50,
        perkBonus: 25,
        buffBonus: 0,
        total: 75,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      // Should extract the value field properly
      expect(wrapper.text()).toContain('75');
      expect(wrapper.text()).toContain('Concealment');
    });

    it('should extract value field properly from MiscSkill objects', async () => {
      const skillData = createTestSkillData({
        base: 0,
        equipmentBonus: 100,
        perkBonus: 50,
        buffBonus: 25,
        total: 175,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.PSYCHOLOGY),
          skillName: 'Psychology',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Should display the calculated total value
      const valueDisplay = wrapper.find('.skill-value-display');
      expect(valueDisplay.exists()).toBe(true);
      expect(valueDisplay.text()).toContain('175');
    });

    it('should maintain read-only behavior for Misc skills', () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 50,
        perkBonus: 0,
        buffBonus: 0,
        total: 50,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.BRAWLING),
          skillName: 'Brawling',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      // Should not show interactive controls for read-only Misc skills
      expect(wrapper.find('input[type="range"]').exists()).toBe(false);
      expect(wrapper.find('input[type="number"]').exists()).toBe(false);
      expect(wrapper.find('button').exists()).toBe(false);
    });

    it('should show equipment bonus indicator for Misc skills with bonuses', () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 75,
        perkBonus: 0,
        buffBonus: 0,
        total: 75,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      const equipmentBonus = wrapper.find('.equipment-bonus-indicator');
      expect(equipmentBonus.exists()).toBe(true);
      expect(equipmentBonus.text()).toContain('+75');
    });
  });

  describe('Tooltip Breakdowns for Misc Skills', () => {
    it('should show tooltip breakdowns for Misc skills', () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 50,
        perkBonus: 25,
        buffBonus: 10,
        total: 85,
      });

      const wrapper = mount(StatBreakdownTooltip, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isMiscSkill: true,
          baseValue: 0,
          trickleDownBonus: 0,
          equipmentBonus: 50,
          perkBonus: 25,
          buffBonus: 10,
          ipContribution: 0,
          abilityImprovements: 0,
          totalValue: 85,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      expect(wrapper.text()).toContain('Concealment Breakdown');
      expect(wrapper.text()).toContain('Equipment:');
      expect(wrapper.text()).toContain('+50');
      expect(wrapper.text()).toContain('Perks:');
      expect(wrapper.text()).toContain('+25');
      expect(wrapper.text()).toContain('Buffs:');
      expect(wrapper.text()).toContain('+10');
    });

    it('should NOT show IP or trickle-down rows for Misc skills', () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 30,
        perkBonus: 0,
        buffBonus: 0,
        total: 30,
      });

      const wrapper = mount(StatBreakdownTooltip, {
        props: {
          skillId: toSkillId(SKILL_ID.PSYCHOLOGY),
          skillName: 'Psychology',
          skillData: skillData,
          isAbility: false,
          isMiscSkill: true,
          baseValue: 0,
          trickleDownBonus: 0,
          equipmentBonus: 30,
          perkBonus: 0,
          buffBonus: 0,
          ipContribution: 0,
          abilityImprovements: 0,
          totalValue: 30,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      // Should NOT show IP improvements or trickle-down
      expect(wrapper.text()).not.toContain('IP Improvements');
      expect(wrapper.text()).not.toContain('Trickle-down');

      // Should show equipment bonus
      expect(wrapper.text()).toContain('Equipment:');
      expect(wrapper.text()).toContain('+30');
    });

    it('should use correct color coding for bonuses', () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 40,
        perkBonus: 20,
        buffBonus: 5,
        total: 65,
      });

      const wrapper = mount(StatBreakdownTooltip, {
        props: {
          skillId: toSkillId(SKILL_ID.DUCK_EXP),
          skillName: 'Duck-Exp',
          skillData: skillData,
          isAbility: false,
          isMiscSkill: true,
          baseValue: 0,
          trickleDownBonus: 0,
          equipmentBonus: 40,
          perkBonus: 20,
          buffBonus: 5,
          ipContribution: 0,
          abilityImprovements: 0,
          totalValue: 65,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      // Check for color classes
      const equipmentRow = wrapper.find('.breakdown-row:has(.text-blue-600)');
      const perkRow = wrapper.find('.breakdown-row:has(.text-purple-600)');
      const buffRow = wrapper.find('.breakdown-row:has(.text-amber-600)');

      // Note: These selectors may not work in jsdom, so we check text content instead
      expect(wrapper.html()).toContain('text-blue-600'); // Equipment bonus color
      expect(wrapper.html()).toContain('text-purple-600'); // Perk bonus color
      expect(wrapper.html()).toContain('text-amber-600'); // Buff bonus color
    });
  });

  describe('Zero-Value Toggle Functionality', () => {
    it('should show/hide zero-value Misc skills based on toggle', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // By default, zero-value skills should be hidden
      // Should show skills with values > 0
      expect(wrapper.text()).toContain('Concealment');
      expect(wrapper.text()).toContain('Psychology');
      expect(wrapper.text()).toContain('Duck-Exp');

      // Should not show zero-value skills
      expect(wrapper.text()).not.toContain('Brawling');
      expect(wrapper.text()).not.toContain('Swim');
    });

    it('should toggle zero-value skills when button is clicked', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // Find and click the toggle button
      const toggleButton =
        wrapper.find('[data-testid="toggle-zero-misc"]') ||
        wrapper.find('button:contains("Show Zero")');

      const allButtons = wrapper.findAll('button');
      const firstButton = allButtons.length > 0 ? allButtons[0] : null;

      const buttonToClick = toggleButton && toggleButton.exists() ? toggleButton : firstButton;
      if (buttonToClick && buttonToClick.exists()) {
        await buttonToClick.trigger('click');
        await nextTick();

        // After toggle, should show zero-value skills
        expect(wrapper.text()).toContain('Brawling');
        expect(wrapper.text()).toContain('Swim');
      }
    });

    it('should save toggle preference to localStorage', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // Find and click the toggle button
      const toggleButton = wrapper.find('[data-testid="toggle-zero-misc"]');
      const allButtons = wrapper.findAll('button');
      const firstButton = allButtons.length > 0 ? allButtons[0] : null;

      const buttonToClick = toggleButton && toggleButton.exists() ? toggleButton : firstButton;
      if (buttonToClick && buttonToClick.exists()) {
        await buttonToClick.trigger('click');
        await nextTick();

        // Check localStorage was updated
        const savedPreference = localStorage.getItem('tinkertools_show_zero_misc_skills');
        expect(savedPreference).toBeTruthy();
      }
    });

    it('should load toggle preference from localStorage on mount', async () => {
      // Set preference in localStorage before mounting
      localStorage.setItem('tinkertools_show_zero_misc_skills', 'true');

      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // Should show zero-value skills based on saved preference
      expect(wrapper.text()).toContain('Concealment');
      expect(wrapper.text()).toContain('Brawling');
      expect(wrapper.text()).toContain('Swim');
    });
  });

  describe('Reactive Updates', () => {
    it('should update display when bonuses change', async () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 50,
        perkBonus: 0,
        buffBonus: 0,
        total: 50,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      expect(wrapper.text()).toContain('50');

      // Update skill data
      const updatedSkill = createTestSkillData({
        base: 0,
        equipmentBonus: 75,
        perkBonus: 25,
        buffBonus: 0,
        total: 100,
      });

      await wrapper.setProps({ skillData: updatedSkill });
      await nextTick();

      expect(wrapper.text()).toContain('100');
      expect(wrapper.find('.equipment-bonus-value').text()).toContain('+75');
    });

    it('should update tooltip when bonuses change', async () => {
      const initialSkill = createTestSkillData({
        base: 0,
        equipmentBonus: 30,
        perkBonus: 0,
        buffBonus: 0,
        total: 30,
      });

      const wrapper = mount(StatBreakdownTooltip, {
        props: {
          skillId: toSkillId(SKILL_ID.PSYCHOLOGY),
          skillName: 'Psychology',
          skillData: initialSkill,
          isAbility: false,
          isMiscSkill: true,
          baseValue: 0,
          trickleDownBonus: 0,
          equipmentBonus: 30,
          perkBonus: 0,
          buffBonus: 0,
          ipContribution: 0,
          abilityImprovements: 0,
          totalValue: 30,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      expect(wrapper.text()).toContain('+30');
      expect(wrapper.text()).not.toContain('Perks:');

      // Update with perk bonus
      const updatedSkill = createTestSkillData({
        base: 0,
        equipmentBonus: 30,
        perkBonus: 20,
        buffBonus: 0,
        total: 50,
      });

      await wrapper.setProps({
        skillData: updatedSkill,
      });
      await nextTick();

      expect(wrapper.text()).toContain('+30');
      expect(wrapper.text()).toContain('Perks:');
      expect(wrapper.text()).toContain('+20');
    });

    it('should update filtered display when toggle changes', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // Initially should not show zero-value skills
      expect(wrapper.text()).toContain('Concealment');
      expect(wrapper.text()).not.toContain('Brawling');

      // Find toggle and click it
      const buttons = wrapper.findAll('button');
      if (buttons.length > 0) {
        await buttons[0].trigger('click');
        await nextTick();

        // Should now show zero-value skills
        expect(wrapper.text()).toContain('Brawling');
      }
    });
  });

  describe('No Console Errors', () => {
    it('should not generate type errors or warnings', async () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 50,
        perkBonus: 25,
        buffBonus: 10,
        total: 85,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Check that no console errors were generated
      expect(consoleErrors).toEqual([]);
    });

    it('should mount and unmount components cleanly', async () => {
      const skillData = createTestSkillData({
        base: 0,
        
        equipmentBonus: 0,
        perkBonus: 0,
        buffBonus: 0,
        total: 50,
      });

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.PSYCHOLOGY),
          skillName: 'Psychology',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      expect(wrapper.exists()).toBe(true);

      wrapper.unmount();

      // Should not generate errors during unmounting
      expect(consoleErrors.filter((error) => error.includes('unmount'))).toEqual([]);
    });

    it('should handle missing or malformed skill data gracefully', () => {
      // Test with undefined skill data
      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.MAX_NCU),
          skillName: 'Test Skill',
          skillData: undefined,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS,
        },
        global: {
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      // Should not crash or generate errors
      expect(wrapper.exists()).toBe(true);
      expect(consoleErrors.filter((error) => error.includes('undefined'))).toEqual([]);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with complete profile integration', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // Should display Misc skills correctly
      expect(wrapper.text()).toContain('Misc');
      expect(wrapper.text()).toContain('Concealment');
      expect(wrapper.text()).toContain('Psychology');
      expect(wrapper.text()).toContain('Duck-Exp');

      // Should not show zero-value skills by default
      expect(wrapper.text()).not.toContain('Brawling');
      expect(wrapper.text()).not.toContain('Swim');

      // No errors should occur
      expect(consoleErrors).toEqual([]);
    });

    it('should handle dynamic profile updates', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile,
        },
        global: {
          plugins: [pinia, PrimeVue, ToastService],
          directives: {
            tooltip: tooltipDirective,
          },
        },
      });

      await nextTick();

      // Expand Misc category to see skills
      await expandMiscCategory(wrapper);

      // Update profile with new skill values
      const updatedProfile = {
        ...profile,
        skills: {
          ...profile.skills,
          [SKILL_ID.BRAWLING]: {
            base: 0,
            trickle: 0,
            ipSpent: 0,
            pointsFromIp: 0,
            equipmentBonus: 100,
            perkBonus: 0,
            buffBonus: 0,
            total: 100,
          },
        },
      };

      await wrapper.setProps({ profile: updatedProfile });
      await nextTick();

      // Should now show the updated Brawling skill (value > 0 makes it visible)
      expect(wrapper.text()).toContain('Brawling');
    });
  });

  // Cleanup
  afterAll(() => {
    console.error = originalConsoleError;
  });
});
