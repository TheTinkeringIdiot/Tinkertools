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
        <span
          v-if="trickleDownBonus > 0"
          class="text-xs text-green-600 dark:text-green-400 font-medium transition-all duration-300"
          :class="{ 'trickle-down-pulse': trickleDownChanged }"
        >
          (+{{ trickleDownBonus }})
        </span>
      </div>

      <div class="skill-values flex items-center gap-2 flex-shrink-0 min-w-[7rem]">
        <!-- Current Value Display with Breakdown -->
        <div class="flex items-center gap-2">
          <span
            v-if="!isReadOnly"
            class="text-sm text-surface-600 dark:text-surface-400 min-w-[4rem] text-right skill-value-display"
          >
            {{ totalValue }} / {{ maxTotalValue }}
          </span>
          <span
            v-if="hasEquipmentBonus"
            v-tooltip.top="equipmentBonusTooltip"
            class="text-xs cursor-help equipment-bonus-indicator"
            :class="equipmentBonusColorClass"
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
          <span
            class="text-sm text-blue-600 dark:text-blue-400 font-medium min-w-[2rem] text-right"
          >
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
        :max="maxTotalValue"
        :step="1"
        class="flex-1 min-w-[100px] max-w-none"
        @slideend="onSliderChanged"
      />

      <!-- Input Number for precise entry with proper width -->
      <div
        v-if="costFactorColor"
        v-tooltip.top="simpleTooltipContent"
        class="input-gradient-wrapper flex-shrink-0"
        :style="{
          '--gradient-color-primary': costFactorColor.primary,
          '--gradient-color-secondary': costFactorColor.secondary,
        }"
      >
        <InputNumber
          :model-value="inputValue"
          :min="minValue"
          :max="maxTotalValue"
          :step="1"
          size="small"
          class="gradient-input"
          @update:model-value="onInputChanged"
        />
      </div>
      <InputNumber
        v-else
        v-tooltip.top="simpleTooltipContent"
        :model-value="inputValue"
        :min="minValue"
        :max="maxTotalValue"
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
        :disabled="inputValue >= maxTotalValue"
        class="flex-shrink-0 min-w-[3rem]"
        @click="setToMax"
      />
    </div>

    <!-- Read-Only Display (for ACs and Misc) -->
    <div v-else class="flex items-center justify-center py-2">
      <div class="text-center">
        <div
          v-tooltip.top="simpleTooltipContent"
          class="text-lg font-bold text-surface-900 dark:text-surface-50 mb-1 cursor-help"
        >
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
import { getBreedInitValue, STAT_ID_TO_ABILITY_INDEX } from '@/lib/tinkerprofiles/ip-calculator';
import { SKILL_COST_FACTORS, BREED_ABILITY_DATA } from '@/services/game-data';
import type { SkillData } from '@/lib/tinkerprofiles/types';
import { skillService } from '@/services/skill-service';
import type { SkillId } from '@/types/skills';

// Props
const props = defineProps<{
  skillId: SkillId | number;
  skillData: SkillData | null;
  isAbility?: boolean;
  isReadOnly?: boolean;
  category: string;
  breed?: number;
  profession?: number;
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillId: number, newValue: number];
  'ability-changed': [skillId: number, newValue: number];
}>();

// Computed properties for skill information
const skillName = computed(() => {
  try {
    return skillService.getName(props.skillId);
  } catch {
    return `Unknown Skill (${props.skillId})`;
  }
});

// 0-based ability index (Strength..Psychic) for breed data lookups, -1 if not an ability
const abilityIndex = computed(() => STAT_ID_TO_ABILITY_INDEX[Number(props.skillId)] ?? -1);

// State
// The slider and the input both hold the displayed total (bonuses included).
// The profile store is sent the trained value instead: see emitTrainedValue.
const sliderValue = ref(0);
const inputValue = ref(0);
const trickleDownChanged = ref(false);
const previousTrickleDown = ref(0);

// Flag to prevent watchers from interfering during user interaction
const isUserInteracting = ref(false);
// Flag to prevent emitting during programmatic updates (like profile loading)
const isProgrammaticUpdate = ref(false);

// Computed
// Abilities: breed starting value plus bonuses (no IP spent)
const abilityMinValue = computed(() => {
  const breedBase = getBreedInitValue(props.breed ?? 1, Number(props.skillId)); // Default to Solitus
  return breedBase + equipmentBonus.value + perkBonus.value + buffBonus.value;
});

