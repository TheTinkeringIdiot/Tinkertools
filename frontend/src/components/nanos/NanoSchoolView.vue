<!--
NanoSchoolView - Organize nanos by school with expandable sections
Provides a hierarchical view of nano programs grouped by their nano schools
-->
<template>
  <div class="nano-school-view h-full overflow-auto p-4">
    <!-- School Sections -->
    <div class="space-y-4">
      <div v-for="school in schoolsWithNanos" :key="school.name" class="school-section">
        <!-- School Header -->
        <div
          class="flex items-center justify-between p-4 bg-surface-100 dark:bg-surface-800 rounded-lg cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          @click="toggleSchool(school.name)"
        >
          <div class="flex items-center gap-3">
            <Avatar
              :label="getSchoolShortName(school.name)"
              :class="getSchoolAvatarClass(school.name)"
              size="large"
              shape="circle"
            />
            <div>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
                {{ school.name }}
              </h3>
              <p class="text-sm text-surface-600 dark:text-surface-400">
                {{ school.nanos.length }} nano{{ school.nanos.length !== 1 ? 's' : '' }}
                <span v-if="showCompatibility && activeProfile">
                  • {{ getCastableCount(school.nanos) }} castable
                </span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- School Stats -->
            <div
              class="hidden md:flex items-center gap-4 text-sm text-surface-600 dark:text-surface-400"
            >
              <div class="flex items-center gap-1">
                <i class="pi pi-chart-bar"></i>
                <span>{{ getAverageLevelRange(school.nanos) }}</span>
              </div>
              <div class="flex items-center gap-1">
                <i class="pi pi-lightning"></i>
                <span>{{ getStrainCount(school.nanos) }} strains</span>
              </div>
            </div>

            <!-- Expand/Collapse Icon -->
            <i
              class="pi transition-transform duration-200"
              :class="expandedSchools.has(school.name) ? 'pi-chevron-up' : 'pi-chevron-down'"
            />
          </div>
        </div>

        <!-- School Content -->
        <Transition name="slide-down">
          <div v-if="expandedSchools.has(school.name)" class="mt-4">
            <!-- Strain Organization Toggle -->
            <div class="flex items-center justify-between mb-4 px-4">
              <div class="flex items-center gap-2">
                <Checkbox v-model="organizeByStrain" inputId="organize-by-strain" binary />
                <label
                  for="organize-by-strain"
                  class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
                >
                  Organize by Strain
                </label>
              </div>

              <div class="flex items-center gap-2">
                <label class="text-sm text-surface-600 dark:text-surface-400"> Sort: </label>
                <Dropdown
                  v-model="sortBy"
                  :options="sortOptions"
                  option-label="label"
                  option-value="value"
                  class="w-32"
                  @change="updateSort"
                />
              </div>
            </div>

            <!-- Strain-based Organization -->
            <div v-if="organizeByStrain" class="space-y-4">
              <div
                v-for="strain in getSchoolStrains(school.nanos)"
                :key="`${school.name}-${strain.name}`"
                class="strain-section"
              >
                <!-- Strain Header -->
                <div
                  class="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700"
                >
                  <div class="flex items-center gap-3">
                    <Badge :value="strain.name" severity="warning" />
                    <span class="text-sm text-surface-700 dark:text-surface-300">
                      {{ strain.nanos.length }} nano{{ strain.nanos.length !== 1 ? 's' : '' }}
                    </span>
                  </div>

                  <!-- Strain Conflict Warning -->
                  <div
                    v-if="strain.hasConflicts"
                    class="flex items-center gap-2 text-orange-600 dark:text-orange-400"
                    :title="getStrainConflictTooltip(strain)"
                  >
                    <i class="pi pi-exclamation-triangle text-sm"></i>
                    <span class="text-xs">Conflicts</span>
                  </div>
                </div>

                <!-- Strain Nanos -->
                <div class="grid gap-3 mt-3" :class="getGridClass()">
                  <NanoCard
                    v-for="nano in getSortedNanos(strain.nanos)"
                    :key="nano.id"
                    :nano="nano"
                    :compact="true"
                    :show-compatibility="showCompatibility"
                    :active-profile="activeProfile"
                    :compatibility-info="getCompatibilityInfo(nano)"
                    @select="handleNanoSelect"
                    @favorite="handleFavorite"
                  />
                </div>
              </div>
            </div>

            <!-- Direct List -->
            <div v-else class="grid gap-3" :class="getGridClass()">
              <NanoCard
                v-for="nano in getSortedNanos(school.nanos)"
                :key="nano.id"
                :nano="nano"
                :compact="compactCards"
                :show-compatibility="showCompatibility"
                :active-profile="activeProfile"
                :compatibility-info="getCompatibilityInfo(nano)"
                @select="handleNanoSelect"
                @favorite="handleFavorite"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="schoolsWithNanos.length === 0"
      class="flex flex-col items-center justify-center h-64"
    >
      <i class="pi pi-search text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
        No nanos found
      </h3>
      <p class="text-surface-500 dark:text-surface-400 text-center">
        Try adjusting your search criteria or filters
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import Checkbox from 'primevue/checkbox';
import Dropdown from 'primevue/dropdown';

