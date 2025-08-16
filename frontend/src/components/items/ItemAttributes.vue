<!--
ItemAttributes - Item flags and properties display component
Shows tradeable status, drop restrictions, special flags, and other item properties
-->
<template>
  <Card>
    <template #header>
      <div class="flex items-center gap-2">
        <i class="pi pi-tags text-blue-500"></i>
        <h3 class="text-lg font-semibold">Item Properties</h3>
      </div>
    </template>
    
    <template #content>
      <div class="space-y-4">
        <!-- Basic Properties -->
        <div>
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Basic Information</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Item Category -->
            <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Category</span>
              <Tag :value="categoryName" severity="info" />
            </div>
            
            <!-- Item Type -->
            <div v-if="item.item_type" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Type</span>
              <span class="font-medium">{{ item.item_type }}</span>
            </div>
            
            <!-- Nano Program -->
            <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Nano Program</span>
              <Tag 
                :value="item.is_nano ? 'Yes' : 'No'" 
                :severity="item.is_nano ? 'success' : 'secondary'"
              />
            </div>
            
            <!-- Quality Level -->
            <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Quality Level</span>
              <Badge :value="`QL ${item.ql}`" severity="info" />
            </div>
          </div>
        </div>

        <!-- Trade and Drop Properties -->
        <div>
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Trade & Drop</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Tradeable Status -->
            <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Tradeable</span>
              <Tag 
                :value="tradeableStatus" 
                :severity="getTradeableSeverity()"
              />
            </div>
            
            <!-- Droppable Status -->
            <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Droppable</span>
              <Tag 
                :value="droppableStatus" 
                :severity="getDroppableSeverity()"
              />
            </div>
          </div>
        </div>

        <!-- Special Flags -->
        <div v-if="specialFlags.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Special Properties</h4>
          <div class="flex flex-wrap gap-2">
            <Tag
              v-for="flag in specialFlags"
              :key="flag.name"
              :value="flag.name"
              :severity="flag.severity"
              size="small"
            />
          </div>
        </div>

        <!-- Usage Information -->
        <div v-if="hasUsageInfo">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Usage</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Equipment Slots -->
            <div v-if="equipmentSlots.length > 0" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Equipment Slot</span>
              <div class="flex flex-wrap gap-1">
                <Tag
                  v-for="slot in equipmentSlots"
                  :key="slot"
                  :value="slot"
                  severity="secondary"
                  size="small"
                />
              </div>
            </div>
            
            <!-- Actions Available -->
            <div v-if="item.actions?.length" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Actions</span>
              <Badge :value="item.actions.length.toString()" severity="info" />
            </div>
            
            <!-- Special Effects -->
            <div v-if="item.spell_data?.length" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Special Effects</span>
              <Badge :value="item.spell_data.length.toString()" severity="warning" />
            </div>
            
            <!-- Multi-Wield -->
            <div v-if="isMultiWieldable" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Multi-Wield</span>
              <Tag value="Capable" severity="success" />
            </div>
          </div>
        </div>

        <!-- Meta Information -->
        <div>
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Meta Information</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Item ID -->
            <div class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Item ID</span>
              <span class="font-mono text-sm">{{ item.id }}</span>
            </div>
            
            <!-- AOID -->
            <div v-if="item.aoid" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">AOID</span>
              <span class="font-mono text-sm">{{ item.aoid }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Item } from '@/types/api'
import { getItemCategoryName, getItemClassName, isWeapon } from '@/services/game-utils'

const props = defineProps<{
  item: Item
}>()

// Computed Properties
const categoryName = computed(() => getItemCategoryName(props.item.item_class))

const tradeableStatus = computed(() => {
  // This would need to be determined from item flags/stats when available
  // For now, we'll show "Unknown" as a placeholder
  return 'Unknown'
})

const droppableStatus = computed(() => {
  // This would need to be determined from item flags/stats when available
  // For now, we'll show "Unknown" as a placeholder
  return 'Unknown'
})

const specialFlags = computed(() => {
  const flags: Array<{name: string; severity: string}> = []
  
  // Check for various special properties
  if (props.item.is_nano) {
    flags.push({ name: 'Nano Program', severity: 'success' })
  }
  
  if (isWeapon(props.item.item_class)) {
    flags.push({ name: 'Weapon', severity: 'warning' })
  }
  
  if (props.item.ql >= 200) {
    flags.push({ name: 'High QL', severity: 'info' })
  }
  
  if (props.item.spell_data?.length) {
    flags.push({ name: 'Special Effects', severity: 'warning' })
  }
  
  // Add more flags based on actual item data when available
  
  return flags
})

const equipmentSlots = computed(() => {
  const slots: string[] = []
  
  // Map item class to equipment slots
  const slotMap: Record<number, string> = {
    1: 'Right Hand', // 1H Blunt
    2: 'Right Hand', // 1H Edged
    3: 'Both Hands', // 2H Blunt
    4: 'Both Hands', // 2H Edged
    5: 'Right Hand', // Ranged
    6: 'Body', // Body Armor
    7: 'Head', // Head Armor
    8: 'Arms', // Arm Armor
    9: 'Legs', // Leg Armor
    10: 'Feet', // Foot Armor
    15: 'Implant Slot' // Implant
  }
  
  const slot = slotMap[props.item.item_class]
  if (slot) {
    slots.push(slot)
  }
  
  return slots
})

const isMultiWieldable = computed(() => {
  // Check if item has multi-wield capability
  // This would need to be determined from item stats
  return false // Placeholder
})

const hasUsageInfo = computed(() => {
  return (
    equipmentSlots.value.length > 0 ||
    props.item.actions?.length ||
    props.item.spell_data?.length ||
    isMultiWieldable.value
  )
})

// Methods
function getTradeableSeverity(): string {
  switch (tradeableStatus.value) {
    case 'Yes': return 'success'
    case 'No': return 'danger'
    case 'Limited': return 'warning'
    default: return 'secondary'
  }
}

function getDroppableSeverity(): string {
  switch (droppableStatus.value) {
    case 'Yes': return 'success'
    case 'No': return 'danger'
    case 'Limited': return 'warning'
    default: return 'secondary'
  }
}
</script>

<style scoped>
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}

/* Ensure consistent spacing */
.grid > div {
  min-height: 3rem;
}

/* Custom spacing for flag display */
.flex.flex-wrap.gap-2 {
  gap: 0.5rem;
}
</style>