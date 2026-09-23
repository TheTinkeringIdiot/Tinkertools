import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api-client';
import { versionKey, adoptLegacyKey } from '@/services/version-keys';
import { errorMessage } from '@/services/error-message';
import { SKILL_COST_FACTORS } from '@/services/game-data';
import { ABILITY_INDEX_TO_STAT_ID } from '@/lib/tinkerprofiles/ip-calculator';
import { mapProfileToStats } from '@/utils/profile-stats-mapper';
import { getNanoCompatibility } from '@/components/nanos/nano-compatibility';
import { useTinkerProfilesStore } from './tinkerProfiles';
import type {
  NanoProgram,
  NanoCompatibilityInfo,
  NanoFilters,
  NanoPreferences,
  NanoSearchRequest,
  NanoSchoolName,
  NanoEffect,
  EffectDuration,
  TargetingData,
} from '@/types/nano';
import type { Action } from '@/types/api';

/** A nano program as the /nanos endpoints return it */
interface BackendNanoProgram {
  id: number;
  aoid: number;
  name: string;
  ql: number;
  description?: string;
  school: NanoSchoolName | null;
  strain: string;
  /** Absent from responses of backends that predate it */
  professions?: string[];
  level: number | null;
  actions?: Action[];
  casting_time?: number;
  recharge_time?: number;
  memory_usage?: number;
  nano_point_cost?: number;
  effects?: NanoEffect[];
  duration?: EffectDuration;
  targeting?: TargetingData;
  source_location?: string;
  acquisition_method?: string;
}

function toNanoProgram(item: BackendNanoProgram): NanoProgram {
  return {
    id: item.id,
    aoid: item.aoid,
    name: item.name,
    qualityLevel: item.ql,
    description: item.description,
    school: item.school ?? null,
    strain: item.strain,
    professions: item.professions ?? [],
    level: item.level ?? null,
    actions: item.actions ?? [],
    castingTime: item.casting_time,
    rechargeTime: item.recharge_time,
    memoryUsage: item.memory_usage,
    nanoPointCost: item.nano_point_cost,
    effects: item.effects || [],
    duration: item.duration,
    targeting: item.targeting,
    sourceLocation: item.source_location,
    acquisitionMethod: item.acquisition_method,
  };
}

/** Stats a character raises with IP: the six abilities and every trainable skill */
const SKILL_STAT_IDS = new Set([
  ...ABILITY_INDEX_TO_STAT_ID,
  ...Object.keys(SKILL_COST_FACTORS).map(Number),
]);

/**
 * How many points the character's skills fall short of casting the nano: the
 * largest shortfall among its unmet requirements, 0 when it can be cast. Null
 * when something no skill can fix (profession, level, a flag...) blocks it.
 */
export function nanoSkillGap(info: NanoCompatibilityInfo): number | null {
  if (info.canCast) return 0;
  if (info.unmetRequirements.length === 0) return null;

  let gap = 0;
  for (const req of info.unmetRequirements) {
    if (!SKILL_STAT_IDS.has(req.stat) || req.operator !== '≥') return null;
    gap = Math.max(gap, req.required - req.current);
  }
  return gap;
}

/** True when no unmet requirement of the nano is on a skill or ability */
export function meetsNanoSkillRequirements(info: NanoCompatibilityInfo): boolean {
  return info.unmetRequirements.every((req) => !SKILL_STAT_IDS.has(req.stat));
}

/** The level range the level filter spans (NanoFilters' slider) */
const MIN_LEVEL = 1;
const MAX_LEVEL = 220;

/**
 * Per-version keys: the nano list is server data and favorites are AOID-keyed,
 * so both mean something different in every game version.
 */
export const NANOS_CACHE_BASE = 'tinkertools_nanos_cache';
const FAVORITES_BASE = 'tinkertools_nano_favorites';

/**
 * Global keys: filters, display preferences, free-text search history and the
 * selected profession are UI state, identical in every version.
 */