import NanoCard from './NanoCard.vue';
import type {
  NanoProgram,
  TinkerProfile,
  NanoCompatibilityInfo,
  StrainConflict,
} from '@/types/nano';

// Types
interface SchoolWithNanos {
  name: string;
  nanos: NanoProgram[];
}

interface StrainWithNanos {
  name: string;
  nanos: NanoProgram[];
  hasConflicts: boolean;
}

interface SortOption {
  label: string;
  value: string;
}

// Props
const props = withDefaults(
  defineProps<{
    nanos: NanoProgram[];
    showCompatibility?: boolean;
    activeProfile?: TinkerProfile | null;
  }>(),
  {
    showCompatibility: false,
    activeProfile: null,
  }
);

// Emits
const emit = defineEmits<{
  'nano-select': [nano: NanoProgram];
  'strain-conflict': [conflict: StrainConflict];
  favorite: [nanoId: number, isFavorite: boolean];
}>();

// Reactive state
const expandedSchools = ref<Set<string>>(new Set());
const organizeByStrain = ref(true);
const compactCards = ref(true);
const sortBy = ref('name');

const sortOptions: SortOption[] = [
  { label: 'Name', value: 'name' },
  { label: 'Level', value: 'level' },
  { label: 'Quality Level', value: 'qualityLevel' },
  { label: 'NP Cost', value: 'nanoPointCost' },
  { label: 'Memory', value: 'memoryUsage' },
  { label: 'Compatibility', value: 'compatibility' },
];

// Nano schools from the design document
const nanoSchools = [
  'Matter Metamorphosis',
  'Biological Metamorphosis',
  'Psychological Modifications',
  'Matter Creation',
  'Time and Space',
  'Sensory Improvement',
  'Unknown School',
];

// Computed
const schoolsWithNanos = computed(() => {
  const schoolMap = new Map<string, NanoProgram[]>();

  // Initialize all schools
  nanoSchools.forEach((school) => {
    schoolMap.set(school, []);
  });

  // Group nanos by school
  props.nanos.forEach((nano) => {
    const school = nano.school || 'Unknown School';
    const nanos = schoolMap.get(school) || [];
    nanos.push(nano);
    schoolMap.set(school, nanos);
  });

  // Convert to array and filter out empty schools
  return Array.from(schoolMap.entries())
    .filter(([_, nanos]) => nanos.length > 0)
    .map(([name, nanos]) => ({ name, nanos }));
});

// Methods
const getSchoolShortName = (school: string | null | undefined): string => {
  if (!school) return '?';

  const shortNames: Record<string, string> = {
    'Matter Metamorphosis': 'MM',
    'Biological Metamorphosis': 'BM',
    'Psychological Modifications': 'PM',
    'Matter Creation': 'MC',
    'Time and Space': 'TS',
    'Sensory Improvement': 'SI',
  };
  return shortNames[school] || school.charAt(0);
};

const getSchoolAvatarClass = (school: string | null | undefined): string => {
  if (!school) return 'bg-surface-500 text-white';

  const schoolColors: Record<string, string> = {
    'Matter Metamorphosis': 'bg-red-500 text-white',
    'Biological Metamorphosis': 'bg-green-500 text-white',
    'Psychological Modifications': 'bg-purple-500 text-white',
    'Matter Creation': 'bg-blue-500 text-white',
    'Time and Space': 'bg-yellow-500 text-white',
    'Sensory Improvement': 'bg-indigo-500 text-white',
  };
  return schoolColors[school] || 'bg-surface-500 text-white';
};

