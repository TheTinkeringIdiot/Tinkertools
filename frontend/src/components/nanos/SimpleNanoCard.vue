<!--
SimpleNanoCard - Basic nano item display card
Shows nano information from Item objects for profession-based display
-->
<template>
  <Card
    class="simple-nano-card transition-all duration-200 cursor-pointer hover:shadow-lg border border-surface-200 dark:border-surface-700"
    @click="handleSelect"
  >
    <template #content>
      <div class="p-4">
        <!-- Nano Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-surface-900 dark:text-surface-50 truncate mb-1">
              {{ nano.name }}
            </h4>
            <div class="flex items-center gap-2">
              <Badge :value="`QL ${nano.ql || 1}`" severity="secondary" size="small" />
              <Badge v-if="strainName" :value="strainName" severity="info" size="small" />
            </div>
          </div>
        </div>

        <!-- Description -->
        <p
          v-if="nano.description"
          class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2"
        >
          {{ nano.description }}
        </p>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import Badge from 'primevue/badge';
import { NANO_STRAIN } from '@/services/game-data';
import type { Item } from '@/types/api';

// Props
interface Props {
  nano: Item;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  select: [nano: Item];
}>();

// Computed
const strainName = computed(() => {
  // Find strain stat (stat 75)
  const strainStat = props.nano.stats.find((stat) => stat.stat === 75);
  if (!strainStat) return null;

  const strainId = strainStat.value;
  return NANO_STRAIN[strainId as keyof typeof NANO_STRAIN] || `Strain ${strainId}`;
});

// Methods
function handleSelect() {
  emit('select', props.nano);
}
</script>

<style scoped>
.simple-nano-card {
  height: 100%;
}

.simple-nano-card:hover {
  transform: translateY(-2px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
