<!--
SymbiantFilters - Filter component for symbiants
Provides filtering by family, slot, quality level, and stat bonuses
-->
<template>
  <div class="symbiant-filters flex flex-col h-full">
    <div class="flex-1 overflow-y-auto">
      <!-- Family Filters -->
      <Accordion :activeIndex="[0]" multiple class="border-none">
        <AccordionTab header="Symbiant Families">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-objects-column text-sm"></i>
              <span class="font-medium">Families</span>
              <Badge
                v-if="selectedFamilies.length > 0"
                :value="selectedFamilies.length"
                severity="info"
                size="small"
              />
            </div>
          </template>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2 mb-3">
              <Button
                @click="selectAllFamilies"
                label="All"
                size="small"
                text
                :severity="selectedFamilies.length === availableFamilies.length ? 'primary' : 'secondary'"
              />
              <Button
                @click="clearFamilies"
                label="None"
                size="small"
                text
                severity="secondary"
              />
            </div>
            
            <div
              v-for="family in availableFamilies"
              :key="family"
              class="flex items-center gap-2"
            >
              <Checkbox
                v-model="selectedFamilies"
                :inputId="`family-${family}`"
                :value="family"
              />
              <label :for="`family-${family}`" class="text-sm flex-1 cursor-pointer">
                {{ family }}
              </label>
              <span class="text-xs text-surface-500 dark:text-surface-400">
                {{ getFamilyCount(family) }}
              </span>
            </div>
          </div>
        </AccordionTab>

        <!-- Slot Filters -->
        <AccordionTab header="Body Slots">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-user text-sm"></i>
              <span class="font-medium">Slots</span>
              <Badge
                v-if="selectedSlots.length > 0"
                :value="selectedSlots.length"
                severity="info"
                size="small"
              />
            </div>
          </template>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2 mb-3">
              <Button
                @click="selectAllSlots"
                label="All"
                size="small"
                text
                :severity="selectedSlots.length === availableSlots.length ? 'primary' : 'secondary'"
              />
              <Button
                @click="clearSlots"
                label="None"
                size="small"
                text
                severity="secondary"
              />
            </div>
            
            <div
              v-for="slot in availableSlots"
              :key="slot"
              class="flex items-center gap-2"
            >
              <Checkbox
                v-model="selectedSlots"
                :inputId="`slot-${slot}`"
                :value="slot"
              />
              <label :for="`slot-${slot}`" class="text-sm flex-1 cursor-pointer">
                {{ formatSlotName(slot) }}
              </label>
              <span class="text-xs text-surface-500 dark:text-surface-400">
                {{ getSlotCount(slot) }}
              </span>
            </div>
          </div>
        </AccordionTab>

        <!-- Quality Level Filters -->
        <AccordionTab header="Quality Levels">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-star text-sm"></i>
              <span class="font-medium">Quality</span>
              <Badge
                v-if="selectedQualityLevels.length > 0"
                :value="selectedQualityLevels.length"
                severity="info"
                size="small"
              />
            </div>
          </template>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2 mb-3">
              <Button
                @click="selectAllQuality"
                label="All"
                size="small"
                text
                :severity="selectedQualityLevels.length === availableQualityLevels.length ? 'primary' : 'secondary'"
              />
              <Button
                @click="clearQuality"
                label="None"
                size="small"
                text
                severity="secondary"
              />
            </div>
            
            <!-- Quality Level Range Slider -->
            <div class="px-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-surface-600 dark:text-surface-400">Range</span>
                <span class="text-sm text-surface-900 dark:text-surface-100">
                  QL {{ qualityRange[0] }} - {{ qualityRange[1] }}
                </span>
              </div>
              <Slider
                v-model="qualityRange"
                range
                :min="minQuality"
                :max="maxQuality"
                :step="5"
                @change="updateQualityFromRange"
                class="w-full"
              />
            </div>
            
            <!-- Individual Quality Checkboxes -->
            <div class="max-h-32 overflow-y-auto">
              <div
                v-for="ql in availableQualityLevels"
                :key="ql"
                class="flex items-center gap-2"
              >
                <Checkbox
                  v-model="selectedQualityLevels"
                  :inputId="`ql-${ql}`"
                  :value="ql"
                />
                <label :for="`ql-${ql}`" class="text-sm flex-1 cursor-pointer">
                  QL {{ ql }}
                </label>
                <span class="text-xs text-surface-500 dark:text-surface-400">
                  {{ getQualityCount(ql) }}
                </span>
              </div>
            </div>
          </div>
        </AccordionTab>

        <!-- Stat Bonus Filters -->
        <AccordionTab header="Stat Bonuses">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-chart-bar text-sm"></i>
              <span class="font-medium">Stats</span>
              <Badge
                v-if="selectedStatBonuses.length > 0"
                :value="selectedStatBonuses.length"
                severity="info"
                size="small"
              />
            </div>
          </template>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2 mb-3">
              <Button
                @click="selectAllStats"
                label="All"
                size="small"
                text
                :severity="selectedStatBonuses.length === availableStats.length ? 'primary' : 'secondary'"
              />
              <Button
                @click="clearStats"
                label="None"
                size="small"
                text
                severity="secondary"
              />
            </div>
            
            <!-- Minimum stat value filter -->
            <div class="px-2 mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm text-surface-600 dark:text-surface-400">Min Bonus</span>
                <span class="text-sm text-surface-900 dark:text-surface-100">
                  +{{ minStatBonus }}
                </span>
              </div>
              <Slider
                v-model="minStatBonus"
                :min="0"
                :max="100"
                :step="1"
                @change="updateStatBonusFilter"
                class="w-full"
              />
            </div>
            
            <!-- Individual stat checkboxes -->
            <div class="max-h-48 overflow-y-auto">
              <div
                v-for="stat in availableStats"
                :key="stat"
                class="flex items-center gap-2"
              >
                <Checkbox
                  v-model="selectedStatBonuses"
                  :inputId="`stat-${stat}`"
                  :value="stat"
                />
                <label :for="`stat-${stat}`" class="text-sm flex-1 cursor-pointer">
                  {{ formatStatName(stat) }}
                </label>
              </div>
            </div>
          </div>
        </AccordionTab>
      </Accordion>
    </div>
    
    <!-- Filter Actions -->
    <div class="p-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
      <Button
        @click="resetAllFilters"
        label="Reset All Filters"
        icon="pi pi-refresh"
        size="small"
        severity="secondary"
        text
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Slider from 'primevue/slider';

