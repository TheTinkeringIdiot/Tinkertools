<!--
SavedBuilds - Manage saved character builds
Load, delete, and organize saved builds
-->
<template>
  <div class="saved-builds">
    <div v-if="builds.length === 0" class="text-center py-8">
      <i class="pi pi-bookmark text-4xl text-surface-400 dark:text-surface-600 mb-4 block"></i>
      <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
        No saved builds
      </h3>
      <p class="text-surface-500 dark:text-surface-400">
        Create and save builds to manage them here
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="build in builds"
        :key="build.id"
        class="build-item p-4 border border-surface-200 dark:border-surface-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
      >
        <!-- Build Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-1">
              {{ build.name }}
            </h4>
            <div class="text-sm text-surface-600 dark:text-surface-400">
              {{ Object.keys(build.symbiants).length }} symbiants equipped
            </div>
            <div v-if="build.notes" class="text-xs text-surface-500 dark:text-surface-400 mt-1">
              {{ build.notes }}
            </div>
          </div>

          <!-- Actions Menu -->
          <div class="flex items-center gap-2">
            <Button @click="loadBuild(build)" label="Load" size="small" severity="primary" />
            <Button
              @click="duplicateBuild(build)"
              icon="pi pi-copy"
              size="small"
              text
              severity="secondary"
              aria-label="Duplicate build"
            />
            <Button
              @click="deleteBuild(build.id)"
              icon="pi pi-trash"
              size="small"
              text
              severity="danger"
              aria-label="Delete build"
            />
          </div>
        </div>

        <!-- Build Stats Summary -->
        <div v-if="build.totalStats && Object.keys(build.totalStats).length > 0" class="mb-3">
          <div class="text-xs font-medium text-surface-700 dark:text-surface-300 mb-2">
            Stat Bonuses:
          </div>
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="[statId, value] in Object.entries(build.totalStats).slice(0, 6)"
              :key="statId"
              :value="`${formatStatName(statId)}: ${value}`"
              severity="info"
              size="small"
            />
            <Badge
              v-if="Object.keys(build.totalStats).length > 6"
              :value="`+${Object.keys(build.totalStats).length - 6} more`"
              severity="secondary"
              size="small"
            />
          </div>
        </div>

        <!-- Equipped Symbiants -->
        <div class="mb-3">
          <div class="text-xs font-medium text-surface-700 dark:text-surface-300 mb-2">
            Equipped Symbiants:
          </div>
          <div class="grid grid-cols-2 gap-1 text-xs">
            <div
              v-for="[slot, symbiant] in Object.entries(build.symbiants).slice(0, 6)"
              :key="slot"
              class="flex justify-between text-surface-600 dark:text-surface-400"
            >
              <span>{{ formatSlotName(slot) }}:</span>
              <span class="font-medium">{{ symbiant.name }}</span>
            </div>
            <div
              v-if="Object.keys(build.symbiants).length > 6"
              class="flex justify-between text-surface-500 dark:text-surface-400"
            >
              <span>+{{ Object.keys(build.symbiants).length - 6 }} more</span>
            </div>
          </div>
        </div>

        <!-- Build Metadata -->
        <div
          class="text-xs text-surface-500 dark:text-surface-400 flex justify-between items-center pt-2 border-t border-surface-100 dark:border-surface-800"
        >
          <div>Created: {{ formatDate(build.createdAt) }}</div>
          <div v-if="build.updatedAt && build.updatedAt !== build.createdAt">
            Modified: {{ formatDate(build.updatedAt) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import type { CharacterBuild } from '@/types/plants';

interface Props {
  builds: CharacterBuild[];
}

const props = defineProps<Props>();

interface Emits {
  (e: 'load-build', build: CharacterBuild): void;
  (e: 'delete-build', buildId: string): void;
  (e: 'duplicate-build', build: CharacterBuild): void;
}

const emit = defineEmits<Emits>();

// Methods
const formatSlotName = (slot: string): string => {
  const slotNames: Record<string, string> = {
    head: 'Head',
    eye: 'Eye',
    ear: 'Ear',
    rarm: 'R.Arm',
    chest: 'Chest',
    larm: 'L.Arm',
    waist: 'Waist',
    rwrist: 'R.Wrist',
    legs: 'Legs',
    lwrist: 'L.Wrist',
    rfinger: 'R.Finger',
    feet: 'Feet',
    lfinger: 'L.Finger',
  };
  return slotNames[slot] || slot;
};

const formatStatName = (statId: string): string => {
  const statNames: Record<string, string> = {
    strength: 'STR',
    agility: 'AGI',
    stamina: 'STA',
    intelligence: 'INT',
    sense: 'SEN',
    psychic: 'PSY',
  };
  return statNames[statId] || statId.toUpperCase().slice(0, 3);
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleDateString();
};

const loadBuild = (build: CharacterBuild) => {
  emit('load-build', build);
};

const deleteBuild = (buildId: string) => {
  emit('delete-build', buildId);
};

const duplicateBuild = (build: CharacterBuild) => {
  emit('duplicate-build', build);
};
</script>

<style scoped>
.build-item {
  transition: all 0.2s ease;
}

.build-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
