/**
 * TinkerPlants Store - Pinia Store for Implant Planning
 *
 * Manages implant configuration, lookups, bonus calculations, and requirement analysis
 * Integrates with TinkerProfiles for profile storage and backend /implants/lookup API
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly, toRaw } from 'vue';
import type {
  Item,
  ImplantSelection,
  ImplantRequirement,
  TreatmentInfo,
  AttributeRequirementInfo,
  PerImplantRequirement,
  SymbiantItem,
} from '../types/api';
import { isSymbiant } from '../types/api';
import { apiClient } from '../services/api-client';
import { useTinkerProfilesStore } from './tinkerProfiles';
import { useSymbiantsStore } from './symbiants';
import { equipmentBonusCalculator } from '../services/equipment-bonus-calculator';
import { getCriteriaRequirements } from '../services/action-criteria';
import { useToast } from 'primevue/usetoast';
import { skillService } from '../services/skill-service';

// Attribute stats that need special display
const ATTRIBUTE_STAT_IDS = new Set([
  124, // Treatment
  16, // Strength
  17, // Agility
  18, // Stamina
  19, // Intelligence
  20, // Sense
  21, // Psychic
]);

// Cache entry for implant lookups
interface CacheEntry {
  item: Item;
  timestamp: number;
}

// Debounced lookup tracker
interface DebouncedLookup {
  timer: number;
  slotBitflag: string;
}

/**
 * Parse cluster IDs from implant description
 * Descriptions contain lines like:
 * "Faded NanoCluster: Pistol"
 * "Bright NanoCluster: Sensory Improvement and Modification"
 * "Shining NanoCluster: Aimed Shot"
 *
 * Returns stat IDs for each cluster using skillService to resolve variations
 */
function parseImplantClusters(
  item: any
): { shiny: number | null; bright: number | null; faded: number | null } | null {
  const description = item.description;
  if (!description) return null;

  const clusters = {
    shiny: null as number | null,
    bright: null as number | null,
    faded: null as number | null,
  };

  const failedClusters: string[] = [];

  // Parse each cluster line
  const fadedMatch = description.match(/Faded NanoCluster:\s*([^\r\n]+)/i);
  const brightMatch = description.match(/Bright NanoCluster:\s*([^\r\n]+)/i);
  const shinyMatch = description.match(/Shining NanoCluster:\s*([^\r\n]+)/i);

  if (fadedMatch) {
    const rawName = fadedMatch[1].trim();
    if (rawName && rawName !== 'Empty') {
      try {
        // Resolve cluster name to stat ID
        const skillId = skillService.resolveId(rawName);
        clusters.faded = skillId;
      } catch (err) {
        console.error(`❌ [CLUSTER LOOKUP FAILED] Faded: "${rawName}"`);
        failedClusters.push(`Faded: "${rawName}"`);
        // Don't set fallback - leave as null
      }
    }
  }

  if (brightMatch) {
    const rawName = brightMatch[1].trim();
    if (rawName && rawName !== 'Empty') {
      try {
        // Resolve cluster name to stat ID
        const skillId = skillService.resolveId(rawName);
        clusters.bright = skillId;
      } catch (err) {
        console.error(`❌ [CLUSTER LOOKUP FAILED] Bright: "${rawName}"`);
        failedClusters.push(`Bright: "${rawName}"`);
        // Don't set fallback - leave as null
      }
    }
  }

  if (shinyMatch) {
    const rawName = shinyMatch[1].trim();
    if (rawName && rawName !== 'Empty') {
      try {
        // Resolve cluster name to stat ID
        const skillId = skillService.resolveId(rawName);
        clusters.shiny = skillId;
      } catch (err) {
        console.error(`❌ [CLUSTER LOOKUP FAILED] Shiny: "${rawName}"`);
        failedClusters.push(`Shiny: "${rawName}"`);
        // Don't set fallback - leave as null
      }
    }
  }

  // Log summary of failures if any
  if (failedClusters.length > 0) {
    console.error(
      `❌ [CLUSTER LOOKUP SUMMARY] ${failedClusters.length} cluster(s) failed normalization:`,
      failedClusters
    );
  }

  // Return null if all clusters are empty
  if (!clusters.shiny && !clusters.bright && !clusters.faded) {
    return null;
  }

  return clusters;
}

