<!--
ItemDetail - Detailed item view with complete information
Shows all item data with profile compatibility and comparison options
-->
<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="item?.name || 'Item Details'"
    :style="{ width: '95vw', maxWidth: '1200px', height: '90vh' }"
    :maximizable="true"
    class="item-detail-dialog"
    @hide="onClose"
  >
    <template #header>
      <div class="flex items-center gap-3 w-full">
        <div class="flex items-center gap-2 flex-1">
          <h2 class="text-xl font-bold">{{ item?.name || 'Loading...' }}</h2>
          <Badge v-if="item" :value="`QL ${item.ql}`" severity="info" />
          <Badge v-if="item?.is_nano" value="Nano" severity="success" />
        </div>
        
        <!-- Header Actions -->
        <div v-if="item" class="flex items-center gap-2">
          <Button
            :icon="isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'"
            :label="isFavorite ? 'Favorited' : 'Favorite'"
            :severity="isFavorite ? 'danger' : 'secondary'"
            outlined
            size="small"
            @click="toggleFavorite"
          />
          <Button
            icon="pi pi-clone"
            label="Compare"
            severity="primary"
            outlined
            size="small"
            @click="addToComparison"
          />
          <Button
            icon="pi pi-share-alt"
            severity="secondary"
            outlined
            size="small"
            @click="shareItem"
            v-tooltip.bottom="'Share Item'"
          />
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center h-96">
      <ProgressSpinner />
    </div>

    <div v-else-if="error" class="text-center py-16">
      <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
        Failed to Load Item
      </h3>
      <p class="text-surface-500 dark:text-surface-500 mb-4">{{ error }}</p>
      <Button label="Retry" @click="loadItem" />
    </div>

    <div v-else-if="item" class="space-y-6 max-h-[70vh] overflow-y-auto">
      <!-- CAN Flags and Advanced View Toggle -->
      <div class="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700">
        <!-- CAN Flags (left side) -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300 mr-2">Capabilities:</span>
          <Tag
            v-for="flag in displayCanFlags"
            :key="flag.name"
            :value="flag.name"
            :severity="flag.severity"
            size="small"
          />
          <span v-if="displayCanFlags.length === 0" class="text-sm text-surface-500 dark:text-surface-400 italic">
            No capabilities found
          </span>
        </div>
        
        <!-- Advanced View Toggle (right side) -->
        <div class="flex items-center gap-2">
          <label for="advanced-view-toggle" class="text-sm text-surface-700 dark:text-surface-300">
            Advanced view
          </label>
          <InputSwitch 
            id="advanced-view-toggle"
            v-model="advancedView"
            :disabled="true"
          />
        </div>
      </div>
      
      <!-- Item Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Item Image and Basic Info -->
        <div class="lg:col-span-1">
          <Card>
            <template #content>
              <div class="text-center space-y-4">
                <!-- Item Image -->
                <div class="h-32 bg-surface-100 dark:bg-surface-800 rounded-lg flex items-center justify-center">
                  <img 
                    v-if="itemIconUrl"
                    :src="itemIconUrl" 
                    :alt="`${item.name} icon`"
                    class="w-16 h-16 object-contain"
                    @error="onIconError"
                  />
                  <i v-else class="pi pi-box text-4xl text-surface-400"></i>
                </div>
                
                <!-- Basic Properties -->
                <div class="space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-surface-600 dark:text-surface-400">Quality Level:</span>
                    <Badge :value="item.ql.toString()" severity="info" />
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-surface-600 dark:text-surface-400">Item Class:</span>
                    <span class="text-sm font-medium">{{ getItemClassName(item.item_class) }}</span>
                  </div>
                  <div v-if="item.item_type" class="flex justify-between items-center">
                    <span class="text-sm text-surface-600 dark:text-surface-400">Type:</span>
                    <span class="text-sm font-medium">{{ item.item_type }}</span>
                  </div>
                </div>
                
                <!-- Compatibility Status -->
                <div v-if="profile && showCompatibility" class="p-3 rounded-lg"
                  :class="{
                    'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800': isCompatible,
                    'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800': !isCompatible && hasRequirements,
                    'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800': !hasRequirements
                  }"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <i :class="{
                      'pi pi-check-circle text-green-600': isCompatible,
                      'pi pi-times-circle text-red-600': !isCompatible && hasRequirements,
                      'pi pi-info-circle text-yellow-600': !hasRequirements
                    }"></i>
                    <span class="text-sm font-medium">
                      {{ getCompatibilityText() }}
                    </span>
                  </div>
                  <div class="text-xs text-surface-600 dark:text-surface-400">
                    Profile: {{ profile.name }} (Level {{ profile.level }})
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
        
        <!-- Item Description and Properties -->
        <div class="lg:col-span-2">
          <Card>
            <template #header>
              <h3 class="text-lg font-semibold">Description & Properties</h3>
            </template>
            <template #content>
              <div class="space-y-4">
                <!-- Description -->
                <div v-if="item.description">
                  <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Description</h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    {{ item.description }}
                  </p>
                </div>
                
                <!-- Item Properties -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Properties</h4>
                    <div class="space-y-1">
                      <div class="flex justify-between text-sm">
                        <span>Nano Program:</span>
                        <span class="font-medium">{{ item.is_nano ? 'Yes' : 'No' }}</span>
                      </div>
                      <div class="flex justify-between text-sm">
                        <span>Tradeable:</span>
                        <span class="font-medium">{{ getTradeableText() }}</span>
                      </div>
                      <div class="flex justify-between text-sm">
                        <span>Droppable:</span>
                        <span class="font-medium">{{ getDroppableText() }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div v-if="item.action_data">
                    <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Usage</h4>
                    <div class="space-y-1">
                      <div class="flex justify-between text-sm">
                        <span>Actions:</span>
                        <span class="font-medium">{{ item.action_data.length || 0 }}</span>
                      </div>
                      <div v-if="hasSpecialEffects" class="flex justify-between text-sm">
                        <span>Special Effects:</span>
                        <span class="font-medium">Yes</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>

      <!-- Weapon Statistics (for weapons only) -->
      <WeaponStats 
        v-if="item && isWeapon(item.item_class)"
        :item="item"
        :profile="profile"
        :show-compatibility="showCompatibility"
      />

      <!-- Item Attributes -->
      <ItemAttributes 
        v-if="item"
        :item="item"
      />

      <!-- Enhanced Requirements -->
      <ItemRequirements
        v-if="item && item.requirements?.length"
        :item="item"
        :profile="profile"
        :show-compatibility="showCompatibility"
      />

      <!-- General Statistics -->
      <Card v-if="item.stats?.length">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">General Statistics</h3>
            <Button
              :label="showAllStats ? 'Show Key Stats' : 'Show All Stats'"
              size="small"
              text
              @click="showAllStats = !showAllStats"
            />
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="stat in displayedStats"
              :key="stat.stat"
              class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded"
            >
              <span class="text-sm text-surface-600 dark:text-surface-400">
                {{ getStatName(stat.stat) }}
              </span>
              <span
                class="font-mono font-medium"
                :class="{
                  'text-green-600 dark:text-green-400': stat.value > 0,
                  'text-red-600 dark:text-red-400': stat.value < 0,
                  'text-surface-700 dark:text-surface-300': stat.value === 0
                }"
              >
                {{ stat.value > 0 ? '+' : '' }}{{ stat.value }}
              </span>
            </div>
          </div>
        </template>
      </Card>


      <!-- Attack/Defense Data -->
      <Card v-if="item.attack_data || item.defense_data">
        <template #header>
          <h3 class="text-lg font-semibold">Combat Information</h3>
        </template>
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-if="item.attack_data">
              <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Attack</h4>
              <div class="space-y-2">
                <div
                  v-for="attack in item.attack_data"
                  :key="attack.stat"
                  class="flex justify-between p-2 bg-surface-50 dark:bg-surface-900 rounded"
                >
                  <span class="text-sm">{{ getStatName(attack.stat) }}</span>
                  <span class="font-mono font-medium">{{ attack.value }}</span>
                </div>
              </div>
            </div>
            
            <div v-if="item.defense_data">
              <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Defense</h4>
              <div class="space-y-2">
                <div
                  v-for="defense in item.defense_data"
                  :key="defense.stat"
                  class="flex justify-between p-2 bg-surface-50 dark:bg-surface-900 rounded"
                >
                  <span class="text-sm">{{ getStatName(defense.stat) }}</span>
                  <span class="font-mono font-medium">{{ defense.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Special Effects -->
      <Card v-if="item.spell_data?.length">
        <template #header>
          <h3 class="text-lg font-semibold">Special Effects</h3>
        </template>
        <template #content>
          <div class="space-y-4">
            <div
              v-for="(spell, index) in item.spell_data"
              :key="index"
              class="p-4 bg-surface-50 dark:bg-surface-900 rounded-lg"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium">Effect {{ index + 1 }}</span>
                <Badge :value="getEffectTrigger(spell.event)" severity="info" size="small" />
              </div>
              <div v-if="spell.description" class="text-sm text-surface-600 dark:text-surface-400">
                {{ spell.description }}
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Actions and Usage -->
      <Card v-if="item.action_data?.length">
        <template #header>
          <h3 class="text-lg font-semibold">Actions</h3>
        </template>
        <template #content>
          <div class="space-y-3">
            <div
              v-for="(action, index) in item.action_data"
              :key="index"
              class="p-3 bg-surface-50 dark:bg-surface-900 rounded"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ getActionName(action.action) }}</span>
                <Badge :value="action.criteria?.length || 0" severity="secondary" size="small" />
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="text-xs text-surface-500 dark:text-surface-400">
          Item ID: {{ item?.id }} | AOID: {{ item?.aoid }}
        </div>
        <div class="flex gap-2">
          <Button label="Close" severity="secondary" @click="onClose" />
          <Button v-if="item" label="Add to Comparison" icon="pi pi-clone" @click="addToComparison" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useItemsStore } from '@/stores/items'
