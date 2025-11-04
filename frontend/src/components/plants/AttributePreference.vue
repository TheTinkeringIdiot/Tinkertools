<!--
AttributePreference - Attribute Filtering Component
Allows users to select a preferred attribute for implant filtering
-->
<template>
  <div class="attribute-preference">
    <div class="flex items-center gap-2">
      <label
        for="attribute-select"
        class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap"
      >
        Attribute Preference:
      </label>
      <Dropdown
        id="attribute-select"
        v-model="selectedAttribute"
        :options="attributeOptions"
        option-label="label"
        option-value="value"
        placeholder="Select Attribute"
        class="w-48"
        aria-describedby="attribute-help"
        @change="handleAttributeChange"
      />
      <span id="attribute-help" class="sr-only">
        Choose preferred attribute for implant filtering when multiple variants exist
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useTinkerPlantsStore } from '@/stores/tinkerPlants';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import Dropdown from 'primevue/dropdown';

// Store access
const tinkerPlantsStore = useTinkerPlantsStore();
const tinkerProfilesStore = useTinkerProfilesStore();

// Attribute options (None first, then Agility, Intelligence, Psychic, Sense, Stamina, Strength)
const attributeOptions = [
  { label: 'None', value: null },
  { label: 'Agility', value: 'Agility' },
  { label: 'Intelligence', value: 'Intelligence' },
  { label: 'Psychic', value: 'Psychic' },
  { label: 'Sense', value: 'Sense' },
  { label: 'Stamina', value: 'Stamina' },
  { label: 'Strength', value: 'Strength' },
];

// Local state for dropdown
const selectedAttribute = ref<string | null>(null);

/**
 * Determine default attribute based on profile's top attributes
 * Defaults to null (None) for no preference
 */
const determineDefaultAttribute = (): string | null => {
  // Default to "None" (no attribute preference)
  return null;
};

/**
 * Handle attribute selection change
 */
const handleAttributeChange = (event: any) => {
  const newAttribute = event.value;

  // Update store (allow null for "None")
  tinkerPlantsStore.setAttributePreference(newAttribute);

  // Persist to localStorage (per profile)
  const profileId = tinkerProfilesStore.activeProfileId;
  if (profileId) {
    const storageKey = `tinkertools_plants_attribute_${profileId}`;
    if (newAttribute === null) {
      // Clear stored preference when "None" is selected
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, newAttribute);
    }
  }
};

/**
 * Load attribute preference from localStorage or default
 */
const loadAttributePreference = () => {
  const profileId = tinkerProfilesStore.activeProfileId;
  if (profileId) {
    const storageKey = `tinkertools_plants_attribute_${profileId}`;
    const stored = localStorage.getItem(storageKey);

    if (stored && attributeOptions.some((opt) => opt.value === stored)) {
      selectedAttribute.value = stored;
      tinkerPlantsStore.setAttributePreference(stored);
    } else {
      // Use default (None)
      const defaultAttr = determineDefaultAttribute();
      selectedAttribute.value = defaultAttr;
      tinkerPlantsStore.setAttributePreference(defaultAttr);
    }
  } else {
    // No profile, use None as default
    selectedAttribute.value = null;
    tinkerPlantsStore.setAttributePreference(null);
  }
};

// Watch for active profile changes
watch(
  () => tinkerProfilesStore.activeProfileId,
  () => {
    loadAttributePreference();
  }
);

// Initialize on mount
onMounted(() => {
  loadAttributePreference();
});
</script>

<style scoped>
/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
