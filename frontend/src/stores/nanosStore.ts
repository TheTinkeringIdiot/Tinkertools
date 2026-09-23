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
  NanoSchoolName,
  NanoSortField,
  NanoStrainOption,
  NanoEffect,
  EffectDuration,
  TargetingData,
} from '@/types/nano';
import type { Action, PaginatedResponse } from '@/types/api';

/** A nano program as the /nanos endpoints return it */
interface BackendNanoProgram {
  id: number;
  aoid: number;
  name: string;
  ql: number;
  description?: string;
  school: NanoSchoolName | null;
  /** Absent from responses of backends that predate it */
  strain_id?: number | null;
  strain: string | null;
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
    strainId: item.strain_id ?? null,
    strain: item.strain ?? null,
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
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 220;

/** The QL range the QL filter spans; nano QLs run up to 390 */
export const MIN_QL = 1;
export const MAX_QL = 400;

/** Nanos per page when the server pages the results */
export const DEFAULT_PAGE_SIZE = 25;

/** The largest page the /nanos endpoints serve */
const MAX_PAGE_SIZE = 200;

/**
 * Most nanos the compatibility filters fetch. They run client-side over every
 * nano the server filters match, so beyond this the user narrows those first.
 * A profession alone matches at most about 2,000 nanos (Nano-Technician, 2,019
 * in ao-2024-02); at roughly 550 bytes a nano the cap is about 1.4 MB.
 */
export const COMPATIBILITY_FETCH_CAP = 2500;

const SERVER_SORT_FIELDS: Record<Exclude<NanoSortField, 'compatibility'>, string> = {
  name: 'name',
  qualityLevel: 'ql',
  level: 'level',
};

export function defaultNanoFilters(): NanoFilters {
  return {
    schools: [],
    strainIds: [],
    professions: [],
    qlRange: [MIN_QL, MAX_QL],
    levelRange: [MIN_LEVEL, MAX_LEVEL],
    skillGapThreshold: null,
    skillCompatible: false,
    castable: false,
    sortBy: 'name',
    sortDescending: false,
  };
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'number');

const isRange = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number');

/**
 * Filters as saved by any earlier version: fields that no longer exist (effect
 * types, durations, targets, memory and nano point ranges, QL checkboxes,
 * strain names) are dropped, and anything malformed falls back to its default.
 */
export function restoreNanoFilters(saved: unknown): NanoFilters {
  const filters = defaultNanoFilters();
  if (!saved || typeof saved !== 'object') return filters;
  const value = saved as Record<string, unknown>;

  if (isStringList(value.schools)) filters.schools = value.schools;
  if (isNumberList(value.strainIds)) filters.strainIds = value.strainIds;
  if (isStringList(value.professions)) filters.professions = value.professions;
  if (isRange(value.qlRange)) filters.qlRange = value.qlRange;
  if (isRange(value.levelRange)) filters.levelRange = value.levelRange;
  if (typeof value.skillGapThreshold === 'number') {
    filters.skillGapThreshold = value.skillGapThreshold;
  }
  if (typeof value.skillCompatible === 'boolean') filters.skillCompatible = value.skillCompatible;
  if (typeof value.castable === 'boolean') filters.castable = value.castable;
  if (
    typeof value.sortBy === 'string' &&
    (value.sortBy === 'compatibility' || value.sortBy in SERVER_SORT_FIELDS)
  ) {
    filters.sortBy = value.sortBy as NanoSortField;
  }
  if (typeof value.sortDescending === 'boolean') filters.sortDescending = value.sortDescending;
  return filters;
}

/**
 * The text query and every server-side filter but strain, as /nanos/strains
 * takes them: it lists the strains the other filters leave. Full ranges are
 * left out.
 */
export function nanoStrainQueryParams(filters: NanoFilters, query: string): URLSearchParams {
  const params = new URLSearchParams();
  if (query.trim()) params.append('q', query.trim());
  filters.schools.forEach((school) => params.append('school', school));
  filters.professions.forEach((profession) => params.append('profession', profession));

  const [qlMin, qlMax] = filters.qlRange;
  if (qlMin > MIN_QL) params.append('ql_min', String(qlMin));
  if (qlMax < MAX_QL) params.append('ql_max', String(qlMax));

  const [levelMin, levelMax] = filters.levelRange;
  if (levelMin > MIN_LEVEL) params.append('level_min', String(levelMin));
  if (levelMax < MAX_LEVEL) params.append('level_max', String(levelMax));
  return params;
}

/**
 * The /nanos (or, with a text query, /nanos/search) query for the server-side
 * filters and sort, without paging
 */
export function nanoQueryParams(filters: NanoFilters, query: string): URLSearchParams {
  const params = nanoStrainQueryParams(filters, query);
  filters.strainIds.forEach((strainId) => params.append('strain', String(strainId)));

  if (filters.sortBy !== 'compatibility') {
    params.append('sort_by', SERVER_SORT_FIELDS[filters.sortBy]);
    if (filters.sortDescending) params.append('sort_desc', 'true');
  }
  return params;
}

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