import { useProfileStore } from '@/stores/profile'
import { getItemIconUrl, isWeapon, getDisplayCanFlags } from '@/services/game-utils'
import type { Item, TinkerProfile, ItemRequirement } from '@/types/api'

// Import new components
import WeaponStats from '@/components/items/WeaponStats.vue'
import ItemAttributes from '@/components/items/ItemAttributes.vue'
import ItemRequirements from '@/components/items/ItemRequirements.vue'

const route = useRoute()
const router = useRouter()
const itemsStore = useItemsStore()
const profileStore = useProfileStore()

// Props
const props = defineProps<{
  id?: string
}>()

// State
const isVisible = ref(true)
const item = ref<Item | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showAllStats = ref(false)
const iconLoadError = ref(false)
const advancedView = ref(false)

// Computed
const profile = computed(() => profileStore.currentProfile)
const showCompatibility = computed(() => !!profile.value)

const hasRequirements = computed(() => 
  item.value?.requirements && item.value.requirements.length > 0
)

const isCompatible = computed(() => {
  if (!profile.value || !hasRequirements.value) return true
  return item.value!.requirements!.every(req => canMeetRequirement(req))
})

const isFavorite = computed(() => 
  item.value ? profileStore.preferences.favoriteItems.includes(item.value.id) : false
)