const minValue = computed(() => {
  if (props.isAbility) {
    return abilityMinValue.value;
  }
  // For skills: slider minimum is base + trickle + bonuses (no IP spent)
  return (
    baseValue.value +
    trickleDownBonus.value +
    equipmentBonus.value +
    perkBonus.value +
    buffBonus.value
  );
});

// Helper to check if skill is a Misc skill
const isMiscSkill = computed(() => props.category === 'Misc');

// Core skill value components
const baseValue = computed(() => {
  if (props.isAbility) {
    return abilityMinValue.value;
  } else if (props.category === 'ACs') {
    // ACs have no base value, only bonuses
    return 0;
  } else if (isMiscSkill.value) {
    // Misc skills carry their base value in the skill data
    return props.skillData?.base || 0;
  } else {
    // Regular skills have a base value of 5
    return 5;
  }
});

const trickleDownBonus = computed(() => {
  if (isMiscSkill.value || props.isAbility || props.category === 'ACs') {
    // Misc skills, abilities, and ACs don't have trickle-down bonuses
    return 0;
  }
  return props.skillData?.trickle || 0;
});

const ipContribution = computed(() => {
  if (isMiscSkill.value || props.isAbility || props.category === 'ACs') {
    // Misc skills, ACs don't use IP system, abilities handle IP separately
    return 0;
  }
  return props.skillData?.pointsFromIp || 0;
});
const equipmentBonus = computed(() => props.skillData?.equipmentBonus || 0);
const perkBonus = computed(() => props.skillData?.perkBonus || 0);
const buffBonus = computed(() => props.skillData?.buffBonus || 0);
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
  return `Equipment ${bonusType}: ${equipmentBonus.value > 0 ? '+' : '-'}${bonusValue} to ${skillName.value}`;
});

// Total displayed value (what the user sees)
const totalValue = computed(() => {
  if (props.isAbility) {
    // For abilities: use the actual value from profile, or breed base if no IP invested
    return sliderValue.value || minValue.value;
  } else if (props.category === 'ACs') {
    // For ACs: use the total from skill data (already calculated and stored)
    if (props.skillData?.total !== undefined) {
      return props.skillData.total;
    }
    // Fallback: calculate from bonuses only
    return equipmentBonus.value + perkBonus.value + buffBonus.value;
  } else if (isMiscSkill.value) {
    // For Misc skills: calculate total from all bonuses
    // The value property should be set by ip-integrator, but calculate as fallback
    if (props.skillData?.total !== undefined) {
      return props.skillData.total;
    }
    // Fallback: calculate from individual bonuses
    return baseValue.value + equipmentBonus.value + perkBonus.value + buffBonus.value;
  } else {
    // For regular skills: use the total value from skill data, or calculate from components if not set
    if (props.skillData?.total !== undefined) {
      return props.skillData.total;
    }
    // Fallback: calculate from base + trickle-down + IP when value isn't set
    return baseValue.value + trickleDownBonus.value + ipContribution.value;
  }
});