const getCastableCount = (nanos: NanoProgram[]): number => {
  if (!props.showCompatibility || !props.activeProfile) return 0;

  return nanos.filter((nano) => {
    const info = getCompatibilityInfo(nano);
    return info?.canCast || false;
  }).length;
};

const getAverageLevelRange = (nanos: NanoProgram[]): string => {
  if (nanos.length === 0) return 'N/A';

  const levels = nanos.filter((nano) => nano.level > 0).map((nano) => nano.level);
  if (levels.length === 0) return 'N/A';

  const min = Math.min(...levels);
  const max = Math.max(...levels);

  return min === max ? `${min}` : `${min}-${max}`;
};

const getStrainCount = (nanos: NanoProgram[]): number => {
  const strains = new Set(nanos.map((nano) => nano.strain).filter(Boolean));
  return strains.size;
};

const getSchoolStrains = (nanos: NanoProgram[]): StrainWithNanos[] => {
  const strainMap = new Map<string, NanoProgram[]>();

  nanos.forEach((nano) => {
    if (nano.strain) {
      const strainNanos = strainMap.get(nano.strain) || [];
      strainNanos.push(nano);
      strainMap.set(nano.strain, strainNanos);
    }
  });

  return Array.from(strainMap.entries()).map(([name, strainNanos]) => ({
    name,
    nanos: strainNanos,
    hasConflicts: checkStrainConflicts(name, strainNanos),
  }));
};

const checkStrainConflicts = (strain: string, nanos: NanoProgram[]): boolean => {
  // Check if multiple nanos in this strain would conflict if used together
  // This is a simplified check - in reality, strain conflicts are more complex
  return (
    nanos.length > 1 && nanos.some((nano) => nano.effects?.some((effect) => !effect.stackable))
  );
};

const getStrainConflictTooltip = (strain: StrainWithNanos): string => {
  if (!strain.hasConflicts) return '';

  return `Multiple nanos in strain "${strain.name}" may conflict when used together. Only one can be active at a time.`;
};

const getSortedNanos = (nanos: NanoProgram[]): NanoProgram[] => {
  const sorted = [...nanos];

  sorted.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'level':
        return (a.level || 0) - (b.level || 0);
      case 'qualityLevel':
        return a.qualityLevel - b.qualityLevel;
      case 'nanoPointCost':
        return (a.nanoPointCost || 0) - (b.nanoPointCost || 0);
      case 'memoryUsage':
        return (a.memoryUsage || 0) - (b.memoryUsage || 0);
      case 'compatibility':
        if (!props.showCompatibility || !props.activeProfile) {
          return a.name.localeCompare(b.name);
        }
        const aInfo = getCompatibilityInfo(a);
        const bInfo = getCompatibilityInfo(b);
        return (bInfo?.compatibilityScore || 0) - (aInfo?.compatibilityScore || 0);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return sorted;
};

const getGridClass = (): string => {
  if (compactCards.value) {
    return 'grid-cols-1';
  } else {
    return 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3';
  }
};

