/**
 * NukeInputForm Component Integration Tests
 *
 * Tests the master form component for TinkerNukes input fields.
 * Validates the state the form hands its parent (update:inputState):
 * - Auto-population from the active profile, and defaults otherwise
 * - Re-population on profile switch and via the Reset to Profile button
 * - Buff dropdown updates to stat 536 (Direct Nano Damage Efficiency)
 * - Debounced emission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import NukeInputForm from '@/components/nukes/NukeInputForm.vue';
import type { NukeInputState } from '@/types/offensive-nano';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { createTestProfile, PROFESSION, BREED } from '@/__tests__/helpers';

// Mock child section components to isolate NukeInputForm behavior
vi.mock('@/components/nukes/CharacterStatsSection.vue', () => ({
  default: {
    name: 'CharacterStatsSection',
    template: '<div data-test="character-stats-section"></div>',
    props: ['characterStats', 'profile'],
    emits: ['update:character-stats'],
  },
}));

vi.mock('@/components/nukes/DamageModifiersSection.vue', () => ({
  default: {
    name: 'DamageModifiersSection',
    template: '<div data-test="damage-modifiers-section"></div>',
    props: ['damageModifiers', 'enhanceNanoDamage', 'ancientMatrix', 'profile'],
    emits: ['update:damage-modifiers'],
  },
}));

vi.mock('@/components/nukes/BuffPresetsSection.vue', () => ({
  default: {
    name: 'BuffPresetsSection',
    template: '<div data-test="buff-presets-section"></div>',
    props: ['buffPresets', 'profile'],
    emits: ['update:buff-presets'],
  },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const createDefaultInputState = (): NukeInputState => ({
  characterStats: {
    breed: 1,
    level: 1,
    psychic: 6,
    nanoInit: 1,
    maxNano: 1,
    nanoDelta: 1,
    matterCreation: 1,
    matterMeta: 1,
    bioMeta: 1,
    psychModi: 1,
    sensoryImp: 1,
    timeSpace: 1,
    spec: 0,
  },
  damageModifiers: {
    projectile: 0,
    melee: 0,
    energy: 0,
    chemical: 0,
    radiation: 0,
    cold: 0,
    nano: 0,
    fire: 0,
    poison: 0,
    directNanoDamageEfficiency: 0,
    targetAC: 0,
  },
  buffPresets: {
    crunchcom: 0,
    humidity: 0,
    notumSiphon: 0,
    channeling: 0,
    enhanceNanoDamage: 0,
    ancientMatrix: 0,
  },
});

const createNanotechProfile = (): TinkerProfile =>
  createTestProfile({
    name: 'TestNano',
    profession: PROFESSION.NANO_TECHNICIAN,
    breed: BREED.NANOMAGE,
    level: 220,
    skills: {
      21: { total: 800 }, // Psychic
      149: { total: 1200 }, // NanoInit
      364: { total: 500 }, // NanoDelta
      130: { total: 2501 }, // MaterialCreation
      127: { total: 2502 }, // MaterialMetamorphose
      128: { total: 2503 }, // BiologicalMetamorphose
      129: { total: 2504 }, // PsychologicalModification
      122: { total: 2505 }, // SensoryImprovement
      131: { total: 2506 }, // SpaceTime
      278: { total: 100 }, // Projectile damage modifier
      280: { total: 150 }, // Energy damage modifier
      315: { total: 200 }, // Nano damage modifier
      536: { total: 50 }, // Direct Nano Damage Efficiency
    },
  });

const createNonNanotechProfile = (): TinkerProfile =>
  createTestProfile({
    name: 'TestDoc',
    profession: PROFESSION.DOCTOR,
    breed: BREED.SOLITUS,
    level: 220,
    skills: { 21: { total: 500 } },
  });

/** A profile carrying only the given skills, bypassing the fixture defaults. */
const withSkills = (profile: TinkerProfile, skills: TinkerProfile['skills']): TinkerProfile => ({
  ...profile,
  skills,
});

// ============================================================================
// Test Suite
// ============================================================================

/** The form debounces its update:inputState emissions by 50ms. */
const EMIT_DEBOUNCE_MS = 50;