// Simple tooltip content for PrimeVue v-tooltip directive
const simpleTooltipContent = computed(() => {
  if (props.isAbility) {
    // Calculate raw breed base without any bonuses
    const breedId = props.breed ?? 1; // Default to Solitus
    const breedBase = getBreedInitValue(breedId, Number(props.skillId));

    const improvements = props.skillData?.pointsFromIp || 0; // Get IP points directly from skillData
    const equipBonus = equipmentBonus.value;

    // Build tooltip parts
    const parts = [`Breed Base: ${breedBase}`];
    if (improvements > 0) parts.push(`IP: +${improvements}`);
    if (equipBonus !== 0) {
      parts.push(`Equipment: ${equipBonus > 0 ? '+' : ''}${equipBonus}`);
    }
    if (perkBonus.value !== 0) {
      parts.push(`Perks: ${perkBonus.value > 0 ? '+' : ''}${perkBonus.value}`);
    }
    if (buffBonus.value !== 0) {
      parts.push(`Buffs: ${buffBonus.value > 0 ? '+' : ''}${buffBonus.value}`);
    }

    const breakdown = parts.join('\n');
    return `${skillName.value} Breakdown:\n${breakdown}\nTotal: ${totalValue.value}`;
  } else if (props.category === 'ACs') {
    // Tooltip for ACs (only bonuses, no base/trickle/IP)
    const parts = [];
    if (equipmentBonus.value !== 0) {
      parts.push(`Equipment: ${equipmentBonus.value > 0 ? '+' : ''}${equipmentBonus.value}`);
    }
    if (perkBonus.value !== 0) {
      parts.push(`Perks: ${perkBonus.value > 0 ? '+' : ''}${perkBonus.value}`);
    }
    if (buffBonus.value !== 0) {
      parts.push(`Buffs: ${buffBonus.value > 0 ? '+' : ''}${buffBonus.value}`);
    }

    const breakdown = parts.length > 0 ? parts.join('\n') : 'No bonuses';
    return `${skillName.value} Breakdown:\n${breakdown}\nTotal: ${totalValue.value}`;
  } else if (isMiscSkill.value) {
    // Tooltip for Misc skills (no trickle-down or IP)
    const parts = [`Base: ${baseValue.value}`];
    if (equipmentBonus.value !== 0) {
      parts.push(`Equipment: ${equipmentBonus.value > 0 ? '+' : ''}${equipmentBonus.value}`);
    }
    if (perkBonus.value !== 0) {
      parts.push(`Perks: ${perkBonus.value > 0 ? '+' : ''}${perkBonus.value}`);
    }
    if (buffBonus.value !== 0) {
      parts.push(`Buffs: ${buffBonus.value > 0 ? '+' : ''}${buffBonus.value}`);
    }

    const breakdown = parts.join('\n');
    return `${skillName.value} Breakdown:\n${breakdown}\nTotal: ${totalValue.value}`;
  } else {
    // Tooltip for regular skills
    const parts = [`Base: ${baseValue.value}`];
    if (trickleDownBonus.value > 0) parts.push(`Trickle-down: +${trickleDownBonus.value}`);
    if (equipmentBonus.value !== 0) {
      parts.push(`Equipment: ${equipmentBonus.value > 0 ? '+' : ''}${equipmentBonus.value}`);
    }
    if (perkBonus.value !== 0) {
      parts.push(`Perks: ${perkBonus.value > 0 ? '+' : ''}${perkBonus.value}`);
    }
    if (buffBonus.value !== 0) {
      parts.push(`Buffs: ${buffBonus.value > 0 ? '+' : ''}${buffBonus.value}`);
    }
    if (ipContribution.value > 0) parts.push(`IP: +${ipContribution.value}`);

    const breakdown = parts.join('\n');
    return `${skillName.value} Breakdown:\n${breakdown}\nTotal: ${totalValue.value}`;
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

const ipCost = computed(() => {
  if (props.isAbility || isMiscSkill.value) {
    return 0; // Abilities and Misc don't track IP
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
  if (props.isAbility && props.breed !== undefined) {
    // For abilities: use breed-based cost factors
    const breedId = props.breed;
    if (abilityIndex.value !== -1) {
      return BREED_ABILITY_DATA.cost_factors[breedId]?.[abilityIndex.value] || null;
    }
  } else if (!props.isAbility && props.profession !== undefined) {
    // For skills: use profession-based cost factors with skillId
    const professionId = props.profession;
    return SKILL_COST_FACTORS[Number(props.skillId)]?.[professionId] || null;
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
/** Equipment, perk and buff bonuses: shown in the total but never trained. */
const bonusTotal = computed(() => equipmentBonus.value + perkBonus.value + buffBonus.value);

/**
 * Emit a new displayed total as the trained value the store expects:
 * modifyAbility takes breed base + IP, modifySkill takes 5 + trickle-down + IP.
 * Neither includes bonuses, so they are subtracted here.
 */
function emitTrainedValue(displayedTotal: number) {
  const trainedValue = displayedTotal - bonusTotal.value;
  if (props.isAbility) {
    emit('ability-changed', Number(props.skillId), trainedValue);
  } else {
    emit('skill-changed', props.category, Number(props.skillId), trainedValue);
  }
}

function clampTotal(value: number): number {
  return Math.max(minValue.value, Math.min(value, maxTotalValue.value));
}

function onSliderChanged() {
  // Don't emit during programmatic updates (e.g. profile loading)
  if (isProgrammaticUpdate.value) {
    return;
  }

  isUserInteracting.value = true;

  const clampedTotal = clampTotal(sliderValue.value);
  inputValue.value = clampedTotal;
  emitTrainedValue(clampedTotal);

  // Reset interaction flag after a short delay
  setTimeout(() => {
    isUserInteracting.value = false;
  }, 100);
}

function onInputChanged(newValue: number | null) {
  if (newValue === null || newValue === undefined) return;

  // Don't emit during programmatic updates (e.g. profile loading)
  if (isProgrammaticUpdate.value) {
    return;
  }

  // Skip if the value didn't actually change (prevents duplicate emissions).
  // The input is bound one-way, so inputValue still holds the previous value here.
  if (inputValue.value === newValue && !isUserInteracting.value) {
    return;
  }

  isUserInteracting.value = true;

  const clampedTotal = clampTotal(newValue);
  sliderValue.value = clampedTotal;
  inputValue.value = clampedTotal;
  emitTrainedValue(clampedTotal);

  // Reset interaction flag after a short delay
  setTimeout(() => {
    isUserInteracting.value = false;
  }, 100);
}

function setToMax() {
  onInputChanged(maxTotalValue.value);
}

// Watchers
// Watch the total field for abilities, skills and ACs alike (not pointsFromIp)
watch(
  () => props.skillData?.total,
  (newValue, oldValue) => {
    // Always update on initial load (oldValue is undefined) or when not interacting
    const isInitialLoad = oldValue === undefined;

    if (newValue !== undefined) {
      if (isInitialLoad || !isUserInteracting.value) {
        // Set flag to prevent onInputChanged from emitting during programmatic updates
        isProgrammaticUpdate.value = true;

        // ACs are read-only, so there is no slider to update
        if (props.category !== 'ACs') {
          sliderValue.value = Math.max(newValue, minValue.value);
          inputValue.value = sliderValue.value;
        }

        // Clear flag after a short delay to ensure InputNumber event has processed
        setTimeout(() => {
          isProgrammaticUpdate.value = false;
        }, 10);
      }
    } else if (isInitialLoad) {
      // Handle case where skillData.value is undefined (no IP invested yet)
      isProgrammaticUpdate.value = true;

      // Nothing trained yet: show the minimum (breed base, or 5 + trickle-down, plus bonuses)
      if (props.isAbility || (!props.isReadOnly && props.category !== 'ACs')) {
        sliderValue.value = minValue.value;
        inputValue.value = minValue.value;
      }

      // Clear flag after a short delay to ensure InputNumber event has processed
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
      }, 10);
    }
  },
  { immediate: true }
);

// Watch for slider value changes to update input field display (visual feedback only)
watch(sliderValue, (newValue) => {
  if (newValue !== undefined) {
    // Set flag during programmatic update from slider watcher
    isProgrammaticUpdate.value = true;

    // Update the input display as the slider moves; the store is only updated
    // on slide end, avoiding expensive recalculation while dragging
    inputValue.value = newValue;

    // Clear flag on next tick
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 0);
  }
});

// Watch for changes that affect the total value to update input field
watch(
  [baseValue, trickleDownBonus],
  (newValues, oldValues) => {
    if (!props.isAbility) {
      const isInitialLoad = oldValues === undefined || oldValues.some((v) => v === undefined);
      if (isInitialLoad || !isUserInteracting.value) {
        isProgrammaticUpdate.value = true;
        inputValue.value = totalValue.value;
        setTimeout(() => {
          isProgrammaticUpdate.value = false;
        }, 0);
      }
    }
  },
  { immediate: true }
);

// Watch for trickle-down changes to trigger visual feedback
watch(
  trickleDownBonus,
  (newValue, oldValue) => {
    if (newValue !== oldValue && oldValue !== undefined && previousTrickleDown.value !== 0) {
      trickleDownChanged.value = true;
      // Reset the animation after a delay
      setTimeout(() => {
        trickleDownChanged.value = false;
      }, 2000);
    }
    previousTrickleDown.value = newValue;
  },
  { immediate: true }
);
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
  0%,
  100% {
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
  background: linear-gradient(
    90deg,
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
  background: linear-gradient(
    135deg,
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
  background: linear-gradient(
    135deg,
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
