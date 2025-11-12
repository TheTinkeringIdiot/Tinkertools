<!--
SkillsManager - Complete skills and abilities management
Interactive skill categories with expandable panels and sliders with IP calculations
-->
<template>
  <div class="skills-manager space-y-4">
    <!-- Core Abilities Section -->
    <SkillCategory
      title="Core Abilities"
      icon="pi pi-user"
      :skills="coreAbilities"
      :is-abilities="true"
      :breed="breed"
      :profession="profession"
      @ability-changed="handleAbilityChange"
      @skill-changed="handleSkillChange"
    />

    <!-- Non-Misc Skill Categories -->
    <template v-for="(skills, categoryName) in skillCategories" :key="categoryName">
      <!-- Special handling for Misc category with toggle -->
      <template v-if="categoryName === 'Misc'">
        <!-- Misc Category Toggle -->
        <div
          class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-3 mb-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="pi pi-ellipsis-h text-primary-500"></i>
              <span class="text-sm font-medium text-surface-700 dark:text-surface-300"
                >Misc Skills Options</span
              >
            </div>
            <div class="flex items-center gap-2">
              <Checkbox
                v-model="showZeroMiscSkills"
                inputId="show-zero-misc"
                binary
                @change="toggleZeroMiscSkills"
              />
              <label
                for="show-zero-misc"
                class="text-sm text-surface-600 dark:text-surface-400 cursor-pointer"
              >
                Show Zero Values
              </label>
            </div>
          </div>
        </div>

        <!-- Misc Category -->
        <SkillCategory
          :title="categoryName"
          :icon="getCategoryIcon(categoryName)"
          :skills="getCategorySkills(categoryName)"
          :is-read-only="isReadOnlyCategory(categoryName)"
          :breed="breed"
          :profession="profession"
          @skill-changed="handleSkillChange"
        />
      </template>

      <!-- Regular categories -->
      <template v-else>
        <SkillCategory
          :title="categoryName"
          :icon="getCategoryIcon(categoryName)"
          :skills="getCategorySkills(categoryName)"
          :is-read-only="isReadOnlyCategory(categoryName)"
          :breed="breed"
          :profession="profession"
          @skill-changed="handleSkillChange"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, provide, toRef } from 'vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import { useSkills } from '@/composables/useSkills';
import { skillService } from '@/services/skill-service';
import SkillCategory from './SkillCategory.vue';
import Checkbox from 'primevue/checkbox';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillId: number, newValue: number];
  'ability-changed': [abilityName: string, newValue: number];
}>();

// Provide profile for AC calculation in child components
// IMPORTANT: Provide computed ref to ensure reactivity when profile prop changes
provide('profile', computed(() => props.profile));

// Use skills composable for skill operations with the viewed profile
// Don't pass profile in options - rely on injection for reactivity
const { getSkillsByCategory } = useSkills();

// State for Misc skills zero-value toggle
const showZeroMiscSkills = ref(false);

// Load toggle preference from localStorage on mount
onMounted(() => {
  const stored = localStorage.getItem('tinkertools_show_zero_misc_skills');
  if (stored !== null) {
    showZeroMiscSkills.value = JSON.parse(stored);
  }
});

// Save toggle preference to localStorage when changed
function toggleZeroMiscSkills() {
  // The v-model already updates showZeroMiscSkills.value, so we just save it
  localStorage.setItem(
    'tinkertools_show_zero_misc_skills',
    JSON.stringify(showZeroMiscSkills.value)
  );
}

// Computed
const coreAbilities = computed(() => {
  return getCategorySkills('Attributes');
});

const breed = computed(() => {
  return props.profile.Character?.Breed || 'Solitus';
});

const profession = computed(() => {
  return props.profile.Character?.Profession || 'Adventurer';
});

// Helper function to get skills for a category as ID-based object
function getCategorySkills(category: string): Record<string, any> {
  try {
    const skillTuples = getSkillsByCategory(category);
    const skillsById: Record<string, any> = {};

    for (const [skillId, skillData] of skillTuples) {
      skillsById[skillId.toString()] = skillData;
    }

    return skillsById;
  } catch (error) {
    console.warn(`[SkillsManager] Failed to get skills for category "${category}":`, error);
    return {};
  }
}

// Filtered Misc skills based on toggle state
const filteredMiscSkills = computed(() => {
  const miscSkillsById = getCategorySkills('Misc');
  if (!miscSkillsById || Object.keys(miscSkillsById).length === 0) return {};

  if (showZeroMiscSkills.value) {
    // Show all Misc skills
    return miscSkillsById;
  } else {
    // Filter out skills with value of 0
    const filtered: Record<string, any> = {};
    Object.entries(miscSkillsById).forEach(([skillId, skillData]) => {
      // Handle SkillData objects which have multiple bonus properties
      let value = 0;
      if (typeof skillData === 'number') {
        value = skillData;
      } else if (skillData && typeof skillData === 'object') {
        // Use the total value from SkillData
        value = skillData.total || 0;
      }
      if (value > 0) {
        filtered[skillId] = skillData;
      }
    });
    return filtered;
  }
});

const skillCategories = computed(() => {
  // Define the order of skill categories, with ACs and Misc at the bottom
  const categoryOrder = [
    'Body & Defense',
    'Ranged Weapons',
    'Ranged Specials',
    'Melee Weapons',
    'Melee Specials',
    'Nanos & Casting',
    'Exploring',
    'Trade & Repair',
    'Combat & Healing',
    'ACs', // Non-modifiable, moved to bottom
    'Misc', // Non-modifiable, at the end
  ];

  // Create ordered categories object
  const orderedCategories: Record<string, any> = {};

  categoryOrder.forEach((categoryName) => {
    if (categoryName !== 'Attributes') {
      try {
        // Use filtered Misc skills for the Misc category
        if (categoryName === 'Misc') {
          orderedCategories[categoryName] = filteredMiscSkills.value;
        } else {
          const categorySkills = getCategorySkills(categoryName);
          if (Object.keys(categorySkills).length > 0) {
            orderedCategories[categoryName] = categorySkills;
          }
        }
      } catch (error) {
        console.warn(`[SkillsManager] Failed to get skills for category "${categoryName}":`, error);
      }
    }
  });

  return orderedCategories;
});

// Methods
function getCategoryIcon(categoryName: string): string {
  const iconMap: Record<string, string> = {
    'Body & Defense': 'pi pi-shield',
    ACs: 'pi pi-chart-line',
    'Ranged Weapons': 'pi pi-crosshairs',
    'Ranged Specials': 'pi pi-star',
    'Melee Weapons': 'pi pi-sword',
    'Melee Specials': 'pi pi-flash',
    'Nanos & Casting': 'pi pi-sparkles',
    Exploring: 'pi pi-compass',
    'Trade & Repair': 'pi pi-wrench',
    'Combat & Healing': 'pi pi-heart',
    Misc: 'pi pi-ellipsis-h',
  };
  return iconMap[categoryName] || 'pi pi-cog';
}

function handleAbilityChange(abilityName: string, newValue: number) {
  emit('ability-changed', abilityName, newValue);
}

function handleSkillChange(category: string, skillId: string, newValue: number) {
  // Emit the skill ID as a number for the parent component
  const numericSkillId = parseInt(skillId, 10);
  emit('skill-changed', category, numericSkillId, newValue);
}

function isReadOnlyCategory(categoryName: string): boolean {
  return categoryName === 'ACs' || categoryName === 'Misc';
}
</script>
