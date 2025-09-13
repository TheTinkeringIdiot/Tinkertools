<!--
EquipmentSlotsDisplay - Complete equipment display showing all items in their slots
Shows all equipped items in a slot grid layout for a specific equipment type
-->
<template>
  <div v-if="slotType" :class="['equipment-slots-display', slotType]">
    <div 
      v-for="(cell, index) in gridCells" 
      :key="index"
      :class="['equipment-slot-cell', { 
        'has-item': cell.item, 
        'empty-slot': !cell.item && cell.slotName,
        'no-slot': !cell.slotName
      }]"
      :title="cell.slotName || ''"
    >
      <!-- Item icon if equipped -->
      <img 
        v-if="cell.item && cell.iconUrl" 
        :src="cell.iconUrl"
        :alt="`${cell.item.name} equipped in ${cell.slotName}`"
        class="item-icon"
        :title="`QL ${cell.item.ql} ${cell.item.name}`"
        @error="onIconError"
        @click="navigateToItem(cell.item)"
      />
      <!-- Fallback icon for equipped items without icon -->
      <i 
        v-else-if="cell.item && !cell.iconUrl"
        class="pi pi-box item-fallback-icon"
        :title="`QL ${cell.item.ql} ${cell.item.name}`"
        @click="navigateToItem(cell.item)"
      ></i>
      <!-- Slot label for debugging (optional) -->
      <span 
        v-if="showLabels && cell.slotName" 
        class="slot-label"
      >
        {{ cell.slotName }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { 
  getWeaponSlotPosition, 
  getArmorSlotPosition, 
  getImplantSlotPosition,
  getImplantSlotPositionFromBitflag,
  getItemIconUrl
} from '@/services/game-utils';
import type { Item } from '@/types/api';

// Props
interface Props {
  equipment: Record<string, Item | null>;
  slotType: 'weapon' | 'armor' | 'implant';
  showLabels?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showLabels: false
});

// Router setup
const router = useRouter();

