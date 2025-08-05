# Frontend Component Structure

## Overview

This document defines the modular component architecture for TinkerTools frontend, emphasizing reusability, maintainability, and consistent user experience across all six specialized applications. The component structure follows Vue 3 best practices with Composition API and TypeScript.

## Design Principles

### 1. Component Hierarchy
- **Atomic Design**: Components organized from atoms to templates
- **Single Responsibility**: Each component has one clear purpose
- **Composition over Inheritance**: Prefer composition for component reuse
- **Prop Drilling Avoidance**: Use provide/inject for deep component trees

### 2. Reusability Strategy
- **Shared Core Components**: Common UI elements across all tools
- **Feature-Specific Components**: Tool-specific functionality
- **Composable Logic**: Reusable business logic as composables
- **Consistent API**: Standardized prop interfaces across similar components

### 3. Performance Optimization
- **Lazy Loading**: Components loaded on demand
- **Virtual Scrolling**: Efficient rendering of large datasets
- **Memoization**: Computed properties and watch caching
- **Code Splitting**: Feature-based code splitting

## Shared Component Library

### Base Components (Atoms)

```typescript
// Core UI building blocks
├── BaseButton.vue              # Standardized button component
├── BaseInput.vue               # Input field with validation
├── BaseSelect.vue              # Dropdown selection
├── BaseCheckbox.vue            # Checkbox input
├── BaseRadio.vue               # Radio button input
├── BaseTextarea.vue            # Multi-line text input
├── BaseSlider.vue              # Range slider input
├── BaseSpinner.vue             # Loading spinner
├── BaseIcon.vue                # Icon wrapper component
├── BaseBadge.vue               # Status/count badge
├── BaseTooltip.vue             # Tooltip overlay
├── BaseModal.vue               # Modal dialog
├── BaseAccordion.vue           # Collapsible content
├── BaseTab.vue                 # Tab component
└── BaseCard.vue                # Content card container
```

#### BaseButton Component Example
```vue
<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    :type="type"
    @click="handleClick"
  >
    <BaseSpinner v-if="loading" size="sm" />
    <BaseIcon v-if="icon && !loading" :name="icon" />
    <span v-if="$slots.default || label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  icon?: string;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  full?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button'
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const buttonClasses = computed(() => [
  'base-button',
  `base-button--${props.variant}`,
  `base-button--${props.size}`,
  {
    'base-button--full': props.full,
    'base-button--disabled': props.disabled,
    'base-button--loading': props.loading
  }
]);

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
};
</script>
```

### Layout Components (Molecules)

```typescript
// Layout and structural components
├── AppHeader.vue               # Application header
├── AppSidebar.vue              # Navigation sidebar
├── AppFooter.vue               # Application footer
├── AppBreadcrumbs.vue          # Breadcrumb navigation
├── PageHeader.vue              # Page-level header
├── PageContent.vue             # Main content area
├── DataTable.vue               # Advanced data table
├── SearchBar.vue               # Search input with filters
├── FilterPanel.vue             # Advanced filtering
├── SortControls.vue            # Sorting controls
├── PaginationControls.vue      # Pagination component
├── ProgressBar.vue             # Progress indicator
├── StatCard.vue                # Statistic display card
├── InfoPanel.vue               # Information display panel
├── AlertBanner.vue             # Alert/notification banner
└── LoadingState.vue            # Loading state placeholder
```

#### DataTable Component Example
```vue
<template>
  <div class="data-table">
    <div v-if="loading" class="data-table__loading">
      <LoadingState />
    </div>
    
    <div v-else class="data-table__container">
      <table class="data-table__table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="getHeaderClasses(column)"
              @click="handleSort(column)"
            >
              {{ column.label }}
              <BaseIcon
                v-if="column.sortable"
                :name="getSortIcon(column.key)"
                class="data-table__sort-icon"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in paginatedData"
            :key="getRowKey(item, index)"
            :class="getRowClasses(item, index)"
            @click="handleRowClick(item, index)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              :class="getCellClasses(column)"
            >
              <slot
                :name="`cell-${column.key}`"
                :item="item"
                :value="getCellValue(item, column.key)"
                :column="column"
                :index="index"
              >
                {{ formatCellValue(item, column) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
      
      <PaginationControls
        v-if="paginated"
        :current-page="currentPage"
        :total-pages="totalPages"
        :page-size="pageSize"
        :total-items="filteredData.length"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  formatter?: (value: any, item: any) => string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface Props {
  data: any[];
  columns: Column[];
  loading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  paginated?: boolean;
  pageSize?: number;
  selectable?: boolean;
  hoverable?: boolean;
  striped?: boolean;
}

// Component implementation with full sorting, pagination, and selection logic
</script>
```

### Character Management Components

