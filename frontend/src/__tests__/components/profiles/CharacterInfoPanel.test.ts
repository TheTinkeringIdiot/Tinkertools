/**
 * CharacterInfoPanel Component Tests
 *
 * Tests for the character information display panel showing stats and metadata
 */


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountWithContext, standardCleanup, BREED, PROFESSION, SKILL_ID } from '@/__tests__/helpers'

import CharacterInfoPanel from '../../../components/profiles/CharacterInfoPanel.vue'
import type { TinkerProfile } from '@/lib/tinkerprofiles'

// Mock PrimeVue Badge
vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge" :class="severity">{{ value }}</span>',
    props: ['value', 'severity']
  }
}))

// Mock game utilities
vi.mock('@/services/game-utils', () => ({
  calculateTitleLevel: vi.fn((level: number) => {
    if (level >= 220) return 7
    if (level >= 200) return 6
    if (level >= 150) return 5
    if (level >= 100) return 4
    if (level >= 50) return 3
    if (level >= 25) return 2
    return 1
  }),
  getBreedId: vi.fn((breed: string) => {
    const breeds: Record<string, number> = {
      'Solitus': 0,
      'Opifex': 1,
      'Nanomage': 2,
      'Atrox': 3
    }
    return breeds[breed] || 0
  }),
  getProfessionName: vi.fn((id: number) => {
    const professions: Record<number, string> = {
      0: 'Adventurer',
      1: 'Agent',
      2: 'Bureaucrat',
      3: 'Doctor',
      4: 'Enforcer',
      5: 'Engineer',
      6: 'Fixer',
      7: 'Keeper',
      8: 'Martial Artist',
      9: 'Meta-Physicist',
      10: 'Nano-Technician',
      11: 'Soldier',
      12: 'Trader',
      13: 'Shade'
    }
    return professions[id] || 'Unknown'
  }),
  getBreedName: vi.fn((id: number) => {
    const breeds: Record<number, string> = {
      0: 'Solitus',
      1: 'Opifex',
      2: 'Nanomage',
      3: 'Atrox'
    }
    return breeds[id] || 'Unknown'
  })
}))

vi.mock('@/lib/tinkerprofiles/ip-calculator', () => ({
  getBreedInitValue: vi.fn(() => 6)
}))

vi.mock('@/services/skill-service', () => ({
  skillService: {
    getShortName: vi.fn((id: number) => {
      const names: Record<number, string> = {
        16: 'STR',
        17: 'AGI',
        18: 'STA',
        19: 'INT',
        20: 'SEN',
        21: 'PSY'
      }
      return names[id] || 'UNK'
    })
  }
}))

// Mock profile data
const mockProfile: TinkerProfile = {
  id: 'profile_123',
  version: '4.0.0',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-15T12:00:00Z',
  Character: {
    Name: 'TestCharacter',
    Level: 200,
    Profession: 3, // Doctor
    Breed: 3, // Atrox
    Faction: 'Clan',
    Expansion: 'Lost Eden',
    AccountType: 'Paid',
    MaxHealth: 15000,
    MaxNano: 8500
  },
  skills: {
    16: { base: 100, trickle: 20, equipment: 50, total: 170 }, // Strength
    17: { base: 120, trickle: 15, equipment: 40, total: 175 }, // Agility
    18: { base: 150, trickle: 25, equipment: 60, total: 235 }, // Stamina
    19: { base: 200, trickle: 30, equipment: 70, total: 300 }, // Intelligence
    20: { base: 110, trickle: 18, equipment: 45, total: 173 }, // Sense
    21: { base: 180, trickle: 22, equipment: 55, total: 257 }  // Psychic
  }
}

const mockLowLevelProfile: TinkerProfile = {
  ...mockProfile,
  Character: {
    ...mockProfile.Character,
    Level: 50,
    MaxHealth: 2500,
    MaxNano: 1200
  }
}

