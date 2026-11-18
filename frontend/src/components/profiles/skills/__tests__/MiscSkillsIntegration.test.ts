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
import SkillsManager from '@/components/profiles/skills/SkillsManager.vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { SkillId } from '@/types/skills';
import {
  SKILL_ID,
  MISC_SKILL_ID,
  createTestProfile,
  PROFESSION,
  BREED,
  createTestSkillData,
} from '@/__tests__/helpers';

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
console.error = (...args: unknown[]) => {
  consoleErrors.push(args.join(' '));
  originalConsoleError(...args);
};

// Helper to cast numeric skill IDs to branded SkillId type
const toSkillId = (id: number): SkillId => id as SkillId;

let pinia: Pinia;

describe('Misc Skills Integration Tests', () => {
  const mountSkillsManager = async (profile: TinkerProfile) => {
    const wrapper = mount(SkillsManager, {
      props: { profile },
      global: {
        plugins: [pinia, PrimeVue, ToastService],
        directives: { tooltip: tooltipDirective },
      },
    });
    await nextTick();
    await expandMiscCategory(wrapper);
    return wrapper;
  };

  const miscCategory = (wrapper: VueWrapper) => {
    const category = wrapper
      .findAll('.skill-category')
      .find((c) => c.find('.category-header h4').text() === 'Misc');
    if (!category) throw new Error('Misc category not rendered');
    return category;
  };

  // Expand the Misc category so its skills are rendered
  const expandMiscCategory = async (wrapper: VueWrapper) => {
    await miscCategory(wrapper).find('.category-header').trigger('click');
  };

  const miscSkillNames = (wrapper: VueWrapper): string[] =>
    miscCategory(wrapper)
      .findAll('.skill-info-row .truncate')
      .map((name) => name.text());

  const setShowZeroValues = async (wrapper: VueWrapper, show: boolean) => {
    await wrapper.find('#show-zero-misc').setValue(show);
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

      // Read-only skills show the calculated total instead of an editable value
      expect(wrapper.find('.skill-value-display').exists()).toBe(false);
      expect(wrapper.text()).toContain('175');
      expect(wrapper.text()).toContain('Misc Skill (Read-Only)');
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

  describe('Zero-Value Toggle Functionality', () => {
    it('hides zero-value Misc skills by default', async () => {
      const wrapper = await mountSkillsManager(createMiscSkillsProfile());

      const names = miscSkillNames(wrapper);
      expect(names).toEqual(expect.arrayContaining(['HealDelta', 'NanoDelta', 'CriticalIncrease']));
      expect(names).not.toContain('Add All Off.');
      expect(names).not.toContain('Add All Def.');
    });

    it('shows the zero-value Misc skills once the toggle is checked, and hides them again', async () => {
      const wrapper = await mountSkillsManager(createMiscSkillsProfile());

      await setShowZeroValues(wrapper, true);
      expect(miscSkillNames(wrapper)).toEqual(
        expect.arrayContaining(['HealDelta', 'Add All Off.', 'Add All Def.'])
      );

      await setShowZeroValues(wrapper, false);
      expect(miscSkillNames(wrapper)).not.toContain('Add All Off.');
      expect(miscSkillNames(wrapper)).toContain('HealDelta');
    });

    it('remembers the toggle in localStorage', async () => {
      const wrapper = await mountSkillsManager(createMiscSkillsProfile());

      await setShowZeroValues(wrapper, true);

      expect(localStorage.getItem('tinkertools_show_zero_misc_skills')).toBe('true');
    });

    it('restores the toggle from localStorage on mount', async () => {
      localStorage.setItem('tinkertools_show_zero_misc_skills', 'true');

      const wrapper = await mountSkillsManager(createMiscSkillsProfile());

      expect((wrapper.find('#show-zero-misc').element as HTMLInputElement).checked).toBe(true);
      expect(miscSkillNames(wrapper)).toEqual(
        expect.arrayContaining(['HealDelta', 'Add All Off.', 'Add All Def.'])
      );
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

    it('shows a Misc skill once a bonus lifts it above zero', async () => {
      const profile = createMiscSkillsProfile();
      const wrapper = await mountSkillsManager(profile);
      expect(miscSkillNames(wrapper)).not.toContain('Add All Off.');

      await wrapper.setProps({
        profile: {
          ...profile,
          skills: {
            ...profile.skills,
            [MISC_SKILL_ID.ADD_ALL_OFF]: createTestSkillData({
              base: 0,
              equipmentBonus: 100,
              perkBonus: 0,
              buffBonus: 0,
              total: 100,
            }),
          },
        },
      });

      expect(miscSkillNames(wrapper)).toContain('Add All Off.');
      expect(miscCategory(wrapper).text()).toContain('100');
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

      mount(SkillSlider, {
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
      // Test with missing (null) skill data
      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.MAX_NCU),
          skillName: 'Test Skill',
          skillData: null,
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
    it("shows the viewed profile's Misc values, not the active profile's", async () => {
      // No profile is active in the store; everything shown must come from the prop.
      const wrapper = await mountSkillsManager(createMiscSkillsProfile());

      const misc = miscCategory(wrapper);
      const healDelta = misc
        .findAll('.skill-item')
        .find((item) => item.text().includes('HealDelta'));
      expect(healDelta?.text()).toContain('85');
      expect(consoleErrors).toEqual([]);
    });
  });

  // Cleanup
  afterAll(() => {
    console.error = originalConsoleError;
  });
});