export const useTinkerPlantsStore = defineStore('tinkerPlants', () => {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Loading state - true when API operations are in progress
   */
  const loading = ref(false);

  /**
   * Per-slot loading state - tracks which slots are currently fetching data
   */
  const slotLoading = ref<Record<string, boolean>>({});

  /**
   * Error state - populated when operations fail
   */
  const error = ref<string | null>(null);

  /**
   * Current implant configuration (working state)
   * Key: slot bitflag (e.g., "2" for Eyes)
   * Value: ImplantSelection with cluster names, QL, and fetched item
   */
  const currentConfiguration = ref<Record<string, ImplantSelection>>({});

  /**
   * Profile configuration (saved state from profile.Implants)
   * Used for dirty checking and revert functionality
   */
  const profileConfiguration = ref<Record<string, ImplantSelection>>({});

  /**
   * Calculated stat bonuses from current implant configuration
   * Key: stat ID (number)
   * Value: total bonus amount
   */
  const calculatedBonuses = ref<Record<number, number>>({});

  /**
   * Calculated requirements for current implant configuration
   * Includes equipment requirements (Treatment, Attributes) and build requirements (NP, skills)
   */
  const calculatedRequirements = ref<ImplantRequirement[]>([]);

  /**
   * Treatment requirement information
   * Contains required treatment, current profile treatment, delta, and sufficiency status
   */
  const treatmentInfo = ref<TreatmentInfo>({
    required: 0,
    current: 0,
    delta: 0,
    sufficient: false,
  });

  /**
   * In-memory cache for implant lookups
   * Key: generated from slot + QL + clusters hash
   * Value: cached item data with timestamp
   */
  const lookupCache = ref<Map<string, CacheEntry>>(new Map());

  /**
   * Cache TTL in milliseconds (5 minutes)
   */
  const cacheTTL = 5 * 60 * 1000;

  /**
   * Toast service for user notifications
   */
  const toast = useToast();

  /**
   * Debounced lookup timers
   * Tracks pending lookups to avoid rapid-fire API calls on manual changes
   */
  const debouncedLookups = ref<Map<string, DebouncedLookup>>(new Map());

  /**
   * Attribute preference for filtering implant variants
   * Defaults to null (no preference)
   */
  const attributePreference = ref<string | null>(null);

  /**
   * Per-implant requirements (not deduplicated)
   * Tracks requirements for each individual implant slot
   * Key: slot bitflag (e.g., "2" for Eyes)
   * Value: array of requirements for that specific implant
   */
  const perImplantRequirements = ref<Record<string, ImplantRequirement[]>>({});

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Map implant slot bitflag to display name
   */
  function getSlotDisplayName(slotBitflag: string): string {
    const slotMap: Record<string, string> = {
      '2': 'Eyes',
      '4': 'Head',
      '8': 'Ears',
      '16': 'Right Arm',
      '32': 'Chest',
      '64': 'Left Arm',
      '128': 'Right Wrist',
      '256': 'Waist',
      '512': 'Left Wrist',
      '1024': 'Right Hand',
      '2048': 'Legs',
      '4096': 'Left Hand',
      '8192': 'Feet',
    };
    return slotMap[slotBitflag] || `Slot ${slotBitflag}`;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Treatment required for current implant configuration
   * Extracted from highest Treatment requirement across all implants
   */
  const treatmentRequired = computed(() => treatmentInfo.value.required);

  /**
   * Unmet requirements for current configuration
   * Returns array of requirements where met === false
   */
  const unmetRequirements = computed(() => calculatedRequirements.value.filter((req) => !req.met));

  /**
   * Has unsaved changes
   * True if currentConfiguration differs from profileConfiguration
   */
  const hasChanges = computed(() => {
    const currentKeys = Object.keys(currentConfiguration.value).sort();
    const profileKeys = Object.keys(profileConfiguration.value).sort();

    // Different number of configured slots
    if (currentKeys.length !== profileKeys.length) {
      return true;
    }

    // Check if any slot configuration differs
    for (const key of currentKeys) {
      const current = currentConfiguration.value[key];
      const profile = profileConfiguration.value[key];

      if (!profile) {
        return true;
      }

      // Check type change
      if (current.type !== profile.type) {
        return true;
      }

      // Check implant-specific changes
      if (current.type === 'implant') {
        if (
          current.shiny !== profile.shiny ||
          current.bright !== profile.bright ||
          current.faded !== profile.faded ||
          current.ql !== profile.ql
        ) {
          return true;
        }
      }

      // Check symbiant-specific changes
      if (current.type === 'symbiant') {
        const currentSymbiantId = current.symbiant?.id || null;
        const profileSymbiantId = profile.symbiant?.id || null;
        if (currentSymbiantId !== profileSymbiantId || current.ql !== profile.ql) {
          return true;
        }
      }
    }

    return false;
  });

  /**
   * Attribute requirements for current configuration
   * Returns only attribute stats (Treatment, Strength, Agility, etc.)
   * Sorted with Treatment first, then alphabetically
   */
  const attributeRequirements = computed((): AttributeRequirementInfo[] => {
    const requirements: AttributeRequirementInfo[] = [];

    for (const req of calculatedRequirements.value) {
      // Only include attribute stats (not build skills)
      if (ATTRIBUTE_STAT_IDS.has(req.stat)) {
        requirements.push({
          stat: req.stat,
          statName: req.statName,
          required: req.required,
          current: req.current,
          delta: req.current !== undefined ? req.required - req.current : undefined,
          sufficient: req.met,
        });
      }
    }

    // Sort: Treatment first, then alphabetically
    requirements.sort((a, b) => {
      if (a.stat === 124) return -1; // Treatment first
      if (b.stat === 124) return 1;
      return a.statName.localeCompare(b.statName);
    });

    return requirements;
  });

  /**
   * Per-implant requirements formatted for display
   * Returns array of requirements grouped by implant slot
   */
  const perImplantRequirementsList = computed((): PerImplantRequirement[] => {
    const result: PerImplantRequirement[] = [];

    // Standard slot order (by bitflag value)
    const slotOrder = [
      '2',
      '4',
      '8',
      '16',
      '32',
      '64',
      '128',
      '256',
      '512',
      '1024',
      '2048',
      '4096',
      '8192',
    ];

    for (const slotBitflag of slotOrder) {
      const requirements = perImplantRequirements.value[slotBitflag];
      if (!requirements || requirements.length === 0) {
        continue; // Skip empty slots
      }

      result.push({
        slot: slotBitflag,
        slotName: getSlotDisplayName(slotBitflag),
        requirements,
      });
    }

    return result;
  });

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Load implant configuration from active profile
   * Populates currentConfiguration and profileConfiguration from profile.Implants
   */
  async function loadFromProfile(): Promise<void> {
    const profilesStore = useTinkerProfilesStore();
    const profile = profilesStore.activeProfile;

    if (!profile) {
      error.value = 'No active profile selected';
      toast.add({
        severity: 'error',
        summary: 'No Active Profile',
        detail: 'Please select a profile to use the implant planner',
        life: 3000,
      });
      return;
    }

    try {
      loading.value = true;
      error.value = null;

      // Extract implants from profile.Implants (uses bitflag keys)
      const implants = profile.Implants || {};

      console.log('[TinkerPlants] Profile Implants keys:', Object.keys(implants));

      // Convert profile implant data to ImplantSelection format
      const loadedConfiguration: Record<string, ImplantSelection> = {};

      for (const [slotBitflag, item] of Object.entries(implants)) {
        if (!item) continue;

        // Check for symbiant using type guard (checks for family/slot_id properties)
        // Also check type field for backwards compatibility
        const isSymbiantItem =
          isSymbiant(item as unknown as Item | SymbiantItem) ||
          ('type' in item && item.type === 'symbiant');

        if (isSymbiantItem) {
          // Load as symbiant - store basic data now, enrich with full item data later
          const symbiantData = item as unknown as SymbiantItem;
          loadedConfiguration[slotBitflag] = {
            type: 'symbiant',
            slotBitflag,
            ql: symbiantData.ql || 200,
            symbiant: JSON.parse(JSON.stringify(symbiantData)) as SymbiantItem,
            item: null,
            shiny: null,
            bright: null,
            faded: null,
          };
          console.log(`[TinkerPlants] Slot ${slotBitflag}: loaded symbiant ${symbiantData.name}`);
        } else {
          // Load as implant (existing cluster parsing logic)
          const clusters = parseImplantClusters(item);
          console.log(`[TinkerPlants] Slot ${slotBitflag} parsed clusters:`, clusters);
          if (clusters) {
            loadedConfiguration[slotBitflag] = {
              type: 'implant',
              shiny: clusters.shiny,
              bright: clusters.bright,
              faded: clusters.faded,
              ql: (item as any).ql || 200,
              slotBitflag,
              item: JSON.parse(JSON.stringify(item)) as Item,
              symbiant: null,
            };
          } else {
            console.log(`[TinkerPlants] Slot ${slotBitflag}: parser returned null`);
          }
        }
      }

      currentConfiguration.value = loadedConfiguration;
      profileConfiguration.value = JSON.parse(JSON.stringify(loadedConfiguration));

      console.log(
        '[TinkerPlants] Loaded configuration from profile:',
        Object.keys(loadedConfiguration).length,
        'slots'
      );

      // Auto-recalculate bonuses and requirements
      recalculate();
    } catch (err: any) {
      error.value = err instanceof Error ? err.message : 'Failed to load configuration';
      toast.add({
        severity: 'error',
        summary: 'Failed to Load Configuration',
        detail: 'Could not load implant configuration from profile',
        life: 5000,
      });
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Save current implant configuration to active profile
   * Converts currentConfiguration to profile.Implants format and persists to storage
   */
  async function saveToProfile(): Promise<void> {
    const profilesStore = useTinkerProfilesStore();
    const profile = profilesStore.activeProfile;

    if (!profile) {
      toast.add({
        severity: 'error',
        summary: 'No Active Profile',
        detail: 'Please select a profile before saving',
        life: 3000,
      });
      return;
    }

    try {
      loading.value = true;
      error.value = null;

      // Convert currentConfiguration to unified profile.Implants format (ImplantWithClusters)
      const implantsToSave: Record<string, any> = {};

      for (const [slotBitflag, selection] of Object.entries(currentConfiguration.value)) {
        const slotNumber = parseInt(slotBitflag, 10);

        if (selection.type === 'implant' && selection.item) {
          // Transform Item to ImplantWithClusters format
          const clusters: any = {};
          if (selection.shiny !== null && selection.shiny !== undefined) {
            clusters.Shiny = {
              stat: selection.shiny,
              skillName: skillService.getName(selection.shiny),
            };
          }
          if (selection.bright !== null && selection.bright !== undefined) {
            clusters.Bright = {
              stat: selection.bright,
              skillName: skillService.getName(selection.bright),
            };
          }
          if (selection.faded !== null && selection.faded !== undefined) {
            clusters.Faded = {
              stat: selection.faded,
              skillName: skillService.getName(selection.faded),
            };
          }

          implantsToSave[slotBitflag] = {
            ...toRaw(selection.item),
            slot: slotNumber,
            type: 'implant' as const,
            clusters: Object.keys(clusters).length > 0 ? clusters : undefined,
          };
        } else if (selection.type === 'symbiant' && selection.symbiant) {
          // Transform SymbiantItem to ImplantWithClusters format
          implantsToSave[slotBitflag] = {
            ...toRaw(selection.symbiant),
            slot: slotNumber,
            type: 'symbiant' as const,
          };
        }
      }

      // Persist profile to storage using updateProfile with partial update
      await profilesStore.updateProfile(profile.id, {
        Implants: implantsToSave,
      });

      // Update profileConfiguration to match currentConfiguration (no longer "dirty")
      profileConfiguration.value = JSON.parse(JSON.stringify(currentConfiguration.value));

      toast.add({
        severity: 'success',
        summary: 'Configuration Saved',
        detail: 'Implant configuration saved to profile',
        life: 3000,
      });

      console.log(
        '[TinkerPlants] Saved configuration to profile:',
        Object.keys(implantsToSave).length,
        'items'
      );
    } catch (err: any) {
      error.value = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: error.value,
        life: 5000,
      });
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Revert current configuration to last saved profile state
   * Discards unsaved changes and reloads from profileConfiguration
   */
  function revertToProfile(): void {
    currentConfiguration.value = JSON.parse(JSON.stringify(profileConfiguration.value));
    console.log('[TinkerPlants] Reverted to profile configuration');

    // Auto-recalculate bonuses and requirements after revert
    recalculate();
  }

  /**
   * Update a single implant slot configuration
   * Updates currentConfiguration with new cluster selections or QL
   *
   * @param slotBitflag - Slot bitflag (e.g., "2" for Eyes)
   * @param updates - Partial ImplantSelection updates
   */
  function updateSlot(slotBitflag: string, updates: Partial<ImplantSelection>): void {
    // Get existing configuration for this slot or create new
    const existing = currentConfiguration.value[slotBitflag] || {
      type: 'implant' as const,
      shiny: null,
      bright: null,
      faded: null,
      ql: 200,
      slotBitflag,
      item: null,
      symbiant: null,
    };

    // Merge updates
    currentConfiguration.value[slotBitflag] = {
      ...existing,
      ...updates,
    };
  }

  /**
   * Set equipment type for a slot (implant or symbiant)
   * Switching types clears the current configuration to avoid conflicts
   *
   * @param slotBitflag - Slot bitflag (e.g., "2" for Eyes)
   * @param type - Equipment type ('implant' or 'symbiant')
   */
  function setSlotType(slotBitflag: string, type: 'implant' | 'symbiant'): void {
    const existing = currentConfiguration.value[slotBitflag];

    if (type === 'symbiant') {
      // Switching to symbiant: clear implant-specific data
      updateSlot(slotBitflag, {
        type: 'symbiant',
        shiny: null,
        bright: null,
        faded: null,
        item: null,
        symbiant: null,
        // Preserve QL as symbiants also have QL (though it's fixed per item)
      });
    } else {
      // Switching to implant: clear symbiant-specific data
      updateSlot(slotBitflag, {
        type: 'implant',
        symbiant: null,
        item: null,
        shiny: null,
        bright: null,
        faded: null,
        // Preserve QL
      });
    }

    // Trigger recalculation since slot type changed
    recalculate();
  }

  /**
   * Set a symbiant for a slot
   * Only valid when slot type is 'symbiant'
   *
   * @param slotBitflag - Slot bitflag (e.g., "2" for Eyes)
   * @param symbiant - SymbiantItem or null to clear
   */
  async function setSymbiant(slotBitflag: string, symbiant: SymbiantItem | null): Promise<void> {
    const existing = currentConfiguration.value[slotBitflag];

    // Ensure slot is in symbiant mode
    if (!existing || existing.type !== 'symbiant') {
      setSlotType(slotBitflag, 'symbiant');
    }

    let enrichedSymbiant: Item | null = null;

    // Fetch full item data from backend if symbiant is provided
    if (symbiant) {
      try {
        const fullItemResponse = await apiClient.getItem(symbiant.aoid);

        if (fullItemResponse.data) {
          // Use the complete Item structure with all fields
          enrichedSymbiant = fullItemResponse.data;
        } else {
          // Fallback: convert minimal symbiant to Item structure
          console.warn(`Could not fetch full item data for symbiant ${symbiant.aoid}, using minimal data`);
          enrichedSymbiant = {
            id: symbiant.id,
            aoid: symbiant.aoid,
            name: symbiant.name,
            ql: symbiant.ql,
            description: '',
            item_class: 3,
            is_nano: false,
            stats: [],
            spell_data: symbiant.spell_data || [],
            actions: symbiant.actions || [],
            attack_stats: [],
            defense_stats: [],
            sources: [],
          };
        }
      } catch (error) {
        console.error(`Failed to fetch full item data for symbiant ${symbiant.aoid}:`, error);
        // Fallback: convert minimal symbiant to Item structure
        enrichedSymbiant = {
          id: symbiant.id,
          aoid: symbiant.aoid,
          name: symbiant.name,
          ql: symbiant.ql,
          description: '',
          item_class: 3,
          is_nano: false,
          stats: [],
          spell_data: symbiant.spell_data || [],
          actions: symbiant.actions || [],
          attack_stats: [],
          defense_stats: [],
          sources: [],
        };
      }
    }

    updateSlot(slotBitflag, {
      symbiant: enrichedSymbiant,
      // Update QL to match symbiant's QL if provided
      ql: enrichedSymbiant?.ql || existing?.ql || 200,
    });

    // Trigger recalculation
    recalculate();
  }

  /**
   * Generate cache key for implant lookup
   * Key format: implant_${slot}_${ql}_${clustersHash}
   *
   * @param slotBitflag - Slot bitflag
   * @param ql - Quality Level
   * @param clusters - Cluster stat IDs (shiny, bright, faded)
   * @returns Cache key string
   */
  function generateCacheKey(
    slotBitflag: string,
    ql: number,
    clusters: { shiny: number | null; bright: number | null; faded: number | null }
  ): string {
    // Create a simple hash of cluster IDs
    const clusterStr = `${clusters.shiny || ''}_${clusters.bright || ''}_${clusters.faded || ''}`;
    return `implant_${slotBitflag}_${ql}_${clusterStr}`;
  }

  /**
   * Check cache for implant lookup result
   * Returns cached item if found and not expired
   *
   * @param cacheKey - Cache key from generateCacheKey
   * @returns Cached item or null if not found/expired
   */
  function checkCache(cacheKey: string): Item | null {
    const cached = lookupCache.value.get(cacheKey);
    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid (within TTL)
    const age = Date.now() - cached.timestamp;
    if (age > cacheTTL) {
      // Cache expired, remove entry
      lookupCache.value.delete(cacheKey);
      return null;
    }

    return cached.item;
  }

  /**
   * Store item in lookup cache
   *
   * @param cacheKey - Cache key from generateCacheKey
   * @param item - Item to cache
   */
  function cacheItem(cacheKey: string, item: Item): void {
    lookupCache.value.set(cacheKey, {
      item,
      timestamp: Date.now(),
    });
  }

  /**
   * Lookup implant for a specific slot
   * Calls /implants/lookup API endpoint with cluster configuration
   * Updates currentConfiguration with returned item data
   *
   * @param slotBitflag - Slot bitflag (e.g., "2" for Eyes)
   */
  async function lookupImplantForSlot(slotBitflag: string): Promise<void> {
    const selection = currentConfiguration.value[slotBitflag];
    if (!selection) {
      console.warn('[TinkerPlants] No selection found for slot:', slotBitflag);
      return;
    }

    // Check if slot has any clusters configured
    const hasAnyClusters =
      selection.shiny !== null || selection.bright !== null || selection.faded !== null;

    if (!hasAnyClusters) {
      // Clear item data for empty slots
      selection.item = null;
      return;
    }

    // Check cache first
    const cacheKey = generateCacheKey(slotBitflag, selection.ql, {
      shiny: selection.shiny ?? null,
      bright: selection.bright ?? null,
      faded: selection.faded ?? null,
    });

    const cachedItem = checkCache(cacheKey);
    if (cachedItem) {
      console.log('[TinkerPlants] Cache hit for slot:', slotBitflag);
      selection.item = cachedItem;
      return;
    }

    // Set per-slot loading state
    slotLoading.value[slotBitflag] = true;

    try {
      // Clusters are already stat IDs - use them directly for API request
      // Backend expects capitalized cluster position keys
      const clustersAsStatIds: Record<string, number> = {};

      if (selection.shiny !== null && selection.shiny !== undefined) {
        clustersAsStatIds['Shiny'] = selection.shiny;
      }

      if (selection.bright !== null && selection.bright !== undefined) {
        clustersAsStatIds['Bright'] = selection.bright;
      }

      if (selection.faded !== null && selection.faded !== undefined) {
        clustersAsStatIds['Faded'] = selection.faded;
      }

      // Convert slot bitflag to slot number for API
      const slotNumber = parseInt(slotBitflag, 10);

      // Call API
      const response = await apiClient.lookupImplant(slotNumber, selection.ql, clustersAsStatIds);

      if (response.success && response.item) {
        // Cache the result
        cacheItem(cacheKey, response.item);

        // Update configuration with fetched item
        selection.item = response.item;

        console.log('[TinkerPlants] Lookup success for slot:', slotBitflag, response.item.name);
      } else {
        // No matching implant found
        toast.add({
          severity: 'info',
          summary: 'No Match Found',
          detail: `No implant found for selected cluster combination in slot ${slotBitflag}`,
          life: 3000,
        });
        selection.item = null;
      }
    } catch (err: any) {
      console.error('[TinkerPlants] Lookup failed for slot:', slotBitflag, err);

      error.value = err instanceof Error ? err.message : 'Implant lookup failed';

      toast.add({
        severity: 'error',
        summary: 'Lookup Failed',
        detail: `Failed to lookup implant for slot ${slotBitflag}`,
        life: 5000,
      });

      selection.item = null;
    } finally {
      slotLoading.value[slotBitflag] = false;

      // Auto-recalculate bonuses and requirements after slot update
      recalculate();
    }
  }

  /**
   * Debounced implant lookup for manual changes
   * Delays API call by 100ms to avoid rapid-fire requests during dropdown changes
   *
   * @param slotBitflag - Slot bitflag
   */
  function lookupImplantForSlotDebounced(slotBitflag: string): void {
    // Clear existing timer for this slot
    const existing = debouncedLookups.value.get(slotBitflag);
    if (existing) {
      clearTimeout(existing.timer);
    }

    // Set new timer
    const timer = window.setTimeout(() => {
      lookupImplantForSlot(slotBitflag);
      debouncedLookups.value.delete(slotBitflag);
    }, 100);

    debouncedLookups.value.set(slotBitflag, { timer, slotBitflag });
  }

  /**
   * Calculate stat bonuses from current implant configuration
   * Iterates all configured slots and aggregates bonuses using equipmentBonusCalculator
   * Updates calculatedBonuses state
   */
  function calculateBonuses(): void {
    const bonuses: Record<number, number> = {};

    // Iterate all slots in current configuration
    for (const [slotBitflag, selection] of Object.entries(currentConfiguration.value)) {
      let equipmentItem: Item | SymbiantItem | null = null;

      // Determine which equipment type is active
      if (selection.type === 'symbiant' && selection.symbiant) {
        equipmentItem = selection.symbiant;
      } else if (selection.type === 'implant' && selection.item) {
        // Skip empty implant slots (all clusters null)
        const hasNonEmptyClusters =
          selection.shiny !== null || selection.bright !== null || selection.faded !== null;

        if (!hasNonEmptyClusters) {
          continue;
        }

        equipmentItem = selection.item;
      }

      // Skip slots without equipment
      if (!equipmentItem) {
        continue;
      }

      try {
        // Extract bonuses from equipment using equipment bonus calculator
        // Works for both implants and symbiants (both have spell_data)
        // Cast to Item since SymbiantItem has compatible structure
        const itemBonuses = equipmentBonusCalculator.parseItemSpells(equipmentItem as Item);

        // Aggregate bonuses
        for (const bonus of itemBonuses) {
          if (bonuses[bonus.statId]) {
            // Stat 355 (WornItem) is a flag field - use bitwise OR
            if (bonus.statId === 355) {
              bonuses[bonus.statId] |= bonus.amount;
            } else {
              bonuses[bonus.statId] += bonus.amount;
            }
          } else {
            bonuses[bonus.statId] = bonus.amount;
          }
        }
      } catch (err) {
        console.error(`[TinkerPlants] Failed to parse bonuses for slot ${slotBitflag}:`, err);
        // Continue processing other slots
      }
    }

    calculatedBonuses.value = bonuses;
    console.log('[TinkerPlants] Calculated bonuses:', Object.keys(bonuses).length, 'stats');
  }

  /**
   * Calculate requirements for current implant configuration
   * Analyzes item actions/criteria and compares against active profile skills
   * Updates calculatedRequirements and treatmentInfo state
   */
  function calculateRequirements(): void {
    const profilesStore = useTinkerProfilesStore();
    const profile = profilesStore.activeProfile;
    const hasProfile = !!profile;

    if (!hasProfile) {
      console.info('[TinkerPlants] No active profile - calculating requirements without comparison');
    }

    // Use Map to track max requirement per stat (deduplication)
    const maxRequirements = new Map<number, ImplantRequirement>();
    let maxTreatmentRequired = 0;

    // Track per-slot requirements (not deduplicated)
    const slotRequirements: Record<string, ImplantRequirement[]> = {};

    // Iterate all slots in current configuration
    for (const [slotBitflag, selection] of Object.entries(currentConfiguration.value)) {
      let equipmentItem: Item | SymbiantItem | null = null;

      // Determine which equipment type is active
      if (selection.type === 'symbiant' && selection.symbiant) {
        equipmentItem = selection.symbiant;
      } else if (selection.type === 'implant' && selection.item) {
        // Skip empty implant slots (all clusters null)
        const hasNonEmptyClusters =
          selection.shiny !== null || selection.bright !== null || selection.faded !== null;

        if (!hasNonEmptyClusters) {
          continue;
        }

        equipmentItem = selection.item;
      }

      // Skip slots without equipment
      if (!equipmentItem) {
        continue;
      }

      // Initialize slot requirements array
      if (!slotRequirements[slotBitflag]) {
        slotRequirements[slotBitflag] = [];
      }

      try {
        // Extract requirements from equipment actions
        // Works for both implants and symbiants (both have actions)
        if (!equipmentItem.actions || equipmentItem.actions.length === 0) {
          continue;
        }

        // Process each action's criteria
        for (const action of equipmentItem.actions) {
          if (!action.criteria) {
            continue;
          }

          // Use action-criteria service to parse requirements
          const actionRequirements = getCriteriaRequirements(action.criteria);

          // Convert to ImplantRequirement format with met status
          for (const req of actionRequirements) {
            const statId = req.stat;
            const requiredValue = req.exactValue || req.minValue || 0;
            const currentValue = hasProfile
              ? (profile?.skills?.[statId]?.total || 0)
              : undefined;

            // Track max Treatment requirement (stat 124)
            if (statId === 124 && requiredValue > maxTreatmentRequired) {
              maxTreatmentRequired = requiredValue;
            }

            const implantReq: ImplantRequirement = {
              stat: statId,
              statName: req.statName,
              required: requiredValue,
              current: currentValue,
              met: currentValue !== undefined ? currentValue >= requiredValue : undefined,
            };

            // Add to this slot's requirement list
            slotRequirements[slotBitflag].push(implantReq);

            // Deduplicate: only keep max requirement per stat for global list
            const existing = maxRequirements.get(statId);
            if (!existing || requiredValue > existing.required) {
              maxRequirements.set(statId, implantReq);
            }
          }
        }
      } catch (err) {
        console.error(`[TinkerPlants] Failed to parse requirements for slot ${slotBitflag}:`, err);
        // Continue processing other slots
      }
    }

    // Calculate Treatment info
    if (hasProfile) {
      const profileTreatment = profile?.skills?.[124]?.total || 0;
      const delta = maxTreatmentRequired - profileTreatment;
      treatmentInfo.value = {
        required: maxTreatmentRequired,
        current: profileTreatment,
        delta: delta > 0 ? delta : 0,
        sufficient: profileTreatment >= maxTreatmentRequired,
      };
    } else {
      treatmentInfo.value = {
        required: maxTreatmentRequired,
        current: undefined,
        delta: undefined,
        sufficient: undefined,
      };
    }

    // Convert Map to array
    calculatedRequirements.value = Array.from(maxRequirements.values());

    // Update per-implant requirements
    perImplantRequirements.value = slotRequirements;

    console.log(
      '[TinkerPlants] Calculated requirements:',
      calculatedRequirements.value.length,
      'unique stats'
    );
    console.log(
      '[TinkerPlants] Per-implant requirements:',
      Object.keys(slotRequirements).length,
      'slots'
    );
    console.log(
      '[TinkerPlants] Treatment required:',
      maxTreatmentRequired,
      'current:',
      treatmentInfo.value.current
    );
  }

  /**
   * Set attribute preference for implant filtering
   *
   * @param attribute - Attribute name (Agility, Intelligence, Psychic, Sense, Stamina, Strength) or null for no preference
   */
  function setAttributePreference(attribute: string | null): void {
    attributePreference.value = attribute;
    // Note: Client-side filtering not yet implemented in lookupImplantForSlot()
    // Backend may not support attribute filtering yet
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Clear lookup cache
   * Forces fresh API calls for all subsequent lookups
   */
  function clearCache(): void {
    lookupCache.value.clear();
    console.log('[TinkerPlants] Cache cleared');
  }

  /**
   * Recalculate bonuses and requirements
   * Convenience method that triggers both calculateBonuses() and calculateRequirements()
   * Called automatically after configuration changes
   */
  function recalculate(): void {
    calculateBonuses();
    calculateRequirements();
  }

  /**
   * Reset store state
   * Clears all configuration, bonuses, requirements, and cache
   */
  function reset(): void {
    currentConfiguration.value = {};
    profileConfiguration.value = {};
    calculatedBonuses.value = {};
    calculatedRequirements.value = [];
    perImplantRequirements.value = {};
    treatmentInfo.value = {
      required: 0,
      current: undefined,
      delta: undefined,
      sufficient: undefined,
    };
    lookupCache.value.clear();
    debouncedLookups.value.clear();
    loading.value = false;
    error.value = null;
    slotLoading.value = {};
    console.log('[TinkerPlants] Store reset');
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    loading: readonly(loading),
    slotLoading: readonly(slotLoading),
    error: readonly(error),
    currentConfiguration: readonly(currentConfiguration),
    calculatedBonuses: readonly(calculatedBonuses),
    calculatedRequirements: readonly(calculatedRequirements),
    treatmentInfo: readonly(treatmentInfo),
    attributePreference: readonly(attributePreference),

    // Getters
    treatmentRequired,
    unmetRequirements,
    hasChanges,
    attributeRequirements,
    perImplantRequirementsList,

    // Actions
    loadFromProfile,
    saveToProfile,
    revertToProfile,
    updateSlot,
    setSlotType,
    setSymbiant,
    lookupImplantForSlot,
    lookupImplantForSlotDebounced,
    calculateBonuses,
    calculateRequirements,
    recalculate,
    clearError,
    clearCache,
    reset,
    setAttributePreference,
  };
});
