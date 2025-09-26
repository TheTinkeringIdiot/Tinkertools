<!--
SkillsGrid - Grid-based skill display with integrated tooltips
Provides a responsive grid layout for skills with stat breakdown tooltips
-->
<template>
  <div class="skills-grid">
    <!-- Grid Container -->
    <div
      class="grid gap-4"
      :class="{
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3': gridMode === 'compact',
        'grid-cols-1 lg:grid-cols-2': gridMode === 'detailed',
        'grid-cols-1': gridMode === 'list'
      }"
    >
      <div
        v-for="(skill, skillId) in skills"
        :key="skillId"
        class="skill-grid-item bg-surface-50 dark:bg-surface-800 rounded-lg p-3 transition-all duration-200 hover:bg-surface-100 dark:hover:bg-surface-700 hover:shadow-sm"
      >
        <SkillSlider
          :skill-name="getSkillName(skillId)"
          :skill-data="skill"
          :is-ability="isAbilities"
          :is-read-only="isReadOnly"
          :category="category"
          :breed="breed"
          :profession="profession"
          :skill-id="Number(skillId)"
          @skill-changed="handleSkillChanged"
          @ability-changed="handleAbilityChanged"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="skillCount === 0" class="text-center py-8">
      <i class="pi pi-info-circle text-3xl text-surface-300 dark:text-surface-600 mb-3"></i>
      <p class="text-surface-500 dark:text-surface-400">No skills in this category</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, provide } from 'vue';
import SkillSlider from './SkillSlider.vue';
import { skillService } from '@/services/skill-service';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import type { SkillId, SkillData } from '@/types/skills';

// Props
const props = defineProps<{
  skills: Record<SkillId, SkillData>;
  category: string;
  isAbilities?: boolean;
  isReadOnly?: boolean;
  breed?: string;
  profession?: string;
  gridMode?: 'compact' | 'detailed' | 'list';
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillName: string, newValue: number];
  'ability-changed': [abilityName: string, newValue: number];
}>();

// Inject the profile from parent and re-provide for children
const profile = inject<TinkerProfile>('profile');
if (profile) {
  // Re-provide for child components (SkillSlider)
  provide('profile', profile);
}

// Computed
const skillCount = computed(() => {
  return Object.keys(props.skills).length;
});

// Methods
function getSkillName(skillId: SkillId | string): string {
  try {
    const numericId = typeof skillId === 'string' ? parseInt(skillId, 10) : skillId;
    return skillService.getName(numericId);
  } catch (error) {
    console.warn(`[SkillsGrid] Failed to resolve skill name for ID ${skillId}:`, error);
    return `Unknown Skill (${skillId})`;
  }
}

function handleSkillChanged(category: string, skillName: string, newValue: number) {
  emit('skill-changed', category, skillName, newValue);
}

function handleAbilityChanged(abilityName: string, newValue: number) {
  emit('ability-changed', abilityName, newValue);
}
</script>

<style scoped>
.skills-grid {
  @apply w-full;
}

.skill-grid-item {
  @apply border border-surface-200 dark:border-surface-700;
  min-height: fit-content;
}

/* Ensure skills display properly in grid layout */
.skill-grid-item :deep(.skill-slider) {
  @apply m-0;
}

/* Compact mode adjustments */
.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3 .skill-grid-item :deep(.skill-info-row) {
  @apply flex-col items-start gap-1;
}

.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3 .skill-grid-item :deep(.skill-values) {
  @apply w-full justify-start;
}

/* Responsive design */
@media (max-width: 640px) {
  .skills-grid {
    @apply space-y-2;
  }

  .skills-grid .grid {
    @apply grid-cols-1 gap-2;
  }
}

/* Animation for grid items */
.skill-grid-item {
  @apply transform transition-transform;
}

.skill-grid-item:hover {
  @apply scale-[1.02];
}

/* Focus states for accessibility */
.skill-grid-item:focus-within {
  @apply ring-2 ring-primary-500 dark:ring-primary-400 ring-opacity-50;
}
</style>