const hasSpecialEffects = computed(() => 
  item.value?.spell_data && item.value.spell_data.length > 0
)

const itemIconUrl = computed(() => {
  if (iconLoadError.value || !item.value?.stats) return null
  return getItemIconUrl(item.value.stats)
})

const displayedStats = computed(() => {
  if (!item.value?.stats) return []
  
  if (showAllStats.value) {
    return item.value.stats.filter(stat => stat.value !== 0)
  } else {
    return item.value.stats
      .filter(stat => stat.value !== 0 && Math.abs(stat.value) > 5)
      .slice(0, 9)
  }
})

const displayCanFlags = computed(() => {
  if (!item.value?.stats) return []
  return getDisplayCanFlags(item.value.stats)
})

// Methods
async function loadItem() {
  const itemId = props.id || route.params.id as string
  if (!itemId) return
  
  loading.value = true
  error.value = null
  
  try {
    const loadedItem = await itemsStore.getItem(parseInt(itemId))
    item.value = loadedItem
  } catch (err: any) {
    error.value = err.message || 'Failed to load item'
  } finally {
    loading.value = false
  }
}

function onClose() {
  isVisible.value = false
  router.push('/items')
}

function toggleFavorite() {
  if (item.value) {
    if (isFavorite.value) {
      profileStore.removeFavoriteItem(item.value.id)
    } else {
      profileStore.addFavoriteItem(item.value.id)
    }
  }
}

