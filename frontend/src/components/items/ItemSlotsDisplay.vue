<!--
ItemSlotsDisplay - Visual equipment slot grid display
Shows where an item can be equipped with the item's icon in valid slots
-->
<template>
  <div v-if="slotInfo.type" :class="['slots-display', slotInfo.type]">
    <div 
      v-for="(cell, index) in gridCells" 
      :key="index"
      :class="['slot-cell', { 
        'valid': cell.isValid, 
        'invalid': !cell.isValid && cell.slotName,
        'empty': !cell.slotName
      }]"
      :title="cell.slotName || ''"
    >
      <img 
        v-if="cell.isValid && slotInfo.iconUrl" 
        :src="slotInfo.iconUrl"
        :alt="`${item.name} can be equipped in ${cell.slotName}`"
        class="slot-icon"
        @error="onIconError"
      />
      <!-- Fallback icon for valid slots without item icon -->
      <i 
        v-else-if="cell.isValid && !slotInfo.iconUrl"
        class="pi pi-box slot-fallback-icon"
      ></i>
      <!-- Debug label (can be toggled off) -->
      <span 
        v-if="showLabels && cell.slotName" 
        class="slot-label"
      >
        {{ cell.slotName }}
      </span>
    </div>
  </div>
  
  <!-- Fallback for non-equipment items -->
  <div v-else class="text-center space-y-4">
    <!-- Item Image -->
    <div class="h-32 bg-surface-100 dark:bg-surface-800 rounded-lg flex items-center justify-center">
      <img 
        v-if="slotInfo.iconUrl"
        :src="slotInfo.iconUrl" 
        :alt="`${item.name} icon`"
        class="w-16 h-16 object-contain"
        @error="onIconError"
      />
      <i v-else class="pi pi-box text-4xl text-surface-400"></i>
    </div>
    
    <!-- Item Type -->
    <div class="text-center">
      <span class="text-sm text-surface-600 dark:text-surface-400">
        {{ getItemCategoryName(getItemClass(item)) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { 
  getItemSlotInfo, 
  getWeaponSlotPosition, 
  getArmorSlotPosition, 
  getImplantSlotPosition,
  getItemClass,
  getItemCategoryName
} from '@/services/game-utils';

// Props
interface Props {
  item: any;
  showLabels?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showLabels: false
});

// Reactive state
const iconError = ref(false);

// Computed properties
const slotInfo = computed(() => getItemSlotInfo(props.item));

const gridCells = computed(() => {
  if (!slotInfo.value.type) return [];
  
  const cells: Array<{
    isValid: boolean;
    slotName: string | null;
    position: { row: number; col: number };
  }> = [];
  
  // Determine grid dimensions and position function
  let rows: number, cols: number, getPositionFn: Function;
  
  switch (slotInfo.value.type) {
    case 'weapon':
      rows = 5;
      cols = 3;
      getPositionFn = getWeaponSlotPosition;
      break;
    case 'armor':
      rows = 5;
      cols = 3;
      getPositionFn = getArmorSlotPosition;
      break;
    case 'implant':
      rows = 4;
      cols = 4;
      getPositionFn = getImplantSlotPosition;
      break;
    default:
      return [];
  }
  
  // Initialize grid
  const grid: Array<Array<{
    isValid: boolean;
    slotName: string | null;
  }>> = [];
  
  for (let row = 1; row <= rows; row++) {
    grid[row] = [];
    for (let col = 1; col <= cols; col++) {
      grid[row][col] = {
        isValid: false,
        slotName: null
      };
    }
  }
  
  // Fill in valid slots
  for (const slotName of slotInfo.value.slots) {
    const position = getPositionFn(slotName);
    if (position && grid[position.row] && grid[position.row][position.col]) {
      grid[position.row][position.col] = {
        isValid: true,
        slotName: slotName
      };
    }
  }
  
  // Convert grid to flat array for template
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      cells.push({
        ...grid[row][col],
        position: { row, col }
      });
    }
  }
  
  return cells;
});

// Methods
function onIconError() {
  iconError.value = true;
}
</script>

<style scoped>
.slots-display {
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  display: grid;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.slots-display.weapon {
  background-image: url('https://cdn.tinkeringidiot.com/static/image/weapon_slots.png');
  width: 165px;
  height: 275px;
  grid-template-rows: repeat(5, 55px);
  grid-template-columns: repeat(3, 55px);
  margin: 0 auto;
}

.slots-display.armor {
  background-image: url('https://cdn.tinkeringidiot.com/static/image/armor_slots.png');
  width: 198px;
  height: 330px;
  grid-template-rows: repeat(5, 66px);
  grid-template-columns: repeat(3, 66px);
  margin: 0 auto;
}

.slots-display.implant {
  background-image: url('https://cdn.tinkeringidiot.com/static/image/implant_slots.png');
  width: 264px;
  height: 264px;
  grid-template-rows: repeat(4, 66px);
  grid-template-columns: repeat(4, 66px);
  margin: 0 auto;
}

.slot-cell {
  border: 1px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.slot-cell.valid {
  background: rgba(0, 255, 0, 0.2);
  border-color: rgba(0, 255, 0, 0.8);
  border-width: 2px;
}

.slot-cell.valid:hover {
  background: rgba(0, 255, 0, 0.3);
  border-color: rgba(0, 255, 0, 1.0);
}

.slot-cell.invalid {
  background: rgba(0, 0, 0, 0.4);
  border-color: rgba(255, 255, 255, 0.3);
}

.slot-cell.empty {
  border-color: rgba(255, 255, 255, 0.1);
  background: transparent;
}

.slot-icon {
  width: 42px;
  height: 42px;
  object-fit: contain;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8));
  border-radius: 4px;
}

.slot-fallback-icon {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}

.slot-label {
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  color: white;
  text-shadow: 
    -1px -1px 0 #000, 
    1px -1px 0 #000, 
    -1px 1px 0 #000, 
    1px 1px 0 #000;
  font-weight: bold;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.5);
  padding: 0 2px;
  border-radius: 2px;
}

/* Dark mode adjustments */
.dark .slot-cell.valid {
  background: rgba(0, 255, 0, 0.2);
  border-color: rgba(0, 255, 0, 0.6);
}

.dark .slot-cell.valid:hover {
  background: rgba(0, 255, 0, 0.3);
  border-color: rgba(0, 255, 0, 0.9);
}

.dark .slot-cell.invalid {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .slots-display {
    min-height: 200px;
  }
  
  .slots-display.weapon,
  .slots-display.implant {
    grid-template: repeat(4, 50px) / repeat(4, 50px);
  }
  
  .slots-display.armor {
    grid-template: repeat(5, 50px) / repeat(3, 50px);
  }
  
  .slot-icon {
    width: 35px;
    height: 35px;
  }
  
  .slot-fallback-icon {
    font-size: 20px;
  }
}
</style>