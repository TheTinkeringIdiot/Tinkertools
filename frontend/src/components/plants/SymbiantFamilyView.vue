<!--
SymbiantFamilyView - Display symbiants organized by family
Shows symbiants grouped by their family types
-->
<template>
  <div class="symbiant-family-view h-full overflow-y-auto">
    <div class="p-4">
      <div v-if="familyGroups.length === 0" class="text-center py-8">
        <i class="pi pi-inbox text-4xl text-surface-400 dark:text-surface-600 mb-4 block"></i>
        <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
          No symbiants found
        </h3>
        <p class="text-surface-500 dark:text-surface-400">Try adjusting your search criteria</p>
      </div>

      <div v-else class="space-y-6">
        <div v-for="group in familyGroups" :key="group.family" class="family-group">
          <!-- Family Header -->
          <div class="flex items-center gap-3 mb-3">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
              {{ group.family || 'Unknown Family' }}
            </h3>
            <Badge :value="group.symbiants.length" severity="info" />
            <Button
              @click="toggleFamily(group.family)"
              :icon="
                expandedFamilies.includes(group.family) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'
              "
              size="small"
              text
              severity="secondary"
            />
          </div>

          <!-- Symbiants Grid -->
          <div
            v-show="expandedFamilies.includes(group.family)"
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <div
              v-for="symbiant in group.symbiants"
              :key="symbiant.id"
              @click="selectSymbiant(symbiant)"
              class="symbiant-card p-3 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md cursor-pointer transition-all"
            >
              <!-- Symbiant Header -->
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                  <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-1">
                    {{ symbiant.name }}
                  </h4>
                  <div
                    class="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400"
                  >
                    <Badge
                      v-if="symbiant.qualityLevel"
                      :value="`QL ${symbiant.qualityLevel}`"
                      size="small"
                    />
                    <span v-if="symbiant.slot">{{ formatSlotName(symbiant.slot) }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1">
                  <Button
                    v-if="buildMode"
                    @click.stop="addToBuild(symbiant)"
                    icon="pi pi-plus"
                    size="small"
                    text
                    severity="primary"
                    aria-label="Add to build"
                  />
                </div>
              </div>

              <!-- Description -->
              <p
                v-if="symbiant.description"
                class="text-xs text-surface-600 dark:text-surface-400 mb-3 line-clamp-3"
              >
                {{ symbiant.description }}
              </p>

              <!-- Stat Bonuses -->
              <div v-if="symbiant.statBonuses && symbiant.statBonuses.length > 0" class="space-y-1">
                <div class="text-xs font-medium text-surface-700 dark:text-surface-300">
                  Stat Bonuses:
                </div>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="bonus in symbiant.statBonuses.slice(0, 4)"
                    :key="bonus.statId"
                    :value="`+${bonus.value} ${formatStatName(bonus.statId)}`"
                    severity="success"
                    size="small"
                  />
                  <Badge
                    v-if="symbiant.statBonuses.length > 4"
                    :value="`+${symbiant.statBonuses.length - 4} more`"
                    severity="secondary"
                    size="small"
                  />
                </div>
              </div>

              <!-- Boss Source (if available) -->
              <div
                v-if="symbiant.bossSource"
                class="mt-2 pt-2 border-t border-surface-100 dark:border-surface-800"
              >
                <div class="text-xs text-surface-500 dark:text-surface-400">
                  <i class="pi pi-map-marker mr-1"></i>
                  {{ symbiant.bossSource }}
                </div>
              </div>
            </div>
          </div>

          <!-- Show More Button for large families -->
          <div
            v-if="group.symbiants.length > 9 && expandedFamilies.includes(group.family)"
            class="text-center mt-3"
          >
            <Button
              label="Show All"
              size="small"
              text
              severity="secondary"
              @click="selectSymbiant(group.symbiants[0])"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';

import type { PlantSymbiant } from '@/types/plants';

interface Props {
  symbiants: PlantSymbiant[];
  families: string[];
  buildMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  buildMode: false,
});

interface Emits {
  (e: 'symbiant-select', symbiant: PlantSymbiant): void;
  (e: 'add-to-build', symbiant: PlantSymbiant): void;
}

const emit = defineEmits<Emits>();

// Reactive state
const expandedFamilies = ref<string[]>([]);

interface FamilyGroup {
  family: string;
  symbiants: PlantSymbiant[];
}

// Computed
const familyGroups = computed((): FamilyGroup[] => {
  const groups = new Map<string, PlantSymbiant[]>();

  // Group symbiants by family
  props.symbiants.forEach((symbiant) => {
    const family = symbiant.family || 'Unknown';
    if (!groups.has(family)) {
      groups.set(family, []);
    }
    groups.get(family)!.push(symbiant);
  });

  // Convert to array and sort by family name
  const result: FamilyGroup[] = Array.from(groups.entries())
    .map(([family, symbiants]) => ({
      family,
      symbiants: symbiants.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family));

  return result;
});

// Methods
const formatSlotName = (slot: string): string => {
  const slotNames: Record<string, string> = {
    head: 'Head',
    eye: 'Eye',
    ear: 'Ear',
    rarm: 'Right Arm',
    chest: 'Chest',
    larm: 'Left Arm',
    waist: 'Waist',
    rwrist: 'Right Wrist',
    legs: 'Legs',
    lwrist: 'Left Wrist',
    rfinger: 'Right Finger',
    feet: 'Feet',
    lfinger: 'Left Finger',
  };
  return slotNames[slot] || slot;
};

const formatStatName = (statId: string): string => {
  const statNames: Record<string, string> = {
    strength: 'STR',
    agility: 'AGI',
    stamina: 'STA',
    intelligence: 'INT',
    sense: 'SEN',
    psychic: 'PSY',
    matter_creation: 'MC',
    matter_metamorphosis: 'MM',
    psychological_modifications: 'PM',
    biological_metamorphosis: 'BM',
    sensory_improvement: 'SI',
    time_and_space: 'TS',
  };
  return statNames[statId] || statId.toUpperCase().slice(0, 3);
};

const selectSymbiant = (symbiant: PlantSymbiant) => {
  emit('symbiant-select', symbiant);
};

const addToBuild = (symbiant: PlantSymbiant) => {
  emit('add-to-build', symbiant);
};

const toggleFamily = (family: string) => {
  const index = expandedFamilies.value.indexOf(family);
  if (index > -1) {
    expandedFamilies.value.splice(index, 1);
  } else {
    expandedFamilies.value.push(family);
  }
};

// Initialize with first few families expanded
onMounted(() => {
  const firstFamilies = familyGroups.value.slice(0, 3).map((group) => group.family);
  expandedFamilies.value = firstFamilies;
});
</script>

<style scoped>
.symbiant-card {
  transition: all 0.2s ease;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.family-group:not(:last-child) {
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 1.5rem;
}
</style>