describe('CharacterInfoPanel', () => {
  let wrapper: any

  beforeEach(() => {
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    standardCleanup()
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Rendering', () => {
    it('should mount without errors', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should display character information title', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Character Information')
    })

    it('should display level information', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Level')
      expect(wrapper.text()).toContain('200')
    })

    it('should display title level', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('TL6')
      expect(wrapper.text()).toContain('Master')
    })
  })

  describe('Title Level Display', () => {
    it('should show correct title level for level 200', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('TL6')
    })

    it('should show correct title level description', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Master (200-219)')
    })

    it('should calculate title level for lower levels', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockLowLevelProfile
        }
      })

      expect(wrapper.text()).toContain('TL3')
      expect(wrapper.text()).toContain('Apprentice')
    })
  })

  describe('Health and Nano Display', () => {
    it('should display health value', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Health')
      expect(wrapper.text()).toContain('15.0K')
    })

    it('should display nano value', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Nano')
      expect(wrapper.text()).toContain('8.5K')
    })

    it('should format large health values', () => {
      const highHealthProfile = {
        ...mockProfile,
        Character: {
          ...mockProfile.Character,
          MaxHealth: 2500000
        }
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: highHealthProfile
        }
      })

      expect(wrapper.text()).toContain('2.5M')
    })

    it('should format small health values without suffix', () => {
      const lowHealthProfile = {
        ...mockProfile,
        Character: {
          ...mockProfile.Character,
          MaxHealth: 500
        }
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: lowHealthProfile
        }
      })

      expect(wrapper.text()).toContain('500')
    })

    it('should handle missing health value', () => {
      const noHealthProfile = {
        ...mockProfile,
        Character: {
          ...mockProfile.Character,
          MaxHealth: undefined
        }
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: noHealthProfile
        }
      })

      expect(wrapper.text()).toContain('0')
    })
  })

  describe('Character Details Display', () => {
    it('should display profession', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Profession')
      expect(wrapper.text()).toContain('Doctor')
    })

    it('should display breed', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Breed')
      expect(wrapper.text()).toContain('Atrox')
    })

    it('should display faction', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Faction')
      expect(wrapper.text()).toContain('Clan')
    })

    it('should display expansion', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Expansion')
      expect(wrapper.text()).toContain('Lost Eden')
    })

    it('should display account type', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Account Type')
      expect(wrapper.text()).toContain('Paid')
    })
  })

  describe('Breed Color Indicators', () => {
    it('should show red indicator for Atrox', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      const breedIndicator = wrapper.find('.text-red-500')
      expect(breedIndicator.exists()).toBe(true)
    })

    it('should show appropriate color for each breed', () => {
      const solitusProfile = {
        ...mockProfile,
        Character: {
          ...mockProfile.Character,
          Breed: 0 // Solitus
        }
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: solitusProfile
        }
      })

      const breedIndicator = wrapper.find('.text-blue-500')
      expect(breedIndicator.exists()).toBe(true)
    })
  })

  describe('Faction Color Indicators', () => {
    it('should show orange indicator for Clan', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      const factionIndicator = wrapper.find('.text-orange-500')
      expect(factionIndicator.exists()).toBe(true)
    })

    it('should show blue indicator for Omni', () => {
      const omniProfile = {
        ...mockProfile,
        Character: {
          ...mockProfile.Character,
          Faction: 'Omni'
        }
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: omniProfile
        }
      })

      const factionIndicator = wrapper.find('.text-blue-500')
      expect(factionIndicator.exists()).toBe(true)
    })
  })

  describe('Core Attributes Display', () => {
    it('should display all six attributes', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Core Attributes')
      expect(wrapper.text()).toContain('STR')
      expect(wrapper.text()).toContain('AGI')
      expect(wrapper.text()).toContain('STA')
      expect(wrapper.text()).toContain('INT')
      expect(wrapper.text()).toContain('SEN')
      expect(wrapper.text()).toContain('PSY')
    })

    it('should display attribute values', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      // Should show total values
      expect(wrapper.text()).toContain('170') // STR total
      expect(wrapper.text()).toContain('175') // AGI total
      expect(wrapper.text()).toContain('300') // INT total
    })

    it('should display breed base values', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Base: 6')
    })

    it('should display trickle-down bonuses', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      // Should show trickle values
      expect(wrapper.text()).toContain('(+20)') // STR trickle
      expect(wrapper.text()).toContain('(+30)') // INT trickle
    })

    it('should handle missing skills data gracefully', () => {
      const noSkillsProfile = {
        ...mockProfile,
        skills: {}
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: noSkillsProfile
        }
      })

      expect(wrapper.text()).toContain('Core Attributes')
      expect(wrapper.text()).toContain('0') // Should show 0 for missing values
    })
  })

  describe('Profile Metadata Display', () => {
    it('should display profile ID', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Profile ID')
      expect(wrapper.text()).toContain('profile_') // First 8 chars of 'profile_123'
    })

    it('should display profile version', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Version')
      expect(wrapper.text()).toContain('4.0.0')
    })

    it('should display created date', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Created')
      // Should contain date representation
      expect(wrapper.text()).toMatch(/Jan|01|2024/)
    })

    it('should display updated date', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      expect(wrapper.text()).toContain('Updated')
      // Should contain date representation
      expect(wrapper.text()).toMatch(/Jan|15|2024/)
    })
  })

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      // Should use locale-specific short date format
      const dateText = wrapper.text()
      expect(dateText).toMatch(/\d{1,2}/)
    })

    it('should handle invalid dates gracefully', () => {
      const invalidDateProfile = {
        ...mockProfile,
        created: 'invalid-date',
        updated: 'invalid-date'
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: invalidDateProfile
        }
      })

      expect(wrapper.text()).toContain('Unknown')
    })
  })

  describe('Visual Styling', () => {
    it('should have character-info-panel class', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      const panel = wrapper.find('.character-info-panel')
      expect(panel.exists()).toBe(true)
    })

    it('should use proper background colors', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      const healthCard = wrapper.find('.bg-red-50')
      expect(healthCard.exists()).toBe(true)

      const nanoCard = wrapper.find('.bg-blue-50')
      expect(nanoCard.exists()).toBe(true)
    })

    it('should display badges with appropriate severity', () => {
      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: mockProfile
        }
      })

      const badge = wrapper.findComponent({ name: 'Badge' })
      expect(badge.exists()).toBe(true)
      expect(badge.props('value')).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing Character data', () => {
      const noCharacterProfile = {
        ...mockProfile,
        Character: undefined
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: noCharacterProfile
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Character Information')
    })

    it('should use default values for missing fields', () => {
      const minimalProfile = {
        id: 'test',
        version: '4.0.0',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        Character: {},
        skills: {}
      }

      wrapper = mountWithContext(CharacterInfoPanel, {
        props: {
          profile: minimalProfile
        }
      })

      expect(wrapper.text()).toContain('1') // Default level
      expect(wrapper.text()).toContain('0') // Default health/nano
    })
  })
})
