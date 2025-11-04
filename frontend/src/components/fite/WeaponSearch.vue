<template>
  <div class="relative">
    <div class="relative">
      <InputText
        v-model="searchQuery"
        @keyup.enter="performSearch"
        @input="onInput"
        placeholder="Search weapons by name or description..."
        class="w-full pr-10"
        :disabled="loading"
      />
      <Button
        @click="performSearch"
        icon="pi pi-search"
        class="absolute right-1 top-1/2 transform -translate-y-1/2"
        text
        :loading="loading"
      />
    </div>

    <!-- Quick Search Suggestions -->
    <div
      v-if="showSuggestions && suggestions.length > 0"
      class="absolute top-full left-0 right-0 bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-b-lg shadow-lg z-10 max-h-60 overflow-y-auto"
    >
      <div
        v-for="suggestion in suggestions"
        :key="suggestion.type + suggestion.text"
        @click="applySuggestion(suggestion)"
        class="px-4 py-2 hover:bg-surface-50 dark:hover:bg-surface-900 cursor-pointer border-b border-surface-100 dark:border-surface-800 last:border-b-0"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-surface-900 dark:text-surface-50">{{ suggestion.text }}</span>
          <span
            class="text-xs text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded"
            >{{ suggestion.type }}</span
          >
        </div>
      </div>
    </div>

    <!-- Search History -->
    <div v-if="searchHistory.length > 0 && searchQuery === ''" class="mt-2">
      <div class="text-xs text-surface-500 dark:text-surface-400 mb-1">Recent searches:</div>
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="term in searchHistory.slice(0, 5)"
          :key="term"
          @click="applyHistoryTerm(term)"
          :label="term"
          size="small"
          severity="secondary"
          outlined
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

interface Props {
  modelValue: string;
  loading?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
  (e: 'search', query: string): void;
}

interface SearchSuggestion {
  text: string;
  type: 'weapon' | 'skill' | 'category';
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Local state
const searchQuery = ref(props.modelValue);
const showSuggestions = ref(false);
const searchHistory = ref<string[]>([]);

// Search suggestions
const suggestions = computed<SearchSuggestion[]>(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) return [];

  const query = searchQuery.value.toLowerCase();
  const results: SearchSuggestion[] = [];

  // Weapon type suggestions
  const weaponTypes = [
    'rifle',
    'pistol',
    'sword',
    'blade',
    'staff',
    'bow',
    'shotgun',
    'smg',
    'assault',
  ];
  weaponTypes.forEach((type) => {
    if (type.includes(query) && !results.find((r) => r.text === type)) {
      results.push({ text: type, type: 'category' });
    }
  });

  // Skill-based suggestions
  const skillTerms = ['martial', 'rifle', 'pistol', '1h', '2h', 'blunt', 'edged', 'piercing'];
  skillTerms.forEach((skill) => {
    if (skill.includes(query) && !results.find((r) => r.text === skill)) {
      results.push({ text: skill, type: 'skill' });
    }
  });

  // Common weapon name patterns
  const weaponPatterns = [
    'superior',
    'enhanced',
    'improved',
    'advanced',
    'basic',
    'premium',
    'elite',
  ];
  weaponPatterns.forEach((pattern) => {
    if (pattern.includes(query) && !results.find((r) => r.text === pattern)) {
      results.push({ text: pattern, type: 'weapon' });
    }
  });

  return results.slice(0, 8);
});

// Methods
const performSearch = () => {
  if (searchQuery.value.trim()) {
    addToHistory(searchQuery.value.trim());
    emit('search', searchQuery.value.trim());
  }
  showSuggestions.value = false;
};

const onInput = () => {
  emit('update:modelValue', searchQuery.value);
  showSuggestions.value = searchQuery.value.length >= 2;
};

const applySuggestion = (suggestion: SearchSuggestion) => {
  searchQuery.value = suggestion.text;
  emit('update:modelValue', suggestion.text);
  showSuggestions.value = false;
  performSearch();
};

const applyHistoryTerm = (term: string) => {
  searchQuery.value = term;
  emit('update:modelValue', term);
  performSearch();
};

const addToHistory = (term: string) => {
  // Remove if already exists
  searchHistory.value = searchHistory.value.filter((t) => t !== term);
  // Add to beginning
  searchHistory.value.unshift(term);
  // Keep only last 10
  searchHistory.value = searchHistory.value.slice(0, 10);
  // Save to localStorage
  saveSearchHistory();
};

const saveSearchHistory = () => {
  try {
    localStorage.setItem('tinkertools_weapon_search_history', JSON.stringify(searchHistory.value));
  } catch (error) {
    console.warn('Failed to save search history:', error);
  }
};

const loadSearchHistory = () => {
  try {
    const saved = localStorage.getItem('tinkertools_weapon_search_history');
    if (saved) {
      searchHistory.value = JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load search history:', error);
  }
};

// Handle clicks outside to close suggestions
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element;
  if (!target.closest('.relative')) {
    showSuggestions.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadSearchHistory();
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Watch for prop changes
watch(
  () => props.modelValue,
  (newValue) => {
    searchQuery.value = newValue;
  }
);
</script>
