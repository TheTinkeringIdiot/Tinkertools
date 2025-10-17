<!--
AttributePreference - Attribute Filtering Component
Allows users to select a preferred attribute for implant filtering
-->
<template>
  <div class="attribute-preference">
    <div class="flex items-center gap-2">
      <label for="attribute-select" class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
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

// Attribute options (Agility, Intelligence, Psychic, Sense, Stamina, Strength)
const attributeOptions = [
  { label: 'Agility', value: 'Agility' },
  { label: 'Intelligence', value: 'Intelligence' },
  { label: 'Psychic', value: 'Psychic' },
  { label: 'Sense', value: 'Sense' },
  { label: 'Stamina', value: 'Stamina' },
  { label: 'Strength', value: 'Strength' }
];

// Local state for dropdown
const selectedAttribute = ref<string | null>(null);

/**
 * Determine default attribute based on profile's top attributes
 * Defaults to profile's highest two attributes (ties broken alphabetically)
 */
const determineDefaultAttribute = (): string => {
  const profile = tinkerProfilesStore.activeProfile;
  if (!profile) {
    return 'Strength'; // Safe default
  }

  // Attribute skill IDs from game-data.ts
  const attributeIds = {
    Agility: 17,
    Intelligence: 19,
    Psychic: 21,
    Sense: 20,
    Stamina: 18,
    Strength: 16
  };

  // Get attribute values from profile
  const attributeValues = Object.entries(attributeIds).map(([name, id]) => ({
    name,
    value: profile.skills?.[id]?.total || 0
  }));

  // Sort by value (descending), then by name (alphabetically)
  attributeValues.sort((a, b) => {
    if (b.value !== a.value) {
      return b.value - a.value;
    }
    return a.name.localeCompare(b.name);
  });

  // Return the highest attribute
  return attributeValues[0]?.name || 'Strength';
};

/**
 * Handle attribute selection change
 */
const handleAttributeChange = (event: any) => {
  const newAttribute = event.value;
  if (newAttribute) {
    // Update store
    tinkerPlantsStore.setAttributePreference(newAttribute);

    // Persist to localStorage (per profile)
    const profileId = tinkerProfilesStore.activeProfileId;
    if (profileId) {
      const storageKey = `tinkertools_plants_attribute_${profileId}`;
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

    if (stored && attributeOptions.some(opt => opt.value === stored)) {
      selectedAttribute.value = stored;
      tinkerPlantsStore.setAttributePreference(stored);
    } else {
      // Use default based on profile
      const defaultAttr = determineDefaultAttribute();
      selectedAttribute.value = defaultAttr;
      tinkerPlantsStore.setAttributePreference(defaultAttr);
    }
  } else {
    // No profile, use Strength as safe default
    selectedAttribute.value = 'Strength';
    tinkerPlantsStore.setAttributePreference('Strength');
  }
};

// Watch for active profile changes
watch(() => tinkerProfilesStore.activeProfileId, () => {
  loadAttributePreference();
});

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
