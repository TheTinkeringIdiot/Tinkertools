<!--
PerkCategory - Expandable perk category panel with progression display
Shows individual perk with all levels (1-10), current ownership, costs, and requirements
-->
<template>
  <div class="perk-category bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
    <!-- Category Header -->
    <div
      class="category-header p-4 bg-surface-50 dark:bg-surface-800 cursor-pointer select-none transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
      @click="toggleExpanded"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <!-- Perk Type Icon -->
          <i :class="typeIcon" :style="{ color: typeColor }" class="text-lg"></i>

          <!-- Perk Name -->
          <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
            {{ category.name }}
          </h4>

          <!-- Owned Level Badge -->
          <Badge
            v-if="ownedLevel > 0"
            :value="`Level ${ownedLevel}`"
            severity="success"
          />

          <!-- Perk Type Badge -->
          <Badge
            :value="category.type"
            :style="{ backgroundColor: typeColor }"
            class="text-white"
          />
        </div>

        <div class="flex items-center gap-3">
          <!-- Point Cost Display -->
          <div v-if="nextLevelCost > 0" class="text-sm text-surface-600 dark:text-surface-400">
            Next: {{ nextLevelCost }} {{ category.type === 'AI' ? 'AI' : 'SL' }} pts
          </div>

          <!-- Max Level Indicator -->
          <div v-if="ownedLevel >= 10" class="text-sm text-green-600 dark:text-green-400 font-medium">
            MAX
          </div>

          <!-- Quick Add Button -->
          <Button
            v-if="canPurchaseNext && ownedLevel < 10"
            :label="`+${ownedLevel + 1}`"
            size="small"
            :disabled="!hasRequiredPoints"
            @click.stop="onQuickAdd"
            class="quick-add-btn"
          />

          <!-- Expand/Collapse Icon -->
          <i
            :class="isExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            class="text-surface-500 dark:text-surface-400 transition-transform duration-200"
          ></i>
        </div>
      </div>

      <!-- Requirements Summary (when collapsed) -->
      <div v-if="!isExpanded && requirementsSummary" class="mt-2 text-sm text-surface-600 dark:text-surface-400">
        <i class="pi pi-info-circle mr-1"></i>
        {{ requirementsSummary }}
      </div>
    </div>

    <!-- Category Content -->
    <Transition name="expand">
      <div v-if="isExpanded" class="category-content">
        <div class="p-4">
          <!-- Perk Description -->
          <div v-if="perkDescription" class="mb-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
            <p class="text-sm text-surface-700 dark:text-surface-300">
              {{ perkDescription }}
            </p>
          </div>

          <!-- Requirements Display -->
          <div v-if="hasRequirements" class="mb-4">
            <h5 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
              Requirements
            </h5>
            <div class="flex flex-wrap gap-2">
              <Chip
                v-if="baseRequirements.level"
                :label="`Level ${baseRequirements.level}`"
                :class="characterLevel >= baseRequirements.level ? 'req-met' : 'req-unmet'"
              />
              <Chip
                v-if="baseRequirements.alienLevel"
                :label="`AI Level ${baseRequirements.alienLevel}`"
                :class="aiLevel >= baseRequirements.alienLevel ? 'req-met' : 'req-unmet'"
              />
              <Chip
                v-if="professionRestriction"
                :label="professionRestriction"
                :class="isProfessionAllowed ? 'req-met' : 'req-unmet'"
              />
              <Chip
                v-if="breedRestriction"
                :label="breedRestriction"
                :class="isBreedAllowed ? 'req-met' : 'req-unmet'"
              />
              <Chip
                v-if="baseRequirements.expansion"
                :label="baseRequirements.expansion"
                class="req-info"
              />
            </div>
          </div>

          <!-- Level Progression -->
          <div class="perk-progression">
            <h5 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
              Level Progression
            </h5>

            <!-- Grid View -->
            <div v-if="viewMode === 'grid'" class="grid grid-cols-5 gap-2">
              <div
                v-for="level in availableLevels"
                :key="level"
                class="perk-level-card p-3 border rounded-lg text-center cursor-pointer transition-all duration-200"
                :class="getLevelCardClass(level)"
                @click="onLevelClick(level)"
              >
                <div class="font-bold text-lg">{{ level }}</div>
                <div v-if="category.type !== 'LE'" class="text-xs mt-1">
                  {{ level }} pt{{ level !== 1 ? 's' : '' }}
                </div>
                <div v-if="level <= ownedLevel" class="text-xs text-green-600 dark:text-green-400 mt-1">
                  Owned
                </div>
              </div>
            </div>

            <!-- List View -->
            <div v-else class="space-y-2">
              <div
                v-for="level in availableLevels"
                :key="level"
                class="perk-level-row flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all duration-200"
                :class="getLevelRowClass(level)"
                @click="onLevelClick(level)"
              >
                <div class="flex items-center gap-3">
                  <div class="level-indicator w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                       :class="getLevelIndicatorClass(level)">
                    {{ level }}
                  </div>
                  <div>
                    <div class="font-medium">Level {{ level }}</div>
                    <div v-if="level <= ownedLevel" class="text-sm text-green-600 dark:text-green-400">
                      Currently Owned
                    </div>
                    <div v-else-if="canPurchaseLevel(level)" class="text-sm text-blue-600 dark:text-blue-400">
                      Available to Purchase
                    </div>
                    <div v-else class="text-sm text-surface-500 dark:text-surface-400">
                      {{ getLevelStatusText(level) }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <!-- Point Cost -->
                  <div v-if="category.type !== 'LE'" class="text-right">
                    <div class="font-medium">{{ level }} {{ category.type === 'AI' ? 'AI' : 'SL' }}</div>
                    <div class="text-xs text-surface-500 dark:text-surface-400">
                      point{{ level !== 1 ? 's' : '' }}
                    </div>
                  </div>

                  <!-- Action Button -->
                  <Button
                    v-if="level <= ownedLevel"
                    label="Remove"
                    icon="pi pi-minus"
                    size="small"
                    outlined
                    severity="danger"
                    @click.stop="onRemoveLevel(level)"
                  />
                  <Button
                    v-else-if="canPurchaseLevel(level)"
                    label="Add"
                    icon="pi pi-plus"
                    size="small"
                    :disabled="!hasRequiredPoints"
                    @click.stop="onAddLevel(level)"
                  />
                  <Button
                    v-else
                    label="Locked"
                    icon="pi pi-lock"
                    size="small"
                    disabled
                    outlined
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Point Cost Summary -->
          <div v-if="category.type !== 'LE'" class="mt-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
            <div class="flex justify-between items-center text-sm">
              <span class="text-surface-700 dark:text-surface-300">
                Total Cost to Level {{ ownedLevel + 1 }}:
              </span>
              <span class="font-medium">
                {{ getCumulativeCost(ownedLevel + 1) }} {{ category.type === 'AI' ? 'AI' : 'SL' }} points
              </span>
            </div>
            <div class="flex justify-between items-center text-sm mt-1">
              <span class="text-surface-700 dark:text-surface-300">
                Available Points:
              </span>
              <span class="font-medium" :class="hasRequiredPoints ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                {{ availablePoints }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AnyPerkEntry } from '@/lib/tinkerprofiles/perk-types';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Chip from 'primevue/chip';

// Types
interface PerkCategoryData {
  name: string;
  type: 'SL' | 'AI' | 'LE';
  perks: any[]; // PerkSeries from API
  totalCount: number;
  ownedCount: number;
}

// Props
const props = defineProps<{
  category: PerkCategoryData;
  viewMode: 'list' | 'grid';
  ownedPerks: AnyPerkEntry[];
  characterLevel: number;
  aiLevel: number;
  profession: string;
  breed: string;
  availableStandardPoints: number;
  availableAIPoints: number;
}>();

// Emits
const emit = defineEmits<{
  'perk-select': [perkInfo: any, targetLevel: number];
  'perk-remove': [perkName: string, targetLevel: number];
}>();

// State
const isExpanded = ref(false);

// Computed
const ownedPerk = computed(() =>
  props.ownedPerks.find(p => p.name === props.category.name)
);

const ownedLevel = computed(() => ownedPerk.value?.level || 0);

const availablePoints = computed(() => {
  return props.category.type === 'AI'
    ? props.availableAIPoints
    : props.availableStandardPoints;
});

const availableLevels = computed(() => {
  // Show levels 1-10
  return Array.from({ length: 10 }, (_, i) => i + 1);
});

const nextLevelCost = computed(() => {
  if (props.category.type === 'LE') return 0;
  return ownedLevel.value < 10 ? 1 : 0; // Each level costs 1 point
});

const hasRequiredPoints = computed(() => {
  if (props.category.type === 'LE') return true;
  return availablePoints.value >= nextLevelCost.value;
});

const canPurchaseNext = computed(() => {
  return ownedLevel.value < 10 && meetsBaseRequirements.value;
});

// Mock base requirements (TODO: Get from perk data)
const baseRequirements = computed(() => ({
  level: 10, // Example requirement
  alienLevel: props.category.type === 'AI' ? 1 : undefined,
  professions: [], // Example: empty means all professions
  breeds: [], // Example: empty means all breeds
  expansion: undefined
}));

const hasRequirements = computed(() => {
  const req = baseRequirements.value;
  return !!(req.level || req.alienLevel || req.professions?.length || req.breeds?.length || req.expansion);
});

const meetsBaseRequirements = computed(() => {
  const req = baseRequirements.value;

  if (req.level && props.characterLevel < req.level) return false;
  if (req.alienLevel && props.aiLevel < req.alienLevel) return false;
  if (req.professions?.length && !req.professions.includes(props.profession)) return false;
  if (req.breeds?.length && !req.breeds.includes(props.breed)) return false;

  return true;
});

const isProfessionAllowed = computed(() => {
  const allowedProfs = baseRequirements.value.professions;
  return !allowedProfs?.length || allowedProfs.includes(props.profession);
});

const isBreedAllowed = computed(() => {
  const allowedBreeds = baseRequirements.value.breeds;
  return !allowedBreeds?.length || allowedBreeds.includes(props.breed);
});

const professionRestriction = computed(() => {
  const profs = baseRequirements.value.professions;
  return profs?.length ? profs.join(', ') : null;
});

const breedRestriction = computed(() => {
  const breeds = baseRequirements.value.breeds;
  return breeds?.length ? breeds.join(', ') : null;
});

const requirementsSummary = computed(() => {
  const parts = [];
  const req = baseRequirements.value;

  if (req.level) parts.push(`Level ${req.level}`);
  if (req.alienLevel) parts.push(`AI Level ${req.alienLevel}`);
  if (req.professions?.length) parts.push(req.professions.join('/'));
  if (req.breeds?.length) parts.push(req.breeds.join('/'));

  return parts.length ? `Requires: ${parts.join(', ')}` : null;
});

const typeIcon = computed(() => {
  switch (props.category.type) {
    case 'SL': return 'pi pi-star';
    case 'AI': return 'pi pi-bolt';
    case 'LE': return 'pi pi-book';
    default: return 'pi pi-circle';
  }
});

const typeColor = computed(() => {
  switch (props.category.type) {
    case 'SL': return '#3b82f6'; // Blue
    case 'AI': return '#10b981'; // Green
    case 'LE': return '#f59e0b'; // Amber
    default: return '#6b7280'; // Gray
  }
});

const perkDescription = computed(() => {
  // TODO: Get from perk data
  return `A ${props.category.type} perk that provides various stat bonuses and abilities.`;
});

// Methods
function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function canPurchaseLevel(level: number): boolean {
  // Must purchase levels sequentially
  if (level > ownedLevel.value + 1) return false;

  // Must meet base requirements
  if (!meetsBaseRequirements.value) return false;

  // Must have points (except LE)
  if (props.category.type !== 'LE') {
    const cost = level - ownedLevel.value;
    if (availablePoints.value < cost) return false;
  }

  return true;
}

function getLevelCardClass(level: number): string {
  const classes = [];

  if (level <= ownedLevel.value) {
    classes.push('border-green-500 bg-green-50 dark:bg-green-900/20');
  } else if (canPurchaseLevel(level)) {
    classes.push('border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30');
  } else {
    classes.push('border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 opacity-50');
  }

  return classes.join(' ');
}

function getLevelRowClass(level: number): string {
  const classes = [];

  if (level <= ownedLevel.value) {
    classes.push('border-green-500 bg-green-50 dark:bg-green-900/20');
  } else if (canPurchaseLevel(level)) {
    classes.push('border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30');
  } else {
    classes.push('border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 opacity-50');
  }

  return classes.join(' ');
}

function getLevelIndicatorClass(level: number): string {
  if (level <= ownedLevel.value) {
    return 'bg-green-500 text-white';
  } else if (canPurchaseLevel(level)) {
    return 'bg-blue-500 text-white';
  } else {
    return 'bg-surface-300 dark:bg-surface-600 text-surface-700 dark:text-surface-300';
  }
}

function getLevelStatusText(level: number): string {
  if (level > ownedLevel.value + 1) {
    return `Must own level ${level - 1} first`;
  }

  if (!meetsBaseRequirements.value) {
    return 'Requirements not met';
  }

  if (props.category.type !== 'LE') {
    const cost = level - ownedLevel.value;
    if (availablePoints.value < cost) {
      return 'Insufficient points';
    }
  }

  return 'Locked';
}

function getCumulativeCost(targetLevel: number): number {
  if (props.category.type === 'LE') return 0;
  return Math.max(0, targetLevel - 1); // Total cost up to target level
}

function onQuickAdd() {
  if (canPurchaseNext.value && hasRequiredPoints.value) {
    onAddLevel(ownedLevel.value + 1);
  }
}

function onLevelClick(level: number) {
  if (level <= ownedLevel.value) {
    // Remove level
    onRemoveLevel(level);
  } else if (canPurchaseLevel(level)) {
    // Add level
    onAddLevel(level);
  }
}

function onAddLevel(level: number) {
  // TODO: Create proper perk info from data
  const mockPerkInfo = {
    aoid: 12345, // TODO: Get from perk data
    name: props.category.name,
    level: level,
    type: props.category.type,
    cost: props.category.type === 'LE' ? 0 : 1,  // Each perk level costs 1 point
    requirements: baseRequirements.value,
    effects: []
  };

  emit('perk-select', mockPerkInfo, level);
}

function onRemoveLevel(level: number) {
  // Remove to the level below the clicked level
  const targetLevel = level - 1;
  emit('perk-remove', props.category.name, targetLevel);
}
</script>

<style scoped>
/* Expand/Collapse Transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-out;
  overflow: hidden;
}

.expand-enter-from {
  max-height: 0;
  opacity: 0;
}

.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 2000px;
  opacity: 1;
}

/* Category Header Styling */
.category-header:active {
  transform: translateY(1px);
}

/* Quick Add Button */
.quick-add-btn {
  min-width: 2.5rem;
}

/* Requirement Chips */
.req-met {
  @apply bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400;
}

.req-unmet {
  @apply bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400;
}

.req-info {
  @apply bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400;
}

/* Perk Level Cards */
.perk-level-card {
  min-height: 4rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .category-header {
    padding: 1rem;
  }

  .category-content {
    padding: 1rem;
  }

  .grid-cols-5 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>