```typescript
// Character-related components
├── CharacterProfile.vue        # Character profile display
├── CharacterSelector.vue       # Character selection dropdown
├── CharacterStats.vue          # Character statistics display
├── SkillTree.vue               # Skill tree visualization
├── SkillProgress.vue           # Individual skill progress
├── StatCalculator.vue          # Real-time stat calculation
├── LevelCalculator.vue         # Level and experience calculation
├── CharacterComparison.vue     # Compare multiple characters
├── CharacterImporter.vue       # Import character data
└── CharacterExporter.vue       # Export character data
```

### Item Management Components

```typescript
// Item-related components
├── ItemCard.vue                # Item display card
├── ItemList.vue                # List of items
├── ItemDetails.vue             # Detailed item information
├── ItemSearch.vue              # Item search interface
├── ItemFilter.vue              # Item filtering controls
├── ItemComparison.vue          # Compare multiple items
├── ItemTooltip.vue             # Item tooltip overlay
├── EquipmentSlot.vue           # Equipment slot representation
├── InventoryGrid.vue           # Grid-based inventory
├── ItemDatabase.vue            # Item database browser
├── StatModifiers.vue           # Item stat modification display
└── RequirementChecker.vue      # Item requirement validation
```

### Game Data Components

```typescript
// Game-specific data components
├── NanoProgram.vue             # Nano program display
├── NanoEffects.vue             # Nano effects visualization
├── SpellData.vue               # Spell data display
├── CombatStats.vue             # Combat statistics
├── DamageCalculation.vue       # Damage calculation display
├── BossInformation.vue         # Boss data display
├── LocationMap.vue             # Game location mapping
├── SymbiantCard.vue            # Symbiant display card
├── QualityLevel.vue            # Quality level indicator
└── GameTooltip.vue             # Game-specific tooltips
```

## Feature-Specific Component Modules

### TinkerPlants Components

```typescript
features/tinker-plants/components/
├── EquipmentOptimizer.vue      # Main optimization interface
├── OptimizationResults.vue     # Display optimization results
├── EquipmentComparison.vue     # Compare equipment builds
├── StatTargets.vue             # Set stat optimization targets
├── EquipmentConstraints.vue    # Set equipment constraints
├── BuildSaver.vue              # Save/load equipment builds
├── OptimizationSettings.vue    # Optimization algorithm settings
├── PerformanceMetrics.vue      # Show optimization performance
├── EquipmentSlotManager.vue    # Manage equipment slots
└── StatProjection.vue          # Project future stat gains
```

### TinkerFite Components

```typescript
features/tinker-fite/components/
├── CombatSimulator.vue         # Main combat simulation
├── FightSetup.vue              # Configure fight parameters
├── CombatResults.vue           # Display fight results
├── DamageBreakdown.vue         # Detailed damage analysis
├── CombatTimeline.vue          # Timeline of combat events
├── OpponentConfiguration.vue   # Set up opponent stats
├── WeaponComparison.vue        # Compare weapon effectiveness
├── DefenseAnalysis.vue         # Analyze defensive capabilities
├── CriticalChanceCalculator.vue # Critical hit calculations
└── CombatLogger.vue            # Log combat events
```

### TinkerNanos Components

```typescript
features/tinker-nanos/components/
├── NanoManager.vue             # Main nano management interface
├── NanoCollection.vue          # Display nano collection
├── NanoPlanner.vue             # Plan nano progression
├── CastingSimulator.vue        # Simulate nano casting
├── NanoEffectsTracker.vue      # Track active nano effects
├── NanoSearch.vue              # Search nano database
├── NanoComparison.vue          # Compare nano programs
├── NanoLineup.vue              # Manage nano lineup
├── NanoRequirements.vue        # Check nano requirements
└── NanoEfficiencyCalculator.vue # Calculate nano efficiency
```

### Shared Composables

```typescript
// Reusable composition functions
├── useCharacterData.ts         # Character data management
├── useItemData.ts              # Item data management
├── useNanoData.ts              # Nano data management
├── useSymbiantData.ts          # Symbiant data management
├── useStatCalculations.ts      # Stat calculation logic
├── useEquipmentOptimization.ts # Equipment optimization
├── useCombatSimulation.ts      # Combat simulation logic
├── useDataFiltering.ts         # Data filtering utilities
├── useDataSorting.ts           # Data sorting utilities
├── usePagination.ts            # Pagination logic
├── useLocalStorage.ts          # LocalStorage management
├── useApiCache.ts              # API response caching
├── useSearch.ts                # Search functionality
├── useValidation.ts            # Form validation
├── useNotifications.ts         # Notification system
├── useTheme.ts                 # Theme management
├── usePerformanceMonitoring.ts # Performance tracking
└── useErrorHandling.ts         # Error handling utilities
```

## Component Communication Patterns

### Props Down, Events Up
```typescript
// Parent to Child (Props)
interface ItemCardProps {
  item: Item;
  showDetails?: boolean;
  selectable?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

// Child to Parent (Events)
interface ItemCardEmits {
  select: [item: Item];
  details: [item: Item];
  compare: [item: Item];
  favorite: [item: Item, favorited: boolean];
}
```

