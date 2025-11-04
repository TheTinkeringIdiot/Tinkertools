<!--
ProfileCard - Individual profile display card
Shows profile information in a compact, action-friendly card format
-->
<template>
  <div
    class="profile-card bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg hover:shadow-lg transition-all duration-200 overflow-hidden"
  >
    <!-- Active Profile Indicator -->
    <div v-if="isActive" class="bg-primary-500 h-1"></div>

    <!-- Card Header -->
    <div class="p-4 pb-3">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <!-- Character Avatar -->
          <div
            class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <i :class="professionIcon" class="text-primary-600 dark:text-primary-400 text-lg"></i>
          </div>

          <!-- Character Info -->
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-surface-900 dark:text-surface-50 truncate mb-1">
              {{ profile.name }}
            </h3>
            <div class="flex items-center gap-2 flex-wrap">
              <Badge
                :value="`Level ${profile.level}`"
                :severity="getLevelSeverity(profile.level)"
                size="small"
              />
              <span class="text-sm text-surface-600 dark:text-surface-400">
                {{ profile.profession }}
              </span>
            </div>
          </div>
        </div>

        <!-- Active Badge -->
        <Badge v-if="isActive" value="Active" severity="success" size="small" />
      </div>

      <!-- Character Details -->
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="flex items-center gap-1">
          <i class="pi pi-circle-fill text-xs" :class="breedColor"></i>
          <span class="text-surface-600 dark:text-surface-400 truncate">{{ profile.breed }}</span>
        </div>
        <div class="flex items-center gap-1">
          <i class="pi pi-flag text-xs" :class="factionColor"></i>
          <span class="text-surface-600 dark:text-surface-400 truncate">{{ profile.faction }}</span>
        </div>
      </div>
    </div>

    <!-- Card Content -->
    <div class="px-4 pb-4">
      <!-- Stats Preview -->
      <div class="bg-surface-50 dark:bg-surface-800 rounded-lg p-3 mb-4">
        <div class="flex items-center justify-between mb-2">
          <span
            class="text-xs font-medium text-surface-700 dark:text-surface-300 uppercase tracking-wider"
          >
            Character Stats
          </span>
          <Button
            icon="pi pi-eye"
            size="small"
            severity="secondary"
            text
            @click="$emit('view-details', profile)"
            v-tooltip.top="'View Full Details'"
          />
        </div>

        <!-- Quick stats could be added here if needed -->
        <div class="text-xs text-surface-500 dark:text-surface-400">
          Click to view full character details, skills, and equipment
        </div>
      </div>

      <!-- Metadata -->
      <div class="space-y-1 text-xs text-surface-500 dark:text-surface-400 mb-4">
        <div class="flex justify-between">
          <span>Created:</span>
          <span>{{ formatDate(profile.created) }}</span>
        </div>
        <div class="flex justify-between">
          <span>Updated:</span>
          <span>{{ formatDate(profile.updated) }}</span>
        </div>
      </div>
    </div>

    <!-- Card Actions -->
    <div class="border-t border-surface-200 dark:border-surface-700 p-3">
      <div class="flex items-center justify-between">
        <!-- Primary Action -->
        <Button
          label="View Details"
          icon="pi pi-eye"
          size="small"
          @click="$emit('view-details', profile)"
          class="flex-1 mr-2"
        />

        <!-- Quick Actions Menu -->
        <div class="flex items-center gap-1">
          <Button
            v-if="!isActive"
            icon="pi pi-check"
            size="small"
            severity="success"
            outlined
            @click="$emit('set-active', profile)"
            v-tooltip.top="'Set as Active Profile'"
          />

          <!-- More Actions Menu -->
          <Button
            icon="pi pi-ellipsis-v"
            size="small"
            severity="secondary"
            outlined
            @click="toggleActionsMenu"
            ref="moreActionsButton"
            v-tooltip.top="'More Actions'"
          />

          <!-- Actions Menu -->
          <Menu :model="actionMenuItems" :popup="true" ref="actionsMenu" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import type { ProfileMetadata } from '@/lib/tinkerprofiles';

// Props
const props = defineProps<{
  profile: ProfileMetadata;
  isActive: boolean;
}>();

// Emits
const emit = defineEmits<{
  'view-details': [profile: ProfileMetadata];
  'set-active': [profile: ProfileMetadata];
  duplicate: [profile: ProfileMetadata];
  export: [profile: ProfileMetadata];
  delete: [profile: ProfileMetadata];
}>();

// Template refs
const moreActionsButton = ref();
const actionsMenu = ref();

// Computed
const professionIcon = computed(() => {
  const iconMap: Record<string, string> = {
    Adventurer: 'pi pi-compass',
    Agent: 'pi pi-eye-slash',
    Bureaucrat: 'pi pi-briefcase',
    Doctor: 'pi pi-heart',
    Enforcer: 'pi pi-shield',
    Engineer: 'pi pi-wrench',
    Fixer: 'pi pi-bolt',
    Keeper: 'pi pi-sun',
    'Martial Artist': 'pi pi-hand-fist',
    'Meta-Physicist': 'pi pi-sparkles',
    'Nano-Technician': 'pi pi-cog',
    Soldier: 'pi pi-rifle',
    Trader: 'pi pi-dollar',
    Shade: 'pi pi-moon',
  };
  return iconMap[props.profile.profession] || 'pi pi-user';
});

const breedColor = computed(() => {
  const colorMap: Record<string, string> = {
    Solitus: 'text-blue-500',
    Opifex: 'text-green-500',
    Nanomage: 'text-purple-500',
    Atrox: 'text-red-500',
  };
  return colorMap[props.profile.breed] || 'text-surface-400';
});

const factionColor = computed(() => {
  const colorMap: Record<string, string> = {
    Omni: 'text-blue-500',
    Clan: 'text-orange-500',
    Neutral: 'text-surface-400',
  };
  return colorMap[props.profile.faction] || 'text-surface-400';
});

const actionMenuItems = computed<MenuItem[]>(() => [
  {
    label: 'Duplicate',
    icon: 'pi pi-clone',
    command: () => emit('duplicate', props.profile),
  },
  {
    label: 'Export',
    icon: 'pi pi-download',
    command: () => emit('export', props.profile),
  },
  { separator: true },
  {
    label: 'Delete',
    icon: 'pi pi-trash',
    command: () => emit('delete', props.profile),
    class: 'text-red-600',
  },
]);

// Methods
function getLevelSeverity(level: number) {
  if (level >= 200) return 'danger';
  if (level >= 150) return 'warning';
  if (level >= 100) return 'info';
  if (level >= 50) return 'success';
  return 'secondary';
}

function toggleActionsMenu(event: Event) {
  actionsMenu.value?.toggle(event);
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}
</script>

<style scoped>
.profile-card {
  @apply transition-all duration-200;
}

.profile-card:hover {
  @apply transform -translate-y-1;
}

/* Ensure consistent card heights */
.profile-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.profile-card > :last-child {
  margin-top: auto;
}

/* Action menu styling */
:deep(.p-menu) {
  min-width: 150px;
}

:deep(.p-menu .p-menuitem-link.text-red-600) {
  color: rgb(220 38 38);
}

:deep(.p-menu .p-menuitem-link.text-red-600:hover) {
  background-color: rgb(254 242 242);
  color: rgb(185 28 28);
}

:deep(.p-menu .p-menuitem-link.text-red-600:hover) {
  @apply dark:bg-red-950 dark:text-red-400;
}
</style>