describe('NukeInputForm', () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  function mountForm(
    activeProfile: TinkerProfile | null,
    inputState: NukeInputState = createDefaultInputState(),
    options: { attachTo?: HTMLElement } = {}
  ): VueWrapper {
    wrapper = mount(NukeInputForm, {
      props: { inputState, activeProfile },
      global: { plugins: [PrimeVue], directives: { tooltip: Tooltip } },
      ...options,
    });
    return wrapper;
  }

  /** Lets pending debounced emissions fire. */
  async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(EMIT_DEBOUNCE_MS + 10);
  }

  function emittedStates(): NukeInputState[] {
    return (wrapper.emitted('update:inputState') ?? []).map(([state]) => state as NukeInputState);
  }

  /** The state the parent ends up with after the debounce settles. */
  async function lastEmittedState(): Promise<NukeInputState> {
    await settle();
    const states = emittedStates();
    expect(states.length).toBeGreaterThan(0);
    return states[states.length - 1];
  }

  function resetButton() {
    return wrapper.find('button');
  }

  // ==========================================================================
  // Component Mounting & Structure Tests
  // ==========================================================================

  describe('Component Structure', () => {
    it('should render the form with all three section components', () => {
      mountForm(null);

      expect(wrapper.find('[data-test="character-stats-section"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="damage-modifiers-section"]').exists()).toBe(true);
      expect(wrapper.find('[data-test="buff-presets-section"]').exists()).toBe(true);
    });

    it('should label the sections', () => {
      mountForm(null);

      expect(wrapper.text()).toContain('Character Stats');
      expect(wrapper.text()).toContain('Damage Modifiers');
      expect(wrapper.text()).toContain('Buff Presets');
    });

    it('should display the form header as a heading', () => {
      mountForm(null);

      expect(wrapper.find('h2').text()).toBe('Offensive Nano Parameters');
    });

    it('should render a native Reset to Profile button, so it is keyboard accessible', () => {
      mountForm(null);

      expect(resetButton().element.tagName).toBe('BUTTON');
      expect(resetButton().text()).toContain('Reset to Profile');
    });
  });

  // ==========================================================================
  // Auto-Population from Profile Tests
  // ==========================================================================

  describe('Auto-Population from Profile', () => {
    it('should auto-populate character stats when Nanotechnician profile is active', async () => {
      mountForm(createNanotechProfile());

      const { characterStats } = await lastEmittedState();
      expect(characterStats).toMatchObject({
        breed: BREED.NANOMAGE,
        level: 220,
        psychic: 800,
        nanoInit: 1200,
        maxNano: 1000, // Character.MaxNano
        nanoDelta: 500,
        matterCreation: 2501,
        matterMeta: 2502,
        bioMeta: 2503,
        psychModi: 2504,
        sensoryImp: 2505,
        timeSpace: 2506,
      });
    });

    it('should auto-populate damage modifiers from profile skills', async () => {
      mountForm(createNanotechProfile());

      const { damageModifiers } = await lastEmittedState();
      expect(damageModifiers.projectile).toBe(100);
      expect(damageModifiers.energy).toBe(150);
      expect(damageModifiers.nano).toBe(200);
      expect(damageModifiers.melee).toBe(0);
      expect(damageModifiers.targetAC).toBe(0);
    });

    it('should calculate initial stat 536 from profile base value', async () => {
      mountForm(createNanotechProfile());

      // Base value from profile (50) + 0 from buffs
      expect((await lastEmittedState()).damageModifiers.directNanoDamageEfficiency).toBe(50);
    });

    it('should reset to defaults when non-Nanotechnician profile is active', async () => {
      mountForm(createNonNanotechProfile());

      const state = await lastEmittedState();
      expect(state.characterStats.breed).toBe(1);
      expect(state.characterStats.psychic).toBe(6);
      expect(state.characterStats.nanoInit).toBe(1);
      expect(state.damageModifiers.directNanoDamageEfficiency).toBe(0);
    });

    it('should reset to defaults when no profile is active', async () => {
      const inputState = createDefaultInputState();
      inputState.characterStats.psychic = 999;
      mountForm(null, inputState);

      const state = await lastEmittedState();
      expect(state.characterStats.psychic).toBe(6);
      expect(state.characterStats.nanoInit).toBe(1);
    });
  });

  // ==========================================================================
  // Profile Switching Tests
  // ==========================================================================

  describe('Profile Switching', () => {
    it('should update fields when switching from one profile to another', async () => {
      const profile1 = createNanotechProfile();
      const profile2 = withSkills(profile1, {
        ...profile1.skills,
        21: { ...profile1.skills[21], total: 1000 },
      });
      mountForm(profile1);
      await settle();

      await wrapper.setProps({ activeProfile: profile2 });

      expect((await lastEmittedState()).characterStats.psychic).toBe(1000);
    });

    it('should clear fields when switching to non-Nanotechnician', async () => {
      mountForm(createNanotechProfile());
      await settle();

      await wrapper.setProps({ activeProfile: createNonNanotechProfile() });

      const state = await lastEmittedState();
      expect(state.characterStats.psychic).toBe(6);
      expect(state.characterStats.nanoInit).toBe(1);
    });

    it('should populate when a Nanotechnician profile becomes active', async () => {
      mountForm(null);
      await settle();

      await wrapper.setProps({ activeProfile: createNanotechProfile() });

      expect((await lastEmittedState()).characterStats.psychic).toBe(800);
    });

    it('should settle on the last profile after rapid switches', async () => {
      const nanoProfile = createNanotechProfile();
      mountForm(nanoProfile);

      await wrapper.setProps({ activeProfile: createNonNanotechProfile() });
      await wrapper.setProps({ activeProfile: null });
      await wrapper.setProps({ activeProfile: nanoProfile });

      const state = await lastEmittedState();
      expect(state.characterStats.psychic).toBe(800);
      // Debounced: the switches collapse into a single emission
      expect(emittedStates()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Reset to Profile Button Tests
  // ==========================================================================

  describe('Reset to Profile Button', () => {
    it('should be disabled when no profile is active', () => {
      mountForm(null);

      expect(resetButton().attributes('disabled')).toBeDefined();
    });

    it('should be enabled when profile is active', () => {
      mountForm(createNanotechProfile());

      expect(resetButton().attributes('disabled')).toBeUndefined();
    });

    it('should discard manual edits and re-populate from profile when clicked', async () => {
      mountForm(createNanotechProfile());
      await settle();

      // User edits psychic in the Character Stats section
      const edited = { ...(await lastEmittedState()).characterStats, psychic: 999 };
      wrapper
        .findComponent({ name: 'CharacterStatsSection' })
        .vm.$emit('update:character-stats', edited);
      expect((await lastEmittedState()).characterStats.psychic).toBe(999);

      await resetButton().trigger('click');

      expect((await lastEmittedState()).characterStats.psychic).toBe(800);
    });

    it('can receive keyboard focus', () => {
      mountForm(createNanotechProfile(), createDefaultInputState(), {
        attachTo: document.body,
      });

      (resetButton().element as HTMLButtonElement).focus();

      expect(document.activeElement).toBe(resetButton().element);
    });
  });

  // ==========================================================================
  // Buff Dropdown Updates Stat 536 (FR-9)
  // ==========================================================================

  describe('Buff Dropdown Updates to Stat 536', () => {
    async function selectBuffs(buffs: Partial<NukeInputState['buffPresets']>) {
      mountForm(createNanotechProfile());
      await settle();

      wrapper.findComponent({ name: 'BuffPresetsSection' }).vm.$emit('update:buff-presets', {
        ...createDefaultInputState().buffPresets,
        ...buffs,
      });

      return (await lastEmittedState()).damageModifiers.directNanoDamageEfficiency;
    }

    it('should add the Enhance Nano Damage bonus to stat 536', async () => {
      // Base 50 + ENHANCE_NANO_DAMAGE[3] (9)
      expect(await selectBuffs({ enhanceNanoDamage: 3 })).toBe(59);
    });

    it('should add the Ancient Matrix bonus to stat 536', async () => {
      // Base 50 + ANCIENT_MATRIX_DAMAGE[5] (1.67)
      expect(await selectBuffs({ ancientMatrix: 5 })).toBe(51.67);
    });

    it('should combine both buff bonuses when both are active', async () => {
      expect(await selectBuffs({ enhanceNanoDamage: 3, ancientMatrix: 5 })).toBe(60.67);
    });

    it('should pass the selected buffs on to the parent', async () => {
      await selectBuffs({ enhanceNanoDamage: 3 });

      expect((await lastEmittedState()).buffPresets.enhanceNanoDamage).toBe(3);
    });
  });

  // ==========================================================================
  // Debounced Emission Tests
  // ==========================================================================

  describe('Debounced State Updates', () => {
    it('should emit rapid edits once, after 50ms, with the latest values', async () => {
      mountForm(createNanotechProfile());
      await settle();
      const emitCountBefore = emittedStates().length;
      const section = wrapper.findComponent({ name: 'CharacterStatsSection' });

      for (let i = 0; i < 5; i++) {
        section.vm.$emit('update:character-stats', {
          ...createDefaultInputState().characterStats,
          psychic: 800 + i,
        });
      }
      await vi.advanceTimersByTimeAsync(EMIT_DEBOUNCE_MS - 1);
      expect(emittedStates()).toHaveLength(emitCountBefore);

      await settle();
      expect(emittedStates()).toHaveLength(emitCountBefore + 1);
      expect((await lastEmittedState()).characterStats.psychic).toBe(804);
    });
  });

  // ==========================================================================
  // Edge Cases & Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should fall back to minimum values for skills the profile lacks', async () => {
      const profile = createNanotechProfile();
      mountForm(withSkills(profile, { 21: { ...profile.skills[21], total: 100 } }));

      const { characterStats, damageModifiers } = await lastEmittedState();
      expect(characterStats.psychic).toBe(100);
      expect(characterStats.nanoInit).toBe(1);
      expect(characterStats.matterCreation).toBe(1);
      expect(damageModifiers.directNanoDamageEfficiency).toBe(0);
    });
  });
});
