<!--
StatTargets - Component for setting stat targets
Allows users to set desired stat values for optimization
-->
<template>
  <div class="stat-targets p-3">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-medium text-surface-900 dark:text-surface-100">
        <i class="pi pi-target mr-2"></i>
        Stat Targets
      </h3>
      <Button
        @click="addTarget"
        icon="pi pi-plus"
        size="small"
        text
        severity="secondary"
        aria-label="Add target"
      />
    </div>
    
    <div v-if="targets.length === 0" class="text-center py-4 text-surface-500 dark:text-surface-400">
      <i class="pi pi-bullseye text-2xl mb-2 block"></i>
      <p class="text-sm">No stat targets set</p>
      <Button
        @click="addTarget"
        label="Add First Target"
        size="small"
        text
        class="mt-2"
      />
    </div>
    
    <div v-else class="space-y-3">
      <div
        v-for="(target, index) in targets"
        :key="target.statId || index"
        class="bg-surface-50 dark:bg-surface-800 p-3 rounded border"
      >
        <div class="flex items-center justify-between mb-2">
          <Dropdown
            v-model="target.statId"
            :options="availableStats"
            option-label="name"
            option-value="id"
            placeholder="Select stat"
            class="w-32"
            @change="updateTarget(index)"
          />
          <Button
            @click="removeTarget(index)"
            icon="pi pi-times"
            size="small"
            text
            severity="danger"
            aria-label="Remove target"
          />
        </div>
        
        <div class="flex items-center gap-2 mb-2">
          <InputNumber
            v-model="target.targetValue"
            :min="0"
            :max="3000"
            :step="1"
            placeholder="Target value"
            showButtons
            @input="updateTarget(index)"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <Dropdown
            v-model="target.priority"
            :options="priorities"
            option-label="label"
            option-value="value"
            placeholder="Priority"
            class="w-24"
            @change="updateTarget(index)"
          />
          <div v-if="currentStats[target.statId]" class="text-xs text-surface-500 dark:text-surface-400">
            Current: {{ currentStats[target.statId] || 0 }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';

import type { StatTarget, CharacterStats } from '@/types/plants';

interface Props {
  modelValue: StatTarget[];
  currentStats?: CharacterStats;
}

const props = withDefaults(defineProps<Props>(), {
  currentStats: () => ({})
});

interface Emits {
  (e: 'update:modelValue', targets: StatTarget[]): void;
}

const emit = defineEmits<Emits>();

const targets = ref([...props.modelValue]);

const availableStats = [
  { id: 'strength', name: 'Strength' },
  { id: 'agility', name: 'Agility' },
  { id: 'stamina', name: 'Stamina' },
  { id: 'intelligence', name: 'Intelligence' },
  { id: 'sense', name: 'Sense' },
  { id: 'psychic', name: 'Psychic' }
];

const priorities = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
];

const addTarget = () => {
  targets.value.push({
    statId: '',
    statName: '',
    targetValue: 0,
    priority: 'medium'
  });
  updateTargets();
};

const removeTarget = (index: number) => {
  targets.value.splice(index, 1);
  updateTargets();
};

const updateTarget = (index: number) => {
  const target = targets.value[index];
  if (target.statId) {
    const stat = availableStats.find(s => s.id === target.statId);
    if (stat) {
      target.statName = stat.name;
    }
  }
  updateTargets();
};

const updateTargets = () => {
  emit('update:modelValue', [...targets.value]);
};

watch(() => props.modelValue, (newTargets) => {
  targets.value = [...newTargets];
}, { deep: true });
</script>