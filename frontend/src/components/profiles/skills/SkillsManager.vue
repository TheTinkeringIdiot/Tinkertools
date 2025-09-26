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
        <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-3 mb-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="pi pi-ellipsis-h text-primary-500"></i>
              <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Misc Skills Options</span>
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
          :skills="skills"
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
          :skills="skills"
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
import { computed, ref, onMounted, provide } from 'vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import SkillCategory from './SkillCategory.vue';
import Checkbox from 'primevue/checkbox';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillName: string, newValue: number];
  'ability-changed': [abilityName: string, newValue: number];
}>();

// Provide profile for AC calculation in child components
provide('profile', props.profile);

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
  localStorage.setItem('tinkertools_show_zero_misc_skills', JSON.stringify(showZeroMiscSkills.value));
}

// Computed
const coreAbilities = computed(() => {
  return props.profile.Skills?.Attributes || {};
});

const breed = computed(() => {
  return props.profile.Character?.Breed || 'Solitus';
});

const profession = computed(() => {
  return props.profile.Character?.Profession || 'Adventurer';
});

// Filtered Misc skills based on toggle state
const filteredMiscSkills = computed(() => {
  const miscSkills = props.profile.Skills?.Misc;
  if (!miscSkills) return {};

  if (showZeroMiscSkills.value) {
    // Show all Misc skills
    return miscSkills;
  } else {
    // Filter out skills with value of 0
    const filtered: Record<string, any> = {};
    Object.entries(miscSkills).forEach(([skillName, skillValue]) => {
      // Handle MiscSkill objects which have multiple bonus properties
      let value = 0;
      if (typeof skillValue === 'number') {
        value = skillValue;
      } else if (skillValue && typeof skillValue === 'object') {
        // Calculate total from all bonus types
        value = (skillValue.baseValue || 0) +
                (skillValue.equipmentBonus || 0) +
                (skillValue.perkBonus || 0) +
                (skillValue.buffBonus || 0);
        // Also check if there's a pre-calculated value property
        if ('value' in skillValue && typeof skillValue.value === 'number') {
          value = skillValue.value;
        }
      }
      if (value > 0) {
        filtered[skillName] = skillValue;
      }
    });
    return filtered;
  }
});

const skillCategories = computed(() => {
  const skills = props.profile.Skills;
  if (!skills) return {};

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
    'ACs',  // Non-modifiable, moved to bottom
    'Misc'  // Non-modifiable, at the end
  ];

  // Create ordered categories object
  const orderedCategories: Record<string, any> = {};

  categoryOrder.forEach(categoryName => {
    if (categoryName !== 'Attributes' && skills[categoryName as keyof typeof skills]) {
      // Use filtered Misc skills for the Misc category
      if (categoryName === 'Misc') {
        orderedCategories[categoryName] = filteredMiscSkills.value;
      } else if (categoryName === 'ACs') {
        // Transform AC values (numbers) into MiscSkill objects for consistency
        const transformedACs: Record<string, any> = {};
        const acs = skills.ACs;
        if (acs) {
          Object.entries(acs).forEach(([acName, acValue]) => {
            transformedACs[acName] = {
              baseValue: acValue,
              equipmentBonus: 0,
              perkBonus: 0,
              buffBonus: 0,
              value: acValue
            };
          });
        }
        orderedCategories[categoryName] = transformedACs;
      } else {
        orderedCategories[categoryName] = skills[categoryName as keyof typeof skills];
      }
    }
  });

  return orderedCategories;
});

// Methods
function getCategoryIcon(categoryName: string): string {
  const iconMap: Record<string, string> = {
    'Body & Defense': 'pi pi-shield',
    'ACs': 'pi pi-chart-line',
    'Ranged Weapons': 'pi pi-crosshairs',
    'Ranged Specials': 'pi pi-star',
    'Melee Weapons': 'pi pi-sword',
    'Melee Specials': 'pi pi-flash',
    'Nanos & Casting': 'pi pi-sparkles',
    'Exploring': 'pi pi-compass',
    'Trade & Repair': 'pi pi-wrench',
    'Combat & Healing': 'pi pi-heart',
    'Misc': 'pi pi-ellipsis-h'
  };
  return iconMap[categoryName] || 'pi pi-cog';
}

function handleAbilityChange(abilityName: string, newValue: number) {
  emit('ability-changed', abilityName, newValue);
}

function handleSkillChange(category: string, skillName: string, newValue: number) {
  emit('skill-changed', category, skillName, newValue);
}

function isReadOnlyCategory(categoryName: string): boolean {
  return categoryName === 'ACs' || categoryName === 'Misc';
}
</script>