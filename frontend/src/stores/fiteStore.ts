import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  Weapon,
  CharacterSkills,
  WeaponFilters,
  WeaponUsability,
  WeaponRequirement,
  WeaponSearchRequest,
  WeaponApiResponse,
} from '@/types/weapon';
import { SKILL_NAMES } from '@/types/weapon';

export const useFiteStore = defineStore('fite', () => {
  // State
  const weapons = ref<Weapon[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);
  const characterSkills = ref<CharacterSkills>({});
  const selectedWeapon = ref<Weapon | null>(null);
  const comparisonWeapons = ref<Weapon[]>([]);

  // Computed
  const totalWeapons = computed(() => totalCount.value);

  const availableWeaponTypes = computed(() => {
    const types = new Set(weapons.value.map((weapon) => weapon.item_class));
    return Array.from(types).sort();
  });

  const availableQualityLevels = computed(() => {
    const qls = new Set(weapons.value.map((weapon) => weapon.ql));
    return Array.from(qls).sort((a, b) => a - b);
  });

  // Actions
  const fetchWeapons = async (searchRequest?: WeaponSearchRequest): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('page_size', '200');

      // Filter to weapons only (not armor, implants, etc.)
      params.append('item_class', '1');

      // Add filters if provided
      if (searchRequest?.filters?.qualityLevels?.length) {
        // For now, use the first QL range (would need backend enhancement for proper range filtering)
        params.append('min_ql', searchRequest.filters.qualityLevels[0].toString());
      }

      const response = await fetch(`http://localhost:8000/api/v1/items?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter to items that have weapon stats (attack/defense related stats)
      weapons.value = data.items.filter((item: any) => {
        // Check if item has weapon-related stats
        return item.stats && item.stats.length > 0 && isLikelyWeapon(item);
      });

      totalCount.value = weapons.value.length;

      // Save to localStorage for caching
      saveWeaponsToStorage();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch weapons';
      console.error('Failed to fetch weapons:', err);

      // Fallback to cached data if available
      loadWeaponsFromStorage();
    } finally {
      loading.value = false;
    }
  };

  const searchWeapons = async (query: string): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      params.append('q', query.trim());
      params.append('page_size', '200');

      const response = await fetch(`http://localhost:8000/api/v1/items/search?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter to weapons only
      weapons.value = data.items.filter((item: any) => {
        return item.item_class === 1 && isLikelyWeapon(item);
      });

      totalCount.value = data.total;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to search weapons';
      console.error('Failed to search weapons:', err);
    } finally {
      loading.value = false;
    }
  };

  // Check if an item is likely a weapon based on its stats
  const isLikelyWeapon = (item: any): boolean => {
    if (!item.stats || item.stats.length === 0) return false;

    // Look for weapon skill requirements or attack-related stats
    const weaponSkillIds = [
      100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 152,
    ]; // Weapon skills + Martial Arts
    const attackStatIds = [2, 7, 30]; // Common attack-related stat IDs (damage, attack rating, etc.)

    return item.stats.some(
      (stat: any) => weaponSkillIds.includes(stat.stat) || attackStatIds.includes(stat.stat)
    );
  };

  const checkWeaponUsability = (weapon: Weapon, skills: CharacterSkills): WeaponUsability => {
    const requirements: WeaponRequirement[] = [];
    const missingRequirements: WeaponRequirement[] = [];

    // Check each stat requirement
    weapon.stats.forEach((stat) => {
      const skillName = SKILL_NAMES[stat.stat];
      if (skillName) {
        const characterValue = skills[stat.stat] || 0;
        const requirement: WeaponRequirement = {
          stat: stat.stat,
          statName: skillName,
          value: stat.value,
          met: characterValue >= stat.value,
          characterValue,
        };

        requirements.push(requirement);

        if (!requirement.met) {
          missingRequirements.push(requirement);
        }
      }
    });

    return {
      canUse: missingRequirements.length === 0,
      requirements,
      missingRequirements,
    };
  };

  const getFilteredWeapons = (filters: WeaponFilters, skills: CharacterSkills): Weapon[] => {
    let result = [...weapons.value];

    // Apply weapon type filter
    if (filters.weaponTypes.length > 0) {
      result = result.filter((weapon) => filters.weaponTypes.includes(weapon.item_class));
    }

    // Apply quality level filter
    if (filters.qualityLevels.length > 0) {
      result = result.filter((weapon) => filters.qualityLevels.includes(weapon.ql));
    }

    // Apply usability filter
    if (filters.usableOnly && Object.keys(skills).length > 0) {
      result = result.filter((weapon) => {
        const usability = checkWeaponUsability(weapon, skills);
        return usability.canUse;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'ql':
          comparison = a.ql - b.ql;
          break;
        case 'usability':
          if (Object.keys(skills).length > 0) {
            const aUsable = checkWeaponUsability(a, skills).canUse;
            const bUsable = checkWeaponUsability(b, skills).canUse;
            comparison = aUsable === bUsable ? 0 : aUsable ? -1 : 1;
          }
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return filters.sortDescending ? -comparison : comparison;
    });

    return result;
  };

  const setCharacterSkills = (skills: CharacterSkills): void => {
    characterSkills.value = skills;
    saveCharacterSkills();
  };

  const selectWeapon = (weapon: Weapon | null): void => {
    selectedWeapon.value = weapon;
  };

  const addToComparison = (weapon: Weapon): void => {
    if (comparisonWeapons.value.length >= 3) return;
    if (!comparisonWeapons.value.find((w) => w.id === weapon.id)) {
      comparisonWeapons.value.push(weapon);
    }
  };

  const removeFromComparison = (weaponId: number): void => {
    comparisonWeapons.value = comparisonWeapons.value.filter((w) => w.id !== weaponId);
  };

  const clearComparison = (): void => {
    comparisonWeapons.value = [];
  };

  // Persistence helpers
  const saveWeaponsToStorage = (): void => {
    try {
      localStorage.setItem(
        'tinkertools_weapons_cache',
        JSON.stringify({
          data: weapons.value,
          totalCount: totalCount.value,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn('Failed to save weapons to storage:', error);
    }
  };

  const loadWeaponsFromStorage = (): void => {
    try {
      const cached = localStorage.getItem('tinkertools_weapons_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only load if cached within last hour
        if (Date.now() - parsed.timestamp < 3600000) {
          weapons.value = parsed.data || [];
          totalCount.value = parsed.totalCount || 0;
        }
      }
    } catch (error) {
      console.warn('Failed to load weapons from storage:', error);
    }
  };

  const saveCharacterSkills = (): void => {
    try {
      localStorage.setItem('tinkertools_character_skills', JSON.stringify(characterSkills.value));
    } catch (error) {
      console.warn('Failed to save character skills:', error);
    }
  };

  const loadCharacterSkills = (): void => {
    try {
      const saved = localStorage.getItem('tinkertools_character_skills');
      if (saved) {
        characterSkills.value = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load character skills:', error);
    }
  };

  // Initialize store
  const initialize = (): void => {
    loadWeaponsFromStorage();
    loadCharacterSkills();
  };

  // Call initialize immediately
  initialize();

  return {
    // State
    weapons: weapons as Readonly<typeof weapons>,
    loading: loading as Readonly<typeof loading>,
    error: error as Readonly<typeof error>,
    totalCount: totalCount as Readonly<typeof totalCount>,
    characterSkills: characterSkills as Readonly<typeof characterSkills>,
    selectedWeapon: selectedWeapon as Readonly<typeof selectedWeapon>,
    comparisonWeapons: comparisonWeapons as Readonly<typeof comparisonWeapons>,

    // Getters
    totalWeapons,
    availableWeaponTypes,
    availableQualityLevels,

    // Actions
    fetchWeapons,
    searchWeapons,
    checkWeaponUsability,
    getFilteredWeapons,
    setCharacterSkills,
    selectWeapon,
    addToComparison,
    removeFromComparison,
    clearComparison,
    initialize,
  };
});
