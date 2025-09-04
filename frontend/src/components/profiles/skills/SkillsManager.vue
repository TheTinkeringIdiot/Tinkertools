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
      @ability-changed="handleAbilityChange"
      @skill-changed="handleSkillChange"
    />
    
    <!-- Skill Categories -->
    <SkillCategory
      v-for="(skills, categoryName) in skillCategories"
      :key="categoryName"
      :title="categoryName"
      :icon="getCategoryIcon(categoryName)"
      :skills="skills"
      :is-read-only="isReadOnlyCategory(categoryName)"
      @skill-changed="handleSkillChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import SkillCategory from './SkillCategory.vue';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Emits
const emit = defineEmits<{
  'skill-changed': [category: string, skillName: string, newValue: number];
  'ability-changed': [abilityName: string, newValue: number];
}>();

// Computed
const coreAbilities = computed(() => {
  return props.profile.Skills?.Attributes || {};
});

const breed = computed(() => {
  return props.profile.Character?.Breed || 'Solitus';
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
      orderedCategories[categoryName] = skills[categoryName as keyof typeof skills];
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