<template>
  <div>
    <!-- Header with sorting controls -->
    <div class="p-4 border-b bg-surface-50 dark:bg-surface-900">
      <div class="flex items-center justify-between">
        <h3 class="font-medium text-surface-900 dark:text-surface-50">
          {{ weapons.length }} weapon{{ weapons.length !== 1 ? 's' : '' }} found
        </h3>
        <div class="flex items-center space-x-2">
          <span class="text-sm text-surface-600 dark:text-surface-400">Sort by:</span>
          <Button
            @click="$emit('sort', 'name', sortBy === 'name' ? !sortDescending : false)"
            :label="'Name'"
            :severity="sortBy === 'name' ? 'primary' : 'secondary'"
            size="small"
            text
          />
          <Button
            @click="$emit('sort', 'ql', sortBy === 'ql' ? !sortDescending : false)"
            :label="'QL'"
            :severity="sortBy === 'ql' ? 'primary' : 'secondary'"
            size="small"
            text
          />
          <Button
            v-if="characterSkills && Object.keys(characterSkills).length > 0"
            @click="$emit('sort', 'usability', sortBy === 'usability' ? !sortDescending : false)"
            :label="'Usability'"
            :severity="sortBy === 'usability' ? 'primary' : 'secondary'"
            size="small"
            text
          />
        </div>
      </div>
    </div>

    <!-- Weapons Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
      <div
        v-for="weapon in weapons"
        :key="weapon.id"
        class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
        @click="$emit('select', weapon)"
      >
        <!-- Weapon Header -->
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-surface-900 dark:text-surface-50 truncate">
                {{ weapon.name }}
              </h4>
              <div class="flex items-center space-x-2 mt-1">
                <span class="text-sm text-surface-600 dark:text-surface-400"
                  >QL {{ weapon.ql }}</span
                >
                <span class="text-xs text-surface-500 dark:text-surface-400"
                  >ID: {{ weapon.aoid }}</span
                >
              </div>
            </div>
            <div class="flex space-x-1 ml-2">
              <Button
                @click.stop="$emit('compare', weapon)"
                icon="pi pi-balance-scale"
                size="small"
                severity="secondary"
                text
                v-tooltip="'Add to comparison'"
              />
              <UsabilityBadge
                v-if="characterSkills && Object.keys(characterSkills).length > 0"
                :weapon="weapon"
                :character-skills="characterSkills"
              />
            </div>
          </div>
        </div>

        <!-- Requirements Section -->
        <div class="p-4">
          <WeaponRequirements
            :weapon="weapon"
            :character-skills="characterSkills"
            :compact="true"
          />
        </div>

        <!-- Attack Stats (if available) -->
        <div v-if="weapon.attack_stats && weapon.attack_stats.length > 0" class="px-4 pb-4">
          <div class="text-xs font-medium text-surface-700 dark:text-surface-300 mb-2">
            Attack Stats
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="stat in weapon.attack_stats.slice(0, 3)"
              :key="stat.id"
              class="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 text-red-700"
            >
              {{ getStatName(stat.stat) }}: {{ stat.value }}
            </span>
            <span
              v-if="weapon.attack_stats.length > 3"
              class="inline-flex items-center px-2 py-1 rounded text-xs bg-surface-50 dark:bg-surface-900 text-surface-600 dark:text-surface-400"
            >
              +{{ weapon.attack_stats.length - 3 }} more
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="px-4 pb-4">
          <div class="flex space-x-2">
            <Button
              @click.stop="$emit('select', weapon)"
              label="View Details"
              size="small"
              outlined
              class="flex-1"
            />
            <Button
              @click.stop="$emit('compare', weapon)"
              icon="pi pi-balance-scale"
              size="small"
              severity="secondary"
              v-tooltip="'Add to comparison'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="weapons.length === 0" class="text-center py-12">
      <div class="text-surface-400 dark:text-surface-500 mb-2">
        <i class="pi pi-search text-3xl"></i>
      </div>
      <p class="text-surface-600 dark:text-surface-400">No weapons match your current filters</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';
import WeaponRequirements from './WeaponRequirements.vue';
import UsabilityBadge from './UsabilityBadge.vue';
import type { Weapon, CharacterSkills } from '@/types/weapon';
import { SKILL_NAMES } from '@/types/weapon';

interface Props {
  weapons: Weapon[];
  characterSkills?: CharacterSkills;
  sortBy: string;
  sortDescending: boolean;
}

interface Emits {
  (e: 'sort', sortBy: string, descending: boolean): void;
  (e: 'select', weapon: Weapon): void;
  (e: 'compare', weapon: Weapon): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Helper function to get stat name
const getStatName = (statId: number): string => {
  return SKILL_NAMES[statId] || `Stat ${statId}`;
};
</script>
