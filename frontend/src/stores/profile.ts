/**
 * Profile Store - Pinia Store for TinkerProfile and User Data Management
 * 
 * Manages character profiles, user preferences, and collection tracking
 * All data stored in LocalStorage following privacy-first approach (REQ-SEC-003)
 * 
 * Enhanced with unified game data utilities for character analysis
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  TinkerProfile,
  UserPreferences,
  CollectionTracking,
  CharacterBuild
} from '../types/api'
import { createDefaultProfile as createTinkerProfile } from '../lib/tinkerprofiles'
import { useGameData, type Character } from '../composables/useGameData'
import { gameUtils } from '../services/game-utils'
import { professionBonuses } from '../utils/profession-bonuses'
import { statCalculations } from '../utils/stat-calculations'

// ============================================================================
// Default Profile Structure
// ============================================================================

const createDefaultProfile = (): TinkerProfile => {
  // Use the TinkerProfiles library to create a proper default profile
  const profile = createTinkerProfile('')
  
  // Clear the name since this is a template
  profile.Character.Name = ''
  
  // Return the profile with the correct structure
  return profile as TinkerProfile
}

const createDefaultPreferences = (): UserPreferences => ({
  theme: 'light',
  language: 'en',
  itemsPerPage: 25,
  defaultExpansion: ['Shadowlands', 'Alien Invasion', 'Lost Eden'],
  favoriteItems: [],
  recentSearches: [],
  lastUpdated: new Date().toISOString()
})

const createDefaultCollection = (): CollectionTracking => ({
  symbiants: {
    collected: [],
    wishlist: [],
    notes: {}
  },
  lastUpdated: new Date().toISOString()
})

// ============================================================================
// LocalStorage Keys
// ============================================================================

const STORAGE_KEYS = {
  PROFILES: 'tinkertools_profiles',
  CURRENT_PROFILE: 'tinkertools_current_profile',
  PREFERENCES: 'tinkertools_preferences',
  COLLECTION: 'tinkertools_collection',
  BUILDS: 'tinkertools_builds',
  VERSION: 'tinkertools_version'
} as const

const CURRENT_VERSION = '1.0.0'

// ============================================================================
// Profile Store
// ============================================================================

export const useProfileStore = defineStore('profile', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  const profiles = ref(new Map<string, TinkerProfile>())
  const currentProfileId = ref<string | null>(null)
  const preferences = ref<UserPreferences>(createDefaultPreferences())
  const collection = ref<CollectionTracking>(createDefaultCollection())
  const builds = ref(new Map<string, CharacterBuild>())
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  const currentProfile = computed(() => 
    currentProfileId.value ? profiles.value.get(currentProfileId.value) || null : null
  )
  
  const allProfiles = computed(() => Array.from(profiles.value.values()))
  
  const profileNames = computed(() => 
    allProfiles.value.map(profile => profile.Character.Name).filter(Boolean)
  )
  
  const hasCurrentProfile = computed(() => currentProfile.value !== null)
  
  const currentCharacterName = computed(() => currentProfile.value?.Character.Name || '')
  
  const currentCharacterLevel = computed(() => currentProfile.value?.Character.Level || 1)
  
  const currentCharacterProfession = computed(() => currentProfile.value?.Character.Profession || '')
  
  // Get specific skill values
  const getSkillValue = computed(() => (category: string, skill: string): number => {
    if (!currentProfile.value) return 0
    const skillCategory = currentProfile.value.Skills[category as keyof typeof currentProfile.value.Skills]
    if (!skillCategory || typeof skillCategory !== 'object') return 0
    return (skillCategory as Record<string, number>)[skill] || 0
  })
  
  // ============================================================================
  // Enhanced Character Analysis with Game Data Utilities
  // ============================================================================
  
  /**
   * Convert TinkerProfile to standardized Character format
   */
  const currentCharacter = computed((): Character | null => {
    if (!currentProfile.value) return null
    
    const profile = currentProfile.value
    const baseStats: Record<number, number> = {}
    
    // Map TinkerProfile attributes to game stat IDs
    const attrMapping = {
      'Strength': 16,
      'Agility': 17, 
      'Stamina': 18,
      'Intelligence': 19,
      'Sense': 20,
      'Psychic': 21
    }
    
    Object.entries(attrMapping).forEach(([attr, statId]) => {
      baseStats[statId] = profile.Skills.Attributes[attr as keyof typeof profile.Skills.Attributes] || 0
    })
    
    // Add other important stats from Skills
    baseStats[53] = profile.Skills.Misc?.['Max Health'] || 0 // Health
    baseStats[220] = profile.Skills.Misc?.['Max Nano'] || 0 // Nano Pool
    baseStats[54] = profile.Character.Level || 1 // Level
    
    return {
      level: profile.Character.Level || 1,
      profession: gameUtils.getProfessionId(profile.Character.Profession) || 0,
      breed: gameUtils.getBreedId(profile.Character.Breed) || 0,
      faction: gameUtils.getFactionId(profile.Character.Faction) || 0,
      baseStats
    }
  })
  
  /**
   * Get comprehensive character analysis
   */
  const characterAnalysis = computed(() => {
    if (!currentCharacter.value) return null
    
    const char = currentCharacter.value
    
    // Get breed information
    const breedInfo = professionBonuses.getBreedSpecialAbilities(char.breed)
    const breedModifiers = professionBonuses.getBreedAttributeModifiers(char.breed)
    const breedSkillMods = professionBonuses.getBreedSkillModifiers(char.breed)
    
    // Get profession information
    const professionCaps = professionBonuses.getProfessionSkillCaps(char.profession)
    const professionNano = professionBonuses.getProfessionNanoEffectiveness(char.profession)
    const professionPriorities = professionBonuses.getProfessionStatPriorities(char.profession)
    
    // Calculate total bonuses
    const characterBonuses = professionBonuses.calculateCharacterBonuses(char)
    
    // Get stat recommendations
    const statRecommendations = professionBonuses.getRecommendedStatDistribution(
      char.breed, 
      char.profession, 
      char.level
    )
    
    return {
      breed: {
        name: gameUtils.getBreedName(char.breed),
        info: breedInfo,
        attributeModifiers: breedModifiers,
        skillModifiers: breedSkillMods
      },
      profession: {
        name: gameUtils.getProfessionName(char.profession),
        skillCaps: professionCaps,
        nanoEffectiveness: professionNano,
        statPriorities: professionPriorities
      },
      bonuses: characterBonuses,
      recommendations: statRecommendations,
      totalStats: calculateTotalStats()
    }
  })
  
  /**
   * Calculate total character stats including all bonuses
   */
  function calculateTotalStats(): Record<number, number> {
    if (!currentCharacter.value) return {}
    
    const char = currentCharacter.value
    const baseStats = { ...char.baseStats }
    
    // Apply breed modifiers
    const breedMods = professionBonuses.getBreedAttributeModifiers(char.breed)
    Object.entries(breedMods).forEach(([stat, modifier]) => {
      const statId = Number(stat)
      baseStats[statId] = (baseStats[statId] || 0) + modifier
    })
    
    // Apply breed skill modifiers (as percentage bonuses)
    const breedSkillMods = professionBonuses.getBreedSkillModifiers(char.breed)
    Object.entries(breedSkillMods).forEach(([skill, bonus]) => {
      const skillId = Number(skill)
      const currentValue = baseStats[skillId] || 0
      baseStats[skillId] = Math.floor(currentValue * (1 + bonus / 100))
    })
    
    return baseStats
  }
  
  /**
   * Get IP analysis for current character
   */
  const ipAnalysis = computed(() => {
    if (!currentCharacter.value) return null
    
    const char = currentCharacter.value
    const totalIP = statCalculations.calculateTotalIP(char)
    const usedIP = statCalculations.calculateUsedIP(char.baseStats)
    
    return {
      total: totalIP,
      used: usedIP,
      available: totalIP - usedIP,
      efficiency: usedIP > 0 ? Math.round((usedIP / totalIP) * 100) : 0
    }
  })
  
  /**
   * Validate character can meet item/nano requirements
   */
  function validateRequirements(requirements: Array<{ stat: number; value: number; operator?: string }>) {
    if (!currentCharacter.value) return { valid: false, failures: [] }
    
    return statCalculations.validateRequirements(currentCharacter.value, requirements)
  }
  
  /**
   * Get profession effectiveness with specific item classes
   */
  function getProfessionItemEffectiveness(itemClass: number): number {
    if (!currentCharacter.value) return 0
    
    const className = gameUtils.getItemClassName(itemClass)
    if (!className) return 0
    
    const professionName = gameUtils.getProfessionName(currentCharacter.value.profession)
    if (!professionName) return 0
    
    // This would use the item validation utilities
    const effectiveness = {
      'Soldier': { 'Weapon': 100, 'Armor': 100, 'Implant': 80 },
      'Doctor': { 'Weapon': 60, 'Armor': 80, 'Implant': 100 },
      // ... other profession mappings
    }
    
    return effectiveness[professionName]?.[className] || 70
  }
  
  /**
   * Get nano school effectiveness for current profession
   */
  function getNanoSchoolEffectiveness(schoolId: number): number {
    if (!currentCharacter.value) return 0
    
    return professionBonuses.getProfessionNanoEffectiveness(currentCharacter.value.profession)[schoolId] || 0
  }
  
  // Get all builds for current profile
  const currentProfileBuilds = computed(() => {
    if (!currentProfileId.value) return []
    return Array.from(builds.value.values()).filter(
      build => build.profile.Character.Name === currentProfile.value?.Character.Name
    )
  })
  
  // ============================================================================
  // LocalStorage Utilities
  // ============================================================================
  
  function saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (err) {
      console.error(`Failed to save to localStorage (${key}):`, err)
      error.value = 'Failed to save data to local storage'
    }
  }
  
  function loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (err) {
      console.error(`Failed to load from localStorage (${key}):`, err)
    }
    return defaultValue
  }
  
  function removeFromStorage(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (err) {
      console.error(`Failed to remove from localStorage (${key}):`, err)
    }
  }
  
  // ============================================================================
  // Profile Management
  // ============================================================================
  
  /**
   * Load all data from LocalStorage
   */
  function loadFromLocalStorage(): void {
    loading.value = true
    error.value = null
    
    try {
      // Load preferences
      preferences.value = loadFromStorage(STORAGE_KEYS.PREFERENCES, createDefaultPreferences())
      
      // Load collection tracking
      collection.value = loadFromStorage(STORAGE_KEYS.COLLECTION, createDefaultCollection())
      
      // Load profiles
      const storedProfiles = loadFromStorage<Record<string, TinkerProfile>>(STORAGE_KEYS.PROFILES, {})
      profiles.value.clear()
      Object.entries(storedProfiles).forEach(([id, profile]) => {
        profiles.value.set(id, profile)
      })
      
      // Load current profile ID
      const storedCurrentId = loadFromStorage<string | null>(STORAGE_KEYS.CURRENT_PROFILE, null)
      if (storedCurrentId && profiles.value.has(storedCurrentId)) {
        currentProfileId.value = storedCurrentId
      }
      
      // Load builds
      const storedBuilds = loadFromStorage<Record<string, CharacterBuild>>(STORAGE_KEYS.BUILDS, {})
      builds.value.clear()
      Object.entries(storedBuilds).forEach(([id, build]) => {
        builds.value.set(id, build)
      })
      
      // Check version and migrate if needed
      const storedVersion = loadFromStorage<string>(STORAGE_KEYS.VERSION, '0.0.0')
      if (storedVersion !== CURRENT_VERSION) {
        migrateData(storedVersion)
        saveToStorage(STORAGE_KEYS.VERSION, CURRENT_VERSION)
      }
      
    } catch (err: any) {
      error.value = err.message || 'Failed to load profile data'
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Save all data to LocalStorage
   */
  function saveToLocalStorage(): void {
    try {
      // Save preferences
      saveToStorage(STORAGE_KEYS.PREFERENCES, preferences.value)
      
      // Save collection tracking
      saveToStorage(STORAGE_KEYS.COLLECTION, collection.value)
      
      // Save profiles
      const profilesObject = Object.fromEntries(profiles.value.entries())
      saveToStorage(STORAGE_KEYS.PROFILES, profilesObject)
      
      // Save current profile ID
      saveToStorage(STORAGE_KEYS.CURRENT_PROFILE, currentProfileId.value)
      
      // Save builds
      const buildsObject = Object.fromEntries(builds.value.entries())
      saveToStorage(STORAGE_KEYS.BUILDS, buildsObject)
      
      // Update timestamps
      preferences.value.lastUpdated = new Date().toISOString()
      collection.value.lastUpdated = new Date().toISOString()
      
    } catch (err: any) {
      error.value = err.message || 'Failed to save profile data'
    }
  }
  
  /**
   * Create a new profile
   */
  function createProfile(name: string): string {
    const profile = createDefaultProfile()
    profile.Character.Name = name
    
    const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    profiles.value.set(profileId, profile)
    
    saveToLocalStorage()
    return profileId
  }
  
  /**
   * Set current active profile
   */
  function setCurrentProfile(profileId: string): boolean {
    if (profiles.value.has(profileId)) {
      currentProfileId.value = profileId
      saveToLocalStorage()
      return true
    }
    return false
  }
  
  /**
   * Update current profile
   */
  function updateCurrentProfile(updates: Partial<TinkerProfile>): void {
    if (!currentProfileId.value || !currentProfile.value) return
    
    const updated = { ...currentProfile.value, ...updates }
    profiles.value.set(currentProfileId.value, updated)
    saveToLocalStorage()
  }
  
  /**
   * Update character skills
   */
  function updateSkills(category: keyof TinkerProfile['Skills'], skills: Record<string, number>): void {
    if (!currentProfile.value) return
    
    const updated = {
      ...currentProfile.value,
      Skills: {
        ...currentProfile.value.Skills,
        [category]: {
          ...currentProfile.value.Skills[category],
          ...skills
        }
      }
    }
    
    updateCurrentProfile(updated)
  }
  
  /**
   * Update equipment slot
   */
  function updateEquipment(
    category: 'Weapons' | 'Clothing' | 'Implants',
    slot: string,
    item: any
  ): void {
    if (!currentProfile.value) return
    
    const updated = {
      ...currentProfile.value,
      [category]: {
        ...currentProfile.value[category],
        [slot]: item
      }
    }
    
    updateCurrentProfile(updated)
  }
  
  /**
   * Delete a profile
   */
  function deleteProfile(profileId: string): void {
    if (profiles.value.has(profileId)) {
      profiles.value.delete(profileId)
      
      // If deleted profile was current, clear current
      if (currentProfileId.value === profileId) {
        currentProfileId.value = null
      }
      
      saveToLocalStorage()
    }
  }
  
  /**
   * Import profile from file/data
   */
  function importProfile(profileData: TinkerProfile): string {
    // Validate profile data structure
    const profile = { ...createDefaultProfile(), ...profileData }
    
    const profileId = createProfile(profile.Character.Name || 'Imported Character')
    profiles.value.set(profileId, profile)
    
    saveToLocalStorage()
    return profileId
  }
  
  /**
   * Export current profile
   */
  function exportCurrentProfile(): TinkerProfile | null {
    return currentProfile.value ? { ...currentProfile.value } : null
  }
  
  // ============================================================================
  // Preferences Management
  // ============================================================================
  
  function updatePreferences(updates: Partial<UserPreferences>): void {
    preferences.value = { ...preferences.value, ...updates }
    saveToLocalStorage()
  }
  
  function addFavoriteItem(itemId: number): void {
    if (!preferences.value.favoriteItems.includes(itemId)) {
      preferences.value.favoriteItems.push(itemId)
      saveToLocalStorage()
    }
  }
  
  function removeFavoriteItem(itemId: number): void {
    const index = preferences.value.favoriteItems.indexOf(itemId)
    if (index > -1) {
      preferences.value.favoriteItems.splice(index, 1)
      saveToLocalStorage()
    }
  }
  
  function addRecentSearch(query: string): void {
    const searches = preferences.value.recentSearches
    const index = searches.indexOf(query)
    
    // Remove if exists, add to front
    if (index > -1) {
      searches.splice(index, 1)
    }
    searches.unshift(query)
    
    // Keep only last 10 searches
    if (searches.length > 10) {
      searches.splice(10)
    }
    
    saveToLocalStorage()
  }
  
  // ============================================================================
  // Collection Tracking
  // ============================================================================
  
  function addCollectedSymbiant(symbiantId: number): void {
    if (!collection.value.symbiants.collected.includes(symbiantId)) {
      collection.value.symbiants.collected.push(symbiantId)
      
      // Remove from wishlist if exists
      const wishlistIndex = collection.value.symbiants.wishlist.indexOf(symbiantId)
      if (wishlistIndex > -1) {
        collection.value.symbiants.wishlist.splice(wishlistIndex, 1)
      }
      
      saveToLocalStorage()
    }
  }
  
  function removeCollectedSymbiant(symbiantId: number): void {
    const index = collection.value.symbiants.collected.indexOf(symbiantId)
    if (index > -1) {
      collection.value.symbiants.collected.splice(index, 1)
      saveToLocalStorage()
    }
  }
  
  function addToSymbiantWishlist(symbiantId: number): void {
    if (!collection.value.symbiants.wishlist.includes(symbiantId) &&
        !collection.value.symbiants.collected.includes(symbiantId)) {
      collection.value.symbiants.wishlist.push(symbiantId)
      saveToLocalStorage()
    }
  }
  
  function removeFromSymbiantWishlist(symbiantId: number): void {
    const index = collection.value.symbiants.wishlist.indexOf(symbiantId)
    if (index > -1) {
      collection.value.symbiants.wishlist.splice(index, 1)
      saveToLocalStorage()
    }
  }
  
  function addSymbiantNote(symbiantId: number, note: string): void {
    collection.value.symbiants.notes[symbiantId] = note
    saveToLocalStorage()
  }
  
  function removeSymbiantNote(symbiantId: number): void {
    delete collection.value.symbiants.notes[symbiantId]
    saveToLocalStorage()
  }
  
  // ============================================================================
  // Build Management
  // ============================================================================
  
  function saveBuild(build: Omit<CharacterBuild, 'id' | 'metadata'>): string {
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fullBuild: CharacterBuild = {
      ...build,
      id: buildId,
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: CURRENT_VERSION
      }
    }
    
    builds.value.set(buildId, fullBuild)
    saveToLocalStorage()
    return buildId
  }
  
  function updateBuild(buildId: string, updates: Partial<CharacterBuild>): void {
    const existing = builds.value.get(buildId)
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        metadata: {
          ...existing.metadata,
          updated_at: new Date().toISOString()
        }
      }
      builds.value.set(buildId, updated)
      saveToLocalStorage()
    }
  }
  
  function deleteBuild(buildId: string): void {
    if (builds.value.has(buildId)) {
      builds.value.delete(buildId)
      saveToLocalStorage()
    }
  }
  
  // ============================================================================
  // Data Migration
  // ============================================================================
  
  function migrateData(fromVersion: string): void {
    console.log(`Migrating TinkerTools data from version ${fromVersion} to ${CURRENT_VERSION}`)
    
    // Handle version-specific migrations here
    if (fromVersion < '1.0.0') {
      // Migration logic for pre-1.0.0 versions
    }
  }
  
  // ============================================================================
  // Cleanup and Reset
  // ============================================================================
  
  function clearError(): void {
    error.value = null
  }
  
  function resetAllData(): void {
    if (confirm('This will delete ALL your profiles, preferences, and collection data. Are you sure?')) {
      profiles.value.clear()
      currentProfileId.value = null
      preferences.value = createDefaultPreferences()
      collection.value = createDefaultCollection()
      builds.value.clear()
      
      // Clear localStorage
      Object.values(STORAGE_KEYS).forEach(key => {
        removeFromStorage(key)
      })
      
      saveToLocalStorage()
    }
  }
  
  // ============================================================================
  // Auto-save setup
  // ============================================================================
  
  // Auto-save on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', saveToLocalStorage)
  }
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    profiles: readonly(profiles),
    currentProfileId: readonly(currentProfileId),
    preferences: readonly(preferences),
    collection: readonly(collection),
    builds: readonly(builds),
    loading: readonly(loading),
    error: readonly(error),
    
    // Getters
    currentProfile,
    allProfiles,
    profileNames,
    hasCurrentProfile,
    currentCharacterName,
    currentCharacterLevel,
    currentCharacterProfession,
    getSkillValue,
    currentProfileBuilds,
    
    // Enhanced character analysis
    currentCharacter,
    characterAnalysis,
    ipAnalysis,
    
    // Actions
    loadFromLocalStorage,
    saveToLocalStorage,
    createProfile,
    setCurrentProfile,
    updateCurrentProfile,
    updateSkills,
    updateEquipment,
    deleteProfile,
    importProfile,
    exportCurrentProfile,
    updatePreferences,
    addFavoriteItem,
    removeFavoriteItem,
    addRecentSearch,
    addCollectedSymbiant,
    removeCollectedSymbiant,
    addToSymbiantWishlist,
    removeFromSymbiantWishlist,
    addSymbiantNote,
    removeSymbiantNote,
    saveBuild,
    updateBuild,
    deleteBuild,
    clearError,
    resetAllData,
    
    // Enhanced analysis methods
    validateRequirements,
    getProfessionItemEffectiveness,
    getNanoSchoolEffectiveness
  }
})