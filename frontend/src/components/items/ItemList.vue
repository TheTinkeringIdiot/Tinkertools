<!--
ItemList - Display component for search results
Shows items in grid or list view with pagination and compatibility indicators
-->
<template>
  <div class="item-list">
    <!-- View Mode Controls (Mobile) -->
    <div class="flex items-center justify-between mb-4 md:hidden">
      <span class="text-sm text-surface-600 dark:text-surface-400">
        {{ items.length }} items
      </span>
      <div class="flex items-center gap-1 border border-surface-300 dark:border-surface-600 rounded">
        <Button
          icon="pi pi-th-large"
          :severity="viewMode === 'grid' ? 'primary' : 'secondary'"
          :outlined="viewMode !== 'grid'"
          size="small"
          @click="$emit('view-mode-change', 'grid')"
        />
        <Button
          icon="pi pi-list"
          :severity="viewMode === 'list' ? 'primary' : 'secondary'"
          :outlined="viewMode !== 'list'"
          size="small"
          @click="$emit('view-mode-change', 'list')"
        />
      </div>
    </div>

    <!-- Items Display -->
    <div v-if="items.length > 0">
      <!-- Grid View -->
      <div
        v-if="viewMode === 'grid'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6"
      >
        <ItemCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :profile="compatibilityProfile"
          :show-compatibility="showCompatibility"
          :is-favorite="isFavorite(item.id)"
          :is-comparing="isComparing(item.id)"
          @click="$emit('item-click', item)"
          @favorite="$emit('item-favorite', item)"
          @compare="$emit('item-compare', item)"
          @quick-view="showQuickView(item)"
        />
      </div>

      <!-- List View -->
      <div v-else class="space-y-2 mb-6">
        <div
          v-for="item in items"
          :key="item.id"
          class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
          @click="$emit('item-click', item)"
        >
          <div class="p-4">
            <div class="flex items-start gap-4">
              <!-- Item Icon/Image -->
              <div class="w-12 h-12 bg-surface-100 dark:bg-surface-800 rounded flex items-center justify-center flex-shrink-0">
                <img 
                  v-if="getItemIconUrl(item)"
                  :src="getItemIconUrl(item)" 
                  :alt="`${item.name} icon`"
                  class="w-10 h-10 object-contain"
                  @error="(e) => handleIconError(e, item.id)"
                />
                <i v-else class="pi pi-box text-surface-400"></i>
              </div>
              
              <!-- Item Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <!-- Name and QL -->
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="font-semibold text-surface-900 dark:text-surface-50 truncate">
                        {{ item.name }}
                      </h3>
                      <Badge :value="`QL ${item.ql}`" severity="info" size="small" />
                      <Badge v-if="item.is_nano" value="Nano" severity="success" size="small" />
                    </div>
                    
                    <!-- Description -->
                    <p v-if="item.description" class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-2">
                      {{ item.description }}
                    </p>
                    
                    <!-- Key Stats -->
                    <div class="flex flex-wrap gap-2 mb-2">
                      <Tag
                        v-for="stat in getKeyStats(item)"
                        :key="stat.name"
                        :value="`${stat.name}: ${stat.value}`"
                        severity="secondary"
                        size="small"
                      />
                    </div>
                    
                    <!-- Requirements (if showing compatibility) -->
                    <div v-if="showCompatibility && item.requirements?.length" class="flex flex-wrap gap-1">
                      <Tag
                        v-for="req in item.requirements.slice(0, 3)"
                        :key="req.stat"
                        :value="`${getStatName(req.stat)}: ${req.value}`"
                        :severity="canMeetRequirement(req) ? 'success' : 'danger'"
                        size="small"
                      />
                      <Tag
                        v-if="item.requirements.length > 3"
                        :value="`+${item.requirements.length - 3} more`"
                        severity="secondary"
                        size="small"
                      />
                    </div>
                  </div>
                  
                  <!-- Actions -->
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <!-- Compatibility Status -->
                    <div v-if="showCompatibility" class="mr-2">
                      <i
                        v-if="getCompatibilityStatus(item) === 'compatible'"
                        class="pi pi-check-circle text-green-500"
                        v-tooltip.bottom="'You can use this item'"
                      ></i>
                      <i
                        v-else-if="getCompatibilityStatus(item) === 'incompatible'"
                        class="pi pi-times-circle text-red-500"
                        v-tooltip.bottom="'You cannot use this item'"
                      ></i>
                      <i
                        v-else
                        class="pi pi-question-circle text-yellow-500"
                        v-tooltip.bottom="'Compatibility unknown'"
                      ></i>
                    </div>
                    
                    <!-- Favorite Button -->
                    <Button
                      :icon="isFavorite(item.id) ? 'pi pi-heart-fill' : 'pi pi-heart'"
                      size="small"
                      text
                      :severity="isFavorite(item.id) ? 'danger' : 'secondary'"
                      @click.stop="$emit('item-favorite', item)"
                      v-tooltip.bottom="isFavorite(item.id) ? 'Remove from favorites' : 'Add to favorites'"
                    />
                    
                    <!-- Compare Button -->
                    <Button
                      icon="pi pi-clone"
                      size="small"
                      text
                      :severity="isComparing(item.id) ? 'primary' : 'secondary'"
                      @click.stop="$emit('item-compare', item)"
                      v-tooltip.bottom="'Add to comparison'"
                    />
                    
                    <!-- Quick Actions Menu -->
                    <Button
                      icon="pi pi-ellipsis-v"
                      size="small"
                      text
                      @click.stop="showItemMenu($event, item)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination" class="flex items-center justify-between">
        <div class="text-sm text-surface-600 dark:text-surface-400">
          Showing {{ pagination.offset + 1 }}-{{ Math.min(pagination.offset + pagination.limit, pagination.total) }}
          of {{ pagination.total }} items
        </div>
        
        <Paginator
          v-model:first="currentOffset"
          :rows="pagination.limit"
          :total-records="pagination.total"
          :rows-per-page-options="[12, 24, 48, 96]"
          template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
          current-page-report-template="Page {currentPage} of {totalPages}"
          @page="onPageChange"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16">
      <i class="pi pi-inbox text-4xl text-surface-400 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
        No items found
      </h3>
      <p class="text-surface-500 dark:text-surface-500">
        Try adjusting your search terms or filters
      </p>
    </div>

    <!-- Item Context Menu -->
    <ContextMenu ref="itemMenu" :model="itemMenuItems" />

    <!-- Quick View Dialog -->
    <Dialog
      v-model:visible="showQuickViewDialog"
      modal
      :header="selectedItem?.name"
      :style="{ width: '80vw', maxWidth: '800px' }"
      class="p-fluid"
    >
      <ItemQuickView
        v-if="selectedItem"
        :item="selectedItem"
        :profile="compatibilityProfile"
        :show-compatibility="showCompatibility"
        @close="showQuickViewDialog = false"
        @view-full="viewFullItem"
        @favorite="$emit('item-favorite', selectedItem)"
        @compare="$emit('item-compare', selectedItem)"
      />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Item, TinkerProfile, PaginationInfo, ItemRequirement } from '@/types/api'