import type { SymbiantFilters } from '@/types/plants';

// Props
interface Props {
  modelValue: SymbiantFilters;
  availableFamilies?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  availableFamilies: () => []
});

// Emits
interface Emits {
  (e: 'update:modelValue', value: SymbiantFilters): void;
  (e: 'filter-change', filters: SymbiantFilters): void;
}

const emit = defineEmits<Emits>();

// Reactive state
const selectedFamilies = ref([...props.modelValue.families]);
const selectedSlots = ref([...props.modelValue.slots]);
const selectedQualityLevels = ref([...props.modelValue.qualityLevels]);
const selectedStatBonuses = ref([...props.modelValue.statBonuses]);
const minStatBonus = ref(props.modelValue.minStatValue || 0);
const qualityRange = ref([1, 300]); // Default range

// Available options (in real implementation, these would come from data)
const availableSlots = computed(() => [
  'head', 'eye', 'ear', 'rarm', 'chest', 'larm', 'waist', 
  'rwrist', 'legs', 'lwrist', 'rfinger', 'feet', 'lfinger'
]);

const availableQualityLevels = computed(() => {
  // Generate quality levels from 1 to 300 in increments of 5
  const levels = [];
  for (let i = 1; i <= 300; i += 5) {
    levels.push(i);
  }
  return levels;
});

const minQuality = computed(() => Math.min(...availableQualityLevels.value));
const maxQuality = computed(() => Math.max(...availableQualityLevels.value));

