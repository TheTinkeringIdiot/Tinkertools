<!--
SkillSlider - Interactive skill value slider with IP calculations
Shows skill name, current value, IP cost, and interactive slider for value adjustment
-->
<template>
  <div class="skill-slider">
    <!-- Skill Info Row -->
    <div class="skill-info-row flex items-center justify-between mb-2">
      <div class="flex items-center gap-2 flex-1 min-w-0 max-w-[16rem]">
        <span class="font-medium text-surface-900 dark:text-surface-50 truncate">
          {{ skillName }}
        </span>
        <span v-if="skillData.trickleDown" class="text-xs text-green-600 dark:text-green-400">
          (+{{ skillData.trickleDown }})
        </span>
      </div>
      
      <div class="skill-values flex items-center gap-2 flex-shrink-0 min-w-[7rem]">
        <!-- Current Value Display -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-surface-600 dark:text-surface-400 min-w-[4rem] text-right">
            {{ displayValue }} / {{ maxValue }}
          </span>
        </div>
        
        <!-- IP Cost Display -->
        <div v-if="!isAbility && category !== 'Misc'" class="flex items-center gap-1">
          <i class="pi pi-circle-fill text-xs text-blue-500"></i>
          <span class="text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[2rem] text-right">
            {{ ipCost }}
          </span>
        </div>
      </div>
    </div>
    
    <!-- Interactive Controls (for editable skills) -->
    <div v-if="!isReadOnly" class="flex items-center gap-2">
      <!-- Slider takes up available space but leaves room for other controls -->
      <Slider
        v-model="sliderValue"
        :min="minValue"
        :max="maxValue"
        :step="1"
        class="flex-1 min-w-[100px] max-w-none"
        @update:model-value="onValueChanged"
      />
      
      <!-- Input Number for precise entry with proper width -->
      <InputNumber
        v-model="sliderValue"
        :min="minValue"
        :max="maxValue"
        :step="1"
        size="small"
        class="flex-shrink-0"
        @update:model-value="onValueChanged"
      />
      
      <!-- Max Button with proper sizing -->
      <Button
        label="Max"
        size="small"
        severity="secondary"
        outlined
        @click="setToMax"
        :disabled="sliderValue >= maxValue"
        class="flex-shrink-0 min-w-[3rem]"
      />
    </div>

    <!-- Read-Only Display (for ACs and Misc) -->
    <div v-else class="flex items-center justify-center py-2">
      <div class="text-center">
        <div class="text-lg font-bold text-surface-900 dark:text-surface-50 mb-1">
          {{ displayValue }}
        </div>
        <div class="text-xs text-surface-500 dark:text-surface-400">
          {{ category === 'ACs' ? 'Armor Class' : 'Misc Skill' }} (Read-Only)
        </div>
      </div>
    </div>
    
    <!-- Progress Bar (Visual Indicator for interactive skills only) -->
    <div v-if="!isReadOnly" class="mt-2">
      <div class="h-1 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
        <div 
          class="h-full transition-all duration-300 rounded-full"
          :class="progressColor"
          :style="{ width: progressPercentage + '%' }"
        ></div>
      </div>
    </div>
    
    <!-- Skill Cap Info -->
    <div v-if="showCapInfo" class="mt-1 text-xs text-surface-500 dark:text-surface-400">
      {{ capInfo }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import { calcIP, getBreedInitValue } from '@/lib/tinkerprofiles/ip-calculator';
import { getBreedId } from '@/services/game-utils';

// Props
const props = defineProps<{
  skillName: string;
  skillData: any;
  isAbility?: boolean;
  isReadOnly?: boolean;
  category: string;
  breed?: string;
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillName: string, newValue: number];
  'ability-changed': [abilityName: string, newValue: number];
}>();

