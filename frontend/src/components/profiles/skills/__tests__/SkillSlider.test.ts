/**
 * SkillSlider Tests
 *
 * The slider and input show a skill's displayed total, which includes
 * equipment, perk and buff bonuses. The profile store's modifySkill and
 * modifyAbility take the trained value (5 + trickle-down + IP for skills,
 * breed base + IP for abilities), so edits must be emitted without bonuses;
 * otherwise every edit on a buffed skill spends IP on the bonus amount.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import SkillSlider from '@/components/profiles/skills/SkillSlider.vue';
import { getBreedInitValue } from '@/lib/tinkerprofiles/ip-calculator';
import type { SkillData } from '@/lib/tinkerprofiles/types';
import { SKILL_ID, BREED, PROFESSION, createTestSkillData } from '@/__tests__/helpers';

/** Programmatic updates suppress emits for 10ms after props change. */
const PROGRAMMATIC_UPDATE_MS = 10;

describe('SkillSlider', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  async function mountSlider(props: {
    skillId: number;
    skillData: SkillData & { cap?: number };
    category: string;
    isAbility?: boolean;
  }) {
    vi.useFakeTimers();
    wrapper = mount(SkillSlider, {
      props: { breed: BREED.SOLITUS, profession: PROFESSION.ADVENTURER, ...props },
      global: { plugins: [PrimeVue], directives: { tooltip: Tooltip } },
    });
    await vi.advanceTimersByTimeAsync(PROGRAMMATIC_UPDATE_MS);
    return wrapper;
  }

  function typeValue(value: number) {
    wrapper.findComponent(InputNumber).vm.$emit('update:modelValue', value);
  }

  function slideTo(value: number) {
    const slider = wrapper.findComponent(Slider);
    slider.vm.$emit('update:modelValue', value);
    slider.vm.$emit('slideend', { originalEvent: new Event('mouseup'), value });
  }

  describe('trainable skill with bonuses', () => {
    // 5 base + 20 trickle-down + 100 IP + 50 equipment = 175, cap 300 (bonuses included)
    const pistol = {
      ...createTestSkillData({
        base: 5,
        trickle: 20,
        pointsFromIp: 100,
        equipmentBonus: 50,
        total: 175,
      }),
      cap: 300,
    };

    const mountPistol = () =>
      mountSlider({ skillId: SKILL_ID.PISTOL, skillData: pistol, category: 'Ranged Weapons' });

    it('shows the total and bounds both controls in total units', async () => {
      await mountPistol();

      const slider = wrapper.findComponent(Slider);
      expect(wrapper.findComponent(InputNumber).props('modelValue')).toBe(175);
      expect(slider.props('modelValue')).toBe(175);
      // Minimum: nothing trained, bonuses still apply
      expect(slider.props('min')).toBe(75);
      expect(slider.props('max')).toBe(300);
    });

    it('emits the trained value, without bonuses, when the user types a total', async () => {
      await mountPistol();

      typeValue(180); // +5 IP

      expect(wrapper.emitted('skill-changed')).toEqual([
        ['Ranged Weapons', SKILL_ID.PISTOL, 5 + 20 + 105],
      ]);
    });

    it('emits the trained value when the user releases the slider', async () => {
      await mountPistol();

      slideTo(200); // +25 IP

      expect(wrapper.emitted('skill-changed')).toEqual([
        ['Ranged Weapons', SKILL_ID.PISTOL, 5 + 20 + 125],
      ]);
    });

    it('never goes below the untrained minimum', async () => {
      await mountPistol();

      typeValue(10);

      expect(wrapper.emitted('skill-changed')).toEqual([['Ranged Weapons', SKILL_ID.PISTOL, 25]]);
    });

    it('raises the skill to its cap with Max', async () => {
      await mountPistol();

      await wrapper
        .findAll('button')
        .find((b) => b.text() === 'Max')!
        .trigger('click');

      expect(wrapper.emitted('skill-changed')).toEqual([['Ranged Weapons', SKILL_ID.PISTOL, 250]]);
    });

    it('follows the profile without emitting when bonuses change', async () => {
      await mountPistol();

      await wrapper.setProps({ skillData: { ...pistol, equipmentBonus: 80, total: 205 } });
      await vi.advanceTimersByTimeAsync(PROGRAMMATIC_UPDATE_MS);

      expect(wrapper.findComponent(Slider).props('min')).toBe(105);
      expect(wrapper.findComponent(InputNumber).props('modelValue')).toBe(205);
      expect(wrapper.emitted('skill-changed')).toBeUndefined();
    });
  });

  describe('ability with bonuses', () => {
    const breedBase = getBreedInitValue(BREED.SOLITUS, SKILL_ID.STRENGTH);
    const strength = {
      ...createTestSkillData({
        base: breedBase,
        pointsFromIp: 200,
        buffBonus: 30,
        total: breedBase + 200 + 30,
      }),
      cap: 600,
    };

    it('emits breed base + IP, without bonuses', async () => {
      await mountSlider({
        skillId: SKILL_ID.STRENGTH,
        skillData: strength,
        category: 'Attributes',
        isAbility: true,
      });

      typeValue(breedBase + 200 + 30 + 10); // +10 IP

      expect(wrapper.emitted('ability-changed')).toEqual([[SKILL_ID.STRENGTH, breedBase + 210]]);
    });
  });
});
