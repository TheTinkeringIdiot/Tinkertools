<!--
EquipSlotSelector - Dialog for selecting equipment slot when equipping an item
Shows available slots for an item and allows user to choose where to equip it
-->
<template>
  <Dialog v-model:visible="localVisible" modal :style="{ width: '450px' }" :header="title">
    <div class="space-y-4">
      <!-- Item Info -->
      <div class="p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
        <div class="flex items-center gap-3">
          <img
            v-if="iconUrl"
            :src="iconUrl"
            :alt="item.name"
            class="w-10 h-10 object-contain"
            @error="onIconError"
          />
          <i v-else class="pi pi-box text-2xl text-surface-400"></i>
          <div>
            <div class="font-medium">{{ item.name }}</div>
            <div class="text-sm text-surface-600 dark:text-surface-400">
              QL {{ item.ql }} {{ itemTypeName }}
            </div>
          </div>
        </div>
      </div>

      <!-- Available Slots -->
      <div v-if="availableSlots.length > 0">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Select Equipment Slot:
        </label>
        <div class="space-y-2">
          <div
            v-for="slot in availableSlots"
            :key="slot.name"
            class="relative"
          >
            <label
              :for="`slot-${slot.name}`"
              class="flex items-center p-3 rounded-lg border cursor-pointer transition-colors"
              :class="[
                selectedSlot === slot.name
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500'
                  : 'bg-surface-0 dark:bg-surface-900 border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800'
              ]"
            >
              <input
                :id="`slot-${slot.name}`"
                type="radio"
                v-model="selectedSlot"
                :value="slot.name"
                class="sr-only"
              />
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <span class="font-medium">{{ slot.displayName }}</span>
                  <Badge
                    v-if="slot.occupied"
                    value="Occupied"
                    severity="warning"
                    class="ml-2"
                  />
                </div>
                <div v-if="slot.occupied" class="text-sm text-surface-600 dark:text-surface-400 mt-1">
                  Currently: {{ slot.currentItem.name }} (QL {{ slot.currentItem.ql }})
                </div>
                <div v-else class="text-sm text-green-600 dark:text-green-400 mt-1">
                  Slot is empty
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
      <div v-else>
        <Message severity="error" :closable="false">
          No valid equipment slots found for this item.
        </Message>
      </div>

      <!-- Confirmation Warning -->
      <Message
        v-if="selectedSlot && getSelectedSlot()?.occupied"
        severity="warn"
        :closable="false"
        icon="pi pi-exclamation-triangle"
      >
        This will replace the currently equipped item in this slot.
      </Message>
    </div>

    <template #footer>
      <Button
        label="Cancel"
        @click="cancel"
        text
      />
      <Button
        label="Equip Item"
        @click="confirm"
        :disabled="!selectedSlot || availableSlots.length === 0"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import Message from 'primevue/message';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { getItemIconUrl } from '@/services/game-utils';

// Props
interface Props {
  visible: boolean;
  item: any; // Item to equip
  profile: TinkerProfile | null;
  validSlots?: string[]; // Optional list of valid slots for this item
}

const props = withDefaults(defineProps<Props>(), {
  validSlots: () => []
});

// Emits
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'confirm': [slot: string];
  'cancel': [];
}>();

// Local state
const selectedSlot = ref<string>('');

// Computed
const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

const title = computed(() => `Equip ${props.item?.name || 'Item'}`);

const iconUrl = computed(() => {
  if (!props.item) return null;
  return getItemIconUrl(props.item.stats || []);
});

const itemTypeName = computed(() => {
  if (!props.item) return '';
  if (props.item.item_class === 1) return 'Weapon';
  if (props.item.item_class === 2) return 'Armor';
  if (props.item.item_class === 3) return 'Implant';
  return 'Item';
});

// Determine available slots based on item type and what's valid
const availableSlots = computed(() => {
  if (!props.item || !props.profile) return [];

  const slots: Array<{
    name: string;
    displayName: string;
    occupied: boolean;
    currentItem: any;
  }> = [];

  // If validSlots are provided (from stat 298), use them directly
  if (props.validSlots && props.validSlots.length > 0) {
    // Determine equipment category based on item class
    let equipmentCategory: 'Weapons' | 'Clothing' | 'Implants';

    if (props.item.item_class === 1) {
      equipmentCategory = 'Weapons';
    } else if (props.item.item_class === 2) {
      equipmentCategory = 'Clothing';
    } else if (props.item.item_class === 3) {
      equipmentCategory = 'Implants';
    } else {
      // Try to guess based on the slot names
      const firstSlot = props.validSlots[0];
      if (['HUD1', 'HUD2', 'HUD3', 'UTILS1', 'UTILS2', 'UTILS3', 'RightHand', 'LeftHand', 'Deck1', 'Deck2', 'Deck3', 'Deck4', 'Deck5', 'Deck6'].includes(firstSlot)) {
        equipmentCategory = 'Weapons';
      } else if (['Head', 'Eye', 'Ear', 'Chest', 'Waist', 'Leg', 'Feet'].includes(firstSlot)) {
        equipmentCategory = 'Implants';
      } else {
        equipmentCategory = 'Clothing';
      }
    }

    const equipment = props.profile[equipmentCategory] || {};

    // Process each valid slot
    for (const slotName of props.validSlots) {
      const currentItem = equipment[slotName] || null;
      slots.push({
        name: slotName,
        displayName: formatSlotName(slotName),
        occupied: currentItem !== null,
        currentItem: currentItem || { name: 'Empty', ql: 0 }
      });
    }

    return slots;
  }

  // Fallback: If no validSlots provided, return empty array
  // (The item should have stat 298 which provides valid slots)
  return [];
});

// Get the selected slot object
function getSelectedSlot() {
  return availableSlots.value.find(s => s.name === selectedSlot.value);
}

// Format slot name for display
function formatSlotName(slot: string): string {
  // Convert camelCase to Title Case
  return slot
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Hud/gi, 'HUD')
    .replace(/Ncu/gi, 'NCU')
    .replace(/Utils/gi, 'Utility');
}

// Methods
function onIconError() {
  console.warn('Failed to load item icon');
}

function confirm() {
  if (selectedSlot.value) {
    emit('confirm', selectedSlot.value);
    selectedSlot.value = '';
  }
}

function cancel() {
  emit('cancel');
  selectedSlot.value = '';
}

// Reset selection when dialog opens
watch(() => props.visible, (newVal) => {
  if (newVal) {
    selectedSlot.value = '';
    // Auto-select first empty slot if available
    const emptySlot = availableSlots.value.find(s => !s.occupied);
    if (emptySlot) {
      selectedSlot.value = emptySlot.name;
    } else if (availableSlots.value.length === 1) {
      // If only one slot available, auto-select it
      selectedSlot.value = availableSlots.value[0].name;
    }
  }
});
</script>

<style scoped>
/* Radio button styling handled by sr-only class */
</style>