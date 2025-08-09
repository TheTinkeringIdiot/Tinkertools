<!--
SymbiantSearch - Search component for symbiants
Provides text search with suggestions and quick filters
-->
<template>
  <div class="symbiant-search p-3">
    <div class="relative">
      <IconField iconPosition="left">
        <InputIcon>
          <i class="pi pi-search"></i>
        </InputIcon>
        <InputText
          v-model="searchQuery"
          placeholder="Search symbiants..."
          class="w-full"
          @input="onSearchInput"
          @keydown.enter="onSearchSubmit"
        />
      </IconField>
      
      <!-- Clear search button -->
      <Button
        v-if="searchQuery.trim()"
        @click="clearSearch"
        icon="pi pi-times"
        size="small"
        text
        rounded
        class="absolute right-2 top-1/2 transform -translate-y-1/2"
        aria-label="Clear search"
      />
    </div>
    
    <!-- Quick filters -->
    <div v-if="showQuickFilters" class="mt-3">
      <div class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
        Quick Filters:
      </div>
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="filter in quickFilters"
          :key="filter.value"
          @click="applyQuickFilter(filter.value)"
          :label="filter.label"
          :severity="activeQuickFilter === filter.value ? 'primary' : 'secondary'"
          size="small"
          text
          class="text-xs"
        />
      </div>
    </div>
    
    <!-- Search suggestions (when typing) -->
    <div
      v-if="showSuggestions && suggestions.length > 0"
      class="absolute z-10 w-full mt-1 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-md shadow-lg max-h-48 overflow-y-auto"
    >
      <div
        v-for="(suggestion, index) in suggestions"
        :key="index"
        @click="applySuggestion(suggestion)"
        class="px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-sm"
      >
        <div class="font-medium">{{ suggestion.name }}</div>
        <div v-if="suggestion.type" class="text-xs text-surface-500 dark:text-surface-400">
          {{ suggestion.type }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';

interface SearchSuggestion {
  name: string;
  type?: string;
  value: string;
}

interface QuickFilter {
  label: string;
  value: string;
}

// Props
interface Props {
  modelValue?: string;
  showQuickFilters?: boolean;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  showQuickFilters: true,
  placeholder: 'Search symbiants...'
});

// Emits
interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'search', query: string): void;
  (e: 'filter-applied', filter: string): void;
}

const emit = defineEmits<Emits>();

// Reactive state
const searchQuery = ref(props.modelValue);
const showSuggestions = ref(false);
const activeQuickFilter = ref<string | null>(null);

// Mock data - in real implementation, these would come from the store
const suggestions = computed<SearchSuggestion[]>(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    return [];
  }
  
  const query = searchQuery.value.toLowerCase();
  
  // Mock suggestions based on common symbiant names and families
  const mockSuggestions: SearchSuggestion[] = [
    { name: 'Seeker', type: 'Family', value: 'family:seeker' },
    { name: 'Hacker', type: 'Family', value: 'family:hacker' },
    { name: 'Soldier', type: 'Family', value: 'family:soldier' },
    { name: 'Infantry', type: 'Unit Type', value: 'type:infantry' },
    { name: 'Artillery', type: 'Unit Type', value: 'type:artillery' },
    { name: 'Control', type: 'Unit Type', value: 'type:control' },
    { name: 'Head', type: 'Slot', value: 'slot:head' },
    { name: 'Chest', type: 'Slot', value: 'slot:chest' },
    { name: 'Arms', type: 'Slot', value: 'slot:arms' }
  ];
  
  return mockSuggestions
    .filter(suggestion => 
      suggestion.name.toLowerCase().includes(query) ||
      suggestion.type?.toLowerCase().includes(query)
    )
    .slice(0, 8); // Limit to 8 suggestions
});

const quickFilters = computed<QuickFilter[]>(() => [
  { label: 'Artillery', value: 'type:artillery' },
  { label: 'Infantry', value: 'type:infantry' },
  { label: 'Support', value: 'type:support' },
  { label: 'Control', value: 'type:control' },
  { label: 'High QL', value: 'ql:high' },
  { label: 'Recent', value: 'sort:recent' }
]);

// Methods
const onSearchInput = () => {
  emit('update:modelValue', searchQuery.value);
  showSuggestions.value = searchQuery.value.length >= 2;
  
  // Auto-search with debounce would be implemented here
  // For now, just emit on each input
  emit('search', searchQuery.value);
};

const onSearchSubmit = () => {
  showSuggestions.value = false;
  emit('search', searchQuery.value);
};

const clearSearch = () => {
  searchQuery.value = '';
  activeQuickFilter.value = null;
  showSuggestions.value = false;
  emit('update:modelValue', '');
  emit('search', '');
};

const applySuggestion = (suggestion: SearchSuggestion) => {
  searchQuery.value = suggestion.value;
  showSuggestions.value = false;
  emit('update:modelValue', suggestion.value);
  emit('search', suggestion.value);
};

const applyQuickFilter = (filterValue: string) => {
  if (activeQuickFilter.value === filterValue) {
    // Toggle off
    activeQuickFilter.value = null;
    clearSearch();
  } else {
    // Apply new filter
    activeQuickFilter.value = filterValue;
    searchQuery.value = filterValue;
    emit('update:modelValue', filterValue);
    emit('filter-applied', filterValue);
    emit('search', filterValue);
  }
};

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  searchQuery.value = newValue;
});

// Handle click outside to close suggestions
const handleClickOutside = (event: Event) => {
  if (!(event.target as Element)?.closest('.symbiant-search')) {
    showSuggestions.value = false;
  }
};

// Add event listener when component mounts
import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.symbiant-search {
  position: relative;
}
</style>