// Computed properties
const gridCells = computed(() => {
  const cells: Array<{
    item: Item | null;
    iconUrl: string | null;
    slotName: string | null;
    position: { row: number; col: number };
  }> = [];
  
  // Determine grid dimensions and position function
  let rows: number, cols: number, getPositionFn: Function;
  
  switch (props.slotType) {
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
      rows = 5;
      cols = 3;
      getPositionFn = getImplantSlotPosition;
      break;
    default:
      return [];
  }
  
  // Initialize grid with empty cells
  const grid: Array<Array<{
    item: Item | null;
    iconUrl: string | null;
    slotName: string | null;
  }>> = [];
  
  for (let row = 1; row <= rows; row++) {
    grid[row] = [];
    for (let col = 1; col <= cols; col++) {
      grid[row][col] = {
        item: null,
        iconUrl: null,
        slotName: null
      };
    }
  }
  
  // Place equipped items in their slots
  for (const [slotKey, item] of Object.entries(props.equipment)) {
    if (item) {
      let position;
      
      if (props.slotType === 'implant') {
        // For implants, slotKey is a bitflag value as string
        const bitflag = parseInt(slotKey);
        position = getImplantSlotPositionFromBitflag(bitflag);
      } else {
        // For weapons and armor, slotKey is a string slot name  
        position = getPositionFn(slotKey);
      }
      
      if (position && grid[position.row] && grid[position.row][position.col]) {
        grid[position.row][position.col] = {
          item,
          iconUrl: getItemIconUrl(item.stats),
          slotName: slotKey
        };
      }
    }
  }
  
  // Add empty slots that exist in the slot system but don't have items
  // This requires knowing all possible slots for each type
  const allSlots = getAllSlotsForType(props.slotType);
  for (const slotKey of allSlots) {
    let position;
    
    if (props.slotType === 'implant') {
      // For implants, slotKey is a bitflag value as string
      const bitflag = parseInt(slotKey);
      position = getImplantSlotPositionFromBitflag(bitflag);
    } else {
      // For weapons and armor, slotKey is a string slot name
      position = getPositionFn(slotKey);
    }
    
    if (position && grid[position.row] && grid[position.row][position.col]) {
      // Only set slot name if no item is already there
      if (!grid[position.row][position.col].item) {
        grid[position.row][position.col].slotName = slotKey;
      }
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

// Helper function to get all possible slots for a type
function getAllSlotsForType(slotType: string): string[] {
  switch (slotType) {
    case 'weapon':
      return ['Right-Hand', 'Left-Hand', 'Right-Finger', 'Left-Finger', 'Chest', 'Legs', 'Feet', 'Hands', 'Arms', 'Head', 'Back', 'Shoulder', 'Wrist', 'Waist', 'Neck'];
    case 'armor':  
      return ['Head', 'Neck', 'Back', 'Right-Shoulder', 'Chest', 'Body', 'Left-Shoulder', 'Right-Arm', 'Hands', 'Left-Arm', 'Right-Wrist', 'Legs', 'Left-Wrist', 'Right-Finger', 'Feet', 'Left-Finger'];
    case 'implant':
      // Return bitflag values as strings for implants
      return ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096', '8192'];
    default:
      return [];
  }
}

// Methods
function onIconError() {
  console.warn('Failed to load item icon');
}

function navigateToItem(item: Item) {
  // Navigate to ItemDetail page for the specific item at the equipped QL
  router.push({
    name: 'ItemDetail',
    params: {
      aoid: item.aoid.toString()
    },
    query: {
      ql: item.ql.toString()
    }
  });
}
</script>

<style scoped>
/* Base equipment display with uniform sizing */
.equipment-slots-display {
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  display: grid;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  margin: 0 auto;
  /* Uniform cell size for all types */
  --cell-size: 55px;
  /* Always define grid structure */
  grid-template-rows: repeat(5, var(--cell-size));
  grid-template-columns: repeat(3, var(--cell-size));
  width: calc(var(--cell-size) * 3);
  height: calc(var(--cell-size) * 5);
  /* Ensure minimum visibility */
  min-height: calc(var(--cell-size) * 5);
  min-width: calc(var(--cell-size) * 3);
}

/* Background images for different slot types */
.equipment-slots-display.weapon {
  background-image: url('https://cdn.tinkeringidiot.com/static/image/weapon_slots.png');
}

.equipment-slots-display.armor {
  background-image: url('https://cdn.tinkeringidiot.com/static/image/armor_slots.png');
}

.equipment-slots-display.implant {
  background-image: url('https://cdn.tinkeringidiot.com/static/image/implant_slots.png');
}

.equipment-slot-cell {
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.equipment-slot-cell.has-item {
  background: rgba(0, 255, 0, 0.2);
  border-color: rgba(0, 255, 0, 0.8);
  border-width: 2px;
}

.equipment-slot-cell.has-item:hover {
  background: rgba(0, 255, 0, 0.3);
  border-color: rgba(0, 255, 0, 1.0);
}

.equipment-slot-cell.empty-slot {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.4);
}

.equipment-slot-cell.no-slot {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
}

.item-icon {
  width: calc(var(--cell-size) * 0.75);
  height: calc(var(--cell-size) * 0.75);
  object-fit: contain;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8));
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.1s ease, filter 0.1s ease;
}

.item-icon:hover {
  transform: scale(1.05);
  filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
}

.item-fallback-icon {
  font-size: 24px;
  color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
  cursor: pointer;
  transition: transform 0.1s ease, color 0.1s ease;
}

.item-fallback-icon:hover {
  transform: scale(1.1);
  color: rgba(255, 255, 255, 1);
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
.dark .equipment-slot-cell.has-item {
  background: rgba(0, 255, 0, 0.2);
  border-color: rgba(0, 255, 0, 0.6);
}

.dark .equipment-slot-cell.has-item:hover {
  background: rgba(0, 255, 0, 0.3);
  border-color: rgba(0, 255, 0, 0.9);
}

.dark .equipment-slot-cell.empty-slot {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .equipment-slots-display {
    --cell-size: 45px; /* Smaller cells on mobile */
    min-height: 180px;
  }
  
  .item-fallback-icon {
    font-size: 18px;
  }
}
</style>