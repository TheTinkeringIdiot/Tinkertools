/**
 * Tests for TinkerProfiles Store Buff Management
 *
 * Tests buff management methods: castBuff, removeBuff, removeAllBuffs,
 * NCU validation logic, NanoStrain conflict resolution, and stacking order logic.
 * Validates edge cases: negative bonuses, multiple conflicts, NCU overflow scenarios.
 *
 * Performance Requirements: <50ms for buff calculations, reactive updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Item } from '../../types/api'
import { useTinkerProfilesStore } from '../tinkerProfiles'
import { skillService } from '../../services/skill-service'

// Mock the TinkerProfiles library
vi.mock('@/lib/tinkerprofiles', () => ({
  TinkerProfilesManager: vi.fn().mockImplementation(() => ({
    createProfile: vi.fn().mockResolvedValue('test-profile-id'),
    loadProfile: vi.fn().mockResolvedValue({
      id: 'test-profile-id',
      Character: {
        Name: 'Test Character',
        Level: 200,
        Profession: 'Soldier',
        Breed: 'Solitus',
        Faction: 'Clan'
      },
      skills: {
        [skillService.resolveId('Max NCU')]: {
          value: 1200,
          baseSkillValue: 1200,
          total: 1200,
          trickleDown: 0,
          pointFromIp: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0
        }
      },
      buffs: []
    }),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
    setActiveProfile: vi.fn().mockResolvedValue(undefined),
    getActiveProfile: vi.fn().mockResolvedValue(null),
    getProfileMetadata: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
    exportProfile: vi.fn().mockResolvedValue('{}'),
    importProfile: vi.fn().mockResolvedValue({ success: true, profile: null, errors: [], warnings: [] }),
    validateProfile: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    searchProfiles: vi.fn().mockResolvedValue([]),
    getAsNanoCompatible: vi.fn().mockResolvedValue({}),
    createFromNanoCompatible: vi.fn().mockResolvedValue('new-profile-id'),
    getStorageStats: vi.fn().mockReturnValue({ used: 0, total: 1000, profiles: 0 }),
    clearAllData: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock the IP integrator
vi.mock('@/lib/tinkerprofiles/ip-integrator', () => ({
  updateProfileWithIPTracking: vi.fn().mockImplementation((profile) => {
    // Return profile with buffBonus calculated in skills
    const updatedProfile = {
      ...profile,
      skills: {
        ...profile.skills,
        // Mock Assault Rifle skill updates
        [17]: { // Assault Rifle skill ID
          value: 100,
          baseSkillValue: 5,
          total: 100,
          trickleDown: 0,
          pointFromIp: 95,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: profile.buffs?.reduce((total: number, buff: Item) => {
            const arBonus = buff.spell_data?.find(sd => sd.event === 1)?.spells
              ?.find(spell => spell.spell_params?.Stat === 17)?.spell_params?.Amount || 0
            return total + arBonus
          }, 0) || 0
        }
      }
    }
    return Promise.resolve(updatedProfile)
  })
}))

// Mock PrimeVue toast
const mockToast = {
  add: vi.fn()
}
vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast
}))

// Mock nano compatibility utility
vi.mock('@/utils/nano-compatibility', () => ({
  nanoCompatibility: {
    checkRequirements: vi.fn().mockReturnValue({ canUse: true, reasons: [] })
  }
}))

describe('TinkerProfiles Store - Buff Management', () => {
  let store: ReturnType<typeof useTinkerProfilesStore>
  let pinia: any

  beforeEach(async () => {
    // Create fresh Pinia instance
    pinia = createPinia()
    setActivePinia(pinia)

    // Create store instance
    store = useTinkerProfilesStore()

    // Clear all mocks
    vi.clearAllMocks()
    mockToast.add.mockClear()

    // Set up a mock active profile with Computer Literacy skill
    // Use type assertion to bypass readonly restrictions in tests
    ;(store as any).activeProfile = {
      id: 'test-profile-id',
      Character: {
        Name: 'Test Character',
        Level: 200,
        Profession: 'Soldier',
        Breed: 'Solitus',
        Faction: 'Clan'
      },
      skills: {
        [skillService.resolveId('Max NCU')]: {
          value: 1200,
          baseSkillValue: 1200,
          total: 1200,
          trickleDown: 0,
          pointFromIp: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0
        }
      },
      buffs: []
    }

    ;(store as any).activeProfileId = 'test-profile-id'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // Test Data Factories
  // ==========================================================================

  const createNanoItem = (
    name: string,
    aoid: number,
    ncuCost: number = 25,
    nanoStrain: number = 100,
    stackingOrder: number = 1000,
    statBonuses: Array<{ statId: number; amount: number }> = []
  ): Item => ({
    id: Math.floor(Math.random() * 10000),
    aoid,
    name,
    ql: 200,
    description: `Test nano: ${name}`,
    item_class: 1,
    is_nano: true,
    stats: [
      { id: 1, stat: 54, value: ncuCost }, // NCU cost
      { id: 2, stat: 75, value: nanoStrain }, // NanoStrain
      { id: 3, stat: 551, value: stackingOrder } // StackingOrder
    ],
    spell_data: statBonuses.length > 0 ? [{
      id: 1,
      event: 1, // Cast event
      spells: statBonuses.map((bonus, index) => ({
        id: index + 1,
        spell_id: 53045,
        spell_params: {
          Stat: bonus.statId,
          Amount: bonus.amount
        },
        criteria: []
      }))
    }] : [],
    actions: [],
    attack_stats: [],
    defense_stats: []
  })

  // ==========================================================================
  // NCU Tracking Tests
  // ==========================================================================

  describe('NCU Tracking', () => {
    it('should calculate current NCU from active buffs', () => {
      const nano1 = createNanoItem('Nano 1', 1001, 25) // 25 NCU
      const nano2 = createNanoItem('Nano 2', 1002, 50) // 50 NCU

      ;(store.activeProfile as any).buffs = [nano1, nano2]

      expect(store.currentNCU).toBe(75) // 25 + 50
    })

    it('should get MaxNCU from Computer Literacy skill', () => {
      expect(store.maxNCU).toBe(1200) // From mock profile setup
    })

    it('should calculate available NCU correctly', () => {
      const nano1 = createNanoItem('Nano 1', 1001, 300) // 300 NCU

      ;(store.activeProfile as any).buffs = [nano1]

      expect(store.currentNCU).toBe(300)
      expect(store.maxNCU).toBe(1200)
      expect(store.availableNCU).toBe(900) // 1200 - 300
    })

    it('should handle zero NCU when no buffs active', () => {
      ;(store.activeProfile as any).buffs = []

      expect(store.currentNCU).toBe(0)
      expect(store.availableNCU).toBe(1200) // Full MaxNCU available
    })

    it('should handle negative available NCU gracefully', () => {
      const highNCUNano = createNanoItem('High NCU Nano', 1001, 1500) // Over MaxNCU

      ;(store.activeProfile as any).buffs = [highNCUNano]

      expect(store.currentNCU).toBe(1500)
      expect(store.availableNCU).toBe(0) // Math.max(0, 1200 - 1500) = 0
    })

    it('should return zero NCU values when no active profile', () => {
      ;(store as any).activeProfile = null

      expect(store.currentNCU).toBe(0)
      expect(store.maxNCU).toBe(0)
      expect(store.availableNCU).toBe(0)
    })
  })

  // ==========================================================================
  // Buff Validation Tests
  // ==========================================================================

  describe('Buff Validation', () => {
    it('should validate nano items can be cast as buffs', () => {
      const validNano = createNanoItem('Valid Nano', 1001, 100)

      expect(store.canCastBuff(validNano)).toBe(true)
    })

    it('should reject non-nano items', () => {
      const regularItem = createNanoItem('Regular Item', 1001, 100)
      regularItem.is_nano = false

      expect(store.canCastBuff(regularItem)).toBe(false)
    })

    it('should reject nanos that exceed NCU capacity', () => {
      const highNCUNano = createNanoItem('High NCU Nano', 1001, 1300) // Over 1200 MaxNCU

      expect(store.canCastBuff(highNCUNano)).toBe(false)
    })

    it('should reject nanos when no active profile', () => {
      ;(store as any).activeProfile = null
      const nano = createNanoItem('Test Nano', 1001, 100)

      expect(store.canCastBuff(nano)).toBe(false)
    })

    it('should consider existing NCU usage when validating', () => {
      const existingNano = createNanoItem('Existing Nano', 1001, 1000) // Uses 1000 NCU
      const newNano = createNanoItem('New Nano', 1002, 300) // Needs 300 NCU

      ;(store.activeProfile as any).buffs = [existingNano]

      // Only 200 NCU available (1200 - 1000), so 300 NCU nano should fail
      expect(store.canCastBuff(newNano)).toBe(false)
    })
  })

  // ==========================================================================
  // NanoStrain Conflict Detection Tests
  // ==========================================================================

  describe('NanoStrain Conflict Detection', () => {
    it('should detect no conflicts when NanoStrains differ', () => {
      const existingNano = createNanoItem('Existing Nano', 1001, 25, 100) // NanoStrain 100
      const newNano = createNanoItem('New Nano', 1002, 25, 200) // NanoStrain 200

      ;(store.activeProfile as any).buffs = [existingNano]

      const conflicts = store.getBuffConflicts(newNano)
      expect(conflicts).toEqual([])
    })

    it('should detect conflicts when NanoStrains match', () => {
      const existingNano = createNanoItem('Existing Nano', 1001, 25, 100) // NanoStrain 100
      const newNano = createNanoItem('New Nano', 1002, 25, 100) // Same NanoStrain 100

      ;(store.activeProfile as any).buffs = [existingNano]

      const conflicts = store.getBuffConflicts(newNano)
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].id).toBe(existingNano.id)
    })

    it('should handle multiple conflicting buffs', () => {
      const existingNano1 = createNanoItem('Existing Nano 1', 1001, 25, 100) // NanoStrain 100
      const existingNano2 = createNanoItem('Existing Nano 2', 1002, 25, 100) // Same NanoStrain 100
      const newNano = createNanoItem('New Nano', 1003, 25, 100) // Same NanoStrain 100

      ;(store.activeProfile as any).buffs = [existingNano1, existingNano2]

      const conflicts = store.getBuffConflicts(newNano)
      expect(conflicts).toHaveLength(2)
    })

    it('should return empty array for non-nano items', () => {
      const regularItem = createNanoItem('Regular Item', 1001, 25, 100)
      regularItem.is_nano = false

      const conflicts = store.getBuffConflicts(regularItem)
      expect(conflicts).toEqual([])
    })

    it('should return empty array when no active profile', () => {
      ;(store as any).activeProfile = null
      const nano = createNanoItem('Test Nano', 1001, 25, 100)

      const conflicts = store.getBuffConflicts(nano)
      expect(conflicts).toEqual([])
    })

    it('should handle nanos without NanoStrain stat', () => {
      const nanoWithoutStrain = createNanoItem('No Strain Nano', 1001, 25, 100)
      nanoWithoutStrain.stats = nanoWithoutStrain.stats.filter(stat => stat.stat !== 75) // Remove NanoStrain

      const conflicts = store.getBuffConflicts(nanoWithoutStrain)
      expect(conflicts).toEqual([])
    })
  })

  // ==========================================================================
  // Cast Buff Tests
  // ==========================================================================

  describe('Cast Buff', () => {
    it('should successfully cast a valid buff', async () => {
      const nano = createNanoItem('Test Nano', 1001, 100, 100, 1000, [
        { statId: 17, amount: 10 } // Assault Rifle +10
      ])

      await store.castBuff(nano)

      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(nano.id)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'Buff Cast',
          detail: 'Successfully cast Test Nano'
        })
      )
    })

    it('should reject casting when no active profile', async () => {
      ;(store as any).activeProfile = null
      const nano = createNanoItem('Test Nano', 1001, 100)

      await expect(store.castBuff(nano)).rejects.toThrow('No active profile selected')
    })

    it('should reject non-nano items', async () => {
      const regularItem = createNanoItem('Regular Item', 1001, 100)
      regularItem.is_nano = false

      await expect(store.castBuff(regularItem)).rejects.toThrow('Only nano items can be cast as buffs')
    })

    it('should reject buffs that exceed NCU capacity', async () => {
      const highNCUNano = createNanoItem('High NCU Nano', 1001, 1300) // Over MaxNCU

      await store.castBuff(highNCUNano)

      expect(store.activeProfile.buffs).toHaveLength(0) // Should not be added
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Insufficient NCU',
          detail: expect.stringContaining('Requires 1300 NCU')
        })
      )
    })

    it('should initialize buffs array if it does not exist', async () => {
      ;(store.activeProfile as any).buffs = undefined
      const nano = createNanoItem('Test Nano', 1001, 100)

      await store.castBuff(nano)

      expect(store.activeProfile.buffs).toBeDefined()
      expect(store.activeProfile.buffs).toHaveLength(1)
    })

    it('should handle stacking order conflicts - higher order replaces lower', async () => {
      const lowPriorityNano = createNanoItem('Low Priority', 1001, 50, 100, 500) // Lower StackingOrder
      const highPriorityNano = createNanoItem('High Priority', 1002, 50, 100, 1500) // Higher StackingOrder

      // Cast low priority first
      await store.castBuff(lowPriorityNano)
      expect(store.activeProfile.buffs).toHaveLength(1)

      // Cast high priority - should replace low priority
      await store.castBuff(highPriorityNano)
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(highPriorityNano.id)
    })

    it('should handle stacking order conflicts - equal order replaces existing', async () => {
      const existingNano = createNanoItem('Existing', 1001, 50, 100, 1000) // Same StackingOrder
      const newNano = createNanoItem('New', 1002, 50, 100, 1000) // Same StackingOrder

      // Cast existing first
      await store.castBuff(existingNano)
      expect(store.activeProfile.buffs).toHaveLength(1)

      // Cast new - should replace existing
      await store.castBuff(newNano)
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(newNano.id)
    })

    it('should reject buff with lower stacking order than existing conflict', async () => {
      const highPriorityNano = createNanoItem('High Priority', 1001, 50, 100, 1500) // Higher StackingOrder
      const lowPriorityNano = createNanoItem('Low Priority', 1002, 50, 100, 500) // Lower StackingOrder

      // Cast high priority first
      await store.castBuff(highPriorityNano)
      expect(store.activeProfile.buffs).toHaveLength(1)

      // Try to cast low priority - should be rejected
      await store.castBuff(lowPriorityNano)
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(highPriorityNano.id) // Original still there
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Buff Conflict',
          detail: expect.stringContaining('higher stacking priority')
        })
      )
    })

    it('should handle multiple conflicts correctly', async () => {
      const conflict1 = createNanoItem('Conflict 1', 1001, 25, 100, 500) // Low priority
      const conflict2 = createNanoItem('Conflict 2', 1002, 25, 100, 600) // Medium priority
      const newNano = createNanoItem('New Nano', 1003, 50, 100, 1000) // High priority

      // Cast conflicts first
      await store.castBuff(conflict1)
      await store.castBuff(conflict2) // Should replace conflict1
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(conflict2.id)

      // Cast high priority - should replace conflict2
      await store.castBuff(newNano)
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(newNano.id)
    })

    it('should handle nanos without stacking order stat', async () => {
      const nanoWithoutStacking = createNanoItem('No Stacking', 1001, 25, 100, 1000)
      nanoWithoutStacking.stats = nanoWithoutStacking.stats.filter(stat => stat.stat !== 551) // Remove StackingOrder

      const conflictNano = createNanoItem('Conflict', 1002, 25, 100, 1000)

      // Cast first nano
      await store.castBuff(nanoWithoutStacking)
      expect(store.activeProfile.buffs).toHaveLength(1)

      // Cast conflicting nano - should treat missing StackingOrder as 0
      await store.castBuff(conflictNano)
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(conflictNano.id) // Should replace (1000 > 0)
    })

    it('should trigger recalculation after casting buff', async () => {
      const nano = createNanoItem('Test Nano', 1001, 100, 100, 1000, [
        { statId: 17, amount: 15 } // Assault Rifle +15
      ])

      await store.castBuff(nano)

      // Verify the mock IP integrator was called
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator')
      expect(updateProfileWithIPTracking).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Remove Buff Tests
  // ==========================================================================

  describe('Remove Buff', () => {
    it('should successfully remove a specific buff', async () => {
      const nano1 = createNanoItem('Nano 1', 1001, 50)
      const nano2 = createNanoItem('Nano 2', 1002, 75)

      ;(store.activeProfile as any).buffs = [nano1, nano2]

      await store.removeBuff(nano1.id)

      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(nano2.id)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'Buff Removed',
          detail: 'Removed Nano 1'
        })
      )
    })

    it('should handle removing non-existent buff gracefully', async () => {
      const nano = createNanoItem('Existing Nano', 1001, 50)
      ;(store.activeProfile as any).buffs = [nano]

      await store.removeBuff(99999) // Non-existent ID

      expect(store.activeProfile.buffs).toHaveLength(1) // Should remain unchanged
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('should handle removing buff when no buffs exist', async () => {
      ;(store.activeProfile as any).buffs = []

      await store.removeBuff(12345)

      expect(store.activeProfile.buffs).toHaveLength(0)
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('should handle removing buff when no active profile', async () => {
      ;(store as any).activeProfile = null

      await store.removeBuff(12345)

      // Should not throw error, just return silently
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('should handle removing buff when buffs array is undefined', async () => {
      ;(store.activeProfile as any).buffs = undefined

      await store.removeBuff(12345)

      // Should not throw error, just return silently
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('should trigger recalculation after removing buff', async () => {
      const nano = createNanoItem('Test Nano', 1001, 50)
      ;(store.activeProfile as any).buffs = [nano]

      await store.removeBuff(nano.id)

      // Verify the mock IP integrator was called
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator')
      expect(updateProfileWithIPTracking).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Remove All Buffs Tests
  // ==========================================================================

  describe('Remove All Buffs', () => {
    it('should successfully remove all buffs', async () => {
      const nano1 = createNanoItem('Nano 1', 1001, 50)
      const nano2 = createNanoItem('Nano 2', 1002, 75)
      const nano3 = createNanoItem('Nano 3', 1003, 25)

      ;(store.activeProfile as any).buffs = [nano1, nano2, nano3]

      await store.removeAllBuffs()

      expect(store.activeProfile.buffs).toHaveLength(0)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'All Buffs Removed',
          detail: 'Removed 3 buffs'
        })
      )
    })

    it('should handle singular buff count in message', async () => {
      const nano = createNanoItem('Single Nano', 1001, 50)
      ;(store.activeProfile as any).buffs = [nano]

      await store.removeAllBuffs()

      expect(store.activeProfile.buffs).toHaveLength(0)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'All Buffs Removed',
          detail: 'Removed 1 buff' // Singular form
        })
      )
    })

    it('should handle removing all when no buffs exist', async () => {
      ;(store.activeProfile as any).buffs = []

      await store.removeAllBuffs()

      expect(store.activeProfile.buffs).toHaveLength(0)
      expect(mockToast.add).not.toHaveBeenCalled() // Should not show toast
    })

    it('should handle removing all when no active profile', async () => {
      ;(store as any).activeProfile = null

      await store.removeAllBuffs()

      // Should not throw error, just return silently
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('should handle removing all when buffs array is undefined', async () => {
      ;(store.activeProfile as any).buffs = undefined

      await store.removeAllBuffs()

      // Should not throw error, just return silently
      expect(mockToast.add).not.toHaveBeenCalled()
    })

    it('should trigger recalculation after removing all buffs', async () => {
      const nano1 = createNanoItem('Nano 1', 1001, 50)
      const nano2 = createNanoItem('Nano 2', 1002, 75)
      ;(store.activeProfile as any).buffs = [nano1, nano2]

      await store.removeAllBuffs()

      // Verify the mock IP integrator was called
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator')
      expect(updateProfileWithIPTracking).toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Edge Cases and Error Handling
  // ==========================================================================

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      // Spy on console methods to verify error handling
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('should handle casting buff with missing stats gracefully', async () => {
      const nanoWithoutStats = createNanoItem('No Stats Nano', 1001, 0)
      nanoWithoutStats.stats = [] // Remove all stats

      await store.castBuff(nanoWithoutStats)

      // Should treat missing NCU stat as 0 cost
      expect(store.activeProfile.buffs).toHaveLength(1)
    })

    it('should handle negative NCU costs', async () => {
      const negativeNCUNano = createNanoItem('Negative NCU', 1001, -50) // Negative NCU

      await store.castBuff(negativeNCUNano)

      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.currentNCU).toBe(-50) // Should handle negative values
    })

    it('should handle very large NCU costs', async () => {
      const massiveNCUNano = createNanoItem('Massive NCU', 1001, 999999)

      await store.castBuff(massiveNCUNano)

      expect(store.activeProfile.buffs).toHaveLength(0)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Insufficient NCU'
        })
      )
    })

    it('should handle nanos with corrupted spell data', async () => {
      const corruptedNano = createNanoItem('Corrupted Nano', 1001, 50)
      corruptedNano.spell_data = [{ corrupted: 'data' } as any]

      await store.castBuff(corruptedNano)

      expect(store.activeProfile.buffs).toHaveLength(1) // Should still add the nano
    })

    it('should handle extreme stacking order values', async () => {
      const extremeStackingNano = createNanoItem('Extreme Stacking', 1001, 50, 100, Number.MAX_SAFE_INTEGER)

      await store.castBuff(extremeStackingNano)

      expect(store.activeProfile.buffs).toHaveLength(1)
    })

    it('should handle casting same nano multiple times', async () => {
      const nano = createNanoItem('Same Nano', 1001, 50, 100, 1000)

      await store.castBuff(nano)
      expect(store.activeProfile.buffs).toHaveLength(1)

      // Try to cast same nano again
      await store.castBuff(nano)
      expect(store.activeProfile.buffs).toHaveLength(1) // Should still be 1 (replaced itself)
    })

    it('should handle removing buffs during cast operation', async () => {
      const nano1 = createNanoItem('Nano 1', 1001, 50, 100, 1000)
      const nano2 = createNanoItem('Nano 2', 1002, 50, 100, 1500) // Higher priority

      // Cast first nano
      await store.castBuff(nano1)
      expect(store.activeProfile.buffs).toHaveLength(1)

      // Simulate concurrent removal and cast
      const removalPromise = store.removeBuff(nano1.id)
      const castPromise = store.castBuff(nano2)

      await Promise.all([removalPromise, castPromise])

      // Should handle both operations correctly
      expect(store.activeProfile.buffs).toHaveLength(1)
      expect(store.activeProfile.buffs[0].id).toBe(nano2.id)
    })

    it('should handle rapid successive buff operations', async () => {
      const nanos = Array.from({ length: 10 }, (_, i) =>
        createNanoItem(`Rapid Nano ${i}`, 1000 + i, 10, 100 + i, 1000)
      )

      // Cast all nanos rapidly
      const promises = nanos.map(nano => store.castBuff(nano))
      await Promise.all(promises)

      // All should be cast since they have different NanoStrains
      expect(store.activeProfile.buffs).toHaveLength(10)
      expect(store.currentNCU).toBe(100) // 10 nanos × 10 NCU each
    })

    it('should maintain performance under load', async () => {
      const manyNanos = Array.from({ length: 50 }, (_, i) =>
        createNanoItem(`Load Test Nano ${i}`, 2000 + i, 5, 200 + i, 1000)
      )

      const startTime = performance.now()

      // Cast all nanos
      for (const nano of manyNanos) {
        await store.castBuff(nano)
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // Should complete within reasonable time (performance requirement)
      expect(totalTime).toBeLessThan(1000) // 1 second for 50 operations
      expect(store.activeProfile.buffs).toHaveLength(50)
    })
  })

  // ==========================================================================
  // Integration Tests with NCU Validation
  // ==========================================================================

  describe('Integration Tests with NCU Validation', () => {
    it('should handle complex NCU scenarios with multiple operations', async () => {
      // Set up a profile with limited NCU
      // Set limited NCU (Max NCU = 200) by updating the mock activeProfile directly
      ;(store.activeProfile as any).skills[skillService.resolveId('Max NCU')].value = 200
      ;(store.activeProfile as any).skills[skillService.resolveId('Max NCU')].total = 200

      const nano1 = createNanoItem('Nano 1', 1001, 100) // 100 NCU
      const nano2 = createNanoItem('Nano 2', 1002, 50)  // 50 NCU
      const nano3 = createNanoItem('Nano 3', 1003, 75)  // 75 NCU - should fail

      // Cast first two nanos (should succeed)
      await store.castBuff(nano1)
      await store.castBuff(nano2)

      expect(store.activeProfile.buffs).toHaveLength(2)
      expect(store.currentNCU).toBe(150) // 100 + 50
      expect(store.availableNCU).toBe(50) // 200 - 150

      // Try to cast third nano (should fail due to insufficient NCU)
      await store.castBuff(nano3)

      expect(store.activeProfile.buffs).toHaveLength(2) // Still only 2
      expect(mockToast.add).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Insufficient NCU'
        })
      )

      // Remove one nano to free up NCU
      await store.removeBuff(nano2.id)

      expect(store.currentNCU).toBe(100) // Only nano1 remains
      expect(store.availableNCU).toBe(100) // 200 - 100

      // Now nano3 should succeed
      await store.castBuff(nano3)

      expect(store.activeProfile.buffs).toHaveLength(2) // nano1 + nano3
      expect(store.currentNCU).toBe(175) // 100 + 75
    })

    it('should handle equipment changes affecting MaxNCU', async () => {
      // Start with buffs using most of the NCU
      const nano1 = createNanoItem('Nano 1', 1001, 600)
      const nano2 = createNanoItem('Nano 2', 1002, 500)

      await store.castBuff(nano1)
      await store.castBuff(nano2)

      expect(store.currentNCU).toBe(1100) // 600 + 500
      expect(store.availableNCU).toBe(100) // 1200 - 1100

      // Simulate equipment change reducing MaxNCU
      ;(store.activeProfile as any).skills[skillService.resolveId('Max NCU')].value = 800
      ;(store.activeProfile as any).skills[skillService.resolveId('Max NCU')].total = 800

      expect(store.maxNCU).toBe(800)
      expect(store.availableNCU).toBe(0) // Math.max(0, 800 - 1100) = 0

      // Existing buffs should remain (as per requirements)
      expect(store.activeProfile.buffs).toHaveLength(2)

      // But new buffs should be rejected
      const newNano = createNanoItem('New Nano', 1003, 50)
      await store.castBuff(newNano)

      expect(store.activeProfile.buffs).toHaveLength(2) // Still only 2
      expect(mockToast.add).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Insufficient NCU'
        })
      )
    })

    it('should handle zero MaxNCU gracefully', async () => {
      // Set zero NCU (Max NCU = 0)
      ;(store.activeProfile as any).skills[skillService.resolveId('Max NCU')].value = 0
      ;(store.activeProfile as any).skills[skillService.resolveId('Max NCU')].total = 0

      const nano = createNanoItem('Test Nano', 1001, 1) // Even 1 NCU should fail

      expect(store.maxNCU).toBe(0)
      expect(store.availableNCU).toBe(0)
      expect(store.canCastBuff(nano)).toBe(false)

      await store.castBuff(nano)

      expect(store.activeProfile.buffs).toHaveLength(0)
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Insufficient NCU'
        })
      )
    })
  })
})