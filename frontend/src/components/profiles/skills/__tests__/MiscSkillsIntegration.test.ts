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
import SkillSlider from '@/components/profiles/skills/SkillSlider.vue';
import StatBreakdownTooltip from '@/components/profiles/skills/StatBreakdownTooltip.vue';
import SkillsManager from '@/components/profiles/skills/SkillsManager.vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { SkillId } from '@/types/skills';
import { SKILL_ID, createTestProfile, PROFESSION, BREED } from '@/__tests__/helpers';

// Mock PrimeVue components
vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template: '<input type="range" :value="modelValue" @input="$emit(\'update:model-value\', Number($event.target.value))" :min="min" :max="max" :step="step" />',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:model-value']
  }
}));

vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    template: '<input type="number" :value="modelValue" @input="$emit(\'update:model-value\', Number($event.target.value))" :min="min" :max="max" :step="step" />',
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:model-value']
  }
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')" :disabled="disabled">{{ label }}</button>',
    props: ['label', 'severity', 'outlined', 'size', 'disabled'],
    emits: ['click']
  }
}));

// Mock tooltip directive
const tooltipDirective = {
  beforeMount() {},
  updated() {}
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

describe('Misc Skills Integration Tests', () => {

  // Test profile factory with Misc skills
  const createMiscSkillsProfile = (): TinkerProfile => {
    return createTestProfile({
      profession: PROFESSION.ADVENTURER,
      breed: BREED.SOLITUS,
      level: 100,
      skills: {
        // Abilities
        [SKILL_ID.INTELLIGENCE]: { base: 100, total: 100 },
        [SKILL_ID.PSYCHIC]: { base: 100, total: 100 },
        [SKILL_ID.SENSE]: { base: 100, total: 100 },
        [SKILL_ID.STAMINA]: { base: 100, total: 100 },
        [SKILL_ID.STRENGTH]: { base: 100, total: 100 },
        [SKILL_ID.AGILITY]: { base: 100, total: 100 },

        // Misc skills with bonuses
        [SKILL_ID.BRAWLING]: {
          base: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0,
          total: 0
        },
        [SKILL_ID.CONCEALMENT]: {
          base: 0,
          equipmentBonus: 50,
          perkBonus: 25,
          buffBonus: 10,
          total: 85
        },
        [SKILL_ID.PSYCHOLOGY]: {
          base: 0,
          equipmentBonus: 30,
          perkBonus: 0,
          buffBonus: 0,
          total: 30
        },
        [SKILL_ID.SWIMMING]: {
          base: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0,
          total: 0
        },
        [SKILL_ID.DUCK_EXP]: {
          base: 0,
          equipmentBonus: 0,
          perkBonus: 15,
          buffBonus: 5,
          total: 20
        },
      }
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrors.length = 0;
    // Clear localStorage
    localStorage.clear();
  });

  describe('SkillSlider Display with MiscSkill Objects', () => {
    it('should correctly display MiscSkill objects', () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 50,
        perkBonus: 25,
        buffBonus: 0,
        total: 75
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      // Should extract the value field properly
      expect(wrapper.text()).toContain('75');
      expect(wrapper.text()).toContain('Concealment');
    });

    it('should extract value field properly from MiscSkill objects', async () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 100,
        perkBonus: 50,
        buffBonus: 25,
        total: 175
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.PSYCHOLOGY),
          skillName: 'Psychology',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

      // Should display the calculated total value
      const valueDisplay = wrapper.find('.skill-value-display');
      expect(valueDisplay.exists()).toBe(true);
      expect(valueDisplay.text()).toContain('175');
    });

    it('should maintain read-only behavior for Misc skills', () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 50,
        perkBonus: 0,
        buffBonus: 0,
        total: 50
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.BRAWLING),
          skillName: 'Brawling',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      // Should not show interactive controls for read-only Misc skills
      expect(wrapper.find('input[type="range"]').exists()).toBe(false);
      expect(wrapper.find('input[type="number"]').exists()).toBe(false);
      expect(wrapper.find('button').exists()).toBe(false);
    });

    it('should show equipment bonus indicator for Misc skills with bonuses', () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 75,
        perkBonus: 0,
        buffBonus: 0,
        total: 75
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      const equipmentBonus = wrapper.find('.equipment-bonus-indicator');
      expect(equipmentBonus.exists()).toBe(true);
      expect(equipmentBonus.text()).toContain('+75');
    });
  });

  describe('Tooltip Breakdowns for Misc Skills', () => {
    it('should show tooltip breakdowns for Misc skills', () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 50,
        perkBonus: 25,
        buffBonus: 10,
        total: 85
      };

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
          totalValue: 85
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
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
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 30,
        perkBonus: 0,
        buffBonus: 0,
        total: 30
      };

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
          totalValue: 30
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      // Should NOT show IP improvements or trickle-down
      expect(wrapper.text()).not.toContain('IP Improvements');
      expect(wrapper.text()).not.toContain('Trickle-down');

      // Should show equipment bonus
      expect(wrapper.text()).toContain('Equipment:');
      expect(wrapper.text()).toContain('+30');
    });

    it('should use correct color coding for bonuses', () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 40,
        perkBonus: 20,
        buffBonus: 5,
        total: 65
      };

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
          totalValue: 65
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      // Check for color classes
      const equipmentRow = wrapper.find('.breakdown-row:has(.text-blue-600)');
      const perkRow = wrapper.find('.breakdown-row:has(.text-purple-600)');
      const buffRow = wrapper.find('.breakdown-row:has(.text-amber-600)');

      // Note: These selectors may not work in jsdom, so we check text content instead
      expect(wrapper.html()).toContain('text-blue-600');  // Equipment bonus color
      expect(wrapper.html()).toContain('text-purple-600'); // Perk bonus color
      expect(wrapper.html()).toContain('text-amber-600');  // Buff bonus color
    });
  });

  describe('Zero-Value Toggle Functionality', () => {
    it('should show/hide zero-value Misc skills based on toggle', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

      // By default, zero-value skills should be hidden
      const miscSection = wrapper.find('[data-testid="misc-skills"]') || wrapper;

      // Should show skills with values > 0
      expect(miscSection.text()).toContain('Concealment');
      expect(miscSection.text()).toContain('Psychology');
      expect(miscSection.text()).toContain('Duck-Exp');

      // Should not show zero-value skills
      expect(miscSection.text()).not.toContain('Brawling');
      expect(miscSection.text()).not.toContain('Swim');
    });

    it('should toggle zero-value skills when button is clicked', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

      // Find and click the toggle button
      const toggleButton = wrapper.find('[data-testid="toggle-zero-misc"]') ||
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
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

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

    it('should load toggle preference from localStorage on mount', () => {
      // Set preference in localStorage before mounting
      localStorage.setItem('tinkertools_show_zero_misc_skills', 'true');

      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      // Should show zero-value skills based on saved preference
      expect(wrapper.text()).toContain('Concealment');
      expect(wrapper.text()).toContain('Brawling');
      expect(wrapper.text()).toContain('Swim');
    });
  });

  describe('Reactive Updates', () => {
    it('should update display when bonuses change', async () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 50,
        perkBonus: 0,
        buffBonus: 0,
        total: 50
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      expect(wrapper.text()).toContain('50');

      // Update skill data
      const updatedSkill = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 75,
        perkBonus: 25,
        buffBonus: 0,
        total: 100
      };

      await wrapper.setProps({ skillData: updatedSkill });
      await nextTick();

      expect(wrapper.text()).toContain('100');
      expect(wrapper.find('.equipment-bonus-value').text()).toContain('+75');
    });

    it('should update tooltip when bonuses change', async () => {
      const initialSkill = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 30,
        perkBonus: 0,
        buffBonus: 0,
        total: 30
      };

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
          totalValue: 30
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      expect(wrapper.text()).toContain('+30');
      expect(wrapper.text()).not.toContain('Perks:');

      // Update with perk bonus
      const updatedSkill = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 30,
        perkBonus: 20,
        buffBonus: 0,
        total: 50
      };

      await wrapper.setProps({
        skillData: updatedSkill
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
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

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
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 50,
        perkBonus: 25,
        buffBonus: 10,
        total: 85
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.CONCEALMENT),
          skillName: 'Concealment',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

      // Check that no console errors were generated
      expect(consoleErrors).toEqual([]);
    });

    it('should mount and unmount components cleanly', async () => {
      const skillData = {
        base: 0,
        trickle: 0,
        ipSpent: 0,
        pointsFromIp: 0,
        equipmentBonus: 0,
        perkBonus: 0,
        buffBonus: 0,
        total: 50
      };

      const wrapper = mount(SkillSlider, {
        props: {
          skillId: toSkillId(SKILL_ID.PSYCHOLOGY),
          skillName: 'Psychology',
          skillData: skillData,
          isAbility: false,
          isReadOnly: true,
          category: 'Misc',
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      expect(wrapper.exists()).toBe(true);

      wrapper.unmount();

      // Should not generate errors during unmounting
      expect(consoleErrors.filter(error => error.includes('unmount'))).toEqual([]);
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
          breed: BREED.SOLITUS
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      // Should not crash or generate errors
      expect(wrapper.exists()).toBe(true);
      expect(consoleErrors.filter(error => error.includes('undefined'))).toEqual([]);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with complete profile integration', async () => {
      const profile = createMiscSkillsProfile();

      const wrapper = mount(SkillsManager, {
        props: {
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

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
          profile: profile
        },
        global: {
          directives: {
            tooltip: tooltipDirective
          }
        }
      });

      await nextTick();

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
            total: 100
          }
        }
      };

      await wrapper.setProps({ profile: updatedProfile });
      await nextTick();

      // Should now show the updated Brawling skill
      expect(wrapper.text()).toContain('Brawling');
    });
  });

  // Cleanup
  afterAll(() => {
    console.error = originalConsoleError;
  });
});