import { getItemIconUrl as getItemIconUrlUtil } from '@/services/game-utils'

// Components (to be created)
import ItemCard from './ItemCard.vue'
import ItemQuickView from './ItemQuickView.vue'

const props = defineProps<{
  items: Item[]
  viewMode: 'grid' | 'list'
  compatibilityProfile?: TinkerProfile | null
  showCompatibility?: boolean
  loading?: boolean
  pagination?: PaginationInfo
  favoriteItems?: number[]
  comparisonItems?: number[]
}>()

const emit = defineEmits<{
  'item-click': [item: Item]
  'item-favorite': [item: Item]
  'item-compare': [item: Item]
  'page-change': [page: number]
  'view-mode-change': [mode: 'grid' | 'list']
}>()

// State
const currentOffset = ref(props.pagination?.offset || 0)
const showQuickViewDialog = ref(false)
const selectedItem = ref<Item | null>(null)
const itemMenu = ref()
const iconLoadErrors = ref<Set<number>>(new Set())

// Context menu items
const itemMenuItems = ref([
  {
    label: 'View Details',
    icon: 'pi pi-eye',
    command: () => {
      if (selectedItem.value) {
        emit('item-click', selectedItem.value)
      }
    }
  },
  {
    label: 'Quick View',
    icon: 'pi pi-search',
    command: () => {
      showQuickViewDialog.value = true
    }
  },
  { separator: true },
  {
    label: 'Add to Favorites',
    icon: 'pi pi-heart',
    command: () => {
      if (selectedItem.value) {
        emit('item-favorite', selectedItem.value)
      }
    }
  },
  {
    label: 'Add to Comparison',
    icon: 'pi pi-clone',
    command: () => {
      if (selectedItem.value) {
        emit('item-compare', selectedItem.value)
      }
    }
  },
  { separator: true },
  {
    label: 'Copy Item Link',
    icon: 'pi pi-copy',
    command: () => {
      if (selectedItem.value) {
        copyItemLink(selectedItem.value)
      }
    }
  },
  {
    label: 'Share Item',
    icon: 'pi pi-share-alt',
    command: () => {
      if (selectedItem.value) {
        shareItem(selectedItem.value)
      }
    }
  }
])

