<!--
IPTrackerPanel - IP (Improvement Points) tracking display
Shows IP allocation, usage, and breakdown with visual indicators
-->
<template>
  <div class="ip-tracker-panel bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
        Improvement Points
      </h3>
      <Badge 
        :value="`TL${titleLevel}`" 
        severity="info" 
        size="small"
        v-tooltip.bottom="'Title Level'"
      />
    </div>
    
    <!-- IP Summary -->
    <div v-if="ipTracker" class="space-y-4">
      
      <!-- IP Stats Grid -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <div class="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
          <div class="text-lg font-bold text-surface-900 dark:text-surface-50">
            {{ formatNumber(ipTracker.totalAvailable) }}
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400">Available</div>
        </div>
        
        <div class="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
          <div class="text-lg font-bold text-surface-900 dark:text-surface-50">
            {{ formatNumber(ipTracker.totalUsed) }}
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400">Used</div>
        </div>
        
        <div class="text-center p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
          <div class="text-lg font-bold" :class="remainingColor">
            {{ formatNumber(ipTracker.remaining) }}
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400">Remaining</div>
        </div>
      </div>
      
      <!-- IP Allocation Breakdown -->
      <div class="space-y-3">
        <h4 class="text-sm font-semibold text-surface-900 dark:text-surface-50">
          IP Allocation
        </h4>
        
        <!-- Abilities vs Skills -->
        <div class="grid grid-cols-2 gap-4">
          <div class="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-purple-700 dark:text-purple-300">Abilities</span>
              <i class="pi pi-user text-purple-600 dark:text-purple-400"></i>
            </div>
            <div class="text-lg font-bold text-purple-900 dark:text-purple-100">
              {{ formatNumber(ipTracker.abilityIP) }}
            </div>
            <div class="text-xs text-purple-600 dark:text-purple-400">
              {{ getPercentage(ipTracker.abilityIP, ipTracker.totalUsed) }}% of used IP
            </div>
          </div>
          
          <div class="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-green-700 dark:text-green-300">Skills</span>
              <i class="pi pi-cog text-green-600 dark:text-green-400"></i>
            </div>
            <div class="text-lg font-bold text-green-900 dark:text-green-100">
              {{ formatNumber(ipTracker.skillIP) }}
            </div>
            <div class="text-xs text-green-600 dark:text-green-400">
              {{ getPercentage(ipTracker.skillIP, ipTracker.totalUsed) }}% of used IP
            </div>
          </div>
        </div>
        
        <!-- Ability Breakdown -->
        <div v-if="ipTracker.breakdown?.abilities && Object.keys(ipTracker.breakdown.abilities).length > 0">
          <h5 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Ability Breakdown
          </h5>
          <div class="space-y-2">
            <div 
              v-for="(ipSpent, abilityName) in ipTracker.breakdown.abilities"
              :key="abilityName"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-surface-600 dark:text-surface-400">{{ abilityName }}</span>
              <span class="font-medium text-surface-900 dark:text-surface-50">{{ formatNumber(ipSpent) }}</span>
            </div>
          </div>
        </div>
        
        <!-- Skill Category Breakdown -->
        <div v-if="ipTracker.breakdown?.skillCategories && Object.keys(ipTracker.breakdown.skillCategories).length > 0">
          <h5 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Top Skill Categories
          </h5>
          <div class="space-y-2">
            <div 
              v-for="(ipSpent, categoryName) in topSkillCategories"
              :key="categoryName"
              class="flex items-center justify-between text-sm"
            >
              <span class="text-surface-600 dark:text-surface-400">{{ categoryName }}</span>
              <span class="font-medium text-surface-900 dark:text-surface-50">{{ formatNumber(ipSpent) }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Last Calculated -->
      <div class="pt-4 mt-4 border-t border-surface-200 dark:border-surface-700">
        <div class="text-xs text-surface-500 dark:text-surface-400 text-center">
          Last calculated: {{ formatDateTime(ipTracker.lastCalculated) }}
        </div>
      </div>
    </div>
    
    <!-- No IP Data -->
    <div v-else class="text-center py-8">
      <i class="pi pi-info-circle text-4xl text-surface-300 dark:text-surface-600 mb-4"></i>
      <p class="text-surface-500 dark:text-surface-400 mb-4">
        IP tracking not available for this profile
      </p>
      <Button
        label="Initialize IP Tracking"
        size="small"
        @click="$emit('initialize-ip')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import { calculateTitleLevel } from '@/services/game-utils';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Emits
const emit = defineEmits<{
  'initialize-ip': [];
}>();

// Computed
const ipTracker = computed(() => props.profile.IPTracker);

const titleLevel = computed(() => {
  try {
    return calculateTitleLevel(props.profile.Character.Level);
  } catch {
    return 1;
  }
});

const circumference = computed(() => 2 * Math.PI * 52); // radius = 52

const ipUsagePercent = computed(() => {
  if (!ipTracker.value || ipTracker.value.totalAvailable === 0) return 0;
  return (ipTracker.value.totalUsed / ipTracker.value.totalAvailable) * 100;
});

const progressOffset = computed(() => {
  if (!ipTracker.value) return circumference.value;
  const progress = ipUsagePercent.value / 100;
  return circumference.value - (progress * circumference.value);
});

const progressColor = computed(() => {
  if (!ipTracker.value) return 'text-surface-300';
  
  const usage = ipUsagePercent.value;
  if (usage <= 50) return 'text-green-500';   // Low usage - green
  if (usage <= 75) return 'text-blue-500';    // Medium usage - blue  
  if (usage <= 90) return 'text-orange-500';  // High usage - orange
  return 'text-red-500';                      // Very high usage - red
});

const remainingColor = computed(() => {
  if (!ipTracker.value) return 'text-surface-900 dark:text-surface-50';
  
  const remaining = ipTracker.value.remaining;
  if (remaining < 0) return 'text-red-600 dark:text-red-400';
  if (remaining < 100) return 'text-orange-600 dark:text-orange-400';
  return 'text-green-600 dark:text-green-400';
});

const topSkillCategories = computed(() => {
  if (!ipTracker.value?.breakdown?.skillCategories) return {};
  
  // Sort skill categories by IP spent and take top 5
  const sorted = Object.entries(ipTracker.value.breakdown.skillCategories)
    .filter(([_, ipSpent]) => ipSpent > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  return Object.fromEntries(sorted);
});

// Methods
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function getPercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Unknown';
  }
}
</script>

<style scoped>
.ip-tracker-panel {
  @apply shadow-sm;
}

/* Progress ring animations */
circle {
  transition: stroke-dashoffset 0.5s ease-in-out;
}

/* Hover effects for stats */
.grid > div:hover {
  @apply transform scale-105 transition-transform duration-200;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .grid-cols-3 {
    @apply grid-cols-1;
  }
  
  .grid-cols-2 {
    @apply grid-cols-1;
  }
  
  .w-32.h-32 {
    @apply w-24 h-24;
  }
}
</style>