function addToComparison() {
  // Emit event or call parent method to add to comparison
  console.log('Add to comparison:', item.value?.id)
}

function shareItem() {
  if (!item.value) return
  
  const url = `${window.location.origin}/items/${item.value.id}`
  
  if (navigator.share) {
    navigator.share({
      title: item.value.name,
      text: item.value.description,
      url
    })
  } else {
    navigator.clipboard.writeText(url)
    // Show success toast
  }
}

function getCompatibilityText(): string {
  if (!hasRequirements.value) return 'No requirements'
  return isCompatible.value ? 'You can use this item' : 'Requirements not met'
}

function canMeetRequirement(requirement: ItemRequirement): boolean {
  if (!profile.value) return false
  const characterStat = profile.value.stats?.[requirement.stat] || 0
  return characterStat >= requirement.value
}

function getCharacterStat(statId: number): number {
  return profile.value?.stats?.[statId] || 0
}

// Utility functions
const statNames: Record<number, string> = {
  16: 'Strength', 17: 'Agility', 18: 'Stamina',
  19: 'Intelligence', 20: 'Sense', 21: 'Psychic',
  102: '1H Blunt', 103: '1H Edged', 105: '2H Edged',
  109: '2H Blunt', 133: 'Ranged Energy', 161: 'Computer Literacy'
}

const itemClassNames: Record<number, string> = {
  1: '1H Blunt Weapon', 2: '1H Edged Weapon', 3: '2H Blunt Weapon',
  4: '2H Edged Weapon', 5: 'Ranged Weapon', 6: 'Body Armor',
  7: 'Head Armor', 8: 'Arm Armor', 9: 'Leg Armor', 10: 'Foot Armor',
  15: 'Implant', 20: 'Utility Item'
}

function getStatName(statId: number): string {
  return statNames[statId] || `Stat ${statId}`
}

function getItemClassName(classId: number): string {
  return itemClassNames[classId] || `Class ${classId}`
}

function getTradeableText(): string {
  return 'Unknown' // Would need actual property from item data
}

function getDroppableText(): string {
  return 'Unknown' // Would need actual property from item data
}

function getEffectTrigger(event: number): string {
  const triggers: Record<number, string> = {
    0: 'On Use', 5: 'On Hit', 14: 'When Equipped', 15: 'Passive'
  }
  return triggers[event] || `Event ${event}`
}

function getActionName(actionId: number): string {
  const actions: Record<number, string> = {
    6: 'Equip', 8: 'Attack', 9: 'Use'
  }
  return actions[actionId] || `Action ${actionId}`
}

function onIconError() {
  iconLoadError.value = true
}

// Initialize
onMounted(() => {
  loadItem()
})

// Watch for route changes
watch(() => route.params.id, () => {
  if (route.name === 'ItemDetail') {
    loadItem()
  }
})
</script>

<style scoped>
.item-detail-dialog :deep(.p-dialog-content) {
  padding: 1.5rem;
}

.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}
</style>