// Computed
const statNameMap = computed(() => ({
  16: 'Strength', 17: 'Agility', 18: 'Stamina',
  19: 'Intelligence', 20: 'Sense', 21: 'Psychic',
  102: '1H Blunt', 103: '1H Edged', 105: '2H Edged',
  109: '2H Blunt', 133: 'Ranged Energy', 161: 'Computer Literacy'
}))

// Methods
function isFavorite(itemId: number): boolean {
  return props.favoriteItems?.includes(itemId) || false
}

function isComparing(itemId: number): boolean {
  return props.comparisonItems?.includes(itemId) || false
}

function getKeyStats(item: Item): Array<{ name: string; value: string }> {
  if (!item.stats || item.stats.length === 0) return []
  
  return item.stats
    .filter(stat => stat.value !== 0)
    .slice(0, 3)
    .map(stat => ({
      name: getStatName(stat.stat),
      value: stat.value > 0 ? `+${stat.value}` : stat.value.toString()
    }))
}

function getStatName(statId: number): string {
  return statNameMap.value[statId] || `Stat ${statId}`
}

function getCompatibilityStatus(item: Item): 'compatible' | 'incompatible' | 'unknown' {
  if (!props.showCompatibility || !props.compatibilityProfile || !item.requirements) {
    return 'unknown'
  }
  
  const canMeetAll = item.requirements.every(req => canMeetRequirement(req))
  return canMeetAll ? 'compatible' : 'incompatible'
}

function canMeetRequirement(requirement: ItemRequirement): boolean {
  if (!props.compatibilityProfile) return false
  
  const characterStat = props.compatibilityProfile.stats?.[requirement.stat] || 0
  return characterStat >= requirement.value
}

function showQuickView(item: Item) {
  selectedItem.value = item
  showQuickViewDialog.value = true
}

function viewFullItem() {
  if (selectedItem.value) {
    emit('item-click', selectedItem.value)
    showQuickViewDialog.value = false
  }
}

function showItemMenu(event: MouseEvent, item: Item) {
  selectedItem.value = item
  itemMenu.value.show(event)
}

function copyItemLink(item: Item) {
  const url = `${window.location.origin}/items/${item.id}`
  navigator.clipboard.writeText(url).then(() => {
    // Show success toast
    console.log('Item link copied to clipboard')
  })
}

function shareItem(item: Item) {
  if (navigator.share) {
    navigator.share({
      title: item.name,
      text: item.description,
      url: `${window.location.origin}/items/${item.id}`
    })
  } else {
    copyItemLink(item)
  }
}

function onPageChange(event: any) {
  currentOffset.value = event.first
  emit('page-change', Math.floor(event.first / event.rows) + 1)
}

function getItemIconUrl(item: Item): string | null {
  if (iconLoadErrors.value.has(item.id)) return null
  return getItemIconUrlUtil(item.stats || [])
}

function handleIconError(event: Event, itemId: number) {
  iconLoadErrors.value.add(itemId)
}
</script>

<style scoped>
/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Hover effects */
.cursor-pointer:hover {
  transform: translateY(-1px);
}

/* Transition for smooth interactions */
.cursor-pointer {
  transition: all 0.2s ease-in-out;
}

/* Custom scrollbar for lists */
.space-y-2 {
  max-height: 70vh;
  overflow-y: auto;
}

.space-y-2::-webkit-scrollbar {
  width: 6px;
}

.space-y-2::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.space-y-2::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}

/* Grid responsive adjustments */
@media (min-width: 1536px) {
  .grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3.xl\\:grid-cols-4 {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
</style>