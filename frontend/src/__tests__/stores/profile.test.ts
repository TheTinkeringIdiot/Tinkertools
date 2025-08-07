/**
 * Profile Store Tests
 * 
 * Tests for the profile and LocalStorage management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProfileStore } from '../../stores/profile'
import type { TinkerProfile, UserPreferences, CollectionTracking } from '../../types/api'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock data
const mockProfile: TinkerProfile = {
  Character: {
    Name: 'TestChar',
    Level: 200,
    Profession: 'Doctor',
    Breed: 'Atrox',
    Faction: 'Clan',
    Expansion: 'Shadowlands',
    AccountType: 'Premium'
  },
  Skills: {
    Attributes: {
      Intelligence: 500,
      Psychic: 400,
      Sense: 300,
      Stamina: 600,
      Strength: 200,
      Agility: 350
    },
    'Body & Defense': {
      'Max Nano': 2500,
      'Nano Pool': 2500,
      'Nano Resist': 800,
      'Max Health': 4000,
      'Body Dev.': 1000,
      'Dodge-Rng': 600,
      'Duck-Exp': 650,
      'Evade-ClsC': 550,
      'Deflect': 500
    },
    ACs: {
      'Imp/Proj AC': 1200,
      'Energy AC': 1000,
      'Melee/ma AC': 1100,
      'Fire AC': 900,
      'Cold AC': 950,
      'Chemical AC': 800,
      'Radiation AC': 850,
      'Disease AC': 750
    },
    'Ranged Weapons': {},
    'Ranged Specials': {},
    'Melee Weapons': {},
    'Melee Specials': {},
    'Nanos & Casting': {
      'Matter Crea': 1000,
      'NanoC. Init.': 800,
      'Psycho Modi': 900,
      'Sensory Impr': 750,
      'Time&Space': 850,
      'Bio Metamor': 950,
      'Matt. Metam': 800
    },
    Exploring: {},
    'Trade & Repair': {},
    'Combat & Healing': {},
    Misc: {}
  },
  Weapons: {
    HUD1: null,
    HUD2: null,
    HUD3: null,
    UTILS1: null,
    UTILS2: null,
    UTILS3: null,
    RHand: null,
    Waist: null,
    LHand: null,
    NCU1: null,
    NCU2: null,
    NCU3: null,
    NCU4: null,
    NCU5: null,
    NCU6: null
  },
  Clothing: {
    Head: null,
    Back: null,
    Body: null,
    RightArm: null,
    LeftArm: null,
    RightWrist: null,
    LeftWrist: null,
    Hands: null,
    Legs: null,
    Feet: null,
    RightShoulder: null,
    LeftShoulder: null,
    RightFinger: null,
    LeftFinger: null,
    Neck: null,
    Belt: null
  },
  Implants: {
    Head: null,
    Eye: null,
    Ear: null,
    Chest: null,
    RightArm: null,
    LeftArm: null,
    Waist: null,
    RightWrist: null,
    LeftWrist: null,
    Leg: null,
    RightHand: null,
    LeftHand: null,
    Feet: null
  },
  PerksAndResearch: []
}

describe('Profile Store', () => {
  let store: ReturnType<typeof useProfileStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    store = useProfileStore()
  })

  afterEach(() => {
    mockLocalStorage.clear()
  })

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      expect(store.allProfiles).toEqual([])
      expect(store.currentProfile).toBe(null)
      expect(store.hasCurrentProfile).toBe(false)
      expect(store.currentCharacterName).toBe('')
      expect(store.currentCharacterLevel).toBe(1)
    })

    it('should have default preferences', () => {
      expect(store.preferences.theme).toBe('light')
      expect(store.preferences.itemsPerPage).toBe(25)
      expect(store.preferences.favoriteItems).toEqual([])
    })

    it('should have empty collection tracking', () => {
      expect(store.collection.symbiants.collected).toEqual([])
      expect(store.collection.symbiants.wishlist).toEqual([])
      expect(Object.keys(store.collection.symbiants.notes)).toHaveLength(0)
    })
  })

  describe('Profile Management', () => {
    it('should create a new profile', () => {
      const profileId = store.createProfile('TestCharacter')
      
      expect(profileId).toBeTruthy()
      expect(store.allProfiles).toHaveLength(1)
      expect(store.allProfiles[0].Character.Name).toBe('TestCharacter')
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should set current profile', () => {
      const profileId = store.createProfile('TestCharacter')
      const success = store.setCurrentProfile(profileId)
      
      expect(success).toBe(true)
      expect(store.currentProfile?.Character.Name).toBe('TestCharacter')
      expect(store.hasCurrentProfile).toBe(true)
      expect(store.currentCharacterName).toBe('TestCharacter')
    })

    it('should not set invalid profile as current', () => {
      const success = store.setCurrentProfile('invalid-id')
      
      expect(success).toBe(false)
      expect(store.currentProfile).toBe(null)
    })

    it('should update current profile', () => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
      
      const updates = {
        Character: {
          ...store.currentProfile!.Character,
          Level: 220,
          Profession: 'Engineer'
        }
      }
      
      store.updateCurrentProfile(updates)
      
      expect(store.currentProfile!.Character.Level).toBe(220)
      expect(store.currentProfile!.Character.Profession).toBe('Engineer')
    })

    it('should delete profile', () => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
      
      store.deleteProfile(profileId)
      
      expect(store.allProfiles).toHaveLength(0)
      expect(store.currentProfile).toBe(null)
    })

    it('should import profile', () => {
      const importedId = store.importProfile(mockProfile)
      
      expect(importedId).toBeTruthy()
      expect(store.allProfiles).toHaveLength(1)
      expect(store.allProfiles[0].Character.Name).toBe('TestChar')
      expect(store.allProfiles[0].Character.Level).toBe(200)
    })

    it('should export current profile', () => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
      store.updateCurrentProfile(mockProfile)
      
      const exported = store.exportCurrentProfile()
      
      expect(exported).toEqual(mockProfile)
    })

    it('should return null when exporting with no current profile', () => {
      const exported = store.exportCurrentProfile()
      expect(exported).toBe(null)
    })
  })

  describe('Skills Management', () => {
    beforeEach(() => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
    })

    it('should update skills in category', () => {
      const skillUpdates = {
        Intelligence: 600,
        Strength: 400
      }
      
      store.updateSkills('Attributes', skillUpdates)
      
      expect(store.currentProfile!.Skills.Attributes.Intelligence).toBe(600)
      expect(store.currentProfile!.Skills.Attributes.Strength).toBe(400)
    })

    it('should get skill value', () => {
      store.updateSkills('Attributes', { Intelligence: 500 })
      
      const intValue = store.getSkillValue('Attributes', 'Intelligence')
      const nonExistentValue = store.getSkillValue('Attributes', 'NonExistent')
      
      expect(intValue).toBe(500)
      expect(nonExistentValue).toBe(0)
    })

    it('should return 0 for skill when no current profile', () => {
      // Don't set current profile
      const value = store.getSkillValue('Attributes', 'Intelligence')
      expect(value).toBe(0)
    })
  })

  describe('Equipment Management', () => {
    beforeEach(() => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
    })

    it('should update weapon slot', () => {
      const weapon = { id: 1, name: 'Test Weapon' }
      
      store.updateEquipment('Weapons', 'RHand', weapon)
      
      expect(store.currentProfile!.Weapons.RHand).toEqual(weapon)
    })

    it('should update clothing slot', () => {
      const armor = { id: 2, name: 'Test Armor' }
      
      store.updateEquipment('Clothing', 'Body', armor)
      
      expect(store.currentProfile!.Clothing.Body).toEqual(armor)
    })

    it('should update implant slot', () => {
      const implant = { id: 3, name: 'Test Implant' }
      
      store.updateEquipment('Implants', 'Head', implant)
      
      expect(store.currentProfile!.Implants.Head).toEqual(implant)
    })
  })

  describe('Preferences Management', () => {
    it('should update preferences', () => {
      const updates: Partial<UserPreferences> = {
        theme: 'dark',
        itemsPerPage: 50,
        language: 'es'
      }
      
      store.updatePreferences(updates)
      
      expect(store.preferences.theme).toBe('dark')
      expect(store.preferences.itemsPerPage).toBe(50)
      expect(store.preferences.language).toBe('es')
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('should manage favorite items', () => {
      store.addFavoriteItem(123)
      store.addFavoriteItem(456)
      
      expect(store.preferences.favoriteItems).toContain(123)
      expect(store.preferences.favoriteItems).toContain(456)
      
      store.removeFavoriteItem(123)
      
      expect(store.preferences.favoriteItems).not.toContain(123)
      expect(store.preferences.favoriteItems).toContain(456)
    })

    it('should not add duplicate favorites', () => {
      store.addFavoriteItem(123)
      store.addFavoriteItem(123)
      
      expect(store.preferences.favoriteItems.filter(id => id === 123)).toHaveLength(1)
    })

    it('should manage recent searches', () => {
      store.addRecentSearch('weapon')
      store.addRecentSearch('armor')
      store.addRecentSearch('implant')
      
      expect(store.preferences.recentSearches).toEqual(['implant', 'armor', 'weapon'])
      
      // Add duplicate - should move to front
      store.addRecentSearch('armor')
      
      expect(store.preferences.recentSearches).toEqual(['armor', 'implant', 'weapon'])
    })

    it('should limit recent searches to 10', () => {
      for (let i = 1; i <= 15; i++) {
        store.addRecentSearch(`search${i}`)
      }
      
      expect(store.preferences.recentSearches).toHaveLength(10)
      expect(store.preferences.recentSearches[0]).toBe('search15')
    })
  })

  describe('Collection Tracking', () => {
    it('should add collected symbiant', () => {
      store.addCollectedSymbiant(123)
      
      expect(store.collection.symbiants.collected).toContain(123)
    })

    it('should remove from wishlist when collected', () => {
      store.addToSymbiantWishlist(123)
      expect(store.collection.symbiants.wishlist).toContain(123)
      
      store.addCollectedSymbiant(123)
      
      expect(store.collection.symbiants.collected).toContain(123)
      expect(store.collection.symbiants.wishlist).not.toContain(123)
    })

    it('should manage symbiant wishlist', () => {
      store.addToSymbiantWishlist(456)
      
      expect(store.collection.symbiants.wishlist).toContain(456)
      
      store.removeFromSymbiantWishlist(456)
      
      expect(store.collection.symbiants.wishlist).not.toContain(456)
    })

    it('should not add collected item to wishlist', () => {
      store.addCollectedSymbiant(123)
      store.addToSymbiantWishlist(123)
      
      expect(store.collection.symbiants.wishlist).not.toContain(123)
      expect(store.collection.symbiants.collected).toContain(123)
    })

    it('should manage symbiant notes', () => {
      store.addSymbiantNote(123, 'Great implant for doctors')
      
      expect(store.collection.symbiants.notes[123]).toBe('Great implant for doctors')
      
      store.addSymbiantNote(123, 'Updated note')
      
      expect(store.collection.symbiants.notes[123]).toBe('Updated note')
      
      store.removeSymbiantNote(123)
      
      expect(store.collection.symbiants.notes[123]).toBeUndefined()
    })
  })

  describe('Build Management', () => {
    beforeEach(() => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
    })

    it('should save build', () => {
      const build = {
        name: 'Doctor Build',
        description: 'High-level doctor build',
        profile: mockProfile,
        components: []
      }
      
      const buildId = store.saveBuild(build)
      
      expect(buildId).toBeTruthy()
      expect(store.currentProfileBuilds).toHaveLength(1)
      expect(store.currentProfileBuilds[0].name).toBe('Doctor Build')
    })

    it('should update build', () => {
      const build = {
        name: 'Doctor Build',
        description: 'High-level doctor build',
        profile: mockProfile,
        components: []
      }
      
      const buildId = store.saveBuild(build)
      
      store.updateBuild(buildId, {
        name: 'Updated Doctor Build',
        description: 'Updated description'
      })
      
      const updatedBuild = Array.from(store.builds.values()).find(b => b.id === buildId)
      
      expect(updatedBuild?.name).toBe('Updated Doctor Build')
      expect(updatedBuild?.description).toBe('Updated description')
      expect(updatedBuild?.metadata.updated_at).toBeTruthy()
    })

    it('should delete build', () => {
      const build = {
        name: 'Doctor Build',
        description: 'High-level doctor build',
        profile: mockProfile,
        components: []
      }
      
      const buildId = store.saveBuild(build)
      expect(store.currentProfileBuilds).toHaveLength(1)
      
      store.deleteBuild(buildId)
      
      expect(store.currentProfileBuilds).toHaveLength(0)
    })
  })

  describe('LocalStorage Integration', () => {
    it('should load from localStorage on initialization', () => {
      const storedProfiles = {
        'profile_1': mockProfile
      }
      const storedPreferences = {
        theme: 'dark',
        itemsPerPage: 50,
        favoriteItems: [1, 2, 3],
        recentSearches: ['test'],
        defaultExpansion: ['Shadowlands'],
        language: 'en',
        lastUpdated: '2024-01-01T00:00:00Z'
      }
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(JSON.stringify(storedProfiles)) // profiles
        .mockReturnValueOnce('"profile_1"') // current profile
        .mockReturnValueOnce(JSON.stringify(storedPreferences)) // preferences
        .mockReturnValueOnce('{}') // collection
        .mockReturnValueOnce('{}') // builds
        .mockReturnValueOnce('"1.0.0"') // version
      
      store.loadFromLocalStorage()
      
      expect(store.allProfiles).toHaveLength(1)
      expect(store.currentProfile?.Character.Name).toBe('TestChar')
      expect(store.preferences.theme).toBe('dark')
      expect(store.preferences.favoriteItems).toEqual([1, 2, 3])
    })

    it('should save to localStorage', () => {
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
      
      store.saveToLocalStorage()
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.stringContaining('TestCharacter')
      )
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_current_profile',
        expect.stringContaining(profileId)
      )
    })

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })
      
      // Should not throw
      expect(() => store.loadFromLocalStorage()).not.toThrow()
      expect(store.error).toBeTruthy()
    })

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json')
      
      // Should not throw and should use defaults
      expect(() => store.loadFromLocalStorage()).not.toThrow()
      expect(store.preferences.theme).toBe('light') // Default value
    })
  })

  describe('Data Reset', () => {
    it('should reset all data with confirmation', () => {
      // Mock confirm to return true
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      // Add some data first
      const profileId = store.createProfile('TestCharacter')
      store.setCurrentProfile(profileId)
      store.addFavoriteItem(123)
      store.addCollectedSymbiant(456)
      
      store.resetAllData()
      
      expect(store.allProfiles).toHaveLength(0)
      expect(store.currentProfile).toBe(null)
      expect(store.preferences.favoriteItems).toHaveLength(0)
      expect(store.collection.symbiants.collected).toHaveLength(0)
      expect(mockLocalStorage.removeItem).toHaveBeenCalled()
      
      // Restore confirm
      vi.restoreAllMocks()
    })

    it('should not reset data without confirmation', () => {
      // Mock confirm to return false
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      
      const profileId = store.createProfile('TestCharacter')
      
      store.resetAllData()
      
      // Data should still be there
      expect(store.allProfiles).toHaveLength(1)
      
      // Restore confirm
      vi.restoreAllMocks()
    })
  })

  describe('Error Handling', () => {
    it('should clear error state', () => {
      store.error = 'Test error'
      
      store.clearError()
      
      expect(store.error).toBe(null)
    })
  })
})