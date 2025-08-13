/**
 * TinkerTools Unified Game Data Composable
 * 
 * Single access point for all game data constants, utility functions,
 * and specialized operations. Provides tree-shakable imports and
 * consistent API for all TinkerTools applications.
 */

import { computed, ref, type Ref } from 'vue';
import { 
  // Core constants
  STAT, 
  REQUIREMENTS, 
  PROFESSION, 
  BREED, 
  FACTION,
  NANOSCHOOL,
  NANO_STRAIN,
  ITEM_CLASS,
  WEAPON_SLOT_POSITIONS,
  ARMOR_SLOT_POSITION,
  IMPLANT_SLOT_POSITION,
  // Type definitions
  type StatId,
  type RequirementId,
  type ProfessionId,
  type BreedId,
  type FactionId,
  type NanoSchoolId,
  type NanoStrainId,
  type ItemClassId
} from '../services/game-data';

import { gameUtils } from '../services/game-utils';
import { statCalculations, type Character } from '../utils/stat-calculations';
import { nanoCompatibility, type Nano, type NCUMemory } from '../utils/nano-compatibility';
import { itemValidation, type Item, type EquipmentSet } from '../utils/item-validation';
import { flagOperations } from '../utils/flag-operations';
import { professionBonuses } from '../utils/profession-bonuses';
import { implantPlanning, type ImplantsData, type ImplantSlotData } from '../utils/implant-planning';
import { nanotechnicianSpecialization, type NukesConfiguration, type DamageBonusResult } from '../utils/nanotechnician-specialization';

// ============================================================================
// Composable State
// ============================================================================

const activeCharacter: Ref<Character | null> = ref(null);
const activeEquipment: Ref<EquipmentSet | null> = ref(null);
const activeNanos: Ref<Nano[]> = ref([]);
const activeImplants: Ref<ImplantsData | null> = ref(null);
const activeNukesConfig: Ref<NukesConfiguration | null> = ref(null);

// ============================================================================
// Main Composable Function
// ============================================================================

