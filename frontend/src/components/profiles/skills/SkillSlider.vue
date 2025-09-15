<!--
SkillSlider - Interactive skill value slider with IP calculations
Shows skill name, current value, IP cost, and interactive slider for value adjustment
-->
<template>
  <div class="skill-slider" :class="{ 'has-equipment-bonus': hasEquipmentBonus }">
    <!-- Skill Info Row -->
    <div class="skill-info-row flex items-center justify-between mb-2">
      <div class="flex items-center gap-2 flex-1 min-w-0 max-w-[16rem]">
        <!-- Cost Factor Dot -->
        <div 
          v-if="costFactorColor" 
          class="cost-factor-dot flex-shrink-0"
          :style="{ backgroundColor: costFactorColor.primary }"
        ></div>
        <span class="font-medium text-surface-900 dark:text-surface-50 truncate">
          {{ skillName }}
        </span>
        <span v-if="trickleDownBonus > 0" 
              class="text-xs text-green-600 dark:text-green-400 font-medium transition-all duration-300"
              :class="{ 'trickle-down-pulse': trickleDownChanged }">
          (+{{ trickleDownBonus }})
        </span>
      </div>
      
      <div class="skill-values flex items-center gap-2 flex-shrink-0 min-w-[7rem]">
        <!-- Current Value Display with Breakdown -->
        <div class="flex items-center gap-2">
          <span
            class="text-sm text-surface-600 dark:text-surface-400 min-w-[4rem] text-right cursor-help skill-value-display"
            v-tooltip.top="simpleTooltipContent"
          >
            {{ totalValue }} / {{ maxTotalValue }}
          </span>
          <span v-if="hasEquipmentBonus"
                class="text-xs cursor-help equipment-bonus-indicator"
                :class="equipmentBonusColorClass"
                v-tooltip.top="equipmentBonusTooltip"
          >
            <i class="pi pi-shield"></i>
            <span class="ml-1 font-medium equipment-bonus-value">
              {{ equipmentBonus > 0 ? '+' : '' }}{{ equipmentBonus }}
            </span>
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
        @slideend="onSliderChanged"
      />
      
      <!-- Input Number for precise entry with proper width -->
      <div 
        v-if="costFactorColor" 
        class="input-gradient-wrapper flex-shrink-0"
        :style="{ 
          '--gradient-color-primary': costFactorColor.primary,
          '--gradient-color-secondary': costFactorColor.secondary 
        }"
      >
        <InputNumber
          v-model="inputValue"
          :min="props.isAbility ? minValue : baseValue + trickleDownBonus"
          :max="props.isAbility ? maxValue : maxTotalValue"
          :step="1"
          size="small"
          class="gradient-input"
          @update:model-value="onInputChanged"
        />
      </div>
      <InputNumber
        v-else
        v-model="inputValue"
        :min="props.isAbility ? minValue : baseValue + trickleDownBonus"
        :max="props.isAbility ? maxValue : maxTotalValue"
        :step="1"
        size="small"
        class="flex-shrink-0"
        @update:model-value="onInputChanged"
      />
      
      <!-- Max Button with proper sizing -->
      <Button
        label="Max"
        size="small"
        severity="secondary"
        outlined
        @click="setToMax"
        :disabled="props.isAbility ? sliderValue >= maxValue : inputValue >= maxTotalValue"
        class="flex-shrink-0 min-w-[3rem]"
      />
    </div>

    <!-- Read-Only Display (for ACs and Misc) -->
    <div v-else class="flex items-center justify-center py-2">
      <div class="text-center">
        <div class="text-lg font-bold text-surface-900 dark:text-surface-50 mb-1">
          {{ totalValue }}
        </div>
        <div class="text-xs text-surface-500 dark:text-surface-400">
          {{ category === 'ACs' ? 'Armor Class' : 'Misc Skill' }} (Read-Only)
        </div>
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
import { calcIP, getBreedInitValue, ABILITY_INDEX_TO_STAT_ID } from '@/lib/tinkerprofiles/ip-calculator';
import { getBreedId } from '@/services/game-utils';
import { SKILL_COST_FACTORS, BREED_ABILITY_DATA } from '@/services/game-data';

