<!--
BuildComparison - Compare multiple builds side by side
Shows stat differences and recommendations
-->
<template>
  <div class="build-comparison">
    <div v-if="builds.length === 0" class="text-center py-8">
      <i class="pi pi-chart-bar text-4xl text-surface-400 dark:text-surface-600 mb-4 block"></i>
      <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
        No builds to compare
      </h3>
      <p class="text-surface-500 dark:text-surface-400">
        Create some builds first to compare them
      </p>
    </div>
    
    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse">
        <!-- Header -->
        <thead>
          <tr class="border-b border-surface-200 dark:border-surface-700">
            <th class="text-left p-3 font-medium text-surface-900 dark:text-surface-100">
              Build
            </th>
            <th
              v-for="build in builds.slice(0, 4)"
              :key="build.id"
              class="text-left p-3 font-medium text-surface-900 dark:text-surface-100 min-w-48"
            >
              {{ build.name }}
            </th>
          </tr>
        </thead>
        
        <!-- Body -->
        <tbody>
          <!-- Basic Info -->
          <tr class="border-b border-surface-100 dark:border-surface-800">
            <td class="p-3 font-medium text-surface-700 dark:text-surface-300">
              Symbiants
            </td>
            <td v-for="build in builds.slice(0, 4)" :key="`${build.id}-symbiants`" class="p-3">
              {{ Object.keys(build.symbiants).length }}/13
            </td>
          </tr>
          
          <!-- Stats Comparison -->
          <tr
            v-for="statId in comparedStats"
            :key="statId"
            class="border-b border-surface-100 dark:border-surface-800"
          >
            <td class="p-3 font-medium text-surface-700 dark:text-surface-300">
              {{ formatStatName(statId) }}
            </td>
            <td
              v-for="build in builds.slice(0, 4)"
              :key="`${build.id}-${statId}`"
              class="p-3"
            >
              <span :class="getStatComparisonClass(build.id, statId)">
                {{ getStatValue(build, statId) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Actions -->
      <div class="mt-4 flex justify-between">
        <div class="flex gap-2">
          <Button
            @click="exportComparison"
            label="Export"
            icon="pi pi-download"
            size="small"
            severity="secondary"
          />
        </div>
        <div class="flex gap-2">
          <Button
            v-for="build in builds.slice(0, 4)"
            :key="`load-${build.id}`"
            @click="$emit('load-build', build)"
            :label="`Load ${build.name}`"
            size="small"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';
import type { CharacterBuild } from '@/types/plants';

interface Props {
  builds: CharacterBuild[];
  currentBuild?: CharacterBuild;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'load-build', build: CharacterBuild): void;
  (e: 'delete-build', buildId: string): void;
}

const emit = defineEmits<Emits>();

const comparedStats = computed(() => {
  const allStats = new Set<string>();
  props.builds.forEach(build => {
    Object.keys(build.totalStats || {}).forEach(statId => {
      allStats.add(statId);
    });
  });
  return Array.from(allStats).sort();
});

const formatStatName = (statId: string): string => {
  const statNames: Record<string, string> = {
    'strength': 'Strength',
    'agility': 'Agility',
    'stamina': 'Stamina',
    'intelligence': 'Intelligence',
    'sense': 'Sense',
    'psychic': 'Psychic'
  };
  return statNames[statId] || statId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getStatValue = (build: CharacterBuild, statId: string): number => {
  return build.totalStats?.[statId] || 0;
};

const getStatComparisonClass = (buildId: string, statId: string): string => {
  const values = props.builds.map(b => getStatValue(b, statId));
  const max = Math.max(...values);
  const current = getStatValue(props.builds.find(b => b.id === buildId)!, statId);
  
  if (current === max && max > 0) {
    return 'text-green-600 dark:text-green-400 font-semibold';
  }
  return 'text-surface-900 dark:text-surface-100';
};

const exportComparison = () => {
  console.log('Export comparison data');
};
</script>