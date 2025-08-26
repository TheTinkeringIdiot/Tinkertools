import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { 
  NanoProgram, 
  NanoFilters, 
  NanosState, 
  NanoPreferences, 
  NanoSearchRequest,
  NanoApiResponse 
} from '@/types/nano';

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
    levelRange: [1, 220],
    memoryUsageRange: [0, 1000],
    nanoPointRange: [0, 2000],
    skillGapThreshold: null,
    skillCompatible: false,
    castable: false,
    sortBy: 'name',
    sortDescending: false
  });
  
  const preferences = ref<NanoPreferences>({
    defaultView: 'school',
    compactCards: true,
    autoExpandSchools: true,
    showCompatibility: false,
    defaultSort: 'name',
    itemsPerPage: 25
  });

  // Getters
  const filteredNanos = computed(() => {
    let result = [...nanos.value];
    
    // Apply school filter
    if (filters.value.schools.length > 0) {
      result = result.filter(nano => filters.value.schools.includes(nano.school));
    }
    
    // Apply strain filter
    if (filters.value.strains.length > 0) {
      result = result.filter(nano => filters.value.strains.includes(nano.strain));
    }
    
    // Apply profession filter
    if (filters.value.professions.length > 0) {
      result = result.filter(nano => 
        !nano.profession || filters.value.professions.includes(nano.profession)
      );
    }
    
    // Apply quality level filter
    if (filters.value.qualityLevels.length > 0) {
      result = result.filter(nano => filters.value.qualityLevels.includes(nano.qualityLevel));
    }
    
    // Apply effect type filter
    if (filters.value.effectTypes && filters.value.effectTypes.length > 0) {
      result = result.filter(nano => 
        nano.effects?.some(effect => filters.value.effectTypes!.includes(effect.type))
      );
    }
    
    // Apply level range filter
    if (filters.value.levelRange) {
      const [minLevel, maxLevel] = filters.value.levelRange;
      result = result.filter(nano => nano.level >= minLevel && nano.level <= maxLevel);
    }
    
    // Apply memory usage filter
    if (filters.value.memoryUsageRange) {
      const [minMemory, maxMemory] = filters.value.memoryUsageRange;
      result = result.filter(nano => {
        const memory = nano.memoryUsage || 0;
        return memory >= minMemory && memory <= maxMemory;
      });
    }
    
    // Apply nano point cost filter
    if (filters.value.nanoPointRange) {
      const [minNP, maxNP] = filters.value.nanoPointRange;
      result = result.filter(nano => {
        const np = nano.nanoPointCost || 0;
        return np >= minNP && np <= maxNP;
      });
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
            comparison = a.level - b.level;
            break;
          case 'qualityLevel':
            comparison = a.qualityLevel - b.qualityLevel;
            break;
          case 'school':
            comparison = a.school.localeCompare(b.school);
            break;
          case 'nanoPointCost':
            comparison = (a.nanoPointCost || 0) - (b.nanoPointCost || 0);
            break;
          case 'memoryUsage':
            comparison = (a.memoryUsage || 0) - (b.memoryUsage || 0);
            break;
          default:
            comparison = a.name.localeCompare(b.name);
        }
        
        return filters.value.sortDescending ? -comparison : comparison;
      });
    }
    
    return result;
  });
  
  const favoriteNanos = computed(() => {
    return nanos.value.filter(nano => favorites.value.includes(nano.id));
  });
  
  const availableSchools = computed(() => {
    const schools = new Set(nanos.value.map(nano => nano.school));
    return Array.from(schools).sort();
  });
  
  const availableStrains = computed(() => {
    const strains = new Set(nanos.value.map(nano => nano.strain).filter(Boolean));
    return Array.from(strains).sort();
  });
  
  const availableProfessions = computed(() => {
    const professions = new Set(nanos.value.map(nano => nano.profession).filter(Boolean));
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
      
      const response = await fetch(`http://localhost:8000/api/v1/nanos?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Map backend response to frontend format
      nanos.value = data.items.map((item: any) => ({
        id: item.id,
        aoid: item.aoid,
        name: item.name,
        ql: item.ql,
        qualityLevel: item.ql, // Map ql to qualityLevel for compatibility
        description: item.description,
        school: item.school,
        strain: item.strain,
        profession: item.profession,
        level: item.level,
        castingRequirements: item.casting_requirements || [],
        castingTime: item.casting_time,
        rechargeTime: item.recharge_time,
        memoryUsage: item.memory_usage,
        nanoPointCost: item.nano_point_cost,
        effects: item.effects || [],
        duration: item.duration,
        targeting: item.targeting,
        sourceLocation: item.source_location,
        acquisitionMethod: item.acquisition_method
      }));
      
      totalCount.value = data.total;
      
      // Save to localStorage for persistence
      saveNanosToStorage();
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch nanos';
      console.error('Failed to fetch nanos:', err);
      
      // Fallback to cached data if available
      loadNanosFromStorage();
    } finally {
      loading.value = false;
    }
  };

  const searchNanos = async (query: string, schools?: string[], fields?: string[]): Promise<void> => {
    loading.value = true;
    error.value = null;
    
    try {
      // Use the search endpoint if we have a query, otherwise use regular fetch
      if (query.trim()) {
        const params = new URLSearchParams();
        params.append('q', query.trim());
        params.append('page_size', '200');
        
        const response = await fetch(`http://localhost:8000/api/v1/nanos/search?${params}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Map backend response to frontend format
        nanos.value = data.items.map((item: any) => ({
          id: item.id,
          aoid: item.aoid,
          name: item.name,
          ql: item.ql,
          qualityLevel: item.ql,
          description: item.description,
          school: item.school,
          strain: item.strain,
          profession: item.profession,
          level: item.level,
          castingRequirements: item.casting_requirements || [],
          castingTime: item.casting_time,
          rechargeTime: item.recharge_time,
          memoryUsage: item.memory_usage,
          nanoPointCost: item.nano_point_cost,
          effects: item.effects || [],
          duration: item.duration,
          targeting: item.targeting,
          sourceLocation: item.source_location,
          acquisitionMethod: item.acquisition_method
        }));
        
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
      error.value = err instanceof Error ? err.message : 'Failed to search nanos';
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
      levelRange: [1, 220],
      memoryUsageRange: [0, 1000],
      nanoPointRange: [0, 2000],
      skillGapThreshold: null,
      skillCompatible: false,
      castable: false,
      sortBy: 'name',
      sortDescending: false
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
    return nanos.value.find(nano => nano.id === id);
  };

  const getNanosBySchool = (school: string): NanoProgram[] => {
    return nanos.value.filter(nano => nano.school === school);
  };

  const getNanosByStrain = (strain: string): NanoProgram[] => {
    return nanos.value.filter(nano => nano.strain === strain);
  };

  // Persistence helpers
  const saveNanosToStorage = (): void => {
    try {
      localStorage.setItem('tinkertools_nanos_cache', JSON.stringify({
        data: nanos.value,
        totalCount: totalCount.value,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save nanos to storage:', error);
    }
  };

  const loadNanosFromStorage = (): void => {
    try {
      const cached = localStorage.getItem('tinkertools_nanos_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only load if cached within last hour
        if (Date.now() - parsed.timestamp < 3600000) {
          nanos.value = parsed.data || [];
          totalCount.value = parsed.totalCount || 0;
        }
      }
    } catch (error) {
      console.warn('Failed to load nanos from storage:', error);
    }
  };

  const saveFavorites = (): void => {
    try {
      localStorage.setItem('tinkertools_nano_favorites', JSON.stringify(favorites.value));
    } catch (error) {
      console.warn('Failed to save favorites:', error);
    }
  };

  const loadFavorites = (): void => {
    try {
      const saved = localStorage.getItem('tinkertools_nano_favorites');
      if (saved) {
        favorites.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load favorites:', error);
    }
  };

  const saveFilters = (): void => {
    try {
      localStorage.setItem('tinkertools_nano_filters', JSON.stringify(filters.value));
    } catch (error) {
      console.warn('Failed to save filters:', error);
    }
  };

  const loadFilters = (): void => {
    try {
      const saved = localStorage.getItem('tinkertools_nano_filters');
      if (saved) {
        filters.value = { ...filters.value, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load filters:', error);
    }
  };

  const savePreferences = (): void => {
    try {
      localStorage.setItem('tinkertools_nano_preferences', JSON.stringify(preferences.value));
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  };

  const loadPreferences = (): void => {
    try {
      const saved = localStorage.getItem('tinkertools_nano_preferences');
      if (saved) {
        preferences.value = { ...preferences.value, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
  };

  const saveSearchHistory = (): void => {
    try {
      localStorage.setItem('tinkertools_nano_search_history', JSON.stringify(searchHistory.value));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  };

  const loadSearchHistory = (): void => {
    try {
      const saved = localStorage.getItem('tinkertools_nano_search_history');
      if (saved) {
        searchHistory.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  };

  const saveSelectedProfession = (): void => {
    try {
      localStorage.setItem('tinkertools_nano_selected_profession', JSON.stringify(selectedProfession.value));
    } catch (error) {
      console.warn('Failed to save selected profession:', error);
    }
  };

  const loadSelectedProfession = (): void => {
    try {
      const saved = localStorage.getItem('tinkertools_nano_selected_profession');
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
    initialize
  };
});

// Mock API function - replace with actual API implementation
async function mockFetchNanos(request?: NanoSearchRequest): Promise<NanoApiResponse> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock data - in real implementation, this would come from the backend API
  const mockNanos: NanoProgram[] = [
    {
      id: 1,
      name: 'Superior Heal',
      school: 'Biological Metamorphosis',
      strain: 'Heal Delta',
      description: 'Heals target for a large amount of health over time.',
      level: 125,
      qualityLevel: 175,
      profession: 'Doctor',
      nanoPointCost: 450,
      castingTime: 3,
      rechargeTime: 5,
      memoryUsage: 85,
      sourceLocation: 'Omni-Tek Shop',
      acquisitionMethod: 'Purchase',
      castingRequirements: [
        { type: 'skill', requirement: 'Biological Metamorphosis', value: 750, critical: true },
        { type: 'skill', requirement: 'Nano Programming', value: 600, critical: true },
        { type: 'level', requirement: 'level', value: 125, critical: true }
      ],
      effects: [
        {
          type: 'heal',
          value: 1250,
          modifier: 'add',
          stackable: false,
          conditions: []
        }
      ],
      duration: { type: 'instant' },
      targeting: { type: 'team', range: 30 }
    },
    {
      id: 2,
      name: 'Matter Armor',
      school: 'Matter Creation',
      strain: 'Protection Alpha',
      description: 'Creates protective armor around the target.',
      level: 100,
      qualityLevel: 150,
      nanoPointCost: 350,
      castingTime: 4,
      rechargeTime: 8,
      memoryUsage: 75,
      sourceLocation: 'Mission Terminal',
      acquisitionMethod: 'Mission Reward',
      castingRequirements: [
        { type: 'skill', requirement: 'Matter Creation', value: 650, critical: true },
        { type: 'skill', requirement: 'Nano Programming', value: 550, critical: true },
        { type: 'level', requirement: 'level', value: 100, critical: true }
      ],
      effects: [
        {
          type: 'protection',
          statId: 'AC',
          value: 200,
          modifier: 'add',
          stackable: false,
          conditions: []
        }
      ],
      duration: { type: 'duration', value: 1800 },
      targeting: { type: 'self' }
    },
    {
      id: 3,
      name: 'Summon Pet',
      school: 'Matter Creation',
      strain: 'Summon Beta',
      description: 'Summons a loyal pet to assist in combat.',
      level: 75,
      qualityLevel: 125,
      profession: 'Meta-Physicist',
      nanoPointCost: 500,
      castingTime: 6,
      rechargeTime: 2,
      memoryUsage: 120,
      sourceLocation: 'Temple of Three Winds',
      acquisitionMethod: 'Quest',
      castingRequirements: [
        { type: 'skill', requirement: 'Matter Creation', value: 500, critical: true },
        { type: 'skill', requirement: 'Nano Programming', value: 450, critical: true },
        { type: 'level', requirement: 'level', value: 75, critical: true }
      ],
      effects: [
        {
          type: 'summon',
          value: 1,
          modifier: 'set',
          stackable: false,
          conditions: []
        }
      ],
      duration: { type: 'duration', value: 3600 },
      targeting: { type: 'self' }
    }
  ];
  
  let filteredData = mockNanos;
  
  // Apply query filter
  if (request?.query) {
    const query = request.query.toLowerCase();
    filteredData = filteredData.filter(nano =>
      nano.name.toLowerCase().includes(query) ||
      nano.description?.toLowerCase().includes(query) ||
      nano.school.toLowerCase().includes(query)
    );
  }
  
  // Apply school filter
  if (request?.filters?.schools && request.filters.schools.length > 0) {
    filteredData = filteredData.filter(nano =>
      request.filters!.schools!.includes(nano.school)
    );
  }
  
  return {
    data: filteredData,
    total: filteredData.length,
    page: request?.page || 0,
    size: request?.size || filteredData.length
  };
}