const FILTERS_KEY = 'tinkertools_nano_filters';
const PREFERENCES_KEY = 'tinkertools_nano_preferences';
const SEARCH_HISTORY_KEY = 'tinkertools_nano_search_history';
const SELECTED_PROFESSION_KEY = 'tinkertools_nano_selected_profession';

export const useNanosStore = defineStore('nanos', () => {
  // State
  const nanos = ref<NanoProgram[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);
  const selectedNano = ref<NanoProgram | null>(null);
  const selectedProfession = ref<number | null>(null);
  const favorites = ref<number[]>([]);
  const searchHistory = ref<string[]>([]);

  const filters = ref<NanoFilters>({
    schools: [],
    strains: [],
    professions: [],
    qualityLevels: [],
    effectTypes: [],
    durationType: [],
    targetTypes: [],
    levelRange: [MIN_LEVEL, MAX_LEVEL],
    memoryUsageRange: [0, 1000],
    nanoPointRange: [0, 2000],
    skillGapThreshold: null,
    skillCompatible: false,
    castable: false,
    sortBy: 'name',
    sortDescending: false,
  });

  const preferences = ref<NanoPreferences>({
    defaultView: 'school',
    compactCards: true,
    autoExpandSchools: true,
    showCompatibility: false,
    defaultSort: 'name',
    itemsPerPage: 25,
  });

  // Getters

  /**
   * The profile compatibility is shown for: the app's active profile, while
   * the user has compatibility switched on.
   */
  const compatibilityProfile = computed(() =>
    // The profiles store is looked up lazily, as other stores do
    preferences.value.showCompatibility ? useTinkerProfilesStore().activeProfile : null
  );

  /**
   * Casting compatibility of every loaded nano (by nano ID) with the
   * compatibility profile, or null when compatibility is off. The profile's
   * stat map is built once per profile change, not once per nano.
   */
  const nanoCompatibility = computed(() => {
    const profile = compatibilityProfile.value;
    if (!profile) return null;

    const characterStats = mapProfileToStats(profile);
    return new Map(
      nanos.value.map((nano) => [nano.id, getNanoCompatibility(nano, characterStats)])
    );
  });

  const filteredNanos = computed(() => {
    let result = [...nanos.value];

    // Apply school filter
    if (filters.value.schools.length > 0) {
      result = result.filter(
        (nano) => nano.school !== null && filters.value.schools.includes(nano.school)
      );
    }

    // Apply strain filter
    if (filters.value.strains.length > 0) {
      result = result.filter((nano) => filters.value.strains.includes(nano.strain));
    }

    // Apply profession filter; nanos any profession can cast always pass
    if (filters.value.professions.length > 0) {
      result = result.filter(
        (nano) =>
          nano.professions.length === 0 ||
          nano.professions.some((profession) => filters.value.professions.includes(profession))
      );
    }

    // Apply quality level filter
    if (filters.value.qualityLevels.length > 0) {
      result = result.filter((nano) => filters.value.qualityLevels.includes(nano.qualityLevel));
    }

    // Apply effect type filter
    if (filters.value.effectTypes && filters.value.effectTypes.length > 0) {
      result = result.filter((nano) =>
        nano.effects?.some((effect) => filters.value.effectTypes!.includes(effect.type))
      );
    }

    // Apply level range filter. The full range filters nothing; a narrowed one
    // also drops nanos without a level (no Use action, so not player-castable).
    if (filters.value.levelRange) {
      const [minLevel, maxLevel] = filters.value.levelRange;
      if (minLevel > MIN_LEVEL || maxLevel < MAX_LEVEL) {
        result = result.filter(
          (nano) => nano.level !== null && nano.level >= minLevel && nano.level <= maxLevel
        );
      }
    }

    // Apply memory usage filter
    if (filters.value.memoryUsageRange) {
      const [minMemory, maxMemory] = filters.value.memoryUsageRange;
      result = result.filter((nano) => {
        const memory = nano.memoryUsage || 0;
        return memory >= minMemory && memory <= maxMemory;
      });
    }

    // Apply nano point cost filter
    if (filters.value.nanoPointRange) {
      const [minNP, maxNP] = filters.value.nanoPointRange;
      result = result.filter((nano) => {
        const np = nano.nanoPointCost || 0;
        return np >= minNP && np <= maxNP;
      });
    }

    // Apply compatibility filters, while compatibility is shown
    const compatibility = nanoCompatibility.value;
    if (compatibility) {
      const infoOf = (nano: NanoProgram) => compatibility.get(nano.id);

      if (filters.value.castable) {
        result = result.filter((nano) => infoOf(nano)?.canCast);
      }

      if (filters.value.skillCompatible) {
        result = result.filter((nano) => {
          const info = infoOf(nano);
          return !!info && meetsNanoSkillRequirements(info);
        });
      }

      const threshold = filters.value.skillGapThreshold;
      if (threshold != null) {
        result = result.filter((nano) => {
          const info = infoOf(nano);
          const gap = info ? nanoSkillGap(info) : null;
          return gap !== null && gap <= threshold;
        });
      }
    }

    // Apply sorting
    if (filters.value.sortBy) {
      result.sort((a, b) => {
        let comparison = 0;

        switch (filters.value.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'level':
            // Nanos without a level sort after every level
            comparison =
              (a.level ?? Number.MAX_SAFE_INTEGER) - (b.level ?? Number.MAX_SAFE_INTEGER);
            break;
          case 'qualityLevel':
            comparison = a.qualityLevel - b.qualityLevel;
            break;
          case 'school':
            comparison = (a.school ?? '').localeCompare(b.school ?? '');
            break;
          case 'nanoPointCost':
            comparison = (a.nanoPointCost || 0) - (b.nanoPointCost || 0);
            break;
          case 'memoryUsage':
            comparison = (a.memoryUsage || 0) - (b.memoryUsage || 0);
            break;
          case 'compatibility': {
            // Without compatibility every score is 0, so this sorts by name
            const score = (nano: NanoProgram) =>
              compatibility?.get(nano.id)?.compatibilityScore ?? 0;
            comparison = score(a) - score(b) || a.name.localeCompare(b.name);
            break;
          }
          default:
            comparison = a.name.localeCompare(b.name);
        }

        return filters.value.sortDescending ? -comparison : comparison;
      });
    }

    return result;
  });

  const favoriteNanos = computed(() => {
    return nanos.value.filter((nano) => favorites.value.includes(nano.id));
  });

  const availableSchools = computed(() => {
    // The backend sends school: null for nanos it has no school for.
    const schools = new Set(
      nanos.value
        .map((nano) => nano.school)
        .filter((school): school is NanoSchoolName => school !== null)
    );
    return Array.from(schools).sort();
  });

  const availableStrains = computed(() => {
    const strains = new Set(nanos.value.map((nano) => nano.strain).filter(Boolean));
    return Array.from(strains).sort();
  });

  const availableProfessions = computed(() => {
    const professions = new Set(nanos.value.flatMap((nano) => nano.professions));
    return Array.from(professions).sort();
  });

  // Actions
  const fetchNanos = async (searchRequest?: NanoSearchRequest): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // Call the real nano API endpoint
      const params = new URLSearchParams();

      // Add pagination
      params.append('page', '1');
      params.append('page_size', '200'); // Get more items for frontend filtering

      // Add basic filters that the backend supports
      if (searchRequest?.filters?.schools?.length) {
        params.append('school', searchRequest.filters.schools[0]); // Backend supports one school filter
      }

      const data = await apiClient.getPaginated<BackendNanoProgram>(`/nanos?${params}`);

      // Map backend response to frontend format
      nanos.value = data.items.map(toNanoProgram);

      totalCount.value = data.total;

      // Save to localStorage for persistence
      saveNanosToStorage();
    } catch (err) {
      error.value = errorMessage(err) || 'Failed to fetch nanos';
      console.error('Failed to fetch nanos:', err);

      // Fallback to cached data if available
      loadNanosFromStorage();
    } finally {
      loading.value = false;
    }
  };

  const searchNanos = async (
    query: string,
    // The search endpoint takes only the text query; callers pass their UI
    // filters too, which are applied client-side.
    /* eslint-disable @typescript-eslint/no-unused-vars -- see above */
    schools?: string[],
    fields?: string[]
    /* eslint-enable @typescript-eslint/no-unused-vars */
  ): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // Use the search endpoint if we have a query, otherwise use regular fetch
      if (query.trim()) {
        const params = new URLSearchParams();
        params.append('q', query.trim());
        params.append('page_size', '200');

        const data = await apiClient.getPaginated<BackendNanoProgram>(`/nanos/search?${params}`);

        // Map backend response to frontend format
        nanos.value = data.items.map(toNanoProgram);

        totalCount.value = data.total;
      } else {
        // No search query, fetch all nanos
        await fetchNanos();
      }

      // Add to search history
      if (query.trim() && !searchHistory.value.includes(query.trim())) {
        searchHistory.value.unshift(query.trim());
        searchHistory.value = searchHistory.value.slice(0, 10); // Keep only 10 recent searches
        saveSearchHistory();
      }
    } catch (err) {
      error.value = errorMessage(err) || 'Failed to search nanos';
      console.error('Failed to search nanos:', err);
    } finally {
      loading.value = false;
    }
  };

  const setFilters = (newFilters: Partial<NanoFilters>): void => {
    filters.value = { ...filters.value, ...newFilters };
    saveFilters();
  };

  const clearFilters = (): void => {
    filters.value = {
      schools: [],
      strains: [],
      professions: [],
      qualityLevels: [],
      effectTypes: [],
      durationType: [],
      targetTypes: [],
      levelRange: [MIN_LEVEL, MAX_LEVEL],
      memoryUsageRange: [0, 1000],
      nanoPointRange: [0, 2000],
      skillGapThreshold: null,
      skillCompatible: false,
      castable: false,
      sortBy: 'name',
      sortDescending: false,
    };
    saveFilters();
  };

  const selectNano = (nano: NanoProgram | null): void => {
    selectedNano.value = nano;
  };

  const setSelectedProfession = (professionId: number | null): void => {
    selectedProfession.value = professionId;
    saveSelectedProfession();
  };

  const toggleFavorite = (nanoId: number): void => {
    const index = favorites.value.indexOf(nanoId);
    if (index > -1) {
      favorites.value.splice(index, 1);
    } else {
      favorites.value.push(nanoId);
    }
    saveFavorites();
  };

  const addToFavorites = (nanoId: number): void => {
    if (!favorites.value.includes(nanoId)) {
      favorites.value.push(nanoId);
      saveFavorites();
    }
  };

  const removeFromFavorites = (nanoId: number): void => {
    const index = favorites.value.indexOf(nanoId);
    if (index > -1) {
      favorites.value.splice(index, 1);
      saveFavorites();
    }
  };

  const updatePreferences = (newPreferences: Partial<NanoPreferences>): void => {
    preferences.value = { ...preferences.value, ...newPreferences };
    savePreferences();
  };

  const getNanoById = (id: number): NanoProgram | undefined => {
    return nanos.value.find((nano) => nano.id === id);
  };

  const getNanosBySchool = (school: string): NanoProgram[] => {
    return nanos.value.filter((nano) => nano.school === school);
  };

  const getNanosByStrain = (strain: string): NanoProgram[] => {
    return nanos.value.filter((nano) => nano.strain === strain);
  };

  // Persistence helpers
  const saveNanosToStorage = (): void => {
    try {
      localStorage.setItem(
        versionKey(NANOS_CACHE_BASE),
        JSON.stringify({
          data: nanos.value,
          totalCount: totalCount.value,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn('Failed to save nanos to storage:', error);
    }
  };

  const loadNanosFromStorage = (): void => {
    try {
      // Adopt a pre-version cache as this version's data on first load.
      adoptLegacyKey(NANOS_CACHE_BASE);
      const cached = localStorage.getItem(versionKey(NANOS_CACHE_BASE));
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only load if cached within last hour
        if (Date.now() - parsed.timestamp < 3600000) {
          // A cache written before nanos carried professions lacks the list
          nanos.value = ((parsed.data || []) as NanoProgram[]).map((nano) => ({
            ...nano,
            professions: nano.professions ?? [],
          }));
          totalCount.value = parsed.totalCount || 0;
        }
      }
    } catch (error) {
      console.warn('Failed to load nanos from storage:', error);
    }
  };

  const saveFavorites = (): void => {
    try {
      localStorage.setItem(versionKey(FAVORITES_BASE), JSON.stringify(favorites.value));
    } catch (error) {
      console.warn('Failed to save favorites:', error);
    }
  };

  const loadFavorites = (): void => {
    try {
      adoptLegacyKey(FAVORITES_BASE);
      const saved = localStorage.getItem(versionKey(FAVORITES_BASE));
      if (saved) {
        favorites.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load favorites:', error);
    }
  };

  const saveFilters = (): void => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters.value));
    } catch (error) {
      console.warn('Failed to save filters:', error);
    }
  };

  const loadFilters = (): void => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY);
      if (saved) {
        filters.value = { ...filters.value, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load filters:', error);
    }
  };

  const savePreferences = (): void => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences.value));
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  };

  const loadPreferences = (): void => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        preferences.value = { ...preferences.value, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
  };

  const saveSearchHistory = (): void => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  };

  const loadSearchHistory = (): void => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        searchHistory.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  };

  const saveSelectedProfession = (): void => {
    try {
      localStorage.setItem(SELECTED_PROFESSION_KEY, JSON.stringify(selectedProfession.value));
    } catch (error) {
      console.warn('Failed to save selected profession:', error);
    }
  };

  const loadSelectedProfession = (): void => {
    try {
      const saved = localStorage.getItem(SELECTED_PROFESSION_KEY);
      if (saved) {
        selectedProfession.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load selected profession:', error);
    }
  };

  // Initialize store
  const initialize = (): void => {
    loadNanosFromStorage();
    loadFavorites();
    loadFilters();
    loadPreferences();
    loadSearchHistory();
    loadSelectedProfession();
  };

  /**
   * Drop the nano list and its persisted copy for the active game version.
   * UI preferences, filters and favorites survive.
   */
  const clearCache = (): void => {
    nanos.value = [];
    totalCount.value = 0;
    selectedNano.value = null;
    error.value = null;

    try {
      localStorage.removeItem(versionKey(NANOS_CACHE_BASE));
    } catch (err) {
      console.warn('Failed to clear nano cache:', err);
    }
  };

  /**
   * Re-point the store at the game version just switched to: drop the old
   * version's in-memory list, then load this version's persisted nano cache
   * and favorites. Nothing persisted is deleted; other versions' nano caches
   * are reclaimed by purgeOtherVersionCaches(), and their favorites are kept.
   */
  const resetForVersionChange = (): void => {
    nanos.value = [];
    totalCount.value = 0;
    selectedNano.value = null;
    error.value = null;
    favorites.value = [];
    loadNanosFromStorage();
    loadFavorites();
  };

  // Call initialize immediately
  initialize();

  return {
    // State
    nanos: nanos as Readonly<typeof nanos>,
    loading: loading as Readonly<typeof loading>,
    error: error as Readonly<typeof error>,
    totalCount: totalCount as Readonly<typeof totalCount>,
    selectedNano: selectedNano as Readonly<typeof selectedNano>,
    selectedProfession: selectedProfession as Readonly<typeof selectedProfession>,
    favorites: favorites as Readonly<typeof favorites>,
    filters: filters as Readonly<typeof filters>,
    preferences: preferences as Readonly<typeof preferences>,
    searchHistory: searchHistory as Readonly<typeof searchHistory>,

    // Getters
    compatibilityProfile,
    nanoCompatibility,
    filteredNanos,
    favoriteNanos,
    availableSchools,
    availableStrains,
    availableProfessions,

    // Actions
    fetchNanos,
    searchNanos,
    setFilters,
    clearFilters,
    selectNano,
    setSelectedProfession,
    toggleFavorite,
    addToFavorites,
    removeFromFavorites,
    updatePreferences,
    getNanoById,
    getNanosBySchool,
    getNanosByStrain,
    initialize,
    clearCache,
    resetForVersionChange,
  };
});