// Helper functions
const getAbilityIndex = (abilityName: string): number => {
  const abilityMap: Record<string, number> = {
    'Strength': 0,
    'Agility': 1,
    'Stamina': 2,
    'Intelligence': 3,
    'Sense': 4,
    'Psychic': 5
  };
  return abilityMap[abilityName] ?? -1;
};

// State
const sliderValue = ref(props.skillData?.value || 0);

// Computed
const minValue = computed(() => {
  if (props.isAbility && props.breed) {
    const breedId = getBreedId(props.breed) || 0;
    const abilityIndex = getAbilityIndex(props.skillName);
    if (abilityIndex !== -1) {
      return getBreedInitValue(breedId, abilityIndex);
    }
  }
  return 1; // Base skill value for regular skills
});

const displayValue = computed(() => {
  const baseValue = sliderValue.value || 0;
  const trickleDown = props.skillData?.trickleDown || 0;
  return baseValue + trickleDown;
});

const maxValue = computed(() => {
  // Use the skill cap if available, otherwise use a reasonable default
  if (props.skillData?.cap !== undefined) {
    return props.skillData.cap;
  }
  
  // Default caps based on category
  if (props.isAbility) {
    return 1000; // Abilities can go higher
  }
  
  if (props.category === 'Misc') {
    return 100; // Misc skills typically lower
  }
  
  return 500; // Default skill cap
});

const ipCost = computed(() => {
  if (props.isAbility || props.category === 'Misc') {
    return 0; // Misc doesn't track IP
  }
  return props.skillData?.ipSpent || 0;
});

const progressPercentage = computed(() => {
  if (maxValue.value === 0) return 0;
  return Math.min((displayValue.value / maxValue.value) * 100, 100);
});

const progressColor = computed(() => {
  const percentage = progressPercentage.value;
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-orange-500';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-blue-500';
  return 'bg-green-500';
});

const showCapInfo = computed(() => {
  return props.skillData?.cap !== undefined;
});

const capInfo = computed(() => {
  if (!showCapInfo.value) return '';
  
  const remaining = maxValue.value - displayValue.value;
  if (remaining <= 0) {
    return 'At skill cap';
  } else if (remaining <= 10) {
    return `${remaining} points to cap`;
  } else {
    return `Cap: ${maxValue.value}`;
  }
});

// Methods
function onValueChanged(newValue: number | null) {
  if (newValue === null || newValue === undefined) return;
  
  const clampedValue = Math.max(minValue.value, Math.min(newValue, maxValue.value));
  sliderValue.value = clampedValue;
  
  if (props.isAbility) {
    emit('ability-changed', props.skillName, clampedValue);
  } else {
    emit('skill-changed', props.category, props.skillName, clampedValue);
  }
}

function setToMax() {
  onValueChanged(maxValue.value);
}

// Watchers
watch(() => props.skillData?.value, (newValue) => {
  if (newValue !== undefined && newValue !== sliderValue.value) {
    sliderValue.value = Math.max(newValue, minValue.value);
  }
}, { immediate: true });

// Watch minValue changes to ensure current value respects minimum
watch(minValue, (newMinValue) => {
  if (sliderValue.value < newMinValue) {
    sliderValue.value = newMinValue;
    onValueChanged(newMinValue);
  }
});
</script>

<style scoped>
.skill-slider {
  @apply transition-all duration-200;
}

.skill-slider:hover {
  @apply bg-surface-50 dark:bg-surface-800 rounded-md px-2 py-1 -mx-2 -my-1;
}

/* Input Number Styling */
:deep(.p-inputnumber-input) {
  text-align: center;
  padding: 0.25rem 0.5rem;
}

/* Slider Styling */
:deep(.p-slider) {
  height: 0.5rem;
}

:deep(.p-slider-handle) {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid #3b82f6;
  background: #ffffff;
}

:deep(.p-slider-range) {
  background: #3b82f6;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .skill-info-row {
    @apply flex-col items-start gap-2;
  }
  
  .skill-values {
    @apply w-full justify-start;
  }
}
</style>