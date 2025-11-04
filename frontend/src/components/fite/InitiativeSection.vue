<!--
InitiativeSection - Initiative skills input for TinkerFite

Inputs (3 fields):
- Melee Init (118)
- Physical Init (120)
- Ranged Init (119)
-->
<template>
  <div
    class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
  >
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Initiative
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Melee Init (118) -->
      <div class="flex flex-col">
        <label
          for="meleeInit"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Melee Init
        </label>
        <InputNumber
          id="meleeInit"
          v-model="localInitiative.meleeInit"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Physical Init (120) -->
      <div class="flex flex-col">
        <label
          for="physicalInit"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Physical Init
        </label>
        <InputNumber
          id="physicalInit"
          v-model="localInitiative.physicalInit"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Ranged Init (119) -->
      <div class="flex flex-col">
        <label
          for="rangedInit"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Ranged Init
        </label>
        <InputNumber
          id="rangedInit"
          v-model="localInitiative.rangedInit"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import InputNumber from 'primevue/inputnumber';
import type { Initiative } from '@/types/weapon-analysis';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { INITIATIVE_IDS } from '@/types/weapon-analysis';

// Props
interface Props {
  initiative: Initiative;
  profile?: TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:initiative': [initiative: Initiative];
}>();

// Local state for two-way binding
const localInitiative = ref<Initiative>({ ...props.initiative });

// Programmatic update flag to prevent watcher loops
const isProgrammaticUpdate = ref(false);

// Handle field changes - emit updates to parent
const onFieldChange = () => {
  if (!isProgrammaticUpdate.value) {
    emit('update:initiative', { ...localInitiative.value });
  }
};

// Watch for prop changes from parent (external updates)
watch(
  () => props.initiative,
  (newInitiative) => {
    isProgrammaticUpdate.value = true;
    localInitiative.value = { ...newInitiative };
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { deep: true }
);

// Auto-populate from profile when profile changes
watch(
  () => props.profile?.skills[INITIATIVE_IDS.MELEE_INIT]?.total,
  (newValue) => {
    if (newValue !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localInitiative.value.meleeInit = newValue;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:initiative', { ...localInitiative.value });
      }, 10);
    }
  },
  { immediate: true }
);

watch(
  () => props.profile?.skills[INITIATIVE_IDS.PHYSICAL_INIT]?.total,
  (newValue) => {
    if (newValue !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localInitiative.value.physicalInit = newValue;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:initiative', { ...localInitiative.value });
      }, 10);
    }
  },
  { immediate: true }
);

watch(
  () => props.profile?.skills[INITIATIVE_IDS.RANGED_INIT]?.total,
  (newValue) => {
    if (newValue !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localInitiative.value.rangedInit = newValue;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:initiative', { ...localInitiative.value });
      }, 10);
    }
  },
  { immediate: true }
);
</script>