export function useGameData() {
  
  // ========================================================================
  // Core Data Access
  // ========================================================================
  
  /**
   * Get all game constants
   */
  const constants = computed(() => ({
    STAT,
    REQUIREMENTS,
    PROFESSION,
    BREED,
    FACTION,
    NANOSCHOOL,
    NANO_STRAIN,
    ITEM_CLASS,
    WEAPON_SLOT_POSITIONS,
    ARMOR_SLOT_POSITION,
    IMPLANT_SLOT_POSITION
  }));
  
  /**
   * Access to all game utility functions
   */
  const utils = computed(() => gameUtils);
  
  // ========================================================================
  // Character Management
  // ========================================================================
  
  /**
   * Set the active character for calculations
   */
  function setActiveCharacter(character: Character) {
    activeCharacter.value = character;
  }
  
  /**
   * Get the current active character
   */
  const character = computed(() => activeCharacter.value);
  
  /**
   * Calculate character stats with all bonuses
   */
  const characterStats = computed(() => {
    if (!activeCharacter.value) return null;
    
    const bonuses = professionBonuses.calculateCharacterBonuses(activeCharacter.value);
    let totalStats = { ...activeCharacter.value.baseStats };
    
    // Apply breed and profession bonuses
    Object.entries(bonuses.totalBonuses).forEach(([stat, bonus]) => {
      const statId = Number(stat);
      totalStats[statId] = (totalStats[statId] || 0) + bonus;
    });
    
    // Apply equipment bonuses if available
    if (activeEquipment.value) {
      const equipStats = itemValidation.calculateEquipmentStats(activeEquipment.value);
      Object.entries(equipStats.totalStats).forEach(([stat, bonus]) => {
        const statId = Number(stat);
        totalStats[statId] = (totalStats[statId] || 0) + bonus;
      });
    }
    
    return {
      baseStats: activeCharacter.value.baseStats,
      totalStats,
      bonuses: bonuses.totalBonuses,
      specialAbilities: bonuses.specialAbilities,
      effectiveSkillCaps: bonuses.effectiveSkillCaps
    };
  });
  
  // ========================================================================
  // Equipment Management
  // ========================================================================
  
  /**
   * Set the active equipment set
   */
  function setActiveEquipment(equipment: EquipmentSet) {
    activeEquipment.value = equipment;
  }
  
  /**
   * Get the current active equipment
   */
  const equipment = computed(() => activeEquipment.value);
  
  /**
   * Validate if an item can be equipped
   */
  function validateItemEquipment(item: Item) {
    if (!activeCharacter.value) {
      return {
        canEquip: false,
        reasons: ['No active character'],
        requiredStats: [],
        slotConflicts: [],
        flagConflicts: []
      };
    }
    
    return itemValidation.validateItemEquipment(
      item, 
      activeCharacter.value, 
      activeEquipment.value || undefined
    );
  }
  
  /**
   * Analyze item usability for current character
   */
  function analyzeItemUsability(item: Item) {
    if (!activeCharacter.value) {
      return {
        usable: false,
        effectiveness: 0,
        issues: ['No active character'],
        recommendations: []
      };
    }
    
    return itemValidation.analyzeItemUsability(item, activeCharacter.value);
  }
  
  /**
   * Calculate equipment stats summary
   */
  const equipmentStats = computed(() => {
    if (!activeEquipment.value) return null;
    
    const stats = itemValidation.calculateEquipmentStats(activeEquipment.value);
    const combat = itemValidation.calculateCombatEffectiveness(activeEquipment.value);
    
    return { ...stats, combat };
  });
  
  // ========================================================================
  // Nano Management
  // ========================================================================
  
  /**
   * Set the active running nanos
   */
  function setActiveNanos(nanos: Nano[]) {
    activeNanos.value = nanos;
  }
  
  /**
   * Get the current active nanos
   */
  const nanos = computed(() => activeNanos.value);
  
  /**
   * Calculate NCU usage and availability
   */
  const ncuStatus = computed((): NCUMemory | null => {
    if (!activeCharacter.value) return null;
    
    const totalNCU = activeCharacter.value.baseStats?.[STAT.NCU] || 0;
    const usedNCU = nanoCompatibility.calculateNCUUsage(activeNanos.value);
    const availableNCU = nanoCompatibility.calculateAvailableNCU(totalNCU, activeNanos.value);
    
    return {
      totalNCU,
      usedNCU,
      availableNCU,
      runningNanos: activeNanos.value
    };
  });
  
  /**
   * Validate if a nano can be cast
   */
  function validateNanoCast(nano: Nano) {
    if (!activeCharacter.value) {
      return {
        canCast: false,
        reasons: ['No active character'],
        requiredStats: [],
        ncuRequired: nano.ncuCost,
        ncuAvailable: 0
      };
    }
    
    const result = nanoCompatibility.validateNanoRequirements(nano, activeCharacter.value);
    
    // Add NCU availability info
    const ncuInfo = ncuStatus.value;
    result.ncuAvailable = ncuInfo?.availableNCU || 0;
    
    if (nano.ncuCost > result.ncuAvailable) {
      result.canCast = false;
      result.reasons.push(`NCU: ${result.ncuAvailable}/${nano.ncuCost}`);
    }
    
    return result;
  }
  
  /**
   * Check for stacking conflicts with a new nano
   */
  function checkNanoConflicts(nano: Nano) {
    return nanoCompatibility.checkStackingConflicts(nano, activeNanos.value);
  }
  
  // ========================================================================
  // Implant Planning
  // ========================================================================
  
  /**
   * Set the active implant configuration
   */
  function setActiveImplants(implants: ImplantsData) {
    activeImplants.value = implants;
  }
  
  /**
   * Get the current active implants
   */
  const implants = computed(() => activeImplants.value);
  
  /**
   * Initialize new implant configuration
   */
  function initializeImplants() {
    return implantPlanning.initialImplants();
  }
  
  /**
   * Validate implant configuration
   */
  function validateImplants(implants?: ImplantsData) {
    const config = implants || activeImplants.value;
    if (!config) {
      return {
        valid: false,
        errors: ['No implant configuration'],
        warnings: []
      };
    }
    
    return implantPlanning.validateImplantConfig(config);
  }
  
  /**
   * Calculate implant construction requirements
   */
  function calculateImplantBuild(implants?: ImplantsData) {
    const config = implants || activeImplants.value;
    if (!config || !activeCharacter.value) return null;
    
    const results = [];
    const combineSkills = {
      'Nanoprogramming': activeCharacter.value.baseStats?.[146] || 0 // Nanoprogramming stat ID
    };
    
    for (const [slotName, slotData] of Object.entries(config)) {
      ['Shiny', 'Bright', 'Faded'].forEach(clusterType => {
        const skill = slotData[clusterType.toLowerCase() as keyof ImplantSlotData] as string;
        if (skill && skill !== 'Empty') {
          if (implantPlanning.isJobeSkill(skill)) {
            const result = implantPlanning.jobeClusterQLBump(
              clusterType as any,
              skill,
              combineSkills,
              slotData.ql,
              1
            );
            results.push({
              slot: slotName,
              cluster: clusterType,
              skill,
              ...result
            });
          } else {
            const result = implantPlanning.rkClusterQLBump(
              clusterType as any,
              skill,
              combineSkills,
              slotData.ql,
              1
            );
            results.push({
              slot: slotName,
              cluster: clusterType,
              skill,
              ...result
            });
          }
        }
      });
    }
    
    return results;
  }
  
  // ========================================================================
  // Nanotechnician Specialization
  // ========================================================================
  
  /**
   * Set the active nanotechnician configuration
   */
  function setActiveNukesConfig(config: NukesConfiguration) {
    activeNukesConfig.value = config;
  }
  
  /**
   * Get the current nanotechnician configuration
   */
  const nukesConfig = computed(() => activeNukesConfig.value);
  
  /**
   * Initialize new nanotechnician configuration
   */
  function initializeNukesConfig() {
    return nanotechnicianSpecialization.initialNukes();
  }
  
  /**
   * Calculate total nano damage bonuses
   */
  const nukeDamageBonuses = computed((): DamageBonusResult | null => {
    if (!activeNukesConfig.value) return null;
    
    return nanotechnicianSpecialization.calculateTotalDamageBonus(activeNukesConfig.value);
  });
  
  /**
   * Validate nanotechnician configuration
   */
  function validateNukesConfig(config?: NukesConfiguration) {
    const nukesConfig = config || activeNukesConfig.value;
    if (!nukesConfig) {
      return {
        valid: false,
        errors: ['No nanotechnician configuration'],
        warnings: []
      };
    }
    
    return nanotechnicianSpecialization.validateNukesConfig(nukesConfig);
  }
  
  /**
   * Calculate nano pool and initiative
   */
  const nukesStats = computed(() => {
    if (!activeNukesConfig.value) return null;
    
    return {
      nanoPool: nanotechnicianSpecialization.calculateNanoPool(activeNukesConfig.value),
      nanoInitiative: nanotechnicianSpecialization.calculateNanoInitiative(activeNukesConfig.value),
      damageBonuses: nukeDamageBonuses.value
    };
  });

  // ========================================================================
  // Profession & Breed Analysis
  // ========================================================================
  
  /**
   * Get breed information and modifiers
   */
  function getBreedInfo(breedId?: number) {
    const id = breedId || activeCharacter.value?.breed;
    if (!id) return null;
    
    return {
      name: gameUtils.getBreedName(id),
      attributeModifiers: professionBonuses.getBreedAttributeModifiers(id),
      skillModifiers: professionBonuses.getBreedSkillModifiers(id),
      specialAbilities: professionBonuses.getBreedSpecialAbilities(id)
    };
  }
  
  /**
   * Get profession information and bonuses
   */
  function getProfessionInfo(professionId?: number) {
    const id = professionId || activeCharacter.value?.profession;
    if (!id) return null;
    
    return {
      name: gameUtils.getProfessionName(id),
      skillCaps: professionBonuses.getProfessionSkillCaps(id),
      nanoEffectiveness: professionBonuses.getProfessionNanoEffectiveness(id),
      statPriorities: professionBonuses.getProfessionStatPriorities(id)
    };
  }
  
  /**
   * Get recommended stat distribution for character
   */
  function getStatRecommendations(level?: number) {
    if (!activeCharacter.value) return null;
    
    const charLevel = level || activeCharacter.value.level;
    return professionBonuses.getRecommendedStatDistribution(
      activeCharacter.value.breed,
      activeCharacter.value.profession,
      charLevel
    );
  }
  
  // ========================================================================
  // Flag Operations
  // ========================================================================
  
  /**
   * Decode various flag types
   */
  const flags = {
    decodeAction: flagOperations.decodeActionFlags,
    decodeItem: flagOperations.decodeItemFlags,
    decodeCan: flagOperations.decodeCanFlags,
    decodeNano: flagOperations.decodeNanoFlags,
    decodeExpansion: flagOperations.decodeExpansionFlags,
    decodeWeaponType: flagOperations.decodeWeaponTypeFlags,
    decodeSlot: flagOperations.decodeSlotFlags,
    
    // Permission checks
    canUseItem: flagOperations.canUseItem,
    checkFactionRestriction: flagOperations.checkFactionRestriction,
    checkExpansionRequirements: flagOperations.checkExpansionRequirements,
    
    // Core operations
    isFlagSet: flagOperations.isFlagSet,
    setFlag: flagOperations.setFlag,
    clearFlag: flagOperations.clearFlag,
    toggleFlag: flagOperations.toggleFlag
  };
  
  // ========================================================================
  // Calculation Utilities
  // ========================================================================
  
  /**
   * Calculate IP costs and distributions
   */
  const calculations = {
    calculateIPCost: statCalculations.calculateIPCost,
    calculateTotalIP: statCalculations.calculateTotalIP,
    calculateOptimalStats: statCalculations.calculateOptimalStats,
    validateRequirements: statCalculations.validateRequirements,
    calculateSkillCap: statCalculations.calculateSkillCap,
    
    // Nano calculations
    calculateNanoCost: nanoCompatibility.calculateNanoCost,
    calculateNanoInitTime: nanoCompatibility.calculateNanoInitTime,
    
    // Item calculations
    calculateItemDPS: itemValidation.calculateItemDPS,
    findItemUpgrades: itemValidation.findItemUpgrades
  };
  
  // ========================================================================
  // Formatting Utilities
  // ========================================================================
  
  /**
   * Format values for display
   */
  const format = {
    // Game data formatting
    statValue: gameUtils.formatStatValue,
    characterName: gameUtils.formatCharacterName,
    itemRequirements: itemValidation.formatItemRequirements,
    
    // Nano effect formatting
    nanoEffects: nanoCompatibility.formatNanoEffects,
    nanoEffect: nanoCompatibility.formatSingleEffect,
    
    // Flag formatting
    flagValue: flagOperations.describeFlagValue,
    flagToBinary: flagOperations.flagToBinaryString,
    flagToHex: flagOperations.flagToHexString
  };
  
  // ========================================================================
  // Validation Utilities
  // ========================================================================
  
  /**
   * Validation functions
   */
  const validate = {
    // Basic validation
    isValidStat: gameUtils.isValidStat,
    isValidProfession: gameUtils.isValidProfession,
    isValidBreed: gameUtils.isValidBreed,
    isValidFaction: gameUtils.isValidFaction,
    
    // Complex validation
    itemEquipment: validateItemEquipment,
    nanoRequirements: validateNanoCast,
    requirements: statCalculations.validateRequirements,
    
    // Flag validation
    flagCombination: flagOperations.validateFlagCombination
  };
  
  // ========================================================================
  // Return Composable API
  // ========================================================================
  
  return {
    // State
    character,
    equipment,
    nanos,
    implants,
    nukesConfig,
    
    // Computed
    constants,
    utils,
    characterStats,
    equipmentStats,
    ncuStatus,
    nukeDamageBonuses,
    nukesStats,
    
    // Character methods
    setActiveCharacter,
    getBreedInfo,
    getProfessionInfo,
    getStatRecommendations,
    
    // Equipment methods
    setActiveEquipment,
    validateItemEquipment,
    analyzeItemUsability,
    
    // Nano methods
    setActiveNanos,
    validateNanoCast,
    checkNanoConflicts,
    
    // Implant methods
    setActiveImplants,
    initializeImplants,
    validateImplants,
    calculateImplantBuild,
    
    // Nanotechnician methods
    setActiveNukesConfig,
    initializeNukesConfig,
    validateNukesConfig,
    
    // Utility groups
    flags,
    calculations,
    format,
    validate,
    
    // Direct access to specialized utilities
    statCalculations,
    nanoCompatibility,
    itemValidation,
    flagOperations,
    professionBonuses,
    implantPlanning,
    nanotechnicianSpecialization
  };
}

// ============================================================================
// Global Instance (Optional)
// ============================================================================

let globalGameData: ReturnType<typeof useGameData> | null = null;

/**
 * Get or create a global instance of the game data composable
 * Useful for sharing state across components
 */
export function useGlobalGameData() {
  if (!globalGameData) {
    globalGameData = useGameData();
  }
  return globalGameData;
}

// ============================================================================
// Convenience Re-exports
// ============================================================================

// Re-export commonly used types
export type {
  Character,
  Nano,
  Item,
  EquipmentSet,
  NCUMemory,
  ImplantsData,
  ImplantSlotData,
  NukesConfiguration,
  DamageBonusResult,
  StatId,
  RequirementId,
  ProfessionId,
  BreedId,
  FactionId,
  NanoSchoolId,
  NanoStrainId,
  ItemClassId
};

// Re-export constants for direct access when tree-shaking is important
export {
  STAT,
  REQUIREMENTS,
  PROFESSION,
  BREED,
  FACTION,
  NANOSCHOOL,
  NANO_STRAIN,
  ITEM_CLASS,
  WEAPON_SLOT_POSITIONS,
  ARMOR_SLOT_POSITION,
  IMPLANT_SLOT_POSITION
};