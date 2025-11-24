<template>
  <div class="min-h-screen bg-surface-50 dark:bg-surface-900">
    <!-- Header -->
    <div
      class="bg-surface-0 dark:bg-surface-950 shadow-md dark:shadow-none border-b border-surface-200 dark:border-surface-700"
    >
      <div class="container mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-50">TinkerFite</h1>
            <p class="text-surface-600 dark:text-surface-400 mt-1">
              Skill-based weapon selection for Anarchy Online
            </p>
          </div>
          <div class="text-right">
            <div class="text-sm text-surface-500 dark:text-surface-400">Total Weapons</div>
            <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {{ totalWeapons }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto px-4 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <!-- Character Skills Panel -->
        <div class="lg:col-span-1">
          <div
            class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
          >
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
              Character Skills
            </h3>

            <div v-if="Object.keys(characterSkills).length === 0" class="text-center py-8">
              <div class="text-surface-400 dark:text-surface-500 mb-2">
                <i class="pi pi-info-circle text-2xl"></i>
              </div>
              <p class="text-surface-600 dark:text-surface-400 mb-4">
                Enter your character's skills to see which weapons you can use
              </p>
              <button
                @click="quickSetup"
                class="bg-primary-500 dark:bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-600 dark:hover:bg-primary-700 transition-colors"
              >
                Quick Setup
              </button>
            </div>

            <div v-else class="space-y-3">
              <div
                class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded border border-primary-200 dark:border-primary-800"
              >
                <span class="text-sm font-medium text-primary-900 dark:text-primary-100">
                  {{ Object.keys(characterSkills).length }} skills configured
                </span>
              </div>

              <div
                v-for="[skillId, skillValue] in Object.entries(characterSkills)"
                :key="skillId"
                class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded"
              >
                <div class="flex-1">
                  <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    {{ getSkillName(Number(skillId)) }}
                  </label>
                </div>
                <span class="font-medium text-surface-900 dark:text-surface-50">{{
                  skillValue
                }}</span>
              </div>

              <button
                @click="clearSkills"
                class="w-full bg-red-500 dark:bg-red-600 text-white px-4 py-2 rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors text-sm"
              >
                Clear Skills
              </button>
            </div>
          </div>
        </div>

        <!-- Main Content Area -->
        <div class="lg:col-span-3">
          <!-- Search -->
          <div
            class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6 mb-6"
          >
            <div class="flex gap-4">
              <input
                v-model="searchQuery"
                @keyup.enter="searchWeapons"
                placeholder="Search weapons by name..."
                class="flex-1 px-4 py-2 border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-900 text-surface-900 dark:text-surface-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
              />
              <button
                @click="searchWeapons"
                class="bg-primary-500 dark:bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-600 dark:hover:bg-primary-700 transition-colors"
                :disabled="loading"
              >
                {{ loading ? 'Loading...' : 'Search' }}
              </button>
            </div>
          </div>

          <!-- Usability Summary -->
          <div
            v-if="Object.keys(characterSkills).length > 0 && weapons.length > 0"
            class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-4 mb-6"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-6">
                <div>
                  <span class="text-2xl font-bold text-green-600 dark:text-green-400">{{
                    usableCount
                  }}</span>
                  <div class="text-sm text-surface-600 dark:text-surface-400">Usable</div>
                </div>
                <div>
                  <span class="text-2xl font-bold text-red-600 dark:text-red-400">{{
                    unusableCount
                  }}</span>
                  <div class="text-sm text-surface-600 dark:text-surface-400">Cannot Use</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm text-surface-600 dark:text-surface-400">Usability Rate</div>
                <div class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                  {{ usabilityPercentage }}%
                </div>
              </div>
            </div>
          </div>

          <!-- Weapons List -->
          <div
            class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700"
          >
            <div v-if="loading" class="p-8 text-center">
              <div
                class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 dark:border-primary-400"
              ></div>
              <p class="text-surface-600 dark:text-surface-400 mt-2">Loading weapons...</p>
            </div>

            <div v-else-if="error" class="p-8 text-center">
              <p class="text-red-800 dark:text-red-300">{{ error }}</p>
              <button
                @click="loadWeapons"
                class="mt-4 bg-primary-500 dark:bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-600 dark:hover:bg-primary-700 transition-colors"
              >
                Retry
              </button>
            </div>

            <div v-else-if="weapons.length === 0" class="p-8 text-center">
              <p class="text-surface-600 dark:text-surface-400">No weapons found</p>
            </div>

            <div v-else class="p-4">
              <div class="mb-4 flex items-center justify-between">
                <h3 class="font-medium text-surface-900 dark:text-surface-50">
                  {{ weapons.length }} weapons found
                </h3>
                <label v-if="Object.keys(characterSkills).length > 0" class="flex items-center">
                  <input v-model="showUsableOnly" type="checkbox" class="mr-2" />
                  <span class="text-sm text-surface-700 dark:text-surface-300"
                    >Show usable only</span
                  >
                </label>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="weapon in filteredWeapons"
                  :key="weapon.id"
                  class="border border-surface-200 dark:border-surface-700 rounded-lg p-4 hover:shadow-md dark:hover:shadow-none transition-shadow"
                  :class="getWeaponCardClass(weapon)"
                >
                  <h4 class="font-semibold text-surface-900 dark:text-surface-50 mb-2">
                    {{ weapon.name }}
                  </h4>
                  <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">
                    QL {{ weapon.ql }}
                  </div>

                  <div v-if="Object.keys(characterSkills).length > 0" class="mb-3">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-medium text-surface-700 dark:text-surface-300"
                        >Usability</span
                      >
                      <span
                        :class="getUsabilityBadgeClass(weapon)"
                        class="px-2 py-1 rounded-full text-xs font-medium"
                      >
                        {{ getUsabilityText(weapon) }}
                      </span>
                    </div>
                  </div>

                  <div class="text-sm">
                    <div class="font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Requirements:
                    </div>
                    <div class="space-y-1">
                      <div
                        v-for="req in getWeaponRequirements(weapon).slice(0, 3)"
                        :key="req.stat"
                        class="flex items-center justify-between text-xs"
                        :class="
                          req.met
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-red-700 dark:text-red-400'
                        "
                      >
                        <span class="text-surface-700 dark:text-surface-300">{{
                          req.statName
                        }}</span>
                        <span
                          >{{ req.value }}
                          {{ req.characterValue ? `(${req.characterValue})` : '' }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Types
interface StatValue {
  id: number;
  stat: number;
  value: number;
}

interface Weapon {
  id: number;
  aoid: number;
  name: string;
  ql: number;
  item_class: number;
  description?: string;
  is_nano: boolean;
  stats: StatValue[];
  attack_stats: StatValue[];
  defense_stats: StatValue[];
}

interface CharacterSkills {
  [skillId: number]: number;
}

interface WeaponRequirement {
  stat: number;
  statName: string;
  value: number;
  met: boolean;
  characterValue?: number;
}

// Skill names mapping
const SKILL_NAMES: Record<number, string> = {
  16: 'Strength',
  17: 'Stamina',
  18: 'Agility',
  19: 'Sense',
  20: 'Intelligence',
  21: 'Psychic',
  100: '1h Blunt',
  101: '1h Edged',
  102: '2h Blunt',
  103: '2h Edged',
  104: 'Pistol',
  105: 'Bow',
  106: 'Thrown Grips',
  107: 'Assault Rifle',
  108: 'SMG',
  109: 'Rifle',
  110: 'Shotgun',
  111: 'Heavy Weapons',
  112: 'Piercing',
  113: 'Multi Melee',
  114: 'Multi Ranged',
  152: 'Martial Arts',
  54: 'Level',
};

// State
const weapons = ref<Weapon[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const characterSkills = ref<CharacterSkills>({});
const showUsableOnly = ref(false);

// Computed
const totalWeapons = computed(() => weapons.value.length);

const filteredWeapons = computed(() => {
  let result = [...weapons.value];

  if (showUsableOnly.value && Object.keys(characterSkills.value).length > 0) {
    result = result.filter((weapon) => isWeaponUsable(weapon));
  }

  return result;
});

const usableCount = computed(() => {
  if (Object.keys(characterSkills.value).length === 0) return 0;
  return weapons.value.filter((weapon) => isWeaponUsable(weapon)).length;
});

const unusableCount = computed(() => {
  if (Object.keys(characterSkills.value).length === 0) return 0;
  return weapons.value.length - usableCount.value;
});

const usabilityPercentage = computed(() => {
  if (weapons.value.length === 0) return 0;
  return Math.round((usableCount.value / weapons.value.length) * 100);
});

// Methods
const getSkillName = (skillId: number): string => {
  return SKILL_NAMES[skillId] || `Skill ${skillId}`;
};

const loadWeapons = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Get items with attack/defense data (these are more likely to be weapons)
    const response = await fetch(
      `${API_BASE_URL}/items?has_attack_defense=true&page_size=100`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Fetch detailed data for each item to get stats
    console.log('Loading detailed weapon data...');
    const detailedWeapons = [];

    for (const item of data.items.slice(0, 50)) {
      // Limit for performance
      try {
        const detailResponse = await fetch(`${API_BASE_URL}/items/${item.id}`);
        if (detailResponse.ok) {
          const detailedItem = await detailResponse.json();
          if (isLikelyWeapon(detailedItem)) {
            detailedWeapons.push(detailedItem);
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch details for item ${item.id}:`, err);
      }
    }

    weapons.value = detailedWeapons;
    console.log('Loaded weapons:', detailedWeapons.length);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load weapons';
  } finally {
    loading.value = false;
  }
};

const searchWeapons = async () => {
  if (!searchQuery.value.trim()) {
    await loadWeapons();
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(
      `${API_BASE_URL}/items/search?q=${encodeURIComponent(searchQuery.value)}&weapons=true&page_size=50`
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Found ${data.total} weapons matching "${searchQuery.value}"`);

    if (data.items.length === 0) {
      weapons.value = [];
      return;
    }

    // Now we need to fetch detailed data to get stats for each weapon
    console.log('Fetching detailed data for weapons...');
    const detailedWeapons = [];

    for (const item of data.items.slice(0, 30)) {
      // Can handle more since they're already filtered to weapons
      try {
        const detailResponse = await fetch(`${API_BASE_URL}/items/${item.id}`);
        if (detailResponse.ok) {
          const detailedItem = await detailResponse.json();
          detailedWeapons.push(detailedItem); // No need to check isLikelyWeapon since backend filtered
        }
      } catch (err) {
        console.warn(`Failed to fetch details for item ${item.id}:`, err);
      }
    }

    console.log('Detailed weapons loaded:', detailedWeapons.length);
    weapons.value = detailedWeapons;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to search weapons';
    console.error('Search error:', err);
  } finally {
    loading.value = false;
  }
};

const isLikelyWeapon = (item: any): boolean => {
  // A weapon should have both attack and defense stats (non-empty)
  const hasAttackStats = item.attack_stats && item.attack_stats.length > 0;
  const hasDefenseStats = item.defense_stats && item.defense_stats.length > 0;

  // Check for weapon skill requirements as backup
  const weaponSkillIds = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 152,
  ];
  const hasWeaponSkills =
    item.stats && item.stats.some((stat: any) => weaponSkillIds.includes(stat.stat));

  // A weapon has attack/defense stats OR weapon skill requirements
  return hasAttackStats || hasDefenseStats || hasWeaponSkills;
};

const getWeaponRequirements = (weapon: Weapon): WeaponRequirement[] => {
  if (!weapon.stats) return [];

  return weapon.stats
    .filter((stat) => SKILL_NAMES[stat.stat])
    .map((stat) => {
      const characterValue = characterSkills.value[stat.stat] || 0;
      return {
        stat: stat.stat,
        statName: SKILL_NAMES[stat.stat],
        value: stat.value,
        met: characterValue >= stat.value,
        characterValue: Object.keys(characterSkills.value).length > 0 ? characterValue : undefined,
      };
    })
    .sort((a, b) => {
      if (a.met !== b.met) return a.met ? 1 : -1;
      return b.value - a.value;
    });
};

const isWeaponUsable = (weapon: Weapon): boolean => {
  const requirements = getWeaponRequirements(weapon);
  return requirements.every((req) => req.met);
};

const getWeaponCardClass = (weapon: Weapon): string => {
  if (Object.keys(characterSkills.value).length === 0) return '';

  return isWeaponUsable(weapon)
    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
    : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
};

const getUsabilityBadgeClass = (weapon: Weapon): string => {
  return isWeaponUsable(weapon)
    ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
    : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
};

const getUsabilityText = (weapon: Weapon): string => {
  const requirements = getWeaponRequirements(weapon);
  const missing = requirements.filter((req) => !req.met).length;

  return missing === 0 ? 'Usable' : `${missing} missing`;
};

const quickSetup = () => {
  // Quick setup with sample character skills
  characterSkills.value = {
    16: 400, // Strength
    17: 400, // Stamina
    18: 400, // Agility
    19: 400, // Sense
    20: 400, // Intelligence
    21: 400, // Psychic
    54: 150, // Level
    101: 600, // 1h Edged
    109: 500, // Rifle
    104: 400, // Pistol
  };
};

const clearSkills = () => {
  characterSkills.value = {};
};

// Lifecycle
onMounted(async () => {
  await loadWeapons();
});
</script>
