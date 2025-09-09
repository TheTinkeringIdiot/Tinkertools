<!--
SkillCategory - Expandable skill category with interactive sliders
Shows skills in a category with IP cost calculations and interactive value adjustment
-->
<template>
  <div class="skill-category bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
    <!-- Category Header -->
    <div 
      class="category-header p-4 bg-surface-50 dark:bg-surface-800 cursor-pointer select-none transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
      @click="toggleExpanded"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <i :class="icon" class="text-primary-500 text-lg"></i>
          <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
            {{ title }}
          </h4>
          <Badge v-if="skillCount > 0" :value="skillCount.toString()" severity="info" size="small" />
        </div>
        
        <div class="flex items-center gap-2">
          <!-- Total IP Cost for Category -->
          <div v-if="totalIPCost > 0" class="text-sm text-surface-600 dark:text-surface-400">
            IP: {{ totalIPCost }}
          </div>
          
          <!-- Expand/Collapse Icon -->
          <i 
            :class="isExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            class="text-surface-500 dark:text-surface-400 transition-transform duration-200"
          ></i>
        </div>
      </div>
    </div>
    
    <!-- Category Content -->
    <Transition name="expand">
      <div v-if="isExpanded" class="category-content">
        <div class="p-4 space-y-3">
          <!-- Skills/Abilities List -->
          <div 
            v-for="(skill, skillName) in skills"
            :key="skillName"
            class="skill-item"
          >
            <SkillSlider
              :skill-name="skillName"
              :skill-data="skill"
              :is-ability="isAbilities"
              :is-read-only="isReadOnly"
              :category="title"
              :breed="breed"
              :profession="profession"
              :skill-id="getSkillId(skillName)"
              @skill-changed="handleSkillChanged"
              @ability-changed="handleAbilityChanged"
            />
          </div>
          
          <!-- Empty State -->
          <div v-if="skillCount === 0" class="text-center py-4">
            <i class="pi pi-info-circle text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
            <p class="text-sm text-surface-500 dark:text-surface-400">No skills in this category</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Badge from 'primevue/badge';
import SkillSlider from './SkillSlider.vue';
import { getSkillStatId } from '@/utils/skill-registry';

// Props
const props = defineProps<{
  title: string;
  icon: string;
  skills: Record<string, any>;
  isAbilities?: boolean;
  isReadOnly?: boolean;
  breed?: string;
  profession?: string;
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillName: string, newValue: number];
  'ability-changed': [abilityName: string, newValue: number];
}>();

// State
// Core Abilities and Body & Defense should default to expanded, others collapsed
const isExpanded = ref(props.title === 'Core Abilities' || props.title === 'Body & Defense');

// Computed
const skillCount = computed(() => {
  return Object.keys(props.skills).length;
});

const totalIPCost = computed(() => {
  if (props.isAbilities) {
    // For abilities, sum up ipSpent values
    return Object.values(props.skills).reduce((total: number, skill: any) => {
      return total + (skill?.ipSpent || 0);
    }, 0);
  } else {
    // For skills, sum up ipSpent values (except Misc category which doesn't track IP)
    if (props.title === 'Misc') return 0;
    return Object.values(props.skills).reduce((total: number, skill: any) => {
      return total + (skill?.ipSpent || 0);
    }, 0);
  }
});

// Methods
function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function getSkillId(skillName: string): number | undefined {
  return getSkillStatId(skillName) || undefined;
}

function handleSkillChanged(category: string, skillName: string, newValue: number) {
  emit('skill-changed', category, skillName, newValue);
}

function handleAbilityChanged(abilityName: string, newValue: number) {
  emit('ability-changed', abilityName, newValue);
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
  max-height: 1000px;
  opacity: 1;
}

/* Category Header Styling */
.category-header:active {
  transform: translateY(1px);
}

/* Skill Item Spacing */
.skill-item:not(:last-child) {
  border-bottom: 1px solid theme('colors.surface.200');
  padding-bottom: 0.75rem;
  margin-bottom: 0.75rem;
}

.dark .skill-item:not(:last-child) {
  border-bottom-color: theme('colors.surface.700');
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .category-header {
    padding: 1rem;
  }
  
  .category-content {
    padding: 1rem;
  }
}
</style>