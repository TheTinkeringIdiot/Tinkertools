<!--
SymbiantSlot - Individual symbiant slot in character builder
Represents a single equipable slot on the character
-->
<template>
  <div :style="position" class="absolute symbiant-slot" @click="onClick">
    <!-- Slot Circle -->
    <div
      :class="[
        'w-8 h-8 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center',
        symbiant
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
          : 'border-surface-400 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 hover:border-primary-400',
      ]"
      :title="slotName"
    >
      <!-- Symbiant Present -->
      <i v-if="symbiant" class="pi pi-check text-xs text-primary-600 dark:text-primary-400"></i>
      <!-- Empty Slot -->
      <i v-else class="pi pi-plus text-xs text-surface-500 dark:text-surface-400"></i>
    </div>

    <!-- Slot Label -->
    <div class="mt-1 text-xs text-center text-surface-600 dark:text-surface-400 whitespace-nowrap">
      {{ slotName }}
    </div>

    <!-- Symbiant Name (if equipped) -->
    <div
      v-if="symbiant"
      class="mt-1 text-xs text-center text-primary-700 dark:text-primary-300 font-medium whitespace-nowrap max-w-20 overflow-hidden text-ellipsis"
      :title="symbiant.name"
    >
      {{ symbiant.name }}
    </div>

    <!-- Remove Button (on hover, if symbiant equipped) -->
    <Button
      v-if="symbiant"
      @click.stop="onRemove"
      icon="pi pi-times"
      size="small"
      text
      rounded
      severity="danger"
      class="absolute -top-2 -right-2 w-4 h-4 opacity-0 hover:opacity-100 transition-opacity"
      aria-label="Remove symbiant"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button';
import type { PlantSymbiant } from '@/types/plants';

interface Props {
  slotId: string;
  slotName: string;
  symbiant?: PlantSymbiant | null;
  position: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  symbiant: null,
});

interface Emits {
  (e: 'symbiant-selected', slotId: string): void;
  (e: 'symbiant-removed', slotId: string): void;
}

const emit = defineEmits<Emits>();

const onClick = () => {
  emit('symbiant-selected', props.slotId);
};

const onRemove = () => {
  emit('symbiant-removed', props.slotId);
};
</script>

<style scoped>
.symbiant-slot:hover .opacity-0 {
  opacity: 1;
}
</style>