// Props
const props = defineProps<{
  skillName: string;
  skillData: any;
  isAbility?: boolean;
  isReadOnly?: boolean;
  category: string;
  breed?: string;
  profession?: string;
  skillId: number;
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
// Initialize slider value properly for both abilities and skills
const sliderValue = ref(0);

// Input field value - shows total skill value for display/editing
const inputValue = ref(0);
const trickleDownChanged = ref(false);
const previousTrickleDown = ref(0);

// Flag to prevent watchers from interfering during user interaction
const isUserInteracting = ref(false);

// Computed
const minValue = computed(() => {
  if (props.isAbility && props.breed) {
    const breedId = getBreedId(props.breed) || 0;
    const abilityIndex = getAbilityIndex(props.skillName);
    if (abilityIndex !== -1) {
      const abilityStatId = ABILITY_INDEX_TO_STAT_ID[abilityIndex];
      return getBreedInitValue(breedId, abilityStatId);
    }
  }
  // For skills: slider minimum is 0 (no IP spent), regardless of trickle-down
  return 0;
});

// Core skill value components
const baseValue = computed(() => props.isAbility ? minValue.value : 5); // Base skill value
const trickleDownBonus = computed(() => props.skillData?.trickleDown || 0);
const ipContribution = computed(() => props.skillData?.pointFromIp || 0);
const equipmentBonus = computed(() => props.skillData?.equipmentBonus || 0);
const hasEquipmentBonus = computed(() => equipmentBonus.value !== 0);

// Equipment bonus visual indicators
const equipmentBonusColorClass = computed(() => {
  if (equipmentBonus.value > 0) {
    return 'text-green-500 dark:text-green-400'; // Positive bonus - green
  } else if (equipmentBonus.value < 0) {
    return 'text-red-500 dark:text-red-400'; // Negative bonus - red
  }
  return 'text-blue-500 dark:text-blue-400'; // Neutral - blue (fallback)
});

const equipmentBonusTooltip = computed(() => {
  const bonusType = equipmentBonus.value > 0 ? 'bonus' : 'penalty';
  const bonusValue = Math.abs(equipmentBonus.value);
  return `Equipment ${bonusType}: ${equipmentBonus.value > 0 ? '+' : '-'}${bonusValue} to ${props.skillName}`;
});

// Total displayed value (what the user sees)
const totalValue = computed(() => {
  if (props.isAbility) {
    // For abilities: use the actual value from profile
    return sliderValue.value || 0;
  } else {
    // For skills: use the total value from skill data directly
    return props.skillData?.value || 0;
  }
});

// Value breakdown tooltip
const valueBreakdown = computed(() => {
  if (props.isAbility) {
    const breedBase = minValue.value;
    const improvements = Math.max(0, totalValue.value - breedBase);
    return `Breed Base: ${breedBase} + Improvements: ${improvements} = ${totalValue.value}`;
  } else {
    return `Base: ${baseValue.value} + Trickle-down: ${trickleDownBonus.value} + IP: ${ipContribution.value} = ${totalValue.value}`;
  }
});

const showBreakdown = computed(() => {
  return !props.isAbility && (trickleDownBonus.value > 0 || ipContribution.value > 0 || equipmentBonus.value !== 0);
});

// Simple tooltip content for PrimeVue v-tooltip directive
const simpleTooltipContent = computed(() => {
  if (props.isAbility) {
    const breedBase = minValue.value;
    const improvements = ipContribution.value; // Use ipContribution which tracks pointFromIp
    const equipBonus = equipmentBonus.value;

    // Build tooltip parts
    const parts = [`Breed Base: ${breedBase}`];
    if (improvements > 0) parts.push(`Improvements: +${improvements}`);
    if (equipBonus !== 0) {
      parts.push(`Equipment: ${equipBonus > 0 ? '+' : ''}${equipBonus}`);
    }

    const breakdown = parts.join('\n');
    return `${props.skillName} Breakdown:\n${breakdown}\nTotal: ${totalValue.value}`;
  } else {
    const parts = [`Base: ${baseValue.value}`];
    if (trickleDownBonus.value > 0) parts.push(`Trickle-down: +${trickleDownBonus.value}`);
    if (equipmentBonus.value !== 0) {
      parts.push(`Equipment: ${equipmentBonus.value > 0 ? '+' : ''}${equipmentBonus.value}`);
    }
    if (ipContribution.value > 0) parts.push(`IP: +${ipContribution.value}`);

    const breakdown = parts.join('\n');
    return `${props.skillName} Breakdown:\n${breakdown}\nTotal: ${totalValue.value}`;
  }
});

// Maximum total skill value (for display purposes)
const maxTotalValue = computed(() => {
  if (props.isAbility) {
    // For abilities: use the skill cap directly
    if (props.skillData?.cap !== undefined) {
      return props.skillData.cap;
    }
    return 1000; // Default ability cap
  }
  
  // For skills: return the total skill cap (base + trickle + max IP improvements)
  return props.skillData?.cap || 500; // Total skill cap from IP calculator
});

// Maximum IP that can be spent (for slider limits)
const maxValue = computed(() => {
  if (props.isAbility) {
    // For abilities: use the skill cap directly
    if (props.skillData?.cap !== undefined) {
      return props.skillData.cap;
    }
    return 1000; // Default ability cap
  }
  
  // For skills: slider max is the amount of IP that can be spent
  // This is the skill cap minus the effective base (base + trickle-down)
  const skillCap = props.skillData?.cap || 500; // Default skill cap
  const effectiveBase = baseValue.value + trickleDownBonus.value;
  
  if (props.category === 'Misc') {
    return 100; // Misc skills typically lower
  }
  
  // Max IP spendable is cap minus effective base
  return Math.max(0, skillCap - effectiveBase);
});

const ipCost = computed(() => {
  if (props.isAbility || props.category === 'Misc') {
    return 0; // Misc doesn't track IP
  }
  return props.skillData?.ipSpent || 0;
});


const showCapInfo = computed(() => {
  return props.skillData?.cap !== undefined;
});

const capInfo = computed(() => {
  if (!showCapInfo.value) return '';
  
  const remaining = maxTotalValue.value - totalValue.value;
  if (remaining <= 0) {
    return 'At skill cap';
  } else if (remaining <= 10) {
    return `${remaining} points to cap`;
  } else {
    return `Cap: ${maxTotalValue.value}`;
  }
});

// Cost factor calculation
const costFactor = computed(() => {
  if (props.isAbility && props.breed) {
    // For abilities: use breed-based cost factors
    const breedId = getBreedId(props.breed);
    const abilityIndex = getAbilityIndex(props.skillName);
    if (breedId !== null && abilityIndex !== -1) {
      return BREED_ABILITY_DATA.cost_factors[breedId]?.[abilityIndex] || null;
    }
  } else if (!props.isAbility && props.profession) {
    // For skills: use profession-based cost factors with skillId
    const professionMap: Record<string, number> = {
      'Adventurer': 6, 'Agent': 5, 'Bureaucrat': 8, 'Doctor': 10, 'Enforcer': 9,
      'Engineer': 3, 'Fixer': 4, 'Keeper': 14, 'Martial Artist': 2, 'Meta-Physicist': 15,
      'Nano-Technician': 12, 'Soldier': 1, 'Trader': 7, 'Shade': 11
    };
    const professionId = professionMap[props.profession];
    if (professionId && props.skillId) {
      return SKILL_COST_FACTORS[props.skillId]?.[professionId] || null;
    }
  }
  return null;
});

// Cost factor color classification
const costFactorColor = computed(() => {
  const factor = costFactor.value;
  if (factor === null) return null;
  
  if (factor >= 1.0 && factor <= 1.1) {
    return { primary: '#09B178', secondary: '#0AB885' }; // Green - cheapest
  } else if (factor >= 1.2 && factor <= 1.5) {
    return { primary: '#08AFB0', secondary: '#09C5C6' }; // Teal - moderate
  } else if (factor >= 1.6 && factor <= 2.1) {
    return { primary: '#0D6495', secondary: '#0F75AA' }; // Blue - expensive
  } else if (factor >= 2.2) {
    return { primary: '#3366FF', secondary: '#4D7AFF' }; // Bright blue - most expensive
  }
  return null;
});

// Methods
function onSliderChanged(newValue: number | null) {
  // This is called when the user releases the slider (slideend event)
  // We use the current sliderValue which has been updated during dragging
  const valueToUse = sliderValue.value;

  isUserInteracting.value = true;

  const clampedValue = Math.max(minValue.value, Math.min(valueToUse, maxValue.value));

  // Update input value to reflect the change
  if (props.isAbility) {
    inputValue.value = clampedValue;
    emit('ability-changed', props.skillName, clampedValue);
  } else {
    // For skills, the slider value represents IP improvements only
    // The total skill value will be: base + trickle-down + IP improvements
    const totalSkillValue = baseValue.value + trickleDownBonus.value + clampedValue;
    inputValue.value = totalSkillValue;
    emit('skill-changed', props.category, props.skillName, totalSkillValue);
  }

  // Reset interaction flag after a short delay
  setTimeout(() => {
    isUserInteracting.value = false;
  }, 100);
}

function onInputChanged(newValue: number | null) {
  if (newValue === null || newValue === undefined) return;
  
  isUserInteracting.value = true;
  
  if (props.isAbility) {
    const clampedValue = Math.max(minValue.value, Math.min(newValue, maxValue.value));
    sliderValue.value = clampedValue;
    inputValue.value = clampedValue;
    emit('ability-changed', props.skillName, clampedValue);
  } else {
    // For skills: calculate the IP portion from total value
    const minTotal = baseValue.value + trickleDownBonus.value;
    const clampedTotal = Math.max(minTotal, Math.min(newValue, maxTotalValue.value));
    const ipPortion = Math.max(0, clampedTotal - baseValue.value - trickleDownBonus.value);
    
    sliderValue.value = ipPortion;
    inputValue.value = clampedTotal;
    emit('skill-changed', props.category, props.skillName, clampedTotal);
  }
  
  // Reset interaction flag after a short delay
  setTimeout(() => {
    isUserInteracting.value = false;
  }, 100);
}

function setToMax() {
  if (props.isAbility) {
    onSliderChanged(maxValue.value);
  } else {
    // For skills: set input to max total value, which will calculate the IP portion
    onInputChanged(maxTotalValue.value);
  }
}

// Watchers
// For abilities: watch the value field, for skills: watch the value field too (not pointFromIp)
watch(() => props.skillData?.value, (newValue, oldValue) => {
  if (newValue !== undefined) {
    // Always update on initial load (oldValue is undefined) or when not interacting
    const isInitialLoad = oldValue === undefined;
    if (isInitialLoad || !isUserInteracting.value) {
      if (props.isAbility) {
        // For abilities: the value directly represents the ability score
        sliderValue.value = Math.max(newValue, minValue.value);
        inputValue.value = sliderValue.value;
      } else {
        // For skills: the value represents the total skill value, 
        // we need to calculate the IP portion for the slider
        const totalSkillValue = newValue;
        const ipPortion = Math.max(0, totalSkillValue - baseValue.value - trickleDownBonus.value);
        sliderValue.value = Math.max(ipPortion, 0);
        inputValue.value = totalSkillValue;
      }
    }
  }
}, { immediate: true });

// Watch for slider value changes to update input field display (visual feedback only)
watch(sliderValue, (newValue) => {
  if (newValue !== undefined) {
    if (props.isAbility) {
      // For abilities, update the input display directly
      inputValue.value = newValue;
    } else {
      // For skills, update the input value display as the slider moves
      // This provides visual feedback without triggering expensive equipment updates
      const totalSkillValue = baseValue.value + trickleDownBonus.value + newValue;
      inputValue.value = totalSkillValue;
    }
  }
});

// Watch for changes that affect the total value to update input field
watch([baseValue, trickleDownBonus], (newValues, oldValues) => {
  if (!props.isAbility) {
    const isInitialLoad = oldValues === undefined || oldValues.some(v => v === undefined);
    if (isInitialLoad || !isUserInteracting.value) {
      inputValue.value = totalValue.value;
    }
  }
}, { immediate: true });

// Watch minValue changes to ensure current value respects minimum
watch(minValue, (newMinValue) => {
  if (sliderValue.value < newMinValue) {
    sliderValue.value = newMinValue;
    onSliderChanged(newMinValue);
  }
});

// Watch for trickle-down changes to trigger visual feedback
watch(trickleDownBonus, (newValue, oldValue) => {
  if (newValue !== oldValue && oldValue !== undefined && previousTrickleDown.value !== 0) {
    trickleDownChanged.value = true;
    // Reset the animation after a delay
    setTimeout(() => {
      trickleDownChanged.value = false;
    }, 2000);
  }
  previousTrickleDown.value = newValue;
}, { immediate: true });
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

/* Trickle-down change animation */
.trickle-down-pulse {
  @apply animate-pulse;
  animation: trickleDownGlow 2s ease-in-out;
  background: linear-gradient(45deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.3));
  border-radius: 0.25rem;
  padding: 0.125rem 0.25rem;
}