const getCompatibilityInfo = (nano: NanoProgram): NanoCompatibilityInfo | null => {
  if (!props.showCompatibility || !props.activeProfile) {
    return null;
  }

  const profile = props.activeProfile;
  const requirements = nano.castingRequirements || [];

  let canCast = true;
  let skillDeficits: { skill: string; current: number; required: number; deficit: number }[] = [];
  let statDeficits: { stat: string; current: number; required: number; deficit: number }[] = [];
  let levelDeficit = 0;

  // Check each requirement
  for (const req of requirements) {
    switch (req.type) {
      case 'skill':
        const skill = req.requirement as string;
        const currentSkill = profile.skills[skill] || 0;
        if (currentSkill < req.value) {
          canCast = false;
          skillDeficits.push({
            skill,
            current: currentSkill,
            required: req.value,
            deficit: req.value - currentSkill,
          });
        }
        break;

      case 'stat':
        const stat = req.requirement as string;
        const currentStat = profile.stats[stat] || 0;
        if (currentStat < req.value) {
          canCast = false;
          statDeficits.push({
            stat,
            current: currentStat,
            required: req.value,
            deficit: req.value - currentStat,
          });
        }
        break;

      case 'level':
        if (profile.level < req.value) {
          canCast = false;
          levelDeficit = req.value - profile.level;
        }
        break;
    }
  }

  // Calculate compatibility score (0-100)
  const totalRequirements = requirements.length;
  const metRequirements =
    totalRequirements - skillDeficits.length - statDeficits.length - (levelDeficit > 0 ? 1 : 0);
  const compatibilityScore =
    totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 100;

  // Calculate skill gap (average deficit across all skill requirements)
  const allSkillReqs = requirements.filter((req) => req.type === 'skill');
  let averageSkillGap = 0;

  if (allSkillReqs.length > 0) {
    const totalGap = skillDeficits.reduce((sum, deficit) => sum + deficit.deficit, 0);
    averageSkillGap = Math.round(totalGap / allSkillReqs.length);
  }

  return {
    canCast,
    compatibilityScore,
    averageSkillGap,
    skillDeficits,
    statDeficits,
    levelDeficit,
    memoryUsage: nano.memoryUsage || 0,
    nanoPointCost: nano.nanoPointCost || 0,
  };
};

const toggleSchool = (schoolName: string) => {
  if (expandedSchools.value.has(schoolName)) {
    expandedSchools.value.delete(schoolName);
  } else {
    expandedSchools.value.add(schoolName);
  }

  // Save expanded state
  try {
    const state = Array.from(expandedSchools.value);
    localStorage.setItem('tinkertools_nano_expanded_schools', JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save expanded state:', error);
  }
};

const updateSort = () => {
  // Force reactivity update
  sortBy.value = sortBy.value;
};

const handleNanoSelect = (nano: NanoProgram) => {
  emit('nano-select', nano);
};

const handleFavorite = (nanoId: number, isFavorite: boolean) => {
  emit('favorite', nanoId, isFavorite);
};

// Component initialization - only run once when component mounts
onMounted(() => {
  // Load saved preferences from localStorage
  try {
    const preferences = localStorage.getItem('tinkertools_nano_school_view_preferences');
    if (preferences) {
      const parsed = JSON.parse(preferences);
      organizeByStrain.value =
        parsed.organizeByStrain !== undefined ? parsed.organizeByStrain : true;
      compactCards.value = parsed.compactCards !== undefined ? parsed.compactCards : true;
      sortBy.value = parsed.sortBy || 'name';

      if (parsed.expandedSchools) {
        expandedSchools.value = new Set(parsed.expandedSchools);
      }
    }
  } catch (error) {
    console.warn('Failed to load school view preferences:', error);
  }

  // Initialize expanded schools if none are set
  if (expandedSchools.value.size === 0 && schoolsWithNanos.value.length > 0) {
    schoolsWithNanos.value.slice(0, 2).forEach((school) => {
      expandedSchools.value.add(school.name);
    });
    try {
      const state = Array.from(expandedSchools.value);
      localStorage.setItem('tinkertools_nano_expanded_schools', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save expanded state:', error);
    }
  }
});

// Watch for preference changes and save them
watch([organizeByStrain, compactCards, sortBy], () => {
  try {
    const preferences = {
      organizeByStrain: organizeByStrain.value,
      compactCards: compactCards.value,
      sortBy: sortBy.value,
      expandedSchools: Array.from(expandedSchools.value),
    };
    localStorage.setItem('tinkertools_nano_school_view_preferences', JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save school view preferences:', error);
  }
});

// Watch for school changes and update expanded state
watch(schoolsWithNanos, () => {
  if (expandedSchools.value.size === 0 && schoolsWithNanos.value.length > 0) {
    schoolsWithNanos.value.slice(0, 2).forEach((school) => {
      expandedSchools.value.add(school.name);
    });
  }
});
</script>

<style scoped>
.school-section {
  background: var(--surface-ground);
  border-radius: 8px;
}

.strain-section {
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 2px solid var(--surface-200);
}

.dark .strain-section {
  border-left-color: var(--surface-700);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 2000px;
  opacity: 1;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}
</style>