const availableStats = computed(() => [
  'strength', 'agility', 'stamina', 'intelligence', 'sense', 'psychic',
  'matter_creation', 'matter_metamorphosis', 'psychological_modifications',
  'biological_metamorphosis', 'sensory_improvement', 'time_and_space'
]);

// Computed filters object
const currentFilters = computed((): SymbiantFilters => ({
  families: [...selectedFamilies.value],
  slots: [...selectedSlots.value],
  qualityLevels: [...selectedQualityLevels.value],
  statBonuses: [...selectedStatBonuses.value],
  minStatValue: minStatBonus.value
}));

// Mock data functions (in real implementation, these would query actual data)
const getFamilyCount = (family: string): number => {
  // Mock count for demonstration
  const mockCounts: Record<string, number> = {
    'Seeker': 13,
    'Hacker': 13,
    'Soldier': 13,
    'Medic': 13
  };
  return mockCounts[family] || 0;
};

const getSlotCount = (slot: string): number => {
  // Mock count for demonstration
  return Math.floor(Math.random() * 20) + 5;
};

const getQualityCount = (ql: number): number => {
  // Mock count for demonstration
  return Math.floor(Math.random() * 10) + 1;
};

// Methods
const formatSlotName = (slot: string): string => {
  const slotNames: Record<string, string> = {
    'head': 'Head',
    'eye': 'Eye',
    'ear': 'Ear',
    'rarm': 'Right Arm',
    'chest': 'Chest',
    'larm': 'Left Arm',
    'waist': 'Waist',
    'rwrist': 'Right Wrist',
    'legs': 'Legs',
    'lwrist': 'Left Wrist',
    'rfinger': 'Right Finger',
    'feet': 'Feet',
    'lfinger': 'Left Finger'
  };
  return slotNames[slot] || slot;
};

const formatStatName = (stat: string): string => {
  return stat.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const selectAllFamilies = () => {
  selectedFamilies.value = [...props.availableFamilies];
};

const clearFamilies = () => {
  selectedFamilies.value = [];
};

const selectAllSlots = () => {
  selectedSlots.value = [...availableSlots.value];
};

const clearSlots = () => {
  selectedSlots.value = [];
};

const selectAllQuality = () => {
  selectedQualityLevels.value = [...availableQualityLevels.value];
};

const clearQuality = () => {
  selectedQualityLevels.value = [];
};

const selectAllStats = () => {
  selectedStatBonuses.value = [...availableStats.value];
};

const clearStats = () => {
  selectedStatBonuses.value = [];
};

const updateQualityFromRange = () => {
  selectedQualityLevels.value = availableQualityLevels.value.filter(
    ql => ql >= qualityRange.value[0] && ql <= qualityRange.value[1]
  );
};

const updateStatBonusFilter = () => {
  // This would trigger a re-filter based on minimum stat bonus
  emitFilterChange();
};

const resetAllFilters = () => {
  selectedFamilies.value = [];
  selectedSlots.value = [];
  selectedQualityLevels.value = [];
  selectedStatBonuses.value = [];
  minStatBonus.value = 0;
  qualityRange.value = [minQuality.value, maxQuality.value];
};

const emitFilterChange = () => {
  emit('update:modelValue', currentFilters.value);
  emit('filter-change', currentFilters.value);
};

// Watch for changes and emit
watch([
  selectedFamilies,
  selectedSlots,
  selectedQualityLevels,
  selectedStatBonuses,
  minStatBonus
], () => {
  emitFilterChange();
}, { deep: true });

// Watch for external changes
watch(() => props.modelValue, (newFilters) => {
  selectedFamilies.value = [...newFilters.families];
  selectedSlots.value = [...newFilters.slots];
  selectedQualityLevels.value = [...newFilters.qualityLevels];
  selectedStatBonuses.value = [...newFilters.statBonuses];
  minStatBonus.value = newFilters.minStatValue || 0;
}, { deep: true });
</script>