### Provide/Inject for Deep Trees
```typescript
// Provide at root level
const characterContext = {
  currentCharacter: readonly(currentCharacter),
  updateCharacter: (updates: Partial<Character>) => void,
  calculateStats: () => ComputedStats,
  validateEquipment: (item: Item) => ValidationResult
};

provide('characterContext', characterContext);

// Inject in deep components
const { currentCharacter, updateCharacter } = inject('characterContext');
```

### Event Bus for Sibling Communication
```typescript
// Global event bus for cross-component communication
interface EventBusEvents {
  'character:updated': Character;
  'equipment:changed': EquipmentChange;
  'calculation:complete': CalculationResult;
  'notification:show': NotificationData;
  'theme:changed': ThemeSettings;
}

const eventBus = createEventBus<EventBusEvents>();
```

## Component Testing Strategy

### Unit Testing Components
```typescript
// Component test example
describe('BaseButton', () => {
  it('renders with correct variant classes', () => {
    const wrapper = mount(BaseButton, {
      props: { variant: 'primary', label: 'Test Button' }
    });
    
    expect(wrapper.classes()).toContain('base-button--primary');
    expect(wrapper.text()).toBe('Test Button');
  });
  
  it('emits click event when clicked', async () => {
    const wrapper = mount(BaseButton);
    await wrapper.trigger('click');
    
    expect(wrapper.emitted('click')).toHaveLength(1);
  });
  
  it('does not emit click when disabled', async () => {
    const wrapper = mount(BaseButton, {
      props: { disabled: true }
    });
    await wrapper.trigger('click');
    
    expect(wrapper.emitted('click')).toBeUndefined();
  });
});
```

### Integration Testing
```typescript
// Integration test for complex components
describe('DataTable Integration', () => {
  it('sorts data when column header clicked', async () => {
    const wrapper = mount(DataTable, {
      props: {
        data: mockData,
        columns: mockColumns
      }
    });
    
    const nameHeader = wrapper.find('[data-testid="header-name"]');
    await nameHeader.trigger('click');
    
    expect(wrapper.emitted('sort')).toHaveLength(1);
    expect(wrapper.emitted('sort')[0]).toEqual(['name', 'asc']);
  });
});
```

## Performance Optimization Patterns

### Virtual Scrolling Implementation
```vue
<template>
  <div class="virtual-scroller" @scroll="handleScroll">
    <div 
      class="virtual-scroller__spacer" 
      :style="{ height: `${spacerHeight}px` }"
    />
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="virtual-scroller__item"
      :style="{ height: `${itemHeight}px` }"
    >
      <slot :item="item" />
    </div>
  </div>
</template>

<script setup lang="ts">
const { visibleItems, spacerHeight, handleScroll } = useVirtualScrolling({
  items: props.items,
  itemHeight: props.itemHeight,
  containerHeight: props.containerHeight
});
</script>
```

### Lazy Component Loading
```typescript
// Lazy load heavy components
const TinkerPlants = defineAsyncComponent(() => 
  import('./features/tinker-plants/TinkerPlants.vue')
);

const TinkerFite = defineAsyncComponent(() => 
  import('./features/tinker-fite/TinkerFite.vue')
);

// With loading and error states
const TinkerNanos = defineAsyncComponent({
  loader: () => import('./features/tinker-nanos/TinkerNanos.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
});
```

## Accessibility Considerations

### ARIA Implementation
```vue
<template>
  <button
    :aria-label="ariaLabel"
    :aria-describedby="describedBy"
    :aria-pressed="pressed"
    :aria-expanded="expanded"
    role="button"
    :tabindex="tabindex"
  >
    <slot />
  </button>
</template>
```

### Keyboard Navigation
```typescript
// Keyboard navigation composable
export function useKeyboardNavigation() {
  const handleKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveNext();
        break;
      case 'ArrowUp':
        event.preventDefault();
        movePrevious();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select();
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  };
  
  return { handleKeydown };
}
```

## Documentation Standards

### Component Documentation Template
```vue
<template>
  <!-- Component template -->
</template>

<script setup lang="ts">
/**
 * BaseButton Component
 * 
 * A reusable button component with multiple variants and states.
 * 
 * @example
 * <BaseButton variant="primary" @click="handleClick">
 *   Click me
 * </BaseButton>
 * 
 * @author TinkerTools Team
 * @version 1.0.0
 */

interface Props {
  /**
   * Button visual variant
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  
  /**
   * Button size
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;
}

interface Emits {
  /**
   * Emitted when button is clicked
   * @param event - The mouse event
   */
  click: [event: MouseEvent];
}
</script>
```

This comprehensive component structure provides a solid foundation for building maintainable, reusable, and performant Vue 3 components for the TinkerTools application while ensuring consistency across all six specialized tools.