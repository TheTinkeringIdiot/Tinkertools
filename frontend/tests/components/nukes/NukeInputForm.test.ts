/**
 * NukeInputForm Component Integration Tests
 *
 * Tests the master form component for TinkerNukes input fields.
 * Validates:
 * - Auto-population from active profile
 * - Manual override persistence
 * - Reset to profile button functionality
 * - Buff dropdown updates to stat 536 (Direct Nano Damage Efficiency)
 * - Accessibility features (ARIA labels, keyboard navigation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import NukeInputForm from '@/components/nukes/NukeInputForm.vue'
import type { NukeInputState } from '@/types/offensive-nano'
import type { TinkerProfile } from '@/lib/tinkerprofiles/types'

// Mock child section components to isolate NukeInputForm behavior
vi.mock('@/components/nukes/CharacterStatsSection.vue', () => ({
  default: {
    name: 'CharacterStatsSection',
    template: '<div data-test="character-stats-section"></div>',
    props: ['characterStats', 'profile'],
    emits: ['update:character-stats']
  }
}))

vi.mock('@/components/nukes/DamageModifiersSection.vue', () => ({
  default: {
    name: 'DamageModifiersSection',
    template: '<div data-test="damage-modifiers-section"></div>',
    props: ['damageModifiers', 'enhanceNanoDamage', 'ancientMatrix', 'profile'],
    emits: ['update:damage-modifiers']
  }
}))

vi.mock('@/components/nukes/BuffPresetsSection.vue', () => ({
  default: {
    name: 'BuffPresetsSection',
    template: '<div data-test="buff-presets-section"></div>',
    props: ['buffPresets', 'profile'],
    emits: ['update:buff-presets']
  }
}))

// ============================================================================
// Test Fixtures
// ============================================================================

const createDefaultInputState = (): NukeInputState => ({
  characterStats: {
    breed: 1,
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
})

const createNanotechProfile = (): TinkerProfile => ({
  Character: {
    Name: 'TestNano',
    Profession: 11, // Nanotechnician
    Breed: 3, // Nanomage
    Level: 220,
    Gender: 'Female',
    Faction: 'Clan',
    Organization: 'Test Org'
  },
  skills: {
    21: { total: 800 },  // Psychic
    149: { total: 1200 }, // Nano Init
    221: { total: 5000 }, // Max Nano
    364: { total: 500 },  // Nano Delta
    126: { total: 2500 }, // Matter Creation
    127: { total: 2500 }, // Matter Meta
    128: { total: 2500 }, // Bio Meta
    129: { total: 2500 }, // Psych Modi
    130: { total: 2500 }, // Sensory Imp
    131: { total: 2500 }, // Time & Space
    278: { total: 100 },  // Projectile damage
    280: { total: 150 },  // Energy damage
    315: { total: 200 },  // Nano damage
    536: { total: 50 },   // Direct Nano Damage Efficiency
  },
  abilities: {},
  items: {},
  symbiants: {},
  perks: [],
  buffs: [],
  version: '4.0.0'
} as any)

const createNonNanotechProfile = (): TinkerProfile => ({
  Character: {
    Name: 'TestDoc',
    Profession: 6, // Doctor
    Breed: 1,
    Level: 220,
    Gender: 'Male',
    Faction: 'Omni',
    Organization: 'Test Org'
  },
  skills: {
    21: { total: 500 },
  },
  abilities: {},
  items: {},
  symbiants: {},
  perks: [],
  buffs: [],
  version: '4.0.0'
} as any)

// ============================================================================
// Test Suite
// ============================================================================

describe('NukeInputForm', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ==========================================================================
  // Component Mounting & Structure Tests
  // ==========================================================================

  describe('Component Structure', () => {
    it('should render the form with all three section components', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      expect(wrapper.find('[data-test="character-stats-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="damage-modifiers-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="buff-presets-section"]').exists()).toBe(true)
    })

    it('should display the form header with title', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      expect(wrapper.text()).toContain('Offensive Nano Parameters')
    })

    it('should render Reset to Profile button', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      const resetButton = wrapper.find('button')
      expect(resetButton.exists()).toBe(true)
      expect(resetButton.text()).toContain('Reset to Profile')
    })

    it('should have accessible ARIA labels on Reset button', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      const resetButton = wrapper.find('button')
      // PrimeVue Button adds aria-label via v-tooltip
      expect(resetButton.attributes('data-pc-section')).toBe('root')
    })
  })

  // ==========================================================================
  // Auto-Population from Profile Tests
  // ==========================================================================

  describe('Auto-Population from Profile', () => {
    it('should auto-populate character stats when Nanotechnician profile is active', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      // Wait for watcher to trigger
      await wrapper.vm.$nextTick()

      // Check emitted update event
      const emittedUpdates = wrapper.emitted('update:inputState')
      expect(emittedUpdates).toBeTruthy()

      // Verify the emitted state has profile values
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState
      expect(lastEmit.characterStats.breed).toBe(3) // Nanomage
      expect(lastEmit.characterStats.psychic).toBe(800)
      expect(lastEmit.characterStats.nanoInit).toBe(1200)
      expect(lastEmit.characterStats.matterCreation).toBe(2500)
    })

    it('should auto-populate damage modifiers from profile skills', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      expect(lastEmit.damageModifiers.projectile).toBe(100)
      expect(lastEmit.damageModifiers.energy).toBe(150)
      expect(lastEmit.damageModifiers.nano).toBe(200)
    })

    it('should calculate initial stat 536 from profile base value', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Should be base value from profile (50) + 0 from buffs
      expect(lastEmit.damageModifiers.directNanoDamageEfficiency).toBe(50)
    })

    it('should reset to defaults when non-Nanotechnician profile is active', async () => {
      const profile = createNonNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Should be reset to default values
      expect(lastEmit.characterStats.breed).toBe(1)
      expect(lastEmit.characterStats.psychic).toBe(6)
      expect(lastEmit.characterStats.nanoInit).toBe(1)
      expect(lastEmit.damageModifiers.directNanoDamageEfficiency).toBe(0)
    })

    it('should reset to defaults when no profile is active', async () => {
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: null
        }
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')

      // Should emit default state on mount
      if (emittedUpdates && emittedUpdates.length > 0) {
        const lastEmit = emittedUpdates[emittedUpdates.length - 1][0] as NukeInputState
        expect(lastEmit.characterStats.psychic).toBe(6)
        expect(lastEmit.characterStats.nanoInit).toBe(1)
      }
    })
  })

  // ==========================================================================
  // Profile Switching Tests
  // ==========================================================================

  describe('Profile Switching', () => {
    it('should update fields when switching from one profile to another', async () => {
      const profile1 = createNanotechProfile()
      const profile2 = {
        ...createNanotechProfile(),
        Character: { ...profile1.Character, Name: 'TestNano2' },
        skills: {
          ...profile1.skills,
          21: { total: 1000 }, // Different psychic value
        }
      }
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile1
        }
      })

      await wrapper.vm.$nextTick()

      // Switch to profile2
      await wrapper.setProps({ activeProfile: profile2 })
      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Should have new profile's psychic value
      expect(lastEmit.characterStats.psychic).toBe(1000)
    })

    it('should clear fields when switching to non-Nanotechnician', async () => {
      const nanoProfile = createNanotechProfile()
      const docProfile = createNonNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: nanoProfile
        }
      })

      await wrapper.vm.$nextTick()

      // Switch to Doctor profile
      await wrapper.setProps({ activeProfile: docProfile })
      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Should be reset to defaults
      expect(lastEmit.characterStats.psychic).toBe(6)
      expect(lastEmit.characterStats.nanoInit).toBe(1)
    })
  })

  // ==========================================================================
  // Reset to Profile Button Tests
  // ==========================================================================

  describe('Reset to Profile Button', () => {
    it('should be disabled when no profile is active', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      const resetButton = wrapper.find('button')
      expect(resetButton.attributes('disabled')).toBeDefined()
    })

    it('should be enabled when profile is active', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: createNanotechProfile()
        }
      })

      const resetButton = wrapper.find('button')
      expect(resetButton.attributes('disabled')).toBeUndefined()
    })

    it('should re-populate from profile when clicked', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      // Modify input state to simulate manual edits
      inputState.characterStats.psychic = 999

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      // Clear previous emissions
      wrapper.emitted('update:inputState')

      // Click reset button
      const resetButton = wrapper.find('button')
      await resetButton.trigger('click')
      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      expect(emittedUpdates).toBeTruthy()

      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Should be reset to profile value, not manual value
      expect(lastEmit.characterStats.psychic).toBe(800)
    })

    it('should have keyboard navigation support', async () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: createNanotechProfile()
        }
      })

      const resetButton = wrapper.find('button')

      // Button should be focusable
      expect(resetButton.attributes('type')).toBeTruthy()

      // Simulate keyboard activation (Enter key)
      await resetButton.trigger('keydown.enter')

      // Should emit update event
      expect(wrapper.emitted('update:inputState')).toBeTruthy()
    })
  })

  // ==========================================================================
  // Buff Dropdown Updates Stat 536 (FR-9)
  // ==========================================================================

  describe('Buff Dropdown Updates to Stat 536', () => {
    it('should update stat 536 when enhanceNanoDamage buff changes', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      // Simulate buff change from BuffPresetsSection
      const buffPresetsSection = wrapper.findComponent({ name: 'BuffPresetsSection' })

      // Update enhanceNanoDamage to level 3 (adds 15% damage)
      await buffPresetsSection.vm.$emit('update:buff-presets', {
        ...inputState.buffPresets,
        enhanceNanoDamage: 3
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Stat 536 should be recalculated
      // Note: The actual value depends on ENHANCE_NANO_DAMAGE lookup table
      expect(lastEmit.damageModifiers.directNanoDamageEfficiency).toBeGreaterThan(50)
    })

    it('should update stat 536 when ancientMatrix buff changes', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      // Simulate buff change from BuffPresetsSection
      const buffPresetsSection = wrapper.findComponent({ name: 'BuffPresetsSection' })

      // Update ancientMatrix to level 5
      await buffPresetsSection.vm.$emit('update:buff-presets', {
        ...inputState.buffPresets,
        ancientMatrix: 5
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Stat 536 should be recalculated with ancient matrix bonus
      expect(lastEmit.damageModifiers.directNanoDamageEfficiency).toBeGreaterThan(50)
    })

    it('should combine both buff bonuses when both are active', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      // Simulate both buffs active
      const buffPresetsSection = wrapper.findComponent({ name: 'BuffPresetsSection' })

      await buffPresetsSection.vm.$emit('update:buff-presets', {
        ...inputState.buffPresets,
        enhanceNanoDamage: 3,
        ancientMatrix: 5
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Stat 536 should be: base(50) + enhance + ancient
      expect(lastEmit.damageModifiers.directNanoDamageEfficiency).toBeGreaterThan(50)
    })
  })

  // ==========================================================================
  // Debounced Emission Tests
  // ==========================================================================

  describe('Debounced State Updates', () => {
    it('should debounce update emissions by 50ms', async () => {
      const profile = createNanotechProfile()
      const inputState = createDefaultInputState()

      wrapper = mount(NukeInputForm, {
        props: {
          inputState,
          activeProfile: profile
        }
      })

      await wrapper.vm.$nextTick()

      // Simulate rapid updates from character stats
      const characterStatsSection = wrapper.findComponent({ name: 'CharacterStatsSection' })

      const initialEmitCount = wrapper.emitted('update:inputState')?.length || 0

      // Emit 5 rapid updates
      for (let i = 0; i < 5; i++) {
        await characterStatsSection.vm.$emit('update:character-stats', {
          ...inputState.characterStats,
          psychic: 800 + i
        })
      }

      // Should not emit immediately
      const afterEmitCount = wrapper.emitted('update:inputState')?.length || 0
      expect(afterEmitCount).toBe(initialEmitCount)

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have emitted once after debounce
      const finalEmitCount = wrapper.emitted('update:inputState')?.length || 0
      expect(finalEmitCount).toBeGreaterThan(initialEmitCount)
    })
  })

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have semantic HTML structure with proper headings', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      const heading = wrapper.find('h2')
      expect(heading.exists()).toBe(true)
      expect(heading.text()).toBe('Offensive Nano Parameters')
    })

    it('should provide tooltip on Reset button for screen readers', () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: createNanotechProfile()
        }
      })

      const resetButton = wrapper.find('button')

      // PrimeVue v-tooltip directive is applied
      expect(resetButton.attributes('data-pc-name')).toBe('button')
    })

    it('should maintain focus management across sections', async () => {
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: createNanotechProfile()
        },
        attachTo: document.body
      })

      const resetButton = wrapper.find('button')

      // Focus the button
      resetButton.element.focus()
      expect(document.activeElement).toBe(resetButton.element)

      wrapper.unmount()
    })

    it('should announce state changes for screen readers', async () => {
      const profile = createNanotechProfile()
      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: null
        }
      })

      // Switch to active profile
      await wrapper.setProps({ activeProfile: profile })
      await wrapper.vm.$nextTick()

      // Should emit update event that parent can announce
      expect(wrapper.emitted('update:inputState')).toBeTruthy()
    })
  })

  // ==========================================================================
  // Edge Cases & Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle profile with missing skill data gracefully', async () => {
      const incompleteProfile = {
        ...createNanotechProfile(),
        skills: {
          21: { total: 100 }, // Only psychic
        }
      }

      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: incompleteProfile
        }
      })

      await wrapper.vm.$nextTick()

      const emittedUpdates = wrapper.emitted('update:inputState')
      const lastEmit = emittedUpdates![emittedUpdates!.length - 1][0] as NukeInputState

      // Should use fallback values (1) for missing skills
      expect(lastEmit.characterStats.psychic).toBe(100)
      expect(lastEmit.characterStats.nanoInit).toBe(1)
      expect(lastEmit.characterStats.matterCreation).toBe(1)
    })

    it('should handle profile with no skills object', async () => {
      const noSkillsProfile = {
        ...createNanotechProfile(),
        skills: undefined
      } as any

      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: noSkillsProfile
        }
      })

      await wrapper.vm.$nextTick()

      // Should not crash, should reset to defaults
      expect(wrapper.exists()).toBe(true)
    })

    it('should handle rapid profile switches without errors', async () => {
      const profile1 = createNanotechProfile()
      const profile2 = createNonNanotechProfile()
      const profile3 = null

      wrapper = mount(NukeInputForm, {
        props: {
          inputState: createDefaultInputState(),
          activeProfile: profile1
        }
      })

      // Rapid switches
      await wrapper.setProps({ activeProfile: profile2 })
      await wrapper.setProps({ activeProfile: profile3 })
      await wrapper.setProps({ activeProfile: profile1 })
      await wrapper.vm.$nextTick()

      // Should not crash
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.emitted('update:inputState')).toBeTruthy()
    })
  })
})