@keyframes trickleDownGlow {
  0%, 100% {
    box-shadow: 0 0 0 rgba(34, 197, 94, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.8);
    transform: scale(1.05);
  }
}

/* Cost Factor Dot */
.cost-factor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Input Gradient Wrapper */
.input-gradient-wrapper {
  position: relative;
  border-radius: 6px;
  padding: 2px;
  background: linear-gradient(90deg, 
    var(--gradient-color-primary) 0%, 
    transparent 25%, 
    transparent 75%, 
    var(--gradient-color-secondary) 100%
  );
}

.input-gradient-wrapper .gradient-input :deep(.p-inputnumber-input) {
  border-radius: 4px;
  border: none;
  background: var(--p-surface-0);
}

.dark .input-gradient-wrapper .gradient-input :deep(.p-inputnumber-input) {
  background: var(--p-surface-900);
}

/* Tooltip styling */
:deep(.stat-breakdown-tooltip-root) {
  @apply max-w-none;
}

:deep(.stat-breakdown-tooltip-text) {
  @apply p-0;
}

/* Equipment bonus indicator styling */
.equipment-bonus-indicator {
  @apply transition-all duration-200 flex items-center;
}

.equipment-bonus-indicator:hover {
  @apply transform scale-110;
}

.equipment-bonus-indicator .pi-shield {
  @apply transition-all duration-200;
}

.equipment-bonus-value {
  @apply transition-all duration-200;
}

/* Equipment bonus highlighting for the entire skill slider */
.skill-slider.has-equipment-bonus {
  position: relative;
}

.skill-slider.has-equipment-bonus::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -4px;
  right: -4px;
  bottom: -2px;
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.1) 0%,
    transparent 25%,
    transparent 75%,
    rgba(59, 130, 246, 0.1) 100%
  );
  border-radius: 6px;
  pointer-events: none;
  z-index: -1;
  transition: all 0.3s ease;
}

.skill-slider.has-equipment-bonus:hover::before {
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.2) 0%,
    rgba(59, 130, 246, 0.05) 25%,
    rgba(59, 130, 246, 0.05) 75%,
    rgba(59, 130, 246, 0.2) 100%
  );
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
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