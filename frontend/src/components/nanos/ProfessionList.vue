<!--
ProfessionList - Profession Selection Component
Displays all Anarchy Online professions in a selectable list for nano filtering
-->
<template>
  <div class="profession-list h-full bg-surface-0 dark:bg-surface-950 overflow-y-auto">
    <!-- Header -->
    <div class="p-4 border-b border-surface-200 dark:border-surface-700">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
        <i class="pi pi-users mr-2"></i>
        Professions
      </h3>
      <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
        Select a profession to view its nanos
      </p>
    </div>

    <!-- Profession List -->
    <div class="p-2 space-y-1">
      <div
        v-for="profession in professions"
        :key="profession.id"
        class="profession-item flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200"
        :class="getProfessionItemClass(profession.id)"
        @click="selectProfession(profession.id)"
      >
        <!-- Profession Info -->
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Profession Avatar -->
          <Avatar
            :label="profession.shortName"
            :class="getProfessionAvatarClass(profession.id)"
            size="normal"
            shape="circle"
          />
          
          <!-- Profession Details -->
          <div class="flex-1 min-w-0">
            <div class="font-medium text-surface-900 dark:text-surface-100 truncate">
              {{ profession.name }}
            </div>
          </div>
        </div>

        <!-- Selection Indicator -->
        <div class="flex-shrink-0">
          <i 
            v-if="selectedProfession === profession.id"
            class="pi pi-check text-primary-500"
          />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center p-8">
      <ProgressSpinner size="small" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Avatar from 'primevue/avatar'
import ProgressSpinner from 'primevue/progressspinner'
import { PROFESSION } from '@/services/game-data'

interface ProfessionInfo {
  id: number
  name: string
  shortName: string
}

// Props
interface Props {
  loading?: boolean
  selectedProfession?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectedProfession: null
})

// Emits
const emit = defineEmits<{
  professionSelected: [professionId: number]
}>()

// Computed
const professions = computed((): ProfessionInfo[] => {
  // Convert PROFESSION mapping to array, excluding Monster (13) and Unknown (0)
  return Object.entries(PROFESSION)
    .map(([id, name]) => ({
      id: parseInt(id),
      name: name === 'MartialArtist' ? 'Martial Artist' : 
           name === 'NanoTechnician' ? 'Nanotechnician' : 
           name === 'MetaPhysicist' ? 'Meta-Physicist' : 
           name,
      shortName: name === 'MartialArtist' ? 'MA' : 
                name === 'NanoTechnician' ? 'NT' : 
                name === 'MetaPhysicist' ? 'MP' : 
                name.substring(0, 2).toUpperCase()
    }))
    .filter(p => p.id > 0 && p.id !== 13) // Exclude Unknown (0) and Monster (13)
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Methods
function selectProfession(professionId: number) {
  emit('professionSelected', professionId)
}

function getProfessionItemClass(professionId: number): string {
  const isSelected = props.selectedProfession === professionId
  
  if (isSelected) {
    return 'bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 text-primary-900 dark:text-primary-100'
  }
  
  return 'hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent'
}

function getProfessionAvatarClass(professionId: number): string {
  const isSelected = props.selectedProfession === professionId
  
  // Profession-specific colors
  const colorMap: Record<number, string> = {
    1: 'bg-red-500 text-white',      // Soldier
    2: 'bg-orange-500 text-white',   // Martial Artist
    3: 'bg-blue-500 text-white',     // Engineer
    4: 'bg-green-500 text-white',    // Fixer
    5: 'bg-purple-500 text-white',   // Agent
    6: 'bg-yellow-500 text-black',   // Adventurer
    7: 'bg-cyan-500 text-white',     // Trader
    8: 'bg-pink-500 text-white',     // Bureaucrat
    9: 'bg-gray-500 text-white',     // Enforcer
    10: 'bg-emerald-500 text-white', // Doctor
    11: 'bg-indigo-500 text-white',  // Nanotechnician
    12: 'bg-violet-500 text-white',  // Meta-Physicist
    14: 'bg-amber-500 text-black',   // Keeper
    15: 'bg-slate-500 text-white'    // Shade
  }
  
  let baseClass = colorMap[professionId] || 'bg-surface-400 text-white'
  
  if (isSelected) {
    baseClass = 'bg-primary-600 text-white'
  }
  
  return baseClass
}

</script>

<style scoped>
.profession-item {
  transition: all 0.2s ease;
}

.profession-list {
  scrollbar-width: thin;
  scrollbar-color: var(--surface-300) var(--surface-100);
}

.profession-list::-webkit-scrollbar {
  width: 6px;
}

.profession-list::-webkit-scrollbar-track {
  background: var(--surface-100);
}

.profession-list::-webkit-scrollbar-thumb {
  background: var(--surface-300);
  border-radius: 3px;
}

.profession-list::-webkit-scrollbar-thumb:hover {
  background: var(--surface-400);
}

/* Dark mode scrollbar */
.dark .profession-list {
  scrollbar-color: var(--surface-600) var(--surface-800);
}

.dark .profession-list::-webkit-scrollbar-track {
  background: var(--surface-800);
}

.dark .profession-list::-webkit-scrollbar-thumb {
  background: var(--surface-600);
}

.dark .profession-list::-webkit-scrollbar-thumb:hover {
  background: var(--surface-500);
}
</style>