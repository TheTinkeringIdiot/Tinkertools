<!--
EquipmentGrid - Complete equipment display with three tables
Shows character's equipped items in visual slot grids for Weapons, Clothing, and Implants
-->
<template>
  <div class="equipment-grid space-y-6">
    <!-- Weapons Table -->
    <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-shield text-orange-500"></i>
        Weapons
      </h3>
      <WeaponsTable :weapons="profile.Weapons" />
    </div>

    <!-- Clothing Table -->
    <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-user text-blue-500"></i>
        Clothing
      </h3>
      <ClothingTable :clothing="profile.Clothing" />
    </div>

    <!-- Implants Table -->
    <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-cpu text-green-500"></i>
        Implants
      </h3>
      <ImplantsTable :implants="profile.Implants" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import WeaponsTable from './WeaponsTable.vue';
import ClothingTable from './ClothingTable.vue';
import ImplantsTable from './ImplantsTable.vue';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();
</script>