  /** The nanos loaded: one server page, or every match while compatibility filters */
  const nanos = ref<NanoProgram[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  /** How many nanos the server filters match */
  const totalCount = ref(0);
  /** The server page loaded (1-based), while the server pages the results */
  const page = ref(1);
  const pageSize = ref(DEFAULT_PAGE_SIZE);
  /** The text query sent to /nanos/search; empty lists /nanos */
  const searchQuery = ref('');
  /**
   * How many nanos matched when there were too many to fetch for the
   * compatibility filters (over COMPATIBILITY_FETCH_CAP); null otherwise
   */
  const compatibilityOverflow = ref<number | null>(null);
  const selectedNano = ref<NanoProgram | null>(null);
  const selectedProfession = ref<number | null>(null);
  const favorites = ref<number[]>([]);
  const searchHistory = ref<string[]>([]);

  const filters = ref<NanoFilters>(defaultNanoFilters());

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

  /**
   * Whether the results need every nano the server filters match: a
   * compatibility filter or sort is in force, and those run client-side.
   */
  const needsAllResults = computed(
    () =>
      compatibilityProfile.value !== null &&
      (filters.value.castable ||
        filters.value.skillCompatible ||
        filters.value.skillGapThreshold !== null ||
        filters.value.sortBy === 'compatibility')
  );

  /** What the server is asked for; a change means reloading from page 1 */
  const requestKey = computed(() =>
    JSON.stringify({
      query: nanoQueryParams(filters.value, searchQuery.value).toString(),
      all: needsAllResults.value,
      pageSize: pageSize.value,
    })
  );

  /**
   * The nanos to show. The server has already filtered and sorted them; the
   * compatibility filters and sort are applied here, over every match.
   */
  const filteredNanos = computed(() => {
    const compatibility = nanoCompatibility.value;
    if (!needsAllResults.value || !compatibility) return nanos.value;

    const infoOf = (nano: NanoProgram) => compatibility.get(nano.id);
    let result = [...nanos.value];

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
    if (threshold !== null) {
      result = result.filter((nano) => {
        const info = infoOf(nano);
        const gap = info ? nanoSkillGap(info) : null;
        return gap !== null && gap <= threshold;
      });
    }

    if (filters.value.sortBy === 'compatibility') {
      const score = (nano: NanoProgram) => infoOf(nano)?.compatibilityScore ?? 0;
      result.sort((a, b) => {
        const comparison = score(a) - score(b) || a.name.localeCompare(b.name);
        return filters.value.sortDescending ? -comparison : comparison;
      });
    }

    return result;
  });

  /** How many nanos the current filters match, compatibility filters included */
  const resultCount = computed(() => {
    if (compatibilityOverflow.value !== null) return compatibilityOverflow.value;
    return needsAllResults.value ? filteredNanos.value.length : totalCount.value;
  });

  const favoriteNanos = computed(() => {
    return nanos.value.filter((nano) => favorites.value.includes(nano.id));
  });

  const availableSchools = computed(() => {
    const schools = new Set(
      nanos.value
        .map((nano) => nano.school)
        .filter((school): school is NanoSchoolName => school !== null)
    );
    return Array.from(schools).sort();
  });

  /** The strains the filters but strain leave, for the strain picker */
  const strainOptions = ref<NanoStrainOption[]>([]);

  /** What /nanos/strains is asked for; a change means reloading the strains */
  const strainRequestKey = computed(() =>
    nanoStrainQueryParams(filters.value, searchQuery.value).toString()
  );

  const availableProfessions = computed(() => {
    const professions = new Set(nanos.value.flatMap((nano) => nano.professions));
    return Array.from(professions).sort();
  });

  // Actions

  /** Responses to a superseded request are dropped */
  let requestSequence = 0;

  const getNanoPage = (
    path: string,
    params: URLSearchParams,
    pageNumber: number,
    size: number
  ): Promise<PaginatedResponse<BackendNanoProgram>> => {
    const query = new URLSearchParams(params);
    query.append('page', String(pageNumber));
    query.append('page_size', String(size));
    return apiClient.getPaginated<BackendNanoProgram>(`${path}?${query}`);
  };

  /**
   * Load the nanos matching the filters and text query. Normally that is one
   * server page; while a compatibility filter is on it is every match, unless
   * there are more than COMPATIBILITY_FETCH_CAP of them.
   */
  const loadNanos = async (pageNumber = 1): Promise<void> => {
    const request = ++requestSequence;
    loading.value = true;
    error.value = null;
    // The list shows the spinner meanwhile, not a stale "too many" message
    compatibilityOverflow.value = null;

    const path = searchQuery.value.trim() ? '/nanos/search' : '/nanos';
    const params = nanoQueryParams(filters.value, searchQuery.value);

    try {
      if (needsAllResults.value) {
        const first = await getNanoPage(path, params, 1, MAX_PAGE_SIZE);
        if (request !== requestSequence) return;

        if (first.total > COMPATIBILITY_FETCH_CAP) {
          nanos.value = [];
          compatibilityOverflow.value = first.total;
        } else {
          const rest = await Promise.all(
            Array.from({ length: first.pages - 1 }, (_, index) =>
              getNanoPage(path, params, index + 2, MAX_PAGE_SIZE)
            )
          );
          if (request !== requestSequence) return;
          nanos.value = [first, ...rest].flatMap((data) => data.items.map(toNanoProgram));
          compatibilityOverflow.value = null;
        }
        totalCount.value = first.total;
        page.value = 1;
      } else {
        const data = await getNanoPage(path, params, pageNumber, pageSize.value);
        if (request !== requestSequence) return;
        nanos.value = data.items.map(toNanoProgram);
        totalCount.value = data.total;
        page.value = pageNumber;
        compatibilityOverflow.value = null;
      }

      saveNanosToStorage();
    } catch (err) {
      if (request !== requestSequence) return;
      error.value = errorMessage(err) || 'Failed to fetch nanos';
      console.error('Failed to fetch nanos:', err);

      // Fallback to cached data if available
      loadNanosFromStorage();
    } finally {
      if (request === requestSequence) loading.value = false;
    }
  };

  let strainRequestSequence = 0;

  /** Load the strains for the strain picker; a failure just leaves it empty */
  const loadStrainOptions = async (): Promise<void> => {
    const request = ++strainRequestSequence;
    const params = nanoStrainQueryParams(filters.value, searchQuery.value);
    try {
      const response = await apiClient.get<{ strains: NanoStrainOption[] }>(
        `/nanos/strains?${params}`
      );
      if (request !== strainRequestSequence) return;
      strainOptions.value = response.data?.strains ?? [];
    } catch (err) {
      if (request !== strainRequestSequence) return;
      console.warn('Failed to load nano strains:', err);
      strainOptions.value = [];
    }
  };

  /** Load the first page of the current filters and query */
  const fetchNanos = (): Promise<void> => loadNanos(1);

  /**
   * Show another page. While every match is loaded for the compatibility
   * filters the list pages them itself, so this only records the page size.
   */
  const setPage = async (pageNumber: number, size: number = pageSize.value): Promise<void> => {
    if (size !== pageSize.value) {
      pageSize.value = size;
      pageNumber = 1;
    }
    if (!needsAllResults.value) await loadNanos(pageNumber);
  };

  /** Set the text query; loading is up to the caller */
  const setSearchQuery = (query: string): void => {
    searchQuery.value = query;
    const term = query.trim();
    if (term && !searchHistory.value.includes(term)) {
      searchHistory.value.unshift(term);
      searchHistory.value = searchHistory.value.slice(0, 10); // Keep only 10 recent searches
      saveSearchHistory();
    }
  };

  /** Search by text (and the current filters), from the first page */
  const searchNanos = async (query: string): Promise<void> => {
    setSearchQuery(query);
    await loadNanos(1);
  };

  const setFilters = (newFilters: Partial<NanoFilters>): void => {
    filters.value = { ...filters.value, ...newFilters };
    saveFilters();
  };

  const clearFilters = (): void => {
    filters.value = defaultNanoFilters();
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
        filters.value = restoreNanoFilters(JSON.parse(saved));
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
    page.value = 1;
    compatibilityOverflow.value = null;
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
    page: page as Readonly<typeof page>,
    pageSize: pageSize as Readonly<typeof pageSize>,
    searchQuery: searchQuery as Readonly<typeof searchQuery>,
    compatibilityOverflow: compatibilityOverflow as Readonly<typeof compatibilityOverflow>,
    selectedNano: selectedNano as Readonly<typeof selectedNano>,
    selectedProfession: selectedProfession as Readonly<typeof selectedProfession>,
    favorites: favorites as Readonly<typeof favorites>,
    filters: filters as Readonly<typeof filters>,
    preferences: preferences as Readonly<typeof preferences>,
    searchHistory: searchHistory as Readonly<typeof searchHistory>,

    // Getters
    compatibilityProfile,
    nanoCompatibility,
    needsAllResults,
    requestKey,
    filteredNanos,
    resultCount,
    favoriteNanos,
    availableSchools,
    strainOptions: strainOptions as Readonly<typeof strainOptions>,
    strainRequestKey,
    availableProfessions,

    // Actions
    loadNanos,
    fetchNanos,
    loadStrainOptions,
    setPage,
    setSearchQuery,
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
