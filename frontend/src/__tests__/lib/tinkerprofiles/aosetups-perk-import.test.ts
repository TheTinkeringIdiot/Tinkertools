/**
 * AOSetups Perk Import Tests
 *
 * Tests importing perks from AOSetups profiles
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProfileTransformer } from '@/lib/tinkerprofiles/transformer'
import { apiClient } from '@/services/api-client'

// Mock the API client
vi.mock('@/services/api-client', () => ({
  apiClient: {
    lookupPerkByAoid: vi.fn(),
    getItem: vi.fn(),
    interpolateItem: vi.fn(),
    lookupImplant: vi.fn()
  }
}))

describe('ProfileTransformer - AOSetups Perk Import', () => {
  let transformer: ProfileTransformer

  beforeEach(() => {
    transformer = new ProfileTransformer()
    vi.clearAllMocks()
  })

  it('should import perks from AOSetups profile with AOID lookup', async () => {
    // Mock the Vestiga profile with perks
    const vestigaProfile = {
      perks: [
        { _id: '68c4d5e0b3f11d03a38e6a87', aoid: 260915 },
        { _id: '68c4d5e0b3f11d03a38e6a86', aoid: 260916 }
      ],
      character: {
        name: 'Vestiga',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        skills: []
      },
      implants: [],
      weapons: [],
      clothes: [],
      buffs: [],
      benefits: []
    }

    // Mock perk lookup responses
    vi.mocked(apiClient.lookupPerkByAoid).mockImplementation(async (aoid) => {
      if (aoid === 260915) {
        return {
          id: 1,
          aoid: 260915,
          name: 'Enhanced DNA',
          counter: 3,
          type: 'SL',
          professions: [],
          breeds: [],
          level: 15,
          ai_title: null,
          description: 'Enhances your DNA',
          ql: 1
        }
      } else if (aoid === 260916) {
        return {
          id: 2,
          aoid: 260916,
          name: 'Improved Reflexes 2',
          counter: 2,
          type: 'SL',
          professions: ['Adventurer'],
          breeds: [],
          level: 10,
          ai_title: null,
          description: 'Improves your reflexes',
          ql: 1
        }
      }
      return null
    })

    // Import the profile
    const result = await transformer.importProfile(JSON.stringify(vestigaProfile), 'aosetups')

    // Verify import succeeded
    expect(result.success).toBe(true)
    expect(result.profile).toBeDefined()

    // Check that perk API was called
    expect(apiClient.lookupPerkByAoid).toHaveBeenCalledWith(260915)
    expect(apiClient.lookupPerkByAoid).toHaveBeenCalledWith(260916)

    // Verify perks were imported with correct names and levels
    const perksSystem = result.profile?.PerksAndResearch
    expect(perksSystem).toBeDefined()
    expect(perksSystem?.perks).toHaveLength(2)

    // Check first perk (Enhanced DNA)
    const enhancedDNA = perksSystem?.perks.find(p => p.name === 'Enhanced DNA')
    expect(enhancedDNA).toBeDefined()
    expect(enhancedDNA?.level).toBe(3)
    expect(enhancedDNA?.type).toBe('SL')

    // Check second perk (Improved Reflexes 2) - may or may not have level suffix stripped
    const improvedReflexes = perksSystem?.perks.find(p => p.name.includes('Improved Reflexes'))
    expect(improvedReflexes).toBeDefined()
    expect(improvedReflexes?.level).toBe(2)
    expect(improvedReflexes?.type).toBe('SL')

    // Verify perk points were calculated
    expect(perksSystem?.standardPerkPoints.spent).toBe(5) // 3 + 2 levels
    expect(perksSystem?.standardPerkPoints.total).toBeGreaterThan(0)

    // Check warnings
    expect(result.warnings).toContain('Imported 2 perks from AOSetups format')
  })

  it('should handle missing perks gracefully', async () => {
    const profileWithMissingPerk = {
      perks: [
        { _id: '68c4d5e0b3f11d03a38e6a87', aoid: 999999 } // Non-existent perk
      ],
      character: {
        name: 'TestChar',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        skills: []
      },
      implants: [],
      weapons: [],
      clothes: []
    }

    // Mock perk not found
    vi.mocked(apiClient.lookupPerkByAoid).mockResolvedValue(null)

    const result = await transformer.importProfile(JSON.stringify(profileWithMissingPerk), 'aosetups')

    expect(result.success).toBe(true)
    expect(result.profile).toBeDefined()

    // Should have fallback perk with unknown name
    const perksSystem = result.profile?.PerksAndResearch
    expect(perksSystem?.perks).toHaveLength(1)
    expect(perksSystem?.perks[0].name).toContain('Unknown Perk')
    expect(perksSystem?.perks[0].level).toBe(1)

    // Check warning was added
    expect(result.warnings).toContain('Could not find perk with AOID 999999 in database')
  })

  it('should handle API errors gracefully', async () => {
    const profileWithPerk = {
      perks: [
        { _id: '68c4d5e0b3f11d03a38e6a87', aoid: 260915 }
      ],
      character: {
        name: 'TestChar',
        level: 60,
        profession: 'Adventurer',
        breed: 'Solitus',
        skills: []
      },
      implants: [],
      weapons: [],
      clothes: []
    }

    // Mock API error
    vi.mocked(apiClient.lookupPerkByAoid).mockRejectedValue(new Error('Network error'))

    const result = await transformer.importProfile(JSON.stringify(profileWithPerk), 'aosetups')

    expect(result.success).toBe(true)
    expect(result.profile).toBeDefined()

    // Should have fallback perk
    const perksSystem = result.profile?.PerksAndResearch
    expect(perksSystem?.perks).toHaveLength(1)
    expect(perksSystem?.perks[0].name).toContain('Unknown Perk')

    // Check warning was added
    expect(result.warnings).toContain('Failed to fetch perk details for AOID 260915')
  })

  it('should handle AI perks correctly', async () => {
    const profileWithAIPerk = {
      perks: [
        { _id: '68c4d5e0b3f11d03a38e6a87', aoid: 280000 } // Example AI perk
      ],
      character: {
        name: 'TestChar',
        level: 200,
        profession: 'Adventurer',
        breed: 'Solitus',
        skills: []
      },
      implants: [],
      weapons: [],
      clothes: []
    }

    // Mock AI perk response
    vi.mocked(apiClient.lookupPerkByAoid).mockResolvedValue({
      id: 3,
      aoid: 280000,
      name: 'Alien Enhancement',
      counter: 1,
      type: 'AI',
      professions: [],
      breeds: [],
      level: 200,
      ai_title: 5,
      description: 'Alien technology enhancement',
      ql: 1
    })

    const result = await transformer.importProfile(JSON.stringify(profileWithAIPerk), 'aosetups')

    expect(result.success).toBe(true)

    const perksSystem = result.profile?.PerksAndResearch
    const alienPerk = perksSystem?.perks.find(p => p.name === 'Alien Enhancement')

    expect(alienPerk).toBeDefined()
    expect(alienPerk?.type).toBe('AI')
    expect(alienPerk?.level).toBe(1)

    // Should use AI points, not standard points
    expect(perksSystem?.aiPerkPoints.spent).toBe(1)
    expect(perksSystem?.standardPerkPoints.spent).toBe(0)
  })

  it('should handle LE research perks correctly', async () => {
    const profileWithResearch = {
      perks: [
        { _id: '68c4d5e0b3f11d03a38e6a87', aoid: 290000 } // Example LE research
      ],
      character: {
        name: 'TestChar',
        level: 200,
        profession: 'Adventurer',
        breed: 'Solitus',
        skills: []
      },
      implants: [],
      weapons: [],
      clothes: []
    }

    // Mock LE research response
    vi.mocked(apiClient.lookupPerkByAoid).mockResolvedValue({
      id: 4,
      aoid: 290000,
      name: 'Nano Technology Research',
      counter: 1,
      type: 'LE',
      professions: [],
      breeds: [],
      level: 200,
      ai_title: null,
      description: 'Research into nano technology',
      ql: 1
    })

    const result = await transformer.importProfile(JSON.stringify(profileWithResearch), 'aosetups')

    expect(result.success).toBe(true)

    const perksSystem = result.profile?.PerksAndResearch

    // LE research should be in research array, not perks
    expect(perksSystem?.research).toHaveLength(1)
    expect(perksSystem?.research[0].name).toBe('Nano Technology Research')
    expect(perksSystem?.research[0].type).toBe('LE')
    expect(perksSystem?.research[0].level).toBe(1)

    // Should not cost any points
    expect(perksSystem?.standardPerkPoints.spent).toBe(0)
    expect(perksSystem?.aiPerkPoints.spent).toBe(0)
  })
})